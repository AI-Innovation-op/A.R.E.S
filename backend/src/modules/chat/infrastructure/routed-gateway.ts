import { providerForTask, type ChatGateway, type ChatTask, type Message, type Provider, type GenerationOptions } from '../domain/chat.js';
import { HttpError } from '../../../shared/http-error.js';

export interface ProviderSlot { gateway: ChatGateway | null; model: string }
export class RoutedGateway implements ChatGateway {
  constructor(private readonly resolve: (provider: Provider) => ProviderSlot) {}
  async generate(messages: readonly Message[], task: ChatTask = 'programming', options?: GenerationOptions) {
    const provider = providerForTask(task);
    const slot = this.resolve(provider);
    if (!slot.gateway) throw new HttpError(503, `${provider.toUpperCase()}_NOT_CONFIGURED`, `Configura ${provider === 'gemini' ? 'Gemini para documentación' : 'OpenRouter para programación'} en Conexiones IA.`);
    const reply = await slot.gateway.generate(messages, task, options);
    return { ...reply, provider, model: reply.model ?? slot.model };
  }
}
