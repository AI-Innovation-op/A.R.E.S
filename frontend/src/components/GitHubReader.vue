<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { GitBranch, X, Search, LoaderCircle } from '@lucide/vue';
import { githubRequest, type GitHubSnapshot, type GitHubRead, type GitHubReport } from '../services/github';
import { useAccessStore } from '../stores/access';
const props = defineProps<{ open: boolean; projectId: string }>();
const emit = defineEmits<{ close: []; report: [report: GitHubReport, snapshotId: string, projectId: string] }>();
const access = useAccessStore();
const panel = ref<HTMLElement>(), heading = ref<HTMLElement>();
const url = ref(''), revision = ref(''), filter = ref(''), showExcluded = ref(false), page = ref(1);
const snapshot = ref<GitHubSnapshot>(), read = ref<GitHubRead>(), report = ref<GitHubReport>();
const selected = ref<string[]>([]), busy = ref(''), error = ref(''), notice = ref('');
let controller: AbortController | undefined, trigger: HTMLElement | null = null, requestId = '';
const filtered = computed(() => (snapshot.value?.files ?? []).filter(file => (showExcluded.value || file.eligible) && file.path.toLowerCase().includes(filter.value.toLowerCase())));
const visible = computed(() => filtered.value.slice((page.value - 1) * 60, page.value * 60));
const bytes = computed(() => (snapshot.value?.files ?? []).filter(file => selected.value.includes(file.path)).reduce((sum, file) => sum + file.size, 0));
const matchesRead = computed(() => !!read.value && read.value.selected === selected.value.length && [...read.value.files, ...read.value.failures].every(file => selected.value.includes(file.path)));
const canRead = computed(() => selected.value.length > 0 && selected.value.length <= 8 && bytes.value <= 98304);
watch([filter, showExcluded], () => { page.value = 1; });
watch(() => props.open, async open => {
  if (open) { trigger = document.activeElement as HTMLElement; await nextTick(); heading.value?.focus(); }
  else if (trigger?.isConnected) trigger.focus();
});
watch(() => access.canWrite, allowed => { if (!allowed) { controller?.abort(); snapshot.value = undefined; read.value = undefined; report.value = undefined; selected.value = []; emit('close'); } });
onUnmounted(() => controller?.abort());
function close() { controller?.abort(); emit('close'); }
function toggle(path: string) {
  selected.value = selected.value.includes(path) ? selected.value.filter(value => value !== path) : [...selected.value, path];
  report.value = undefined; requestId = '';
}
async function run(operation: 'inspect' | 'read' | 'analyze') {
  if (busy.value || !access.canWrite) return;
  controller = new AbortController(); const signal = controller.signal;
  busy.value = operation; error.value = ''; notice.value = '';
  try {
    if (operation === 'inspect') {
      const isPullRequest=/\/pull\/[1-9][0-9]*\/?$/.test(url.value.trim());
      const value = await githubRequest<GitHubSnapshot>(isPullRequest?'pull-request':'inspect', { url: url.value.trim(), ...(!isPullRequest&&revision.value.trim() ? { ref: revision.value.trim() } : {}) }, signal);
      if (signal.aborted) return;
      snapshot.value = value; selected.value = []; read.value = undefined; report.value = undefined; requestId = ''; page.value = 1; filter.value = '';
    } else if (operation === 'read' && snapshot.value && canRead.value) {
      const value = await githubRequest<GitHubRead>('read', { snapshotId: snapshot.value.id, paths: selected.value }, signal);
      if (signal.aborted) return;
      read.value = value; report.value = undefined; requestId = '';
    } else if (operation === 'analyze' && snapshot.value && read.value && matchesRead.value) {
      requestId ||= crypto.randomUUID();
      const value = await githubRequest<GitHubReport>('analyze', { snapshotId: snapshot.value.id, readId: read.value.id, requestId }, signal);
      if (signal.aborted) return;
      report.value = value;
      emit('report', value, snapshot.value.id, props.projectId);
    }
  } catch (cause) { if (!signal.aborted) error.value = (cause as Error).message; }
  finally { if (signal.aborted) notice.value = 'Operación cancelada. No se confirma ningún resultado nuevo.'; busy.value = ''; controller = undefined; }
}
function trap(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key !== 'Tab') return;
  const controls = [...panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex="0"]') ?? []].filter(element => element.offsetParent !== null);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.value)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
</script>

