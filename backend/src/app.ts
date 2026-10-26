import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envFile, loadEnv } from './config/env.js';
import { saveGeminiSettings, validateGemini } from './config/gemini-settings.js';
import { listOpenRouterModels, saveOpenRouterSettings, validateOpenRouter } from './config/openrouter-settings.js';
import { createDatabase } from './config/db.js';
import { migrateDatabase } from './config/migrations.js';
import { PostgresHistory } from './modules/chat/infrastructure/postgres-history.js';
import { ConversationService } from './modules/chat/application/conversation-service.js';
import { SendMessage } from './modules/chat/application/send-message.js';
import { GeminiAdapter } from './modules/chat/infrastructure/gemini-adapter.js';
import { OpenRouterAdapter } from './modules/chat/infrastructure/openrouter-adapter.js';
import { RoutedGateway, type ProviderSlot } from './modules/chat/infrastructure/routed-gateway.js';
import type { Provider } from './modules/chat/domain/chat.js';
import { HttpError } from './shared/http-error.js';
import { createApp } from './server.js';
import { LibraryService } from './modules/library/application/library-service.js';
import { PostgresLibrary } from './modules/library/infrastructure/postgres-library.js';
import { PostgresMemory } from './modules/memory/infrastructure/postgres-memory.js';
import { MemoryService } from './modules/memory/application/memory-service.js';
import { GeminiEmbeddings } from './modules/memory/infrastructure/gemini-embeddings.js';
import { LocalFiles } from './modules/workspace/infrastructure/local-files.js';
import { findNpmCli, LocalRunner } from './modules/workspace/infrastructure/local-runner.js';
import { PostgresWorkspace } from './modules/workspace/infrastructure/postgres-workspace.js';
import { WorkspaceService } from './modules/workspace/application/workspace-service.js';
import { ProposalService } from './modules/changes/application/proposal-service.js';
import { PostgresProposals } from './modules/changes/infrastructure/postgres-proposals.js';
import { setupBackups } from './modules/maintenance/setup.js';
import { ChangeSetService } from './modules/changes/application/change-set-service.js';
import { PostgresChangeSets } from './modules/changes/infrastructure/postgres-change-sets.js';
import { GitService } from './modules/git/git-service.js';
import { DocumentManagement } from './modules/library/application/document-management.js';
import { CodeMemory } from './modules/memory/application/code-memory.js';
import { GeminiResearch,ResearchService } from './modules/research/research.js';
import { BioService } from './modules/bio/bio-service.js';
import { AccessControl,currentActor } from './modules/access/access.js';
import { UsageMeter,MeteredGateway,MeteredEmbeddings,MeteredResearch } from './modules/access/usage.js';
import { writeProviderSettings } from './config/settings-file.js';
import { DockerRunner,findDocker } from './modules/workspace/infrastructure/docker-runner.js';
import {ConversationNotes} from './modules/library/application/conversation-notes.js';

