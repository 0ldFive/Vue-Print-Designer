<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
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
import AddIcon from '~icons/material-symbols/add';
import DeleteIcon from '~icons/material-symbols/delete';
import CopyIcon from '~icons/material-symbols/content-copy';
import PasteIcon from '~icons/material-symbols/content-paste';

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
  return store.pages.findIndex(p => p.elements.some(e => e.id === store.selectedElementId));
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

const handleDrop = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();
  const data = event.dataTransfer?.getData('application/json');
  if (!data) return;

  const { type, payload } = JSON.parse(data);
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
      ...(type === ElementType.RECT || type === ElementType.CIRCLE || type === ElementType.PAGE_NUMBER ? { backgroundColor: 'transparent' } : {}),
      ...(type === ElementType.TABLE ? {
        headerBackgroundColor: '#f3f4f6',
        headerColor: '#000000',
        footerBackgroundColor: '#f9fafb',
        footerColor: '#000000'
      } : {})
    },
    content: type === ElementType.TEXT ? t('canvas.newText') 
      : type === ElementType.BARCODE ? '12345678'
      : type === ElementType.QRCODE ? 'https://example.com'
      : '',
    format: type === ElementType.PAGE_NUMBER ? '1/Total' : undefined,
    // Dummy data for table
    columns: type === ElementType.TABLE ? [
      { field: 'id', header: t('canvas.defaultTableHeaders.id'), width: 50 },
      { field: 'name', header: t('canvas.defaultTableHeaders.name'), width: 100 },
      { field: 'qty', header: t('canvas.defaultTableHeaders.qty'), width: 60 },
      { field: 'price', header: t('canvas.defaultTableHeaders.price'), width: 80 },
      { field: 'total', header: t('canvas.defaultTableHeaders.total'), width: 80 },
    ] : undefined,
    data: type === ElementType.TABLE ? Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `${t('canvas.defaultTableData.item')} ${i + 1}`,
      qty: (i % 5) + 1,
      price: 100 + (i * 10),
      total: ((i % 5) + 1) * (100 + (i * 10))
    })) : undefined,
    showFooter: type === ElementType.TABLE ? true : undefined,
    tfootRepeat: type === ElementType.TABLE ? true : undefined,
    autoPaginate: type === ElementType.TABLE ? true : undefined,
    footerData: type === ElementType.TABLE ? [
      { id: { value: t('canvas.defaultTableData.pageSum') }, qty: { value: '', field: '{#pageQty}' }, total: { value: '', field: '{#pageSum}' } },
      { id: { value: t('canvas.defaultTableData.total') }, qty: { value: '', field: '{#totalQty}' }, total: { value: '', field: '{#totalSum}' } },
      { id: { value: t('canvas.defaultTableData.inWords') }, total: { value: '', field: '{#totalCap}' } }
    ] : undefined,
    customScript: type === ElementType.TABLE ? `// RMB Uppercase Conversion
try {
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
               if (v.includes('{#totalQty}')) return v.replace('{#totalQty}', String(totalQty));
               if (v.includes('{#totalCap}')) return v.replace('{#totalCap}', digitUppercase(totalAmount));
               
               // For {#pageSum}, we want to show the Grand Total in the Designer (visual feedback),
               // but pass the original {#pageSum} token to the Print logic (via data-value).
               if (v.includes('{#pageSum}')) {
                   const displayVal = v.replace('{#pageSum}', totalAmount.toFixed(2));
                   // printValue keeps {#pageSum} but resolves other globals
                   const printVal = v.replace('{#totalSum}', totalAmount.toFixed(2))
                                   .replace('{#totalQty}', String(totalQty))
                                   .replace('{#totalCap}', digitUppercase(totalAmount)); 
                   
                   return { value: displayVal, printValue: printVal };
               }

               // For {#pageQty}
               if (v.includes('{#pageQty}')) {
                   const displayVal = v.replace('{#pageQty}', String(totalQty));
                   // printValue keeps {#pageQty} but resolves other globals
                   const printVal = v.replace('{#totalSum}', totalAmount.toFixed(2))
                                   .replace('{#totalQty}', String(totalQty))
                                   .replace('{#totalCap}', digitUppercase(totalAmount)); 
                   
                   return { value: displayVal, printValue: printVal };
               }
           }
           
           // Page replacements (Page Sum)
           if (typeof type !== 'undefined' && type === 'page') {
               if (v.includes('{#pageSum}')) return v.replace('{#pageSum}', totalAmount.toFixed(2));
               if (v.includes('{#pageQty}')) return v.replace('{#pageQty}', String(totalQty));
           }
           return v;
        };

        // Handle object values
        if (val && typeof val === 'object') {
           // If it has a 'field' property, check if it contains a variable
           if (val.field && typeof val.field === 'string') {
               const processed = processValue(val.field);
               // If processed is different from field (meaning a replacement happened)
               // OR if processValue returned an object (for {#pageSum})
               if (processed !== val.field || typeof processed === 'object') {
                   if (typeof processed === 'object') {
                       val.result = processed.value; // Store in result, keep val.value as text
                       val.printValue = processed.printValue;
                   } else {
                       val.result = processed;
                   }
               }
           }
           // Also check 'value' if it was set manually and looks like a variable
           else if (val.value && typeof val.value === 'string') {
               // Only process if value looks like a variable, otherwise it's just text
               if (val.value.includes('{#')) {
                  const processed = processValue(val.value);
                  if (typeof processed === 'object') {
                       val.result = processed.value;
                       val.printValue = processed.printValue;
                   } else {
                       val.result = processed;
                   }
               }
           }
        }
      });
    });
  }

  return { data, footerData };
} catch (e) {
  console.error('Script Execution Error:', e);
  return { data, footerData };
}` : undefined
  };

  store.addElement(newElement, pageIndex);
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

const getGlobalElements = () => {
  if (pages.value.length === 0) return [];
  const firstPage = pages.value[0];
  const marginTop = store.pageSpacingY || 0;
  const marginBottom = store.pageSpacingY || 0;

  return firstPage.elements.filter(el => 
    (store.showHeaderLine && el.y < (store.headerHeight + marginTop)) || 
    (store.showFooterLine && el.y >= (store.canvasSize.height - (store.footerHeight + marginBottom)))
  );
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
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors"
          :title="t('canvas.addPage')"
          @click="store.addPage()"
        >
          <AddIcon />
        </button>
        <button 
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors"
          :title="t('canvas.copyPage')"
          @click="store.copyPage(index)"
        >
          <CopyIcon />
        </button>
        <button 
          v-if="store.copiedPage"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors"
          :title="t('canvas.pastePage')"
          @click="store.pastePage(index)"
        >
          <PasteIcon />
        </button>
        <button 
          v-if="index > 0"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-red-50 hover:text-red-600 text-gray-600 transition-colors"
          :title="t('canvas.deletePage')"
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
          :class="index === 0 ? 'cursor-row-resize' : 'cursor-default'"
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
          :class="index === 0 ? 'cursor-row-resize' : 'cursor-default'"
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
        v-for="element in page.elements"
        :key="element.id"
        :element="element"
        :is-selected="store.selectedElementId === element.id || store.selectedElementIds.includes(element.id)"
        :zoom="zoom"
        :page-index="index"
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
