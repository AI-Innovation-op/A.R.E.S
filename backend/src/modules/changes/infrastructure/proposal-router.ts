import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { ProposalService } from '../application/proposal-service.js';
import { HttpError } from '../../../shared/http-error.js';
export function createProposalRouter(service: ProposalService, origins: string[]) {
  const router = Router();
  const id = (value: unknown) => { const result = z.uuid().safeParse(value); if (!result.success) throw new HttpError(400, 'INVALID_ID', 'Identificador inválido.'); return result.data; };
  router.use('/projects/:id/changes', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && (!req.headers.origin || !origins.includes(req.headers.origin))) return next(new HttpError(403, 'CHANGE_ORIGIN_DENIED', 'Revisa y aplica los cambios desde la consola local.'));
    next();
  });
  router.get('/projects/:id/changes', async (req, res) => { res.json({ proposals: await service.list(id(req.params.id)) }); });
  router.get('/projects/:id/changes/:proposalId', async (req, res) => { res.json({ proposal: await service.read(id(req.params.id), id(req.params.proposalId)) }); });
  router.post('/projects/:id/changes', rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'CHANGE_RATE_LIMIT', message: 'Espera un minuto antes de generar más propuestas.' } } }), async (req, res) => {
    const input = z.object({ requestId: z.uuid(), path: z.string().min(1).max(1000), sha256: z.string().regex(/^[a-f0-9]{64}$/), instruction: z.string().trim().min(1).max(2500) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_PROPOSAL_REQUEST', 'Selecciona un archivo y describe un cambio de hasta 2500 caracteres.');
    res.json({ proposal: await service.generate({ ...input.data, projectId: id(req.params.id) }) });
  });
  for (const action of ['apply','revert'] as const) router.post(`/projects/:id/changes/:proposalId/${action}`, async (req, res) => {
    const input = z.object({ approvedHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_APPROVAL', 'La operación requiere la huella del cambio revisado.');
    res.json({ proposal: await service[action](id(req.params.id), id(req.params.proposalId), input.data.approvedHash) });
  });
  router.post('/projects/:id/changes/:proposalId/reject', async (req, res) => {
    if (!z.object({}).strict().safeParse(req.body).success) throw new HttpError(400, 'INVALID_REQUEST', 'Descarta la propuesta sin enviar contenido adicional.');
    res.json({ proposal: await service.reject(id(req.params.id), id(req.params.proposalId)) });
  });
  return router;
}
