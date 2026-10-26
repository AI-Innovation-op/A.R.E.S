import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { ConversationService } from '../application/conversation-service.js';
import { HttpError } from '../../../shared/http-error.js';
import { generationResponse } from '../../../shared/stream-response.js';

export function createHistoryRouter(service: ConversationService, allowedOrigins: string[]) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, _res, next) => {
    // El historial es local y de un único comandante; protege escrituras frente a páginas ajenas.
    if (req.method !== 'GET' && (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))) {
      return next(new HttpError(403, 'HISTORY_ORIGIN_DENIED', 'Modifica el historial desde la consola local.'));
    }
    next();
  });
  const id = (value: unknown) => {
    const result = z.uuid().safeParse(value);
    if (!result.success) throw new HttpError(400, 'INVALID_CONVERSATION', 'Identificador de conversación inválido.');
    return result.data;
  };
  router.get('/', async (_req, res) => { res.json({ conversations: await service.list() }); });
  router.post('/', async (req, res) => {
    const input = z.object({ title: z.string().trim().min(1).max(200).default('Nueva conversación'), projectId: z.uuid().optional() }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_CONVERSATION', 'Introduce un título válido.');
    res.status(201).json({ conversation: await service.create(input.data.title, input.data.projectId) });
  });
  router.get('/:id', async (req, res) => {
    const before = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().safeParse(req.query.before);
    if (!before.success) throw new HttpError(400, 'INVALID_CURSOR', 'Cursor de mensajes inválido.');
    res.json(await service.read(id(req.params.id), before.data));
  });
  router.post('/:id/messages', rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes; espera un minuto.' } },
  }), async (req, res) => {
    const input = z.object({ requestId: z.uuid(), revision: z.number().int().nonnegative(), task: z.enum(['programming', 'documentation', 'audit', 'architecture']), message: z.string().trim().min(1).max(16000), useMemory: z.boolean().default(false),
      files: z.array(z.object({ path: z.string().min(1).max(1000), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(3).default([]), runIds: z.array(z.uuid()).max(1).default([]),
    }).strict().safeParse(req.body);
    if (!input.success) throw new HttpError(400, 'INVALID_REQUEST', 'Envío de conversación inválido.');
    const conversationId=id(req.params.id);
    await generationResponse(req,res,options=>service.send({...input.data,conversationId},options));
  });
  return router;
}
