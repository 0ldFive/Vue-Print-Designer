<script setup lang="ts">
import { computed } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import { normalizeVariableKey } from '@/utils/variables';

const props = defineProps<{
  element: PrintElement;
}>();

const store = useDesignerStore();

const resolvedText = computed(() => {
  const variable = props.element.variable || '';
  if (store.isExporting && variable) {
    const key = normalizeVariableKey(variable);
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  return props.element.variable || props.element.content || 'Double click to edit';
});
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'properties.section.content',
      tab: 'properties',
      fields: [
        { label: 'properties.label.content', type: 'textarea', target: 'element', key: 'content', placeholder: 'properties.label.textContentPlaceholder' },
        { label: 'properties.label.variable', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'properties.section.typography',
      tab: 'style',
      fields: [
        { label: 'properties.label.writingMode', type: 'select', target: 'style', key: 'writingMode', options: [
            { label: 'properties.option.horizontal', value: 'horizontal-tb' },
            { label: 'properties.option.vertical', value: 'vertical-rl' }
          ] 
        },
        { label: 'properties.label.fontSize', type: 'number', target: 'style', key: 'fontSize', min: 8, max: 96, step: 1 },
        { label: 'properties.label.color', type: 'color', target: 'style', key: 'color' },
        {
          label: 'properties.label.textAlign',
          type: 'select',
          target: 'style',
          key: 'textAlign',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.left', value: 'left' },
            { label: 'properties.option.center', value: 'center' },
            { label: 'properties.option.right', value: 'right' }
          ]
        },
        {
          label: 'properties.label.fontFamily',
          type: 'select',
          target: 'style',
          key: 'fontFamily',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.arial', value: 'Arial, sans-serif' },
            { label: 'properties.option.timesNewRoman', value: '"Times New Roman", serif' },
            { label: 'properties.option.courierNew', value: '"Courier New", monospace' },
            { label: 'properties.option.simSun', value: 'SimSun, serif' },
            { label: 'properties.option.simHei', value: 'SimHei, sans-serif' }
          ]
        },
        {
          label: 'properties.label.fontWeight',
          type: 'select',
          target: 'style',
          key: 'fontWeight',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.normal', value: '400' },
            { label: 'properties.option.medium', value: '500' },
            { label: 'properties.option.bold', value: '700' }
          ]
        }
      ]
    },
    {
      title: 'properties.section.border',
      tab: 'style',
      fields: [
        { label: 'properties.label.borderStyle', type: 'select', target: 'style', key: 'borderStyle', options: [
            { label: 'properties.option.none', value: 'none' },
            { label: 'properties.option.solid', value: 'solid' },
            { label: 'properties.option.dashed', value: 'dashed' },
            { label: 'properties.option.dotted', value: 'dotted' }
          ]
        },
        { label: 'properties.label.borderWidth', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'properties.label.borderColor', type: 'color', target: 'style', key: 'borderColor' }
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
    textDecoration: element.style.textDecoration,
    color: element.style.color,
    padding: `${element.style.padding}px`,
    writingMode: element.style.writingMode as any || 'horizontal-tb',
  }">
    {{ resolvedText }}
  </div>
</template>