<template>
  <div v-if="open" class="github-overlay" @click.self="close">
    <section ref="panel" class="github-reader" role="dialog" aria-modal="true" aria-labelledby="github-heading" @keydown="trap">
      <header><div><span class="eyebrow">FUENTES VERIFICABLES</span><h2 id="github-heading" ref="heading" tabindex="-1"><GitBranch :size="21"/> Leer GitHub</h2></div><button class="icon-button" aria-label="Cerrar lectura GitHub" @click="close"><X :size="20"/></button></header>
      <div class="github-body">
        <p>Inspecciona un repositorio público, elige sus archivos y revisa lo leído antes de analizarlo con OpenRouter. No se clona ni ejecuta código.</p>
        <form class="github-inspect" @submit.prevent="run('inspect')">
          <label>Repositorio público<input v-model="url" type="url" required placeholder="https://github.com/organización/repositorio" :disabled="!!busy" maxlength="300"/></label>
          <label>Rama, etiqueta o commit (opcional)<input v-model="revision" placeholder="Rama predeterminada" :disabled="!!busy" maxlength="180"/></label>
          <button class="connection-action" :disabled="!!busy || !access.canWrite"><Search :size="14"/> Inspeccionar</button>
        </form>
        <p v-if="busy" role="status" class="github-progress"><LoaderCircle :size="15"/> {{ busy === 'inspect' ? 'Fijando revisión y leyendo inventario…' : busy === 'read' ? 'Leyendo solo los archivos seleccionados…' : 'OpenRouter está analizando la lectura…' }} <button class="connection-action" @click="controller?.abort()">Cancelar</button></p>
        <p v-if="error" role="alert" class="github-error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
        <template v-if="snapshot">
          <div v-if="snapshot.pullRequest" class="github-revision"><a :href="snapshot.pullRequest.url" target="_blank" rel="noopener noreferrer">{{ snapshot.pullRequest.title }}</a><strong>PR · revisión estática de la cabecera</strong><span>{{ snapshot.pullRequest.changedFiles }} archivos cambiados. Se eligen archivos del commit de cabecera; la base y el diff completo no se analizan automáticamente.</span><details><summary>Rutas cambiadas · {{ snapshot.pullRequest.filesComplete?'lista completa':'lista parcial' }}</summary><p v-for="file in snapshot.pullRequest.files" :key="file.path">{{ file.status }} · {{ file.path }}</p></details></div>
          <div class="github-revision"><strong>{{ snapshot.repository }}</strong><span>Revisión: {{ snapshot.ref }}</span><a :href="`${snapshot.url}/commit/${snapshot.commit}`" target="_blank" rel="noopener noreferrer">Commit {{ snapshot.commit }}</a><small>Lectura temporal hasta {{ new Date(snapshot.expiresAt).toLocaleTimeString('es') }}. Este inventario aún no es un análisis.</small></div>
          <p role="status">{{ snapshot.listedFiles }} rutas listadas · {{ snapshot.incomplete || snapshot.limited ? 'Inventario parcial; total desconocido' : 'Inventario completo' }}. Los archivos no seleccionados no se leen.</p>
          <div class="github-filters"><label>Filtrar rutas<input v-model="filter" type="search" placeholder="src/, dominio, README…"/></label><label class="github-check"><input v-model="showExcluded" type="checkbox"/> Ver excluidos</label></div>
          <div class="github-files" aria-label="Archivos del repositorio">
            <label v-for="file in visible" :key="file.path" class="github-file"><input type="checkbox" :checked="selected.includes(file.path)" :disabled="!!busy || !file.eligible || (!selected.includes(file.path) && selected.length >= 8)" @change="toggle(file.path)"/><span>{{ file.path }}<small>{{ file.eligible ? `${file.size} bytes` : file.reason }}</small></span></label>
            <p v-if="!visible.length">No hay rutas que coincidan con el filtro.</p>
          </div>
          <div class="github-pagination"><button class="connection-action" :disabled="page <= 1" @click="page--">Anterior</button><span>{{ page }} / {{ Math.max(1, Math.ceil(filtered.length / 60)) }}</span><button class="connection-action" :disabled="page * 60 >= filtered.length" @click="page++">Siguiente</button></div>
          <div class="github-actions"><span>{{ selected.length }}/8 seleccionados · {{ (bytes / 1024).toFixed(1) }}/96 KiB · máximo 64 KiB por archivo</span><button class="connection-action" :disabled="!!busy || !canRead" @click="run('read')">Leer selección</button></div>
          <p v-if="selected.length && !canRead" role="alert" class="github-error">Reduce la selección para respetar el límite de lectura.</p>
          <template v-if="read">
            <h3>Lectura confirmada</h3><p>{{ read.files.length }} leídos de {{ read.selected }} seleccionados · {{ read.bytes }} bytes</p>
            <p v-if="!matchesRead" role="status">Cambiaste la selección. Vuelve a leerla antes de analizar.</p>
            <details v-for="file in read.files" :key="file.path" class="github-preview"><summary>{{ file.path }} · {{ file.redacted ? 'secretos ocultos' : 'texto completo' }}</summary><p>SHA-256 {{ file.sha256 }}</p><a :href="file.url" target="_blank" rel="noopener noreferrer">Ver fuente fijada en GitHub</a><pre>{{ file.content }}</pre></details>
            <p v-for="failure in read.failures" :key="failure.path" class="github-error">No leído: {{ failure.path }} — {{ failure.reason }}</p>
            <div class="github-actions"><span>Solo el contenido confirmado y sus fuentes se enviarán al modelo.</span><button class="connection-action" :disabled="!!busy || !matchesRead || !read.files.length" @click="report && snapshot ? emit('report', report, snapshot.id, projectId) : run('analyze')">{{ report ? 'Abrir informe' : 'Analizar con OpenRouter' }}</button></div>
          </template>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.github-overlay{position:fixed;inset:0;background:#020a10c9;z-index:90;display:grid;place-items:center;padding:20px;backdrop-filter:blur(5px)}
.github-reader{width:min(860px,100%);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:var(--bg-panel,#0b181f);border:1px solid #28504a;border-radius:14px;box-shadow:0 24px 100px #0008;color:var(--text-primary,#d9ecef)}
header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #254047}h2{display:flex;gap:10px;align-items:center;margin:6px 0 0;font-size:23px}.eyebrow{font-size:10px;letter-spacing:2px;color:#71a9ab}
.github-body{padding:0 24px 24px;overflow:auto;overscroll-behavior:contain;font-size:13px;line-height:1.65}.github-body>p{color:#9db7c2}.github-inspect{display:grid;grid-template-columns:1.5fr 1fr;gap:12px}.github-inspect>button{justify-self:start}label{display:flex;flex-direction:column;gap:5px;color:#9ebac4;font-size:12px}input:not([type=checkbox]){width:100%;box-sizing:border-box;min-width:0;padding:10px;background:#081318;border:1px solid #28404b;border-radius:6px;color:#dbe9ef;font:inherit}input:focus-visible,button:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid #39e9b0;outline-offset:3px}
.github-revision{display:flex;flex-direction:column;gap:4px;margin-top:20px;padding:12px;border:1px solid #254047;border-radius:6px;overflow-wrap:anywhere}.github-revision a,.github-preview a{color:#5ee5c5}.github-revision small{color:#89a6b2}.github-filters{display:flex;gap:18px;align-items:end;margin:14px 0}.github-filters>label:first-child{flex:1}.github-check{flex-direction:row;align-items:center;white-space:nowrap}.github-files{max-height:240px;overflow:auto;background:#081318;border:1px solid #223e48;border-radius:6px}.github-file{display:flex;flex-direction:row;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:1px solid #172d34;overflow-wrap:anywhere}.github-file input{margin-top:5px;accent-color:#36e9b1}.github-file small{display:block;color:#7897a6}.github-file:has(input:checked){background:#16372f}.github-pagination,.github-actions,.github-progress{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;margin:12px 0}.github-actions>span{flex:1;min-width:180px;color:#92aab8}.github-body .github-error{color:#ffb5ae}.github-preview{border:1px solid #29414b;border-radius:6px;padding:10px;margin:8px 0}.github-preview summary{cursor:pointer;overflow-wrap:anywhere}.github-preview p{font-size:11px;overflow-wrap:anywhere}.github-preview pre{max-height:260px;overflow:auto;background:#061016;padding:12px;font-size:11px;white-space:pre}.connection-action{display:inline-flex;align-items:center;gap:6px}button:disabled{opacity:.45}
@media(max-width:600px){.github-overlay{padding:8px}.github-reader{max-height:calc(100dvh - 16px)}header{padding:16px}.github-body{padding:0 16px 16px}.github-inspect{grid-template-columns:1fr}.github-file{font-size:11px}.github-filters{align-items:start;flex-direction:column;width:100%}.github-filters>label:first-child{width:100%}}
</style>
