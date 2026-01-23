<script setup lang="ts">
import { computed } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type ElementPropertiesSchema, type PropertyField } from '@/types';
import { elementPropertiesSchema as TextSchema } from '@/components/elements/TextElement.vue';
import { elementPropertiesSchema as ImageSchema } from '@/components/elements/ImageElement.vue';
import { elementPropertiesSchema as TableSchema } from '@/components/elements/TableElement.vue';

const store = useDesignerStore();
const element = computed(() => store.selectedElement);

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
    const value = (e.target as HTMLInputElement).value;
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
    default: return null;
  }
};

const handleFieldInput = (field: PropertyField, rawValue: any) => {
  if (!element.value) return;
  const value = field.type === 'number' ? Number(rawValue) : rawValue;
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
  }
};
</script>

<template>
  <aside class="w-72 bg-white border-l border-gray-200 flex flex-col h-full z-40 overflow-y-auto">
    <div class="p-4 border-b border-gray-200">
      <h2 class="font-semibold text-gray-700">Properties</h2>
    </div>

    <div v-if="element" class="p-4 space-y-6">
      <!-- Common Properties -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold text-gray-500 uppercase">Position & Size</h3>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-gray-500 mb-1">X (PX)</label>
            <input 
              type="number" 
              :value="element.x" 
              @input="(e) => handleChange('x', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Y (PX)</label>
            <input 
              type="number" 
              :value="element.y" 
              @input="(e) => handleChange('y', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Width (PX)</label>
            <input 
              type="number" 
              :value="element.width" 
              @input="(e) => handleChange('width', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Height (PX)</label>
            <input 
              type="number" 
              :value="element.height" 
              @input="(e) => handleChange('height', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <!-- Dynamic Element-Specific Properties from Component Schema -->
      <div v-if="getSchema(element.type)" class="space-y-6">
        <template v-for="(section, si) in getSchema(element.type)?.sections" :key="si">
          <div class="space-y-3">
            <h3 class="text-xs font-bold text-gray-500 uppercase">{{ section.title }}</h3>
            <template v-for="(field, fi) in section.fields" :key="fi">
              <div v-if="field.type !== 'action'">
                <label class="block text-xs text-gray-500 mb-1">{{ field.label }}</label>
                <template v-if="field.type === 'number'">
                  <input
                    type="number"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step || 1"
                    :value="field.target === 'style' ? element.style[field.key!] ?? '' : (element as any)[field.key!]"
                    @input="(e) => handleFieldInput(field, (e.target as HTMLInputElement).value)"
                    class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </template>
                <template v-else-if="field.type === 'text'">
                  <input
                    type="text"
                    :placeholder="field.placeholder"
                    :value="field.target === 'style' ? element.style[field.key!] ?? '' : (element as any)[field.key!]"
                    @input="(e) => handleFieldInput(field, (e.target as HTMLInputElement).value)"
                    class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </template>
                <template v-else-if="field.type === 'color'">
                  <input
                    type="color"
                    :value="field.target === 'style' ? element.style[field.key!] ?? '#000000' : (element as any)[field.key!]"
                    @input="(e) => handleFieldInput(field, (e.target as HTMLInputElement).value)"
                    class="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </template>
                <template v-else-if="field.type === 'textarea'">
                  <textarea
                    :placeholder="field.placeholder"
                    :value="field.key === 'data' ? JSON.stringify(element.data, null, 2) : (field.target === 'style' ? element.style[field.key!] ?? '' : (element as any)[field.key!])"
                    @change="field.key === 'data' ? handleDataJsonChange(field.key!, $event) : handleFieldInput(field, ( $event.target as HTMLTextAreaElement ).value)"
                    class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none h-24"
                  ></textarea>
                </template>
              </div>
              <div v-else>
                <button
                  @click="handleFieldAction(field)"
                  class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {{ field.label }}
                </button>
              </div>
            </template>
          </div>
        </template>
      </div>
      
      <!-- Style -->
      <div class="space-y-3">
        <h3 class="text-xs font-bold text-gray-500 uppercase">Style</h3>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Border (e.g. 1px solid black)</label>
          <input 
            type="text" 
            :value="element.style.border || ''" 
            @input="(e) => handleStyleChange('border', (e.target as HTMLInputElement).value)"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            placeholder="none"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Background Color</label>
          <input 
            type="color" 
            :value="element.style.backgroundColor || '#ffffff'" 
            @input="(e) => handleStyleChange('backgroundColor', (e.target as HTMLInputElement).value)"
            class="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>
      </div>
      
      <button 
        @click="store.removeElement(element.id)"
        class="w-full py-2 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors text-sm font-medium"
      >
        Delete Element
      </button>

    </div>
    <div v-else class="p-8 text-center text-gray-400">
      <p>Select an element to edit its properties</p>
    </div>
  </aside>
</template>
