<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  nextTick,
  inject,
  watch,
  type CSSProperties,
} from "vue";
import { useI18n } from "vue-i18n";
import type { PrintElement, TableCellRef } from "@/types";
import { useDesignerStore } from "@/stores/designer";
import cloneDeep from "lodash/cloneDeep";
import { normalizeVariableKey } from "@/utils/variables";

const props = defineProps<{
  element: PrintElement;
  variableDropHoverCell?: {
    rowIndex: number;
    colField: string;
    section?: "body" | "footer";
  } | null;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));
const tableHostRef = ref<HTMLElement | null>(null);

type CellGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const previousCellGeometryByKey = ref<Map<string, CellGeometry>>(new Map());
const hasCellGeometryBaseline = ref(false);
let embeddedGeometrySyncFrame: number | null = null;

const getEmbeddedCellKey = (cell: TableCellRef) => {
  const section = cell.section === "footer" ? "footer" : "body";
  return `${section}|${cell.rowIndex}|${cell.colField}`;
};

const getCellBorderInsetRect = (
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

const collectCurrentCellGeometryByKey = () => {
  const host = tableHostRef.value;
  const map = new Map<string, CellGeometry>();
  if (!host) return map;

  const zoom = store.zoom || 1;
  const hostRect = host.getBoundingClientRect();
  const candidateCells = host.querySelectorAll<HTMLElement>(
    "td[data-field][data-row-index][data-section]",
  );

  for (const cellEl of candidateCells) {
    const colField = cellEl.dataset.field || "";
    const rowIndex = Number(cellEl.dataset.rowIndex);
    if (!colField || !Number.isFinite(rowIndex)) continue;

    const section = cellEl.dataset.section === "footer" ? "footer" : "body";
    const visibleRect = getCellBorderInsetRect(cellEl, hostRect, zoom);
    map.set(`${section}|${rowIndex}|${colField}`, {
      x: (visibleRect.left - hostRect.left) / zoom,
      y: (visibleRect.top - hostRect.top) / zoom,
      width: Math.max(0, visibleRect.right - visibleRect.left) / zoom,
      height: Math.max(0, visibleRect.bottom - visibleRect.top) / zoom,
    });
  }

  return map;
};

const syncEmbeddedElementsByCellGeometryDelta = () => {
  if (!store.isTemplateEditable) return;

  const nextCellGeometryByKey = collectCurrentCellGeometryByKey();
  if (!hasCellGeometryBaseline.value) {
    previousCellGeometryByKey.value = nextCellGeometryByKey;
    hasCellGeometryBaseline.value = true;
    return;
  }

  const prevCellGeometryByKey = previousCellGeometryByKey.value;
  const epsilon = 0.01;

  for (const page of store.pages) {
    for (const element of page.elements) {
      if (element.embeddedInTableId !== props.element.id) continue;
      if (!element.embeddedInTableCell) continue;

      const cellKey = getEmbeddedCellKey(element.embeddedInTableCell);
      const prev = prevCellGeometryByKey.get(cellKey);
      const next = nextCellGeometryByKey.get(cellKey);
      if (!prev || !next) continue;

      const scaleX = prev.width > epsilon ? next.width / prev.width : 1;
      const scaleY = prev.height > epsilon ? next.height / prev.height : 1;

      const prevCellX = props.element.x + prev.x;
      const prevCellY = props.element.y + prev.y;
      const nextCellX = props.element.x + next.x;
      const nextCellY = props.element.y + next.y;

      const offsetX = element.x - prevCellX;
      const offsetY = element.y - prevCellY;

      const cellWidth = Math.max(0, next.width);
      const cellHeight = Math.max(0, next.height);

      // Keep embedded element size strictly within host cell bounds, even at tiny scales.
      const scaledWidth = Math.max(0, element.width * scaleX);
      const scaledHeight = Math.max(0, element.height * scaleY);
      const nextWidth = Math.min(cellWidth, scaledWidth);
      const nextHeight = Math.min(cellHeight, scaledHeight);

      let nextX = nextCellX + offsetX * scaleX;
      let nextY = nextCellY + offsetY * scaleY;

      const maxX = nextCellX + Math.max(0, cellWidth - nextWidth);
      const maxY = nextCellY + Math.max(0, cellHeight - nextHeight);

      nextX = Math.min(Math.max(nextCellX, nextX), maxX);
      nextY = Math.min(Math.max(nextCellY, nextY), maxY);

      const hasPositionChanged =
        Math.abs(nextX - element.x) > epsilon ||
        Math.abs(nextY - element.y) > epsilon;
      const hasSizeChanged =
        Math.abs(nextWidth - element.width) > epsilon ||
        Math.abs(nextHeight - element.height) > epsilon;

      if (!hasPositionChanged && !hasSizeChanged) continue;

      store.updateElement(
        element.id,
        {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        },
        false,
      );
    }
  }

  previousCellGeometryByKey.value = nextCellGeometryByKey;
};

const resetEmbeddedGeometryBaseline = () => {
  previousCellGeometryByKey.value = collectCurrentCellGeometryByKey();
  hasCellGeometryBaseline.value = true;
};

const scheduleEmbeddedGeometrySync = () => {
  if (embeddedGeometrySyncFrame !== null) return;

  embeddedGeometrySyncFrame = requestAnimationFrame(async () => {
    embeddedGeometrySyncFrame = null;
    await nextTick();
    syncEmbeddedElementsByCellGeometryDelta();
  });
};

function isCellSelected(
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) {
  if (
    store.tableSelection &&
    store.tableSelection.elementId !== props.element.id
  )
    return false;
  return (
    store.tableSelection?.cells.some(
      (c) =>
        c.rowIndex === rowIndex &&
        c.colField === colField &&
        (c.section || "body") === section,
    ) ?? false
  );
}

function isVariableDropCellHovered(
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) {
  const hoverCell = props.variableDropHoverCell;
  if (!hoverCell) return false;

  return (
    hoverCell.rowIndex === rowIndex &&
    hoverCell.colField === colField &&
    (hoverCell.section || "body") === section
  );
}

type InlineEditingCell = {
  rowIndex: number;
  colField: string;
  section: "body" | "footer";
};

const inlineEditingCell = ref<InlineEditingCell | null>(null);
const inlineEditingValue = ref("");
const inlineEditorRef = ref<HTMLTextAreaElement | null>(null);

const canInlineEditCell = computed(() => {
  return (
    store.isTemplateEditable &&
    !props.element.locked &&
    store.selectedElementId === props.element.id
  );
});

const isInlineEditingCurrentCell = (
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  const editing = inlineEditingCell.value;
  if (!editing) return false;

  return (
    editing.rowIndex === rowIndex &&
    editing.colField === colField &&
    editing.section === section
  );
};

const getRawCellEditValue = (row: any, colField: string) => {
  if (!row) return "";

  const value = row[colField];
  if (value && typeof value === "object") {
    return String(value.value ?? "");
  }

  return value === undefined || value === null ? "" : String(value);
};

const startCellInlineEdit = async (
  event: MouseEvent,
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  if (!canInlineEditCell.value) return;

  const wrapper = (event.currentTarget as HTMLElement | null)?.closest(
    ".element-wrapper",
  );
  if (wrapper?.getAttribute("data-read-only") === "true") return;

  const targetRows =
    section === "footer" ? props.element.footerData : props.element.data;
  if (!Array.isArray(targetRows)) return;
  const row = targetRows[rowIndex];
  if (!row) return;

  event.stopPropagation();
  inlineEditingCell.value = { rowIndex, colField, section };
  inlineEditingValue.value = getRawCellEditValue(row, colField);

  await nextTick();
  inlineEditorRef.value?.focus();
  inlineEditorRef.value?.select();
};

const commitCellInlineEdit = () => {
  const editing = inlineEditingCell.value;
  if (!editing) return;

  const targetKey = editing.section === "footer" ? "footerData" : "data";
  const currentRows = (props.element as any)[targetKey];
  if (!Array.isArray(currentRows)) {
    inlineEditingCell.value = null;
    inlineEditingValue.value = "";
    return;
  }

  const nextRows = JSON.parse(JSON.stringify(currentRows));
  if (!nextRows[editing.rowIndex]) {
    nextRows[editing.rowIndex] = {};
  }

  const row = nextRows[editing.rowIndex];
  const currentValue = row[editing.colField];
  if (currentValue && typeof currentValue === "object") {
    row[editing.colField] = {
      ...currentValue,
      value: inlineEditingValue.value,
    };
  } else {
    row[editing.colField] = inlineEditingValue.value;
  }

  if (editing.section === "footer") {
    store.updateElement(props.element.id, { footerData: nextRows });
  } else {
    store.updateElement(props.element.id, { data: nextRows });
  }

  inlineEditingCell.value = null;
  inlineEditingValue.value = "";
};

const cancelCellInlineEdit = () => {
  inlineEditingCell.value = null;
  inlineEditingValue.value = "";
};

const syncInlineEditingValueFromEvent = (event: Event) => {
  const target = event.target as HTMLTextAreaElement | null;
  if (!target) return;
  inlineEditingValue.value = target.value;
};

const handleInlineCellEditorKeydown = (event: KeyboardEvent) => {
  event.stopPropagation();

  if (event.key === "Escape") {
    event.preventDefault();
    cancelCellInlineEdit();
    return;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    if (event.isComposing) return;
    event.preventDefault();
    syncInlineEditingValueFromEvent(event);
    commitCellInlineEdit();
  }
};

// Column Header Editing Logic
const editingColIndex = ref<number | null>(null);
const editingFooterCell = ref<{ rowIndex: number; colField: string } | null>(
  null,
);
const editForm = ref({ header: "", field: "", value: "", variable: "" });
const editFormPosition = ref({ top: 0, left: 0 });
const editFormRef = ref<HTMLElement | null>(null);

const handleHeaderDblClick = async (e: MouseEvent, index: number) => {
  if (store.selectedElementId !== props.element.id || props.element.locked)
    return;

  const col = processedData.value.columns[index];
  if (!col) return;

  editingColIndex.value = index;
  editingFooterCell.value = null; // Clear footer edit
  editForm.value = {
    header: col.header,
    field: col.field,
    value: "",
    variable: "",
  };

  editFormPosition.value = {
    top: e.clientY + 10,
    left: e.clientX + 10,
  };

  // Adjust position if overflowing
  await nextTick();
  if (editFormRef.value) {
    const rect = editFormRef.value.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (editFormPosition.value.left + rect.width > winWidth) {
      editFormPosition.value.left = winWidth - rect.width - 20;
    }
    if (editFormPosition.value.top + rect.height > winHeight) {
      editFormPosition.value.top = winHeight - rect.height - 20;
    }
  }

  setTimeout(() => {
    window.addEventListener("click", handleClickOutside);
  }, 100);
};

const handleFooterDblClick = async (
  e: MouseEvent,
  rowIndex: number,
  colField: string,
) => {
  if (store.selectedElementId !== props.element.id || props.element.locked)
    return;

  const row = processedData.value.footerData[rowIndex];
  if (!row) return;

  const cell = row[colField];
  let value = "";
  let variable = "";

  if (cell && typeof cell === "object") {
    value = cell.value || "";
    variable = cell.field || "";
  }

  editingFooterCell.value = { rowIndex, colField };
  editingColIndex.value = null; // Clear header edit
  editForm.value = { header: "", field: colField, value, variable };

  editFormPosition.value = {
    top: e.clientY + 10,
    left: e.clientX + 10,
  };

  // Adjust position if overflowing
  await nextTick();
  if (editFormRef.value) {
    const rect = editFormRef.value.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (editFormPosition.value.left + rect.width > winWidth) {
      editFormPosition.value.left = winWidth - rect.width - 20;
    }
    if (editFormPosition.value.top + rect.height > winHeight) {
      editFormPosition.value.top = winHeight - rect.height - 20;
    }
  }

  setTimeout(() => {
    window.addEventListener("click", handleClickOutside);
  }, 100);
};

const handleClickOutside = (e: MouseEvent) => {
  if (editFormRef.value && !editFormRef.value.contains(e.target as Node)) {
    closeEditForm();
  }
};

const closeEditForm = () => {
  editingColIndex.value = null;
  editingFooterCell.value = null;
  window.removeEventListener("click", handleClickOutside);
};

const saveHeaderEdit = () => {
  if (editingColIndex.value !== null) {
    // ... existing header save logic ...
    const currentColumns = props.element.columns
      ? [...props.element.columns]
      : [];
    if (currentColumns.length === 0 && processedData.value.columns.length > 0) {
      const newCols = JSON.parse(JSON.stringify(processedData.value.columns));
      if (newCols[editingColIndex.value]) {
        newCols[editingColIndex.value].header = editForm.value.header;
        newCols[editingColIndex.value].field = editForm.value.field;
        store.updateElement(props.element.id, { columns: newCols });
      }
      closeEditForm();
      return;
    }
    if (editingColIndex.value < currentColumns.length) {
      currentColumns[editingColIndex.value] = {
        ...currentColumns[editingColIndex.value],
        header: editForm.value.header,
        field: editForm.value.field,
      };
      store.updateElement(props.element.id, { columns: currentColumns });
    }
  } else if (editingFooterCell.value) {
    // Save Footer Edit
    const { rowIndex, colField } = editingFooterCell.value;
    const currentFooterData = props.element.footerData
      ? JSON.parse(JSON.stringify(props.element.footerData))
      : [];

    // Ensure row exists
    if (!currentFooterData[rowIndex]) {
      // Should not happen if clicking existing row, but good to be safe
      return;
    }

    const row = currentFooterData[rowIndex];
    const val = row[colField];

    if (val && typeof val === "object") {
      val.value = editForm.value.value;
      val.field = editForm.value.variable;
    } else {
      row[colField] = {
        value: editForm.value.value,
        field: editForm.value.variable,
      };
    }

    store.updateElement(props.element.id, { footerData: currentFooterData });
  }

  closeEditForm();
};

const isSelecting = ref(false);
const startCell = ref<{
  rowIndex: number;
  colField: string;
  section: "body" | "footer";
} | null>(null);

const mergeOriginalRowCellLayout = (mergedRow: any, originalRow: any) => {
  Object.keys(originalRow).forEach((field) => {
    const originalCell = originalRow[field];
    if (!originalCell || typeof originalCell !== "object") return;

    const layout: Record<string, any> = {};
    if ("rowSpan" in originalCell) layout.rowSpan = originalCell.rowSpan;
    if ("colSpan" in originalCell) layout.colSpan = originalCell.colSpan;
    if (originalCell.style && typeof originalCell.style === "object") {
      layout.style = cloneDeep(originalCell.style);
    }
    if (Object.keys(layout).length === 0) return;

    if (mergedRow[field] === undefined) {
      mergedRow[field] = { value: "", ...layout };
    } else if (
      typeof mergedRow[field] !== "object" ||
      mergedRow[field] === null
    ) {
      mergedRow[field] = { value: mergedRow[field], ...layout };
    } else {
      Object.assign(mergedRow[field], layout);
    }
  });
};

const processedData = computed(() => {
  let cols = Array.isArray(props.element.columns) ? props.element.columns : [];
  let data = Array.isArray(props.element.data) ? props.element.data : [];
  let footerData = Array.isArray(props.element.footerData)
    ? props.element.footerData
    : [];

  const testData = store.testData || {};
  const variables = (store as any).variables || {};

  // Data Variable
  if (store.isExporting && props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    const tableData = key ? (variables[key] ?? testData[key]) : undefined;
    if (Array.isArray(tableData)) {
      data = tableData.map((row, index) => {
        // preserve rowSpan/colSpan/style from original data if available
        const originalRow = Array.isArray(props.element.data)
          ? props.element.data[index]
          : undefined;
        if (!originalRow) return cloneDeep(row);

        const mergedRow = cloneDeep(row);
        mergeOriginalRowCellLayout(mergedRow, originalRow);
        return mergedRow;
      });
    }
  } else if (!store.isExporting && props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    const tableData = key ? testData[key] : undefined;
    if (Array.isArray(tableData)) {
      data = tableData.map((row, index) => {
        // preserve rowSpan/colSpan/style from original data if available
        const originalRow = Array.isArray(props.element.data)
          ? props.element.data[index]
          : undefined;
        if (!originalRow) return cloneDeep(row);

        const mergedRow = cloneDeep(row);
        mergeOriginalRowCellLayout(mergedRow, originalRow);
        return mergedRow;
      });
    }
  }

  // Columns Variable
  if (store.isExporting && props.element.columnsVariable) {
    const key = normalizeVariableKey(props.element.columnsVariable);
    const tableCols = key ? (variables[key] ?? testData[key]) : undefined;
    if (Array.isArray(tableCols)) {
      cols = cloneDeep(tableCols);
    }
  } else if (!store.isExporting && props.element.columnsVariable) {
    const key = normalizeVariableKey(props.element.columnsVariable);
    const tableCols = key ? testData[key] : undefined;
    if (Array.isArray(tableCols)) {
      cols = cloneDeep(tableCols);
    }
  }

  // Footer Data Variable
  if (store.isExporting && props.element.footerDataVariable) {
    const key = normalizeVariableKey(props.element.footerDataVariable);
    const tableFooter = key ? (variables[key] ?? testData[key]) : undefined;
    if (Array.isArray(tableFooter)) {
      footerData = tableFooter.map((row, index) => {
        const originalRow = Array.isArray(props.element.footerData)
          ? props.element.footerData[index]
          : undefined;
        if (!originalRow) return cloneDeep(row);
        const mergedRow = cloneDeep(row);
        mergeOriginalRowCellLayout(mergedRow, originalRow);
        return mergedRow;
      });
    }
  } else if (!store.isExporting && props.element.footerDataVariable) {
    const key = normalizeVariableKey(props.element.footerDataVariable);
    const tableFooter = key ? testData[key] : undefined;
    if (Array.isArray(tableFooter)) {
      footerData = tableFooter.map((row, index) => {
        const originalRow = Array.isArray(props.element.footerData)
          ? props.element.footerData[index]
          : undefined;
        if (!originalRow) return cloneDeep(row);
        const mergedRow = cloneDeep(row);
        mergeOriginalRowCellLayout(mergedRow, originalRow);
        return mergedRow;
      });
    }
  }

  let scriptContent = props.element.customScript;

  // Custom Script Variable
  if (store.isExporting && props.element.customScriptVariable) {
    const key = normalizeVariableKey(props.element.customScriptVariable);
    const variableScript = key ? (variables[key] ?? testData[key]) : undefined;
    if (typeof variableScript === "string") {
      scriptContent = variableScript;
    }
  } else if (!store.isExporting && props.element.customScriptVariable) {
    const key = normalizeVariableKey(props.element.customScriptVariable);
    const variableScript = key ? testData[key] : undefined;
    if (typeof variableScript === "string") {
      scriptContent = variableScript;
    }
  }

  if (scriptContent) {
    try {
      const func = new Function(
        "data",
        "footerData",
        "columns",
        "type",
        scriptContent,
      );
      const result = func(
        cloneDeep(data),
        cloneDeep(footerData),
        cloneDeep(cols),
        "global",
      );
      if (result) {
        if (result.data) data = result.data;
        if (result.footerData) footerData = result.footerData;
        if (result.columns) return { ...result, columns: result.columns };
      }
    } catch (e) {
      console.error("Custom script error", e);
    }
  }

  // Calculate footer values based on field variable
  const computedFooterData = cloneDeep(footerData);
  const columnFields = cols.map((c: any) => c.field);

  computedFooterData.forEach((row: any) => {
    Object.keys(row).forEach((key) => {
      const cell = row[key];
      if (
        cell &&
        typeof cell === "object" &&
        cell.field &&
        columnFields.includes(cell.field)
      ) {
        const fieldKey = cell.field;
        // Simple SUM aggregation by default
        const sum = data.reduce((acc: number, curr: any) => {
          const val = parseFloat(curr[fieldKey]);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);
        // Store result in 'result' property, not overwriting value (which is static text)
        cell.result = sum;
      }
    });
  });

  return { columns: cols, data, footerData: computedFooterData, scriptContent };
});

const cellStyle = computed(() => ({
  color: props.element.style.color || "#000000",
  fontFamily: props.element.style.fontFamily,
  borderColor: props.element.style.borderColor || "#000",
  borderWidth: (props.element.style.borderWidth || 1) + "px",
  borderStyle: props.element.style.borderStyle || "solid",
}));

const tableOuterEdgeStyle = computed(() => {
  const borderStyle = props.element.style.borderStyle || "solid";
  const borderWidth = props.element.style.borderWidth || 1;
  if (borderStyle === "none" || borderWidth <= 0) return {};

  return {
    borderRight: `${borderWidth}px ${borderStyle} ${props.element.style.borderColor || "#000"}`,
    borderBottom: `${borderWidth}px ${borderStyle} ${props.element.style.borderColor || "#000"}`,
  };
});

const shouldRenderTableOuterEdge = computed(() => {
  return !store.isExporting;
});

const shouldShowBodyFooterConnectorBorder = computed(() => {
  return (
    props.element.showFooter === true &&
    shouldOmitBodyRowsInDesign.value &&
    processedData.value.footerData.length > 0
  );
});

const shouldOmitBodyRowsInDesign = computed(() => {
  return (
    !store.isExporting &&
    props.element.designOmitRows !== false &&
    processedData.value.data.length > 5
  );
});

const displayBodyRows = computed(() => {
  return shouldOmitBodyRowsInDesign.value
    ? processedData.value.data.slice(0, 5)
    : processedData.value.data;
});

const tableCellTextPosition = computed<"overlap" | "top" | "bottom">(() => {
  const mode = props.element.embeddedCellTextPosition;
  return mode === "top" || mode === "bottom" ? mode : "overlap";
});

const tableCellTextLayer = computed<"above" | "below">(() => {
  return props.element.embeddedCellTextLayer === "above" ? "above" : "below";
});

const embeddedCellKeySet = computed(() => {
  const keys = new Set<string>();
  for (const page of store.pages) {
    for (const element of page.elements) {
      if (element.embeddedInTableId !== props.element.id) continue;
      if (!element.embeddedInTableCell) continue;
      keys.add(getEmbeddedCellKey(element.embeddedInTableCell));
    }
  }
  return keys;
});

const hasEmbeddedElementInCell = (
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  return embeddedCellKeySet.value.has(`${section}|${rowIndex}|${colField}`);
};

const getCellTextPositionStyle = (
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  if (tableCellTextPosition.value === "overlap") return {};
  if (!hasEmbeddedElementInCell(rowIndex, colField, section)) return {};

  return {
    verticalAlign: tableCellTextPosition.value,
    lineHeight: "normal",
  };
};

const getCellTextLayerStyle = (
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
): CSSProperties => {
  if (!hasEmbeddedElementInCell(rowIndex, colField, section)) return {};

  return {
    position: "relative",
    zIndex: tableCellTextLayer.value === "above" ? 2 : 0,
    display: "inline-block",
    width: "100%",
  };
};

const hasCustomRowHeight = computed(() => {
  const rowHeight = props.element.style.rowHeight;
  return (
    typeof rowHeight === "number" && Number.isFinite(rowHeight) && rowHeight > 0
  );
});

const hasCustomHeaderHeight = computed(() => {
  const headerHeight = props.element.style.headerHeight;
  return (
    typeof headerHeight === "number" &&
    Number.isFinite(headerHeight) &&
    headerHeight > 0
  );
});

const hasCustomFooterHeight = computed(() => {
  const footerHeight = props.element.style.footerHeight;
  return (
    typeof footerHeight === "number" &&
    Number.isFinite(footerHeight) &&
    footerHeight > 0
  );
});

const shouldRenderDesignSpacerRow = computed(() => {
  return (
    !store.isExporting &&
    !hasCustomHeaderHeight.value &&
    !hasCustomRowHeight.value &&
    !hasCustomFooterHeight.value
  );
});

const CELL_VALUE_VARIABLE_RE = /@[A-Za-z0-9_.-]+/g;

const resolveCellValueVariable = (token: string) => {
  const key = normalizeVariableKey(token);
  if (!key) return token;

  const variables = (store as any).variables || {};
  if (
    store.isExporting &&
    Object.prototype.hasOwnProperty.call(variables, key) &&
    variables[key] !== undefined &&
    variables[key] !== null
  ) {
    return String(variables[key]);
  }

  if (
    Object.prototype.hasOwnProperty.call(store.testData || {}, key) &&
    store.testData[key] !== undefined &&
    store.testData[key] !== null
  ) {
    return String(store.testData[key]);
  }

  return token;
};

const resolveCellValueVariables = (value: unknown) => {
  if (typeof value !== "string") return value;
  return value.replace(CELL_VALUE_VARIABLE_RE, resolveCellValueVariable);
};

const getPrintValue = (row: any, field: string) => {
  if (!row) return "";
  const val = row[field];
  if (val && typeof val === "object") {
    const text = resolveCellValueVariables(val.value ?? "");
    // Use printValue (print token) if available, otherwise result, or fallback to empty
    const result =
      val.printValue !== undefined
        ? val.printValue
        : val.result !== undefined
          ? val.result
          : "";
    return text + result;
  }
  return resolveCellValueVariables(val);
};

const getCellValue = (row: any, field: string) => {
  if (!row) return "";
  const val = row[field];
  if (val && typeof val === "object") {
    const text = resolveCellValueVariables(val.value ?? "");
    // Use result (calculated display value) if available, otherwise printValue, or fallback to empty
    const result =
      val.result !== undefined
        ? val.result
        : val.printValue !== undefined
          ? val.printValue
          : "";
    return text + result;
  }
  return resolveCellValueVariables(val);
};

const getRowSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === "object" && "rowSpan" in val) {
    return val.rowSpan;
  }
  return 1;
};

const getColSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === "object" && "colSpan" in val) {
    return val.colSpan;
  }
  return 1;
};

const shouldRenderCell = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === "object") {
    if (val.rowSpan === 0 || val.colSpan === 0) return false;
  }
  return true;
};

const getCellStyle = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === "object" && val.style) {
    return val.style;
  }
  return {};
};

// Resizing Logic
const tempColumnWidths = ref<Record<string, number>>({});
const resizingColIndex = ref<number | null>(null);
const startResizeX = ref(0);
const startResizeWidth = ref(0);
type RowResizeSection = "header" | "body" | "footer";
const tempRowHeights = ref<Record<string, number>>({});
const resizingRow = ref<{ section: RowResizeSection; rowIndex: number } | null>(
  null,
);
const startResizeY = ref(0);
const startResizeHeight = ref(0);
const TABLE_BODY_DRAG_HANDLE_EDGE_SIZE = 10;
const canDragTableElement = computed(
  () => store.isTemplateEditable && !props.element.locked,
);
const shouldUseBodyCellDragCursor = computed(
  () =>
    canDragTableElement.value && store.selectedElementId !== props.element.id,
);
const columnResizeHandleClass =
  "absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 z-10 transition-opacity";
const rowResizeHandleClass =
  "absolute -bottom-1 left-0 right-0 h-2 cursor-row-resize hover:bg-blue-400 opacity-0 hover:opacity-100 z-20 transition-opacity";

