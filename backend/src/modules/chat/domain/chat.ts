export interface Message {
  role: 'user' | 'model';
  content: string;
}

import type { MemoryContext } from '../../memory/domain/memory.js';
import type { WorkspaceContext } from '../../workspace/domain/workspace.js';
export interface ChatReply {
  content: string;
  sources: { uri: string; title: string }[];
  provider?: Provider;
  model?: string;
  memory?: MemoryContext;
  workspace?: WorkspaceContext;
}

export type {Provider} from '../../../../../packages/contracts/index.js';
import type {Provider} from '../../../../../packages/contracts/index.js';
export type ChatTask = 'programming' | 'documentation' | 'audit' | 'architecture';
export function providerForTask(task: ChatTask): Provider { return task === 'documentation' ? 'gemini' : 'openrouter'; }
export interface GenerationOptions { purpose?: 'proposal';signal?:AbortSignal;onDelta?:(text:string)=>void|Promise<void> }

export interface ChatGateway {
  generate(messages: readonly Message[], task?: ChatTask, options?: GenerationOptions): Promise<ChatReply>;
}
