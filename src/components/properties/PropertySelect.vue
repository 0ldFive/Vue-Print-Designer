<script setup lang="ts">


interface Option {
  label: string;
  value: string | number | boolean;
}

const props = defineProps<{
  label: string;
  value?: string | number | boolean;
  options: Option[];
  disabled?: boolean;
}>();

const emit = defineEmits(['update:value']);

const handleChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  const val = target.value;
  // Find the option to get the correct type (number/boolean)
  const option = props.options.find(opt => String(opt.value) === val);
  emit('update:value', option ? option.value : val);
};
</script>

<template>
  <div>
    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</label>
    <select
      :value="value"
      :disabled="disabled"
      @change="handleChange"
      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-400 outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
    >
      <option v-for="opt in options" :key="String(opt.value)" :value="opt.value" class="dark:bg-gray-800 dark:text-gray-200">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>