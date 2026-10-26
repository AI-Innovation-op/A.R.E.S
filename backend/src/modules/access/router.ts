import { Router,json } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AccessControl,currentActor,cookieName,sessionToken,secureOrigin } from './access.js';
import { HttpError } from '../../shared/http-error.js';
export function accessRouter(service:AccessControl){const router=Router();router.use('/access',json({limit:'4kb'}));const role=z.enum(['admin','editor','viewer']);const code=z.string().regex(/^[A-Za-z0-9_-]{43}$/);const parse=<T>(schema:z.ZodType<T>,body:unknown)=>{const result=schema.safeParse(body);if(!result.success)throw new HttpError(400,'INVALID_ACCESS','Revisa los datos de acceso.');return result.data;};
 router.get('/access/session',async(req,res)=>res.json({mode:service.mode,user:await service.identity(sessionToken(req))}));
 router.post('/access/redeem',rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{const secure=secureOrigin(req);const input=parse(z.object({code,name:z.string().trim().min(1).max(80)}).strict(),req.body);const raw=await service.redeem(input.code,input.name);res.cookie(cookieName,raw,{httpOnly:true,sameSite:'strict',secure,path:'/',maxAge:7*86400000}).json({ok:true});});
 router.post('/access/invites',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{secureOrigin(req);res.json(await service.invite(parse(z.object({role}).strict(),req.body).role,currentActor()!.id));});
 router.post('/access/enable',async(req,res)=>{const secure=secureOrigin(req);const raw=await service.enable(parse(z.object({recoveryToken:code}).strict(),req.body).recoveryToken);res.cookie(cookieName,raw,{httpOnly:true,sameSite:'strict',secure,path:'/',maxAge:7*86400000}).json({ok:true});});
 router.post('/access/users/:id/invite',async(req,res)=>{secureOrigin(req);const id=parse(z.uuid(),req.params.id);parse(z.object({}).strict(),req.body);res.json(await service.invite('viewer',currentActor()!.id,id));});
 router.get('/access/users',async(_req,res)=>res.json({users:await service.users()}));
 router.post('/access/users/:id',async(req,res)=>{const id=parse(z.uuid(),req.params.id),input=parse(z.object({role,disabled:z.boolean()}).strict(),req.body);await service.updateUser(id,input.role,input.disabled,currentActor()!.id);res.json({ok:true});});
 router.post('/access/logout',async(req,res)=>{await service.logout(sessionToken(req));res.clearCookie(cookieName,{path:'/',httpOnly:true,sameSite:'strict',secure:secureOrigin(req)}).json({ok:true});});return router;
}
