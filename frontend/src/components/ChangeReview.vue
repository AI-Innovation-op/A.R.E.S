<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import ComparativeDiff from './ComparativeDiff.vue';
import { Download, RefreshCw, Square } from '@lucide/vue';
import { useChangesStore } from '../stores/changes';
import { proposalLabels } from '../services/changes';
import type { SourceFile } from '../services/workspace';
import { downloadText } from '../utils/download';
const props = defineProps<{ projectId: string; file: SourceFile | null; disabled?: boolean }>();
const emit = defineEmits<{ changed: [path: string] }>();
const changes = useChangesStore(), instruction = ref('');
const lines = computed(() => (changes.selected?.patch ?? '').split('\n'));
const fileEligible = computed(() => props.file && !props.file.redacted && props.file.content.length <= 6000);
watch(() => [props.projectId, changes.busy] as const, ([id, busy]) => { if (!busy && id !== changes.projectId) void changes.load(id); });
onMounted(() => { void changes.load(props.projectId); });
async function act(action: 'apply' | 'revert' | 'reject') {
  if (await changes.act(action)) { if (action !== 'reject' && changes.selected) emit('changed', changes.selected.path); }
}
</script>
<template>
  <section class="change-review" aria-label="Propuestas de cambio"><div class="result-toolbar"><h3>Cambios para revisar</h3><button class="icon-button" aria-label="Actualizar propuestas" :disabled="disabled || changes.busy" @click="changes.refresh"><RefreshCw :size="15"/></button></div><p class="muted">Describe un cambio para el archivo leído. OpenRouter preparará una propuesta; podrás revisar el diff antes de escribirla.</p>
    <form v-if="file" @submit.prevent="changes.generate(file, instruction)"><p class="source-hash">Archivo seleccionado: {{ file.path }}</p><label for="change-instruction">Cambio que quieres proponer</label><textarea id="change-instruction" v-model="instruction" rows="3" maxlength="2500" placeholder="Ejemplo: añade validación de entrada conservando el comportamiento actual…" :disabled="disabled || changes.busy"/><p v-if="!fileEligible" class="result-note">Elige un archivo sin valores sensibles y de hasta 6000 caracteres para generar una propuesta completa.</p><div class="source-actions"><button v-if="changes.generating" type="button" class="connection-action" @click="changes.cancel"><Square :size="12"/> Cancelar espera</button><button v-else class="primary-button" :disabled="disabled || changes.busy || !fileEligible || !instruction.trim()">Generar propuesta</button></div></form>
    <p v-else class="result-note">Lee un archivo en el explorador para preparar un cambio.</p><p v-if="changes.error" class="library-error" role="alert">{{ changes.error }}</p>
    <div class="proposal-list" aria-label="Historial de propuestas"><button v-for="proposal in changes.proposals" :key="proposal.id" :disabled="disabled || changes.busy" :class="{ selected: changes.selected?.id === proposal.id }" @click="changes.open(proposal.id)"><strong>{{ proposal.path }}</strong><span>{{ proposalLabels[proposal.status] }}</span><small>{{ proposal.summary }}</small></button></div>
    <section v-if="changes.selected" class="proposal-detail" aria-label="Diff de la propuesta"><p class="draft-label">{{ proposalLabels[changes.selected.status] }} · {{ changes.selected.model }}</p><h3>{{ changes.selected.path }}</h3><p class="proposal-summary">{{ changes.selected.summary }}</p><p class="source-hash">Carpeta: {{ changes.selected.workspacePath }}<br/>Original: {{ changes.selected.beforeHash }}<br/>Propuesta: {{ changes.selected.afterHash }}</p><ComparativeDiff :key="changes.selected.id" :before="changes.selected.beforeContent" :after="changes.selected.afterContent" :path="changes.selected.path"/><details><summary>Ver parche de texto</summary><div class="proposal-diff" role="region" aria-label="Comparación de cambios"><div v-for="(line, index) in lines" :key="index" :class="{ addition: line.startsWith('+') && !line.startsWith('+++'), removal: line.startsWith('-') && !line.startsWith('---'), hunk: line.startsWith('@@') }">{{ line || ' ' }}</div></div></details><p v-if="changes.selected.lastError" class="library-error">{{ changes.selected.lastError }}</p>
      <div class="source-actions"><button v-if="['DRAFT','APPLYING'].includes(changes.selected.status)" class="primary-button" :disabled="disabled || changes.busy" @click="act('apply')">{{ changes.selected.status === 'APPLYING' ? 'Comprobar aplicación' : 'Aplicar este cambio' }}</button><button v-if="['APPLIED','REVERTING'].includes(changes.selected.status)" class="connection-action" :disabled="disabled || changes.busy" @click="act('revert')">{{ changes.selected.status === 'REVERTING' ? 'Comprobar restauración' : 'Restaurar original' }}</button><button v-if="changes.selected.status === 'DRAFT'" class="connection-action" :disabled="disabled || changes.busy" @click="act('reject')">Descartar propuesta</button><button class="connection-action" @click="downloadText(`ares-${changes.selected.id}.patch`, changes.selected.patch, 'text/plain')"><Download :size="13"/> Descargar diff</button><button class="connection-action" @click="downloadText(`ares-${changes.selected.path.split('/').at(-1)}.original.txt`, changes.selected.beforeContent, 'text/plain')">Descargar original</button></div>
      <p class="result-note">{{ changes.selected.status === 'APPLIED' ? 'Archivo aplicado. Ejecuta las comprobaciones del proyecto para validarlo.' : changes.selected.status === 'REVERTED' ? 'Se confirmó la restauración del contenido original.' : 'Aplicar escribe únicamente este archivo. La copia original queda guardada para restaurarlo si no hay cambios posteriores.' }} Las propuestas no ejecutan pruebas ni crean commits.</p>
    </section>
  </section>
</template>
