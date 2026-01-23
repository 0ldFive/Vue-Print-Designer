<script setup lang="ts">
import { computed } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { ElementType } from '@/types';

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

const handleDataChange = (e: Event) => {
  try {
    const value = (e.target as HTMLInputElement).value;
    handleChange('data', JSON.parse(value));
  } catch (err) {
    window.alert('Invalid JSON');
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
            <label class="block text-xs text-gray-500 mb-1">X (px)</label>
            <input 
              type="number" 
              :value="element.x" 
              @input="(e) => handleChange('x', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Y (px)</label>
            <input 
              type="number" 
              :value="element.y" 
              @input="(e) => handleChange('y', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Width (px)</label>
            <input 
              type="number" 
              :value="element.width" 
              @input="(e) => handleChange('width', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Height (px)</label>
            <input 
              type="number" 
              :value="element.height" 
              @input="(e) => handleChange('height', Number((e.target as HTMLInputElement).value))"
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <!-- Specific Properties -->
      <div v-if="element.type === ElementType.TEXT" class="space-y-3">
        <h3 class="text-xs font-bold text-gray-500 uppercase">Text Style</h3>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Content</label>
          <textarea 
            :value="element.content" 
            @input="(e) => handleChange('content', (e.target as HTMLInputElement).value)"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none h-20"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Font Size (px)</label>
          <input 
            type="number" 
            :value="element.style.fontSize || 14" 
            @input="(e) => handleStyleChange('fontSize', Number((e.target as HTMLInputElement).value))"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Align</label>
          <select 
            :value="element.style.textAlign || 'left'"
            @change="(e) => handleStyleChange('textAlign', (e.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div v-if="element.type === ElementType.IMAGE" class="space-y-3">
         <h3 class="text-xs font-bold text-gray-500 uppercase">Image Settings</h3>
         <div>
          <label class="block text-xs text-gray-500 mb-1">URL</label>
          <input 
            type="text"
            :value="element.content" 
            @input="(e) => handleChange('content', (e.target as HTMLInputElement).value)"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div v-if="element.type === ElementType.TABLE" class="space-y-3">
         <h3 class="text-xs font-bold text-gray-500 uppercase">Table Settings</h3>
         <button 
           @click="store.paginateTable(element.id)"
           class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
         >
           Auto Paginate
         </button>
         <div>
          <label class="block text-xs text-gray-500 mb-1">Header Height (px)</label>
          <input 
            type="number" 
            :value="element.style.headerHeight || 40" 
            @input="(e) => handleStyleChange('headerHeight', Number((e.target as HTMLInputElement).value))"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Row Height (px)</label>
          <input 
            type="number" 
            :value="element.style.rowHeight || 30" 
            @input="(e) => handleStyleChange('rowHeight', Number((e.target as HTMLInputElement).value))"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Data (JSON)</label>
          <textarea 
            :value="JSON.stringify(element.data, null, 2)" 
            @change="handleDataChange"
            class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none h-40 font-mono text-xs"
          ></textarea>
        </div>
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
