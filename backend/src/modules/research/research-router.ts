import { Router,json } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { ResearchService } from './research.js';
import { HttpError } from '../../shared/http-error.js';
export function createResearchRouter(service:ResearchService,origins:string[]){const router=Router();router.use('/research',(req,res,next)=>{res.set('Cache-Control','no-store');if(!req.headers.origin||!origins.includes(req.headers.origin))return next(new HttpError(403,'RESEARCH_ORIGIN','Investiga desde la consola local.'));next();});
 router.post('/research',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{code:'RESEARCH_LIMIT',message:'Espera un minuto antes de volver a investigar.'}}}),json({limit:'6mb'}),async(req,res)=>{
  const query=z.string().trim().min(1).max(3000),parsed=z.discriminatedUnion('mode',[z.object({mode:z.literal('web'),query}).strict(),z.object({mode:z.literal('image'),query,image:z.object({mimeType:z.enum(['image/png','image/jpeg','image/webp']),data:z.string().min(1).max(5600000)}).strict()}).strict(),z.object({mode:z.literal('audio'),audio:z.object({mimeType:z.enum(['audio/webm','audio/ogg','audio/m4a','audio/wav']),data:z.string().min(1).max(2800000)}).strict()}).strict()]).safeParse(req.body);
  if(!parsed.success)throw new HttpError(400,'INVALID_RESEARCH','Introduce una consulta o medio admitido dentro del límite.');const controller=new AbortController(),close=()=>controller.abort();res.once('close',close);try{const result=await service.research(parsed.data,controller.signal);if(!res.destroyed)res.json(result);}finally{res.off('close',close);}
 });return router;}
