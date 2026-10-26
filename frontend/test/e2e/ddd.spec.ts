import {expect,test} from '@playwright/test';
import {navigate} from './navigation';
test('DDD: archivo leído, análisis real del servidor, infracción y exportación',async({page,context})=>{
 for(const prefix of ['projects','artifacts','conversations'])await context.route(`**/api/${prefix}**`,async route=>{const response=await route.fetch({url:route.request().url().replace('127.0.0.1:5174','127.0.0.1:3102')});await route.fulfill({response});});
 await page.goto('/');await navigate(page,/^Repositorio/);await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();await page.getByLabel('Nombre del proyecto').fill('DDD dependencias E2E');await page.getByRole('button',{name:'Crear proyecto',exact:true}).click();await page.getByRole('button',{name:'Conectar carpeta',exact:true}).click();await page.getByRole('button',{name:'domain CARPETA',exact:true}).click();await page.getByRole('button',{name:'order.ts LEER',exact:true}).click();
 const panel=page.getByRole('region',{name:'Reglas DDD'});await panel.getByRole('button',{name:'Añadir archivo a revisión DDD'}).click();await panel.getByRole('button',{name:'Comprobar reglas DDD'}).click();await expect(panel).toContainText('DOMAIN_TECHNICAL');await expect(panel).toContainText('domain/order.ts:1');await expect(panel).toContainText('1/1 archivos analizados');const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Descargar informe DDD'}).click();expect((await download).suggestedFilename()).toBe('ares-reglas-ddd.json');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test.afterEach(async({context})=>context.unrouteAll({behavior:'ignoreErrors'}));
