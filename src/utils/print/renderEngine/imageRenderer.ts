import { usePrintSettings } from "@/composables/usePrintSettings";
import { pxToMm } from "@/utils/units";
import {
  cleanElement,
  cloneElementWithStyles,
  isShadowDomContent,
  lockViewportScroll,
} from "../dom";
import type {
  DesignerStore,
  PrepareEnvironmentFn,
  RenderContent,
} from "./types";
import type { RenderSource } from "./iframeRenderer";

export interface ImageRendererDeps {
  store: DesignerStore;
  prepareEnvironment: PrepareEnvironmentFn;
  resolveRenderSource: (content: RenderContent) => Promise<RenderSource>;
  handleTablePagination: (
    container: HTMLElement,
    pageHeight: number,
    headerHeight: number,
    footerHeight: number,
    copyHeader: boolean,
    copyFooter: boolean,
  ) => number;
  updatePageNumbers: (container: HTMLElement, totalPages: number) => void;
}

// 创建图片/PDF 渲染模块：负责 HTML 预处理、分页截图与 PDF 生成。
export const createImageRenderer = (deps: ImageRendererDeps) => {
  const {
    store,
    prepareEnvironment,
    resolveRenderSource,
    handleTablePagination,
    updatePageNumbers,
  } = deps;

  // 生成打印预览 HTML：兼容字符串与 DOM 节点两种输入。
  const getPrintHtml = async (content?: HTMLElement[]): Promise<string> => {
    const targetContent =
      content ||
      (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
    const restore = await prepareEnvironment({
      mutateStore: false,
      setExporting: false,
    });

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;

    let resultContainer: HTMLElement | null = null;
    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const result = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );
      resultContainer = result.container;
      tempWrapper = result.tempWrapper;

      const previewContainer = document.createElement("div");
      previewContainer.style.width = "100%";
      previewContainer.style.display = "flex";
      previewContainer.style.flexDirection = "column";
      previewContainer.style.alignItems = "center";

      const paginatedPages = Array.from(resultContainer.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];

      paginatedPages.forEach((page, index) => {
        const clone = page.cloneNode(true) as HTMLElement;
        const isLastPage = index === paginatedPages.length - 1;

        clone.style.position = "relative";
        clone.style.left = "auto";
        clone.style.top = "auto";
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;
        clone.style.margin = isLastPage ? "0" : "0 0 20px 0";
        clone.style.backgroundColor = store.canvasBackground;
        clone.style.transform = "none";

        previewContainer.appendChild(clone);
      });

      return previewContainer.outerHTML;
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      if (cleanup) {
        cleanup();
      }
      restore();
    }
  };

  // 将 SVG 转为 Canvas，避免导出图片时丢失矢量内容。
  const svgToCanvas = async (root: HTMLElement) => {
    const svgs = root.querySelectorAll("svg");
    if (svgs.length === 0) return;
    // @ts-ignore - 忽略 TS7016：canvg 的 package.json exports 导致类型解析异常
    const { Canvg } = await import("canvg");

    svgs.forEach((svg) => {
      const parent = svg.parentElement as HTMLElement | null;
      if (!parent) return;
      const style = getComputedStyle(parent);
      const w = parseFloat(style.width);
      const h = parseFloat(style.height);
      const canvas = document.createElement("canvas");
      canvas.width = Number.isFinite(w) ? Math.max(1, Math.round(w)) : 10;
      canvas.height = Number.isFinite(h) ? Math.max(1, Math.round(h)) : 10;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const serializer = new XMLSerializer();
      svg.setAttribute("width", `${w}px`);
      svg.setAttribute("height", `${h}px`);

      const str = serializer.serializeToString(svg);
      const instance = Canvg.fromString(ctx, str);
      instance.render();

      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/png");
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.display = "block";

      svg.before(img);
      parent.removeChild(svg);
    });
  };

  // 创建临时容器（保留兼容能力，供按页拼接流程复用）。
  const createTempContainer = (
    width: number,
    height: number,
    pagesCount: number,
  ): HTMLElement => {
    const temp = document.createElement("div");
    temp.className = "print_temp_container";
    temp.style.cssText =
      "position:fixed;left:0;top:0;z-index:-9999;overflow:hidden;height:0;box-sizing:border-box;";

    const container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = `${width}px`;
    container.style.height = `${height * pagesCount}px`;
    container.style.backgroundColor = "#ffffff";

    temp.appendChild(container);
    document.body.appendChild(temp);

    return container;
  };

  const parseCssNumber = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const isAxisAlignedTransform = (transform: string) => {
    if (!transform || transform === "none") return true;
    if (!transform.startsWith("matrix(")) return false;

    const values = transform
      .slice(7, -1)
      .split(",")
      .map((item) => parseFloat(item.trim()));

    if (values.length < 4 || values.some((value) => !Number.isFinite(value))) {
      return false;
    }

    const b = values[1];
    const c = values[2];
    return Math.abs(b) <= 0.001 && Math.abs(c) <= 0.001;
  };

  // 完全位于画布外的元素不参与后续分页与导出渲染。
  const isWrapperFullyOutsideCanvas = (
    wrapper: HTMLElement,
    canvasWidth: number,
    canvasHeight: number,
  ) => {
    const left = parseCssNumber(wrapper.style.left);
    const top = parseCssNumber(wrapper.style.top);
    const wrapperWidth = parseCssNumber(wrapper.style.width);
    const wrapperHeight = parseCssNumber(wrapper.style.height);

    if (
      left === null ||
      top === null ||
      wrapperWidth === null ||
      wrapperHeight === null ||
      wrapperWidth <= 0 ||
      wrapperHeight <= 0
    ) {
      return false;
    }

    const transform = wrapper.style.transform || "";
    if (!isAxisAlignedTransform(transform)) {
      return false;
    }

    const right = left + wrapperWidth;
    const bottom = top + wrapperHeight;
    return (
      right <= 0 || bottom <= 0 || left >= canvasWidth || top >= canvasHeight
    );
  };

  const clamp = (value: number, min: number, max: number) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  };

  const readRatio = (value: string | undefined) => {
    if (value === undefined) return null;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    return clamp(parsed, 0, 1);
  };

  const getCellBorderInsetRect = (
    cellEl: HTMLElement,
    wrapperRect: DOMRect,
  ) => {
    const rect = cellEl.getBoundingClientRect();
    const style = window.getComputedStyle(cellEl);
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

  const inlineEmbeddedWrapperIntoTableCell = (
    wrapper: HTMLElement,
    wrapperById: Map<string, HTMLElement>,
  ) => {
    const tableId = wrapper.dataset.embeddedTableId;
    const rowIndexRaw = wrapper.dataset.embeddedCellRowIndex;
    const colField = wrapper.dataset.embeddedCellColField;
    const section = wrapper.dataset.embeddedCellSection || "body";
    if (!tableId || rowIndexRaw === undefined || !colField) return false;

    const tableWrapper = wrapperById.get(tableId);
    if (!tableWrapper || tableWrapper === wrapper) return false;

    const rowIndex = Number(rowIndexRaw);
    if (!Number.isFinite(rowIndex)) return false;

    const candidateCells = tableWrapper.querySelectorAll<HTMLElement>(
      "td[data-field][data-row-index][data-section]",
    );

    let matchedCell: HTMLElement | null = null;
    for (const cellEl of candidateCells) {
      if (
        cellEl.dataset.field === colField &&
        cellEl.dataset.rowIndex === String(rowIndex) &&
        (cellEl.dataset.section || "body") === section
      ) {
        matchedCell = cellEl;
        break;
      }
    }

    if (!matchedCell) return false;

    const tableRect = tableWrapper.getBoundingClientRect();
    const cellRect = getCellBorderInsetRect(matchedCell, tableRect);
    const cellWidth = Math.max(0, cellRect.right - cellRect.left);
    const cellHeight = Math.max(0, cellRect.bottom - cellRect.top);
    if (cellWidth <= 0 || cellHeight <= 0) return false;

    const offsetXRatio = readRatio(wrapper.dataset.embeddedAnchorOffsetXRatio);
    const offsetYRatio = readRatio(wrapper.dataset.embeddedAnchorOffsetYRatio);
    const widthRatio = readRatio(wrapper.dataset.embeddedAnchorWidthRatio);
    const heightRatio = readRatio(wrapper.dataset.embeddedAnchorHeightRatio);
    const fillsWidth = wrapper.dataset.embeddedAnchorFillsWidth === "true";
    const fillsHeight = wrapper.dataset.embeddedAnchorFillsHeight === "true";

    let nextWidth: number;
    let nextHeight: number;
    let nextLeft: number;
    let nextTop: number;
    const wrapperRect = wrapper.getBoundingClientRect();
    nextWidth = Math.max(0, wrapperRect.width);
    nextHeight = Math.max(0, wrapperRect.height);

    if (
      offsetXRatio !== null &&
      offsetYRatio !== null &&
      widthRatio !== null &&
      heightRatio !== null
    ) {
      if (fillsWidth) nextWidth = cellWidth;
      if (fillsHeight) nextHeight = cellHeight;
      nextLeft = wrapperRect.left - cellRect.left;
      nextTop = wrapperRect.top - cellRect.top;
    } else {
      nextLeft = wrapperRect.left - cellRect.left;
      nextTop = wrapperRect.top - cellRect.top;
    }

    matchedCell.style.position = "relative";
    matchedCell.style.overflow = "visible";
    wrapper.setAttribute("data-print-embedded-wrapper", "true");
    wrapper.removeAttribute("data-print-wrapper");
    wrapper.removeAttribute("data-flow-id");
    wrapper.removeAttribute("data-flow-kind");
    wrapper.removeAttribute("data-original-top");
    wrapper.removeAttribute("data-original-height");
    wrapper.style.position = "absolute";
    wrapper.style.left = `${nextLeft}px`;
    wrapper.style.top = `${nextTop}px`;
    wrapper.style.width = `${nextWidth}px`;
    wrapper.style.height = `${nextHeight}px`;
    wrapper.style.margin = "0";
    wrapper.style.right = "auto";
    wrapper.style.bottom = "auto";
    wrapper.style.clipPath = "none";

    matchedCell.appendChild(wrapper);
    return true;
  };

  // 渲染前预处理：克隆页面、清理节点、分页并同步页码。
  const processContentForImage = async (
    content: RenderContent,
    width: number,
    height: number,
    convertSvg = true,
    getComputedStyleFn: (
      elt: Element,
    ) => CSSStyleDeclaration = window.getComputedStyle,
  ) => {
    const tempHost = document.createElement("div");
    tempHost.style.position = "fixed";
    tempHost.style.left = "0";
    tempHost.style.top = "0";
    tempHost.style.width = "0";
    tempHost.style.height = "0";
    tempHost.style.overflow = "hidden";
    tempHost.style.zIndex = "-9999";
    tempHost.style.visibility = "hidden";
    tempHost.style.pointerEvents = "none";
    tempHost.className = "print_temp_container";
    document.body.appendChild(tempHost);

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    tempHost.appendChild(container);

    let pages: HTMLElement[] = [];
    if (typeof content === "string") {
      container.innerHTML = content;
      pages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];
    } else if (Array.isArray(content)) {
      pages = content;
    } else {
      if (content.classList.contains("design-workspace")) {
        pages = Array.from(content.children) as HTMLElement[];
      } else {
        pages = [content];
      }
    }

    pages.forEach((page, idx) => {
      const clone = cloneElementWithStyles(page, getComputedStyleFn);
      clone.style.position = "absolute";
      clone.style.left = "0";
      clone.style.top = `${idx * height}px`;
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.transform = "none";
      clone.style.backgroundColor = store.canvasBackground;

      container.appendChild(clone);

      clone
        .querySelectorAll('[data-print-exclude="true"]')
        .forEach((el) => el.remove());

      const wrappers = Array.from(
        clone.querySelectorAll<HTMLElement>(".element-wrapper"),
      );
      const wrapperById = new Map<string, HTMLElement>();
      wrappers.forEach((wrapper) => {
        const id = wrapper.getAttribute("data-element-id");
        if (id) wrapperById.set(id, wrapper);
      });
      wrappers.forEach((w, wrapperIndex) => {
        const el = w as HTMLElement;

        if (inlineEmbeddedWrapperIntoTableCell(el, wrapperById)) {
          return;
        }

        if (isWrapperFullyOutsideCanvas(el, width, height)) {
          el.remove();
          return;
        }

        el.setAttribute("data-print-wrapper", "true");
        const top = parseFloat(el.style.top || "");
        const elHeight = parseFloat(el.style.height || "");
        const resolvedTop = Number.isFinite(top) ? top : 0;
        const resolvedHeight = Number.isFinite(elHeight)
          ? elHeight
          : el.getBoundingClientRect().height;
        el.setAttribute("data-original-top", `${resolvedTop}`);
        el.setAttribute("data-original-height", `${resolvedHeight}`);
        el.setAttribute("data-origin-page-index", `${idx}`);
        const wrapperSeq = `${idx}-${wrapperIndex}`;
        el.setAttribute("data-wrapper-seq", wrapperSeq);

        const table = el.querySelector("table");
        const autoHeightEl = el.querySelector('[data-auto-height="true"]');
        const marginTop = store.pageSpacingY || 0;
        const marginBottom = store.pageSpacingY || 0;
        const isHeaderTable =
          !!table &&
          store.showHeaderLine &&
          store.headerHeight > 0 &&
          resolvedTop + resolvedHeight <= store.headerHeight + marginTop;
        const isFooterTable =
          !!table &&
          store.showFooterLine &&
          store.footerHeight > 0 &&
          resolvedTop >= height - store.footerHeight - marginBottom;

        if (table && (isHeaderTable || isFooterTable)) {
          table.setAttribute("data-auto-paginate", "false");
          el.removeAttribute("data-flow-id");
          el.removeAttribute("data-flow-kind");
        } else if (
          table &&
          table.getAttribute("data-auto-paginate") === "true"
        ) {
          el.setAttribute("data-flow-id", wrapperSeq);
          el.setAttribute("data-flow-kind", "table");
        } else if (autoHeightEl) {
          el.setAttribute("data-flow-id", wrapperSeq);
          el.setAttribute("data-flow-kind", "auto-height");
        } else {
          el.removeAttribute("data-flow-id");
          el.removeAttribute("data-flow-kind");
        }
      });

      cleanElement(clone);

      const svgs = clone.querySelectorAll("svg");
      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          const w = svg.getAttribute("width");
          const h = svg.getAttribute("height");
          if (w) svg.style.width = w.includes("px") ? w : `${w}px`;
          if (h) svg.style.height = h.includes("px") ? h : `${h}px`;
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (convertSvg) {
      await svgToCanvas(container);
    }

    const pagesCount = handleTablePagination(
      container,
      height,
      store.headerHeight,
      store.footerHeight,
      store.showHeaderLine,
      store.showFooterLine,
    );

    updatePageNumbers(container, pagesCount);
    container.style.height = `${height * pagesCount}px`;

    return { container, tempWrapper: tempHost, pagesCount };
  };

  // 将每页 DOM 渲染为 JPEG DataURL。
  const generatePageImages = async (
    container: HTMLElement,
    width: number,
    height: number,
  ): Promise<string[]> => {
    const pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];

    pages.forEach((page) => {
      page.style.top = "0px";
    });

    const monacoLinks = Array.from(
      document.querySelectorAll('link[href*="monaco-editor"]'),
    );
    const linkParents = monacoLinks.map((link) => link.parentNode);
    monacoLinks.forEach((link) => link.parentNode?.removeChild(link));

    const printSettings = usePrintSettings();
    const printQualityStr = printSettings?.printQuality?.value ?? "normal";

    let printQualityScale = 1;
    let jpegQuality = 0.8;
    if (printQualityStr === "fast") {
      printQualityScale = 0.5;
      jpegQuality = 0.6;
    } else if (printQualityStr === "normal") {
      printQualityScale = 1;
      jpegQuality = 0.8;
    } else if (printQualityStr === "high") {
      printQualityScale = 1.5;
      jpegQuality = 0.9;
    } else if (printQualityStr === "ultra") {
      printQualityScale = 2;
      jpegQuality = 1.0;
    }

    try {
      // 渲染单页为图片数据。
      const generatePageImage = async (page: HTMLElement) => {
        const domToImageModule = await import("dom-to-image-more");
        const domtoimage =
          (domToImageModule as any)?.default || domToImageModule;
        const canvas = await domtoimage.toCanvas(page, {
          filter: (node: Node) => {
            if (node.nodeType === 1 && (node as Element).tagName === "LINK") {
              const href = (node as HTMLLinkElement).href;
              if (href && href.includes("monaco-editor")) {
                return false;
              }
            }
            return true;
          },
          scale: printQualityScale,
          width,
          height,
          useCORS: true,
          bgcolor: store.canvasBackground,
        });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          (ctx as any).mozImageSmoothingEnabled = true;
          (ctx as any).webkitImageSmoothingEnabled = true;
          (ctx as any).msImageSmoothingEnabled = true;
          ctx.imageSmoothingEnabled = true;
        }

        return canvas.toDataURL("image/jpeg", jpegQuality);
      };

      const batchSize = 3;
      const pageImages: string[] = [];

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((page) => generatePageImage(page)),
        );
        pageImages.push(...results);
      }

      return pageImages;
    } finally {
      monacoLinks.forEach((link, index) => {
        if (linkParents[index]) {
          linkParents[index]?.appendChild(link);
        }
      });
    }
  };

  // 生成 jsPDF 文档对象，并按页写入截图图像。
  const createPdfDocument = async (content: RenderContent) => {
    const restore = await prepareEnvironment({
      mutateStore: false,
      setExporting: false,
    });
    const restoreViewport = lockViewportScroll(!isShadowDomContent(content));

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    const widthMm = pxToMm(width);
    const heightMm = pxToMm(height);

    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const source = await resolveRenderSource(content);
      cleanup = source.cleanup;

      const { container, tempWrapper: wrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );
      tempWrapper = wrapper;

      const jsPdfModule = await import("jspdf");
      const jsPDF =
        (jsPdfModule as any)?.default ||
        (jsPdfModule as any)?.jsPDF ||
        jsPdfModule;
      const pdf = new jsPDF({
        orientation: width > height ? "l" : "p",
        unit: "mm",
        format: [widthMm, heightMm],
        hotfixes: ["px_scaling"],
      });

      const pageImages = await generatePageImages(container, width, height);

      pageImages.forEach((imgData, i) => {
        if (i > 0) pdf.addPage([widthMm, heightMm]);
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
      });

      return pdf;
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      if (cleanup) {
        cleanup();
      }
      restoreViewport();
      restore();
    }
  };

  return {
    getPrintHtml,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  };
};
