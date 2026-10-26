import type { Pool,PoolClient } from 'pg';
import { HttpError } from '../../shared/http-error.js';
type Phase='IDLE'|'FOCUS'|'BREAK'|'PAUSED_FOCUS'|'PAUSED_BREAK';
interface Row{commander_id:string;enabled:boolean;focus_minutes:number;break_minutes:number;water_minutes:number;notifications:boolean;phase:Phase;ends_at:Date|null;remaining_seconds:number|null;water_at:Date|null;revision:number}
export interface BioSettings{revision:number;enabled:boolean;focusMinutes:number;breakMinutes:number;waterMinutes:number;notifications:boolean}
export type BioAction='start'|'pause'|'resume'|'break'|'finish'|'drink'|'stop';
export class BioService{
 constructor(private readonly pool:Pool,private readonly owner:()=>string,private readonly now:()=>number=Date.now){}
 private async ensure(client:Pool|PoolClient,owner:string){await client.query('INSERT INTO commanders(id) VALUES($1) ON CONFLICT DO NOTHING',[owner]);await client.query('INSERT INTO bio_preferences(commander_id) VALUES($1) ON CONFLICT DO NOTHING',[owner]);}
 private dto(row:Row){return{ownerId:row.commander_id,enabled:row.enabled,focusMinutes:row.focus_minutes,breakMinutes:row.break_minutes,waterMinutes:row.water_minutes,notifications:row.notifications,phase:row.phase,endsAt:row.ends_at?.toISOString()??null,remainingSeconds:row.remaining_seconds,waterAt:row.water_at?.toISOString()??null,revision:row.revision,serverNow:new Date(this.now()).toISOString()};}
 async status(){const owner=this.owner();await this.ensure(this.pool,owner);const row=(await this.pool.query<Row>('SELECT * FROM bio_preferences WHERE commander_id=$1',[owner])).rows[0]!;const events=(await this.pool.query<{action:string;created_at:Date}>('SELECT action,created_at FROM bio_actions WHERE commander_id=$1 ORDER BY created_at DESC LIMIT 12',[owner])).rows.map(event=>({action:event.action,createdAt:event.created_at.toISOString()}));return{...this.dto(row),events};}
 async configure(input:BioSettings){const owner=this.owner();await this.ensure(this.pool,owner);const result=await this.pool.query(`UPDATE bio_preferences SET enabled=$1,focus_minutes=$2,break_minutes=$3,water_minutes=$4,notifications=$5,phase=CASE WHEN $1 THEN phase ELSE 'IDLE' END,ends_at=CASE WHEN $1 THEN ends_at ELSE NULL END,remaining_seconds=CASE WHEN $1 THEN remaining_seconds ELSE NULL END,water_at=CASE WHEN NOT $1 THEN NULL WHEN water_at IS NOT NULL AND water_minutes<>$4 THEN $6::timestamptz+($4::text||' minutes')::interval ELSE water_at END,revision=revision+1 WHERE commander_id=$7 AND revision=$8 RETURNING commander_id`,[input.enabled,input.focusMinutes,input.breakMinutes,input.waterMinutes,input.notifications,new Date(this.now()).toISOString(),owner,input.revision]);if(!result.rows.length)throw new HttpError(409,'BIO_CHANGED','Tus preferencias cambiaron en otra pestaña. Actualiza antes de guardar.');return this.status();}
 async act(input:{action:BioAction;revision:number;requestId:string}){
  const owner=this.owner(),client=await this.pool.connect();
  try{await client.query('BEGIN');await this.ensure(client,owner);const row=(await client.query<Row>('SELECT * FROM bio_preferences WHERE commander_id=$1 FOR UPDATE',[owner])).rows[0]!;
   const previous=(await client.query<{action:string;revision:number}>('SELECT action,revision FROM bio_actions WHERE commander_id=$1 AND request_id=$2',[owner,input.requestId])).rows[0];
   if(previous){if(previous.action!==input.action||previous.revision!==input.revision)throw new HttpError(409,'BIO_REQUEST_MISMATCH','Este identificador ya se usó para otra acción.');await client.query('COMMIT');return this.status();}
   if(!row.enabled)throw new HttpError(409,'BIO_DISABLED','Activa Bio-Armadura antes de iniciar recordatorios.');if(row.revision!==input.revision)throw new HttpError(409,'BIO_CHANGED','El temporizador cambió. Actualiza su estado.');
   const now=this.now(),date=(minutes:number)=>new Date(now+minutes*60000),invalid=()=>new HttpError(409,'BIO_PHASE','Esta acción no corresponde al estado del temporizador.');
   switch(input.action){
    case'start':if(row.phase!=='IDLE')throw invalid();row.phase='FOCUS';row.ends_at=date(row.focus_minutes);row.remaining_seconds=null;row.water_at??=date(row.water_minutes);break;
    case'pause':if(!['FOCUS','BREAK'].includes(row.phase)||!row.ends_at)throw invalid();row.remaining_seconds=Math.max(0,Math.ceil((row.ends_at.getTime()-now)/1000));row.phase=row.phase==='FOCUS'?'PAUSED_FOCUS':'PAUSED_BREAK';row.ends_at=null;break;
    case'resume':if(!['PAUSED_FOCUS','PAUSED_BREAK'].includes(row.phase))throw invalid();row.phase=row.phase==='PAUSED_FOCUS'?'FOCUS':'BREAK';row.ends_at=new Date(now+(row.remaining_seconds??0)*1000);row.remaining_seconds=null;break;
    case'break':if(!['FOCUS','PAUSED_FOCUS'].includes(row.phase))throw invalid();row.phase='BREAK';row.ends_at=date(row.break_minutes);row.remaining_seconds=null;break;
    case'finish':if(!['BREAK','PAUSED_BREAK'].includes(row.phase))throw invalid();row.phase='IDLE';row.ends_at=null;row.remaining_seconds=null;break;
    case'drink':row.water_at=date(row.water_minutes);break;
    case'stop':row.phase='IDLE';row.ends_at=null;row.remaining_seconds=null;row.water_at=null;break;
   }
   await client.query('UPDATE bio_preferences SET phase=$1,ends_at=$2,remaining_seconds=$3,water_at=$4,revision=revision+1 WHERE commander_id=$5',[row.phase,row.ends_at,row.remaining_seconds,row.water_at,owner]);
   await client.query('INSERT INTO bio_actions(commander_id,request_id,action,revision) VALUES($1,$2,$3,$4)',[owner,input.requestId,input.action,input.revision]);
   await client.query("INSERT INTO agent_state_events(commander_id,stance,pose_number,trigger_source) VALUES($1,$2,$3,'BIO')",[owner,input.action==='stop'?'IDLE':'SHIELD',input.action==='stop'?1:14]);
   await client.query('DELETE FROM bio_actions WHERE commander_id=$1 AND request_id IN (SELECT request_id FROM bio_actions WHERE commander_id=$1 ORDER BY created_at DESC OFFSET 200)',[owner]);
   await client.query('COMMIT');return this.status();
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 }
}
