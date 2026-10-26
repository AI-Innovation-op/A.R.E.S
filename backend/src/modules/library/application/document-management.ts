import type { Pool } from 'pg';
import { HttpError } from '../../../shared/http-error.js';
import type { LocalFiles } from '../../workspace/infrastructure/local-files.js';
export class DocumentManagement {
 constructor(private readonly pool:Pool,private readonly owner:string,private readonly files:LocalFiles){}
 async change(id:string,revision:number,action:'edit'|'approve'|'delete',input?:{title:string;content:string}){
  if(input&&this.files.redact(input.title+'\n'+input.content)!==input.title+'\n'+input.content)throw new HttpError(400,'DOCUMENT_SECRET','Retira los valores sensibles antes de guardar el documento.');
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const row=(await client.query<{id:string;title:string;content:string;status:string;revision:number;technical_document_id:string|null}>('SELECT a.* FROM module_artifacts a JOIN repositories r ON r.id=a.repository_id WHERE a.id=$1 AND r.commander_id=$2 FOR UPDATE OF a',[id,this.owner])).rows[0];
   if(!row)throw new HttpError(404,'ARTIFACT_NOT_FOUND','No se encontró este documento.');
   if(row.revision!==revision)throw new HttpError(409,'DOCUMENT_CHANGED','El documento cambió. Recarga su versión antes de guardar.');
   if(action==='delete'){
    await client.query('DELETE FROM module_artifacts WHERE id=$1',[id]);if(row.technical_document_id)await client.query('DELETE FROM technical_documents WHERE id=$1',[row.technical_document_id]);
   }else{
    await client.query('INSERT INTO artifact_revisions(artifact_id,revision,title,content,status) VALUES($1,$2,$3,$4,$5)',[id,row.revision,row.title,row.content,row.status]);
    const title=input?.title??row.title,content=input?.content??row.content,status=action==='approve'?'APPROVED':'DRAFT';
    await client.query('UPDATE module_artifacts SET title=$1,content=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$4',[title,content,status,id]);
    if(row.technical_document_id)await client.query('UPDATE technical_documents SET title=$1,markdown_content=$2,status=$3,version=$4 WHERE id=$5',[title,content,status,'1.0.'+(row.revision+1),row.technical_document_id]);
    if(action==='edit'){await client.query('DELETE FROM artifact_memory WHERE artifact_id=$1',[id]);await client.query('DELETE FROM knowledge_embeddings WHERE artifact_id=$1',[id]);}
   }
   await client.query('COMMIT');return{status:action==='delete'?'deleted':'saved'};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 }
 async revisions(id:string){const owned=await this.pool.query('SELECT 1 FROM module_artifacts a JOIN repositories r ON r.id=a.repository_id WHERE a.id=$1 AND r.commander_id=$2',[id,this.owner]);if(!owned.rows.length)throw new HttpError(404,'ARTIFACT_NOT_FOUND','No se encontró este documento.');return(await this.pool.query('SELECT revision,title,content,status,saved_at AS "savedAt" FROM artifact_revisions WHERE artifact_id=$1 ORDER BY revision DESC LIMIT 20',[id])).rows;}
}
