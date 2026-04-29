<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type PrintElement } from '@/types';
import ElementWrapper from '../elements/ElementWrapper.vue';
import TextElement from '../elements/TextElement.vue';
import ImageElement from '../elements/ImageElement.vue';
import TableElement from '../elements/TableElement.vue';
import PageNumberElement from '../elements/PageNumberElement.vue';
import BarcodeElement from '../elements/BarcodeElement.vue';
import QRCodeElement from '../elements/QRCodeElement.vue';
import LineElement from '../elements/LineElement.vue';
import RectElement from '../elements/RectElement.vue';
import CircleElement from '../elements/CircleElement.vue';
import AddIcon from '~icons/material-symbols/add';
import DeleteIcon from '~icons/material-symbols/delete';
import CopyIcon from '~icons/material-symbols/content-copy';
import PasteIcon from '~icons/material-symbols/content-paste';
import { createNewElement } from '../../utils/elementFactory';

const store = useDesignerStore();
const designerRoot = inject<Ref<HTMLElement | null>>('designer-root', ref(null));

const getQueryRoot = () => {
  return (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document;
};
const { t } = useI18n();

const pages = computed(() => store.pages);
const zoom = computed(() => store.zoom);
const pageSpacingX = computed(() => store.pageSpacingX || 0);
const pageSpacingY = computed(() => store.pageSpacingY || 0);
const marginLeft = computed(() => store.pageSpacingX || 0);
const marginRight = computed(() => store.pageSpacingX || 0);
const marginTop = computed(() => store.pageSpacingY || 0);
const marginBottom = computed(() => store.pageSpacingY || 0);
const canvasSize = computed(() => store.canvasSize);
const isTemplateEditable = computed(() => store.isTemplateEditable);

// Header/Footer Dragging
const isDraggingLine = ref(false);
const draggingLineType = ref<'header' | 'footer' | null>(null);
const draggingPageElement = ref<HTMLElement | null>(null);

const handleLineMouseDown = (e: MouseEvent, type: 'header' | 'footer') => {
  if (!store.isTemplateEditable) return;
  e.preventDefault();
  e.stopPropagation();
  
  isDraggingLine.value = true;
  draggingLineType.value = type;
  
  // Find the closest page element
  const target = e.target as HTMLElement;
  draggingPageElement.value = target.closest('.print-page') as HTMLElement;
  
  window.addEventListener('mousemove', handleLineMouseMove);
  window.addEventListener('mouseup', handleLineMouseUp);
};

const handleLineMouseMove = (e: MouseEvent) => {
  if (!isDraggingLine.value || !draggingPageElement.value) return;
  
  const rect = draggingPageElement.value.getBoundingClientRect();
  const relativeY = (e.clientY - rect.top) / store.zoom;
  
  // Clamp values
  const clampedY = Math.max(0, Math.min(store.canvasSize.height, relativeY));
  
  if (draggingLineType.value === 'header') {
    const marginTop = store.pageSpacingY || 0;
    const val = Math.max(0, clampedY - marginTop);
    store.setHeaderHeight(Math.round(val));
  } else if (draggingLineType.value === 'footer') {
    const marginBottom = store.pageSpacingY || 0;
    const val = Math.max(0, store.canvasSize.height - clampedY - marginBottom);
    store.setFooterHeight(Math.round(val));
  }
};

const handleLineMouseUp = () => {
  isDraggingLine.value = false;
  draggingLineType.value = null;
  draggingPageElement.value = null;
  
  window.removeEventListener('mousemove', handleLineMouseMove);
  window.removeEventListener('mouseup', handleLineMouseUp);
};

onUnmounted(() => {
  window.removeEventListener('mousemove', handleLineMouseMove);
  window.removeEventListener('mouseup', handleLineMouseUp);
});

const pageStyle = computed(() => {
  const base = {
    width: `${store.canvasSize.width}px`,
    height: `${store.canvasSize.height}px`,
    backgroundColor: store.canvasBackground
  } as const;

  if (!watermarkStyle.value) return base;
  return { ...base, ...watermarkStyle.value } as const;
});

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const watermarkStyle = computed(() => {
  const watermark = store.watermark;
  if (!watermark || !watermark.enabled || !watermark.text) return null;

  const text = escapeXml(watermark.text);
  const angle = Number.isFinite(watermark.angle) ? watermark.angle : -30;
  const size = Math.max(6, watermark.size || 24);
  const density = Math.max(40, watermark.density || 160);
  const color = watermark.color || '#000000';
  const opacity = Math.min(1, Math.max(0, watermark.opacity ?? 0.1));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${density}" height="${density}">` +
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"` +
    ` fill="${color}" fill-opacity="${opacity}" font-size="${size}"` +
    ` transform="rotate(${angle} ${density / 2} ${density / 2})">${text}</text>` +
    `</svg>`;

  const encoded = encodeURIComponent(svg);
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundRepeat: 'repeat',
    backgroundSize: `${density}px ${density}px`
  } as const;
});

