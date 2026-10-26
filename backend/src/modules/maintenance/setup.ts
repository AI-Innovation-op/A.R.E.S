import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { envFile, type loadEnv } from '../../config/env.js';
import { BackupService } from './backups.js';
import { PgTools } from './pg-tools.js';
export function setupBackups(pool: Pool, env: ReturnType<typeof loadEnv>) {
  if (!env.DATABASE_URL) throw new Error('Base no configurada');
  const backend = path.dirname(fileURLToPath(envFile)); const root = path.basename(backend) === 'backend' ? path.dirname(backend) : backend;
  return new BackupService(pool, env.DATABASE_URL, env.ARES_BACKUP_DIR ?? path.join(root,'.local-setup/backups'), new PgTools(env.DATABASE_URL, root, env.ARES_PG_BIN), { enabled: env.ARES_BACKUP_ENABLED, intervalHours: env.ARES_BACKUP_INTERVAL_HOURS, keep: env.ARES_BACKUP_KEEP });
}
