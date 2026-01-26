<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

defineProps<{
  label: string;
  value: string;
  disabled?: boolean;
}>();

const emit = defineEmits(['update:value']);

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update:value', target.value);
};
</script>

<template>
  <div class="flex items-center justify-between">
    <label class="text-xs text-gray-500">{{ label }}</label>
    <div class="flex items-center gap-2">
      <input
        type="text"
        :value="value"
        :disabled="disabled"
        @input="handleInput"
        class="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
        placeholder="#000000"
      />
      <input
        type="color"
        :value="value || '#000000'"
        :disabled="disabled"
        @input="handleInput"
        class="h-6 w-8 p-0 border border-gray-300 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  </div>
</template>