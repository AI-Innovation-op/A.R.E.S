<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { computed, ref } from 'vue';
import { ArrowUpRight, Download, Copy, Check, Square } from '@lucide/vue';
import { modules, type ModuleId } from '../domain/modules';
import { useConsoleStore } from '../stores/console';
import { downloadText } from '../utils/download';
import MarkdownContent from './MarkdownContent.vue';
import ProjectSelector from './ProjectSelector.vue';
import { useLibraryStore } from '../stores/library';
import { lexer } from 'marked';
import ComparativeDiff from './ComparativeDiff.vue';
const props = defineProps<{ moduleId: ModuleId }>();
const store = useConsoleStore();
const library = useLibraryStore();
const config = computed(() => modules[props.moduleId]);
const state = computed(() => store.moduleStates[props.moduleId]);
const copied = ref(false);
const copyError = ref('');
const refactoring=computed(()=>props.moduleId==='audit'&&state.value.format==='Refactorización');
const proposedCode=computed(()=>{if(state.value.comparedOriginal===undefined)return null;const blocks=lexer(state.value.result).filter(token=>token.type==='code');return blocks.length===1&&'text'in blocks[0]!?blocks[0]!.text:null;});
async function copy() {
  try { await navigator.clipboard.writeText(state.value.result); copied.value = true; setTimeout(() => { copied.value = false; }, 2000); }
  catch { copyError.value = 'No se pudo copiar. Puedes descargar el borrador.'; }
}
</script>

<template>
  <section class="workbench panel">
    <div class="panel-toolbar"><span class="panel-title">{{ config.eyebrow }}</span><span class="session-badge">ASISTIDO POR IA</span></div>
    <div class="workbench-content">
      <div class="module-provider-note">{{ moduleId === 'documentation' ? 'GEMINI · DOCUMENTACIÓN' : 'OPENROUTER · PROGRAMACIÓN' }}</div>
      <span class="eyebrow">TU ARSENAL DE INGENIERÍA</span><h2>{{ config.title }}</h2><p class="muted">{{ config.description }}</p>
      <ProjectSelector :disabled="store.pending" />
      <form v-if="access.canWrite" @submit.prevent="store.runModule(moduleId)">
        <label :for="`${moduleId}-title`">Título del borrador (opcional)</label><input :id="`${moduleId}-title`" v-model="state.title" maxlength="255" :placeholder="state.format" :disabled="store.pending" />
        <label :for="`${moduleId}-format`">Tipo de entrega</label>
        <select :id="`${moduleId}-format`" v-model="state.format" :disabled="store.pending"><option v-for="format in config.formats" :key="format">{{ format }}</option></select>
        <template v-if="refactoring"><label for="refactor-original-path">Nombre del archivo (opcional)</label><input id="refactor-original-path" v-model="state.originalPath" placeholder="src/pedidos/domain/Pedido.ts" maxlength="500" :disabled="store.pending"/><label for="refactor-original-code">Código original para comparar</label><textarea id="refactor-original-code" v-model="state.originalCode" rows="8" maxlength="12000" :disabled="store.pending" placeholder="Pega aquí el archivo original; quedará a la izquierda del comparador."></textarea></template>
        <label :for="`${moduleId}-context`">{{ config.label }}</label>
        <textarea :id="`${moduleId}-context`" v-model="state.context" rows="7" maxlength="14000" :placeholder="config.placeholder" :disabled="store.pending"></textarea>
        <div class="module-form-footer"><small>{{ state.context.length.toLocaleString('es-PE') }} / 14 000</small>
          <button v-if="store.pending" type="button" class="primary-button" @click="store.cancel"><Square :size="15" /> Cancelar</button>
          <button v-else class="primary-button" :disabled="(!state.context.trim()&&!state.originalCode?.trim()) || library.status === 'loading' || library.busy || (library.status === 'ready' && !library.projectId)">{{ config.action }} <ArrowUpRight :size="17" /></button>
        </div>
      </form>
      <p v-if="store.moduleNotice" class="result-note" role="status">{{ store.moduleNotice }}</p>
      <div v-if="store.pending" class="thinking" role="status"><span></span><span></span><span></span> Preparando tu borrador…</div>
      <section v-if="state.result" class="module-result" aria-label="Borrador generado">
        <p class="artifact-save-status" role="status">{{ state.artifactId ? `Guardado en ${state.savedProject} · ${state.savedTitle}` : 'Sin guardar · disponible solo en esta sesión' }}</p>
        <div v-if="state.provider" class="response-provider">{{ state.provider === 'gemini' ? 'GEMINI' : 'OPENROUTER' }} <span>· {{ state.model }}</span></div>
        <div class="result-toolbar"><span class="draft-label">BORRADOR · REVISIÓN PENDIENTE</span><div>
          <button class="icon-button" aria-label="Copiar borrador" @click="copy"><Check v-if="copied" :size="17"/><Copy v-else :size="17"/></button>
          <button class="icon-button" aria-label="Descargar borrador" @click="downloadText(`ares-${moduleId}-borrador.md`, state.result)"><Download :size="17" /></button>
        </div></div>
        <p v-if="copyError" role="status">{{ copyError }}</p>
        <ComparativeDiff v-if="proposedCode!==null&&state.comparedOriginal!==undefined" :before="state.comparedOriginal" :after="proposedCode" :path="state.comparedPath||'archivo.ts'"/><p v-if="state.comparedOriginal!==undefined&&proposedCode===null" class="result-note">La respuesta debe contener una única versión completa en un bloque de código para comparar. Las propuestas del Repositorio permiten revisar y aplicar archivos concretos.</p>
        <MarkdownContent :content="state.result" />
        <p class="result-note">Revisa el contenido y valida el código antes de utilizarlo. {{ state.artifactId ? 'Puedes recuperar este borrador desde la Biblioteca.' : 'Descárgalo para conservarlo.' }}</p>
      </section>
    </div>
  </section>
</template>
