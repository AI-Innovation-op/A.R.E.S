import { it, expect, vi, afterEach } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import {
  verifyPrototype,
  type PrototypeArtifact,
} from "../src/services/prototypes";
import { useResultStore } from "../src/stores/results";
import { useConsoleStore } from "../src/stores/console";
import { useLibraryStore } from "../src/stores/library";
import { createPinia, setActivePinia } from "pinia";
afterEach(() => vi.unstubAllGlobals());
it("incorpora la versión compilada sin volver al contenido original y respeta proyecto y límite", () => {
  setActivePinia(createPinia());
  const result = useResultStore(),
    chat = useConsoleStore(),
    library = useLibraryStore();
  result.openMessage(
    { id: "message", role: "model", content: "Precio 17", sources: [] },
    {
      id: "conversation",
      projectId: "project",
      title: "Prueba",
      revision: 1,
      createdAt: "",
      updatedAt: "",
    },
    "Original",
  );
  chat.draft = "Mi pregunta";
  library.projectId = "project";
  expect(
    result.appendToMessage("Fuentes compiladas · revisión nueva · precio 999"),
  ).toBe(true);
  expect(chat.draft).toContain("Mi pregunta");
  expect(chat.draft).toContain("999");
  expect(chat.draft).not.toContain("Precio 17");
  const before = chat.draft;
  library.projectId = "other";
  expect(result.appendToMessage("Otro dato")).toBe(false);
  expect(chat.draft).toBe(before);
  library.projectId = "project";
  expect(result.appendToMessage("x".repeat(16000))).toBe(false);
  expect(chat.draft).toBe(before);
});
it("verifica huellas y bytes tanto de fuentes como de salida compilada", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const file = {
      path: "index.html",
      content: "<p>17</p>",
      sha256: createHash("sha256").update("<p>17</p>").digest("hex"),
      bytes: 9,
    },
    artifact = {
      files: [file],
      runtime: { ...file, path: ".ares/preview.html" },
    } as PrototypeArtifact;
  await verifyPrototype(artifact);
  await expect(
    verifyPrototype({
      ...artifact,
      runtime: { ...artifact.runtime, content: "<p>999</p>" },
    }),
  ).rejects.toThrow("no coincide");
  await expect(
    verifyPrototype({ ...artifact, files: [{ ...file, bytes: 10 }] }),
  ).rejects.toThrow("no coincide");
});
it("el prototipo pendiente bloquea reemplazar el resultado y conserva el borrador al ocultarlo", () => {
  setActivePinia(createPinia());
  const result = useResultStore(),
    message = {
      id: "one",
      role: "model" as const,
      content: "Documento",
      sources: [],
    };
  result.openMessage(message, null, "Pregunta");
  result.prototypeDirty = true;
  expect(result.openMessage({ ...message, id: "two" }, null, "Otra")).toBe(
    false,
  );
  expect(result.origin?.context).toBe("Pregunta");
  expect(result.error).toContain("Compila o descarta");
  result.close();
  expect(result.prototypeDirty).toBe(true);
  result.prototypeDirty = false;
  expect(result.openMessage({ ...message, id: "two" }, null, "Otra")).toBe(
    true,
  );
});
