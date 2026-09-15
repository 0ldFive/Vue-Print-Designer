<script setup lang="ts">
import {
  watch,
  onMounted,
  onUnmounted,
  computed,
  inject,
  ref,
  defineAsyncComponent,
} from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { useTheme } from "@/composables/useTheme";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import Close from "~icons/material-symbols/close";
import Save from "~icons/material-symbols/save";
import ContentCopy from "~icons/material-symbols/content-copy";
import Check from "~icons/material-symbols/check";
import Help from "~icons/material-symbols/help";

const Editor = defineAsyncComponent(() =>
  import("@guolao/vue-monaco-editor").then((m) => m.Editor),
);

const { t } = useI18n();
const { isDark } = useTheme();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const props = defineProps<{
  visible: boolean;
  title: string;
  value: string;
  language: string;
  readOnly?: boolean;
  showCopyButton?: boolean;
  showSaveButton?: boolean;
  /** Translated help items; when set, a help tooltip is available in the header. */
  helpItems?: string[];
}>();

const emit = defineEmits<{
  (e: "update:visible", visible: boolean): void;
  (e: "update:value", value: string): void;
  (e: "close"): void;
  (e: "save"): void;
}>();

const store = useDesignerStore();

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
});

const editorOptions = computed(() => ({
  minimap: { enabled: true },
  lineNumbers: "on",
  glyphMargin: false,
  folding: true,
  wordWrap: "on",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  theme: isDark.value ? "vs-dark" : "vs",
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  renderLineHighlight: "none",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: true,
}));

const shouldShowCopyButton = computed(
  () => props.showCopyButton ?? !!props.readOnly,
);

const isReadOnly = computed(() => !!props.readOnly);

const shouldShowSaveButton = computed(
  () => (props.showSaveButton ?? false) && !isReadOnly.value,
);

const accessModeLabel = computed(() => {
  return isReadOnly.value
    ? t("common.readOnly") || "Read Only"
    : t("common.readWrite") || "Read/Write";
});

const accessModeClass = computed(() => {
  return isReadOnly.value
    ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
    : "theme-bg text-white";
});

const copyState = ref<"idle" | "success">("idle");
let copyStateTimer: number | null = null;

const copyButtonLabel = computed(() => {
  if (copyState.value === "success") {
    return t("common.copied") || "Copied";
  }
  return t("common.copy") || "Copy";
});

const resetCopyState = () => {
  if (copyStateTimer !== null) {
    window.clearTimeout(copyStateTimer);
    copyStateTimer = null;
  }
  copyState.value = "idle";
};

const showCopySuccessFeedback = () => {
  copyState.value = "success";
  if (copyStateTimer !== null) {
    window.clearTimeout(copyStateTimer);
  }
  copyStateTimer = window.setTimeout(() => {
    copyState.value = "idle";
    copyStateTimer = null;
  }, 1500);
};

const copyWithExecCommand = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

const handleCopy = async () => {
  const text = props.value || "";
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showCopySuccessFeedback();
      return;
    }
    if (copyWithExecCommand(text)) {
      showCopySuccessFeedback();
    }
  } catch {
    if (copyWithExecCommand(text)) {
      showCopySuccessFeedback();
    }
  }
};

const handleChange = (val: string | undefined) => {
  emit("update:value", val || "");
};

const handleClose = () => {
  emit("update:visible", false);
  emit("close");
};

const handleSave = () => {
  emit("save");
};

const handleKeydown = (e: KeyboardEvent) => {
  if (props.visible && e.key === "Escape") {
    handleClose();
  }
};

watch(
  () => props.visible,
  (val) => {
    store.setDisableGlobalShortcuts(val);
    if (!val) {
      resetCopyState();
    }
  },
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  resetCopyState();
  window.removeEventListener("keydown", handleKeydown);
  if (props.visible) {
    store.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      v-if="visible"
      :class="{ dark: isDark }"
      class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto"
      @click.self="handleClose"
    >
      <div
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[60vw] h-[80vh] flex flex-col overflow-hidden animate-fade-in"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0"
        >
          <div class="flex items-center gap-2">
            <h3
              class="text-base font-semibold text-gray-800 dark:text-gray-100"
            >
              {{ title }}
            </h3>
            <button
              v-if="helpItems && helpItems.length"
              ref="helpButtonRef"
              type="button"
              class="inline-flex items-center justify-center p-0.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              :aria-label="title"
              :aria-expanded="showHelp"
              @mousedown.stop.prevent="toggleHelp"
            >
              <Help class="w-4 h-4" />
            </button>
            <span
              class="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-mono uppercase"
              >{{ language }}</span
            >
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              :class="accessModeClass"
            >
              {{ accessModeLabel }}
            </span>
          </div>
          <button
            @click="handleClose"
            class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
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
        <div
          class="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2.5 rounded-b-lg shrink-0"
        >
          <button
            v-if="shouldShowSaveButton"
            @click="handleSave"
            class="flex items-center gap-1.5 px-3 py-1.5 theme-bg-strong text-white rounded hover:opacity-90 transition-opacity text-xs"
          >
            <Save class="w-4 h-4" />
            {{ t("common.save") }}
          </button>
          <button
            v-if="shouldShowCopyButton"
            @click="handleCopy"
            class="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 font-medium rounded transition-colors text-xs min-w-[64px]"
            :class="
              copyState === 'success'
                ? 'theme-border theme-bg text-white'
                : 'border-gray-300 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            <Check v-if="copyState === 'success'" class="w-4 h-4" />
            <ContentCopy v-else class="w-4 h-4" />
            {{ copyButtonLabel }}
          </button>
          <button
            @click="handleClose"
            class="whitespace-nowrap px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <Close class="w-4 h-4" />
            {{ t("common.close") }}
          </button>
        </div>
      </div>

      <!-- Header Help Tooltip (sibling of the dialog so it stays on top) -->
      <div
        v-if="helpItems && helpItems.length && showHelp"
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
            <ul
              class="min-w-0 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
            >
              <li v-for="item in helpItems" :key="item">{{ item }}</li>
            </ul>
          </div>
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
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
