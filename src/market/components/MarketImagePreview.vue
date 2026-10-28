<script setup lang="ts">
import { computed } from "vue";
import CloseIcon from "~icons/material-symbols/close";
import { useMarketStore } from "../store";

const store = useMarketStore();
const preview = computed(() => store.previewImage);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="preview"
      class="pointer-events-auto fixed inset-0 z-[100020] flex items-center justify-center bg-black/70 p-6"
      @click.self="store.closePreview()"
    >
      <button
        type="button"
        class="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        @click="store.closePreview()"
      >
        <CloseIcon class="h-5 w-5" />
      </button>
      <img
        :src="preview.src"
        :alt="preview.alt || ''"
        class="max-h-full max-w-full object-contain"
      />
    </div>
  </Teleport>
</template>
