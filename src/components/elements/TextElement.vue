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
      title: 'Text',
      fields: [
        { label: 'Content', type: 'textarea', target: 'element', key: 'content', placeholder: 'Enter text' },
        { label: 'Font Size (PX)', type: 'number', target: 'style', key: 'fontSize', min: 8, max: 96, step: 1 },
        { label: 'Color', type: 'color', target: 'style', key: 'color' }
      ]
    }
  ]
};
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
