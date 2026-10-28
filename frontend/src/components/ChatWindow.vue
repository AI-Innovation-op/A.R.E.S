<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowUp, ArrowDown, Square, Shield, Code2, GitBranch, Plus, Download, Sparkles, ArrowUpRight, RefreshCw, Mic, FolderOpen, Paperclip, X } from '@lucide/vue';
import { useConsoleStore } from '../stores/console';
import { parsePose,visibleReply } from '../domain/poses';
import VoiceControls from './VoiceControls.vue';
import ConversationMode from './ConversationMode.vue';
import {useConversationStore} from '../stores/conversation';
import {useVoiceStore} from '../stores/voice';
const conversationMode=useConversationStore();
const voice = useVoiceStore();
import { downloadText } from '../utils/download';
import MarkdownContent from './MarkdownContent.vue';
import ProjectSelector from './ProjectSelector.vue';
import ProjectMemory from './ProjectMemory.vue';
import { useLibraryStore } from '../stores/library';
import { useMemoryStore } from '../stores/memory';
import SpeechInput from './SpeechInput.vue';
import SpeechOutput from './SpeechOutput.vue';
import ResearchPanel from './ResearchPanel.vue';
defineEmits<{ openArtifact: [id: string, messageId?: string]; openWorkspace: [projectId: string]; openResult: [messageId: string]; openGithub: [] }>();
function insertContext(value:string){const next=[store.draft,value].filter(Boolean).join('\n\n');if(next.length>16000){store.error='El resultado no cabe en el mensaje. Conserva un fragmento más breve antes de enviarlo.';return;}store.draft=next;}
const store = useConsoleStore();
const library = useLibraryStore(), memory = useMemoryStore();
const projectId = computed(() => store.activeConversation ? store.activeConversation.projectId ?? '' : library.projectId);
const projectName = computed(() => library.projects.find(project => project.id === projectId.value)?.name ?? 'Sin proyecto');
const feed = ref<HTMLElement>();
const feedContent = ref<HTMLElement>();
const input = ref<HTMLTextAreaElement>();
const voiceOptions = ref<HTMLDetailsElement>();
const projectOptions = ref<HTMLDetailsElement>();
const attachmentOptions = ref<HTMLDetailsElement>();
const voicePanelOpen = ref(false);
const attachmentPanelOpen = ref(false);
const following = ref(true);
let loadingOlder = false;
let contentObserver: ResizeObserver | undefined;
const optionPanels = () => [voiceOptions.value, projectOptions.value, attachmentOptions.value];
function closeOptions(panel?: HTMLDetailsElement, restoreFocus = false) {
  const open = panel ? [panel] : optionPanels();
  for (const item of open) {
    if (!item?.open) continue;
    item.open = false;
    if (restoreFocus) item.querySelector('summary')?.focus();
  }
}
function onOptionsToggle(event: Event) {
  const target = event.target as HTMLDetailsElement;
  if (target === voiceOptions.value) voicePanelOpen.value = target.open;
  if (target === attachmentOptions.value) attachmentPanelOpen.value = target.open;
  if (target.open) for (const panel of optionPanels()) if (panel !== target) closeOptions(panel);
}
function onOptionsFocusOut(event: FocusEvent) {
  if (!event.relatedTarget) return;
  const target = event.currentTarget as HTMLDetailsElement;
  if (!target.contains(event.relatedTarget as Node)) closeOptions(target);
}
function outsideOptions(event: PointerEvent) {
  for (const panel of optionPanels()) if (panel && !panel.contains(event.target as Node)) closeOptions(panel);
}
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!optionPanels().some(panel => panel?.open)) return;
  event.preventDefault();
  closeOptions(undefined, true);
}
function scrollToLatest() {
  following.value = true;
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'instant' });
}
function onFeedScroll() {
  if (loadingOlder || !feed.value) return;
  following.value = feed.value.scrollHeight - feed.value.scrollTop - feed.value.clientHeight < 48;
}
async function loadOlder() {
  const previousHeight = feed.value?.scrollHeight ?? 0;
  const previousTop = feed.value?.scrollTop ?? 0;
  loadingOlder = true;
  try {
    await store.loadOlderMessages();
    await nextTick();
    if (feed.value) feed.value.scrollTop = previousTop + feed.value.scrollHeight - previousHeight;
  } finally { loadingOlder = false; onFeedScroll(); }
}
function sendMessage() { following.value = true; void store.runChat(); }
const suggestions = [
  { icon: Shield, title: 'Protege tu proyecto', text: 'Genera un README claro y completo', mode: 'documentation' as const, prompt: 'Ayúdame a crear el README de mi proyecto. Pregúntame qué contexto necesitas.' },
  { icon: Code2, title: 'Pon tu código a prueba', text: 'Audita, optimiza y refactoriza', mode: 'programming' as const, prompt: 'Quiero revisar mi código con SOLID y Big-O. Indícame qué información necesitas.' },
  { icon: GitBranch, title: 'Diseña con criterio', text: 'Construye una arquitectura sostenible', mode: 'programming' as const, prompt: 'Ayúdame a diseñar una arquitectura Clean + Hexagonal. Empecemos por los requisitos.' },
];
watch(() => [store.messages.length, store.pending, store.partialReply], async () => {
  await nextTick();
  if (following.value && !loadingOlder) scrollToLatest();
});
watch(() => store.activeConversation?.id, async () => { following.value = true; await nextTick(); scrollToLatest(); });
onMounted(() => {
  document.addEventListener('keydown', onEscape);
  document.addEventListener('pointerdown', outsideOptions);
  contentObserver = new ResizeObserver(() => { if (following.value && !loadingOlder) scrollToLatest(); });
  if (feedContent.value) contentObserver.observe(feedContent.value);
  scrollToLatest();
});
onUnmounted(() => { document.removeEventListener('pointerdown', outsideOptions); document.removeEventListener('keydown', onEscape); contentObserver?.disconnect(); });
function choose(prompt: string, mode: 'documentation' | 'programming') { store.chatMode = mode; store.draft = prompt; input.value?.focus(); }
function exportChat() {
  downloadText('ares-conversacion.json', JSON.stringify(store.messages.map(({ role, content, sources, provider, model, createdAt, task, memory, workspace }) => ({ role, content, sources, provider, model, createdAt, task, memory, workspace })), null, 2), 'application/json');
}
async function openVoiceOptions(){if(!voiceOptions.value)return;voiceOptions.value.open=true;await nextTick();voiceOptions.value.querySelector('summary')?.focus();}
defineExpose({openVoiceOptions});
function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
}
</script>

