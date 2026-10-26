<script setup lang="ts">
import { onMounted,ref } from 'vue';
import App from './App.vue';
import { accessRequest,useAccessStore } from './stores/access';
const access=useAccessStore(),code=ref(''),name=ref(''),busy=ref(false),error=ref('');
onMounted(()=>access.initialize());
async function login(){busy.value=true;error.value='';try{await accessRequest('access/redeem',{code:code.value.trim(),name:name.value.trim()});code.value='';await access.initialize();}catch(e){error.value=e instanceof Error?e.message:'No se pudo iniciar sesión.';}finally{busy.value=false;}}
</script>
<template><App v-if="access.ready&&(access.user||access.legacy)"/><main v-else class="login-shell"><section class="panel access-panel"><span class="eyebrow">A.R.E.S. · ACCESO</span><h1>Tu espacio de ingeniería.</h1><p v-if="access.error" role="alert">{{ access.error }} <button class="connection-action" @click="access.initialize">Reintentar</button></p><p v-else-if="!access.ready">Comprobando sesión…</p><form v-else @submit.prevent="login"><p>Introduce una invitación de tu administrador. El código se utiliza una vez y la sesión dura siete días.</p><label for="access-name">Tu nombre</label><input id="access-name" v-model="name" maxlength="80" required autocomplete="nickname"/><label for="access-code">Código de invitación</label><input id="access-code" v-model="code" type="password" autocomplete="off" required/><button class="connection-action" :disabled="busy||!name.trim()||!code.trim()">{{ busy?'Entrando…':'Entrar' }}</button><p v-if="error" role="alert">{{ error }}</p></form></section></main></template>
