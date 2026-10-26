import { loadEnv } from './env.js';
import { createDatabase } from './db.js';
import { migrateDatabase } from './migrations.js';
const env = loadEnv();
if (!env.DATABASE_URL) throw new Error('Configura DATABASE_URL antes de migrar.');
const pool = createDatabase(env.DATABASE_URL);
try { await migrateDatabase(pool); console.log('Esquema maestro y migraciones aplicados correctamente.'); }
catch { console.error('No se pudo migrar PostgreSQL. Comprueba Docker, DATABASE_URL y pgvector. No se han aplicado cambios parciales.'); process.exitCode = 1; }
finally { await pool.end(); }
