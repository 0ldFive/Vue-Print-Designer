<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { ElementType } from '@/types';
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
    case ElementType.BARCODE: return BarcodeElement;
    case ElementType.QRCODE: return QRCodeElement;
    case ElementType.LINE: return LineElement;
    case ElementType.RECT: return RectElement;
    case ElementType.CIRCLE: return CircleElement;
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

  const widthMap: Partial<Record<ElementType, number>> = {
    [ElementType.PAGE_NUMBER]: 52,
    [ElementType.BARCODE]: 200,
    [ElementType.QRCODE]: 100,
    [ElementType.LINE]: 200,
    [ElementType.RECT]: 100,
    [ElementType.CIRCLE]: 100,
  };

  const heightMap: Partial<Record<ElementType, number>> = {
    [ElementType.PAGE_NUMBER]: 20,
    [ElementType.BARCODE]: 80,
    [ElementType.QRCODE]: 100,
    [ElementType.TABLE]: 150,
    [ElementType.LINE]: 20,
    [ElementType.RECT]: 100,
    [ElementType.CIRCLE]: 100,
  };

  const newElement = {
    type,
    x,
    y,
    width: widthMap[type as ElementType] || 200,
    height: heightMap[type as ElementType] || 100,
    variable: '',
    style: {
      fontSize: 14,
      color: '#000000',
      ...(type === ElementType.RECT || type === ElementType.CIRCLE ? { backgroundColor: 'transparent' } : {}),
    },
    content: type === ElementType.TEXT ? 'New Text' 
      : type === ElementType.BARCODE ? '12345678'
      : type === ElementType.QRCODE ? 'https://example.com'
      : '',
    // Dummy data for table
    columns: type === ElementType.TABLE ? [
      { field: 'id', header: 'ID', width: 50 },
      { field: 'name', header: 'Name', width: 100 },
      { field: 'qty', header: 'Qty', width: 60 },
      { field: 'price', header: 'Price', width: 80 },
      { field: 'total', header: 'Total', width: 80 },
    ] : undefined,
    data: type === ElementType.TABLE ? [
      { id: 1, name: 'Item 1', qty: 2, price: 100, total: 200 },
      { id: 2, name: 'Item 2', qty: 1, price: 50, total: 50 },
      { id: 3, name: 'Item 3', qty: 5, price: 20, total: 100 },
    ] : undefined,
    showFooter: type === ElementType.TABLE ? true : undefined,
    tfootRepeat: type === ElementType.TABLE ? true : undefined,
    footerData: type === ElementType.TABLE ? [
      { id: 'Page Sum', total: '{#pageSum}' },
      { id: 'Total', qty: '{#totalQty}', total: '{#totalSum}' },
      { id: 'In Words', total: '{#totalCap}' }
    ] : undefined,
    customScript: type === ElementType.TABLE ? `// RMB Uppercase Conversion
function digitUppercase(n) {
    var fraction = ['角', '分'];
    var digit = [
        '零', '壹', '贰', '叁', '肆',
        '伍', '陆', '柒', '捌', '玖'
    ];
    var unit = [
        ['元', '万', '亿'],
        ['', '拾', '佰', '仟']
    ];
    var head = n < 0 ? '欠' : '';
    n = Math.abs(n);
    var s = '';
    for (var i = 0; i < fraction.length; i++) {
        s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    }
    s = s || '整';
    n = Math.floor(n);
    for (var i = 0; i < unit[0].length && n > 0; i++) {
        var p = '';
        for (var j = 0; j < unit[1].length && n > 0; j++) {
            p = digit[n % 10] + unit[1][j] + p;
            n = Math.floor(n / 10);
        }
        s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    return head + s.replace(/(零.)*零元/, '元')
        .replace(/(零.)+/g, '零')
        .replace(/^整$/, '零元整');
}

// 1. Calculate Total (works for both Global and Page data)
let totalAmount = 0;
let totalQty = 0;
if (data && Array.isArray(data)) {
  data.forEach(row => {
    // Ensure numeric values
    const val = Number(row.total) || 0;
    const qty = Number(row.qty) || 0;
    totalAmount += val;
    totalQty += qty;
  });
}

// 2. Update Footer Data
if (footerData && Array.isArray(footerData)) {
  footerData.forEach(row => {
    Object.keys(row).forEach(key => {
      const val = row[key];
      const processValue = (v) => {
         if (typeof v !== 'string') return v;
         
         // Global replacements (Grand Total)
         if (typeof type === 'undefined' || type !== 'page') {
             if (v.includes('{#totalSum}')) return v.replace('{#totalSum}', totalAmount.toFixed(2));
             if (v.includes('{#totalQty}')) return v.replace('{#totalQty}', totalQty);
             if (v.includes('{#totalCap}')) return v.replace('{#totalCap}', digitUppercase(totalAmount));
             if (v.includes('{#pageSum}')) return v.replace('{#pageSum}', totalAmount.toFixed(2));
         }
         
         // Page replacements (Page Sum)
         if (typeof type !== 'undefined' && type === 'page') {
             if (v.includes('{#pageSum}')) return v.replace('{#pageSum}', totalAmount.toFixed(2));
         }
         return v;
      };

      // Handle string values
      if (typeof val === 'string') {
        row[key] = processValue(val);
      } 
      // Handle object values (merged cells)
      else if (val && typeof val === 'object' && val.value) {
        if (typeof val.value === 'string') {
          val.value = processValue(val.value);
        }
      }
    });
  });
}

return { data, footerData };` : undefined
  };

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
