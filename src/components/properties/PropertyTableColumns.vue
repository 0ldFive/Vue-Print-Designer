<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { toast } from "@/utils/toast";
import { normalizeVariableKey } from "@/utils/variables";
import type { TableColumn } from "@/types";
import PropertyCode from "@/components/properties/PropertyCode.vue";
import DragIndicator from "~icons/material-symbols/drag-indicator";
import AddIcon from "~icons/material-symbols/add";
import ContentCopy from "~icons/material-symbols/content-copy";
import DeleteIcon from "~icons/material-symbols/delete";
import MoveUpIcon from "~icons/material-symbols/arrow-upward";
import MoveDownIcon from "~icons/material-symbols/arrow-downward";
import AutoFixHigh from "~icons/material-symbols/auto-fix-high";
import HorizontalDistribute from "~icons/material-symbols/horizontal-distribute";
import TuneIcon from "~icons/material-symbols/tune";
import OpenInFullIcon from "~icons/material-symbols/open-in-full";
import ViewColumnIcon from "~icons/material-symbols/view-column";
import DataObjectIcon from "~icons/material-symbols/data-object";

const props = defineProps<{
  label: string;
  columns: TableColumn[];
  disabled?: boolean;
  /** Data variable of the table element (e.g. "@rows"), used for column inference. */
  dataVariable?: string;
  /** Design-time rows of the table element, used as inference source when no data variable is bound. */
  elementData?: Record<string, any>[];
}>();

const emit = defineEmits(["update:columns"]);

const { t } = useI18n();
const store = useDesignerStore();

type EditMode = "visual" | "json";
const mode = ref<EditMode>("visual");
const jsonText = ref("");
const jsonError = ref("");

// ---------- mode switching with bidirectional sync ----------
const switchMode = (next: EditMode) => {
  if (props.disabled || next === mode.value) return;
  if (next === "json") {
    jsonText.value = JSON.stringify(props.columns || [], null, 2);
    jsonError.value = "";
  }
  // Switching back to visual: current element columns are the source of truth.
  // Invalid JSON text is discarded (never overwrites existing columns).
  mode.value = next;
};

const handleJsonChange = (value: string) => {
  jsonText.value = value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      jsonError.value = "";
      emit("update:columns", parsed);
      return;
    }
    jsonError.value = t("properties.label.columnsJsonNotArray");
  } catch {
    jsonError.value = t("common.invalidJson");
  }
};

// ---------- visual editing ----------
const emitColumns = (next: TableColumn[]) => {
  emit("update:columns", next);
};

const updateColumn = (index: number, patch: Partial<TableColumn>) => {
  const next = props.columns.map((col, i) =>
    i === index ? { ...col, ...patch } : col,
  );
  emitColumns(next);
};

const addColumn = () => {
  const next = [
    ...props.columns,
    { field: "", header: "", width: 80 },
  ];
  emitColumns(next);
};

const duplicateColumn = (index: number) => {
  const source = props.columns[index];
  const copy: TableColumn = { ...source, field: `${source.field || "field"}_copy` };
  const next = [...props.columns];
  next.splice(index + 1, 0, copy);
  emitColumns(next);
};

const removeColumn = (index: number) => {
  const next = props.columns.filter((_, i) => i !== index);
  emitColumns(next);
};

const moveColumn = (index: number, offset: number) => {
  const target = index + offset;
  if (target < 0 || target >= props.columns.length) return;
  const next = [...props.columns];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  emitColumns(next);
};

// Distribute the current total width evenly across all columns.
const equalizeWidths = () => {
  if (props.columns.length === 0) return;
  const total = props.columns.reduce((sum, col) => sum + (col.width || 0), 0);
  const fallback = 80 * props.columns.length;
  const base = total > 0 ? total : fallback;
  const even = Math.max(1, Math.round(base / props.columns.length));
  emitColumns(props.columns.map((col) => ({ ...col, width: even })));
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
  const next = [...props.columns];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, moved);
  dragIndex.value = null;
  dropIndex.value = null;
  emitColumns(next);
};
const onDragEnd = () => {
  dragIndex.value = null;
  dropIndex.value = null;
};

