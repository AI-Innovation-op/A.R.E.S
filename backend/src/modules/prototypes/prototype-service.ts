import { HttpError } from "../../shared/http-error.js";
import {
  artifactManifest,
  digest,
  previewPolicy,
  validateBundle,
  type PrototypeArtifact,
  type SourceBundle,
} from "./manifest.js";
import {
  compilePrototype,
  compilerIdentity,
  prototypeLicenses,
} from "./compiler.js";
import { storedZip } from "./zip.js";
import { createEvidence } from "../../../../packages/contracts/index.js";
import { randomBytes } from "node:crypto";
type Compiler = (
  source: SourceBundle,
  revision: string,
  signal: AbortSignal,
) => Promise<string>;
export class PrototypeService {
  private readonly artifacts = new Map<
    string,
    { actor: string; artifact: PrototypeArtifact; expires: number }
  >();
  private building = 0;
  private readonly buildingByActor = new Map<string, number>();
  constructor(
    private readonly actor: () => string,
    private readonly redact: (text: string) => string,
    private readonly compiler: Compiler = compilePrototype,
    private readonly now: () => number = Date.now,
  ) {}
  private clean() {
    for (const [id, item] of this.artifacts)
      if (item.expires <= this.now()) this.artifacts.delete(id);
  }
  async build(value: unknown, signal: AbortSignal) {
    this.clean();
    signal.throwIfAborted();
    const source = validateBundle(value, this.redact),
      revision = digest(JSON.stringify(source)),
      actor = this.actor();
    const previous = [...this.artifacts.values()].find(
      (item) => item.actor === actor && item.artifact.revision === revision,
    );
    if (previous) return previous.artifact;
    if (this.building >= 2)
      throw new HttpError(
        429,
        "PROTOTYPE_BUSY",
        "Hay dos compilaciones en curso. Espera antes de volver a compilar.",
      );
    if (
      this.artifacts.size + this.building >= 16 ||
      [...this.artifacts.values()].filter((item) => item.actor === actor)
        .length +
        (this.buildingByActor.get(actor) ?? 0) >=
        4
    )
      throw new HttpError(
        429,
        "PROTOTYPE_LIMIT",
        "Hay varios prototipos temporales. Descárgalos y descarta uno antes de compilar otro.",
      );
    this.building++;
    this.buildingByActor.set(actor, (this.buildingByActor.get(actor) ?? 0) + 1);
    try {
      const content = await this.compiler(source, revision, signal);
      signal.throwIfAborted();
      const outputHash = digest(content),
        expires = this.now() + 30 * 60000;
      const licenses = (await prototypeLicenses()).map((file) => ({
        ...file,
        sha256: digest(file.content),
        bytes: Buffer.byteLength(file.content),
      }));
      const artifact: PrototypeArtifact = {
        id: digest(
          JSON.stringify({
            revision,
            outputHash,
            compiler: compilerIdentity,
            policy: previewPolicy,
            licenses: licenses.map((file) => ({
              path: file.path,
              sha256: file.sha256,
            })),
          }),
        ),
        revision,
        entry: source.entry,
        createdAt: new Date(this.now()).toISOString(),
        expiresAt: new Date(expires).toISOString(),
        compiler: compilerIdentity,
        policy: previewPolicy,
        licenses,
        files: source.files.map((file) => ({
          ...file,
          sha256: digest(file.content),
          bytes: Buffer.byteLength(file.content),
        })),
        runtime: {
          path: ".ares/preview.html",
          content,
          sha256: outputHash,
          bytes: Buffer.byteLength(content),
        },
        evidence: createEvidence(
          "compiled",
          source.files.map((file) => file.path),
          [{ kind: "compile", id: compilerIdentity, sha256: outputHash }],
          [
            "Transformación sintáctica; no ejecuta ni prueba la lógica de la aplicación.",
          ],
          revision,
        ),
        previewPath: `/prototype-view/${randomBytes(32).toString("hex")}`,
      };
      this.artifacts.set(`${actor}:${artifact.id}`, {
        actor,
        artifact,
        expires,
      });
      return artifact;
    } finally {
      this.building--;
      const active = (this.buildingByActor.get(actor) ?? 1) - 1;
      if (active) this.buildingByActor.set(actor, active);
      else this.buildingByActor.delete(actor);
    }
  }
  read(id: string) {
    this.clean();
    const item = this.artifacts.get(`${this.actor()}:${id}`);
    if (!item)
      throw new HttpError(
        410,
        "PROTOTYPE_EXPIRED",
        "Este prototipo caducó o pertenece a otro usuario. Vuelve a compilar los archivos revisados.",
      );
    return item.artifact;
  }
  list() {
    this.clean();
    return [...this.artifacts.values()]
      .filter((item) => item.actor === this.actor())
      .map(({ artifact }) => ({
        id: artifact.id,
        revision: artifact.revision,
        entry: artifact.entry,
        createdAt: artifact.createdAt,
        expiresAt: artifact.expiresAt,
      }));
  }
  view(token: string) {
    this.clean();
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(404, "PROTOTYPE_VIEW", "Vista no disponible.");
    const item = [...this.artifacts.values()].find(
      (item) => item.artifact.previewPath === `/prototype-view/${token}`,
    );
    if (!item)
      throw new HttpError(
        410,
        "PROTOTYPE_EXPIRED",
        "Vista caducada o descartada.",
      );
    return item.artifact;
  }
  discard(id: string) {
    this.read(id);
    this.artifacts.delete(`${this.actor()}:${id}`);
  }
  zip(id: string) {
    const artifact = this.read(id);
    return storedZip([
      ...artifact.files,
      ...artifact.licenses,
      { path: artifact.runtime.path, content: artifact.runtime.content },
      {
        path: ".ares/manifest.json",
        content: JSON.stringify(artifactManifest(artifact), null, 2) + "\n",
      },
    ]);
  }
}
