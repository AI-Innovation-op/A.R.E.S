<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { onMounted, ref, watch } from 'vue';
import { Download, ArrowUpRight, RefreshCw } from '@lucide/vue';
import { useLibraryStore } from '../stores/library';
import { modules } from '../domain/modules';
import type { Artifact } from '../services/library';
import { downloadText } from '../utils/download';
import ProjectSelector from './ProjectSelector.vue';
import MarkdownContent from './MarkdownContent.vue';
import ProjectMemory from './ProjectMemory.vue';
import { changeSetRequest } from '../services/change-sets';
import DocumentEditor from './DocumentEditor.vue';
import { useMemoryStore } from '../stores/memory';
defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ restore: [artifact: Artifact]; workspace: [] }>();
const library = useLibraryStore();
const syncPath = ref('README.md'), syncBusy = ref(false), syncError = ref('');
const documentBusy=ref(false);
function savedDocument(artifact:Artifact){library.selected=artifact;void library.refresh();void useMemoryStore().refresh(library.projectId);}
function deletedDocument(){library.selected=null;void library.refresh();void useMemoryStore().refresh(library.projectId);}
let syncRetry: { key: string; id: string } | undefined;
async function synchronize() {
  if (!library.selected) return; syncBusy.value = true; syncError.value = '';
  const project = library.projectId, artifactId = library.selected.id;
  try { const key = JSON.stringify([project,artifactId,syncPath.value]); if(syncRetry?.key !== key) syncRetry={key,id:crypto.randomUUID()}; await changeSetRequest(project,'/document',{requestId:syncRetry.id,artifactId,path:syncPath.value}); syncRetry=undefined;if(library.projectId===project)emit('workspace'); }
  catch(cause){syncError.value=(cause as Error).message;}finally{syncBusy.value=false;}
}
const date = (value: string) => new Date(value).toLocaleString('es-PE');
watch(() => [library.projectId, library.filter, library.status], () => { library.selected = null; void library.refresh(); });
onMounted(() => { void library.refresh(); });
</script>
<template>
  <section class="panel workbench artifact-library">
    <div class="panel-toolbar"><span class="panel-title">BIBLIOTECA / PROYECTOS</span><span class="session-badge">{{ library.status === 'ready' ? 'POSTGRESQL' : 'SIN CONEXIÓN' }}</span></div>
    <div class="workbench-content"><span class="eyebrow">EL TRABAJO QUE PERMANECE</span><h2>Tu biblioteca técnica</h2><p class="muted">Recupera los borradores de documentación, auditoría y arquitectura de cada proyecto.</p>
      <ProjectSelector :disabled="disabled || syncBusy || documentBusy" />
      <ProjectMemory v-if="library.status === 'ready' && library.projectId" :project-id="library.projectId" :disabled="disabled" />
      <template v-if="library.status === 'ready' && library.projectId">
        <div class="library-filters"><label for="artifact-filter">Módulo</label><select id="artifact-filter" v-model="library.filter" :disabled="library.busy || disabled || documentBusy || syncBusy"><option value="">Todos los módulos</option><option value="documentation">Documentación</option><option value="audit">Auditoría</option><option value="architecture">Arquitectura</option></select><button class="icon-button" aria-label="Actualizar biblioteca" :disabled="library.busy || disabled || documentBusy || syncBusy" @click="library.refresh()"><RefreshCw :size="16" /></button></div>
        <p v-if="!library.artifacts.length && !library.busy" class="library-empty">Aún no hay borradores en este proyecto. Genera uno desde los módulos para guardarlo aquí.</p>
        <div class="artifact-list" aria-label="Borradores guardados"><button v-for="item in library.artifacts" :key="item.id" class="artifact-card" :class="{ selected: library.selected?.id === item.id }" :disabled="library.busy || disabled || documentBusy || syncBusy" @click="library.open(item.id)"><span class="eyebrow">{{ modules[item.module].title }}</span><strong>{{ item.title }}</strong><span>{{ item.format }} · {{ date(item.createdAt) }}</span><small>{{ item.provider === 'gemini' ? 'GEMINI' : 'OPENROUTER' }} · {{ item.model }}</small><span class="draft-label">{{ item.status === 'APPROVED' ? 'APROBADO' : 'BORRADOR' }}</span></button></div>
        <button v-if="library.hasMore" class="connection-action" :disabled="library.busy || disabled || documentBusy || syncBusy" @click="library.refresh(true)">Cargar borradores anteriores</button>
        <p v-if="library.busy" role="status">Cargando biblioteca…</p>
        <section v-if="library.selected" class="module-result" aria-label="Borrador guardado"><div class="result-toolbar"><h3>{{ library.selected.title }}</h3><button class="icon-button" aria-label="Descargar borrador guardado" @click="downloadText(`ares-${library.selected.module}-${library.selected.id}.md`, library.selected.content)"><Download :size="17" /></button></div><p class="response-provider">{{ library.selected.provider.toUpperCase() }} · {{ library.selected.model }}</p><p class="result-note">{{ library.selected.status === 'APPROVED' ? 'APROBADO' : 'BORRADOR' }} · {{ date(library.selected.createdAt) }}</p><MarkdownContent :content="library.selected.content" /><details class="artifact-context"><summary>Ver contexto original</summary><pre>{{ library.selected.context }}</pre></details><button class="connection-action" :disabled="disabled || syncBusy" @click="$emit('restore', library.selected)">Abrir en el módulo <ArrowUpRight :size="15" /></button><form v-if="access.canWrite" class="documentation-sync" @submit.prevent="synchronize"><label for="sync-document-path">Archivo de documentación en el repositorio</label><input id="sync-document-path" v-model="syncPath" maxlength="1000" placeholder="docs/guia.md" :disabled="disabled || syncBusy"/><p class="result-note">Crea una propuesta desde el contenido guardado, sin consultar al modelo. Requiere una carpeta conectada y destino .md, .yaml o .yml. Revisa y aplica el diff en Conjunto de cambios; después puedes incluir el documento en un commit.</p><button class="connection-action" :disabled="disabled || syncBusy || !syncPath.trim()">Revisar sincronización con repositorio</button><p v-if="syncError" role="alert" class="library-error">{{ syncError }}</p></form></section>
        <DocumentEditor v-if="library.selected && access.canWrite" :artifact="library.selected" :disabled="disabled || syncBusy || library.busy" @busy="documentBusy=$event" @saved="savedDocument" @deleted="deletedDocument"/>
      </template>
    </div>
  </section>
</template>
<style scoped>.documentation-sync{display:grid;gap:10px;margin-top:24px}.documentation-sync input{background:#08151a;border:1px solid #29434b;color:#dcebf0;padding:12px;border-radius:6px}.documentation-sync button{justify-self:start}</style>
