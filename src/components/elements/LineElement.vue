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
      title: 'Line Style',
      tab: 'style',
      fields: [
        { label: 'Color', type: 'color', target: 'style', key: 'borderColor', defaultValue: '#000000' },
        { label: 'Thickness (px)', type: 'number', target: 'style', key: 'borderWidth', min: 1, max: 100, step: 1, defaultValue: 1 },
        { label: 'Style', type: 'select', target: 'style', key: 'borderStyle', defaultValue: 'solid', options: [
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' }
          ]
        }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full flex items-center justify-center">
    <div 
      class="w-full"
      :style="{
        borderTopWidth: `${element.style.borderWidth || 1}px`,
        borderTopStyle: (element.style.borderStyle as any) || 'solid',
        borderTopColor: element.style.borderColor || '#000000'
      }"
    ></div>
  </div>
</template>
