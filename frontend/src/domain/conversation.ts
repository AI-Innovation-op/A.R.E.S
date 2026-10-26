export type VoiceCommand = { kind: 'none' } | { kind: 'wake'; remainder: string } | { kind: 'sleep' } | { kind: 'cancel' };
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.!?,;:¿¡]/g,' ').replace(/\s+/g,' ').trim();
export function voiceCommand(text:string):VoiceCommand {
  const value=normalized(text);
  if(/^(?:ares )?(?:descansa|a dormir|duerme)$/.test(value))return{kind:'sleep'};
  if(/^(?:ares )?(?:cancelar|cancela|descartar)$/.test(value))return{kind:'cancel'};
  const match=/^\s*[¡¿]?(?:(?:ey|hey|oye)[,\s]+)?[aá][.\s]*r[.\s]*e[.\s]*s\b[.!?,;:\s]*/i.exec(text);
  if(match)return{kind:'wake',remainder:text.slice(match[0].length).trim()};
  return{kind:'none'};
}
export function completeVoiceTurn(text:string) {
  const match=/(?:^|\s)(?:okey|okay|ok)[.!?,;:…\s]*$/i.exec(text);
  return { complete:!!match, text:match?text.slice(0,match.index).trim():text.trim() };
}
export interface RecognitionResult { isFinal:boolean; [index:number]:{transcript:string} }
export interface Recognition {
  lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
  onstart:(()=>void)|null;onresult:((event:{resultIndex:number;results:ArrayLike<RecognitionResult>})=>void)|null;
  onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
  start():void;stop():void;abort():void;
}
export function recognitionConstructor(){const value=window as Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return value.SpeechRecognition??value.webkitSpeechRecognition;}
