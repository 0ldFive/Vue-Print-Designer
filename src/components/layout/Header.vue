<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDesignerStore } from '@/stores/designer';
import { Printer, FileOutput, ZoomIn, ZoomOut, Settings } from 'lucide-vue-next';
import { PAPER_SIZES, type PaperSizeKey } from '@/constants/paper';

const store = useDesignerStore();

const selectedPaper = ref<PaperSizeKey>('A4');
const customWidth = ref(PAPER_SIZES.A4.width);
const customHeight = ref(PAPER_SIZES.A4.height);
const showPaperSettings = ref(false);

const handlePaperChange = () => {
  if (selectedPaper.value !== 'CUSTOM') {
    const size = PAPER_SIZES[selectedPaper.value];
    customWidth.value = size.width;
    customHeight.value = size.height;
    store.setCanvasSize(size.width, size.height);
  }
};

const applyCustomSize = () => {
  store.setCanvasSize(customWidth.value, customHeight.value);
  if (!Object.values(PAPER_SIZES).some(s => s.width === customWidth.value && s.height === customHeight.value)) {
    selectedPaper.value = 'CUSTOM';
  }
};

// Sync local state with store
watch(() => store.canvasSize, (newSize) => {
  customWidth.value = newSize.width;
  customHeight.value = newSize.height;
  
  // Find matching paper size
  const match = Object.entries(PAPER_SIZES).find(([_, size]) => 
    size.width === newSize.width && size.height === newSize.height
  );
  
  if (match) {
    selectedPaper.value = match[0] as PaperSizeKey;
  } else {
    selectedPaper.value = 'CUSTOM';
  }
}, { immediate: true });

const handleZoomIn = () => {
  store.setZoom(Math.min(store.zoom + 0.1, 3));
};

const handleZoomOut = () => {
  store.setZoom(Math.max(store.zoom - 0.1, 0.5));
};

const handlePrint = () => {
  window.print();
};

const handleExport = async () => {
  const previousSelection = store.selectedElementId;
  const previousShowGrid = store.showGrid;

  store.selectElement(null);
  store.setShowGrid(false);
  await nextTick();

  try {
    const pages = document.querySelectorAll('.print-page');
    if (!pages.length) return;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [store.canvasSize.width, store.canvasSize.height],
      hotfixes: ['px_scaling']
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;
      
      const canvas = await html2canvas(page, {
        scale: 1,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      
      if (i > 0) {
        pdf.addPage([store.canvasSize.width, store.canvasSize.height]);
      }
      
      pdf.addImage(imgData, 'PNG', 0, 0, store.canvasSize.width, store.canvasSize.height);
    }

    pdf.save('print-design.pdf');
  } catch (error) {
    console.error('Export failed', error);
    alert('Export failed');
  } finally {
    store.setShowGrid(previousShowGrid);
    store.selectElement(previousSelection);
  }
};
</script>

<template>
  <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50 relative shadow-sm">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">P</div>
      <h1 class="font-semibold text-gray-700">Print Designer</h1>
    </div>

    <div class="flex items-center gap-4">
      <!-- Paper Settings -->
      <div class="relative">
        <button 
          @click="showPaperSettings = !showPaperSettings"
          class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          <Settings class="w-4 h-4" />
          <span>{{ selectedPaper === 'CUSTOM' ? 'Custom' : selectedPaper }}</span>
        </button>

        <div v-if="showPaperSettings" class="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-4 z-50">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Paper Settings</h3>
          
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Size Preset</label>
              <select 
                v-model="selectedPaper" 
                @change="handlePaperChange"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
              >
                <option v-for="(size, key) in PAPER_SIZES" :key="key" :value="key">
                  {{ key }} ({{ size.width }}x{{ size.height }})
                </option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Width (px)</label>
                <input 
                  type="number" 
                  v-model.number="customWidth"
                  @change="applyCustomSize"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Height (px)</label>
                <input 
                  type="number" 
                  v-model.number="customHeight"
                  @change="applyCustomSize"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
          
          <div 
            class="fixed inset-0 z-[-1]" 
            @click="showPaperSettings = false"
          ></div>
        </div>
      </div>

      <div class="h-6 w-px bg-gray-300"></div>

      <div class="flex items-center bg-gray-100 rounded-lg p-1">
        <button @click="handleZoomOut" class="p-1 hover:bg-gray-200 rounded" title="Zoom Out">
          <ZoomOut class="w-4 h-4" />
        </button>
        <span class="text-xs w-12 text-center">{{ Math.round(store.zoom * 100) }}%</span>
        <button @click="handleZoomIn" class="p-1 hover:bg-gray-200 rounded" title="Zoom In">
          <ZoomIn class="w-4 h-4" />
        </button>
      </div>
      
      <div class="h-6 w-px bg-gray-300"></div>

      <button @click="handlePrint" class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
        <Printer class="w-4 h-4" />
        <span>Print</span>
      </button>

      <button @click="handleExport" class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm">
        <FileOutput class="w-4 h-4" />
        <span>Export PDF</span>
      </button>
    </div>
  </header>
</template>
