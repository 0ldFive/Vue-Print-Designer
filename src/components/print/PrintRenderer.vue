<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, provide } from "vue";
import cloneDeep from "lodash/cloneDeep";
import { useDesignerStore } from "@/stores/designer";
import Canvas from "@/components/canvas/Canvas.vue";

const props = defineProps<{
  payload?: any;
  token?: string;
}>();

const root = ref<HTMLElement | null>(null);
const store = useDesignerStore();
const token =
  props.token ||
  new URLSearchParams(window.location.search).get("printToken") ||
  "";
const origin = window.location.origin;

// Registry for async render tasks (like QRCode, Barcode)
const renderTasks = ref<Promise<void>[]>([]);
provide("registerRenderTask", (task: Promise<void>) => {
  renderTasks.value.push(task);
});

const getDoc = () => root.value?.ownerDocument || document;
const getWin = () => getDoc().defaultView || window;

const postToParent = (type: string) => {
  const win = getWin();
  if (win.parent && win.parent !== win) {
    win.parent.postMessage({ type, token }, origin);
  }
  // Also dispatch a custom event for local usage
  window.dispatchEvent(
    new CustomEvent(`print-renderer:${type}`, { detail: { token } }),
  );
};

const waitForFonts = async (timeoutMs = 2000) => {
  const doc = getDoc();
  const fonts = (doc as any).fonts as FontFaceSet | undefined;
  if (!fonts || !fonts.ready) return;
  await Promise.race([
    fonts.ready,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

const waitForImages = async (timeoutMs = 2000) => {
  const doc = getDoc();
  const images = Array.from(doc.images || []) as HTMLImageElement[];
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return;

  await Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            const done = () => {
              img.removeEventListener("load", done);
              img.removeEventListener("error", done);
              resolve();
            };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

const getCellBorderInsetRect = (cellEl: HTMLElement, wrapperRect: DOMRect) => {
  const rect = cellEl.getBoundingClientRect();
  const style = getWin().getComputedStyle(cellEl);
  const toPx = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    left: Math.max(rect.left + toPx(style.borderLeftWidth), wrapperRect.left),
    top: Math.max(rect.top + toPx(style.borderTopWidth), wrapperRect.top),
    right: Math.min(
      rect.right - toPx(style.borderRightWidth),
      wrapperRect.right,
    ),
    bottom: Math.min(
      rect.bottom - toPx(style.borderBottomWidth),
      wrapperRect.bottom,
    ),
  };
};

const syncEmbeddedAnchorsToRenderedCells = () => {
  const host = root.value;
  if (!host) return false;

  const pageNodes = Array.from(
    host.querySelectorAll<HTMLElement>(".print-page"),
  );
  let hasChanged = false;
  const epsilon = 0.01;

  store.pages.forEach((page, pageIndex) => {
    const pageNode = pageNodes[pageIndex];
    if (!pageNode) return;

    const pageRect = pageNode.getBoundingClientRect();
    const wrapperById = new Map<string, HTMLElement>();
    pageNode.querySelectorAll<HTMLElement>(".element-wrapper").forEach((el) => {
      const id = el.getAttribute("data-element-id");
      if (id) wrapperById.set(id, el);
    });

    page.elements.forEach((element) => {
      if (
        !element.embeddedInTableId ||
        !element.embeddedInTableCell ||
        !element.embeddedInTableAnchor
      ) {
        return;
      }

      const tableWrapper = wrapperById.get(element.embeddedInTableId);
      if (!tableWrapper) return;

      const { rowIndex, colField } = element.embeddedInTableCell;
      const section = element.embeddedInTableCell.section || "body";
      const cell = Array.from(
        tableWrapper.querySelectorAll<HTMLElement>(
          "td[data-field][data-row-index][data-section]",
        ),
      ).find(
        (cellEl) =>
          cellEl.dataset.field === colField &&
          cellEl.dataset.rowIndex === String(rowIndex) &&
          (cellEl.dataset.section || "body") === section,
      );
      if (!cell) return;

      const tableRect = tableWrapper.getBoundingClientRect();
      const cellRect = getCellBorderInsetRect(cell, tableRect);
      const cellWidth = Math.max(0, cellRect.right - cellRect.left);
      const cellHeight = Math.max(0, cellRect.bottom - cellRect.top);
      if (cellWidth <= 0 || cellHeight <= 0) return;

      const anchor = element.embeddedInTableAnchor;
      const fillsCellWidth = anchor.fillsWidth === true;
      const fillsCellHeight = anchor.fillsHeight === true;
      const nextWidth = fillsCellWidth
        ? cellWidth
        : Math.max(0, element.width);
      const nextHeight = fillsCellHeight
        ? cellHeight
        : Math.max(0, element.height);
      const nextX =
        cellRect.left - pageRect.left + cellWidth * anchor.offsetXRatio;
      const nextY =
        cellRect.top - pageRect.top + cellHeight * anchor.offsetYRatio;

      const changed =
        Math.abs(element.x - nextX) > epsilon ||
        Math.abs(element.y - nextY) > epsilon ||
        Math.abs(element.width - nextWidth) > epsilon ||
        Math.abs(element.height - nextHeight) > epsilon;
      if (!changed) return;

      element.x = nextX;
      element.y = nextY;
      element.width = nextWidth;
      element.height = nextHeight;
      hasChanged = true;
    });
  });

  return hasChanged;
};

const applyPayload = async (payload: any) => {
  store.$patch({
    pages: cloneDeep(payload.pages || []),
    canvasSize: payload.canvasSize || store.canvasSize,
    canvasBackground: payload.canvasBackground || store.canvasBackground,
    headerHeight: payload.headerHeight ?? store.headerHeight,
    footerHeight: payload.footerHeight ?? store.footerHeight,
    pageSpacingX: payload.pageSpacingX ?? store.pageSpacingX,
    pageSpacingY: payload.pageSpacingY ?? store.pageSpacingY,
    showHeaderLine: payload.showHeaderLine ?? false,
    showFooterLine: payload.showFooterLine ?? false,
    enableHeaderFooterLineRendering:
      payload.enableHeaderFooterLineRendering ?? false,
    headerLineStyle:
      payload.headerLineStyle === "solid" ||
      payload.headerLineStyle === "dotted"
        ? payload.headerLineStyle
        : "dashed",
    footerLineStyle:
      payload.footerLineStyle === "solid" ||
      payload.footerLineStyle === "dotted"
        ? payload.footerLineStyle
        : "dashed",
    headerLineColor:
      typeof payload.headerLineColor === "string" &&
      payload.headerLineColor.trim()
        ? payload.headerLineColor
        : "#f87171",
    footerLineColor:
      typeof payload.footerLineColor === "string" &&
      payload.footerLineColor.trim()
        ? payload.footerLineColor
        : "#f87171",
    headerLineWidth: Math.max(
      1,
      Math.round(Number(payload.headerLineWidth) || 1),
    ),
    footerLineWidth: Math.max(
      1,
      Math.round(Number(payload.footerLineWidth) || 1),
    ),
    headerLineSpanMode:
      payload.headerLineSpanMode === "percent" ? "percent" : "value",
    footerLineSpanMode:
      payload.footerLineSpanMode === "percent" ? "percent" : "value",
    headerLineSpan:
      payload.headerLineSpanMode === "percent"
        ? Math.min(
            100,
            Math.max(
              1,
              Number(Number(payload.headerLineSpan || 100).toFixed(2)),
            ),
          )
        : Math.max(1, Math.round(Number(payload.headerLineSpan) || 100)),
    footerLineSpan:
      payload.footerLineSpanMode === "percent"
        ? Math.min(
            100,
            Math.max(
              1,
              Number(Number(payload.footerLineSpan || 100).toFixed(2)),
            ),
          )
        : Math.max(1, Math.round(Number(payload.footerLineSpan) || 100)),
    showGrid: false,
    showCornerMarkers: false,
    zoom: 1,
    currentPageIndex: 0,
    selectedElementId: null,
    selectedElementIds: [],
    guides: [],
    testData: payload.testData || {},
    variables: payload.variables || {},
  });

  if (payload.watermark) {
    store.watermark = cloneDeep(payload.watermark);
  }
  if (payload.unit) {
    store.unit = payload.unit;
  }

  store.setIsExporting(true);
  const doc = getDoc();
  doc.body.classList.add("exporting");

  // Reset render tasks before nextTick
  renderTasks.value = [];

  await nextTick();
  // Wait for async rendering components like QRCode and Barcode which registered their tasks
  await Promise.all(renderTasks.value);
  if (syncEmbeddedAnchorsToRenderedCells()) {
    renderTasks.value = [];
    await nextTick();
    await Promise.all(renderTasks.value);
  }
  await waitForFonts();
  await waitForImages();
  requestAnimationFrame(() => {
    postToParent("print-renderer-rendered");
  });
};

const onMessage = (event: MessageEvent) => {
  if (event.origin !== origin) return;
  const data = event.data as { type?: string; token?: string; payload?: any };
  if (!data || data.type !== "print-renderer-payload" || data.token !== token)
    return;
  applyPayload(data.payload || {});
};

onMounted(() => {
  const doc = getDoc();
  const win = getWin();

  doc.body.style.margin = "0";
  doc.body.style.background = "#ffffff";
  win.addEventListener("message", onMessage);

  if (props.payload) {
    applyPayload(props.payload);
  } else {
    postToParent("print-renderer-ready");
  }
});

onUnmounted(() => {
  const win = getWin();
  win.removeEventListener("message", onMessage);
});
</script>

<template>
  <div class="print-renderer" ref="root">
    <Canvas />
  </div>
</template>

<style scoped>
.print-renderer {
  padding: 0;
}
</style>
