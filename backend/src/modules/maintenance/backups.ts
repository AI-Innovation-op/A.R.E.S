import { randomUUID, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, rename, readdir, stat, lstat, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import pg, { type Pool, type PoolClient } from 'pg';
import { PgTools } from './pg-tools.js';
import { HttpError } from '../../shared/http-error.js';
import { z } from 'zod';
export interface DatabaseProof { version?: 2; schema: string; tables: Record<string, { rows: number; digest: string }> }
export interface BackupRecord { id: string; createdAt: string; database: string; bytes: number; sha256: string; proof: DatabaseProof; verifiedAt: string | null }
const recordSchema = z.object({ id: z.uuid().refine(value => value[14] === '4'), createdAt: z.iso.datetime(), database: z.string().min(1), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), verifiedAt: z.iso.datetime().nullable(), proof: z.object({ version: z.literal(2).optional(), schema: z.string().regex(/^[a-f0-9]{64}$/), tables: z.record(z.string(), z.object({ rows: z.number().int().nonnegative(), digest: z.string().regex(/^[a-f0-9]{32}$/) })) }) });
const identifier = (value: string) => '"' + value.replace(/"/g, '""') + '"';
async function hashFile(file: string) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
export async function databaseProof(client: Pool | PoolClient, version: 1 | 2 = 2): Promise<DatabaseProof> {
  const schema = await client.query(`SELECT table_name,column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  const definitions = version === 2 ? await client.query(`
    SELECT 'constraint' AS kind,c.relname||'.'||k.conname AS name,
      jsonb_build_object('type',k.contype,'columns',k.conkey,'referencedTable',r.relname,'referencedColumns',k.confkey,'update',k.confupdtype,'delete',k.confdeltype,'match',k.confmatchtype,'deferrable',k.condeferrable,'deferred',k.condeferred,'validated',k.convalidated)::text AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class r ON r.oid=k.confrelid WHERE n.nspname='public'
    UNION ALL SELECT 'index',c.relname,jsonb_build_object('table',t.relname,'columns',i.indkey::text,'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'method',a.amname,'partial',i.indpred IS NOT NULL,'expression',i.indexprs IS NOT NULL)::text
      FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_am a ON a.oid=c.relam WHERE n.nspname='public'
    UNION ALL SELECT 'view',viewname,definition FROM pg_views WHERE schemaname='public'
    ORDER BY kind,name,definition`) : null;
  const result = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const tables: DatabaseProof['tables'] = {};
  for (const { tablename } of result.rows) {
    const query = await client.query<{ rows: number; digest: string }>(`SELECT count(*)::int AS rows,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${identifier(tablename)} t) x`);
    tables[tablename] = query.rows[0]!;
  }
  return { ...(version === 2 ? { version: 2 as const } : {}), schema: createHash('sha256').update(JSON.stringify(version === 2 ? [schema.rows, definitions!.rows] : schema.rows)).digest('hex'), tables };
}
export class BackupService {
  private busy = false;
  private lastError = '';
  private stage = '';
  private timer?: ReturnType<typeof setInterval>;
  private initial?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private drain: (() => void)[] = [];
  constructor(private readonly pool: Pool, private readonly databaseUrl: string, private readonly directory: string, private readonly tools: PgTools, private readonly options = { enabled: true, intervalHours: 24, keep: 7 }) {}
  private async folder() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); return realpath(this.directory); }
  private async files(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new HttpError(400, 'INVALID_BACKUP', 'Identificador de respaldo inválido.');
    const folder = await this.folder(); return { dump: path.join(folder, `${id}.dump`), manifest: path.join(folder, `${id}.json`) };
  }
  async list() {
    const folder = await this.folder(), result: BackupRecord[] = [];
    for (const name of await readdir(folder)) {
      if (!/^[0-9a-f-]{36}\.json$/.test(name)) continue;
      try { const value = recordSchema.parse(JSON.parse(await readFile(path.join(folder, name), 'utf8'))); if (name === value.id + '.json') result.push(value); } catch { /* Una escritura incompleta no se presenta como respaldo. */ }
    }
    return result.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async status() { const records = await this.list(); return { enabled: this.options.enabled, intervalHours: this.options.intervalHours, keep: this.options.keep, directory: await this.folder(), busy: this.busy, stage: this.stage, lastError: this.lastError, nextAt: records[0] ? new Date(Date.parse(records[0].createdAt) + this.options.intervalHours * 3600000).toISOString() : null, backups: records.map(({ proof, ...record }) => ({ ...record, tableCount: Object.keys(proof.tables).length })) }; }
  private async save(record: BackupRecord) {
    const { manifest } = await this.files(record.id), temp = manifest + '.' + randomUUID() + '.partial';
    try { await writeFile(temp, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 }); await rename(temp, manifest); }
    finally { await unlink(temp).catch(() => {}); }
  }
  private async exclusive<T>(action: () => Promise<T>) {
    if (this.busy) throw new HttpError(409, 'BACKUP_BUSY', 'Ya hay una operación de respaldo en curso.');
    this.busy = true; this.lastError = '';
    try { return await action(); } catch (error) { this.lastError = error instanceof HttpError ? error.message : 'No se pudo completar el respaldo. Los datos activos se conservan.'; if (error instanceof HttpError) throw error; throw new HttpError(503, 'BACKUP_FAILED', this.lastError); }
    finally { this.busy = false; this.stage = ''; this.drain.splice(0).forEach(resolve => resolve()); }
  }
  async create() {
    return this.exclusive(async () => {
      this.stage = 'Creando copia consistente'; await this.tools.prepare();
      const id = randomUUID(), files = await this.files(id), partial = files.dump + '.partial';
      const client = await this.pool.connect();
      let record: BackupRecord;
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); await client.query("SET LOCAL statement_timeout='120s'"); await client.query("SET LOCAL TIME ZONE 'UTC'");
        const snapshot = (await client.query<{ id: string }>('SELECT pg_export_snapshot() AS id')).rows[0]!.id;
        const proof = await databaseProof(client);
        const database = decodeURIComponent(new URL(this.databaseUrl).pathname.slice(1));
        await this.tools.run('pg_dump', database, ['--format=custom','--no-owner','--no-privileges',`--snapshot=${snapshot}`], partial);
        await client.query('COMMIT');
        await rename(partial, files.dump);
        record = { id, createdAt: new Date().toISOString(), database, bytes: (await stat(files.dump)).size, sha256: await hashFile(files.dump), proof, verifiedAt: null };
        await this.save(record);
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); await unlink(partial).catch(() => {}); throw error; }
      finally { client.release(); }
      await this.recover(record!, false);
      const records = await this.list();
      for (const old of records.slice(this.options.keep)) { const owned = await this.files(old.id); await unlink(owned.dump); await unlink(owned.manifest); }
      return record!;
    });
  }
  private async checked(id: string) {
    const files = await this.files(id);
    let record: BackupRecord;
    try { record = recordSchema.parse(JSON.parse(await readFile(files.manifest, 'utf8'))); } catch { throw new HttpError(404, 'BACKUP_NOT_FOUND', 'No se encontró este respaldo.'); }
    const info = await lstat(files.dump);
    if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1 || record.id !== id || record.sha256 !== await hashFile(files.dump)) throw new HttpError(409, 'BACKUP_CORRUPT', 'El respaldo no coincide con su huella. No se restauró.');
    return record;
  }
  private async recover(record: BackupRecord, keepDatabase: boolean) {
    this.stage = keepDatabase ? 'Recuperando en una base nueva' : 'Comprobando recuperación';
    const target = `${keepDatabase ? 'ares_recovered_' : 'ares_verify_'}${randomUUID().replaceAll('-', '')}`;
    if (!/^ares_(?:verify|recovered)_[a-f0-9]{32}$/.test(target)) throw new Error('Destino de recuperación inválido');
    const url = new URL(this.databaseUrl); url.pathname = '/' + target;
    let created = false, success = false;
    const verification = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 120000 });
    try {
      await this.pool.query(`CREATE DATABASE ${identifier(target)} TEMPLATE template0`); created = true;
      await this.tools.run('pg_restore', target, ['--exit-on-error','--single-transaction','--no-owner','--no-privileges'], (await this.files(record.id)).dump);
      const client = await verification.connect(); let actual: DatabaseProof;
      try { await client.query('BEGIN READ ONLY'); await client.query("SET LOCAL TIME ZONE 'UTC'"); actual = await databaseProof(client, record.proof.version ?? 1); await client.query('COMMIT'); } finally { client.release(); }
      if (JSON.stringify(actual!) !== JSON.stringify(record.proof)) throw new HttpError(409, 'RESTORE_MISMATCH', 'La recuperación no coincide con el esquema o contenido respaldado.');
      record.verifiedAt = new Date().toISOString(); await this.save(record); success = true;
      return { database: target, verifiedAt: record.verifiedAt, tables: Object.keys(actual!.tables).length };
    } finally {
      await verification.end();
      // Se elimina exclusivamente la base aleatoria que este método acaba de crear.
      if (created && (!keepDatabase || !success)) await this.pool.query(`DROP DATABASE ${identifier(target)} WITH (FORCE)`);
    }
  }
  async verify(id: string) { return this.exclusive(async () => { await this.tools.prepare(); return this.recover(await this.checked(id), false); }); }
  async recoverNew(id: string) { return this.exclusive(async () => { await this.tools.prepare(); return this.recover(await this.checked(id), true); }); }
  start() {
    if (!this.options.enabled) return;
    const tick = async () => { if (this.stopped || this.busy) return; try { const records = await this.list(); const last = records.find(record => record.verifiedAt); if (!last || Date.now() - Date.parse(last.createdAt) >= this.options.intervalHours * 3600000) await this.create(); } catch { /* El estado visible conserva el error; se reintenta en el siguiente ciclo. */ } };
    this.initial = setTimeout(() => { void tick(); }, 15000); this.initial.unref();
    this.timer = setInterval(() => { void tick(); }, 15 * 60000); this.timer.unref();
  }
  async stop() { this.stopped = true; clearTimeout(this.initial); clearInterval(this.timer); if (this.busy) { this.tools.cancel(); await new Promise<void>(resolve => this.drain.push(resolve)); } }
}
