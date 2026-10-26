export interface Backup { id: string; createdAt: string; verifiedAt: string | null; database: string; bytes: number; sha256: string; tableCount: number }
export interface BackupStatus { enabled: boolean; intervalHours: number; keep: number; directory: string; busy: boolean; stage: string; lastError: string; nextAt: string | null; backups: Backup[] }
export async function maintenance<T>(suffix = '', action = false): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/maintenance/backups${suffix}`, action ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(240000) } : { signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error('No se pudo consultar el respaldo. Actualiza para comprobar si la operación terminó.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'No se pudo completar el mantenimiento.');
  return data as T;
}
