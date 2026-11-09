import cloneDeep from "lodash/cloneDeep";

const sanitizeElement = (element: any) => {
  if (!element || typeof element !== "object") return null;
  if (typeof element.id !== "string" || !element.id) return null;
  if (typeof element.type !== "string" || !element.type) return null;
  return {
    ...element,
    style:
      element.style && typeof element.style === "object" ? element.style : {},
  };
};

/**
 * 模板设计数据字段清单——序列化的单一来源。
 *
 * 新增模板级字段时只登记此处：
 * - web-component `getTemplateData`（宿主导出）
 * - 模版 JSON 对话框（useJsonBlobModal）
 * - 模板保存（templates.saveCurrentTemplate）
 * - 粘贴校验白名单（TemplateListPanel DESIGN_JSON_KEYS）
 * 均由此派生，避免多处手抄清单造成字段静默丢失。
 * 恢复侧（loadTemplateData / applyTemplateJsonToDesigner / loadTemplate）
 * 需各自支持清单内字段。
 */
export const TEMPLATE_DATA_KEYS = [
  "pages",
  "canvasSize",
  "continuousPaper",
  "guides",
  "zoom",
  "showGrid",
  "allowDragOutsideCanvas",
  "headerHeight",
  "footerHeight",
  "showHeaderLine",
  "showFooterLine",
  "enableHeaderFooterLineRendering",
  "headerLineStyle",
  "footerLineStyle",
  "headerLineColor",
  "footerLineColor",
  "headerLineWidth",
  "footerLineWidth",
  "headerLineSpanMode",
  "footerLineSpanMode",
  "headerLineSpan",
  "footerLineSpan",
  "showMinimap",
  "showHistoryPanel",
  "canvasBackground",
  "canvasBackgroundImage",
  "pageSpacingX",
  "pageSpacingY",
  "unit",
  "watermark",
  "testData",
] as const;

/**
 * 按 TEMPLATE_DATA_KEYS 从 store 序列化模板设计数据。
 * 引用类型一律深拷贝，返回全新对象，调用方可自由展开或改写。
 * store 参数放宽为 Record：Pinia Store 交叉类型与映射类型结构兼容性检查过重。
 */
export const serializeTemplateData = (
  store: Record<string, any>,
): Record<string, any> => {
  const data: Record<string, any> = {};
  for (const key of TEMPLATE_DATA_KEYS) {
    data[key] = cloneDeep(store[key]);
  }
  return data;
};

export const sanitizePages = (pages: any) => {
  if (!Array.isArray(pages)) return [];
  return pages
    .filter((page) => page && typeof page === "object")
    .map((page, index) => ({
      ...page,
      id:
        typeof page.id === "string" && page.id ? page.id : `page-${index + 1}`,
      elements: Array.isArray(page.elements)
        ? page.elements.map(sanitizeElement).filter(Boolean)
        : [],
    }));
};

export const sanitizeTemplateData = (data: any) => {
  const base = data && typeof data === "object" ? data : {};
  return {
    ...base,
    pages: sanitizePages(base.pages),
  };
};

export const hasMeaningfulTemplateData = (data: any): boolean => {
  if (!data || typeof data !== "object") return false;
  // A template data is meaningful if it has pages with elements,
  // or it has a defined canvasSize which is a core property of a template.
  // Just having 'testData' or other minor keys doesn't mean we have the full template data.
  if (Array.isArray(data.pages) && data.pages.length > 0) return true;
  if (data.canvasSize && typeof data.canvasSize === "object") return true;
  return false;
};
