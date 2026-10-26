import { defineStore } from 'pinia';
import { ref } from 'vue';
import { memoryRequest, type MemoryStatus } from '../services/memory';
export const useMemoryStore = defineStore('memory', () => {
  const statuses = ref<Record<string, MemoryStatus>>({});
  const errors = ref<Record<string, string>>({});
  const busyProject = ref('');
  let controller: AbortController | undefined;
  async function refresh(projectId: string) {
    if (!projectId || busyProject.value === projectId) return;
    errors.value[projectId] = '';
    try { statuses.value[projectId] = await memoryRequest(projectId); }
    catch { errors.value[projectId] = 'La memoria no está disponible. Comprueba PostgreSQL y vuelve a actualizar.'; }
  }
  async function prepare(projectId: string) {
    if (busyProject.value || !projectId) return;
    busyProject.value = projectId; errors.value[projectId] = '';
    const requestController = new AbortController(); controller = requestController;
    try {
      let status = await memoryRequest(projectId, false, requestController.signal);
      statuses.value[projectId] = status;
      while (status.pendingDocuments && !requestController.signal.aborted) {
        status = await memoryRequest(projectId, true, requestController.signal);
        statuses.value[projectId] = status;
      }
    } catch (cause) {
      errors.value[projectId] = requestController.signal.aborted ? 'Preparación pausada. Los fragmentos ya guardados se conservan; puedes reanudar.' : cause instanceof Error ? cause.message : 'No se pudo preparar la memoria.';
    } finally { busyProject.value = ''; controller = undefined; }
  }
  function pause() { controller?.abort(); }
  return { statuses, errors, busyProject, refresh, prepare, pause };
});
