<script setup lang="ts">
import{computed}from'vue';
import{useVoiceStore}from'../stores/voice';
const props=defineProps<{content:string}>(),voice=useVoiceStore(),id='manual-'+crypto.randomUUID();
const speaking=computed(()=>voice.source===id&&(voice.speaking||voice.preparing));
function toggle(){if(speaking.value){voice.stop();return;}voice.speak(props.content,id,false);}
</script>
<template><div class="speech-output"><button class="connection-action" type="button" :disabled="!voice.supported" :aria-pressed="speaking" :title="voice.supported?'Voz del navegador en español':'Este navegador no ofrece síntesis de voz'" @click="toggle">{{ speaking?'Detener lectura':'Escuchar respuesta' }}</button><small v-if="speaking" role="status">{{ voice.preparing?'Preparando lectura…':'Leyendo en español' }}</small></div></template>
<style scoped>.speech-output{margin-top:12px;display:flex;gap:10px;align-items:center}.speech-output small{font-size:11px;color:#829da8}</style>
