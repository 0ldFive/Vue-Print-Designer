<script setup lang="ts">
import { ref, watch } from 'vue';
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
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50">
    <div class="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="h-14 border-b border-gray-200 px-4 flex items-center justify-between bg-gray-50">
        <h2 class="font-semibold text-gray-700">Print Preview</h2>
        <div class="flex items-center gap-3">
          <button 
            @click="handlePrint"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Printer class="text-lg" />
            Print
          </button>
          <button 
            @click="handlePdf"
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2 text-sm"
          >
            <FilePdf class="text-lg" />
            Export PDF
          </button>
          <button 
            @click="handleClose"
            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2"
          >
            <Close class="text-lg" />
            Close
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div 
          ref="previewContainer"
          class="preview-content shadow-lg bg-white"
          :style="{ width: `${width}px` }"
          v-html="htmlContent"
        ></div>
      </div>
    </div>
  </div>
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
