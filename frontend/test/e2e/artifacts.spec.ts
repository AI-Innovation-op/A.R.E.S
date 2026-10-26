import{navigate}from'./navigation';
import { expect, test } from '@playwright/test';

test('biblioteca SQL: crea proyecto, genera, recarga, restaura y descarga el borrador', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const path of ['projects', 'artifacts']) await context.route(`**/api/${path}**`, async route => {
    const response = await route.fetch({ url: route.request().url().replace('127.0.0.1:5174', '127.0.0.1:3102') });
    await route.fulfill({ response });
  });
  await page.goto('/');
  await navigate(page,/Escudo Documental/);
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Proyecto biblioteca E2E');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByLabel('Título del borrador (opcional)').fill('Guía de la API');
  await page.getByLabel('Contexto, requisitos o código del proyecto').fill('API de tareas con Node, Vue y PostgreSQL.');
  await page.getByRole('button', { name: 'Forjar documento' }).click();
  await expect(page.getByRole('heading', { name: 'Documento persistido' })).toBeVisible();
  await expect(page.locator('.artifact-save-status')).toContainText('Guardado en Proyecto biblioteca E2E');
  await expect(page.locator('.response-provider')).toContainText('GEMINI');
  await page.reload();
  await navigate(page,/Biblioteca/);
  await page.getByRole('button', { name: /Guía de la API/ }).click();
  await expect(page.getByRole('heading', { name: 'Documento persistido' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Borrador guardado', exact: true })).toContainText('history-test');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar borrador guardado', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^ares-documentation-.*\.md$/);
  await page.getByRole('button', { name: 'Abrir en el módulo' }).click();
  await expect(page.getByLabel('Contexto, requisitos o código del proyecto')).toHaveValue('API de tareas con Node, Vue y PostgreSQL.');
  await expect(page.getByLabel('Título del borrador (opcional)')).toHaveValue('Guía de la API');
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page,/Biblioteca/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/library-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