const getRowResizeKey = (section: RowResizeSection, rowIndex: number) => {
  return `${section}:${rowIndex}`;
};

const getNumericStyleHeight = (style: any) => {
  const value = style?.height;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  return 0;
};

const getRowCellHeight = (row: any, fallbackHeight: number) => {
  if (!row) return fallbackHeight;

  for (const col of processedData.value.columns) {
    const height = getNumericStyleHeight(getCellStyle(row, col.field));
    if (height > 0) return height;
  }

  return fallbackHeight;
};

const getCurrentRowHeight = (
  section: RowResizeSection,
  rowIndex: number,
  row?: any,
) => {
  const tempHeight = tempRowHeights.value[getRowResizeKey(section, rowIndex)];
  if (
    typeof tempHeight === "number" &&
    Number.isFinite(tempHeight) &&
    tempHeight > 0
  ) {
    return tempHeight;
  }

  return getRenderedRowHeight(section, rowIndex, row) || 32;
};

const getRenderedRowHeight = (
  section: RowResizeSection,
  rowIndex: number,
  row?: any,
) => {
  const tempHeight = tempRowHeights.value[getRowResizeKey(section, rowIndex)];
  if (
    typeof tempHeight === "number" &&
    Number.isFinite(tempHeight) &&
    tempHeight > 0
  ) {
    return tempHeight;
  }

  if (section === "header") {
    const height = Number(props.element.style.headerHeight) || 0;
    return height > 0 ? height : 0;
  }

  if (section === "footer") {
    return getRowCellHeight(row, Number(props.element.style.footerHeight) || 0);
  }

  return getRowCellHeight(row, Number(props.element.style.rowHeight) || 0);
};

