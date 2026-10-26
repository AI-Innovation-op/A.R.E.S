import { expect, test } from '@playwright/test';

test('selector de modo envía tarea y muestra proveedor/modelo de cada respuesta', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' });
  await page.getByLabel('Modo', { exact: true }).selectOption('documentation');
  await input.fill('Escribe documentación');
  const request = page.waitForRequest(request => request.url().endsWith('/api/chat') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  expect((await request).postDataJSON().task).toBe('documentation');
  await expect(page.locator('.message.model .response-provider').last()).toContainText('GEMINI');
  await expect(page.locator('.message.model .response-provider').last()).toContainText('gemini-test');
  await page.getByLabel('Modo', { exact: true }).selectOption('programming');
  await input.fill('Revisa una función');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model .response-provider').last()).toContainText('OPENROUTER');
  await expect(page.locator('.message.model .response-provider').last()).toContainText('test/coder:free');
  await expect(page.locator('.message.model')).toHaveCount(2);
});

test('configuración OpenRouter permite cambiar modelo sin volver a introducir la clave', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurar conexiones IA' }).click();
  await expect(page.getByRole('heading', { name: 'Conecta tu OpenRouter' })).toBeVisible();
  await expect(page.getByLabel('Mostrar solo modelos gratuitos')).toBeChecked();
  await expect(page.locator('#openrouter-models option')).toHaveCount(1);
  await page.getByLabel('Identificador del modelo').fill('test/coder:free');
  const request = page.waitForRequest(request => request.url().endsWith('/api/setup/openrouter'));
  await page.getByRole('button', { name: 'Verificar y guardar' }).click();
  expect((await request).postDataJSON()).toEqual({ model: 'test/coder:free' });
  await expect(page.getByText('Conexión verificada y guardada.', { exact: false })).toBeVisible();
  await page.getByLabel('Identificador del modelo').fill('test/coder-paid');
  await expect(page.getByRole('button', { name: 'Verificar y guardar' })).toBeDisabled();
  await page.getByLabel('Mostrar solo modelos gratuitos').uncheck();
  await expect(page.getByRole('button', { name: 'Verificar y guardar' })).toBeEnabled();
});
