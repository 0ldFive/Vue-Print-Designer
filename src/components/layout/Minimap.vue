<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { ElementType, type WatermarkSettings } from '@/types';

const props = defineProps<{
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  pages: any[];
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  contentOffsetX: number;
  contentOffsetY: number;
  canvasBackground: string;
  showHeaderLine: boolean;
  showFooterLine: boolean;
  headerHeight: number;
  footerHeight: number;
  watermark: WatermarkSettings | null;
}>();

const emit = defineEmits<{
  (e: 'update:scroll', pos: { left: number; top: number }): void;
}>();

const WIDTH = 180;
const MIN_WIDTH = 120;
const MAX_HEIGHT = 300;
const GAP = 32; // match the gap in PrintDesigner (gap-8)

const ratio = computed(() => {
  if (props.scrollWidth <= 0 || props.scrollHeight <= 0) return 0.1;
  
  let r = WIDTH / props.scrollWidth;
  
  // First try to fit within max height
  if (props.scrollHeight * r > MAX_HEIGHT) {
    r = MAX_HEIGHT / props.scrollHeight;
  }
  
  // Then enforce min width (overrides max height constraint)
  if (props.scrollWidth * r < MIN_WIDTH) {
    r = MIN_WIDTH / props.scrollWidth;
  }
  
  return r;
});

const height = computed(() => {
  return props.scrollHeight * ratio.value;
});

