import pg from 'pg';

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
  });
  pool.on('error', () => console.error('Error de conexión PostgreSQL en segundo plano'));
  return pool;
}
