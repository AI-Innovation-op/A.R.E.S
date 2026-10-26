<script setup lang="ts">
import { onUnmounted,ref,watch } from 'vue';
import DOMPurify from 'dompurify';
import { exportDiagram } from '../utils/diagram-export';
const props=defineProps<{code:string}>(),svg=ref(''),error=ref(''),pending=ref(false);let revision=0;
const surface=ref<HTMLElement>(),zoom=ref(1),x=ref(0),y=ref(0),expanded=ref(false),exporting=ref(false),exportError=ref('');
let drag:{id:number;x:number;y:number}|undefined;
function reset(){zoom.value=1;x.value=0;y.value=0;}
function scale(amount:number){zoom.value=Math.max(.25,Math.min(4,Math.round((zoom.value+amount)*100)/100));}
function move(dx:number,dy:number){x.value=Math.max(-4000,Math.min(4000,x.value+dx));y.value=Math.max(-4000,Math.min(4000,y.value+dy));}
function down(event:PointerEvent){if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);}
function pan(event:PointerEvent){if(!drag||drag.id!==event.pointerId)return;move(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;}
function key(event:KeyboardEvent){const steps:Record<string,[number,number]>={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(steps[event.key]){event.preventDefault();move(...steps[event.key]!);}else if(['+','=','-','0'].includes(event.key)){event.preventDefault();event.key==='0'?reset():scale(event.key==='-'?-.25:.25);}}
async function save(format:'svg'|'png'){const element=surface.value?.querySelector('svg');if(!element||exporting.value)return;exporting.value=true;exportError.value='';try{await exportDiagram(element,format);}catch(cause){exportError.value=cause instanceof Error?cause.message:'No se pudo exportar el diagrama.';}finally{exporting.value=false;}}
onUnmounted(()=>{revision++;});
watch(()=>props.code,async code=>{
 const token=++revision;svg.value='';error.value='';pending.value=true;exportError.value='';reset();drag=undefined;
 let container:HTMLDivElement|undefined;
 try{
  if(code.length>10000||/%%\{|^\s*---|<\/?[a-z!]|\b(?:https?:|javascript:|data:|file:)|@import|url\s*\(|^\s*click\s/im.test(code))throw new Error('El diagrama supera los límites o incluye configuración, HTML o enlaces externos.');
  const {default:mermaid}=await import('mermaid');
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'dark',fontFamily:'monospace',htmlLabels:false,maxTextSize:10000,maxEdges:100,secure:['securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','themeCSS','fontFamily'],flowchart:{htmlLabels:false}});
  if(!await mermaid.parse(code,{suppressErrors:true}))throw new Error('La sintaxis Mermaid no es válida.');
  if(token!==revision)return;
  container=document.createElement('div');container.style.cssText='position:absolute;left:-10000px;top:0;visibility:hidden';document.body.appendChild(container);
  const result=await mermaid.render('ares-diagram-'+crypto.randomUUID(),code,container);
  if(token===revision)svg.value=DOMPurify.sanitize(result.svg,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','image','a','script','use','animate','set','animateMotion','animateTransform'],FORBID_ATTR:['onload','onclick']});
 }catch(cause){if(token===revision)error.value=cause instanceof Error?cause.message:'No se pudo dibujar el diagrama.';}
 finally{container?.remove();if(token===revision)pending.value=false;}
},{immediate:true});
</script>
<template><figure class="mermaid-diagram"><template v-if="svg"><div class="diagram-controls" role="group" aria-label="Controles del diagrama"><button type="button" aria-label="Alejar diagrama" :disabled="zoom<=.25" @click="scale(-.25)">−</button><output aria-label="Zoom del diagrama">{{ Math.round(zoom*100) }}%</output><button type="button" aria-label="Acercar diagrama" :disabled="zoom>=4" @click="scale(.25)">+</button><button type="button" @click="reset">Centrar</button><button type="button" :aria-pressed="expanded" @click="expanded=!expanded">{{ expanded?'Reducir diagrama':'Ampliar diagrama' }}</button><button type="button" :disabled="exporting" @click="save('svg')">Exportar SVG</button><button type="button" :disabled="exporting" @click="save('png')">Exportar PNG</button></div><div ref="surface" class="diagram-svg" :class="{expanded}" role="img" tabindex="0" aria-label="Diagrama Mermaid" title="Arrastra para desplazar. Usa flechas, +, − o 0 con el teclado." @pointerdown="down" @pointermove="pan" @pointerup="drag=undefined" @pointercancel="drag=undefined" @lostpointercapture="drag=undefined" @keydown="key"><div class="diagram-content" :style="{transform:`translate(${x}px, ${y}px) scale(${zoom})`}" v-html="svg"></div></div><figcaption>Arrastra para explorar; flechas para desplazar y +/− para zoom. La descarga incluye el diagrama completo.</figcaption></template><p v-if="pending" role="status">Preparando diagrama…</p><p v-if="error" class="result-note" role="status">{{ error }} Puedes revisar el código del diagrama.</p><p v-if="exportError" class="result-note" role="status">{{ exportError }}</p><details><summary>Ver código Mermaid</summary><pre><code>{{ code }}</code></pre></details></figure></template>
<style scoped>.mermaid-diagram{margin:20px 0;padding:14px;background:#08151a;border:1px solid #233a41;border-radius:8px;overflow:hidden}.diagram-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.diagram-controls button{padding:7px 10px;background:#102a30;border:1px solid #31524c;color:#b8e5d9;border-radius:5px;font:inherit;font-size:11px;cursor:pointer}.diagram-controls button:disabled{opacity:.4;cursor:default}.diagram-controls output{font:11px monospace;min-width:38px;text-align:center}.diagram-svg{height:300px;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;border:1px solid #1c383d;border-radius:4px}.diagram-svg:active{cursor:grabbing}.diagram-svg.expanded{height:65vh}.diagram-svg:focus-visible{outline:2px solid #40e9b5}.diagram-content{width:100%;height:100%;display:flex;align-items:center;justify-content:center;transform-origin:center;user-select:none;pointer-events:none}.diagram-svg :deep(svg){max-width:100%;max-height:100%;width:100%;height:100%}.mermaid-diagram pre{max-height:300px;overflow:auto}.mermaid-diagram summary,.mermaid-diagram figcaption{font-size:11px;margin-top:12px;color:#91acb5}</style>
