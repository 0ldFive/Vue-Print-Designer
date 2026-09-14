<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "@/locales";
import type { TableColumn, TableFooterRow } from "@/types";
import PropertyCode from "@/components/properties/PropertyCode.vue";
import DragIndicator from "~icons/material-symbols/drag-indicator";
import AddIcon from "~icons/material-symbols/add";
import ContentCopy from "~icons/material-symbols/content-copy";
import DeleteIcon from "~icons/material-symbols/delete";
import MoveUpIcon from "~icons/material-symbols/arrow-upward";
import MoveDownIcon from "~icons/material-symbols/arrow-downward";
import TuneIcon from "~icons/material-symbols/tune";
import OpenInFullIcon from "~icons/material-symbols/open-in-full";
import TableRowsIcon from "~icons/material-symbols/table-rows";
import DataObjectIcon from "~icons/material-symbols/data-object";
import CellMergeIcon from "~icons/material-symbols/cell-merge";
import GridViewOutline from "~icons/material-symbols/grid-view-outline";
import CloseIcon from "~icons/material-symbols/close";

const props = defineProps<{
  label: string;
  rows: TableFooterRow[];
  /** Table columns, used for per-cell labels and the variable field suggestions. */
  columns: TableColumn[];
  disabled?: boolean;
}>();

const emit = defineEmits(["update:rows"]);

const { t } = useI18n();

type EditMode = "visual" | "json";
const mode = ref<EditMode>("visual");
const jsonText = ref("");
const jsonError = ref("");

// ---------- mode switching with bidirectional sync ----------
const switchMode = (next: EditMode) => {
  if (props.disabled || next === mode.value) return;
  if (next === "json") {
    jsonText.value = JSON.stringify(props.rows || [], null, 2);
    jsonError.value = "";
  }
  // Switching back to visual: current element rows are the source of truth.
  // Invalid JSON text is discarded (never overwrites existing rows).
  mode.value = next;
};

const handleJsonChange = (value: string) => {
  jsonText.value = value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      jsonError.value = "";
      emit("update:rows", parsed);
      return;
    }
    jsonError.value = t("properties.label.footerRowsJsonNotArray");
  } catch {
    jsonError.value = t("common.invalidJson");
  }
};

// ---------- visual editing ----------
// Footer cells are keyed by column field; hidden columns are not editable.
const cellColumns = computed(() =>
  (props.columns || []).filter((col) => !col.hidden),
);

const fieldSuggestions = computed(() =>
  Array.from(
    new Set((props.columns || []).map((col) => col.field).filter(Boolean)),
  ),
);

const emitRows = (next: TableFooterRow[]) => {
  emit("update:rows", next);
};

const cloneRows = (): TableFooterRow[] =>
  JSON.parse(JSON.stringify(props.rows || []));

const getCellValue = (row: any, field: string): string => {
  const raw = row?.[field];
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "object") return raw.value ?? "";
  return String(raw);
};

const getCellVariable = (row: any, field: string): string => {
  const raw = row?.[field];
  if (raw && typeof raw === "object") return raw.field ?? "";
  return "";
};

// ---------- merge helpers ----------
// A merged region is described by its top-left cell ({ rowSpan, colSpan } > 1);
// every other cell in the region is marked with rowSpan/colSpan = 0 and is not rendered.
const isCoveredCell = (row: any, field: string): boolean => {
  const raw = row?.[field];
  return (
    !!raw &&
    typeof raw === "object" &&
    (raw.rowSpan === 0 || raw.colSpan === 0)
  );
};

const isMergedCell = (row: any, field: string): boolean => {
  const raw = row?.[field];
  return (
    !!raw &&
    typeof raw === "object" &&
    ((raw.rowSpan ?? 1) > 1 || (raw.colSpan ?? 1) > 1)
  );
};

/** Cells actually rendered for a row: hidden columns and merge-covered cells are excluded. */
const visibleCells = (row: any): TableColumn[] =>
  cellColumns.value.filter((col) => !isCoveredCell(row, col.field));

/** Keep the JSON tidy: a cell that only carries display text stays a plain string. */
const collapseCell = (row: Record<string, any>, field: string) => {
  const cell = row[field];
  if (!cell || typeof cell !== "object") return;
  const keys = Object.keys(cell).filter((key) => cell[key] !== undefined);
  if (keys.length === 1 && keys[0] === "value") row[field] = cell.value ?? "";
};

