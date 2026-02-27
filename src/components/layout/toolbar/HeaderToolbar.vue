<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject, type Ref } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import Printer from '~icons/material-symbols/print';
import Preview from '~icons/material-symbols/preview';
import FileOutput from '~icons/material-symbols/file-download';
import FilePdf from '~icons/material-symbols/picture-as-pdf';
import Image from '~icons/material-symbols/image';
import ZoomIn from '~icons/material-symbols/zoom-in';
import ZoomOut from '~icons/material-symbols/zoom-out';
import Settings from '~icons/material-symbols/settings';
import Save from '~icons/material-symbols/save';
import SaveAs from '~icons/material-symbols/save-as';
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
import { usePrint } from '@/utils/print';
import { usePrintSettings, type PrintOptions } from '@/composables/usePrintSettings';
import { ElementType } from '@/types';
import PreviewModal from '../PreviewModal.vue';
import ColorPicker from '@/components/common/ColorPicker.vue';
import TemplateDropdown from './TemplateDropdown.vue';
import PaperSettings from './PaperSettings.vue';
import InputModal from '@/components/common/InputModal.vue';
import { useTemplateStore } from '@/stores/templates';
import DataObject from '~icons/material-symbols/data-object';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import cloneDeep from 'lodash/cloneDeep';
import { useI18n } from 'vue-i18n';
import { formatShortcut } from '@/utils/os';
import PrintDialog from '../PrintDialog.vue';

const emit = defineEmits<{
  (e: 'toggleHelp'): void
  (e: 'toggleSettings'): void
}>();

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();

const designerRoot = inject<Ref<HTMLElement | null>>('designer-root', ref(null));
const getQueryRoot = () => {
  return (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document;
};

const { printMode, silentPrint, localPrintOptions, remotePrintOptions } = usePrintSettings();
const printModeValue = computed(() => printMode.value || 'browser');

const showJsonModal = ref(false);
const jsonContent = ref('');
const modalTitle = ref('');
const modalLanguage = ref('json');

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
const showSaveNameModal = ref(false);
const saveNameInitialValue = ref('');
const saveModalMode = ref<'save' | 'saveAs'>('save');
const { getPrintHtml, print, exportPdf, getPdfBlob, exportImages, getImageBlob } = usePrint();

const handleViewImageBlob = async () => {
  try {
      // Use real DOM elements to ensure computed styles are captured correctly
      const pages = Array.from(getQueryRoot().querySelectorAll('.print-page')) as HTMLElement[];
      const blob = await getImageBlob(pages);
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
          jsonContent.value = reader.result as string;
          modalTitle.value = t('editor.viewImageBlob');
          modalLanguage.value = 'text';
          showJsonModal.value = true;
      }
  } catch (e) {
      console.error(e);
      alert('Failed to generate blob');
  }
};

const handleViewPdfBlob = async () => {
  try {
      const pages = Array.from(getQueryRoot().querySelectorAll('.print-page')) as HTMLElement[];
      const blob = await getPdfBlob(pages);
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
          jsonContent.value = reader.result as string;
          modalTitle.value = t('editor.viewPdfBlob');
          modalLanguage.value = 'text';
          showJsonModal.value = true;
      }
  } catch (e) {
      console.error(e);
      alert('Failed to generate PDF blob');
  }
};

const showPreview = ref(false);
const previewContent = ref('');
const showExportMenu = ref(false);
const showPrintDialog = ref(false);
const pendingPrintContent = ref<HTMLElement[] | HTMLElement | string | null>(null);

const activePrintOptions = computed<PrintOptions>(() => {
  return printMode.value === 'remote' ? remotePrintOptions : localPrintOptions;
});

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
  const pages = Array.from(getQueryRoot().querySelectorAll('.print-page')) as HTMLElement[];
  if (printMode.value !== 'browser' && !silentPrint.value) {
    pendingPrintContent.value = pages;
    showPrintDialog.value = true;
    return;
  }
  await print(pages, { mode: printModeValue.value });
};

