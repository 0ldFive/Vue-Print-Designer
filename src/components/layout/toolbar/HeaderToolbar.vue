<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import Printer from '~icons/material-symbols/print';
import Preview from '~icons/material-symbols/preview';
import FileOutput from '~icons/material-symbols/file-download';
import ZoomIn from '~icons/material-symbols/zoom-in';
import ZoomOut from '~icons/material-symbols/zoom-out';
import Settings from '~icons/material-symbols/settings';
import Save from '~icons/material-symbols/save';
import Loading from '~icons/material-symbols/progress-activity';
import Undo2 from '~icons/material-symbols/undo';
import Redo2 from '~icons/material-symbols/redo';
import Trash2 from '~icons/material-symbols/delete';
import HelpCircle from '~icons/material-symbols/help';
import AlignLeft from '~icons/material-symbols/format-align-left';
import AlignCenterHorizontal from '~icons/material-symbols/format-align-center';
import AlignRight from '~icons/material-symbols/format-align-right';
import AlignStartVertical from '~icons/material-symbols/vertical-align-top';
import AlignCenterVertical from '~icons/material-symbols/vertical-align-center';
import AlignEndVertical from '~icons/material-symbols/vertical-align-bottom';
import Bold from '~icons/material-symbols/format-bold';
import Italic from '~icons/material-symbols/format-italic';
import FormatUnderlined from '~icons/material-symbols/format-underlined';
import TextRotateVertical from '~icons/material-symbols/text-rotate-vertical';
import RotateCcw from '~icons/material-symbols/rotate-left';
import Copy from '~icons/material-symbols/content-copy';
import FontDownload from '~icons/material-symbols/font-download';
import FormatColorFill from '~icons/material-symbols/format-color-fill';
import ClipboardPaste from '~icons/material-symbols/content-paste';
import Group from '~icons/material-symbols/group-work';
import Lock from '~icons/material-symbols/lock';
import Unlock from '~icons/material-symbols/lock-open';
import ChevronDown from '~icons/material-symbols/expand-more';
import Plus from '~icons/material-symbols/add';
import { PAPER_SIZES, type PaperSizeKey } from '@/constants/paper';
import { usePrint } from '@/utils/print';
import { pxToMm, mmToPx } from '@/utils/units';
import { ElementType } from '@/types';
import PreviewModal from '../PreviewModal.vue';
import ColorPicker from '@/components/common/ColorPicker.vue';
import TemplateDropdown from './TemplateDropdown.vue';
import InputModal from '@/components/common/InputModal.vue';
import { useTemplateStore } from '@/stores/templates';
import DataObject from '~icons/material-symbols/data-object';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import cloneDeep from 'lodash/cloneDeep';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  (e: 'toggleHelp'): void
}>();

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();

const showJsonModal = ref(false);
const jsonContent = ref('');

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
  showJsonModal.value = true;
};
const showSaveNameModal = ref(false);
const { getPrintHtml, print, exportPdf } = usePrint();

const showPreview = ref(false);
const previewContent = ref('');
const showExportMenu = ref(false);

const selectedPaper = ref<PaperSizeKey>('A4');
const customWidth = ref(PAPER_SIZES.A4.width);
const customHeight = ref(PAPER_SIZES.A4.height);
const showPaperSettings = ref(false);
const showZoomSettings = ref(false);
const zoomPercent = ref(Math.round(store.zoom * 100));

// Font State
const selectedFont = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.fontFamily || '';
    }
    return '';
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ fontFamily: val });
  }
});

const selectedFontSize = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.fontSize || 12;
    }
    return 12;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ fontSize: val });
  }
});

const isBold = computed(() => {
  return store.selectedElement?.style.fontWeight === '700' || store.selectedElement?.style.fontWeight === 'bold';
});

const isItalic = computed(() => {
  return store.selectedElement?.style.fontStyle === 'italic';
});

const isUnderline = computed(() => {
  return store.selectedElement?.style.textDecoration === 'underline';
});

const isVertical = computed(() => {
  return store.selectedElement?.style.writingMode === 'vertical-rl';
});

const selectedColor = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.color;
    }
    return undefined;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ color: val });
  }
});

const selectedBackgroundColor = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.backgroundColor;
    }
    return undefined;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ backgroundColor: val });
  }
});

const isLocked = computed(() => {
  if (store.selectedElementIds.length === 0) return false;
  return store.selectedElement?.locked || false;
});

