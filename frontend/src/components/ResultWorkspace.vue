<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { X, Download, FolderOpen, MessageSquarePlus, Save } from "@lucide/vue";
import { useResultStore } from "../stores/results";
import { useLibraryStore } from "../stores/library";
import { useAccessStore } from "../stores/access";
import { useMemoryStore } from "../stores/memory";
import { comparisonPath, resultBlocks } from "../domain/results";
import { downloadText } from "../utils/download";
import MarkdownContent from "./MarkdownContent.vue";
import MermaidDiagram from "./MermaidDiagram.vue";
import ComparativeDiff from "./ComparativeDiff.vue";
import DocumentEditor from "./DocumentEditor.vue";
import PrototypeWorkbench from "./PrototypeWorkbench.vue";
import type { Artifact } from "../services/library";
import { safeSources } from "../services/api";

const emit = defineEmits<{ library: [artifact: Artifact] }>();
const props = defineProps<{ overlay?: boolean }>();
const results = useResultStore(),
  library = useLibraryStore(),
  access = useAccessStore();
const heading = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const tab = ref("document"),
  selectedBlock = ref(0),
  before = ref("");
const prototypeKey = ref(0),
  prototypeVisited = ref(false);
const blocks = computed(() => resultBlocks(results.content));
const diagrams = computed(() =>
  blocks.value.filter((block) => block.language === "mermaid"),
);
const code = computed(() =>
  blocks.value.filter((block) => block.language !== "mermaid"),
);
const proposed = computed(() => code.value[selectedBlock.value]);
const sources = computed(() =>
  safeSources(results.artifact?.sources ?? results.origin?.sources),
);
const projectName = computed(() => {
  const id = results.artifact?.projectId ?? results.origin?.projectId;
  return (
    library.projects.find((project) => project.id === id)?.name ??
    (id ? "Proyecto del resultado" : "Sin proyecto")
  );
});
const tabs = computed(() => [
  { id: "document", label: "Documento" },
  ...(diagrams.value.length ? [{ id: "diagrams", label: "Diagramas" }] : []),
  ...(code.value.length
    ? [
        { id: "code", label: "Código" },
        { id: "diff", label: "Comparar" },
      ]
    : []),
  ...(access.canWrite ? [{ id: "prototype", label: "Preview y ZIP" }] : []),
  { id: "origin", label: "Origen" },
]);
const path = computed(
  () =>
    results.origin?.comparison?.path ||
    comparisonPath(proposed.value?.language ?? "text"),
);
const canSave = computed(
  () =>
    !!results.origin?.conversationId &&
    !!results.origin.messageId &&
    !!results.origin.projectId,
);
const canSaveGithub = computed(
  () => !!results.origin?.github?.persistable && !!results.origin.projectId,
);
watch(
  () => results.origin,
  () => {
    prototypeKey.value++;
    prototypeVisited.value = false;
    tab.value = "document";
    selectedBlock.value = 0;
    before.value = results.origin?.comparison?.before ?? "";
  },
  { immediate: true },
);
watch(
  () => results.content,
  () => {
    selectedBlock.value = 0;
    if (!tabs.value.some((item) => item.id === tab.value))
      tab.value = "document";
  },
);
async function saved(value: Artifact) {
  results.updated(value);
  if (library.projectId === value.projectId) await library.refresh();
  void useMemoryStore().refresh(value.projectId);
}
async function saveNote() {
  if (results.origin?.kind === "github") await results.saveGithub();
  else await results.saveNote();
  const artifact = results.artifact;
  if (artifact) {
    if (library.projectId === artifact.projectId) void library.refresh();
    void useMemoryStore().refresh(artifact.projectId);
  }
}
function deleted() {
  const project = results.artifact?.projectId;
  results.deleted();
  if (project) {
    if (library.projectId === project) void library.refresh();
    void useMemoryStore().refresh(project);
  }
}
function selectTab(id: string) {
  if (results.loading) return;
  if (id === "prototype") prototypeVisited.value = true;
  tab.value = id;
}
function trapFocus(event: KeyboardEvent) {
  if (!props.overlay || event.key !== "Tab" || !panel.value) return;
  const controls = [
    ...panel.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
    ),
  ].filter((element) => element.offsetParent !== null);
  const first = controls[0],
    last = controls.at(-1);
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === heading.value)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function moveTab(event: KeyboardEvent, index: number) {
  const items = tabs.value;
  const target =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % items.length
          : event.key === "ArrowLeft"
            ? (index + items.length - 1) % items.length
            : -1;
  if (target < 0) return;
  event.preventDefault();
  selectTab(items[target]!.id);
  void nextTick(() =>
    document.getElementById(`result-tab-${tab.value}`)?.focus(),
  );
}
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <aside
    ref="panel"
    class="result-workspace panel"
    :role="overlay ? 'dialog' : 'complementary'"
    :aria-modal="overlay ? true : undefined"
    aria-label="Resultado en contexto"
    :aria-busy="results.loading || results.busy"
    @keydown="trapFocus"
    @keydown.esc.stop="results.close"
  >
    <header class="result-workspace-heading">
      <div>
        <span class="eyebrow">ESPACIO DE TRABAJO</span>
        <h2 ref="heading" tabindex="-1">{{ results.title }}</h2>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="Cerrar resultado"
        :disabled="results.busy"
        @click="results.close"
      >
        <X :size="18" />
      </button>
    </header>
    <div class="result-workspace-meta">
      <span>{{ projectName }}</span>
      <strong>{{
        results.artifact
          ? results.artifact.status === "APPROVED"
            ? "Revisión aprobada"
            : "Borrador guardado"
          : "Respuesta · sin guardar en Biblioteca"
      }}</strong>
      <span v-if="results.artifact"
        >Revisión {{ results.artifact.revision ?? 0 }}</span
      >
      <span v-if="results.artifact?.provider || results.origin?.provider"
        >{{
          (
            results.artifact?.provider || results.origin?.provider
          )?.toUpperCase()
        }}
        · {{ results.artifact?.model || results.origin?.model }}</span
      >
    </div>
    <div class="result-workspace-actions">
      <button
        v-if="!results.artifact && access.canWrite"
        type="button"
        class="connection-action"
        :disabled="
          !(results.origin?.kind === 'github' ? canSaveGithub : canSave) ||
          results.busy ||
          results.loading
        "
        @click="saveNote"
      >
        <Save :size="14" />
        {{
          results.origin?.kind === "github"
            ? "Guardar informe en Biblioteca"
            : "Guardar nota en Biblioteca"
        }}
      </button>
      <button
        v-if="access.canWrite && tab !== 'prototype'"
        type="button"
        class="connection-action"
        :disabled="
          !results.content || results.busy || results.dirty || results.loading
        "
        @click="results.useInMessage"
      >
        <MessageSquarePlus :size="14" /> Usar en mensaje
      </button>
      <button
        type="button"
        class="connection-action"
        :disabled="!results.content || results.loading"
        @click="downloadText('ares-resultado.md', results.content)"
      >
        <Download :size="14" /> Descargar
      </button>
      <button
        v-if="results.artifact"
        type="button"
        class="connection-action"
        :disabled="results.busy || results.dirty"
        @click="emit('library', results.artifact)"
      >
        <FolderOpen :size="14" /> Ver en Biblioteca
      </button>
    </div>
    <p
      v-if="!results.artifact && results.origin?.kind === 'github'"
      class="result-workspace-note"
    >
      El informe conserva el commit y la cobertura. Para guardarlo, abre la
      lectura con un proyecto y PostgreSQL conectado antes de que caduque.
      Puedes descargarlo.
    </p>
    <p v-else-if="!results.artifact && !canSave" class="result-workspace-note">
      Para guardar una nota, la respuesta debe estar confirmada en una
      conversación con proyecto y PostgreSQL. Puedes descargar este resultado.
    </p>
    <p v-if="results.notice" role="status" class="result-workspace-note">
      {{ results.notice }}
    </p>
    <p v-if="results.error" role="alert" class="result-workspace-error">
      {{ results.error }}
    </p>
    <div
      class="result-workspace-tabs"
      role="tablist"
      aria-label="Vistas del resultado"
    >
      <button
        v-for="(item, index) in tabs"
        :id="`result-tab-${item.id}`"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-controls="`result-view-${item.id}`"
        :tabindex="tab === item.id ? 0 : -1"
        @click="selectTab(item.id)"
        @keydown="moveTab($event, index)"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="result-workspace-body">
      <section
        id="result-view-prototype"
        v-show="tab === 'prototype'"
        role="tabpanel"
        aria-labelledby="result-tab-prototype"
      >
        <PrototypeWorkbench
          v-if="access.canWrite && prototypeVisited"
          :key="prototypeKey"
          compact
          :html="
            code.filter((block) => block.language === 'html').length === 1
              ? code.find((block) => block.language === 'html')?.content
              : undefined
          "
          @busy="results.busy = $event"
          @dirty="results.prototypeDirty = $event"
          @discuss="results.appendToMessage"
        />
      </section>
      <p v-if="results.loading" role="status">
        Abriendo el documento guardado…
      </p>
      <section
        id="result-view-document"
        v-show="tab === 'document'"
        role="tabpanel"
        aria-labelledby="result-tab-document"
      >
        <section
          :aria-label="
            results.artifact ? 'Borrador guardado' : 'Contenido del resultado'
          "
        >
          <MarkdownContent :content="results.content" />
          <DocumentEditor
            v-if="results.artifact && access.canWrite"
            :artifact="results.artifact"
            :disabled="results.loading"
            @busy="results.busy = $event"
            @dirty="results.dirty = $event"
            @saved="saved"
            @deleted="deleted"
          />
        </section>
      </section>
      <section
        v-if="tab === 'diagrams'"
        id="result-view-diagrams"
        role="tabpanel"
        aria-labelledby="result-tab-diagrams"
      >
        <MermaidDiagram
          v-for="(diagram, index) in diagrams"
          :key="index"
          :code="diagram.content"
        />
      </section>
      <section
        v-if="tab === 'code' || tab === 'diff'"
        :id="`result-view-${tab}`"
        role="tabpanel"
        :aria-labelledby="`result-tab-${tab}`"
      >
        <label for="result-code-block">Bloque de código</label
        ><select id="result-code-block" v-model.number="selectedBlock">
          <option v-for="(block, index) in code" :key="index" :value="index">
            Bloque {{ index + 1 }} · {{ block.language }}
          </option>
        </select>
        <template v-if="tab === 'code'"
          ><p class="result-note">
            Contenido de la respuesta; no se ejecuta al abrirlo.
          </p>
          <pre class="result-code"><code>{{ proposed?.content }}</code></pre>
        </template>
        <template v-else>
          <label for="result-comparison-original">Original para comparar</label
          ><textarea
            id="result-comparison-original"
            v-model="before"
            rows="5"
            maxlength="100000"
            placeholder="Pega el original; una comparación no aplica cambios."
          />
          <p v-if="results.origin?.comparison" class="result-note">
            Base recibida: {{ results.origin.comparison.path }}.
            {{
              results.origin.comparison.partial
                ? "El contenido fue recortado o redactado; la comparación es parcial."
                : ""
            }}
          </p>
          <p class="result-note">
            Compara un bloque de la respuesta. Puede ser un fragmento, no un
            archivo completo. Para aplicar cambios usa las propuestas de
            Repositorio.
          </p>
          <ComparativeDiff
            v-if="before && proposed && proposed.content.length <= 100000"
            :before="before"
            :after="proposed.content"
            :path="path"
          />
          <p v-else class="result-note">
            Aporta un original y un bloque de hasta 100 000 caracteres para
            abrir el comparador.
          </p>
        </template>
      </section>
      <section
        v-if="tab === 'origin'"
        id="result-view-origin"
        role="tabpanel"
        aria-labelledby="result-tab-origin"
      >
        <h3>Origen y alcance</h3>
        <p>
          Revisar o guardar un borrador no aplica archivos, ejecuta pruebas ni
          publica cambios.
        </p>
        <dl>
          <dt>Proyecto</dt>
          <dd>
            {{
              results.artifact?.projectId ||
              results.origin?.projectId ||
              "Sin proyecto"
            }}
          </dd>
          <template v-if="results.origin?.conversationId"
            ><dt>Conversación</dt>
            <dd>{{ results.origin.conversationId }}</dd>
            <dt>Mensaje</dt>
            <dd>{{ results.origin.messageId }}</dd></template
          ><template v-if="results.artifact"
            ><dt>Documento</dt>
            <dd>{{ results.artifact.id }}</dd>
            <dt>Revisión actual</dt>
            <dd>{{ results.artifact.revision ?? 0 }}</dd></template
          >
        </dl>
        <p v-if="results.origin?.kind === 'artifact'">
          Se muestra la revisión actual de Biblioteca. Las citas del chat
          conservan el fragmento recibido cuando se generó la respuesta.
        </p>
        <p v-if="results.origin?.comparison?.sha256">
          Base recibida: {{ results.origin.comparison.path }} · SHA-256
          {{ results.origin.comparison.sha256 }}
        </p>
        <div v-if="sources.length" class="sources">
          <a
            v-for="source in sources"
            :key="source.uri"
            :href="source.uri"
            target="_blank"
            rel="noopener noreferrer"
            >{{ source.title }} ↗</a
          >
        </div>
        <h3>Contexto de origen</h3>
        <pre>{{
          results.origin?.context ||
          results.artifact?.context ||
          "Resultado abierto desde esta sesión."
        }}</pre>
        <template v-if="results.artifact && results.origin?.context"
          ><h3>Registro del documento</h3>
          <pre>{{ results.artifact.context }}</pre>
        </template>
      </section>
    </div>
  </aside>
</template>
