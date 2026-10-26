<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CloseIcon from "~icons/material-symbols/close";
import ChevronLeftIcon from "~icons/material-symbols/chevron-left";
import ChevronRightIcon from "~icons/material-symbols/chevron-right";

interface PreviewItem {
  src: string;
  alt?: string;
}

const props = withDefaults(
  defineProps<{
    visible: boolean;
    src?: string;
    alt?: string;
    items?: PreviewItem[];
    index?: number;
  }>(),
  { src: "", alt: "", items: undefined, index: 0 },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const current = ref(0);

const gallery = computed<PreviewItem[]>(() => {
  if (props.items && props.items.length > 0) return props.items;
  return [{ src: props.src, alt: props.alt }];
});

const total = computed(() => gallery.value.length);
const canSwitch = computed(() => total.value > 1);
const active = computed(() => gallery.value[current.value] || gallery.value[0]);

watch(
  () => [props.visible, props.index, total.value] as const,
  ([visible]) => {
    if (!visible) return;
    const next = Number(props.index) || 0;
    current.value = Math.min(Math.max(next, 0), Math.max(total.value - 1, 0));
  },
  { immediate: true },
);

const close = () => emit("update:visible", false);

const showPrev = () => {
  if (!canSwitch.value) return;
  current.value = (current.value - 1 + total.value) % total.value;
};

const showNext = () => {
  if (!canSwitch.value) return;
  current.value = (current.value + 1) % total.value;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.visible) return;
  if (event.key === "Escape") {
    event.stopImmediatePropagation();
    close();
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.key === "ArrowLeft") showPrev();
    else showNext();
  }
};

onMounted(() => window.addEventListener("keydown", handleKeydown, true));

onBeforeUnmount(() =>
  window.removeEventListener("keydown", handleKeydown, true),
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100010] flex items-center justify-center bg-black/70 p-6"
      @click="close"
    >
      <img
        :src="active?.src || ''"
        :alt="active?.alt || ''"
        class="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        @click.stop
      />

      <template v-if="canSwitch">
        <button
          type="button"
          class="absolute left-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
          @click.stop="showPrev"
        >
          <ChevronLeftIcon class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
          @click.stop="showNext"
        >
          <ChevronRightIcon class="h-5 w-5" />
        </button>
        <span
          class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white"
        >
          {{ current + 1 }} / {{ total }}
        </span>
      </template>

      <button
        type="button"
        class="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
        @click.stop="close"
      >
        <CloseIcon class="h-4 w-4" />
      </button>
    </div>
  </Teleport>
</template>
