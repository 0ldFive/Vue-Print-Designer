<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type ElementPropertiesSchema, type PropertyField } from '@/types';
import { elementPropertiesSchema as TextSchema } from '@/components/elements/TextElement.vue';
import { elementPropertiesSchema as ImageSchema } from '@/components/elements/ImageElement.vue';
import { elementPropertiesSchema as TableSchema } from '@/components/elements/TableElement.vue';
import { elementPropertiesSchema as PagerSchema } from '@/components/elements/PageNumberElement.vue';
import { elementPropertiesSchema as BarcodeSchema } from '@/components/elements/BarcodeElement.vue';
import { elementPropertiesSchema as QrCodeSchema } from '@/components/elements/QRCodeElement.vue';
import { elementPropertiesSchema as LineSchema } from '@/components/elements/LineElement.vue';
import { elementPropertiesSchema as RectSchema } from '@/components/elements/RectElement.vue';
import { elementPropertiesSchema as CircleSchema } from '@/components/elements/CircleElement.vue';
import { pxToUnit, unitToPx, type Unit } from '@/utils/units';
import PropertyInput from '@/components/properties/PropertyInput.vue';
import PropertySelect from '@/components/properties/PropertySelect.vue';
import PropertyColor from '@/components/properties/PropertyColor.vue';
import PropertyCode from '@/components/properties/PropertyCode.vue';
import PropertyImage from '@/components/properties/PropertyImage.vue';
import Lock from '~icons/material-symbols/lock';
import ContentCopy from '~icons/material-symbols/content-copy';
import Check from '~icons/material-symbols/check';
import Save from '~icons/material-symbols/save';
import Delete from '~icons/material-symbols/delete';
import InputModal from '@/components/common/InputModal.vue';

const { t } = useI18n();
const store = useDesignerStore();
const element = computed(() => store.selectedElement);
const isMultiSelected = computed(() => store.selectedElementIds.length > 1);
const isLocked = computed(() => element.value?.locked || false);
const showCustomElementModal = ref(false);
const customElementInitialName = ref('');

const isSelfStyled = computed(() => {
  if (!element.value) return false;
  return [ElementType.LINE, ElementType.RECT, ElementType.CIRCLE].includes(element.value.type);
});

const canMergeCells = computed(() => {
  if (!store.tableSelection) return false;
  return store.tableSelection.cells.length > 1;
});

const canSplitCells = computed(() => {
  if (!store.tableSelection) return false;
  if (store.tableSelection.cells.length !== 1) return false;
  
  const cell = store.tableSelection.cells[0];
  const el = store.selectedElement;
  if (!el || el.type !== ElementType.TABLE) return false;
  
  const section = cell.section || 'body';
  const targetData = section === 'footer' ? el.footerData : el.data;
  
  if (!targetData) return false;
  
  const row = targetData[cell.rowIndex];
  if (!row) return false;
  const val = row[cell.colField];
  if (val && typeof val === 'object') {
     return (val.rowSpan || 1) > 1 || (val.colSpan || 1) > 1;
  }
  return false;
});

const activeTab = ref<'properties' | 'style' | 'advanced'>('properties');
const copied = ref(false);
const unit = computed(() => (store.unit || 'mm') as Unit);
const unitLabel = computed(() => store.unit || 'mm');
const unitFieldKeys = new Set([
  'fontSize',
  'borderWidth',
  'barcodeWidth',
  'barcodeHeight',
  'margin',
  'borderRadius',
  'headerHeight',
  'rowHeight',
  'footerHeight',
  'labelFontSize',
  'labelBorderWidth'
]);

const isUnitField = (field: PropertyField) => {
  if (field.type !== 'number' || !field.key) return false;
  return unitFieldKeys.has(field.key);
};

const getFieldLabel = (field: PropertyField) => {
  const base = t(field.label);
  return isUnitField(field) ? `${base} (${unitLabel.value})` : base;
};

const getFieldDisplayValue = (field: PropertyField) => {
  const value = getFieldValue(field);
  if (isUnitField(field) && typeof value === 'number') {
    return pxToUnit(value, unit.value);
  }
  return value;
};

const toFieldValue = (field: PropertyField, value: any) => {
  if (isUnitField(field)) {
    return unitToPx(Number(value), unit.value);
  }
  return value;
};

const getFieldMin = (field: PropertyField) => {
  if (field.min === undefined || field.min === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.min, unit.value) : field.min;
};

const getFieldMax = (field: PropertyField) => {
  if (field.max === undefined || field.max === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.max, unit.value) : field.max;
};

const getFieldStep = (field: PropertyField) => {
  if (field.step === undefined || field.step === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.step, unit.value) : field.step;
};

