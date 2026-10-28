import { expect, test, type Page } from '@playwright/test';
import { openChatOptions } from './navigation';
import { mockConversation } from './conversation-fixture';

async function expectComposerInViewport(page: Page) {
  for (const control of [page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }), page.getByRole('button', { name: 'Enviar mensaje', exact: true })]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('entrada visible con historial en escritorio, móvil y pantalla corta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Hola Ares');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model')).toBeVisible();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 390, height: 600 }, { width: 390, height: 420 }]) {
    await page.setViewportSize(viewport);
    await expectComposerInViewport(page);
  }
  await page.screenshot({ path: 'test-results/conversation-layout-mobile.png', fullPage: true });
});

test('opciones bajo demanda, Escape devuelve foco y cerrar no apaga la conversación', async ({ page }) => {
  await mockConversation(page);
  await page.goto('/');
  const voice = page.locator('summary[aria-label="Voz y conversación"]');
  await expect(page.getByRole('button', { name: 'Activar conversación', exact: true })).toBeHidden();
  expect(await page.evaluate(() => window.__aresTalk.starts())).toBe(0);
  await openChatOptions(page, 'voice');
  await page.getByRole('button', { name: 'Activar conversación', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Conversación por voz' })).toHaveAttribute('data-phase', 'standby');
  await page.getByRole('button', { name: 'Cerrar opciones de voz' }).click();
  await expect(voice).toBeFocused();
  expect(await page.evaluate(() => window.__aresTalk.active())).toBe(true);
  await expect(page.getByRole('button', { name: 'Desactivar micrófono', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desactivar micrófono', exact: true }).click();
  expect(await page.evaluate(() => window.__aresTalk.active())).toBe(false);
  await openChatOptions(page, 'attachments');
  await expect(page.getByRole('button', { name: 'Dictar mensaje', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dictar mensaje', exact: true }).click();
  expect(await page.evaluate(() => window.__aresTalk.active())).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('summary[aria-label="Adjuntos y dictado"]')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Dictar mensaje', exact: true })).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__aresTalk.active())).toBe(false);
  await expectComposerInViewport(page);
});

test('respuesta nueva respeta la lectura anterior hasta volver al último mensaje', async ({ page }) => {
  let calls = 0;
  let release: (() => void) | undefined;
  await page.route('**/api/chat', async route => {
    calls++;
    if (calls === 2) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { content: calls === 1 ? Array.from({ length: 60 }, (_, index) => `Párrafo ${index + 1}: evidencia de una conversación extensa.\n\n`).join('') : 'Resultado nuevo que conserva la lectura anterior.', sources: [], provider: 'openrouter', model: 'fixture' } });
  });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' });
  await input.fill('Primera consulta larga');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model')).toContainText('Párrafo 60');
  await input.fill('Segunda consulta');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  const feed = page.getByRole('log', { name: 'Mensajes' });
  await feed.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(page.getByRole('button', { name: 'Volver al último mensaje' })).toBeVisible();
  release!();
  await expect(page.locator('.message.model').last()).toContainText('Resultado nuevo');
  expect(await feed.evaluate(element => element.scrollTop)).toBeLessThan(50);
  await page.getByRole('button', { name: 'Volver al último mensaje' }).click();
  await expect.poll(() => feed.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(48);
  await expectComposerInViewport(page);
});

test('cargar mensajes anteriores conserva el mensaje que se estaba leyendo', async ({ page }) => {
  const conversation = { id: 'pagination-fixture', title: 'Historial de prueba', revision: 1, createdAt: '2026-10-27T12:00:00Z', updatedAt: '2026-10-27T12:00:00Z' };
  const messages = (start: number) => Array.from({ length: 20 }, (_, index) => ({ id: `message-${start + index}`, sequence: start + index, role: 'user', content: `Mensaje ${start + index} · contenido anterior de la conversación.`, sources: [], createdAt: conversation.createdAt }));
  await page.route('**/api/conversations**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/conversations') return route.fulfill({ json: { conversations: [conversation] } });
    const older = url.searchParams.has('before');
    return route.fulfill({ json: { conversation, messages: messages(older ? 1 : 21), hasMore: !older } });
  });
  await page.goto('/');
  await expect(page.locator('.message')).toHaveCount(20);
  await page.getByRole('log', { name: 'Mensajes' }).evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  const anchor = page.locator('.message').filter({ hasText: 'Mensaje 21 ·' });
  const previousTop = (await anchor.boundingBox())!.y;
  await page.getByRole('button', { name: 'Cargar mensajes anteriores' }).click();
  await expect(page.locator('.message')).toHaveCount(40);
  expect(Math.abs((await anchor.boundingBox())!.y - previousTop)).toBeLessThan(2);
  await expectComposerInViewport(page);
});
