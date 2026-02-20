import cloneDeep from 'lodash/cloneDeep';
import { ElementType, type Page, type PrintElement } from '@/types';

type TestData = Record<string, any>;

export const normalizeVariableKey = (token: string): string => {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return trimmed.slice(1).trim();
  if (trimmed.startsWith('{#') && trimmed.endsWith('}')) {
    return trimmed.slice(2, -1).trim();
  }
  return trimmed;
};

export const elementSupportsVariables = (element: PrintElement): boolean => {
  return [
    ElementType.TEXT,
    ElementType.BARCODE,
    ElementType.QRCODE,
    ElementType.TABLE
  ].includes(element.type);
};

const buildTableSample = (element: PrintElement): any[] => {
  if (Array.isArray(element.data) && element.data.length > 0) {
    return cloneDeep(element.data);
  }

  const columns = element.columns || [];
  if (columns.length === 0) return [];

  const row: Record<string, any> = {};
  columns.forEach(col => {
    row[col.field] = '';
  });

  return [row];
};

export const buildTestDataFromElement = (
  element: PrintElement,
  existing: TestData = {}
): TestData => {
  const result: TestData = { ...existing };
  if (!elementSupportsVariables(element)) return result;

  const rawVariable = element.variable || '';
  const key = normalizeVariableKey(rawVariable);
  if (!key) return result;

  if (Object.prototype.hasOwnProperty.call(result, key)) return result;

  if (element.type === ElementType.TABLE) {
    result[key] = buildTableSample(element);
    return result;
  }

  result[key] = element.content ?? '';
  return result;
};

export const buildTestDataFromPages = (
  pages: Page[] = [],
  existing: TestData = {}
): TestData => {
  let result: TestData = { ...existing };
  pages.forEach(page => {
    page.elements.forEach(element => {
      result = buildTestDataFromElement(element, result);
    });
  });
  return result;
};
