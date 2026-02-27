<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { PAPER_SIZES, type PaperSizeKey } from '@/constants/paper';
import { pxToUnit, unitToPx, type Unit } from '@/utils/units';
import Settings from '~icons/material-symbols/settings';
import ChevronDown from '~icons/material-symbols/expand-more';
import Plus from '~icons/material-symbols/add';
import X from '~icons/material-symbols/close';
import ColorPicker from '@/components/common/ColorPicker.vue';

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));

const selectedPaper = ref<PaperSizeKey>('A4');
const customWidth = ref(PAPER_SIZES.A4.width);
const customHeight = ref(PAPER_SIZES.A4.height);
const showPaperSettings = ref(false);
const showAdvancedSettings = ref(false);

const canvasBackground = computed({
  get: () => store.canvasBackground,
  set: (val) => store.setCanvasBackground(val)
});

const watermarkText = computed({
  get: () => store.watermark?.text || '',
  set: (val) => store.setWatermark({ text: val })
});

const watermarkEnabled = computed({
  get: () => store.watermark?.enabled ?? false,
  set: (val) => store.setWatermark({ enabled: Boolean(val) })
});

const watermarkAngle = computed({
  get: () => store.watermark?.angle ?? -30,
  set: (val) => store.setWatermark({ angle: Number(val) })
});

const watermarkColor = computed({
  get: () => store.watermark?.color || '#000000',
  set: (val) => store.setWatermark({ color: val })
});

const watermarkOpacity = computed({
  get: () => Math.round(((store.watermark?.opacity ?? 0.1) * 100) as number),
  set: (val) => {
    const next = Math.max(0, Math.min(100, Number(val)));
    store.setWatermark({ opacity: next / 100 });
  }
});

const watermarkSize = computed({
  get: () => formatUnitValue(store.watermark?.size ?? 24),
  set: (val) => store.setWatermark({ size: unitToPx(Number(val), store.unit as Unit) })
});

const watermarkDensity = computed({
  get: () => formatUnitValue(store.watermark?.density ?? 160),
  set: (val) => store.setWatermark({ density: unitToPx(Number(val), store.unit as Unit) })
});

const pageSpacingX = computed({
  get: () => formatUnitValue(store.pageSpacingX || 0),
  set: (val) => store.setPageSpacingX(unitToPx(Number(val), store.unit as Unit))
});

const pageSpacingY = computed({
  get: () => formatUnitValue(store.pageSpacingY || 0),
  set: (val) => store.setPageSpacingY(unitToPx(Number(val), store.unit as Unit))
});

const unitLabel = computed(() => {
  if (store.unit === 'px') return t('common.px');
  if (store.unit === 'pt') return t('common.pt');
  return t('common.mm');
});