const copyId = () => {
  if (element.value) {
    navigator.clipboard.writeText(element.value.id);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
};

const handleSaveCustom = () => {
  if (!element.value) return;
  customElementInitialName.value = element.value.type;
  showCustomElementModal.value = true;
};

const onSaveCustomElement = (name: string) => {
  if (element.value && name) {
    store.addCustomElement(name, element.value);
  }
};

const handleChange = (key: string, value: any) => {
  if (element.value) {
    store.updateElement(element.value.id, { [key]: value });
  }
};

const handleStyleChange = (key: string, value: any) => {
  if (element.value) {
    store.updateElement(element.value.id, {
      style: { ...element.value.style, [key]: value }
    });
  }
};

const handleDataJsonChange = (fieldKey: string, e: Event) => {
  try {
    const value = (e.target as HTMLTextAreaElement).value;
    handleChange(fieldKey, JSON.parse(value));
  } catch (err) {
    window.alert('Invalid JSON');
  }
};

const getCodeValue = (field: PropertyField) => {
  const val = getFieldValue(field);
  if (field.language === 'json' && typeof val === 'object') {
    return JSON.stringify(val, null, 2);
  }
  return val || '';
};

const handleCodeChange = (field: PropertyField, value: string) => {
  if (field.language === 'json') {
    try {
      const parsed = JSON.parse(value);
      handleChange(field.key!, parsed);
    } catch (e) {
      // ignore invalid json
    }
  } else {
    handleChange(field.key!, value);
  }
};

const getSchema = (type: ElementType): ElementPropertiesSchema | null => {
  switch (type) {
    case ElementType.TEXT: return TextSchema;
    case ElementType.IMAGE: return ImageSchema;
    case ElementType.TABLE: return TableSchema;
    case ElementType.PAGE_NUMBER: return PagerSchema;
    case ElementType.BARCODE: return BarcodeSchema;
    case ElementType.QRCODE: return QrCodeSchema;
    case ElementType.LINE: return LineSchema;
    case ElementType.RECT: return RectSchema;
    case ElementType.CIRCLE: return CircleSchema;
    default: return null;
  }
};

const currentSchema = computed(() => element.value ? getSchema(element.value.type) : null);

const visibleSections = computed(() => {
  if (!currentSchema.value) return [];
  return currentSchema.value.sections.filter(s => (s.tab || 'properties') === activeTab.value);
});

const getFieldValue = (field: PropertyField) => {
  if (!element.value) return field.defaultValue;
  const target = field.target === 'style' ? element.value.style : element.value;
  const value = (target as any)[field.key!];
  return value ?? field.defaultValue;
};

const handleFieldChange = (field: PropertyField, value: any) => {
  if (!element.value) return;
  if (field.target === 'style' && field.key) {
    handleStyleChange(field.key, value);
  } else if (field.target === 'element' && field.key) {
    handleChange(field.key, value);
  }
};

const handleFieldAction = (field: PropertyField) => {
  if (!element.value || !field.actionName) return;
  if (field.actionName === 'paginateTable') {
    store.paginateTable(element.value.id);
  } else if (field.actionName === 'removeBorder') {
    store.updateElement(element.value.id, { 
      style: { 
        ...element.value.style, 
        borderStyle: undefined, 
        borderWidth: undefined, 
        borderColor: undefined,
        border: 'none'
      } 
    });
  }
};

const handleDeleteSelected = () => {
  if (isMultiSelected.value) {
    store.removeSelectedElements();
  } else if (element.value) {
    store.removeElement(element.value.id);
  }
};

const handleFocusIn = (e: FocusEvent) => {
  // If focus comes from another element within the aside, do nothing
  if (e.relatedTarget && (e.currentTarget as Element).contains(e.relatedTarget as Node)) {
    return;
  }
  store.setDisableGlobalShortcuts(true);
};

const handleFocusOut = (e: FocusEvent) => {
  // If focus moves to another element within the aside, do nothing
  if (e.relatedTarget && (e.currentTarget as Element).contains(e.relatedTarget as Node)) {
    return;
  }
  // Otherwise enable shortcuts
  store.setDisableGlobalShortcuts(false);
};
</script>

<template>
  <aside 
    class="w-[380px] bg-white border-l border-gray-200 flex flex-col h-full z-40 overflow-hidden"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
  >
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
      <div>
        <h2 class="font-semibold text-gray-700">{{ t('properties.title') }}</h2>
        <p class="text-xs text-gray-500 mt-1">{{ t('properties.subtitle') }}</p>
      </div>
      <div v-if="isLocked" class="flex items-center text-red-500 gap-1 text-xs font-medium bg-red-50 px-2 py-1 rounded border border-red-100">
        <Lock class="w-3 h-3" />
        <span>{{ t('properties.locked') }}</span>
      </div>
    </div>

    <!-- Multi-select Mode -->
    <div v-if="isMultiSelected" class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900">{{ t('properties.multiSelectMode') }}</h3>
        <p class="text-sm text-gray-500 mt-2">
          <span class="font-medium">{{ store.selectedElementIds.length }}</span> 
          {{ t('properties.selectedElements', { n: '' }).replace('{n}', '') }}
        </p>
      </div>
      <button
        @click="handleDeleteSelected"
        class="w-full py-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors text-sm font-medium"
      >
        {{ t('properties.deleteSelected') }}
      </button>
    </div>

    <!-- Single Element Mode -->
    <div v-else-if="element" class="flex flex-col h-full overflow-hidden">
      <!-- Tabs -->
      <div class="flex border-b border-gray-200 bg-white">
        <button 
          v-for="tab in ['properties', 'style', 'advanced']" 
          :key="tab"
          @click="activeTab = tab as any"
          :class="['flex-1 py-3 text-sm font-medium transition-colors relative', activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50']"
        >
          {{ t(`properties.tab.${tab}`) }}
          <div v-if="activeTab === tab" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
        </button>
      </div>

      <div class="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
        
        <!-- Properties Tab: Position & Size -->
        <div v-if="activeTab === 'properties'" class="space-y-3">
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ t('properties.section.positionSize') }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <PropertyInput 
              :label="`${t('properties.label.x')} (${unitLabel})`" 
              type="number" 
              :disabled="isLocked"
              :value="pxToUnit(element.x, unit)" 
              @update:value="(v) => handleChange('x', unitToPx(Number(v), unit))" 
            />
            <PropertyInput 
              :label="`${t('properties.label.y')} (${unitLabel})`" 
              type="number" 
              :disabled="isLocked"
              :value="pxToUnit(element.y, unit)" 
              @update:value="(v) => handleChange('y', unitToPx(Number(v), unit))" 
            />
            <PropertyInput 
              :label="`${t('properties.label.width')} (${unitLabel})`" 
              type="number" 
              :disabled="isLocked"
              :value="pxToUnit(element.width, unit)" 
              @update:value="(v) => handleChange('width', unitToPx(Number(v), unit))" 
            />
            <PropertyInput 
              :label="`${t('properties.label.height')} (${unitLabel})`" 
              type="number" 
              :disabled="isLocked"
              :value="pxToUnit(element.height, unit)" 
              @update:value="(v) => handleChange('height', unitToPx(Number(v), unit))" 
            />
          </div>
        </div>

        <!-- Table Cell Operations -->
        <div v-if="activeTab === 'properties' && element.type === 'table' && store.tableSelection" class="space-y-3 pt-2 border-t border-gray-100">
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ t('properties.section.cellOperations') }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <button
              @click="store.mergeSelectedCells()"
              :disabled="!canMergeCells || isLocked"
              class="w-full py-2 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-100 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
            >
              {{ t('properties.action.mergeCells') }}
            </button>
            <button
              @click="store.splitSelectedCells()"
              :disabled="!canSplitCells || isLocked"
              class="w-full py-2 bg-white text-gray-600 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ t('properties.action.splitCells') }}
            </button>
          </div>
        </div>

        <!-- Dynamic Sections -->
        <template v-for="(section, si) in visibleSections" :key="si">
          <div class="space-y-3 pt-2 first:pt-0 border-t first:border-0 border-gray-100">
            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ t(section.title) }}</h3>
            <div class="space-y-3">
              <template v-for="(field, fi) in section.fields" :key="fi">
                <!-- Action Button -->
                <div v-if="field.type === 'action'">
                  <button
                    @click="handleFieldAction(field)"
                    :disabled="isLocked"
                    class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {{ t(field.label) }}
                  </button>
                </div>
                
                <!-- Text/Number/Switch Input -->
                <PropertyInput
                  v-else-if="field.type === 'text' || field.type === 'number' || field.type === 'switch'"
                  :label="getFieldLabel(field)"
                  :type="field.type"
                  :min="getFieldMin(field)"
                  :max="getFieldMax(field)"
                  :step="getFieldStep(field)"
                  :disabled="isLocked"
                  :placeholder="field.placeholder ? (field.placeholder.startsWith('properties.') ? t(field.placeholder) : field.placeholder) : ''"
                  :value="getFieldDisplayValue(field)"
                  @update:value="(v) => handleFieldChange(field, toFieldValue(field, v))"
                />

                <!-- Select -->
                <PropertySelect
                  v-else-if="field.type === 'select'"
                  :label="t(field.label)"
                  :options="(field.options || []).map(o => ({ ...o, label: t(o.label) }))"
                  :disabled="isLocked"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Color -->
                <PropertyColor
                  v-else-if="field.type === 'color'"
                  :label="t(field.label)"
                  :disabled="isLocked"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Image Upload -->
                <PropertyImage
                  v-else-if="field.type === 'image'"
                  :label="t(field.label)"
                  :disabled="isLocked"
                  :placeholder="field.placeholder ? (field.placeholder.startsWith('properties.') ? t(field.placeholder) : field.placeholder) : undefined"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Code Editor -->
                <PropertyCode
                  v-else-if="field.type === 'code'"
                  :label="t(field.label)"
                  :language="field.language || 'javascript'"
                  :disabled="isLocked"
                  :value="getCodeValue(field)"
                  @update:value="(v) => handleCodeChange(field, v)"
                />

                <!-- Textarea -->
                <div v-else-if="field.type === 'textarea'">
                  <label class="block text-xs text-gray-500 mb-1 font-medium">{{ t(field.label) }}</label>
                  <textarea
                    :placeholder="field.placeholder ? (field.placeholder.startsWith('properties.') ? t(field.placeholder) : field.placeholder) : ''"
                    :disabled="isLocked"
                    :value="['data', 'columns', 'footerData'].includes(field.key!) ? JSON.stringify((element as any)[field.key!], null, 2) : getFieldValue(field)"
                    @change="['data', 'columns', 'footerData'].includes(field.key!) ? handleDataJsonChange(field.key!, $event) : handleFieldChange(field, ( $event.target as HTMLTextAreaElement ).value)"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none h-24 resize-y font-mono disabled:bg-gray-100 disabled:text-gray-500"
                  ></textarea>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Style Tab: Generic Appearance -->
        <div v-if="activeTab === 'style' && !isSelfStyled" class="space-y-3 pt-2 border-t border-gray-100">
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ t('properties.section.appearance') }}</h3>
          <PropertyColor 
            :label="t('properties.label.backgroundColor')" 
            :disabled="isLocked"
            :value="element.style.backgroundColor || '#ffffff'" 
            @update:value="(v) => handleStyleChange('backgroundColor', v)" 
          />
        </div>

        <!-- Advanced Tab Content -->
        <div v-if="activeTab === 'advanced'" class="space-y-4">
          <div class="p-4 bg-gray-50 rounded border border-gray-200">
             <h4 class="text-sm font-medium text-gray-700 mb-3">{{ t('properties.section.elementInfo') }}</h4>
             <div class="space-y-3">
               <div>
                 <p class="text-xs text-gray-500 mb-1.5 font-medium">{{ t('properties.label.id') }}</p>
                 <div class="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5 hover:border-blue-400 transition-colors">
                   <span class="font-mono text-xs text-gray-600 flex-1 truncate select-all" :title="element.id">{{ element.id }}</span>
                   <button 
                     @click="copyId"
                     class="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-gray-100 flex-shrink-0"
                     :title="copied ? t('properties.action.copied') : t('properties.action.copyId')"
                   >
                     <Check v-if="copied" class="w-3.5 h-3.5 text-green-500" />
                     <ContentCopy v-else class="w-3.5 h-3.5" />
                   </button>
                 </div>
               </div>
               <div class="text-xs text-gray-500 flex items-center justify-between border-t border-gray-100 pt-2">
                 <span class="font-medium">{{ t('properties.label.type') }}</span> 
                 <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{{ t('elements.' + element.type) }}</span>
               </div>
             </div>
          </div>
          
          <button
            @click="handleSaveCustom"
            class="w-full py-2 bg-white text-blue-600 rounded border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center gap-2 mb-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Save class="w-4 h-4" />
            {{ t('properties.action.saveCustom') }}
          </button>

          <button
            @click="handleDeleteSelected"
            :disabled="isLocked"
            class="w-full py-2 bg-white text-red-600 rounded border border-red-200 hover:bg-red-50 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Delete class="w-4 h-4" />
            {{ t('properties.action.deleteElement') }}
          </button>
        </div>

      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900">{{ t('properties.empty.noSelection') }}</h3>
        <p class="text-sm text-gray-500 mt-2">
          {{ t('properties.empty.selectInstruction') }}
        </p>
      </div>
    </div>
  </aside>

  <InputModal
    :show="showCustomElementModal"
    :initial-value="customElementInitialName"
    :title="t('properties.action.saveCustomModal')"
    :placeholder="t('sidebar.enterNamePlaceholder')"
    @close="showCustomElementModal = false"
    @save="onSaveCustomElement"
  />
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db;
}
</style>