const handlePrintConfirm = async (options: PrintOptions) => {
  if (printMode.value === 'local') {
    Object.assign(localPrintOptions, options);
  }
  if (printMode.value === 'remote') {
    Object.assign(remotePrintOptions, options);
  }

  const content = pendingPrintContent.value || Array.from(getQueryRoot().querySelectorAll('.print-page')) as HTMLElement[];
  pendingPrintContent.value = null;
  showPrintDialog.value = false;
  await print(content, { mode: printModeValue.value, options });
};

const handleExport = async () => {
  const baseName = getExportBaseName();
  await exportPdf(undefined, `${baseName}.pdf`);
};

const handleExportImages = async () => {
  const baseName = getExportBaseName();
  await exportImages(undefined, baseName);
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
  saveModalMode.value = 'save';
  saveNameInitialValue.value = '';
  showSaveNameModal.value = true;
};

const handleSaveAs = () => {
  saveModalMode.value = 'saveAs';
  const current = templateStore.templates.find(t => t.id === templateStore.currentTemplateId);
  saveNameInitialValue.value = current ? `${current.name} Copy` : '';
  showSaveNameModal.value = true;
};

const handleSaveConfirm = (name: string) => {
  if (saveModalMode.value === 'saveAs') {
    templateStore.createTemplate(name);
  } else {
    templateStore.saveCurrentTemplate(name);
  }
  showSaveNameModal.value = false;
};

