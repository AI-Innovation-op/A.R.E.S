<script setup lang="ts">
import { useAccessStore } from '../stores/access';
const access=useAccessStore();
import { ref } from 'vue';
import { useLibraryStore } from '../stores/library';
defineProps<{ disabled?: boolean }>();
const library = useLibraryStore();
const creating = ref(false), name = ref('');
async function create() { if (await library.addProject(name.value)) { name.value = ''; creating.value = false; } }
</script>
<template>
  <div class="project-selector">
    <div v-if="library.status !== 'ready'" class="library-notice" role="status">
      <span>{{ library.status === 'loading' ? 'Comprobando biblioteca…' : 'Biblioteca sin conexión. Los borradores nuevos solo estarán en esta sesión.' }}</span>
      <button v-if="library.status === 'offline'" class="connection-action" :disabled="library.busy || disabled" @click="library.initialize">Reconectar biblioteca</button>
    </div>
    <template v-else>
      <label for="library-project">Proyecto</label>
      <div class="project-controls"><select id="library-project" :value="library.projectId" :disabled="library.busy || disabled" @change="library.selectProject(($event.target as HTMLSelectElement).value)"><option v-if="!library.projects.length" value="">Crea tu primer proyecto</option><option v-for="project in library.projects" :key="project.id" :value="project.id">{{ project.name }}</option></select><button v-if="access.canWrite" type="button" class="connection-action" :disabled="library.busy || disabled" @click="creating = !creating">{{ creating ? 'Cerrar' : 'Nuevo proyecto' }}</button></div>
      <form v-if="creating && access.canWrite" class="project-controls" @submit.prevent="create"><label class="sr-only" for="new-project">Nombre del proyecto</label><input id="new-project" v-model="name" placeholder="Nombre del proyecto" maxlength="150" :disabled="library.busy || disabled" required /><button class="connection-action" :disabled="library.busy || disabled || !name.trim()">Crear proyecto</button></form>
    </template>
    <p v-if="library.error" role="alert" class="library-error">{{ library.error }}</p>
  </div>
</template>
