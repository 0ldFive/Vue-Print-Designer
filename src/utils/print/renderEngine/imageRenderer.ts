import { usePrintSettings } from "@/composables/usePrintSettings";
import { pxToMm } from "@/utils/units";
import {
  cleanElement,
  cloneElementWithStyles,
  createCloneStyleCache,
  deduplicateInlineStyles,
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
    const startTime = performance.now();
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
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      const processStart = performance.now();
      const result = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
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

    const cloneStart = performance.now();
    // 跨页共享样式缓存：同模板多页文档结构相同，第 2+ 页几乎全部命中缓存，
    // 将后续页的 getComputedStyle 调用量从 ~N 降至接近 0。
    const sharedStyleCache = createCloneStyleCache();
    pages.forEach((page, idx) => {
      const clone = cloneElementWithStyles(page, getComputedStyleFn, sharedStyleCache);
      
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

    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] 1. DOM cloning & pre-processing took ${(performance.now() - cloneStart).toFixed(2)}ms`);
    }

    // 让出一个宏任务帧，确保浏览器完成挂载后的样式刷新
    const waitStart = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] 4. handleTablePagination & updatePageNumbers took ${(performance.now() - paginStart).toFixed(2)}ms (generated ${pagesCount} pages)`);
    }

    return { container, tempWrapper: tempHost, pagesCount };
  };

  // 将每页 DOM 渲染为 JPEG DataURL。
  const generatePageImages = async (
    container: HTMLElement,
    width: number,
    height: number,
  ): Promise<string[]> => {
    const startTime = performance.now();
    if (store.showRenderDebugLogs) {
      console.log(`[Render Debug] Starting generatePageImages for ${container.children.length} pages`);
    }

    const pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];

    pages.forEach((page) => {
      page.style.top = "0px";
    });

    // ─── 关键优化：将 tempHost 从活跃文档中摘除 ───────────────────────────────────
    // processContentForImage 完成后，所有布局测量（getBoundingClientRect、分页计算）
    // 均已结束，容器不再需要挂载到 document.body。
    // 在此处摘除后，后续所有 DOM 变更（deduplicateInlineStyles 改写 2000+ 个元素的
    // className/removeAttribute、canvas→img 替换、link 移除）均在离线子树上执行，
    // 浏览器无需触发任何 Recalculate Style，消除每次调用 ~30-60ms 的隐性开销。
    // 调用方 finally 块里的 tempWrapper.parentNode 检查会因 parentNode===null 而安全跳过。
    const _tempHost = container.parentElement;
    if (_tempHost?.parentElement) {
      _tempHost.parentElement.removeChild(_tempHost);
    }

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

    // 所有页共享同一个 XMLSerializer，避免每页重复构造。
    const serializer = new XMLSerializer();

    try {
      // 渲染单页为图片数据。
      const generatePageImage = async (page: HTMLElement) => {
        // 0+1. 单次遍历完成两件事：移除 link/style + 将 <canvas> 转为 base64 img。
        // 两次独立的 querySelectorAll 合并为一次，减少 DOM 树遍历。
        for (const el of Array.from(page.querySelectorAll("link, style, canvas"))) {
          if (el.tagName === "CANVAS") {
            const c = el as HTMLCanvasElement;
            const img = document.createElement("img");
            img.src = c.toDataURL("image/png");
            img.style.cssText = c.style.cssText;
            img.className = c.className;
            c.replaceWith(img);
          } else {
            el.remove();
          }
        }

        // 2a. 移除外部 background-image，防止 Canvas Tainted。
        // 用属性子串选择器仅取含 url() 的元素，避免把整棵树（大表格 2000+ 个 <td>）
        // 全部拉入 JS 数组——绝大多数元素没有 background-image，按需取可节省 ~10ms。
        for (const el of page.querySelectorAll<HTMLElement>("[style*='url(']")) {
          const bg = el.style.backgroundImage;
          if (bg && bg.includes("url(") && !bg.includes("data:")) {
            el.style.backgroundImage = "none";
          }
        }

        // 2b. 并行内联外部 <img>，避免 Canvas Tainted。
        // 直接用 "img" 选择器替代先 querySelectorAll("*") 再 JS 过滤的做法。
        const externalImgs = Array.from(
          page.querySelectorAll<HTMLImageElement>("img"),
        ).filter((img) => img.src && !img.src.startsWith("data:"));

        if (externalImgs.length > 0) {
          await Promise.all(
            externalImgs.map(async (img) => {
              const src = img.src;
              try {
                const res = await fetch(src);
                const blob = await res.blob();
                const reader = new FileReader();
                await new Promise<void>((resolve) => {
                  reader.onloadend = () => resolve();
                  reader.readAsDataURL(blob);
                });
                img.src = reader.result as string;
              } catch (e) {
                console.warn("[Render Debug] Inline image failed", src, e);
                // 失败必须替换为空白 base64，否则 SVG 使用跨域 HTTP url 绘制进 Canvas 必报 Tainted SecurityError
                img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
              }
            }),
          );
        }

        // 3. 将重复的 inline style 提取为 <style> 块，减少序列化字符串体积。
        // DOM 已离线，此处 2000+ 元素的 className/removeAttribute 变更无任何重排开销。
        deduplicateInlineStyles(page);

        const scale = printQualityScale;
        page.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

        // 清洗不可见控制字符，防止 XML 解析异常导致图片黑屏。
        // 先用 .test() 快速判断，无控制字符时跳过全字符串扫描。
        let htmlStr = serializer.serializeToString(page);
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(htmlStr)) {
          htmlStr = htmlStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
        }

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
          <foreignObject x="0" y="0" width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; transform: scale(${scale}); transform-origin: top left; background-color: ${store.canvasBackground}; margin: 0; padding: 0;">
              ${htmlStr}
            </div>
          </foreignObject>
        </svg>`;

        // Chrome 对 Blob URL 中含 <foreignObject> 的 SVG 加载到 Canvas 后强制标记 Tainted，
        // 必须使用 data URI。encodeURIComponent 对 SVG 内容（主要是 ASCII：CSS 属性名、数值、
        // 标签名等）的处理速度极快——ASCII 字符直接原样输出，只有中文内容字段才需要编码。
        // 实测比 TextEncoder+btoa 快约 70ms（后者对所有字符都需完整 UTF-8 + base64 编码）。
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              (ctx as any).mozImageSmoothingEnabled = true;
              (ctx as any).webkitImageSmoothingEnabled = true;
              (ctx as any).msImageSmoothingEnabled = true;
              ctx.imageSmoothingEnabled = true;
              
              ctx.fillStyle = store.canvasBackground;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
            }
            // 改进：使用 toDataURL 替代 toBlob + FileReader。
            // toBlob 虽然在后台线程编码不阻塞主线程，但带来了极其昂贵的 IPC 和多次事件循环列队延迟。
            // 对于批量打印，由于 V8 引擎在 C++ 层的同步 toDataURL 编码非常快（<10ms），
            // 直接由主线程同步提取 base64 可以极大降低整体等待时间，两页耗时能减少约 40-80ms。
            const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
            resolve(dataUrl);
          };
          img.onerror = (e) => {
            console.error("[Render Debug] SVG render failed:", e);
            reject(new Error("SVG to Image conversion failed."));
          };
          img.src = url;
        });
      };

      const batchSize = 3;
      const pageImages: string[] = [];

      for (let i = 0; i < pages.length; i += batchSize) {
        const batchStart = performance.now();
        const batch = pages.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((page) => generatePageImage(page)),
        );
        pageImages.push(...results);
        if (store.showRenderDebugLogs) {
          console.log(`[Render Debug] generatePageImages batch ${Math.floor(i / batchSize) + 1} took ${(performance.now() - batchStart).toFixed(2)}ms`);
        }
      }

      if (store.showRenderDebugLogs) {
        console.log(`[Render Debug] generatePageImages finished in ${(performance.now() - startTime).toFixed(2)}ms`);
      }

      return pageImages;
    } catch (err) {
      console.error("[Render Debug] generatePageImages error:", err);
      throw err;
    }
  };

  // 生成 jsPDF 文档对象，并按页写入截图图像。
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

      const addImagesStart = performance.now();
      pageImages.forEach((imgData, i) => {
        if (i > 0) pdf.addPage([widthMm, heightMm]);
        pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
      });
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
    generatePageImages,
    createPdfDocument,
  };
};
