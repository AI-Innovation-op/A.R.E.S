<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Box, RotateCcw, Pause, Play, Footprints, Move, Minimize2 } from '@lucide/vue';
import type { Pose } from '../domain/poses';
import type { AvatarScene } from '../avatar/scene';
import AvatarFallback from './AvatarCanvas.vue';

const props = defineProps<{ pose: Pose; refactorPulse?: number }>();
const host = ref<HTMLElement>(), wrapper = ref<HTMLElement>();
const mode = ref<'loading' | '3d' | '2d'>('loading'), fallbackReason = ref('');
const animation = ref(true), patrol = ref(false), floating = ref(false), reducedMotion = ref(false);
const floatingPosition = ref({ x: 0, y: 0 });
const floatingStyle = computed(() => floating.value ? { left: `${floatingPosition.value.x}px`, top: `${floatingPosition.value.y}px` } : {});
let scene: AvatarScene | undefined, disposed = false, motionQuery: MediaQueryList | undefined, generation = 0;
let drag: { id: number; x: number; y: number; originX: number; originY: number } | undefined;
function updateMotion() { scene?.setMotion(animation.value && !reducedMotion.value); }
function onMotionChange() { reducedMotion.value = motionQuery?.matches ?? false; updateMotion(); }
function fallback(reason: string) { scene?.dispose(); scene = undefined; mode.value = '2d'; fallbackReason.value = reason; }
async function start3d() {
  const version = ++generation; mode.value = 'loading'; fallbackReason.value = ''; await nextTick();
  try {
    const { mountAvatarScene } = await import('../avatar/scene');
    if (disposed || version !== generation || !host.value) return;
    scene = mountAvatarScene(host.value, props.pose, () => fallback('Se perdió la conexión gráfica. El avatar continúa en 2D.'));
    scene.setPatrol(patrol.value); updateMotion(); mode.value = '3d';
  } catch { if (!disposed && version === generation) fallback('WebGL no está disponible. El avatar continúa en 2D.'); }
}
function toggleMode() { if (mode.value === '2d') void start3d(); else { ++generation; fallback('Modo 2D seleccionado.'); } }
function clampPosition() {
  const width = wrapper.value?.offsetWidth ?? 290, height = wrapper.value?.offsetHeight ?? 420;
  floatingPosition.value = { x: Math.max(8, Math.min(floatingPosition.value.x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(floatingPosition.value.y, window.innerHeight - height - 8)) };
}
function toggleFloating() {
  floating.value = !floating.value;
  if (floating.value) { floatingPosition.value = { x: window.innerWidth - 320, y: Math.min(160, window.innerHeight - 440) }; void nextTick(clampPosition); }
}
function startDrag(event: PointerEvent) {
  if (!floating.value || event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: floatingPosition.value.x, originY: floatingPosition.value.y };
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  floatingPosition.value = { x: drag.originX + event.clientX - drag.x, y: drag.originY + event.clientY - drag.y }; clampPosition();
}
function keyMove(event: KeyboardEvent) {
  if (!floating.value || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); floatingPosition.value.x += event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0;
  floatingPosition.value.y += event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0; clampPosition();
}
watch(() => props.pose, pose => { scene?.setPose(pose); }); watch(animation, updateMotion); watch(patrol, enabled => { scene?.setPatrol(enabled); });
watch(()=>props.refactorPulse,()=>{scene?.triggerRefactor();});
onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); onMotionChange();
  motionQuery.addEventListener('change', onMotionChange); window.addEventListener('resize', clampPosition); void start3d();
});
onUnmounted(() => { disposed = true; ++generation; scene?.dispose(); motionQuery?.removeEventListener('change', onMotionChange); window.removeEventListener('resize', clampPosition); });
</script>

<template>
  <div class="avatar-home" :class="{ 'has-floating-avatar': floating }">
    <div v-if="floating" class="avatar-away"><Box :size="26"/><p>A.R.E.S. te acompaña.</p><button @click="toggleFloating">Volver al panel ↙</button></div>
    <div ref="wrapper" class="avatar-experience" :class="{ 'is-floating': floating, 'motion-paused': !animation || reducedMotion }" :style="floatingStyle" :data-pose="pose.id" :data-mode="mode">
      <div v-if="floating" class="floating-title"><button class="avatar-drag-handle" aria-label="Mover compañero flotante con las flechas o arrastrando" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="drag = undefined" @pointercancel="drag = undefined" @keydown="keyMove"><Move :size="13"/> A.R.E.S. / {{ pose.name }}</button><button class="icon-button" aria-label="Anclar compañero al panel" @click="toggleFloating"><Minimize2 :size="14"/></button></div>
      <div class="avatar-stage" @dblclick="scene?.resetView()">
        <div v-show="mode !== '2d'" ref="host" class="avatar-webgl" role="img" :aria-label="`Avatar 3D A.R.E.S., pose ${pose.id}: ${pose.name}, ojos ${pose.eyes}`" tabindex="0" @keydown.left.prevent="scene?.turn(-1)" @keydown.right.prevent="scene?.turn(1)" @keydown.home.prevent="scene?.resetView()"></div>
        <AvatarFallback v-if="mode === '2d'" :pose="pose"/>
        <div v-if="mode === 'loading'" class="avatar-loading" role="status"><Box :size="24"/><span>Despertando a A.R.E.S.…</span></div>
        <div v-if="mode === '3d'" class="avatar-stage-label"><span class="status-dot"></span> VOXEL / 3D <span>POSE {{ String(pose.id).padStart(2, '0') }}</span></div>
      </div>
      <div class="avatar-controls"><button class="avatar-mode-button" :disabled="mode === 'loading'" @click="toggleMode"><Box :size="13"/> {{ mode === '2d' ? 'Ver en 3D' : '3D' }}</button><div>
        <button class="icon-button" :aria-label="animation ? 'Pausar animación' : 'Activar animación'" :aria-pressed="!animation" :disabled="reducedMotion" @click="animation = !animation"><Pause v-if="animation" :size="14"/><Play v-else :size="14"/></button>
        <button class="icon-button" aria-label="Pasear por la escena" title="Pasear por la escena" :aria-pressed="patrol" :disabled="mode !== '3d' || reducedMotion" @click="patrol = !patrol"><Footprints :size="15"/></button>
        <button class="icon-button" aria-label="Restablecer vista 3D" title="Restablecer vista" :disabled="mode !== '3d'" @click="scene?.resetView()"><RotateCcw :size="14"/></button>
        <button class="icon-button" :aria-label="floating ? 'Devolver avatar al panel' : 'Activar compañero flotante'" title="Compañero flotante" :aria-pressed="floating" @click="toggleFloating"><Move :size="14"/></button>
      </div></div>
      <p class="avatar-instructions" role="status">{{ fallbackReason || (reducedMotion ? 'Movimiento reducido · pose estática' : 'Arrastra para girar · Doble clic para centrar') }}</p>
    </div>
  </div>
</template>
