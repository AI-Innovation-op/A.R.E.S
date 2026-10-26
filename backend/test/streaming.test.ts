import assert from'node:assert/strict';
import{test}from'node:test';
import request from'supertest';
import{GenerateContentResponse,FinishReason}from'@google/genai';
import{OpenRouterAdapter}from'../src/modules/chat/infrastructure/openrouter-adapter.js';
import{GeminiAdapter}from'../src/modules/chat/infrastructure/gemini-adapter.js';
import{readSse}from'../src/shared/sse.js';
import{createApp}from'../src/server.js';
import{SendMessage}from'../src/modules/chat/application/send-message.js';
import{HttpError}from'../src/shared/http-error.js';
const stream=(text:string)=>new ReadableStream<Uint8Array>({start(controller){const bytes=new TextEncoder().encode(text);for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}});
test('SSE conserva Unicode dividido, comentarios, CRLF y data en varias líneas',async()=>{const frames=[];for await(const frame of readSse(stream(': comentario\r\nevent: delta\r\ndata: hola 🌟\r\ndata: segunda línea\r\n\r\n')))frames.push(frame);assert.deepEqual(frames,[{event:'delta',data:'hola 🌟\nsegunda línea'}]);});
test('OpenRouter transmite contenido visible e ignora razonamiento, exige cierre completo',async()=>{
 let body:Record<string,unknown>={};const transport:typeof fetch=async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response(stream(': processing\n\ndata: {"model":"fixture","choices":[{"delta":{"content":"Hola 🌟","reasoning":"NO MOSTRAR"}}]}\n\ndata: {"choices":[{"delta":{"content":" mundo"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'),{headers:{'Content-Type':'text/event-stream'}});};
 const deltas:string[]=[],adapter=new OpenRouterAdapter('fixture','fixture','Sistema público',60000,4096,transport),reply=await adapter.generate([{role:'user',content:'Hola'}],'programming',{onDelta:text=>{deltas.push(text);}});assert.equal(reply.content,'Hola 🌟 mundo');assert.deepEqual(deltas,['Hola 🌟',' mundo']);assert.equal(body.stream,true);assert.ok(!reply.content.includes('NO MOSTRAR'));
 for(const tail of ['', 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n','event: error\ndata: {"message":"fallo"}\n\ndata: [DONE]\n\n']){const broken=new OpenRouterAdapter('fixture','fixture','Público',10000,100,async()=>new Response(stream('data: {"choices":[{"delta":{"content":"parcial"}}]}\n\n'+tail),{headers:{'Content-Type':'text/event-stream'}}));await assert.rejects(broken.generate([{role:'user',content:'Hola'}],'programming',{onDelta:()=>{}}));}
});
test('Gemini transmite fragmentos SDK y la cancelación detiene el flujo',async()=>{
 const chunk=(text:string,finish=false)=>Object.assign(new GenerateContentResponse(),{candidates:[{content:{parts:[{text}]},...(finish?{finishReason:FinishReason.STOP}:{})}]});
 const models={generateContent:async()=>chunk('final',true),generateContentStream:async()=>async function*(){yield chunk('Hola ');yield chunk('mundo',true);}()};
 const deltas:string[]=[],adapter=new GeminiAdapter('fixture','fixture','Sistema público',60000,'low',models as never);assert.equal((await adapter.generate([{role:'user',content:'Hola'}],'documentation',{onDelta:text=>{deltas.push(text);}})).content,'Hola mundo');assert.deepEqual(deltas,['Hola ','mundo']);
 const controller=new AbortController();await assert.rejects(adapter.generate([{role:'user',content:'Hola'}],'documentation',{signal:controller.signal,onDelta:()=>{controller.abort();}}));
});
test('HTTP progresivo entrega fragmentos y confirmación, y errores controlados conservan un evento de fallo',async()=>{
 let fail=false;const app=createApp({allowedOrigins:['http://localhost:5175'],checkDatabase:async()=>{},sendMessage:new SendMessage({generate:async(_messages,_task,options)=>{await options?.onDelta?.('primera parte');if(fail)throw new HttpError(502,'PROVIDER_DOWN','Proveedor interrumpido.');return{content:'primera parte completa',sources:[]};}})});
 const response=await request(app).post('/api/chat').set('Accept','text/event-stream').send({message:'hola'});assert.equal(response.status,200);assert.match(response.text,/event: delta/);assert.match(response.text,/event: done/);fail=true;const failed=await request(app).post('/api/chat').set('Accept','text/event-stream').send({message:'hola'});assert.match(failed.text,/event: error/);assert.doesNotMatch(failed.text,/event: done/);
});
