export const appVersion = "1.0.0";
export const generationEvents = Object.freeze({
  delta: "delta",
  done: "done",
  error: "error",
});
export function prototypeManifest(artifact) {
  const metadata = ({ path, sha256, bytes }) => ({ path, sha256, bytes });
  return {
    format: "ares.prototype.v1",
    id: artifact.id,
    revision: artifact.revision,
    entry: artifact.entry,
    compiler: artifact.compiler,
    policy: artifact.policy,
    evidence: artifact.evidence,
    files: artifact.files.map(metadata),
    licenses: artifact.licenses.map(metadata),
    runtime: metadata(artifact.runtime),
  };
}
export const evidenceLabels = Object.freeze({
  proposal: "Propuesta",
  generated: "Generado por IA",
  read: "Lectura confirmada",
  compiled: "Compilación confirmada",
  executed: "Ejecución registrada",
  tested: "Pruebas aprobadas",
  applied: "Cambios aplicados",
  published: "Publicación confirmada",
});
const hash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export function createEvidence(
  status,
  scope,
  receipts = [],
  limitations = [],
  revision,
) {
  if (
    !Object.hasOwn(evidenceLabels, status) ||
    !Array.isArray(scope) ||
    scope.length > 3000 ||
    !scope.every(
      (path) =>
        typeof path === "string" && path.length > 0 && path.length <= 500,
    ) ||
    !Array.isArray(receipts) ||
    receipts.length > 100 ||
    !receipts.every(
      (receipt) =>
        receipt && typeof receipt.id === "string" && receipt.id.length > 0,
    ) ||
    !Array.isArray(limitations) ||
    !limitations.every(
      (text) => typeof text === "string" && text.length <= 1000,
    )
  )
    throw new TypeError("Registro de evidencia inválido.");
  const required = {
    read: (receipt) => receipt.kind === "read" && hash(receipt.sha256),
    compiled: (receipt) => receipt.kind === "compile" && hash(receipt.sha256),
    executed: (receipt) =>
      receipt.kind === "run" && Number.isInteger(receipt.exitCode),
    tested: (receipt) =>
      receipt.kind === "test" &&
      receipt.exitCode === 0 &&
      Number.isInteger(receipt.passed) &&
      receipt.passed > 0,
    applied: (receipt) => receipt.kind === "apply" && hash(receipt.sha256),
    published: (receipt) =>
      receipt.kind === "publish" &&
      typeof receipt.url === "string" &&
      /^https:\/\//.test(receipt.url),
  }[status];
  if (required && !receipts.some(required))
    throw new TypeError(
      "El estado requiere un comprobante de la operación correspondiente.",
    );
  return {
    schema: "ares.evidence.v1",
    status,
    scope: [...new Set(scope)],
    receipts: receipts.map((receipt) => ({ ...receipt })),
    limitations: [...limitations],
    ...(revision ? { revision } : {}),
  };
}
