import{expect,type Page}from'@playwright/test';
export async function navigate(page:Page,name:RegExp|string){const nav=page.getByRole('navigation',{name:'Secciones de A.R.E.S.'});if(!await nav.isVisible())await page.getByRole('button',{name:'Abrir menú principal',exact:true}).click();await nav.getByRole('button',{name}).click();await expect(nav).toHaveCount(0);}
export async function openChatOptions(page:Page,kind:'voice'|'project'|'attachments') {
  const label={voice:'Voz y conversación',project:'Proyecto e historial',attachments:'Adjuntos y dictado'}[kind];
  const summary=page.locator(`summary[aria-label="${label}"]`);
  if(await summary.locator('..').getAttribute('open')===null)await summary.click();
}
