<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../utils/markdown';
import { marked } from 'marked';
import MermaidDiagram from './MermaidDiagram.vue';
const props = defineProps<{ content: string }>();
const parts = computed(() => {
  const result:{type:'markdown'|'mermaid';content:string}[]=[];let text='';
  for(const token of marked.lexer(props.content)){if(token.type==='code'&&token.lang?.trim().toLowerCase()==='mermaid'){if(text)result.push({type:'markdown',content:renderMarkdown(text)});text='';result.push({type:'mermaid',content:token.text});}else text+=token.raw;}
  if(text)result.push({type:'markdown',content:renderMarkdown(text)});return result;
});
</script>

<template><div class="markdown"><template v-for="(part,index) in parts" :key="index"><MermaidDiagram v-if="part.type==='mermaid'" :code="part.content"/><div v-else v-html="part.content"></div></template></div></template>
