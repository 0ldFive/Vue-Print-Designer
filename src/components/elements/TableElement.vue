<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import cloneDeep from 'lodash/cloneDeep';

const props = defineProps<{
  element: PrintElement;
}>();

const store = useDesignerStore();

function isCellSelected(rowIndex: number, colField: string, section: 'body' | 'footer' = 'body') {
  if (store.tableSelection && store.tableSelection.elementId !== props.element.id) return false;
  return store.tableSelection?.cells.some(c => 
    c.rowIndex === rowIndex && 
    c.colField === colField && 
    (c.section || 'body') === section
  ) ?? false;
}



// Column Header Editing Logic
const editingColIndex = ref<number | null>(null);
const editingFooterCell = ref<{ rowIndex: number; colField: string } | null>(null);
const editForm = ref({ header: '', field: '', value: '', variable: '' });
const editFormPosition = ref({ top: 0, left: 0 });
const editFormRef = ref<HTMLElement | null>(null);

const handleHeaderDblClick = async (e: MouseEvent, index: number) => {
  if (store.selectedElementId !== props.element.id) return;

  const col = processedData.value.columns[index];
  if (!col) return;

  editingColIndex.value = index;
  editingFooterCell.value = null; // Clear footer edit
  editForm.value = { header: col.header, field: col.field, value: '', variable: '' };
  
  editFormPosition.value = {
    top: e.clientY + 10,
    left: e.clientX + 10
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
    window.addEventListener('click', handleClickOutside);
  }, 100);
};

