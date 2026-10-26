<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { computed, watch } from 'vue';
import { RefreshCw, Database, Square } from '@lucide/vue';
import { useMemoryStore } from '../stores/memory';
const props = defineProps<{ projectId: string; disabled?: boolean }>();
const memory = useMemoryStore();
const status = computed(() => memory.statuses[props.projectId]);
const busy = computed(() => memory.busyProject === props.projectId);
watch(() => props.projectId, id => { if (id) void memory.refresh(id); }, { immediate: true });
</script>
<template>
  <section v-if="projectId" class="project-memory" aria-label="Memoria del proyecto">
    <div class="memory-heading"><Database :size="14"/><strong>Memoria del proyecto</strong><button class="icon-button" aria-label="Actualizar estado de memoria" :disabled="!access.canWrite || busy || disabled" @click="memory.refresh(projectId)"><RefreshCw :size="13"/></button></div>
    <template v-if="status"><p role="status">{{ status.indexedDocuments }} de {{ status.documents }} documentos listos · {{ status.chunks }} fragmentos<span v-if="status.pendingDocuments"> · {{ status.pendingDocuments }} pendientes</span><span v-if="status.codeFiles"> · Código: {{ status.indexedCodeFiles }} de {{ status.codeFiles }} archivos vigentes</span></p><div class="memory-actions"><button v-if="busy" type="button" class="connection-action" @click="memory.pause"><Square :size="12"/> Pausar preparación</button><button v-else-if="status.pendingDocuments" type="button" class="connection-action" :disabled="disabled || !!memory.busyProject || !status.configured" @click="memory.prepare(projectId)">Preparar memoria</button><small>{{ busy ? 'Preparando fragmentos…' : !status.configured ? 'Configura Gemini para usar la memoria.' : !status.documents && !status.codeFiles ? 'Guarda un documento o indexa un archivo desde Repositorio.' : 'Consulta las fuentes preparadas desde el chat.' }}</small></div></template>
    <p v-if="memory.errors[projectId]" class="library-error" role="status">{{ memory.errors[projectId] }}</p>
  </section>
</template>