const draggingPageIndex = computed(() => {
  if (!store.isDragging || !store.selectedElementId) return -1;
  return store.pages.findIndex(p => p.elements.some(e => e?.id === store.selectedElementId));
});

// Selection box state
const isBoxSelecting = ref(false);
const boxSelectionStart = ref({ x: 0, y: 0 });
const boxSelectionEnd = ref({ x: 0, y: 0 });
const currentSelectingPageIndex = ref<number | null>(null);
const justFinishedBoxSelection = ref(false);

const selectionBoxStyle = computed(() => {
  if (!isBoxSelecting.value) return { display: 'none' } as const;

  const x = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  const width = Math.abs(boxSelectionEnd.value.x - boxSelectionStart.value.x);
  const height = Math.abs(boxSelectionEnd.value.y - boxSelectionStart.value.y);

  return {
    position: 'absolute' as const,
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    border: '1px solid var(--brand-500)',
    backgroundColor: 'var(--brand-500-alpha-10)',
    pointerEvents: 'none' as const,
    zIndex: 1000,
  };
});

const getComponent = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT: return TextElement;
    case ElementType.IMAGE: return ImageElement;
    case ElementType.TABLE: return TableElement;
    case ElementType.PAGE_NUMBER: return PageNumberElement;
    case ElementType.BARCODE: return BarcodeElement;
    case ElementType.QRCODE: return QRCodeElement;
    case ElementType.LINE: return LineElement;
    case ElementType.RECT: return RectElement;
    case ElementType.CIRCLE: return CircleElement;
    default: return TextElement;
  }
};

const isRenderableElement = (element: PrintElement | null | undefined): element is PrintElement => {
  return !!element && typeof element.id === 'string' && typeof element.type === 'string';
};

const getRenderableElements = (elements: Array<PrintElement | null | undefined>) => {
  return elements.filter(isRenderableElement);
};

const toAtVariable = (raw: string) => {
  const normalized = String(raw || '').trim();
  if (!normalized) return '';
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
};

