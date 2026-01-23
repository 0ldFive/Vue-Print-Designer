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
      title: 'Table Settings',
      fields: [
        { label: 'Auto Paginate', type: 'action', target: 'element', actionName: 'paginateTable' },
        { label: 'Header Height (px)', type: 'number', target: 'style', key: 'headerHeight', min: 20, max: 200, step: 1 },
        { label: 'Row Height (px)', type: 'number', target: 'style', key: 'rowHeight', min: 20, max: 200, step: 1 },
        { label: 'Data (JSON)', type: 'textarea', target: 'element', key: 'data', placeholder: '[{...}]' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-white">
    <table class="w-full border-collapse" :style="{
      borderColor: element.style.borderColor || '#000',
      borderWidth: `${element.style.borderWidth || 1}px`
    }">
      <thead>
        <tr>
          <th 
            v-for="col in element.columns" 
            :key="col.field"
            class="border p-1 text-left bg-gray-100 font-bold text-sm"
            :style="{ width: `${col.width}px` }"
          >
            {{ col.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in element.data" :key="i">
          <td 
            v-for="col in element.columns" 
            :key="col.field"
            class="border p-1 text-sm"
          >
            {{ row[col.field] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
