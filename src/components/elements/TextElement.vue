<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  inject,
  type Ref,
} from "vue";
import type { PrintElement } from "@/types";
import { useDesignerStore } from "@/stores/designer";
import { normalizeVariableKey } from "@/utils/variables";
import { createFontGroups } from "@/utils/fonts";
import { useI18n } from "@/locales";
import AlignLeft from "~icons/material-symbols/format-align-left";
import AlignCenterHorizontal from "~icons/material-symbols/format-align-center";
import AlignRight from "~icons/material-symbols/format-align-right";
import Bold from "~icons/material-symbols/format-bold";
import Italic from "~icons/material-symbols/format-italic";
import FormatUnderlined from "~icons/material-symbols/format-underlined";
import TextRotateVertical from "~icons/material-symbols/text-rotate-vertical";

const props = defineProps<{
  element: PrintElement;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const isInlineEditing = ref(false);
const editingValue = ref("");
const editorRef = ref<HTMLTextAreaElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const isReadOnlyWrapper = ref(false);
const designerRoot = inject<Ref<HTMLElement | null>>(
  "designer-root",
  ref(null),
);
const modalContainer = inject<Ref<HTMLElement | null>>(
  "modal-container",
  ref(null),
);
const toolbarAnchorRect = ref<DOMRect | null>(null);
const canvasScrollContainerRef = ref<HTMLElement | null>(null);
let rootScrollEventTarget: EventTarget | null = null;

const resolvedText = computed(() => {
  const baseContent = props.element.content || "";
  const variable = props.element.variable || "";

  if (!variable) {
    return baseContent;
  }

  const key = normalizeVariableKey(variable);
  if (!key) {
    return baseContent;
  }

  let resolvedValue: string | null = null;

  if (
    store.isExporting &&
    (store as any).variables &&
    Object.prototype.hasOwnProperty.call((store as any).variables, key)
  ) {
    const value = (store as any).variables[key];
    if (value !== undefined && value !== null) {
      resolvedValue = String(value);
    }
  }

  if (
    resolvedValue === null &&
    Object.prototype.hasOwnProperty.call(store.testData, key)
  ) {
    const value = store.testData[key];
    if (value !== undefined && value !== null) {
      resolvedValue = String(value);
    }
  }

  if (resolvedValue !== null) {
    const targetToReplace = variable.startsWith("@") ? variable : `@${key}`;
    if (baseContent.includes(targetToReplace)) {
      const staticPrefix = baseContent.slice(
        0,
        baseContent.indexOf(targetToReplace),
      );
      if (staticPrefix && resolvedValue.startsWith(staticPrefix)) {
        return resolvedValue;
      }
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
  return (
    store.selectedElementId === props.element.id &&
    store.selectedElementIds.length <= 1
  );
});

const showQuickToolbar = computed(() => {
  return (
    isPrimarySelected.value &&
    store.showTextQuickToolbar &&
    !isInlineEditing.value &&
    !isReadOnlyWrapper.value
  );
});

const isToolbarDisabled = computed(() => {
  return !store.isTemplateEditable || props.element.locked;
});

const toolbarTeleportTarget = computed(
  () => designerRoot.value || modalContainer.value,
);

const updateToolbarAnchorRect = () => {
  if (!showQuickToolbar.value || !rootRef.value) {
    toolbarAnchorRect.value = null;
    return;
  }
  toolbarAnchorRect.value = rootRef.value.getBoundingClientRect();
};

const quickToolbarHostStyle = computed(
  () =>
    ({
      ...toolbarResetStyle,
      display: toolbarAnchorRect.value ? "block" : "none",
      position: "fixed",
      left: `${toolbarAnchorRect.value?.left ?? 0}px`,
      top: `${
        toolbarAnchorRect.value
          ? toolbarAnchorRect.value.top < 64
            ? toolbarAnchorRect.value.bottom + 8
            : Math.max(8, toolbarAnchorRect.value.top - 8)
          : 0
      }px`,
      transform:
        toolbarAnchorRect.value && toolbarAnchorRect.value.top < 64
          ? "none"
          : "translateY(-100%)",
      transformOrigin:
        toolbarAnchorRect.value && toolbarAnchorRect.value.top < 64
          ? "left top"
          : "left bottom",
    }) as Record<string, string>,
);

const toolbarResetStyle = {
  writingMode: "horizontal-tb",
  textOrientation: "mixed",
  direction: "ltr",
  textAlign: "left",
  fontStyle: "normal",
  fontWeight: "400",
  textDecoration: "none",
  textTransform: "none",
  letterSpacing: "normal",
  lineHeight: "normal",
  fontSize: "14px",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

const fontGroups = computed(() => createFontGroups(t, store.fontOptions));

const selectedFont = computed({
  get: () => props.element.style.fontFamily || "",
  set: (val: string) => {
    store.updateSelectedElementsStyle({ fontFamily: val });
  },
});

const selectedFontSize = computed({
  get: () => Number(props.element.style.fontSize || 12),
  set: (val: number) => {
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(200, Math.max(1, parsed));
    store.updateSelectedElementsStyle({ fontSize: clamped });
  },
});

const decreaseFontSize = () => {
  selectedFontSize.value = selectedFontSize.value - 1;
};

const increaseFontSize = () => {
  selectedFontSize.value = selectedFontSize.value + 1;
};

const isBold = computed(() => {
  return (
    props.element.style.fontWeight === "700" ||
    props.element.style.fontWeight === "bold"
  );
});

const isItalic = computed(() => {
  return props.element.style.fontStyle === "italic";
});

const isUnderline = computed(() => {
  return props.element.style.textDecoration === "underline";
});

const isVertical = computed(() => {
  return props.element.style.writingMode === "vertical-rl";
});

const activeTextAlign = computed(() => {
  return props.element.style.textAlign || "";
});

const activeVerticalAlign = computed(() => {
  return props.element.style.verticalAlign || "";
});

type HorizontalAlignment = "left" | "center" | "right";
type VerticalAlignment = "top" | "middle" | "bottom";
type AlignmentType = HorizontalAlignment | VerticalAlignment;
type AlignmentCycleStep = "element" | "content";

const createAlignmentCycle = (): Record<AlignmentType, AlignmentCycleStep> => ({
  left: "element",
  center: "element",
  right: "element",
  top: "element",
  middle: "element",
  bottom: "element",
});

const alignmentCycle = ref(createAlignmentCycle());
const isContentAlignmentMode = ref(false);
const hasAppliedContentAlignment = ref(false);

const resetAlignmentCycle = () => {
  alignmentCycle.value = createAlignmentCycle();
  isContentAlignmentMode.value = false;
  hasAppliedContentAlignment.value = false;
};

const isHorizontalAlignment = (
  type: AlignmentType,
): type is HorizontalAlignment => {
  return type === "left" || type === "center" || type === "right";
};

const setNextAlignmentCycleStep = (
  type: AlignmentType,
  step: AlignmentCycleStep,
) => {
  alignmentCycle.value = {
    ...alignmentCycle.value,
    [type]: step,
  };
};

const updateContentAlignment = (type: AlignmentType, toggle = true) => {
  if (isHorizontalAlignment(type)) {
    if (toggle && hasAppliedContentAlignment.value && activeTextAlign.value === type) {
      store.updateSelectedElementsStyle({ textAlign: "" });
      resetAlignmentCycle();
      return;
    }

    store.updateSelectedElementsStyle({ textAlign: type });
    hasAppliedContentAlignment.value = true;
    return;
  }

  if (toggle && hasAppliedContentAlignment.value && activeVerticalAlign.value === type) {
    store.updateSelectedElementsStyle({ verticalAlign: "" });
    resetAlignmentCycle();
    return;
  }

  store.updateSelectedElementsStyle({ verticalAlign: type });
  hasAppliedContentAlignment.value = true;
};

const handleAlignmentClick = (type: AlignmentType) => {
  if (isContentAlignmentMode.value) {
    updateContentAlignment(type);
    return;
  }

  const step = alignmentCycle.value[type];
  if (step === "element") {
    store.alignSelectedElements(type);
    setNextAlignmentCycleStep(type, "content");
    isContentAlignmentMode.value = true;
    return;
  }

  updateContentAlignment(type, false);
  isContentAlignmentMode.value = true;
};

const setTextAlign = (textAlign: HorizontalAlignment) => {
  handleAlignmentClick(textAlign);
};

const setVerticalAlign = (verticalAlign: VerticalAlignment) => {
  handleAlignmentClick(verticalAlign);
};

watch(
  () => store.selectedElementIds.join("|"),
  () => resetAlignmentCycle(),
);

const toggleBold = () => {
  store.updateSelectedElementsStyle({
    fontWeight: isBold.value ? "400" : "700",
  });
};

const toggleItalic = () => {
  store.updateSelectedElementsStyle({
    fontStyle: isItalic.value ? "normal" : "italic",
  });
};

const toggleUnderline = () => {
  store.updateSelectedElementsStyle({
    textDecoration: isUnderline.value ? "none" : "underline",
  });
};

const toggleVertical = () => {
  store.updateSelectedElementsStyle({
    writingMode: isVertical.value ? "horizontal-tb" : "vertical-rl",
  });
};

const justifyContent = computed(() => {
  const verticalAlign = props.element.style.verticalAlign;
  if (verticalAlign === "middle") return "center";
  if (verticalAlign === "bottom") return "flex-end";
  return "flex-start";
});

const startInlineEdit = async (event: MouseEvent) => {
  if (!canInlineEdit.value) return;
  const wrapper = (event.currentTarget as HTMLElement | null)?.closest(
    ".element-wrapper",
  );
  if (wrapper?.getAttribute("data-read-only") === "true") return;
  if (
    store.selectedElementId !== props.element.id &&
    !store.selectedElementIds.includes(props.element.id)
  )
    return;

  event.stopPropagation();
  editingValue.value = props.element.content || "";
  isInlineEditing.value = true;
  await nextTick();
  editorRef.value?.focus();
  editorRef.value?.select();
};

const commitInlineEdit = () => {
  if (!isInlineEditing.value) return;
  isInlineEditing.value = false;
  if (editingValue.value !== (props.element.content || "")) {
    store.updateElement(props.element.id, { content: editingValue.value });
  }
};

const cancelInlineEdit = () => {
  if (!isInlineEditing.value) return;
  isInlineEditing.value = false;
  editingValue.value = props.element.content || "";
};

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineEdit();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
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
  },
);

watch(isInlineEditing, (val) => {
  store.setDisableGlobalShortcuts(val);
});

watch(showQuickToolbar, (visible) => {
  if (!visible) {
    toolbarAnchorRect.value = null;
    return;
  }
  nextTick(updateToolbarAnchorRect);
});

watch(
  () => store.zoom,
  () => {
    if (!showQuickToolbar.value) return;
    nextTick(updateToolbarAnchorRect);
  },
);

watch(
  () => [
    props.element.x,
    props.element.y,
    props.element.width,
    props.element.height,
  ],
  () => {
    if (!showQuickToolbar.value) return;
    nextTick(updateToolbarAnchorRect);
  },
);

onMounted(() => {
  const wrapper = rootRef.value?.closest(".element-wrapper");
  isReadOnlyWrapper.value = wrapper?.getAttribute("data-read-only") === "true";

  canvasScrollContainerRef.value =
    rootRef.value?.closest(".canvas-scroll") ?? null;
  if (canvasScrollContainerRef.value) {
    canvasScrollContainerRef.value.addEventListener(
      "scroll",
      updateToolbarAnchorRect,
      { passive: true },
    );
  }

  const rootNode = rootRef.value?.getRootNode();
  if (rootNode && "addEventListener" in rootNode) {
    rootScrollEventTarget = rootNode as EventTarget;
    rootScrollEventTarget.addEventListener(
      "scroll",
      updateToolbarAnchorRect,
      true,
    );
  }

  window.addEventListener("resize", updateToolbarAnchorRect);
  window.addEventListener("scroll", updateToolbarAnchorRect, true);
  nextTick(updateToolbarAnchorRect);
});

onUnmounted(() => {
  if (canvasScrollContainerRef.value) {
    canvasScrollContainerRef.value.removeEventListener(
      "scroll",
      updateToolbarAnchorRect,
    );
  }
  if (rootScrollEventTarget) {
    rootScrollEventTarget.removeEventListener(
      "scroll",
      updateToolbarAnchorRect,
      true,
    );
    rootScrollEventTarget = null;
  }

  window.removeEventListener("resize", updateToolbarAnchorRect);
  window.removeEventListener("scroll", updateToolbarAnchorRect, true);
  if (isInlineEditing.value) {
    store.setDisableGlobalShortcuts(false);
  }
});
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from "@/types";
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: "properties.section.content",
      tab: "properties",
      fields: [
        {
          label: "properties.label.content",
          type: "textarea",
          target: "element",
          key: "content",
          placeholder: "properties.label.textContentPlaceholder",
        },
        {
          label: "properties.label.variable",
          type: "text",
          target: "element",
          key: "variable",
          placeholder: "@variable",
        },
      ],
    },
    {
      title: "properties.section.dataBehavior",
      tab: "properties",
      fields: [
        {
          label: "properties.label.autoHeight",
          type: "switch",
          target: "style",
          key: "autoHeight",
        },
      ],
    },
    {
      title: "properties.section.typography",
      tab: "style",
      fields: [
        {
          label: "properties.label.writingMode",
          type: "select",
          target: "style",
          key: "writingMode",
          options: [
            { label: "properties.option.horizontal", value: "horizontal-tb" },
            { label: "properties.option.vertical", value: "vertical-rl" },
          ],
        },
        {
          label: "properties.label.fontSize",
          type: "number",
          target: "style",
          key: "fontSize",
          min: 8,
          max: 96,
          step: 1,
        },
        {
          label: "properties.label.color",
          type: "color",
          target: "style",
          key: "color",
        },
        {
          label: "properties.label.textAlign",
          type: "select",
          target: "style",
          key: "textAlign",
          options: [
            { label: "properties.option.default", value: "" },
            { label: "properties.option.left", value: "left" },
            { label: "properties.option.center", value: "center" },
            { label: "properties.option.right", value: "right" },
          ],
        },
        {
          label: "properties.label.verticalAlign",
          type: "select",
          target: "style",
          key: "verticalAlign",
          options: [
            { label: "properties.option.default", value: "" },
            { label: "properties.option.top", value: "top" },
            { label: "properties.option.middle", value: "middle" },
            { label: "properties.option.bottom", value: "bottom" },
          ],
        },
        {
          label: "properties.label.fontFamily",
          type: "select",
          target: "style",
          key: "fontFamily",
          options: [
            { label: "properties.option.default", value: "" },
            { label: "properties.option.arial", value: "Arial, sans-serif" },
            {
              label: "properties.option.timesNewRoman",
              value: '"Times New Roman", serif',
            },
            {
              label: "properties.option.courierNew",
              value: '"Courier New", monospace',
            },
            { label: "properties.option.simSun", value: "SimSun, serif" },
            { label: "properties.option.simHei", value: "SimHei, sans-serif" },
          ],
        },
        {
          label: "properties.label.fontWeight",
          type: "select",
          target: "style",
          key: "fontWeight",
          options: [
            { label: "properties.option.default", value: "" },
            { label: "properties.option.normal", value: "400" },
            { label: "properties.option.medium", value: "500" },
            { label: "properties.option.bold", value: "700" },
          ],
        },
      ],
    },
    {
      title: "properties.section.border",
      tab: "style",
      fields: [
        {
          label: "properties.label.borderStyle",
          type: "select",
          target: "style",
          key: "borderStyle",
          options: [
            { label: "properties.option.none", value: "none" },
            { label: "properties.option.solid", value: "solid" },
            { label: "properties.option.dashed", value: "dashed" },
            { label: "properties.option.dotted", value: "dotted" },
          ],
        },
        {
          label: "properties.label.borderWidth",
          type: "number",
          target: "style",
          key: "borderWidth",
          min: 0,
          max: 20,
          step: 1,
        },
        {
          label: "properties.label.borderColor",
          type: "color",
          target: "style",
          key: "borderColor",
        },
      ],
    },
  ],
};
</script>

