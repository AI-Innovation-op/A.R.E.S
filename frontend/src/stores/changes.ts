import { defineStore } from 'pinia';
import { ref } from 'vue';
import { changeRequest, type Proposal, type ProposalSummary } from '../services/changes';
import type { SourceFile } from '../services/workspace';
export const useChangesStore = defineStore('changes', () => {
  const projectId = ref(''), busy = ref(false), generating = ref(false), error = ref('');
  const proposals = ref<ProposalSummary[]>([]), selected = ref<Proposal | null>(null);
  let controller: AbortController | undefined;
  let retry: { key: string; id: string } | undefined;
  async function list(id = projectId.value) { const data = await changeRequest<{ proposals: ProposalSummary[] }>(id); if (id === projectId.value) proposals.value = data.proposals; }
  async function load(id: string) {
    if (busy.value || !id) return;
    projectId.value = id; selected.value = null; proposals.value = []; error.value = ''; busy.value = true;
    try { await list(id); } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las propuestas.'; }
    finally { busy.value = false; }
  }
  async function refresh() {
    if (busy.value || !projectId.value) return;
    busy.value = true; error.value = '';
    try {
      await list();
      if (selected.value) selected.value = (await changeRequest<{ proposal: Proposal }>(projectId.value, `/${encodeURIComponent(selected.value.id)}`)).proposal;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las propuestas.'; }
    finally { busy.value = false; }
  }
  async function open(id: string) {
    if (busy.value) return; busy.value = true; error.value = '';
    try { selected.value = (await changeRequest<{ proposal: Proposal }>(projectId.value, `/${encodeURIComponent(id)}`)).proposal; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo abrir la propuesta.'; }
    finally { busy.value = false; }
  }
  async function generate(file: SourceFile, instruction: string) {
    if (busy.value || !instruction.trim()) return;
    const target = projectId.value;
    const key = JSON.stringify([target, file.path, file.sha256, instruction.trim()]);
    if (retry?.key !== key) retry = { key, id: crypto.randomUUID() };
    const requestController = new AbortController(); controller = requestController; busy.value = true; generating.value = true; error.value = '';
    try {
      const data = await changeRequest<{ proposal: Proposal }>(target, '', { requestId: retry!.id, path: file.path, sha256: file.sha256, instruction: instruction.trim() }, requestController.signal);
      if (target === projectId.value && !requestController.signal.aborted) selected.value = data.proposal;
      retry = undefined; await list(target);
    } catch (cause) { error.value = requestController.signal.aborted ? 'Se canceló la espera. La propuesta puede terminar en el servidor; actualiza la lista para recuperarla.' : cause instanceof Error ? cause.message : 'No se pudo generar la propuesta.'; }
    finally { busy.value = false; generating.value = false; controller = undefined; }
  }
  function cancel() { controller?.abort(); }
  async function act(action: 'apply' | 'revert' | 'reject') {
    if (busy.value || !selected.value) return false;
    const current = selected.value; busy.value = true; error.value = '';
    try {
      selected.value = (await changeRequest<{ proposal: Proposal }>(current.projectId, `/${encodeURIComponent(current.id)}/${action}`, action === 'reject' ? {} : { approvedHash: current.afterHash })).proposal;
      await list(current.projectId).catch(() => { error.value = 'La operación se confirmó, pero no se pudo actualizar la lista. Pulsa actualizar.'; }); return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo confirmar la operación.'; return false; }
    finally { busy.value = false; }
  }
  return { projectId, busy, generating, error, proposals, selected, load, refresh, open, generate, cancel, act };
});
