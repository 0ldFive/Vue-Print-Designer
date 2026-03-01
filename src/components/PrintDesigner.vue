<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { useTemplateStore } from '@/stores/templates';
import { useAutoSave } from '@/composables/useAutoSave';
import { useTheme } from '@/composables/useTheme';
import debounce from 'lodash/debounce';
import { pxToUnit, type Unit } from '@/utils/units';
import { parseColor, toRgbaString } from '@/utils/color';
import Header from './layout/Header.vue';
import Sidebar from './layout/Sidebar.vue';
import PropertiesPanel from './layout/PropertiesPanel.vue';
import Canvas from './canvas/Canvas.vue';
import Ruler from './layout/Ruler.vue';
import Shortcuts from './layout/Shortcuts.vue';
import Minimap from './layout/Minimap.vue';
import InputModal from '@/components/common/InputModal.vue';
import Save from '~icons/material-symbols/save';
import SaveAs from '~icons/material-symbols/save-as';
import Logout from '~icons/material-symbols/logout';

const store = useDesignerStore();
const templateStore = useTemplateStore();
const { autoSave } = useAutoSave();
const { isDark } = useTheme();
const { t } = useI18n();
const scrollContainer = ref<HTMLElement | null>(null);
const rootContainer = ref<HTMLElement | null>(null);
const modalContainer = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
const canvasContainer = ref<HTMLElement | null>(null);

// Provide root and modal container for children
import { provide } from 'vue';
provide('designer-root', rootContainer);
provide('modal-container', modalContainer);
const canvasWrapper = ref<HTMLElement | null>(null);
const showSaveAsModal = ref(false);
const brandTick = ref(0);

const handleBrandThemeUpdated = () => {
  brandTick.value += 1;
};

const getThemeRgba = (cssVar: string, alpha: number) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  const parsed = parseColor(value);
  if (!parsed) return `rgba(59, 130, 246, ${alpha})`;
  return toRgbaString(parsed.h, parsed.s, parsed.v, alpha);
};

const editingCustomElement = computed(() => store.editingCustomElement);
const saveAsInitialName = computed(() => {
  if (!editingCustomElement.value) return '';
  return `${editingCustomElement.value.name} Copy`;
});

onMounted(() => {
  // Reset isExporting flag on mount to ensure table truncation logic works in designer
  store.setIsExporting(false);

  nextTick(() => {
    updateOffset();
  });

  resizeObserver = new ResizeObserver(() => {
    updateOffset();
  });
  
  if (scrollContainer.value) {
    resizeObserver.observe(scrollContainer.value);
  }

  window.addEventListener('resize', updateOffset);
  window.addEventListener('keydown', handleCtrlKey);
  window.addEventListener('keydown', handleCustomEditShortcuts);
  window.addEventListener('keyup', handleCtrlKey);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('brand-theme-updated', handleBrandThemeUpdated);
  
  // Watch for layout changes
  watch(
    [
      () => store.pages.length,
      () => store.canvasSize.width,
      () => store.canvasSize.height,
      () => store.zoom,
      () => store.showMinimap
    ],
    () => {
      nextTick(updateOffset);
    }
  );

  // Apply dark mode class to root container for Shadow DOM compatibility
  watch(isDark, (val) => {
    if (rootContainer.value) {
      rootContainer.value.classList.toggle('dark', val);
    }
  }, { immediate: true });

  // Auto-save watcher
  watch(
    [
      () => store.pages,
      () => store.canvasSize,
      () => store.guides,
      () => store.headerHeight,
      () => store.footerHeight,
      () => store.showHeaderLine,
      () => store.showFooterLine,
      () => store.canvasBackground,
      () => store.pageSpacingX,
      () => store.pageSpacingY,
      () => store.watermark,
      () => store.showMinimap
    ],
    () => {
      debouncedAutoSave();
    },
    { deep: true }
  );
});

const debouncedAutoSave = debounce(() => {
  if (store.editingCustomElementId) return;
  if (autoSave.value && templateStore.currentTemplateId && !templateStore.isSaving) {
    const currentTemplate = templateStore.templates.find(t => t.id === templateStore.currentTemplateId);
    if (currentTemplate) {
      templateStore.saveCurrentTemplate(currentTemplate.name);
    }
  }
}, 1000);

