import { createApp, h } from "vue";
import { createPinia } from "pinia";
import cloneDeep from "lodash/cloneDeep";
import { v4 as uuidv4 } from "uuid";
import type { EmbeddedInTableAnchor, Page, WatermarkSettings } from "@/types";
import i18n from "@/locales";
import PrintRenderer from "@/components/print/PrintRenderer.vue";
import baseStyles from "@/style.css?inline";
import type {
  CreateRepeatedPagesFn,
  DesignerStore,
  RenderContent,
} from "./types";

export type RenderSource = {
  content: RenderContent;
  cleanup: null | (() => void);
  getComputedStyleFn: (elt: Element) => CSSStyleDeclaration;
};

type PrintRenderPayload = {
  pages: Page[];
  canvasSize: { width: number; height: number };
  canvasBackground: string;
  headerHeight: number;
  footerHeight: number;
  pageSpacingX: number;
  pageSpacingY: number;
  showHeaderLine: boolean;
  showFooterLine: boolean;
  enableHeaderFooterLineRendering: boolean;
  headerLineStyle: "solid" | "dashed" | "dotted";
  footerLineStyle: "solid" | "dashed" | "dotted";
  headerLineColor: string;
  footerLineColor: string;
  headerLineWidth: number;
  footerLineWidth: number;
  headerLineSpanMode: "value" | "percent";
  footerLineSpanMode: "value" | "percent";
  headerLineSpan: number;
  footerLineSpan: number;
  watermark: WatermarkSettings;
  unit: "mm" | "px" | "pt" | "in" | "cm";
  testData: Record<string, any>;
  variables: Record<string, any>;
};

const fallbackWatermark: WatermarkSettings = {
  enabled: false,
  text: "",
  angle: -30,
  color: "#000000",
  opacity: 0.1,
  size: 24,
  density: 160,
};

