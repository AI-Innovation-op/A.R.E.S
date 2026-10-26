import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../../src/config/env.js';
import { testDatabase } from './database.js';
import { BackupService } from '../../src/modules/maintenance/backups.js';
import { PgTools } from '../../src/modules/maintenance/pg-tools.js';
test('respaldo real, recuperación, retención y corrupción sin modificar la base de origen', { timeout: 120000 }, async () => {
  const pool = await testDatabase(), url = new URL(loadEnv().DATABASE_URL!); url.pathname = '/ares_test';
  const directory = await mkdtemp(path.join(tmpdir(), 'ares-backup-sql-'));
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const service = new BackupService(pool, url.href, directory, new PgTools(url.href, root), { enabled: false, intervalHours: 24, keep: 2 });
  let recovered: string | undefined;
  try {
    const baseline = await pool.query('SELECT current_database() AS name');
    const first = await service.create(); assert.ok(first.verifiedAt); assert.ok(first.bytes > 0);
    assert.equal(first.proof.version, 2); assert.ok(Object.keys(first.proof.tables).length >= 9);
    const result = await service.recoverNew(first.id); recovered = result.database;
    assert.match(recovered, /^ares_recovered_[a-f0-9]{32}$/);
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, baseline.rows[0].name);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'ares_verify_%'")).rows[0].n, 0);
    await service.create(); const latest = await service.create();
    const listed = await service.list(); assert.equal(listed.length, 2); assert.ok(!listed.some(item => item.id === first.id));
    await appendFile(path.join(directory, latest.id + '.dump'), 'broken');
    await assert.rejects(service.verify(latest.id), /huella/);
    await assert.rejects(service.verify('../ares_db'), /Identificador/);
    assert.equal((await service.status()).busy, false);
  } finally {
    await service.stop();
    if (recovered) { assert.match(recovered, /^ares_recovered_[a-f0-9]{32}$/); await pool.query(`DROP DATABASE "${recovered}" WITH (FORCE)`); }
    await pool.end(); assert.equal(path.dirname(directory), tmpdir()); assert.ok(path.basename(directory).startsWith('ares-backup-sql-')); await rm(directory, { recursive: true, force: true });
  }
});