const isFontControlsDisabled = computed(() => {
  return !store.selectedElementId || isLocked.value || store.selectedElement?.type === ElementType.IMAGE;
});

const toggleBold = () => {
  store.updateSelectedElementsStyle({ fontWeight: isBold.value ? '400' : '700' });
};

const toggleItalic = () => {
  store.updateSelectedElementsStyle({ fontStyle: isItalic.value ? 'normal' : 'italic' });
};

const toggleUnderline = () => {
  store.updateSelectedElementsStyle({ textDecoration: isUnderline.value ? 'none' : 'underline' });
};

const toggleVertical = () => {
  store.updateSelectedElementsStyle({ writingMode: isVertical.value ? 'horizontal-tb' : 'vertical-rl' });
};

const resetRotation = () => {
  store.updateSelectedElementsStyle({ rotate: 0 });
};

const fontOptions = computed(() => [
  { label: t('editor.fonts.default'), value: '' },
  { label: t('editor.fonts.arial'), value: 'Arial, sans-serif' },
  { label: t('editor.fonts.timesNewRoman'), value: '"Times New Roman", serif' },
  { label: t('editor.fonts.courierNew'), value: '"Courier New", monospace' },
  { label: t('editor.fonts.simSun'), value: 'SimSun, serif' },
  { label: t('editor.fonts.simHei'), value: 'SimHei, sans-serif' }
]);

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

const handleZoomIn = () => {
  const currentPercent = Math.round(store.zoom * 100);
  const nextPercent = Math.min(currentPercent + 10, 500);
  store.setZoom(nextPercent / 100);
  zoomPercent.value = nextPercent;
};

const handleZoomOut = () => {
  const currentPercent = Math.round(store.zoom * 100);
  const nextPercent = Math.max(currentPercent - 10, 20);
  store.setZoom(nextPercent / 100);
  zoomPercent.value = nextPercent;
};

watch(() => store.zoom, (z) => {
  zoomPercent.value = Math.round(z * 100);
});

const handleZoomSlider = () => {
  const clamped = Math.max(20, Math.min(500, zoomPercent.value));
  zoomPercent.value = clamped;
  store.setZoom(clamped / 100);
};

const handlePreview = async () => {
  try {
    previewContent.value = await getPrintHtml();
    showPreview.value = true;
  } catch (e) {
    console.error(e);
    alert('Preview generation failed');
  }
};

const handlePrint = async () => {
  // Use real DOM elements to ensure computed styles are captured correctly, similar to exportPdf
  const pages = Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
  await print(pages);
};

const handleExport = async () => {
  await exportPdf();
};

const handleSave = () => {
  if (templateStore.currentTemplateId) {
    const t = templateStore.templates.find(t => t.id === templateStore.currentTemplateId);
    if (t) {
      templateStore.saveCurrentTemplate(t.name);
      // Optional: feedback
      return;
    }
  }
  showSaveNameModal.value = true;
};

const handleSaveConfirm = (name: string) => {
  templateStore.saveCurrentTemplate(name);
  showSaveNameModal.value = false;
};

onMounted(() => {
  window.addEventListener('designer:preview', handlePreview);
  window.addEventListener('designer:save', handleSave);
  window.addEventListener('designer:print', handlePrint);
  window.addEventListener('designer:export-pdf', handleExport);
  window.addEventListener('designer:view-json', handleViewJson);
});

onUnmounted(() => {
  window.removeEventListener('designer:preview', handlePreview);
  window.removeEventListener('designer:save', handleSave);
  window.removeEventListener('designer:print', handlePrint);
  window.removeEventListener('designer:export-pdf', handleExport);
  window.removeEventListener('designer:view-json', handleViewJson);
});
</script>

