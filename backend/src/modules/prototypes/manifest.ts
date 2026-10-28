import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../../shared/http-error.js";
import type { PrototypeArtifact } from "../../../../packages/contracts/index.js";
import { prototypeManifest } from "../../../../packages/contracts/index.js";
export type { PrototypeArtifact } from "../../../../packages/contracts/index.js";
export const sourceBundleSchema = z
  .object({
    entry: z.string().max(160),
    files: z
      .array(
        z
          .object({ path: z.string().max(160), content: z.string().max(65536) })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();
export type SourceBundle = z.infer<typeof sourceBundleSchema>;
export const digest = (text: string | Uint8Array) =>
  createHash("sha256").update(text).digest("hex");
export function validateBundle(
  value: unknown,
  redact: (text: string) => string,
): SourceBundle {
  const parsed = sourceBundleSchema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      400,
      "PROTOTYPE_INPUT",
      "Introduce un manifiesto con entry y entre 1 y 24 archivos de hasta 64 KiB.",
    );
  const seen = new Set<string>();
  let total = 0;
  for (const file of parsed.data.files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
      file.path.startsWith("/") ||
      file.path
        .split("/")
        .some(
          (part) =>
            !part ||
            part === "." ||
            part === ".." ||
            part.toLowerCase() === ".ares" ||
            part.startsWith("__ares_") ||
            /^(?:node_modules|\.git|\.env(?:\..*)?|credentials(?:\..*)?)$/i.test(
              part,
            ),
        ) ||
      !/\.(?:html|css|js|ts|vue|json)$/.test(file.path) ||
      seen.has(file.path.toLowerCase())
    )
      throw new HttpError(
        400,
        "PROTOTYPE_PATH",
        "Hay rutas duplicadas, reservadas, sensibles o no compatibles. Usa rutas relativas de HTML, CSS, JS, TS, Vue o JSON.",
      );
    seen.add(file.path.toLowerCase());
    const size = Buffer.byteLength(file.content);
    total += size;
    if (
      size > 65536 ||
      total > 262144 ||
      file.content.includes("\0") ||
      Buffer.from(file.content).toString("utf8") !== file.content
    )
      throw new HttpError(
        413,
        "PROTOTYPE_SIZE",
        "El conjunto supera 256 KiB, un archivo supera 64 KiB o contiene texto inválido.",
      );
    if (redact(file.content) !== file.content)
      throw new HttpError(
        400,
        "PROTOTYPE_SECRET",
        "Se detectaron valores sensibles. Sustitúyelos por datos de ejemplo antes de generar o exportar.",
      );
  }
  if (
    !parsed.data.files.some((file) => file.path === parsed.data.entry) ||
    !parsed.data.entry.endsWith(".html")
  )
    throw new HttpError(
      400,
      "PROTOTYPE_ENTRY",
      "La entrada debe ser un archivo HTML incluido en el conjunto.",
    );
  return {
    entry: parsed.data.entry,
    files: parsed.data.files.sort((a, b) => a.path.localeCompare(b.path, "en")),
  };
}
export const previewPolicy =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; media-src 'none'";
export function artifactManifest(artifact: PrototypeArtifact) {
  return prototypeManifest(artifact);
}
