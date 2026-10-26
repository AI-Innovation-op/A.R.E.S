import type { ChatGateway, ChatTask, Message,GenerationOptions } from '../domain/chat.js';

export class SendMessage {
  constructor(private readonly gateway: ChatGateway) {}

  execute(message: string, history: readonly Message[], task: ChatTask = 'programming',options?:GenerationOptions) {
    return this.gateway.generate([...history, { role: 'user', content: message }], task,options);
  }
}
