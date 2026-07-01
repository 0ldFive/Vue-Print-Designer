import cloneDeep from "lodash/cloneDeep";
import { ElementType, type Page, type PrintElement } from "@/types";
import {
  classifyLabelElements,
  findMultiLabelElement,
  getMultiLabelPerPage,
  multiLabelSettingsFromElement,
} from "@/utils/multiLabel";

type TestData = Record<string, any>;

export const normalizeVariableKey = (token: string): string => {
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) return trimmed.slice(1).trim();
  if (trimmed.startsWith("{#") && trimmed.endsWith("}")) {
    return trimmed.slice(2, -1).trim();
  }
  return trimmed;
};

export const elementSupportsVariables = (element: PrintElement): boolean => {
  return [
    ElementType.TEXT,
    ElementType.BARCODE,
    ElementType.QRCODE,
    ElementType.TABLE,
  ].includes(element.type);
};

const buildTableSample = (element: PrintElement): any[] => {
  if (Array.isArray(element.data) && element.data.length > 0) {
    return cloneDeep(element.data);
  }

  const columns = element.columns || [];
  if (columns.length === 0) return [];

  const row: Record<string, any> = {};
  columns.forEach((col) => {
    row[col.field] = "";
  });

  return [row];
};

export const buildTestDataFromElement = (
  element: PrintElement,
  existing: TestData = {},
): TestData => {
  const result: TestData = { ...existing };
  if (!elementSupportsVariables(element)) return result;

  const getTextVariableSample = (rawVar: string) => {
    const key = normalizeVariableKey(rawVar);
    if (!key) return element.content ?? "";

    const token = rawVar.trim().startsWith("@") ? rawVar.trim() : `@${key}`;
    const content = element.content ?? "";
    return content.includes(token) ? token : content;
  };

  const extractVariable = (
    rawVar: string,
    type: "text" | "tableData" | "tableColumns" | "tableFooterData",
  ) => {
    const key = normalizeVariableKey(rawVar);
    if (!key) return;
    if (Object.prototype.hasOwnProperty.call(result, key)) return;

    if (type === "tableData") {
      result[key] = buildTableSample(element);
    } else if (type === "tableColumns") {
      result[key] =
        Array.isArray(element.columns) && element.columns.length > 0
          ? cloneDeep(element.columns)
          : [];
    } else if (type === "tableFooterData") {
      result[key] =
        Array.isArray(element.footerData) && element.footerData.length > 0
          ? cloneDeep(element.footerData)
          : [];
    } else {
      result[key] = getTextVariableSample(rawVar);
    }
  };

  extractVariable(
    element.variable || "",
    element.type === ElementType.TABLE ? "tableData" : "text",
  );

  if (element.type === ElementType.TABLE) {
    if (element.columnsVariable) {
      extractVariable(element.columnsVariable, "tableColumns");
    }
    if (element.footerDataVariable) {
      extractVariable(element.footerDataVariable, "tableFooterData");
    }
  }

  return result;
};

/**
 * Build the sample test data for a page that contains a multi-label container.
 * The label (label #1) is a per-row template, so its inner variables are grouped
 * into one sample row and an array of such rows is bound to the multi-label data
 * variable (e.g. "@labels"). Elements outside the label region keep their normal
 * flat keys.
 */
const buildMultiLabelTestData = (
  multiLabelElement: PrintElement,
  elements: PrintElement[],
  existing: TestData,
): TestData => {
  const ml = multiLabelSettingsFromElement(multiLabelElement);
  const { labelElements, decorElements } = classifyLabelElements(elements, ml);

  // Page decorations (outside the label region) produce normal flat sample data.
  let decorData: TestData = {};
  decorElements.forEach((element) => {
    decorData = buildTestDataFromElement(element, decorData);
  });

  // Label-template variables are collected into a single sample row.
  let row: TestData = {};
  labelElements.forEach((element) => {
    row = buildTestDataFromElement(element, row);
  });

  const key = normalizeVariableKey(multiLabelElement.dataVariable || "");
  const result: TestData = { ...existing };

  // Drop stale flat keys that now belong inside the label data array, unless a
  // page decoration legitimately produces the same key.
  Object.keys(row).forEach((k) => {
    if (k !== key && !Object.prototype.hasOwnProperty.call(decorData, k)) {
      delete result[k];
    }
  });

  // Merge decoration sample data without overwriting user-provided values.
  Object.keys(decorData).forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(result, k)) {
      result[k] = decorData[k];
    }
  });

  // Bind an array of label rows to the data variable (one row per label cell).
  if (key && !Object.prototype.hasOwnProperty.call(result, key)) {
    if (Object.keys(row).length > 0) {
      const count = Math.max(1, getMultiLabelPerPage(ml));
      result[key] = Array.from({ length: count }, () => cloneDeep(row));
    } else {
      result[key] = [];
    }
  }

  return result;
};

export const buildTestDataFromPages = (
  pages: Page[] = [],
  existing: TestData = {},
): TestData => {
  let result: TestData = { ...existing };
  pages.forEach((page) => {
    const elements = page.elements || [];
    const multiLabelElement = findMultiLabelElement(elements);
    if (multiLabelElement) {
      result = buildMultiLabelTestData(multiLabelElement, elements, result);
      return;
    }
    elements.forEach((element) => {
      result = buildTestDataFromElement(element, result);
    });
  });
  return result;
};