<template>
  <div ref="rootRef" class="relative w-full h-full overflow-visible">
    <Teleport
      v-if="showQuickToolbar && toolbarTeleportTarget"
      :to="toolbarTeleportTarget"
    >
      <div
        data-print-exclude="true"
        class="z-[1997] pointer-events-auto"
        :style="quickToolbarHostStyle"
        @mousedown.stop
        @click.stop
        @dblclick.stop
      >
        <div
          class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 px-2 shadow-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
        >
          <select
            v-model="selectedFont"
            :disabled="isToolbarDisabled"
            class="w-32 text-sm bg-transparent border-none outline-none focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200"
            :title="t('editor.fontFamily')"
          >
            <optgroup
              v-for="group in fontGroups"
              :key="group.label"
              :label="group.label"
              class="dark:bg-gray-800 dark:text-gray-200"
            >
              <option
                v-for="opt in group.options"
                :key="`${group.label}-${opt.value}`"
                :value="opt.value"
                class="dark:bg-gray-800 dark:text-gray-200"
              >
                {{ opt.label }}
              </option>
            </optgroup>
          </select>

          <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

          <div class="flex items-center gap-1">
            <button
              @click="decreaseFontSize"
              :disabled="isToolbarDisabled"
              class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <input
              type="number"
              v-model.number="selectedFontSize"
              :disabled="isToolbarDisabled"
              class="w-12 text-center text-sm bg-transparent dark:bg-gray-800 border-none outline-none focus:ring-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:text-gray-200"
              min="1"
              max="200"
            />
            <button
              @click="increaseFontSize"
              :disabled="isToolbarDisabled"
              class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>

          <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

          <button
            @click="setTextAlign('left')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeTextAlign === 'left',
            }"
            :title="t('editor.alignLeft')"
          >
            <AlignLeft class="w-4 h-4" />
          </button>
          <button
            @click="setTextAlign('center')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeTextAlign === 'center',
            }"
            :title="t('editor.alignCenter')"
          >
            <AlignCenterHorizontal class="w-4 h-4" />
          </button>
          <button
            @click="setTextAlign('right')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeTextAlign === 'right',
            }"
            :title="t('editor.alignRight')"
          >
            <AlignRight class="w-4 h-4" />
          </button>

          <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

          <button
            @click="setVerticalAlign('top')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeVerticalAlign === 'top',
            }"
            :title="t('editor.alignTop')"
          >
            <AlignLeft class="w-4 h-4 rotate-90" />
          </button>
          <button
            @click="setVerticalAlign('middle')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeVerticalAlign === 'middle',
            }"
            :title="t('editor.alignMiddle')"
          >
            <AlignCenterHorizontal class="w-4 h-4 rotate-90" />
          </button>
          <button
            @click="setVerticalAlign('bottom')"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                activeVerticalAlign === 'bottom',
            }"
            :title="t('editor.alignBottom')"
          >
            <AlignRight class="w-4 h-4 rotate-90" />
          </button>

          <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

          <button
            @click="toggleBold"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                isBold,
            }"
            :title="t('editor.bold')"
          >
            <Bold class="w-4 h-4" />
          </button>
          <button
            @click="toggleItalic"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                isItalic,
            }"
            :title="t('editor.italic')"
          >
            <Italic class="w-4 h-4" />
          </button>
          <button
            @click="toggleUnderline"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                isUnderline,
            }"
            :title="t('editor.underline')"
          >
            <FormatUnderlined class="w-4 h-4" />
          </button>
          <button
            @click="toggleVertical"
            :disabled="isToolbarDisabled"
            class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{
              'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
                isVertical,
            }"
            :title="t('editor.verticalText')"
          >
            <TextRotateVertical class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Teleport>

    <div
      class="w-full h-full overflow-hidden"
      @dblclick="startInlineEdit"
      :data-auto-height="element.style.autoHeight ? 'true' : undefined"
      data-text-content="true"
      :style="{
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
        writingMode: (element.style.writingMode as any) || 'horizontal-tb',
        whiteSpace: 'pre-wrap',
      }"
    >
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
          padding: `${element.style.padding || 0}px`,
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
