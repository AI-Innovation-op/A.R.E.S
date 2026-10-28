import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { SendMessage } from './modules/chat/application/send-message.js';
import { createChatRouter } from './modules/chat/infrastructure/chat-router.js';
import { HttpError } from './shared/http-error.js';
import { z } from 'zod';
import type { ChatStatus, GeminiSettings } from './config/gemini-settings.js';
import { openRouterKeySchema, openRouterModelSchema, type CatalogModel, type OpenRouterInput } from './config/openrouter-settings.js';
import type { Provider } from './modules/chat/domain/chat.js';
import type { ConversationService } from './modules/chat/application/conversation-service.js';
import { createHistoryRouter } from './modules/chat/infrastructure/history-router.js';
import type { LibraryService } from './modules/library/application/library-service.js';
import { createLibraryRouter } from './modules/library/infrastructure/library-router.js';
import type { MemoryService } from './modules/memory/application/memory-service.js';
import { createMemoryRouter } from './modules/memory/infrastructure/memory-router.js';
import type { WorkspaceService } from './modules/workspace/application/workspace-service.js';
import { createWorkspaceRouter } from './modules/workspace/infrastructure/workspace-router.js';
import type { ProposalService } from './modules/changes/application/proposal-service.js';
import { createProposalRouter } from './modules/changes/infrastructure/proposal-router.js';
import type { BackupService } from './modules/maintenance/backups.js';
import { createMaintenanceRouter } from './modules/maintenance/router.js';
import type { ChangeSetService } from './modules/changes/application/change-set-service.js';
import { createChangeSetRouter } from './modules/changes/infrastructure/change-set-router.js';
import type { GitService } from './modules/git/git-service.js';
import { createGitRouter } from './modules/git/git-router.js';
import type { DocumentManagement } from './modules/library/application/document-management.js';
import { createDocumentRouter } from './modules/library/infrastructure/document-router.js';
import type { CodeMemory } from './modules/memory/application/code-memory.js';
import { createCodeMemoryRouter } from './modules/memory/infrastructure/code-memory-router.js';
import type { ResearchService } from './modules/research/research.js';
import { createResearchRouter } from './modules/research/research-router.js';
import type { BioService } from './modules/bio/bio-service.js';
import { createBioRouter } from './modules/bio/bio-router.js';
import type { AccessControl } from './modules/access/access.js';
import { accessRouter } from './modules/access/router.js';
import { usageRouter,type UsageMeter } from './modules/access/usage.js';
import type {ConversationNotes} from './modules/library/application/conversation-notes.js';
import type { GitHubService } from './modules/github/github-service.js';
import { createGitHubRouter } from './modules/github/github-router.js';
import type {PrototypeService} from './modules/prototypes/prototype-service.js';
import {createPrototypeRouter} from './modules/prototypes/prototype-router.js';
import{previewPolicy}from'./modules/prototypes/manifest.js';
import{appVersion}from'../../packages/contracts/index.js';

