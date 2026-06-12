<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { ElementType, type PrintElement } from "@/types";
import TableElement from "@/components/elements/TableElement.vue";
import { buildWatermarkPatternSvg } from "@/svg/templates";

// 定义水印设置接口
interface WatermarkSettings {
  enabled: boolean;
  text?: string;
  angle?: number;
  size?: number;
  density?: number;
  color?: string;
  opacity?: number;
}

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
  pageSpacingY: number;
  watermark: WatermarkSettings | null;
  previewWidth?: number;
  previewMaxHeight?: number;
}>();

const emit = defineEmits<{
  (e: "update:scroll", pos: { left: number; top: number }): void;
}>();

const MIN_WIDTH = 120;
const PAGE_GAP = 20; // match Canvas.vue rowGap and PrintDesigner canvasStyle
const MINIMAP_PAGE_NUMBER_Z_INDEX = 900;
const MINIMAP_VIEWPORT_Z_INDEX = 1000;
const MINIMAP_MAX_ELEMENT_Z_INDEX = MINIMAP_PAGE_NUMBER_Z_INDEX - 1;
const VIEWPORT_BORDER_PX = 2;

const previewWidth = computed(() =>
  Math.ceil(Math.max(MIN_WIDTH, props.previewWidth ?? 180)),
);
const previewMaxHeight = computed(() =>
  Math.ceil(Math.max(80, props.previewMaxHeight ?? 300)),
);

const ratio = computed(() => {
  if (props.scrollWidth <= 0 || props.scrollHeight <= 0) return 0.1;

  return previewWidth.value / props.scrollWidth;
});

const height = computed(() => {
  return Math.ceil(props.scrollHeight * ratio.value);
});

const previewScale = computed(() => props.zoom * ratio.value);

const contentHeight = computed(() => {
  const h = Math.ceil(Math.max(height.value, previewMaxHeight.value));
  // 当内容可滚动时（height > previewMaxHeight），多加 1px 缓冲，防止视口
  // 指示器的底边与 content div 底边整数重合，被 overflow:hidden 裁掉最后 1px 边框
  return height.value > previewMaxHeight.value ? h + 1 : h;
});

const viewportRect = computed(() => {
  const scaledWidth = props.scrollWidth * ratio.value;
  const scaledHeight = props.scrollHeight * ratio.value;
  const exactLeft = Math.max(0, Math.min(scaledWidth, props.scrollLeft * ratio.value));
  const exactTop = Math.max(0, Math.min(scaledHeight, props.scrollTop * ratio.value));
  const exactRight = Math.min(scaledWidth, exactLeft + props.viewportWidth * ratio.value);
  const exactBottom = Math.min(scaledHeight, exactTop + props.viewportHeight * ratio.value);

  return {
    left: Math.round(exactLeft),
    top: Math.round(exactTop),
    width: Math.max(0, Math.round(exactRight) - Math.round(exactLeft)),
    height: Math.max(0, Math.round(exactBottom) - Math.round(exactTop)),
  };
});

// 使用单个元素 + inset box-shadow 绘制视口边框。
// inset 阴影完全绘制在元素内部，不会被父容器 overflow:hidden 裁切，
// 从根本上消除多 div 方案在底部/右侧少一个像素边框的问题。
const viewportStyle = computed(() => {
  const rect = viewportRect.value;
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: MINIMAP_VIEWPORT_Z_INDEX,
    boxShadow: `inset 0 0 0 ${VIEWPORT_BORDER_PX}px var(--brand-500)`,
    backgroundColor: "var(--brand-500-alpha-10, rgb(59 130 246 / 0.1))",
  };
});

