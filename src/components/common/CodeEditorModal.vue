<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { Editor } from '@guolao/vue-monaco-editor';
import { useDesignerStore } from '@/stores/designer';
import Close from '~icons/material-symbols/close';

const props = defineProps<{
  visible: boolean;
  title: string;
  value: string;
  language: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void;
  (e: 'update:value', value: string): void;
  (e: 'close'): void;
}>();

const store = useDesignerStore();

const editorOptions = {
  minimap: { enabled: true },
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  wordWrap: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: 'vs',
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: true,
};

const handleChange = (val: string | undefined) => {
  emit('update:value', val || '');
};

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === 'Escape') {
    handleClose();
  }
};

watch(() => props.visible, (val) => {
  store.setDisableGlobalShortcuts(val);
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (props.visible) {
    store.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="bg-white rounded-lg shadow-xl w-[60vw] h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        <!-- Header -->
        <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold text-gray-800">{{ title }}</h3>
            <span class="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-mono">{{ language }}</span>
          </div>
          <button @click="handleClose" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <Close class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden relative">
          <Editor
            :value="value"
            :language="language"
            :options="{ ...editorOptions, readOnly: readOnly }"
            @update:value="handleChange"
            class="w-full h-full"
          />
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-b-lg">
          <button 
            @click="handleClose"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
