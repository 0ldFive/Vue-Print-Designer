import cloneDeep from "lodash/cloneDeep";
import {
  normalizeHeaderFooterLineColor,
  normalizeHeaderFooterLineRenderingEnabled,
  normalizeHeaderFooterLineSpan,
  normalizeHeaderFooterLineSpanMode,
  normalizeHeaderFooterLineStyle,
  normalizeHeaderFooterLineWidth,
  persistContinuousPaper,
} from "./helpers";

/**
 * 模板设计数据的统一恢复入口。
 *
 * 此前同一套字段恢复逻辑在四处各写一遍（applyTemplateJsonToDesigner、
 * loadTemplateData、loadTemplate 的 remote/local 分支），字段与归一规则容易漂移。
 * 现在统一在此实现：各入口只保留自己的前置流程（resetCanvas、ext 恢复、
 * 只读守卫等），字段级的判断与归一全部复用本函数。
 *
 * 新增模板级字段时，与 `TEMPLATE_DATA_KEYS`（序列化单一来源）一并更新。
 */
export const applyTemplateDataFields = (
  store: Record<string, any>,
  data: Record<string, any> | null | undefined,
): void => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;

  if (Array.isArray(data.pages) && data.pages.length > 0) {
    store.pages = cloneDeep(data.pages);
    if (store.currentPageIndex >= data.pages.length) {
      store.currentPageIndex = Math.max(data.pages.length - 1, 0);
    }
  }

  if (data.canvasSize && typeof data.canvasSize === "object") {
    store.canvasSize = cloneDeep(data.canvasSize);
  }

  // 连续纸仅支持单页：多页模板强制关闭，并同步到本地持久化。
  if (typeof data.continuousPaper === "boolean") {
    const enabled = data.continuousPaper && store.pages.length <= 1;
    store.continuousPaper = enabled;
    persistContinuousPaper(enabled);
  }

  if (Array.isArray(data.guides)) store.guides = cloneDeep(data.guides);
  if (typeof data.zoom === "number") store.zoom = data.zoom;
  if (typeof data.showGrid === "boolean") store.showGrid = data.showGrid;
  if (typeof data.allowDragOutsideCanvas === "boolean") {
    store.allowDragOutsideCanvas = data.allowDragOutsideCanvas;
  }

  if (typeof data.headerHeight === "number") {
    store.headerHeight = data.headerHeight;
  }
  if (typeof data.footerHeight === "number") {
    store.footerHeight = data.footerHeight;
  }
  if (typeof data.showHeaderLine === "boolean") {
    store.showHeaderLine = data.showHeaderLine;
  }
  if (typeof data.showFooterLine === "boolean") {
    store.showFooterLine = data.showFooterLine;
  }
  if (data.enableHeaderFooterLineRendering !== undefined) {
    store.enableHeaderFooterLineRendering =
      normalizeHeaderFooterLineRenderingEnabled(
        data.enableHeaderFooterLineRendering,
      );
  }
  if (data.headerLineStyle !== undefined) {
    store.headerLineStyle = normalizeHeaderFooterLineStyle(
      data.headerLineStyle,
    );
  }
  if (data.footerLineStyle !== undefined) {
    store.footerLineStyle = normalizeHeaderFooterLineStyle(
      data.footerLineStyle,
    );
  }
  if (data.headerLineColor !== undefined) {
    store.headerLineColor = normalizeHeaderFooterLineColor(
      data.headerLineColor,
    );
  }
  if (data.footerLineColor !== undefined) {
    store.footerLineColor = normalizeHeaderFooterLineColor(
      data.footerLineColor,
    );
  }
  if (data.headerLineWidth !== undefined) {
    store.headerLineWidth = normalizeHeaderFooterLineWidth(
      data.headerLineWidth,
    );
  }
  if (data.footerLineWidth !== undefined) {
    store.footerLineWidth = normalizeHeaderFooterLineWidth(
      data.footerLineWidth,
    );
  }
  if (data.headerLineSpanMode !== undefined) {
    store.headerLineSpanMode = normalizeHeaderFooterLineSpanMode(
      data.headerLineSpanMode,
    );
  }
  if (data.footerLineSpanMode !== undefined) {
    store.footerLineSpanMode = normalizeHeaderFooterLineSpanMode(
      data.footerLineSpanMode,
    );
  }
  if (data.headerLineSpan !== undefined) {
    store.headerLineSpan = normalizeHeaderFooterLineSpan(
      data.headerLineSpan,
      store.headerLineSpanMode,
    );
  }
  if (data.footerLineSpan !== undefined) {
    store.footerLineSpan = normalizeHeaderFooterLineSpan(
      data.footerLineSpan,
      store.footerLineSpanMode,
    );
  }

  if (typeof data.showMinimap === "boolean") {
    store.showMinimap = data.showMinimap;
  }
  if (typeof data.showHistoryPanel === "boolean") {
    store.showHistoryPanel = data.showHistoryPanel;
  }
  if (typeof data.canvasBackground === "string") {
    store.canvasBackground = data.canvasBackground;
  }
  if (data.canvasBackgroundImage !== undefined) {
    store.canvasBackgroundImage = data.canvasBackgroundImage
      ? cloneDeep(data.canvasBackgroundImage)
      : null;
  }
  if (data.pageSpacingX !== undefined) store.pageSpacingX = data.pageSpacingX;
  if (data.pageSpacingY !== undefined) store.pageSpacingY = data.pageSpacingY;
  if (data.unit !== undefined) store.unit = data.unit;
  if (data.watermark !== undefined) {
    store.watermark = cloneDeep(data.watermark);
  }
  // 仍带 undefined 守卫：局部粘贴不应清空现有样例数据。
  if (data.testData !== undefined) {
    store.testData = cloneDeep(data.testData || {});
  }

  // 恢复数据后统一清理选中与历史，避免引用到已被替换的元素。
  store.selectedElementId = null;
  store.selectedElementIds = [];
  store.selectedGuideId = null;
  store.highlightedGuideId = null;
  store.highlightedEdge = null;
  store.highlightedAlignedElementIds = [];
  store.tableSelection = null;
  store.historyPast = [];
  store.historyFuture = [];
  store.historyPastActionKeys = [];
  store.historyFutureActionKeys = [];
};
