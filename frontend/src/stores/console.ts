import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { conversationPose, getPose, getStancePose, parsePose, type Stance } from '../domain/poses';
import { modulePrompt, modules, type ModuleId } from '../domain/modules';
import { boundedHistory, sendChat, type Attribution, type ChatTask, type Message, type Provider, type ProviderStatus, type Source } from '../services/api';
import { createConversation, listConversations, readConversation, sendPersistentMessage, type Conversation, type SavedTurn } from '../services/history';
import { generateArtifact, type Artifact, type ArtifactInput } from '../services/library';
import { useLibraryStore } from './library';
import type { MemoryContext } from '../services/memory';
import type { FileReference, SourceFile, ToolRun, WorkspaceContext } from '../services/workspace';

export interface ChatEntry extends Message, Attribution { id: number | string; sources: Source[]; sequence?: number; createdAt?: string; task?: ChatTask; memory?: MemoryContext; workspace?: WorkspaceContext; useMemory?: boolean }
export interface ModuleState extends Attribution { context: string; format: string; result: string; title?: string; artifactId?: string; savedProject?: string; savedTitle?: string; originalCode?:string; originalPath?:string; comparedOriginal?:string; comparedPath?:string }

export const useConsoleStore = defineStore('console', () => {
  const messages = ref<ChatEntry[]>([]);
  const draft = ref('');
  const chatMode = ref<'programming' | 'documentation'>('programming');
  const useMemory = ref(false);
  const attachedFiles = ref<FileReference[]>([]), attachedRuns = ref<{ id: string; script: string }[]>([]), attachmentProjectId = ref('');
  const providerStatus = ref<Record<Provider, ProviderStatus>>({ gemini: { configured: false, model: '' }, openrouter: { configured: false, model: '' } });
  const poseId = ref(1);
  const refactorPulse=ref(0);
  const pose = computed(() => getPose(poseId.value));
  const pending = ref(false);
  const partialReply=ref('');
  const completedReply=ref<{id:number;content:string;conversationId?:string;messageId?:string}|null>(null);
  let completionId=0;
  function receiveDelta(delta:string,signal:AbortSignal){if(signal.aborted)return;partialReply.value+=delta;const next=parsePose(partialReply.value).pose;if(next&&poseId.value!==next.id)setPose(next.id);}
  const error = ref('');
  const conversations = ref<Conversation[]>([]);
  const activeConversation = ref<Conversation | null>(null);
  const historyStatus = ref<'loading' | 'ready' | 'offline'>('loading');
  const historyBusy = ref(false), hasOlderMessages = ref(false);
  const historyNotice = ref('');
  const moduleStates = ref<Record<ModuleId, ModuleState>>({
    documentation: { context: '', format: modules.documentation.formats[0], result: '' },
    audit: { context: '', format: modules.audit.formats[0], result: '' },
    architecture: { context: '', format: modules.architecture.formats[0], result: '' },
  });
  let controller: AbortController | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  let entryId = 0;
  let moduleRetry: ArtifactInput | undefined;
  const moduleNotice = ref('');
  let retry: { id: string; conversationId: string; message: string; task: ChatTask; useMemory: boolean; attachments: string } | undefined;
  function remember(id: string | null) {
    try { if (id) localStorage.setItem('ares.activeConversation', id); else localStorage.removeItem('ares.activeConversation'); } catch { /* El historial no depende de que localStorage esté permitido. */ }
  }
  async function openConversation(id: string) {
    if (pending.value || historyBusy.value) return;
    historyBusy.value = true; historyNotice.value = '';
    try {
      const page = await readConversation(id);
      activeConversation.value = page.conversation; messages.value = page.messages;
      clearAttachments();
      useMemory.value = !!page.messages.at(-1)?.memory;
      const lastTask = page.messages.at(-1)?.task; if (lastTask === 'programming' || lastTask === 'documentation') chatMode.value = lastTask;
      hasOlderMessages.value = page.hasMore; historyStatus.value = 'ready'; retry = undefined;
      remember(id); error.value = ''; setStance('IDLE');
    } catch (cause: unknown) { historyNotice.value = cause instanceof Error ? cause.message : 'No se pudo abrir la conversación.'; }
    finally { historyBusy.value = false; }
  }
  async function initializeHistory() {
    if (historyBusy.value || pending.value) return;
    historyBusy.value = true;
    try {
      const list = await listConversations(); conversations.value = list; historyStatus.value = 'ready'; historyNotice.value = '';
      let selected: string | null = null; try { selected = localStorage.getItem('ares.activeConversation'); } catch { /* Sin almacenamiento del navegador. */ }
      const match = list.find(item => item.id === selected) ?? list[0];
      // No sustituir una conversación de sesión que todavía no se haya exportado.
      if ((!messages.value.length || activeConversation.value) && match) {
        const page = await readConversation(match.id);
        activeConversation.value = page.conversation; messages.value = page.messages; hasOlderMessages.value = page.hasMore; remember(match.id);
        useMemory.value = !!page.messages.at(-1)?.memory;
        const lastTask = page.messages.at(-1)?.task; if (lastTask === 'programming' || lastTask === 'documentation') chatMode.value = lastTask;
      }
      else if(!list.length&&(!messages.value.length||activeConversation.value)){messages.value=[];activeConversation.value=null;hasOlderMessages.value=false;useMemory.value=false;clearAttachments();remember(null);}
      if (messages.value.length && !activeConversation.value) historyNotice.value = 'Estos mensajes pertenecen a una sesión sin guardar. Puedes exportarlos y crear una conversación nueva con PostgreSQL.';
    } catch { historyStatus.value = 'offline'; historyNotice.value = 'PostgreSQL no está conectado. Los mensajes nuevos permanecerán solo en esta sesión.'; }
    finally { historyBusy.value = false; }
  }
  async function newConversation() {
    if (pending.value || historyBusy.value) return;
    clearChat(); historyNotice.value = '';
  }
  async function loadOlderMessages() {
    const first = messages.value[0];
    if (!activeConversation.value || !first?.sequence || historyBusy.value || pending.value) return;
    historyBusy.value = true;
    try {
      const page = await readConversation(activeConversation.value.id, first.sequence);
      messages.value.unshift(...page.messages); hasOlderMessages.value = page.hasMore;
    } catch (cause: unknown) { historyNotice.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los mensajes anteriores.'; }
    finally { historyBusy.value = false; }
  }

  function setPose(id: number) {
    clearTimeout(resetTimer);
    poseId.value = getPose(id).id;
  }
  function setStance(stance: Stance) { setPose(getStancePose(stance).id); }
  function settlePose(id: number) {
    setPose(id);
    resetTimer = setTimeout(() => { poseId.value = 1; }, 12000);
  }
  function cancel() {
    controller?.abort();
    if (activeConversation.value) historyNotice.value = 'Se canceló la espera en esta pestaña. La generación puede continuar; vuelve a abrir la conversación para comprobar si quedó guardada.';
    setStance('IDLE');
  }
  function clearAttachments() { attachedFiles.value = []; attachedRuns.value = []; attachmentProjectId.value = ''; }
  function attach(projectId: string, file?: SourceFile, run?: ToolRun) {
    if (pending.value) return;
    if (attachmentProjectId.value && attachmentProjectId.value !== projectId) clearAttachments();
    attachmentProjectId.value = projectId;
    if (file) {
      if (attachedFiles.value.length >= 3 && !attachedFiles.value.some(item => item.path === file.path)) { error.value = 'Puedes adjuntar hasta tres archivos por mensaje.'; return; }
      attachedFiles.value = [...attachedFiles.value.filter(item => item.path !== file.path), { path: file.path, sha256: file.sha256 }];
    }
    if (run) attachedRuns.value = [{ id: run.id, script: run.script }];
  }

  async function runChat() {
    const text = draft.value.trim();
    if (!text || text.length > 16000 || pending.value || historyBusy.value) return;
    const library = useLibraryStore();
    if (useMemory.value && (historyStatus.value !== 'ready' || !(activeConversation.value ? activeConversation.value.projectId : library.currentProject?.id))) { error.value = 'Crea una conversación con un proyecto y PostgreSQL conectado para consultar su memoria.'; return; }
    const hasAttachments = !!(attachedFiles.value.length || attachedRuns.value.length);
    if (hasAttachments && (historyStatus.value !== 'ready' || attachmentProjectId.value !== (activeConversation.value ? activeConversation.value.projectId : library.currentProject?.id))) { error.value = 'Los adjuntos pertenecen a otro proyecto. Abre una conversación de ese proyecto o retíralos.'; return; }
    pending.value = true;
    partialReply.value='';
    error.value = '';
    setPose(conversationPose(text).id);
    const requestController = new AbortController();
    controller = requestController;
    const history: Message[] = boundedHistory(messages.value, text);
    const userEntry: ChatEntry = { id: ++entryId, role: 'user', content: text, sources: [] };
    messages.value.push(userEntry);
    draft.value = '';
    try {
      if (historyStatus.value === 'ready' && !activeConversation.value && messages.value.length === 1) {
        activeConversation.value = await createConversation('Nueva conversación', library.status === 'ready' ? library.currentProject?.id : undefined);
        conversations.value.unshift(activeConversation.value); remember(activeConversation.value.id);
      }
      const persistent = historyStatus.value === 'ready' && activeConversation.value;
      const task = chatMode.value;
      let reply;
      if (persistent) {
        const attachments = JSON.stringify([attachedFiles.value, attachedRuns.value.map(run => run.id)]);
        if (!retry || retry.message !== text || retry.task !== task || retry.conversationId !== persistent.id || retry.useMemory !== useMemory.value || retry.attachments !== attachments) retry = { id: crypto.randomUUID(), message: text, task, conversationId: persistent.id, useMemory: useMemory.value, attachments };
        reply = await sendPersistentMessage(persistent, retry.id, text, task, requestController.signal, useMemory.value, attachedFiles.value, attachedRuns.value.map(run => run.id),delta=>receiveDelta(delta,requestController.signal));
      } else reply = await sendChat(text, history, requestController.signal, task,delta=>receiveDelta(delta,requestController.signal));
      if (requestController.signal.aborted) return;
      if ('messages' in reply) {
        const saved = reply as SavedTurn;
        if (activeConversation.value && saved.revision > activeConversation.value.revision + 1) {
          const page = await readConversation(activeConversation.value.id); messages.value = page.messages; hasOlderMessages.value = page.hasMore;
        } else {
          if (messages.value.at(-1)?.id === userEntry.id) messages.value.pop();
          messages.value.push(...saved.messages);
        }
        if (activeConversation.value) activeConversation.value.revision = saved.revision;
        conversations.value = await listConversations().catch(() => conversations.value);
        retry = undefined;
      } else messages.value.push({ id: ++entryId, role: 'model', ...reply });
      clearAttachments();
      settlePose(parsePose(reply.content).pose?.id ?? conversationPose(text, true).id);
      if(parsePose(reply.content).pose?.id===11)refactorPulse.value++;
      completedReply.value={id:++completionId,content:reply.content,...('messages' in reply?{conversationId:(reply as SavedTurn).conversationId,messageId:String((reply as SavedTurn).messages.find(item=>item.role==='model')?.id??'')}: {})};
    } catch (cause: unknown) {
      if (!requestController.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'No se pudo enviar el mensaje.';
        settlePose(2);
      }
    } finally {
      // Un turno fallido/cancelado no se envía como historial incompleto al backend.
      if (messages.value.at(-1)?.id === userEntry.id) {
        messages.value.pop();
        if (!draft.value) draft.value = text;
      }
      if (requestController.signal.aborted) setStance('IDLE');
      pending.value = false;
      partialReply.value='';
      controller = null;
    }
  }

  async function runModule(id: ModuleId) {
    const state = moduleStates.value[id];
    const refactoring=id==='audit'&&state.format==='Refactorización';
    const original=refactoring?state.originalCode:undefined;
    const context=[state.context.trim(),original&&!state.context.includes(original)?'Código original para refactorizar (dato aportado por el usuario):\n'+original:''].filter(Boolean).join('\n\n');
    if(!context||pending.value)return;
    if(context.length>14000){error.value='El contexto y código juntos superan 14 000 caracteres. Reduce el contenido o usa las propuestas del Repositorio.';return;}
    const library = useLibraryStore();
    if (library.status === 'ready' && !library.currentProject) { error.value = 'Crea o selecciona un proyecto antes de generar el borrador.'; return; }
    pending.value = true;
    if(refactoring)refactorPulse.value++;
    error.value = '';
    moduleNotice.value = '';
    setPose(modules[id].pose);
    const requestController = new AbortController();
    controller = requestController;
    try {
      let reply;
      if (library.status === 'ready' && library.currentProject) {
        const projectName = library.currentProject.name;
        const input = { projectId: library.currentProject.id, module: id, format: state.format, title: state.title?.trim() || state.format, context };
        if (!moduleRetry || Object.entries(input).some(([key, value]) => moduleRetry![key as keyof ArtifactInput] !== value)) moduleRetry = { ...input, requestId: crypto.randomUUID() };
        reply = await generateArtifact(moduleRetry, requestController.signal);
        if (requestController.signal.aborted) return;
        state.artifactId = reply.id; state.savedProject = projectName; state.savedTitle = reply.title; moduleRetry = undefined;
      } else {
        reply = await sendChat(modulePrompt(id, state.format, context), [], requestController.signal, id as ChatTask);
        if (requestController.signal.aborted) return;
        state.artifactId = undefined; state.savedProject = undefined; state.savedTitle = undefined;
      }
      if (requestController.signal.aborted) return;
      state.result = parsePose(reply.content).text;
      state.comparedOriginal=original;state.comparedPath=state.originalPath;
      state.provider = reply.provider; state.model = reply.model;
      completedReply.value={id:++completionId,content:'El borrador está listo para revisar. '+state.result};
      settlePose(16);
    } catch (cause: unknown) {
      if (!requestController.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'No se pudo generar el borrador.';
        settlePose(2);
      }
    } finally {
      if (requestController.signal.aborted) moduleNotice.value = 'Se canceló la espera. Si la biblioteca estaba conectada, la generación puede continuar; actualízala para comprobar el guardado.';
      pending.value = false;
      controller = null;
    }
  }

  function restoreArtifact(artifact: Artifact, projectName: string) {
    if (pending.value) return;
    moduleStates.value[artifact.module] = { context: artifact.context, format: artifact.format, title: artifact.title, result: artifact.content,
      provider: artifact.provider, model: artifact.model, artifactId: artifact.id, savedProject: projectName, savedTitle: artifact.title };
    moduleNotice.value = ''; error.value = ''; setPose(modules[artifact.module].pose);
  }

  function clearChat() {
    if (pending.value) return;
    messages.value = [];
    activeConversation.value = null; retry = undefined; hasOlderMessages.value = false; remember(null);
    useMemory.value = false;
    clearAttachments();
    error.value = '';
    setStance('IDLE');
  }

  return { messages, draft, chatMode, useMemory, attachedFiles, attachedRuns, attachmentProjectId, providerStatus, pose,refactorPulse, pending,partialReply,completedReply, error, moduleStates, moduleNotice, conversations, activeConversation, historyStatus, historyBusy, historyNotice, hasOlderMessages,
    initializeHistory, openConversation, newConversation, loadOlderMessages, setPose, setStance, cancel, runChat, runModule, restoreArtifact, clearChat, attach, clearAttachments };
});