const handleDrop = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();
  if (!store.isTemplateEditable) return;
  const data = event.dataTransfer?.getData('application/json');
  if (!data) return;

  const { type, payload, variable, dataVariable } = JSON.parse(data);
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / store.zoom;
  const y = (event.clientY - rect.top) / store.zoom;

  if (payload) {
    store.addElement({
      ...payload,
      x,
      y,
      locked: false
    }, pageIndex);
    return;
  }

  // Handle dropping a variable directly to canvas
  if (variable || dataVariable) {
    const page = store.pages[pageIndex];
    if (page) {
      // Iterate backwards to find the topmost element at drop position
      for (let i = page.elements.length - 1; i >= 0; i--) {
        const element = page.elements[i];
        if (!element) continue;
        
        const isPointInside = 
          x >= element.x &&
          x <= element.x + element.width &&
          y >= element.y &&
          y <= element.y + element.height;
          
        if (isPointInside) {
          // Bind variable to this existing element if types match
          if (variable && element.type === ElementType.TEXT) {
            const atVariable = toAtVariable(variable);
            store.updateElement(element.id, {
              variable: atVariable,
              content: atVariable
            });
            return;
          } else if (dataVariable && element.type === ElementType.TABLE) {
            store.updateElement(element.id, {
              variable: toAtVariable(dataVariable)
            });
            return;
          }
        }
      }
    }
    // Do not create new elements if dropping a variable on empty space
    return;
  }

  // Handle dropping a regular element from the left panel
  if (type) {
    const newElement = createNewElement(type as ElementType, x, y, t);
    store.addElement(newElement as PrintElement, pageIndex);
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const handleBackgroundClick = (e: MouseEvent) => {
  // Don't clear selection if Ctrl key is pressed (multi-select mode)
  // Also don't clear if we just finished box selection
  if (!e.ctrlKey && !e.metaKey && !justFinishedBoxSelection.value) {
    store.selectElement(null);
  }
};

// Box selection handlers
const handlePageMouseDown = (e: MouseEvent, pageIndex: number) => {
  if (!store.isTemplateEditable) return;
  // Only left click and when not Ctrl pressed
  if (e.button !== 0 || e.ctrlKey || e.metaKey) return;

  // Check if clicking on an element (should be handled by ElementWrapper)
  const target = e.target as HTMLElement;
  if (target.closest('.element-wrapper')) return;

  // Start box selection
  e.preventDefault();
  // e.stopPropagation();

  isBoxSelecting.value = true;
  currentSelectingPageIndex.value = pageIndex;

  const pageElement = e.currentTarget as HTMLElement;
  const rect = pageElement.getBoundingClientRect();

  // Convert to page coordinates (consider zoom)
  boxSelectionStart.value = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value,
  };
  boxSelectionEnd.value = { ...boxSelectionStart.value };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isBoxSelecting.value || currentSelectingPageIndex.value === null) return;

  // Find the page element that started the selection within the same shadow root or document
  const root = getQueryRoot();
  const pageElement = root.getElementById(`page-${currentSelectingPageIndex.value}`) as HTMLElement;
  if (!pageElement) return;

  const rect = pageElement.getBoundingClientRect();
  boxSelectionEnd.value = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value,
  };
};

const handleMouseUp = () => {
  if (!isBoxSelecting.value) return;

  // Calculate selection bounds
  const x = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  const width = Math.abs(boxSelectionEnd.value.x - boxSelectionStart.value.x);
  const height = Math.abs(boxSelectionEnd.value.y - boxSelectionStart.value.y);

  // Find elements within selection box
  const selectedIds: string[] = [];
  if (currentSelectingPageIndex.value !== null) {
    const page = pages.value[currentSelectingPageIndex.value];
    if (page) {
      for (const element of getRenderableElements(page.elements)) {
        // Check if element intersects with selection box
        const elementRight = element.x + element.width;
        const elementBottom = element.y + element.height;
        const selectionRight = x + width;
        const selectionBottom = y + height;

        if (
          element.x < selectionRight &&
          elementRight > x &&
          element.y < selectionBottom &&
          elementBottom > y
        ) {
          selectedIds.push(element.id);
        }
      }
    }
  }

  store.setSelection(selectedIds);

  isBoxSelecting.value = false;
  currentSelectingPageIndex.value = null;
  justFinishedBoxSelection.value = true;

  setTimeout(() => {
    justFinishedBoxSelection.value = false;
  }, 50);

  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
};

const handleContextMenu = (e: MouseEvent, pageIndex: number) => {
  const pageElement = e.currentTarget as HTMLElement;
  const rect = pageElement.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoom.value;
  const y = (e.clientY - rect.top) / zoom.value;

  const page = pages.value[pageIndex];
  if (!page) return;

  let targetId: string | null = null;
  let topZ = -Infinity;

  const renderableElements = getRenderableElements(page.elements);
  for (let i = 0; i < renderableElements.length; i++) {
    const el = renderableElements[i];
    const within =
      x >= el.x &&
      x <= el.x + el.width &&
      y >= el.y &&
      y <= el.y + el.height;
    if (within) {
      const z = (el.style?.zIndex as number) ?? 1;
      if (z >= topZ) {
        topZ = z;
        targetId = el.id;
      }
    }
  }

  if (targetId) {
    store.selectElement(targetId, false);
  }
};

