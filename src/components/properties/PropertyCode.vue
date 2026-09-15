<script setup lang="ts">
import {
  ref,
  inject,
  watch,
  onMounted,
  onUnmounted,
  computed,
  defineAsyncComponent,
  type Ref,
} from "vue";
import { useDesignerStore } from "@/stores/designer";
import { useTheme } from "@/composables/useTheme";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import CodeEditorModal from "@/components/common/CodeEditorModal.vue";
import OpenInFull from "~icons/material-symbols/open-in-full";
import Close from "~icons/material-symbols/close";
import Help from "~icons/material-symbols/help";

const Editor = defineAsyncComponent(() =>
  import("@guolao/vue-monaco-editor").then((m) => m.Editor),
);

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    language: string;
    disabled?: boolean;
    height?: number;
    /** Hide the built-in title bar when the caller renders its own header. */
    showHeader?: boolean;
    /** Translated help text; when set, a help icon is shown next to the label. */
    helpText?: string;
    /** Translated help items shown in the expanded editor modal's help tooltip. */
    modalHelpItems?: string[];
  }>(),
  // Explicit default: a boolean prop that is absent would otherwise be cast to
  // false by Vue, hiding the header for every caller.
  { showHeader: true },
);

const emit = defineEmits(["update:value"]);
const store = useDesignerStore();
const { isDark } = useTheme();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const showHelp = ref(false);
const helpButtonRef = ref<HTMLElement | null>(null);
const helpTooltipRef = ref<HTMLElement | null>(null);
const {
  arrowStyle: helpArrowStyle,
  placement: helpPlacement,
  toggleTooltip: toggleHelp,
  tooltipStyle: helpTooltipStyle,
} = useFloatingTooltip(showHelp, helpButtonRef, helpTooltipRef, {
  width: 320,
  preferredPlacement: "top",
  horizontalAlign: "left",
});

const isExpanded = ref(false);

const editorOptions = computed(() => ({
  minimap: { enabled: false },
  lineNumbers: "on",
  glyphMargin: false,
  folding: true,
  wordWrap: "on",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: isDark.value ? "vs-dark" : "vs",
  fontSize: 12,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: "none",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
}));

const handleChange = (val: string | undefined) => {
  emit("update:value", val || "");
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const handleModalClose = () => {
  isExpanded.value = false;
};

const handleModalUpdate = (val: string) => {
  emit("update:value", val);
};

// Let callers that hide the built-in header trigger the expanded editor.
defineExpose({ toggleExpand, isExpanded });
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-if="showHeader !== false" class="flex justify-between items-center">
      <div class="flex items-center gap-1 min-w-0">
        <label class="text-xs text-gray-500 font-medium">{{ label }}</label>
        <button
          v-if="helpText"
          ref="helpButtonRef"
          type="button"
          class="shrink-0 inline-flex items-center justify-center p-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          :aria-label="label"
          :aria-expanded="showHelp"
          @mousedown.stop.prevent="toggleHelp"
        >
          <Help class="w-4 h-4" />
        </button>
      </div>
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

    <!-- Field Help Tooltip (same layering and styling as the panel-top help) -->
    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="helpText && showHelp"
        ref="helpTooltipRef"
        role="tooltip"
        class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
        :style="helpTooltipStyle"
        @click.stop
      >
        <div
          v-if="helpPlacement === 'bottom'"
          class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="helpArrowStyle"
        ></div>
        <div
          v-else
          class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="helpArrowStyle"
        ></div>
        <div
          class="overflow-y-auto p-3"
          :style="{ maxHeight: helpTooltipStyle.maxHeight }"
        >
          <div class="flex items-start gap-2">
            <Help
              class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
            />
            <p class="min-w-0 text-xs leading-5 text-gray-600 dark:text-gray-300">
              {{ helpText }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Inline Editor -->
    <div
      class="border border-gray-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 resize-y relative group"
      :style="{
        height: `${height || 200}px`,
        minHeight: '100px',
        maxHeight: '600px',
      }"
    >
      <Editor
        :value="value"
        :language="language"
        :options="{ ...editorOptions, readOnly: disabled }"
        @update:value="handleChange"
        class="w-full h-full"
      />
      <!-- Resize Handle Visual Hint (optional, standard resize handle is usually bottom-right) -->
      <div
        class="absolute bottom-0 right-0 w-3 h-3 cursor-ns-resize pointer-events-none bg-gradient-to-tl from-gray-300 to-transparent opacity-50 group-hover:opacity-100"
      ></div>
    </div>

    <!-- Expanded Modal -->
    <CodeEditorModal
      v-model:visible="isExpanded"
      :title="label"
      :value="value"
      :language="language"
      :read-only="disabled"
      :help-items="modalHelpItems"
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
