import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { WorkspaceService } from '../application/workspace-service.js';
import { scripts } from '../domain/workspace.js';
import { HttpError } from '../../../shared/http-error.js';
export function createWorkspaceRouter(service: WorkspaceService, origins: string[]) {
  const router = Router();
  const id = (value: unknown) => { const result = z.uuid().safeParse(value); if (!result.success) throw new HttpError(400, 'INVALID_ID', 'Identificador inválido.'); return result.data; };
  const directory = (value: unknown) => { const result = z.string().max(1000).default('').safeParse(value); if (!result.success) throw new HttpError(400, 'INVALID_PATH', 'Ruta inválida.'); return result.data; };
  router.use('/projects/:id/workspace', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && (!req.headers.origin || !origins.includes(req.headers.origin))) return next(new HttpError(403, 'WORKSPACE_ORIGIN_DENIED', 'Usa el repositorio desde la consola local.'));
    next();
  });
  router.get('/projects/:id/workspace', async (req, res) => { res.json(await service.settings(id(req.params.id))); });
  router.post('/projects/:id/workspace', async (req, res) => {
    const input = z.object({ path: z.string().trim().min(1).max(2000) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_PATH', 'Introduce una ruta local absoluta.');
    res.json(await service.connect(id(req.params.id), input.data.path));
  });
  router.get('/projects/:id/workspace/files', async (req, res) => { res.json(await service.list(id(req.params.id), directory(req.query.directory))); });
  router.get('/projects/:id/workspace/file', async (req, res) => { res.json({ file: await service.read(id(req.params.id), directory(req.query.path)) }); });
  router.get('/projects/:id/workspace/scripts', async (req, res) => { res.json(await service.preview(id(req.params.id), directory(req.query.directory))); });
  router.post('/projects/:id/workspace/architecture', rateLimit({ windowMs: 60000, limit: 20 }), async (req, res) => {
    const input = z.object({ files: z.array(z.object({ path: z.string().min(1).max(1000), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(50), aliases: z.array(z.object({ prefix: z.string().regex(/^[\w@#~-][\w@#~/-]*\/$/).max(80), directory: z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w./-]*$/).max(200) }).strict()).max(10).default([]) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_ARCHITECTURE_INPUT', 'Selecciona hasta 50 archivos y alias relativos válidos.');
    res.json(await service.architecture(id(req.params.id), input.data.files, input.data.aliases));
  });
  router.get('/projects/:id/workspace/runs', async (req, res) => { res.json({ runs: await service.runs(id(req.params.id)) }); });
  router.get('/projects/:id/workspace/runs/:runId', async (req, res) => { res.json({ run: await service.run(id(req.params.id), id(req.params.runId)) }); });
  router.post('/projects/:id/workspace/runs', rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'TOOL_RATE_LIMIT', message: 'Espera un minuto antes de ejecutar más comprobaciones.' } },
  }), async (req, res) => {
    const input = z.object({ requestId: z.uuid(), directory: z.string().max(1000).default(''), script: z.enum(scripts), manifestHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_RUN', 'Selecciona un script y su versión; no se admiten comandos arbitrarios.');
    res.status(202).json({ run: await service.execute({ ...input.data, projectId: id(req.params.id) }) });
  });
  router.post('/projects/:id/workspace/runs/:runId/cancel', async (req, res) => { res.json({ run: await service.cancel(id(req.params.id), id(req.params.runId)) }); });
  return router;
}
