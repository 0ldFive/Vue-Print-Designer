<script setup lang="ts">
import type { PrintElement } from '@/types';

defineProps<{
  element: PrintElement;
}>();
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