const handleFooterDblClick = async (e: MouseEvent, rowIndex: number, colField: string) => {
  if (store.selectedElementId !== props.element.id) return;
  
  const row = processedData.value.footerData[rowIndex];
  if (!row) return;
  
  const cell = row[colField];
  let value = '';
  let variable = '';

  if (cell && typeof cell === 'object') {
    value = cell.value || '';
    variable = cell.field || '';
  }
  
  editingFooterCell.value = { rowIndex, colField };
  editingColIndex.value = null; // Clear header edit
  editForm.value = { header: '', field: colField, value, variable };
  
  editFormPosition.value = {
    top: e.clientY + 10,
    left: e.clientX + 10
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
  editingFooterCell.value = null;
  window.removeEventListener('click', handleClickOutside);
};

const saveHeaderEdit = () => {
  if (editingColIndex.value !== null) {
      // ... existing header save logic ...
      const currentColumns = props.element.columns ? [...props.element.columns] : [];
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
  } else if (editingFooterCell.value) {
      // Save Footer Edit
      const { rowIndex, colField } = editingFooterCell.value;
      const currentFooterData = props.element.footerData ? JSON.parse(JSON.stringify(props.element.footerData)) : [];
      
      // Ensure row exists
      if (!currentFooterData[rowIndex]) {
         // Should not happen if clicking existing row, but good to be safe
         return;
      }
      
      const row = currentFooterData[rowIndex];
      const val = row[colField];
      
      if (val && typeof val === 'object') {
          val.value = editForm.value.value;
          val.field = editForm.value.variable;
      } else {
          row[colField] = {
              value: editForm.value.value,
              field: editForm.value.variable
          };
      }
      
      store.updateElement(props.element.id, { footerData: currentFooterData });
  }
  
  closeEditForm();
};

const isSelecting = ref(false);
const startCell = ref<{ rowIndex: number; colField: string; section: 'body' | 'footer' } | null>(null);

const processedData = computed(() => {
  const cols = props.element.columns || [];
  let data = props.element.data || [];
  let footerData = props.element.footerData || [];
  
  if (props.element.customScript) {
    try {
      const func = new Function('data', 'footerData', 'columns', 'type', props.element.customScript);
      const result = func(cloneDeep(data), cloneDeep(footerData), cloneDeep(cols), 'global');
      if (result) {
        if (result.data) data = result.data;
        if (result.footerData) footerData = result.footerData;
        if (result.columns) return { ...result, columns: result.columns };
      }
    } catch (e) {
      console.error('Custom script error', e);
    }
  }

  // Calculate footer values based on field variable
  const computedFooterData = cloneDeep(footerData);
  const columnFields = cols.map((c: any) => c.field);
  
  computedFooterData.forEach((row: any) => {
      Object.keys(row).forEach(key => {
          const cell = row[key];
          if (cell && typeof cell === 'object' && cell.field && columnFields.includes(cell.field)) {
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
  
  return { columns: cols, data, footerData: computedFooterData };
});

const cellStyle = computed(() => ({
  fontFamily: props.element.style.fontFamily,
  borderColor: props.element.style.borderColor || '#000',
  borderWidth: (props.element.style.borderWidth || 1) + 'px',
  borderStyle: props.element.style.borderStyle || 'solid',
}));

const getPrintValue = (row: any, field: string) => {
  if (!row) return '';
  const val = row[field];
  if (val && typeof val === 'object') {
    const text = val.value || '';
    // Use printValue (print token) if available, otherwise result, or fallback to empty
    const result = (val.printValue !== undefined) ? val.printValue : (val.result !== undefined ? val.result : '');
    return text + result;
  }
  return val;
};

const getCellValue = (row: any, field: string) => {
  if (!row) return '';
  const val = row[field];
  if (val && typeof val === 'object') {
    const text = val.value || '';
    // Use result (calculated display value) if available, otherwise printValue, or fallback to empty
    const result = (val.result !== undefined) ? val.result : ((val.printValue !== undefined) ? val.printValue : '');
    return text + result;
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

const shouldRenderCell = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object') {
    if (val.rowSpan === 0 || val.colSpan === 0) return false;
  }
  return true;
};

const getCellStyle = (row: any, field: string) => {
  const val = row[field];
  if (val && typeof val === 'object' && val.style) {
      return val.style;
  }
  return {};
};

// Resizing Logic
const tempColumnWidths = ref<Record<string, number>>({});
const resizingColIndex = ref<number | null>(null);
const startResizeX = ref(0);
const startResizeWidth = ref(0);

const handleResizeStart = (e: MouseEvent, index: number) => {
  e.preventDefault();
  e.stopPropagation();
  resizingColIndex.value = index;
  startResizeX.value = e.clientX;
  const col = processedData.value.columns[index];
  startResizeWidth.value = col.width || 100;
  
  window.addEventListener('mousemove', handleResizeMove);
  window.addEventListener('mouseup', handleResizeEnd);
};

const handleResizeMove = (e: MouseEvent) => {
  if (resizingColIndex.value === null) return;
  const dx = e.clientX - startResizeX.value;
  const newWidth = Math.max(20, startResizeWidth.value + dx);
  const col = processedData.value.columns[resizingColIndex.value];
  tempColumnWidths.value[col.field] = newWidth;
};

const handleResizeEnd = () => {
  if (resizingColIndex.value !== null) {
      const col = processedData.value.columns[resizingColIndex.value];
      const finalWidth = tempColumnWidths.value[col.field];
      if (finalWidth) {
          const newCols = [...(props.element.columns || [])];
          if (newCols[resizingColIndex.value]) {
              newCols[resizingColIndex.value] = { ...newCols[resizingColIndex.value], width: finalWidth };
              store.updateElement(props.element.id, { columns: newCols });
          }
      }
  }
  resizingColIndex.value = null;
  tempColumnWidths.value = {};
  window.removeEventListener('mousemove', handleResizeMove);
  window.removeEventListener('mouseup', handleResizeEnd);
};

const handleMouseDown = (e: MouseEvent, rowIndex: number, colField: string, section: 'body' | 'footer' = 'body') => {
  if (store.selectedElementId !== props.element.id) return;
  e.stopPropagation();
  isSelecting.value = true;
  startCell.value = { rowIndex, colField, section };
  store.setTableSelection(props.element.id, { rowIndex, colField, section }, false);
};

const handleMouseOver = (rowIndex: number, colField: string, section: 'body' | 'footer' = 'body') => {
  if (!isSelecting.value || !startCell.value) return;
  
  // Prevent cross-section selection
  if (startCell.value.section !== section) return;
  
  const startRow = startCell.value.rowIndex;
  const endRow = rowIndex;
  const startColIdx = processedData.value.columns.findIndex((c: any) => c.field === startCell.value!.colField);
  const endColIdx = processedData.value.columns.findIndex((c: any) => c.field === colField);
  
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
        section
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
        { label: 'Columns (JSON)', type: 'code', language: 'json', target: 'element', key: 'columns', placeholder: '[{ field: "name", header: "Name", width: 100 }]' },
        { label: 'Data (JSON)', type: 'code', language: 'json', target: 'element', key: 'data', placeholder: '[{...}]' },
        { label: 'Footer Data (JSON)', type: 'code', language: 'json', target: 'element', key: 'footerData', placeholder: '[{ "id": { "value": "Total" }, "amount": { "value": "Total:", "field": "{#sum}" } }]' },
        { label: 'Custom Script', type: 'code', language: 'javascript', target: 'element', key: 'customScript', placeholder: 'return { data: ... };' }
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
    <table class="w-full border-collapse" :class="{ 'h-full': !store.isExporting }" :data-tfoot-repeat="element.tfootRepeat" :data-auto-paginate="element.autoPaginate" :data-custom-script="element.customScript">
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
              v-if="store.selectedElementId === element.id && index < processedData.columns.length - 1"
              class="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 opacity-0 hover:opacity-100 z-10 transition-opacity"
              :class="{ 'bg-blue-400 opacity-100': resizingColIndex === index }"
              @mousedown="(e) => handleResizeStart(e, index)"
              @click.stop
            ></div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in (store.isExporting ? processedData.data : processedData.data.slice(0, 5))" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm select-none"
               :class="{ 'bg-blue-100 ring-1 ring-blue-400': isCellSelected(i, col.field) }"
               :style="{
                 ...cellStyle,
                 ...getCellStyle(row, col.field),
                 height: element.style.rowHeight ? `${element.style.rowHeight}px` : undefined
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
               :data-field="col.field"
               @mousedown="(e) => handleMouseDown(e, i, col.field)"
               @mouseover="handleMouseOver(i, col.field)"
             >
               {{ getCellValue(row, col.field) }}
             </td>
          </template>
        </tr>
        <tr v-if="!store.isExporting && processedData.data.length > 5">
          <td 
            :colspan="processedData.columns.length" 
            class="p-1 text-center text-gray-500 select-none"
            :style="{
               ...cellStyle,
               height: element.style.rowHeight ? `${element.style.rowHeight}px` : undefined
            }"
          >
            ...
          </td>
        </tr>
        <!-- Spacer Row to push footer to bottom in design mode -->
        <tr v-if="!store.isExporting" class="h-full border-none bg-transparent">
          <td 
            :colspan="processedData.columns.length || 1" 
            class="border-none p-0"
          ></td>
        </tr>
      </tbody>
      <tfoot v-if="element.showFooter">
        <tr v-for="(row, i) in processedData.footerData" :key="i">
          <template v-for="col in processedData.columns" :key="col.field">
             <td 
               v-if="shouldRenderCell(row, col.field)"
               class="p-1 text-sm font-bold select-none"
               :class="{ '!bg-blue-100 ring-1 ring-blue-400': isCellSelected(i, col.field, 'footer') }"
                :style="{ 
                  ...cellStyle,
                  ...getCellStyle(row, col.field), 
                  height: element.style.footerHeight ? `${element.style.footerHeight}px` : undefined,
                  backgroundColor: element.style.footerBackgroundColor || '#f9fafb',
                 color: element.style.footerColor || '#000000',
                 fontSize: element.style.footerFontSize ? `${element.style.footerFontSize}px` : undefined,
                 cursor: store.selectedElementId === element.id ? 'pointer' : 'default'
               }"
               :rowspan="getRowSpan(row, col.field)"
               :colspan="getColSpan(row, col.field)"
               :data-field="col.field"
               :data-value="getPrintValue(row, col.field)"
               @mousedown="(e) => handleMouseDown(e, i, col.field, 'footer')"
               @mouseover="handleMouseOver(i, col.field, 'footer')"
               @dblclick="(e) => handleFooterDblClick(e, i, col.field)"
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
        v-if="editingColIndex !== null || editingFooterCell" 
        ref="editFormRef"
        class="fixed z-[9999] bg-white shadow-xl border border-gray-200 rounded-lg p-4 w-64 flex flex-col gap-3"
        :style="{ top: `${editFormPosition.top}px`, left: `${editFormPosition.left}px` }"
        @click.stop
      >
        <h4 class="text-sm font-semibold text-gray-700">{{ editingFooterCell ? 'Edit Cell' : 'Edit Column' }}</h4>
        
        <template v-if="editingColIndex !== null">
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
        </template>

        <template v-if="editingFooterCell">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">Text</label>
            <input 
              v-model="editForm.value"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Display Text (e.g. Total:)"
              @keydown.enter="saveHeaderEdit"
              autoFocus
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">Variable Field</label>
             <input 
              v-model="editForm.variable"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Data Field (e.g. {#amount})"
              @keydown.enter="saveHeaderEdit"
            />
          </div>
        </template>

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