const env = loadEnv();
const prompt = await readFile(new URL('../prompts/ares-system-prompt.md', import.meta.url), 'utf8');
const database = env.DATABASE_URL ? createDatabase(env.DATABASE_URL) : null;
const accessControl=new AccessControl(database,env.LOCAL_COMMANDER_ID,env.ARES_ACCESS_MODE,()=>writeProviderSettings(envFile,{ARES_ACCESS_MODE:'shared'}));
const usage=new UsageMeter(database,env.LOCAL_COMMANDER_ID);
const backups = database ? setupBackups(database, env) : undefined;
let openRouterKey = env.OPENROUTER_API_KEY;
let geminiKey = env.GEMINI_API_KEY;
let embeddings = env.GEMINI_API_KEY ? new MeteredEmbeddings(new GeminiEmbeddings(env.GEMINI_API_KEY),usage) : null;
const providers: Record<Provider, ProviderSlot> = {
  gemini: { model: env.GEMINI_MODEL, gateway: env.GEMINI_API_KEY ? new GeminiAdapter(env.GEMINI_API_KEY, env.GEMINI_MODEL, prompt, env.GEMINI_TIMEOUT_MS, env.GEMINI_THINKING_LEVEL) : null },
  openrouter: { model: env.OPENROUTER_MODEL, gateway: env.OPENROUTER_API_KEY ? new OpenRouterAdapter(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL, prompt, env.OPENROUTER_TIMEOUT_MS, env.OPENROUTER_MAX_TOKENS) : null },
};
const status = (provider: Provider) => ({ configured: providers[provider].gateway !== null, model: providers[provider].model });
const routed = new RoutedGateway(provider => ({...providers[provider],gateway:providers[provider].gateway?new MeteredGateway(providers[provider].gateway!,usage,provider):null}));
let schemaReady = false;
if (database && env.DATABASE_AUTO_MIGRATE) {
  try { await migrateDatabase(database); schemaReady = true; }
  catch { console.log('PostgreSQL pendiente: el chat continúa en modo sesión hasta conectar la base.'); }
}
const installation=env.ARES_SERVE_FRONTEND?path.dirname(fileURLToPath(envFile)):path.dirname(path.dirname(fileURLToPath(envFile)));
const files = new LocalFiles(env.ARES_WORKSPACE_ROOTS?.split(';').map(root => root.trim()).filter(Boolean) ?? [installation], () => [geminiKey, openRouterKey],()=>accessControl.mode==='shared'?[installation]:[]);
const workspaceRepository = database ? new PostgresWorkspace(database, env.LOCAL_COMMANDER_ID) : undefined;
const runner=env.ARES_RUNNER_MODE==='docker'?new DockerRunner(await findDocker(),files):new LocalRunner(await findNpmCli(),text=>files.redact(text));
const workspace = workspaceRepository ? new WorkspaceService(workspaceRepository, files, runner) : undefined;
const codeMemory=database&&workspace?new CodeMemory(database,env.LOCAL_COMMANDER_ID,workspace,files,()=>embeddings):undefined;
const memory=database?new MemoryService(new PostgresMemory(database,env.LOCAL_COMMANDER_ID),()=>embeddings,codeMemory):undefined;
if (schemaReady) await workspaceRepository?.interrupt();
let recoveredWorkspace = schemaReady;
let recoveringWorkspace: Promise<void> | undefined;
const history = database ? new ConversationService(new PostgresHistory(database, env.LOCAL_COMMANDER_ID), routed, memory, workspace) : undefined;
let preparing: Promise<void> | undefined;
async function ensureHistory() {
  if (!database) throw new Error('PostgreSQL no configurado');
  if (!schemaReady && env.DATABASE_AUTO_MIGRATE) {
    preparing ??= migrateDatabase(database).then(() => { schemaReady = true; }).finally(() => { preparing = undefined; });
    await preparing;
  }
  await database.query('SELECT revision FROM conversations LIMIT 0');
  await database.query('SELECT technical_document_id FROM module_artifacts LIMIT 0');
  await database.query('SELECT chunk_count FROM artifact_memory LIMIT 0');
  await database.query('SELECT manifest_hash FROM tool_runs LIMIT 0');
  await database.query('SELECT before_hash FROM change_proposals LIMIT 0');
  if (!recoveredWorkspace && workspaceRepository) {
    recoveringWorkspace ??= workspaceRepository.interrupt().then(() => { recoveredWorkspace = true; }).finally(() => { recoveringWorkspace = undefined; });
    await recoveringWorkspace;
  }
}
const app = createApp({
  access:accessControl,usage,isolatedRunner:runner.isolation==='docker',
  getSpec:async()=>({current:await readFile(new URL('../../ESTADO-ACTUAL.md',import.meta.url),'utf8'),master:await readFile(new URL('../../ficha_tecnica_maestra_ARES_v2.6.md',import.meta.url),'utf8')}),
  publicDirectory:env.ARES_SERVE_FRONTEND?fileURLToPath(new URL('../public/',import.meta.url)):undefined,
  bio:database?new BioService(database,()=>currentActor()?.id??env.LOCAL_COMMANDER_ID):undefined,
  research:new ResearchService(()=>geminiKey?new MeteredResearch(new GeminiResearch(geminiKey,providers.gemini.model),usage):null,files),
  documents:database?new DocumentManagement(database,env.LOCAL_COMMANDER_ID,files):undefined,
  conversationNotes:database?new ConversationNotes(database,env.LOCAL_COMMANDER_ID,files):undefined,
  codeMemory,
  git: workspace ? new GitService(workspace,files) : undefined,
  changeSets: database && workspace ? new ChangeSetService(new PostgresChangeSets(database, env.LOCAL_COMMANDER_ID), workspace, files, routed, new PostgresLibrary(database, env.LOCAL_COMMANDER_ID)) : undefined,
  backups,
  sendMessage: new SendMessage(routed),
  conversations: history,
  memory,
  workspace,
  changes: database && workspace ? new ProposalService(new PostgresProposals(database, env.LOCAL_COMMANDER_ID), workspace, files, routed) : undefined,
  library: database ? new LibraryService(new PostgresLibrary(database, env.LOCAL_COMMANDER_ID), routed) : undefined,
  beforeHistory: ensureHistory,
  allowedOrigins: env.CORS_ORIGINS,
  checkDatabase: async () => {
    await ensureHistory();
  },
  getChatStatus: () => status('openrouter'),
  getProviderStatus: () => ({ gemini: status('gemini'), openrouter: status('openrouter') }),
  listOpenRouterModels,
  configureGemini: async settings => {
    await validateGemini(settings);
    await saveGeminiSettings(envFile, settings);
    providers.gemini = { gateway: new GeminiAdapter(settings.apiKey, settings.model, prompt, env.GEMINI_TIMEOUT_MS, env.GEMINI_THINKING_LEVEL), model: settings.model };
    embeddings = new MeteredEmbeddings(new GeminiEmbeddings(settings.apiKey),usage);
    geminiKey = settings.apiKey;
  },
  configureOpenRouter: async settings => {
    const apiKey = settings.apiKey ?? openRouterKey;
    if (!apiKey) throw new HttpError(400, 'OPENROUTER_NOT_CONFIGURED', 'Introduce tu clave de OpenRouter para guardar el modelo.');
    await validateOpenRouter({ apiKey, model: settings.model });
    await saveOpenRouterSettings(envFile, { apiKey, model: settings.model });
    providers.openrouter = { gateway: new OpenRouterAdapter(apiKey, settings.model, prompt, env.OPENROUTER_TIMEOUT_MS, env.OPENROUTER_MAX_TOKENS), model: settings.model };
    openRouterKey = apiKey;
  },
});
const server = app.listen(env.PORT, env.HOST, () => {
  backups?.start();
  console.log(`A.R.E.S. disponible en http://${env.HOST}:${env.PORT}`);
  if (!providers.gemini.gateway || !providers.openrouter.gateway) console.log('Hay proveedores pendientes: abre Conexiones IA en la consola.');
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  server.close(() => {
    void Promise.all([workspace?.shutdown(),backups?.stop()]).finally(() => database?.end()).then(() => { clearTimeout(deadline); }, () => process.exit(1));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
