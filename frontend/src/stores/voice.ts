import { defineStore } from 'pinia';
import { computed,ref,shallowRef } from 'vue';
import { spokenText } from '../domain/speech';
const preferenceKey='ares.voice.v1';
export const useVoiceStore=defineStore('voice',()=>{
  const enabled=ref(false),voices=shallowRef<SpeechSynthesisVoice[]>([]),selected=ref(''),rate=ref(.96),speaking=ref(false),preparing=ref(false),error=ref(''),source=ref('');
  const supported=typeof window.speechSynthesis!=='undefined'&&typeof window.SpeechSynthesisUtterance!=='undefined';
  let initialized=false,armed=false,active:SpeechSynthesisUtterance|undefined,revision=0,deadline:ReturnType<typeof setTimeout>|undefined;
  const voice=computed(()=>voices.value.find(item=>item.voiceURI===selected.value)??voices.value.find(item=>/pablo|jorge|alvaro|diego/i.test(item.name))??voices.value.find(item=>/^es[-_]?(?:PE|MX)$/i.test(item.lang))??voices.value.find(item=>item.localService)??voices.value[0]);
  function save(){try{localStorage.setItem(preferenceKey,JSON.stringify({enabled:enabled.value,voice:selected.value,rate:rate.value}));}catch{/* La voz funciona sin almacenamiento. */}}
  function refreshVoices(){if(!supported)return;voices.value=window.speechSynthesis.getVoices().filter(item=>/^es(?:[-_]|$)/i.test(item.lang));}
  function initialize(){if(initialized)return;initialized=true;try{const data=JSON.parse(localStorage.getItem(preferenceKey)??'null');if(data){enabled.value=data.enabled===true;selected.value=typeof data.voice==='string'?data.voice:'';rate.value=typeof data.rate==='number'&&data.rate>=.8&&data.rate<=1.15?data.rate:.96;}}catch{/* Preferencias inválidas: valores iniciales. */}if(supported){refreshVoices();window.speechSynthesis.addEventListener?.('voiceschanged',refreshVoices);}}
  function stop(){revision++;clearTimeout(deadline);if(active){active.onstart=null;active.onend=null;active.onerror=null;}active=undefined;if(supported)window.speechSynthesis.cancel();speaking.value=false;preparing.value=false;source.value='';}
  function speak(content:string,id='manual',concise=true){initialize();if(!supported){error.value='Este navegador no ofrece voz. Usa Chrome o Edge con una voz española instalada.';return false;}refreshVoices();const chosen=voice.value;if(!chosen){error.value='El navegador todavía no ofrece una voz española. Espera unos segundos o habilita una voz de español en el sistema.';return false;}const text=spokenText(content,concise);if(!text)return false;stop();error.value='';const version=revision;const utterance=new SpeechSynthesisUtterance(text);active=utterance;utterance.voice=chosen;utterance.lang=chosen.lang||'es-ES';utterance.rate=rate.value;utterance.pitch=.95;source.value=id;preparing.value=true;
    const finished=()=>{if(version!==revision)return;clearTimeout(deadline);active=undefined;preparing.value=false;speaking.value=false;source.value='';};
    utterance.onstart=()=>{if(version!==revision)return;clearTimeout(deadline);preparing.value=false;speaking.value=true;deadline=setTimeout(()=>{if(version!==revision)return;stop();error.value='La reproducción agotó su tiempo. Puedes leer el texto o volver a probar la voz.';},120000);};utterance.onend=finished;utterance.onerror=event=>{if(version!==revision)return;finished();error.value=event.error==='not-allowed'?'Pulsa Probar voz para habilitar el audio en esta pestaña.':'La voz no pudo reproducirse. Prueba otra voz española.';};
    deadline=setTimeout(()=>{if(version!==revision||!preparing.value)return;stop();error.value='La voz no comenzó a reproducirse. Pulsa Probar voz o elige otra voz española.';},10000);
    try{window.speechSynthesis.speak(utterance);return true;}catch{finished();error.value='No se pudo iniciar la voz del navegador.';return false;}
  }
  function activate(){enabled.value=true;armed=true;save();speak('Comandante, estoy listo. Te responderé en español claro y leeré un resumen de cada respuesta.','preview');}
  function disable(){enabled.value=false;save();stop();error.value='';}
  function readSummary(content:string,id:string){if(!enabled.value||document.hidden)return;if(!armed&&navigator.userActivation?.hasBeenActive!==true){error.value='Pulsa Probar voz para habilitar el audio en esta pestaña.';return;}armed=true;speak(content,id);}
  function selectVoice(value:string){selected.value=value;stop();save();}
  function changeRate(value:number){rate.value=Math.max(.8,Math.min(1.15,value));save();}
  function dispose(){stop();if(supported)window.speechSynthesis.removeEventListener?.('voiceschanged',refreshVoices);initialized=false;armed=false;}
  return{enabled,voices,selected,rate,speaking,preparing,error,source,supported,voice,initialize,stop,speak,activate,disable,readSummary,selectVoice,changeRate,dispose};
});