const getGlobalElements = () => {
  if (pages.value.length === 0) return [];
  const firstPage = pages.value[0];
  const marginTop = store.pageSpacingY || 0;
  const marginBottom = store.pageSpacingY || 0;
  const headerBoundary = store.headerHeight + marginTop;
  const footerBoundary = store.canvasSize.height - (store.footerHeight + marginBottom);

  return getRenderableElements(firstPage.elements).filter(el => {
    if (el.type === ElementType.TABLE) return false;
    const bounds = store.getElementBoundsAtPosition(el, el.x, el.y);
    const isRepeatPerPage = el.repeatPerPage === true;
    const isHeader = store.showHeaderLine && bounds.maxY <= headerBoundary;
    const isFooter = store.showFooterLine && bounds.minY >= footerBoundary;
    return isRepeatPerPage || isHeader || isFooter;
  });
};
</script>

<template>
  <div
    class="flex flex-col"
    :style="{
      transform: `scale(${zoom})`,
      transformOrigin: 'top left',
      width: 'fit-content',
      rowGap: '20px'
    }"
  >
    <div v-for="(page, index) in pages" :key="page.id" class="relative group">
      <div class="absolute top-0 -right-12 flex flex-col gap-2 z-10">
        <button 
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.addPage')"
          :disabled="!isTemplateEditable"
          @click="store.addPage()"
        >
          <AddIcon />
        </button>
        <button 
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.copyPage')"
          :disabled="!isTemplateEditable"
          @click="store.copyPage(index)"
        >
          <CopyIcon />
        </button>
        <button 
          v-if="store.copiedPage"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.pastePage')"
          :disabled="!isTemplateEditable"
          @click="store.pastePage(index)"
        >
          <PasteIcon />
        </button>
        <button 
          v-if="index > 0"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-red-50 hover:text-red-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.deletePage')"
          :disabled="!isTemplateEditable"
          @click="store.removePage(index)"
        >
          <DeleteIcon />
        </button>
      </div>

      <div
        :id="`page-${index}`"
        class="print-page shadow-lg relative overflow-hidden transition-all"
        :style="[pageStyle, { 
          overflow: draggingPageIndex === index ? 'visible' : 'hidden', 
          zIndex: draggingPageIndex === index ? 50 : 1 
        }]"
        @drop="(e) => handleDrop(e, index)"
        @dragover="handleDragOver"
        @mousedown="(e) => handlePageMouseDown(e, index)"
        @contextmenu="(e) => handleContextMenu(e, index)"
        @click.self="handleBackgroundClick"
      >
      <!-- Grid Background -->
       <div v-if="store.showGrid" data-print-exclude="true" class="absolute inset-0 pointer-events-none opacity-50"
           style="background-image: linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px); background-size: 20px 20px;">
      </div>


      <!-- Selection Box -->
       <div v-if="isBoxSelecting && currentSelectingPageIndex === index" data-print-exclude="true" :style="selectionBoxStyle"></div>

      <!-- Header & Footer Lines -->
      <template v-if="store.showHeaderLine">
        <div 
          data-print-exclude="true"
          class="absolute left-0 w-full z-20 group flex flex-col justify-center items-center"
          :class="index === 0 && isTemplateEditable ? 'cursor-row-resize' : 'cursor-default'"
          :style="{ 
            top: `${store.headerHeight + marginTop}px`, 
            left: `${marginLeft}px`,
            width: `${store.canvasSize.width - marginLeft - marginRight}px`,
            height: '12px',
            marginTop: '-6px'
          }"
          @mousedown="(e) => index === 0 && handleLineMouseDown(e, 'header')"
        >
          <div 
            class="w-full h-px"
            :style="{
              backgroundImage: index === 0 ? 'linear-gradient(to right, #f87171 60%, transparent 40%)' : 'linear-gradient(to right, #d1d5db 60%, transparent 40%)',
              backgroundSize: '20px 1px',
              backgroundRepeat: 'repeat-x'
            }"
          ></div>
          <div 
            class="absolute right-0 -top-4 text-xs bg-white/80 px-1 pointer-events-none"
            :class="index === 0 ? 'text-red-400' : 'text-gray-400'"
          >{{ t('canvas.headerLabel') }}</div>
        </div>
      </template>

      <template v-if="store.showFooterLine">
        <div 
          data-print-exclude="true"
          class="absolute left-0 w-full z-20 group flex flex-col justify-center items-center"
          :class="index === 0 && isTemplateEditable ? 'cursor-row-resize' : 'cursor-default'"
          :style="{ 
            bottom: `${store.footerHeight + marginBottom}px`,
            left: `${marginLeft}px`,
            width: `${store.canvasSize.width - marginLeft - marginRight}px`,
            height: '12px',
            marginBottom: '-6px'
          }"
          @mousedown="(e) => index === 0 && handleLineMouseDown(e, 'footer')"
        >
          <div 
            class="w-full h-px"
            :style="{
              backgroundImage: index === 0 ? 'linear-gradient(to right, #f87171 60%, transparent 40%)' : 'linear-gradient(to right, #d1d5db 60%, transparent 40%)',
              backgroundSize: '20px 1px',
              backgroundRepeat: 'repeat-x'
            }"
          ></div>
          <div 
            class="absolute right-0 -bottom-4 text-xs bg-white/80 px-1 pointer-events-none"
            :class="index === 0 ? 'text-red-400' : 'text-gray-400'"
          >{{ t('canvas.footerLabel') }}</div>
        </div>
      </template>

      <!-- Global Header/Footer Elements (from Page 1) -->
      <template v-if="index > 0 && pages.length > 0">
        <ElementWrapper
          v-for="element in getGlobalElements()"
          :key="`global-${element.id}`"
          :element="element"
          :is-selected="store.selectedElementId === element.id || store.selectedElementIds.includes(element.id)"
          :zoom="zoom"
          :page-index="0"
          :read-only="true"
        >
          <component :is="getComponent(element.type)" :element="element" :page-index="index" :total-pages="pages.length" />
        </ElementWrapper>
      </template>

      <!-- Elements -->
      <ElementWrapper
        v-for="element in getRenderableElements(page.elements)"
        :key="element.id"
        :element="element"
        :is-selected="store.selectedElementId === element.id || store.selectedElementIds.includes(element.id)"
        :zoom="zoom"
        :page-index="index"
        :read-only="!isTemplateEditable"
      >
        <component :is="getComponent(element.type)" :element="element" :page-index="index" :total-pages="pages.length" />
      </ElementWrapper>

      <!-- Corner Markers -->
      <div v-if="store.showCornerMarkers" data-print-exclude="true" class="marker absolute inset-0 pointer-events-none z-50 opacity-50">
        <!-- Top Left -->
        <div
          class="absolute w-3 h-3 border-t-2 border-l-2 border-gray-300"
          :style="{ top: `${marginTop}px`, left: `${marginLeft}px` }"
        ></div>
        <!-- Top Right -->
        <div
          class="absolute w-3 h-3 border-t-2 border-r-2 border-gray-300"
          :style="{ top: `${marginTop}px`, right: `${marginRight}px` }"
        ></div>
        <!-- Bottom Left -->
        <div
          class="absolute w-3 h-3 border-b-2 border-l-2 border-gray-300"
          :style="{ bottom: `${marginBottom}px`, left: `${marginLeft}px` }"
        ></div>
        <!-- Bottom Right -->
        <div
          class="absolute w-3 h-3 border-b-2 border-r-2 border-gray-300"
          :style="{ bottom: `${marginBottom}px`, right: `${marginRight}px` }"
        ></div>
      </div>

      <!-- Margin Guides -->
      <div v-if="store.showMarginLines && (marginLeft > 0 || marginTop > 0)" data-print-exclude="true" class="margin-guides absolute inset-0 pointer-events-none z-40">
        <!-- Top Line -->
        <div 
          v-if="marginTop > 0"
          class="absolute border-t border-dashed border-gray-400 w-full"
          :style="{ top: `${marginTop}px` }"
        ></div>
        <!-- Bottom Line -->
        <div 
          v-if="marginBottom > 0"
          class="absolute border-b border-dashed border-gray-400 w-full"
          :style="{ bottom: `${marginBottom}px` }"
        ></div>
        <!-- Left Line -->
        <div 
          v-if="marginLeft > 0"
          class="absolute border-l border-dashed border-gray-400 h-full"
          :style="{ left: `${marginLeft}px` }"
        ></div>
        <!-- Right Line -->
        <div 
          v-if="marginRight > 0"
          class="absolute border-r border-dashed border-gray-400 h-full"
          :style="{ right: `${marginRight}px` }"
        ></div>
      </div>
    </div>
  </div>
</div>
</template>
