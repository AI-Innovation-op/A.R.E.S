import { parsePose } from './poses';
import { renderMarkdown } from '../utils/markdown';

export function spokenText(content:string,concise=true):string{
  const source=parsePose(content).text.replace(/```[\s\S]*?(?:```|$)/g,'\n').replace(/^\s*#{1,6}\s+.*$/gm,'').replace(/`[^`]+`/g,'el código en pantalla').replace(/https?:\/\/[^\s<>]+/g,'el enlace en pantalla').replace(/\[D\d+\]/g,'');
  const element=document.createElement('div');element.innerHTML=renderMarkdown(source);
  const text=(element.textContent??'').replace(/\s+/g,' ').trim();
  if(!text)return content.includes('```')?'El código está en pantalla para que lo revises.':'';
  if(!concise)return text.slice(0,12000);
  const sentences=text.split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9])/u);
  let summary=sentences.slice(0,2).join(' ').trim();
  if(summary.length>420){summary=summary.slice(0,420);const space=summary.lastIndexOf(' ');summary=summary.slice(0,space>300?space:420).replace(/[,;:]$/,'')+'…';}
  return summary;
}
