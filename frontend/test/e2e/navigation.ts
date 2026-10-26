import{expect,type Page}from'@playwright/test';
export async function navigate(page:Page,name:RegExp|string){const nav=page.getByRole('navigation',{name:'Secciones de A.R.E.S.'});if(!await nav.isVisible())await page.getByRole('button',{name:'Abrir menú principal',exact:true}).click();await nav.getByRole('button',{name}).click();await expect(nav).toHaveCount(0);}
