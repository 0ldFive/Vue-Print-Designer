<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePrint } from '@/utils/print';
import { useDesignerStore } from '@/stores/designer';
import Printer from '~icons/material-symbols/print';
import FilePdf from '~icons/material-symbols/picture-as-pdf';
import Image from '~icons/material-symbols/image';
import Close from '~icons/material-symbols/close';
import ZoomIn from '~icons/material-symbols/zoom-in';
import ZoomOut from '~icons/material-symbols/zoom-out';
import DataObject from '~icons/material-symbols/data-object';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import cloneDeep from 'lodash/cloneDeep';

const props = defineProps<{
  visible: boolean;
  htmlContent: string;
  width: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const { print: printHtml, exportPdf: exportPdfHtml, getPdfBlob, exportImages } = usePrint();
const previewContainer = ref<HTMLElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const zoomPercent = ref(100);
const showJsonModal = ref(false);
const jsonContent = ref('');
const modalTitle = ref('');
const modalLanguage = ref('json');

watch(() => props.visible, (val) => {
  if (!val) {
    zoomPercent.value = 100;
  }
});

const handleClose = () => {
  emit('update:visible', false);
};

const handleViewJson = () => {
  const data = {
    pages: cloneDeep(store.pages),
    canvasSize: cloneDeep(store.canvasSize),
    guides: cloneDeep(store.guides),
    zoom: store.zoom,
    showGrid: store.showGrid,
    headerHeight: store.headerHeight,
    footerHeight: store.footerHeight,
    showHeaderLine: store.showHeaderLine,
    showFooterLine: store.showFooterLine,
    showMinimap: store.showMinimap,
    canvasBackground: store.canvasBackground,
  };
  jsonContent.value = JSON.stringify(data, null, 2);
  modalTitle.value = t('preview.templateJson');
  modalLanguage.value = 'json';
  showJsonModal.value = true;
};

const handleViewBlob = async () => {
  try {
      if (!previewContainer.value) return;
      // Use elements within the preview container
      const pages = Array.from(previewContainer.value.querySelectorAll('.print-page')) as HTMLElement[];
      const blob = await getPdfBlob(pages);
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
          jsonContent.value = reader.result as string;
          modalTitle.value = t('editor.viewBlob');
          modalLanguage.value = 'text';
          showJsonModal.value = true;
      }
  } catch (e) {
      console.error(e);
      alert('Failed to generate blob');
  }
};

const handlePrint = () => {
  if (previewContainer.value) {
    printHtml(previewContainer.value);
  }
};

const handlePdf = () => {
  if (previewContainer.value) {
    const pages = Array.from(previewContainer.value.querySelectorAll('.print-page')) as HTMLElement[];
    exportPdfHtml(pages);
  }
};

const handleExportImages = async () => {
  if (previewContainer.value) {
    const pages = Array.from(previewContainer.value.querySelectorAll('.print-page')) as HTMLElement[];
    await exportImages(pages);
  }
};

const handleZoomIn = () => {
  zoomPercent.value = Math.min(500, zoomPercent.value + 10);
};

const handleZoomOut = () => {
  zoomPercent.value = Math.max(20, zoomPercent.value - 10);
};

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }
};

const handleCtrlKey = (e: KeyboardEvent) => {
  if (e.key === 'Control' || e.key === 'Meta') {
    if (e.type === 'keydown' && !e.repeat) {
      wrapperRef.value?.addEventListener('wheel', handleWheel, { passive: false });
    } else if (e.type === 'keyup') {
      wrapperRef.value?.removeEventListener('wheel', handleWheel);
    }
  }
};

const handleBlur = () => {
  wrapperRef.value?.removeEventListener('wheel', handleWheel);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === 'Escape') {
    handleClose();
  }
  handleCtrlKey(e);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleCtrlKey);
  window.addEventListener('blur', handleBlur);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('keyup', handleCtrlKey);
  window.removeEventListener('blur', handleBlur);
  wrapperRef.value?.removeEventListener('wheel', handleWheel);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="relative flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">{{ t('preview.title') }}</h3>
          
          <!-- Zoom Control -->
          <div class="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <button @click="handleZoomOut" class="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors" :title="t('preview.zoomOut')">
              <ZoomOut class="w-4 h-4" />
            </button>
            <input 
              type="range" 
              min="20" 
              max="500" 
              step="10" 
              v-model.number="zoomPercent" 
              class="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
            />
            <button @click="handleZoomIn" class="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors" :title="t('preview.zoomIn')">
              <ZoomIn class="w-4 h-4" />
            </button>
            <span class="text-xs text-gray-600 w-9 text-right select-none">{{ zoomPercent }}%</span>
          </div>

          <button @click="handleClose" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <Close class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center" ref="wrapperRef">
          <div 
            ref="previewContainer"
            class="preview-content"
            :style="`width: ${width}px; zoom: ${zoomPercent / 100}`"
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
            {{ t('editor.print') }}
          </button>
          <button 
            @click="handlePdf"
            class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2 text-sm transition-colors"
          >
            <FilePdf class="text-lg" />
            {{ t('editor.exportPdf') }}
          </button>
          <button 
            @click="handleExportImages"
            class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2 text-sm transition-colors"
          >
            <Image class="text-lg" />
            {{ t('editor.exportImage') }}
          </button>
          <button 
            @click="handleViewJson"
            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 transition-colors"
          >
            <DataObject class="text-lg" />
            {{ t('editor.viewJson') }}
          </button>
          <button 
            @click="handleViewBlob"
            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 transition-colors"
          >
            <DataObject class="text-lg" />
            {{ t('editor.viewBlob') }}
          </button>
          <button 
            @click="handleClose"
            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 transition-colors"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <CodeEditorModal
    v-model:visible="showJsonModal"
    :title="modalTitle"
    :value="jsonContent"
    :language="modalLanguage"
    read-only
  />
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

/* Force default cursor for all elements in preview */
.preview-content :deep(*) {
  cursor: default !important;
}
</style>
