<script setup lang="ts">


interface Option {
  label: string;
  value: string | number;
}

defineProps<{
  label: string;
  value?: string | number;
  options: Option[];
  disabled?: boolean;
}>();

const emit = defineEmits(['update:value']);

const handleChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  emit('update:value', target.value);
};
</script>

<template>
  <div>
    <label class="block text-xs text-gray-500 mb-1">{{ label }}</label>
    <select
      :value="value"
      :disabled="disabled"
      @change="handleChange"
      class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
    >
      <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>