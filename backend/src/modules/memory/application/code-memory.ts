import type { Pool } from 'pg';
import type { WorkspaceService } from '../../workspace/application/workspace-service.js';
import type { LocalFiles } from '../../workspace/infrastructure/local-files.js';
import { chunkText,normalizedVector,EMBEDDING_MODEL,type Embeddings,type MemoryReference } from '../domain/memory.js';
import { HttpError } from '../../../shared/http-error.js';
export class CodeMemory {
 private active=new Set<string>();
 constructor(private readonly pool:Pool,private readonly owner:string,private readonly workspace:WorkspaceService,private readonly files:LocalFiles,private readonly embeddings:()=>Embeddings|null){}
 async list(project:string){
  const settings=await this.workspace.settings(project);
  const rows=(await this.pool.query<{id:string;workspace_path:string;file_path:string;source_hash:string;chunk_count:number;embedding_model:string;indexed_at:Date}>('SELECT f.* FROM code_memory_files f JOIN repositories r ON r.id=f.repository_id WHERE f.repository_id=$1 AND r.commander_id=$2 ORDER BY f.file_path',[project,this.owner])).rows;
  return Promise.all(rows.map(async row=>{let current=false;try{if(settings.path===row.workspace_path&&row.embedding_model===EMBEDDING_MODEL){const source=await this.files.read(row.workspace_path,row.file_path);current=!source.redacted&&source.sha256===row.source_hash;}}catch{}return{id:row.id,path:row.file_path,sha256:row.source_hash,chunks:row.chunk_count,indexedAt:row.indexed_at.toISOString(),current};}));
 }
 async index(project:string,input:{path:string;sha256:string}){
  if(this.active.has(project))throw new HttpError(409,'CODE_INDEX_BUSY','Ya se está preparando código de este proyecto.');this.active.add(project);
  try{
   const settings=await this.workspace.settings(project);if(!settings.path)throw new HttpError(409,'WORKSPACE_NOT_CONNECTED','Conecta una carpeta antes de indexar código.');
   const source=await this.files.read(settings.path,input.path);if(source.redacted||source.sha256!==input.sha256)throw new HttpError(409,'SOURCE_CHANGED','El archivo cambió o contiene valores sensibles. Vuelve a leerlo.');
   const gateway=this.embeddings();if(!gateway)throw new HttpError(503,'EMBEDDING_NOT_CONFIGURED','Configura Gemini para indexar código.');
   const chunks=chunkText(source.content);if(!chunks.length)throw new HttpError(400,'EMPTY_CODE','El archivo está vacío.');
   const existing=await this.list(project);if(existing.length>=50&&!existing.some(item=>item.path===source.path))throw new HttpError(413,'CODE_MEMORY_LIMIT','Se admiten hasta 50 archivos indexados por proyecto.');
   if(existing.some(item=>item.path===source.path&&item.current))return{files:existing};
   const vectors=await gateway.embed(chunks,'RETRIEVAL_DOCUMENT');if(vectors.length!==chunks.length)throw new HttpError(502,'INVALID_EMBEDDINGS','Cantidad inesperada de embeddings.');
   const latest=await this.files.read(settings.path,input.path);if(latest.sha256!==source.sha256||latest.redacted||(await this.workspace.settings(project)).path!==settings.path)throw new HttpError(409,'SOURCE_CHANGED','El archivo o carpeta cambió durante la indexación. No se guardó.');
   const client=await this.pool.connect();
   try{await client.query('BEGIN');await client.query('SELECT id FROM repositories WHERE id=$1 AND commander_id=$2 FOR UPDATE',[project,this.owner]);
    const row=(await client.query<{id:string}>(`INSERT INTO code_memory_files(repository_id,workspace_path,file_path,source_hash,content,embedding_model,chunk_count) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(repository_id,file_path) DO UPDATE SET workspace_path=EXCLUDED.workspace_path,source_hash=EXCLUDED.source_hash,content=EXCLUDED.content,embedding_model=EXCLUDED.embedding_model,chunk_count=EXCLUDED.chunk_count,indexed_at=NOW() RETURNING id`,[project,settings.path,source.path,source.sha256,source.content,gateway.model,chunks.length])).rows[0]!;
    await client.query('DELETE FROM code_memory_chunks WHERE file_id=$1',[row.id]);
    for(let number=0;number<chunks.length;number++)await client.query('INSERT INTO code_memory_chunks(file_id,chunk_number,chunk_text,embedding) VALUES($1,$2,$3,$4::vector)',[row.id,number,chunks[number],JSON.stringify(normalizedVector(vectors[number]!))]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
   return{files:await this.list(project)};
  }finally{this.active.delete(project);}
 }
 async remove(project:string,id:string){await this.workspace.settings(project);const result=await this.pool.query('DELETE FROM code_memory_files f USING repositories r WHERE f.repository_id=r.id AND r.id=$1 AND r.commander_id=$2 AND f.id=$3 RETURNING f.id',[project,this.owner,id]);if(!result.rows.length)throw new HttpError(404,'CODE_MEMORY_NOT_FOUND','No se encontró el archivo indexado.');return{files:await this.list(project)};}
 async search(project:string,model:string,vector:number[]):Promise<MemoryReference[]>{
  const current=(await this.list(project)).filter(item=>item.current).map(item=>item.id);if(!current.length)return[];
  const rows=(await this.pool.query<{id:string;file_path:string;source_hash:string;chunk_text:string;chunk_number:number;similarity:number}>(`SELECT f.id,f.file_path,f.source_hash,c.chunk_text,c.chunk_number,1-(c.embedding<=>$4::vector) AS similarity FROM code_memory_chunks c JOIN code_memory_files f ON f.id=c.file_id JOIN repositories r ON r.id=f.repository_id WHERE f.repository_id=$1 AND r.commander_id=$2 AND f.embedding_model=$3 AND f.id=ANY($5::uuid[]) AND 1-(c.embedding<=>$4::vector)>=0.4 ORDER BY c.embedding<=>$4::vector,f.id,c.chunk_number LIMIT 4`,[project,this.owner,model,JSON.stringify(normalizedVector(vector)),current])).rows;
  return rows.map((row,index)=>({label:'D'+(index+1),artifactId:row.id,title:row.file_path,excerpt:row.chunk_text,chunkNumber:row.chunk_number,similarity:Number(row.similarity),sourceKind:'code',filePath:row.file_path,sha256:row.source_hash}));
 }
}
