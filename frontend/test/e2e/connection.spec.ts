import { expect, test } from '@playwright/test';

test('guía de configuración, guardado y recuperación de la conexión', async ({ page }) => {
  await page.route('**/health', route => route.fulfill({ json: { status: 'ok', chat: { configured: false, model: 'test-model' } } }));
  await page.goto('/');
  await expect(page.getByText('Gemini por configurar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configurar Gemini', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conecta tu Gemini' })).toBeVisible();
  const key = page.getByLabel('Clave de API de Gemini');
  await expect(key).toHaveAttribute('type', 'password');
  await key.fill('test_key_only_for_local_validation_123');
  await page.getByLabel('Identificador del modelo').fill('test-model');
  await page.unroute('**/health');
  await page.getByRole('button', { name: 'Verificar y guardar' }).click();
  await expect(page.getByText('Conexión verificada y guardada.', { exact: false })).toBeVisible();
  await expect(page.getByText('Backend conectado', { exact: true })).toBeVisible();
  await expect(key).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test_key_only_for_local_validation_123');
});

test('muestra cómo iniciar el servidor cuando el proxy no responde', async ({ page }) => {
  await page.route('**/health', route => route.fulfill({ status: 502, body: '' }));
  await page.goto('/');
  await expect(page.getByText('Backend desconectado', { exact: true })).toBeVisible();
  await expect(page.locator('.connection-banner')).toContainText('npm run dev');
  await expect(page.getByRole('button', { name: 'Volver a comprobar' })).toBeVisible();
});
