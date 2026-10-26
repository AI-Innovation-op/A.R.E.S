<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { maintenance, type BackupStatus } from '../services/maintenance';
const status = ref<BackupStatus | null>(null), busy = ref(false), error = ref(''), message = ref('');
let disposed = false, loading = false;
async function refresh() {
  if (loading) return; loading = true;
  try { const result = await maintenance<BackupStatus>(); if (!disposed) { status.value = result; error.value = ''; } }
  catch (cause) { if (!disposed) error.value = (cause as Error).message; }
  finally { loading = false; }
}
async function run(id?: string) {
  busy.value = true; error.value = ''; message.value = '';
  try { await maintenance(id ? `/${encodeURIComponent(id)}/verify` : '', true); if (!disposed) message.value = 'Recuperación comprobada: el esquema y los datos coinciden con la copia.'; }
  catch (cause) { if (!disposed) error.value = (cause as Error).message; }
  finally { if (!disposed) { busy.value = false; const failure = error.value; await refresh(); if (failure) error.value = failure; } }
}
onMounted(() => { void refresh(); });
const timer = setInterval(() => { if (busy.value || status.value?.busy) void refresh(); }, 1500);
onUnmounted(() => { disposed = true; clearInterval(timer); });
const date = (value: string) => new Date(value).toLocaleString('es-PE');
</script>
<template>
  <section class="panel workbench" aria-label="Respaldos de PostgreSQL"><div class="panel-toolbar"><span class="panel-title">MANTENIMIENTO / DATOS</span><span class="session-badge">LOCAL</span></div><div class="workbench-content">
    <span class="eyebrow">CONTINUIDAD DEL PROYECTO</span><h2>Respaldos y recuperación</h2><p class="muted">Cada copia se restaura en una base temporal y compara el esquema y el contenido. Las verificaciones conservan la base activa.</p>
    <p v-if="error || status?.lastError" role="alert" class="library-error">{{ error || status?.lastError }}</p><p v-if="message" role="status" class="result-note">{{ message }}</p>
    <template v-if="status"><p class="result-note">{{ status.enabled ? `Copia automática cada ${status.intervalHours} horas mientras el servidor esté encendido.` : 'Copias automáticas desactivadas.' }} Se conservan {{ status.keep }} copias. <span v-if="status.nextAt && status.enabled">Próxima: {{ date(status.nextAt) }}.</span></p><p class="source-hash">Carpeta: {{ status.directory }}</p>
      <div class="source-actions"><button class="primary-button" :disabled="busy || status.busy" @click="run()">Crear y verificar respaldo</button><button class="connection-action" @click="refresh">Actualizar</button></div>
      <p v-if="busy || status.busy" role="status" class="result-note">{{ status.stage || 'Preparando respaldo y recuperación…' }}</p>
      <div class="backup-list"><article v-for="backup in status.backups" :key="backup.id"><strong>{{ date(backup.createdAt) }}</strong><span>{{ (backup.bytes / 1024).toFixed(1) }} KB · {{ backup.tableCount }} tablas</span><span>{{ backup.verifiedAt ? `Verificado: ${date(backup.verifiedAt)}` : 'Recuperación pendiente de verificación' }}</span><code>{{ backup.id }}</code><button class="connection-action" :disabled="busy || status.busy" @click="run(backup.id)">Verificar recuperación</button></article></div>
      <p v-if="!status.backups.length" class="result-note">Todavía no hay copias. Crea la primera o espera al respaldo automático.</p>
      <p class="result-note">Para recuperar datos tras una pérdida, usa <code>npm run backup:recover -- UUID</code> desde la carpeta del proyecto. El comando crea otra base y devuelve su nombre. Después puedes configurar DATABASE_URL para usarla. Guarda también una copia en otro disco para cubrir daños del equipo.</p>
    </template><button v-else class="connection-action" @click="refresh">Volver a comprobar</button>
  </div></section>
</template>
<style scoped>
.backup-list { display: grid; gap: 12px; margin: 24px 0; }.backup-list article { display: grid; gap: 9px; padding: 18px; border: 1px solid var(--border, #233a41); border-radius: 8px; }.backup-list span { color: var(--muted, #8da6ad); font-size: 12px; }.backup-list code { font-size: 10px; overflow-wrap: anywhere; }.backup-list button { justify-self: start; }
</style>
