import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workspaceRequest, type WorkspaceSettings, type FilePage, type SourceFile, type ScriptPreview, type ToolRun, type ScriptName } from '../services/workspace';
export const useWorkspaceStore = defineStore('workspace', () => {
  const projectId = ref(''), busy = ref(false), error = ref('');
  const settings = ref<WorkspaceSettings | null>(null), files = ref<FilePage>({ directory: '', entries: [], truncated: false });
  const selected = ref<SourceFile | null>(null), preview = ref<ScriptPreview | null>(null), runs = ref<ToolRun[]>([]), selectedRun = ref<ToolRun | null>(null);
  let retry: { key: string; id: string } | undefined;
  async function operation(action: () => Promise<void>) {
    if (busy.value) return;
    busy.value = true; error.value = '';
    try { await action(); } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo completar la operación.'; }
    finally { busy.value = false; }
  }
  async function directoryContents(directory: string) {
    files.value = await workspaceRequest<FilePage>(projectId.value, `/files?directory=${encodeURIComponent(directory)}`);
    selected.value = null; preview.value = null;
    if (files.value.entries.some(entry => entry.name === 'package.json' && !entry.directory)) preview.value = await workspaceRequest<ScriptPreview>(projectId.value, `/scripts?directory=${encodeURIComponent(directory)}`);
  }
  async function load(id: string) {
    await operation(async () => {
      projectId.value = id; settings.value = null; selected.value = null; selectedRun.value = null; preview.value = null; runs.value = []; files.value = { directory: '', entries: [], truncated: false };
      if (!id) return;
      settings.value = await workspaceRequest<WorkspaceSettings>(id);
      runs.value = (await workspaceRequest<{ runs: ToolRun[] }>(id, '/runs')).runs;
      if (settings.value.path) await directoryContents('');
    });
  }
  async function connect(path: string) {
    await operation(async () => { await workspaceRequest(projectId.value, '', { path }); settings.value = await workspaceRequest<WorkspaceSettings>(projectId.value); await directoryContents(''); });
  }
  async function browse(directory: string) { await operation(() => directoryContents(directory)); }
  async function read(path: string) { await operation(async () => { selected.value = (await workspaceRequest<{ file: SourceFile }>(projectId.value, `/file?path=${encodeURIComponent(path)}`)).file; }); }
  async function refreshRuns() {
    if (!projectId.value || busy.value) return;
    const target = projectId.value;
    try {
      const data = await workspaceRequest<{ runs: ToolRun[] }>(target, '/runs');
      if (projectId.value !== target) return;
      runs.value = data.runs;
      if (selectedRun.value) selectedRun.value = data.runs.find(run => run.id === selectedRun.value?.id) ?? selectedRun.value;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudieron actualizar las comprobaciones.'; }
  }
  async function execute(script: ScriptName) {
    if (!preview.value) return;
    await operation(async () => {
      const current = preview.value!;
      const key = JSON.stringify([projectId.value, current.directory, current.manifestHash, script]);
      if (retry?.key !== key) retry = { key, id: crypto.randomUUID() };
      const { run } = await workspaceRequest<{ run: ToolRun }>(projectId.value, '/runs', { requestId: retry!.id, directory: current.directory, script, manifestHash: current.manifestHash });
      retry = undefined; selectedRun.value = run; runs.value = [run, ...runs.value.filter(item => item.id !== run.id)];
    });
  }
  async function cancel(id: string) { await operation(async () => { await workspaceRequest(projectId.value, `/runs/${encodeURIComponent(id)}/cancel`, {}); }); await refreshRuns(); }
  return { projectId, busy, error, settings, files, selected, preview, runs, selectedRun, load, connect, browse, read, execute, refreshRuns, cancel };
});
