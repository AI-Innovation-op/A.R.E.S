import { expect, test } from '@playwright/test';

test('el avatar libera su bucle al ocultarse y lo recupera al volver',async({page})=>{
 await page.addInitScript(()=>{const host=window as Window&{__aresFrames?:number};host.__aresFrames=0;const native=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>native(time=>{host.__aresFrames=(host.__aresFrames??0)+1;callback(time);});});
 await page.goto('/');const canvas=page.locator('canvas[data-renderer="three"]');await expect(canvas).toHaveAttribute('data-frames','2');const count=()=>page.evaluate(()=>(window as Window&{__aresFrames?:number}).__aresFrames??0);await expect.poll(count).toBeGreaterThan(2);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(canvas).toHaveAttribute('data-loop','paused');const paused=await count();await page.waitForTimeout(250);expect(await count()).toBeLessThanOrEqual(paused+1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(canvas).toHaveAttribute('data-loop','running');await expect.poll(count).toBeGreaterThan(paused+1);
});

test('avatar WebGL real: poses automáticas desde respuestas, paseo, rotación y compañero flotante', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const avatar = page.locator('.avatar-experience');
  await expect(avatar).toHaveAttribute('data-mode', '3d', { timeout: 20000 });
  await expect(page.locator('canvas[data-renderer="three"]')).toHaveAttribute('data-frames', '2');
  await expect(page.locator('canvas')).toHaveAttribute('data-effects', 'matrix');
  await page.getByRole('button', { name: 'Pausar animación', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-effects', 'paused');
  await expect.poll(async () => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d')!; context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let visible = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) visible++;
    return visible;
  })).toBeGreaterThan(1000);
  await page.screenshot({ path: 'test-results/avatar-3d-desktop.png', fullPage: true });
  await expect(page.getByRole('button', { name: /Matriz de poses/ })).toHaveCount(0);
  await page.route('**/api/chat',async route=>{const message=route.request().postDataJSON().message as string;const id=Number(message.match(/pose (\d+)/)?.[1]??1);await route.fulfill({json:{content:`[🛡️ POSE ${id}: ESTADO]\n\nRespuesta de prueba ${id}.`,sources:[]}});});
  for (let id = 1; id <= 16; id++) {
    await page.getByRole('textbox',{name:'Mensaje para A.R.E.S.'}).fill('pose '+id);
    await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
    await expect(avatar).toHaveAttribute('data-pose', String(id));
    await expect(page.locator('.avatar-webgl')).toHaveAttribute('aria-label', new RegExp(`pose ${id}:`));
    await expect(page.locator('canvas')).toHaveCount(1);
  }
  await expect(page.locator('.pose-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Activar animación', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-effects', 'matrix');
  const previousRefactors = Number(await page.locator('canvas').getAttribute('data-refactors'));
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('pose 11');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-refactors', String(previousRefactors + 1));
  await page.screenshot({ path: 'test-results/avatar-refactor-effects.png' });
  await page.getByRole('button', { name: 'Pasear por la escena' }).click();
  await expect(page.getByRole('button', { name: 'Pasear por la escena' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('img', { name: /Avatar 3D/ }).press('ArrowRight');
  await page.getByRole('button', { name: 'Restablecer vista 3D' }).click();
  await page.getByRole('button', { name: 'Activar compañero flotante' }).click();
  await expect(avatar).toHaveClass(/is-floating/);
  const before = await avatar.boundingBox();
  await page.getByRole('button', { name: /Mover compañero flotante/ }).press('ArrowLeft');
  expect((await avatar.boundingBox())!.x).toBeLessThan(before!.x);
  await page.getByRole('button', { name: 'Anclar compañero al panel' }).click();
  await expect(avatar).not.toHaveClass(/is-floating/);
  expect(errors).toEqual([]);
});

test('continúa en 2D sin WebGL y puede recuperar el contexto', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.avatar-experience')).toHaveAttribute('data-mode', '3d', { timeout: 20000 });
  await page.locator('canvas').evaluate(canvas => { canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); });
  await expect(page.locator('.avatar-experience')).toHaveAttribute('data-mode', '2d');
  await expect(page.getByText('Se perdió la conexión gráfica. El avatar continúa en 2D.')).toBeVisible();
  await expect(page.locator('.avatar-art')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver en 3D' }).click();
  await expect(page.locator('.avatar-experience')).toHaveAttribute('data-mode', '3d', { timeout: 20000 });
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('avatar visible en móvil y respeta movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.avatar-experience')).toHaveAttribute('data-mode', '3d', { timeout: 20000 });
  await expect(page.getByRole('img', { name: /Avatar 3D/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar avatar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar animación', exact: true })).toBeDisabled();
  await expect(page.getByText('Movimiento reducido · pose estática')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-effects', 'paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/avatar-3d-mobile.png', fullPage: true });
});
