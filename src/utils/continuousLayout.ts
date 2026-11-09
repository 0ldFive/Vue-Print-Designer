import { ElementType, type PrintElement } from "@/types";

/**
 * 连续纸（标签流式）布局计算。
 *
 * 设计器与导出/打印共用同一套结果，保证「画布看到的」=「标签打出来的」：
 * - 表格按数据行撑开，不再被元素框裁剪；
 * - 表格下方元素整体下移，避免被撑开的表格压住；
 * - 页面高度取内容底边，不再固定为 canvasSize.height。
 *
 * 多页模板：逐页计算后合并（元素 id 全局唯一），页高取各页最大值——
 * 导出/打印的页面尺寸必须统一，否则 PDF 无法生成。
 */

const DEFAULT_LINE_EM = 1.2;
const CELL_VERTICAL_PADDING = 8;
/** 单元格左右内边距合计（与 TableElement 的 p-1 对齐：4px × 2）。 */
const CELL_HORIZONTAL_PADDING = 8;
const DEFAULT_FONT_SIZE = 14;
const MAX_CONTENT_HEIGHT = 5000;
/**
 * 非 CJK 字符相对字号的宽度比例（经验值）。
 * 取偏大值让行数宁多勿少：低估会裁切内容，高估只是多留空白。
 */
const LATIN_CHAR_WIDTH_RATIO = 0.62;
const CJK_CHAR_RE =
  /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/;

/** 表格宽度测量上下文：用于复刻渲染侧「列宽按可用宽度缩放」的口径。 */
export interface ContinuousMeasureContext {
  canvasWidth?: number;
  pageSpacingX?: number;
}

interface TableColumnLike {
  field: string;
  header?: string;
  width?: number;
  hidden?: boolean;
}

const readFontSize = (value: unknown, fallback: number): number => {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : fallback;
};

const defaultRowHeight = (fontSize: number): number =>
  fontSize * DEFAULT_LINE_EM + CELL_VERTICAL_PADDING;

/** 读取单元格文本：兼容原始值与 { value / text / result, style } 对象。 */
const cellText = (cell: unknown): string => {
  if (cell == null) return "";
  if (typeof cell !== "object") return String(cell);
  const record = cell as Record<string, unknown>;
  for (const key of ["result", "value", "text"]) {
    const candidate = record[key];
    if (candidate != null && candidate !== "") return String(candidate);
  }
  return "";
};

/** 单元格显式高度（行内单格改高时，渲染侧用该值替代行高）。 */
const cellExplicitHeight = (cell: unknown): number | undefined => {
  if (!cell || typeof cell !== "object") return undefined;
  const height = Number((cell as Record<string, any>).style?.height);
  return Number.isFinite(height) && height > 0 ? height : undefined;
};

const estimateTextWidth = (text: string, fontSize: number): number => {
  let width = 0;
  for (const char of text) {
    width += CJK_CHAR_RE.test(char)
      ? fontSize
      : fontSize * LATIN_CHAR_WIDTH_RATIO;
  }
  return width;
};

/**
 * 复刻 TableElement 的列宽口径：col.width 为建议宽度，总和超过可用宽度时整体缩放。
 * 可用宽度受画布右边界（canvasWidth - pageSpacingX - element.x）约束。
 */
const resolveColumnWidths = (
  element: PrintElement,
  columns: TableColumnLike[],
  context?: ContinuousMeasureContext,
): number[] => {
  const declaredWidth = Math.max(1, Number(element.width) || 1);
  const canvasWidth = Number(context?.canvasWidth) || 0;
  const pageSpacingX = Math.max(0, Number(context?.pageSpacingX) || 0);
  const rightBoundary =
    canvasWidth > 0 ? Math.max(1, canvasWidth - pageSpacingX) : 0;
  const printableWidth =
    rightBoundary > 0
      ? Math.max(1, rightBoundary - (Number(element.x) || 0))
      : declaredWidth;
  const availableWidth = Math.max(
    1,
    Math.min(declaredWidth, printableWidth),
  );

  const columnCount = Math.max(1, columns.length || 1);
  const rawWidths = columns.map((column) => {
    const width = Number(column.width);
    return Number.isFinite(width) && width > 0
      ? width
      : Math.max(20, Math.floor(availableWidth / columnCount));
  });
  const totalWidth = rawWidths.reduce((sum, width) => sum + width, 0);
  const scale = totalWidth > availableWidth ? availableWidth / totalWidth : 1;
  return rawWidths.map((width) => width * scale);
};

