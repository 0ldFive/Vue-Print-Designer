<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  label: string;
  value?: string;
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits(['update:value']);
const { t } = useI18n();
const fileInput = ref<HTMLInputElement | null>(null);
const errorMessage = ref('');

const handleUploadClick = () => {
  if (props.disabled) return;
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Reset error
  errorMessage.value = '';

  // Check size (2MB = 2 * 1024 * 1024 bytes)
  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = t('properties.image.sizeError');
    // Clear input so same file can be selected again
    target.value = ''; 
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result as string;
    emit('update:value', result);
  };
  reader.onerror = () => {
    errorMessage.value = t('properties.image.readError');
  };
  reader.readAsDataURL(file);
  
  // Clear input
  target.value = '';
};

const handleTextInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update:value', target.value);
};
</script>

<template>
  <div>
    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</label>
    
    <div class="space-y-2">
      <!-- URL Input -->
      <input
        type="text"
        :value="value || ''"
        :disabled="disabled"
        :placeholder="placeholder || t('properties.image.urlPlaceholder')"
        @input="handleTextInput"
        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-400 outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
      />
      
      <!-- Upload Button -->
      <div class="flex flex-col gap-1">
        <button
          type="button"
          @click="handleUploadClick"
          :disabled="disabled"
          class="w-full py-1.5 px-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {{ t('properties.image.uploadBtn') }}
        </button>
        <span class="text-[10px] text-gray-400 dark:text-gray-500 text-center">{{ t('properties.image.uploadTip') }}</span>
      </div>

      <!-- Error Message -->
      <p v-if="errorMessage" class="text-xs text-red-500 mt-1">{{ errorMessage }}</p>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>
