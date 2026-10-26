import { Router,json } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { CodeMemory } from '../application/code-memory.js';
import { HttpError } from '../../../shared/http-error.js';
export function createCodeMemoryRouter(service:CodeMemory,origins:string[]){const router=Router();const id=(value:unknown)=>{const parsed=z.uuid().safeParse(value);if(!parsed.success)throw new HttpError(400,'INVALID_PROJECT','Proyecto inválido.');return parsed.data;};
 router.use('/projects/:id/memory/code',json({limit:'4kb'}));
 router.use('/projects/:id/memory/code',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&(!req.headers.origin||!origins.includes(req.headers.origin)))return next(new HttpError(403,'CODE_INDEX_ORIGIN','Prepara código desde la consola local.'));next();});
 router.get('/projects/:id/memory/code',async(req,res)=>{res.json({files:await service.list(id(req.params.id))});});
 router.post('/projects/:id/memory/code',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{const input=z.object({path:z.string().min(1).max(1000),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_CODE_INDEX','Selecciona un archivo leído y su versión.');res.json(await service.index(id(req.params.id),input.data));});
 router.post('/projects/:id/memory/code/remove',async(req,res)=>{const input=z.object({id:z.uuid()}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_CODE_INDEX','Selecciona un archivo indexado.');res.json(await service.remove(id(req.params.id),input.data.id));});return router;
}
