// @ts-nocheck
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
} from "../../../utils/crudConfig";
import { toast } from "../../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../../utils/entityConstraints";
import { useTemplateStore } from "../../templates";
import { normalizeVariableKey } from "../../../utils/variables";
import i18n from "../../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from '../helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from '../helpers';

export const tableActions = {
  setTableSelection(
      elementId: string,
      cell: { rowIndex: number; colField: string; section?: "body" | "footer" },
      multi: boolean,
    ) {
      // If switching elements, clear previous
      if (this.tableSelection && this.tableSelection.elementId !== elementId) {
        this.tableSelection = { elementId, cells: [cell] };
        return;
      }

      if (!this.tableSelection) {
        this.tableSelection = { elementId, cells: [cell] };
        return;
      }

      if (multi) {
        // Toggle if exists
        const idx = this.tableSelection.cells.findIndex(
          (c) =>
            c.rowIndex === cell.rowIndex &&
            c.colField === cell.colField &&
            c.section === cell.section,
        );
        if (idx >= 0) {
          this.tableSelection.cells.splice(idx, 1);
          if (this.tableSelection.cells.length === 0) {
            this.tableSelection = null;
          }
        } else {
          // Ensure we don't mix sections
          if (
            this.tableSelection.cells.length > 0 &&
            this.tableSelection.cells[0].section !== cell.section
          ) {
            // If mixed, reset to new selection
            this.tableSelection = { elementId, cells: [cell] };
          } else {
            this.tableSelection.cells.push(cell);
          }
        }
      } else {
        this.tableSelection = { elementId, cells: [cell] };
      }
    },

  setTableSelectionCells(
      elementId: string,
      cells: {
        rowIndex: number;
        colField: string;
        section?: "body" | "footer";
      }[],
    ) {
      this.tableSelection = { elementId, cells };
    },

  clearTableSelection() {
      this.tableSelection = null;
    },

  mergeSelectedCells() {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length < 2) return;

      const { elementId, cells } = this.tableSelection;
      const section = cells[0].section || "body";

      // Find element
      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element) return;

      const targetDataKey = section === "footer" ? "footerData" : "data";

      // Determine effective columns
      let effectiveColumns = element.columns || [];
      if (element.columnsVariable && this.testData) {
        const key = normalizeVariableKey(element.columnsVariable);
        if (key && Array.isArray(this.testData[key])) {
          effectiveColumns = this.testData[key];
        }
      }

      if (effectiveColumns.length === 0) return;

      // Map columns to indices to find min/max col
      const colFields = effectiveColumns.map((c) => c.field);
      const colIndices = cells
        .map((c) => colFields.indexOf(c.colField))
        .filter((i) => i !== -1);

      if (colIndices.length !== cells.length) return; // Invalid columns

      const cellKey = (row: number, col: number) => `${row}:${col}`;
      const sourceData = element[targetDataKey] || [];

      // 选中的合并格只带锚点，先展开成它实际覆盖的格子集合，
      // 否则把已合并的块再次纳入 L 形选区时会被拆散。
      const selectedKeys = new Set<string>();
      let minRow = Number.POSITIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;
      let minColIdx = Number.POSITIVE_INFINITY;
      let maxColIdx = Number.NEGATIVE_INFINITY;

      cells.forEach((c) => {
        const rowStart = c.rowIndex;
        const colStart = colFields.indexOf(c.colField);
        if (colStart === -1) return;

        const cellValue = sourceData[rowStart]?.[c.colField];
        const spanRows =
          cellValue && typeof cellValue === "object"
            ? cellValue.rowSpan || 1
            : 1;
        const spanCols =
          cellValue && typeof cellValue === "object"
            ? cellValue.colSpan || 1
            : 1;
        const rowEnd = rowStart + spanRows - 1;
        const colEnd = Math.min(colStart + spanCols - 1, colFields.length - 1);

        for (let r = rowStart; r <= rowEnd; r++) {
          for (let c2 = colStart; c2 <= colEnd; c2++) {
            selectedKeys.add(cellKey(r, c2));
            minRow = Math.min(minRow, r);
            maxRow = Math.max(maxRow, r);
            minColIdx = Math.min(minColIdx, c2);
            maxColIdx = Math.max(maxColIdx, c2);
          }
        }
      });

      if (selectedKeys.size === 0) return;

      // 把选区拆成若干最大矩形块：优先取剩余格子中最长的水平连续段，再向下扩展。
      // 矩形选区只会得到一块；反 L 形会得到「下方 1×3」+「上方 2×2」两块。
      const usedKeys = new Set<string>();
      const blocks: {
        top: number;
        left: number;
        bottom: number;
        right: number;
      }[] = [];

      while (true) {
        let best: { row: number; col: number; width: number } | null = null;

        for (let r = minRow; r <= maxRow; r++) {
          let c = minColIdx;
          while (c <= maxColIdx) {
            if (
              !selectedKeys.has(cellKey(r, c)) ||
              usedKeys.has(cellKey(r, c))
            ) {
              c++;
              continue;
            }
            let end = c;
            while (
              end + 1 <= maxColIdx &&
              selectedKeys.has(cellKey(r, end + 1)) &&
              !usedKeys.has(cellKey(r, end + 1))
            ) {
              end++;
            }
            const width = end - c + 1;
            if (!best || width > best.width) best = { row: r, col: c, width };
            c = end + 1;
          }
        }

        if (!best) break;

        let bottom = best.row;
        while (bottom + 1 <= maxRow) {
          let rowComplete = true;
          for (let c = best.col; c < best.col + best.width; c++) {
            if (
              !selectedKeys.has(cellKey(bottom + 1, c)) ||
              usedKeys.has(cellKey(bottom + 1, c))
            ) {
              rowComplete = false;
              break;
            }
          }
          if (!rowComplete) break;
          bottom++;
        }

        for (let r = best.row; r <= bottom; r++) {
          for (let c = best.col; c < best.col + best.width; c++) {
            usedKeys.add(cellKey(r, c));
          }
        }

        blocks.push({
          top: best.row,
          left: best.col,
          bottom,
          right: best.col + best.width - 1,
        });
      }

      if (blocks.length === 0) return;

      // Snapshot for undo
      this.snapshot(HISTORY_ACTION.TABLE_MERGE_CELLS);

      // Update data
      const newData = cloneDeep(element[targetDataKey] || []);

      // Ensure rows exist up to maxRow
      for (let r = 0; r <= maxRow; r++) {
        if (!newData[r]) newData[r] = {};
      }

      const ensureCell = (rowIndex: number, field: string) => {
        const row = newData[rowIndex];
        if (typeof row[field] !== "object" || row[field] === null) {
          row[field] = { value: row[field] !== undefined ? row[field] : "" };
        }
        return row[field];
      };

      blocks.forEach((block) => {
        const rowSpan = block.bottom - block.top + 1;
        const colSpan = block.right - block.left + 1;
        for (let r = block.top; r <= block.bottom; r++) {
          for (let c = block.left; c <= block.right; c++) {
            const cellObject = ensureCell(r, colFields[c]);
            if (r === block.top && c === block.left) {
              cellObject.rowSpan = rowSpan;
              cellObject.colSpan = colSpan;
            } else {
              cellObject.rowSpan = 0;
              cellObject.colSpan = 0;
              cellObject.value = "";
            }
          }
        }
      });

      // 整个选区只保留左上角格子的内容，其余块左上角的内容清空。
      const anchorBlock =
        blocks.find(
          (block) =>
            block.top <= minRow &&
            minRow <= block.bottom &&
            block.left <= minColIdx &&
            minColIdx <= block.right,
        ) || blocks[0];
      blocks.forEach((block) => {
        if (block === anchorBlock) return;
        ensureCell(block.top, colFields[block.left]).value = "";
      });

      // 去掉相邻块之间的公共边框，让多块拼接成视觉上连续的整块。
      const clearBlockBorder = (
        rowIndex: number,
        field: string,
        side:
          | "borderTopWidth"
          | "borderBottomWidth"
          | "borderLeftWidth"
          | "borderRightWidth",
      ) => {
        const cellObject = ensureCell(rowIndex, field);
        if (
          !cellObject.style ||
          typeof cellObject.style !== "object" ||
          Array.isArray(cellObject.style)
        ) {
          cellObject.style = {};
        }
        cellObject.style[side] = 0;
      };

      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          const colOverlapStart = Math.max(a.left, b.left);
          const colOverlapEnd = Math.min(a.right, b.right);
          const rowOverlapStart = Math.max(a.top, b.top);
          const rowOverlapEnd = Math.min(a.bottom, b.bottom);

          if (a.bottom + 1 === b.top && colOverlapStart <= colOverlapEnd) {
            clearBlockBorder(a.top, colFields[a.left], "borderBottomWidth");
            clearBlockBorder(b.top, colFields[b.left], "borderTopWidth");
          } else if (b.bottom + 1 === a.top && colOverlapStart <= colOverlapEnd) {
            clearBlockBorder(b.top, colFields[b.left], "borderBottomWidth");
            clearBlockBorder(a.top, colFields[a.left], "borderTopWidth");
          }

          if (a.right + 1 === b.left && rowOverlapStart <= rowOverlapEnd) {
            clearBlockBorder(a.top, colFields[a.left], "borderRightWidth");
            clearBlockBorder(b.top, colFields[b.left], "borderLeftWidth");
          } else if (b.right + 1 === a.left && rowOverlapStart <= rowOverlapEnd) {
            clearBlockBorder(b.top, colFields[b.left], "borderRightWidth");
            clearBlockBorder(a.top, colFields[a.left], "borderLeftWidth");
          }
        }
      }

      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        [targetDataKey]: newData,
      };

      this.tableSelection = null;
    },

  splitSelectedCells() {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length !== 1)
        return;

      const { elementId, cells } = this.tableSelection;
      const cell = cells[0];
      const section = cell.section || "body";

      // Find element
      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element) return;

      const targetDataKey = section === "footer" ? "footerData" : "data";

      const row = element[targetDataKey]?.[cell.rowIndex];
      if (!row) return;

      const val = row[cell.colField];
      if (!val || typeof val !== "object" || (!val.rowSpan && !val.colSpan))
        return;

      // Check if actually merged
      const rowSpan = val.rowSpan || 1;
      const colSpan = val.colSpan || 1;

      if (rowSpan <= 1 && colSpan <= 1) return;

      // Determine effective columns
      let effectiveColumns = element.columns || [];
      if (element.columnsVariable && this.testData) {
        const key = normalizeVariableKey(element.columnsVariable);
        if (key && Array.isArray(this.testData[key])) {
          effectiveColumns = this.testData[key];
        }
      }

      if (effectiveColumns.length === 0) return;

      // Snapshot
      this.snapshot(HISTORY_ACTION.TABLE_SPLIT_CELLS);

      const newData = cloneDeep(element[targetDataKey] || []);
      const colFields = effectiveColumns.map((c) => c.field);
      const startColIdx = colFields.indexOf(cell.colField);

      if (startColIdx === -1) return;

      // Reset all cells in the range
      for (let r = cell.rowIndex; r < cell.rowIndex + rowSpan; r++) {
        for (let c = startColIdx; c < startColIdx + colSpan; c++) {
          const field = colFields[c];
          const rData = newData[r];
          if (rData && rData[field] && typeof rData[field] === "object") {
            rData[field].rowSpan = 1;
            rData[field].colSpan = 1;
          }
        }
      }

      // 清除合并时写入的 0 值边框覆盖，恢复公共边显示。
      const clearZeroBorderSide = (
        rowIndex: number,
        field: string,
        side:
          | "borderTopWidth"
          | "borderBottomWidth"
          | "borderLeftWidth"
          | "borderRightWidth",
      ) => {
        const cellValue = newData[rowIndex]?.[field];
        if (!cellValue || typeof cellValue !== "object") return;
        const style = cellValue.style;
        if (!style || typeof style !== "object" || Array.isArray(style)) return;
        const value = style[side];
        if (value !== 0 && value !== "0" && value !== "0px") return;
        delete style[side];
        if (Object.keys(style).length === 0) delete cellValue.style;
      };

      const clearZeroBorderOverride = (rowIndex: number, field: string) => {
        for (const side of [
          "borderTopWidth",
          "borderBottomWidth",
          "borderLeftWidth",
          "borderRightWidth",
        ] as const) {
          clearZeroBorderSide(rowIndex, field, side);
        }
      };

      const top = cell.rowIndex;
      const bottom = cell.rowIndex + rowSpan - 1;
      const left = startColIdx;
      const right = startColIdx + colSpan - 1;

      // 本块及外扩一圈
      for (let r = top - 1; r <= bottom + 1; r++) {
        for (let c = left - 1; c <= right + 1; c++) {
          if (r < 0 || c < 0 || c >= colFields.length || !newData[r]) continue;
          clearZeroBorderOverride(r, colFields[c]);
        }
      }

      // 相邻块可能跨越本块边界（如 L 形合并的上块跨两行），
      // 需要按列/行回溯到合并格锚点，再清除落在该边界上的那条边。
      const findRowAnchor = (rowIndex: number, colIndex: number) => {
        for (let r = rowIndex; r >= 0; r--) {
          const value = newData[r]?.[colFields[colIndex]];
          if (!value || typeof value !== "object") return r;
          if (value.rowSpan !== 0) return r;
        }
        return -1;
      };

      const findColAnchor = (rowIndex: number, colIndex: number) => {
        for (let c = colIndex; c >= 0; c--) {
          const value = newData[rowIndex]?.[colFields[c]];
          if (!value || typeof value !== "object") return c;
          if (value.colSpan !== 0) return c;
        }
        return -1;
      };

      for (let c = left; c <= right; c++) {
        const topAnchorRow = findRowAnchor(top - 1, c);
        if (topAnchorRow >= 0) {
          const value = newData[topAnchorRow]?.[colFields[c]];
          const span =
            value && typeof value === "object" ? value.rowSpan || 1 : 1;
          if (topAnchorRow + span - 1 === top - 1) {
            clearZeroBorderSide(
              topAnchorRow,
              colFields[c],
              "borderBottomWidth",
            );
          }
        }

        const bottomAnchorRow = findRowAnchor(bottom + 1, c);
        if (bottomAnchorRow === bottom + 1) {
          clearZeroBorderSide(
            bottomAnchorRow,
            colFields[c],
            "borderTopWidth",
          );
        }
      }

      for (let r = top; r <= bottom; r++) {
        const leftAnchorCol = findColAnchor(r, left - 1);
        if (leftAnchorCol >= 0) {
          const value = newData[r]?.[colFields[leftAnchorCol]];
          const span =
            value && typeof value === "object" ? value.colSpan || 1 : 1;
          if (leftAnchorCol + span - 1 === left - 1) {
            clearZeroBorderSide(
              r,
              colFields[leftAnchorCol],
              "borderRightWidth",
            );
          }
        }

        const rightAnchorCol = findColAnchor(r, right + 1);
        if (rightAnchorCol === right + 1) {
          clearZeroBorderSide(
            r,
            colFields[rightAnchorCol],
            "borderLeftWidth",
          );
        }
      }

      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        [targetDataKey]: newData,
      };

      this.tableSelection = null;
    },

  setSelectedCellsTextAlign(align: "left" | "center" | "right") {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length === 0)
        return;

      const { elementId, cells } = this.tableSelection;
      const section = cells[0].section || "body";

      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element) return;

      const targetDataKey = section === "footer" ? "footerData" : "data";

      this.snapshot(HISTORY_ACTION.TABLE_ALIGN_CELLS);

      const newData = cloneDeep(element[targetDataKey] || []);

      const allSameAlign = cells.every((c) => {
        const row = newData[c.rowIndex];
        if (!row) return false;
        const val = row[c.colField];
        if (
          val &&
          typeof val === "object" &&
          val.style &&
          val.style.textAlign === align
        )
          return true;
        return false;
      });

      const newAlign = allSameAlign ? undefined : align;

      cells.forEach((c) => {
        if (!newData[c.rowIndex]) newData[c.rowIndex] = {};

        const row = newData[c.rowIndex];
        let val = row[c.colField];

        if (typeof val !== "object" || val === null) {
          val = { value: val !== undefined ? val : "" };
        }

        if (!val.style) val.style = {};

        if (newAlign) {
          val.style.textAlign = newAlign;
        } else {
          delete val.style.textAlign;
          if (Object.keys(val.style).length === 0) {
            delete val.style;
          }
        }

        row[c.colField] = val;
      });

      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        [targetDataKey]: newData,
      };
    },

  updateSelectedTableCellsStyle(style: Partial<any>) {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length === 0)
        return;

      const { elementId, cells } = this.tableSelection;
      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element || element.locked || element.type !== ElementType.TABLE)
        return;

      const nextRowsByKey: Partial<Record<"data" | "footerData", any[]>> = {};
      let hasChanges = false;

      const getRows = (targetDataKey: "data" | "footerData") => {
        if (!nextRowsByKey[targetDataKey]) {
          nextRowsByKey[targetDataKey] = cloneDeep(
            element![targetDataKey] || [],
          );
        }
        return nextRowsByKey[targetDataKey]!;
      };

      for (const cell of cells) {
        const targetDataKey =
          (cell.section || "body") === "footer" ? "footerData" : "data";
        const nextRows = getRows(targetDataKey);
        if (!nextRows[cell.rowIndex]) nextRows[cell.rowIndex] = {};

        const row = nextRows[cell.rowIndex];
        const currentValue = row[cell.colField];
        const cellObject =
          currentValue && typeof currentValue === "object"
            ? { ...currentValue }
            : { value: currentValue !== undefined ? currentValue : "" };
        const nextStyle = { ...(cellObject.style || {}) };

        for (const [key, value] of Object.entries(style)) {
          if (value === undefined || value === null || value === "") {
            delete nextStyle[key];
          } else {
            nextStyle[key] = value;
          }
        }

        if (Object.keys(nextStyle).length > 0) {
          cellObject.style = nextStyle;
        } else {
          delete cellObject.style;
        }

        row[cell.colField] = cellObject;
        hasChanges = true;
      }

      if (!hasChanges) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_STYLE);
      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        ...(nextRowsByKey.data ? { data: nextRowsByKey.data } : {}),
        ...(nextRowsByKey.footerData
          ? { footerData: nextRowsByKey.footerData }
          : {}),
      };
    },

  getSelectedTableRowsHeight() {
      if (!this.tableSelection || this.tableSelection.cells.length === 0) {
        return undefined;
      }

      const { elementId, cells } = this.tableSelection;
      let element: PrintElement | null = null;

      for (let i = 0; i < this.pages.length; i++) {
        const found = this.pages[i].elements.find((e) => e.id === elementId);
        if (found) {
          element = found;
          break;
        }
      }

      if (!element || element.type !== ElementType.TABLE) return undefined;

      const columns = getEffectiveTableColumns(element, this.testData);
      if (columns.length === 0) return undefined;

      const rowKeys = new Set<string>();
      const heights: number[] = [];

      for (const cell of cells) {
        const section = cell.section || "body";
        const rowKey = `${section}:${cell.rowIndex}`;
        if (rowKeys.has(rowKey)) continue;
        rowKeys.add(rowKey);

        const rows = section === "footer" ? element.footerData : element.data;
        const row = rows?.[cell.rowIndex];
        const explicitHeight = getTableRowExplicitHeight(row, columns);
        const fallbackHeight =
          section === "footer"
            ? Number(element.style.footerHeight) || 0
            : Number(element.style.rowHeight) || 0;
        const height =
          explicitHeight ?? (fallbackHeight > 0 ? fallbackHeight : undefined);

        if (height === undefined) return undefined;
        heights.push(height);
      }

      if (heights.length === 0) return undefined;
      const firstHeight = heights[0];
      return heights.every((height) => Math.abs(height - firstHeight) < 0.01)
        ? firstHeight
        : undefined;
    },

  updateSelectedTableRowsHeight(height: number) {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length === 0)
        return;

      const nextHeight = Number(height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;

      const { elementId, cells } = this.tableSelection;
      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element || element.locked || element.type !== ElementType.TABLE)
        return;

      const columns = getEffectiveTableColumns(element, this.testData);
      if (columns.length === 0) return;

      const targetRowsByKey: Record<"data" | "footerData", Set<number>> = {
        data: new Set<number>(),
        footerData: new Set<number>(),
      };

      cells.forEach((cell) => {
        const targetDataKey =
          (cell.section || "body") === "footer" ? "footerData" : "data";
        targetRowsByKey[targetDataKey].add(cell.rowIndex);
      });

      const nextRowsByKey: Partial<Record<"data" | "footerData", any[]>> = {};
      let hasChanges = false;

      const getRows = (targetDataKey: "data" | "footerData") => {
        if (!nextRowsByKey[targetDataKey]) {
          nextRowsByKey[targetDataKey] = cloneDeep(
            element![targetDataKey] || [],
          );
        }
        return nextRowsByKey[targetDataKey]!;
      };

      const applyHeightToRow = (
        targetDataKey: "data" | "footerData",
        rowIndex: number,
      ) => {
        const nextRows = getRows(targetDataKey);
        if (!nextRows[rowIndex]) nextRows[rowIndex] = {};

        const row = nextRows[rowIndex];
        columns.forEach((col) => {
          const currentValue = row[col.field];
          const cellObject =
            currentValue && typeof currentValue === "object"
              ? { ...currentValue }
              : { value: currentValue !== undefined ? currentValue : "" };
          const currentHeight = getNumericCellStyleHeight(cellObject);
          cellObject.style = {
            ...(cellObject.style || {}),
            height: nextHeight,
          };

          if (currentHeight !== nextHeight) {
            hasChanges = true;
          }

          row[col.field] = cellObject;
        });
      };

      targetRowsByKey.data.forEach((rowIndex) => {
        applyHeightToRow("data", rowIndex);
      });
      targetRowsByKey.footerData.forEach((rowIndex) => {
        applyHeightToRow("footerData", rowIndex);
      });

      if (!hasChanges) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_STYLE);
      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        ...(nextRowsByKey.data ? { data: nextRowsByKey.data } : {}),
        ...(nextRowsByKey.footerData
          ? { footerData: nextRowsByKey.footerData }
          : {}),
      };
    },

  getTableElementById(tableId: string) {
      if (!tableId) return null;

      for (const page of this.pages) {
        const table = page.elements.find(
          (element) =>
            element.id === tableId && element.type === ElementType.TABLE,
        );
        if (table) return table;
      }

      return null;
    },

  getEffectiveTableRows(
      table: PrintElement,
      section: "body" | "footer",
    ): EffectiveTableRows {
      const layoutRows =
        section === "footer"
          ? Array.isArray(table.footerData)
            ? table.footerData
            : []
          : Array.isArray(table.data)
            ? table.data
            : [];

      if (section === "footer" && table.footerDataVariable && this.testData) {
        const key = normalizeVariableKey(table.footerDataVariable);
        const rows = key ? this.testData[key] : undefined;
        if (Array.isArray(rows)) {
          return { rows, layoutRows };
        }
      }

      if (section === "body" && table.variable && this.testData) {
        const key = normalizeVariableKey(table.variable);
        const rows = key ? this.testData[key] : undefined;
        if (Array.isArray(rows)) {
          return { rows, layoutRows };
        }
      }

      return {
        rows: layoutRows,
        layoutRows,
      };
    },

  getTableColumnPixelWidths(table: PrintElement, columns: TableColumn[]) {
      const colCount = Math.max(1, columns.length || 1);

      return columns.map((column) => {
        const width =
          typeof column.width === "number" &&
          Number.isFinite(column.width) &&
          column.width > 0
            ? column.width
            : Math.max(20, Math.floor(table.width / colCount));

        return {
          field: column.field,
          width: Math.max(0, width),
        };
      });
    },

  getTableSectionRowHeight(
      table: PrintElement,
      section: "body" | "footer",
      rowIndex: number,
      columns: TableColumn[],
      rows: any[],
      layoutRows: any[],
    ) {
      const row = layoutRows[rowIndex] ?? rows[rowIndex];
      const explicitHeight =
        getTableRowExplicitHeight(row, columns) ??
        getTableRowExplicitHeight(rows[rowIndex], columns);

      const fallbackRaw =
        section === "footer"
          ? Number(table.style.footerHeight) || 0
          : Number(table.style.rowHeight) || 0;
      const fallback = fallbackRaw > 0 ? fallbackRaw : 32;

      return explicitHeight ?? fallback;
    },

  getEmbeddedElementCellBounds(
      element: PrintElement,
    ): EmbeddedCellBounds | null {
      const tableId = element.embeddedInTableId;
      const cellRef = element.embeddedInTableCell;
      if (!tableId || !cellRef) return null;

      const rowIndex = Number(cellRef.rowIndex);
      if (!Number.isFinite(rowIndex)) return null;

      const section = cellRef.section === "footer" ? "footer" : "body";

      const table = this.getTableElementById(tableId);
      if (!table) return null;

      const escapedTableId = escapeAttributeSelectorValue(tableId);
      const tableWrapper = querySelectorAcrossDocumentAndShadowRoots(
        `.element-wrapper[data-element-id="${escapedTableId}"]`,
      );

      if (tableWrapper) {
        const escapedColField = escapeAttributeSelectorValue(cellRef.colField);
        const escapedRowIndex = escapeAttributeSelectorValue(String(rowIndex));
        const matchedCell = tableWrapper.querySelector(
          `td[data-field="${escapedColField}"][data-row-index="${escapedRowIndex}"][data-section="${section}"]`,
        ) as HTMLElement | null;

        if (matchedCell) {
          const zoom = this.zoom || 1;
          const wrapperRect = tableWrapper.getBoundingClientRect();
          const visibleRect = getCellBorderInsetRect(
            matchedCell,
            wrapperRect,
            zoom,
          );
          const width =
            Math.max(0, visibleRect.right - visibleRect.left) / zoom;
          const height =
            Math.max(0, visibleRect.bottom - visibleRect.top) / zoom;

          if (width > 0 && height > 0) {
            return {
              x: table.x + (visibleRect.left - wrapperRect.left) / zoom,
              y: table.y + (visibleRect.top - wrapperRect.top) / zoom,
              width,
              height,
            };
          }
        }
      }

      const columns = getEffectiveTableColumns(table, this.testData);
      if (columns.length === 0) return null;

      const columnWidths = this.getTableColumnPixelWidths(table, columns);
      const columnIndex = columnWidths.findIndex(
        (column) => column.field === cellRef.colField,
      );
      if (columnIndex < 0) return null;

      if (section === "footer" && table.showFooter !== true) return null;

      const bodyRows = this.getEffectiveTableRows(table, "body");
      const footerRows = this.getEffectiveTableRows(table, "footer");
      const sectionRows = section === "footer" ? footerRows : bodyRows;
      const rowCount =
        sectionRows.rows.length > 0
          ? sectionRows.rows.length
          : sectionRows.layoutRows.length;

      if (rowIndex < 0 || rowIndex >= rowCount) {
        return null;
      }

      let x = table.x;
      for (let i = 0; i < columnIndex; i += 1) {
        x += columnWidths[i].width;
      }

      const getBodyRowHeight = (index: number) =>
        this.getTableSectionRowHeight(
          table,
          "body",
          index,
          columns,
          bodyRows.rows,
          bodyRows.layoutRows,
        );

      const getFooterRowHeight = (index: number) =>
        this.getTableSectionRowHeight(
          table,
          "footer",
          index,
          columns,
          footerRows.rows,
          footerRows.layoutRows,
        );

      let y = table.y;
      if (table.showHeader !== false) {
        const headerHeightRaw = Number(table.style.headerHeight) || 0;
        y += headerHeightRaw > 0 ? headerHeightRaw : 32;
      }

      if (section === "body") {
        for (let i = 0; i < rowIndex; i += 1) {
          y += getBodyRowHeight(i);
        }
      } else {
        const bodyRowCount =
          bodyRows.rows.length > 0
            ? bodyRows.rows.length
            : bodyRows.layoutRows.length;
        for (let i = 0; i < bodyRowCount; i += 1) {
          y += getBodyRowHeight(i);
        }
        for (let i = 0; i < rowIndex; i += 1) {
          y += getFooterRowHeight(i);
        }
      }

      const layoutRow = sectionRows.layoutRows[rowIndex];
      const dataRow = sectionRows.rows[rowIndex];
      const layoutCell =
        layoutRow && typeof layoutRow === "object"
          ? layoutRow[cellRef.colField]
          : undefined;
      const dataCell =
        dataRow && typeof dataRow === "object"
          ? dataRow[cellRef.colField]
          : undefined;
      const cell =
        layoutCell && typeof layoutCell === "object"
          ? layoutCell
          : dataCell && typeof dataCell === "object"
            ? dataCell
            : null;

      const rawColSpan =
        typeof cell?.colSpan === "number" && Number.isFinite(cell.colSpan)
          ? Math.floor(cell.colSpan)
          : 1;
      const rawRowSpan =
        typeof cell?.rowSpan === "number" && Number.isFinite(cell.rowSpan)
          ? Math.floor(cell.rowSpan)
          : 1;

      if (rawColSpan <= 0 || rawRowSpan <= 0) return null;

      const colSpan = Math.max(1, rawColSpan);
      const rowSpan = Math.max(1, rawRowSpan);

      let width = 0;
      const endColumnIndex = Math.min(
        columnWidths.length,
        columnIndex + colSpan,
      );
      for (let i = columnIndex; i < endColumnIndex; i += 1) {
        width += columnWidths[i].width;
      }

      let height = 0;
      const endRowIndex = Math.min(rowCount, rowIndex + rowSpan);
      for (let i = rowIndex; i < endRowIndex; i += 1) {
        height +=
          section === "footer" ? getFooterRowHeight(i) : getBodyRowHeight(i);
      }

      if (width <= 0 || height <= 0) return null;

      return {
        x,
        y,
        width,
        height,
      };
    },

  moveEmbeddedElementsByTableDelta(
      tableDeltaById: Map<string, { dx: number; dy: number }>,
      options?: { excludeIds?: Set<string> },
    ) {
      if (tableDeltaById.size === 0) return;

      const excludeIds = options?.excludeIds || new Set<string>();
      for (const page of this.pages) {
        for (let index = 0; index < page.elements.length; index += 1) {
          const element = page.elements[index];
          if (excludeIds.has(element.id)) continue;

          const tableId = element.embeddedInTableId;
          if (!tableId) continue;

          const delta = tableDeltaById.get(tableId);
          if (!delta || (delta.dx === 0 && delta.dy === 0)) continue;

          page.elements[index] = {
            ...element,
            x: element.x + delta.dx,
            y: element.y + delta.dy,
          };
        }
      }
    },

  ensureEmbeddedElementsAboveTables(tableIds?: Set<string>) {
      const tableZIndexById = new Map<string, number>();

      for (const page of this.pages) {
        for (const element of page.elements) {
          if (element.type !== ElementType.TABLE) continue;
          if (tableIds && tableIds.size > 0 && !tableIds.has(element.id)) {
            continue;
          }

          tableZIndexById.set(element.id, getElementZIndex(element));
        }
      }

      if (tableZIndexById.size === 0) return;

      for (const page of this.pages) {
        for (let index = 0; index < page.elements.length; index += 1) {
          const element = page.elements[index];
          const tableId = element.embeddedInTableId;
          if (!tableId) continue;

          const tableZ = tableZIndexById.get(tableId);
          if (tableZ === undefined) continue;

          const currentZ = getElementZIndex(element);
          if (currentZ > tableZ) continue;

          page.elements[index] = {
            ...element,
            style: {
              ...element.style,
              zIndex: tableZ + 1,
            },
          };
        }
      }
    },

  normalizeTableForHeaderFooterRegion(element: PrintElement) {
      if (element.type !== ElementType.TABLE) return element;
      if (!this.isElementInHeaderOrFooterRegion(element)) return element;
      if (element.autoPaginate !== true) return element;

      return {
        ...element,
        autoPaginate: false,
      };
    },

  paginateTable(elementId: string) {
      if (!this.isTemplateEditable) return;
      this.snapshot(HISTORY_ACTION.TABLE_PAGINATE);
      // 1. Find Element and Page
      let pageIndex = -1;
      let elementIndex = -1;
      let element: PrintElement | undefined;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === elementId);
        if (idx !== -1) {
          pageIndex = i;
          elementIndex = idx;
          element = this.pages[i].elements[idx];
          break;
        }
      }

      if (!element || element.type !== ElementType.TABLE || !element.data)
        return;

      // 2. Constants
      const PAGE_HEIGHT = this.canvasSize.height;
      const MARGIN_BOTTOM = 50; // Safety margin
      const HEADER_HEIGHT = element.style.headerHeight || 40; // Default estimate
      const ROW_HEIGHT = element.style.rowHeight || 30; // Default estimate
      const START_Y = element.y;

      // 3. Calculate Capacity
      const availableHeight = PAGE_HEIGHT - START_Y - MARGIN_BOTTOM;
      const bodyHeight = availableHeight - HEADER_HEIGHT;

      if (bodyHeight < ROW_HEIGHT) {
        // Not enough space for even one row? Move to next page?
        // For now, let's just split what fits.
      }

      const rowsPerPage = Math.floor(Math.max(0, bodyHeight) / ROW_HEIGHT);

      // 4. Check if split is needed
      if (rowsPerPage >= element.data.length) {
        return; // All fits
      }

      // 5. Split Data
      const currentData = element.data.slice(0, rowsPerPage);
      const remainingData = element.data.slice(rowsPerPage);

      // Update current element
      this.updateElement(
        element.id,
        {
          data: currentData,
          height: HEADER_HEIGHT + currentData.length * ROW_HEIGHT,
        },
        false,
      );

      // 6. Handle Next Page
      const nextPageIdx = pageIndex + 1;
      if (nextPageIdx >= this.pages.length) {
        this.addPage();
      }

      // 7. Create New Element on Next Page
      const newElement: PrintElement = {
        ...cloneDeep(element),
        id: uuidv4(),
        y: 50, // Start at top margin of next page
        data: remainingData,
        height: HEADER_HEIGHT + remainingData.length * ROW_HEIGHT, // Initial height estimate
      };

      this.pages[nextPageIdx].elements.push(newElement);

      // 8. Recursive Call (to handle multiple pages)
      // We need to wait for state update or just call it directly?
      // Calling directly is fine as we are modifying state synchronously.
      this.paginateTable(newElement.id);
    }
};
