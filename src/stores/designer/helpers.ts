import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import cloneDeep from "lodash/cloneDeep";
import {
  type DesignerState,
  type PrintElement,
  type TableColumn,
  type Page,
  type Guide,
  ElementType,
  type CustomElementTemplate,
  type WatermarkSettings,
  type CustomElementEditSnapshot,
  type BrandingSettings,
  type DesignerFontOption,
  type ListContextMenuConfig,
  type ListContextMenuItem,
  type TemplateModalFormConfig,
  type TemplateModalField,
} from "@/types";
import {
  getCrudConfig,
  buildEndpoint,
  buildFetchOptions,
} from "../../utils/crudConfig";
import { toast } from "../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../utils/entityConstraints";
import { useTemplateStore } from "../templates";
import { normalizeVariableKey } from "../../utils/variables";
import i18n from "../../locales";

export const defaultWatermark: WatermarkSettings = {
  enabled: false,
  text: "",
  angle: -30,
  color: "#000000",
  opacity: 0.1,
  size: 24,
  density: 160,
};

export const defaultBranding: BrandingSettings = {
  title: "",
  logoUrl: "",
  showTitle: true,
  showLogo: true,
};

export const HISTORY_ACTION = {
  UNKNOWN: "editor.historyAction.unknown",
  PAGE_ADD: "editor.historyAction.pageAdd",
  PAGE_REMOVE: "editor.historyAction.pageRemove",
  PAGE_PASTE: "editor.historyAction.pagePaste",
  PAGE_REORDER: "editor.historyAction.pageReorder",
  ELEMENT_ADD: "editor.historyAction.elementAdd",
  ELEMENT_MOVE: "editor.historyAction.elementMove",
  ELEMENT_NUDGE: "editor.historyAction.elementNudge",
  ELEMENT_MOVE_TO_PAGE: "editor.historyAction.elementMoveToPage",
  ELEMENT_RESIZE: "editor.historyAction.elementResize",
  ELEMENT_ROTATE: "editor.historyAction.elementRotate",
  ELEMENT_STYLE: "editor.historyAction.elementStyle",
  ELEMENT_CONTENT: "editor.historyAction.elementContent",
  ELEMENT_UPDATE: "editor.historyAction.elementUpdate",
  ELEMENT_REMOVE: "editor.historyAction.elementRemove",
  ELEMENT_ALIGN: "editor.historyAction.elementAlign",
  ELEMENT_LAYER: "editor.historyAction.elementLayer",
  ELEMENT_LOCK: "editor.historyAction.elementLock",
  ELEMENT_PASTE: "editor.historyAction.elementPaste",
  CANVAS_RESIZE: "editor.historyAction.canvasResize",
  TABLE_MERGE_CELLS: "editor.historyAction.tableMergeCells",
  TABLE_SPLIT_CELLS: "editor.historyAction.tableSplitCells",
  TABLE_ALIGN_CELLS: "editor.historyAction.tableAlignCells",
  TABLE_PAGINATE: "editor.historyAction.tablePaginate",
} as const;

