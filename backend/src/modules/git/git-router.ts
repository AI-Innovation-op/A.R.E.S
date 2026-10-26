import { Router,json } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { GitService } from './git-service.js';
import { HttpError } from '../../shared/http-error.js';
export function createGitRouter(service:GitService,origins:string[]){
 const router=Router();const head=z.string().regex(/^[a-f0-9]{40,64}$/).nullable();
 router.use('/projects/:id/git',json({limit:'100kb'}));
 const id=(value:unknown)=>{const parsed=z.uuid().safeParse(value);if(!parsed.success)throw new HttpError(400,'INVALID_ID','Proyecto inválido.');return parsed.data;};
 router.use('/projects/:id/git',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&(!req.headers.origin||!origins.includes(req.headers.origin)))return next(new HttpError(403,'GIT_ORIGIN_DENIED','Usa Git desde la consola local.'));next();});
 router.get('/projects/:id/git',async(req,res)=>{res.json(await service.status(id(req.params.id)));});
 router.post('/projects/:id/git/init',async(req,res)=>{if(!z.object({}).strict().safeParse(req.body).success)throw new HttpError(400,'INVALID_GIT_INPUT','Petición inválida.');res.json(await service.init(id(req.params.id)));});
 router.post('/projects/:id/git/branch',async(req,res)=>{const input=z.object({name:z.string().min(1).max(100),create:z.boolean(),head}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_GIT_INPUT','Rama inválida.');res.json(await service.branch(id(req.params.id),input.data.name,input.data.create,input.data.head));});
 router.post('/projects/:id/git/remote',async(req,res)=>{const input=z.object({url:z.string().max(1000),expectedRemote:z.string().max(2000)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_GIT_INPUT','Remoto inválido.');res.json(await service.remote(id(req.params.id),input.data.url,input.data.expectedRemote));});
 router.post('/projects/:id/git/commit',async(req,res)=>{const input=z.object({head,message:z.string().trim().min(1).max(2000),name:z.string().trim().regex(/^[^<>\r\n\0]{1,100}$/),email:z.email().max(200),files:z.array(z.object({path:z.string().min(1).max(1000),sha256:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict()).min(1).max(50)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_GIT_INPUT','Revisa la identidad, mensaje y archivos del commit.');res.json(await service.commit(id(req.params.id),input.data));});
 router.post('/projects/:id/git/publish',rateLimit({windowMs:60000,limit:3,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{const input=z.object({head:z.string().regex(/^[a-f0-9]{40,64}$/),remote:z.string().max(1000),base:z.string().min(1).max(100),title:z.string().trim().min(1).max(200),body:z.string().max(20000),confirmed:z.literal(true)}).strict().safeParse(req.body);if(!input.success)throw new HttpError(400,'INVALID_GIT_INPUT','Revisa y confirma la publicación de la rama y el PR.');res.json(await service.publish(id(req.params.id),input.data));});
 return router;
}
