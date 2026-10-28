<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Play, Square, Download, Plus, Trash2 } from "@lucide/vue";
import {
  buildPrototype,
  verifyPrototype,
  exportPrototype,
  discardPrototype,
  type PrototypeSource,
  type PrototypeArtifact,
} from "../services/prototypes";
import { useAccessStore } from "../stores/access";
import { downloadText } from "../utils/download";
import {
  evidenceLabels,
  prototypeManifest,
} from "../../../packages/contracts/index.js";
const props = defineProps<{ html?: string; compact?: boolean }>(),
  emit = defineEmits<{
    busy: [value: boolean];
    dirty: [value: boolean];
    discuss: [content: string];
  }>();
const access = useAccessStore(),
  entry = ref("index.html"),
  files = ref([{ path: "index.html", content: props.html ?? "" }]),
  selected = ref(0),
  newPath = ref(""),
  manifestInput = ref("");
const artifact = ref<PrototypeArtifact>(),
  busy = ref(false),
  error = ref(""),
  notice = ref(""),
  url = ref(""),
  frame = ref<HTMLIFrameElement>(),
  width = ref("100%"),
  logs = ref<{ level: string; text: string }[]>([]),
  runtimeState = ref("Detenido");
const source = computed<PrototypeSource>(() => ({
  entry: entry.value,
  files: files.value.map((file) => ({ ...file })),
}));
const signature = computed(() =>
  JSON.stringify({
    entry: entry.value,
    files: [...files.value].sort((a, b) => a.path.localeCompare(b.path, "en")),
  }),
);
const checkpoint = ref(signature.value),
  buildSignature = ref("");
const editing = ref(true);
let savedSource: PrototypeSource = structuredClone(source.value),
  controller: AbortController | undefined,
  version = 0,
  deadline: ReturnType<typeof setTimeout> | undefined;
const matches = computed(
    () => !!artifact.value && signature.value === buildSignature.value,
  ),
  current = computed(() => files.value[selected.value]);