const updateCell = (
  rowIndex: number,
  colField: string,
  patch: { value?: string; variable?: string },
) => {
  const next = cloneRows();
  const row = next[rowIndex];
  if (!row) return;

  const raw = row[colField];
  const cell: Record<string, any> =
    raw && typeof raw === "object" ? { ...raw } : { value: raw ?? "" };

  if (patch.value !== undefined) cell.value = patch.value;
  if (patch.variable !== undefined) {
    if (patch.variable) cell.field = patch.variable;
    else delete cell.field;
  }

  row[colField] = cell;
  collapseCell(row, colField);

  emitRows(next);
};

// ---------- cell selection (for merging) ----------
// Selection is tracked per (row, column field) so a region can span multiple footer rows.
const selectedCells = ref<{ row: number; field: string }[]>([]);

const isCellSelected = (rowIndex: number, field: string) =>
  selectedCells.value.some((c) => c.row === rowIndex && c.field === field);

const toggleCellSelect = (rowIndex: number, field: string) => {
  selectedCells.value = isCellSelected(rowIndex, field)
    ? selectedCells.value.filter(
        (c) => !(c.row === rowIndex && c.field === field),
      )
    : [...selectedCells.value, { row: rowIndex, field }];
};

const clearSelection = () => {
  selectedCells.value = [];
};

const canMergeSelection = computed(() => selectedCells.value.length >= 2);

const addRow = () => {
  clearSelection();
  emitRows([...(props.rows || []), {}]);
};

const duplicateRow = (index: number) => {
  const next = cloneRows();
  const source = next[index];
  if (!source) return;
  clearSelection();
  next.splice(index + 1, 0, JSON.parse(JSON.stringify(source)));
  emitRows(next);
};

const removeRow = (index: number) => {
  clearSelection();
  emitRows((props.rows || []).filter((_, i) => i !== index));
};

const moveRow = (index: number, offset: number) => {
  const target = index + offset;
  if (target < 0 || target >= (props.rows || []).length) return;
  const next = [...(props.rows || [])];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  clearSelection();
  emitRows(next);
};

// ---------- merge / split footer cells ----------
/** Column indices use the full column list so panel merges match canvas merges. */
const allColumnFields = computed(() =>
  (props.columns || []).map((col) => col.field),
);

const mergeSelectedCells = () => {
  const cells = selectedCells.value;
  if (cells.length < 2) return;

  const colFields = allColumnFields.value;
  const colIndexes = cells.map((c) => colFields.indexOf(c.field));
  if (colIndexes.some((i) => i === -1)) return;

  const rowIndexes = cells.map((c) => c.row);
  const minRow = Math.min(...rowIndexes);
  const maxRow = Math.max(...rowIndexes);
  const minCol = Math.min(...colIndexes);
  const maxCol = Math.max(...colIndexes);
  const rowSpan = maxRow - minRow + 1;
  const colSpan = maxCol - minCol + 1;

  const next = cloneRows();
  for (let r = minRow; r <= maxRow; r++) {
    if (!next[r]) next[r] = {};
    for (let c = minCol; c <= maxCol; c++) {
      const field = colFields[c];
      const raw = next[r][field];
      const cell: Record<string, any> =
        raw && typeof raw === "object" ? { ...raw } : { value: raw ?? "" };

      if (r === minRow && c === minCol) {
        cell.rowSpan = rowSpan;
        cell.colSpan = colSpan;
      } else {
        // Covered cells are not rendered; keep their binding so a later split restores it.
        cell.rowSpan = 0;
        cell.colSpan = 0;
        cell.value = "";
      }
      next[r][field] = cell;
    }
  }

  clearSelection();
  emitRows(next);
};

const splitCell = (rowIndex: number, field: string) => {
  const next = cloneRows();
  const raw = next[rowIndex]?.[field];
  if (!raw || typeof raw !== "object") return;

  const rowSpan = raw.rowSpan || 1;
  const colSpan = raw.colSpan || 1;
  if (rowSpan <= 1 && colSpan <= 1) return;

  const colFields = allColumnFields.value;
  const startCol = colFields.indexOf(field);
  if (startCol === -1) return;

  for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
    const row = next[r];
    if (!row) continue;
    for (let c = startCol; c < startCol + colSpan; c++) {
      const target = row[colFields[c]];
      if (!target || typeof target !== "object") continue;
      delete target.rowSpan;
      delete target.colSpan;
      collapseCell(row, colFields[c]);
    }
  }

  clearSelection();
  emitRows(next);
};

