<script setup lang="ts">
import type { PrintElement } from '@/types';

defineProps<{
  element: PrintElement;
}>();
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'Image',
      fields: [
        { label: 'Image URL', type: 'text', target: 'element', key: 'content', placeholder: 'https://...' }
      ]
    }
  ]
};
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
