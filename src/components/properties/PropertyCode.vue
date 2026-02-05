<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { Editor } from '@guolao/vue-monaco-editor';
import { useDesignerStore } from '@/stores/designer';
import { useTheme } from '@/composables/useTheme';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import OpenInFull from '~icons/material-symbols/open-in-full';
import Close from '~icons/material-symbols/close';

const props = defineProps<{
  label: string;
  value: string;
  language: string;
  disabled?: boolean;
  height?: number;
}>();

const emit = defineEmits(['update:value']);
const store = useDesignerStore();
const { isDark } = useTheme();

const isExpanded = ref(false);

const editorOptions = computed(() => ({
  minimap: { enabled: false },
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  wordWrap: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: isDark.value ? 'vs-dark' : 'vs',
  fontSize: 12,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
}));

const handleChange = (val: string | undefined) => {
  emit('update:value', val || '');
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleModalClose = () => {
  isExpanded.value = false;
};

const handleModalUpdate = (val: string) => {
  emit('update:value', val);
};
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex justify-between items-center">
      <label class="text-xs text-gray-500 font-medium">{{ label }}</label>
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-gray-400 uppercase">{{ language }}</span>
        <button 
          @click="toggleExpand"
          class="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
          title="Expand Editor"
        >
          <OpenInFull class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    
    <!-- Inline Editor -->
    <div 
      class="border border-gray-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 resize-y relative group"
      :style="{ height: `${height || 200}px`, minHeight: '100px', maxHeight: '600px' }"
    >
      <Editor
        :value="value"
        :language="language"
        :options="{ ...editorOptions, readOnly: disabled }"
        @update:value="handleChange"
        class="w-full h-full"
      />
      <!-- Resize Handle Visual Hint (optional, standard resize handle is usually bottom-right) -->
      <div class="absolute bottom-0 right-0 w-3 h-3 cursor-ns-resize pointer-events-none bg-gradient-to-tl from-gray-300 to-transparent opacity-50 group-hover:opacity-100"></div>
    </div>

    <!-- Expanded Modal -->
    <CodeEditorModal
      v-model:visible="isExpanded"
      :title="label"
      :value="value"
      :language="language"
      :read-only="disabled"
      @update:value="handleModalUpdate"
      @close="handleModalClose"
    />
  </div>
</template>

<style scoped>
/* Ensure the resize handle works */
.resize-y {
  resize: vertical; 
}
</style>
