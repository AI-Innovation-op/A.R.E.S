import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { MemoryService } from '../application/memory-service.js';
import { HttpError } from '../../../shared/http-error.js';
export function createMemoryRouter(service: MemoryService, origins: string[]) {
  const router = Router();
  const id = (value: unknown) => { const parsed = z.uuid().safeParse(value); if (!parsed.success) throw new HttpError(400, 'INVALID_PROJECT', 'Proyecto inválido.'); return parsed.data; };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/projects/:id/memory', async (req, res) => { res.json(await service.status(id(req.params.id))); });
  router.post('/projects/:id/memory/index', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'INDEX_RATE_LIMIT', message: 'Espera un minuto para continuar preparando la memoria.' } },
  }), async (req, res) => {
    if (!req.headers.origin || !origins.includes(req.headers.origin)) throw new HttpError(403, 'MEMORY_ORIGIN_DENIED', 'Prepara la memoria desde la consola local.');
    if (!z.object({}).strict().safeParse(req.body).success) throw new HttpError(400, 'INVALID_INDEX_REQUEST', 'La preparación no admite contenido ni claves del cliente.');
    res.json(await service.index(id(req.params.id)));
  });
  return router;
}