// ---------- advanced options (collapsed per card) ----------
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

// ---------- field suggestions ----------
const flattenVariableLeaves = (
  items: { label: string; children?: any[] }[] | undefined,
  acc: string[],
) => {
  if (!items) return;
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      flattenVariableLeaves(item.children, acc);
    } else {
      acc.push(item.label);
    }
  }
};

const fieldSuggestions = computed((): string[] => {
  const suggestions: string[] = [];
  // testData keys
  if (store.testData && typeof store.testData === "object") {
    suggestions.push(...Object.keys(store.testData));
  }
  // available variable leaves
  const leaves: string[] = [];
  flattenVariableLeaves(
    (store as any).availableVariables as any,
    leaves,
  );
  suggestions.push(...leaves);
  // first row keys of bound data variable (design mode uses testData)
  const rows = resolveDataRows();
  if (rows.length > 0) {
    suggestions.push(...Object.keys(rows[0] || {}));
  }
  return Array.from(new Set(suggestions)).filter(Boolean).slice(0, 100);
});

// ---------- infer columns from data ----------
// Preferred source: rows of the bound data variable. Fallback: the element's own
// design-time rows (only when no data variable is bound, since those mirror the
// design snapshot rather than the variable's shape).
const resolveFirstRow = (): Record<string, any> | null => {
  const variable = props.dataVariable || "";
  if (variable) {
    const key = normalizeVariableKey(variable);
    const rows = key ? (store.testData as any)?.[key] : undefined;
    if (Array.isArray(rows) && rows.length > 0) return rows[0] || {};
    return null;
  }
  const rows = props.elementData;
  if (Array.isArray(rows) && rows.length > 0) return rows[0] || {};
  return null;
};

const resolveDataRows = (): any[] => {
  const firstRow = resolveFirstRow();
  return firstRow ? [firstRow] : [];
};

const inferColumns = () => {
  const firstRow = resolveFirstRow();
  if (!firstRow) {
    toast.error(t("toast.columnsInferNoData"));
    return;
  }
  const keys = Object.keys(firstRow);
  if (keys.length === 0) {
    toast.error(t("toast.columnsInferNoData"));
    return;
  }
  const existingFields = new Set(props.columns.map((c) => c.field));
  const newKeys = keys.filter((k) => !existingFields.has(k));
  if (newKeys.length === 0) {
    toast.info(t("toast.columnsInferNoNew"));
    return;
  }
  const newColumns: TableColumn[] = newKeys.map((key) => ({
    field: key,
    header: key,
    width: 80,
  }));
  emitColumns([...props.columns, ...newColumns]);
  toast.info(t("toast.columnsInferred", { n: newColumns.length }));
};

