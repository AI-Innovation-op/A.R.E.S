<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { computed, nextTick, ref, watch } from 'vue';
import { ArrowUp, Square, Shield, Code2, GitBranch, Plus, Download, Sparkles, ArrowUpRight, RefreshCw } from '@lucide/vue';
import { useConsoleStore } from '../stores/console';
import { parsePose,visibleReply } from '../domain/poses';
import VoiceControls from './VoiceControls.vue';
import ConversationMode from './ConversationMode.vue';
import {useConversationStore} from '../stores/conversation';
const conversationMode=useConversationStore();
import { downloadText } from '../utils/download';
import MarkdownContent from './MarkdownContent.vue';
import ProjectSelector from './ProjectSelector.vue';
import ProjectMemory from './ProjectMemory.vue';
import { useLibraryStore } from '../stores/library';
import { useMemoryStore } from '../stores/memory';
import SpeechInput from './SpeechInput.vue';
import SpeechOutput from './SpeechOutput.vue';
import ResearchPanel from './ResearchPanel.vue';
defineEmits<{ openArtifact: [id: string]; openWorkspace: [projectId: string] }>();
function insertContext(value:string){const next=[store.draft,value].filter(Boolean).join('\n\n');if(next.length>16000){store.error='El resultado no cabe en el mensaje. Conserva un fragmento más breve antes de enviarlo.';return;}store.draft=next;}
const store = useConsoleStore();
const library = useLibraryStore(), memory = useMemoryStore();
const projectId = computed(() => store.activeConversation ? store.activeConversation.projectId ?? '' : library.projectId);
const projectName = computed(() => library.projects.find(project => project.id === projectId.value)?.name ?? 'Sin proyecto');
const feed = ref<HTMLElement>();
const input = ref<HTMLTextAreaElement>();
const suggestions = [
  { icon: Shield, title: 'Protege tu proyecto', text: 'Genera un README claro y completo', mode: 'documentation' as const, prompt: 'Ayúdame a crear el README de mi proyecto. Pregúntame qué contexto necesitas.' },
  { icon: Code2, title: 'Pon tu código a prueba', text: 'Audita, optimiza y refactoriza', mode: 'programming' as const, prompt: 'Quiero revisar mi código con SOLID y Big-O. Indícame qué información necesitas.' },
  { icon: GitBranch, title: 'Diseña con criterio', text: 'Construye una arquitectura sostenible', mode: 'programming' as const, prompt: 'Ayúdame a diseñar una arquitectura Clean + Hexagonal. Empecemos por los requisitos.' },
];
watch(() => [store.messages.length, store.pending], async () => {
  await nextTick();
  feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' });
});
function choose(prompt: string, mode: 'documentation' | 'programming') { store.chatMode = mode; store.draft = prompt; input.value?.focus(); }
function exportChat() {
  downloadText('ares-conversacion.json', JSON.stringify(store.messages.map(({ role, content, sources, provider, model, createdAt, task, memory, workspace }) => ({ role, content, sources, provider, model, createdAt, task, memory, workspace })), null, 2), 'application/json');
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void store.runChat();
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
    <VoiceControls/>
    <ConversationMode/>
    <div class="conversation-toolbar"><label for="saved-conversation">Historial</label><select id="saved-conversation" :value="store.activeConversation?.id ?? ''" :disabled="store.historyStatus !== 'ready' || store.historyBusy || store.pending" @change="store.openConversation(($event.target as HTMLSelectElement).value)"><option value="" disabled>{{ store.historyStatus === 'ready' ? 'Selecciona una conversación' : 'Solo esta sesión' }}</option><option v-for="conversation in store.conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option></select><button class="icon-button" aria-label="Reconectar historial" title="Reconectar historial" :disabled="store.pending || store.historyBusy" @click="store.initializeHistory"><RefreshCw :size="13" :class="{ spinning: store.historyBusy }"/></button></div>
    <div v-if="store.historyNotice" class="history-notice" role="status">{{ store.historyNotice }}</div>
    <div v-if="library.status === 'ready' && store.historyStatus === 'ready'" class="chat-project-controls">
      <ProjectSelector v-if="!store.activeConversation" :disabled="store.pending || library.busy" />
      <p v-else class="conversation-project">Proyecto de esta conversación: <strong>{{ projectName }}</strong><small>Para cambiar de proyecto, crea una conversación nueva.</small></p>
      <ProjectMemory v-if="projectId" :project-id="projectId" :disabled="store.pending" />
      <label class="memory-toggle"><input v-model="store.useMemory" type="checkbox" :disabled="store.pending || !projectId || !!memory.busyProject" /> Consultar memoria del proyecto</label>
      <p v-if="!projectId" class="result-note">Elige un proyecto antes del primer mensaje para consultar sus documentos.</p>
    </div>
    <div ref="feed" class="chat-feed" role="log" aria-label="Mensajes" :aria-busy="store.pending">
      <button v-if="store.hasOlderMessages" class="load-older" :disabled="store.historyBusy || store.pending" @click="store.loadOlderMessages">Cargar mensajes anteriores</button>
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
        <SpeechOutput v-if="message.role==='model'" :content="parsePose(message.content).text"/>
        <div v-if="message.sources.length" class="sources"><a v-for="source in message.sources" :key="source.uri" :href="source.uri" target="_blank" rel="noopener noreferrer">{{ source.title }} ↗</a></div>
        <section v-if="message.memory" class="memory-references" aria-label="Documentos recuperados"><strong>Memoria · {{ message.memory.projectName }}</strong><p v-if="!message.memory.references.length">No se encontraron fragmentos relevantes. La respuesta no tiene respaldo documental del proyecto.</p><p v-if="message.memory.pendingDocuments">{{ message.memory.pendingDocuments }} documentos pendientes de preparar al responder.</p><details v-for="reference in message.memory.references" :key="reference.label"><summary>[{{ reference.label }}] {{ reference.title }} · fragmento {{ reference.chunkNumber + 1 }}{{ reference.sourceKind==='code'?' · Código':'' }}</summary><blockquote>{{ reference.excerpt }}</blockquote><p v-if="reference.sha256" class="source-hash">Versión: {{ reference.sha256 }}</p><button v-if="reference.sourceKind==='code'" type="button" class="connection-action" :disabled="store.pending" @click="$emit('openWorkspace', message.memory.projectId)">Ver repositorio [{{ reference.label }}]</button><button v-else type="button" class="connection-action" :disabled="store.pending" @click="$emit('openArtifact', reference.artifactId)">Abrir documento [{{ reference.label }}]</button></details></section>
        <section v-if="message.workspace" class="memory-references" aria-label="Evidencia local"><strong>Archivos y comprobaciones del proyecto</strong><details v-for="file in message.workspace.files" :key="file.path"><summary>{{ file.path }} · {{ file.sha256.slice(0, 12) }}</summary><p v-if="file.truncated || file.redacted">{{ file.truncated ? 'Contenido recortado. ' : '' }}{{ file.redacted ? 'Valores sensibles ocultos.' : '' }}</p><blockquote>{{ file.content }}</blockquote></details><details v-for="run in message.workspace.runs" :key="run.id"><summary>{{ run.script }} · {{ run.status }} · salida {{ run.exitCode ?? '—' }}</summary><p>{{ run.workspacePath }} / {{ run.directory || '.' }}</p><blockquote>{{ run.output }}</blockquote><p v-if="run.truncated">Salida recortada.</p></details><button class="connection-action" :disabled="store.pending" @click="$emit('openWorkspace', message.workspace.projectId)">Abrir repositorio</button></section>
      </article>
      <article v-if="store.pending&&visibleReply(store.partialReply,true)" class="message model partial-reply" aria-label="Respuesta en curso"><p class="response-provider">GENERANDO · TODAVÍA SIN CONFIRMAR</p><MarkdownContent :content="visibleReply(store.partialReply,true)"/></article>
      <div v-if="store.pending" class="thinking" role="status"><span></span><span></span><span></span> A.R.E.S. está trabajando…</div>
    </div>
    <form v-if="access.canWrite" class="composer" @submit.prevent="store.runChat">
      <ResearchPanel :disabled="store.pending" @insert="insertContext"/>
      <SpeechInput :disabled="store.pending||conversationMode.enabled" @text="insertContext"/>
      <div v-if="store.attachedFiles.length || store.attachedRuns.length" class="chat-attachments" aria-label="Adjuntos del mensaje"><span v-for="file in store.attachedFiles" :key="file.path">{{ file.path }}</span><span v-for="run in store.attachedRuns" :key="run.id">Comprobación: {{ run.script }}</span><button type="button" class="connection-action" :disabled="store.pending" @click="store.clearAttachments">Retirar adjuntos</button></div>
      <div class="chat-mode-row"><label for="chat-mode">Modo</label><select id="chat-mode" v-model="store.chatMode" :disabled="store.pending"><option value="programming">Programación · OpenRouter</option><option value="documentation">Documentación · Gemini</option></select><span class="chat-model-name">{{ store.providerStatus[store.chatMode === 'documentation' ? 'gemini' : 'openrouter'].model }}</span></div>
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
