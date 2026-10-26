<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { KeyRound, X, ExternalLink, Check, LoaderCircle } from '@lucide/vue';
import { configureProvider, listModels, type CatalogModel, type Provider } from '../services/api';
const props = withDefaults(defineProps<{ model: string; provider?: Provider; configured?: boolean }>(), { provider: 'gemini', configured: false });
const emit = defineEmits<{ saved: []; close: []; select: [provider: Provider] }>();
const isOpenRouter = computed(() => props.provider === 'openrouter');
const name = computed(() => isOpenRouter.value ? 'OpenRouter' : 'Gemini');
const keepKey = computed(() => isOpenRouter.value && props.configured);
const apiKey = ref(''), model = ref(props.model || (isOpenRouter.value ? 'cohere/north-mini-code:free' : 'gemini-3-flash-preview'));
const saving = ref(false), error = ref(''), saved = ref(false);
const catalog = ref<CatalogModel[]>([]), freeOnly = ref(true), catalogError = ref(''), loadingModels = ref(false);
const visibleModels = computed(() => catalog.value.filter(item => !freeOnly.value || item.free));
const selectedModel = computed(() => catalog.value.find(item => item.id === model.value));
const paidBlocked = computed(() => isOpenRouter.value && freeOnly.value && selectedModel.value && !selectedModel.value.free);
const price = (value: number | null) => value === null ? 'variable' : `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
onMounted(async () => {
  if (!isOpenRouter.value) return;
  loadingModels.value = true;
  try { catalog.value = await listModels(); }
  catch (cause: unknown) { catalogError.value = cause instanceof Error ? cause.message : 'Catálogo no disponible.'; }
  finally { loadingModels.value = false; }
});
async function save() {
  if (saving.value || (!apiKey.value.trim() && !keepKey.value) || !model.value.trim() || paidBlocked.value) return;
  saving.value = true; error.value = ''; saved.value = false;
  try {
    await configureProvider(props.provider, apiKey.value.trim(), model.value.trim());
    apiKey.value = ''; saved.value = true; emit('saved');
  } catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'No se pudo completar la configuración.'; }
  finally { saving.value = false; }
}
onUnmounted(() => { apiKey.value = ''; });
</script>

<template>
  <section class="setup-panel panel" aria-labelledby="setup-title">
    <button class="icon-button close-help" aria-label="Cerrar configuración" :disabled="saving" @click="emit('close')"><X :size="17"/></button>
    <span class="eyebrow"><KeyRound :size="13"/> CONEXIONES IA</span>
    <div class="provider-tabs" aria-label="Proveedor a configurar"><button type="button" :class="{ active: !isOpenRouter }" :disabled="saving" @click="emit('select', 'gemini')">Gemini · Documentación</button><button type="button" :class="{ active: isOpenRouter }" :disabled="saving" @click="emit('select', 'openrouter')">OpenRouter · Programación</button></div>
    <h2 id="setup-title">Conecta tu {{ name }}</h2>
    <p>{{ isOpenRouter ? 'Elige el modelo para programación, auditoría y arquitectura.' : 'Gemini prepara documentación, fichas técnicas, README y ADR.' }}</p>
    <form @submit.prevent="save">
      <label for="provider-key">Clave de API de {{ name }}</label>
      <input id="provider-key" v-model="apiKey" type="password" autocomplete="off" autocapitalize="none" :spellcheck="false" maxlength="200" :disabled="saving" :placeholder="keepKey ? 'Clave guardada · deja vacío para conservarla' : `Pega aquí tu clave de ${name}`" :required="!keepKey" />
      <div class="setup-key-help"><span>Se guarda en el servidor local. No se guarda en el navegador ni se añade al chat.</span><a :href="isOpenRouter ? 'https://openrouter.ai/settings/keys' : 'https://aistudio.google.com/app/apikey'" target="_blank" rel="noopener noreferrer">Obtener una clave <ExternalLink :size="11"/></a></div>
      <label for="gemini-model">Identificador del modelo</label>
      <input id="gemini-model" v-model="model" maxlength="160" :disabled="saving" autocapitalize="none" :spellcheck="false" :list="isOpenRouter ? 'openrouter-models' : undefined" required />
      <datalist v-if="isOpenRouter" id="openrouter-models"><option v-for="item in visibleModels" :key="item.id" :value="item.id">{{ item.name }} · {{ item.free ? 'Gratuito' : `Entrada ${price(item.inputPerMillion)} / Salida ${price(item.outputPerMillion)} por 1M tokens` }}</option></datalist>
      <label v-if="isOpenRouter" class="free-model-toggle"><input v-model="freeOnly" type="checkbox" :disabled="saving"/> Mostrar solo modelos gratuitos</label>
      <small v-if="!isOpenRouter">Usa un modelo de texto disponible en tu proyecto de Google AI Studio.</small>
      <small v-if="loadingModels">Cargando catálogo de OpenRouter…</small><small v-if="catalogError">{{ catalogError }}</small>
      <div v-if="isOpenRouter && selectedModel" class="model-price"><strong>{{ selectedModel.name }}</strong><span>{{ selectedModel.free ? 'Gratuito · sujeto a disponibilidad y límites de OpenRouter' : `USD por 1M tokens: entrada ${price(selectedModel.inputPerMillion)} · salida ${price(selectedModel.outputPerMillion)}` }}</span></div>
      <small v-if="paidBlocked">El modelo indicado tiene tarifa. Cambia a uno gratuito o desactiva el filtro para seleccionarlo conscientemente.</small>
      <p v-if="error" class="setup-error" role="alert">{{ error }}</p>
      <p v-if="saved" class="setup-success" role="status"><Check :size="16"/> Conexión verificada y guardada. Ya puedes conversar con A.R.E.S.</p>
      <div class="setup-actions"><span>La verificación comprueba la configuración; no envía una conversación.</span><button class="primary-button" :disabled="saving || (!apiKey.trim() && !keepKey) || !model.trim() || paidBlocked"><LoaderCircle v-if="saving" class="spinning" :size="15"/><KeyRound v-else :size="15"/>{{ saving ? `Verificando con ${name}…` : 'Verificar y guardar' }}</button></div>
    </form>
  </section>
</template>
