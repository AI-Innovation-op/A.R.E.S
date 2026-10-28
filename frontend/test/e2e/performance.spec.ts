import { test, expect } from "@playwright/test";
import { cpus, totalmem, platform } from "node:os";
import { writeFile } from "node:fs/promises";
test("línea base local de producción: carga, compilación Vue y renderizado aislado", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  const start = performance.now();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir acciones (Ctrl+K)" }),
  ).toBeVisible();
  await expect(page.locator("canvas[data-renderer=three]")).toHaveAttribute(
    "data-frames",
    /[12]/,
  );
  const ready = performance.now() - start,
    origin = new URL(page.url()).origin,
    samples: { compileMs: number; renderMs: number; bytes: number }[] = [];
  const hardware = await page.evaluate(() => {
    const canvas = document.querySelector(
        "canvas[data-renderer=three]",
      ) as HTMLCanvasElement,
      gl = canvas.getContext("webgl2"),
      ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      gpu: ext
        ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "No disponible",
      devicePixelRatio,
    };
  });
  for (let n = 0; n < 3; n++) {
    const before = performance.now(),
      response = await page.request.post("/api/prototypes/build", {
        headers: { Origin: origin },
        data: {
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
                'import{createApp}from"vue";import App from"./App.vue";createApp(App).mount("#app");',
            },
            {
              path: "App.vue",
              content: `<script setup lang="ts">const price:number=${17 + n};</script><template><button>Precio {{price}}</button></template>`,
            },
          ],
        },
      });
    expect(response.ok()).toBe(true);
    const artifact = (await response.json()).artifact,
      compiled = performance.now() - before;
    try {
      const beforeRender = performance.now();
      await page.evaluate((src) => {
        const frame = document.createElement("iframe");
        frame.dataset.performance = "true";
        frame.setAttribute("sandbox", "allow-scripts");
        frame.setAttribute("credentialless", "");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.src = src;
        document.body.append(frame);
      }, artifact.previewPath);
      await expect(
        page
          .frameLocator("iframe[data-performance=true]")
          .getByRole("button", { name: `Precio ${17 + n}`, exact: true }),
      ).toBeVisible();
      samples.push({
        compileMs: compiled,
        renderMs: performance.now() - beforeRender,
        bytes: artifact.runtime.bytes,
      });
    } finally {
      await page
        .locator("iframe[data-performance=true]")
        .evaluate((node) => node.remove())
        .catch(() => {});
      await page.request.post(`/api/prototypes/${artifact.id}/discard`, {
        headers: { Origin: origin },
      });
    }
  }
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  // Observación del renderer, sin activar voz/IA ni ejecutar un benchmark ajeno.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metricsBefore = (await cdp.send("Performance.getMetrics")).metrics;
  const motion = await page.evaluate(() => new Promise<{ elapsedMs: number; deltas: number[] }>(resolve => {
    const deltas: number[] = [];
    let first = 0, previous = 0;
    const sample = (time: number) => {
      if (!first) first = time;
      if (previous) deltas.push(time - previous);
      previous = time;
      if (time - first < 3000) requestAnimationFrame(sample);
      else resolve({ elapsedMs: time - first, deltas });
    };
    requestAnimationFrame(sample);
  }));
  const metricsAfter = (await cdp.send("Performance.getMetrics")).metrics;
  await cdp.detach();
  const metric = (metrics: typeof metricsAfter, name: string) => metrics.find(item => item.name === name)?.value ?? 0;
  const frameTimes = [...motion.deltas].sort((a, b) => a - b);
  const renderer = {
    sampleMs: Math.round(motion.elapsedMs),
    averageRafHz: Math.round(motion.deltas.length / (motion.elapsedMs / 1000)),
    medianFrameMs: Math.round(median(frameTimes) * 10) / 10,
    p95FrameMs: Math.round(frameTimes[Math.min(frameTimes.length - 1, Math.floor(frameTimes.length * 0.95))]! * 10) / 10,
    framesOver50Ms: frameTimes.filter(value => value > 50).length,
    taskCpuMs: Math.round((metric(metricsAfter, "TaskDuration") - metric(metricsBefore, "TaskDuration")) * 1000),
    jsHeapUsedMiB: Math.round(metric(metricsAfter, "JSHeapUsedSize") / 1024 ** 2 * 10) / 10,
    scope: "Renderer Chrome con avatar visible, tres segundos. RAF no equivale a presentaciones GPU; heap JS no es RAM total de navegador, GPU o backend.",
  };
  const result = {
    createdAt: new Date().toISOString(),
    mode: "Build de producción, datos sintéticos, sin IA ni micrófono físico",
    hardware: {
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      ramGiB: Math.round(totalmem() / 1024 ** 3),
      platform: platform(),
      node: process.version,
      chrome: browser.version(),
      ...hardware,
    },
    viewport: page.viewportSize(),
    appReadyMs: Math.round(ready),
    samples,
    medianCompileMs: Math.round(median(samples.map((item) => item.compileMs))),
    medianRenderMs: Math.round(median(samples.map((item) => item.renderMs))),
    renderer,
    interpretation:
      "Tres muestras locales; no es un SLA. Comparar repeticiones en el mismo equipo, build y viewport; objetivo inicial: no empeorar medianas más del 50% sin investigación.",
  };
  await writeFile(
    info.outputPath("performance-baseline.json"),
    JSON.stringify(result, null, 2),
  );
});
