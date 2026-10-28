import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("configuración persistente de contenedor: ruta propia prevalece para proveedores sin sustituir DB/orígenes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ares-settings-"));
  try {
    const file = path.join(directory, "providers.env");
    await writeFile(
      file,
      "GEMINI_API_KEY=settings-synthetic-value\nGEMINI_MODEL=fixture-saved\nDATABASE_URL=postgresql://do-not-use/db\nCORS_ORIGINS=http://do-not-use\n",
    );
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key, value]) =>
          value !== undefined &&
          ["PATH", "SystemRoot", "TEMP", "TMP"].some(
            (name) => name.toLowerCase() === key.toLowerCase(),
          ),
      ),
    ) as Record<string, string>;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `import{loadEnv}from'./src/config/env.ts';const e=loadEnv();console.log(JSON.stringify({model:e.GEMINI_MODEL,saved:e.GEMINI_API_KEY==='settings-synthetic-value',database:e.DATABASE_URL,origin:e.CORS_ORIGINS[0]}));`,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...env,
          ARES_SETTINGS_FILE: file,
          GEMINI_API_KEY: "environment-start-value",
          DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:5432/isolated",
          CORS_ORIGINS: "http://127.0.0.1:5175",
        },
        windowsHide: true,
      },
    );
    const result = JSON.parse(stdout.trim());
    assert.equal(result.model, "fixture-saved");
    assert.equal(result.saved, true);
    assert.equal(
      result.database,
      "postgresql://fixture:fixture@127.0.0.1:5432/isolated",
    );
    assert.equal(result.origin, "http://127.0.0.1:5175");
  } finally {
    if (
      path.dirname(directory) !== tmpdir() ||
      !path.basename(directory).startsWith("ares-settings-")
    )
      throw Error("Ruta inesperada");
    await rm(directory, { recursive: true, force: true });
  }
});
