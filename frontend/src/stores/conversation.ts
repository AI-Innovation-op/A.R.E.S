import { defineStore } from 'pinia';
import { computed,ref,watch } from 'vue';
import { completeVoiceTurn,recognitionConstructor,voiceCommand,type Recognition } from '../domain/conversation';
import { useConsoleStore } from './console';
import { useVoiceStore } from './voice';
import { useAccessStore } from './access';

export const useConversationStore=defineStore('conversation-mode',()=>{
  const consoleStore=useConsoleStore(),voice=useVoiceStore(),access=useAccessStore();
  const enabled=ref(false),phase=ref<'off'|'standby'|'listening'|'review'|'thinking'|'speaking'>('off');
  const transcript=ref(''),interim=ref(''),notice=ref(''),error=ref(''),documentReplies=ref(false),noteStatus=ref('');
  const microphone=ref(false),savingNote=ref(false);
  const heard=ref('');
  const supported=!!recognitionConstructor();
  const labels={off:'Conversación desactivada',standby:'Esperando «ARES»',listening:'Te escucho · termina con «okey»',review:'Revisa tu mensaje',thinking:'Preparando respuesta',speaking:'A.R.E.S. está hablando'};
  const label=computed(()=>labels[phase.value]);
  let recognition:Recognition|undefined,epoch=0,restart:ReturnType<typeof setTimeout>|undefined,turnDeadline:ReturnType<typeof setTimeout>|undefined;
  let quickEnds=0,returnTo:'standby'|'listening'='listening',utteranceStarted=false,turnStarted=0;
  function clearTimers(){clearTimeout(restart);clearTimeout(turnDeadline);}
  function halt(){epoch++;clearTimeout(restart);if(recognition){recognition.onstart=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{}}recognition=undefined;microphone.value=false;interim.value='';}
  function stop(message=''){enabled.value=false;phase.value='off';clearTimers();halt();voice.stop();notice.value=message;heard.value='';}
  function pause(){halt();clearTimers();phase.value='review';notice.value='No se envió nada. Revisa la transcripción y pulsa Enviar turno o continúa dictando.';}
  function listen(next:'standby'|'listening',continuing=false){
    if(!enabled.value||document.hidden||!access.canWrite)return;
    halt();clearTimeout(turnDeadline);phase.value=next;
    if(next==='listening'){if(!continuing)turnStarted=Date.now();const remaining=90000-(Date.now()-turnStarted);if(remaining<=0){pause();return;}turnDeadline=setTimeout(pause,remaining);}
    const Constructor=recognitionConstructor();if(!Constructor){stop('Este navegador no ofrece reconocimiento continuo. Puedes usar Dictar con Gemini.');return;}
    const current=new Constructor(),version=epoch;recognition=current;
    current.lang='es-PE';current.continuous=true;current.interimResults=true;current.maxAlternatives=1;
    let started=Date.now(),recognized=false;const finalIndices=new Set<number>();
    current.onstart=()=>{if(version===epoch){microphone.value=true;started=Date.now();}};
    current.onresult=event=>{
      if(version!==epoch||!enabled.value||voice.speaking||voice.preparing||consoleStore.pending)return;
      recognized=true;quickEnds=0;let partial='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i];if(!result)continue;const text=result[0]?.transcript.trim()??'';
        if(!result.isFinal){partial+=' '+text;continue;}
        if(finalIndices.has(i))continue;finalIndices.add(i);
        if(phase.value==='standby')heard.value=text.slice(0,140);
        const command=voiceCommand(text);
        if(phase.value!=='standby'&&command.kind==='sleep'){transcript.value='';say('De acuerdo. Aquí estaré cuando digas ARES.','standby');return;}
        if(phase.value!=='standby'&&command.kind==='cancel'){transcript.value='';say('He descartado el mensaje. ¿Qué necesitas?','listening');return;}
        if(phase.value==='standby'){
          if(command.kind==='wake'){transcript.value=command.remainder;const turn=completeVoiceTurn(command.remainder);if(turn.complete&&turn.text){transcript.value=turn.text;void send();}else if(command.remainder){halt();listen('listening');}else say('Aquí estoy. ¿En qué te ayudo?','listening');return;}
          continue;
        }
        if(phase.value!=='listening')continue;
        const turn=completeVoiceTurn([transcript.value,text].filter(Boolean).join(' '));transcript.value=turn.text;
        if(transcript.value.length>16000){error.value='El mensaje supera 16 000 caracteres. Recórtalo antes de enviarlo.';pause();return;}
        if(turn.complete){if(turn.text)void send();else notice.value='Todavía no hay un mensaje. Dime qué necesitas y termina con okey.';return;}
      }
      interim.value=partial.trim();
    };
    current.onerror=event=>{
      if(version!==epoch)return;
      if(event.error==='no-speech')return;
      error.value=event.error==='not-allowed'||event.error==='service-not-allowed'?'Autoriza el micrófono en el navegador y vuelve a activar la conversación.':event.error==='audio-capture'?'No se encontró un micrófono disponible. Conéctalo y vuelve a intentarlo.':'Se interrumpió el reconocimiento. Revisa la conexión y vuelve a activar la conversación.';
      stop('Conservé la transcripción; no se envió automáticamente.');
    };
    current.onend=()=>{
      if(version!==epoch||!enabled.value||!['standby','listening'].includes(phase.value))return;
      microphone.value=false;
      if(!recognized&&Date.now()-started<2000)quickEnds++;else quickEnds=0;
      if(quickEnds>=3){error.value='El servicio de voz se desconecta repetidamente. Reactiva la conversación o usa el dictado manual.';stop();return;}
      restart=setTimeout(()=>{if(version===epoch&&enabled.value)listen(phase.value as 'standby'|'listening',true);},600);
    };
    try{current.start();}catch{error.value='No se pudo iniciar la escucha. Comprueba los permisos del navegador.';stop();}
  }
  function resumeAfterSpeech(){if(!enabled.value||phase.value!=='speaking')return;clearTimeout(restart);restart=setTimeout(()=>{if(enabled.value&&phase.value==='speaking')listen(returnTo);},600);}
  function say(text:string,next:'standby'|'listening'){
    halt();clearTimers();returnTo=next;phase.value='speaking';utteranceStarted=false;
    if(!voice.speak(text,'conversation-mode',true)){notice.value=voice.error||'La respuesta queda en pantalla.';resumeAfterSpeech();}
  }
  watch(()=>voice.speaking||voice.preparing,active=>{if(!enabled.value||phase.value!=='speaking')return;if(active)utteranceStarted=true;else if(utteranceStarted)resumeAfterSpeech();});
  function start(){if(!supported||!access.canWrite||consoleStore.pending)return;error.value='';notice.value='El navegador puede procesar el audio en línea. Solo se envía a A.R.E.S. el turno que cierres con okey.';enabled.value=true;quickEnds=0;voice.stop();if(transcript.value.trim()){phase.value='review';notice.value='Conservaste un borrador. Revísalo, envíalo o pulsa Continuar dictando.';}else listen('standby');}
  function continueTurn(){if(enabled.value&&!consoleStore.pending){error.value='';voice.stop();listen('listening');}}
  function interrupt(){voice.stop();if(consoleStore.pending)consoleStore.cancel();pause();notice.value='Respuesta detenida. Revisa el historial si el servidor ya había confirmado el turno.';}
  function discard(){transcript.value='';interim.value='';error.value='';if(enabled.value){voice.stop();listen('standby');}}
  async function saveNote(conversationId:string,messageId:string){savingNote.value=true;noteStatus.value='Guardando borrador en Biblioteca…';try{const response=await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/notes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??'No se pudo guardar el borrador.');noteStatus.value=`Borrador guardado en Biblioteca: ${data.artifact.title}. No se modificaron archivos.`;}catch(cause){noteStatus.value='No se guardó el borrador: '+(cause as Error).message;}finally{savingNote.value=false;}}
  async function send(){
    if(!enabled.value||consoleStore.pending||consoleStore.historyBusy||!access.canWrite)return;
    if(savingNote.value){pause();notice.value='Espera a que termine el guardado anterior y pulsa Enviar turno. Conservé tu mensaje.';return;}
    const text=transcript.value.trim();if(!text||text.length>16000)return;
    halt();clearTimers();
    if(consoleStore.draft.trim()&&consoleStore.draft.trim()!==text){phase.value='review';error.value='Hay un mensaje escrito en el chat. Envíalo o vacíalo antes de enviar este turno de voz.';return;}
    phase.value='thinking';error.value='';notice.value='';const before=consoleStore.completedReply?.id,shouldDocument=documentReplies.value;
    consoleStore.draft=text;await consoleStore.runChat();
    const reply=consoleStore.completedReply;
    if(reply&&reply.id!==before){
      transcript.value='';
      if(shouldDocument){if(reply.conversationId&&reply.messageId)void saveNote(reply.conversationId,reply.messageId);else noteStatus.value='No se guardó un borrador: hace falta una conversación persistente vinculada a un proyecto.';}
      if(enabled.value)say(reply.content,'listening');
    }else if(enabled.value){phase.value='review';error.value=consoleStore.error||'El turno no se confirmó. Revisa el mensaje antes de reintentar.';}
  }
  watch(()=>access.canWrite,canWrite=>{if(!canWrite)stop();});
  watch(()=>voice.speaking||voice.preparing,active=>{if(active&&enabled.value&&['standby','listening'].includes(phase.value)){halt();clearTimers();phase.value='review';notice.value='Escucha pausada mientras se reproduce audio. Pulsa Continuar dictando para retomarla.';}});
  watch(()=>consoleStore.pending,pending=>{if(pending&&enabled.value&&['standby','listening'].includes(phase.value))pause();});
  return{enabled,phase,transcript,interim,heard,notice,error,documentReplies,noteStatus,microphone,savingNote,supported,label,start,stop,pause,continueTurn,interrupt,discard,send};
});