export function createApp(dependencies: {
  sendMessage: SendMessage;
  allowedOrigins: string[];
  checkDatabase: () => Promise<void>;
  getChatStatus?: () => ChatStatus;
  configureGemini?: (settings: GeminiSettings) => Promise<void>;
  getProviderStatus?: () => Record<Provider, ChatStatus>;
  configureOpenRouter?: (settings: OpenRouterInput) => Promise<void>;
  listOpenRouterModels?: () => Promise<CatalogModel[]>;
  conversations?: ConversationService;
  beforeHistory?: () => Promise<void>;
  library?: LibraryService;
  conversationNotes?:ConversationNotes;
  github?: GitHubService;
  prototypes?:PrototypeService;
  memory?: MemoryService;
  workspace?: WorkspaceService;
  changes?: ProposalService;
  backups?: BackupService;
  changeSets?: ChangeSetService;
  git?: GitService;
  documents?:DocumentManagement;
  codeMemory?:CodeMemory;
  research?:ResearchService;
  bio?:BioService;
  access?:AccessControl;
  usage?:UsageMeter;
  isolatedRunner?:boolean;
  getSpec?:()=>Promise<{current:string;master:string}>;
  publicDirectory?:string;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), geolocation=(), microphone=(self)'});next();});
  app.use(cors({ origin(origin, callback) {
    if (!origin || dependencies.allowedOrigins.includes(origin)) callback(null, true);
    else callback(new HttpError(403, 'ORIGIN_DENIED', 'Origen no permitido.'));
  } }));
  if(dependencies.access){app.use('/api',dependencies.access.middleware(dependencies.allowedOrigins,dependencies.isolatedRunner===true));app.use('/api',accessRouter(dependencies.access));}
  if(dependencies.prototypes)app.get('/prototype-view/:token',rateLimit({windowMs:60000,limit:60}),async(req,res)=>{const artifact=dependencies.prototypes!.view(typeof req.params.token==='string'?req.params.token:'');res.removeHeader('X-Frame-Options');res.set({'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`${previewPolicy}; sandbox allow-scripts; frame-ancestors 'self'`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=()','Cross-Origin-Resource-Policy':'same-origin'}).send(artifact.runtime.content);});
  if(dependencies.usage)app.use('/api',usageRouter(dependencies.usage));
  if(dependencies.getSpec)app.get('/api/spec',async(_req,res)=>res.set('Cache-Control','no-store').json(await dependencies.getSpec!()));
  if(dependencies.conversationNotes)app.post('/api/conversations/:id/notes',express.json({limit:'2kb'}),async(req,res)=>{
    if(!req.headers.origin||!dependencies.allowedOrigins.includes(req.headers.origin))throw new HttpError(403,'NOTES_ORIGIN','Guarda notas desde la consola autorizada.');
    const id=z.uuid().safeParse(req.params.id),body=z.object({messageId:z.uuid()}).strict().safeParse(req.body);
    if(!id.success||!body.success)throw new HttpError(400,'INVALID_NOTES','Selecciona una respuesta confirmada.');
    res.set('Cache-Control','no-store').json({artifact:await dependencies.conversationNotes!.save(id.data,body.data.messageId)});
  });
  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', service: 'ares-backend',version:appVersion, chat: dependencies.getChatStatus?.() ?? { configured: true, model: '' }, providers: dependencies.getProviderStatus?.() });
  });
  if (dependencies.listOpenRouterModels) app.get('/api/models/openrouter', async (_req, res) => {
    res.json({ models: await dependencies.listOpenRouterModels!() });
  });
  if (dependencies.configureOpenRouter) {
    let saving = false;
    app.post('/api/setup/openrouter', rateLimit({ windowMs: 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
      message: { error: { code: 'SETUP_RATE_LIMIT', message: 'Espera un minuto antes de volver a configurar OpenRouter.' } },
    }), express.json({ limit: '4kb' }), async (req, res) => {
      if (!req.headers.origin || !dependencies.allowedOrigins.includes(req.headers.origin)) throw new HttpError(403, 'SETUP_ORIGIN_DENIED', 'Configura OpenRouter desde la consola local.');
      const result = z.object({ apiKey: openRouterKeySchema.optional(), model: openRouterModelSchema }).strict().safeParse(req.body);
      if (!result.success) throw new HttpError(400, 'INVALID_SETTINGS', 'Introduce una clave e identificador válidos de OpenRouter.');
      if (saving) throw new HttpError(409, 'SETUP_IN_PROGRESS', 'Ya hay una configuración de OpenRouter en proceso.');
      saving = true;
      try {
        await dependencies.configureOpenRouter!(result.data);
        res.set('Cache-Control', 'no-store').json({ status: 'configured', provider: 'openrouter', model: result.data.model });
      } finally { saving = false; }
    });
  }
  if (dependencies.configureGemini) {
    let saving = false;
    app.post('/api/setup/gemini', rateLimit({ windowMs: 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
      message: { error: { code: 'SETUP_RATE_LIMIT', message: 'Espera un minuto antes de volver a configurar Gemini.' } },
    }), express.json({ limit: '4kb' }), async (req, res) => {
      // Una página ajena no puede cambiar credenciales locales, ni mediante un formulario CSRF.
      if (!req.headers.origin || !dependencies.allowedOrigins.includes(req.headers.origin)) {
        throw new HttpError(403, 'SETUP_ORIGIN_DENIED', 'Configura Gemini desde la consola local de A.R.E.S.');
      }
      const result = z.object({ apiKey: z.string().trim().regex(/^[A-Za-z0-9._-]{20,200}$/), model: z.string().trim().regex(/^[A-Za-z0-9._/-]{1,100}$/) }).strict().safeParse(req.body);
      if (!result.success) throw new HttpError(400, 'INVALID_SETTINGS', 'Introduce una clave de Gemini y un identificador de modelo válidos.');
      if (saving) throw new HttpError(409, 'SETUP_IN_PROGRESS', 'Ya hay una configuración en proceso. Espera a que termine.');
      saving = true;
      try {
        await dependencies.configureGemini!(result.data);
        res.set('Cache-Control', 'no-store').json({ status: 'configured', model: result.data.model });
      } finally { saving = false; }
    });
  }
  app.get('/ready', async (_req, res) => {
    try {
      await dependencies.checkDatabase();
      res.json({ status: 'ready' });
    } catch {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'PostgreSQL no está disponible.');
    }
  });
  app.use('/api/chat', rateLimit({ windowMs: 60000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes; espera un minuto.' } },
  }), express.json({ limit: '300kb' }), createChatRouter(dependencies.sendMessage));
  if (dependencies.backups) app.use('/api', createMaintenanceRouter(dependencies.backups, dependencies.allowedOrigins));
  if (dependencies.research) app.use('/api',createResearchRouter(dependencies.research,dependencies.allowedOrigins));
  if (dependencies.github) app.use('/api',createGitHubRouter(dependencies.github, dependencies.allowedOrigins));
  if (dependencies.prototypes) app.use('/api',createPrototypeRouter(dependencies.prototypes, dependencies.allowedOrigins));
  if (dependencies.bio) app.use('/api',createBioRouter(dependencies.bio,dependencies.allowedOrigins));
  if (dependencies.conversations) app.use('/api/conversations', async (_req, _res, next) => {
    try { await dependencies.beforeHistory?.(); next(); }
    catch { next(new HttpError(503, 'HISTORY_UNAVAILABLE', 'El historial no está disponible. Inicia PostgreSQL con Docker y reintenta la conexión.')); }
  }, express.json({ limit: '100kb' }), createHistoryRouter(dependencies.conversations, dependencies.allowedOrigins));
  if (dependencies.changeSets) app.use('/api', createChangeSetRouter(dependencies.changeSets, dependencies.allowedOrigins));
  if (dependencies.git) app.use('/api', createGitRouter(dependencies.git,dependencies.allowedOrigins));
  if (dependencies.documents) app.use('/api',createDocumentRouter(dependencies.documents,dependencies.allowedOrigins));
  if (dependencies.codeMemory) app.use('/api',createCodeMemoryRouter(dependencies.codeMemory,dependencies.allowedOrigins));
  if (dependencies.library || dependencies.memory || dependencies.workspace || dependencies.changes) app.use('/api', async (_req, _res, next) => {
    try { await dependencies.beforeHistory?.(); next(); }
    catch { next(new HttpError(503, 'LIBRARY_UNAVAILABLE', 'La biblioteca no está disponible. Inicia PostgreSQL con Docker y reintenta.')); }
  }, express.json({ limit: '100kb' }), ...(dependencies.changes ? [createProposalRouter(dependencies.changes, dependencies.allowedOrigins)] : []), ...(dependencies.workspace ? [createWorkspaceRouter(dependencies.workspace, dependencies.allowedOrigins)] : []), ...(dependencies.memory ? [createMemoryRouter(dependencies.memory, dependencies.allowedOrigins)] : []), ...(dependencies.library ? [createLibraryRouter(dependencies.library, dependencies.allowedOrigins)] : []));
  if(dependencies.publicDirectory){app.use(express.static(dependencies.publicDirectory,{index:'index.html',setHeaders(res){res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' about:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-cache');}}));}
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.')));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    if (status === 400 || status === 413 || status === 415) {
      res.status(status).json({ error: { code: 'INVALID_BODY', message: 'Cuerpo JSON inválido, demasiado grande o codificación no admitida.' } });
      return;
    }
    console.error('Error interno al procesar una solicitud');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
  };
  app.use(errors);
  return app;
}