export const hasOwn = (obj: unknown, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

export const inferElementUpdateHistoryAction = (updates: Partial<PrintElement>) => {
  if (hasOwn(updates, "x") || hasOwn(updates, "y")) {
    return HISTORY_ACTION.ELEMENT_MOVE;
  }

  if (hasOwn(updates, "width") || hasOwn(updates, "height")) {
    return HISTORY_ACTION.ELEMENT_RESIZE;
  }

  if (hasOwn(updates, "locked")) {
    return HISTORY_ACTION.ELEMENT_LOCK;
  }

  if (updates.style && typeof updates.style === "object") {
    if (hasOwn(updates.style, "rotate")) {
      return HISTORY_ACTION.ELEMENT_ROTATE;
    }
    return HISTORY_ACTION.ELEMENT_STYLE;
  }

  if (
    hasOwn(updates, "content") ||
    hasOwn(updates, "variable") ||
    hasOwn(updates, "data") ||
    hasOwn(updates, "footerData") ||
    hasOwn(updates, "columns")
  ) {
    return HISTORY_ACTION.ELEMENT_CONTENT;
  }

  return HISTORY_ACTION.ELEMENT_UPDATE;
};

export const loadWatermark = (): WatermarkSettings => {
  const stored = localStorage.getItem("print-designer-watermark");
  if (!stored) return { ...defaultWatermark };
  try {
    return {
      ...defaultWatermark,
      ...(JSON.parse(stored) as WatermarkSettings),
    };
  } catch {
    return { ...defaultWatermark };
  }
};

export const loadDeveloperMode = () => {
  const stored = localStorage.getItem("print-designer-developer-mode");
  if (stored === null) return true;
  return stored !== "false";
};

export const loadPaginationDebugLogs = () => {
  const stored = localStorage.getItem("print-designer-pagination-debug-logs");
  if (stored === null) return false;
  return stored === "true";
};

export const loadRenderDebugLogs = () => {
  const stored = localStorage.getItem("print-designer-render-debug-logs");
  if (stored === null) return false;
  return stored === "true";
};

export const loadTextQuickToolbarEnabled = () => {
  const stored = localStorage.getItem("print-designer-show-text-quick-toolbar");
  if (stored === null) return true;
  return stored !== "false";
};

export const loadStatusBarVisible = () => {
  const stored = localStorage.getItem("print-designer-show-status-bar");
  if (stored === null) return true;
  return stored !== "false";
};

export type LayerMoveMode = "front" | "back" | "forward" | "backward";

export const getElementZIndex = (element: PrintElement) => element.style?.zIndex || 1;

export const getLayerSortedElements = (page: Page) => {
  return page.elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const za = getElementZIndex(a.element);
      const zb = getElementZIndex(b.element);
      if (za === zb) return a.index - b.index;
      return za - zb;
    });
};

export const buildLayerAssignments = (
  page: Page,
  idSet: Set<string>,
  mode: LayerMoveMode,
) => {
  const ordered = getLayerSortedElements(page);
  const selectedCount = ordered.filter((item) =>
    idSet.has(item.element.id),
  ).length;
  if (selectedCount === 0) return null;

  let nextOrdered = [...ordered];

  if (mode === "front") {
    const selected = ordered.filter((item) => idSet.has(item.element.id));
    const unselected = ordered.filter((item) => !idSet.has(item.element.id));
    nextOrdered = [...unselected, ...selected];
  } else if (mode === "back") {
    const selected = ordered.filter((item) => idSet.has(item.element.id));
    const unselected = ordered.filter((item) => !idSet.has(item.element.id));
    nextOrdered = [...selected, ...unselected];
  } else if (mode === "forward") {
    for (let i = nextOrdered.length - 2; i >= 0; i -= 1) {
      const current = nextOrdered[i];
      const next = nextOrdered[i + 1];
      if (idSet.has(current.element.id) && !idSet.has(next.element.id)) {
        nextOrdered[i] = next;
        nextOrdered[i + 1] = current;
      }
    }
  } else {
    for (let i = 1; i < nextOrdered.length; i += 1) {
      const current = nextOrdered[i];
      const previous = nextOrdered[i - 1];
      if (idSet.has(current.element.id) && !idSet.has(previous.element.id)) {
        nextOrdered[i] = previous;
        nextOrdered[i - 1] = current;
      }
    }
  }

  const assignments = new Map<string, number>();
  nextOrdered.forEach((item, index) => {
    const targetZ = index + 1;
    if (getElementZIndex(item.element) !== targetZ) {
      assignments.set(item.element.id, targetZ);
    }
  });

  if (assignments.size === 0) return null;
  return assignments;
};