const formatUnitValue = (px: number) => {
  const value = pxToUnit(px, store.unit as Unit);
  return store.unit === 'px' ? Math.round(value) : Number(value.toFixed(1));
};

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
    <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors dark:text-gray-200"
        :title="t('editor.paperSettings')"
      >
        <Settings class="w-4 h-4" />
      </button>
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors w-16 text-center"
        :title="t('editor.paperSettings')"
      >
        <span class="truncate">{{ selectedPaper === 'CUSTOM' ? t('editor.custom') : selectedPaper }}</span>
      </button>
      <button 
        @click="showPaperSettings = !showPaperSettings"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors dark:text-gray-200"
        :title="t('editor.paperSettings')"
      >
        <ChevronDown class="w-4 h-4" />
      </button>
    </div>

    <div v-if="showPaperSettings" class="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-4 z-[1000]">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{{ t('editor.paperSettings') }}</h3>
      
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.sizePreset') }}</label>
          <select 
            v-model="selectedPaper" 
            @change="handlePaperChange"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
          >
            <option v-for="(size, key) in PAPER_SIZES" :key="key" :value="key" class="dark:bg-gray-800 dark:text-gray-200">
              {{ key }} ({{ formatUnitValue(size.width) }}{{ unitLabel }} x {{ formatUnitValue(size.height) }}{{ unitLabel }})
            </option>
            <option value="CUSTOM" class="dark:bg-gray-800 dark:text-gray-200">{{ t('editor.custom') }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.unit') }}</label>
          <select 
            :value="store.unit"
            @change="(e) => store.setUnit((e.target as HTMLSelectElement).value as Unit)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
          >
            <option value="mm" class="dark:bg-gray-800 dark:text-gray-200">{{ t('common.mm') }}</option>
            <option value="pt" class="dark:bg-gray-800 dark:text-gray-200">{{ t('common.pt') }}</option>
            <option value="px" class="dark:bg-gray-800 dark:text-gray-200">{{ t('common.px') }}</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('common.width') }} ({{ unitLabel }})</label>
            <input 
              type="number" 
              :value="formatUnitValue(customWidth)"
              @change="(e) => { customWidth = unitToPx(Number((e.target as HTMLInputElement).value), store.unit as Unit); applyCustomSize(); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('common.height') }} ({{ unitLabel }})</label>
            <input 
              type="number" 
              :value="formatUnitValue(customHeight)"
              @change="(e) => { customHeight = unitToPx(Number((e.target as HTMLInputElement).value), store.unit as Unit); applyCustomSize(); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.spacingX') }} ({{ unitLabel }})</label>
            <input 
              type="number" 
              :value="pageSpacingX"
              @change="(e) => { pageSpacingX = Number((e.target as HTMLInputElement).value); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.spacingY') }} ({{ unitLabel }})</label>
            <input 
              type="number" 
              :value="pageSpacingY"
              @change="(e) => { pageSpacingY = Number((e.target as HTMLInputElement).value); }"
              class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>


      </div>

      <div class="mt-4 flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.showMarginLines') }}</span>
        <button 
          @click="store.setShowMarginLines(!store.showMarginLines)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showMarginLines ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <span class="sr-only">Toggle margin lines</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showMarginLines ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.showCornerMarkers') }}</span>
        <button 
          @click="store.setShowCornerMarkers(!store.showCornerMarkers)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showCornerMarkers ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <span class="sr-only">Toggle corner markers</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showCornerMarkers ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.showGrid') }}</span>
        <button 
          @click="store.setShowGrid(!store.showGrid)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showGrid ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <span class="sr-only">Toggle grid</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showGrid ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.showMinimap') }}</span>
        <button 
          @click="store.setShowMinimap(!store.showMinimap)"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          :class="store.showMinimap ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
        >
          <span class="sr-only">Toggle minimap</span>
          <span
            aria-hidden="true"
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
            :class="store.showMinimap ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.backgroundColor') }}</span>
        <ColorPicker 
          v-model="canvasBackground" 
          :allow-transparent="true"
          default-color="#ffffff"
          placement="bottom-end"
          :teleport-to-body="true"
        >
          <template #trigger="{ color, open }">
            <div 
              class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              :class="{ 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900': open }"
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

      <div class="border-t border-gray-200 dark:border-gray-700 my-4 pt-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{{ t('editor.headerFooter') }}</h3>
        
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
               <button 
                @click="store.setShowHeaderLine(!store.showHeaderLine)"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                :class="store.showHeaderLine ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
              >
                <span class="sr-only">Toggle header line</span>
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                  :class="store.showHeaderLine ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <label class="text-xs text-gray-600 dark:text-gray-400">{{ t('editor.headerLine') }}</label>
            </div>
            <div class="flex items-center gap-1">
              <input 
                type="number" 
                :value="formatUnitValue(store.headerHeight)"
                @change="e => store.setHeaderHeight(unitToPx(Number((e.target as HTMLInputElement).value), store.unit as Unit))"
                class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none text-right"
                min="0"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ unitLabel }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
               <button 
                @click="store.setShowFooterLine(!store.showFooterLine)"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                :class="store.showFooterLine ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
              >
                <span class="sr-only">Toggle footer line</span>
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                  :class="store.showFooterLine ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <label class="text-xs text-gray-600 dark:text-gray-400">{{ t('editor.footerLine') }}</label>
            </div>
            <div class="flex items-center gap-1">
              <input 
                type="number" 
                :value="formatUnitValue(store.footerHeight)"
                @change="e => store.setFooterHeight(unitToPx(Number((e.target as HTMLInputElement).value), store.unit as Unit))"
                class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none text-right"
                min="0"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ unitLabel }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
        <button 
          @click="store.addPage(); showPaperSettings = false" 
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors text-sm font-medium"
        >
          <Plus class="w-4 h-4" />
          <span>{{ t('editor.addNewPage') }}</span>
        </button>
        <button
          @click="showAdvancedSettings = true"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-sm font-medium"
        >
          <Settings class="w-4 h-4" />
          <span>{{ t('editor.advancedSettings') }}</span>
        </button>
      </div>
      
      <div 
        class="fixed inset-0 z-[-1]" 
        @click="showPaperSettings = false"
      ></div>
    </div>

    <Teleport :to="modalContainer || 'body'">
      <div v-if="showAdvancedSettings" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 pointer-events-auto" @click.self="showAdvancedSettings = false">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[640px] max-w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
          <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ t('editor.advancedSettings') }}</h3>
            <button @click="showAdvancedSettings = false" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 overflow-y-auto space-y-4">
            <div>
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{{ t('editor.watermark') }}</h3>

              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700 dark:text-gray-200 font-medium">{{ t('editor.watermarkEnable') }}</span>
                  <button 
                    @click="watermarkEnabled = !watermarkEnabled"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    :class="watermarkEnabled ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'"
                  >
                    <span class="sr-only">Toggle watermark</span>
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow ring-0 transition duration-200 ease-in-out"
                      :class="watermarkEnabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>

                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkText') }}</label>
                  <input
                    v-model="watermarkText"
                    type="text"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    :placeholder="t('editor.watermarkTextPlaceholder')"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkAngle') }}</label>
                    <input
                      v-model.number="watermarkAngle"
                      type="number"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkOpacity') }}</label>
                    <input
                      v-model.number="watermarkOpacity"
                      type="number"
                      min="0"
                      max="100"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkSize') }} ({{ unitLabel }})</label>
                    <input
                      v-model.number="watermarkSize"
                      type="number"
                      min="1"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkDensity') }} ({{ unitLabel }})</label>
                    <input
                      v-model.number="watermarkDensity"
                      type="number"
                      min="20"
                      class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.watermarkColor') }}</label>
                  <ColorPicker
                    v-model="watermarkColor"
                    default-color="#000000"
                    placement="bottom-end"
                    :teleport-to-body="true"
                  >
                    <template #trigger="{ color, open }">
                      <div
                        class="w-8 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer relative overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                        :class="{ 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 dark:ring-offset-gray-900': open }"
                      >
                        <div class="absolute inset-0" :style="{ backgroundColor: color }"></div>
                      </div>
                    </template>
                  </ColorPicker>
                </div>
              </div>
            </div>

          </div>

          <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end">
            <button @click="showAdvancedSettings = false" class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium">
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
