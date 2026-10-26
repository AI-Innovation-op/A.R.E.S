import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { testDatabase } from './database.js';
import { AccessControl,asActor } from '../../src/modules/access/access.js';
import { UsageMeter } from '../../src/modules/access/usage.js';
import { createApp } from '../../src/server.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
test('acceso compartido: sesión HttpOnly, un uso, roles, revocación, origen y recuperación',async()=>{
 const pool=await testDatabase(),owner=randomUUID(),ids=[owner],origin='http://127.0.0.1:5174';let saved=0;
 const access=new AccessControl(pool,owner,'local',async()=>{saved++;});const app=createApp({access,isolatedRunner:false,allowedOrigins:[origin,'http://remote.example'],checkDatabase:async()=>{},getSpec:async()=>({current:'privado',master:'privado'}),sendMessage:new SendMessage({generate:async()=>({content:'ok',sources:[]})})});
 try{const recovery=await access.invite('admin',owner);await request(app).post('/api/access/enable').set('Origin',origin).send({recoveryToken:'x'.repeat(43)}).expect(400);const enabled=await request(app).post('/api/access/enable').set('Origin',origin).send({recoveryToken:recovery.code}).expect(200);assert.equal(saved,1);const cookie=enabled.headers['set-cookie'][0].split(';')[0];assert.match(enabled.headers['set-cookie'][0],/HttpOnly/);assert.match(enabled.headers['set-cookie'][0],/SameSite=Strict/);
  await request(app).get('/api/spec').expect(401);await request(app).get('/api/spec').set('Cookie',cookie).expect(200);await request(app).post('/api/access/invites').set('Cookie',cookie).send({role:'editor'}).expect(403);
  const invite=(await request(app).post('/api/access/invites').set('Origin',origin).set('Cookie',cookie).send({role:'viewer'}).expect(200)).body.code;
  await request(app).post('/api/access/redeem').set('Origin','http://remote.example').send({code:invite,name:'Lector'}).expect(403);
  const signed=await request(app).post('/api/access/redeem').set('Origin',origin).send({code:invite,name:'Lector'}).expect(200);const viewerCookie=signed.headers['set-cookie'][0].split(';')[0];const actor=(await request(app).get('/api/access/session').set('Cookie',viewerCookie)).body.user;ids.push(actor.id);assert.equal(actor.role,'viewer');
  await request(app).post('/api/access/redeem').set('Origin',origin).send({code:invite,name:'Duplicado'}).expect(401);await request(app).get('/api/spec').set('Cookie',viewerCookie).expect(200);await request(app).get('/api/access/users').set('Cookie',viewerCookie).expect(403);await request(app).post('/api/chat').set('Origin',origin).set('Cookie',viewerCookie).send({message:'hola',history:[]}).expect(403);
  await request(app).post('/api/access/users/'+owner).set('Origin',origin).set('Cookie',cookie).send({role:'viewer',disabled:true}).expect(409);await request(app).post('/api/access/users/'+actor.id).set('Origin',origin).set('Cookie',cookie).send({role:'viewer',disabled:true}).expect(200);await request(app).get('/api/spec').set('Cookie',viewerCookie).expect(401);
  const editorInvite=await access.invite('editor',owner),editorToken=await access.redeem(editorInvite.code,'Editor'),editor=await access.identity(editorToken);ids.push(editor!.id);await request(app).post('/api/projects/'+randomUUID()+'/workspace/runs').set('Origin',origin).set('Cookie','ares_session='+editorToken).send({}).expect(403);
  const restore=await access.redeem(recovery.code,'Recuperación'),restored=await access.identity(restore);ids.push(restored!.id);assert.equal(restored?.role,'admin');await access.logout(restore);assert.equal(await access.identity(restore),null);
  const rows=await pool.query('SELECT hash FROM access_sessions WHERE user_id=$1',[owner]);assert.notEqual(rows.rows[0].hash,cookie.split('=')[1]);
  const renewal=await access.invite('viewer',owner,editor!.id);const renewed=await access.redeem(renewal.code,'No reemplaza identidad');assert.deepEqual(await access.identity(renewed),editor);await request(app).post('/api/usage/POLICY/').set('Origin',origin).set('Cookie','ares_session='+renewed).send({}).expect(403);
  const expired=await access.invite('viewer',owner);await pool.query("UPDATE access_invites SET expires_at=now()-interval '1 second' WHERE created_by=$1 AND redeemed_at IS NULL",[owner]);await assert.rejects(access.redeem(expired.code,'Caducado'),/caducó/);
 }finally{await pool.query('DELETE FROM commanders WHERE id=ANY($1::uuid[])',[ids]);await pool.end();}
});
test('consumo SQL reserva concurrentemente, cuenta fallos, separa usuarios y reinicia por día UTC',async()=>{
 const pool=await testDatabase(),owner=randomUUID(),other=randomUUID();let now=Date.parse('2090-01-01T12:00:00Z');const meter=new UsageMeter(pool,owner,()=>now);const previous=await meter.policy();let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;});
 try{await meter.configure({dailyCalls:3,userCalls:2,dailyBytes:1000,concurrency:1});let started!:()=>void;const begun=new Promise<void>(resolve=>{started=resolve;});const running=meter.run('gemini','test',100,async()=>{started();await waiting;return'complete';});await begun;await assert.rejects(meter.run('gemini','test',100,async()=>0),/en curso/);release();assert.equal(await running,'complete');await assert.rejects(meter.run('gemini','test',100,async()=>{throw new Error('provider failed');}),/provider failed/);await assert.rejects(meter.run('gemini','test',100,async()=>0),/límite diario/);
  await asActor({id:other,name:'Otro',role:'editor'},()=>meter.run('openrouter','test',100,async()=>0));assert.equal((await meter.status()).calls,2);await assert.rejects(asActor({id:other,name:'Otro',role:'editor'},()=>meter.run('gemini','test',100,async()=>0)),/límite diario/);now+=86400000;assert.equal((await meter.status()).calls,0);await assert.rejects(meter.run('gemini','test',1001,async()=>0),/límite diario/);await meter.run('gemini','test',100,async()=>0);
 }finally{release();await meter.configure(previous);await pool.query('DELETE FROM usage_requests WHERE actor=ANY($1::uuid[])',[[owner,other]]);await pool.end();}
});
