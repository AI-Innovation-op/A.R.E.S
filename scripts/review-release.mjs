import { createHash } from "node:crypto";
import { readFile, readdir, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  base = path.join(root, ".release-check"),
  out = path.join(root, ".local-setup", "revision-local");
const excluded = new Set([
  "node_modules",
  "dist",
  ".git",
  ".local-setup",
  ".release-check",
  "test-results",
  "playwright-report",
  "coverage",
  ".codex",
  ".agents",
  ".aws",
  ".ssh",
  ".ares",
]);
const roots = [
  "backend",
  "frontend",
  "database",
  "examples",
  "packages",
  "scripts",
  ".github",
];
const forbidden = (name) =>
  (/^\.env(?:\..*)?$/.test(name) && name !== ".env.example") ||
  /\.(?:dump|pem|key|log|secret\.json)$/.test(name) ||
  /^(?:\.npmrc|credentials(?:\..*)?)$/i.test(name);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function filesAt(directory, prefix = "") {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (
      excluded.has(item.name) ||
      forbidden(item.name) ||
      item.isSymbolicLink()
    )
      continue;
    const name = prefix ? `${prefix}/${item.name}` : item.name,
      target = path.join(directory, item.name);
    if (item.isDirectory()) {
      if (!prefix && !roots.includes(item.name)) continue;
      if (name === "backend/public") continue;
      result.push(...(await filesAt(target, name)));
    } else if (
      item.isFile() &&
      (prefix ||
        /\.(?:md|json|ya?ml)$/.test(item.name) ||
        ["LICENSE", ".gitignore", ".dockerignore", ".gitattributes", "ares-terminal.cmd", "schema.sql"].includes(item.name))
    )
      result.push(name);
  }
  return result;
}
const files = (await filesAt(root)).sort(),
  secrets = [];
try {
  const env = await readFile(path.join(root, "backend", ".env"), "utf8");
  for (const name of ["GEMINI_API_KEY", "OPENROUTER_API_KEY"]) {
    const match = new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, "m").exec(
      env,
    );
    if (match?.[1] && match[1].length >= 12)
      secrets.push(Buffer.from(match[1].trim()));
  }
} catch {}
const records = [],
  problems = [];
let baseFiles = [];
try { baseFiles = await filesAt(base); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const currentFiles = new Set(files);
const removed = baseFiles.filter(name => !currentFiles.has(name)).sort();
for (const name of files) {
  const absolute = path.resolve(root, name);
  if (!absolute.startsWith(path.resolve(root) + path.sep))
    throw new Error("Ruta fuera del proyecto.");
  const info = await lstat(absolute);
  if (!info.isFile() || info.size > 5 * 1024 * 1024) {
    problems.push({ path: name, reason: "Tipo o tamaño no revisable" });
    continue;
  }
  const bytes = await readFile(absolute),
    text = bytes.toString("utf8");
  if (
    secrets.some((secret) => bytes.includes(secret)) ||
    /\b(?:sk-or-v1-[A-Za-z0-9_-]{40,}|AIza[A-Za-z0-9_-]{25,}|ghp_[A-Za-z0-9]{30,}|ares_session=[A-Za-z0-9_-]{43})\b/.test(
      text,
    )
  )
    problems.push({
      path: name,
      reason: "Coincidencia de credencial: revisar localmente, sin publicar",
    });
  let before;
  try {
    before = await readFile(path.join(base, name));
  } catch {}
  records.push({
    path: name,
    bytes: bytes.length,
    sha256: digest(bytes),
    status: before
      ? digest(before) === digest(bytes)
        ? "sin cambios"
        : "modificado"
      : "nuevo",
    ...(before ? { baseSha256: digest(before) } : {}),
  });
}
await mkdir(out, { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  base: ".release-check (solo lectura)",
  files: records.length,
  new: records.filter((item) => item.status === "nuevo").length,
  modified: records.filter((item) => item.status === "modificado").length,
  removed,
  credentialFindings: problems.length,
  problems,
  records,
};
await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
const markdown = [
  "# Revisión local antes de push",
  "",
  `Generado: ${summary.generatedAt}. Comparación de contenido con .release-check; no modifica índices, ramas ni remotos.`,
  "",
  `Archivos revisados: ${summary.files}; nuevos: ${summary.new}; modificados: ${summary.modified}; ausentes respecto de la base: ${summary.removed.length}; coincidencias a revisar: ${summary.credentialFindings}.`,
  "",
  "Se excluyeron dependencias instaladas, builds, claves, sesiones, respaldos, conversaciones y preparaciones locales. El análisis busca las claves IA configuradas y patrones de credenciales; no sustituye la revisión humana.",
  "",
  ...problems.map((item) => `- REVISAR ${item.path}: ${item.reason}`),
  ...removed.map(name => `- AUSENTE respecto de la base: ${name}. Revisar antes de preparar una publicación; este inventario no autoriza borrarlo.`),
  "",
  "| Archivo | Estado | Bytes | SHA-256 |",
  "|---|---|---:|---|",
  ...records
    .filter((item) => item.status !== "sin cambios")
    .map(
      (item) =>
        `| ${item.path} | ${item.status} | ${item.bytes} | ${item.sha256} |`,
    ),
  "",
  "No se realizó push, commit, PR ni despliegue. La siguiente acción es revisar los cambios con el usuario.",
  "",
].join("\n");
await writeFile(path.join(out, "REVISION-LOCAL.md"), markdown);
console.log(
  JSON.stringify({
    files: summary.files,
    new: summary.new,
    modified: summary.modified,
    removed: summary.removed.length,
    credentialFindings: summary.credentialFindings,
    report: path.join(out, "REVISION-LOCAL.md"),
  }),
);
if (problems.length) process.exitCode = 1;
