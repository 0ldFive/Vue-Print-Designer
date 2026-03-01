<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import Close from '~icons/material-symbols/close';
import { useDesignerStore } from '@/stores/designer';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{
  show: boolean;
  initialValue?: string;
  title?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', value: string): void;
}>();

const { t } = useI18n();
const { isDark } = useTheme();
const designerStore = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));

const value = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.show, (val) => {
  if (val) {
    value.value = props.initialValue || '';
    setTimeout(() => {
      inputRef.value?.focus();
    }, 100);
    designerStore.setDisableGlobalShortcuts(true);
    return;
  }
  designerStore.setDisableGlobalShortcuts(false);
});

const handleSave = () => {
  if (!value.value.trim()) return;
  emit('save', value.value.trim());
  emit('close');
};

onUnmounted(() => {
  if (props.show) {
    designerStore.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div v-if="show" :class="{ 'dark': isDark }" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 pointer-events-auto">
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-96 animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden">
        <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ title || t('input.title') }}</h3>
          <button @click="emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400">
            <Close class="w-4 h-4" />
          </button>
        </div>
        
        <div class="p-4">
          <div class="mb-4">
            <input 
              ref="inputRef"
              v-model="value"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :placeholder="placeholder || t('input.placeholder')"
              @keydown.enter="handleSave"
              @keydown.esc="emit('close')"
            />
          </div>
          
          <div class="flex justify-end gap-2">
            <button 
              @click="emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              {{ t('common.cancel') }}
            </button>
            <button 
              @click="handleSave"
              :disabled="!value.trim()"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
