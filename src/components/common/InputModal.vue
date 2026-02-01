<script setup lang="ts">
import { ref, watch } from 'vue';
import Close from '~icons/material-symbols/close';

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

const value = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.show, (val) => {
  if (val) {
    value.value = props.initialValue || '';
    setTimeout(() => {
      inputRef.value?.focus();
    }, 100);
  }
});

const handleSave = () => {
  if (!value.value.trim()) return;
  emit('save', value.value.trim());
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-lg shadow-xl w-96 animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden">
        <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
          <h3 class="text-lg font-semibold text-gray-800">{{ title || 'Input' }}</h3>
          <button @click="emit('close')" class="text-gray-500 hover:text-gray-700 transition-colors">
            <Close class="w-5 h-5" />
          </button>
        </div>
        
        <div class="p-4">
          <div class="mb-4">
            <input 
              ref="inputRef"
              v-model="value"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              :placeholder="placeholder || 'Enter value...'"
              @keydown.enter="handleSave"
              @keydown.esc="emit('close')"
            />
          </div>
          
          <div class="flex justify-end gap-2">
            <button 
              @click="emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="handleSave"
              :disabled="!value.trim()"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