export const canLayerMoveInPage = (
  page: Page,
  idSet: Set<string>,
  mode: LayerMoveMode,
) => {
  const ordered = getLayerSortedElements(page);
  let hasSelected = false;

  if (mode === "front" || mode === "back") {
    let selectedMaxZ = -Infinity;
    let selectedMinZ = Infinity;
    let otherMaxZ = -Infinity;
    let otherMinZ = Infinity;

    for (const item of ordered) {
      const z = getElementZIndex(item.element);
      if (idSet.has(item.element.id)) {
        hasSelected = true;
        selectedMaxZ = Math.max(selectedMaxZ, z);
        selectedMinZ = Math.min(selectedMinZ, z);
      } else {
        otherMaxZ = Math.max(otherMaxZ, z);
        otherMinZ = Math.min(otherMinZ, z);
      }
    }

    if (!hasSelected) return false;
    if (otherMaxZ === -Infinity || otherMinZ === Infinity) return false;

    if (mode === "front") {
      return selectedMaxZ < otherMaxZ;
    }

    return selectedMinZ > otherMinZ;
  }

  const selectedIndices: number[] = [];
  ordered.forEach((item, index) => {
    if (idSet.has(item.element.id)) {
      selectedIndices.push(index);
    }
  });

  if (selectedIndices.length === 0) return false;

  if (mode === "forward") {
    for (let i = ordered.length - 2; i >= 0; i -= 1) {
      const current = ordered[i];
      const next = ordered[i + 1];
      if (idSet.has(current.element.id) && !idSet.has(next.element.id)) {
        return true;
      }
    }
    return false;
  }

  for (let i = 1; i < ordered.length; i += 1) {
    const current = ordered[i];
    const previous = ordered[i - 1];
    if (idSet.has(current.element.id) && !idSet.has(previous.element.id)) {
      return true;
    }
  }

  return false;
};

export const normalizeContextMenuConfig = (
  config: ListContextMenuConfig | null | undefined,
): ListContextMenuConfig | null => {
  if (!config || !Array.isArray(config.items)) return null;

  const items = config.items
    .filter((item): item is ListContextMenuItem =>
      Boolean(
        item &&
        typeof item.key === "string" &&
        item.key &&
        typeof item.label === "string",
      ),
    )
    .map((item) => ({ ...item }));

  if (items.length === 0) return null;

  return {
    mode: config.mode === "replace" ? "replace" : "append",
    items,
  };
};

export const normalizeTemplateModalFields = (
  fields: TemplateModalField[] | undefined,
): TemplateModalField[] | undefined => {
  if (!Array.isArray(fields)) return undefined;
  const normalized = fields
    .filter(
      (field) =>
        field &&
        typeof field.key === "string" &&
        field.key &&
        typeof field.type === "string",
    )
    .map((field) => ({
      ...field,
      options: Array.isArray(field.options)
        ? field.options.filter((opt) => opt && typeof opt.label === "string")
        : undefined,
    }));
  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeTemplateModalFormConfig = (
  config: TemplateModalFormConfig | null | undefined,
): TemplateModalFormConfig | null => {
  if (!config || typeof config !== "object") return null;
  const next: TemplateModalFormConfig = {};
  (["create", "edit", "copy"] as const).forEach((mode) => {
    const item = config[mode];
    if (!item || typeof item !== "object") return;
    const fields = normalizeTemplateModalFields(item.fields);
    const initialValues =
      item.initialValues && typeof item.initialValues === "object"
        ? { ...item.initialValues }
        : undefined;
    if (fields || initialValues) {
      next[mode] = {
        ...(fields ? { fields } : {}),
        ...(initialValues ? { initialValues } : {}),
      };
    }
  });
  return Object.keys(next).length > 0 ? next : null;
};

export const inferVariableFromContent = (content: string): string | null => {
  const tokenMatch = content.match(/@([A-Za-z0-9_.-]+)/);
  if (!tokenMatch) return null;
  const key = normalizeVariableKey(`@${tokenMatch[1]}`);
  if (!key) return null;
  return `@${key}`;
};

export const normalizeDesignerFontOptions = (
  options: DesignerFontOption[] | null | undefined,
): DesignerFontOption[] => {
  if (!Array.isArray(options)) return [];

  const seen = new Set<string>();
  const normalized: DesignerFontOption[] = [];

  options.forEach((option) => {
    if (!option || typeof option.value !== "string") return;
    const value = option.value.trim();
    const rawLabel =
      typeof option.label === "string" ? option.label.trim() : "";
    const label = rawLabel || value || i18n.global.t("editor.fonts.default");
    if (seen.has(value)) return;
    seen.add(value);
    normalized.push({ label, value });
  });

  return normalized;
};

export const getEffectiveTableColumns = (
  element: PrintElement,
  testData: Record<string, any> | null | undefined,
): TableColumn[] => {
  let effectiveColumns = element.columns || [];
  if (element.columnsVariable && testData) {
    const key = normalizeVariableKey(element.columnsVariable);
    if (key && Array.isArray(testData[key])) {
      effectiveColumns = testData[key];
    }
  }

  return effectiveColumns;
};

export const getNumericCellStyleHeight = (cellValue: any) => {
  const height = cellValue?.style?.height;
  if (typeof height === "number" && Number.isFinite(height) && height > 0) {
    return height;
  }

  if (typeof height === "string") {
    const parsed = Number.parseFloat(height);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
};

export const getTableRowExplicitHeight = (row: any, columns: TableColumn[]) => {
  if (!row) return undefined;

  for (const col of columns) {
    const height = getNumericCellStyleHeight(row[col.field]);
    if (height !== undefined) return height;
  }

  return undefined;
};

export type HeaderFooterLineStyle = "solid" | "dashed" | "dotted";

export type HeaderFooterLineSpanMode = "value" | "percent";

export const isHeaderFooterLineStyle = (
  value: unknown,
): value is HeaderFooterLineStyle => {
  return value === "solid" || value === "dashed" || value === "dotted";
};

export const normalizeHeaderFooterLineStyle = (
  value: unknown,
): HeaderFooterLineStyle => {
  return isHeaderFooterLineStyle(value) ? value : "dashed";
};

export const normalizeHeaderFooterLineColor = (value: unknown) => {
  if (typeof value !== "string") return "#f87171";
  const color = value.trim();
  return color ? color : "#f87171";
};

export const normalizeHeaderFooterLineWidth = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.round(numeric));
};

