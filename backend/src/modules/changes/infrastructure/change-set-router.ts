import { Router,json } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { ChangeSetService } from '../application/change-set-service.js';
import { HttpError } from '../../../shared/http-error.js';
export function createChangeSetRouter(service: ChangeSetService,origins: string[]) {
  const router = Router();
  router.use('/projects/:id/change-sets',json({limit:'100kb'}));
  const id = (value: unknown) => { const parsed=z.uuid().safeParse(value); if (!parsed.success) throw new HttpError(400,'INVALID_ID','Identificador inválido.'); return parsed.data; };
  router.use('/projects/:id/change-sets',(req,res,next)=>{ res.set('Cache-Control','no-store'); if(req.method !== 'GET' && (!req.headers.origin || !origins.includes(req.headers.origin))) return next(new HttpError(403,'CHANGE_ORIGIN_DENIED','Revisa los cambios desde la consola local.')); next(); });
  router.get('/projects/:id/change-sets',async(req,res)=>{res.json({sets:await service.list(id(req.params.id))});});
  router.get('/projects/:id/change-sets/:setId',async(req,res)=>{res.json({set:await service.read(id(req.params.id),id(req.params.setId))});});
  router.post('/projects/:id/change-sets/document',async(req,res)=>{const input=z.object({requestId:z.uuid(),artifactId:z.uuid(),path:z.string().min(1).max(1000)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_DOCUMENT_SYNC','Selecciona un documento y ruta de destino.');res.json({set:await service.document(id(req.params.id),input.data)});});
  router.post('/projects/:id/change-sets',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
    const input=z.object({requestId:z.uuid(),instruction:z.string().trim().min(1).max(2500),files:z.array(z.object({path:z.string().min(1).max(1000),sha256:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict()).min(1).max(5)}).strict().safeParse(req.body);
    if(!input.success) throw new HttpError(400,'INVALID_CHANGE_SET','Selecciona entre uno y cinco archivos y describe el cambio.');
    res.json({set:await service.generate({...input.data,projectId:id(req.params.id)})});
  });
  for(const action of ['apply','revert'] as const) router.post(`/projects/:id/change-sets/:setId/${action}`,async(req,res)=>{const input=z.object({approvedHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_APPROVAL','Revisa el conjunto antes de aprobar.');res.json({set:await service.act(id(req.params.id),id(req.params.setId),action,input.data.approvedHash)});});
  router.post('/projects/:id/change-sets/:setId/reject',async(req,res)=>{if(!z.object({}).strict().safeParse(req.body).success)throw new HttpError(400,'INVALID_REQUEST','Petición inválida.');res.json({set:await service.reject(id(req.params.id),id(req.params.setId))});});
  return router;
}