const handleSaveCustomEdit = () => {
  const ok = store.commitCustomElementEdit();
  if (!ok) {
    alert(t('sidebar.editSaveFailed'));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleSaveCustomEditAs = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const ok = store.saveCustomElementEditAs(trimmed);
  if (!ok) {
    alert(t('sidebar.editSaveFailed'));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleExitCustomEdit = () => {
  if (!confirm(t('sidebar.confirmExitEdit'))) {
    return;
  }
  store.cancelCustomElementEdit();
  requestAnimationFrame(() => {
    scrollContainer.value?.focus?.();
  });
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

const handleCustomEditShortcuts = (e: KeyboardEvent) => {
  if (store.disableGlobalShortcuts) return;
  if (!store.editingCustomElementId) return;
  if (showSaveAsModal.value) return;
  if (isTypingTarget(e.target)) return;

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  const key = e.key.toLowerCase();
  if (key === 's' && e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    showSaveAsModal.value = true;
    return;
  }

  if (key === 's') {
    e.preventDefault();
    e.stopPropagation();
    handleSaveCustomEdit();
    return;
  }

  if (key === 'q') {
    e.preventDefault();
    e.stopPropagation();
    handleExitCustomEdit();
  }
};

const scrollX = ref(0);
const scrollY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const RULER_SIZE = 20;

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollX.value = target.scrollLeft;
  scrollY.value = target.scrollTop;
};

const scrollWidth = ref(0);
const scrollHeight = ref(0);
const viewportWidth = ref(0);
const viewportHeight = ref(0);
const unitLabel = computed(() => store.unit || 'mm');
const formatUnitValue = (px: number) => {
  const value = pxToUnit(px, (store.unit || 'mm') as Unit);
  return store.unit === 'px' ? Math.round(value) : Number(value.toFixed(1));
};

const canvasStyle = computed(() => {
  const pagesCount = store.pages.length;
  const pageHeight = store.canvasSize.height;
  const pageWidth = store.canvasSize.width;
  const gapY = store.pageSpacingY || 0;
  // const paddingBottom = 80; // pb-20 - Removed to prevent unnecessary scrollbars
  
  const unscaledHeight = pagesCount > 0
    ? (pagesCount * pageHeight) + ((pagesCount - 1) * gapY)
    : 0;

  const unscaledWidth = pageWidth;

  return {
    width: `${unscaledWidth * store.zoom}px`,
    height: `${unscaledHeight * store.zoom}px`,
  };
});

const updateOffset = () => {
  if (scrollContainer.value && canvasWrapper.value) {
    // Calculate expected scroll dimensions based on canvas size to avoid loop with overlay size
    const containerClientWidth = scrollContainer.value.clientWidth;
    const containerClientHeight = scrollContainer.value.clientHeight;
    
    viewportWidth.value = containerClientWidth;
    viewportHeight.value = containerClientHeight;
    
    const wrapperW = parseFloat(canvasStyle.value.width);
    const wrapperH = parseFloat(canvasStyle.value.height);
    
    // p-8 = 32px padding on each side
    const paddingX = 64; 
    const paddingY = 64;

    scrollWidth.value = Math.max(containerClientWidth, wrapperW + paddingX);
    scrollHeight.value = Math.max(containerClientHeight, wrapperH + paddingY);
    
    // Fix: If the wrapper fits within the container, force scroll dimensions to client dimensions
    // This prevents scrollbars from appearing when they shouldn't due to slight pixel differences
    if (wrapperW + paddingX <= containerClientWidth) {
      scrollWidth.value = containerClientWidth;
    }
    if (wrapperH + paddingY <= containerClientHeight) {
      scrollHeight.value = containerClientHeight;
    }

    const containerRect = scrollContainer.value.getBoundingClientRect();
    const wrapperRect = canvasWrapper.value.getBoundingClientRect();

    scrollX.value = scrollContainer.value.scrollLeft;
    scrollY.value = scrollContainer.value.scrollTop;

    offsetX.value = wrapperRect.left - containerRect.left + scrollContainer.value.scrollLeft;
    offsetY.value = wrapperRect.top - containerRect.top + scrollContainer.value.scrollTop;
  }
};

onUnmounted(() => {
  debouncedAutoSave.cancel();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener('resize', updateOffset);
  window.removeEventListener('mousemove', handleGuideMouseMove);
  window.removeEventListener('mouseup', handleGuideMouseUp);
  window.removeEventListener('keydown', handleCtrlKey);
  window.removeEventListener('keydown', handleCustomEditShortcuts);
  window.removeEventListener('keyup', handleCtrlKey);
  window.removeEventListener('blur', handleBlur);
  window.removeEventListener('brand-theme-updated', handleBrandThemeUpdated);
  scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
});


// Guides Logic
const isDraggingGuide = ref(false);
const draggingGuideId = ref<string | null>(null);
const draggingGuideType = ref<'horizontal' | 'vertical'>('horizontal');
const draggingGuidePos = ref(0);

const handleGuideDragStart = (e: MouseEvent, type: 'horizontal' | 'vertical', id: string | null = null) => {
  isDraggingGuide.value = true;
  draggingGuideId.value = id;
  draggingGuideType.value = type;
  
  updateGuidePosFromEvent(e);
  
  window.addEventListener('mousemove', handleGuideMouseMove);
  window.addEventListener('mouseup', handleGuideMouseUp);
};

const updateGuidePosFromEvent = (e: MouseEvent) => {
  if (!scrollContainer.value) return;
  
  const rect = scrollContainer.value.getBoundingClientRect();
  const zoom = store.zoom;
  
  if (draggingGuideType.value === 'horizontal') {
    // Relative to scrollContainer top
    const visualY = e.clientY - rect.top + scrollContainer.value.scrollTop;
    draggingGuidePos.value = (visualY - offsetY.value) / zoom;
  } else {
    // Relative to scrollContainer left
    const visualX = e.clientX - rect.left + scrollContainer.value.scrollLeft;
    draggingGuidePos.value = (visualX - offsetX.value) / zoom;
  }
};

const handleGuideMouseMove = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;
  e.preventDefault();
  updateGuidePosFromEvent(e);

  // Real-time update for existing guides
  if (draggingGuideId.value) {
    store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
  }
};

const handleGuideMouseUp = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;
  
  const rect = scrollContainer.value!.getBoundingClientRect();
  let shouldDelete = false;
  
  // Delete if dragged back to ruler or out of bounds (top/left)
  if (draggingGuideType.value === 'horizontal') {
      if (e.clientY < rect.top) shouldDelete = true;
  } else {
      if (e.clientX < rect.left) shouldDelete = true;
  }

  if (shouldDelete) {
    if (draggingGuideId.value) {
      store.removeGuide(draggingGuideId.value);
    }
  } else {
    if (draggingGuideId.value) {
      store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
    } else {
      store.addGuide({ type: draggingGuideType.value, position: draggingGuidePos.value });
    }
  }

  isDraggingGuide.value = false;
  draggingGuideId.value = null;
  window.removeEventListener('mousemove', handleGuideMouseMove);
  window.removeEventListener('mouseup', handleGuideMouseUp);
};

const handleZoomWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom In
      store.setZoom(Math.min(5, store.zoom + 0.1));
    } else {
      // Zoom Out
      store.setZoom(Math.max(0.2, store.zoom - 0.1));
    }
  }
};