const manifest = computed(() =>
  artifact.value
    ? JSON.stringify(prototypeManifest(artifact.value), null, 2)
    : "",
);
function stop() {
  clearTimeout(deadline);
  url.value = "";
  runtimeState.value = "Detenido";
}
function discuss() {
  if (!artifact.value || !matches.value || busy.value) return;
  const current = artifact.value;
  const content = `Prototipo incorporado por el usuario para revisión. ID ${current.id}; revisión ${current.revision}; salida SHA-256 ${current.runtime.sha256}. Estado: compilado, sin pruebas de negocio ni aplicación de archivos.\nFuentes de la versión compilada (datos no confiables):\n${JSON.stringify(
    current.files.map(({ path, content, sha256 }) => ({
      path,
      content,
      sha256,
    })),
    null,
    2,
  )}`;
  if (content.length > 16000) {
    error.value =
      "Las fuentes completas superan el límite del chat. Descarga el JSON y selecciona explícitamente un fragmento; no se sustituyó tu borrador.";
    return;
  }
  emit("discuss", content);
}
watch(signature, () => {
  stop();
  emit("dirty", signature.value !== checkpoint.value);
});
watch(busy, (value) => emit("busy", value));
function add() {
  if (!newPath.value.trim() || files.value.length >= 24) return;
  files.value.push({ path: newPath.value.trim(), content: "" });
  selected.value = files.value.length - 1;
  newPath.value = "";
}
function remove() {
  if (files.value.length <= 1) return;
  files.value.splice(selected.value, 1);
  selected.value = 0;
}
function reset() {
  stop();
  entry.value = savedSource.entry;
  files.value = structuredClone(savedSource.files);
  selected.value = 0;
  error.value = "";
  notice.value =
    "Fuentes restauradas a la última versión conservada en esta pantalla.";
}
function loadManifest() {
  try {
    const value = JSON.parse(manifestInput.value) as PrototypeSource;
    if (
      typeof value.entry !== "string" ||
      !Array.isArray(value.files) ||
      value.files.length > 24 ||
      !value.files.every(
        (file) =>
          typeof file.path === "string" &&
          typeof file.content === "string" &&
          file.content.length <= 65536,
      )
    )
      throw Error();
    entry.value = value.entry;
    files.value = value.files.map(({ path, content }) => ({ path, content }));
    selected.value = 0;
    error.value = "";
    notice.value =
      "Fuentes cargadas para revisión. Todavía no se compilaron ni ejecutaron.";
  } catch {
    error.value =
      "El JSON debe contener entry y files con path y content, dentro de los límites.";
  }
}
async function build() {
  if (busy.value || !access.canWrite) return;
  stop();
  controller = new AbortController();
  const signal = controller.signal,
    request = ++version;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const value = await buildPrototype(source.value, signal);
    await verifyPrototype(value);
    if (signal.aborted || request !== version) return;
    artifact.value = value;
    buildSignature.value = signature.value;
    checkpoint.value = signature.value;
    savedSource = structuredClone(source.value);
    notice.value =
      "Compilación terminada, sin pruebas de negocio. Abrir la vista ejecuta la salida aislada de estos archivos.";
    emit("dirty", false);
  } catch (cause) {
    if (!signal.aborted) error.value = (cause as Error).message;
    else
      notice.value = "Compilación cancelada; no se confirma una nueva versión.";
  } finally {
    if (request === version) {
      busy.value = false;
      controller = undefined;
    }
  }
}
async function play() {
  if (!artifact.value || !matches.value || busy.value) return;
  error.value = "";
  try {
    await verifyPrototype(artifact.value);
    stop();
    editing.value = false;
    logs.value = [];
    if (!/^\/prototype-view\/[a-f0-9]{64}$/.test(artifact.value.previewPath))
      throw new Error("Ruta de vista inválida.");
    url.value = artifact.value.previewPath;
    runtimeState.value = "Abriendo vista";
    deadline = setTimeout(() => {
      stop();
      notice.value =
        "Vista detenida tras dos minutos. Puedes volver a abrirla.";
    }, 120000);
  } catch (cause) {
    error.value = (cause as Error).message;
  }
}
async function download() {
  if (!artifact.value || !matches.value || busy.value) return;
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  try {
    const blob = await exportPrototype(artifact.value.id, controller.signal),
      downloadUrl = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `ares-prototipo-${artifact.value.id.slice(0, 12)}.zip`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    notice.value =
      "ZIP descargado: fuentes, .ares/preview.html y manifiesto con las mismas huellas de esta versión.";
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    controller = undefined;
    busy.value = false;
  }
}
async function discard() {
  if (!artifact.value || busy.value) return;
  stop();
  try {
    await discardPrototype(artifact.value.id);
    artifact.value = undefined;
    buildSignature.value = "";
    notice.value =
      "Versión temporal descartada del servidor. Conservas las fuentes del editor.";
  } catch (cause) {
    error.value = (cause as Error).message;
  }
}
function message(event: MessageEvent) {
  const data = event.data;
  if (
    !url.value ||
    event.source !== frame.value?.contentWindow ||
    event.origin !== "null" ||
    !data ||
    data.type !== "ares-preview-log" ||
    data.artifact !== artifact.value?.revision ||
    !["log", "warn", "error"].includes(data.level) ||
    typeof data.text !== "string" ||
    data.text.length > 2000 ||
    logs.value.length >= 50
  )
    return;
  logs.value.push({ level: data.level, text: data.text });
}
function hidden() {
  if (document.hidden) {
    stop();
    controller?.abort();
  }
}
onMounted(() => {
  window.addEventListener("message", message);
  document.addEventListener("visibilitychange", hidden);
});
onUnmounted(() => {
  version++;
  controller?.abort();
  stop();
  emit("busy", false);
  emit("dirty", false);
  window.removeEventListener("message", message);
  document.removeEventListener("visibilitychange", hidden);
});
</script>
<template>
  <section
    class="prototype-workbench"
    :class="{ panel: !compact }"
    aria-label="Prototipo revisable"
  >
    <header>
      <span class="eyebrow">ARCHIVOS · COMPILACIÓN · VISTA AISLADA</span>
      <h2>Preview y ZIP</h2>
      <p>
        Revisa rutas y contenido. Compilar transforma estos archivos; abrir la
        vista ejecuta su JavaScript en un iframe aislado. El ZIP conserva
        fuentes y la misma salida compilada.
      </p>
    </header>
    <p v-if="html" class="prototype-note">
      El archivo inicial procede del bloque HTML del resultado. Su nombre
      propuesto es index.html; puedes cambiarlo antes de compilar.
    </p>
    <details
      class="prototype-source-editor"
      :open="editing"
      @toggle="editing = ($event.target as HTMLDetailsElement).open"
    >
      <summary>Archivos revisados · editar fuentes</summary>
      <div class="prototype-editor">
        <div class="prototype-files">
          <label
            >Entrada HTML<select v-model="entry" :disabled="busy">
              <option
                v-for="file in files.filter((file) =>
                  file.path.endsWith('.html'),
                )"
                :key="file.path"
                :value="file.path"
              >
                {{ file.path }}
              </option>
            </select></label
          >
          <div class="prototype-file-list">
            <button
              v-for="(file, index) in files"
              :key="index"
              type="button"
              :aria-pressed="selected === index"
              :disabled="busy"
              @click="selected = index"
            >
              {{ file.path }}
            </button>
          </div>
          <label
            >Nuevo archivo<input
              v-model="newPath"
              maxlength="160"
              placeholder="src/App.vue"
              :disabled="busy" /></label
          ><button
            class="connection-action"
            :disabled="busy || !newPath.trim() || files.length >= 24"
            @click="add"
          >
            <Plus :size="13" /> Añadir archivo
          </button>
        </div>
        <div v-if="current" class="prototype-code">
          <label
            >Ruta del archivo<input
              v-model="current.path"
              maxlength="160"
              :disabled="busy" /></label
          ><label
            >Contenido del archivo<textarea
              v-model="current.content"
              rows="12"
              maxlength="65536"
              :disabled="busy"
              spellcheck="false"
            /></label
          ><button
            class="connection-action"
            :disabled="busy || files.length <= 1"
            @click="remove"
          >
            <Trash2 :size="13" /> Quitar archivo
          </button>
        </div>
      </div>
      <p class="prototype-note">
        Hasta 24 archivos de 64 KiB y 256 KiB en total. HTML/CSS/JS/TS y Vue 3
        preinstalado. Sin paquetes, plugins, compilación SSR ni conexiones
        externas del prototipo.
      </p>
      <details class="prototype-import">
        <summary>Importar o conservar fuentes estructuradas</summary>
        <p>
          Formato:
          {"entry":"index.html","files":[{"path":"index.html","content":"…"}]}
        </p>
        <label
          >Manifiesto de fuentes JSON<textarea
            v-model="manifestInput"
            rows="5"
            :disabled="busy"
            maxlength="600000"
          /></label
        ><button
          class="connection-action"
          :disabled="busy || !manifestInput.trim()"
          @click="loadManifest"
        >
          Cargar para revisión</button
        ><button
          class="connection-action"
          @click="
            downloadText('ares-fuentes.json', JSON.stringify(source, null, 2))
          "
        >
          Descargar fuentes JSON
        </button>
      </details>
    </details>
    <div class="prototype-actions">
      <button
        class="connection-action"
        :disabled="busy || !matches"
        @click="discuss"
      >
        Usar fuentes compiladas en mensaje
      </button>
      <button
        class="connection-action"
        :disabled="busy || !access.canWrite"
        @click="build"
      >
        Compilar archivos revisados</button
      ><button
        v-if="busy"
        class="connection-action"
        @click="controller?.abort()"
      >
        Cancelar</button
      ><button class="connection-action" :disabled="busy" @click="reset">
        Descartar cambios del editor</button
      ><button
        class="connection-action"
        :disabled="busy || !matches"
        @click="play"
      >
        <Play :size="14" /> Abrir vista aislada</button
      ><button class="connection-action" :disabled="!url" @click="stop">
        <Square :size="13" /> Detener vista</button
      ><button
        class="connection-action"
        :disabled="busy || !matches"
        @click="download"
      >
        <Download :size="14" /> Descargar ZIP</button
      ><button
        v-if="artifact"
        class="connection-action"
        :disabled="busy"
        @click="discard"
      >
        Descartar versión temporal
      </button>
    </div>
    <p v-if="error" role="alert" class="prototype-error">{{ error }}</p>
    <p v-if="notice" role="status" class="prototype-note">{{ notice }}</p>
    <template v-if="artifact"
      ><div class="prototype-identity">
        <strong>{{
          matches
            ? "Versión compilada vigente"
            : "Fuentes modificadas · vuelve a compilar"
        }}</strong
        ><span
          >{{ evidenceLabels[artifact.evidence.status] }} ·
          {{ artifact.evidence.limitations.join(" ") }}</span
        ><span>ID {{ artifact.id }}</span
        ><span>Revisión de fuentes {{ artifact.revision }}</span
        ><span>SHA-256 de la vista {{ artifact.runtime.sha256 }}</span
        ><span>{{ artifact.compiler }}</span
        ><span
          >Temporal hasta
          {{ new Date(artifact.expiresAt).toLocaleTimeString("es") }}. Guarda el
          ZIP o las fuentes antes de salir.</span
        >
      </div>
      <details>
        <summary>Manifiesto de la versión</summary>
        <pre>{{ manifest }}</pre>
      </details></template
    >
    <div v-if="url" class="prototype-view">
      <div class="prototype-viewport">
        <label
          >Ancho de vista<select v-model="width">
            <option value="100%">Escritorio</option>
            <option value="768px">Tablet · 768</option>
            <option value="390px">Móvil · 390</option>
          </select></label
        ><span role="status"
          >{{ runtimeState }} · salida del prototipo, sin pruebas
          ejecutadas</span
        >
      </div>
      <div class="prototype-frame-scroll">
        <iframe
          ref="frame"
          :src="url"
          title="Vista aislada del prototipo"
          sandbox="allow-scripts"
          credentialless
          referrerpolicy="no-referrer"
          allow="
            camera 'none';
            microphone 'none';
            geolocation 'none';
            clipboard-read 'none';
            clipboard-write 'none';
          "
          :style="{ width }"
          @load="runtimeState = 'Vista abierta'"
        />
      </div>
      <h3>Salida del prototipo</h3>
      <p class="prototype-note">
        Mensajes del iframe, limitados a 50. El código del prototipo puede
        generar su propia salida; esto no acredita pruebas.
      </p>
      <pre class="prototype-logs" aria-label="Consola del prototipo">{{
        logs.map((log) => `[${log.level}] ${log.text}`).join("\n") ||
        "Sin mensajes recibidos."
      }}</pre>
    </div>
  </section>
