<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import Close from '~icons/material-symbols/close';

const props = defineProps<{
  show: boolean;
  initialName?: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', name: string): void;
}>();

const name = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.show, (val) => {
  if (val) {
    name.value = props.initialName || '';
    setTimeout(() => {
      inputRef.value?.focus();
    }, 100);
  }
});

const handleSave = () => {
  if (!name.value.trim()) return;
  emit('save', name.value.trim());
  emit('close');
};
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
    <div class="bg-white rounded-lg shadow-xl w-96 p-4 animate-in fade-in zoom-in duration-200">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800">{{ title || 'Save Template' }}</h3>
        <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <Close class="w-5 h-5" />
        </button>
      </div>
      
      <div class="mb-4">
        <input 
          ref="inputRef"
          v-model="name"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter template name..."
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
          :disabled="!name.trim()"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
</template>