const watermarkStyle = computed(() => {
  const watermark = props.watermark;
  if (!watermark || !watermark.enabled || !watermark.text) return null;

  const angle = Number.isFinite(watermark.angle)
    ? Number(watermark.angle)
    : -30;
  const size = Math.max(6, watermark.size || 24);
  const density = Math.max(40, watermark.density || 160);
  const color = watermark.color || "#000000";
  const opacity = Math.min(1, Math.max(0, watermark.opacity ?? 0.1));

  const svg = buildWatermarkPatternSvg({
    text: watermark.text,
    angle,
    size,
    density,
    color,
    opacity,
  });

  const encoded = encodeURIComponent(svg);
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundRepeat: "repeat",
    backgroundSize: `${density}px ${density}px`,
  } as const;
});

const getPageStyle = (index: number) => {
  const base = {
    left: `${props.contentOffsetX * ratio.value}px`,
    top: `${(props.contentOffsetY + index * (props.pageHeight + PAGE_GAP) * props.zoom) * ratio.value}px`,
    width: `${props.pageWidth * props.zoom * ratio.value}px`,
    height: `${props.pageHeight * props.zoom * ratio.value}px`,
    backgroundColor: props.canvasBackground || "#ffffff",
  } as Record<string, string>;

  if (!watermarkStyle.value) return base;
  return { ...base, ...watermarkStyle.value } as Record<string, string>;
};

const getGlobalElements = () => {
  if (!props.pages || props.pages.length === 0) return [];
  const firstPage = props.pages[0];
  if (!firstPage?.elements) return [];
  const getRotatedBounds = (el: any) => {
    const rotation = Number(el?.style?.rotate || 0);
    const normalized = ((rotation % 360) + 360) % 360;
    if (normalized === 0) {
      return {
        minY: el.y,
        maxY: el.y + el.height,
      };
    }
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rad = (normalized * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x, y: el.y + el.height },
      { x: el.x + el.width, y: el.y + el.height },
    ];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of corners) {
      const ny = cy + (p.x - cx) * sin + (p.y - cy) * cos;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    }
    return { minY, maxY };
  };
  return firstPage.elements.filter((el: any) => {
    const bounds = getRotatedBounds(el);
    const isRepeatPerPage =
      el.type !== ElementType.TABLE && el.repeatPerPage === true;
    const marginTop = props.pageSpacingY || 0;
    const marginBottom = props.pageSpacingY || 0;
    const headerBoundary = props.headerHeight + marginTop;
    const footerBoundary =
      props.pageHeight - (props.footerHeight + marginBottom);
    const isHeader = props.showHeaderLine && bounds.maxY <= headerBoundary;
    const isFooter = props.showFooterLine && bounds.minY >= footerBoundary;
    return isRepeatPerPage || isHeader || isFooter;
  });
};

const getElementZIndex = (element: any) => {
  const styleZIndex = Number(element.style?.zIndex ?? 1);
  return Number.isFinite(styleZIndex)
    ? Math.min(styleZIndex, MINIMAP_MAX_ELEMENT_Z_INDEX)
    : 1;
};

const getTablePreviewElement = (element: any): PrintElement => ({
  ...element,
  id: `minimap-${element.id}`,
  style: element.style || {},
});

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
    zIndex: getElementZIndex(element),
    transform: `rotate(${element.style?.rotate || 0}deg)`,
  } as Record<string, string | number>;

  if (element.type === ElementType.LINE) {
    const lineColor = element.style?.borderColor || "#111827";
    const lineWidth = Math.max(
      1,
      (element.style?.borderWidth || 1) * props.zoom * ratio.value,
    );
    return {
      ...base,
      height: `${lineWidth}px`,
      backgroundColor: lineColor,
      top: `${element.y * props.zoom * ratio.value + (height - lineWidth) / 2}px`,
    };
  }

  if (
    element.type === ElementType.RECT ||
    element.type === ElementType.CIRCLE
  ) {
    const borderColor = element.style?.borderColor || "#111827";
    const borderWidth = Math.max(
      1,
      (element.style?.borderWidth || 1) * props.zoom * ratio.value,
    );
    return {
      ...base,
      backgroundColor: element.style?.backgroundColor || "transparent",
      borderColor,
      borderWidth: `${borderWidth}px`,
      borderStyle: element.style?.borderStyle || "solid",
      borderRadius:
        element.type === ElementType.CIRCLE
          ? "9999px"
          : `${element.style?.borderRadius || 0}px`,
    };
  }

  if (
    element.type === ElementType.BARCODE ||
    element.type === ElementType.QRCODE
  ) {
    return {
      ...base,
      backgroundColor: "rgba(17, 24, 39, 0.15)",
      border: "1px solid rgba(17, 24, 39, 0.3)",
    };
  }

  if (element.type === ElementType.PAGE_NUMBER) {
    return {
      ...base,
      color: element.style?.color || "#111827",
      backgroundColor: element.style?.backgroundColor || "transparent",
    };
  }

  return {
    ...base,
    backgroundColor: element.type === ElementType.IMAGE ? "#e5e7eb" : undefined,
  };
};

