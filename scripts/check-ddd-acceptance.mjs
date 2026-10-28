import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const source = fileURLToPath(
  new URL("../examples/ddd-acceptance/", import.meta.url),
);
const run = (cwd) =>
  spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", "test/acceptance.test.mjs"],
    {
      cwd,
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
      },
    },
  );
const baseline = run(source);
if (baseline.status !== 0)
  throw new Error(
    "Falló la aceptación DDD:\n" + baseline.stdout + baseline.stderr,
  );
const directory = await mkdtemp(path.join(tmpdir(), "ares-ddd-mutation-"));
try {
  for (const name of [
    "package.json",
    "src/orders/domain/order.mjs",
    "src/orders/application/confirm-order.mjs",
    "src/inventory/domain/stock.mjs",
    "src/adapters/in-memory-uow.mjs",
    "test/acceptance.test.mjs",
  ]) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    let text = await readFile(path.join(source, name), "utf8");
    if (name === "src/orders/domain/order.mjs") {
      if (!text.includes("if (!this.#lines.length)"))
        throw new Error("No se encontró la invariante que se pretende mutar.");
      text = text.replace("if (!this.#lines.length)", "if (false)");
    }
    await writeFile(target, text);
  }
  const mutant = run(directory);
  if (mutant.status === 0 || !mutant.stdout.includes("not ok 1 - pedido vacío"))
    throw new Error(
      "La prueba no detectó la eliminación de la invariante esperada:\n" +
        mutant.stdout +
        mutant.stderr,
    );
  console.log(
    "DDD: 6 pruebas aprobadas. Una copia con la invariante de pedido vacío eliminada falló en el caso esperado. Fuentes originales conservadas.",
  );
} finally {
  const resolved = path.resolve(directory);
  if (
    path.dirname(resolved) !== path.resolve(tmpdir()) ||
    !path.basename(resolved).startsWith("ares-ddd-mutation-")
  )
    throw new Error("Se rechazó limpiar una ruta temporal inesperada.");
  await rm(resolved, { recursive: true, force: true });
}