<template>
  <div class="flex items-center gap-4">
    <TemplateDropdown />
    <InputModal 
      :show="showSaveNameModal" 
      :title="t('editor.saveTemplate')"
      @close="showSaveNameModal = false"
      @save="handleSaveConfirm"
    />

    <!-- Font Controls -->
    <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1 px-2">
      <!-- Font Family -->
      <select 
        v-model="selectedFont"
        :disabled="isFontControlsDisabled"
        class="w-32 text-sm bg-transparent border-none outline-none focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        :title="t('editor.fontFamily')"
      >
        <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      
      <div class="w-px h-4 bg-gray-300"></div>

      <!-- Font Size -->
      <div class="flex items-center gap-1">
        <button @click="selectedFontSize--" :disabled="isFontControlsDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">-</button>
        <input 
          type="number" 
          v-model="selectedFontSize" 
          :disabled="isFontControlsDisabled"
          class="w-12 text-center text-sm bg-transparent border-none outline-none focus:ring-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min="1" max="200"
        />
        <button @click="selectedFontSize++" :disabled="isFontControlsDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">+</button>
      </div>

      <div class="w-px h-4 bg-gray-300"></div>

      <!-- Style Toggles -->
      <button 
        @click="toggleBold" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 text-blue-700': isBold }"
        :title="t('editor.bold')"
      >
        <Bold class="w-4 h-4" />
      </button>
      <button 
        @click="toggleItalic" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 text-blue-700': isItalic }"
        :title="t('editor.italic')"
      >
        <Italic class="w-4 h-4" />
      </button>
      <button 
        @click="toggleUnderline" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 text-blue-700': isUnderline }"
        :title="t('editor.underline')"
      >
        <FormatUnderlined class="w-4 h-4" />
      </button>

      <button 
        @click="toggleVertical" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 text-blue-700': isVertical }"
        :title="t('editor.verticalText')"
      >
        <TextRotateVertical class="w-4 h-4" />
      </button>

      <ColorPicker 
        v-model="selectedColor" 
        :disabled="isFontControlsDisabled"
        default-color="#000000"
      >
        <template #trigger="{ color }">
          <button 
            type="button"
            class="flex items-center gap-1 p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            :disabled="isFontControlsDisabled"
            :title="t('editor.textColor')"
          >
            <FontDownload class="w-4 h-4" />
            <div class="w-1 h-3.5 rounded-[1px] border border-gray-300" :style="{ backgroundColor: color }"></div>
          </button>
        </template>
      </ColorPicker>

      <ColorPicker 
        v-model="selectedBackgroundColor" 
        :disabled="isFontControlsDisabled"
        :allow-transparent="true"
        default-color="transparent"
      >
        <template #trigger="{ color }">
          <button
            type="button"
            class="flex items-center gap-1 p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isFontControlsDisabled"
            :title="t('editor.backgroundColor')"
          >
            <FormatColorFill class="w-4 h-4" />
            <div class="w-1 h-3.5 rounded-[1px] border border-gray-300 relative overflow-hidden bg-white">
               <div v-if="color === 'transparent'" class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50 bg-repeat bg-[length:6px_6px]"></div>
               <div class="absolute inset-0" :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"></div>
               <div v-if="color === 'transparent'" class="absolute inset-0 flex items-center justify-center">
                  <div class="w-full h-[1px] bg-red-500 rotate-90 transform scale-150"></div>
               </div>
            </div>
          </button>
        </template>
      </ColorPicker>

      <div class="w-px h-4 bg-gray-300"></div>
      
      <button 
        @click="resetRotation" 
        :disabled="isLocked || !store.selectedElementId"
        class="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :title="t('editor.resetRotation')"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300"></div>

    <!-- Alignment -->
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button @click="store.alignSelectedElements('left')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignLeft')">
        <AlignLeft class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('center')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignCenter')">
        <AlignCenterHorizontal class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('right')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignRight')">
        <AlignRight class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 mx-1"></div>
      <button @click="store.alignSelectedElements('top')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignTop')">
        <AlignStartVertical class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('middle')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignMiddle')">
        <AlignCenterVertical class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('bottom')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignBottom')">
        <AlignEndVertical class="w-4 h-4" />
      </button>
      <template v-if="store.selectedElementIds.length > 1">
        <div class="w-px h-4 bg-gray-300 mx-1"></div>
        <button @click="store.groupSelectedElements()" :disabled="isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.group')">
          <Group class="w-4 h-4" />
        </button>
      </template>
    </div>

    <div class="h-6 w-px bg-gray-300"></div>

    <!-- History & Edit -->
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button @click="store.undo()" :disabled="store.historyPast.length === 0" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.undo') + ' (Ctrl+Z)'">
        <Undo2 class="w-4 h-4" />
      </button>
      <button @click="store.redo()" :disabled="store.historyFuture.length === 0" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.redo') + ' (Ctrl+Y)'">
        <Redo2 class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 mx-1"></div>
      <button @click="store.copy()" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.copy') + ' (Ctrl+C)'">
        <Copy class="w-4 h-4" />
      </button>
      <button @click="store.paste()" :disabled="store.clipboard.length === 0" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.paste') + ' (Ctrl+V)'">
        <ClipboardPaste class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 mx-1"></div>
      <button @click="store.toggleLock()" :disabled="!store.selectedElementId" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="(isLocked ? t('editor.unlock') : t('editor.lock')) + ' (Ctrl+L)'">
        <Unlock v-if="isLocked" class="w-4 h-4 text-red-500" />
        <Lock v-else class="w-4 h-4" />
      </button>
      <button @click="store.removeSelectedElements()" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-red-600" :title="t('common.delete') + ' (Del)'">
        <Trash2 class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300"></div>

    <!-- Paper Settings -->
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

    <!-- Zoom Settings -->
    <div class="relative">
      <div class="flex items-center bg-gray-100 rounded-lg p-1">
        <button @click="handleZoomOut" class="p-1 hover:bg-gray-200 rounded" :title="t('editor.zoomOut')">
          <ZoomOut class="w-4 h-4" />
        </button>
        <button 
          @click="showZoomSettings = !showZoomSettings" 
          class="text-xs w-12 text-center hover:bg-gray-200 rounded px-1 py-0.5"
          :title="t('editor.zoomSettings')"
        >
          {{ Math.round(store.zoom * 100) }}%
        </button>
        <button @click="handleZoomIn" class="p-1 hover:bg-gray-200 rounded" :title="t('editor.zoomIn')">
          <ZoomIn class="w-4 h-4" />
        </button>
      </div>

      <div v-if="showZoomSettings" class="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-4 z-[1000]">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">{{ t('editor.zoomLevel') }}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">{{ t('editor.zoomLevel') }} (20% - 500%)</label>
            <input 
              type="range" 
              min="20" 
              max="500" 
              step="10" 
              v-model.number="zoomPercent" 
              @input="handleZoomSlider"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
            />
            <div class="text-right text-xs text-gray-600 mt-1">{{ zoomPercent }}%</div>
          </div>
        </div>

        <div class="fixed inset-0 z-[-1]" @click="showZoomSettings = false"></div>
      </div>
    </div>

    <div class="h-6 w-px bg-gray-300"></div>

    <!-- Help -->
    <button @click="emit('toggleHelp')" class="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" :title="t('editor.help')">
      <HelpCircle class="w-5 h-5" />
    </button>

    <div class="h-6 w-px bg-gray-300"></div>

    <!-- Preview / Export Dropdown -->
    <div class="relative">
      <div class="flex items-center shadow-sm">
        <button 
          @click="handlePreview" 
          class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-l-md hover:bg-indigo-700 transition-colors text-sm border-r border-indigo-500"
        >
          <Preview class="w-4 h-4" />
          <span>{{ t('editor.preview') }}</span>
        </button>
        <button 
          @click="showExportMenu = !showExportMenu"
          class="px-2 py-1.5 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 transition-colors text-sm flex items-center"
        >
          <ChevronDown class="w-5 h-5" />
        </button>
      </div>

      <div v-if="showExportMenu" class="absolute top-full right-0 mt-2 w-40 bg-white border border-gray-200 shadow-xl rounded-lg p-1 z-[1000] flex flex-col gap-1">
        <button @click="handlePrint(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm text-left transition-colors">
          <Printer class="w-4 h-4 text-gray-500" />
          <span>{{ t('editor.print') }}</span>
        </button>
        <button @click="handleExport(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm text-left transition-colors">
          <FileOutput class="w-4 h-4 text-gray-500" />
          <span>{{ t('editor.exportPdf') }}</span>
        </button>
        <button @click="handleViewJson(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded text-sm text-left transition-colors">
          <DataObject class="w-4 h-4 text-gray-500" />
          <span>{{ t('editor.viewJson') }}</span>
        </button>
      </div>
      
      <div v-if="showExportMenu" class="fixed inset-0 z-[999]" @click="showExportMenu = false"></div>
    </div>

    <button @click="handleSave" :disabled="templateStore.isSaving" class="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
      <Loading v-if="templateStore.isSaving" class="w-4 h-4 animate-spin" />
      <Save v-else class="w-4 h-4" />
      <span>{{ t('common.save') }}</span>
    </button>
  </div>

  <PreviewModal 
    v-model:visible="showPreview"
    :html-content="previewContent"
    :width="store.canvasSize.width"
  />

  <CodeEditorModal
    v-model:visible="showJsonModal"
    :title="t('preview.templateJson')"
    :value="jsonContent"
    language="json"
    read-only
  />
</template>
