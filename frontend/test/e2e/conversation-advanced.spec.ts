import { test, expect } from "@playwright/test";
import { mockConversation } from "./conversation-fixture";
import { openChatOptions } from "./navigation";
test("voz: ARES más finales y provisionales en un evento conservan texto sin envío prematuro", async ({
  page,
}) => {
  await mockConversation(page);
  let messages: string[] = [];
  await page.route("**/api/chat", (route) => {
    messages.push(route.request().postDataJSON().message);
    return route.fulfill({
      json: {
        content: "Un contexto delimita lenguaje y reglas.",
        sources: [],
        provider: "openrouter",
        model: "fixture",
      },
    });
  });
  await page.goto("/");
  await openChatOptions(page, "voice");
  const talk = page.getByRole("region", { name: "Conversación por voz" });
  await talk
    .getByRole("button", { name: "Activar conversación", exact: true })
    .click();
  await page.evaluate(() =>
    window.__aresTalk.frame([
      { text: "ARES.", final: true },
      { text: "Explica contextos", final: false },
    ]),
  );
  await expect(talk).toHaveAttribute("data-phase", "listening");
  expect(messages).toHaveLength(0);
  await page.evaluate(() =>
    window.__aresTalk.frame([
      { text: "ARES.", final: true },
      { text: "Explica contextos delimitados.", final: true },
      { text: "Con ejemplos", final: false },
    ]),
  );
  await expect(talk.getByLabel("Tu turno · transcripción")).toHaveValue(
    "Explica contextos delimitados.",
  );
  expect(messages).toHaveLength(0);
  await page.evaluate(() =>
    window.__aresTalk.frame([
      { text: "ARES.", final: true },
      { text: "Explica contextos delimitados.", final: true },
      { text: "Con ejemplos,okey.", final: true },
    ]),
  );
  await expect(talk).toHaveAttribute("data-phase", "speaking");
  expect(messages).toEqual(["Explica contextos delimitados. Con ejemplos"]);
  await expect(page.locator("canvas[data-renderer=three]")).toHaveAttribute(
    "data-activity",
    "speaking",
  );
  await talk
    .getByRole("button", { name: "Interrumpir respuesta", exact: true })
    .click();
  await expect(talk).toHaveAttribute("data-phase", "review");
  expect(await page.evaluate(() => window.__aresTalk.active())).toBe(false);
});
test("medidor opcional libera captura y AudioContext durante TTS, cierre del panel y error", async ({
  page,
}) => {
  await mockConversation(page);
  await page.addInitScript(() => {
    const stats = { captures: 0, stops: 0, closes: 0 };
    Object.assign(window, { __aresMeter: stats });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        stats.captures++;
        return {
          getTracks: () => [
            {
              stop() {
                stats.stops++;
              },
            },
          ],
        };
      },
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class {
        createAnalyser() {
          return {
            fftSize: 256,
            getByteTimeDomainData(samples: Uint8Array) {
              samples.fill(144);
            },
          };
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        async resume() {}
        async close() {
          stats.closes++;
        }
      },
    });
  });
  const stats = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __aresMeter: { captures: number; stops: number; closes: number };
          }
        ).__aresMeter,
    );
  await page.goto("/");
  await openChatOptions(page, "voice");
  const talk = page.getByRole("region", { name: "Conversación por voz" });
  await talk.getByLabel("Mostrar nivel del micrófono (opcional)").check();
  expect((await stats()).captures).toBe(0);
  await talk
    .getByRole("button", { name: "Activar conversación", exact: true })
    .click();
  await expect.poll(async () => (await stats()).captures).toBe(1);
  await expect(talk.getByRole("meter")).toBeVisible();
  await page.evaluate(() => window.__aresTalk.emit("ARES"));
  await expect(talk).toHaveAttribute("data-phase", "speaking");
  await expect.poll(async () => (await stats()).stops).toBe(1);
  await page.evaluate(() => window.__aresTalk.finish());
  await expect(talk).toHaveAttribute("data-phase", "listening");
  await expect.poll(async () => (await stats()).captures).toBe(2);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await stats()).stops).toBe(2);
  expect(await page.evaluate(() => window.__aresTalk.active())).toBe(true);
  await openChatOptions(page, "voice");
  await expect.poll(async () => (await stats()).captures).toBe(3);
  await page.evaluate(() => window.__aresTalk.deny());
  await expect(talk).toHaveAttribute("data-phase", "off");
  await expect.poll(async () => (await stats()).stops).toBe(3);
  expect((await stats()).closes).toBe(3);
});
