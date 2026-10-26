import { ApiError, GoogleGenAI, ThinkingLevel,type GenerateContentConfig } from '@google/genai';
import type { ChatGateway, ChatReply, Message,ChatTask,GenerationOptions } from '../domain/chat.js';
import { HttpError } from '../../../shared/http-error.js';

export class GeminiAdapter implements ChatGateway {
  private readonly models:Pick<GoogleGenAI['models'],'generateContent'|'generateContentStream'>;

  constructor(apiKey: string, private readonly model: string,
    private readonly systemInstruction: string, private readonly timeoutMs: number,
    private readonly thinkingLevel: 'minimal' | 'low' | 'medium' | 'high' = 'low',models?:Pick<GoogleGenAI['models'],'generateContent'|'generateContentStream'>) {
    this.models = models??new GoogleGenAI({ apiKey }).models;
  }

  async generate(messages: readonly Message[],_task?:ChatTask,options?:GenerationOptions): Promise<ChatReply> {
    const timeout=AbortSignal.timeout(this.timeoutMs),signal=options?.signal?AbortSignal.any([timeout,options.signal]):timeout;
    try {
      const config:GenerateContentConfig={
          systemInstruction: this.systemInstruction,
          abortSignal: signal,
          maxOutputTokens: 4096,
          ...(this.model.replace(/^models\//, '') === 'gemini-3-flash-preview' ? {
            thinkingConfig: { thinkingLevel: { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH }[this.thinkingLevel] },
          } : {}),
        };
      const request={model:this.model,contents:messages.map(message=>({role:message.role,parts:[{text:message.content}]})),config};
      if(options?.onDelta){
        const stream=await this.models.generateContentStream(request);let content='',finished=false;const sources:ChatReply['sources']=[];
        for await(const chunk of stream){signal.throwIfAborted();const delta=chunk.text??'';content+=delta;if(content.length>64000)throw new HttpError(502,'GEMINI_OUTPUT_LIMIT','La respuesta supera el límite de texto. Solicita una entrega menor.');if(delta)await options.onDelta(delta);const reason=chunk.candidates?.[0]?.finishReason;if(reason){if(reason!=='STOP')throw new HttpError(502,'GEMINI_INCOMPLETE','Gemini interrumpió la respuesta antes de completarla. No se confirmó el texto parcial.');finished=true;}sources.push(...(chunk.candidates?.[0]?.groundingMetadata?.groundingChunks??[]).flatMap(item=>item.web?.uri?[{uri:item.web.uri,title:item.web.title??item.web.uri}]:[]));}
        if(!finished||!content.trim())throw new HttpError(502,'GEMINI_INCOMPLETE','El flujo de Gemini terminó sin confirmar una respuesta completa.');
        return{content:content.trim(),sources:Array.from(new Map(sources.map(source=>[source.uri,source])).values()).slice(0,5)};
      }
      const response = await this.models.generateContent(request);
      const content = response.text?.trim();
      if (!content) throw new HttpError(502, 'EMPTY_RESPONSE', 'Gemini no devolvió texto; la respuesta puede estar bloqueada.');
      const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
        .flatMap(chunk => chunk.web?.uri ? [{ uri: chunk.web.uri, title: chunk.web.title ?? chunk.web.uri }] : []);
      return { content, sources };
    } catch (error: unknown) {
      if (error instanceof HttpError) throw error;
      if(options?.signal?.aborted)throw error;
      if (signal.aborted) throw new HttpError(504, 'GEMINI_TIMEOUT', 'Gemini excedió el tiempo de espera.');
      if (error instanceof ApiError && error.status === 429) {
        throw new HttpError(429, 'GEMINI_QUOTA', 'Cuota de Gemini agotada; inténtalo más tarde.');
      }
      throw new HttpError(502, 'GEMINI_UNAVAILABLE', 'No se pudo consultar Gemini. Revisa la configuración del servicio.');
    }
  }
}
