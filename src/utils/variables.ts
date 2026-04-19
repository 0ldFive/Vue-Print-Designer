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

  const extractVariable = (rawVar: string, type: 'text' | 'tableData' | 'tableColumns' | 'tableFooterData') => {
    const key = normalizeVariableKey(rawVar);
    if (!key) return;
    if (Object.prototype.hasOwnProperty.call(result, key)) return;

    if (type === 'tableData') {
      result[key] = buildTableSample(element);
    } else if (type === 'tableColumns') {
      result[key] = Array.isArray(element.columns) && element.columns.length > 0 ? cloneDeep(element.columns) : [];
    } else if (type === 'tableFooterData') {
      result[key] = Array.isArray(element.footerData) && element.footerData.length > 0 ? cloneDeep(element.footerData) : [];
    } else {
      result[key] = element.content ?? '';
    }
  };

  extractVariable(element.variable || '', element.type === ElementType.TABLE ? 'tableData' : 'text');

  if (element.type === ElementType.TABLE) {
    if (element.columnsVariable) {
      extractVariable(element.columnsVariable, 'tableColumns');
    }
    if (element.footerDataVariable) {
      extractVariable(element.footerDataVariable, 'tableFooterData');
    }
  }

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
