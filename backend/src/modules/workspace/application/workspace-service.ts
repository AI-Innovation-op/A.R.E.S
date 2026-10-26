import { scripts, type FileReference, type RunInput, type ScriptPreview, type ToolRun, type WorkspaceReader, type WorkspaceRepository } from '../domain/workspace.js';
import { LocalFiles } from '../infrastructure/local-files.js';
import { type CheckRunner, type RunningCheck } from '../infrastructure/local-runner.js';
import { HttpError } from '../../../shared/http-error.js';
import { checkArchitecture, type ArchitectureAlias } from '../domain/architecture.js';
export class WorkspaceService implements WorkspaceReader {
  private readonly active = new Map<string, { check: RunningCheck; saving: Promise<void> }>();
  private launching = false;
  constructor(private readonly repository: WorkspaceRepository, private readonly files: LocalFiles, private readonly runner: CheckRunner) {}
  async settings(projectId: string) { return { ...await this.repository.link(projectId), allowedRoots: this.files.allowedRoots, runnerAvailable: this.runner.available,runnerIsolation:this.runner.isolation??'local' }; }
  async assertSettled(projectId: string) { if (await this.repository.pendingChanges(projectId)) throw new HttpError(409,'CHANGE_PENDING','Completa o restaura los cambios pendientes antes de continuar.'); }
  async connect(projectId: string, input: string) {
    return this.exclusive(async () => { await this.repository.link(projectId); return this.repository.connect(projectId, await this.files.root(input)); });
  }
  async exclusive<T>(operation: () => Promise<T>) {
    if (this.launching || this.active.size) throw new HttpError(409, 'TOOL_BUSY', 'Espera a que termine la operación del repositorio antes de continuar.');
    this.launching = true;
    try { return await operation(); } finally { this.launching = false; }
  }
  private async root(projectId: string) {
    const link = await this.repository.link(projectId);
    if (!link.path) throw new HttpError(409, 'WORKSPACE_NOT_CONNECTED', 'Conecta la carpeta local del proyecto.');
    return this.files.root(link.path);
  }
  async list(projectId: string, directory = '') { return this.files.list(await this.root(projectId), directory); }
  async read(projectId: string, relative: string) { return this.files.read(await this.root(projectId), relative); }
  async architecture(projectId: string, references: FileReference[], aliases: ArchitectureAlias[]) {
    const root = await this.root(projectId), sources = []; let bytes = 0;
    for (const reference of references) {
      const source = await this.files.read(root, reference.path);
      if (source.redacted) throw new HttpError(400, 'SOURCE_REDACTED', 'Retira los valores sensibles antes de comprobar este archivo.');
      if (source.sha256 !== reference.sha256) throw new HttpError(409, 'SOURCE_CHANGED', 'Un archivo cambió. Vuelve a leerlo y selecciónalo otra vez.');
      bytes += source.bytes; if (bytes > 512 * 1024) throw new HttpError(413, 'ARCHITECTURE_TOO_LARGE', 'Selecciona como máximo 512 KB de código por comprobación.');
      sources.push(source);
    }
    if (await this.root(projectId) !== root) throw new HttpError(409, 'SOURCE_CHANGED', 'La carpeta conectada cambió durante la comprobación.');
    return checkArchitecture(sources, aliases);
  }
  private async manifest(projectId: string, directory: string) {
    const root = await this.root(projectId);
    const cwd = await this.files.resolve(root, directory, true);
    const source = await this.files.read(root, [directory, 'package.json'].filter(Boolean).join('/'));
    if (source.redacted) throw new HttpError(400, 'MANIFEST_CONTAINS_SECRETS', 'El package.json contiene valores sensibles. Retíralos antes de ejecutar comprobaciones.');
    let data: unknown; try { data = JSON.parse(source.content); } catch { throw new HttpError(400, 'INVALID_MANIFEST', 'El package.json no contiene JSON válido.'); }
    const values = typeof data === 'object' && data && 'scripts' in data && typeof data.scripts === 'object' && data.scripts ? data.scripts as Record<string, unknown> : {};
    const entries = scripts.flatMap(name => typeof values[name] === 'string' && values[name].trim() ? [{ name, command: values[name] as string, runnable: (values[name] as string).length <= 2000 }] : []);
    const preview: ScriptPreview = { directory, manifestHash: source.sha256, scripts: entries, runnerAvailable: this.runner.available };
    return { preview, cwd, root };
  }
  async preview(projectId: string, directory = '') { return (await this.manifest(projectId, directory)).preview; }
  private async recover(run: ToolRun) {
    if (run.status === 'RUNNING' && !this.active.has(run.id) && !this.launching) {
      await this.repository.finish(run.id, 'INTERRUPTED', `${run.output}\nNo se pudo recuperar un resultado confirmado de esta ejecución.`, run.truncated, null);
      return this.repository.run(run.projectId, run.id);
    }
    return run;
  }
  async runs(projectId: string) {
    const runs = await this.repository.runs(projectId);
    return Promise.all(runs.map(async item => { const run = await this.recover(item); return { ...run, ...this.active.get(run.id)?.check.snapshot() }; }));
  }
  async run(projectId: string, id: string) { const run = await this.recover(await this.repository.run(projectId, id)); return { ...run, ...this.active.get(id)?.check.snapshot() }; }
  async execute(input: RunInput) {
    const existing = await this.repository.previous(input); if (existing) return this.run(input.projectId, existing.id);
    if (this.launching || this.active.size) throw new HttpError(409, 'TOOL_BUSY', 'Ya hay una comprobación en ejecución.');
    this.launching = true;
    try {
      if (await this.repository.pendingChanges(input.projectId)) throw new HttpError(409, 'CHANGE_PENDING', 'Confirma la aplicación o restauración pendiente antes de ejecutar comprobaciones.');
      const { preview, cwd, root } = await this.manifest(input.projectId, input.directory);
      if (preview.manifestHash !== input.manifestHash) throw new HttpError(409, 'MANIFEST_CHANGED', 'El package.json cambió. Actualiza los scripts antes de ejecutar.');
      const script = preview.scripts.find(item => item.name === input.script && item.runnable);
      if (!script) throw new HttpError(400, 'SCRIPT_NOT_ALLOWED', 'Selecciona un script disponible: check, test, lint o build.');
      if (!this.runner.available) throw new HttpError(503, 'RUNNER_UNAVAILABLE', 'El ejecutor no está disponible. Comprueba Docker y ejecuta npm run runner:prepare.');
      const { run, created } = await this.repository.start(input, `npm --ignore-scripts run ${input.script}\n${script.command}`, root);
      if (!created) return run;
      let check: RunningCheck;
      try { check = this.runner.start(cwd, input.script, root); }
      catch { await this.repository.finish(run.id, 'FAILED', 'No se pudo iniciar la comprobación.', false, null); return this.repository.run(input.projectId, run.id); }
      const saving = check.done.then(result => this.repository.finish(run.id, result.status, result.output, result.truncated, result.exitCode))
        .catch(() => { console.error('No se pudo registrar el resultado de una comprobación local.'); })
        .finally(() => { this.active.delete(run.id); });
      this.active.set(run.id, { check, saving });
      return run;
    } finally { this.launching = false; }
  }
  async cancel(projectId: string, id: string) { const run = await this.repository.run(projectId, id); this.active.get(run.id)?.check.cancel(); return this.run(projectId, id); }
  async shutdown() { for (const { check } of this.active.values()) check.cancel('INTERRUPTED'); await Promise.all([...this.active.values()].map(value => value.saving)); }
  async context(projectId: string, references: FileReference[], runIds: string[]) {
    const files = [];
    for (const reference of references) {
      const file = await this.read(projectId, reference.path);
      if (file.sha256 !== reference.sha256) throw new HttpError(409, 'SOURCE_CHANGED', `El archivo ${reference.path} cambió. Vuelve a leerlo antes de enviar.`);
      files.push({ ...file, content: file.content.slice(0, 4000), truncated: file.content.length > 4000 });
    }
    const runs: ToolRun[] = [];
    for (const id of runIds) {
      const run = await this.repository.run(projectId, id);
      if (run.status === 'RUNNING') throw new HttpError(409, 'RUN_NOT_FINISHED', 'Espera a que termine la comprobación antes de adjuntarla.');
      runs.push({ ...run, output: this.files.redact(run.output).slice(-6000), truncated: run.truncated || run.output.length > 6000 });
    }
    return { projectId, sourceRoot: (await this.repository.link(projectId)).path, files, runs };
  }
}
