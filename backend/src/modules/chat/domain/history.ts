import type { ChatReply, ChatTask, Message, Provider } from './chat.js';
import type { FileReference } from '../../workspace/domain/workspace.js';

export interface Conversation { id: string; title: string; revision: number; createdAt: string; updatedAt: string; projectId?: string }
export interface StoredMessage extends Message {
  id: string; sequence: number; createdAt: string;
  sources: { uri: string; title: string }[];
  provider?: Provider; model?: string; task?: ChatTask; poseNumber?: number;
  memory?: ChatReply['memory']; useMemory?: boolean;
  workspace?: ChatReply['workspace'];
}
export interface ConversationPage { conversation: Conversation; messages: StoredMessage[]; hasMore: boolean }
export interface SavedTurn extends ChatReply { conversationId: string; revision: number; messages: StoredMessage[] }
export interface TurnInput { conversationId: string; requestId: string; revision: number; task: ChatTask; message: string; useMemory?: boolean; files?: FileReference[]; runIds?: string[] }
export interface TurnSnapshot { conversation: Conversation; history: Message[]; existing?: SavedTurn }
export interface HistoryRepository {
  list(): Promise<Conversation[]>;
  create(title: string, projectId?: string): Promise<Conversation>;
  read(id: string, before?: number): Promise<ConversationPage>;
  prepare(input: TurnInput): Promise<TurnSnapshot>;
  commit(input: TurnInput, reply: ChatReply): Promise<SavedTurn>;
}
