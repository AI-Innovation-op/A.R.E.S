import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { ResultOrigin } from "../domain/results";
import { parsePose } from "../domain/poses";
import { readArtifact, type Artifact } from "../services/library";
import type { Conversation } from "../services/history";
import { useConsoleStore, type ChatEntry, type ModuleState } from "./console";
import { useLibraryStore } from "./library";
import { useAccessStore } from "./access";
import type { ModuleId } from "../domain/modules";
import { githubRequest, type GitHubReport } from "../services/github";

export const useResultStore = defineStore("results", () => {
  const open = ref(false),
    loading = ref(false),
    busy = ref(false),
    dirty = ref(false);
  const prototypeDirty = ref(false);
  const error = ref(""),
    notice = ref("");
  const origin = ref<ResultOrigin | null>(null);
  const artifact = ref<Artifact | null>(null);
  let request = 0;
  const content = computed(
    () => artifact.value?.content ?? origin.value?.content ?? "",
  );
  const title = computed(
    () => artifact.value?.title ?? origin.value?.title ?? "Resultado",
  );

  function canReplace() {
    if (busy.value || dirty.value || prototypeDirty.value) {
      open.value = true;
      error.value = busy.value
        ? "Espera a que termine la operación antes de abrir otro resultado o cambiar de sección."
        : prototypeDirty.value
          ? "Compila o descarta los cambios del prototipo antes de abrir otro resultado o cambiar de sección."
          : "Guarda o cancela la edición antes de abrir otro resultado o cambiar de sección.";
      return false;
    }
    return true;
  }
  function select(value: ResultOrigin) {
    if (!canReplace()) return false;
    request++;
    loading.value = false;
    origin.value = value;
    artifact.value = null;
    error.value = "";
    notice.value = "";
    open.value = true;
    return true;
  }
  function openMessage(
    message: ChatEntry,
    conversation: Conversation | null,
    question: string,
  ) {
    if (message.role !== "model") return false;
    const file =
      message.workspace?.files.length === 1
        ? message.workspace.files[0]
        : undefined;
    return select({
      kind: "message",
      title: "Respuesta de A.R.E.S.",
      content: parsePose(message.content).text,
      context: question,
      projectId: conversation?.projectId,
      ...(conversation && typeof message.id === "string"
        ? { conversationId: conversation.id, messageId: message.id }
        : {}),
      provider: message.provider,
      model: message.model,
      createdAt: message.createdAt,
      sources: message.sources.map((source) => ({ ...source })),
      ...(file
        ? {
            comparison: {
              before: file.content,
              path: file.path,
              partial: file.truncated || file.redacted,
              sha256: file.sha256,
            },
          }
        : {}),
    });
  }
  async function openArtifact(
    id: string,
    source?: Pick<ResultOrigin, "context" | "conversationId" | "messageId">,
  ) {
    if (
      !select({
        kind: "artifact",
        title: "Documento de Biblioteca",
        content: "",
        context: source?.context ?? "",
        artifactId: id,
        ...source,
      })
    )
      return false;
    const revision = request;
    loading.value = true;
    try {
      const saved = await readArtifact(id);
      if (revision !== request) return false;
      artifact.value = saved;
      origin.value = {
        ...origin.value!,
        projectId: saved.projectId,
        provider: saved.provider,
        model: saved.model,
        createdAt: saved.createdAt,
      };
      return true;
    } catch (cause) {
      if (revision === request) error.value = (cause as Error).message;
      return false;
    } finally {
      if (revision === request) loading.value = false;
    }
  }
  async function openModule(
    module: ModuleId,
    state: ModuleState,
    projectId: string,
  ) {
    if (!state.result) return false;
    const comparison =
      state.comparedOriginal !== undefined
        ? {
            before: state.comparedOriginal,
            path: state.comparedPath || "archivo.ts",
          }
        : undefined;
    if (state.artifactId) {
      const opened = await openArtifact(state.artifactId);
      if (opened && origin.value)
        origin.value = { ...origin.value, comparison };
      return opened;
    }
    return select({
      kind: "module",
      title: state.title || state.format,
      content: state.result,
      context: state.context,
      provider: state.provider,
      model: state.model,
      comparison,
      ...(projectId ? { projectId } : {}),
    });
  }
  async function saveNote() {
    const source = origin.value;
    if (
      !source?.conversationId ||
      !source.messageId ||
      !source.projectId ||
      !useAccessStore().canWrite ||
      busy.value ||
      artifact.value
    )
      return;
    busy.value = true;
    error.value = "";
    notice.value = "";
    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(source.conversationId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: source.messageId }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error?.message ??
            "No se pudo guardar la nota. Puedes reintentar.",
        );
      if (!data?.artifact?.id || typeof data.artifact.content !== "string")
        throw new Error("El servidor no confirmó un documento válido.");
      artifact.value = data.artifact;
      notice.value =
        "Nota guardada en Biblioteca como borrador. Se copió el turno confirmado; no hubo otra llamada al modelo.";
    } catch (cause) {
      error.value = (cause as Error).message;
    } finally {
      busy.value = false;
    }
  }
  function openGithub(
    report: GitHubReport,
    snapshotId: string,
    projectId: string,
  ) {
    return select({
      kind: "github",
      title: report.title,
      content: report.content,
      context: report.context,
      sources: report.sources,
      provider: report.provider,
      model: report.model,
      createdAt: report.createdAt,
      ...(projectId ? { projectId } : {}),
      github: {
        snapshotId,
        reportId: report.id,
        persistable: report.persistable,
      },
    });
  }
  async function saveGithub() {
    const source = origin.value;
    if (
      !source?.github?.persistable ||
      !source.projectId ||
      !useAccessStore().canWrite ||
      busy.value ||
      artifact.value
    )
      return;
    busy.value = true;
    error.value = "";
    notice.value = "";
    try {
      const data = await githubRequest<{ artifact: Artifact }>("save", {
        snapshotId: source.github.snapshotId,
        reportId: source.github.reportId,
        projectId: source.projectId,
      });
      if (!data.artifact?.id || typeof data.artifact.content !== "string")
        throw new Error("No se confirmó el informe guardado.");
      artifact.value = data.artifact;
      notice.value =
        "Informe guardado en Biblioteca con revisión y fuentes. No se hizo otra llamada al modelo.";
    } catch (cause) {
      error.value = (cause as Error).message;
    } finally {
      busy.value = false;
    }
  }
  function updated(value: Artifact) {
    artifact.value = value;
    dirty.value = false;
    error.value = "";
    notice.value =
      "Revisión guardada por el servidor. El mensaje original conserva su contenido.";
  }
  function deleted() {
    artifact.value = null;
    dirty.value = false;
    if (origin.value?.kind === "artifact") {
      origin.value = null;
      open.value = false;
    }
    notice.value =
      "Documento eliminado. La conversación conserva su respuesta y las citas recibidas.";
  }
  function useInMessage() {
    if (
      !content.value ||
      busy.value ||
      dirty.value ||
      loading.value ||
      !useAccessStore().canWrite
    )
      return false;
    const reference = artifact.value
      ? `Documento ${artifact.value.id}, revisión ${artifact.value.revision ?? 0}`
      : origin.value?.conversationId
        ? `Conversación ${origin.value.conversationId}, mensaje ${origin.value.messageId}`
        : "Resultado de esta sesión";
    const provenance = artifact.value?.context.startsWith(
      "Lectura pública GitHub:",
    )
      ? artifact.value.context
      : origin.value?.kind === "github"
        ? origin.value.context
        : "";
    const context = `Resultado incorporado por el usuario para discutirlo (${reference}). El contenido puede incluir propuestas todavía no aplicadas:\n\n${provenance ? `${provenance}\n\n` : ""}${content.value}`;
    return appendToMessage(context);
  }
  function appendToMessage(context: string) {
    if (
      busy.value ||
      dirty.value ||
      loading.value ||
      prototypeDirty.value ||
      !useAccessStore().canWrite
    )
      return false;
    const chat = useConsoleStore(),
      library = useLibraryStore();
    const targetProject = chat.activeConversation
      ? chat.activeConversation.projectId
      : library.projectId;
    const sourceProject = artifact.value?.projectId ?? origin.value?.projectId;
    if (sourceProject && sourceProject !== targetProject) {
      error.value =
        "Este resultado pertenece a otro proyecto. Abre una conversación nueva de ese proyecto antes de incorporarlo.";
      return false;
    }
    const draft = [chat.draft, context].filter(Boolean).join("\n\n");
    if (draft.length > 16000) {
      error.value =
        "El resultado completo supera el límite del mensaje. Conserva tu borrador y copia solo el fragmento necesario.";
      return false;
    }
    chat.draft = draft;
    error.value = "";
    notice.value =
      "Contenido añadido al borrador del chat. Revisa tu pregunta y pulsa Enviar.";
    return true;
  }
  function close() {
    if (!busy.value) open.value = false;
  }
  return {
    open,
    loading,
    busy,
    dirty,
    prototypeDirty,
    error,
    notice,
    origin,
    artifact,
    content,
    title,
    canReplace,
    openMessage,
    openArtifact,
    openModule,
    openGithub,
    saveGithub,
    saveNote,
    updated,
    deleted,
    useInMessage,
    appendToMessage,
    close,
  };
});
