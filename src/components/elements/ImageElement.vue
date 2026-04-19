<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import { toast } from '@/utils/toast';
import { normalizeVariableKey } from '@/utils/variables';

const props = defineProps<{
  element: PrintElement;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const fileInputRef = ref<HTMLInputElement | null>(null);

const resolvedContent = computed(() => {
  if (props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    
    if (store.isExporting) {
      const vars = (store as any).variables;
      if (key && vars && Object.prototype.hasOwnProperty.call(vars, key)) {
        const value = vars[key];
        if (value !== undefined && value !== null) {
          return String(value);
        }
      }
    }
    
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  return props.element.content;
});

const canSelectFile = () => {
  if (!store.isTemplateEditable || props.element.locked) return false;
  if (store.selectedElementId !== props.element.id && !store.selectedElementIds.includes(props.element.id)) return false;
  return true;
};

const handleDblClick = (event: MouseEvent) => {
  if (!canSelectFile()) return;
  const wrapper = (event.currentTarget as HTMLElement | null)?.closest('.element-wrapper');
  if (wrapper?.getAttribute('data-read-only') === 'true') return;
  event.stopPropagation();
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    toast.error(t('properties.image.sizeError'));
    target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result as string;
    if (result) {
      store.updateElement(props.element.id, { content: result });
    }
  };
  reader.onerror = () => {
    toast.error(t('properties.image.readError'));
  };
  reader.readAsDataURL(file);
  target.value = '';
};
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'properties.section.imageSource',
      tab: 'properties',
      fields: [
        { label: 'properties.label.imageSource', type: 'image', target: 'element', key: 'content' },
        { label: 'properties.label.variable', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'properties.section.border',
      tab: 'style',
      fields: [
        { label: 'properties.label.borderStyle', type: 'select', target: 'style', key: 'borderStyle', options: [
            { label: 'properties.option.none', value: 'none' },
            { label: 'properties.option.solid', value: 'solid' },
            { label: 'properties.option.dashed', value: 'dashed' },
            { label: 'properties.option.dotted', value: 'dotted' }
          ]
        },
        { label: 'properties.label.borderWidth', type: 'number', target: 'style', key: 'borderWidth', min: 0, max: 20, step: 1 },
        { label: 'properties.label.borderColor', type: 'color', target: 'style', key: 'borderColor' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full overflow-hidden flex items-center justify-center" @dblclick="handleDblClick">
    <img 
      v-if="resolvedContent" 
      :src="resolvedContent" 
      class="w-full h-full object-contain pointer-events-none"
      alt="Element"
    />
    <span v-else class="text-gray-400 text-xs">No Image</span>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>
