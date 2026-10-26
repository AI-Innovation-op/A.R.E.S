import { loadEnv } from '../../src/config/env.js';
import { createDatabase } from '../../src/config/db.js';
import { migrateDatabase } from '../../src/config/migrations.js';

export async function testDatabase() {
  const config = loadEnv();
  if (!config.DATABASE_URL) throw new Error('Las pruebas SQL requieren DATABASE_URL local.');
  const url = new URL(config.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Las pruebas SQL solo usan PostgreSQL local.');
  const admin = createDatabase(url.href);
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', ['ares_test']);
    if (!found.rows.length) await admin.query('CREATE DATABASE ares_test');
  } finally { await admin.end(); }
  url.pathname = '/ares_test';
  const pool = createDatabase(url.href);
  await migrateDatabase(pool);
  return pool;
}