/** 文本按列宽折行后的行数（向上取整；取各列最大值）。 */
const estimateRowLines = (
  cells: string[],
  widths: number[],
  fontSize: number,
): number => {
  let maxLines = 1;
  widths.forEach((width, index) => {
    const text = cells[index];
    if (!text) return;
    const available = Math.max(1, width - CELL_HORIZONTAL_PADDING);
    const lines = Math.ceil(estimateTextWidth(text, fontSize) / available);
    if (lines > maxLines) maxLines = lines;
  });
  return maxLines;
};

/**
 * 折行后的行高：单行用基准行高；多行时渲染侧行高为 auto（height:auto +
 * minHeight:基准行高 + lineHeight:normal），实际高度取文本自然高度与基准行高的较大者。
 */
const rowHeightForLines = (
  baseHeight: number,
  lines: number,
  fontSize: number,
): number =>
  lines <= 1
    ? baseHeight
    : Math.max(baseHeight, lines * fontSize * DEFAULT_LINE_EM);

/**
 * 表格按数据行展开后的自然高度（与 TableElement 的渲染口径一致）。
 * 已覆盖：表头/表体/表尾逐行折行、单元格显式高度、列宽缩放、边框。
 */
export const measureTableContentHeight = (
  element: PrintElement,
  context?: ContinuousMeasureContext,
): number => {
  if (element.type !== ElementType.TABLE) return element.height;

  const rawColumns: TableColumnLike[] = Array.isArray(element.columns)
    ? element.columns
    : [];
  // 隐藏列不参与渲染布局，测量时同样剔除。
  const columns = rawColumns.filter((column) => Boolean(column) && !column?.hidden);
  const widths = resolveColumnWidths(element, columns, context);

  const bodyFontSize = readFontSize(element.style?.fontSize, DEFAULT_FONT_SIZE);
  const headerFontSize = readFontSize(
    element.style?.headerFontSize,
    bodyFontSize,
  );
  const footerFontSize = readFontSize(
    element.style?.footerFontSize,
    bodyFontSize,
  );

  const styleRowHeight = Number(element.style?.rowHeight);
  const bodyBase =
    Number.isFinite(styleRowHeight) && styleRowHeight > 0
      ? styleRowHeight
      : defaultRowHeight(bodyFontSize);
  const styleHeaderHeight = Number(element.style?.headerHeight);
  const headerBase =
    Number.isFinite(styleHeaderHeight) && styleHeaderHeight > 0
      ? styleHeaderHeight
      : defaultRowHeight(headerFontSize);
  const styleFooterHeight = Number(element.style?.footerHeight);
  const footerBase =
    Number.isFinite(styleFooterHeight) && styleFooterHeight > 0
      ? styleFooterHeight
      : defaultRowHeight(footerFontSize);

  const measureRows = (
    rows: any[],
    baseHeight: number,
    fontSize: number,
  ): number =>
    rows.reduce((sum, row) => {
      const explicit = columns
        .map((column) => cellExplicitHeight(row?.[column.field]))
        .find((height) => height !== undefined);
      if (explicit !== undefined) return sum + explicit;
      const lines = estimateRowLines(
        columns.map((column) => cellText(row?.[column.field])),
        widths,
        fontSize,
      );
      return sum + rowHeightForLines(baseHeight, lines, fontSize);
    }, 0);

  const showHeader = element.showHeader !== false;
  const headerHeight = showHeader
    ? rowHeightForLines(
        headerBase,
        estimateRowLines(
          columns.map((column) => String(column.header ?? "")),
          widths,
          headerFontSize,
        ),
        headerFontSize,
      )
    : 0;

  const bodyRows = Array.isArray(element.data) ? element.data : [];
  const footerRows =
    element.showFooter !== false && Array.isArray(element.footerData)
      ? element.footerData
      : [];

  const bodyHeight = measureRows(bodyRows, bodyBase, bodyFontSize);
  const footerHeight = footerRows.length
    ? measureRows(footerRows, footerBase, footerFontSize)
    : 0;

  const borderWidth = Number(element.style?.borderWidth);
  const border = (Number.isFinite(borderWidth) ? borderWidth : 1) * 2;

  return Math.max(
    0,
    headerHeight + bodyHeight + footerHeight + border,
  );
};

export interface ContinuousLayout {
  /** 元素 id → 需要向下位移的像素（跨页合并，元素 id 全局唯一）。 */
  shiftById: Map<string, number>;
  /** 表格 id → 按内容撑开后的渲染高度。 */
  heightById: Map<string, number>;
  /** 页面有效高度（所有页内容底边的最大值，含最小画布高度）。 */
  contentHeight: number;
}

