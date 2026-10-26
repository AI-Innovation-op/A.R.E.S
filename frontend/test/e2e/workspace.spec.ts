import{navigate}from'./navigation';
import { expect, test } from '@playwright/test';
test('repositorio real: conecta, lee código, ejecuta check y conserva evidencia del chat', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const prefix of ['projects', 'artifacts', 'conversations']) await context.route(`**/api/${prefix}**`, async route => {
    const response = await route.fetch({ url: route.request().url().replace('127.0.0.1:5174', '127.0.0.1:3102') }); await route.fulfill({ response });
  });
  await page.goto('/'); await navigate(page,/^Repositorio/);
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Repositorio E2E'); await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar carpeta', exact: true }).click();
  await expect(page.getByLabel('Archivos del repositorio')).not.toContainText('.env');
  await page.getByRole('button', { name: 'source.ts LEER', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Archivo leído' })).toContainText('answer = 42');
  await page.getByRole('button', { name: 'Usar en auditoría', exact: true }).click();
  await expect(page.getByLabel('Código y contexto a revisar')).toHaveValue(/source.ts[\s\S]*answer = 42/);
  await navigate(page,/^Repositorio/); await page.getByRole('button', { name: 'source.ts LEER', exact: true }).click();
  await page.getByRole('button', { name: 'Adjuntar archivo al chat', exact: true }).click();
  await expect(page.getByLabel('Adjuntos del mensaje')).toContainText('source.ts');
  await navigate(page,/^Repositorio/); await page.getByRole('button', { name: 'Ejecutar check', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Resultado de comprobación' })).toContainText('CHECK_E2E_OK', { timeout: 15000 });
  await expect(page.getByRole('region', { name: 'Resultado de comprobación' })).toContainText('Completado');
  await page.getByRole('button', { name: 'Adjuntar resultado al chat', exact: true }).click();
  await expect(page.getByLabel('Adjuntos del mensaje')).toContainText('source.ts'); await expect(page.getByLabel('Adjuntos del mensaje')).toContainText('check');
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Explica el archivo y la comprobación'); await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Evidencia local' })).toContainText('source.ts'); await expect(page.getByRole('region', { name: 'Evidencia local' })).toContainText('PASSED');
  await page.reload(); await expect(page.getByRole('region', { name: 'Evidencia local' })).toContainText('PASSED');
  await page.getByRole('button', { name: 'Abrir repositorio', exact: true }).click();
  await expect(page.getByLabel('Historial de comprobaciones')).toContainText('Completado');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true }); expect(errors).toEqual([]);
});

test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
