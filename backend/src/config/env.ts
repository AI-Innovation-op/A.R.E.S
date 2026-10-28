import { config } from 'dotenv';
import { fileURLToPath,pathToFileURL } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

// Resolver desde el proyecto, incluso al arrancar desde otro directorio.
const settingsFile=process.env.ARES_SETTINGS_FILE;
if(settingsFile&&!path.isAbsolute(settingsFile))throw new Error('ARES_SETTINGS_FILE debe ser una ruta absoluta.');
export const envFile = settingsFile?pathToFileURL(settingsFile):new URL('../../.env', import.meta.url);
const configured=config({ path: fileURLToPath(envFile), quiet: true });
// En contenedor, la configuración editada por el administrador prevalece sobre
// los valores iniciales del proveedor; no sustituye DB, orígenes ni otros ajustes.
if(settingsFile&&configured.parsed)for(const name of ['GEMINI_API_KEY','GEMINI_MODEL','OPENROUTER_API_KEY','OPENROUTER_MODEL','ARES_ACCESS_MODE'])if(configured.parsed[name]!==undefined)process.env[name]=configured.parsed[name];
const optionalText = z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value, z.string().trim().min(1).optional());

const schema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.preprocess(value => value === '' ? undefined : value, z.url().refine(value => /^postgres(ql)?:/.test(value)).optional()),
  DATABASE_AUTO_MIGRATE: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
  LOCAL_COMMANDER_ID: z.uuid().default('00000000-0000-4000-8000-000000000001'),
  ARES_WORKSPACE_ROOTS: optionalText,
  ARES_BACKUP_DIR: optionalText,
  ARES_PG_BIN: optionalText,
  ARES_ACCESS_MODE: z.enum(['local','shared']).default('local'),
  ARES_RUNNER_MODE: z.enum(['docker','local']).default('docker'),
  ARES_SERVE_FRONTEND: z.enum(['true','false']).default('false').transform(value=>value==='true'),
  ARES_BACKUP_ENABLED: z.enum(['true','false']).default('true').transform(value => value === 'true'),
  ARES_BACKUP_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  ARES_BACKUP_KEEP: z.coerce.number().int().min(2).max(100).default(7),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175')
    .transform(value => value.split(',').map(origin => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  GEMINI_API_KEY: optionalText,
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3-flash-preview'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  GEMINI_THINKING_LEVEL: z.enum(['minimal', 'low', 'medium', 'high']).default('low'),
  OPENROUTER_API_KEY: optionalText,
  OPENROUTER_MODEL: z.string().trim().min(1).default('cohere/north-mini-code:free'),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().min(64).max(16384).default(4096),
});

export function loadEnv(input: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // No incluir valores: podrían contener claves o credenciales PostgreSQL.
    throw new Error(`Configuración inválida: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  }
  if(result.data.ARES_ACCESS_MODE==='local'&&!['127.0.0.1','localhost','::1'].includes(result.data.HOST))throw new Error('ARES_ACCESS_MODE=local exige HOST de loopback. Configura accesos antes de exponer el servidor.');
  return result.data;
}