const handleCtrlKey = (e: KeyboardEvent) => {
  if (store.disableGlobalShortcuts) return;
  if (e.key === 'Control' || e.key === 'Meta') {
    if (e.type === 'keydown' && !e.repeat) {
      scrollContainer.value?.addEventListener('wheel', handleZoomWheel, { passive: false });
    } else if (e.type === 'keyup') {
      scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
    }
  }
};

const handleBlur = () => {
  scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
};

const handleMinimapScroll = (pos: { left: number, top: number }) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({
      left: pos.left,
      top: pos.top,
      behavior: 'auto'
    });
  }
};

const getRotatedBounds = (el: any) => {
  const rotation = el.style?.rotate || 0;
  if (rotation === 0) {
    return {
      minX: el.x,
      maxX: el.x + el.width,
      minY: el.y,
      maxY: el.y + el.height
    };
  }

  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x, y: el.y + el.height },
    { x: el.x + el.width, y: el.y + el.height }
  ];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const p of corners) {
    const nx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
    const ny = cy + (p.x - cx) * sin + (p.y - cy) * cos;
    
    if (nx < minX) minX = nx;
    if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny;
    if (ny > maxY) maxY = ny;
  }

  return { minX, maxX, minY, maxY };
};

const dragProjection = computed(() => {
  if (!store.isDragging || store.selectedElementIds.length === 0) return null;

  const elements: any[] = [];
  for (const id of store.selectedElementIds) {
    for (const page of store.pages) {
      const el = page.elements.find(e => e.id === id);
      if (el) elements.push(el);
    }
  }

  if (elements.length === 0) return null;

  let globalMinX = Infinity;
  let globalMaxX = -Infinity;
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  for (const el of elements) {
    const bounds = getRotatedBounds(el);
    if (bounds.minX < globalMinX) globalMinX = bounds.minX;
    if (bounds.maxX > globalMaxX) globalMaxX = bounds.maxX;
    if (bounds.minY < globalMinY) globalMinY = bounds.minY;
    if (bounds.maxY > globalMaxY) globalMaxY = bounds.maxY;
  }

  const centerX = (globalMinX + globalMaxX) / 2;
  const centerY = (globalMinY + globalMaxY) / 2;

  return { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY, centerX, centerY };
});

