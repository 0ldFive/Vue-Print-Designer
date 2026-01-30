<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';

const props = defineProps<{
  element: PrintElement;
}>();

const store = useDesignerStore();

function isCellSelected(rowIndex: number, colField: string) {
  if (store.tableSelection && store.tableSelection.elementId !== props.element.id) return false;
  return store.tableSelection?.cells.some(c => c.rowIndex === rowIndex && c.colField === colField) ?? false;
}

// Column Resizing Logic
const resizingColIndex = ref<number | null>(null);
const startResizeX = ref(0);
const startResizeWidth = ref(0);
const tempColumnWidths = ref<Record<string, number>>({});

const handleResizeStart = (e: MouseEvent, index: number) => {
  if (store.selectedElementId !== props.element.id) return;
  e.preventDefault();
  e.stopPropagation();
  
  const col = processedData.value.columns[index];
  resizingColIndex.value = index;
  startResizeX.value = e.clientX;
  startResizeWidth.value = col.width || 100;
  
  window.addEventListener('mousemove', handleResizeMove);
  window.addEventListener('mouseup', handleResizeEnd);
};

const handleResizeMove = (e: MouseEvent) => {
  if (resizingColIndex.value === null) return;
  
  const dx = e.clientX - startResizeX.value;
  const newWidth = Math.max(20, startResizeWidth.value + dx); // Min width 20px
  
  const col = processedData.value.columns[resizingColIndex.value];
  tempColumnWidths.value[col.field] = newWidth;
};

const handleResizeEnd = () => {
  if (resizingColIndex.value === null) return;
  
  // Commit changes to store
  const newColumns = processedData.value.columns.map(col => ({
    ...col,
    width: tempColumnWidths.value[col.field] || col.width
  }));
  
  store.updateElement(props.element.id, { columns: newColumns });
  
  // Cleanup
  resizingColIndex.value = null;
  tempColumnWidths.value = {};
  window.removeEventListener('mousemove', handleResizeMove);
  window.removeEventListener('mouseup', handleResizeEnd);
};

// Column Header Editing Logic
const editingColIndex = ref<number | null>(null);
const editForm = ref({ header: '', field: '' });
const editFormPosition = ref({ top: 0, left: 0 });
const editFormRef = ref<HTMLElement | null>(null);

const handleHeaderDblClick = (e: MouseEvent, index: number) => {
  console.log('Double click on header', index, store.selectedElementId, props.element.id);
  if (store.selectedElementId !== props.element.id) {
    console.warn('Element not selected, ignoring double click');
    return;
  }
  
  const col = processedData.value.columns[index];
  console.log('Editing column:', col);
  editingColIndex.value = index;
  editForm.value = { header: col.header, field: col.field };
  
  // Position the form near the mouse cursor
  editFormPosition.value = {
    top: e.clientY + 10,
    left: e.clientX + 10
  };
  
  // Add click outside listener
  setTimeout(() => {
    window.addEventListener('click', handleClickOutside);
  }, 100);
};

const handleClickOutside = (e: MouseEvent) => {
  if (editFormRef.value && !editFormRef.value.contains(e.target as Node)) {
    closeEditForm();
  }
};

const closeEditForm = () => {
  editingColIndex.value = null;
  window.removeEventListener('click', handleClickOutside);
};

const saveHeaderEdit = () => {
  if (editingColIndex.value === null) return;
  
  // Ensure we are updating the source of truth
  const currentColumns = props.element.columns ? [...props.element.columns] : [];
  
  // If we have no columns stored but processedData has them (e.g. from script or defaults),
  // we should initialize the stored columns with the processed ones so we can save edits.
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
      field: editForm.value.field
    };
    
    store.updateElement(props.element.id, { columns: currentColumns });
  }
  
  closeEditForm();
};

const isSelecting = ref(false);
const startCell = ref<{ rowIndex: number; colField: string } | null>(null);

const cellStyle = computed(() => ({
  borderStyle: props.element.style.borderStyle || 'solid',
  borderWidth: props.element.style.borderWidth !== undefined ? `${props.element.style.borderWidth}px` : '1px',
  borderColor: props.element.style.borderColor || '#e5e7eb'
}));

