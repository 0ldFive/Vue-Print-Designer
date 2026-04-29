<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import { normalizeVariableKey } from '@/utils/variables';

const props = defineProps<{
  element: PrintElement;
}>();

const store = useDesignerStore();
const isInlineEditing = ref(false);
const editingValue = ref('');
const editorRef = ref<HTMLTextAreaElement | null>(null);

const resolvedText = computed(() => {
  const variable = props.element.variable || '';
  if (store.isExporting && variable) {
      const key = normalizeVariableKey(variable);
      if (key && (store as any).variables && Object.prototype.hasOwnProperty.call((store as any).variables, key)) {
        const value = (store as any).variables[key];
        if (value !== undefined && value !== null) {
          return String(value);
        }
      }
    
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  // 即使不是导出模式，只要有 testData 并且有匹配的 variable，就展示 testData
  if (!store.isExporting && props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    if (key && Object.prototype.hasOwnProperty.call(store.testData, key)) {
      const value = store.testData[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
  }

  if (props.element.variable) {
    const key = normalizeVariableKey(props.element.variable);
    if (!key) return props.element.content;
    return `@${key}`;
  }
  return props.element.content;
});

const canInlineEdit = computed(() => {
  return store.isTemplateEditable && !props.element.locked;
});

const justifyContent = computed(() => {
  const verticalAlign = props.element.style.verticalAlign;
  if (verticalAlign === 'middle') return 'center';
  if (verticalAlign === 'bottom') return 'flex-end';
  return 'flex-start';
});

const startInlineEdit = async (event: MouseEvent) => {
  if (!canInlineEdit.value) return;
  const wrapper = (event.currentTarget as HTMLElement | null)?.closest('.element-wrapper');
  if (wrapper?.getAttribute('data-read-only') === 'true') return;
  if (store.selectedElementId !== props.element.id && !store.selectedElementIds.includes(props.element.id)) return;

  event.stopPropagation();
  editingValue.value = props.element.content || '';
  isInlineEditing.value = true;
  await nextTick();
  editorRef.value?.focus();
  editorRef.value?.select();
};

const commitInlineEdit = () => {
  if (!isInlineEditing.value) return;
  isInlineEditing.value = false;
  if (editingValue.value !== (props.element.content || '')) {
    store.updateElement(props.element.id, { content: editingValue.value });
  }
};

const cancelInlineEdit = () => {
  if (!isInlineEditing.value) return;
  isInlineEditing.value = false;
  editingValue.value = props.element.content || '';
};

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelInlineEdit();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    commitInlineEdit();
  }
};

watch(
  () => store.selectedElementId,
  (id) => {
    if (id !== props.element.id) {
      commitInlineEdit();
    }
  }
);
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'properties.section.content',
      tab: 'properties',
      fields: [
        { label: 'properties.label.content', type: 'textarea', target: 'element', key: 'content', placeholder: 'properties.label.textContentPlaceholder' },
        { label: 'properties.label.variable', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'properties.section.dataBehavior',
      tab: 'properties',
      fields: [
        { label: 'properties.label.autoHeight', type: 'switch', target: 'style', key: 'autoHeight' }
      ]
    },
    {
      title: 'properties.section.typography',
      tab: 'style',
      fields: [
        { label: 'properties.label.writingMode', type: 'select', target: 'style', key: 'writingMode', options: [
            { label: 'properties.option.horizontal', value: 'horizontal-tb' },
            { label: 'properties.option.vertical', value: 'vertical-rl' }
          ] 
        },
        { label: 'properties.label.fontSize', type: 'number', target: 'style', key: 'fontSize', min: 8, max: 96, step: 1 },
        { label: 'properties.label.color', type: 'color', target: 'style', key: 'color' },
        {
          label: 'properties.label.textAlign',
          type: 'select',
          target: 'style',
          key: 'textAlign',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.left', value: 'left' },
            { label: 'properties.option.center', value: 'center' },
            { label: 'properties.option.right', value: 'right' }
          ]
        },
        {
          label: 'properties.label.verticalAlign',
          type: 'select',
          target: 'style',
          key: 'verticalAlign',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.top', value: 'top' },
            { label: 'properties.option.middle', value: 'middle' },
            { label: 'properties.option.bottom', value: 'bottom' }
          ]
        },
        {
          label: 'properties.label.fontFamily',
          type: 'select',
          target: 'style',
          key: 'fontFamily',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.arial', value: 'Arial, sans-serif' },
            { label: 'properties.option.timesNewRoman', value: '"Times New Roman", serif' },
            { label: 'properties.option.courierNew', value: '"Courier New", monospace' },
            { label: 'properties.option.simSun', value: 'SimSun, serif' },
            { label: 'properties.option.simHei', value: 'SimHei, sans-serif' }
          ]
        },
        {
          label: 'properties.label.fontWeight',
          type: 'select',
          target: 'style',
          key: 'fontWeight',
          options: [
            { label: 'properties.option.default', value: '' },
            { label: 'properties.option.normal', value: '400' },
            { label: 'properties.option.medium', value: '500' },
            { label: 'properties.option.bold', value: '700' }
          ]
        }
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
  <div class="w-full h-full overflow-hidden" @dblclick="startInlineEdit" :data-auto-height="element.style.autoHeight ? 'true' : undefined" :style="{
    display: 'flex',
    flexDirection: 'column',
    justifyContent,
    fontSize: `${element.style.fontSize}px`,
    fontFamily: element.style.fontFamily,
    fontWeight: element.style.fontWeight,
    fontStyle: element.style.fontStyle,
    textAlign: element.style.textAlign,
    textDecoration: element.style.textDecoration,
    color: element.style.color,
    padding: `${element.style.padding || 0}px`,
    writingMode: element.style.writingMode as any || 'horizontal-tb',
    whiteSpace: 'pre-wrap'
  }">
    <textarea
      v-if="isInlineEditing"
      ref="editorRef"
      v-model="editingValue"
      class="w-full h-full resize-none bg-transparent outline-none"
      :style="{
        fontSize: `${element.style.fontSize}px`,
        fontFamily: element.style.fontFamily,
        fontWeight: element.style.fontWeight,
        fontStyle: element.style.fontStyle,
        textAlign: element.style.textAlign,
        color: element.style.color,
        padding: `${element.style.padding || 0}px`
      }"
      @mousedown.stop
      @click.stop
      @blur="commitInlineEdit"
      @keydown="handleEditorKeydown"
    />
    <template v-else>{{ resolvedText }}</template>
  </div>
</template>
