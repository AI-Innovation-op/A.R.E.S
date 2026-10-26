import{navigate}from'./navigation';
import { expect, test } from '@playwright/test';
test('RAG SQL: prepara documentos, responde con referencias y las recupera tras recargar', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let delayProjects = false, projectsWaiting = false, releaseProjects!: () => void;
  const projectsReady = new Promise<void>(resolve => { releaseProjects = resolve; });
  for (const path of ['projects', 'artifacts', 'conversations']) await context.route(`**/api/${path}**`, async route => {
    if (delayProjects && route.request().method() === 'GET' && new URL(route.request().url()).pathname === '/api/projects') {
      projectsWaiting = true; await projectsReady;
    }
    const response = await route.fetch({ url: route.request().url().replace('127.0.0.1:5174', '127.0.0.1:3102') });
    await route.fulfill({ response });
  });
  await page.goto('/');
  await navigate(page,/Escudo Documental/);
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Proyecto memoria E2E');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByLabel('Título del borrador (opcional)').fill('Cómo iniciar el proyecto');
  await page.getByLabel('Contexto, requisitos o código del proyecto').fill('El comando de inicio de esta API es npm run dev.');
  await page.getByRole('button', { name: 'Forjar documento' }).click();
  await expect(page.locator('.artifact-save-status')).toContainText('Guardado en Proyecto memoria E2E');
  await navigate(page,/Biblioteca/);
  await page.getByRole('button', { name: 'Preparar memoria', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Memoria del proyecto' })).toContainText('1 de 1 documentos listos');
  await navigate(page,/Consola táctica/);
  await page.getByRole('button', { name: 'Nueva conversación', exact: true }).click();
  await page.getByLabel('Proyecto', { exact: true }).selectOption({ label: 'Proyecto memoria E2E' });
  await page.getByRole('checkbox', { name: 'Consultar memoria del proyecto' }).check();
  await page.getByLabel('Modo', { exact: true }).selectOption('programming');
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('¿Qué comando uso para iniciar?');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model')).toContainText('npm run dev [D1]');
  await expect(page.getByRole('region', { name: 'Documentos recuperados' })).toContainText('Cómo iniciar el proyecto');
  delayProjects = true;
  await page.reload();
  await expect(page.getByRole('region', { name: 'Documentos recuperados' })).toContainText('Cómo iniciar el proyecto');
  await page.getByText('[D1] Cómo iniciar el proyecto · fragmento 1', { exact: true }).click();
  await expect(page.locator('.memory-references blockquote')).toContainText('npm run dev');
  await expect.poll(() => projectsWaiting).toBe(true);
  await page.getByRole('button', { name: 'Abrir documento [D1]', exact: true }).click();
  releaseProjects();
  await expect(page.getByRole('region', { name: 'Borrador guardado', exact: true })).toContainText('npm run dev');
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page,/Consola táctica/);
  await expect(page.getByRole('checkbox', { name: 'Consultar memoria del proyecto' })).toBeChecked();
  await expect(page.locator('.conversation-project')).toContainText('Proyecto memoria E2E');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/memory-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
