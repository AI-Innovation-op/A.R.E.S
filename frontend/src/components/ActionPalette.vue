<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Search, X, ArrowUpRight } from "@lucide/vue";
import { consoleActions, type ConsoleAction } from "../domain/actions";
import { useAccessStore } from "../stores/access";
const emit = defineEmits<{ close: []; select: [id: ConsoleAction] }>(),
  access = useAccessStore(),
  query = ref(""),
  selected = ref(0),
  input = ref<HTMLInputElement>(),
  panel = ref<HTMLElement>();
const results = computed(() =>
  consoleActions.filter(
    (item) =>
      (access.canWrite || !("write" in item && item.write)) &&
      `${item.title} ${item.description}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          query.value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ),
  ),
);
let trigger: HTMLElement | null = null;
onMounted(async () => {
  trigger = document.activeElement as HTMLElement;
  await nextTick();
  input.value?.focus();
});
onUnmounted(() => trigger?.isConnected && trigger.focus());
function key(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    selected.value =
      (selected.value +
        (event.key === "ArrowDown" ? 1 : -1) +
        results.value.length) %
      Math.max(1, results.value.length);
    void nextTick(() =>
      panel.value
        ?.querySelector(`[data-index="${selected.value}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  } else if (event.key === "Enter") {
    event.preventDefault();
    const item = results.value[selected.value];
    if (item) emit("select", item.id);
  } else if (event.key === "Tab") {
    const controls = [
      ...(panel.value?.querySelectorAll<HTMLElement>("input,button") ?? []),
    ];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
</script>
<template>
  <div class="action-palette-overlay" @click.self="emit('close')">
    <section
      ref="panel"
      class="action-palette"
      role="dialog"
      aria-modal="true"
      aria-label="Acciones de A.R.E.S."
      @keydown="key"
    >
      <header>
        <Search :size="17" /><input
          ref="input"
          v-model="query"
          aria-label="Buscar acción"
          placeholder="¿Qué quieres hacer?"
          @input="selected = 0"
        /><button
          class="icon-button"
          aria-label="Cerrar acciones"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </header>
      <div class="action-palette-list">
        <button
          v-for="(item, index) in results"
          :key="item.id"
          :data-index="index"
          :class="{ selected: index === selected }"
          @focus="selected = index"
          @click="emit('select', item.id)"
        >
          <span
            ><strong>{{ item.title }}</strong
            ><small>{{ item.description }}</small></span
          ><ArrowUpRight :size="15" />
        </button>
        <p v-if="!results.length">No hay acciones que coincidan.</p>
      </div>
      <footer>↑ ↓ elegir · Enter abrir · Escape cerrar</footer>
    </section>
  </div>
</template>
<style scoped>
.action-palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 15dvh 16px 24px;
  background: #020b13c9;
  backdrop-filter: blur(5px);
}
.action-palette {
  width: min(620px, 100%);
  max-height: 75dvh;
  display: flex;
  flex-direction: column;
  background: #0b1a23;
  border: 1px solid #31554f;
  border-radius: 12px;
  box-shadow: 0 20px 100px #0009;
  color: #bdd7df;
}
.action-palette header {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #29414a;
}
.action-palette input {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: #e1efed;
  border: none;
  font: inherit;
  outline: none;
}
.action-palette-list {
  overflow: auto;
  padding: 8px;
}
.action-palette-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: none;
  border-radius: 6px;
  padding: 12px;
  color: #d1e3e7;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.action-palette-list button.selected,
.action-palette-list button:hover {
  background: #173b32;
}
.action-palette strong {
  display: block;
  font-size: 13px;
}
.action-palette small {
  display: block;
  color: #91abb9;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 5px;
}
.action-palette footer {
  padding: 12px 18px;
  font: 10px monospace;
  color: #7198a7;
  border-top: 1px solid #263f49;
}
.action-palette button:focus-visible {
  outline: 2px solid #35e7ac;
}
.action-palette-list p {
  font-size: 13px;
  padding: 15px;
}
@media (max-width: 500px) {
  .action-palette-overlay {
    padding-top: 9dvh;
  }
  .action-palette {
    max-height: 80dvh;
  }
}
</style>
