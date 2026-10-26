<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { FolderOpen, FileCode, RefreshCw, ArrowUpRight, Square } from '@lucide/vue';
import { useLibraryStore } from '../stores/library';
import { useWorkspaceStore } from '../stores/workspace';
import { useConsoleStore } from '../stores/console';
import { runLabels, type SourceFile, type ToolRun } from '../services/workspace';
import ProjectSelector from './ProjectSelector.vue';
import ChangeReview from './ChangeReview.vue';
import ChangeSetReview from './ChangeSetReview.vue';
import GitPanel from './GitPanel.vue';
import CodeMemoryPanel from './CodeMemoryPanel.vue';
import ArchitectureCheck from './ArchitectureCheck.vue';
import { useChangesStore } from '../stores/changes';
defineProps<{ disabled?: boolean }>();
defineEmits<{ attach: [data: { projectId: string; file?: SourceFile; run?: ToolRun }]; audit: [data: { projectId: string; file: SourceFile }] }>();
const library = useLibraryStore(), workspace = useWorkspaceStore(), consoleStore = useConsoleStore();
const changes = useChangesStore();
const localPath = ref('');
const locked=computed(()=>library.busy||workspace.projectId!==library.projectId);
const setBusy = ref(false);
const gitBusy = ref(false);
const running = computed(() => workspace.runs.some(run => run.status === 'RUNNING'));
const parent = computed(() => workspace.files.directory.split('/').slice(0, -1).join('/'));
watch(() => [library.projectId, workspace.busy] as const, ([id, busy]) => { if (!busy && workspace.projectId !== id) void workspace.load(id); });
onMounted(() => { void workspace.load(library.projectId); });
watch(() => workspace.settings, settings => { localPath.value = settings?.path ?? settings?.allowedRoots[0] ?? ''; });
watch(() => workspace.selectedRun?.status, status => { if (status) consoleStore.setPose(status === 'RUNNING' ? 3 : status === 'PASSED' ? 4 : status === 'CANCELLED' ? 1 : 2); });
const timer = setInterval(() => { if (running.value) void workspace.refreshRuns(); }, 1500);
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <section class="workbench panel workspace-panel"><div class="panel-toolbar"><span class="panel-title">REPOSITORIO / HERRAMIENTAS</span><span class="session-badge">LOCAL</span></div><div class="workbench-content"><span class="eyebrow">CONTEXTO REAL DEL PROYECTO</span><h2>Tu código, conectado</h2><p class="muted">Lee archivos seleccionados, llévalos al chat y ejecuta comprobaciones con resultados guardados.</p>
    <ProjectSelector :disabled="disabled || locked || workspace.busy || changes.busy || setBusy || gitBusy" />
    <p v-if="workspace.error" class="library-error" role="alert">{{ workspace.error }}</p>
    <template v-if="library.status === 'ready' && library.projectId && workspace.settings && workspace.projectId===library.projectId">
      <form v-if="access.admin" class="workspace-connect" @submit.prevent="workspace.connect(localPath)"><label for="local-workspace-path">Carpeta local del proyecto</label><input id="local-workspace-path" v-model="localPath" :disabled="disabled || locked || workspace.busy || running" placeholder="Ruta absoluta de la carpeta" maxlength="2000"/><p class="result-note">Carpetas habilitadas: {{ workspace.settings.allowedRoots.join(' · ') || 'Ninguna. Configura ARES_WORKSPACE_ROOTS en el backend.' }}</p><button class="primary-button" :disabled="disabled || locked || workspace.busy || running || !localPath.trim()">{{ workspace.settings.path ? 'Actualizar carpeta' : 'Conectar carpeta' }} <ArrowUpRight :size="15"/></button></form>
      <template v-if="workspace.settings.path">
        <div class="workspace-breadcrumb"><button class="connection-action" :disabled="workspace.busy || disabled" @click="workspace.browse('')">Raíz</button><span>{{ workspace.files.directory || '/' }}</span><button v-if="workspace.files.directory" class="connection-action" :disabled="workspace.busy || disabled" @click="workspace.browse(parent)">Subir</button><button class="icon-button" aria-label="Actualizar archivos" :disabled="workspace.busy || disabled" @click="workspace.browse(workspace.files.directory)"><RefreshCw :size="15"/></button></div>
        <div class="workspace-files" aria-label="Archivos del repositorio"><button v-for="entry in workspace.files.entries" :key="entry.path" :disabled="workspace.busy || disabled" :class="{ selected: workspace.selected?.path === entry.path }" @click="entry.directory ? workspace.browse(entry.path) : workspace.read(entry.path)"><FolderOpen v-if="entry.directory" :size="16"/><FileCode v-else :size="16"/><span>{{ entry.name }}</span><small>{{ entry.directory ? 'CARPETA' : 'LEER' }}</small></button><p v-if="!workspace.files.entries.length" class="muted">No hay archivos compatibles en esta carpeta.</p></div>
        <p class="result-note">Se omiten credenciales, archivos .env, enlaces y carpetas generadas. Lectura de texto UTF-8 hasta 64 KB por archivo. No se envía el repositorio completo a los modelos.</p><p v-if="workspace.files.truncated" class="result-note">La lista está recortada. Abre una subcarpeta para explorarla.</p>
        <section v-if="workspace.selected" class="source-preview" aria-label="Archivo leído"><div class="result-toolbar"><h3>{{ workspace.selected.path }}</h3><span class="session-badge">{{ workspace.selected.bytes }} B</span></div><p class="source-hash">SHA-256 {{ workspace.selected.sha256 }}</p><p v-if="workspace.selected.redacted" class="result-note">Se ocultaron valores sensibles en esta vista.</p><pre>{{ workspace.selected.content }}</pre><div class="source-actions"><button class="connection-action" :disabled="disabled" @click="$emit('attach', { projectId: library.projectId, file: workspace.selected })">Adjuntar archivo al chat</button><button class="connection-action" :disabled="disabled" @click="$emit('audit', { projectId: library.projectId, file: workspace.selected })">Usar en auditoría</button></div></section>
        <ArchitectureCheck v-if="access.canWrite" :key="library.projectId+workspace.settings.path" :project-id="library.projectId" :file="workspace.selected" :disabled="disabled || locked || workspace.busy || running" />
        <ChangeReview v-if="access.canWrite" :project-id="library.projectId" :file="workspace.selected" :disabled="disabled || locked || workspace.busy || running" @changed="path => workspace.selected?.path === path ? workspace.read(path) : undefined" />
        <ChangeSetReview v-if="access.canWrite" :project-id="library.projectId" :file="workspace.selected" :disabled="disabled || locked || workspace.busy || running || gitBusy" @busy="setBusy = $event" />
        <GitPanel :project-id="library.projectId" :disabled="disabled || locked || workspace.busy || running || setBusy" @busy="gitBusy = $event" />
        <CodeMemoryPanel v-if="access.canWrite" :project-id="library.projectId" :file="workspace.selected" :disabled="disabled || locked || workspace.busy || running || setBusy || gitBusy" />
        <section class="workspace-checks" aria-label="Comprobaciones del proyecto"><h3>Comprobaciones</h3><p class="muted">Abre la carpeta que contiene package.json. Revisa el comando antes de iniciarlo.</p><p v-if="!workspace.preview" class="result-note">Esta carpeta no contiene un package.json disponible.</p><p v-else-if="!workspace.preview.runnerAvailable" class="result-note">npm no está disponible para este runtime.</p><div v-if="workspace.preview" class="script-list"><div v-for="script in workspace.preview.scripts" :key="script.name"><div><strong>{{ script.name }}</strong><code>{{ script.command }}</code></div><button class="connection-action" :disabled="!access.canWrite || disabled || locked || workspace.busy || changes.busy || running || !script.runnable || !workspace.preview.runnerAvailable" @click="workspace.execute(script.name)">Ejecutar {{ script.name }}</button></div></div><p class="result-note">{{ workspace.settings.runnerIsolation === 'docker' ? 'Docker ejecuta una copia filtrada sin red ni carpetas del host: 1 CPU, 1 GB y 90 segundos. Se excluyen secretos, binarios y dependencias locales. La preparación descarga solo dependencias públicas de npm, sin scripts de instalación (hasta 3 minutos). Los resultados no modifican el original.' : 'Ejecutor local explícito: los scripts usan tus permisos del equipo. No hay aislamiento Docker. Límite de 90 segundos y sin hooks pre/post. Este modo se bloquea al compartir.' }}</p>
          <div class="tool-run-list" aria-label="Historial de comprobaciones"><button v-for="run in workspace.runs" :key="run.id" :disabled="disabled" :class="{ selected: workspace.selectedRun?.id === run.id }" @click="workspace.selectedRun = run"><strong>{{ run.directory || '/' }} · {{ run.script }}</strong><span :class="['run-status', run.status.toLowerCase()]">{{ runLabels[run.status] }}</span><small>{{ new Date(run.startedAt).toLocaleString('es-PE') }}</small></button></div>
          <section v-if="workspace.selectedRun" class="run-detail" aria-label="Resultado de comprobación"><h3>{{ workspace.selectedRun.script }} · {{ runLabels[workspace.selectedRun.status] }}</h3><p class="source-hash">{{ workspace.selectedRun.workspacePath }} / {{ workspace.selectedRun.directory || '.' }}</p><pre>{{ workspace.selectedRun.command }}</pre><p class="result-note">{{ workspace.selectedRun.finishedAt ? `Terminó: ${new Date(workspace.selectedRun.finishedAt).toLocaleString('es-PE')}` : 'Comprobación en curso…' }} · Código de salida: {{ workspace.selectedRun.exitCode ?? '—' }}<span v-if="workspace.selectedRun.truncated"> · Salida recortada</span></p><pre class="tool-output">{{ workspace.selectedRun.output || 'Esperando salida…' }}</pre><button v-if="workspace.selectedRun.status === 'RUNNING'" class="connection-action" :disabled="workspace.busy || disabled" @click="workspace.cancel(workspace.selectedRun.id)"><Square :size="12"/> Cancelar comprobación</button><button v-else class="connection-action" :disabled="disabled" @click="$emit('attach', { projectId: library.projectId, run: workspace.selectedRun })">Adjuntar resultado al chat</button></section>
        </section>
      </template>
    </template><p v-if="workspace.busy" role="status" class="result-note">Cargando repositorio…</p>
  </div></section>
</template>
