<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Editor } from '@guolao/vue-monaco-editor';
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

const isExpanded = ref(false);

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

const expandedEditorOptions = {
  ...editorOptions,
  minimap: { enabled: true },
  fontSize: 14,
  contextmenu: true,
};

const handleChange = (val: string | undefined) => {
  emit('update:value', val || '');
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (isExpanded.value && e.key === 'Escape') {
    toggleExpand();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
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
    <Teleport to="body">
      <div v-if="isExpanded" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="toggleExpand">
        <div class="bg-white rounded-lg shadow-xl w-[80vw] h-[80vh] flex flex-col overflow-hidden animate-fade-in">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-gray-800">{{ label }}</h3>
              <span class="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-xs font-mono">{{ language }}</span>
            </div>
            <button @click="toggleExpand" class="text-gray-500 hover:text-gray-700">
              <Close class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden relative">
            <Editor
              :value="value"
              :language="language"
              :options="{ ...expandedEditorOptions, readOnly: disabled }"
              @update:value="handleChange"
              class="w-full h-full"
            />
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-b-lg">
            <button 
              @click="toggleExpand"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Ensure the resize handle works */
.resize-y {
  resize: vertical; 
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
