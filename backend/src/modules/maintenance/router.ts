import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { BackupService } from './backups.js';
import { HttpError } from '../../shared/http-error.js';
export function createMaintenanceRouter(service: BackupService, origins: string[]) {
  const router = Router();
  router.use('/maintenance', (req, res, next) => { res.set('Cache-Control','no-store'); if (req.method !== 'GET' && (!req.headers.origin || !origins.includes(req.headers.origin))) return next(new HttpError(403,'MAINTENANCE_ORIGIN_DENIED','Usa mantenimiento desde la consola local.')); next(); });
  router.use('/maintenance', json({ limit: '4kb' }));
  router.post('/maintenance/backups{/:id/verify}', rateLimit({ windowMs: 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'BACKUP_RATE_LIMIT', message: 'Espera un minuto antes de volver a verificar respaldos.' } } }), (_req, _res, next) => next());
  router.get('/maintenance/backups', async (_req,res) => { res.json(await service.status()); });
  router.post('/maintenance/backups', async (req,res) => { if (!z.object({}).strict().safeParse(req.body).success) throw new HttpError(400,'INVALID_BACKUP_REQUEST','El respaldo no acepta rutas del cliente.'); res.json({ backup: await service.create() }); });
  router.post('/maintenance/backups/:id/verify', async (req,res) => { const id = z.uuid().safeParse(req.params.id); if (!id.success || !z.object({}).strict().safeParse(req.body).success) throw new HttpError(400,'INVALID_BACKUP','Respaldo inválido.'); res.json(await service.verify(id.data)); });
  return router;
}
