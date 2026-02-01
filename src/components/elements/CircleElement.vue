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
      title: 'properties.section.appearance',
      tab: 'style',
      fields: [
        { label: 'properties.label.background', type: 'color', target: 'style', key: 'backgroundColor', defaultValue: 'transparent' },
        { label: 'properties.label.borderColor', type: 'color', target: 'style', key: 'borderColor', defaultValue: '#000000' },
        { label: 'properties.label.borderWidth', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 100, defaultValue: 1 },
        { label: 'properties.label.borderStyle', type: 'select', target: 'style', key: 'borderStyle', defaultValue: 'solid', options: [
            { label: 'properties.option.none', value: 'none' },
            { label: 'properties.option.solid', value: 'solid' },
            { label: 'properties.option.dashed', value: 'dashed' },
            { label: 'properties.option.dotted', value: 'dotted' }
          ]
        }
      ]
    }
  ]
};
</script>

<template>
  <div 
    class="w-full h-full rounded-full"
    :style="{
      backgroundColor: element.style.backgroundColor || 'transparent',
      borderWidth: `${element.style.borderWidth || 1}px`,
      borderStyle: element.style.borderStyle || 'solid',
      borderColor: element.style.borderColor || '#000000'
    }"
  ></div>
</template>