const getPageNumberText = (element: any, pageIndex: number) => {
  const current = pageIndex + 1;
  const total = props.pages?.length || 1;
  const format = element.format || "1";

  if (format === "1") return `${current}`;
  if (format === "Page 1") return `Page ${current}`;
  return `${current}/${total}`;
};

const getImageKey = (element: any) => {
  const style = element.style ? JSON.stringify(element.style) : "";
  return `${element.id}:${element.type}:${element.variable || ""}:${element.content || ""}:${style}`;
};

const barcodeSrcMap = ref<Record<string, string>>({});
const qrSrcMap = ref<Record<string, string>>({});
let imageRenderToken = 0;

const getResolvedContent = (element: any) => {
  if (element.type === ElementType.BARCODE) {
    return element.variable || element.content || "12345678";
  }
  if (element.type === ElementType.QRCODE) {
    return element.variable || element.content || "https://example.com";
  }
  return element.variable || element.content || "";
};

const renderBarcodeDataUrl = async (element: any) => {
  try {
    const jsBarcodeModule = await import("jsbarcode");
    const JsBarcode = (jsBarcodeModule as any)?.default || jsBarcodeModule;
    const canvas = document.createElement("canvas");
    const style = element.style || {};
    JsBarcode(canvas, getResolvedContent(element), {
      format: style.barcodeFormat || "CODE128",
      lineColor: style.color || "#000000",
      width: Number(style.barcodeWidth) || 2,
      height: Number(style.barcodeHeight) || 40,
      displayValue: style.showText !== false && style.showText !== "false",
      fontOptions: style.fontOptions || "",
      font: style.font || "monospace",
      textAlign: style.textAlign || "center",
      textPosition: style.textPosition || "bottom",
      textMargin: Number(style.textMargin) || 2,
      fontSize: Number(style.fontSize) || 20,
      background: "transparent",
      margin: Number(style.margin) || 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
};

const renderQrDataUrl = async (element: any) => {
  try {
    const qrcodeModule = await import("qrcode");
    const QRCode = (qrcodeModule as any)?.default || qrcodeModule;
    return await QRCode.toDataURL(getResolvedContent(element), {
      margin: 0,
      color: {
        dark: element.style?.color || "#000000",
        light: "#00000000",
      },
      errorCorrectionLevel: element.style?.qrErrorCorrection || "M",
    });
  } catch {
    return "";
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
        const src = await renderBarcodeDataUrl(element);
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

const getBarcodeSrc = (element: any) =>
  barcodeSrcMap.value[getImageKey(element)] || "";
const getQrSrc = (element: any) => qrSrcMap.value[getImageKey(element)] || "";

watch(
  () => props.pages,
  () => {
    updateCodeImages();
  },
  { deep: true, immediate: true },
);

const isDragging = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);
const DRAG_EDGE_AUTO_SCROLL_DISTANCE = 24;
const DRAG_EDGE_AUTO_SCROLL_SPEED = 12;

const ensureViewportVisible = () => {
  if (!scrollContainer.value || isDragging.value) return;

  const container = scrollContainer.value;
  const viewportTop = props.scrollTop * ratio.value;
  const viewportHeight = props.viewportHeight * ratio.value;
  const padding = 8;
  const currentTop = container.scrollTop;
  const currentBottom = currentTop + container.clientHeight;
  const targetTop = Math.max(0, viewportTop - padding);
  const targetBottom = viewportTop + viewportHeight + padding;

  let nextTop = currentTop;
  if (targetTop < currentTop) {
    nextTop = targetTop;
  } else if (targetBottom > currentBottom) {
    nextTop = targetBottom - container.clientHeight;
  }

  if (Math.abs(nextTop - currentTop) > 1) {
    container.scrollTop = nextTop;
  }
};

const scheduleEnsureViewportVisible = () => {
  nextTick(() => {
    ensureViewportVisible();
  });
};

watch(
  [() => props.scrollTop, () => props.viewportHeight, () => ratio.value],
  () => {
    scheduleEnsureViewportVisible();
  },
  { immediate: true },
);

onMounted(() => {
  scheduleEnsureViewportVisible();
});

const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  const content = e.currentTarget as HTMLElement;
  const container = scrollContainer.value;
  if (!container) return;

  const getContentPoint = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left + container.scrollLeft,
      y: clientY - rect.top + container.scrollTop,
    };
  };

  const point = getContentPoint(e.clientX, e.clientY);
  const x = point.x;
  const y = point.y;

  const viewportX = props.scrollLeft * ratio.value;
  const viewportY = props.scrollTop * ratio.value;
  const viewportW = props.viewportWidth * ratio.value;
  const viewportH = props.viewportHeight * ratio.value;

  let startOffsetX = 0;
  let startOffsetY = 0;

  if (
    x >= viewportX &&
    x <= viewportX + viewportW &&
    y >= viewportY &&
    y <= viewportY + viewportH
  ) {
    // Clicked inside viewport
    startOffsetX = x - viewportX;
    startOffsetY = y - viewportY;
  } else {
    // Clicked outside - jump center to click
    const newLeft = x / ratio.value - props.viewportWidth / 2;
    const newTop = y / ratio.value - props.viewportHeight / 2;
    emit("update:scroll", { left: newLeft, top: newTop });

    startOffsetX = viewportW / 2;
    startOffsetY = viewportH / 2;
  }

  isDragging.value = true;
  let lastClientX = e.clientX;
  let lastClientY = e.clientY;
  let autoScrollDirection = 0;
  let rafId: number | null = null;

  const emitViewportFromPointer = (clientX: number, clientY: number) => {
    const current = getContentPoint(clientX, clientY);
    const maxLeft = Math.max(0, props.scrollWidth - props.viewportWidth);
    const maxTop = Math.max(0, props.scrollHeight - props.viewportHeight);
    const nextLeft = Math.max(
      0,
      Math.min(maxLeft, (current.x - startOffsetX) / ratio.value),
    );
    const nextTop = Math.max(
      0,
      Math.min(maxTop, (current.y - startOffsetY) / ratio.value),
    );

    emit("update:scroll", {
      left: nextLeft,
      top: nextTop,
    });
  };

  const updateAutoScrollDirection = (clientY: number) => {
    const rect = container.getBoundingClientRect();
    if (clientY < rect.top + DRAG_EDGE_AUTO_SCROLL_DISTANCE) {
      autoScrollDirection = -1;
      return;
    }
    if (clientY > rect.bottom - DRAG_EDGE_AUTO_SCROLL_DISTANCE) {
      autoScrollDirection = 1;
      return;
    }
    autoScrollDirection = 0;
  };

  const autoScrollTick = () => {
    if (!isDragging.value) return;

    if (autoScrollDirection !== 0) {
      const prev = container.scrollTop;
      const maxScroll = Math.max(
        0,
        container.scrollHeight - container.clientHeight,
      );
      container.scrollTop = Math.max(
        0,
        Math.min(
          maxScroll,
          prev + autoScrollDirection * DRAG_EDGE_AUTO_SCROLL_SPEED,
        ),
      );

      if (container.scrollTop !== prev) {
        emitViewportFromPointer(lastClientX, lastClientY);
      }
    }

    rafId = window.requestAnimationFrame(autoScrollTick);
  };

  rafId = window.requestAnimationFrame(autoScrollTick);

  const onMouseMove = (ev: MouseEvent) => {
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    updateAutoScrollDirection(ev.clientY);
    emitViewportFromPointer(ev.clientX, ev.clientY);
  };

  const onMouseUp = () => {
    isDragging.value = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};
</script>

<template>
  <div
    ref="scrollContainer"
    class="bg-gray-100 dark:bg-gray-700 overflow-y-auto overflow-x-hidden box-content no-scrollbar"
    :style="{
      width: `${previewWidth}px`,
      height: `${previewMaxHeight}px`,
    }"
  >
    <div
      class="relative select-none box-content overflow-hidden"
      :style="{
        width: `${previewWidth}px`,
        height: `${contentHeight}px`,
      }"
      @mousedown="handleMouseDown"
    >
      <!-- Background -->
      <div class="absolute inset-0 bg-gray-100 dark:bg-gray-700"></div>

      <!-- Pages -->
      <div
        v-for="(page, index) in pages"
        :key="index"
        class="absolute shadow-sm border border-gray-300 overflow-hidden"
        :style="getPageStyle(index)"
      >
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm leading-none text-gray-300 pointer-events-none"
          :style="{ zIndex: MINIMAP_PAGE_NUMBER_Z_INDEX }"
        >
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
              lineHeight: 1,
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
              lineHeight: 1,
            }"
          >
            {{ getPageNumberText(element, index) }}
          </div>

          <!-- Image Placeholder -->
          <div
            v-else-if="element.type === ElementType.IMAGE"
            class="w-full h-full bg-gray-200 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="element.content"
              :src="element.content"
              class="w-full h-full object-cover"
            />
          </div>

          <div
            v-else-if="element.type === ElementType.BARCODE"
            class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="getBarcodeSrc(element)"
              :src="getBarcodeSrc(element)"
              class="w-full h-full object-contain"
            />
          </div>

          <div
            v-else-if="element.type === ElementType.QRCODE"
            class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="getQrSrc(element)"
              :src="getQrSrc(element)"
              class="w-full h-full object-contain"
            />
          </div>

          <!-- Table Placeholder -->
          <div
            v-else-if="element.type === ElementType.TABLE"
            class="relative w-full h-full overflow-hidden bg-white pointer-events-none"
          >
            <div
              class="absolute left-0 top-0"
              :style="{
                width: `${element.width}px`,
                height: `${element.height}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }"
            >
              <TableElement :element="getTablePreviewElement(element)" />
            </div>
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
                lineHeight: 1,
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
                lineHeight: 1,
              }"
            >
              {{ getPageNumberText(element, index) }}
            </div>
            <div
              v-else-if="element.type === ElementType.IMAGE"
              class="w-full h-full bg-gray-200 flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="element.content"
                :src="element.content"
                class="w-full h-full object-cover"
              />
            </div>

            <div
              v-else-if="element.type === ElementType.BARCODE"
              class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="getBarcodeSrc(element)"
                :src="getBarcodeSrc(element)"
                class="w-full h-full object-contain"
              />
            </div>

            <div
              v-else-if="element.type === ElementType.QRCODE"
              class="w-full h-full bg-gray-100 flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="getQrSrc(element)"
                :src="getQrSrc(element)"
                class="w-full h-full object-contain"
              />
            </div>
            <div
              v-else-if="element.type === ElementType.TABLE"
              class="relative w-full h-full overflow-hidden bg-white pointer-events-none"
            >
              <div
                class="absolute left-0 top-0"
                :style="{
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }"
              >
                <TableElement :element="getTablePreviewElement(element)" />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Viewport: inset box-shadow 边框完全在元素内部绘制，不会被 overflow:hidden 裁切 -->
      <div
        class="absolute cursor-move"
        :style="viewportStyle"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
