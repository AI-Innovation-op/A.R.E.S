import type {Pool} from 'pg';
import {HttpError} from '../../../shared/http-error.js';
import {PostgresLibrary} from '../infrastructure/postgres-library.js';
import type {LocalFiles} from '../../workspace/infrastructure/local-files.js';
import type {Provider} from '../../chat/domain/chat.js';
export class ConversationNotes {
  constructor(private readonly pool:Pool,private readonly owner:string,private readonly files:LocalFiles){}
  async save(conversationId:string,messageId:string){
    const result=await this.pool.query<{repository_id:string|null;content:string;question:string;provider:Provider|null;model:string|null;sources:{uri:string;title:string}[]}>(`SELECT c.repository_id,m.content,m.provider,m.model,m.sources,u.content AS question
      FROM conversations c JOIN messages m ON m.conversation_id=c.id
      JOIN messages u ON u.conversation_id=c.id AND u.request_id=m.request_id AND u.role='user'
      WHERE c.id=$1 AND c.commander_id=$2 AND m.id=$3 AND m.role='model'`,[conversationId,this.owner,messageId]);
    const row=result.rows[0];if(!row)throw new HttpError(404,'CONFIRMED_REPLY_NOT_FOUND','No se encontró una respuesta confirmada de esta conversación.');
    if(!row.repository_id)throw new HttpError(409,'NOTES_PROJECT_REQUIRED','Para documentar la conversación, vincúlala a un proyecto antes del primer mensaje.');
    if(!row.provider||!row.model)throw new HttpError(409,'NOTES_ATTRIBUTION_REQUIRED','La respuesta no tiene un proveedor confirmado.');
    const input={projectId:row.repository_id,requestId:messageId,module:'documentation' as const,format:'Nota de conversación',title:'Conversación · '+this.files.redact(row.question).replace(/\s+/g,' ').slice(0,70),context:`Copia de una respuesta confirmada. Conversación ${conversationId}; mensaje ${messageId}. No se generó documentación adicional ni se ejecutaron acciones.`};
    const library=new PostgresLibrary(this.pool,this.owner),existing=await library.prepare(input);if(existing)return existing;
    const answer=row.content.replace(/^\s*\[[^\r\n]*?\bPOSE\s+(?:[1-9]|1[0-6]):[^\r\n]*\]\s*(?:\r?\n|$)/u,'');
    const content=this.files.redact(`# Nota de conversación\n\nBorrador copiado del turno confirmado para revisión. Las propuestas del texto no son acciones ejecutadas.\n\n## Solicitud\n\n${row.question}\n\n## Respuesta\n\n${answer}`);
    if(content.length>1000000)throw new HttpError(413,'NOTES_TOO_LARGE','El turno es demasiado largo para guardarlo como un único borrador.');
    return library.commit(input,{content,sources:row.sources??[],provider:row.provider,model:row.model});
  }
}
