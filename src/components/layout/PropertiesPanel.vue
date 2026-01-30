<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { pxToMm, mmToPx } from '@/utils/units';
import PropertyInput from '@/components/properties/PropertyInput.vue';
import PropertySelect from '@/components/properties/PropertySelect.vue';
import PropertyColor from '@/components/properties/PropertyColor.vue';
import Lock from '~icons/material-symbols/lock';

const store = useDesignerStore();
const element = computed(() => store.selectedElement);
const isMultiSelected = computed(() => store.selectedElementIds.length > 1);
const isLocked = computed(() => element.value?.locked || false);
const isSelfStyled = computed(() => {
  if (!element.value) return false;
  return [ElementType.LINE, ElementType.RECT, ElementType.CIRCLE].includes(element.value.type);
});
const activeTab = ref<'properties' | 'style' | 'advanced'>('properties');

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
</script>

<template>
  <aside class="w-[380px] bg-white border-l border-gray-200 flex flex-col h-full z-40 overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
      <h2 class="font-semibold text-gray-700">Properties</h2>
      <div v-if="isLocked" class="flex items-center text-red-500 gap-1 text-xs font-medium bg-red-50 px-2 py-1 rounded border border-red-100">
        <Lock class="w-3 h-3" />
        <span>Locked</span>
      </div>
    </div>

    <!-- Multi-select Mode -->
    <div v-if="isMultiSelected" class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Multi-select mode</h3>
        <p class="text-sm text-gray-500 mt-2">
          <span class="font-medium">{{ store.selectedElementIds.length }}</span> 
          elements selected
        </p>
      </div>
      <button
        @click="handleDeleteSelected"
        class="w-full py-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors text-sm font-medium"
      >
        Delete Selected Elements
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
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
          <div v-if="activeTab === tab" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
        </button>
      </div>

      <div class="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
        
        <!-- Properties Tab: Position & Size -->
        <div v-if="activeTab === 'properties'" class="space-y-3">
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Position & Size</h3>
          <div class="grid grid-cols-2 gap-3">
            <PropertyInput 
              label="X (mm)" 
              type="number" 
              :disabled="isLocked"
              :value="pxToMm(element.x)" 
              @update:value="(v) => handleChange('x', mmToPx(Number(v)))" 
            />
            <PropertyInput 
              label="Y (mm)" 
              type="number" 
              :disabled="isLocked"
              :value="pxToMm(element.y)" 
              @update:value="(v) => handleChange('y', mmToPx(Number(v)))" 
            />
            <PropertyInput 
              label="Width (mm)" 
              type="number" 
              :disabled="isLocked"
              :value="pxToMm(element.width)" 
              @update:value="(v) => handleChange('width', mmToPx(Number(v)))" 
            />
            <PropertyInput 
              label="Height (mm)" 
              type="number" 
              :disabled="isLocked"
              :value="pxToMm(element.height)" 
              @update:value="(v) => handleChange('height', mmToPx(Number(v)))" 
            />
          </div>
        </div>

        <!-- Dynamic Sections -->
        <template v-for="(section, si) in visibleSections" :key="si">
          <div class="space-y-3 pt-2 first:pt-0 border-t first:border-0 border-gray-100">
            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ section.title }}</h3>
            <div class="space-y-3">
              <template v-for="(field, fi) in section.fields" :key="fi">
                <!-- Action Button -->
                <div v-if="field.type === 'action'">
                  <button
                    @click="handleFieldAction(field)"
                    :disabled="isLocked"
                    class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {{ field.label }}
                  </button>
                </div>
                
                <!-- Text/Number/Switch Input -->
                <PropertyInput
                  v-else-if="field.type === 'text' || field.type === 'number' || field.type === 'switch'"
                  :label="field.label"
                  :type="field.type"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :disabled="isLocked"
                  :placeholder="field.placeholder"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Select -->
                <PropertySelect
                  v-else-if="field.type === 'select'"
                  :label="field.label"
                  :options="field.options || []"
                  :disabled="isLocked"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Color -->
                <PropertyColor
                  v-else-if="field.type === 'color'"
                  :label="field.label"
                  :disabled="isLocked"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Textarea -->
                <div v-else-if="field.type === 'textarea'">
                  <label class="block text-xs text-gray-500 mb-1 font-medium">{{ field.label }}</label>
                  <textarea
                    :placeholder="field.placeholder"
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
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Appearance</h3>
          <PropertyColor 
            label="Background Color" 
            :disabled="isLocked"
            :value="element.style.backgroundColor || '#ffffff'" 
            @update:value="(v) => handleStyleChange('backgroundColor', v)" 
          />
        </div>

        <!-- Advanced Tab Content -->
        <div v-if="activeTab === 'advanced'" class="space-y-4">
          <div class="p-4 bg-gray-50 rounded border border-gray-200">
             <h4 class="text-sm font-medium text-gray-700 mb-2">Element Info</h4>
             <div class="text-xs text-gray-500 space-y-1">
               <p>ID: <span class="font-mono">{{ element.id.slice(0, 8) }}...</span></p>
               <p>Type: {{ element.type }}</p>
             </div>
          </div>
          
          <button
            @click="handleDeleteSelected"
            :disabled="isLocked"
            class="w-full py-2 bg-white text-red-600 rounded border border-red-200 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            Delete Element
          </button>
        </div>

      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900">No Selection</h3>
        <p class="text-sm text-gray-500 mt-2">
          Select an element to edit properties
        </p>
      </div>
    </div>
  </aside>
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
