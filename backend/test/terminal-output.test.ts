import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TerminalOutput } from '../src/interfaces/terminal-output.js';
const marker='[🛡️ POSE 1: Centinela Documental | OJOS: [| |] | ESCUDO: DOCS_RESUMEN]';
test('salida terminal: oculta el metadato intermedio observado en Gemini sin perder texto',()=>{
 let text='';const printer=new TerminalOutput(value=>{text+=value;});
 for(const part of ['El botón incrementa ','una unidad.\n\n[🛡️ PO','SE 1: Centinela Documental | OJOS: [| |] | ESCUDO: DOCS_RESUMEN]\n\n','No he leído archivos.'])printer.push(part);
 printer.finish();assert.doesNotMatch(text,/POSE|OJOS|ESCUDO/);assert.match(text,/El botón incrementa una unidad/);assert.match(text,/No he leído archivos/);
});
test('salida terminal: conserva metadatos citados, código, bloques abiertos e identificadores inválidos',()=>{
 for(const value of ['```text\n'+marker+'\n```','~~~text\n'+marker,'> '+marker,'    '+marker,marker.replace('POSE 1:','POSE 17:')]){
  let text='';const printer=new TerminalOutput(part=>{text+=part;});printer.push(value);printer.finish();assert.equal(text,value);
 }
});
test('salida terminal: el texto normal sale sin esperar punto o fin de respuesta',()=>{
 let text='';const printer=new TerminalOutput(value=>{text+=value;});printer.push('Comandante');assert.equal(text,'Comandante');printer.push(', propongo ');assert.equal(text,'Comandante, propongo ');printer.push('un cambio.\n'+marker);printer.finish();assert.doesNotMatch(text,/POSE/);
});
