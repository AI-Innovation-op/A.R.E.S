import { chunkText, EMBEDDING_MODEL, type ContextRetriever, type Embeddings, type MemoryRepository } from '../domain/memory.js';
import { HttpError } from '../../../shared/http-error.js';
import type { CodeMemory } from './code-memory.js';
export class MemoryService implements ContextRetriever {
  private readonly active = new Set<string>();
  constructor(private readonly repository: MemoryRepository, private readonly embeddings: () => Embeddings | null,private readonly code?:CodeMemory) {}
  async status(projectId: string) { const status=await this.repository.status(projectId, EMBEDDING_MODEL),files=this.code?await this.code.list(projectId):[];return { ...status, configured: this.embeddings() !== null,...(this.code?{codeFiles:files.length,indexedCodeFiles:files.filter(file=>file.current).length}:{}) }; }
  async index(projectId: string) {
    if (this.active.has(projectId)) throw new HttpError(409, 'INDEX_BUSY', 'Este proyecto ya está preparando su memoria. Espera y actualiza el estado.');
    this.active.add(projectId);
    try {
      const status = await this.status(projectId);
      const document = await this.repository.next(projectId, EMBEDDING_MODEL);
      if (!document) return status;
      const gateway = this.embeddings();
      if (!gateway) throw new HttpError(503, 'EMBEDDING_NOT_CONFIGURED', 'Configura Gemini para preparar la memoria del proyecto.');
      const chunks = chunkText(document.content);
      const batch = chunks.map((text, number) => ({ number, text })).filter(chunk => !document.completed.includes(chunk.number)).slice(0, 8);
      const vectors = await gateway.embed(batch.map(chunk => chunk.text), 'RETRIEVAL_DOCUMENT');
      if (vectors.length !== batch.length) throw new HttpError(502, 'INVALID_EMBEDDINGS', 'Gemini devolvió una cantidad inesperada de embeddings.');
      await this.repository.save(document, gateway.model, batch.map((chunk, index) => ({ ...chunk, vector: vectors[index]! })), chunks.length);
      return await this.status(projectId);
    } finally { this.active.delete(projectId); }
  }
  async retrieve(projectId: string, question: string) {
    const status = await this.status(projectId);
    if (!status.indexedDocuments && !status.indexedCodeFiles && status.pendingDocuments) throw new HttpError(409, 'MEMORY_NOT_READY', 'Prepara la memoria del proyecto antes de consultarla.');
    if (!status.indexedDocuments && !status.indexedCodeFiles) return { ...status, references: [] };
    const gateway = this.embeddings();
    if (!gateway) throw new HttpError(503, 'EMBEDDING_NOT_CONFIGURED', 'Configura Gemini para consultar la memoria del proyecto.');
    const vectors = await gateway.embed([chunkText(question)[0] ?? question], 'RETRIEVAL_QUERY');
    if (!vectors[0]) throw new HttpError(502, 'INVALID_EMBEDDINGS', 'Gemini no devolvió el embedding de la consulta.');
    const references = [...await this.repository.search(projectId, gateway.model, vectors[0]),...(this.code?await this.code.search(projectId,gateway.model,vectors[0]):[])].sort((a,b)=>b.similarity-a.similarity||a.artifactId.localeCompare(b.artifactId)).slice(0,4).map((reference,index)=>({...reference,label:'D'+(index+1)}));
    return { projectId, projectName: status.projectName, indexedDocuments: status.indexedDocuments, pendingDocuments: status.pendingDocuments, references };
  }
}