<template>
  <section class="chat-panel panel" aria-label="Consola de conversación">
    <div class="panel-toolbar">
      <span class="panel-title"><span class="status-dot"></span> CANAL DE COMANDO</span>
      <div class="toolbar-actions">
        <span class="session-badge">{{ store.historyStatus === 'loading' ? 'CONECTANDO HISTORIAL' : store.activeConversation ? 'POSTGRESQL' : 'SESIÓN LOCAL' }}</span>
        <button class="icon-button" aria-label="Exportar conversación" title="Exportar conversación" :disabled="!store.messages.length || store.pending" @click="exportChat"><Download :size="16" /></button>
        <button class="icon-button" aria-label="Nueva conversación" title="Nueva conversación" :disabled="!access.canWrite || store.pending || store.historyBusy" @click="store.newConversation"><Plus :size="17" /></button>
      </div>
    </div>
    <div class="chat-context-bar">
      <button v-if="access.canWrite" type="button" class="connection-action" :disabled="store.pending" @click="$emit('openGithub')"><GitBranch :size="15"/> Leer GitHub</button>
      <details ref="voiceOptions" class="chat-options" @toggle="onOptionsToggle" @focusout="onOptionsFocusOut">
        <summary aria-controls="chat-voice-options" aria-label="Voz y conversación"><Mic :size="15"/><span>Voz</span><small>{{ conversationMode.enabled ? conversationMode.label : voice.enabled ? 'Resumen activado' : 'A tu ritmo' }}</small></summary>
        <div id="chat-voice-options" class="chat-options-panel">
          <div class="chat-options-heading"><strong>Voz y conversación</strong><button type="button" class="icon-button" aria-label="Cerrar opciones de voz" @click="closeOptions(voiceOptions, true)"><X :size="16"/></button></div>
          <VoiceControls/>
          <ConversationMode :visible="voicePanelOpen"/>
        </div>
      </details>
      <details ref="projectOptions" class="chat-options" @toggle="onOptionsToggle" @focusout="onOptionsFocusOut">
        <summary aria-controls="chat-project-options" aria-label="Proyecto e historial"><FolderOpen :size="15"/><span>Proyecto</span><small :title="projectName">{{ projectName }}</small><i v-if="store.useMemory" class="status-dot" title="Consulta de memoria activada"></i></summary>
        <div id="chat-project-options" class="chat-options-panel">
          <div class="chat-options-heading"><strong>Proyecto e historial</strong><button type="button" class="icon-button" aria-label="Cerrar proyecto e historial" @click="closeOptions(projectOptions, true)"><X :size="16"/></button></div>
    <div class="conversation-toolbar"><label for="saved-conversation">Historial</label><select id="saved-conversation" :value="store.activeConversation?.id ?? ''" :disabled="store.historyStatus !== 'ready' || store.historyBusy || store.pending" @change="store.openConversation(($event.target as HTMLSelectElement).value)"><option value="" disabled>{{ store.historyStatus === 'ready' ? 'Selecciona una conversación' : 'Solo esta sesión' }}</option><option v-for="conversation in store.conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option></select><button class="icon-button" aria-label="Reconectar historial" title="Reconectar historial" :disabled="store.pending || store.historyBusy" @click="store.initializeHistory"><RefreshCw :size="13" :class="{ spinning: store.historyBusy }"/></button></div>
    <div v-if="library.status === 'ready' && store.historyStatus === 'ready'" class="chat-project-controls">
      <ProjectSelector v-if="!store.activeConversation" :disabled="store.pending || library.busy" />
      <p v-else class="conversation-project">Proyecto de esta conversación: <strong>{{ projectName }}</strong><small>Para cambiar de proyecto, crea una conversación nueva.</small></p>
      <ProjectMemory v-if="projectId" :project-id="projectId" :disabled="store.pending" />
      <label class="memory-toggle"><input v-model="store.useMemory" type="checkbox" :disabled="store.pending || !projectId || !!memory.busyProject" /> Consultar memoria del proyecto</label>
      <p v-if="!projectId" class="result-note">Elige un proyecto antes del primer mensaje para consultar sus documentos.</p>
    </div>
        </div>
      </details>
      <span v-if="conversationMode.enabled" class="chat-listening-status" role="status"><span class="status-dot"></span>{{ conversationMode.label }}<button v-if="conversationMode.phase === 'thinking' || conversationMode.phase === 'speaking'" type="button" class="connection-action" @click="conversationMode.interrupt">Interrumpir respuesta</button><button v-else type="button" class="connection-action" @click="conversationMode.stop('Micrófono desactivado.')">Desactivar micrófono</button></span>
    </div>
    <div v-if="store.historyNotice" class="compact-history-notice" role="status">{{ store.historyNotice }}</div>
    <div v-if="conversationMode.error && !voicePanelOpen" class="compact-history-notice" role="alert">{{ conversationMode.error }}</div>
    <div ref="feed" class="chat-feed" role="log" aria-label="Mensajes" :aria-busy="store.pending" tabindex="0" @scroll="onFeedScroll" @wheel="event => { if (event.deltaY < 0) following = false; }">
      <div ref="feedContent" class="chat-feed-content">
      <button v-if="store.hasOlderMessages" class="load-older" :disabled="store.historyBusy || store.pending" @click="loadOlder">Cargar mensajes anteriores</button>
      <div v-if="!store.messages.length" class="chat-welcome">
        <div class="welcome-symbol"><Sparkles :size="23" :stroke-width="1.5" /></div>
        <span class="eyebrow">INGENIERÍA CON PROPÓSITO</span>
        <h2>Tu siguiente gran idea.<br /><span>Una base más sólida.</span></h2>
        <p>Activa la voz, escribe o dicta tu primera pregunta y pulsa Enviar. Verás la respuesta mientras se escribe y escucharás un resumen en español.</p><p class="welcome-evidence">Para revisar un archivo, primero debes conectarlo o adjuntarlo. A.R.E.S. te indicará qué recibió y qué pudo comprobar.</p>
        <div class="suggestion-list">
          <button v-for="suggestion in suggestions" :key="suggestion.title" class="suggestion" :disabled="store.pending" @click="choose(suggestion.prompt, suggestion.mode)">
            <span class="suggestion-icon"><component :is="suggestion.icon" :size="19" :stroke-width="1.5" /></span>
            <span><strong>{{ suggestion.title }}</strong><small>{{ suggestion.text }}</small></span>
            <ArrowUpRight :size="16" class="suggestion-arrow" />
          </button>
        </div>
      </div>
      <article v-for="message in store.messages" :key="message.id" class="message" :class="message.role">
        <div class="message-meta"><span class="message-avatar">{{ message.role === 'user' ? 'TÚ' : 'Λ' }}</span><strong>{{ message.role === 'user' ? 'Comandante' : 'A.R.E.S.' }}</strong><span>{{ message.role === 'user' ? 'SOLICITUD' : 'RESPUESTA' }}</span></div>
        <div v-if="message.provider" class="response-provider">{{ message.provider === 'gemini' ? 'GEMINI' : 'OPENROUTER' }} <span>· {{ message.model }}</span></div>
        <p v-if="message.role === 'user'" class="user-content">{{ message.content }}</p>
        <MarkdownContent v-else :content="parsePose(message.content).text" />
        <div v-if="message.role === 'model'" class="message-result-actions"><button type="button" class="connection-action" :disabled="store.pending" @click="$emit('openResult', String(message.id))"><FolderOpen :size="14"/> Abrir resultado</button><SpeechOutput :content="parsePose(message.content).text"/></div>
        <div v-if="message.sources.length" class="sources"><a v-for="source in message.sources" :key="source.uri" :href="source.uri" target="_blank" rel="noopener noreferrer">{{ source.title }} ↗</a></div>
        <section v-if="message.memory" class="memory-references" aria-label="Documentos recuperados"><strong>Memoria · {{ message.memory.projectName }}</strong><p v-if="!message.memory.references.length">No se encontraron fragmentos relevantes. La respuesta no tiene respaldo documental del proyecto.</p><p v-if="message.memory.pendingDocuments">{{ message.memory.pendingDocuments }} documentos pendientes de preparar al responder.</p><details v-for="reference in message.memory.references" :key="reference.label"><summary>[{{ reference.label }}] {{ reference.title }} · fragmento {{ reference.chunkNumber + 1 }}{{ reference.sourceKind==='code'?' · Código':'' }}</summary><blockquote>{{ reference.excerpt }}</blockquote><p v-if="reference.sha256" class="source-hash">Versión: {{ reference.sha256 }}</p><button v-if="reference.sourceKind==='code'" type="button" class="connection-action" :disabled="store.pending" @click="$emit('openWorkspace', message.memory.projectId)">Ver repositorio [{{ reference.label }}]</button><button v-else type="button" class="connection-action" :disabled="store.pending" @click="$emit('openArtifact', reference.artifactId, String(message.id))">Abrir documento [{{ reference.label }}]</button></details></section>
        <section v-if="message.workspace" class="memory-references" aria-label="Evidencia local"><strong>Archivos y comprobaciones del proyecto</strong><details v-for="file in message.workspace.files" :key="file.path"><summary>{{ file.path }} · {{ file.sha256.slice(0, 12) }}</summary><p v-if="file.truncated || file.redacted">{{ file.truncated ? 'Contenido recortado. ' : '' }}{{ file.redacted ? 'Valores sensibles ocultos.' : '' }}</p><blockquote>{{ file.content }}</blockquote></details><details v-for="run in message.workspace.runs" :key="run.id"><summary>{{ run.script }} · {{ run.status }} · salida {{ run.exitCode ?? '—' }}</summary><p>{{ run.workspacePath }} / {{ run.directory || '.' }}</p><blockquote>{{ run.output }}</blockquote><p v-if="run.truncated">Salida recortada.</p></details><button class="connection-action" :disabled="store.pending" @click="$emit('openWorkspace', message.workspace.projectId)">Abrir repositorio</button></section>
      </article>
      <article v-if="store.pending&&visibleReply(store.partialReply,true)" class="message model partial-reply" aria-label="Respuesta en curso"><p class="response-provider">GENERANDO · TODAVÍA SIN CONFIRMAR</p><MarkdownContent :content="visibleReply(store.partialReply,true)"/></article>
      <div v-if="store.pending" class="thinking" role="status"><span></span><span></span><span></span> A.R.E.S. está trabajando…</div>
      </div>
    </div>
    <div v-if="!following && store.messages.length" class="chat-latest"><button type="button" @click="scrollToLatest"><ArrowDown :size="13"/> Volver al último mensaje</button></div>
    <form v-if="access.canWrite" class="composer" @submit.prevent="sendMessage">
      <div v-if="store.attachedFiles.length || store.attachedRuns.length" class="chat-attachments" aria-label="Adjuntos del mensaje"><span v-for="file in store.attachedFiles" :key="file.path">{{ file.path }}</span><span v-for="run in store.attachedRuns" :key="run.id">Comprobación: {{ run.script }}</span><button type="button" class="connection-action" :disabled="store.pending" @click="store.clearAttachments">Retirar adjuntos</button></div>
      <div class="composer-toolbar">
        <div class="chat-mode-row"><label for="chat-mode">Modo</label><select id="chat-mode" v-model="store.chatMode" :disabled="store.pending"><option value="programming">Programación · OpenRouter</option><option value="documentation">Documentación · Gemini</option></select><span class="chat-model-name" :title="store.providerStatus[store.chatMode === 'documentation' ? 'gemini' : 'openrouter'].model">{{ store.providerStatus[store.chatMode === 'documentation' ? 'gemini' : 'openrouter'].model }}</span></div>
        <details ref="attachmentOptions" class="chat-options attachment-options" @toggle="onOptionsToggle" @focusout="onOptionsFocusOut">
          <summary aria-label="Adjuntos y dictado" aria-controls="chat-attachment-options"><Paperclip :size="15"/><span>Adjuntar y dictar</span></summary>
          <div id="chat-attachment-options" class="chat-options-panel">
            <div class="chat-options-heading"><strong>Adjuntos y dictado</strong><button type="button" class="icon-button" aria-label="Cerrar adjuntos y dictado" @click="closeOptions(attachmentOptions, true)"><X :size="16"/></button></div>
            <p class="attachment-dictation-note">Cerrar este panel detiene el dictado en curso.</p>
            <SpeechInput v-if="attachmentPanelOpen" :disabled="store.pending||conversationMode.enabled" @text="insertContext"/>
            <ResearchPanel :disabled="store.pending" @insert="insertContext"/>
          </div>
        </details>
      </div>
      <label class="sr-only" for="chat-input">Mensaje para A.R.E.S.</label>
      <div class="composer-box">
        <textarea id="chat-input" ref="input" v-model="store.draft" rows="2" maxlength="16000" placeholder="Comandante, ¿qué vamos a construir hoy?" @keydown="onKey"></textarea>
        <div class="composer-bottom"><span><span class="tiny-diamond">◆</span> A.R.E.S. / INGENIERÍA FULL-STACK</span>
          <button v-if="store.pending" type="button" class="send-button" aria-label="Cancelar solicitud" @click="store.cancel"><Square :size="15" /></button>
          <button v-else class="send-button" aria-label="Enviar mensaje" :disabled="!store.draft.trim() || store.historyBusy"><ArrowUp :size="20" /></button>
        </div>
      </div>
      <div class="composer-hint"><span>Enter para enviar <span class="hint-divider">/</span> Shift + Enter para nueva línea</span><span>{{ store.draft.length.toLocaleString('es-PE') }} / 16 000</span></div>
    </form>
  </section>
</template>
