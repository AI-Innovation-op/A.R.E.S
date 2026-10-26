import{navigate}from'./navigation';
import { expect, test } from '@playwright/test';
test('propuesta: genera diff sin escribir, recupera, aplica y restaura el original', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const prefix of ['projects', 'artifacts', 'conversations']) await context.route(`**/api/${prefix}**`, async route => { const response = await route.fetch({ url: route.request().url().replace('127.0.0.1:5174', '127.0.0.1:3102') }); await route.fulfill({ response }); });
  await page.goto('/'); await navigate(page,/^Repositorio/);
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click(); await page.getByLabel('Nombre del proyecto').fill('Cambios E2E'); await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar carpeta', exact: true }).click(); await page.getByRole('button', { name: 'source.ts LEER', exact: true }).click();
  await page.getByLabel('Cambio que quieres proponer').fill('Cambia el valor de answer de 42 a 43.'); await page.getByRole('button', { name: 'Generar propuesta', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Diff de la propuesta' })).toContainText('Por revisar');
  await expect(page.locator('.comparative-diff')).toHaveAttribute('data-ready','true',{timeout:30000});await page.getByText('Ver parche de texto',{exact:true}).click();await expect(page.locator('.proposal-diff .addition')).toContainText('43'); await expect(page.locator('.proposal-diff .removal')).toContainText('42');
  await expect(page.getByRole('region', { name: 'Archivo leído' })).toContainText('answer = 42');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Descargar diff', exact: true }).click(); expect((await download).suggestedFilename()).toMatch(/\.patch$/);
  await page.reload(); await navigate(page,/^Repositorio/);
  await page.locator('.proposal-list button').filter({ hasText: 'source.ts' }).first().click();
  await page.getByRole('button', { name: 'source.ts LEER', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar este cambio', exact: true }).click(); await expect(page.locator('.proposal-detail .draft-label')).toContainText('Aplicado');
  await expect(page.getByRole('region', { name: 'Archivo leído' })).toContainText('answer = 43');
  await page.getByRole('button', { name: 'Ejecutar check', exact: true }).click(); await expect(page.getByRole('region', { name: 'Resultado de comprobación' })).toContainText('Completado', { timeout: 15000 });
  await page.getByRole('button', { name: 'Restaurar original', exact: true }).click(); await expect(page.locator('.proposal-detail .draft-label')).toContainText('Restaurado');
  await expect(page.getByRole('region', { name: 'Archivo leído' })).toContainText('answer = 42');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/changes-mobile.png', fullPage: true }); expect(errors).toEqual([]);
});

test('conjunto: revisa dos archivos, crea uno, ejecuta check y restaura el original',async({page,context})=>{
  for(const prefix of ['projects','artifacts','conversations'])await context.route(`**/api/${prefix}**`,async route=>{const response=await route.fetch({url:route.request().url().replace('127.0.0.1:5174','127.0.0.1:3102')});await route.fulfill({response});});
  await page.goto('/');await navigate(page,/^Repositorio/);await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByLabel('Nombre del proyecto').fill('Conjunto E2E');await page.getByRole('button',{name:'Crear proyecto',exact:true}).click();await page.getByRole('button',{name:'Conectar carpeta',exact:true}).click();await page.getByRole('button',{name:'source.ts LEER',exact:true}).click();
  const review=page.getByRole('region',{name:'Cambios de varios archivos',exact:true});
  await review.getByRole('button',{name:'Añadir archivo leído al conjunto'}).click();await review.getByLabel('Ruta de archivo nuevo').fill('notes.md');await review.getByRole('button',{name:'Añadir archivo nuevo',exact:true}).click();await review.getByLabel('Cambio para el conjunto').fill('Actualiza código y añade notas');await review.getByRole('button',{name:'Generar conjunto',exact:true}).click();
  const diff=review.getByRole('region',{name:'Diff del conjunto',exact:true});await expect(diff).toContainText('Por revisar');await expect(diff).toContainText('notes.md');await expect(diff.locator('.comparative-diff')).toHaveAttribute('data-ready','true',{timeout:30000});await diff.getByText('Parche de texto: source.ts',{exact:true}).click();await expect(diff).toContainText('+export const answer = 43;');
  await diff.getByLabel(/Ejecutar check de/).check();await diff.getByRole('button',{name:'Aplicar conjunto revisado',exact:true}).click();await expect(diff.locator('.draft-label')).toContainText('Aplicado');await expect(page.getByRole('region',{name:'Resultado de comprobación'})).toContainText('Completado',{timeout:15000});
  await page.getByRole('button',{name:'notes.md LEER',exact:true}).click();await expect(page.getByRole('region',{name:'Archivo leído'})).toContainText('Valor 43');
  await diff.getByRole('button',{name:'Restaurar conjunto',exact:true}).click();await expect(diff.locator('.draft-label')).toContainText('Restaurado');
  await page.getByRole('button',{name:'Actualizar archivos',exact:true}).click();await expect(page.getByRole('button',{name:'notes.md LEER',exact:true})).toHaveCount(0);
});

test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
