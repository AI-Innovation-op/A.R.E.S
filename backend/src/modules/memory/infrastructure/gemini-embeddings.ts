import { ApiError, GoogleGenAI } from '@google/genai';
import { DIMENSIONS, EMBEDDING_MODEL, normalizedVector, type Embeddings } from '../domain/memory.js';
import { HttpError } from '../../../shared/http-error.js';

export class GeminiEmbeddings implements Embeddings {
  readonly model = EMBEDDING_MODEL;
  private readonly client: GoogleGenAI;
  constructor(apiKey: string, private readonly timeoutMs = 30000) { this.client = new GoogleGenAI({ apiKey }); }
  async embed(texts: string[], task: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') {
    if (!texts.length) return [];
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await this.client.models.embedContent({ model: this.model, contents: texts,
        config: { taskType: task, outputDimensionality: DIMENSIONS, abortSignal: signal } });
      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== texts.length) throw new Error('Cantidad de embeddings inesperada');
      return embeddings.map(embedding => normalizedVector(embedding.values ?? []));
    } catch (error) {
      if (signal.aborted) throw new HttpError(504, 'EMBEDDING_TIMEOUT', 'Gemini tardó demasiado en preparar la memoria. Puedes reanudarla.');
      if (error instanceof ApiError && error.status === 429) throw new HttpError(429, 'EMBEDDING_QUOTA', 'Se agotó la cuota de embeddings de Gemini. La memoria ya preparada se conserva.');
      throw new HttpError(502, 'EMBEDDING_UNAVAILABLE', 'No se pudieron generar los embeddings. Comprueba Gemini en Conexiones IA y reintenta.');
    }
  }
}
