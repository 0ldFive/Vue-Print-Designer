<script setup lang="ts">
import ColorPicker from '@/components/common/ColorPicker.vue';
import FormatColorReset from '~icons/material-symbols/format-color-reset';

defineProps<{
  label: string;
  value?: string;
  disabled?: boolean;
}>();

const emit = defineEmits(['update:value']);
</script>

<template>
  <div class="flex items-center justify-between">
    <label class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</label>
    <div class="flex items-center gap-2">
      <ColorPicker
        :model-value="value"
        @update:model-value="(val) => emit('update:value', val)"
        :disabled="disabled"
        :allow-transparent="true"
      >
        <template #trigger="{ color, open }">
          <div 
            class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            :class="{ 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900': open, 'opacity-50 cursor-not-allowed': disabled }"
          >
            <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50"></div>
            <div class="absolute inset-0" :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"></div>
            <div v-if="color === 'transparent'" class="absolute inset-0 flex items-center justify-center">
                <div class="w-full h-[1px] bg-red-500 rotate-45"></div>
            </div>
          </div>
        </template>
      </ColorPicker>
    </div>
  </div>
</template>
