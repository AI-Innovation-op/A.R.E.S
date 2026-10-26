<script setup lang="ts">
import { computed } from 'vue';
import type { Pose } from '../domain/poses';
const props = defineProps<{ pose: Pose }>();
const swordRotation = computed(() => props.pose.action === 'sword-high' ? -105 : props.pose.action === 'slash' ? -65 : props.pose.action === 'sword-guard' ? -30 : 12);
</script>

<template>
  <div class="avatar-scene" :class="[`action-${pose.action}`, { 'is-error': pose.id === 2 }]">
    <div class="avatar-orbit orbit-one"></div><div class="avatar-orbit orbit-two"></div>
    <span class="coordinate coord-top">ARES_CORE / 01</span><span class="coordinate coord-bottom">VOXEL · 2D</span>
    <svg class="avatar-art" viewBox="0 0 340 380" role="img" :aria-label="`A.R.E.S., ${pose.name}, ojos ${pose.eyes}`">
      <defs>
        <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1a94cb"/><stop offset="1" stop-color="#0e386b"/></linearGradient>
        <linearGradient id="energy" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5ffe0"/><stop offset=".45" stop-color="#00ffaa"/><stop offset="1" stop-color="#058b85"/></linearGradient>
        <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#071d2b"/><stop offset="1" stop-color="#021019"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <ellipse cx="174" cy="342" rx="107" ry="22" fill="#00ffaa" opacity=".05"/>
      <ellipse cx="174" cy="342" rx="107" ry="22" fill="none" stroke="#00ffaa" stroke-opacity=".3"/>
      <path d="m82 342 48 20h90l52-20-49-21h-90Z" fill="none" stroke="#00ffaa" stroke-opacity=".15"/>
      <g class="avatar-body">
        <!-- La capa y las piezas se dibujan en SVG para mantener expresiones coherentes con la FSM. -->
        <path d="m115 168 105 3 32 139-79-22-76 19Z" fill="#054f50" opacity=".7"/>
        <g fill="#00ffaa" opacity=".22" font-family="monospace" font-size="12"><text x="112" y="236">01</text><text x="226" y="275">10</text><text x="110" y="286">10</text></g>
        <g class="avatar-leg leg-left"><path d="m126 254 39 4-2 64-38 3Z" fill="#09233c" stroke="#06121f" stroke-width="5"/><path d="m120 299 42 1v35h-54v-21Z" fill="url(#armor)" stroke="#06121f" stroke-width="4"/><path d="M113 323h48v12h-48Z" fill="#16e4af"/></g>
        <g class="avatar-leg leg-right"><path d="m177 257 38-3 5 72-39-5Z" fill="#09233c" stroke="#06121f" stroke-width="5"/><path d="m179 300 41 3 15 17v16h-56Z" fill="url(#armor)" stroke="#06121f" stroke-width="4"/><path d="M180 323h50v12h-50Z" fill="#16e4af"/></g>
        <path d="m119 177 97 1 8 80-50 16-58-17Z" fill="url(#armor)" stroke="#06121f" stroke-width="5"/>
        <path d="m121 177 95 1-5 39-40 10-45-10Z" fill="#0bbba2" stroke="#06121f" stroke-width="4"/>
        <path d="m157 184 15 7 15-7v21l-15 11-15-11Z" fill="url(#energy)"/>
        <path d="m126 230 42 9 43-9m-86 15 43 9 45-9" fill="none" stroke="#06121f" stroke-width="7"/>
        <path d="m119 255 51 9 49-10v12l-48 10-52-10Z" fill="#27b3ce" stroke="#06121f" stroke-width="4"/>
        <g :transform="`rotate(${swordRotation} 108 194)`">
          <path d="m91 183 29 12-10 53-30-11Z" fill="url(#armor)" stroke="#06121f" stroke-width="5"/>
          <path d="m90 174 35 13-7 23-37-12Z" fill="#0dc9ab" stroke="#06121f" stroke-width="5"/>
          <path d="m86 235 30 11-7 24-30-11Z" fill="#0b4774" stroke="#06121f" stroke-width="4"/>
          <path d="m92 256-8 21 16 5 8-20Z" fill="#17d9b1" stroke="#06121f" stroke-width="4"/>
          <path d="m74 271 41 15" stroke="#00ffaa" stroke-width="8"/>
          <path d="m84 278-20 55 4 20 17-13 20-55Z" fill="url(#energy)" stroke="#59ffe5" stroke-width="3"/>
          <path d="m94 288-22 53" stroke="#d2fff6" stroke-width="3"/>
        </g>
        <path d="m214 183 27-1 14 52-32 9Z" fill="url(#armor)" stroke="#06121f" stroke-width="5"/>
        <g v-if="pose.shield !== 'NONE'" class="aegis-shield" :transform="pose.action === 'shield' ? 'translate(-5 -8) scale(1.025)' : ''">
          <path d="m229 212 52-15 5 79-32 30-30-17Z" fill="#063c60" stroke="#00e9b5" stroke-width="5"/>
          <path d="m235 218 39-11 4 64-25 25-23-13Z" fill="none" stroke="#2ca7ad" stroke-width="2"/>
          <path v-if="pose.shield === 'DOC'" d="m245 230 15-4 8 7 1 36-24 9Zm15-4 1 11 7-4m-18 14 13-4m-13 14 13-4m-13 14 13-4" fill="none" stroke="#59ffce" stroke-width="3"/>
          <text v-else x="239" y="265" fill="#59ffce" font-size="20" font-family="monospace">{{ pose.shield === 'CODE' ? '&lt;&gt;' : 'Λ' }}</text>
        </g>
        <!-- Casco con cresta espartana y visor de consola. -->
        <path d="m123 55 40-17 39 16 2 33-81-1Z" fill="#087d85" stroke="#06121f" stroke-width="5"/>
        <path d="m131 49 30-13 36 14-1 11-35-12-30 14Z" fill="url(#energy)"/>
        <path d="M142 51v28m16-34v33m16-31v31m15-26v26" stroke="#00ffaa" stroke-width="5" stroke-dasharray="7 6"/>
        <path d="m102 87 61-20 74 17v85l-64 22-70-20Z" fill="#0d3667" stroke="#06121f" stroke-width="6"/>
        <path d="m104 87 61-20 72 17-67 20Z" fill="#29b6d6" stroke="#06121f" stroke-width="5"/>
        <path d="m169 104 68-20v85l-65 22Z" fill="url(#armor)"/>
        <path d="m121 109 97-9v61l-97 9Z" fill="url(#screen)" stroke="#063759" stroke-width="6"/>
        <path d="m117 106 1 66 101-11" fill="none" stroke="#3ccbe1" stroke-width="5"/>
        <path d="m158 78 22 3v33l-22 3Z" fill="url(#energy)" stroke="#08243c" stroke-width="4"/>
        <text x="168" y="145" text-anchor="middle" fill="#00ffaa" font-size="23" font-weight="700" font-family="monospace" filter="url(#glow)">{{ pose.eyes }}</text>
        <text x="168" y="145" text-anchor="middle" fill="#93ffdc" font-size="23" font-weight="700" font-family="monospace">{{ pose.eyes }}</text>
        <path d="m108 115-13 4v29l13 5Z" fill="#1598c4" stroke="#06121f" stroke-width="4"/>
        <path d="m128 177 39 10 41-12" fill="none" stroke="#06121f" stroke-width="5"/>
      </g>
    </svg>
    <div class="avatar-scanline"></div>
  </div>
</template>
