import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const execute = promisify(execFile),
  docker = process.argv[2] ?? "docker",
  image = process.argv[3] ?? "ares-local-review:1.0.0";
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) =>
      value !== undefined &&
      [
        "PATH",
        "HOME",
        "USERPROFILE",
        "LOCALAPPDATA",
        "SystemRoot",
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "DOCKER_CONFIG",
        "TEMP",
        "TMP",
      ].some((name) => name.toLowerCase() === key.toLowerCase()),
  ),
);
const inheritedPath =
  Object.entries(environment).find(
    ([key]) => key.toLowerCase() === "path",
  )?.[1] ?? "";
for (const key of Object.keys(environment))
  if (key.toLowerCase() === "path") delete environment[key];
environment.PATH = path.dirname(docker) + path.delimiter + inheritedPath;
const run = async (args) =>
  (
    await execute(docker, args, {
      windowsHide: true,
      env: environment,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120000,
    })
  ).stdout.trim();
const listener = createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`,
  name = `ares-review-${randomUUID()}`;
let id = "",
  databaseId = "",
  networkId = "",
  browser;
try {
  networkId = await run(["network", "create", "--label", "ares.review=true", name]);
  if (!/^[a-f0-9]{64}$/.test(networkId)) throw new Error("Docker no confirmó la red temporal.");
  databaseId = await run([
    "run", "--rm", "-d", "--name", `${name}-db`,
    "--label", "ares.review=true", "--network", networkId, "--network-alias", "db",
    "-e", "POSTGRES_USER=ares", "-e", "POSTGRES_PASSWORD=synthetic_review_only",
    "-e", "POSTGRES_DB=ares_review", "pgvector/pgvector:pg16",
  ]);
  if (!/^[a-f0-9]{64}$/.test(databaseId)) throw new Error("Docker no confirmó PostgreSQL temporal.");
  let databaseReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await run(["exec", databaseId, "pg_isready", "-U", "ares", "-d", "ares_review"]).then(() => true, () => false)) { databaseReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!databaseReady) throw new Error("PostgreSQL temporal no arrancó.");
  id = await run([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "--label",
    "ares.review=true",
    "--network", networkId,
    "-p",
    `127.0.0.1:${port}:3000`,
    "-e",
    "HOST=0.0.0.0",
    "-e",
    "PORT=3000",
    "-e",
    "ARES_SERVE_FRONTEND=true",
    "-e",
    "ARES_ACCESS_MODE=shared",
    "-e",
    "DATABASE_URL=postgresql://ares:synthetic_review_only@db:5432/ares_review",
    "-e",
    "ARES_BACKUP_ENABLED=false",
    "-e",
    `CORS_ORIGINS=${origin}`,
    image,
  ]);
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new Error("Docker no confirmó el contenedor de prueba.");
  let health;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${origin}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        health = await response.json();
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!health || health.version !== "1.0.0")
    throw new Error("La imagen no confirmó health/version.");
  if ((await fetch(`${origin}/api/spec`)).status !== 401) throw new Error("La imagen no exige sesión.");
  const recovery = await run(["exec", id, "node", "dist/modules/access/recover-cli.js"]);
  const code = recovery.trim().split(/\r?\n/).at(-1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(code ?? "")) throw new Error("No se preparó la identidad temporal.");
  const redeemed = await fetch(`${origin}/api/access/redeem`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "Revisión sintética de imagen" }),
  });
  const cookie = redeemed.headers.get("set-cookie")?.split(";")[0];
  if (!redeemed.ok || !cookie?.startsWith("ares_session=")) throw new Error("No se autenticó la identidad temporal.");
  const post = async (route, body) => {
    const response = await fetch(`${origin}/api${route}`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Falló API de la imagen: ${response.status}`);
    return response;
  };
  const source = {
      entry: "index.html",
      files: [
        {
          path: "index.html",
          content:
            '<p id="price"></p><script type="module" src="./main.ts"></script>',
        },
        {
          path: "main.ts",
          content:
            'const price:number=999;document.querySelector("#price")!.textContent=String(price);',
        },
      ],
    },
    artifact = (await (await post("/prototypes/build", source)).json())
      .artifact;
  const preview = await fetch(origin + artifact.previewPath),
    content = await preview.text();
  if (
    createHash("sha256").update(content).digest("hex") !==
    artifact.runtime.sha256
  )
    throw new Error("La vista no coincide con la huella de la imagen.");
  if (
    !preview.headers
      .get("content-security-policy")
      ?.includes("sandbox allow-scripts")
  )
    throw new Error("La vista carece de CSP sandbox.");
  const require = createRequire(
      new URL("../frontend/package.json", import.meta.url),
    ),
    { chromium } = require("@playwright/test");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: "ares_session", value: cookie.slice("ares_session=".length), url: origin, httpOnly: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole("button", { name: "Abrir acciones (Ctrl+K)" }).waitFor();
  await page.evaluate((src) => {
    const frame = document.createElement("iframe");
    frame.id = "container-probe";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("credentialless", "");
    frame.src = src;
    document.body.append(frame);
  }, artifact.previewPath);
  await page
    .frameLocator("#container-probe")
    .locator("#price")
    .filter({ hasText: "999" })
    .waitFor();
  const settings = await run([
    "exec",
    id,
    "node",
    "--input-type=module",
    "-e",
    `import{envFile}from'./dist/config/env.js';import{writeProviderSettings}from'./dist/config/settings-file.js';await writeProviderSettings(envFile,{GEMINI_MODEL:'synthetic-persisted-model'});console.log('saved');`,
  ]);
  const persisted = await run([
    "exec",
    id,
    "node",
    "--input-type=module",
    "-e",
    `import{loadEnv}from'./dist/config/env.js';const e=loadEnv();console.log(JSON.stringify({persisted:e.GEMINI_MODEL==='synthetic-persisted-model',keysAbsent:!e.GEMINI_API_KEY&&!e.OPENROUTER_API_KEY,uid:process.getuid()}));`,
  ]);
  const state = JSON.parse(persisted);
  if (
    settings !== "saved" ||
    !state.persisted ||
    !state.keysAbsent ||
    state.uid === 0
  )
    throw new Error("Falló la configuración persistente sin privilegios.");
  const zip = Buffer.from(
    await (await post(`/prototypes/${artifact.id}/zip`, {})).arrayBuffer(),
  );
  if (zip.readUInt32LE(0) !== 0x04034b50)
    throw new Error("No se descargó ZIP desde la imagen.");
  const result = {
    image,
    version: health.version,
    frontend: true,
    previewSha256: artifact.runtime.sha256,
    cspSandbox: true,
    renderedPrice: 999,
    zipBytes: zip.length,
    settingsPersisted: true,
    nonRootUid: state.uid,
    providerKeysAbsent: true,
    temporaryPostgres: true,
    sharedAccessEnforced: true,
    modelInvoked: false,
    pushed: false,
  };
  const output = fileURLToPath(
    new URL("../.local-setup/container-validation.json", import.meta.url),
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  for (const containerId of [id, databaseId]) if (/^[a-f0-9]{64}$/.test(containerId)) {
    const label = await run([
      "inspect",
      "--format",
      '{{index .Config.Labels "ares.review"}}',
      containerId,
    ]).catch(() => "");
    if (label === "true") await run(["rm", "-f", containerId]);
  }
  if (/^[a-f0-9]{64}$/.test(networkId)) {
    const label = await run(["network", "inspect", "--format", '{{index .Labels "ares.review"}}', networkId]).catch(() => "");
    if (label === "true") await run(["network", "rm", networkId]);
  }
}