const processedData = computed(() => {
  let data = props.element.data || [];
  let columns = props.element.columns || [];
  let footerData = props.element.footerData || [];

  if (props.element.customScript) {
    try {
      // Safe-ish execution
      const fn = new Function('data', 'columns', 'footerData', props.element.customScript);
      const result = fn(data, columns, footerData);
      if (result) {
        if (result.data) data = result.data;
        // We generally don't expect columns to change, but why not
        if (result.columns) columns = result.columns;
        if (result.footerData) footerData = result.footerData;
      }
    } catch (e) {
      console.error('Custom Script Error:', e);
    }
  }
  return { data, columns, footerData };
});

const getCellValue = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'value' in val) {
    return val.value;
  }
  return val;
};

const getRowSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'rowSpan' in val) {
    return val.rowSpan;
  }
  return 1;
};

const getColSpan = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && 'colSpan' in val) {
    return val.colSpan;
  }
  return 1;
};

const getCellStyle = (row: any, field: string) => {
  const val = row[field];
  const style = { ...cellStyle.value };
  
  if (val && typeof val === 'object' && 'style' in val) {
    Object.assign(style, val.style);
  }
  return style;
};

const shouldRenderCell = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object') {
    if (val.rowSpan === 0 || val.colSpan === 0) return false;
  }
  return true;
};

const handleMouseDown = (e: MouseEvent, rowIndex: number, colField: string) => {
  if (store.selectedElementId !== props.element.id) return;
  e.stopPropagation();
  isSelecting.value = true;
  startCell.value = { rowIndex, colField };
  store.setTableSelection(props.element.id, { rowIndex, colField }, false);
};

