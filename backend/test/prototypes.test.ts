import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { PrototypeService } from "../src/modules/prototypes/prototype-service.js";
import {
  validateBundle,
  digest,
  artifactManifest,
} from "../src/modules/prototypes/manifest.js";
import { LocalFiles } from "../src/modules/workspace/infrastructure/local-files.js";
const signal = () => AbortSignal.timeout(20000);
const html = (price: number) => ({
  entry: "index.html",
  files: [
    {
      path: "index.html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><div id="price"></div><script type="module" src="./main.ts"></script></body></html>',
    },
    { path: "style.css", content: "body {color: green}" },
    {
      path: "main.ts",
      content: `const price: number = ${price}; document.querySelector('#price')!.textContent = String(price);`,
    },
  ],
});
function entries(zip: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18),
      nameLength = zip.readUInt16LE(offset + 26),
      extra = zip.readUInt16LE(offset + 28),
      name = zip.subarray(offset + 30, offset + 30 + nameLength).toString(),
      start = offset + 30 + nameLength + extra,
      content = zip.subarray(start, start + size);
    assert.equal(crc32(content), zip.readUInt32LE(offset + 14));
    files.set(name, content);
    offset = start + size;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 14), files.size);
  return files;
}
test("prototipos: valida conjunto completo, rutas, tamaño y secretos antes de compilar", () => {
  const redact = (value: string) => new LocalFiles([]).redact(value);
  for (const path of [
    "../index.html",
    "/index.html",
    ".ares/index.html",
    "node_modules/index.html",
    ".env.json",
    "a/../index.html",
  ])
    assert.throws(() =>
      validateBundle({ entry: path, files: [{ path, content: "a" }] }, redact),
    );
  assert.throws(() =>
    validateBundle(
      {
        entry: "index.html",
        files: [
          { path: "index.html", content: "a" },
          { path: "INDEX.html", content: "b" },
        ],
      },
      redact,
    ),
  );
  assert.throws(() =>
    validateBundle(
      {
        entry: "index.html",
        files: [{ path: "index.html", content: 'secret="sensitive-data"' }],
      },
      redact,
    ),
  );
  assert.throws(() =>
    validateBundle(
      {
        entry: "index.html",
        files: [{ path: "index.html", content: "x".repeat(65537) }],
      },
      redact,
    ),
  );
  assert.throws(() =>
    validateBundle(
      { entry: "main.ts", files: [{ path: "main.ts", content: "x" }] },
      redact,
    ),
  );
});
test("prototipos: compila TS/CSS reales, ZIP contiene exactamente fuentes, runtime y manifiesto con huellas", async () => {
  const service = new PrototypeService(
      () => "actor",
      (x) => x,
    ),
    artifact = await service.build(html(17), signal());
  assert.match(artifact.runtime.content, /17/);
  assert.doesNotMatch(artifact.runtime.content, /: number/);
  assert.match(artifact.runtime.content, /default-src 'none'/);
  assert.match(artifact.runtime.content, /color:green/);
  const files = entries(service.zip(artifact.id));
  assert.equal(
    files.size,
    artifact.files.length + artifact.licenses.length + 2,
  );
  assert.match(
    files.get(".ares/licenses/vue.txt")!.toString(),
    /Permission is hereby granted/,
  );
  assert.equal(
    files.get(".ares/preview.html")!.toString(),
    artifact.runtime.content,
  );
  assert.equal(
    digest(files.get(".ares/preview.html")!),
    artifact.runtime.sha256,
  );
  assert.deepEqual(
    JSON.parse(files.get(".ares/manifest.json")!.toString()),
    artifactManifest(artifact),
  );
  for (const source of artifact.files) {
    assert.equal(files.get(source.path)!.toString(), source.content);
    assert.equal(digest(files.get(source.path)!), source.sha256);
  }
  assert.equal((await service.build(html(17), signal())).id, artifact.id);
  const changed = await service.build(html(999), signal());
  assert.notEqual(changed.revision, artifact.revision);
  assert.notEqual(changed.runtime.sha256, artifact.runtime.sha256);
});
test("prototipos: compila Vue SFC/TypeScript reales con dependencias instaladas y cerradas", async () => {
  const service = new PrototypeService(
      () => "actor",
      (x) => x,
    ),
    artifact = await service.build(
      {
        entry: "index.html",
        files: [
          {
            path: "index.html",
            content:
              '<div id="app"></div><script type="module" src="./main.ts"></script>',
          },
          {
            path: "main.ts",
            content:
              'import {createApp} from "vue"; import App from "./App.vue"; createApp(App).mount("#app");',
          },
          {
            path: "App.vue",
            content:
              '<script setup lang="ts">const price: number = 17;</script><template><p>Precio {{price}}</p></template><style scoped>p {color:green}</style>',
          },
        ],
      },
      signal(),
    );
  assert.match(artifact.runtime.content, /Precio/);
  assert.match(artifact.compiler, /Vue 3.5.44/);
  assert.doesNotMatch(artifact.runtime.content, /src="\.\/main.ts"/);
});
test("prototipos: rechaza importaciones externas, lectura host y archivos ausentes sin ejecutar código", async () => {
  const service = new PrototypeService(
    () => "actor",
    (x) => x,
  );
  for (const code of [
    'import fs from "node:fs";',
    'import "https://example.com/a.js";',
    'import "../../secret.js";',
    'import "./missing.ts";',
  ]) {
    const value = html(17);
    value.files[2]!.content = code;
    await assert.rejects(
      service.build(value, signal()),
      /compilar|importaci|incluido/i,
    );
  }
});
test("prototipos: identidad por actor, caducidad, descarte y cancelación sin confirmar", async () => {
  let actor = "a",
    now = 0;
  const service = new PrototypeService(
      () => actor,
      (x) => x,
      undefined,
      () => now,
    ),
    artifact = await service.build(html(17), signal());
  actor = "b";
  assert.throws(() => service.read(artifact.id), /otro usuario/);
  actor = "a";
  service.discard(artifact.id);
  assert.throws(() => service.zip(artifact.id), /caducó/);
  const next = await service.build(html(17), signal());
  now = 30 * 60000;
  assert.throws(() => service.read(next.id), /caducó/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.build(html(999), controller.signal));
});
