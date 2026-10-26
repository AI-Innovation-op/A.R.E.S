import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { testDatabase } from './database.js';
import { PostgresHistory } from '../../src/modules/chat/infrastructure/postgres-history.js';
import { ConversationService } from '../../src/modules/chat/application/conversation-service.js';
import { migrateDatabase } from '../../src/config/migrations.js';
import type { ChatReply, Provider } from '../../src/modules/chat/domain/chat.js';

const pool = await testDatabase();
const owners: string[] = [];
function repository() { const owner = randomUUID(); owners.push(owner); return new PostgresHistory(pool, owner); }
after(async () => {
  try { await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])', [owners]); }
  finally { await pool.end(); }
});

test('aplica el SQL maestro con pgvector y repite migraciones sin perder datos', async () => {
  const before = await pool.query('SELECT count(*)::int AS count FROM ares_schema_migrations');
  await migrateDatabase(pool);
  const after = await pool.query('SELECT count(*)::int AS count FROM ares_schema_migrations');
  assert.equal(after.rows[0].count, before.rows[0].count);
  const vector = await pool.query("SELECT extname FROM pg_extension WHERE extname='vector'");
  assert.equal(vector.rows.length, 1);
});

test('guarda, recupera y reintenta un turno con proveedor y modelo reales de su contrato', async () => {
  const repo = repository(); const conversation = await repo.create('Nueva conversación'); let calls = 0;
  const service = new ConversationService(repo, { generate: async () => { calls++; return { content: '[🛡️ POSE 15: DOCS]\nDocumento', sources: [{ uri: 'https://example.com', title: 'Referencia' }], provider: 'gemini', model: 'test-model' }; } });
  const input = { conversationId: conversation.id, requestId: randomUUID(), revision: 0, task: 'documentation' as const, message: 'Mi primera consulta' };
  const saved = await service.send(input);
  await service.send(input); assert.equal(calls, 1);
  const restored = await repo.read(conversation.id);
  assert.equal(restored.messages.length, 2); assert.equal(restored.conversation.revision, 1);
  assert.equal(restored.conversation.title, 'Mi primera consulta');
  assert.equal(restored.messages[1]?.provider, 'gemini'); assert.equal(restored.messages[1]?.model, 'test-model'); assert.equal(restored.messages[1]?.poseNumber, 15);
  assert.equal(restored.messages[1]?.sources[0]?.title, 'Referencia');
  assert.deepEqual(saved.messages, restored.messages);
  await assert.rejects(service.send({ ...input, message: 'Otro texto' }), /ya se usó/);
});

test('un fallo de inserción revierte juntos la revisión y los dos mensajes', async () => {
  const repo = repository(); const conversation = await repo.create('Atomicidad');
  await assert.rejects(repo.commit({ conversationId: conversation.id, requestId: randomUUID(), revision: 0, task: 'programming', message: 'Texto válido' }, { content: 'Respuesta', sources: [], provider: 'invalid' as Provider }));
  const page = await repo.read(conversation.id); assert.equal(page.messages.length, 0); assert.equal(page.conversation.revision, 0);
});

test('no permite leer una conversación perteneciente a otro comandante', async () => {
  const owner = repository(); const other = repository(); const conversation = await owner.create('Privada');
  await assert.rejects(other.read(conversation.id), /No se encontró/);
});

test('paginación estable con timestamps iguales y más de cien mensajes', async () => {
  const repo = repository(); const conversation = await repo.create('Paginación');
  await pool.query(`INSERT INTO messages (conversation_id,role,content)
    SELECT $1, CASE WHEN i%2=1 THEN 'user' ELSE 'model' END, 'Mensaje '||i
    FROM generate_series(1,110) AS i ORDER BY i`, [conversation.id]);
  const recent = await repo.read(conversation.id);
  assert.equal(recent.messages.length, 100); assert.equal(recent.hasMore, true); assert.equal(recent.messages[0]?.content, 'Mensaje 11');
  const older = await repo.read(conversation.id, recent.messages[0]?.sequence);
  assert.equal(older.messages.length, 10); assert.equal(older.hasMore, false); assert.equal(older.messages[0]?.content, 'Mensaje 1');
});

test('rechaza un estado obsoleto antes de llamar al proveedor', async () => {
  const repo = repository(); const conversation = await repo.create('Revisión');
  const reply: ChatReply = { content: 'ok', sources: [] };
  await repo.commit({ conversationId: conversation.id, requestId: randomUUID(), revision: 0, task: 'programming', message: 'Primer turno' }, reply);
  let calls = 0; const service = new ConversationService(repo, { generate: async () => { calls++; return reply; } });
  await assert.rejects(service.send({ conversationId: conversation.id, requestId: randomUUID(), revision: 0, task: 'programming', message: 'Obsoleto' }), /cambió/);
  assert.equal(calls, 0);
});
test('una transmisión interrumpida o cancelada no confirma mensajes parciales',async()=>{
 const repo=repository(),conversation=await repo.create('Streaming'),input={conversationId:conversation.id,requestId:randomUUID(),revision:0,task:'programming' as const,message:'Ejemplo público'};let partial='';
 const failing=new ConversationService(repo,{generate:async(_messages,_task,options)=>{await options?.onDelta?.('parcial');throw new Error('Proveedor interrumpido');}});await assert.rejects(failing.send(input,{onDelta:text=>{partial+=text;}}));assert.equal(partial,'parcial');assert.equal((await repo.read(conversation.id)).messages.length,0);
 const controller=new AbortController(),cancelled=new ConversationService(repo,{generate:async(_messages,_task,options)=>{await options?.onDelta?.('parcial');return{content:'final',sources:[]};}});await assert.rejects(cancelled.send(input,{signal:controller.signal,onDelta:()=>{controller.abort();}}));assert.equal((await repo.read(conversation.id)).messages.length,0);
 const completed=new ConversationService(repo,{generate:async()=>({content:'Respuesta completa',sources:[]})});await completed.send(input);assert.equal((await repo.read(conversation.id)).messages.length,2);
});