const getRowHeightCellStyle = (
  section: RowResizeSection,
  rowIndex: number,
  row?: any,
) => {
  const height = getRenderedRowHeight(section, rowIndex, row);
  if (!height) return {};

  return {
    height: `${height}px`,
    paddingTop: "0px",
    paddingBottom: "0px",
    lineHeight: `${height}px`,
  };
};

const hasRenderedRowHeight = (
  section: RowResizeSection,
  rowIndex: number,
  row?: any,
) => getRenderedRowHeight(section, rowIndex, row) > 0;

const isResizingRow = (section: RowResizeSection, rowIndex: number) => {
  return (
    resizingRow.value?.section === section &&
    resizingRow.value.rowIndex === rowIndex
  );
};

const shouldShowRowResizeHandle = () => {
  return store.selectedElementId === props.element.id && !props.element.locked;
};

const shouldShowBodyRowResizeHandle = (rowIndex: number) => {
  return shouldShowRowResizeHandle() && rowIndex < displayBodyRows.value.length;
};

const shouldShowFooterRowResizeHandle = (rowIndex: number) => {
  return (
    shouldShowRowResizeHandle() &&
    rowIndex < processedData.value.footerData.length
  );
};

const isBodyDragHandleHit = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const edgeSize = Math.min(
    TABLE_BODY_DRAG_HANDLE_EDGE_SIZE,
    rect.width / 3,
    rect.height / 3,
  );
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  return (
    offsetX <= edgeSize ||
    offsetX >= rect.width - edgeSize ||
    offsetY <= edgeSize ||
    offsetY >= rect.height - edgeSize
  );
};

