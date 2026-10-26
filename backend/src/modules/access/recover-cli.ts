import { loadEnv } from '../../config/env.js';
import { createDatabase } from '../../config/db.js';
import { migrateDatabase } from '../../config/migrations.js';
import { AccessControl } from './access.js';
const env=loadEnv();if(!env.DATABASE_URL)throw new Error('PostgreSQL no configurado.');
const pool=createDatabase(env.DATABASE_URL);
try{await migrateDatabase(pool);const service=new AccessControl(pool,env.LOCAL_COMMANDER_ID,'shared',async()=>{});const invite=await service.invite('admin',env.LOCAL_COMMANDER_ID);console.log('Código de recuperación de un uso, válido 24 horas. Guárdalo como una contraseña:\n'+invite.code);}finally{await pool.end();}
