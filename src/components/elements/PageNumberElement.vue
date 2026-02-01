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
      title: 'properties.section.labelContent',
      tab: 'properties',
      fields: [
        { label: 'properties.label.labelText', type: 'text', target: 'element', key: 'labelText', placeholder: 'properties.label.labelTextPlaceholder' },
        { label: 'properties.label.labelPosition', type: 'select', target: 'element', key: 'labelPosition', options: [
          { label: 'properties.option.before', value: 'before' },
          { label: 'properties.option.after', value: 'after' }
        ] },
        { label: 'properties.label.pageFormat', type: 'select', target: 'element', key: 'format', options: [
          { label: 'properties.option.numberOnly', value: '1' },
          { label: 'properties.option.page1', value: 'Page 1' },
          { label: 'properties.option.oneTotal', value: '1/Total' }
        ] }
      ]
    },
    {
      title: 'properties.section.pagerTypography',
      tab: 'style',
      fields: [
        { label: 'properties.label.fontSize', type: 'number', target: 'style', key: 'fontSize', min: 8, max: 96, step: 1 },
        { label: 'properties.label.color', type: 'color', target: 'style', key: 'color' },
        { label: 'properties.label.textAlign', type: 'select', target: 'style', key: 'textAlign', options: [
          { label: 'properties.option.default', value: '' },
          { label: 'properties.option.left', value: 'left' },
          { label: 'properties.option.center', value: 'center' },
          { label: 'properties.option.right', value: 'right' }
        ] },
        { label: 'properties.label.fontFamily', type: 'select', target: 'style', key: 'fontFamily', options: [
          { label: 'properties.option.default', value: '' },
          { label: 'properties.option.arial', value: 'Arial, sans-serif' },
          { label: 'properties.option.timesNewRoman', value: '"Times New Roman", serif' },
          { label: 'properties.option.courierNew', value: '"Courier New", monospace' },
          { label: 'properties.option.simSun', value: 'SimSun, serif' },
          { label: 'properties.option.simHei', value: 'SimHei, sans-serif' }
        ] },
        { label: 'properties.label.fontWeight', type: 'select', target: 'style', key: 'fontWeight', options: [
          { label: 'properties.option.default', value: '' },
          { label: 'properties.option.normal', value: '400' },
          { label: 'properties.option.medium', value: '500' },
          { label: 'properties.option.bold', value: '700' }
        ] }
      ]
    },
    {
      title: 'properties.section.labelStyle',
      tab: 'style',
      fields: [
        { label: 'properties.label.labelFontSize', type: 'number', target: 'element', key: 'labelFontSize', min: 8, max: 96, step: 1 },
        { label: 'properties.label.labelColor', type: 'color', target: 'element', key: 'labelColor' },
        { label: 'properties.label.labelFontFamily', type: 'select', target: 'element', key: 'labelFontFamily', options: [
          { label: 'properties.option.default', value: '' },
          { label: 'properties.option.arial', value: 'Arial, sans-serif' },
          { label: 'properties.option.timesNewRoman', value: '"Times New Roman", serif' },
          { label: 'properties.option.courierNew', value: '"Courier New", monospace' },
          { label: 'properties.option.simSun', value: 'SimSun, serif' },
          { label: 'properties.option.simHei', value: 'SimHei, sans-serif' }
        ] },
        { label: 'properties.label.labelFontWeight', type: 'select', target: 'element', key: 'labelFontWeight', options: [
          { label: 'properties.option.default', value: '' },
          { label: 'properties.option.normal', value: '400' },
          { label: 'properties.option.medium', value: '500' },
          { label: 'properties.option.bold', value: '700' }
        ] },
        { label: 'properties.label.labelBackgroundColor', type: 'color', target: 'element', key: 'labelBackgroundColor' },
        // Label Border
        { label: 'properties.label.labelBorderStyle', type: 'select', target: 'element', key: 'labelBorderStyle', options: [
            { label: 'properties.option.none', value: '' },
            { label: 'properties.option.solid', value: 'solid' },
            { label: 'properties.option.dashed', value: 'dashed' },
            { label: 'properties.option.dotted', value: 'dotted' }
          ]
        },
        { label: 'properties.label.labelBorderWidth', type: 'number', target: 'element', key: 'labelBorderWidth', min: 0, max: 20, step: 1 },
        { label: 'properties.label.labelBorderColor', type: 'color', target: 'element', key: 'labelBorderColor' }
      ]
    },
    {
      title: 'properties.section.frameBorder',
      tab: 'style',
      fields: [
        { label: 'properties.label.borderStyle', type: 'select', target: 'style', key: 'borderStyle', options: [
          { label: 'properties.option.none', value: 'none' },
          { label: 'properties.option.solid', value: 'solid' },
          { label: 'properties.option.dashed', value: 'dashed' },
          { label: 'properties.option.dotted', value: 'dotted' }
        ] },
        { label: 'properties.label.borderWidth', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'properties.label.borderColor', type: 'color', target: 'style', key: 'borderColor' },
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