const handleResizeStart = (e: MouseEvent, index: number) => {
  if (props.element.locked) return;
  e.preventDefault();
  e.stopPropagation();
  resetEmbeddedGeometryBaseline();
  resizingColIndex.value = index;
  startResizeX.value = e.clientX;
  const col = processedData.value.columns[index];
  startResizeWidth.value = col.width || 100;

  window.addEventListener("mousemove", handleResizeMove);
  window.addEventListener("mouseup", handleResizeEnd);
};

const handleResizeMove = (e: MouseEvent) => {
  if (resizingColIndex.value === null) return;
  const dx = e.clientX - startResizeX.value;
  const newWidth = Math.max(20, startResizeWidth.value + dx);
  const col = processedData.value.columns[resizingColIndex.value];
  tempColumnWidths.value[col.field] = newWidth;
  scheduleEmbeddedGeometrySync();
};

const handleResizeEnd = () => {
  if (resizingColIndex.value !== null) {
    const col = processedData.value.columns[resizingColIndex.value];
    const finalWidth = tempColumnWidths.value[col.field];
    if (finalWidth) {
      const newCols = [...(props.element.columns || [])];
      if (newCols[resizingColIndex.value]) {
        newCols[resizingColIndex.value] = {
          ...newCols[resizingColIndex.value],
          width: finalWidth,
        };
        store.updateElement(props.element.id, { columns: newCols });
      }
    }
  }
  resizingColIndex.value = null;
  tempColumnWidths.value = {};
  window.removeEventListener("mousemove", handleResizeMove);
  window.removeEventListener("mouseup", handleResizeEnd);
};

const applyHeightToRowCells = (
  rows: any[],
  rowIndex: number,
  height: number,
) => {
  if (!rows[rowIndex]) rows[rowIndex] = {};

  const row = rows[rowIndex];
  processedData.value.columns.forEach((col: any) => {
    const currentValue = row[col.field];
    const cellObject =
      currentValue && typeof currentValue === "object"
        ? { ...currentValue }
        : { value: currentValue !== undefined ? currentValue : "" };

    cellObject.style = {
      ...(cellObject.style || {}),
      height,
    };
    row[col.field] = cellObject;
  });
};

const getResizeTargetCellHeight = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement | null;
  const cell = target?.closest("th,td") as HTMLElement | null;
  if (!cell) return 0;

  const height = cell.getBoundingClientRect().height / (store.zoom || 1);
  return Number.isFinite(height) && height > 0 ? height : 0;
};

const handleRowResizeStart = (
  e: MouseEvent,
  section: RowResizeSection,
  rowIndex: number,
  row?: any,
) => {
  if (props.element.locked) return;
  e.preventDefault();
  e.stopPropagation();
  resetEmbeddedGeometryBaseline();
  resizingRow.value = { section, rowIndex };
  startResizeY.value = e.clientY;
  startResizeHeight.value =
    getResizeTargetCellHeight(e) || getCurrentRowHeight(section, rowIndex, row);

  window.addEventListener("mousemove", handleRowResizeMove);
  window.addEventListener("mouseup", handleRowResizeEnd);
};

const handleRowResizeMove = (e: MouseEvent) => {
  if (!resizingRow.value) return;
  const dy = e.clientY - startResizeY.value;
  const newHeight = Math.max(20, startResizeHeight.value + dy);
  tempRowHeights.value[
    getRowResizeKey(resizingRow.value.section, resizingRow.value.rowIndex)
  ] = newHeight;
  scheduleEmbeddedGeometrySync();
};

const handleRowResizeEnd = () => {
  if (resizingRow.value) {
    const { section, rowIndex } = resizingRow.value;
    const finalHeight =
      tempRowHeights.value[getRowResizeKey(section, rowIndex)];
    if (finalHeight) {
      if (section === "header") {
        store.updateElement(props.element.id, {
          style: { ...props.element.style, headerHeight: finalHeight },
        });
      } else {
        const targetKey = section === "footer" ? "footerData" : "data";
        const currentRows = (props.element as any)[targetKey] || [];
        const nextRows = JSON.parse(JSON.stringify(currentRows));
        applyHeightToRowCells(nextRows, rowIndex, finalHeight);
        store.updateElement(props.element.id, { [targetKey]: nextRows } as any);
      }
    }
  }

  resizingRow.value = null;
  tempRowHeights.value = {};
  window.removeEventListener("mousemove", handleRowResizeMove);
  window.removeEventListener("mouseup", handleRowResizeEnd);
};

const getColumnPixelWidth = (field: string, width?: number) => {
  const tempWidth = tempColumnWidths.value[field];
  if (
    typeof tempWidth === "number" &&
    Number.isFinite(tempWidth) &&
    tempWidth > 0
  ) {
    return tempWidth;
  }

  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    return width;
  }

  const colCount = Math.max(1, processedData.value.columns.length || 1);
  return Math.max(20, Math.floor(props.element.width / colCount));
};

const showInlineColumnResizeHandles = computed(() => {
  return (
    props.element.showHeader === false &&
    store.selectedElementId === props.element.id &&
    !props.element.locked
  );
});

const shouldShowBodyColumnResizeHandle = (
  rowIndex: number,
  colIndex: number,
) => {
  return (
    showInlineColumnResizeHandles.value &&
    rowIndex === 0 &&
    colIndex < processedData.value.columns.length - 1
  );
};

const shouldShowFooterColumnResizeHandle = (
  rowIndex: number,
  colIndex: number,
) => {
  return (
    showInlineColumnResizeHandles.value &&
    displayBodyRows.value.length === 0 &&
    rowIndex === 0 &&
    colIndex < processedData.value.columns.length - 1
  );
};

const tableGeometrySyncSignature = computed(() => {
  const columnSignature = processedData.value.columns
    .map((col: any) => `${col.field}:${Number(col.width) || 0}`)
    .join(",");
  const bodyRowHeightSignature = displayBodyRows.value
    .map((row: any, index: number) => `${index}:${getRowCellHeight(row, 0)}`)
    .join(",");
  const footerRowHeightSignature = processedData.value.footerData
    .map((row: any, index: number) => `${index}:${getRowCellHeight(row, 0)}`)
    .join(",");

  return [
    Number(props.element.width) || 0,
    Number(props.element.height) || 0,
    props.element.showHeader === false ? "0" : "1",
    props.element.showFooter === false ? "0" : "1",
    props.element.designOmitRows === false ? "0" : "1",
    Number(props.element.style?.headerHeight) || 0,
    Number(props.element.style?.rowHeight) || 0,
    Number(props.element.style?.footerHeight) || 0,
    processedData.value.data.length,
    displayBodyRows.value.length,
    processedData.value.footerData.length,
    columnSignature,
    bodyRowHeightSignature,
    footerRowHeightSignature,
  ].join("|");
});

watch(
  tableGeometrySyncSignature,
  async () => {
    await nextTick();
    syncEmbeddedElementsByCellGeometryDelta();
  },
  { flush: "post" },
);

watch(
  () => store.selectedElementId,
  (id) => {
    if (id !== props.element.id) {
      commitCellInlineEdit();
    }
  },
);

