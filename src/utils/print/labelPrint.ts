import cloneDeep from "lodash/cloneDeep";
import { ElementType, type Page, type PrintElement } from "@/types";
import { normalizeVariableKey } from "@/utils/variables";

/**
 * Label channel payload builder.
 *
 * The local client (print-dot-client) converts the designer template JSON into
 * native label commands (TSPL / ZPL / CPCL / ESC-POS). Its template parser only
 * understands `{{key}}` placeholders and `multiLabel.dataVariable`; it ignores
 * the designer's `variable: "@key"` binding. Pages therefore go through
 * `adaptPagesForLabel` before they leave the browser.
 */

export type LabelLanguage = "auto" | "tspl" | "zpl" | "cpcl" | "escpos";
export type LabelTextMode = "" | "device" | "bitmap";
export type LabelBackgroundMode = "auto" | "off";

export interface LabelPageSize {
  width: number;
  height: number;
}

export interface LabelPrintOptions {
  printer: string;
  language?: LabelLanguage;
  dpi?: number;
  speed?: number;
  density?: number;
  gap?: number;
  bline?: number;
  offset?: number;
  textMode?: LabelTextMode;
  continuous?: boolean;
  pageSize?: LabelPageSize;
  background?: LabelBackgroundMode;
  jobName?: string;
  intervalMs?: number;
  timeout?: number;
  fallbackToPdf?: boolean;
}

export interface LabelBatchItem {
  variables?: Record<string, any>;
  testData?: Record<string, any>;
  copies?: number;
}

export interface LabelTemplatePayload {
  pages: Page[];
  canvasSize: { width: number; height: number };
  canvasBackground?: string;
  canvasBackgroundImage?: any;
  watermark?: any;
}

export interface LabelJobPayload {
  type: "print_label";
  printer: string;
  key?: string;
  data: LabelTemplatePayload;
  labels: Array<{ testData: Record<string, any> }>;
  label: Record<string, any>;
  job: { name: string; copies: number; intervalMs?: number };
}

const toPlaceholder = (key: string) => `{{${key}}}`;

/**
 * Rewrite one element's `variable` binding into a `{{key}}` placeholder.
 * Mirrors `bakeLabelVariable` in `utils/multiLabel.ts`, except the value is
 * deferred to the client so one template can serve every data row.
 */
const adaptElement = (element: PrintElement): void => {
  if (element.type === ElementType.TABLE) {
    const boundKeys = [
      element.variable,
      element.columnsVariable,
      element.footerDataVariable,
    ].filter((value) => normalizeVariableKey(value || ""));
    if (boundKeys.length > 0) {
      throw new Error(
        `Label channel does not support table variable binding (${boundKeys.join(
          ", ",
        )}); use the PDF channel instead.`,
      );
    }
    return;
  }

  const rawVariable = element.variable || "";
  const key = normalizeVariableKey(rawVariable);
  if (!key) return;

  if (element.type === ElementType.TEXT) {
    const token = rawVariable.trim().startsWith("@")
      ? rawVariable.trim()
      : `@${key}`;
    const content = element.content ?? "";
    element.content = content.includes(token)
      ? content.split(token).join(toPlaceholder(key))
      : toPlaceholder(key);
  } else if (
    element.type === ElementType.BARCODE ||
    element.type === ElementType.QRCODE ||
    element.type === ElementType.IMAGE
  ) {
    element.content = toPlaceholder(key);
  }

  element.variable = "";
};

/** Deep-copy pages and convert every `@key` binding into a `{{key}}` placeholder. */
export const adaptPagesForLabel = (pages: Page[]): Page[] => {
  const cloned = cloneDeep(pages || []);
  cloned.forEach((page) => {
    (page.elements || []).forEach((element) => adaptElement(element));
  });
  return cloned;
};

const normalizeCopies = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(999, Math.max(1, Math.round(parsed)));
};

/**
 * Expand batch items into the client's `labels[]` shape. Variables and test data
 * are merged the same way the client merges fill sources (test data wins), and
 * per-item `copies` is unrolled here so the job-level copies stays at 1.
 */
export const expandLabelItems = (
  items: LabelBatchItem[],
): Array<{ testData: Record<string, any> }> => {
  const labels: Array<{ testData: Record<string, any> }> = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const merged = { ...(item?.variables || {}), ...(item?.testData || {}) };
    const copies = normalizeCopies(item?.copies);
    for (let index = 0; index < copies; index += 1) {
      labels.push({ testData: { ...merged } });
    }
  });
  return labels;
};

export const buildLabelTemplate = (params: {
  pages: Page[];
  canvasSize: { width: number; height: number };
  canvasBackground?: string;
  canvasBackgroundImage?: any;
  watermark?: any;
}): LabelTemplatePayload => {
  const template: LabelTemplatePayload = {
    pages: adaptPagesForLabel(params.pages),
    canvasSize: {
      width: params.canvasSize?.width || 0,
      height: params.canvasSize?.height || 0,
    },
  };

  // Empty background is omitted on purpose: the client treats a missing value as
  // "no background", while an empty string would paint a transparent layer.
  if (params.canvasBackground) {
    template.canvasBackground = params.canvasBackground;
  }
  if (params.canvasBackgroundImage) {
    template.canvasBackgroundImage = cloneDeep(params.canvasBackgroundImage);
  }
  if (params.watermark) {
    template.watermark = cloneDeep(params.watermark);
  }

  return template;
};

const buildLabelOptions = (
  options: Omit<LabelPrintOptions, "printer" | "timeout" | "fallbackToPdf">,
): Record<string, any> => {
  const label: Record<string, any> = {};
  if (options.language) label.language = options.language;
  if (typeof options.dpi === "number" && options.dpi > 0) label.dpi = options.dpi;
  if (typeof options.speed === "number" && options.speed > 0) {
    label.speed = options.speed;
  }
  if (typeof options.density === "number" && options.density > 0) {
    label.density = options.density;
  }
  if (typeof options.gap === "number" && options.gap > 0) label.gap = options.gap;
  if (typeof options.bline === "number" && options.bline > 0) {
    label.bline = options.bline;
  }
  if (typeof options.offset === "number" && options.offset > 0) {
    label.offset = options.offset;
  }
  if (options.textMode) label.textMode = options.textMode;
  if (options.continuous) label.continuous = true;
  if (options.background) label.background = options.background;
  if (options.pageSize) {
    label.pageSize = {
      width: options.pageSize.width || 0,
      height: options.pageSize.height || 0,
    };
  }
  return label;
};

export const buildLabelPayload = (params: {
  printer: string;
  template: LabelTemplatePayload;
  items: LabelBatchItem[];
  options?: Omit<LabelPrintOptions, "printer" | "timeout" | "fallbackToPdf">;
  key?: string;
}): LabelJobPayload => {
  const options = params.options || {};
  const labels = expandLabelItems(params.items);
  if (labels.length === 0) {
    throw new Error("Label batch requires at least one data item.");
  }

  const payload: LabelJobPayload = {
    type: "print_label",
    printer: params.printer,
    data: params.template,
    labels,
    label: buildLabelOptions(options),
    // Copies are unrolled into `labels`, so the job-level copy count stays 1.
    job: {
      name: options.jobName || "Label Batch",
      copies: 1,
    },
  };

  if (params.key) payload.key = params.key;
  if (typeof options.intervalMs === "number" && options.intervalMs > 0) {
    payload.job.intervalMs = options.intervalMs;
  }

  return payload;
};
