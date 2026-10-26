import {
  ElementType,
  type Page,
  type PrintElement,
  type Size,
  type TableColumn,
  type VariableTreeItem,
} from "@/types";
import { uuidv4 } from "@/utils/uuid";
import { normalizeVariableKey } from "@/utils/variables";
import type {
  AiNormalizeContext,
  AiNormalizeResult,
  AiTemplateData,
  AiWarning,
} from "../types";

const MAX_PAGES = 5;
const MAX_TABLE_ROWS = 200;
const MAX_FOOTER_ROWS = 10;
const MIN_ELEMENT_SIZE = 4;
const MIN_FONT_SIZE = 8;
const MAX_NAME_LENGTH = 60;
const MAX_VARIABLES = 80;
const MAX_VARIABLE_LABEL = 40;
const MIN_CANVAS_SIZE = 100;
const MAX_CANVAS_SIZE = 5000;
const ALLOWED_TYPES = new Set<string>(Object.values(ElementType) as string[]);
const VARIABLE_ID_PATTERN = /^[A-Za-z_\u4e00-\u9fa5][\w.\-\u4e00-\u9fa5]*$/;

const asNumber = (value: unknown, fallback: number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

/** Accepts the canvas size proposed by the model when it is sane, else keeps the designer size. */
const normalizeCanvasSize = (input: unknown, fallback: Size): Size => {
  if (!input || typeof input !== "object") return { ...fallback };

  const source = input as Record<string, any>;
  const width = Math.round(asNumber(source.width, fallback.width));
  const height = Math.round(asNumber(source.height, fallback.height));
  if (
    width < MIN_CANVAS_SIZE ||
    height < MIN_CANVAS_SIZE ||
    width > MAX_CANVAS_SIZE ||
    height > MAX_CANVAS_SIZE
  ) {
    return { ...fallback };
  }
  return { width, height };
};

export const extractJsonText = (raw: string): string => {
  const text = String(raw || "").trim();
  if (!text) return "";

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);

  return text;
};

const parsePayload = (raw: unknown): any => {
  if (typeof raw === "string") {
    return JSON.parse(extractJsonText(raw));
  }
  return raw;
};

const collectVariableKeys = (
  items: VariableTreeItem[],
  out: Set<string> = new Set(),
): Set<string> => {
  (items || []).forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (item.id) out.add(normalizeVariableKey(item.id));
    if (Array.isArray(item.children) && item.children.length > 0) {
      collectVariableKeys(item.children, out);
    }
  });
  return out;
};

/** Normalizes the variable declarations the model returns next to the pages. */
const normalizeVariableDeclarations = (input: unknown): VariableTreeItem[] => {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const result: VariableTreeItem[] = [];

  input.forEach((item) => {
    if (result.length >= MAX_VARIABLES) return;
    if (!item || typeof item !== "object") return;

    const source = item as Record<string, any>;
    const id = normalizeVariableKey(String(source.id ?? source.key ?? ""));
    if (!id || seen.has(id) || !VARIABLE_ID_PATTERN.test(id)) return;

    const label =
      String(source.label ?? source.name ?? "")
        .trim()
        .slice(0, MAX_VARIABLE_LABEL) || id;
    const node: VariableTreeItem = { id, label };
    if (source.isArray === true) node.isArray = true;

    seen.add(id);
    result.push(node);
  });

  return result;
};

const normalizeVariable = (
  raw: unknown,
  knownKeys: Set<string>,
  warnings: AiWarning[],
): string => {
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) return "";

  const key = normalizeVariableKey(token);
  if (key && knownKeys.has(key)) {
    return token.startsWith("@") ? token : `@${key}`;
  }

  warnings.push({ code: "invalidVariable", detail: token });
  return "";
};

