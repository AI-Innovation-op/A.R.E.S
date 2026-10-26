import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { HttpError } from '../shared/http-error.js';

type SettingName = 'GEMINI_API_KEY' | 'GEMINI_MODEL' | 'OPENROUTER_API_KEY' | 'OPENROUTER_MODEL' | 'ARES_ACCESS_MODE';
let pending: Promise<void> = Promise.resolve();

// Ambos proveedores comparten archivo: serializar evita perder cambios simultáneos.
export function writeProviderSettings(path: URL, values: Partial<Record<SettingName, string>>) {
  const operation = pending.then(async () => {
    let current = '';
    try { current = await readFile(path, 'utf8'); }
    catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new HttpError(500, 'SETTINGS_READ_ERROR', 'No se pudo leer la configuración local.');
    }
    const entries = Object.entries(values);
    if (entries.some(([, value]) => /[\r\n\0]/.test(value))) throw new HttpError(400, 'INVALID_SETTINGS', 'Configuración inválida.');
    const names = new Set(entries.map(([name]) => name));
    const lines = current.split(/\r?\n/).filter(line => {
      const name = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=/)?.[1];
      return !name || !names.has(name);
    });
    const content = `${lines.join('\n').trimEnd()}\n${entries.map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n')}\n`;
    const temporary = new URL(`${path.href}.${crypto.randomUUID()}.tmp`);
    try { await writeFile(temporary, content, { mode: 0o600 }); await rename(temporary, path); }
    catch { throw new HttpError(500, 'SETTINGS_WRITE_ERROR', 'No se pudo guardar backend/.env. Revisa los permisos de la carpeta.'); }
    finally { await unlink(temporary).catch(() => {}); }
  });
  pending = operation.catch(() => {});
  return operation;
}
