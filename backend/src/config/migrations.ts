import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { Pool } from 'pg';

const databaseDirectory = new URL('../../../database/', import.meta.url);
export async function migrateDatabase(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(41240101)');
    await client.query(`CREATE TABLE IF NOT EXISTS ares_schema_migrations (
      name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const baseline = await client.query("SELECT to_regclass('public.commanders') AS table_name");
    if (!baseline.rows[0]?.table_name) await client.query(await readFile(new URL('schema.sql', databaseDirectory), 'utf8'));
    // Un esquema previo incompleto se detecta antes de intentar modificarlo.
    const tables = await client.query(`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'
      AND table_name = ANY($1::text[])`, [['commanders', 'repositories', 'technical_documents', 'code_audits', 'conversations', 'messages', 'knowledge_embeddings', 'bio_telemetry_logs', 'agent_state_events']]);
    if (tables.rows[0]?.count !== 9) throw new Error('El esquema maestro está incompleto.');
    const directory = new URL('migrations/', databaseDirectory);
    const names = (await readdir(directory)).filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query('SELECT checksum FROM ares_schema_migrations WHERE name=$1', [name]);
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum) throw new Error(`La migración aplicada cambió: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO ares_schema_migrations (name, checksum) VALUES ($1,$2)', [name, checksum]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