watch(
  () => inlineEditingCell.value !== null,
  (isEditing) => {
    store.setDisableGlobalShortcuts(isEditing);
  },
);

const handleMouseDown = (
  event: MouseEvent,
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  if (store.selectedElementId !== props.element.id) return;
  if (event.button !== 0) return;
  if (section === "body" && isBodyDragHandleHit(event)) {
    store.clearTableSelection();
    return;
  }

  event.stopPropagation();
  isSelecting.value = true;
  startCell.value = { rowIndex, colField, section };
  store.setTableSelection(
    props.element.id,
    { rowIndex, colField, section },
    false,
  );
};

const handleMouseOver = (
  rowIndex: number,
  colField: string,
  section: "body" | "footer" = "body",
) => {
  if (!isSelecting.value || !startCell.value) return;

  // Prevent cross-section selection
  if (startCell.value.section !== section) return;

  const startRow = startCell.value.rowIndex;
  const endRow = rowIndex;
  const startColIdx = processedData.value.columns.findIndex(
    (c: any) => c.field === startCell.value!.colField,
  );
  const endColIdx = processedData.value.columns.findIndex(
    (c: any) => c.field === colField,
  );

  if (startColIdx === -1 || endColIdx === -1) return;

  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);

  const cells = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push({
        rowIndex: r,
        colField: processedData.value.columns[c].field,
        section,
      });
    }
  }

  store.setTableSelectionCells(props.element.id, cells);
};

const handleMouseUp = () => {
  isSelecting.value = false;
  startCell.value = null;
};

onMounted(() => {
  window.addEventListener("mouseup", handleMouseUp);

  nextTick(() => {
    resetEmbeddedGeometryBaseline();
  });
});

onUnmounted(() => {
  window.removeEventListener("mouseup", handleMouseUp);
  if (inlineEditingCell.value) {
    store.setDisableGlobalShortcuts(false);
  }
  if (embeddedGeometrySyncFrame !== null) {
    cancelAnimationFrame(embeddedGeometrySyncFrame);
    embeddedGeometrySyncFrame = null;
  }
  hasCellGeometryBaseline.value = false;
  previousCellGeometryByKey.value = new Map();
});
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from "@/types";
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: "properties.section.dataBehavior",
      tab: "properties",
      fields: [
        {
          label: "properties.label.autoPaginate",
          type: "switch",
          target: "element",
          key: "autoPaginate",
        },
        {
          label: "properties.label.repeatFooter",
          type: "switch",
          target: "element",
          key: "tfootRepeat",
        },
        {
          label: "properties.label.showHeader",
          type: "switch",
          target: "element",
          key: "showHeader",
          defaultValue: true,
        },
        {
          label: "properties.label.showFooter",
          type: "switch",
          target: "element",
          key: "showFooter",
        },
        {
          label: "properties.label.designOmitRows",
          type: "switch",
          target: "element",
          key: "designOmitRows",
          defaultValue: true,
        },
        {
          label: "properties.label.columnsVariable",
          type: "text",
          target: "element",
          key: "columnsVariable",
          placeholder: "@columnsVariable",
        },
        {
          label: "properties.label.dataVariable",
          type: "text",
          target: "element",
          key: "variable",
          placeholder: "@dataVariable",
        },
        {
          label: "properties.label.footerDataVariable",
          type: "text",
          target: "element",
          key: "footerDataVariable",
          placeholder: "@footerDataVariable",
        },
        {
          label: "properties.label.customScriptVariable",
          type: "text",
          target: "element",
          key: "customScriptVariable",
          placeholder: "@customScriptVariable",
        },
        {
          label: "properties.label.columns",
          type: "code",
          language: "json",
          target: "element",
          key: "columns",
          height: 100,
          placeholder: "properties.label.columnsPlaceholder",
        },
        {
          label: "properties.label.data",
          type: "code",
          language: "json",
          target: "element",
          key: "data",
          height: 100,
          placeholder: "properties.label.dataPlaceholder",
        },
        {
          label: "properties.label.footerData",
          type: "code",
          language: "json",
          target: "element",
          key: "footerData",
          height: 100,
          placeholder: "properties.label.footerDataPlaceholder",
        },
        {
          label: "properties.label.customScript",
          type: "code",
          language: "javascript",
          target: "element",
          key: "customScript",
          height: 100,
          placeholder: "properties.label.customScriptPlaceholder",
        },
      ],
    },
    {
      title: "properties.section.layoutDimensions",
      tab: "style",
      fields: [
        {
          label: "properties.label.headerHeight",
          type: "number",
          target: "style",
          key: "headerHeight",
          min: 1,
          max: 200,
          step: 1,
        },
        {
          label: "properties.label.rowHeight",
          type: "number",
          target: "style",
          key: "rowHeight",
          min: 1,
          max: 200,
          step: 1,
        },
        {
          label: "properties.label.footerHeight",
          type: "number",
          target: "style",
          key: "footerHeight",
          min: 1,
          max: 200,
          step: 1,
        },
      ],
    },
    {
      title: "properties.section.appearance",
      tab: "style",
      fields: [
        {
          label: "properties.label.backgroundColor",
          type: "color",
          target: "style",
          key: "backgroundColor",
        },
        {
          label: "properties.label.textColor",
          type: "color",
          target: "style",
          key: "color",
        },
        {
          label: "properties.label.fontSize",
          type: "number",
          target: "style",
          key: "fontSize",
          min: 8,
          max: 72,
          step: 1,
        },
        {
          label: "properties.label.textAlign",
          type: "select",
          target: "style",
          key: "textAlign",
          options: [
            { label: "properties.align.left", value: "left" },
            { label: "properties.align.center", value: "center" },
            { label: "properties.align.right", value: "right" },
          ],
        },
        {
          label: "properties.label.cellTextPosition",
          type: "select",
          target: "element",
          key: "embeddedCellTextPosition",
          options: [
            { label: "properties.option.overlap", value: "overlap" },
            { label: "properties.option.top", value: "top" },
            { label: "properties.option.bottom", value: "bottom" },
          ],
        },
        {
          label: "properties.label.cellTextLayer",
          type: "select",
          target: "element",
          key: "embeddedCellTextLayer",
          options: [
            { label: "properties.option.below", value: "below" },
            { label: "properties.option.above", value: "above" },
          ],
        },
      ],
    },
    {
      title: "properties.section.headerStyle",
      tab: "style",
      fields: [
        {
          label: "properties.label.background",
          type: "color",
          target: "style",
          key: "headerBackgroundColor",
        },
        {
          label: "properties.label.textColor",
          type: "color",
          target: "style",
          key: "headerColor",
        },
        {
          label: "properties.label.fontSize",
          type: "number",
          target: "style",
          key: "headerFontSize",
          min: 8,
          max: 72,
          step: 1,
        },
        {
          label: "properties.label.textAlign",
          type: "select",
          target: "style",
          key: "headerTextAlign",
          options: [
            { label: "properties.align.left", value: "left" },
            { label: "properties.align.center", value: "center" },
            { label: "properties.align.right", value: "right" },
          ],
        },
      ],
    },
    {
      title: "properties.section.footerStyle",
      tab: "style",
      fields: [
        {
          label: "properties.label.background",
          type: "color",
          target: "style",
          key: "footerBackgroundColor",
        },
        {
          label: "properties.label.textColor",
          type: "color",
          target: "style",
          key: "footerColor",
        },
        {
          label: "properties.label.fontSize",
          type: "number",
          target: "style",
          key: "footerFontSize",
          min: 8,
          max: 72,
          step: 1,
        },
        {
          label: "properties.label.textAlign",
          type: "select",
          target: "style",
          key: "footerTextAlign",
          options: [
            { label: "properties.align.left", value: "left" },
            { label: "properties.align.center", value: "center" },
            { label: "properties.align.right", value: "right" },
          ],
        },
      ],
    },
    {
      title: "properties.section.border",
      tab: "style",
      fields: [
        {
          label: "properties.label.borderStyle",
          type: "select",
          target: "style",
          key: "borderStyle",
          options: [
            { label: "properties.option.none", value: "none" },
            { label: "properties.option.solid", value: "solid" },
            { label: "properties.option.dashed", value: "dashed" },
            { label: "properties.option.dotted", value: "dotted" },
          ],
        },
        {
          label: "properties.label.borderWidth",
          type: "number",
          target: "style",
          key: "borderWidth",
          min: 0,
          max: 20,
          step: 1,
        },
        {
          label: "properties.label.borderColor",
          type: "color",
          target: "style",
          key: "borderColor",
        },
      ],
    },
  ],
};
</script>

