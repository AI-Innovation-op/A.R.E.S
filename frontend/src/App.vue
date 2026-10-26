<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Terminal, Shield, Code2, GitBranch, FileText, FolderOpen, ChevronRight, Radio, RefreshCw, ExternalLink, X, Command, ArrowUpRight, CircleHelp, KeyRound, Menu } from '@lucide/vue';
import ChatWindow from './components/ChatWindow.vue';
import AvatarCanvas from './components/AvatarCompanion.vue';
import ModuleWorkbench from './components/ModuleWorkbench.vue';
import MarkdownContent from './components/MarkdownContent.vue';
import { useConsoleStore } from './stores/console';
import { useVoiceStore } from './stores/voice';
import { useConversationStore } from './stores/conversation';
import type { ModuleId } from './domain/modules';
import { checkConnection, type ConnectionStatus, type Provider } from './services/api';
import ConnectionSetup from './components/ConnectionSetup.vue';
import ArtifactLibrary from './components/ArtifactLibrary.vue';
import { useLibraryStore } from './stores/library';
import type { Artifact } from './services/library';
import WorkspacePanel from './components/WorkspacePanel.vue';
import MaintenancePanel from './components/MaintenancePanel.vue';
import type { SourceFile, ToolRun } from './services/workspace';
import AccessPanel from './components/AccessPanel.vue';
import { useAccessStore,accessRequest } from './stores/access';
import BioPanel from './components/BioPanel.vue';
import BioBanner from './components/BioBanner.vue';
import { useBioStore } from './stores/bio';
const store = useConsoleStore();
const library = useLibraryStore();
const bio=useBioStore();
const voice=useVoiceStore();
const conversationMode=useConversationStore();
watch(()=>store.completedReply,reply=>{if(reply&&!conversationMode.enabled)voice.readSummary(reply.content,'response-'+reply.id);});
watch(()=>store.pending,pending=>{if(pending)voice.stop();});
const access=useAccessStore(),masterSheet=ref(''),currentSheet=ref('');
watch(()=>[bio.noticeKey,store.pending] as const,([key,pending],[previous])=>{if(key&&!pending){store.setPose(14);bio.notify();}else if(previous&&!key&&!pending&&store.pose.id===14)store.setPose(1);});
const navigation = [
  { id: 'chat', title: 'Consola táctica', icon: Terminal, number: '01' },
  { id: 'documentation', title: 'Escudo Documental', icon: Shield, number: '02' },
  { id: 'audit', title: 'Espada Binaria', icon: Code2, number: '03' },
  { id: 'architecture', title: 'Arquitectura', icon: GitBranch, number: '04' },
  { id: 'library', title: 'Biblioteca', icon: FileText, number: '05' },
  { id: 'workspace', title: 'Repositorio', icon: FolderOpen, number: '06' },
  { id: 'spec', title: 'Ficha técnica', icon: FileText, number: '07' },
  { id: 'maintenance', title: 'Respaldos', icon: Shield, number: '08' },
  { id: 'bio', title: 'Bio-Armadura', icon: Shield, number: '09' },
  { id: 'access', title: 'Acceso y consumo', icon: KeyRound, number: '10' },
] as const;
type Page = typeof navigation[number]['id'];
const page = ref<Page>('chat');
const menuOpen=ref(false),menuPanel=ref<HTMLElement>(),menuToggle=ref<HTMLButtonElement>();
let originalOverflow='';
watch(menuOpen,async open=>{if(open){originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden';await nextTick();(menuPanel.value?.querySelector<HTMLButtonElement>('[aria-current="page"]:not(:disabled)')??menuPanel.value?.querySelector<HTMLButtonElement>('.drawer-close'))?.focus();}else{document.body.style.overflow=originalOverflow;await nextTick();menuToggle.value?.focus();}});
function closeMenu(){menuOpen.value=false;}
function trapMenu(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();closeMenu();return;}if(event.key!=='Tab')return;const controls=[...menuPanel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input,[tabindex="0"]')??[]].filter(element=>element.offsetParent!==null);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
const visibleNavigation=computed(()=>navigation.filter(item=>access.admin||item.id!=='maintenance'));
watch(page,async value=>{if(value==='spec'){try{const result=await accessRequest<{current:string;master:string}>('spec');currentSheet.value=result.current;masterSheet.value=result.master;}catch{currentSheet.value='No se pudo cargar la ficha. Comprueba la conexión y vuelve a abrir esta sección.';}}});
const currentPage = computed(() => navigation.find(item => item.id === page.value)!);
const activeModule = computed<ModuleId | null>(() => ['documentation', 'audit', 'architecture'].includes(page.value) ? page.value as ModuleId : null);
const connection = ref<ConnectionStatus | null>(null);
const online = computed(() => connection.value === null ? null : connection.value.state !== 'offline');
const activeProvider = computed<Provider>(() => !connection.value?.providers ? 'gemini' : page.value === 'documentation' || (page.value === 'chat' && store.chatMode === 'documentation') ? 'gemini' : 'openrouter');
const providerName = computed(() => activeProvider.value === 'gemini' ? 'Gemini' : 'OpenRouter');
const needsSetup = computed(() => online.value === true && (connection.value?.providers ? !store.providerStatus[activeProvider.value].configured : connection.value?.state === 'needs-setup'));
const showSetup = ref(false);
const setupProvider = ref<Provider>('openrouter');
function openSetup(provider: Provider = activeProvider.value) { setupProvider.value = provider; showSetup.value = true; }
const checking = ref(false);
const showHelp = ref(false);
let healthTimer: ReturnType<typeof setInterval> | undefined;
let disposed = false;
async function refreshHealth() {
  if (checking.value) return;
  checking.value = true;
  const status = await checkConnection();
  if (!disposed) {
    const staleConnectionError = /El servidor no pudo completar|No se pudo conectar con (el servidor local|A\.R\.E\.S\.)/.test(store.error);
    if (status.state !== 'offline' && (connection.value?.state === 'offline' || staleConnectionError)) { store.error = ''; store.setStance('IDLE'); }
    connection.value = status;
    if (status.providers) store.providerStatus = status.providers;
    if (status.state !== 'offline' && store.historyStatus === 'offline') void store.initializeHistory();
    if (status.state !== 'offline' && library.status === 'offline') void library.initialize();
  }
  checking.value = false;
}
async function onConfigured() { store.error = ''; store.setStance('IDLE'); await refreshHealth(); }
watch(() => store.error, value => { if (value) void refreshHealth(); });
function navigate(target: Page) {
  if (store.pending) return;
  closeMenu();
  page.value = target;
  store.error = '';
  store.setPose(target === 'documentation' ? 15 : target === 'audit' ? 11 : target === 'architecture' ? 7 : 1);
}
function restoreArtifact(artifact: Artifact) {
  store.restoreArtifact(artifact, library.projects.find(project => project.id === artifact.projectId)?.name ?? 'Proyecto');
  navigate(artifact.module);
}
async function openReferencedArtifact(id: string) {
  if (store.pending) return;
  await library.open(id);
  const artifact = library.selected;
  if (!artifact || artifact.id !== id) { store.error = library.error || 'No se pudo abrir el documento.'; return; }
  if (library.projectId !== artifact.projectId) library.selectProject(artifact.projectId);
  library.selected = artifact; navigate('library');
}
function openWorkspace(projectId: string) { library.selectProject(projectId); navigate('workspace'); }
async function attachWorkspace(data: { projectId: string; file?: SourceFile; run?: ToolRun }) {
  if (store.pending) return;
  if (store.historyStatus !== 'ready') { store.error = 'Conecta PostgreSQL para adjuntar contexto del repositorio.'; return; }
  if (!store.activeConversation && store.messages.length) { store.error = 'Exporta esta sesión y abre una conversación nueva del proyecto para adjuntar archivos.'; return; }
  if (store.activeConversation && store.activeConversation.projectId !== data.projectId) {
    await store.newConversation();
  }
  library.selectProject(data.projectId); store.attach(data.projectId, data.file, data.run); store.chatMode = 'programming'; navigate('chat');
}
function auditWorkspace(data: { projectId: string; file: SourceFile }) {
  library.selectProject(data.projectId);
  const content = data.file.content.slice(0, 12500);
  store.moduleStates.audit.originalCode=data.file.content.length<=12000?data.file.content:undefined;store.moduleStates.audit.originalPath=data.file.path;
  store.moduleStates.audit.context = `Archivo leído: ${data.file.path}\nSHA-256: ${data.file.sha256}\n${data.file.redacted ? 'Valores sensibles ocultos.\n' : ''}${content}${content.length < data.file.content.length ? '\n[Contenido recortado]' : ''}`;
  navigate('audit');
}
onMounted(() => { voice.initialize();bio.initialize();void refreshHealth(); void store.initializeHistory(); void library.initialize(); healthTimer = setInterval(() => { void refreshHealth(); }, 30000); });
onUnmounted(() => { if(menuOpen.value)document.body.style.overflow=originalOverflow;voice.dispose();bio.stop();disposed = true; clearInterval(healthTimer); store.cancel(); });
</script>

<template>
  <div class="app-shell">
    <button v-if="menuOpen" class="menu-backdrop" tabindex="-1" aria-hidden="true" @click="closeMenu"></button>
    <Transition name="navigation-drawer"><aside v-if="menuOpen" id="ares-navigation" ref="menuPanel" class="sidebar" role="dialog" aria-modal="true" aria-label="Menú principal" @keydown="trapMenu">
      <button class="icon-button drawer-close" aria-label="Cerrar menú principal" @click="closeMenu"><X :size="18"/></button>
      <a href="#" class="brand" aria-label="A.R.E.S. inicio" @click.prevent="navigate('chat')"><span class="brand-mark">Λ</span><span>A.R.E.S.<small>ENGINEERING COMPANION</small></span></a>
      <div class="sidebar-section-label">SECCIONES DE A.R.E.S. <span>{{ visibleNavigation.length }}</span></div>
      <nav aria-label="Secciones de A.R.E.S."><button v-for="item in visibleNavigation" :key="item.id" class="nav-item" :class="{ active: page === item.id }" :aria-current="page === item.id ? 'page' : undefined" :disabled="store.pending" @click="navigate(item.id)"><component :is="item.icon" :size="18" :stroke-width="1.6"/><span>{{ item.title }}</span><small>{{ item.number }}</small></button></nav>
      <div class="sidebar-manifesto"><Shield :size="21" :stroke-width="1.3"/><p>Un código sin documentación<br />es una fortaleza sin murallas.</p><span>EL PRINCIPIO AEGIS</span></div>
      <div class="sidebar-bottom"><button class="help-button" @click="showHelp = !showHelp;closeMenu()"><CircleHelp :size="17"/> Guía de la consola <ArrowUpRight :size="15"/></button><div class="commander-profile"><span class="profile-avatar">C</span><div><strong>{{ access.user?.name??'Comandante' }}</strong><small>ESPACIO DE TRABAJO</small></div><span class="profile-dot"></span></div></div>
    </aside></Transition>

    <div class="main-shell" :inert="menuOpen">
      <header class="topbar"><div class="breadcrumb"><button ref="menuToggle" class="icon-button menu-toggle" aria-label="Abrir menú principal" aria-controls="ares-navigation" :aria-expanded="menuOpen" @click="menuOpen=true"><Menu :size="20"/></button><Command :size="15"/><span>A.R.E.S.</span><ChevronRight :size="13"/><strong>{{ currentPage.title }}</strong></div><div class="topbar-right"><span class="version-tag">v1.0 / {{ access.mode.toUpperCase() }}</span><span class="connection-status" :class="{ offline: online === false || needsSetup }" role="status"><span class="status-dot"></span>{{ online === null ? 'Comprobando conexión' : needsSetup ? `${providerName} por configurar` : online ? 'Backend conectado' : 'Backend desconectado' }}</span><button v-if="online && access.admin" class="icon-button" aria-label="Configurar conexiones IA" title="Conexiones IA" @click="showSetup ? showSetup = false : openSetup()"><KeyRound :size="15"/></button><button class="icon-button" aria-label="Comprobar conexión" :disabled="checking" @click="refreshHealth"><RefreshCw :size="14" :class="{ spinning: checking }"/></button></div></header>

      <main>
        <div class="page-heading"><div><div class="eyebrow"><span class="tiny-diamond">◆</span> A.R.E.S. ENGINEERING SYSTEM</div><h1>{{ currentPage.title }}<span class="heading-dot">.</span></h1><p>Tu código. Tu visión. Un aliado en cada decisión.</p></div><div class="heading-serial"><span>EST. 2026</span><strong>SYS / {{ currentPage.number }}</strong></div></div>

        <div v-if="showHelp" class="help-panel panel"><button class="icon-button close-help" aria-label="Cerrar guía" @click="showHelp = false"><X :size="17"/></button><h2>Tu centro de comando</h2><p>Para empezar: activa Voz de A.R.E.S. en la consola, elige una voz española si quieres y escribe o dicta tu pregunta. Revisa el dictado antes de enviar. Tras cada respuesta nueva se lee un resumen breve; puedes detenerlo o silenciarlo. Al recargar, el historial anterior permanece en silencio. El avatar cambia automáticamente de postura.</p><p>Gemini genera documentación y OpenRouter se encarga de programación, auditoría y arquitectura. Elige el modo del chat o usa un módulo. Ambos proveedores se configuran en Conexiones IA y las claves se guardan únicamente en el servidor.</p><p>Con PostgreSQL conectado, el historial se conserva al recargar. En modo sesión permanece en memoria. Al cambiar de proveedor, se comparte el contexto de la conversación. Puedes exportarlo desde la consola. Cada respuesta identifica el proveedor y modelo que la generaron. La Biblioteca conserva los borradores de los módulos por proyecto. Pulsa Preparar memoria y, en una conversación nueva del mismo proyecto, activa Consultar memoria del proyecto. Las respuestas mostrarán los fragmentos recuperados y permitirán abrir sus documentos. En Repositorio puedes conectar una carpeta local, adjuntar archivos al chat y ejecutar comprobaciones. También puedes generar un cambio, revisar su diff y aplicarlo desde su botón; el original queda guardado para restaurarlo.</p></div>
        <div v-if="store.error" class="error-banner" role="alert"><span>{{ store.error }}</span><button class="icon-button" aria-label="Cerrar error" @click="store.error = ''"><X :size="17"/></button></div>
        <div v-if="online === false" class="connection-banner"><Radio :size="16"/><span>El servidor local está apagado. En la carpeta principal de A.R.E.S., ejecuta <code>npm run dev</code> y mantén esa terminal abierta.</span><button class="connection-action" :disabled="checking" @click="refreshHealth">Volver a comprobar</button></div>
        <div v-if="needsSetup && access.admin" class="connection-banner"><KeyRound :size="16"/><span>Servidor conectado. Falta configurar {{ providerName }} para este modo.</span><button class="connection-action" @click="openSetup()">Configurar {{ providerName }}</button></div>
        <ConnectionSetup v-if="showSetup && online && access.admin" :key="setupProvider" :provider="setupProvider" :configured="store.providerStatus[setupProvider].configured" :model="connection?.providers ? store.providerStatus[setupProvider].model : connection?.model ?? ''" @select="openSetup" @saved="onConfigured" @close="showSetup = false"/>

        <BioBanner/><p v-if="!access.canWrite" class="connection-banner" role="status">Acceso de lectura: puedes consultar el espacio y configurar tus recordatorios personales.</p>
        <div class="workspace-grid">
          <aside class="agent-column" aria-label="Estado de A.R.E.S.">
            <section class="agent-panel panel">
              <div class="panel-toolbar"><span class="panel-title">NÚCLEO DEL AGENTE</span><span class="mini-label">{{ store.pending ? 'ACTIVO' : 'EN GUARDIA' }}</span></div>
              <AvatarCanvas :pose="store.pose" :refactor-pulse="store.refactorPulse"/>
              <div class="agent-identity"><div class="agent-name">A.R.E.S.<span>◆</span></div><p>Tu guardián de ingeniería.</p></div>
              <div class="agent-state" aria-live="polite"><div><span class="status-dot" :class="{ red: store.pose.id === 2 }"></span><strong>{{ store.pose.name }}</strong></div><span>ESTADO AUTOMÁTICO</span></div>
              <div class="agent-readouts"><div><span>EXPRESIÓN</span><strong>[ {{ store.pose.eyes }} ]</strong></div><div><span>AEGIS</span><strong>{{ store.pose.shield === 'NONE' ? 'EN REPOSO' : store.pose.shield }}</strong></div></div>
            </section>
            <section class="protocol-panel panel"><div class="protocol-heading"><Shield :size="16"/><span>PROTOCOLO AEGIS</span><span class="tiny-diamond">◆</span></div><p>Construye con intención.<br />Documenta lo que importa.</p><div class="protocol-line"><span>IA transparente</span><span>01 / 03</span></div><div class="protocol-track"><i></i></div><small>Revisa el código generado antes de usarlo.</small></section>
          </aside>

          <ChatWindow v-if="page === 'chat'" @open-artifact="openReferencedArtifact" @open-workspace="openWorkspace"/>
          <ModuleWorkbench v-else-if="activeModule" :key="activeModule" :module-id="activeModule"/>
          <ArtifactLibrary v-else-if="page === 'library'" :disabled="store.pending" @restore="restoreArtifact" @workspace="navigate('workspace')" />
          <WorkspacePanel v-else-if="page === 'workspace'" :disabled="store.pending" @attach="attachWorkspace" @audit="auditWorkspace" />
          <MaintenancePanel v-else-if="page === 'maintenance'" />
          <BioPanel v-else-if="page === 'bio'"/><AccessPanel v-else-if="page === 'access'"/>
          <section v-else class="panel spec-panel"><div class="panel-toolbar"><span class="panel-title">FICHA TÉCNICA / ESTADO COMPROBADO</span><span class="session-badge">LOCAL</span></div><div class="spec-content"><MarkdownContent :content="currentSheet"/><details><summary>Consultar ficha maestra v2.6 de referencia</summary><MarkdownContent :content="masterSheet"/></details></div></section>
        </div>
        <footer class="workspace-footer"><span><span class="tiny-diamond">◆</span> AUTONOMOUS RESILIENT ENGINEERING & SOFTWARE-DOCUMENTATION GOD</span><span>HECHO PARA CONSTRUIR MEJOR <ExternalLink :size="11"/></span></footer>
      </main>
    </div>
  </div>
</template>