const normalizeStyle = (input: unknown): PrintElement["style"] => {
  const source =
    input && typeof input === "object"
      ? ({ ...input } as Record<string, any>)
      : ({} as Record<string, any>);

  if ("fontSize" in source) {
    const fontSize = Number(source.fontSize);
    if (Number.isFinite(fontSize)) {
      source.fontSize = Math.min(200, Math.max(MIN_FONT_SIZE, fontSize));
    } else {
      delete source.fontSize;
    }
  }

  ["color", "backgroundColor", "borderColor"].forEach((key) => {
    if (key in source && typeof source[key] !== "string") {
      delete source[key];
    }
  });

  return source as PrintElement["style"];
};

const normalizeGeometry = (input: Record<string, any>, canvasSize: Size) => {
  const pageWidth = Math.max(MIN_ELEMENT_SIZE, canvasSize.width);
  const pageHeight = Math.max(MIN_ELEMENT_SIZE, canvasSize.height);

  const width = Math.min(
    pageWidth,
    Math.max(MIN_ELEMENT_SIZE, asNumber(input.width, 100)),
  );
  const height = Math.min(
    pageHeight,
    Math.max(MIN_ELEMENT_SIZE, asNumber(input.height, 40)),
  );

  const maxX = Math.max(0, pageWidth - width);
  const maxY = Math.max(0, pageHeight - height);

  return {
    x: Math.min(maxX, Math.max(0, asNumber(input.x, 0))),
    y: Math.min(maxY, Math.max(0, asNumber(input.y, 0))),
    width,
    height,
  };
};

const normalizeColumns = (input: unknown): TableColumn[] => {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const column: TableColumn = {
        field:
          typeof item.field === "string" && item.field.trim()
            ? item.field.trim()
            : `col${index + 1}`,
        header: typeof item.header === "string" ? item.header : "",
        width: Math.max(20, asNumber(item.width, 100)),
      };
      if (
        item.align === "left" ||
        item.align === "center" ||
        item.align === "right"
      ) {
        column.align = item.align;
      }
      return column;
    });
};

const normalizeTableRows = (
  input: unknown,
  warnings: AiWarning[],
): Record<string, any>[] => {
  if (!Array.isArray(input)) return [];
  const rows = input.filter((row) => row && typeof row === "object");
  if (rows.length > MAX_TABLE_ROWS) {
    warnings.push({ code: "truncatedRows", detail: String(rows.length) });
  }
  return rows.slice(0, MAX_TABLE_ROWS);
};

const normalizeElement = (
  input: unknown,
  canvasSize: Size,
  knownKeys: Set<string>,
  usedIds: Set<string>,
  warnings: AiWarning[],
): PrintElement | null => {
  if (!input || typeof input !== "object") return null;

  const source = input as Record<string, any>;
  const type = typeof source.type === "string" ? source.type : "";
  if (!ALLOWED_TYPES.has(type)) {
    warnings.push({ code: "unsupportedType", detail: type || "unknown" });
    return null;
  }

  let id =
    typeof source.id === "string" && source.id.trim()
      ? source.id.trim()
      : uuidv4();
  if (usedIds.has(id)) id = uuidv4();
  usedIds.add(id);

  const geometry = normalizeGeometry(source, canvasSize);
  const style = normalizeStyle(source.style);
  const variable = normalizeVariable(source.variable, knownKeys, warnings);

  const element: PrintElement = {
    id,
    type: type as ElementType,
    ...geometry,
    style,
  };

  if (variable) element.variable = variable;

  switch (type) {
    case ElementType.TEXT: {
      element.content =
        typeof source.content === "string" ? source.content : "";
      break;
    }
    case ElementType.IMAGE: {
      const content =
        typeof source.content === "string" ? source.content.trim() : "";
      if (content && !/^(https?:\/\/|data:)/i.test(content)) {
        warnings.push({ code: "invalidImage", detail: content });
      }
      element.content = content;
      break;
    }
    case ElementType.BARCODE:
    case ElementType.QRCODE: {
      element.content =
        typeof source.content === "string" && source.content
          ? source.content
          : "";
      break;
    }
    case ElementType.TABLE: {
      const data = normalizeTableRows(source.data, warnings);
      let columns = normalizeColumns(source.columns);

      if (columns.length === 0 && data.length > 0) {
        columns = Object.keys(data[0]).map((field) => ({
          field,
          header: field,
          width: 100,
        }));
      }

      element.columns = columns;
      element.data = data;
      element.showHeader = asBoolean(source.showHeader, true);
      element.showFooter = asBoolean(source.showFooter, true);
      element.tfootRepeat = asBoolean(source.tfootRepeat, true);
      element.autoPaginate = asBoolean(source.autoPaginate, true);
      element.designOmitRows = true;

      if (Array.isArray(source.footerData)) {
        element.footerData = source.footerData
          .filter((row) => row && typeof row === "object")
          .slice(0, MAX_FOOTER_ROWS);
      }
      break;
    }
    case ElementType.PAGE_NUMBER: {
      element.format =
        typeof source.format === "string" && source.format
          ? source.format
          : "1";
      break;
    }
    case ElementType.MULTI_LABEL: {
      element.rows = Math.min(20, Math.max(1, asNumber(source.rows, 5)));
      element.cols = Math.min(20, Math.max(1, asNumber(source.cols, 3)));
      element.gapX = Math.min(100, Math.max(0, asNumber(source.gapX, 12)));
      element.gapY = Math.min(100, Math.max(0, asNumber(source.gapY, 12)));
      element.direction = source.direction === "column" ? "column" : "row";
      element.dataVariable = normalizeVariable(
        source.dataVariable,
        knownKeys,
        warnings,
      );
      break;
    }
    default:
      break;
  }

  return element;
};