export const normalizeHeaderFooterLineSpanMode = (
  value: unknown,
): HeaderFooterLineSpanMode => {
  return value === "percent" ? "percent" : "value";
};

export const normalizeHeaderFooterLineSpan = (
  value: unknown,
  mode: HeaderFooterLineSpanMode,
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return mode === "percent" ? 100 : 100;
  if (mode === "percent") {
    return Math.min(100, Math.max(1, Number(numeric.toFixed(2))));
  }
  return Math.max(1, Math.round(numeric));
};

export const normalizeHeaderFooterLineRenderingEnabled = (value: unknown) => {
  return Boolean(value);
};

export const escapeAttributeSelectorValue = (value: string) => {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
};

export const getCellBorderInsetRect = (
  cellEl: HTMLElement,
  hostRect: DOMRect,
  zoom: number,
) => {
  const rect = cellEl.getBoundingClientRect();
  const style = window.getComputedStyle(cellEl);
  const toViewportPx = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed * zoom : 0;
  };

  return {
    left: Math.max(
      rect.left + toViewportPx(style.borderLeftWidth),
      hostRect.left,
    ),
    top: Math.max(rect.top + toViewportPx(style.borderTopWidth), hostRect.top),
    right: Math.min(
      rect.right - toViewportPx(style.borderRightWidth),
      hostRect.right,
    ),
    bottom: Math.min(
      rect.bottom - toViewportPx(style.borderBottomWidth),
      hostRect.bottom,
    ),
  };
};

export const querySelectorAcrossDocumentAndShadowRoots = (selector: string) => {
  const directHit = document.querySelector(selector) as HTMLElement | null;
  if (directHit) return directHit;

  const visited = new Set<Document | ShadowRoot>([document]);
  const queue: Array<Document | ShadowRoot> = [document];

  while (queue.length > 0) {
    const root = queue.shift()!;
    const hosts = root.querySelectorAll("*");

    for (const host of hosts) {
      const shadow = (host as HTMLElement).shadowRoot;
      if (!shadow || visited.has(shadow)) continue;

      const hit = shadow.querySelector(selector) as HTMLElement | null;
      if (hit) return hit;

      visited.add(shadow);
      queue.push(shadow);
    }
  }

  return null;
};

export type EmbeddedCellBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EffectiveTableRows = {
  rows: any[];
  layoutRows: any[];
};