// ---------- drag reorder (HTML5) ----------
const dragIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null);

const onDragStart = (index: number) => {
  dragIndex.value = index;
};
const onDragOver = (index: number, e: DragEvent) => {
  if (dragIndex.value === null || dragIndex.value === index) return;
  e.preventDefault();
  dropIndex.value = index;
};
const onDrop = (index: number) => {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null;
    dropIndex.value = null;
    return;
  }
  const next = [...(props.rows || [])];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, moved);
  dragIndex.value = null;
  dropIndex.value = null;
  clearSelection();
  emitRows(next);
};
const onDragEnd = () => {
  dragIndex.value = null;
  dropIndex.value = null;
};

// ---------- cell editor (collapsed per row) ----------
const expandedIndexes = ref<number[]>([]);

const isExpanded = (index: number) => expandedIndexes.value.includes(index);

const toggleExpand = (index: number) => {
  expandedIndexes.value = isExpanded(index)
    ? expandedIndexes.value.filter((i) => i !== index)
    : [...expandedIndexes.value, index];
};

// The JSON editor renders its own title bar hidden; its expand modal is triggered
// from the panel header instead.
const jsonEditorRef = ref<{ toggleExpand: () => void } | null>(null);

const expandJsonEditor = () => {
  jsonEditorRef.value?.toggleExpand();
};
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex justify-between items-center">
      <label class="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {{ label }}
        <span class="text-gray-400">({{ rows.length }})</span>
      </label>
      <div class="flex items-center gap-1">
        <button
          v-if="mode === 'json'"
          type="button"
          :disabled="disabled"
          class="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('properties.label.expandEditor')"
          @click="expandJsonEditor"
        >
          <OpenInFullIcon class="w-3.5 h-3.5" />
        </button>
        <div
          class="flex items-center rounded border border-gray-300 dark:border-gray-600 overflow-hidden"
        >
          <button
            type="button"
            :disabled="disabled"
            @click="switchMode('visual')"
            class="p-1 transition-colors disabled:cursor-not-allowed"
            :class="
              mode === 'visual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
            :title="t('properties.label.visualMode')"
          >
            <TableRowsIcon class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            :disabled="disabled"
            @click="switchMode('json')"
            class="p-1 transition-colors disabled:cursor-not-allowed"
            :class="
              mode === 'json'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
            :title="t('properties.label.jsonMode')"
          >
            <DataObjectIcon class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Visual mode -->
    <div v-if="mode === 'visual'" class="flex flex-col gap-1.5">
      <datalist id="table-footer-field-suggestions">
        <option v-for="s in fieldSuggestions" :key="s" :value="s" />
      </datalist>

      <!-- 勾选单元格后出现的合并操作栏 -->
      <div
        v-if="selectedCells.length > 0"
        class="flex items-center gap-1 px-1.5 py-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
      >
        <span
          class="flex-1 min-w-0 text-[10px] text-blue-600 dark:text-blue-300 truncate"
        >
          {{
            t("properties.label.selectedCellsCount", {
              n: selectedCells.length,
            })
          }}
        </span>
        <button
          type="button"
          :disabled="disabled || !canMergeSelection"
          class="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('editor.mergeCells')"
          @click="mergeSelectedCells"
        >
          <CellMergeIcon class="w-3.5 h-3.5" />
          {{ t("editor.mergeCells") }}
        </button>
        <button
          type="button"
          :disabled="disabled"
          class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          :title="t('properties.label.clearSelection')"
          @click="clearSelection"
        >
          <CloseIcon class="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        v-if="rows.length === 0"
        class="text-xs text-gray-400 dark:text-gray-500 px-2 py-3 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded"
      >
        {{ t("properties.label.noFooterRows") }}
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <div
          v-for="(row, index) in rows"
          :key="index"
          class="border rounded px-1.5 py-1 flex flex-col gap-1 transition-colors"
          :class="[
            dropIndex === index && dragIndex !== null
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700',
            dragIndex === index ? 'opacity-50' : '',
          ]"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover="(e) => onDragOver(index, e)"
          @drop="onDrop(index)"
          @dragend="onDragEnd"
        >
          <!-- 常驻单行：拖拽把手 / 行序号 / 单元格设置 -->
          <div class="flex items-center gap-1">
            <DragIndicator
              class="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0"
              :class="{ 'cursor-grabbing': dragIndex === index }"
            />
            <span
              class="flex-1 min-w-0 text-xs text-gray-600 dark:text-gray-300 truncate"
            >
              {{
                t("properties.label.footerRowIndex", { n: index + 1 })
              }}
            </span>
            <button
              type="button"
              :disabled="disabled"
              class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              :class="
                isExpanded(index)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              "
              :title="t('properties.label.editCell')"
              @click="toggleExpand(index)"
            >
              <TuneIcon class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 折叠区：每个列一个单元格的显示文本 + 变量字段 / 行操作 -->
          <div
            v-if="isExpanded(index)"
            class="flex flex-col gap-1.5 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700"
          >
            <div
              v-for="col in visibleCells(row)"
              :key="col.field"
              class="flex flex-col gap-0.5 rounded px-1 py-0.5 -mx-1 transition-colors"
              :class="
                isCellSelected(index, col.field)
                  ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                  : ''
              "
            >
              <div class="flex items-center gap-1">
                <input
                  type="checkbox"
                  :checked="isCellSelected(index, col.field)"
                  :disabled="disabled"
                  class="accent-blue-600 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  :title="t('properties.label.selectCell')"
                  @change="toggleCellSelect(index, col.field)"
                />
                <span class="flex-1 min-w-0 text-[10px] text-gray-400 truncate">
                  {{ col.header || col.field }}
                </span>
                <button
                  v-if="isMergedCell(row, col.field)"
                  type="button"
                  :disabled="disabled"
                  class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  :title="t('editor.splitCells')"
                  @click="splitCell(index, col.field)"
                >
                  <GridViewOutline class="w-3 h-3" />
                </button>
              </div>
              <div class="flex items-center gap-1">
                <input
                  type="text"
                  :value="getCellValue(row, col.field)"
                  :disabled="disabled"
                  :placeholder="t('properties.label.footerCellText')"
                  class="w-0 flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  @change="
                    (e) =>
                      updateCell(index, col.field, {
                        value: (e.target as HTMLInputElement).value,
                      })
                  "
                />
                <input
                  type="text"
                  :value="getCellVariable(row, col.field)"
                  :disabled="disabled"
                  list="table-footer-field-suggestions"
                  :placeholder="t('properties.label.footerCellVariable')"
                  class="w-0 flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  @change="
                    (e) =>
                      updateCell(index, col.field, {
                        variable: (e.target as HTMLInputElement).value.trim(),
                      })
                  "
                />
              </div>
            </div>
            <div
              v-if="cellColumns.length === 0"
              class="text-[10px] text-gray-400 dark:text-gray-500"
            >
              {{ t("properties.label.noColumns") }}
            </div>

            <div class="flex items-center justify-end gap-0.5">
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.footerRowMoveUp')"
                @click="moveRow(index, -1)"
              >
                <MoveUpIcon class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.footerRowMoveDown')"
                @click="moveRow(index, 1)"
              >
                <MoveDownIcon class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.duplicateFooterRow')"
                @click="duplicateRow(index)"
              >
                <ContentCopy class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.deleteFooterRow')"
                @click="removeRow(index)"
              >
                <DeleteIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        :disabled="disabled"
        class="flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        @click="addRow"
      >
        <AddIcon class="w-3.5 h-3.5" />
        {{ t("properties.label.addFooterRow") }}
      </button>
    </div>

    <!-- JSON mode -->
    <div v-else class="flex flex-col gap-1">
      <PropertyCode
        ref="jsonEditorRef"
        :label="label"
        language="json"
        :disabled="disabled"
        :height="180"
        :show-header="false"
        :value="jsonText"
        @update:value="handleJsonChange"
      />
      <div
        v-if="jsonError"
        class="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1"
      >
        {{ jsonError }}
      </div>
      <div v-else class="text-[10px] text-gray-400 dark:text-gray-500">
        {{ t("properties.label.footerRowsJsonSynced") }}
      </div>
    </div>
  </div>
</template>
