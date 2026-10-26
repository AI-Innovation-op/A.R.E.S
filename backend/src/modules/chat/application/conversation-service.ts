import type { ChatGateway, Message,GenerationOptions } from '../domain/chat.js';
import type { HistoryRepository, TurnInput } from '../domain/history.js';
import { HttpError } from '../../../shared/http-error.js';
import { withMemory, type ContextRetriever } from '../../memory/domain/memory.js';
import { withWorkspace, type WorkspaceReader } from '../../workspace/domain/workspace.js';

export class ConversationService {
  private readonly active = new Set<string>();
  constructor(private readonly repository: HistoryRepository, private readonly gateway: ChatGateway, private readonly memory?: ContextRetriever, private readonly workspace?: WorkspaceReader) {}
  list() { return this.repository.list(); }
  create(title: string, projectId?: string) { return this.repository.create(title, projectId); }
  read(id: string, before?: number) { return this.repository.read(id, before); }
  async send(input: TurnInput,options?:GenerationOptions) {
    if (this.active.has(input.conversationId)) throw new HttpError(409, 'CONVERSATION_BUSY', 'Esta conversación ya está generando una respuesta. Espera y vuelve a abrirla.');
    this.active.add(input.conversationId);
    try {
      const snapshot = await this.repository.prepare(input);
      if (snapshot.existing) return snapshot.existing;
      if (snapshot.conversation.revision !== input.revision) throw new HttpError(409, 'CONVERSATION_CHANGED', 'La conversación cambió en otra pestaña. Vuelve a abrirla antes de enviar.');
      const history: Message[] = snapshot.history.map(message => ({ role: message.role, content: message.content.slice(0, 16000) }));
      while (history.length && Buffer.byteLength(JSON.stringify(history), 'utf8') > 250 * 1024) history.splice(0, 2);
      if (input.useMemory && (!snapshot.conversation.projectId || !this.memory)) throw new HttpError(400, 'MEMORY_PROJECT_REQUIRED', 'Crea una conversación con un proyecto para consultar su memoria.');
      const memory = input.useMemory ? await this.memory!.retrieve(snapshot.conversation.projectId!, `${input.message}\nConsulta anterior: ${history.filter(message => message.role === 'user').at(-1)?.content.slice(0, 500) ?? ''}`) : undefined;
      const hasWorkspace = !!(input.files?.length || input.runIds?.length);
      if (hasWorkspace && (!snapshot.conversation.projectId || !this.workspace)) throw new HttpError(400, 'WORKSPACE_PROJECT_REQUIRED', 'Selecciona un proyecto con carpeta conectada para adjuntar archivos o comprobaciones.');
      const workspace = hasWorkspace ? await this.workspace!.context(snapshot.conversation.projectId!, input.files ?? [], input.runIds ?? []) : undefined;
      let message = memory ? withMemory(input.message, memory) : input.message;
      if (workspace) message = withWorkspace(message, workspace);
      options?.signal?.throwIfAborted();
      const reply = await this.gateway.generate([...history, { role: 'user', content: message }], input.task,options);
      options?.signal?.throwIfAborted();
      if (memory) reply.memory = memory;
      if (workspace) reply.workspace = workspace;
      return await this.repository.commit(input, reply);
    } finally { this.active.delete(input.conversationId); }
  }
}
