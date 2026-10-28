import {openChatOptions} from './navigation';
import { expect, test } from '@playwright/test';

test('PostgreSQL conserva contexto, proveedor y conversación al recargar y cambiar de pestaña', async ({ page, context }) => {
  await page.addInitScript(()=>{localStorage.setItem('ares.voice.v1',JSON.stringify({enabled:true,rate:.96}));Object.defineProperty(window,'__historyVoice',{value:[]});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{text:string;lang='';voice:unknown;onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onerror:unknown;constructor(text:string){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'es-test',lang:'es-ES',name:'Voz española de prueba',localService:true}],addEventListener(){},removeEventListener(){},cancel(){},speak(utterance:{text:string;onstart?:()=>void;onend?:()=>void}){(window as unknown as{__historyVoice:string[]}).__historyVoice.push(utterance.text);queueMicrotask(()=>{utterance.onstart?.();utterance.onend?.();});}},configurable:true});});
  await context.route('**/api/conversations**', async route => {
    const response = await route.fetch({ url: route.request().url().replace('127.0.0.1:5174', '127.0.0.1:3102') });
    await route.fulfill({ response });
  });
  await page.goto('/');
  await openChatOptions(page,'project');
  await expect(page.getByRole('button', { name: 'Reconectar historial' })).toBeEnabled();
  expect(await page.evaluate(()=>(window as unknown as{__historyVoice:string[]}).__historyVoice)).toEqual([]);
  await expect(page.locator('.session-badge').first()).toHaveText('POSTGRESQL');
  await page.getByRole('button', { name: 'Nueva conversación' }).click();
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Primera consulta guardada');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model')).toContainText('1 mensajes de contexto');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as{__historyVoice:string[]}).__historyVoice.length)).toBe(1);
  await expect(page.locator('.session-badge').first()).toHaveText('POSTGRESQL');
  const firstId = await page.evaluate(() => localStorage.getItem('ares.activeConversation'));
  await page.reload();
  await expect(page.locator('.message.model')).toContainText('1 mensajes de contexto');
  expect(await page.evaluate(()=>(window as unknown as{__historyVoice:string[]}).__historyVoice)).toEqual([]);
  await expect(page.locator('.response-provider')).toContainText('OPENROUTER');
  await page.getByLabel('Modo', { exact: true }).selectOption('documentation');
  await page.getByRole('textbox', { name: 'Mensaje para A.R.E.S.' }).fill('Documenta lo anterior');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.locator('.message.model').last()).toContainText('3 mensajes de contexto');
  await expect(page.locator('.response-provider').last()).toContainText('GEMINI');
  await page.getByRole('button', { name: 'Nueva conversación' }).click();
  await expect(page.locator('.message')).toHaveCount(0);
  await openChatOptions(page,'project');
  await page.getByLabel('Historial', { exact: true }).selectOption(firstId!);
  await expect(page.locator('.message')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.message')).toHaveCount(4);
  await expect(page.getByLabel('Modo', { exact: true })).toHaveValue('documentation');
});

test.afterEach(async({context})=>{await context.unrouteAll({behavior:'ignoreErrors'});});
