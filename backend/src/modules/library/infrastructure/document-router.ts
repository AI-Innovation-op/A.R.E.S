import { Router,json } from 'express';
import { z } from 'zod';
import type { DocumentManagement } from '../application/document-management.js';
import { HttpError } from '../../../shared/http-error.js';
export function createDocumentRouter(service:DocumentManagement,origins:string[]){
 const router=Router(),id=(value:unknown)=>{const parsed=z.uuid().safeParse(value);if(!parsed.success)throw new HttpError(400,'INVALID_ARTIFACT','Documento inválido.');return parsed.data;};
 router.use('/artifacts/:id/manage',json({limit:'200kb'}));
 router.use('/artifacts/:id/manage',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&(!req.headers.origin||!origins.includes(req.headers.origin)))return next(new HttpError(403,'DOCUMENT_ORIGIN','Modifica documentos desde la consola local.'));next();});
 router.get('/artifacts/:id/manage/revisions',async(req,res)=>{res.json({revisions:await service.revisions(id(req.params.id))});});
 for(const action of ['edit','approve','delete'] as const)router.post(`/artifacts/:id/manage/${action}`,async(req,res)=>{
  const input=z.object({revision:z.number().int().nonnegative(),title:z.string().trim().min(1).max(255).optional(),content:z.string().min(1).max(60000).refine(value=>!!value.trim()).optional()}).strict().safeParse(req.body);
  if(!input.success)throw new HttpError(400,'INVALID_DOCUMENT_CHANGE','Revisa el título, contenido y versión del documento.');
  if(action==='edit'?(typeof input.data.content!=='string'||typeof input.data.title!=='string'):(input.data.content!==undefined||input.data.title!==undefined))throw new HttpError(400,'INVALID_DOCUMENT_CHANGE','Contenido inesperado para esta operación.');
  res.json(await service.change(id(req.params.id),input.data.revision,action,typeof input.data.content==='string'&&typeof input.data.title==='string'?{title:input.data.title,content:input.data.content}:undefined));
 });return router;
}
