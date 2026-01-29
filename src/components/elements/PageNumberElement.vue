<script setup lang="ts">
import type { PrintElement } from '@/types';
defineProps<{
  element: PrintElement;
  pageIndex: number;
  totalPages?: number;
}>();
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'Label Content',
      tab: 'properties',
      fields: [
        { label: 'Label Text', type: 'text', target: 'element', key: 'labelText', placeholder: 'e.g. 第' },
        { label: 'Label Position', type: 'select', target: 'element', key: 'labelPosition', options: [
          { label: 'Before', value: 'before' },
          { label: 'After', value: 'after' }
        ] }
      ]
    },
    {
      title: 'Pager Typography',
      tab: 'style',
      fields: [
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'fontSize', min: 8, max: 96, step: 1 },
        { label: 'Color', type: 'color', target: 'style', key: 'color' },
        { label: 'Text Align', type: 'select', target: 'style', key: 'textAlign', options: [
          { label: 'Default', value: '' },
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' }
        ] },
        { label: 'Font Family', type: 'select', target: 'style', key: 'fontFamily', options: [
          { label: 'Default', value: '' },
          { label: 'Arial', value: 'Arial, sans-serif' },
          { label: 'Times New Roman', value: '"Times New Roman", serif' },
          { label: 'Courier New', value: '"Courier New", monospace' },
          { label: 'SimSun (宋体)', value: 'SimSun, serif' },
          { label: 'SimHei (黑体)', value: 'SimHei, sans-serif' }
        ] },
        { label: 'Font Weight', type: 'select', target: 'style', key: 'fontWeight', options: [
          { label: 'Default', value: '' },
          { label: 'Normal', value: '400' },
          { label: 'Medium', value: '500' },
          { label: 'Bold', value: '700' }
        ] }
      ]
    },
    {
      title: 'Label Style',
      tab: 'style',
      fields: [
        { label: 'Label Font Size (px)', type: 'number', target: 'element', key: 'labelFontSize', min: 8, max: 96, step: 1 },
        { label: 'Label Color', type: 'color', target: 'element', key: 'labelColor' },
        { label: 'Label Font Family', type: 'select', target: 'element', key: 'labelFontFamily', options: [
          { label: 'Default', value: '' },
          { label: 'Arial', value: 'Arial, sans-serif' },
          { label: 'Times New Roman', value: '"Times New Roman", serif' },
          { label: 'Courier New', value: '"Courier New", monospace' },
          { label: 'SimSun (宋体)', value: 'SimSun, serif' },
          { label: 'SimHei (黑体)', value: 'SimHei, sans-serif' }
        ] },
        { label: 'Label Font Weight', type: 'select', target: 'element', key: 'labelFontWeight', options: [
          { label: 'Default', value: '' },
          { label: 'Normal', value: '400' },
          { label: 'Medium', value: '500' },
          { label: 'Bold', value: '700' }
        ] },
        { label: 'Label Background Color', type: 'color', target: 'element', key: 'labelBackgroundColor' },
        // Label Border
        { label: 'Label Border Style', type: 'select', target: 'element', key: 'labelBorderStyle', options: [
            { label: 'None', value: '' },
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' }
          ]
        },
        { label: 'Label Border Width (px)', type: 'number', target: 'element', key: 'labelBorderWidth', min: 0, max: 20, step: 1 },
        { label: 'Label Border Color', type: 'color', target: 'element', key: 'labelBorderColor' }
      ]
    },
    {
      title: 'Frame Border',
      tab: 'style',
      fields: [
        { label: 'Border Style', type: 'select', target: 'style', key: 'borderStyle', options: [
          { label: 'None', value: 'none' },
          { label: 'Solid', value: 'solid' },
          { label: 'Dashed', value: 'dashed' },
          { label: 'Dotted', value: 'dotted' }
        ] },
        { label: 'Border Width (px)', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'Border Color', type: 'color', target: 'style', key: 'borderColor' },
      ]
    },
  ]
};
</script>

<template>
  <div class="w-full h-full overflow-hidden" 
    data-print-type="page-number"
    :style="{
    fontSize: `${element.style.fontSize}px`,
    fontFamily: element.style.fontFamily,
    fontWeight: element.style.fontWeight,
    fontStyle: element.style.fontStyle,
    textAlign: element.style.textAlign,
    color: element.style.color,
    padding: `${element.style.padding || 0}px`
  }">
    <span v-if="element.labelText && element.labelPosition !== 'after'" :style="{
      fontSize: element.labelFontSize ? `${element.labelFontSize}px` : undefined,
      fontFamily: element.labelFontFamily || undefined,
      fontWeight: element.labelFontWeight || undefined,
      color: element.labelColor || undefined,
      backgroundColor: element.labelBackgroundColor || 'transparent',
      borderStyle: element.labelBorderStyle || 'none',
      borderWidth: `${element.labelBorderWidth || 0}px`,
      borderColor: element.labelBorderColor || 'transparent',
      marginRight: '4px',
      padding: '0 4px'
    }">{{ element.labelText }}</span>
    <span class="page-number-text">{{ (pageIndex + 1) }}/{{ totalPages || 1 }}</span>
    <span v-if="element.labelText && element.labelPosition === 'after'" :style="{
      fontSize: element.labelFontSize ? `${element.labelFontSize}px` : undefined,
      fontFamily: element.labelFontFamily || undefined,
      fontWeight: element.labelFontWeight || undefined,
      color: element.labelColor || undefined,
      backgroundColor: element.labelBackgroundColor || 'transparent',
      borderStyle: element.labelBorderStyle || 'none',
      borderWidth: `${element.labelBorderWidth || 0}px`,
      borderColor: element.labelBorderColor || 'transparent',
      marginLeft: '4px',
      padding: '0 4px'
    }">{{ element.labelText }}</span>
  </div>
</template>
