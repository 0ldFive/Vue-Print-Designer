<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { ElementType } from '@/types';
import ElementWrapper from '../elements/ElementWrapper.vue';
import TextElement from '../elements/TextElement.vue';
import ImageElement from '../elements/ImageElement.vue';
import TableElement from '../elements/TableElement.vue';
import PageNumberElement from '../elements/PageNumberElement.vue';

const store = useDesignerStore();

const pages = computed(() => store.pages);
const zoom = computed(() => store.zoom);
const canvasSize = computed(() => store.canvasSize);

// Header/Footer Dragging
const isDraggingLine = ref(false);
const draggingLineType = ref<'header' | 'footer' | null>(null);
const draggingPageElement = ref<HTMLElement | null>(null);

const handleLineMouseDown = (e: MouseEvent, type: 'header' | 'footer') => {
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
    store.setHeaderHeight(Math.round(clampedY));
  } else if (draggingLineType.value === 'footer') {
    store.setFooterHeight(Math.round(store.canvasSize.height - clampedY));
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

const pageStyle = computed(() => ({
  width: `${store.canvasSize.width}px`,
  height: `${store.canvasSize.height}px`,
  backgroundColor: store.canvasBackground
}));

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
    border: '1px solid #3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
    default: return TextElement;
  }
};

const handleDrop = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();
  const data = event.dataTransfer?.getData('application/json');
  if (!data) return;

  const { type } = JSON.parse(data);
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / store.zoom;
  const y = (event.clientY - rect.top) / store.zoom;

  const newElement = {
    type,
    x,
    y,
    width: type === ElementType.PAGE_NUMBER ? 52 : 200,
    height: type === ElementType.PAGE_NUMBER ? 20 : 100,
    variable: '',
    style: {
      fontSize: 14,
      color: '#000000',
    },
    content: type === ElementType.TEXT ? 'New Text' : '',
    // Dummy data for table
    columns: type === ElementType.TABLE ? [
      { field: 'id', header: 'ID', width: 50 },
      { field: 'name', header: 'Name', width: 100 },
    ] : undefined,
    data: type === ElementType.TABLE ? [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ] : undefined
  };

  // If table, give it more height
  if (type === ElementType.TABLE) {
    newElement.height = 150;
  }

  store.addElement(newElement);
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
  // Only left click and when not Ctrl pressed
  if (e.button !== 0 || e.ctrlKey || e.metaKey) return;

  // Check if clicking on an element (should be handled by ElementWrapper)
  const target = e.target as HTMLElement;
  if (target.closest('.element-wrapper')) return;

  // Start box selection
  e.preventDefault();
  e.stopPropagation();

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
  if (!isBoxSelecting.value) return;

  // Find the page element that started the selection
  const pageElement = document.querySelector('.print-page') as HTMLElement;
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
      for (const element of page.elements) {
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

  for (let i = 0; i < page.elements.length; i++) {
    const el = page.elements[i];
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
</script>

<template>
  <div class="flex flex-col gap-8" :style="{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'fit-content' }">
    <div
      v-for="(page, index) in pages"
      :key="page.id"
      :id="`page-${index}`"
      class="print-page shadow-lg relative overflow-hidden transition-all"
      :style="pageStyle"
      @drop="(e) => handleDrop(e, index)"
      @dragover="handleDragOver"
      @mousedown="(e) => handlePageMouseDown(e, index)"
      @contextmenu="(e) => handleContextMenu(e, index)"
      @click.self="handleBackgroundClick"
    >
      <!-- Grid Background -->
      <div v-if="store.showGrid" class="absolute inset-0 pointer-events-none opacity-50"
           style="background-image: linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px); background-size: 20px 20px;">
      </div>

      <!-- Selection Box -->
      <div v-if="isBoxSelecting" :style="selectionBoxStyle"></div>

      <!-- Header & Footer Lines -->
      <template v-if="store.showHeaderLine">
        <div 
          class="absolute left-0 w-full z-20 cursor-row-resize group flex flex-col justify-center items-center"
          :style="{ 
            top: `${store.headerHeight}px`, 
            height: '12px',
            marginTop: '-6px'
          }"
          @mousedown="(e) => handleLineMouseDown(e, 'header')"
        >
          <div 
            class="w-full h-px"
            :style="{
              backgroundImage: 'linear-gradient(to right, #f87171 60%, transparent 40%)',
              backgroundSize: '20px 1px',
              backgroundRepeat: 'repeat-x'
            }"
          ></div>
          <div class="absolute right-0 -top-4 text-xs text-red-400 bg-white/80 px-1 pointer-events-none">Header</div>
        </div>
      </template>

      <template v-if="store.showFooterLine">
        <div 
          class="absolute left-0 w-full z-20 cursor-row-resize group flex flex-col justify-center items-center"
          :style="{ 
            bottom: `${store.footerHeight}px`,
            height: '12px',
            marginBottom: '-6px'
          }"
          @mousedown="(e) => handleLineMouseDown(e, 'footer')"
        >
          <div 
            class="w-full h-px"
            :style="{
              backgroundImage: 'linear-gradient(to right, #f87171 60%, transparent 40%)',
              backgroundSize: '20px 1px',
              backgroundRepeat: 'repeat-x'
            }"
          ></div>
          <div class="absolute right-0 -bottom-4 text-xs text-red-400 bg-white/80 px-1 pointer-events-none">Footer</div>
        </div>
      </template>

      <!-- Elements -->
      <ElementWrapper
        v-for="element in page.elements"
        :key="element.id"
        :element="element"
        :is-selected="store.selectedElementId === element.id || store.selectedElementIds.includes(element.id)"
        :zoom="zoom"
      >
        <component :is="getComponent(element.type)" :element="element" :page-index="index" :total-pages="pages.length" />
      </ElementWrapper>

      <!-- Corner Markers -->
      <div v-if="store.showCornerMarkers" class="marker absolute inset-0 pointer-events-none z-50 opacity-50">
        <!-- Top Left -->
        <div class="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-gray-300"></div>
        <!-- Top Right -->
        <div class="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-gray-300"></div>
        <!-- Bottom Left -->
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-gray-300"></div>
        <!-- Bottom Right -->
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-gray-300"></div>
      </div>
    </div>
  </div>
</template>
