import { AccessControl } from '../../src/modules/access/access.js';
// Servidor exclusivo de pruebas: usa el HTTP real con un puerto Gemini simulado.
import { createApp } from '../../src/server.js';
import { SendMessage } from '../../src/modules/chat/application/send-message.js';
import { HttpError } from '../../src/shared/http-error.js';
import { ResearchService } from '../../src/modules/research/research.js';
import { LocalFiles } from '../../src/modules/workspace/infrastructure/local-files.js';
import { githubFixture } from './github.js';
import {PrototypeService} from '../../src/modules/prototypes/prototype-service.js';

const app = createApp({ access:new AccessControl(null,'00000000-0000-4000-8000-000000000001','local',async()=>{}),getSpec:async()=>({current:'Control del Documento',master:'Referencia de prueba'}),
  github: githubFixture(),
  prototypes:new PrototypeService(()=> 'fixture',text=>new LocalFiles([]).redact(text)),
  research:new ResearchService(()=>({research:async input=>({content:input.mode==='audio'?'Texto transcrito de prueba':input.mode==='image'?'# Imagen analizada\nEjemplo visual de prueba.':'# Investigación web\nResultado apoyado por una fuente de prueba.',sources:input.mode==='web'?[{uri:'https://example.com/docs',title:'Fuente de prueba'}]:[],provider:'gemini',model:'research-fixture',...(input.mode==='web'?{suggestions:'<div>Buscar en Google</div><script>alert(1)</script>'}:{})})}),new LocalFiles([])),
  allowedOrigins: ['http://127.0.0.1:5174'],
  checkDatabase: async () => {},
  configureGemini: async () => {}, // No valida claves reales ni escribe .env durante las pruebas.
  configureOpenRouter: async () => {},
  getProviderStatus: () => ({ gemini: { configured: true, model: 'gemini-test' }, openrouter: { configured: true, model: 'test/coder:free' } }),
  listOpenRouterModels: async () => [
    { id: 'test/coder:free', name: 'Test Coder', contextLength: 1000, inputPerMillion: 0, outputPerMillion: 0, free: true },
    { id: 'test/coder-paid', name: 'Test Paid', contextLength: 1000, inputPerMillion: 1, outputPerMillion: 2, free: false },
  ],
  sendMessage: new SendMessage({ generate: async (messages, task,options) => {
    const attribution = { provider: task === 'documentation' ? 'gemini' as const : 'openrouter' as const, model: task === 'documentation' ? 'gemini-test' : 'test/coder:free' };
    const last = messages.at(-1)?.content ?? '';
    if(last==='respuesta progresiva de prueba'){await options?.onDelta?.('Texto parcial');await new Promise(resolve=>setTimeout(resolve,1800));await options?.onDelta?.(' confirmado.');return{content:'Texto parcial confirmado.',sources:[],...attribution};}
    if (last === 'provocar error') throw new HttpError(502, 'GEMINI_UNAVAILABLE', 'Gemini no está disponible en esta prueba.');
    if (last.startsWith('Solicitud del módulo')) return { content: '# Borrador\n\nDocumento generado para revisión.', sources: [], ...attribution };
    return {
      content: `[🛡️ POSE 15: SANTUARIO | OJOS: [^ ^] | ESCUDO: DOCS]\n\n## Respuesta de prueba\n\nRecibí **${messages.length} mensajes**.\n\n<script>alert('xss')</script>`,
      sources: [{ uri: 'https://vuejs.org/guide/introduction', title: 'Documentación Vue' }],
      ...attribution,
    };
  } }),
});
const server = app.listen(3101, '127.0.0.1', () => console.log('Backend de pruebas en 3101'));
process.on('SIGTERM', () => { server.close(); });