const getExportBaseName = () => {
  const current = templateStore.templates.find(t => t.id === templateStore.currentTemplateId);
  const rawName = (current?.name || 'print-design').trim();
  const safeName = rawName.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'print-design';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${safeName}-${yyyy}${mm}${dd}`;
};

onMounted(() => {
  window.addEventListener('designer:preview', handlePreview);
  window.addEventListener('designer:save', handleSave);
  window.addEventListener('designer:save-as', handleSaveAs);
  window.addEventListener('designer:print', handlePrint);
  window.addEventListener('designer:export-pdf', handleExport);
  window.addEventListener('designer:view-json', handleViewJson);
  window.addEventListener('designer:view-blob', handleViewImageBlob);
});

onUnmounted(() => {
  window.removeEventListener('designer:preview', handlePreview);
  window.removeEventListener('designer:save', handleSave);
  window.removeEventListener('designer:save-as', handleSaveAs);
  window.removeEventListener('designer:print', handlePrint);
  window.removeEventListener('designer:export-pdf', handleExport);
  window.removeEventListener('designer:view-json', handleViewJson);
  window.removeEventListener('designer:view-blob', handleViewImageBlob);
});
</script>

<template>
  <div class="flex items-center gap-4 text-gray-700 dark:text-gray-200">
    <TemplateDropdown />
    <InputModal 
      :show="showSaveNameModal" 
      :title="saveModalMode === 'saveAs' ? t('editor.saveAsTemplate') : t('editor.saveTemplate')"
      :initial-value="saveNameInitialValue"
      @close="showSaveNameModal = false"
      @save="handleSaveConfirm"
    />

    <!-- Font Controls -->
    <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 px-2">
      <!-- Font Family -->
      <select 
        v-model="selectedFont"
        :disabled="isFontControlsDisabled"
        class="w-32 text-sm bg-transparent border-none outline-none focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200"
        :title="t('editor.fontFamily')"
      >
        <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value" class="dark:bg-gray-800 dark:text-gray-200">
          {{ opt.label }}
        </option>
      </select>
      
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <!-- Font Size -->
      <div class="flex items-center gap-1">
        <button @click="selectedFontSize--" :disabled="isFontControlsDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">-</button>
        <input 
          type="number" 
          v-model="selectedFontSize" 
          :disabled="isFontControlsDisabled"
          class="w-12 text-center text-sm bg-transparent dark:bg-gray-800 border-none outline-none focus:ring-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:text-gray-200"
          min="1" max="200"
        />
        <button @click="selectedFontSize++" :disabled="isFontControlsDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">+</button>
      </div>

      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <!-- Style Toggles -->
      <button 
        @click="toggleBold" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isBold }"
        :title="t('editor.bold')"
      >
        <Bold class="w-4 h-4" />
      </button>
      <button 
        @click="toggleItalic" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isItalic }"
        :title="t('editor.italic')"
      >
        <Italic class="w-4 h-4" />
      </button>
      <button 
        @click="toggleUnderline" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isUnderline }"
        :title="t('editor.underline')"
      >
        <FormatUnderlined class="w-4 h-4" />
      </button>

      <button 
        @click="toggleVertical" 
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isVertical }"
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
            class="flex items-center gap-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            :disabled="isFontControlsDisabled"
            :title="t('editor.textColor')"
          >
            <FontDownload class="w-4 h-4" />
            <div class="w-1 h-3.5 rounded-[1px] border border-gray-300 dark:border-gray-600" :style="{ backgroundColor: color }"></div>
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
            class="flex items-center gap-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isFontControlsDisabled"
            :title="t('editor.backgroundColor')"
          >
            <FormatColorFill class="w-4 h-4" />
            <div class="w-1 h-3.5 rounded-[1px] border border-gray-300 dark:border-gray-600 relative overflow-hidden bg-white">
               <div v-if="color === 'transparent'" class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50 bg-repeat bg-[length:6px_6px]"></div>
               <div class="absolute inset-0" :style="{ backgroundColor: color === 'transparent' ? 'transparent' : color }"></div>
               <div v-if="color === 'transparent'" class="absolute inset-0 flex items-center justify-center">
                  <div class="w-full h-[1px] bg-red-500 rotate-90 transform scale-150"></div>
               </div>
            </div>
          </button>
        </template>
      </ColorPicker>

      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
      
      <button 
        @click="resetRotation" 
        :disabled="isLocked || !store.selectedElementId"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :title="t('editor.resetRotation')"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Alignment -->
    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button @click="store.alignSelectedElements('left')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignLeft')">
        <AlignLeft class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('center')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignCenter')">
        <AlignCenterHorizontal class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('right')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignRight')">
        <AlignRight class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button @click="store.alignSelectedElements('top')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignTop')">
        <AlignStartVertical class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('middle')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignMiddle')">
        <AlignCenterVertical class="w-4 h-4" />
      </button>
      <button @click="store.alignSelectedElements('bottom')" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.alignBottom')">
        <AlignEndVertical class="w-4 h-4" />
      </button>
      <template v-if="store.selectedElementIds.length > 1">
        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
        <button @click="store.groupSelectedElements()" :disabled="isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('editor.group')">
          <Group class="w-4 h-4" />
        </button>
      </template>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- History & Edit -->
    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button @click="store.undo()" :disabled="store.historyPast.length === 0" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.undo') + ' (' + formatShortcut(['Ctrl', 'Z']) + ')'">
        <Undo2 class="w-4 h-4" />
      </button>
      <button @click="store.redo()" :disabled="store.historyFuture.length === 0" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.redo') + ' (' + formatShortcut(['Ctrl', 'Y']) + ')'">
        <Redo2 class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button @click="store.copy()" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.copy') + ' (' + formatShortcut(['Ctrl', 'C']) + ')'">
        <Copy class="w-4 h-4" />
      </button>
      <button @click="store.paste()" :disabled="store.clipboard.length === 0" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.paste') + ' (' + formatShortcut(['Ctrl', 'V']) + ')'">
        <ClipboardPaste class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button @click="store.toggleLock()" :disabled="!store.selectedElementId" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="(isLocked ? t('editor.unlock') : t('editor.lock')) + ' (' + formatShortcut(['Ctrl', 'L']) + ')'">
        <Unlock v-if="isLocked" class="w-4 h-4 text-red-500" />
        <Lock v-else class="w-4 h-4" />
      </button>
      <button @click="store.removeSelectedElements()" :disabled="!store.selectedElementId || isLocked" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed" :title="t('common.delete') + ' (' + formatShortcut(['Del']) + ')'">
        <Trash2 class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Paper Settings -->
    <PaperSettings />

    <!-- Zoom Settings -->
    <div class="relative">
      <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button @click="handleZoomOut" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" :title="t('editor.zoomOut')">
          <ZoomOut class="w-4 h-4" />
        </button>
        <button 
          @click="showZoomSettings = !showZoomSettings" 
          class="text-xs w-12 text-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1 py-0.5"
          :title="t('editor.zoomSettings')"
        >
          {{ Math.round(store.zoom * 100) }}%
        </button>
        <button @click="handleZoomIn" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" :title="t('editor.zoomIn')">
          <ZoomIn class="w-4 h-4" />
        </button>
      </div>

      <div v-if="showZoomSettings" class="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-4 z-[1000]">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{{ t('editor.zoomLevel') }}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('editor.zoomLevel') }} (20% - 500%)</label>
            <input 
              type="range" 
              min="20" 
              max="500" 
              step="10" 
              v-model.number="zoomPercent" 
              @input="handleZoomSlider"
              class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 dark:[&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 dark:[&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
            />
            <div class="text-right text-xs text-gray-600 dark:text-gray-400 mt-1">{{ zoomPercent }}%</div>
          </div>
        </div>

        <div class="fixed inset-0 z-[-1]" @click="showZoomSettings = false"></div>
      </div>
    </div>

<!-- Help moved to dropdown -->

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Save / Export Dropdown -->
    <div class="relative">
      <div class="flex items-center shadow-sm">
        <button 
          @click="handleSave" 
          :disabled="templateStore.isSaving"
          class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 transition-colors text-sm border-r border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loading v-if="templateStore.isSaving" class="w-4 h-4 animate-spin" />
          <Save v-else class="w-4 h-4" />
          <span>{{ t('common.save') }}</span>
        </button>
        <button 
          @click="showExportMenu = !showExportMenu"
          class="px-2 py-1.5 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors text-sm flex items-center"
        >
          <ChevronDown class="w-5 h-5" />
        </button>
      </div>

      <div v-if="showExportMenu" class="absolute top-full right-0 mt-2 w-max min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-1 z-[1000] flex flex-col gap-1">
        <button @click="handleSaveAs(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <SaveAs class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.saveAsTemplate') }}</span>
        </button>
        <button @click="handlePreview(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <Preview class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.preview') }}</span>
        </button>
        <button @click="handlePrint(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <Printer class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.print') }}</span>
        </button>
        <button @click="handleExport(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <FileOutput class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.exportPdf') }}</span>
        </button>
        <button @click="handleExportImages(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <FileOutput class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.exportImage') }}</span>
        </button>
        <button @click="handleViewImageBlob(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.viewImageBlob') }}</span>
        </button>
        <button @click="handleViewPdfBlob(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.viewPdfBlob') }}</span>
        </button>
        <button @click="handleViewJson(); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.viewJson') }}</span>
        </button>        
        <div class="h-px bg-gray-200 dark:bg-gray-700 my-0.5"></div>        
        <button @click="emit('toggleHelp'); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <HelpCircle class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.help') }}</span>
        </button>
        <button @click="emit('toggleSettings'); showExportMenu = false" class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap">
          <Settings class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>{{ t('editor.settings') }}</span>
        </button>
      </div>
      <div v-if="showExportMenu" class="fixed inset-0 z-[999]" @click="showExportMenu = false"></div>
    </div>

<!-- Save moved to dropdown group -->
  </div>

  <PreviewModal 
    v-model:visible="showPreview"
    :html-content="previewContent"
    :width="store.canvasSize.width"
  />

  <PrintDialog
    v-model:show="showPrintDialog"
    :mode="printModeValue"
    :options="activePrintOptions"
    @confirm="handlePrintConfirm"
  />

  <CodeEditorModal
    v-model:visible="showJsonModal"
    :title="modalTitle"
    :value="jsonContent"
    :language="modalLanguage"
    read-only
  />
</template>
