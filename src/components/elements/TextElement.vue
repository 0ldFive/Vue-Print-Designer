<script setup lang="ts">
import type { PrintElement } from '@/types';

defineProps<{
  element: PrintElement;
}>();
</script>

<template>
  <div class="w-full h-full overflow-hidden" :style="{
    fontSize: `${element.style.fontSize}px`,
    fontFamily: element.style.fontFamily,
    fontWeight: element.style.fontWeight,
    fontStyle: element.style.fontStyle,
    textAlign: element.style.textAlign,
    color: element.style.color,
    padding: `${element.style.padding}px`
  }">
    {{ element.content || 'Double click to edit' }}
  </div>
</template>
