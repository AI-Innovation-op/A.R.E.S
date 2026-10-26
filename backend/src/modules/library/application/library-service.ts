import type { ChatGateway,GenerationOptions } from '../../chat/domain/chat.js';
import { formats, modulePrompt, type ArtifactInput, type LibraryRepository, type ModuleId } from '../domain/library.js';
import { HttpError } from '../../../shared/http-error.js';

export class LibraryService {
  private readonly active = new Set<string>();
  constructor(private readonly repository: LibraryRepository, private readonly gateway: ChatGateway) {}
  projects() { return this.repository.projects(); }
  createProject(name: string) { return this.repository.createProject(name); }
  list(projectId: string, module?: ModuleId, before?: number) { return this.repository.list(projectId, module, before); }
  read(id: string) { return this.repository.read(id); }
  async generate(input: ArtifactInput,options?:GenerationOptions) {
    if (!(formats[input.module] as readonly string[]).includes(input.format)) throw new HttpError(400, 'INVALID_FORMAT', 'Este tipo de entrega no pertenece al módulo.');
    const key = `${input.projectId}:${input.requestId}`;
    if (this.active.has(key)) throw new HttpError(409, 'GENERATION_BUSY', 'Este borrador se está generando. Espera y actualiza la biblioteca.');
    this.active.add(key);
    try {
      const existing = await this.repository.prepare(input);
      if (existing) return existing;
      const reply = await this.gateway.generate([{ role: 'user', content: modulePrompt(input) }], input.module,options);
      options?.signal?.throwIfAborted();
      const content = reply.content.replace(/^\[[^\r\n]*?\bPOSE\s+(?:[1-9]|1[0-6]):[^\r\n]*\]\s*(?:\r?\n|$)/u, '').trim();
      if (!content || content.length > 1000000 || !reply.provider || !reply.model) throw new HttpError(502, 'INVALID_ARTIFACT', 'El proveedor no devolvió un borrador válido con su modelo.');
      return await this.repository.commit(input, { ...reply, content, provider: reply.provider, model: reply.model });
    } finally { this.active.delete(key); }
  }
}
