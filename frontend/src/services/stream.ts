export async function generationData(response:Response,onDelta?:(text:string)=>void):Promise<unknown>{
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return response.json().catch(()=>null);
 if(!response.body)throw new Error('No se recibió el flujo de la respuesta.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',event='message',data:string[]=[],length=0;
 try{while(true){const part=await reader.read();if(part.done)break;buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>524288)throw new Error('La respuesta supera el límite de recepción.');let end:number;
  while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);if(!line){if(data.length){let value:unknown;try{value=JSON.parse(data.join('\n'));}catch{throw new Error('El servidor envió un fragmento inválido.');}if(event==='done')return value;if(event==='error'){const message=value&&typeof value==='object'&&'error'in value&&value.error&&typeof value.error==='object'&&'message'in value.error&&typeof value.error.message==='string'?value.error.message:'La generación se interrumpió.';throw new Error(message);}if(event==='delta'&&value&&typeof value==='object'&&'text'in value&&typeof value.text==='string'){length+=value.text.length;if(length>64000)throw new Error('La respuesta supera el límite de texto.');onDelta?.(value.text);}}event='message';data=[];}
   else if(!line.startsWith(':')){const colon=line.indexOf(':'),key=colon<0?line:line.slice(0,colon);let value=colon<0?'':line.slice(colon+1);if(value.startsWith(' '))value=value.slice(1);if(key==='event')event=value;else if(key==='data')data.push(value);if(data.join('\n').length>524288)throw new Error('Fragmento demasiado grande.');}
  }
 }throw new Error('La respuesta se interrumpió antes de confirmarse. El texto parcial no se guardó.');
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