const alignOptions = [
  { label: t("properties.option.left"), value: "left" },
  { label: t("properties.option.center"), value: "center" },
  { label: t("properties.option.right"), value: "right" },
];
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex justify-between items-center">
      <label class="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {{ label }}
        <span class="text-gray-400">({{ columns.length }})</span>
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
          <ViewColumnIcon class="w-3.5 h-3.5" />
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
      <datalist id="table-column-field-suggestions">
        <option v-for="s in fieldSuggestions" :key="s" :value="s" />
      </datalist>

      <div
        v-if="columns.length === 0"
        class="text-xs text-gray-400 dark:text-gray-500 px-2 py-3 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded"
      >
        {{ t("properties.label.noColumns") }}
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <div
          v-for="(col, index) in columns"
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
          <!-- 常驻单行：拖拽把手 / 表头 / 隐藏 / 高级设置 -->
          <div class="flex items-center gap-1">
            <DragIndicator
              class="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0"
              :class="{ 'cursor-grabbing': dragIndex === index }"
            />
            <input
              type="text"
              :value="col.header"
              :disabled="disabled"
              :placeholder="t('properties.label.columnHeader')"
              class="flex-1 min-w-[70px] px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              @change="
                (e) =>
                  updateColumn(index, {
                    header: (e.target as HTMLInputElement).value,
                  })
              "
            />
            <input
              type="checkbox"
              :checked="!col.hidden"
              :disabled="disabled"
              class="accent-blue-600 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
              :title="t('properties.label.columnVisible')"
              @change="
                (e) =>
                  updateColumn(index, {
                    hidden: (e.target as HTMLInputElement).checked
                      ? undefined
                      : true,
                  })
              "
            />
            <button
              type="button"
              :disabled="disabled"
              class="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              :class="
                isExpanded(index)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              "
              :title="t('properties.label.columnAdvanced')"
              @click="toggleExpand(index)"
            >
              <TuneIcon class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 折叠区：字段 / 宽度 / 列对齐 / 隐藏 / 行操作 -->
          <div
            v-if="isExpanded(index)"
            class="flex flex-col gap-1 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-1">
              <label class="text-[10px] text-gray-400 flex-shrink-0 w-9">{{
                t("properties.label.columnField")
              }}</label>
              <input
                type="text"
                :value="col.field"
                :disabled="disabled"
                list="table-column-field-suggestions"
                class="flex-1 min-w-[70px] px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                @change="
                  (e) =>
                    updateColumn(index, {
                      field: (e.target as HTMLInputElement).value.trim(),
                    })
                "
              />
            </div>
            <div class="flex items-center gap-1">
              <label class="text-[10px] text-gray-400 flex-shrink-0 w-9">{{
                t("common.width")
              }}</label>
              <input
                type="number"
                :value="col.width"
                :disabled="disabled"
                min="1"
                step="1"
                class="w-0 flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                @change="
                  (e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    updateColumn(index, {
                      width: Number.isFinite(v) && v > 0 ? v : col.width,
                    });
                  }
                "
              />
            </div>
            <div class="flex items-center gap-1">
              <label class="text-[10px] text-gray-400 flex-shrink-0 w-9">{{
                t("properties.label.columnAlign")
              }}</label>
              <select
                :value="col.align || ''"
                :disabled="disabled"
                class="w-0 flex-1 min-w-0 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                @change="
                  (e) =>
                    updateColumn(index, {
                      align: ((e.target as HTMLSelectElement).value ||
                        undefined) as TableColumn['align'],
                    })
                "
              >
                <option value="">{{ t("properties.option.default") }}</option>
                <option
                  v-for="opt in alignOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center justify-end gap-0.5">
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.columnMoveUp')"
                @click="moveColumn(index, -1)"
              >
                <MoveUpIcon class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.columnMoveDown')"
                @click="moveColumn(index, 1)"
              >
                <MoveDownIcon class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.duplicateColumn')"
                @click="duplicateColumn(index)"
              >
                <ContentCopy class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :disabled="disabled"
                class="p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                :title="t('properties.label.deleteColumn')"
                @click="removeColumn(index)"
              >
                <DeleteIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-1.5">
        <button
          type="button"
          :disabled="disabled"
          class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="addColumn"
        >
          <AddIcon class="w-3.5 h-3.5" />
          {{ t("properties.label.addColumn") }}
        </button>
        <button
          type="button"
          :disabled="disabled || columns.length === 0"
          class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          @click="equalizeWidths"
        >
          <HorizontalDistribute class="w-3.5 h-3.5" />
          {{ t("properties.label.equalColumnWidths") }}
        </button>
      </div>
      <button
        type="button"
        :disabled="disabled"
        class="flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        @click="inferColumns"
      >
        <AutoFixHigh class="w-3.5 h-3.5" />
        {{ t("properties.label.inferColumns") }}
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
      <div
        v-else
        class="text-[10px] text-gray-400 dark:text-gray-500"
      >
        {{ t("properties.label.columnsJsonSynced") }}
      </div>
    </div>
  </div>
</template>
