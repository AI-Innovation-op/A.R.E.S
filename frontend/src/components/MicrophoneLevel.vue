<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { MicrophoneMeter } from "../domain/microphone-meter";
const props = defineProps<{ active: boolean }>();
const level = ref(0),
  error = ref("");
const meter = new MicrophoneMeter(
  (value) => {
    level.value = value;
  },
  (message) => {
    error.value = message;
  },
);
watch(
  () => props.active,
  (active) => {
    error.value = "";
    if (active) void meter.start();
    else meter.stop();
  },
  { immediate: true },
);
onUnmounted(() => meter.stop());
</script>
<template>
  <div class="microphone-level">
    <div
      role="meter"
      aria-label="Nivel local del micrófono"
      :aria-valuenow="Math.round(level * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="active ? 'Nivel local del micrófono' : 'Medidor pausado'"
    >
      <i :style="{ transform: `scaleX(${level})` }"></i>
    </div>
    <small>{{
      active ? "Nivel local · sin grabación" : "Medidor pausado"
    }}</small>
    <p v-if="error" role="status">{{ error }}</p>
  </div>
</template>
<style scoped>
.microphone-level {
  margin: 12px 0;
}
.microphone-level > [role="meter"] {
  height: 6px;
  background: #122e36;
  border-radius: 5px;
  overflow: hidden;
}
.microphone-level i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #24b88f, #68f9c6);
  transform-origin: left;
  transition: transform 80ms linear;
}
.microphone-level small {
  color: #8aadb8;
  font-size: 10px;
}
.microphone-level p {
  font-size: 11px;
  color: #d9b889;
}
@media (prefers-reduced-motion: reduce) {
  .microphone-level i {
    transition: none;
  }
}
</style>
