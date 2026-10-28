import { expect, test } from '@playwright/test';
import { navigate } from './navigation';

test('GitHub → informe → Biblioteca → edición → reapertura conserva fuentes y alcance', async ({ page, context }) => {
  let generations=0;
  for (const prefix of ['projects','artifacts','conversations','github']) await context.route(`**/api/${prefix}**`, async route => {
    if(route.request().url().endsWith('/github/analyze')) generations++;
    const response=await route.fetch({url:route.request().url().replace('127.0.0.1:5174','127.0.0.1:3102')});await route.fulfill({response});
  });
  await page.goto('/'); await navigate(page,/^Biblioteca/);
  await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByLabel('Nombre del proyecto').fill('GitHub persistente');await page.getByRole('button',{name:'Crear proyecto',exact:true}).click();
  await navigate(page,/^Consola táctica/);await page.getByRole('button',{name:'Leer GitHub',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'Leer GitHub',exact:true});await reader.getByLabel('Repositorio público').fill('https://github.com/example/orders');await reader.getByRole('button',{name:'Inspeccionar',exact:true}).click();await reader.getByRole('checkbox',{name:/src\/order.ts/}).check();await reader.getByRole('button',{name:'Leer selección',exact:true}).click();await reader.getByRole('button',{name:'Analizar con OpenRouter',exact:true}).click();
  const panel=page.getByRole('complementary',{name:'Resultado en contexto'});await panel.getByRole('button',{name:'Guardar informe en Biblioteca'}).click();await expect(panel).toContainText('Borrador guardado');
  await panel.getByRole('button',{name:'Editar documento',exact:true}).click();await panel.getByLabel('Título del documento').fill('Informe revisado');await panel.getByLabel('Contenido del documento').fill('# Decisión revisada\nPropuesta humana de invariantes.');await panel.getByRole('button',{name:'Guardar revisión',exact:true}).click();await expect(panel).toContainText('Revisión 1');
  await panel.getByRole('button',{name:'Ver en Biblioteca'}).click();await expect(page.locator('.artifact-card')).toHaveCount(1);await page.reload();await navigate(page,/^Biblioteca/);await page.locator('.artifact-card').filter({hasText:'Informe revisado'}).click();await page.getByRole('button',{name:'Ver junto al chat',exact:true}).click();
  await expect(panel).toContainText('Informe revisado');await panel.getByRole('tab',{name:'Origen',exact:true}).click();await expect(panel).toContainText('1 leídos de 1 seleccionados; 3 rutas listadas');await expect(panel.getByRole('link',{name:/src\/order.ts/})).toHaveAttribute('href',/blob\/a{40}/);
  await panel.getByRole('button',{name:'Usar en mensaje'}).click();const input=page.getByRole('textbox',{name:'Mensaje para A.R.E.S.'});await expect(input).toHaveValue(/Commit fijado: a{40}/);await expect(input).toHaveValue(/Propuesta humana/);expect(generations).toBe(1);
});
test.afterEach(async({context})=>context.unrouteAll({behavior:'ignoreErrors'}));
