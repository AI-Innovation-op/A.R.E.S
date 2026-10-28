import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { navigate } from "./navigation";
const html = (code: string) => ({
  entry: "index.html",
  files: [
    {
      path: "index.html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><p id="price"></p><script type="module" src="./main.ts"></script></body></html>',
    },
    { path: "style.css", content: "#price {color:green}" },
    { path: "main.ts", content: code },
  ],
});
const price = (value: number) =>
  `const price: number = ${value}; document.querySelector('#price')!.textContent = 'Precio ' + price;`;
const builds = new Set<string>(),
  responses: Promise<unknown>[] = [];
test.beforeEach(async ({ page }) => {
  page.on("response", (response) => {
    if (
      response.url().endsWith("/api/prototypes/build") &&
      response.status() === 200
    )
      responses.push(
        response.json().then((data) => builds.add(data.artifact.id)),
      );
  });
});
test.afterEach(async ({ page, context }) => {
  await Promise.allSettled(responses.splice(0));
  for (const id of builds)
    await context.request
      .post(`${new URL(page.url()).origin}/api/prototypes/${id}/discard`, {
        headers: { Origin: new URL(page.url()).origin },
      })
      .catch(() => {});
  builds.clear();
});
async function load(page: import("@playwright/test").Page, value: object) {
  await navigate(page, /^Preview y ZIP/);
  const panel = page.getByRole("region", { name: "Prototipo revisable" });
  await panel
    .getByText("Importar o conservar fuentes estructuradas", { exact: true })
    .click();
  await panel
    .getByLabel("Manifiesto de fuentes JSON")
    .fill(JSON.stringify(value));
  await panel
    .getByRole("button", { name: "Cargar para revisión", exact: true })
    .click();
  return panel;
}
function zipFiles(zip: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18),
      length = zip.readUInt16LE(offset + 26),
      extra = zip.readUInt16LE(offset + 28),
      name = zip.subarray(offset + 30, offset + 30 + length).toString(),
      start = offset + 30 + length + extra,
      content = zip.subarray(start, start + size);
    expect(crc32(content)).toBe(zip.readUInt32LE(offset + 14));
    files.set(name, content);
    offset = start + size;
  }
  expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  return files;
}
test("preview y ZIP comparten archivos reales y huellas; cambiar precio 17 → 999 cambia la ejecución", async ({
  page,
}) => {
  await page.goto("/");
  const panel = await load(page, html(price(17)));
  expect(await panel.locator("iframe").count()).toBe(0);
  await panel
    .getByRole("button", { name: "Compilar archivos revisados", exact: true })
    .click();
  await expect(panel).toContainText("Versión compilada vigente");
  expect(await panel.locator("iframe").count()).toBe(0);
  await panel
    .getByRole("button", { name: "Abrir vista aislada", exact: true })
    .click();
  const view = page.frameLocator('iframe[title="Vista aislada del prototipo"]');
  await expect(view.locator("#price")).toHaveText("Precio 17");
  await expect(view.locator("#price")).toHaveCSS("color", "rgb(0, 128, 0)");
  await expect(panel.locator("iframe")).toHaveAttribute(
    "sandbox",
    "allow-scripts",
  );
  await panel.getByLabel("Ancho de vista").selectOption("390px");
  expect((await panel.locator("iframe").boundingBox())!.width).toBe(390);
  await page.screenshot({ path: "test-results/prototype-desktop.png" });
  await panel
    .getByText("Archivos revisados · editar fuentes", { exact: true })
    .click();
  await panel.getByRole("button", { name: "main.ts", exact: true }).click();
  await panel
    .getByLabel("Contenido del archivo", { exact: true })
    .fill(price(999));
  await expect(panel.locator("iframe")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Descargar ZIP", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Compilar archivos revisados", exact: true })
    .click();
  await expect(panel).toContainText("Versión compilada vigente");
  await panel
    .getByRole("button", { name: "Abrir vista aislada", exact: true })
    .click();
  await expect(view.locator("#price")).toHaveText("Precio 999");
  const pending = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Descargar ZIP", exact: true })
    .click();
  const download = await pending,
    zip = zipFiles(await readFile((await download.path())!)),
    manifest = JSON.parse(zip.get(".ares/manifest.json")!.toString());
  expect(zip.get("main.ts")!.toString()).toBe(price(999));
  expect(
    createHash("sha256").update(zip.get(".ares/preview.html")!).digest("hex"),
  ).toBe(manifest.runtime.sha256);
  await expect(panel).toContainText(manifest.id);
  await expect(panel).toContainText(manifest.runtime.sha256);
  await panel
    .getByRole("button", { name: "Detener vista", exact: true })
    .click();
  await expect(panel.locator("iframe")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/prototype-mobile.png" });
  await panel.getByRole('button',{name:'Usar fuentes compiladas en mensaje',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Mensaje para A.R.E.S.'})).toHaveValue(/price: number = 999/);
  await expect(page.getByRole('textbox',{name:'Mensaje para A.R.E.S.'})).toHaveValue(/sin pruebas de negocio/);
});
test("Vue/TypeScript se compila y ejecuta con reactividad real", async ({
  page,
}) => {
  await page.goto("/");
  const panel = await load(page, {
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
          'import {createApp} from "vue";import App from "./App.vue";createApp(App).mount("#app");',
      },
      {
        path: "App.vue",
        content:
          '<script setup lang="ts">import {ref} from "vue";const price=ref<number>(17);</script><template><button @click="price++">Precio {{price}}</button></template><style scoped>button{color:green}</style>',
      },
    ],
  });
  await panel
    .getByRole("button", { name: "Compilar archivos revisados", exact: true })
    .click();
  await expect(panel).toContainText("Versión compilada vigente");
  await panel
    .getByRole("button", { name: "Abrir vista aislada", exact: true })
    .click();
  const view = page.frameLocator('iframe[title="Vista aislada del prototipo"]');
  await view.getByRole("button", { name: "Precio 17", exact: true }).click();
  await expect(
    view.getByRole("button", { name: "Precio 18", exact: true }),
  ).toHaveCSS("color", "rgb(0, 128, 0)");
});
test("aislamiento bloquea DOM padre, almacenamiento y red; rechaza mensajes ajenos", async ({
  page,
}) => {
  const escaped: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("preview-escape.invalid"))
      escaped.push(request.url());
  });
  await page.goto("/");
  const code = `try{parent.document.body.dataset.previewEscaped='yes'}catch{console.log('DOM_PADRE_BLOQUEADO')}try{localStorage.setItem('previewEscape','yes')}catch{console.log('STORAGE_BLOQUEADO')}fetch('https://preview-escape.invalid/leak').catch(()=>console.log('RED_BLOQUEADA'));setTimeout(()=>{location.href='https://preview-escape.invalid/navigate'},1500);`;
  const panel = await load(page, html(code));
  await panel
    .getByRole("button", { name: "Compilar archivos revisados", exact: true })
    .click();
  await expect(panel).toContainText("Versión compilada vigente");
  await panel
    .getByRole("button", { name: "Abrir vista aislada", exact: true })
    .click();
  const logs = panel.getByLabel("Consola del prototipo");
  await expect(logs).toContainText("DOM_PADRE_BLOQUEADO");
  await expect(logs).toContainText("STORAGE_BLOQUEADO");
  await expect(logs).toContainText("RED_BLOQUEADA");
  await page.evaluate(() =>
    window.postMessage(
      { type: "ares-preview-log", level: "error", text: "MENSAJE_AJENO" },
      "*",
    ),
  );
  await expect(logs).not.toContainText("MENSAJE_AJENO");
  await page.waitForTimeout(1800);
  expect(escaped).toEqual([]);
  expect(
    await page.evaluate(() => document.body.dataset.previewEscaped),
  ).toBeUndefined();
  await panel
    .getByRole("button", { name: "Detener vista", exact: true })
    .click();
  await expect(panel.locator("iframe")).toHaveCount(0);
});
