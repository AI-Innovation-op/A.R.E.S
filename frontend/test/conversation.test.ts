import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createPinia,setActivePinia,disposePinia} from 'pinia';
import {nextTick} from 'vue';
import {voiceCommand,completeVoiceTurn,recognitionFrame,type Recognition} from '../src/domain/conversation';
import {useConversationStore} from '../src/stores/conversation';
import {useConsoleStore} from '../src/stores/console';
let recognitions:FakeRecognition[]=[],utterance:{onstart:(()=>void)|null;onend:(()=>void)|null;text:string}|undefined;
let pinia:ReturnType<typeof createPinia>;
class FakeRecognition implements Recognition {
 lang='';continuous=false;interimResults=false;maxAlternatives=1;onstart:(()=>void)|null=null;onresult:Recognition['onresult']=null;onerror:Recognition['onerror']=null;onend:(()=>void)|null=null;
 events:{isFinal:boolean;0:{transcript:string}}[]=[];active=false;
 constructor(){recognitions.push(this);}start(){this.active=true;this.onstart?.();}stop(){this.active=false;this.onend?.();}abort(){this.active=false;}
 emit(text:string,final=true){const index=this.events.length;this.events.push({isFinal:final,0:{transcript:text}});this.onresult?.({resultIndex:index,results:this.events});}
}
beforeEach(()=>{pinia=createPinia();setActivePinia(pinia);vi.useFakeTimers();localStorage.clear();recognitions=[];utterance=undefined;vi.stubGlobal('SpeechRecognition',FakeRecognition);vi.stubGlobal('SpeechSynthesisUtterance',class {text:string;lang='';onstart=null;onend=null;onerror=null;constructor(text:string){this.text=text;}});vi.stubGlobal('speechSynthesis',{getVoices:()=>[{voiceURI:'es',lang:'es-PE',name:'Español',localService:true}],cancel:vi.fn(),speak:vi.fn(value=>{utterance=value;}),addEventListener(){},removeEventListener(){}});const consoleStore=useConsoleStore();consoleStore.historyStatus='offline';consoleStore.historyBusy=false;vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({content:'Puedo ayudarte a organizar tu día. Empecemos por tu prioridad.',sources:[],provider:'openrouter',model:'fixture'}),{status:200,headers:{'Content-Type':'application/json'}})));});
afterEach(()=>{useConversationStore().stop();disposePinia(pinia);vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
async function finishSpeech(){await nextTick();utterance?.onstart?.();await nextTick();utterance?.onend?.();await nextTick();await vi.advanceTimersByTimeAsync(650);}
async function wake(){const store=useConversationStore();store.start();recognitions.at(-1)!.emit('ARES');await finishSpeech();expect(store.phase).toBe('listening');return store;}
it('ARES solo despierta, preserva contenido/caso y okey solo cierra al final',()=>{expect(voiceCommand('Ares.')).toEqual({kind:'wake',remainder:''});expect(voiceCommand('ARES, Explícame OrderId')).toEqual({kind:'wake',remainder:'Explícame OrderId'});expect(voiceCommand('Ey A.R.E.S., Explícame OrderId')).toEqual({kind:'wake',remainder:'Explícame OrderId'});expect(voiceCommand('mi amigo dijo ares')).toEqual({kind:'none'});expect(voiceCommand('áreas de trabajo')).toEqual({kind:'none'});expect(completeVoiceTurn('Quiero decir okey dentro de una frase').complete).toBe(false);expect(completeVoiceTurn('Organiza mi día, okey.')).toEqual({complete:true,text:'Organiza mi día'});expect(completeVoiceTurn('Organiza mi día,okey.').complete).toBe(true);expect(completeVoiceTurn('objeto.ok').complete).toBe(false);});

it('distingue provisionales reemplazados y finales acumulados sin duplicarlos',()=>{
  const seen=new Set<number>(),results=[{isFinal:false,0:{transcript:'Pregunta provisional'}}];
  expect(recognitionFrame(results,seen)).toEqual({finals:[],interim:'Pregunta provisional'});
  results[0]={isFinal:true,0:{transcript:'Pregunta final.'}};results.push({isFinal:false,0:{transcript:'Segunda parte'}});
  expect(recognitionFrame(results,seen)).toEqual({finals:['Pregunta final.'],interim:'Segunda parte'});
  expect(recognitionFrame(results,seen)).toEqual({finals:[],interim:'Segunda parte'});
  results[1]={isFinal:true,0:{transcript:'okey.'}};expect(recognitionFrame(results,seen).finals).toEqual(['okey.']);
});
it('un evento con ARES y varios finales conserva todo el turno y solo envía una vez',async()=>{
  const store=useConversationStore();store.start();store.start();expect(recognitions).toHaveLength(1);
  const results=['ARES.','Explica OrderId.','Con ejemplos,okey.'].map(text=>({isFinal:true,0:{transcript:text}}));
  recognitions[0]!.onresult?.({resultIndex:0,results});await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body).message).toBe('Explica OrderId. Con ejemplos');
});
it('una respuesta tardía de un turno detenido no borra otro borrador ni reactiva voz',async()=>{
  const store=await wake(),chat=useConsoleStore();let finish!:()=>void;
  vi.spyOn(chat,'runChat').mockImplementation(async()=>{await new Promise<void>(resolve=>{finish=resolve;});chat.completedReply={id:100,content:'Respuesta tardía'};});
  store.transcript='Turno anterior';const sending=store.send();store.stop();store.transcript='Nueva idea';store.start();finish();await sending;
  expect(store.transcript).toBe('Nueva idea');expect(store.phase).toBe('review');
});
it('no escucha al cargar, ignora ambiente en espera y una pausa nunca envía',async()=>{const store=useConversationStore();expect(recognitions).toHaveLength(0);store.start();recognitions.at(-1)!.emit('comida y cancelar');expect(store.phase).toBe('standby');expect(fetch).not.toHaveBeenCalled();recognitions.at(-1)!.emit('ARES');await finishSpeech();recognitions.at(-1)!.emit('Organiza mi día');await vi.advanceTimersByTimeAsync(90000);expect(store.phase).toBe('review');expect(store.transcript).toBe('Organiza mi día');expect(fetch).not.toHaveBeenCalled();});
it('okey envía una sola vez; pausa captura mientras habla y reanuda el siguiente turno',async()=>{const store=await wake(),recognition=recognitions.at(-1)!;recognition.emit('Ayúdame con mis tareas');recognition.emit('okey');await vi.advanceTimersByTimeAsync(0);await nextTick();expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body).message).toBe('Ayúdame con mis tareas');expect(recognition.active).toBe(false);expect(store.phase).toBe('speaking');recognition.emit('eco okey');expect(fetch).toHaveBeenCalledTimes(1);await finishSpeech();expect(store.phase).toBe('listening');expect(recognitions.at(-1)!.active).toBe(true);});
it('permiso denegado apaga y no reinicia; conserva transcripción al reactivar',async()=>{const store=await wake();recognitions.at(-1)!.emit('Borrador pendiente');recognitions.at(-1)!.onerror?.({error:'not-allowed'});expect(store.enabled).toBe(false);expect(store.error).toContain('Autoriza');const count=recognitions.length;await vi.advanceTimersByTimeAsync(2000);expect(recognitions).toHaveLength(count);expect(store.transcript).toBe('Borrador pendiente');store.start();expect(store.phase).toBe('review');expect(store.transcript).toBe('Borrador pendiente');expect(recognitions).toHaveLength(count);});
it('no sobrescribe el chat escrito ni envía un turno parcial o cancelado',async()=>{const store=await wake();useConsoleStore().draft='Mensaje escrito';recognitions.at(-1)!.emit('Otra cosa okey');expect(store.phase).toBe('review');expect(fetch).not.toHaveBeenCalled();expect(useConsoleStore().draft).toBe('Mensaje escrito');store.continueTurn();recognitions.at(-1)!.emit('cancelar');expect(store.transcript).toBe('');expect(fetch).not.toHaveBeenCalled();});
it('repetición de resultados finales no duplica contenido y apagado desconecta callbacks',async()=>{const store=await wake(),recognition=recognitions.at(-1)!;recognition.emit('Un mensaje');recognition.onresult?.({resultIndex:0,results:recognition.events});expect(store.transcript).toBe('Un mensaje');store.stop();expect(recognition.active).toBe(false);expect(recognition.onresult).toBeNull();});