// 创建 iframe 渲染模块：负责将设计页渲染为可采集的 .print-page 内容。
export const createIframeRenderer = ({
  store,
  createRepeatedPages,
}: {
  store: DesignerStore;
  createRepeatedPages: CreateRepeatedPagesFn;
}) => {
  const clamp = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  };

  const resolveContentPages = (content?: RenderContent) => {
    if (!content || typeof content === "string") return [];
    if (Array.isArray(content)) return content;
    if (content.classList.contains("design-workspace")) {
      return Array.from(content.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );
    }
    return [content];
  };

  const getCellBorderInsetRect = (
    cellEl: HTMLElement,
    wrapperRect: DOMRect,
  ) => {
    const rect = cellEl.getBoundingClientRect();
    const win = cellEl.ownerDocument.defaultView || window;
    const style = win.getComputedStyle(cellEl);
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

  const collectEmbeddedAnchorsFromContent = (
    content: RenderContent | undefined,
    pagesSource: Page[],
  ) => {
    const contentPages = resolveContentPages(content);
    if (contentPages.length === 0) return;

    pagesSource.forEach((page, pageIndex) => {
      const pageNode = contentPages[pageIndex];
      if (!pageNode) return;

      const wrapperById = new Map<string, HTMLElement>();
      pageNode
        .querySelectorAll<HTMLElement>(".element-wrapper")
        .forEach((el) => {
          const id = el.getAttribute("data-element-id");
          if (id) wrapperById.set(id, el);
        });

      page.elements.forEach((element) => {
        if (!element.embeddedInTableId || !element.embeddedInTableCell) return;

        const wrapper = wrapperById.get(element.id);
        const tableWrapper = wrapperById.get(element.embeddedInTableId);
        if (!wrapper || !tableWrapper) return;

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

        const wrapperRect = wrapper.getBoundingClientRect();
        const width = Math.min(cellWidth, Math.max(0, wrapperRect.width));
        const height = Math.min(cellHeight, Math.max(0, wrapperRect.height));
        const widthRatio = clamp(width / cellWidth, 0, 1);
        const heightRatio = clamp(height / cellHeight, 0, 1);
        const fillTolerance = 2;
        const cellStyle =
          cell.ownerDocument.defaultView?.getComputedStyle(cell) ||
          window.getComputedStyle(cell);
        const toPx = (value: string) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        };
        const contentRect = {
          left: cellRect.left + toPx(cellStyle.paddingLeft),
          right: cellRect.right - toPx(cellStyle.paddingRight),
          top: cellRect.top + toPx(cellStyle.paddingTop),
          bottom: cellRect.bottom - toPx(cellStyle.paddingBottom),
        };
        const leftGap = Math.abs(wrapperRect.left - cellRect.left);
        const rightGap = Math.abs(cellRect.right - wrapperRect.right);
        const topGap = Math.abs(wrapperRect.top - cellRect.top);
        const bottomGap = Math.abs(cellRect.bottom - wrapperRect.bottom);
        const contentLeftGap = Math.abs(wrapperRect.left - contentRect.left);
        const contentRightGap = Math.abs(contentRect.right - wrapperRect.right);
        const contentTopGap = Math.abs(wrapperRect.top - contentRect.top);
        const contentBottomGap = Math.abs(
          contentRect.bottom - wrapperRect.bottom,
        );
        const contentWidth = Math.max(0, contentRect.right - contentRect.left);
        const contentHeight = Math.max(0, contentRect.bottom - contentRect.top);
        const contentWidthRatio =
          contentWidth > 0 ? clamp(width / contentWidth, 0, 1) : 0;
        const contentHeightRatio =
          contentHeight > 0 ? clamp(height / contentHeight, 0, 1) : 0;
        const fillsWidthByCell =
          leftGap <= fillTolerance &&
          rightGap <= fillTolerance &&
          widthRatio >= 0.985;
        const fillsHeightByCell =
          topGap <= fillTolerance &&
          bottomGap <= fillTolerance &&
          heightRatio >= 0.985;
        const fillsWidthByContent =
          contentLeftGap <= fillTolerance &&
          contentRightGap <= fillTolerance &&
          contentWidth > 0 &&
          contentWidthRatio >= 0.985;
        const fillsHeightByContent =
          contentTopGap <= fillTolerance &&
          contentBottomGap <= fillTolerance &&
          contentHeight > 0 &&
          contentHeightRatio >= 0.985;

        const anchor: EmbeddedInTableAnchor = {
          offsetXRatio:
            cellWidth > 0
              ? (wrapperRect.left - cellRect.left) / cellWidth
              : 0,
          offsetYRatio:
            cellHeight > 0
              ? (wrapperRect.top - cellRect.top) / cellHeight
              : 0,
          widthRatio,
          heightRatio,
          fillsWidth: fillsWidthByCell || fillsWidthByContent,
          fillsHeight: fillsHeightByCell || fillsHeightByContent,
        };

        element.embeddedInTableAnchor = anchor;
      });
    });
  };

  // 构建传给 PrintRenderer 的完整渲染载荷。
  const buildPrintRenderPayload = (
    content?: RenderContent,
  ): PrintRenderPayload => {
    const sourcePages = cloneDeep(store.pages);
    collectEmbeddedAnchorsFromContent(content, sourcePages);

    return {
      pages: createRepeatedPages(sourcePages),
      canvasSize: { ...store.canvasSize },
      canvasBackground: store.canvasBackground,
      headerHeight: store.headerHeight,
      footerHeight: store.footerHeight,
      pageSpacingX: store.pageSpacingX || 0,
      pageSpacingY: store.pageSpacingY || 0,
      showHeaderLine: store.showHeaderLine,
      showFooterLine: store.showFooterLine,
      enableHeaderFooterLineRendering: Boolean(
        store.enableHeaderFooterLineRendering,
      ),
      headerLineStyle:
        store.headerLineStyle === "solid" || store.headerLineStyle === "dotted"
          ? store.headerLineStyle
          : "dashed",
      footerLineStyle:
        store.footerLineStyle === "solid" || store.footerLineStyle === "dotted"
          ? store.footerLineStyle
          : "dashed",
      headerLineColor:
        typeof store.headerLineColor === "string" &&
        store.headerLineColor.trim()
          ? store.headerLineColor
          : "#f87171",
      footerLineColor:
        typeof store.footerLineColor === "string" &&
        store.footerLineColor.trim()
          ? store.footerLineColor
          : "#f87171",
      headerLineWidth: Math.max(
        1,
        Math.round(Number(store.headerLineWidth) || 1),
      ),
      footerLineWidth: Math.max(
        1,
        Math.round(Number(store.footerLineWidth) || 1),
      ),
      headerLineSpanMode:
        store.headerLineSpanMode === "percent" ? "percent" : "value",
      footerLineSpanMode:
        store.footerLineSpanMode === "percent" ? "percent" : "value",
      headerLineSpan:
        store.headerLineSpanMode === "percent"
          ? Math.min(
              100,
              Math.max(
                1,
                Number(Number(store.headerLineSpan || 100).toFixed(2)),
              ),
            )
          : Math.max(1, Math.round(Number(store.headerLineSpan) || 100)),
      footerLineSpan:
        store.footerLineSpanMode === "percent"
          ? Math.min(
              100,
              Math.max(
                1,
                Number(Number(store.footerLineSpan || 100).toFixed(2)),
              ),
            )
          : Math.max(1, Math.round(Number(store.footerLineSpan) || 100)),
      watermark: cloneDeep(store.watermark || fallbackWatermark),
      unit: store.unit || "mm",
      testData: cloneDeep(store.testData || {}),
      variables: cloneDeep(store.variables || {}),
    };
  };

  // 等待渲染完成消息，超时则抛出错误。
  const waitForMessage = (token: string, type: string, timeoutMs = 15000) =>
    new Promise<any>((resolve, reject) => {
      const origin = window.location.origin;
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", handler);
        window.removeEventListener(
          `print-renderer:${type}`,
          customHandler as any,
        );
        reject(new Error(`Print renderer timeout: ${type}`));
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.origin !== origin) return;
        const data = event.data as { type?: string; token?: string };
        if (!data || data.type !== type || data.token !== token) return;
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        window.removeEventListener(
          `print-renderer:${type}`,
          customHandler as any,
        );
        resolve(data);
      };

      const customHandler = (event: CustomEvent) => {
        if (event.detail && event.detail.token === token) {
          window.clearTimeout(timeoutId);
          window.removeEventListener("message", handler);
          window.removeEventListener(
            `print-renderer:${type}`,
            customHandler as any,
          );
          resolve({ type, token });
        }
      };

      window.addEventListener("message", handler);
      window.addEventListener(`print-renderer:${type}`, customHandler as any);
    });

  // 在隐藏 iframe 中挂载 PrintRenderer，并返回渲染结果与清理函数。
  const renderPagesViaIframe = async (content: RenderContent) => {
    const token = uuidv4();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-print-renderer", "true");
    iframe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) throw new Error("Print renderer not available");

    const style = frameDoc.createElement("style");
    style.textContent = baseStyles;
    frameDoc.head.appendChild(style);

    const mountEl = frameDoc.createElement("div");
    mountEl.id = "app";
    frameDoc.body.appendChild(mountEl);

    const payload = buildPrintRenderPayload(content);
    const app = createApp({
      render: () => h(PrintRenderer, { payload, token }),
    });

    app.use(createPinia());
    app.use(i18n);
    app.mount(mountEl);

    const cleanup = () => {
      app.unmount();
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    try {
      await waitForMessage(token, "print-renderer-rendered");

      const pages = Array.from(
        frameDoc.querySelectorAll(".print-page"),
      ) as HTMLElement[];
      return {
        pages,
        cleanup,
        getComputedStyleFn: frameWin.getComputedStyle.bind(frameWin),
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  };

  // 统一解析渲染源：字符串直返，其它来源统一走 iframe 渲染。
  const resolveRenderSource = async (
    content: RenderContent,
  ): Promise<RenderSource> => {
    if (typeof content === "string") {
      return {
        content,
        cleanup: null,
        getComputedStyleFn: window.getComputedStyle,
      };
    }

    const iframeResult = await renderPagesViaIframe(content);
    return {
      content: iframeResult.pages,
      cleanup: iframeResult.cleanup,
      getComputedStyleFn: iframeResult.getComputedStyleFn,
    };
  };

  return { resolveRenderSource };
};
