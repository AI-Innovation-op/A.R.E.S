import { z } from 'zod';
import type { ChatGateway, Message, ChatTask, GenerationOptions } from '../domain/chat.js';
import { HttpError } from '../../../shared/http-error.js';
import { readSse } from '../../../shared/sse.js';

const completionSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ finish_reason: z.string().nullable().optional(), message: z.object({ content: z.string().nullable() }) })).min(1),
});

export class OpenRouterAdapter implements ChatGateway {
  constructor(private readonly apiKey: string, private readonly model: string, private readonly systemInstruction: string,
    private readonly timeoutMs: number, private readonly maxTokens: number, private readonly request: typeof fetch = fetch) {}
  async generate(messages: readonly Message[], _task?: ChatTask, options?: GenerationOptions) {
    const timeout=AbortSignal.timeout(this.timeoutMs),signal=options?.signal?AbortSignal.any([timeout,options.signal]):timeout;
    try {
      const response = await this.request('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'A.R.E.S.' },
        body: JSON.stringify({ model: this.model, stream: !!options?.onDelta, max_tokens: this.maxTokens,
          ...(options?.purpose === 'proposal' && this.model === 'cohere/north-mini-code:free' ? { reasoning: { enabled: false } } : {}),
          messages: [{ role: 'system', content: this.systemInstruction }, ...messages.map(message => ({ role: message.role === 'model' ? 'assistant' : 'user', content: message.content }))],
        }),
      });
      if (response.status === 402) throw new HttpError(402, 'OPENROUTER_CREDITS', 'OpenRouter indica saldo o límite insuficiente para este modelo. Revisa tu cuenta o elige un modelo gratuito.');
      if (response.status === 429) throw new HttpError(429, 'OPENROUTER_QUOTA', 'El modelo de OpenRouter alcanzó su límite de solicitudes. Inténtalo más tarde o cambia el modelo.');
      if ([401, 403].includes(response.status)) throw new HttpError(503, 'OPENROUTER_AUTH', 'OpenRouter rechazó la clave. Actualízala en Conexiones IA.');
      if (response.status === 404) throw new HttpError(502, 'OPENROUTER_MODEL_UNAVAILABLE', 'El modelo de OpenRouter no tiene un endpoint disponible. Selecciona otro modelo.');
      if (!response.ok) throw new HttpError(502, 'OPENROUTER_UNAVAILABLE', 'No se pudo consultar OpenRouter. Inténtalo más tarde.');
      if(options?.onDelta){
        if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new HttpError(502,'OPENROUTER_INVALID_STREAM','OpenRouter no confirmó un flujo de texto.');
        let content='',model=this.model,completed=false;
        for await(const frame of readSse(response.body,signal)){
          if(frame.event==='error')throw new HttpError(502,'OPENROUTER_STREAM_ERROR','OpenRouter interrumpió la respuesta.');
          if(frame.data==='[DONE]'){completed=true;break;}
          let event:unknown;try{event=JSON.parse(frame.data);}catch{throw new HttpError(502,'OPENROUTER_INVALID_STREAM','OpenRouter envió un fragmento inválido.');}
          const parsed=z.object({model:z.string().optional(),error:z.unknown().optional(),choices:z.array(z.object({finish_reason:z.string().nullable().optional(),delta:z.object({content:z.string().nullable().optional()}).optional()})).optional()}).safeParse(event);
          if(!parsed.success||parsed.data.error)throw new HttpError(502,'OPENROUTER_STREAM_ERROR','OpenRouter interrumpió la respuesta. No se confirmó el texto parcial.');
          if(parsed.data.model)model=parsed.data.model;const choice=parsed.data.choices?.[0];
          if(choice?.finish_reason&&choice.finish_reason!=='stop')throw new HttpError(502,'OPENROUTER_INCOMPLETE','El modelo agotó su salida o interrumpió la respuesta. Solicita una entrega menor.');
          const delta=choice?.delta?.content??'';content+=delta;if(content.length>64000)throw new HttpError(502,'OPENROUTER_OUTPUT_LIMIT','La respuesta supera el límite de texto.');if(delta)await options.onDelta(delta);
        }
        if(!completed||!content.trim())throw new HttpError(502,'OPENROUTER_INCOMPLETE','OpenRouter terminó sin confirmar una respuesta completa.');
        return{content:content.trim(),sources:[],model};
      }
      const parsed = completionSchema.safeParse(await response.json().catch(() => null));
      const content = parsed.success ? parsed.data.choices[0]?.message.content?.trim() : undefined;
      if (parsed.success && parsed.data.choices[0]?.finish_reason === 'length' && (!content || options?.purpose === 'proposal')) throw new HttpError(502, 'OPENROUTER_OUTPUT_LIMIT', 'El modelo agotó su límite de salida. Solicita un cambio más pequeño o ajusta OPENROUTER_MAX_TOKENS.');
      if (!parsed.success || !content) throw new HttpError(502, 'OPENROUTER_EMPTY_RESPONSE', 'OpenRouter no devolvió una respuesta de texto válida.');
      return { content, sources: [], model: parsed.data.model ?? this.model };
    } catch (error: unknown) {
      if (error instanceof HttpError) throw error;
      if(options?.signal?.aborted)throw error;
      if (signal.aborted) throw new HttpError(504, 'OPENROUTER_TIMEOUT', 'OpenRouter excedió el tiempo de espera.');
      throw new HttpError(502, 'OPENROUTER_UNAVAILABLE', 'No se pudo conectar con OpenRouter.');
    }
  }
}
