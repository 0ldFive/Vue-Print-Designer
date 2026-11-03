import { ElementType, type PrintElement } from "@/types";

/**
 * 连续纸（标签流式）布局计算。
 *
 * 设计器与导出/打印共用同一套结果，保证「画布看到的」= 「标签打出来的」：
 * - 表格按数据行撑开，不再被元素框裁剪；
 * - 表格下方元素整体下移，避免被撑开的表格压住；
 * - 页面高度取内容底边，不再固定为 canvasSize.height。
 */

const DEFAULT_LINE_EM = 1.2;
const CELL_VERTICAL_PADDING = 8;
const MAX_CONTENT_HEIGHT = 5000;

const defaultRowHeight = (element: PrintElement): number => {
  const fontSize = Number(element.style?.fontSize) || 14;
  return fontSize * DEFAULT_LINE_EM + CELL_VERTICAL_PADDING;
};

/** 表格按数据行展开后的自然高度（与 TableElement 的渲染口径一致）。 */
export const measureTableContentHeight = (element: PrintElement): number => {
  if (element.type !== ElementType.TABLE) return element.height;

  const styleRowHeight = Number(element.style?.rowHeight);
  const rowHeight =
    Number.isFinite(styleRowHeight) && styleRowHeight > 0
      ? styleRowHeight
      : defaultRowHeight(element);

  const rows = Array.isArray(element.data) ? element.data.length : 0;
  const showHeader = element.showHeader !== false;
  const styleHeaderHeight = Number(element.style?.headerHeight);
  const headerHeight = showHeader
    ? Number.isFinite(styleHeaderHeight) && styleHeaderHeight > 0
      ? styleHeaderHeight
      : rowHeight
    : 0;

  const footerRows =
    element.showFooter !== false && Array.isArray(element.footerData)
      ? element.footerData.length
      : 0;
  const styleFooterHeight = Number(element.style?.footerHeight);
  const footerHeight =
    footerRows > 0
      ? (Number.isFinite(styleFooterHeight) && styleFooterHeight > 0
          ? styleFooterHeight
          : rowHeight) * footerRows
      : 0;

  const borderWidth = Number(element.style?.borderWidth);
  const border = (Number.isFinite(borderWidth) ? borderWidth : 1) * 2;

  return Math.max(0, headerHeight + rows * rowHeight + footerHeight + border);
};

export interface ContinuousLayout {
  /** 元素 id → 需要向下位移的像素。 */
  shiftById: Map<string, number>;
  /** 表格 id → 按内容撑开后的渲染高度。 */
  heightById: Map<string, number>;
  /** 页面有效高度（内容底边，含最小画布高度）。 */
  contentHeight: number;
}

const EMPTY_LAYOUT = (canvasHeight: number): ContinuousLayout => ({
  shiftById: new Map(),
  heightById: new Map(),
  contentHeight: canvasHeight,
});

export const computeContinuousLayout = (
  elements: PrintElement[],
  canvasHeight: number,
): ContinuousLayout => {
  const tables = elements
    .filter((el) => el.type === ElementType.TABLE && el.printable !== false)
    .map((el) => ({
      id: el.id,
      y: el.y,
      overflow: measureTableContentHeight(el) - el.height,
      contentHeight: measureTableContentHeight(el),
    }))
    .filter((table) => table.overflow > 0.5);

  if (tables.length === 0) return EMPTY_LAYOUT(canvasHeight);

  const layout = EMPTY_LAYOUT(canvasHeight);
  let maxBottom = canvasHeight;

  // 设计态底部留白：原始内容底边到纸张底边的距离。
  // 连续纸撑高后必须原样保留，否则内容会贴着纸边，与设计态不一致。
  const originalBottom = elements.reduce(
    (bottom, element) => Math.max(bottom, element.y + element.height),
    0,
  );
  const bottomMargin = Math.max(0, canvasHeight - originalBottom);

  elements.forEach((element) => {
    const table = tables.find((item) => item.id === element.id);
    const shift = tables
      .filter((item) => item.id !== element.id && element.y >= item.y)
      .reduce((sum, item) => sum + item.overflow, 0);
    const height = table ? table.contentHeight : element.height;

    if (table) layout.heightById.set(element.id, table.contentHeight);
    if (shift > 0) layout.shiftById.set(element.id, shift);

    const bottom = element.y + shift + height;
    if (bottom > maxBottom) maxBottom = bottom;
  });

  // 内容被撑出纸张时，把设计态的底部留白补回去。
  if (maxBottom > canvasHeight) {
    maxBottom += bottomMargin;
  }

  layout.contentHeight = Math.min(
    MAX_CONTENT_HEIGHT,
    Math.ceil(maxBottom),
  );
  return layout;
};

/**
 * 渲染用的画布尺寸：连续纸时高度取内容底边，其余情况沿用模板尺寸。
 * 只做计算、不修改 store —— 设计态的画布高度必须保持模板值，
 * 否则一次预览/导出就会把设计器画布永久撑高。
 */
export const resolveRenderCanvasSize = (
  canvasSize: { width: number; height: number },
  elements: PrintElement[],
  continuous: boolean,
): { width: number; height: number } => {
  if (!continuous) return { ...canvasSize };
  const layout = computeContinuousLayout(elements, canvasSize.height);
  return { width: canvasSize.width, height: layout.contentHeight };
};

/** 把连续纸布局烘焙进页面元素（导出/打印用，配合页面高度一起使用）。 */
export const applyContinuousLayout = (
  elements: PrintElement[],
  layout: ContinuousLayout,
): PrintElement[] =>
  elements.map((element) => {
    const shift = layout.shiftById.get(element.id) || 0;
    const height = layout.heightById.get(element.id);
    if (!shift && height === undefined) return element;
    return {
      ...element,
      y: element.y + shift,
      height: height ?? element.height,
    };
  });
