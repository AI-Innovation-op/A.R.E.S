import { expect, test } from "@playwright/test";
import { mockConversation } from "./conversation-fixture";
import { openChatOptions } from "./navigation";

test("pose al final: avatar automático y metadato oculto en mensaje y voz", async ({
  page,
}) => {
  await mockConversation(page);
  const content =
    "Propongo validar el pedido. Sin artículos, se conserva el borrador.\n\n[🛡️ POSE 15: Santuario | OJOS: [^ ^] | NÚCLEO: DOCS]";
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: `event: delta\ndata: ${JSON.stringify({ text: content })}\n\nevent: done\ndata: ${JSON.stringify({ content, sources: [], provider: "gemini", model: "fixture" })}\n\n`,
    }),
  );
  await page.goto("/");
  await openChatOptions(page, "voice");
  await page
    .getByRole("button", { name: "Activar voz de A.R.E.S.", exact: true })
    .click();
  await page.evaluate(() => window.__aresTalk.finish());
  await page
    .getByRole("textbox", { name: "Mensaje para A.R.E.S." })
    .fill("Explica la regla del pedido.");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await expect(page.locator(".avatar-experience")).toHaveAttribute(
    "data-pose",
    "15",
  );
  await expect(page.locator(".message.model").last()).toContainText(
    "se conserva el borrador",
  );
  await expect(page.locator(".message.model").last()).not.toContainText("POSE");
  await expect
    .poll(() => page.evaluate(() => window.__aresTalk.spoken.length))
    .toBe(2);
  const spoken = await page.evaluate(() => window.__aresTalk.spoken.at(-1));
  expect(spoken?.text).toContain("se conserva el borrador");
  expect(spoken?.text).not.toMatch(/POSE|NÚCLEO|OJOS/);
  expect(spoken?.lang).toMatch(/^es-/);
});
