<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { PAPER_SIZES, type PaperSizeKey } from '@/constants/paper';
import { pxToMm, mmToPx } from '@/utils/units';
import Settings from '~icons/material-symbols/settings';
import ChevronDown from '~icons/material-symbols/expand-more';
import Plus from '~icons/material-symbols/add';
import ColorPicker from '@/components/common/ColorPicker.vue';

const { t } = useI18n();
const store = useDesignerStore();

const selectedPaper = ref<PaperSizeKey>('A4');
const customWidth = ref(PAPER_SIZES.A4.width);
const customHeight = ref(PAPER_SIZES.A4.height);
const showPaperSettings = ref(false);

const canvasBackground = computed({
  get: () => store.canvasBackground,
  set: (val) => store.setCanvasBackground(val)
});

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
</script>

<template>
  <div class="relative">
    <div class="flex items-center bg-gray-100 rounded-lg p-1">
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="p-1 hover:bg-gray-200 rounded transition-colors"
        :title="t('editor.paperSettings')"
      >
        <Settings class="w-4 h-4" />
      </button>
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="flex items-center justify-center text-xs text-gray-700 hover:bg-gray-200 rounded px-1 py-0.5 transition-colors w-16 text-center"
        :title="t('editor.paperSettings')"
      >
        <span class="truncate">{{ selectedPaper === 'CUSTOM' ? t('editor.custom') : selectedPaper }}</span>
      </button>
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="p-1 hover:bg-gray-200 rounded transition-colors"
        :title="t('editor.paperSettings')"
      >
        <ChevronDown class="w-4 h-4" />
      </button>
    </div>

    <div v-if="showPaperSettings" class="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-4 z-[1000]">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ t('editor.paperSettings') }}</h3>
      
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">{{ t('editor.sizePreset') }}</label>
          <select 
            v-model="selectedPaper" 
            @change="handlePaperChange"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          >
            <option v-for="(size, key) in PAPER_SIZES" :key="key" :value="key">
              {{ key }} ({{ pxToMm(size.width) }}mm x {{ pxToMm(size.height) }}mm)
            </option>
            <option value="CUSTOM">{{ t('editor.custom') }}</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-gray-500 mb-1">{{ t('common.width') }} ({{ t('common.mm') }})</label>
            <input 
              type="number" 
              :value="pxToMm(customWidth)"
              @change="(e) => { customWidth = mmToPx(Number((e.target as HTMLInputElement).value)); applyCustomSize(); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">{{ t('common.height') }} ({{ t('common.mm') }})</label>
            <input 
              type="number" 
              :value="pxToMm(customHeight)"
              @change="(e) => { customHeight = mmToPx(Number((e.target as HTMLInputElement).value)); applyCustomSize(); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>
      
      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-gray-700 font-medium">{{ t('editor.showCornerMarkers') }}</span>
        <button 
          @click="store.setShowCornerMarkers(!store.showCornerMarkers)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showCornerMarkers ? 'bg-blue-600' : 'bg-gray-200'"
        >
          <span class="sr-only">Toggle corner markers</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showCornerMarkers ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 font-medium">{{ t('editor.showGrid') }}</span>
        <button 
          @click="store.setShowGrid(!store.showGrid)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showGrid ? 'bg-blue-600' : 'bg-gray-200'"
        >
          <span class="sr-only">Toggle grid</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showGrid ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 font-medium">{{ t('editor.showMinimap') }}</span>
        <button 
          @click="store.setShowMinimap(!store.showMinimap)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showMinimap ? 'bg-blue-600' : 'bg-gray-200'"
        >
          <span class="sr-only">Toggle minimap</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showMinimap ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 font-medium">{{ t('editor.backgroundColor') }}</span>
        <ColorPicker 
          v-model="canvasBackground" 
          :allow-transparent="true"
          default-color="#ffffff"
          placement="bottom-end"
        >
          <template #trigger="{ color, open }">
            <div 
              class="w-8 h-6 rounded border border-gray-300 cursor-pointer relative overflow-hidden hover:border-blue-500 transition-colors"
              :class="{ 'ring-2 ring-blue-500 ring-offset-1': open }"
            >
              <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50"></div>
              <div class="absolute inset-0" :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"></div>
              <div v-if="color === 'transparent'" class="absolute inset-0 flex items-center justify-center">
                  <div class="w-full h-[1px] bg-red-500 rotate-45"></div>
              </div>
            </div>
          </template>
        </ColorPicker>
      </div>

      <div class="border-t border-gray-200 my-4 pt-3">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ t('editor.headerFooter') }}</h3>
        
        <div class="space-y-3">
          <!-- Header Settings -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
               <button 
                @click="store.setShowHeaderLine(!store.showHeaderLine)"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                :class="store.showHeaderLine ? 'bg-blue-600' : 'bg-gray-200'"
              >
                <span class="sr-only">Toggle header line</span>
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="store.showHeaderLine ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <label class="text-xs text-gray-600">{{ t('editor.headerLine') }}</label>
            </div>
            <div class="flex items-center gap-1">
              <input 
                type="number" 
                :value="pxToMm(store.headerHeight)"
                @change="e => store.setHeaderHeight(mmToPx(Number((e.target as HTMLInputElement).value)))"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none text-right"
                min="0"
              />
              <span class="text-xs text-gray-500">{{ t('common.mm') }}</span>
            </div>
          </div>

          <!-- Footer Settings -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
               <button 
                @click="store.setShowFooterLine(!store.showFooterLine)"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                :class="store.showFooterLine ? 'bg-blue-600' : 'bg-gray-200'"
              >
                <span class="sr-only">Toggle footer line</span>
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="store.showFooterLine ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <label class="text-xs text-gray-600">{{ t('editor.footerLine') }}</label>
            </div>
            <div class="flex items-center gap-1">
              <input 
                type="number" 
                :value="pxToMm(store.footerHeight)"
                @change="e => store.setFooterHeight(mmToPx(Number((e.target as HTMLInputElement).value)))"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none text-right"
                min="0"
              />
              <span class="text-xs text-gray-500">{{ t('common.mm') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-3 mt-3">
        <button 
          @click="store.addPage(); showPaperSettings = false" 
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors text-sm font-medium"
        >
          <Plus class="w-4 h-4" />
          <span>{{ t('editor.addNewPage') }}</span>
        </button>
      </div>
      
      <div 
        class="fixed inset-0 z-[-1]" 
        @click="showPaperSettings = false"
      ></div>
    </div>
  </div>
</template>