const viewportStyle = computed(() => ({
  left: `${props.scrollLeft * ratio.value}px`,
  top: `${props.scrollTop * ratio.value}px`,
  width: `${props.viewportWidth * ratio.value}px`,
  height: `${props.viewportHeight * ratio.value}px`,
}));

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const watermarkStyle = computed(() => {
  const watermark = props.watermark;
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

const getPageStyle = (index: number) => {
  const base = {
    left: `${(props.contentOffsetX) * ratio.value}px`,
    top: `${(props.contentOffsetY + index * (props.pageHeight + GAP) * props.zoom) * ratio.value}px`,
    width: `${props.pageWidth * props.zoom * ratio.value}px`,
    height: `${props.pageHeight * props.zoom * ratio.value}px`,
    backgroundColor: props.canvasBackground || '#ffffff'
  } as Record<string, string>;

  if (!watermarkStyle.value) return base;
  return { ...base, ...watermarkStyle.value } as Record<string, string>;
};

const getGlobalElements = () => {
  if (!props.pages || props.pages.length === 0) return [];
  const firstPage = props.pages[0];
  if (!firstPage?.elements) return [];
  return firstPage.elements.filter((el: any) =>
    (props.showHeaderLine && el.y < props.headerHeight) ||
    (props.showFooterLine && el.y >= props.pageHeight - props.footerHeight)
  );
};

const getElementBounds = (element: any) => {
  const width = Math.max(1, element.width * props.zoom * ratio.value);
  const height = Math.max(1, element.height * props.zoom * ratio.value);
  return { width, height };
};

const getElementStyle = (element: any) => {
  const { width, height } = getElementBounds(element);
  const base = {
    left: `${element.x * props.zoom * ratio.value}px`,
    top: `${element.y * props.zoom * ratio.value}px`,
    width: `${width}px`,
    height: `${height}px`,
    fontSize: `${(element.style?.fontSize || 12) * props.zoom * ratio.value}px`,
    zIndex: element.style?.zIndex || 1,
    transform: `rotate(${element.style?.rotate || 0}deg)`
  } as Record<string, string | number>;

  if (element.type === ElementType.LINE) {
    const lineColor = element.style?.borderColor || '#111827';
    const lineWidth = Math.max(1, (element.style?.borderWidth || 1) * props.zoom * ratio.value);
    return {
      ...base,
      height: `${lineWidth}px`,
      backgroundColor: lineColor,
      top: `${element.y * props.zoom * ratio.value + (height - lineWidth) / 2}px`
    };
  }

  if (element.type === ElementType.RECT || element.type === ElementType.CIRCLE) {
    const borderColor = element.style?.borderColor || '#111827';
    const borderWidth = Math.max(1, (element.style?.borderWidth || 1) * props.zoom * ratio.value);
    return {
      ...base,
      backgroundColor: element.style?.backgroundColor || 'transparent',
      borderColor,
      borderWidth: `${borderWidth}px`,
      borderStyle: element.style?.borderStyle || 'solid',
      borderRadius: element.type === ElementType.CIRCLE ? '9999px' : `${element.style?.borderRadius || 0}px`
    };
  }

  if (element.type === ElementType.BARCODE || element.type === ElementType.QRCODE) {
    return {
      ...base,
      backgroundColor: 'rgba(17, 24, 39, 0.15)',
      border: '1px solid rgba(17, 24, 39, 0.3)'
    };
  }

  if (element.type === ElementType.PAGE_NUMBER) {
    return {
      ...base,
      color: element.style?.color || '#111827',
      backgroundColor: element.style?.backgroundColor || 'transparent'
    };
  }

  return {
    ...base,
    backgroundColor: element.type === ElementType.IMAGE ? '#e5e7eb' : undefined
  };
};

const getPageNumberText = (element: any, pageIndex: number) => {
  const current = pageIndex + 1;
  const total = props.pages?.length || 1;
  const format = element.format || '1/Total';

  if (format === '1') return `${current}`;
  if (format === 'Page 1') return `Page ${current}`;
  return `${current}/${total}`;
};

const getImageKey = (element: any) => {
  const style = element.style ? JSON.stringify(element.style) : '';
  return `${element.id}:${element.type}:${element.variable || ''}:${element.content || ''}:${style}`;
};

const barcodeSrcMap = ref<Record<string, string>>({});
const qrSrcMap = ref<Record<string, string>>({});
let imageRenderToken = 0;

const getResolvedContent = (element: any) => {
  if (element.type === ElementType.BARCODE) {
    return element.variable || element.content || '12345678';
  }
  if (element.type === ElementType.QRCODE) {
    return element.variable || element.content || 'https://example.com';
  }
  return element.variable || element.content || '';
};

const renderBarcodeDataUrl = (element: any) => {
  try {
    const canvas = document.createElement('canvas');
    const style = element.style || {};
    JsBarcode(canvas, getResolvedContent(element), {
      format: style.barcodeFormat || 'CODE128',
      lineColor: style.color || '#000000',
      width: Number(style.barcodeWidth) || 2,
      height: Number(style.barcodeHeight) || 40,
      displayValue: style.showText !== false && style.showText !== 'false',
      fontOptions: style.fontOptions || '',
      font: style.font || 'monospace',
      textAlign: style.textAlign || 'center',
      textPosition: style.textPosition || 'bottom',
      textMargin: Number(style.textMargin) || 2,
      fontSize: Number(style.fontSize) || 20,
      background: 'transparent',
      margin: Number(style.margin) || 0
    });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
};

const renderQrDataUrl = async (element: any) => {
  try {
    return await QRCode.toDataURL(getResolvedContent(element), {
      margin: 0,
      color: {
        dark: element.style?.color || '#000000',
        light: '#00000000'
      },
      errorCorrectionLevel: element.style?.qrErrorCorrection || 'M'
    });
  } catch {
    return '';
  }
};

const updateCodeImages = async () => {
  const token = ++imageRenderToken;
  const nextBarcodeMap: Record<string, string> = {};
  const nextQrMap: Record<string, string> = {};
  const pages = props.pages || [];

  for (const page of pages) {
    const elements = page?.elements || [];
    for (const element of elements) {
      const key = getImageKey(element);
      if (element.type === ElementType.BARCODE) {
        const src = renderBarcodeDataUrl(element);
        if (src) nextBarcodeMap[key] = src;
      } else if (element.type === ElementType.QRCODE) {
        const src = await renderQrDataUrl(element);
        if (src) nextQrMap[key] = src;
      }
    }
  }

  if (token !== imageRenderToken) return;
  barcodeSrcMap.value = nextBarcodeMap;
  qrSrcMap.value = nextQrMap;
};

const getBarcodeSrc = (element: any) => barcodeSrcMap.value[getImageKey(element)] || '';
const getQrSrc = (element: any) => qrSrcMap.value[getImageKey(element)] || '';

watch(() => props.pages, () => {
  updateCodeImages();
}, { deep: true, immediate: true });

const isDragging = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

// Sync scroll container with viewport position
watch(() => props.scrollTop, () => {
  if (!scrollContainer.value) return;
  
  const rectTop = props.scrollTop * ratio.value;
  const rectHeight = props.viewportHeight * ratio.value;
  const containerHeight = scrollContainer.value.clientHeight;
  const currentScroll = scrollContainer.value.scrollTop;
  
  // If viewport rect is out of view (or close to edge), scroll to keep it visible
  if (rectTop < currentScroll) {
    scrollContainer.value.scrollTop = rectTop;
  } else if (rectTop + rectHeight > currentScroll + containerHeight) {
    scrollContainer.value.scrollTop = rectTop + rectHeight - containerHeight;
  }
});

const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  // Ensure we are working with the content container, not the scroll wrapper
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const viewportX = props.scrollLeft * ratio.value;
  const viewportY = props.scrollTop * ratio.value;
  const viewportW = props.viewportWidth * ratio.value;
  const viewportH = props.viewportHeight * ratio.value;
  
  let startOffsetX = 0;
  let startOffsetY = 0;

  if (
    x >= viewportX && x <= viewportX + viewportW &&
    y >= viewportY && y <= viewportY + viewportH
  ) {
    // Clicked inside viewport
    startOffsetX = x - viewportX;
    startOffsetY = y - viewportY;
  } else {
    // Clicked outside - jump center to click
    const newLeft = (x / ratio.value) - (props.viewportWidth / 2);
    const newTop = (y / ratio.value) - (props.viewportHeight / 2);
    emit('update:scroll', { left: newLeft, top: newTop });
    
    startOffsetX = viewportW / 2;
    startOffsetY = viewportH / 2;
  }

  isDragging.value = true;

  const onMouseMove = (ev: MouseEvent) => {
    const currentRect = container.getBoundingClientRect();
    const currentX = ev.clientX - currentRect.left;
    const currentY = ev.clientY - currentRect.top;
    
    const newViewportX = currentX - startOffsetX;
    const newViewportY = currentY - startOffsetY;
    
    emit('update:scroll', {
      left: newViewportX / ratio.value,
      top: newViewportY / ratio.value
    });
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<template>
  <div 
    ref="scrollContainer"
    class="bg-white border border-gray-200 shadow-lg rounded max-h-[300px] overflow-y-auto overflow-x-hidden box-content no-scrollbar"
    :style="{  
      width: `${props.scrollWidth * ratio}px`,
      maxWidth: `${WIDTH}px`
    }"
  >
    <div 
      class="relative select-none box-content overflow-hidden"
      :style="{ 
        width: `${props.scrollWidth * ratio}px`, 
        height: `${height}px`,
      }"
      @mousedown="handleMouseDown"
    >
      <!-- Background -->
    <div class="absolute inset-0 bg-gray-100"></div>

    <!-- Pages -->
    <div 
      v-for="(page, index) in pages" 
      :key="index"
      class="absolute shadow-sm border border-gray-300 overflow-hidden"
      :style="getPageStyle(index)"
    >
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm leading-none text-gray-300 z-10">
        {{ index + 1 }}
      </div>
      <!-- Elements -->
      <div 
        v-for="element in page.elements" 
        :key="element.id"
        class="absolute"
        :style="getElementStyle(element)"
      >
        <!-- Text -->
        <div 
          v-if="element.type === ElementType.TEXT" 
          class="w-full h-full overflow-hidden whitespace-nowrap"
          :style="{
             color: element.style.color || '#000000',
             fontFamily: element.style.fontFamily,
             fontWeight: element.style.fontWeight,
             fontStyle: element.style.fontStyle,
             textAlign: element.style.textAlign,
             lineHeight: 1
          }"
        >
          {{ element.variable || element.content }}
        </div>

        <div
          v-else-if="element.type === ElementType.PAGE_NUMBER"
          class="w-full h-full overflow-hidden whitespace-nowrap"
          :style="{
            color: element.style.color || '#000000',
            fontFamily: element.style.fontFamily,
            fontWeight: element.style.fontWeight,
            fontStyle: element.style.fontStyle,
            textAlign: element.style.textAlign,
            lineHeight: 1
          }"
        >
          {{ getPageNumberText(element, index) }}
        </div>
        
        <!-- Image Placeholder -->
        <div 
          v-else-if="element.type === ElementType.IMAGE" 
          class="w-full h-full bg-gray-200 flex items-center justify-center overflow-hidden"
        >
          <img v-if="element.content" :src="element.content" class="w-full h-full object-cover" />
        </div>

        <div
          v-else-if="element.type === ElementType.BARCODE"
          class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
        >
          <img v-if="getBarcodeSrc(element)" :src="getBarcodeSrc(element)" class="w-full h-full object-contain" />
        </div>

        <div
          v-else-if="element.type === ElementType.QRCODE"
          class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
        >
          <img v-if="getQrSrc(element)" :src="getQrSrc(element)" class="w-full h-full object-contain" />
        </div>

        <!-- Table Placeholder -->
        <div 
           v-else-if="element.type === ElementType.TABLE"
           class="w-full h-full border border-gray-300 bg-white grid"
           :style="{
             gridTemplateColumns: `repeat(${element.columns?.length || 2}, 1fr)`
           }"
        >
           <div v-for="i in Math.min(6, (element.columns?.length || 2) * 2)" :key="i" class="border-[0.5px] border-gray-100"></div>
        </div>
      </div>

      <!-- Repeated Header/Footer Elements (from Page 1) -->
      <template v-if="index > 0">
        <div
          v-for="element in getGlobalElements()"
          :key="`global-${index}-${element.id}`"
          class="absolute"
          :style="getElementStyle(element)"
        >
          <div 
            v-if="element.type === ElementType.TEXT" 
            class="w-full h-full overflow-hidden whitespace-nowrap"
            :style="{
               color: element.style.color || '#000000',
               fontFamily: element.style.fontFamily,
               fontWeight: element.style.fontWeight,
               fontStyle: element.style.fontStyle,
               textAlign: element.style.textAlign,
               lineHeight: 1
            }"
          >
            {{ element.variable || element.content }}
          </div>

          <div
            v-else-if="element.type === ElementType.PAGE_NUMBER"
            class="w-full h-full overflow-hidden whitespace-nowrap"
            :style="{
              color: element.style.color || '#000000',
              fontFamily: element.style.fontFamily,
              fontWeight: element.style.fontWeight,
              fontStyle: element.style.fontStyle,
              textAlign: element.style.textAlign,
              lineHeight: 1
            }"
          >
            {{ getPageNumberText(element, index) }}
          </div>
          <div 
            v-else-if="element.type === ElementType.IMAGE" 
            class="w-full h-full bg-gray-200 flex items-center justify-center overflow-hidden"
          >
            <img v-if="element.content" :src="element.content" class="w-full h-full object-cover" />
          </div>

          <div
            v-else-if="element.type === ElementType.BARCODE"
            class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
          >
            <img v-if="getBarcodeSrc(element)" :src="getBarcodeSrc(element)" class="w-full h-full object-contain" />
          </div>

          <div
            v-else-if="element.type === ElementType.QRCODE"
            class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
          >
            <img v-if="getQrSrc(element)" :src="getQrSrc(element)" class="w-full h-full object-contain" />
          </div>
          <div 
             v-else-if="element.type === ElementType.TABLE"
             class="w-full h-full border border-gray-300 bg-white grid"
             :style="{
               gridTemplateColumns: `repeat(${element.columns?.length || 2}, 1fr)`
             }"
          >
             <div v-for="i in Math.min(6, (element.columns?.length || 2) * 2)" :key="i" class="border-[0.5px] border-gray-100"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Viewport -->
    <div 
      class="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move z-[1000]"
      :style="viewportStyle"
    ></div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
