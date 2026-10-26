import type { Pool, QueryResultRow } from 'pg';
import type { RunInput, RunStatus, ToolRun, WorkspaceRepository } from '../domain/workspace.js';
import { HttpError } from '../../../shared/http-error.js';
interface RunRow extends QueryResultRow { id: string; repository_id: string; request_id: string; package_path: string; workspace_path: string; script: ToolRun['script']; manifest_hash: string; command: string; status: RunStatus; output: string; truncated: boolean; exit_code: number | null; started_at: Date; finished_at: Date | null }
const run = (row: RunRow): ToolRun => ({ id: row.id, projectId: row.repository_id, requestId: row.request_id, directory: row.package_path, workspacePath: row.workspace_path, script: row.script, manifestHash: row.manifest_hash, command: row.command, status: row.status, output: row.output, truncated: row.truncated, exitCode: row.exit_code, startedAt: row.started_at.toISOString(), finishedAt: row.finished_at?.toISOString() ?? null });
export class PostgresWorkspace implements WorkspaceRepository {
  constructor(private readonly pool: Pool, private readonly owner: string) {}
  async link(projectId: string) {
    const result = await this.pool.query<{ local_path: string | null; connected_at: Date | null }>('SELECT local_path,connected_at FROM repositories WHERE id=$1 AND commander_id=$2', [projectId, this.owner]);
    const row = result.rows[0]; if (!row) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'No se encontró este proyecto.');
    return { projectId, path: row.local_path, ...(row.connected_at ? { connectedAt: row.connected_at.toISOString() } : {}) };
  }
  async connect(projectId: string, path: string) {
    await this.link(projectId);
    if (await this.pendingChanges(projectId)) throw new HttpError(409, 'CHANGE_PENDING', 'Confirma o recupera la aplicación pendiente antes de cambiar la carpeta.');
    const running = await this.pool.query("SELECT 1 FROM tool_runs WHERE repository_id=$1 AND status='RUNNING'", [projectId]);
    if (running.rows.length) throw new HttpError(409, 'TOOL_BUSY', 'Espera a que termine la comprobación antes de cambiar la carpeta.');
    await this.pool.query('UPDATE repositories SET local_path=$1,connected_at=NOW() WHERE id=$2 AND commander_id=$3', [path, projectId, this.owner]);
    return this.link(projectId);
  }
  async runs(projectId: string) {
    await this.link(projectId);
    const result = await this.pool.query<RunRow>('SELECT * FROM tool_runs WHERE repository_id=$1 AND commander_id=$2 ORDER BY started_at DESC,id LIMIT 30', [projectId, this.owner]);
    return result.rows.map(run);
  }
  async run(projectId: string, id: string) {
    const result = await this.pool.query<RunRow>('SELECT * FROM tool_runs WHERE id=$1 AND repository_id=$2 AND commander_id=$3', [id, projectId, this.owner]);
    if (!result.rows[0]) throw new HttpError(404, 'RUN_NOT_FOUND', 'No se encontró esta comprobación.');
    return run(result.rows[0]);
  }
  async previous(input: RunInput) {
    await this.link(input.projectId);
    const result = await this.pool.query<RunRow>('SELECT * FROM tool_runs WHERE repository_id=$1 AND request_id=$2 AND commander_id=$3', [input.projectId, input.requestId, this.owner]);
    if (!result.rows[0]) return;
    const previous = run(result.rows[0]);
    if (previous.directory !== input.directory || previous.script !== input.script || previous.manifestHash !== input.manifestHash) throw new HttpError(409, 'REQUEST_MISMATCH', 'Este identificador ya se usó para otra comprobación.');
    return previous;
  }
  async start(input: RunInput, command: string, workspacePath: string) {
    await this.link(input.projectId);
    try {
      const result = await this.pool.query<RunRow>(`INSERT INTO tool_runs (commander_id,repository_id,request_id,package_path,script,manifest_hash,command,workspace_path)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [this.owner, input.projectId, input.requestId, input.directory, input.script, input.manifestHash, command, workspacePath]);
      return { run: run(result.rows[0]!), created: true };
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        const previous = await this.previous(input); if (previous) return { run: previous, created: false };
        throw new HttpError(409, 'TOOL_BUSY', 'Ya hay una comprobación en ejecución. Espera a que termine.');
      }
      throw error;
    }
  }
  async finish(id: string, status: Exclude<RunStatus, 'RUNNING'>, output: string, truncated: boolean, exitCode: number | null) {
    await this.pool.query("UPDATE tool_runs SET status=$1,output=$2,truncated=$3,exit_code=$4,finished_at=NOW() WHERE id=$5 AND commander_id=$6 AND status='RUNNING'", [status, output, truncated, exitCode, id, this.owner]);
  }
  async interrupt() { await this.pool.query("UPDATE tool_runs SET status='INTERRUPTED',finished_at=NOW(),output=output||E'\nEl servidor se reinició antes de registrar el resultado.' WHERE commander_id=$1 AND status='RUNNING'", [this.owner]); }
  async pendingChanges(projectId: string) {
    await this.link(projectId);
    return (await this.pool.query("SELECT 1 FROM change_proposals WHERE repository_id=$1 AND status IN ('APPLYING','REVERTING') UNION ALL SELECT 1 FROM change_sets WHERE repository_id=$1 AND status IN ('APPLYING','REVERTING') LIMIT 1", [projectId])).rows.length > 0;
  }
}
