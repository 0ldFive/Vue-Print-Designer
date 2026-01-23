<script setup lang="ts">
import type { PrintElement } from '@/types';

defineProps<{
  element: PrintElement;
}>();
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-gray-50 flex items-center justify-center">
    <img 
      v-if="element.content" 
      :src="element.content" 
      class="w-full h-full object-contain pointer-events-none"
      alt="Element"
    />
    <span v-else class="text-gray-400 text-xs">No Image</span>
  </div>
</template>
