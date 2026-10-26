import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ModuleId } from '../domain/modules';
import { createProject, listProjects, listArtifacts, readArtifact, type Project, type ArtifactSummary, type Artifact } from '../services/library';

export const useLibraryStore = defineStore('library', () => {
  const status = ref<'loading' | 'ready' | 'offline'>('loading');
  const busy = ref(false), error = ref('');
  const projects = ref<Project[]>([]), projectId = ref('');
  const currentProject = computed(() => projects.value.find(project => project.id === projectId.value));
  const filter = ref<ModuleId | ''>('');
  const artifacts = ref<ArtifactSummary[]>([]), hasMore = ref(false), selected = ref<Artifact | null>(null);
  function remember() { try { localStorage.setItem('ares.activeProject', projectId.value); } catch { /* La base conserva los datos. */ } }
  let initialization: Promise<void> | undefined;
  function initialize(): Promise<void> {
    if (initialization) return initialization;
    if (busy.value) return Promise.resolve();
    busy.value = true; error.value = '';
    initialization = (async () => {
    try {
      projects.value = await listProjects(); status.value = 'ready';
      let previous = projectId.value; try { previous ||= localStorage.getItem('ares.activeProject') ?? ''; } catch { /* Sin almacenamiento local. */ }
      projectId.value = projects.value.find(project => project.id === previous)?.id ?? projects.value[0]?.id ?? '';
      remember();
    } catch { status.value = 'offline'; }
    finally { busy.value = false; initialization = undefined; }
    })();
    return initialization;
  }
  async function addProject(name: string) {
    if (busy.value || !name.trim()) return;
    busy.value = true; error.value = '';
    try {
      const created = await createProject(name.trim()); projects.value.push(created); projectId.value = created.id;
      artifacts.value = []; selected.value = null; hasMore.value = false; remember();
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo crear el proyecto.'; return false; }
    finally { busy.value = false; }
  }
  function selectProject(id: string) {
    projectId.value = id; artifacts.value = []; selected.value = null; hasMore.value = false; remember();
  }
  async function refresh(more = false) {
    if (busy.value || !projectId.value || status.value !== 'ready') return;
    busy.value = true; error.value = '';
    try {
      const page = await listArtifacts(projectId.value, filter.value || undefined, more ? artifacts.value.at(-1)?.sequence : undefined);
      artifacts.value = more ? [...artifacts.value, ...page.artifacts] : page.artifacts;
      hasMore.value = page.hasMore;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la biblioteca.'; }
    finally { busy.value = false; }
  }
  async function open(id: string) {
    // A citation can be clicked while the project list is still loading after refresh.
    if (initialization) await initialization;
    if (busy.value) return;
    busy.value = true; error.value = '';
    try { selected.value = await readArtifact(id); }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el borrador.'; }
    finally { busy.value = false; }
  }
  return { status, busy, error, projects, projectId, currentProject, filter, artifacts, hasMore, selected, initialize, addProject, selectProject, refresh, open };
});