const handleMouseOver = (rowIndex: number, colField: string) => {
  if (!isSelecting.value || !startCell.value) return;
  
  const startRow = startCell.value.rowIndex;
  const endRow = rowIndex;
  const startColIdx = processedData.value.columns.findIndex(c => c.field === startCell.value!.colField);
  const endColIdx = processedData.value.columns.findIndex(c => c.field === colField);
  
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
        colField: processedData.value.columns[c].field
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
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp);
});
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'Data & Behavior',
      tab: 'properties',
      fields: [
        { label: 'Auto Paginate', type: 'switch', target: 'element', key: 'autoPaginate' },
        { label: 'Repeat Footer', type: 'switch', target: 'element', key: 'tfootRepeat' },
        { label: 'Show Footer', type: 'switch', target: 'element', key: 'showFooter' },
        { label: 'Variable (@foobar)', type: 'text', target: 'element', key: 'variable', placeholder: '@foobar' },
        { label: 'Columns (JSON)', type: 'textarea', target: 'element', key: 'columns', placeholder: '[{ field: "name", header: "Name", width: 100 }]' },
        { label: 'Data (JSON)', type: 'textarea', target: 'element', key: 'data', placeholder: '[{...}]' },
        { label: 'Footer Data (JSON)', type: 'textarea', target: 'element', key: 'footerData', placeholder: '[{...}]' },
        { label: 'Custom Script', type: 'textarea', target: 'element', key: 'customScript', placeholder: 'return { data: ... };' }
      ]
    },
    {
      title: 'Layout & Dimensions',
      tab: 'style',
      fields: [
        { label: 'Header Height (px)', type: 'number', target: 'style', key: 'headerHeight', min: 20, max: 200, step: 1 },
        { label: 'Row Height (px)', type: 'number', target: 'style', key: 'rowHeight', min: 20, max: 200, step: 1 },
        { label: 'Footer Height (px)', type: 'number', target: 'style', key: 'footerHeight', min: 20, max: 200, step: 1 },
      ]
    },
    {
      title: 'Header Style',
      tab: 'style',
      fields: [
        { label: 'Background', type: 'color', target: 'style', key: 'headerBackgroundColor' },
        { label: 'Text Color', type: 'color', target: 'style', key: 'headerColor' },
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'headerFontSize', min: 8, max: 72, step: 1 }
      ]
    },
    {
      title: 'Footer Style',
      tab: 'style',
      fields: [
        { label: 'Background', type: 'color', target: 'style', key: 'footerBackgroundColor' },
        { label: 'Text Color', type: 'color', target: 'style', key: 'footerColor' },
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'footerFontSize', min: 8, max: 72, step: 1 }
      ]
    },
    {
      title: 'Border',
      tab: 'style',
      fields: [
        { label: 'Border Style', type: 'select', target: 'style', key: 'borderStyle', options: [
            { label: 'None', value: 'none' },
            { label: 'Solid', value: 'solid' },
            { label: 'Dashed', value: 'dashed' },
            { label: 'Dotted', value: 'dotted' }
          ]
        },
        { label: 'Border Width (px)', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'Border Color', type: 'color', target: 'style', key: 'borderColor' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-white">
    <table class="w-full border-collapse" :data-tfoot-repeat="element.tfootRepeat" :data-auto-paginate="element.autoPaginate">
      <thead>
        <tr>
          <th 
            v-for="(col, index) in processedData.columns" 
            :key="col.field"
            class="p-1 text-left font-bold text-sm relative group select-none"
            :style="{ 
               ...cellStyle, 
               width: `${tempColumnWidths[col.field] || col.width}px`, 
               height: element.style.headerHeight ? `${element.style.headerHeight}px` : undefined,
               backgroundColor: element.style.headerBackgroundColor || '#f3f4f6',
              color: element.style.headerColor || '#000000',
              fontSize: element.style.headerFontSize ? `${element.style.headerFontSize}px` : undefined,
              cursor: store.selectedElementId === element.id ? 'pointer' : 'default'
            }"
            @dblclick="(e) => handleHeaderDblClick(e, index)"
          >
            {{ col.header }}
            
            <!-- Resize Handle -->
            <div 
              v-if="store.selectedElementId === element.id"
              class="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 z-10 transition-opacity"
              :class="{ 'bg-blue-400 opacity-100': resizingColIndex === index }"
              @mousedown="(e) => handleResizeStart(e, index)"
              @click.stop
            ></div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in processedData.data" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm select-none"
               :class="{ 'bg-blue-100 ring-1 ring-blue-400': isCellSelected(i, col.field) }"
               :style="{
                 ...getCellStyle(row, col.field),
                 height: element.style.rowHeight ? `${element.style.rowHeight}px` : undefined
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
               @mousedown="(e) => handleMouseDown(e, i, col.field)"
               @mouseover="handleMouseOver(i, col.field)"
             >
               {{ getCellValue(row, col.field) }}
             </td>
          </template>
        </tr>
      </tbody>
      <tfoot v-if="element.showFooter">
        <tr v-for="(row, i) in processedData.footerData" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm font-bold"
                :style="{ 
                  ...getCellStyle(row, col.field), 
                  height: element.style.footerHeight ? `${element.style.footerHeight}px` : undefined,
                  backgroundColor: element.style.footerBackgroundColor || '#f9fafb',
                 color: element.style.footerColor || '#000000',
                 fontSize: element.style.footerFontSize ? `${element.style.footerFontSize}px` : undefined
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
             >
               {{ getCellValue(row, col.field) }}
             </td>
          </template>
        </tr>
      </tfoot>
    </table>
    
    <!-- Header Edit Form -->
    <Teleport to="body">
      <div 
        v-if="editingColIndex !== null" 
        ref="editFormRef"
        class="fixed z-[9999] bg-white shadow-xl border border-gray-200 rounded-lg p-4 w-64 flex flex-col gap-3"
        :style="{ top: `${editFormPosition.top}px`, left: `${editFormPosition.left}px` }"
        @click.stop
      >
        <h4 class="text-sm font-semibold text-gray-700">Edit Column</h4>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-500">Header Text</label>
          <input 
            v-model="editForm.header"
            class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Header Name"
            @keydown.enter="saveHeaderEdit"
            autoFocus
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-gray-500">Field Key</label>
          <input 
            v-model="editForm.field"
            class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Field Key"
            @keydown.enter="saveHeaderEdit"
          />
        </div>
        <div class="flex justify-end gap-2 mt-1">
          <button 
            @click="closeEditForm"
            class="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button 
            @click="saveHeaderEdit"
            class="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            Save
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
