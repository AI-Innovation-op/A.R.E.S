import { parse } from '@babel/parser';
import path from 'node:path';
export interface ArchitectureSource { path: string; content: string; sha256: string }
export interface ArchitectureAlias { prefix: string; directory: string }
interface Finding { path: string; line: number; rule: string; dependency: string; message: string }
type Ast = { type?: string; loc?: { start: { line: number } }; [key: string]: unknown };
const layers: Record<string, string> = { domain: 'domain', dominio: 'domain', application: 'application', aplicacion: 'application', infrastructure: 'infrastructure', infraestructura: 'infrastructure', adapters: 'infrastructure', adaptadores: 'infrastructure', presentation: 'presentation', ui: 'presentation' };
function location(file: string) {
  const parts = file.replace(/\\/g, '/').split('/'), index = parts.findIndex(part => layers[part.toLowerCase()]);
  return index < 0 ? undefined : { layer: layers[parts[index]!.toLowerCase()]!, context: parts.slice(0, index).join('/') || '(raíz)' };
}
const text = (value: unknown) => typeof value === 'object' && value && 'type' in value && value.type === 'StringLiteral' && 'value' in value && typeof value.value === 'string' ? value.value : undefined;
const technical = /^(?:node:(?:fs|http|https|net|child_process)|fs(?:\/|$)|@prisma\/|@nestjs\/|typeorm(?:\/|$)|sequelize(?:\/|$)|mongoose(?:\/|$)|knex(?:\/|$)|pg(?:\/|$)|mysql2?(?:\/|$)|express(?:\/|$)|axios(?:\/|$)|react(?:\/|$)|vue(?:\/|$))/;
export function checkArchitecture(sources: ArchitectureSource[], aliases: ArchitectureAlias[] = []) {
  const findings: Finding[] = [], uncertainties: { path: string; line: number; reason: string }[] = [];
  let analyzed = 0, imports = 0;
  for (const source of sources) {
    const from = location(source.path);
    const uncertain = (reason: string, line = 1) => uncertainties.push({ path: source.path, line, reason });
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(source.path)) { uncertain('Formato no analizado. Esta comprobación admite JavaScript y TypeScript.'); continue; }
    if (!from) { uncertain('No se reconoció una capa en la ruta: domain, application, infrastructure, adapters o presentation/ui.'); continue; }
    let ast;
    try { ast = parse(source.content, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'], createImportExpressions: true }); }
    catch { uncertain('No se pudo analizar la sintaxis; este archivo no se considera comprobado.'); continue; }
    analyzed++;
    const stack: unknown[] = [ast];
    while (stack.length) {
      const item = stack.pop(); if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) { stack.push(...item); continue; }
      const node = item as Ast; if (typeof node.type !== 'string') continue;
      const line = node.loc?.start.line ?? 1;
      let dependency: string | undefined, isImport = false;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && node.source) { dependency = text(node.source); isImport = true; }
      else if (node.type === 'CallExpression' && (node.callee as Ast | undefined)?.type === 'Identifier' && (node.callee as Ast).name === 'require') { dependency = text((node.arguments as unknown[])[0]); isImport = true; }
      else if (['TSExternalModuleReference', 'TSImportType'].includes(node.type)) { dependency = text(node.expression ?? node.argument); isImport = true; }
      if (isImport) {
        imports++;
        if (!dependency) uncertain('Importación dinámica no literal: no se puede resolver estáticamente.', line);
        else {
          const found = (rule: string, message: string) => findings.push({ path: source.path, line, rule, dependency: dependency!, message });
          let target: string | undefined;
          if (dependency.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(source.path.replace(/\\/g, '/')), dependency));
          else { const alias = [...aliases].sort((a, b) => b.prefix.length - a.prefix.length).find(value => dependency!.startsWith(value.prefix)); if (alias) target = path.posix.normalize(alias.directory + '/' + dependency.slice(alias.prefix.length)); }
          if (target) {
            const to = location(target);
            if (target.startsWith('../') || target.startsWith('/')) uncertain('La dependencia sale de la raíz; no se inspeccionó el destino.', line);
            else if (!to) uncertain(`Destino sin capa reconocida: ${dependency}. Puede ser un contrato compartido; revísalo.`, line);
            else {
              if (from.layer === 'domain' && to.layer !== 'domain') found('DOMAIN_OUTWARD', 'El dominio depende de una capa exterior. Define un puerto o un valor del dominio y aporta el adaptador desde fuera.');
              if (from.layer === 'application' && ['infrastructure', 'presentation'].includes(to.layer)) found('APPLICATION_ADAPTER', 'El caso de uso importa un adaptador concreto. Depende de un puerto y suministra el adaptador al componer la aplicación.');
              if (from.context !== to.context && to.layer === 'domain') found('CROSS_CONTEXT_DOMAIN', 'Acceso al dominio interno de otro contexto. Revisa un contrato público, evento o una capa de traducción entre contextos.');
            }
          } else if (from.layer === 'domain' && technical.test(dependency)) found('DOMAIN_TECHNICAL', 'El dominio importa una dependencia de persistencia, red, sistema o interfaz. Separa esa responsabilidad mediante un puerto.');
          else if (dependency.startsWith('@') || dependency.startsWith('#')) uncertain(`Paquete o alias no resuelto: ${dependency}. Configura el alias si pertenece al proyecto.`, line);
        }
      }
      for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens'].includes(key) && value && typeof value === 'object') stack.push(value);
    }
  }
  return { checkedAt: new Date().toISOString(), status: findings.length ? 'findings' as const : uncertainties.length ? 'partial' as const : 'clear' as const, selected: sources.length, analyzed, imports, files: sources.map(({ path, sha256 }) => ({ path, sha256 })), findings, uncertainties,
    scope: 'Importaciones explícitas de los archivos seleccionados. Las capas y contextos se infieren de sus rutas. No valida reglas de negocio, invariantes, destinos existentes, dependencias transitivas ni todo el repositorio. require se interpreta como CommonJS; un require local puede necesitar revisión.' };
}