const normalizePages = (
  payload: any,
  canvasSize: Size,
  knownKeys: Set<string>,
  warnings: AiWarning[],
): Page[] => {
  let pageInputs: unknown[] = [];

  if (Array.isArray(payload?.pages)) {
    pageInputs = payload.pages;
  } else if (Array.isArray(payload?.elements)) {
    pageInputs = [{ elements: payload.elements }];
  }

  if (pageInputs.length > MAX_PAGES) {
    warnings.push({
      code: "truncatedPages",
      detail: String(pageInputs.length),
    });
    pageInputs = pageInputs.slice(0, MAX_PAGES);
  }

  const usedPageIds = new Set<string>();

  const pages = pageInputs
    .filter((page) => page && typeof page === "object")
    .map((page) => {
      const source = page as Record<string, any>;
      let id =
        typeof source.id === "string" && source.id.trim()
          ? source.id.trim()
          : uuidv4();
      if (usedPageIds.has(id)) id = uuidv4();
      usedPageIds.add(id);

      const usedElementIds = new Set<string>();
      const elements = Array.isArray(source.elements)
        ? source.elements
            .map((element: unknown) =>
              normalizeElement(
                element,
                canvasSize,
                knownKeys,
                usedElementIds,
                warnings,
              ),
            )
            .filter((element: PrintElement | null): element is PrintElement =>
              Boolean(element),
            )
        : [];

      return { id, elements };
    });

  // An explicit empty template ("新建一个空模板") is valid: keep one blank page.
  if (pages.length === 0 && Array.isArray(payload?.pages)) {
    pages.push({ id: uuidv4(), elements: [] });
  }

  return pages;
};

export const normalizeTemplate = (
  raw: unknown,
  ctx: AiNormalizeContext,
): AiNormalizeResult => {
  const warnings: AiWarning[] = [];
  const payload = parsePayload(raw);
  const declaredVariables = normalizeVariableDeclarations(payload?.variables);
  const knownKeys = collectVariableKeys(ctx.availableVariables);
  declaredVariables.forEach((item) => knownKeys.add(item.id));
  // The model owns the canvas size (document type, paper size, mm -> px). The
  // designer size is only a fallback when the field is missing or out of range.
  const canvasSize = normalizeCanvasSize(payload?.canvasSize, ctx.canvasSize);
  const pages = normalizePages(payload, canvasSize, knownKeys, warnings);

  const name =
    typeof payload?.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, MAX_NAME_LENGTH)
      : undefined;

  const template: AiTemplateData = { canvasSize, pages };
  if (name) template.name = name;
  if (declaredVariables.length > 0) template.variables = declaredVariables;

  return { template, warnings };
};
