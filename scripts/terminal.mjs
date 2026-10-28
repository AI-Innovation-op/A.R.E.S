import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 24 || (major === 24 && minor < 11))
  throw Error("La terminal requiere Node 24.11 o posterior.");
async function newest(directory) {
  let latest = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) latest = Math.max(latest, await newest(file));
    else latest = Math.max(latest, (await stat(file)).mtimeMs);
  }
  return latest;
}
async function run(args, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  const stop = () => child.kill(),
    interrupt = () => {};
  process.once("SIGTERM", stop);
  process.on("SIGINT", interrupt);
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.off("SIGTERM", stop);
  process.off("SIGINT", interrupt);
  return result;
}
const target = path.join(root, "backend/dist/interfaces/repl-main.js");
const built = await stat(target).then(
  (item) => item.mtimeMs,
  () => 0,
);
if (
  built <
  Math.max(
    await newest(path.join(root, "backend/src")),
    await newest(path.join(root, "packages/contracts")),
  )
) {
  const compiler = path.join(root, "backend/node_modules/typescript/bin/tsc");
  if (
    !(await stat(compiler).then(
      () => true,
      () => false,
    ))
  )
    throw Error("Instala las dependencias con npm --prefix backend ci.");
  console.log("Preparando la terminal de A.R.E.S.…");
  const code = await run(
    [compiler, "-p", "tsconfig.json"],
    path.join(root, "backend"),
  );
  if (code) process.exit(code);
}
const args = process.argv.slice(2);
if (
  !args.includes("--help") &&
  !args.includes("--api") &&
  !process.env.ARES_API_URL
) {
  for (const port of [
    3001,
    3000,
    ...Array.from({ length: 9 }, (_, index) => 3002 + index),
  ]) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        redirect: "error",
        signal: AbortSignal.timeout(400),
      });
      if (response.ok && (await response.json()).service === "ares-backend") {
        args.push("--api", `http://127.0.0.1:${port}`);
        break;
      }
    } catch {}
  }
}
process.exitCode = await run([target, ...args]);
