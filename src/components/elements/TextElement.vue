<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import { normalizeVariableKey } from '@/utils/variables';
import { useI18n } from 'vue-i18n';
import AlignLeft from '~icons/material-symbols/format-align-left';
import AlignCenterHorizontal from '~icons/material-symbols/format-align-center';
import AlignRight from '~icons/material-symbols/format-align-right';
import AlignStartVertical from '~icons/material-symbols/vertical-align-top';
import AlignCenterVertical from '~icons/material-symbols/vertical-align-center';
import AlignEndVertical from '~icons/material-symbols/vertical-align-bottom';
import Bold from '~icons/material-symbols/format-bold';
import Italic from '~icons/material-symbols/format-italic';
import FormatUnderlined from '~icons/material-symbols/format-underlined';
import TextRotateVertical from '~icons/material-symbols/text-rotate-vertical';

const props = defineProps<{
  element: PrintElement;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const isInlineEditing = ref(false);
const editingValue = ref('');
const editorRef = ref<HTMLTextAreaElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const isReadOnlyWrapper = ref(false);

const resolvedText = computed(() => {
  const baseContent = props.element.content || '';
  const variable = props.element.variable || '';
  
  if (!variable) {
    return baseContent;
  }

  const key = normalizeVariableKey(variable);
  if (!key) {
    return baseContent;
  }

  let resolvedValue: string | null = null;

  if (store.isExporting && (store as any).variables && Object.prototype.hasOwnProperty.call((store as any).variables, key)) {
    const value = (store as any).variables[key];
    if (value !== undefined && value !== null) {
      resolvedValue = String(value);
    }
  }

  if (resolvedValue === null && Object.prototype.hasOwnProperty.call(store.testData, key)) {
    const value = store.testData[key];
    if (value !== undefined && value !== null) {
      resolvedValue = String(value);
    }
  }

  if (resolvedValue !== null) {
    const targetToReplace = variable.startsWith('@') ? variable : `@${key}`;
    if (baseContent.includes(targetToReplace)) {
      return baseContent.replace(targetToReplace, resolvedValue);
    }
    return resolvedValue;
  }

  return baseContent || `@${key}`;
});

const canInlineEdit = computed(() => {
  return store.isTemplateEditable && !props.element.locked;
});

const isPrimarySelected = computed(() => {
  return store.selectedElementId === props.element.id && store.selectedElementIds.length <= 1;
});

const showQuickToolbar = computed(() => {
  return isPrimarySelected.value && !isInlineEditing.value && !isReadOnlyWrapper.value;
});

const isToolbarDisabled = computed(() => {
  return !store.isTemplateEditable || props.element.locked;
});

const inverseZoom = computed(() => {
  return store.zoom > 0 ? 1 / store.zoom : 1;
});

const quickToolbarHostStyle = computed(() => ({
  ...toolbarResetStyle,
  bottom: 'calc(100% + 8px)',
  transform: `scale(${inverseZoom.value})`,
  transformOrigin: 'left bottom'
}));

const toolbarResetStyle = {
  writingMode: 'horizontal-tb',
  textOrientation: 'mixed',
  direction: 'ltr',
  textAlign: 'left',
  fontStyle: 'normal',
  fontWeight: '400',
  textDecoration: 'none',
  textTransform: 'none',
  letterSpacing: 'normal',
  lineHeight: 'normal',
  fontSize: '14px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
} as const;

const defaultFontOptions = computed(() => [
  { label: t('editor.fonts.default'), value: '' },
  { label: t('editor.fonts.arial'), value: 'Arial, sans-serif' },
  { label: t('editor.fonts.timesNewRoman'), value: '"Times New Roman", serif' },
  { label: t('editor.fonts.courierNew'), value: '"Courier New", monospace' },
  { label: t('editor.fonts.simSun'), value: 'SimSun, serif' },
  { label: t('editor.fonts.simHei'), value: 'SimHei, sans-serif' }
]);

const fontOptions = computed(() => {
  const customOptions = store.fontOptions || [];
  if (!customOptions.length) {
    return defaultFontOptions.value;
  }

  const normalizedCustom = customOptions.map((opt) => ({
    label: (opt.label || opt.value || '').trim(),
    value: opt.value
  }));
  const hasDefaultOption = normalizedCustom.some((opt) => opt.value === '');

  if (hasDefaultOption) {
    return normalizedCustom;
  }

  return [{ label: t('editor.fonts.default'), value: '' }, ...normalizedCustom];
});

const selectedFont = computed({
  get: () => props.element.style.fontFamily || '',
  set: (val: string) => {
    store.updateSelectedElementsStyle({ fontFamily: val });
  }
});

const selectedFontSize = computed({
  get: () => Number(props.element.style.fontSize || 12),
  set: (val: number) => {
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(200, Math.max(1, parsed));
    store.updateSelectedElementsStyle({ fontSize: clamped });
  }
});

const decreaseFontSize = () => {
  selectedFontSize.value = selectedFontSize.value - 1;
};

const increaseFontSize = () => {
  selectedFontSize.value = selectedFontSize.value + 1;
};

const isBold = computed(() => {
  return props.element.style.fontWeight === '700' || props.element.style.fontWeight === 'bold';
});

const isItalic = computed(() => {
  return props.element.style.fontStyle === 'italic';
});

const isUnderline = computed(() => {
  return props.element.style.textDecoration === 'underline';
});

const isVertical = computed(() => {
  return props.element.style.writingMode === 'vertical-rl';
});

const activeTextAlign = computed(() => {
  return props.element.style.textAlign || '';
});

const activeVerticalAlign = computed(() => {
  return props.element.style.verticalAlign || '';
});

const setTextAlign = (textAlign: 'left' | 'center' | 'right') => {
  const nextTextAlign = activeTextAlign.value === textAlign ? '' : textAlign;
  store.updateSelectedElementsStyle({ textAlign: nextTextAlign });
};

const setVerticalAlign = (verticalAlign: 'top' | 'middle' | 'bottom') => {
  const nextVerticalAlign = activeVerticalAlign.value === verticalAlign ? '' : verticalAlign;
  store.updateSelectedElementsStyle({ verticalAlign: nextVerticalAlign });
};

const toggleBold = () => {
  store.updateSelectedElementsStyle({ fontWeight: isBold.value ? '400' : '700' });
};

const toggleItalic = () => {
  store.updateSelectedElementsStyle({ fontStyle: isItalic.value ? 'normal' : 'italic' });
};

const toggleUnderline = () => {
  store.updateSelectedElementsStyle({ textDecoration: isUnderline.value ? 'none' : 'underline' });
};

const toggleVertical = () => {
  store.updateSelectedElementsStyle({ writingMode: isVertical.value ? 'horizontal-tb' : 'vertical-rl' });
};

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

watch(isInlineEditing, (val) => {
  store.setDisableGlobalShortcuts(val);
});

onMounted(() => {
  const wrapper = rootRef.value?.closest('.element-wrapper');
  isReadOnlyWrapper.value = wrapper?.getAttribute('data-read-only') === 'true';
});

onUnmounted(() => {
  if (isInlineEditing.value) {
    store.setDisableGlobalShortcuts(false);
  }
});
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
  <div ref="rootRef" class="relative w-full h-full overflow-visible">
    <div
      v-if="showQuickToolbar"
      data-print-exclude="true"
      class="absolute left-0 z-[70]"
      :style="quickToolbarHostStyle"
      @mousedown.stop
      @click.stop
      @dblclick.stop
    >
      <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 px-2 shadow-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
        <select
          v-model="selectedFont"
          :disabled="isToolbarDisabled"
          class="w-32 text-sm bg-transparent border-none outline-none focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200"
          :title="t('editor.fontFamily')"
        >
          <option v-for="opt in fontOptions" :key="opt.value" :value="opt.value" class="dark:bg-gray-800 dark:text-gray-200">
            {{ opt.label }}
          </option>
        </select>

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

        <div class="flex items-center gap-1">
          <button @click="decreaseFontSize" :disabled="isToolbarDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">-</button>
          <input
            type="number"
            v-model.number="selectedFontSize"
            :disabled="isToolbarDisabled"
            class="w-12 text-center text-sm bg-transparent dark:bg-gray-800 border-none outline-none focus:ring-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:text-gray-200"
            min="1"
            max="200"
          />
          <button @click="increaseFontSize" :disabled="isToolbarDisabled" class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">+</button>
        </div>

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

        <button
          @click="setTextAlign('left')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeTextAlign === 'left' }"
          :title="t('editor.alignLeft')"
        >
          <AlignLeft class="w-4 h-4" />
        </button>
        <button
          @click="setTextAlign('center')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeTextAlign === 'center' }"
          :title="t('editor.alignCenter')"
        >
          <AlignCenterHorizontal class="w-4 h-4" />
        </button>
        <button
          @click="setTextAlign('right')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeTextAlign === 'right' }"
          :title="t('editor.alignRight')"
        >
          <AlignRight class="w-4 h-4" />
        </button>

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

        <button
          @click="setVerticalAlign('top')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeVerticalAlign === 'top' }"
          :title="t('editor.alignTop')"
        >
          <AlignStartVertical class="w-4 h-4" />
        </button>
        <button
          @click="setVerticalAlign('middle')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeVerticalAlign === 'middle' }"
          :title="t('editor.alignMiddle')"
        >
          <AlignCenterVertical class="w-4 h-4" />
        </button>
        <button
          @click="setVerticalAlign('bottom')"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': activeVerticalAlign === 'bottom' }"
          :title="t('editor.alignBottom')"
        >
          <AlignEndVertical class="w-4 h-4" />
        </button>

        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

        <button
          @click="toggleBold"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isBold }"
          :title="t('editor.bold')"
        >
          <Bold class="w-4 h-4" />
        </button>
        <button
          @click="toggleItalic"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isItalic }"
          :title="t('editor.italic')"
        >
          <Italic class="w-4 h-4" />
        </button>
        <button
          @click="toggleUnderline"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isUnderline }"
          :title="t('editor.underline')"
        >
          <FormatUnderlined class="w-4 h-4" />
        </button>
        <button
          @click="toggleVertical"
          :disabled="isToolbarDisabled"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400': isVertical }"
          :title="t('editor.verticalText')"
        >
          <TextRotateVertical class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="w-full h-full overflow-hidden" @dblclick="startInlineEdit" :data-auto-height="element.style.autoHeight ? 'true' : undefined" data-text-content="true" :style="{
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
  </div>
</template>
