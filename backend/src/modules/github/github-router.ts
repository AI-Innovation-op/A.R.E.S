import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError } from '../../shared/http-error.js';
import type { GitHubService } from './github-service.js';

export function createGitHubRouter(service: GitHubService, origins: string[]) {
  const router = Router();
  router.use('/github', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.headers.origin || !origins.includes(req.headers.origin)) return next(new HttpError(403, 'GITHUB_ORIGIN', 'Abre la lectura desde la consola autorizada.'));
    next();
  }, rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'GITHUB_RATE_LIMIT', message: 'Espera un minuto antes de repetir las lecturas.' } } }), json({ limit: '8kb' }));
  const operations = {
    'pull-request':z.object({url:z.string().trim().max(350)}).strict(),
    inspect: z.object({ url: z.string().trim().max(300), ref: z.string().trim().min(1).max(180).regex(/^[^\u0000-\u0020\u007f]+$/).optional() }).strict(),
    read: z.object({ snapshotId: z.uuid(), paths: z.array(z.string().min(1).max(300)).min(1).max(8) }).strict(),
    analyze: z.object({ snapshotId: z.uuid(), readId: z.uuid(), requestId: z.uuid() }).strict(),
    save: z.object({ snapshotId: z.uuid(), reportId: z.uuid(), projectId: z.uuid() }).strict(),
  };
  for (const operation of ['pull-request','inspect', 'read', 'analyze', 'save'] as const) router.post(`/github/${operation}`, async (req, res) => {
    const parsed = operations[operation].safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'GITHUB_INPUT', 'Comprueba el repositorio, la revisión y los archivos seleccionados.');
    const controller = new AbortController(), close = () => controller.abort(); res.once('close', close);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(operation === 'analyze' ? 120000 : 30000)]);
    try {
      let result: unknown;
      if(operation==='pull-request'){const data=operations['pull-request'].parse(parsed.data);result=await service.inspectPullRequest(data.url,signal);}
      else if (operation === 'inspect') { const data = operations.inspect.parse(parsed.data); result = await service.inspect(data.url, data.ref, signal); }
      else if (operation === 'read') { const data = operations.read.parse(parsed.data); result = await service.read(data.snapshotId, data.paths, signal); }
      else if (operation === 'analyze') { const data = operations.analyze.parse(parsed.data); result = await service.analyze(data.snapshotId, data.readId, data.requestId, signal); }
      else { const data = operations.save.parse(parsed.data); result = { artifact: await service.save(data.snapshotId, data.reportId, data.projectId) }; }
      if (!res.destroyed) res.json(result);
    } catch (cause) {
      if (signal.aborted && !controller.signal.aborted) throw new HttpError(504, 'GITHUB_TIMEOUT', 'La operación agotó su tiempo. Puedes reintentar.');
      if (!controller.signal.aborted) throw cause;
    } finally { res.off('close', close); }
  });
  return router;
}