<template>
  <div
    ref="tableHostRef"
    class="relative w-full h-full overflow-hidden"
    :style="{ backgroundColor: element.style.backgroundColor || 'transparent' }"
  >
    <table
      class="w-full border-collapse"
      :class="{ 'h-full': !store.isExporting }"
      :style="{ tableLayout: 'fixed' }"
      :data-tfoot-repeat="element.tfootRepeat"
      :data-auto-paginate="element.autoPaginate"
      :data-custom-script="processedData.scriptContent || element.customScript"
    >
      <colgroup>
        <col
          v-for="col in processedData.columns"
          :key="`col-${col.field}`"
          :style="{ width: `${getColumnPixelWidth(col.field, col.width)}px` }"
        />
      </colgroup>
      <thead v-if="element.showHeader !== false">
        <tr>
          <th
            v-for="(col, index) in processedData.columns"
            :key="col.field"
            class="p-1 font-bold text-sm relative group select-none"
            :style="{
              ...cellStyle,
              width: `${getColumnPixelWidth(col.field, col.width)}px`,
              height: hasCustomHeaderHeight
                ? `${element.style.headerHeight}px`
                : undefined,
              paddingTop: hasCustomHeaderHeight ? '0px' : undefined,
              paddingBottom: hasCustomHeaderHeight ? '0px' : undefined,
              lineHeight: hasCustomHeaderHeight
                ? `${element.style.headerHeight}px`
                : undefined,
              overflow: shouldShowRowResizeHandle()
                ? 'visible'
                : hasCustomHeaderHeight
                  ? 'hidden'
                  : undefined,
              backgroundColor: element.style.headerBackgroundColor || '#f3f4f6',
              color: element.style.headerColor || '#000000',
              fontSize: element.style.headerFontSize
                ? `${element.style.headerFontSize}px`
                : undefined,
              textAlign: element.style.headerTextAlign || 'left',
              cursor:
                store.selectedElementId === element.id ? 'pointer' : 'default',
              ...getRowHeightCellStyle('header', 0),
            }"
            @dblclick="(e) => handleHeaderDblClick(e, index)"
          >
            {{ col.header }}

            <!-- Resize Handle -->
            <div
              v-if="
                store.selectedElementId === element.id &&
                index < processedData.columns.length - 1 &&
                !element.locked
              "
              :class="[
                columnResizeHandleClass,
                { 'bg-blue-400 opacity-100': resizingColIndex === index },
              ]"
              @mousedown="(e) => handleResizeStart(e, index)"
              @click.stop
            ></div>
            <div
              v-if="shouldShowRowResizeHandle()"
              :class="[
                rowResizeHandleClass,
                { 'bg-blue-400 opacity-100': isResizingRow('header', 0) },
              ]"
              @mousedown="(e) => handleRowResizeStart(e, 'header', 0)"
              @click.stop
            ></div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in displayBodyRows" :key="i">
          <template
            v-for="(col, colIndex) in processedData.columns"
            :key="col.field"
          >
            <td
              v-if="shouldRenderCell(row, col.field)"
              class="relative p-1 select-none cursor-default"
              :class="{
                'bg-blue-100 ring-1 ring-blue-400':
                  isCellSelected(i, col.field) &&
                  !isInlineEditingCurrentCell(i, col.field),
                'bg-blue-50 ring-1 ring-blue-300': isVariableDropCellHovered(
                  i,
                  col.field,
                ),
              }"
              :style="{
                ...cellStyle,
                height: hasCustomRowHeight
                  ? `${element.style.rowHeight}px`
                  : undefined,
                paddingTop: hasCustomRowHeight ? '0px' : undefined,
                paddingBottom: hasCustomRowHeight ? '0px' : undefined,
                lineHeight: hasCustomRowHeight
                  ? `${element.style.rowHeight}px`
                  : undefined,
                overflow:
                  shouldShowBodyColumnResizeHandle(i, colIndex) ||
                  shouldShowBodyRowResizeHandle(i)
                    ? 'visible'
                    : hasRenderedRowHeight('body', i, row)
                      ? 'hidden'
                      : undefined,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                textAlign: element.style.textAlign || 'left',
                fontSize: element.style.fontSize
                  ? `${element.style.fontSize}px`
                  : undefined,
                cursor: shouldUseBodyCellDragCursor ? 'move' : 'default',
                ...getCellStyle(row, col.field),
                ...getRowHeightCellStyle('body', i, row),
                ...getCellTextPositionStyle(i, col.field, 'body'),
              }"
              :rowspan="getRowSpan(row, col.field)"
              :colspan="getColSpan(row, col.field)"
              :data-field="col.field"
              :data-row-index="i"
              data-section="body"
              @mousedown="(e) => handleMouseDown(e, i, col.field)"
              @mouseover="handleMouseOver(i, col.field)"
              @dblclick="(e) => startCellInlineEdit(e, i, col.field)"
            >
              <template
                v-if="
                  canDragTableElement &&
                  !isInlineEditingCurrentCell(i, col.field)
                "
              >
                <div
                  class="absolute inset-x-0 top-0 z-10 cursor-move"
                  :style="{ height: `${TABLE_BODY_DRAG_HANDLE_EDGE_SIZE}px` }"
                ></div>
                <div
                  v-if="!shouldShowBodyRowResizeHandle(i)"
                  class="absolute inset-x-0 bottom-0 z-10 cursor-move"
                  :style="{ height: `${TABLE_BODY_DRAG_HANDLE_EDGE_SIZE}px` }"
                ></div>
                <div
                  class="absolute inset-y-0 left-0 z-10 cursor-move"
                  :style="{ width: `${TABLE_BODY_DRAG_HANDLE_EDGE_SIZE}px` }"
                ></div>
                <div
                  v-if="!shouldShowBodyColumnResizeHandle(i, colIndex)"
                  class="absolute inset-y-0 right-0 z-10 cursor-move"
                  :style="{ width: `${TABLE_BODY_DRAG_HANDLE_EDGE_SIZE}px` }"
                ></div>
              </template>
              <div
                v-if="shouldShowBodyColumnResizeHandle(i, colIndex)"
                :class="[
                  columnResizeHandleClass,
                  { 'bg-blue-400 opacity-100': resizingColIndex === colIndex },
                ]"
                @mousedown="(e) => handleResizeStart(e, colIndex)"
                @click.stop
              ></div>
              <div
                v-if="shouldShowBodyRowResizeHandle(i)"
                :class="[
                  rowResizeHandleClass,
                  { 'bg-blue-400 opacity-100': isResizingRow('body', i) },
                ]"
                @mousedown="(e) => handleRowResizeStart(e, 'body', i, row)"
                @click.stop
              ></div>
              <textarea
                v-if="isInlineEditingCurrentCell(i, col.field)"
                ref="inlineEditorRef"
                v-model="inlineEditingValue"
                class="w-full h-full min-h-[20px] resize-none border-0 bg-transparent p-0 text-inherit outline-none"
                @mousedown.stop
                @keydown="handleInlineCellEditorKeydown"
                @keyup.stop
                @blur="commitCellInlineEdit"
              ></textarea>
              <template v-else>
                <span :style="getCellTextLayerStyle(i, col.field, 'body')">
                  {{ getCellValue(row, col.field) }}
                </span>
              </template>
            </td>
          </template>
        </tr>
        <tr v-if="shouldOmitBodyRowsInDesign">
          <td
            :colspan="processedData.columns.length"
            class="p-1 text-center text-gray-500 select-none"
            :style="{
              ...cellStyle,
              height: hasCustomRowHeight
                ? `${element.style.rowHeight}px`
                : undefined,
              paddingTop: hasCustomRowHeight ? '0px' : undefined,
              paddingBottom: hasCustomRowHeight ? '0px' : undefined,
              lineHeight: hasCustomRowHeight
                ? `${element.style.rowHeight}px`
                : undefined,
              overflow: hasCustomRowHeight ? 'hidden' : undefined,
            }"
          >
            ...
          </td>
        </tr>
        <!-- Spacer Row to push footer to bottom in design mode -->
        <tr
          v-if="shouldRenderDesignSpacerRow"
          class="h-full bg-transparent"
          data-table-spacer-row="true"
        >
          <td
            :colspan="processedData.columns.length || 1"
            class="p-0"
            :class="{ 'border-none': !shouldShowBodyFooterConnectorBorder }"
            :style="shouldShowBodyFooterConnectorBorder ? cellStyle : undefined"
          ></td>
        </tr>
      </tbody>
      <tfoot v-if="element.showFooter">
        <tr v-for="(row, i) in processedData.footerData" :key="i">
          <template
            v-for="(col, colIndex) in processedData.columns"
            :key="col.field"
          >
            <td
              v-if="shouldRenderCell(row, col.field)"
              class="relative p-1 text-sm font-bold select-none"
              :class="{
                '!bg-blue-100 ring-1 ring-blue-400':
                  isCellSelected(i, col.field, 'footer') &&
                  !isInlineEditingCurrentCell(i, col.field, 'footer'),
                '!bg-blue-50 ring-1 ring-blue-300': isVariableDropCellHovered(
                  i,
                  col.field,
                  'footer',
                ),
              }"
              :style="{
                ...cellStyle,
                height: hasCustomFooterHeight
                  ? `${element.style.footerHeight}px`
                  : undefined,
                paddingTop: hasCustomFooterHeight ? '0px' : undefined,
                paddingBottom: hasCustomFooterHeight ? '0px' : undefined,
                lineHeight: hasCustomFooterHeight
                  ? `${element.style.footerHeight}px`
                  : undefined,
                overflow:
                  shouldShowFooterColumnResizeHandle(i, colIndex) ||
                  shouldShowFooterRowResizeHandle(i)
                    ? 'visible'
                    : hasRenderedRowHeight('footer', i, row)
                      ? 'hidden'
                      : undefined,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                backgroundColor:
                  element.style.footerBackgroundColor || '#f9fafb',
                color: element.style.footerColor || '#000000',
                fontSize: element.style.footerFontSize
                  ? `${element.style.footerFontSize}px`
                  : undefined,
                textAlign: element.style.footerTextAlign || 'left',
                cursor:
                  store.selectedElementId === element.id
                    ? 'pointer'
                    : 'default',
                ...getCellStyle(row, col.field),
                ...getRowHeightCellStyle('footer', i, row),
                ...getCellTextPositionStyle(i, col.field, 'footer'),
              }"
              :rowspan="getRowSpan(row, col.field)"
              :colspan="getColSpan(row, col.field)"
              :data-field="col.field"
              :data-row-index="i"
              data-section="footer"
              :data-value="getPrintValue(row, col.field)"
              @mousedown="(e) => handleMouseDown(e, i, col.field, 'footer')"
              @mouseover="handleMouseOver(i, col.field, 'footer')"
              @dblclick="(e) => handleFooterDblClick(e, i, col.field)"
            >
              <div
                v-if="shouldShowFooterColumnResizeHandle(i, colIndex)"
                :class="[
                  columnResizeHandleClass,
                  { 'bg-blue-400 opacity-100': resizingColIndex === colIndex },
                ]"
                @mousedown="(e) => handleResizeStart(e, colIndex)"
                @click.stop
              ></div>
              <div
                v-if="shouldShowFooterRowResizeHandle(i)"
                :class="[
                  rowResizeHandleClass,
                  { 'bg-blue-400 opacity-100': isResizingRow('footer', i) },
                ]"
                @mousedown="(e) => handleRowResizeStart(e, 'footer', i, row)"
                @click.stop
              ></div>
              <textarea
                v-if="isInlineEditingCurrentCell(i, col.field, 'footer')"
                ref="inlineEditorRef"
                v-model="inlineEditingValue"
                class="w-full h-full min-h-[20px] resize-none border-0 bg-transparent p-0 text-inherit outline-none"
                @mousedown.stop
                @keydown="handleInlineCellEditorKeydown"
                @keyup.stop
                @blur="commitCellInlineEdit"
              ></textarea>
              <template v-else>
                <span :style="getCellTextLayerStyle(i, col.field, 'footer')">
                  {{ getCellValue(row, col.field) }}
                </span>
              </template>
            </td>
          </template>
        </tr>
      </tfoot>
    </table>
    <div
      v-if="shouldRenderTableOuterEdge"
      class="absolute inset-0 box-border pointer-events-none"
      :style="tableOuterEdgeStyle"
    ></div>

    <!-- Header Edit Form -->
    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="editingColIndex !== null || editingFooterCell"
        ref="editFormRef"
        class="fixed z-[9999] bg-white shadow-xl border border-gray-200 rounded-lg p-4 w-64 flex flex-col gap-3 pointer-events-auto"
        :style="{
          top: `${editFormPosition.top}px`,
          left: `${editFormPosition.left}px`,
        }"
        @click.stop
      >
        <h4 class="text-sm font-semibold text-gray-700">
          {{
            editingFooterCell
              ? t("properties.label.editCell")
              : t("properties.label.editColumn")
          }}
        </h4>

        <template v-if="editingColIndex !== null">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">{{
              t("properties.label.headerText")
            }}</label>
            <input
              v-model="editForm.header"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              :placeholder="t('properties.label.headerNamePlaceholder')"
              @keydown.enter="saveHeaderEdit"
              autofocus
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">{{
              t("properties.label.fieldKey")
            }}</label>
            <input
              v-model="editForm.field"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              :placeholder="t('properties.label.fieldKey')"
              @keydown.enter="saveHeaderEdit"
            />
          </div>
        </template>

        <template v-if="editingFooterCell">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">{{
              t("properties.label.content")
            }}</label>
            <input
              v-model="editForm.value"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              :placeholder="t('properties.label.displayTextPlaceholder')"
              @keydown.enter="saveHeaderEdit"
              autofocus
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">{{
              t("properties.label.variableField")
            }}</label>
            <input
              v-model="editForm.variable"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              :placeholder="t('properties.label.dataFieldPlaceholder')"
              @keydown.enter="saveHeaderEdit"
            />
          </div>
        </template>

        <div class="flex justify-end gap-2 mt-1">
          <button
            @click="closeEditForm"
            class="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            @click="saveHeaderEdit"
            class="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            {{ t("common.save") }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
