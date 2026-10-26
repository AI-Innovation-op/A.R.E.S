export async function* readSse(body:ReadableStream<Uint8Array>,signal?:AbortSignal){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='',event='message',data:string[]=[];
 const abort=()=>{void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{while(true){signal?.throwIfAborted();const part=await reader.read();signal?.throwIfAborted();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>524288)throw new Error('Evento demasiado grande');let end:number;
  while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);if(!line){if(data.length)yield{event,data:data.join('\n')};event='message';data=[];}else if(!line.startsWith(':')){const colon=line.indexOf(':'),key=colon<0?line:line.slice(0,colon);let value=colon<0?'':line.slice(colon+1);if(value.startsWith(' '))value=value.slice(1);if(key==='event')event=value;else if(key==='data')data.push(value);if(data.join('\n').length>524288)throw new Error('Evento demasiado grande');}}
 }}finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
