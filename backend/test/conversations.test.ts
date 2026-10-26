import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/server.js';
import { ConversationService } from '../src/modules/chat/application/conversation-service.js';
import { SendMessage } from '../src/modules/chat/application/send-message.js';
import type { ChatGateway, ChatReply } from '../src/modules/chat/domain/chat.js';
import type { Conversation, HistoryRepository, SavedTurn, StoredMessage, TurnInput } from '../src/modules/chat/domain/history.js';

class MemoryHistory implements HistoryRepository {
  conversation: Conversation = { id: randomUUID(), title: 'Nueva conversación', revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  messages: StoredMessage[] = [];
  saved = new Map<string, SavedTurn>();
  async list() { return [this.conversation]; }
  async create(title: string) { this.conversation = { ...this.conversation, title }; return this.conversation; }
  async read() { return { conversation: this.conversation, messages: this.messages, hasMore: false }; }
  async prepare(input: TurnInput) { return { conversation: { ...this.conversation }, history: this.messages.map(({ role, content }) => ({ role, content })), existing: this.saved.get(input.requestId) }; }
  async commit(input: TurnInput, reply: ChatReply) {
    this.conversation.revision++;
    const rows: StoredMessage[] = [
      { id: randomUUID(), sequence: this.messages.length + 1, createdAt: new Date().toISOString(), role: 'user', content: input.message, sources: [] },
      { id: randomUUID(), sequence: this.messages.length + 2, createdAt: new Date().toISOString(), role: 'model', ...reply },
    ];
    this.messages.push(...rows);
    const result = { ...reply, conversationId: input.conversationId, revision: this.conversation.revision, messages: rows };
    this.saved.set(input.requestId, result); return result;
  }
}
const input = (repository: MemoryHistory): TurnInput => ({ conversationId: repository.conversation.id, requestId: randomUUID(), revision: repository.conversation.revision, task: 'programming', message: 'Mensaje' });

test('guarda el par completo con metadatos y reintenta el mismo envío sin repetir generación', async () => {
  const repository = new MemoryHistory(); let calls = 0;
  const service = new ConversationService(repository, { generate: async messages => { calls++; assert.equal(messages.at(-1)?.content, 'Mensaje'); return { content: 'Respuesta', sources: [], provider: 'openrouter', model: 'test' }; } });
  const turn = input(repository);
  const first = await service.send(turn); const second = await service.send(turn);
  assert.equal(calls, 1); assert.equal(repository.messages.length, 2); assert.deepEqual(first, second);
  assert.equal(first.messages[1]?.provider, 'openrouter');
});

test('un error del proveedor no deja mensajes huérfanos', async () => {
  const repository = new MemoryHistory();
  const service = new ConversationService(repository, { generate: async () => { throw new Error('sin respuesta'); } });
  await assert.rejects(service.send(input(repository))); assert.equal(repository.messages.length, 0); assert.equal(repository.conversation.revision, 0);
});

test('rechaza revisiones antiguas antes de cobrar otra generación y bloquea envíos simultáneos', async () => {
  const repository = new MemoryHistory(); let calls = 0; let deliver: ((reply: ChatReply) => void) | undefined;
  const service = new ConversationService(repository, { generate: () => { calls++; return new Promise(resolve => { deliver = resolve; }); } });
  const sending = service.send(input(repository));
  await new Promise(resolve => setTimeout(resolve, 0));
  await assert.rejects(service.send(input(repository)), /ya está generando/);
  deliver!({ content: 'ok', sources: [] }); await sending;
  await assert.rejects(service.send({ ...input(repository), revision: 0 }), /cambió en otra pestaña/);
  assert.equal(calls, 1);
});

test('la API protege escrituras y rechaza historial del cliente en un envío persistente', async () => {
  const repository = new MemoryHistory(); const gateway: ChatGateway = { generate: async () => ({ content: 'ok', sources: [] }) };
  const app = createApp({ sendMessage: new SendMessage(gateway), allowedOrigins: ['http://localhost:5173'], checkDatabase: async () => {}, conversations: new ConversationService(repository, gateway) });
  assert.equal((await request(app).post('/api/conversations').send({})).status, 403);
  assert.equal((await request(app).post('/api/conversations').set('Origin', 'http://localhost:5173').send({})).status, 201);
  const turn = input(repository);
  const body = { requestId: turn.requestId, revision: 0, task: turn.task, message: turn.message, history: [] };
  assert.equal((await request(app).post(`/api/conversations/${turn.conversationId}/messages`).set('Origin', 'http://localhost:5173').send(body)).status, 400);
  assert.equal((await request(app).get('/api/conversations/not-a-uuid')).status, 400);
});
