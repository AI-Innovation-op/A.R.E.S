import { loadEnv } from '../../config/env.js';
import { createDatabase } from '../../config/db.js';
import { setupBackups } from './setup.js';
const env = loadEnv();
if (!env.DATABASE_URL) throw new Error('Configura PostgreSQL antes de respaldar.');
const pool = createDatabase(env.DATABASE_URL), service = setupBackups(pool, env);
try {
  const [action,id] = process.argv.slice(2);
  if (action === 'create') { const result = await service.create(); console.log(JSON.stringify({ id: result.id, bytes: result.bytes, verifiedAt: result.verifiedAt })); }
  else if (action === 'verify' && id) console.log(JSON.stringify(await service.verify(id)));
  else if (action === 'recover' && id) console.log(JSON.stringify(await service.recoverNew(id)));
  else if (action === 'list') console.log(JSON.stringify(await service.status(), null, 2));
  else throw new Error('Usa create, list, verify UUID o recover UUID.');
} catch { console.error('No se pudo completar el mantenimiento. Revisa Docker, la conexión y los permisos de PostgreSQL.'); process.exitCode = 1; }
finally { await service.stop(); await pool.end(); }
