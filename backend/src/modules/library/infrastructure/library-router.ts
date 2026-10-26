import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { LibraryService } from '../application/library-service.js';
import { HttpError } from '../../../shared/http-error.js';

export function createLibraryRouter(service: LibraryService, allowedOrigins: string[]) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))) return next(new HttpError(403, 'LIBRARY_ORIGIN_DENIED', 'Modifica la biblioteca desde la consola local.'));
    next();
  });
  router.get('/projects', async (_req, res) => { res.json({ projects: await service.projects() }); });
  router.post('/projects', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(150) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_PROJECT', 'Introduce un nombre de proyecto de hasta 150 caracteres.');
    res.status(201).json({ project: await service.createProject(input.data.name) });
  });
  router.get('/artifacts', async (req, res) => {
    const query = z.object({ projectId: z.uuid(), module: z.enum(['documentation', 'audit', 'architecture']).optional(), before: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional() }).strict().safeParse(req.query);
    if (!query.success) throw new HttpError(400, 'INVALID_FILTER', 'Selecciona un proyecto y filtro válidos.');
    res.json(await service.list(query.data.projectId, query.data.module, query.data.before));
  });
  router.get('/artifacts/:id', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new HttpError(400, 'INVALID_ARTIFACT', 'Identificador de borrador inválido.');
    res.json({ artifact: await service.read(id.data) });
  });
  router.post('/artifacts/generate', rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes; espera un minuto.' } },
  }), async (req, res) => {
    const input = z.object({ projectId: z.uuid(), requestId: z.uuid(), module: z.enum(['documentation', 'audit', 'architecture']),
      format: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(255).optional(), context: z.string().trim().min(1).max(14000) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_ARTIFACT', 'Introduce un contexto y formato válidos para el borrador.');
    res.json({ artifact: await service.generate({ ...input.data, title: input.data.title ?? input.data.format }) });
  });
  return router;
}
