<script setup lang="ts">


defineProps<{
  label: string;
  value?: string | number | boolean;
  type?: 'text' | 'number' | 'textarea' | 'switch';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}>();

const emit = defineEmits(['update:value']);

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update:value', target.value);
};
</script>

<template>
  <div v-if="type === 'switch'" class="flex items-center justify-between">
    <label class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ label }}</label>
    <button 
      type="button"
      :disabled="disabled"
      @click="$emit('update:value', !value)"
      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      :class="value ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
    >
      <span class="sr-only">Toggle {{ label }}</span>
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
        :class="value ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>

  <div v-else>
    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</label>
    
    <textarea
      v-if="type === 'textarea'"
      :value="value === undefined || value === null ? '' : String(value)"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="handleInput"
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-400 outline-none h-24 resize-y disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
    ></textarea>
    <input
      v-else
      :type="type || 'text'"
      :value="value === undefined || value === null ? '' : String(value)"
      :disabled="disabled"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      @input="handleInput"
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-400 outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
    />
  </div>
</template>