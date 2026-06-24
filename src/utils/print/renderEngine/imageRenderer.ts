import { pxToMm } from "@/utils/units";
import {
  cleanupForExport,
  cleanElement,
  cloneElementWithStyles,
  createCloneStyleCache,
  deduplicateInlineStyles,
  isShadowDomContent,
  lockViewportScroll,
} from "../dom";
import { generatePageImages } from "./domToImage";
import { buildPdfFromJpegs } from "./pdfBuilder";
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

  const yieldToMainThread = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

  const toFixedCssPx = (value: number) =>
    `${Math.max(0, Number(value.toFixed(2)))}px`;

  const resolveNumericLineHeight = (cell: HTMLElement) => {
    const computed = window.getComputedStyle(cell);
    const lineHeight = Number.parseFloat(computed.lineHeight || "");
    if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;

    const fontSize = Number.parseFloat(computed.fontSize || "");
    return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.2 : 0;
  };

  // 判断 CSS transform 是否包含旋转（rotate()/matrix/matrix3d 的非对角分量）。
  const cssTransformHasRotation = (transform: string | null | undefined) => {
    if (!transform || transform === "none") return false;
    if (/\brotate/i.test(transform)) return true;
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) {
      const parts = matrix[1].split(",").map((v) => Number.parseFloat(v));
      if (parts.length >= 4) {
        return Math.abs(parts[1]) > 1e-4 || Math.abs(parts[2]) > 1e-4;
      }
    }
    const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
    if (matrix3d) {
      const parts = matrix3d[1].split(",").map((v) => Number.parseFloat(v));
      if (parts.length >= 6) {
        return Math.abs(parts[1]) > 1e-4 || Math.abs(parts[4]) > 1e-4;
      }
    }
    return false;
  };

  // 沿祖先链（直到所在 page）检测元素是否处于旋转上下文中。
  const isWithinRotatedContext = (el: HTMLElement, boundary: HTMLElement) => {
    const win = el.ownerDocument.defaultView || window;
    let node: HTMLElement | null = el;
    while (node) {
      if (cssTransformHasRotation(win.getComputedStyle(node).transform)) {
        return true;
      }
      if (node === boundary) break;
      node = node.parentElement;
    }
    return false;
  };

  // 独立 HTML 会在客户端 WebView 中重新排版表格；序列化前固化当前浏览器测得的几何，
  // 避免表格高度被目标渲染器撑大后覆盖后续绝对定位元素。
  const stabilizeStandaloneHtmlTableLayout = (pages: HTMLElement[]) => {
    pages.forEach((page) => {
      const tables = Array.from(page.querySelectorAll<HTMLTableElement>("table"));

      tables.forEach((table) => {
        // 旋转表格的 getBoundingClientRect 返回旋转后的外接矩形（90° 时宽高互换），
        // 用它固化会破坏 table-layout:fixed 的列宽行高。旋转时改用与 transform 无关的
        // offsetWidth/offsetHeight（布局尺寸）；未旋转保持原 getBoundingClientRect 行为。
        const rotated = isWithinRotatedContext(table, page);
        const tableRect = table.getBoundingClientRect();
        const tableWidth = rotated ? table.offsetWidth : tableRect.width;
        const tableHeight = rotated ? table.offsetHeight : tableRect.height;
        if (tableWidth <= 0 || tableHeight <= 0) return;

        table.style.setProperty("table-layout", "fixed");
        table.style.setProperty("box-sizing", "border-box");
        table.style.setProperty("width", toFixedCssPx(tableWidth));
        table.style.setProperty("min-width", toFixedCssPx(tableWidth));
        table.style.setProperty("height", toFixedCssPx(tableHeight));
        table.style.setProperty("min-height", toFixedCssPx(tableHeight));

        const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
        rows.forEach((row) => {
          const rowRect = row.getBoundingClientRect();
          const rowHeight = rotated ? row.offsetHeight : rowRect.height;
          if (rowHeight > 0) {
            row.style.setProperty("height", toFixedCssPx(rowHeight));
            row.style.setProperty("min-height", toFixedCssPx(rowHeight));
          }

          const cells = Array.from(row.children).filter(
            (child): child is HTMLTableCellElement =>
              child instanceof HTMLTableCellElement,
          );

          cells.forEach((cell) => {
            const cellRect = cell.getBoundingClientRect();
            const cellWidth = rotated ? cell.offsetWidth : cellRect.width;
            const cellHeight = rotated ? cell.offsetHeight : cellRect.height;
            if (cellWidth > 0) {
              cell.style.setProperty("width", toFixedCssPx(cellWidth));
              cell.style.setProperty("min-width", toFixedCssPx(cellWidth));
            }
            if (cellHeight > 0) {
              cell.style.setProperty("height", toFixedCssPx(cellHeight));
              cell.style.setProperty("min-height", toFixedCssPx(cellHeight));
            }

            const lineHeight = resolveNumericLineHeight(cell);
            if (lineHeight > 0) {
              const lineHeightPx = toFixedCssPx(lineHeight);
              cell.style.setProperty("line-height", lineHeightPx);
              Array.from(cell.children).forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                if (window.getComputedStyle(child).position === "absolute") return;
                child.style.setProperty("line-height", lineHeightPx);
              });
            }

            cell.style.setProperty("box-sizing", "border-box");
          });
        });
      });
    });
  };

  // 旋转表格在屏幕端（非打印）预览渲染器里，collapse 折叠的外边框会因半像素取整被丢弃，
  // 表现为旋转后“缺两条外边”。打印走干净 iframe、导出图片走高保真光栅化，均不受影响，
  // 故此修复仅作用于 preview 模式：在表格容器内补一个非折叠的 box-border 叠层，稳定绘制
  // 完整外边框（不依赖 collapse 折叠边）。
  const addRotatedTableEdgeOverlayForPreview = (pages: HTMLElement[]) => {
    pages.forEach((page) => {
      const tables = Array.from(
        page.querySelectorAll<HTMLTableElement>("table"),
      );
      tables.forEach((table) => {
        if (!isWithinRotatedContext(table, page)) return;
        const parent = table.parentElement;
        if (!parent) return;
        if (
          parent.querySelector(':scope > [data-print-table-edge-overlay="true"]')
        ) {
          return;
        }
        const cell = table.querySelector<HTMLElement>("td, th");
        if (!cell) return;
        const cellStyle = window.getComputedStyle(cell);
        const width = cellStyle.borderTopWidth;
        const style = cellStyle.borderTopStyle;
        const color = cellStyle.borderTopColor;
        if (style === "none" || !(Number.parseFloat(width) > 0)) return;
        if (window.getComputedStyle(parent).position === "static") {
          parent.style.setProperty("position", "relative");
        }
        const overlay = parent.ownerDocument.createElement("div");
        overlay.setAttribute("data-print-table-edge-overlay", "true");
        overlay.style.cssText =
          "position:absolute;left:0;top:0;width:100%;height:100%;" +
          `box-sizing:border-box;border:${width} ${style} ${color};` +
          "pointer-events:none;";
        parent.appendChild(overlay);
      });
    });
  };

  // 生成打印预览 HTML：兼容字符串与 DOM 节点两种输入。
  // mode="preview"（默认）保留去重后的 <style>+class 形式以减小体积；
  // mode="export" 输出完全内联、无 class/数据属性的独立 HTML 文档。
  const getPrintHtml = async (
    content?: HTMLElement[],
    options: {
      mode?: "preview" | "export";
      onStageProgress?: (progress: {
        current: number;
        total: number;
        message?: string;
      }) => void;
    } = {},
  ): Promise<string> => {
    const startTime = performance.now();
    const mode = options.mode ?? "preview";
    const reportStageProgress = (
      current: number,
      message?: string,
      total = 100,
    ) => {
      options.onStageProgress?.({ current, total, message });
    };

    reportStageProgress(42);
    if (store.showRenderDebugLogs) {
      console.log("[Render Debug] Starting getPrintHtml");
    }

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
      reportStageProgress(48);
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const processStart = performance.now();
      reportStageProgress(52);
      const result = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
        {
          onPagePrepared: (current, total) => {
            const ratio = total > 0 ? current / total : 1;
            const stageValue = 52 + Math.round(Math.min(1, ratio) * 26);
            reportStageProgress(Math.min(78, stageValue));
          },
          onPaginationStart: () => {
            reportStageProgress(82);
          },
          onPaginationDone: () => {
            reportStageProgress(90);
          },
        },
      );
      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] processContentForImage took ${(performance.now() - processStart).toFixed(2)}ms`); // 包括克隆DOM、清洗、等20ms以及处理分页的耗时
      }
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

      stabilizeStandaloneHtmlTableLayout(paginatedPages);

      // 仅预览模式补旋转表格外边框叠层（打印 mode="export" 不受影响，避免与折叠边重叠变粗）。
      if (mode === "preview") {
        addRotatedTableEdgeOverlayForPreview(paginatedPages);
      }

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

      if (mode === "export") {
        cleanupForExport(previewContainer);
      } else {
        deduplicateInlineStyles(previewContainer);
      }

      reportStageProgress(96);

      const totalTime = performance.now() - startTime;
      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] getPrintHtml finished in ${totalTime.toFixed(2)}ms`);
      }

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
    const svgs = Array.from(root.querySelectorAll("svg"));
    if (svgs.length === 0) return;

    await Promise.all(
      svgs.map((svg) => {
        return new Promise<void>((resolve) => {
          const parent = svg.parentElement as HTMLElement | null;
          if (!parent) return resolve();
          const style = getComputedStyle(parent);
          const w = parseFloat(style.width);
          const h = parseFloat(style.height);
          const canvas = document.createElement("canvas");
          canvas.width = Number.isFinite(w) ? Math.max(1, Math.round(w)) : 10;
          canvas.height = Number.isFinite(h) ? Math.max(1, Math.round(h)) : 10;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve();
          
          svg.setAttribute("width", `${w}px`);
          svg.setAttribute("height", `${h}px`);
          if (!svg.getAttribute("xmlns")) {
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          }

          const serializer = new XMLSerializer();
          const str = serializer.serializeToString(svg);
          const svgBlob = new window.Blob([str], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(svgBlob);
          const drawImg = new Image();

          drawImg.onload = () => {
            ctx.drawImage(drawImg, 0, 0);
            URL.revokeObjectURL(url);

            const img = document.createElement("img");
            img.src = canvas.toDataURL("image/png");
            img.style.width = `${w}px`;
            img.style.height = `${h}px`;
            img.style.display = "block";

            svg.before(img);
            if (svg.parentNode) {
              svg.parentNode.removeChild(svg);
            }
            resolve();
          };
          drawImg.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          drawImg.src = url;
        });
      })
    );
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
    options: {
      onPagePrepared?: (current: number, total: number) => void;
      onPaginationStart?: () => void;
      onPaginationDone?: () => void;
    } = {},
  ) => {
    const doc = document;
    const tempHost = doc.createElement("div");
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
    doc.body.appendChild(tempHost);

    const container = doc.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    tempHost.appendChild(container);

    let pages: HTMLElement[] = [];
    let preservePrePaginatedPages = false;
    let layoutHostCleanup: (() => void) | null = null;
    if (typeof content === "string") {
      // 字符串内容先注入到不受尺寸约束的临时容器，让浏览器完成布局，
      // 避免 flex 等布局在固定尺寸 absolute 容器中崩塌
      // 注意：layoutHost 必须有正常的视口宽度，否则外层 flex 容器
      // （width: 100%）会解析为 0，导致 .print-page 被压缩成不可见内容
      const layoutHost = doc.createElement("div");
      layoutHost.style.cssText =
        `position:fixed;left:-100000px;top:0;width:${width}px;z-index:-9999;opacity:0;pointer-events:none;`;
      doc.body.appendChild(layoutHost);
      layoutHost.innerHTML = content;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // 优先提取 .print-page 元素；若外层有包裹容器则深入其子元素
      const printPages = layoutHost.querySelectorAll(".print-page");
      if (printPages.length > 0) {
        pages = Array.from(printPages) as HTMLElement[];
        preservePrePaginatedPages = true;
      } else {
        pages = Array.from(layoutHost.children).filter(
          (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
        ) as HTMLElement[];
      }
      // 延迟清理：cloneElementWithStyles 需要 layoutHost 仍在 DOM 中
      // 才能正确读取 getComputedStyle
      layoutHostCleanup = () => layoutHost.remove();
    } else if (Array.isArray(content)) {
      pages = content;
    } else {
      if (content.classList.contains("design-workspace")) {
        pages = Array.from(content.children) as HTMLElement[];
      } else {
        pages = [content];
      }
    }

    const cloneStart = performance.now();
    // 跨页共享样式缓存：同模板多页文档结构相同，第 2+ 页几乎全部命中缓存，
    // 将后续页的 getComputedStyle 调用量从 ~N 降至接近 0。
    const sharedStyleCache = createCloneStyleCache();
    const totalPages = pages.length || 1;
    for (let idx = 0; idx < pages.length; idx++) {
      const page = pages[idx];
      const clone = cloneElementWithStyles(page, getComputedStyleFn, sharedStyleCache);

      // 修复：原生 cloneNode 无法克隆 Canvas 内容，导致图表/条形码等打印空白
      const originalCanvases = Array.from(page.querySelectorAll ? page.querySelectorAll("canvas") : []);
      if (originalCanvases.length > 0) {
        const clonedCanvases = Array.from(clone.querySelectorAll("canvas"));
        originalCanvases.forEach((orig, i) => {
          const cClone = clonedCanvases[i] as HTMLCanvasElement;
          cClone.width = (orig as HTMLCanvasElement).width;
          cClone.height = (orig as HTMLCanvasElement).height;
          const ctx = cClone.getContext("2d");
          if (ctx) ctx.drawImage(orig as HTMLCanvasElement, 0, 0);
        });
      }
      
      clone.style.position = "absolute";
      clone.style.left = "0";
      clone.style.top = `${idx * height}px`;
      clone.style.width = `${width}px`;
      clone.style.height = `${height}px`;
      clone.style.transform = "none";
      clone.style.backgroundColor = store.canvasBackground;

      // ── 关键修复：在 clone 挂入 live DOM 之前完成 cleanElement ────────────────────
      // cleanElement 是递归函数，会访问整棵树的每一个节点并调用多次 classList.remove。
      // 对 200 行 × 10 列表格（2000+ 元素），每次调用产生 ~16000 次样式失效事件。
      // 若在 container.appendChild(clone) 之后调用，这些失效会堆积到 live DOM 上，
      // 紧随其后的 getBoundingClientRect()（SVG 尺寸修复）会强制 flush 全部失效，
      // 造成一次代价极高的强制全局重排。
      // cleanElement 只读写 inline style 和 classList，不依赖 DOM 挂载，可安全离线执行。
      cleanElement(clone);

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

      // 阶段1：批量只读并标记
      const wrapperTasks = wrappers.map((w, wrapperIndex) => {
        const el = w as HTMLElement;

        if (inlineEmbeddedWrapperIntoTableCell(el, wrapperById)) {
          return null;
        }

        if (isWrapperFullyOutsideCanvas(el, width, height)) {
          el.remove();
          return null;
        }

        const top = parseFloat(el.style.top || "");
        const elHeight = parseFloat(el.style.height || "");
        const resolvedTop = Number.isFinite(top) ? top : 0;
        const resolvedHeight = Number.isFinite(elHeight)
          ? elHeight
          : el.getBoundingClientRect().height;

        return { el, resolvedTop, resolvedHeight, wrapperIndex };
      }).filter(Boolean);

      // 阶段2：集中写入DOM属性，避免 Layout Thrashing
      wrapperTasks.forEach((task) => {
        if (!task) return;
        const { el, resolvedTop, resolvedHeight, wrapperIndex } = task;

        el.setAttribute("data-print-wrapper", "true");
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

      // cleanElement 已在 appendChild 之前调用（见上方注释），此处删除重复调用。
      const svgs = Array.from(clone.querySelectorAll("svg"));
      // 阶段1：批量只读 SVG 尺寸，避免在写入 width/height 后引起 Layout Thrashing
      const svgTasks = svgs.map((svg) => ({
        svg,
        rect: svg.getBoundingClientRect(),
        w: svg.getAttribute("width"),
        h: svg.getAttribute("height")
      }));
      // 阶段2：批量写入修正样式
      svgTasks.forEach(({ svg, rect, w, h }) => {
        if (rect.width === 0 || rect.height === 0) {
          if (w) svg.style.width = w.includes("px") ? w : `${w}px`;
          if (h) svg.style.height = h.includes("px") ? h : `${h}px`;
        }
      });
      options.onPagePrepared?.(idx + 1, totalPages);

      // 大文档时主动让出主线程，避免外层进度 ticker 长时间无法触发。
      if (idx < pages.length - 1 || wrappers.length > 32) {
        await yieldToMainThread();
      }
    }

    // 字符串内容的 layoutHost 在克隆完成后方可移除
    layoutHostCleanup?.();

    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] 1. DOM cloning & pre-processing took ${(performance.now() - cloneStart).toFixed(2)}ms`);
    }

    // 让出一个宏任务帧，确保浏览器完成挂载后的样式刷新
    const waitStart = performance.now();
    await yieldToMainThread();
    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] 2. DOM wait took ${(performance.now() - waitStart).toFixed(2)}ms`);
    }

    if (convertSvg) {
      const svgStart = performance.now();
      await svgToCanvas(container);
      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] 3. convertSvg took ${(performance.now() - svgStart).toFixed(2)}ms`);
      }
    }

    const paginStart = performance.now();
    options.onPaginationStart?.();
    await yieldToMainThread();
    const pagesCount = preservePrePaginatedPages
      ? Array.from(container.children).filter(
          (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
        ).length
      : handleTablePagination(
          container,
          height,
          store.headerHeight,
          store.footerHeight,
          store.showHeaderLine,
          store.showFooterLine,
        );
    options.onPaginationDone?.();
    await yieldToMainThread();

    updatePageNumbers(container, pagesCount);
    container.style.height = `${height * pagesCount}px`;

    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] 4. handleTablePagination & updatePageNumbers took ${(performance.now() - paginStart).toFixed(2)}ms (generated ${pagesCount} pages)`);
    }

    return { container, tempWrapper: tempHost, pagesCount };
  };

  // 将每页 DOM 渲染为 JPEG DataURL（委托给 domToImage 模块）。
  const renderPageImages = async (
    container: HTMLElement,
    width: number,
    height: number,
    options?: { onPageRendered?: (current: number, total: number) => void },
  ): Promise<string[]> => {
    return generatePageImages(container, width, height, {
      canvasBackground: store.canvasBackground,
      showRenderDebugLogs: store.showRenderDebugLogs,
      onPageRendered: options?.onPageRendered,
    });
  };

  // 生成 PDF 文档对象，并按页写入截图图像。
  const createPdfDocument = async (content: RenderContent) => {
    const startTime = performance.now();
    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] Starting createPdfDocument`);
    }

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

      const processStart = performance.now();
      const { container, tempWrapper: wrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );
      tempWrapper = wrapper;
      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] PDF processContentForImage took ${(performance.now() - processStart).toFixed(2)}ms`); // 包括克隆DOM、清洗、等20ms以及处理分页的耗时
      }

      const pageImages = await renderPageImages(container, width, height);

      const addImagesStart = performance.now();

      const pdf = buildPdfFromJpegs(pageImages, widthMm, heightMm);

      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] addImage to PDF took ${(performance.now() - addImagesStart).toFixed(2)}ms`);
      }

      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] createPdfDocument finished in ${(performance.now() - startTime).toFixed(2)}ms`);
      }

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
    generatePageImages: renderPageImages,
    createPdfDocument,
  };
};
