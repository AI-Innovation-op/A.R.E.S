import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkArchitecture } from '../src/modules/workspace/domain/architecture.js';
const source=(content:string,path='src/orders/domain/order.ts')=>({content,path,sha256:'a'.repeat(64)});
test('AST: ignora comentarios/cadenas y detecta ORM, exportaciones y tipos',()=>{
 const report=checkArchitecture([source('// import x from "pg";\nconst example="require(\'pg\')";\nimport type { Prisma } from "@prisma/client";\nexport {save} from "../infrastructure/db";')]);
 assert.equal(report.imports,2);assert.deepEqual(report.findings.map(x=>x.rule),['DOMAIN_OUTWARD','DOMAIN_TECHNICAL']);assert.equal(report.findings.find(x=>x.rule==='DOMAIN_TECHNICAL')!.line,3);
});
test('detecta dependencia entre contextos y adaptador desde caso de uso',()=>{
 const report=checkArchitecture([source('import {Buyer} from "../../customers/domain/buyer";\nimport {Db} from "../infrastructure/db";','src/orders/application/confirm.ts')]);
 assert.deepEqual(new Set(report.findings.map(x=>x.rule)),new Set(['CROSS_CONTEXT_DOMAIN','APPLICATION_ADAPTER']));
});
test('resuelve alias explícitos y marca importaciones dinámicas o sintaxis desconocida como parciales',()=>{
 const report=checkArchitecture([source('import {db} from "@/orders/infrastructure/db"; const x=import(name);'),source('import { x } from "@unresolved/port"','src/orders/domain/value.ts'),source('def run(): pass','src/orders/domain/order.py'),source('class {','src/orders/domain/broken.ts')],[{prefix:'@/',directory:'src'}]);
 assert.equal(report.findings.length,1);assert.equal(report.uncertainties.length,4);assert.equal(report.analyzed,2);
});
test('un dominio puro y un caso de uso interno no tienen infracciones',()=>{
 const report=checkArchitecture([source('export class Order {}'),source('import {Order} from "../domain/order";','src/orders/application/confirm.ts')]);assert.equal(report.status,'clear');assert.equal(report.analyzed,2);
});
