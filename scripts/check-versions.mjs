import {readFile}from'node:fs/promises';
import {appVersion}from'../packages/contracts/index.js';
for(const name of ['package.json','backend/package.json','frontend/package.json','packages/contracts/package.json','backend/package-lock.json','frontend/package-lock.json']){const value=JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));if(value.version!==appVersion||value.packages?.['']&&value.packages[''].version!==appVersion)throw new Error(`Versión incoherente: ${name}`);}
console.log(`Versión coherente: ${appVersion}. Esto valida metadatos, no capacidades ni publicación.`);
