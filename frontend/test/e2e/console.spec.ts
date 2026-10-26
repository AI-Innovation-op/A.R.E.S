import{navigate}from'./navigation';
import { expect, test } from '@playwright/test';

test('chat: navegador → proxy Vite → API Express → respuesta y pose', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Backend conectado')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tu siguiente gran idea/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/console-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Hola Ares');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Respuesta de prueba' })).toBeVisible();
  await expect(page.getByText('Recibí', { exact: false })).toContainText('1 mensajes');
  await expect(page.locator('.agent-state')).toContainText('Santuario Documental');
  await expect(page.getByRole('link', { name: 'Documentación Vue' })).toHaveAttribute('href', 'https://vuejs.org/guide/introduction');
  await expect(page.locator('.message.model script')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Una segunda consulta');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model').last()).toContainText('3 mensajes');
  expect(errors).toEqual([]);
});

test('módulos: genera, descarga y conserva el borrador al cambiar de pestaña', async ({ page }) => {
  await page.goto('/');
  await navigate(page,/Escudo Documental/);
  await page.getByLabel('Contexto, requisitos o código del proyecto').fill('API de tareas con Node, TypeScript y PostgreSQL.');
  await page.getByRole('button', { name: 'Forjar documento' }).click();
  await expect(page.getByRole('heading', { name: 'Borrador', exact: true })).toBeVisible();
  await expect(page.getByText('BORRADOR · REVISIÓN PENDIENTE')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar borrador' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('ares-documentation-borrador.md');
  await navigate(page,/Arquitectura 04/);
  await navigate(page,/Escudo Documental/);
  await expect(page.getByRole('heading', { name: 'Borrador', exact: true })).toBeVisible();
});

test('error recuperable, pose automática, ficha y diseño móvil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('provocar error');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini no está disponible');
  await expect(page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' })).toHaveValue('provocar error');
  await expect(page.getByRole('button',{name:/Matriz de poses/})).toHaveCount(0);
  await page.getByRole('textbox',{name:'Mensaje para A.R.E.S.'}).fill('Hola Ares');
  await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect(page.locator('.agent-state')).toContainText('Santuario Documental');
  await navigate(page,/Ficha técnica/);
  await expect(page.locator('.spec-content')).toContainText('Control del Documento');
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page,/Consola táctica/);
  await expect(page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/console-mobile.png', fullPage: true });
});
