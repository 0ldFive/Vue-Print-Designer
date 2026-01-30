<script setup lang="ts">
import { ref, watch } from 'vue';
import { Editor } from '@guolao/vue-monaco-editor';

const props = defineProps<{
  label: string;
  value: string;
  language: string;
  disabled?: boolean;
  height?: number;
}>();

const emit = defineEmits(['update:value']);

const editorOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  wordWrap: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: 'vs',
  fontSize: 12,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
};

const handleChange = (val: string | undefined) => {
  emit('update:value', val || '');
};
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex justify-between items-center">
      <label class="text-xs text-gray-500 font-medium">{{ label }}</label>
      <span class="text-[10px] text-gray-400 uppercase">{{ language }}</span>
    </div>
    <div 
      class="border border-gray-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
      :style="{ height: `${height || 200}px` }"
    >
      <Editor
        :value="value"
        :language="language"
        :options="{ ...editorOptions, readOnly: disabled }"
        @update:value="handleChange"
        class="w-full h-full"
      />
    </div>
  </div>
</template>
