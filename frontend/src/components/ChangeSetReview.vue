<script setup lang="ts">
import ComparativeDiff from './ComparativeDiff.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { SourceFile } from '../services/workspace';
import { changeSetRequest, type ChangeSet } from '../services/change-sets';
import { proposalLabels } from '../services/changes';
import { useWorkspaceStore } from '../stores/workspace';
import { downloadText } from '../utils/download';
const props=defineProps<{projectId:string;file:SourceFile|null;disabled?:boolean}>();
const emit=defineEmits<{changed:[];busy:[value:boolean]}>();
const workspace=useWorkspaceStore();
const activePath=ref('');
const activeFile=computed(()=>selected.value?.files.find(file=>file.path===activePath.value)??selected.value?.files[0]);
const chosen=ref<{path:string;sha256:string|null}[]>([]),newPath=ref(''),instruction=ref(''),sets=ref<ChangeSet[]>([]),selected=ref<ChangeSet|null>(null),busy=ref(false),error=ref(''),checkAfter=ref(false);
let retry:{signature:string;id:string}|undefined;
let disposed=false;
watch(busy,value=>emit('busy',value));
onUnmounted(()=>{disposed=true;emit('busy',false);});
async function refresh(){ const project=props.projectId;try{ const result=await changeSetRequest<{sets:ChangeSet[]}>(project);if(disposed||props.projectId!==project)return;sets.value=result.sets;if(selected.value)selected.value=sets.value.find(item=>item.id===selected.value?.id)??null; }catch(cause){if(!disposed&&props.projectId===project)error.value=(cause as Error).message;} }
function add(path:string,sha256:string|null){if(chosen.value.length<5&&!chosen.value.some(item=>item.path.toLowerCase()===path.toLowerCase()))chosen.value.push({path,sha256});newPath.value='';}
async function generate(){busy.value=true;error.value='';const project=props.projectId;try{const signature=JSON.stringify([project,chosen.value,instruction.value]);if(retry?.signature!==signature)retry={signature,id:crypto.randomUUID()};const result=await changeSetRequest<{set:ChangeSet}>(project,'',{requestId:retry.id,files:chosen.value,instruction:instruction.value});if(project===props.projectId){selected.value=result.set;retry=undefined;await refresh();}}catch(cause){error.value=(cause as Error).message;}finally{busy.value=false;}}
async function act(action:'apply'|'revert'|'reject'){
  if(!selected.value)return;busy.value=true;error.value='';const project=props.projectId;
  try{const result=await changeSetRequest<{set:ChangeSet}>(project,`/${selected.value.id}/${action}`,action==='reject'?{}:{approvedHash:selected.value.approvedHash});if(disposed||project!==props.projectId)return;selected.value=result.set;await refresh();emit('changed');
    if(action==='apply'&&checkAfter.value&&workspace.projectId===project&&workspace.preview){const directory=workspace.preview.directory;await workspace.browse(directory);if(!disposed&&workspace.projectId===project&&workspace.preview?.scripts.some(script=>script.name==='check'&&script.runnable))await workspace.execute('check');else error.value='Cambio aplicado. No hay un script check disponible en esta carpeta.';}
  }catch(cause){error.value=(cause as Error).message;await refresh();}finally{busy.value=false;}
}
watch(()=>props.projectId,()=>{chosen.value=[];selected.value=null;sets.value=[];retry=undefined;void refresh();});onMounted(()=>{void refresh();});
</script>
<template>
  <section class="change-review" aria-label="Cambios de varios archivos"><div class="result-toolbar"><h3>Conjunto de cambios</h3><button class="connection-action" :disabled="busy||disabled" @click="refresh">Actualizar conjuntos</button></div><p class="muted">Selecciona hasta cinco archivos. Los existentes admiten parches sobre archivos de hasta 64 KB; el conjunto admite 128 KB de contexto. Los nuevos se crean dentro de carpetas existentes.</p>
    <button class="connection-action" :disabled="busy||disabled||!file||file.redacted||chosen.length>=5" @click="file&&add(file.path,file.sha256)">Añadir archivo leído al conjunto</button>
    <form class="new-file-form" @submit.prevent="add(newPath.trim(),null)"><label for="new-change-path">Ruta de archivo nuevo</label><input id="new-change-path" v-model="newPath" maxlength="1000" placeholder="src/nuevo.ts" :disabled="busy||disabled"/><button class="connection-action" :disabled="busy||disabled||!newPath.trim()||chosen.length>=5">Añadir archivo nuevo</button></form>
    <ul class="set-selection"><li v-for="(item,index) in chosen" :key="item.path"><code>{{ item.path }}</code><span>{{ item.sha256 ? 'Modificar' : 'Crear' }}</span><button class="connection-action" :disabled="busy||disabled" :aria-label="`Quitar ${item.path}`" @click="chosen.splice(index,1)">Quitar</button></li></ul>
    <form @submit.prevent="generate"><label for="set-instruction">Cambio para el conjunto</label><textarea id="set-instruction" v-model="instruction" rows="3" maxlength="2500" :disabled="busy||disabled"/><button class="primary-button" :disabled="busy||disabled||!chosen.length||!instruction.trim()">Generar conjunto</button></form>
    <p v-if="busy" class="result-note" role="status">Procesando conjunto…</p><p v-if="error" class="library-error" role="alert">{{ error }}</p>
    <div class="proposal-list"><button v-for="set in sets" :key="set.id" :disabled="busy||disabled" @click="selected=set"><strong>{{ set.summary }}</strong><span>{{ set.files.length }} archivos · {{ proposalLabels[set.status] }}</span></button></div>
    <section v-if="selected" class="proposal-detail" aria-label="Diff del conjunto"><p class="draft-label">{{ proposalLabels[selected.status] }} · {{ selected.model }}</p><h3>{{ selected.summary }}</h3><p class="source-hash">{{ selected.workspacePath }}<br/>Huella del conjunto: {{ selected.approvedHash }}</p><div class="comparison-file-list" role="group" aria-label="Archivos del conjunto"><button v-for="item in selected.files" :key="item.path" type="button" class="connection-action" :aria-pressed="activeFile?.path===item.path" @click="activePath=item.path">{{ item.path }} · {{ item.before===null?'Nuevo':'Modificar' }}</button></div><ComparativeDiff v-if="activeFile" :key="selected.id+activeFile.path" :before="activeFile.before" :after="activeFile.after" :path="activeFile.path"/><details v-for="item in selected.files" :key="item.path"><summary>Parche de texto: {{ item.path }}</summary><pre class="set-diff">{{ item.patch }}</pre></details><p v-if="selected.lastError" class="library-error">{{ selected.lastError }}</p>
      <label v-if="['DRAFT','APPLYING'].includes(selected.status)&&workspace.preview?.scripts.some(item=>item.name==='check'&&item.runnable)" class="set-check"><input v-model="checkAfter" type="checkbox" :disabled="busy||disabled"/>Ejecutar check de {{ workspace.preview.directory || '/' }} después de aplicar: <code>{{ workspace.preview.scripts.find(item=>item.name==='check')?.command }}</code></label>
      <div class="source-actions"><button v-if="['DRAFT','APPLYING'].includes(selected.status)" class="primary-button" :disabled="busy||disabled" @click="act('apply')">{{ selected.status==='APPLYING'?'Completar aplicación':'Aplicar conjunto revisado' }}</button><button v-if="['APPLIED','APPLYING','REVERTING'].includes(selected.status)" class="connection-action" :disabled="busy||disabled" @click="act('revert')">Restaurar conjunto</button><button v-if="selected.status==='DRAFT'" class="connection-action" :disabled="busy||disabled" @click="act('reject')">Descartar conjunto</button><button class="connection-action" @click="downloadText(`ares-${selected.id}.patch`,selected.files.map(item=>item.patch).join('\n'),'text/plain')">Descargar diff del conjunto</button></div>
      <p class="result-note">Se revisan todos los originales antes de escribir. Si una operación se interrumpe, puedes completarla o restaurarla. Restaurar retira los archivos creados únicamente si conservan el contenido aplicado. Los cambios posteriores se conservan. Las comprobaciones muestran su resultado en el historial del repositorio.</p>
    </section>
  </section>
</template>
<style scoped>
.new-file-form {display:grid;gap:9px;margin:20px 0}.new-file-form input {width:100%;padding:12px;background:#08151a;border:1px solid #29434b;color:#dcebf0;border-radius:6px}.set-selection {list-style:none;padding:0;display:grid;gap:10px}.set-selection li{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.set-selection code{overflow-wrap:anywhere}.set-selection span{font-size:11px;color:#92acb6}.set-diff{max-height:450px;overflow:auto;padding:12px;background:#061015;font-size:12px}.set-check{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:18px 0}.set-check input{width:auto}
</style>