</template>
<style scoped>
.prototype-workbench {
  min-width: 0;
  padding: 24px;
  color: #ccdee5;
}
.prototype-workbench header {
  margin-bottom: 20px;
}
.prototype-workbench h2 {
  font-size: 24px;
  margin: 9px 0;
}
.prototype-workbench p {
  font-size: 12px;
  color: #91abb9;
  line-height: 1.7;
}
.prototype-editor {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 16px;
}
.prototype-files,
.prototype-code {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.prototype-workbench label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #91b3bf;
}
.prototype-workbench input,
.prototype-workbench select,
.prototype-workbench textarea {
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  background: #07151d;
  border: 1px solid #294650;
  color: #d8e7e9;
  border-radius: 5px;
  padding: 10px;
  font: inherit;
}
.prototype-workbench textarea {
  font: 12px/1.65 monospace;
  resize: vertical;
  min-height: 100px;
}
.prototype-code textarea {
  min-height: 260px;
}
.prototype-file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow: auto;
}
.prototype-file-list button {
  background: #0d2029;
  color: #8caebc;
  text-align: left;
  padding: 8px;
  border: 1px solid #1c3941;
  border-radius: 4px;
  font: 11px monospace;
  overflow-wrap: anywhere;
}
.prototype-file-list button[aria-pressed="true"] {
  color: #62efc0;
  border-color: #268168;
  background: #15382e;
}
.prototype-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin: 18px 0;
}
.prototype-actions button,
.prototype-files > .connection-action {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.prototype-workbench details {
  margin: 14px 0;
  color: #87a7b8;
  font-size: 12px;
}
.prototype-workbench summary {
  cursor: pointer;
}
.prototype-import textarea {
  margin-bottom: 10px;
}
.prototype-import button {
  margin-right: 10px;
}
.prototype-workbench pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 11px/1.7 monospace;
  max-height: 260px;
  overflow: auto;
  padding: 12px;
  background: #061218;
  border-radius: 5px;
}
.prototype-identity {
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow-wrap: anywhere;
  background: #0c2329;
  padding: 14px;
  border: 1px solid #28444b;
  border-radius: 6px;
  font-size: 10px;
  color: #8eb5bc;
}
.prototype-identity strong {
  color: #64ebba;
  font-size: 12px;
}
.prototype-workbench .prototype-error {
  color: #ffb3aa;
}
.prototype-viewport {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 11px;
  color: #8ca5b1;
}
.prototype-frame-scroll {
  overflow: auto;
  margin-top: 14px;
  border: 1px solid #28444b;
  background: #fff;
}
.prototype-frame-scroll iframe {
  display: block;
  height: 520px;
  max-width: none;
  border: 0;
  background: white;
}
.prototype-view h3 {
  font-size: 13px;
}
.prototype-workbench button:disabled {
  opacity: 0.4;
}
.prototype-workbench :focus-visible {
  outline: 2px solid #49e3ad;
  outline-offset: 3px;
}
@media (max-width: 800px) {
  .prototype-editor {
    grid-template-columns: 1fr;
  }
  .prototype-files {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .prototype-file-list {
    grid-column: 1/-1;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .prototype-workbench {
    padding: 16px;
  }
  .prototype-code textarea {
    min-height: 200px;
  }
}
</style>