const emptyLayout = (canvasHeight: number): ContinuousLayout => ({
  shiftById: new Map(),
  heightById: new Map(),
  contentHeight: canvasHeight,
});

interface TableBox {
  id: string;
  x: number;
  y: number;
  width: number;
  overflow: number;
  contentHeight: number;
}

/** 元素与表格在水平方向是否重叠：并排元素不应被表格撑高影响。 */
const overlapsHorizontally = (element: PrintElement, table: TableBox): boolean => {
  const width = Number(element.width) || 0;
  // 尺寸缺失时退回纯纵向判定，保持旧行为。
  if (width <= 0 || table.width <= 0) return true;
  const x = Number(element.x) || 0;
  return x < table.x + table.width && x + width > table.x;
};

const computeSinglePageLayout = (
  elements: PrintElement[],
  canvasHeight: number,
  context?: ContinuousMeasureContext,
): ContinuousLayout => {
  const tables: TableBox[] = elements
    .filter(
      (element) =>
        element.type === ElementType.TABLE && element.printable !== false,
    )
    .map((element) => {
      const contentHeight = measureTableContentHeight(element, context);
      return {
        id: element.id,
        x: Number(element.x) || 0,
        y: Number(element.y) || 0,
        width: Number(element.width) || 0,
        overflow: contentHeight - (Number(element.height) || 0),
        contentHeight,
      };
    })
    .filter((table) => table.overflow > 0.5);

  if (tables.length === 0) return emptyLayout(canvasHeight);

  const layout = emptyLayout(canvasHeight);
  let maxBottom = canvasHeight;

  // 设计态底部留白：原始内容底边到纸张底边的距离。
  // 连续纸撑高后必须原样保留，否则内容会贴着纸边，与设计态不一致。
  const originalBottom = elements.reduce(
    (bottom, element) =>
      Math.max(bottom, (Number(element.y) || 0) + element.height),
    0,
  );
  const bottomMargin = Math.max(0, canvasHeight - originalBottom);

  elements.forEach((element) => {
    const table = tables.find((item) => item.id === element.id);
    const elementY = Number(element.y) || 0;
    const shift = tables
      .filter(
        (item) =>
          item.id !== element.id &&
          elementY >= item.y &&
          overlapsHorizontally(element, item),
      )
      .reduce((sum, item) => sum + item.overflow, 0);
    const height = table ? table.contentHeight : element.height;

    if (table) layout.heightById.set(element.id, table.contentHeight);
    if (shift > 0) layout.shiftById.set(element.id, shift);

    const bottom = elementY + shift + height;
    if (bottom > maxBottom) maxBottom = bottom;
  });

  // 内容被撑出纸张时，把设计态的底部留白补回去。
  if (maxBottom > canvasHeight) {
    maxBottom += bottomMargin;
  }

  layout.contentHeight = Math.min(MAX_CONTENT_HEIGHT, Math.ceil(maxBottom));
  return layout;
};

/**
 * 多页模板的连续纸布局：逐页计算后合并。
 * 页高取各页最大值——导出/打印的页面尺寸必须统一。
 */
export const computeContinuousLayout = (
  pages: Array<{ elements?: PrintElement[] }>,
  canvasHeight: number,
  context?: ContinuousMeasureContext,
): ContinuousLayout => {
  const merged = emptyLayout(canvasHeight);
  for (const page of pages) {
    const layout = computeSinglePageLayout(
      page.elements || [],
      canvasHeight,
      context,
    );
    layout.shiftById.forEach((value, id) => merged.shiftById.set(id, value));
    layout.heightById.forEach((value, id) =>
      merged.heightById.set(id, value),
    );
    if (layout.contentHeight > merged.contentHeight) {
      merged.contentHeight = layout.contentHeight;
    }
  }
  return merged;
};

/**
 * 渲染用的画布尺寸：连续纸时高度取内容底边，其余情况沿用模板尺寸。
 * 只做计算、不修改 store —— 设计态的画布高度必须保持模板值，
 * 否则一次预览/导出就会把设计器画布永久撑高。
 */
export const resolveRenderCanvasSize = (
  canvasSize: { width: number; height: number },
  pages: Array<{ elements?: PrintElement[] }>,
  continuous: boolean,
): { width: number; height: number } => {
  if (!continuous) return { ...canvasSize };
  const layout = computeContinuousLayout(pages, canvasSize.height, {
    canvasWidth: canvasSize.width,
  });
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
