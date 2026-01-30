<script setup lang="ts">
import { computed } from 'vue';
import type { PrintElement } from '@/types';

const props = defineProps<{
  element: PrintElement;
}>();

const cellStyle = computed(() => ({
  borderStyle: props.element.style.borderStyle || 'solid',
  borderWidth: props.element.style.borderWidth !== undefined ? `${props.element.style.borderWidth}px` : '1px',
  borderColor: props.element.style.borderColor || '#e5e7eb'
}));

const processedData = computed(() => {
  let data = props.element.data || [];
  let columns = props.element.columns || [];
  let footerData = props.element.footerData || [];

  if (props.element.customScript) {
    try {
      // Safe-ish execution
      const fn = new Function('data', 'columns', 'footerData', props.element.customScript);
      const result = fn(data, columns, footerData);
      if (result) {
        if (result.data) data = result.data;
        // We generally don't expect columns to change, but why not
        if (result.columns) columns = result.columns;
        if (result.footerData) footerData = result.footerData;
      }
    } catch (e) {
      console.error('Custom Script Error:', e);
    }
  }
  return { data, columns, footerData };
});

const getCellValue = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'value' in val) {
    return val.value;
  }
  return val;
};

const getRowSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'rowSpan' in val) {
    return val.rowSpan;
  }
  return 1;
};

const getColSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'colSpan' in val) {
    return val.colSpan;
  }
  return 1;
};

const getCellStyle = (row: any, field: string) => {
  const val = row[field];
  const style = { ...cellStyle.value };
  
  if (val && typeof val === 'object' && 'style' in val) {
    Object.assign(style, val.style);
  }
  return style;
};

const shouldRenderCell = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object') {
    if (val.rowSpan === 0 || val.colSpan === 0) return false;
  }
  return true;
};
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'Data & Behavior',
      tab: 'properties',
      fields: [
        { label: 'Auto Paginate', type: 'switch', target: 'element', key: 'autoPaginate' },
        { label: 'Repeat Footer', type: 'switch', target: 'element', key: 'tfootRepeat' },
        { label: 'Show Footer', type: 'switch', target: 'element', key: 'showFooter' },
        { label: 'Variable (@foobar)', type: 'text', target: 'element', key: 'variable', placeholder: '@foobar' },
        { label: 'Columns (JSON)', type: 'textarea', target: 'element', key: 'columns', placeholder: '[{ field: "name", header: "Name", width: 100 }]' },
        { label: 'Data (JSON)', type: 'textarea', target: 'element', key: 'data', placeholder: '[{...}]' },
        { label: 'Footer Data (JSON)', type: 'textarea', target: 'element', key: 'footerData', placeholder: '[{...}]' },
        { label: 'Custom Script', type: 'textarea', target: 'element', key: 'customScript', placeholder: 'return { data: ... };' }
      ]
    },
    {
      title: 'Layout & Dimensions',
      tab: 'style',
      fields: [
        { label: 'Header Height (px)', type: 'number', target: 'style', key: 'headerHeight', min: 20, max: 200, step: 1 },
        { label: 'Row Height (px)', type: 'number', target: 'style', key: 'rowHeight', min: 20, max: 200, step: 1 },
        { label: 'Footer Height (px)', type: 'number', target: 'style', key: 'footerHeight', min: 20, max: 200, step: 1 },
      ]
    },
    {
      title: 'Header Style',
      tab: 'style',
      fields: [
        { label: 'Background', type: 'color', target: 'style', key: 'headerBackgroundColor' },
        { label: 'Text Color', type: 'color', target: 'style', key: 'headerColor' },
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'headerFontSize', min: 8, max: 72, step: 1 }
      ]
    },
    {
      title: 'Footer Style',
      tab: 'style',
      fields: [
        { label: 'Background', type: 'color', target: 'style', key: 'footerBackgroundColor' },
        { label: 'Text Color', type: 'color', target: 'style', key: 'footerColor' },
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'footerFontSize', min: 8, max: 72, step: 1 }
      ]
    },
    {
      title: 'Border',
      tab: 'style',
      fields: [
        { label: 'Border Style', type: 'select', target: 'style', key: 'borderStyle', options: [
            { label: 'None', value: 'none' },
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' }
          ]
        },
        { label: 'Border Width (px)', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'Border Color', type: 'color', target: 'style', key: 'borderColor' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-white">
    <table class="w-full border-collapse" :data-tfoot-repeat="element.tfootRepeat" :data-auto-paginate="element.autoPaginate">
      <thead>
        <tr>
          <th 
            v-for="col in processedData.columns" 
            :key="col.field"
            class="p-1 text-left font-bold text-sm"
            :style="{ 
               ...cellStyle, 
               width: `${col.width}px`, 
               height: element.style.headerHeight ? `${element.style.headerHeight}px` : undefined,
               backgroundColor: element.style.headerBackgroundColor || '#f3f4f6',
              color: element.style.headerColor || '#000000',
              fontSize: element.style.headerFontSize ? `${element.style.headerFontSize}px` : undefined
            }"
          >
            {{ col.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in processedData.data" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm"
               :style="{
                 ...getCellStyle(row, col.field),
                 height: element.style.rowHeight ? `${element.style.rowHeight}px` : undefined
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
             >
               {{ getCellValue(row, col.field) }}
             </td>
          </template>
        </tr>
      </tbody>
      <tfoot v-if="element.showFooter">
        <tr v-for="(row, i) in processedData.footerData" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm font-bold"
                :style="{ 
                  ...getCellStyle(row, col.field), 
                  height: element.style.footerHeight ? `${element.style.footerHeight}px` : undefined,
                  backgroundColor: element.style.footerBackgroundColor || '#f9fafb',
                 color: element.style.footerColor || '#000000',
                 fontSize: element.style.footerFontSize ? `${element.style.footerFontSize}px` : undefined
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
             >
               {{ getCellValue(row, col.field) }}
             </td>
          </template>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
