<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { usePrint } from '@/utils/print';
import Printer from '~icons/material-symbols/print';
import FilePdf from '~icons/material-symbols/picture-as-pdf';
import Close from '~icons/material-symbols/close';

const props = defineProps<{
  visible: boolean;
  htmlContent: string;
  width: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const { print: printHtml, exportPdf: exportPdfHtml } = usePrint();
const previewContainer = ref<HTMLElement | null>(null);

const handleClose = () => {
  emit('update:visible', false);
};

const handlePrint = () => {
  if (previewContainer.value) {
    printHtml(previewContainer.value);
  }
};

const handlePdf = () => {
  if (previewContainer.value) {
    exportPdfHtml(previewContainer.value);
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === 'Escape') {
    handleClose();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">Print Preview</h3>
          <button @click="handleClose" class="text-gray-500 hover:text-gray-700">
            <Close class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
          <div 
            ref="previewContainer"
            class="preview-content"
            :style="{ width: `${width}px` }"
            v-html="htmlContent"
          ></div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <button 
            @click="handlePrint"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm transition-colors"
          >
            <Printer class="text-lg" />
            Print
          </button>
          <button 
            @click="handlePdf"
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2 text-sm transition-colors"
          >
            <FilePdf class="text-lg" />
            Export PDF
          </button>
          <button 
            @click="handleClose"
            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Ensure the preview content styling matches print expectations */
:deep(.print-page) {
  margin-bottom: 20px;
  background: white;
  box-shadow: none !important; /* Remove shadows in preview if desired, or keep for visual separation */
  position: relative !important; /* Reset position for stack flow */
  left: auto !important;
  top: auto !important;
}

/* Hide the last margin */
:deep(.print-page:last-child) {
  margin-bottom: 0;
}
</style>
