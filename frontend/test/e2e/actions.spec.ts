import { test, expect } from "@playwright/test";
test("paleta navega a acciones reales, conserva borrador y abre voz sin activar micrófono", async ({
  page,
}) => {
  let generations = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/chat")) generations++;
  });
  await page.goto("/");
  const draft = page.getByRole("textbox", { name: "Mensaje para A.R.E.S." });
  await draft.fill("Conservar pregunta");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Acciones de A.R.E.S." });
  await expect(palette.getByLabel("Buscar acción")).toBeFocused();
  await palette.getByLabel("Buscar acción").fill("voz");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Conversación por voz" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar conversación", exact: true }),
  ).toBeVisible();
  await expect(draft).toHaveValue("Conservar pregunta");
  await page.getByRole("button", { name: "Cerrar opciones de voz" }).click();
  const trigger = page.getByRole("button", { name: "Abrir acciones (Ctrl+K)" });
  await trigger.click();
  await palette.getByLabel("Buscar acción").fill("preview");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Prototipo revisable" }),
  ).toBeVisible();
  await trigger.click();
  await palette.getByLabel("Buscar acción").fill("conversar");
  await page.keyboard.press("Enter");
  await expect(draft).toHaveValue("Conservar pregunta");
  expect(generations).toBe(0);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
