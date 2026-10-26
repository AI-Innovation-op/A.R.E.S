import { Router } from 'express';
import { z } from 'zod';
import type { SendMessage } from '../application/send-message.js';
import { HttpError } from '../../../shared/http-error.js';
import { generationResponse } from '../../../shared/stream-response.js';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(16000),
  task: z.enum(['programming', 'documentation', 'audit', 'architecture']).default('programming'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string().trim().min(1).max(16000),
  }).strict()).max(16).default([]),
}).strict().superRefine(({ history }, ctx) => {
  // El historial contiene turnos completos; el nuevo mensaje se añade después.
  if (history.length % 2 !== 0 || history.some((message, index) => message.role !== (index % 2 === 0 ? 'user' : 'model'))) {
    ctx.addIssue({ code: 'custom', path: ['history'], message: 'Se esperan pares user/model.' });
  }
});

export function createChatRouter(sendMessage: SendMessage) {
  const router = Router();
  router.post('/', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_REQUEST', 'Envía message y hasta 16 mensajes de historial en pares user/model.');
    await generationResponse(req,res,options=>sendMessage.execute(parsed.data.message,parsed.data.history,parsed.data.task,options));
  });
  return router;
}
