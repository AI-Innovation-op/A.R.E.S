import type {
  PrototypeSource,
  PrototypeArtifact,
} from "../../../packages/contracts/index.js";
export type {
  PrototypeSource,
  PrototypeArtifact,
} from "../../../packages/contracts/index.js";
async function response(operation: string, init?: RequestInit) {
  const result = await fetch("/api/prototypes/" + operation, {
    method: "POST",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!result.ok) {
    const data = await result.json().catch(() => null);
    throw new Error(
      data?.error?.message ??
        "No se pudo preparar el prototipo. Conserva tus fuentes y vuelve a intentar.",
    );
  }
  return result;
}
export async function buildPrototype(
  source: PrototypeSource,
  signal: AbortSignal,
) {
  const data = await (
    await response("build", { body: JSON.stringify(source), signal })
  ).json();
  if (
    !data?.artifact?.id ||
    !data.artifact.runtime ||
    !Array.isArray(data.artifact.files)
  )
    throw new Error("No se confirmó un artefacto válido.");
  return data.artifact as PrototypeArtifact;
}
export async function verifyPrototype(artifact: PrototypeArtifact) {
  for (const file of [
    ...artifact.files,
    ...(artifact.licenses ?? []),
    artifact.runtime,
  ]) {
    const bytes = new TextEncoder().encode(file.content),
      hash = await crypto.subtle.digest("SHA-256", bytes),
      actual = [...new Uint8Array(hash)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
    if (actual !== file.sha256 || bytes.length !== file.bytes)
      throw new Error(
        "El contenido no coincide con las huellas confirmadas. Vuelve a compilar.",
      );
  }
}
export async function exportPrototype(id: string, signal: AbortSignal) {
  return (await response(`${encodeURIComponent(id)}/zip`, { signal })).blob();
}
export async function discardPrototype(id: string) {
  await response(`${encodeURIComponent(id)}/discard`);
}