const rulerIndicators = computed(() => {
  if (!dragProjection.value) return { h: [], v: [] };
  brandTick.value;
  const indicatorColor = getThemeRgba('--brand-500', 0.5);
  
  const { minX, maxX, minY, maxY } = dragProjection.value;
  
  return {
    h: [
      { position: minX, color: indicatorColor },
      { position: maxX, color: indicatorColor }
    ],
    v: [
      { position: minY, color: indicatorColor },
      { position: maxY, color: indicatorColor }
    ]
  };
});
</script>

<template>
  <div ref="rootContainer" class="h-full w-full flex flex-col bg-gray-100 overflow-hidden">
    <Header />
    <div class="flex-1 flex overflow-hidden">
      <Sidebar />
      <main class="flex-1 overflow-hidden relative flex flex-col">
        <div v-if="store.editingCustomElementId" class="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100">
          <div class="text-sm font-medium">
            {{ t('sidebar.editingElement', { name: editingCustomElement?.name || '' }) }}
          </div>
          <div class="flex items-center gap-2">
            <button @click="handleSaveCustomEdit" class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 inline-flex items-center gap-1.5">
              <Save class="w-4 h-4" />
              {{ t('sidebar.saveEdit') }}
            </button>
            <button @click="showSaveAsModal = true" class="px-3 py-1.5 text-xs font-medium bg-blue-200 text-blue-900 rounded hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white inline-flex items-center gap-1.5">
              <SaveAs class="w-4 h-4" />
              {{ t('sidebar.saveAs') }}
            </button>
            <button @click="handleExitCustomEdit" class="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-900 rounded hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 inline-flex items-center gap-1.5">
              <Logout class="w-4 h-4" />
              {{ t('sidebar.exitEdit') }}
            </button>
          </div>
        </div>
        <Shortcuts />
        <!-- Rulers Area -->
        <div class="relative w-full h-full flex flex-col overflow-hidden">
           <!-- Top Ruler -->
           <div class="flex-none h-5 bg-gray-50 border-b border-gray-300 flex z-20">
              <div class="w-5 flex-none bg-gray-100 border-r border-gray-300"></div> <!-- Corner -->
              <div class="flex-1 relative overflow-hidden">
                  <Ruler 
                    type="horizontal" 
                    :zoom="store.zoom" 
                    :scroll="scrollX" 
                    :offset="offsetX" 
                    :thick="20"
                    :unit="(store.unit || 'mm') as Unit"
                    :indicators="rulerIndicators.h"
                    @guide-drag-start="(e) => handleGuideDragStart(e, 'horizontal')"
                 />
              </div>
           </div>
           
           <div class="flex-1 flex overflow-hidden relative">
              <!-- Left Ruler -->
              <div class="w-5 flex-none bg-gray-50 border-r border-gray-300 h-full relative z-20 overflow-hidden">
                  <Ruler 
                    type="vertical" 
                    :zoom="store.zoom" 
                    :scroll="scrollY" 
                    :offset="offsetY" 
                    :thick="20"
                    :unit="(store.unit || 'mm') as Unit"
                    :indicators="rulerIndicators.v"
                    @guide-drag-start="(e) => handleGuideDragStart(e, 'vertical')"
                 />
              </div>
              
              <!-- Canvas Area -->
              <div
                ref="scrollContainer"
                tabindex="-1"
                class="flex-1 overflow-auto p-8 flex relative canvas-scroll bg-gray-100 focus:outline-none"
                @scroll="handleScroll"
                @click="(e) => { if (e.target === scrollContainer || e.target === e.currentTarget) { store.selectGuide(null); } }"
              >
                 <div ref="canvasWrapper" :style="canvasStyle" class="mx-auto relative">
                    <Canvas ref="canvasContainer" class="absolute top-0 left-0" />
                 </div>

                 <!-- Guides Overlay -->
                 <div class="absolute top-0 left-0 pointer-events-none z-50" :style="{ width: `${scrollWidth}px`, height: `${scrollHeight}px` }">
                    
                    <!-- Dragging Distance Guides -->
                     <template v-if="dragProjection">
                       <!-- Top Line -->
                        <div class="absolute w-full border-t border-blue-500 border-dashed"
                            :style="{ top: `${offsetY + dragProjection.minY * store.zoom}px`, left: 0 }">
                          <div class="absolute -top-6 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                               :style="{ left: `${scrollX + 10}px` }">
                             {{ formatUnitValue(dragProjection.minY) }} {{ unitLabel }}
                          </div>
                       </div>
                       <!-- Bottom Line -->
                        <div class="absolute w-full border-t border-dashed theme-border"
                            :style="{ top: `${offsetY + dragProjection.maxY * store.zoom}px`, left: 0 }">
                          <div class="absolute -top-6 theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                               :style="{ left: `${scrollX + 10}px` }">
                             {{ formatUnitValue(dragProjection.maxY) }} {{ unitLabel }}
                          </div>
                       </div>
                       <!-- Left Line -->
                        <div class="absolute h-full border-l border-dashed theme-border"
                            :style="{ left: `${offsetX + dragProjection.minX * store.zoom}px`, top: 0 }">
                          <div class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                               :style="{ top: `${scrollY + 10}px` }">
                             {{ formatUnitValue(dragProjection.minX) }} {{ unitLabel }}
                          </div>
                       </div>
                       <!-- Right Line -->
                        <div class="absolute h-full border-l border-dashed theme-border"
                            :style="{ left: `${offsetX + dragProjection.maxX * store.zoom}px`, top: 0 }">
                          <div class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                               :style="{ top: `${scrollY + 10}px` }">
                             {{ formatUnitValue(dragProjection.maxX) }} {{ unitLabel }}
                          </div>
                       </div>
                     </template>

                    <!-- Existing Guides -->
                    <template v-for="guide in store.guides" :key="guide.id">
                       <div 
                          v-if="guide.type === 'horizontal'"
                          class="absolute left-0 w-full h-3 -mt-1.5 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                          :style="{ top: `${offsetY + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => { store.selectGuide(guide.id); handleGuideDragStart(e, 'horizontal', guide.id); }"
                       >
                        <div :class="['w-full', store.highlightedGuideId === guide.id ? 'border-t-2 theme-border-strong' : 'border-t theme-border', 'theme-border-hover']"></div>
                          <div class="absolute left-2 -top-4 theme-bg text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                             {{ formatUnitValue(guide.position) }}{{ unitLabel }}
                          </div>
                       </div>
                       <div 
                          v-else
                          class="absolute top-0 h-full w-3 -ml-1.5 cursor-col-resize pointer-events-auto group flex flex-row justify-center"
                          :style="{ left: `${offsetX + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => { store.selectGuide(guide.id); handleGuideDragStart(e, 'vertical', guide.id); }"
                       >
                          <div :class="['h-full', store.highlightedGuideId === guide.id ? 'border-l-2 theme-border-strong' : 'border-l theme-border', 'theme-border-hover']"></div>
                          <div class="absolute top-2 -left-4 theme-bg text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                             {{ formatUnitValue(guide.position) }}{{ unitLabel }}
                          </div>
                       </div>
                    </template>
                    
                    <!-- Dragging Preview -->
                    <div 
                       v-if="isDraggingGuide && !draggingGuideId"
                       :class="[
                         'absolute border-dashed pointer-events-none theme-border',
                         draggingGuideType === 'horizontal' ? 'left-0 w-full border-t' : 'top-0 h-full border-l'
                       ]"
                       :style="{ 
                         top: draggingGuideType === 'horizontal' ? `${offsetY + draggingGuidePos * store.zoom}px` : undefined,
                         left: draggingGuideType === 'vertical' ? `${offsetX + draggingGuidePos * store.zoom}px` : undefined
                       }"
                    >
                         <div :class="[
                           'absolute theme-bg text-white text-[10px] px-1 rounded',
                           draggingGuideType === 'horizontal' ? 'left-2 -top-4' : 'top-2 -left-4'
                       ]">
                          {{ formatUnitValue(draggingGuidePos) }}{{ unitLabel }}
                       </div>
                    </div>
                    

                    
                    <!-- Edge Highlight -->
                    <div v-if="store.highlightedEdge" class="absolute pointer-events-none">
                      <div 
                        v-if="store.highlightedEdge === 'top'" 
                        class="absolute left-0 w-full border-t theme-border"
                        :style="{ top: `${offsetY}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'bottom'" 
                        class="absolute left-0 w-full border-t theme-border"
                        :style="{ top: `${offsetY + store.canvasSize.height * store.zoom}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'left'" 
                        class="absolute top-0 h-full border-l theme-border"
                        :style="{ left: `${offsetX}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'right'" 
                        class="absolute top-0 h-full border-l theme-border"
                        :style="{ left: `${offsetX + store.canvasSize.width * store.zoom}px` }"
                      ></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
        
        <!-- <footer class="h-6 bg-white border-t border-gray-200 text-xs flex items-center px-4 text-gray-500 z-30">
           Ready
        </footer> -->

        <!-- Minimap -->
        <div v-if="store.showMinimap" class="absolute bottom-4 right-4 z-50">
          <Minimap
            :scroll-width="scrollWidth"
            :scroll-height="scrollHeight"
            :viewport-width="viewportWidth"
            :viewport-height="viewportHeight"
            :scroll-left="scrollX"
            :scroll-top="scrollY"
            :pages="store.pages"
            :page-width="store.canvasSize.width"
            :page-height="store.canvasSize.height"
            :zoom="store.zoom"
            :content-offset-x="offsetX" 
            :content-offset-y="offsetY"
            :canvas-background="store.canvasBackground"
            :show-header-line="store.showHeaderLine"
            :show-footer-line="store.showFooterLine"
            :header-height="store.headerHeight"
            :footer-height="store.footerHeight"
            :watermark="store.watermark || null"
            @update:scroll="handleMinimapScroll"
          />
        </div>
      </main>
      <PropertiesPanel />
    </div>

    <InputModal
      :show="showSaveAsModal"
      :initial-value="saveAsInitialName"
      :title="t('sidebar.saveAsCustomElement')"
      :placeholder="t('sidebar.enterNamePlaceholder')"
      @close="showSaveAsModal = false"
      @save="handleSaveCustomEditAs"
    />

    <!-- Modal Container for Teleport -->
    <div ref="modalContainer" class="print-designer-modals fixed inset-0 pointer-events-none z-[9999]"></div>
  </div>
</template>
