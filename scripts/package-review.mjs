import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appVersion } from "../packages/contracts/index.js";
import { storedZip } from "../backend/dist/modules/prototypes/zip.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await promisify(execFile)(process.execPath, ["scripts/review-release.mjs"], {
  cwd: root,
  windowsHide: true,
});
const review = JSON.parse(
  await readFile(
    path.join(root, ".local-setup/revision-local/manifest.json"),
    "utf8",
  ),
);
if (review.credentialFindings || review.problems.length)
  throw Error("La revisión encontró entradas pendientes: no se empaquetó.");
const files = [];
for (const record of review.records) {
  if (
    !/^[a-zA-Z0-9_. /-]+$/.test(record.path) ||
    record.path
      .split("/")
      .some((part) => !part || part === "." || part === "..")
  )
    throw Error("Ruta no admitida en la entrega.");
  const absolute = path.resolve(root, record.path);
  if (!absolute.startsWith(root)) throw Error("Ruta fuera de la instalación.");
  const info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink())
    throw Error("Cambió el tipo de un archivo revisado.");
  const bytes = await readFile(absolute);
  if (hash(bytes) !== record.sha256 || bytes.length !== record.bytes)
    throw Error(
      "Cambió un archivo después de revisarlo; vuelve a generar el paquete.",
    );
  // Esta entrega contiene fuentes UTF-8; no convertir binarios silenciosamente.
  const content = bytes.toString("utf8");
  if (!Buffer.from(content).equals(bytes))
    throw Error("La entrega de fuentes contiene un binario no admitido.");
  files.push({ path: record.path, content });
}
const records = review.records.map(({ path, bytes, sha256 }) => ({
  path,
  bytes,
  sha256,
}));
const revision = hash(JSON.stringify(records));
const manifest = {
  version: appVersion,
  revision,
  kind: "source-review",
  files: records,
  exclusions: [
    "credenciales",
    "sesiones",
    "historial y bases de datos",
    "respaldos",
    "dependencias instaladas",
    "builds",
    "configuración Git y preparaciones locales",
  ],
};
if (files.some((file) => file.path === "DELIVERY-MANIFEST.json"))
  throw Error("Nombre reservado de manifiesto.");
files.push({
  path: "DELIVERY-MANIFEST.json",
  content: JSON.stringify(manifest, null, 2) + "\n",
});
const zip = storedZip(files);

// Lectura independiente de directorio central/CRC con node:zlib; nada se ejecuta.
const end = zip.length - 22;
if (
  zip.readUInt32LE(end) !== 0x06054b50 ||
  zip.readUInt16LE(end + 10) !== files.length
)
  throw Error("ZIP incompleto.");
let central = zip.readUInt32LE(end + 16);
for (const file of files) {
  if (zip.readUInt32LE(central) !== 0x02014b50)
    throw Error("Directorio ZIP inválido.");
  const local = zip.readUInt32LE(central + 42),
    nameLength = zip.readUInt16LE(central + 28);
  const name = zip.subarray(central + 46, central + 46 + nameLength).toString();
  if (name !== file.path || zip.readUInt32LE(local) !== 0x04034b50)
    throw Error("Identidad ZIP inválida.");
  const start =
    local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const body = zip.subarray(start, start + zip.readUInt32LE(central + 24));
  if (
    crc32(body) !== zip.readUInt32LE(central + 16) ||
    hash(body) !== hash(Buffer.from(file.content))
  )
    throw Error("Contenido ZIP distinto de las fuentes revisadas.");
  central +=
    46 +
    nameLength +
    zip.readUInt16LE(central + 30) +
    zip.readUInt16LE(central + 32);
}
if (central !== end)
  throw Error("El directorio ZIP no termina donde corresponde.");
const output = path.join(
  root,
  ".local-setup",
  "delivery",
  `ares-${appVersion}-${revision.slice(0, 12)}.zip`,
);
await mkdir(path.dirname(output), { recursive: true });
try {
  await writeFile(output, zip, { flag: "wx" });
} catch (error) {
  if (error.code !== "EEXIST" || !zip.equals(await readFile(output)))
    throw error;
}
const result = {
  createdAt: new Date().toISOString(),
  version: appVersion,
  revision,
  files: records.length,
  zipBytes: zip.length,
  zipSha256: hash(zip),
  credentialFindings: 0,
  output,
  published: false,
};
await writeFile(
  path.join(root, ".local-setup", "package-review-result.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
