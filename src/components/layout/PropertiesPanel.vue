<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { toast } from "@/utils/toast";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import {
  ElementType,
  type ElementPropertiesSchema,
  type PropertyField,
  type PrintElement,
} from "@/types";
import { elementPropertiesSchema as TextSchema } from "@/components/elements/TextElement.vue";
import { elementPropertiesSchema as ImageSchema } from "@/components/elements/ImageElement.vue";
import { elementPropertiesSchema as TableSchema } from "@/components/elements/TableElement.vue";
import { elementPropertiesSchema as PagerSchema } from "@/components/elements/PageNumberElement.vue";
import { elementPropertiesSchema as BarcodeSchema } from "@/components/elements/BarcodeElement.vue";
import { elementPropertiesSchema as QrCodeSchema } from "@/components/elements/QRCodeElement.vue";
import { elementPropertiesSchema as LineSchema } from "@/components/elements/LineElement.vue";
import { elementPropertiesSchema as RectSchema } from "@/components/elements/RectElement.vue";
import { elementPropertiesSchema as CircleSchema } from "@/components/elements/CircleElement.vue";
import { pxToUnit, unitToPx, type Unit } from "@/utils/units";
import PropertyInput from "@/components/properties/PropertyInput.vue";
import PropertySelect from "@/components/properties/PropertySelect.vue";
import PropertyColor from "@/components/properties/PropertyColor.vue";
import PropertyCode from "@/components/properties/PropertyCode.vue";
import PropertyImage from "@/components/properties/PropertyImage.vue";
import Lock from "~icons/material-symbols/lock";
import ContentCopy from "~icons/material-symbols/content-copy";
import Check from "~icons/material-symbols/check";
import Save from "~icons/material-symbols/save";
import Delete from "~icons/material-symbols/delete";
import FormatAlignLeft from "~icons/material-symbols/format-align-left";
import FormatAlignCenter from "~icons/material-symbols/format-align-center";
import FormatAlignRight from "~icons/material-symbols/format-align-right";
import BringToFrontIcon from "~icons/material-symbols/vertical-align-top";
import SendToBackIcon from "~icons/material-symbols/vertical-align-bottom";
import MoveUpIcon from "~icons/material-symbols/arrow-upward";
import MoveDownIcon from "~icons/material-symbols/arrow-downward";
import Close from "~icons/material-symbols/close";
import Help from "~icons/material-symbols/help";
import InputModal from "@/components/common/InputModal.vue";

const { t } = useI18n();
const store = useDesignerStore();
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));
const isHandPanActive = inject<Ref<boolean>>(
  "designer-hand-pan-active",
  ref(false),
);
const element = computed(() => store.selectedElement);
const isMultiSelected = computed(() => store.selectedElementIds.length > 1);
const selectedElementId = computed(() => element.value?.id || "");
const selectedElementType = computed(() => element.value?.type || "");
const isLocked = computed(() => element.value?.locked || false);
const selectedElements = computed<PrintElement[]>(() => {
  if (store.selectedElementIds.length === 0) return [];

  const selectedIdSet = new Set(store.selectedElementIds);
  const elements: PrintElement[] = [];

  for (const page of store.pages) {
    for (const item of page.elements) {
      if (selectedIdSet.has(item.id)) {
        elements.push(item);
      }
    }
  }

  return elements;
});
const allSelectedLocked = computed(() => {
  if (selectedElements.value.length === 0) return false;
  return selectedElements.value.every((item) => Boolean(item.locked));
});
const hasUnlockedSelectedElements = computed(() => {
  return selectedElements.value.some((item) => !item.locked);
});
const shouldShowLockedBadge = computed(() => {
  if (isMultiSelected.value) {
    return allSelectedLocked.value;
  }
  return isLocked.value;
});
const isDeleteSelectedDisabled = computed(() => {
  if (!store.isTemplateEditable) return true;
  if (isMultiSelected.value) {
    return !hasUnlockedSelectedElements.value;
  }
  return isLocked.value;
});
const isEditingDisabled = computed(
  () => isLocked.value || !store.isTemplateEditable,
);
const isStyleEditingDisabled = computed(
  () => isEditingDisabled.value || isHandPanActive.value,
);
const showCustomElementModal = ref(false);
const customElementInitialName = ref("");
const showPropertyHelp = ref(false);
const propertyHelpButtonRef = ref<HTMLElement | null>(null);
const propertyHelpTooltipRef = ref<HTMLElement | null>(null);
const {
  arrowStyle: propertyHelpArrowStyle,
  placement: propertyHelpPlacement,
  toggleTooltip: togglePropertyHelp,
  tooltipStyle: propertyHelpTooltipStyle,
  updateTooltipPosition: updatePropertyHelpTooltipPosition,
} = useFloatingTooltip(
  showPropertyHelp,
  propertyHelpButtonRef,
  propertyHelpTooltipRef,
  { width: 320 },
);

const isSelfStyled = computed(() => {
  if (!element.value) return false;
  return [ElementType.LINE, ElementType.RECT, ElementType.CIRCLE].includes(
    element.value.type,
  );
});

const showRepeatPerPage = computed(() => {
  if (!element.value) return false;
  return element.value.type !== ElementType.TABLE;
});

const isTextElement = computed(() => element.value?.type === ElementType.TEXT);
const isTextAutoHeightEnabled = computed(
  () => isTextElement.value && element.value?.style?.autoHeight === true,
);
const isTextRepeatPerPageEnabled = computed(
  () => isTextElement.value && element.value?.repeatPerPage === true,
);
const hasTextBehaviorConflict = computed(
  () => isTextAutoHeightEnabled.value && isTextRepeatPerPageEnabled.value,
);
const isTableInHeaderOrFooter = computed(() => {
  if (!element.value || element.value.type !== ElementType.TABLE) return false;
  return store.isElementInHeaderOrFooterRegion(element.value);
});

const isFieldDisabled = (field: PropertyField) => {
  if (isEditingDisabled.value) return true;
  if (isHandPanActive.value && field.target === "style") return true;

  if (
    element.value?.type === ElementType.TABLE &&
    field.target === "element" &&
    field.key === "autoPaginate"
  ) {
    return isTableInHeaderOrFooter.value;
  }

  if (!isTextElement.value || field.type !== "switch") return false;
  if (hasTextBehaviorConflict.value) return false;

  if (field.target === "style" && field.key === "autoHeight") {
    return isTextRepeatPerPageEnabled.value;
  }

  if (field.target === "element" && field.key === "repeatPerPage") {
    return isTextAutoHeightEnabled.value;
  }

  return false;
};

const canMergeCells = computed(() => {
  if (!store.tableSelection) return false;
  return store.tableSelection.cells.length > 1;
});

const hasSelectedTableCells = computed(() => {
  return (
    element.value?.type === ElementType.TABLE &&
    store.tableSelection?.elementId === element.value.id &&
    store.tableSelection.cells.length > 0
  );
});

const shouldApplyRowHeightToSelectedRows = (field: PropertyField) => {
  return (
    hasSelectedTableCells.value &&
    field.target === "style" &&
    field.key === "rowHeight"
  );
};

const getPropertyHelpItems = (...keys: string[]) => {
  return keys.map((key) => t(`properties.help.items.${key}`));
};

const propertyHelpContent = computed(() => {
  if (isMultiSelected.value) {
    return {
      title: t("properties.help.title.multi"),
      items: getPropertyHelpItems("multiSelect", "multiLayer"),
    };
  }

  if (!element.value) {
    return {
      title: t("properties.help.title.none"),
      items: getPropertyHelpItems("noneSelect", "nonePanel"),
    };
  }

  switch (selectedElementType.value) {
    case ElementType.TEXT:
      return {
        title: t("properties.help.title.text"),
        items: getPropertyHelpItems("textContent", "textVariable"),
      };
    case ElementType.IMAGE:
      return {
        title: t("properties.help.title.image"),
        items: getPropertyHelpItems("imageSource", "imageVariable"),
      };
    case ElementType.TABLE:
      return {
        title: t("properties.help.title.table"),
        items: [
          ...getPropertyHelpItems(
            "tableDataVariable",
            "tableColumnsVariable",
            "tableFooterVariable",
            "tableCellValueVariable",
            "tableCellStyleScope",
            "tableCellMergeSplit",
            "tableCellResizeBehavior",
            "tableCellEditKeys",
            "tableFooterField",
            "tableScript",
            "tableScriptReturn",
          ),
          ...(hasSelectedTableCells.value
            ? getPropertyHelpItems("tableSelectedCell")
            : []),
        ],
      };
    case ElementType.PAGE_NUMBER:
      return {
        title: t("properties.help.title.pageNumber"),
        items: getPropertyHelpItems("pageFormat", "pageLabel"),
      };
    case ElementType.BARCODE:
      return {
        title: t("properties.help.title.barcode"),
        items: getPropertyHelpItems("barcodeContent", "codeVariable"),
      };
    case ElementType.QRCODE:
      return {
        title: t("properties.help.title.qrcode"),
        items: getPropertyHelpItems("qrcodeContent", "codeVariable"),
      };
    case ElementType.LINE:
      return {
        title: t("properties.help.title.line"),
        items: getPropertyHelpItems("lineStyle", "lineSize"),
      };
    case ElementType.RECT:
    case ElementType.CIRCLE:
      return {
        title: t("properties.help.title.shape"),
        items: getPropertyHelpItems("shapeStyle", "shapeSize"),
      };
    default:
      return {
        title: t("properties.help.title.none"),
        items: getPropertyHelpItems("nonePanel"),
      };
  }
});

const propertyHelpKey = computed(() => {
  if (isMultiSelected.value) return "multi";
  if (!element.value) return "none";

  return [
    selectedElementId.value,
    selectedElementType.value,
    hasSelectedTableCells.value ? "selected-cells" : "element",
  ].join(":");
});

watch(propertyHelpKey, () => {
  if (showPropertyHelp.value) {
    void updatePropertyHelpTooltipPosition();
  }
});

const canSplitCells = computed(() => {
  if (!store.tableSelection) return false;
  if (store.tableSelection.cells.length !== 1) return false;

  const cell = store.tableSelection.cells[0];
  const el = store.selectedElement;
  if (!el || el.type !== ElementType.TABLE) return false;

  const section = cell.section || "body";
  const targetData = section === "footer" ? el.footerData : el.data;

  if (!targetData) return false;

  const row = targetData[cell.rowIndex];
  if (!row) return false;
  const val = row[cell.colField];
  if (val && typeof val === "object") {
    return (val.rowSpan || 1) > 1 || (val.colSpan || 1) > 1;
  }
  return false;
});

const activeTab = ref<"properties" | "style" | "advanced">("properties");
const copied = ref(false);
const unit = computed(() => (store.unit || "mm") as Unit);
const unitLabel = computed(() => store.unit || "mm");
const defaultFontOptions = computed(() => [
  { label: t("properties.option.default"), value: "" },
  { label: t("properties.option.arial"), value: "Arial, sans-serif" },
  {
    label: t("properties.option.timesNewRoman"),
    value: '"Times New Roman", serif',
  },
  {
    label: t("properties.option.courierNew"),
    value: '"Courier New", monospace',
  },
  { label: t("properties.option.simSun"), value: "SimSun, serif" },
  { label: t("properties.option.simHei"), value: "SimHei, sans-serif" },
]);
const dynamicFontFamilyOptions = computed(() => {
  const customOptions = store.fontOptions || [];
  if (!customOptions.length) {
    return defaultFontOptions.value;
  }

  const normalizedCustom = customOptions.map((opt) => ({
    label: (opt.label || opt.value || "").trim(),
    value: opt.value,
  }));
  const hasDefaultOption = normalizedCustom.some((opt) => opt.value === "");

  if (hasDefaultOption) {
    return normalizedCustom;
  }

  return [
    { label: t("properties.option.default"), value: "" },
    ...normalizedCustom,
  ];
});
const fontFamilyFieldKeys = new Set(["fontFamily", "labelFontFamily"]);
const unitFieldKeys = new Set([
  "fontSize",
  "borderWidth",
  "barcodeWidth",
  "barcodeHeight",
  "margin",
  "borderRadius",
  "headerHeight",
  "rowHeight",
  "footerHeight",
  "labelFontSize",
  "labelBorderWidth",
]);

const isUnitField = (field: PropertyField) => {
  if (field.type !== "number" || !field.key) return false;
  return unitFieldKeys.has(field.key);
};

const getFieldLabel = (field: PropertyField) => {
  const base = t(field.label);
  return isUnitField(field) ? `${base} (${unitLabel.value})` : base;
};

const i18nKeyPrefixes = [
  "properties.",
  "editor.",
  "common.",
  "elements.",
  "elementsPanel.",
  "help.",
  "preview.",
  "printDialog.",
  "settings.",
  "shortcuts.",
  "toast.",
];

const isI18nKey = (value: string) =>
  i18nKeyPrefixes.some((prefix) => value.startsWith(prefix));

const resolveOptionLabel = (label: unknown) => {
  if (typeof label !== "string") {
    return String(label ?? "");
  }
  return isI18nKey(label) ? t(label) : label;
};

const getSelectOptions = (field: PropertyField) => {
  const rawOptions = fontFamilyFieldKeys.has(field.key || "")
    ? dynamicFontFamilyOptions.value
    : field.options || [];
  return rawOptions.map((option: any) => ({
    ...option,
    label: resolveOptionLabel(option.label),
  }));
};

const getFieldDisplayValue = (field: PropertyField) => {
  const value = getFieldValue(field);
  if (isUnitField(field) && typeof value === "number") {
    return pxToUnit(value, unit.value);
  }
  return value;
};

const toFieldValue = (field: PropertyField, value: any) => {
  if (isUnitField(field)) {
    return unitToPx(Number(value), unit.value);
  }
  return value;
};

const getFieldMin = (field: PropertyField) => {
  if (field.min === undefined || field.min === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.min, unit.value) : field.min;
};

const getFieldMax = (field: PropertyField) => {
  if (field.max === undefined || field.max === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.max, unit.value) : field.max;
};

const getFieldStep = (field: PropertyField) => {
  if (field.step === undefined || field.step === null) return undefined;
  return isUnitField(field) ? pxToUnit(field.step, unit.value) : field.step;
};

const copyId = () => {
  if (element.value) {
    navigator.clipboard.writeText(element.value.id);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
};

const customElementInitialValues = ref<Record<string, any>>({});
const customElementModalFields = computed(() => {
  return store.customElementModalFormConfig?.create?.fields;
});

const handleSaveCustom = () => {
  if (!element.value) return;
  customElementInitialName.value = element.value.type;

  const configItem = store.customElementModalFormConfig?.create;
  customElementInitialValues.value = configItem?.initialValues || {};

  showCustomElementModal.value = true;
};

const onSaveCustomElement = (payload: string | Record<string, any>) => {
  if (element.value) {
    let name = "";
    let extraValues: Record<string, any> | undefined = undefined;

    if (typeof payload === "string") {
      name = payload;
    } else {
      name = payload.name;
      const { name: _, ...rest } = payload;
      if (Object.keys(rest).length > 0) {
        extraValues = rest;
      }
    }

    if (name) {
      store.addCustomElement(name, element.value, extraValues);
    }
  }
};

const handleChange = (key: string, value: any) => {
  if (element.value) {
    store.updateElement(element.value.id, { [key]: value });
  }
};

const handleStyleChange = (key: string, value: any) => {
  if (element.value) {
    store.updateElement(element.value.id, {
      style: { ...element.value.style, [key]: value },
    });
  }
};

const handleDataJsonChange = (fieldKey: string, e: Event) => {
  try {
    const value = (e.target as HTMLTextAreaElement).value;
    handleChange(fieldKey, JSON.parse(value));
  } catch (err) {
    toast.error("Invalid JSON");
  }
};

const getCodeValue = (field: PropertyField) => {
  const val = getFieldValue(field);
  if (field.language === "json" && typeof val === "object") {
    return JSON.stringify(val, null, 2);
  }
  return val || "";
};

const handleCodeChange = (field: PropertyField, value: string) => {
  if (field.language === "json") {
    try {
      const parsed = JSON.parse(value);
      handleChange(field.key!, parsed);
    } catch (e) {
      // ignore invalid json
    }
  } else {
    handleChange(field.key!, value);
  }
};

const getSchema = (type: ElementType): ElementPropertiesSchema | null => {
  switch (type) {
    case ElementType.TEXT:
      return TextSchema;
    case ElementType.IMAGE:
      return ImageSchema;
    case ElementType.TABLE:
      return TableSchema;
    case ElementType.PAGE_NUMBER:
      return PagerSchema;
    case ElementType.BARCODE:
      return BarcodeSchema;
    case ElementType.QRCODE:
      return QrCodeSchema;
    case ElementType.LINE:
      return LineSchema;
    case ElementType.RECT:
      return RectSchema;
    case ElementType.CIRCLE:
      return CircleSchema;
    default:
      return null;
  }
};

const currentSchema = computed(() =>
  element.value ? getSchema(element.value.type) : null,
);

const visibleSections = computed(() => {
  if (!currentSchema.value) return [];
  const sections = currentSchema.value.sections.filter(
    (s) => (s.tab || "properties") === activeTab.value,
  );

  if (activeTab.value === "properties") {
    const clonedSections = JSON.parse(JSON.stringify(sections));
    let dataBehavior = clonedSections.find(
      (s: any) => s.title === "properties.section.dataBehavior",
    );
    if (!dataBehavior) {
      dataBehavior = {
        title: "properties.section.dataBehavior",
        tab: "properties",
        fields: [],
      };
      clonedSections.push(dataBehavior);
    }

    if (!dataBehavior.fields.some((f: any) => f.key === "printable")) {
      dataBehavior.fields.push({
        label: "properties.label.printable",
        type: "switch",
        target: "element",
        key: "printable",
        defaultValue: true,
      });
    }

    if (
      showRepeatPerPage.value &&
      !dataBehavior.fields.some((f: any) => f.key === "repeatPerPage")
    ) {
      dataBehavior.fields.unshift({
        label: "properties.label.repeatPerPage",
        type: "switch",
        target: "element",
        key: "repeatPerPage",
      });
    }

    return clonedSections;
  }

  return sections;
});

const getFieldValue = (field: PropertyField) => {
  if (!element.value) return field.defaultValue;
  if (shouldApplyRowHeightToSelectedRows(field)) {
    return store.getSelectedTableRowsHeight() ?? field.defaultValue;
  }
  const target = field.target === "style" ? element.value.style : element.value;
  const value = (target as any)[field.key!];
  return value ?? field.defaultValue;
};

const handleFieldChange = (field: PropertyField, value: any) => {
  if (!element.value) return;
  if (shouldApplyRowHeightToSelectedRows(field)) {
    store.updateSelectedTableRowsHeight(Number(value));
    return;
  }
  if (field.target === "style" && field.key) {
    handleStyleChange(field.key, value);
  } else if (field.target === "element" && field.key) {
    handleChange(field.key, value);
  }
};

const handleFieldAction = (field: PropertyField) => {
  if (!element.value || !field.actionName) return;
  if (field.actionName === "paginateTable") {
    store.paginateTable(element.value.id);
  } else if (field.actionName === "removeBorder") {
    store.updateElement(element.value.id, {
      style: {
        ...element.value.style,
        borderStyle: undefined,
        borderWidth: undefined,
        borderColor: undefined,
        border: "none",
      },
    });
  }
};

const handleDeleteSelected = () => {
  if (isMultiSelected.value) {
    store.removeSelectedElements();
  } else if (element.value) {
    store.removeElement(element.value.id);
  }
};

const currentZIndex = computed(() => element.value?.style?.zIndex || 1);

const layerOrderedElements = computed(() => {
  if (!element.value) return [];
  const page = store.pages.find((p) =>
    p.elements.some((el) => el.id === element.value!.id),
  );
  if (!page) return [];
  return page.elements
    .map((el, index) => ({
      id: el.id,
      zIndex: el.style?.zIndex || 1,
      originalIndex: index,
    }))
    .sort((a, b) => {
      if (a.zIndex === b.zIndex) return a.originalIndex - b.originalIndex;
      return a.zIndex - b.zIndex;
    });
});

const currentLayerIndex = computed(() => {
  if (!element.value) return -1;
  return layerOrderedElements.value.findIndex(
    (item) => item.id === element.value!.id,
  );
});

const canMoveLayerUp = computed(() => {
  if (!element.value) return false;
  return (
    currentLayerIndex.value >= 0 &&
    currentLayerIndex.value < layerOrderedElements.value.length - 1
  );
});

const canMoveLayerDown = computed(() => {
  if (!element.value) return false;
  return currentLayerIndex.value > 0;
});

const handleZIndexChange = (value: string | number) => {
  if (!element.value) return;
  const parsed = Math.max(1, Math.round(Number(value) || 1));
  store.updateElement(element.value.id, {
    style: {
      ...element.value.style,
      zIndex: parsed,
    },
  });
};

const handleLayerMove = (mode: "front" | "back" | "forward" | "backward") => {
  if (!element.value) return;
  const ids = [element.value.id];
  if (mode === "front") {
    store.moveElementsLayer(ids, "front");
    return;
  }
  if (mode === "back") {
    store.sendElementsToBack(ids);
    return;
  }
  if (mode === "forward") {
    store.moveElementsForward(ids);
    return;
  }
  store.moveElementsBackward(ids);
};

const handleFocusIn = (e: FocusEvent) => {
  // If focus comes from another element within the aside, do nothing
  if (
    e.relatedTarget &&
    (e.currentTarget as Element).contains(e.relatedTarget as Node)
  ) {
    return;
  }
  store.setDisableGlobalShortcuts(true);
};

const handleFocusOut = (e: FocusEvent) => {
  // If focus moves to another element within the aside, do nothing
  if (
    e.relatedTarget &&
    (e.currentTarget as Element).contains(e.relatedTarget as Node)
  ) {
    return;
  }
  // Otherwise enable shortcuts
  store.setDisableGlobalShortcuts(false);
};

const dispatchDesignerEvent = (name: string) => {
  const detail: Record<string, unknown> = {};
  if (designerInstanceId) {
    detail.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const closePropertiesPanel = () => {
  showPropertyHelp.value = false;
  dispatchDesignerEvent("designer:close-properties-panel");
};
</script>

<template>
  <aside
    class="w-full bg-white dark:bg-gray-900 flex flex-col h-full z-40 overflow-hidden"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
  >
    <!-- Header -->
    <div
      class="relative p-4 pr-20 min-h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-move select-none rounded-t"
      data-floating-panel-drag-handle="true"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ t("properties.title") }}
          </h2>
          <div
            v-if="shouldShowLockedBadge"
            class="inline-flex items-center gap-1.5 text-red-500 dark:text-red-400 text-xs font-medium leading-none bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded border border-red-100 dark:border-red-800 shrink-0"
          >
            <Lock class="w-3.5 h-3.5 shrink-0" />
            <span>{{ t("properties.locked") }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t("properties.subtitle") }}
        </p>
      </div>
      <div class="absolute right-0 top-0 z-50 flex items-center gap-0">
        <button
          ref="propertyHelpButtonRef"
          type="button"
          :class="[
            'panel-help-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
            showPropertyHelp
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              : '',
          ]"
          :aria-label="
            showPropertyHelp
              ? t('properties.help.hide')
              : t('properties.help.show')
          "
          :aria-pressed="showPropertyHelp"
          @mousedown.stop.prevent="togglePropertyHelp"
        >
          <Help class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="panel-close-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
          @mousedown.stop
          @click.stop="closePropertiesPanel"
        >
          <Close class="w-4 h-4" />
        </button>
      </div>
    </div>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showPropertyHelp"
        :key="propertyHelpKey"
        ref="propertyHelpTooltipRef"
        role="tooltip"
        class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
        :style="propertyHelpTooltipStyle"
        @click.stop
      >
        <div
          v-if="propertyHelpPlacement === 'bottom'"
          class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="propertyHelpArrowStyle"
        ></div>
        <div
          v-else
          class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="propertyHelpArrowStyle"
        ></div>
        <div
          class="overflow-y-auto p-3"
          :style="{ maxHeight: propertyHelpTooltipStyle.maxHeight }"
        >
          <div class="flex items-start gap-2">
            <Help
              class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
            />
            <div class="min-w-0">
              <h3
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {{ propertyHelpContent.title }}
              </h3>
              <ul
                class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
              >
                <li v-for="item in propertyHelpContent.items" :key="item">
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Multi-select Mode -->
    <div v-if="isMultiSelected" class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ t("properties.multiSelectMode") }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span class="font-medium text-gray-700 dark:text-gray-200">{{
            store.selectedElementIds.length
          }}</span>
          {{ t("properties.selectedElements", { n: "" }).replace("{n}", "") }}
        </p>
      </div>
      <button
        @click="handleDeleteSelected"
        :disabled="isDeleteSelectedDisabled"
        class="w-full py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ t("properties.deleteSelected") }}
      </button>
    </div>

    <!-- Single Element Mode -->
    <div v-else-if="element" class="flex flex-col h-full overflow-hidden">
      <!-- Tabs -->
      <div
        class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <button
          v-for="tab in ['properties', 'style', 'advanced']"
          :key="tab"
          @click="activeTab = tab as any"
          :class="[
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === tab
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
          ]"
        >
          {{ t(`properties.tab.${tab}`) }}
          <div
            v-if="activeTab === tab"
            class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"
          ></div>
        </button>
      </div>

      <div
        class="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar dark:bg-gray-900"
      >
        <!-- Properties Tab: Position & Size -->
        <div v-if="activeTab === 'properties'" class="space-y-3">
          <h3
            class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {{ t("properties.section.positionSize") }}
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <PropertyInput
              :label="`${t('properties.label.x')} (${unitLabel})`"
              type="number"
              :disabled="isEditingDisabled"
              :value="pxToUnit(element.x, unit)"
              @update:value="
                (v) => handleChange('x', unitToPx(Number(v), unit))
              "
            />
            <PropertyInput
              :label="`${t('properties.label.y')} (${unitLabel})`"
              type="number"
              :disabled="isEditingDisabled"
              :value="pxToUnit(element.y, unit)"
              @update:value="
                (v) => handleChange('y', unitToPx(Number(v), unit))
              "
            />
            <PropertyInput
              :label="`${t('properties.label.width')} (${unitLabel})`"
              type="number"
              :disabled="isEditingDisabled"
              :value="pxToUnit(element.width, unit)"
              @update:value="
                (v) => handleChange('width', unitToPx(Number(v), unit))
              "
            />
            <PropertyInput
              :label="`${t('properties.label.height')} (${unitLabel})`"
              type="number"
              :disabled="isEditingDisabled"
              :value="pxToUnit(element.height, unit)"
              @update:value="
                (v) => handleChange('height', unitToPx(Number(v), unit))
              "
            />
          </div>
        </div>

        <div
          v-if="activeTab === 'properties'"
          class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800"
        >
          <h3
            class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {{ t("properties.section.layer") }}
          </h3>
          <PropertyInput
            :label="t('properties.label.zIndex')"
            type="number"
            :disabled="isEditingDisabled"
            :min="1"
            :step="1"
            :value="currentZIndex"
            @update:value="handleZIndexChange"
          />
          <div class="grid grid-cols-2 gap-3">
            <button
              @click="handleLayerMove('forward')"
              :disabled="isEditingDisabled || !canMoveLayerUp"
              class="w-full py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <MoveUpIcon class="w-3.5 h-3.5 shrink-0" />
              <span>{{ t("properties.action.moveUp") }}</span>
            </button>
            <button
              @click="handleLayerMove('backward')"
              :disabled="isEditingDisabled || !canMoveLayerDown"
              class="w-full py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <MoveDownIcon class="w-3.5 h-3.5 shrink-0" />
              <span>{{ t("properties.action.moveDown") }}</span>
            </button>
            <button
              @click="handleLayerMove('front')"
              :disabled="isEditingDisabled || !canMoveLayerUp"
              class="w-full py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <BringToFrontIcon class="w-3.5 h-3.5 shrink-0" />
              <span>{{ t("properties.action.bringToFront") }}</span>
            </button>
            <button
              @click="handleLayerMove('back')"
              :disabled="isEditingDisabled || !canMoveLayerDown"
              class="w-full py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
            >
              <SendToBackIcon class="w-3.5 h-3.5 shrink-0" />
              <span>{{ t("properties.action.sendToBack") }}</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Sections -->
        <template v-for="(section, si) in visibleSections" :key="si">
          <div
            class="space-y-3 pt-2 first:pt-0 border-t first:border-0 border-gray-100 dark:border-gray-800"
          >
            <h3
              class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              {{ t(section.title) }}
            </h3>
            <div class="space-y-3">
              <template v-for="(field, fi) in section.fields" :key="fi">
                <!-- Action Button -->
                <div v-if="field.type === 'action'">
                  <button
                    @click="handleFieldAction(field)"
                    :disabled="
                      field.actionName === 'removeBorder'
                        ? isStyleEditingDisabled
                        : isEditingDisabled
                    "
                    class="w-full py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-700"
                  >
                    {{ t(field.label) }}
                  </button>
                </div>

                <!-- Text/Number/Switch Input -->
                <PropertyInput
                  v-else-if="
                    field.type === 'text' ||
                    field.type === 'number' ||
                    field.type === 'switch'
                  "
                  :label="getFieldLabel(field)"
                  :type="field.type"
                  :min="getFieldMin(field)"
                  :max="getFieldMax(field)"
                  :step="getFieldStep(field)"
                  :disabled="isFieldDisabled(field)"
                  :placeholder="
                    field.placeholder
                      ? field.placeholder.startsWith('properties.')
                        ? t(field.placeholder)
                        : field.placeholder
                      : ''
                  "
                  :value="getFieldDisplayValue(field)"
                  @update:value="
                    (v) => handleFieldChange(field, toFieldValue(field, v))
                  "
                />

                <!-- Select -->
                <PropertySelect
                  v-else-if="field.type === 'select'"
                  :label="t(field.label)"
                  :options="getSelectOptions(field)"
                  :disabled="isFieldDisabled(field)"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Color -->
                <PropertyColor
                  v-else-if="field.type === 'color'"
                  :label="t(field.label)"
                  :disabled="isFieldDisabled(field)"
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Image Upload -->
                <PropertyImage
                  v-else-if="field.type === 'image'"
                  :label="t(field.label)"
                  :disabled="isFieldDisabled(field)"
                  :placeholder="
                    field.placeholder
                      ? field.placeholder.startsWith('properties.')
                        ? t(field.placeholder)
                        : field.placeholder
                      : undefined
                  "
                  :value="getFieldValue(field)"
                  @update:value="(v) => handleFieldChange(field, v)"
                />

                <!-- Code Editor -->
                <PropertyCode
                  v-else-if="field.type === 'code'"
                  :label="t(field.label)"
                  :language="field.language || 'javascript'"
                  :disabled="isFieldDisabled(field)"
                  :height="field.height"
                  :value="getCodeValue(field)"
                  @update:value="(v) => handleCodeChange(field, v)"
                />

                <!-- Textarea -->
                <div v-else-if="field.type === 'textarea'">
                  <label
                    class="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium"
                    >{{ t(field.label) }}</label
                  >
                  <textarea
                    :placeholder="
                      field.placeholder
                        ? field.placeholder.startsWith('properties.')
                          ? t(field.placeholder)
                          : field.placeholder
                        : ''
                    "
                    :disabled="isFieldDisabled(field)"
                    :value="
                      ['data', 'columns', 'footerData'].includes(field.key!)
                        ? JSON.stringify((element as any)[field.key!], null, 2)
                        : getFieldValue(field)
                    "
                    @input="
                      !['data', 'columns', 'footerData'].includes(field.key!) &&
                      handleFieldChange(
                        field,
                        ($event.target as HTMLTextAreaElement).value,
                      )
                    "
                    @change="
                      ['data', 'columns', 'footerData'].includes(field.key!)
                        ? handleDataJsonChange(field.key!, $event)
                        : handleFieldChange(
                            field,
                            ($event.target as HTMLTextAreaElement).value,
                          )
                    "
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:border-blue-500 outline-none h-24 resize-y font-mono disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  ></textarea>
                </div>
              </template>
            </div>
          </div>

          <!-- Table Cell Operations (below layout) -->
          <div
            v-if="
              section.title === 'properties.section.layoutDimensions' &&
              element.type === 'table' &&
              store.tableSelection
            "
            class="space-y-3 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800"
          >
            <h3
              class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              {{ t("properties.section.cellOperations") }}
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <button
                @click="store.mergeSelectedCells()"
                :disabled="!canMergeCells || isEditingDisabled"
                class="w-full py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:border-gray-200 dark:disabled:border-gray-700"
              >
                {{ t("properties.action.mergeCells") }}
              </button>
              <button
                @click="store.splitSelectedCells()"
                :disabled="!canSplitCells || isEditingDisabled"
                class="w-full py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ t("properties.action.splitCells") }}
              </button>
            </div>
            <div class="space-y-2">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t("properties.label.cellTextAlign") }}
              </p>
              <div class="flex gap-2">
                <button
                  @click="store.setSelectedCellsTextAlign('left')"
                  :disabled="isStyleEditingDisabled"
                  class="flex-1 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  :title="t('properties.align.left')"
                >
                  <FormatAlignLeft class="w-4 h-4" />
                  <span>{{ t("properties.align.left") }}</span>
                </button>
                <button
                  @click="store.setSelectedCellsTextAlign('center')"
                  :disabled="isStyleEditingDisabled"
                  class="flex-1 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  :title="t('properties.align.center')"
                >
                  <FormatAlignCenter class="w-4 h-4" />
                  <span>{{ t("properties.align.center") }}</span>
                </button>
                <button
                  @click="store.setSelectedCellsTextAlign('right')"
                  :disabled="isStyleEditingDisabled"
                  class="flex-1 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  :title="t('properties.align.right')"
                >
                  <FormatAlignRight class="w-4 h-4" />
                  <span>{{ t("properties.align.right") }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Style Tab: Generic Appearance -->
        <div
          v-if="
            activeTab === 'style' &&
            !isSelfStyled &&
            element.type !== ElementType.TABLE
          "
          class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800"
        >
          <h3
            class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {{ t("properties.section.appearance") }}
          </h3>
          <PropertyColor
            :label="t('properties.label.backgroundColor')"
            :disabled="isStyleEditingDisabled"
            :value="element.style.backgroundColor || '#ffffff'"
            @update:value="(v) => handleStyleChange('backgroundColor', v)"
          />
        </div>

        <!-- Advanced Tab Content -->
        <div v-if="activeTab === 'advanced'" class="space-y-4">
          <div
            class="p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
          >
            <h4
              class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3"
            >
              {{ t("properties.section.elementInfo") }}
            </h4>
            <div class="space-y-3">
              <div>
                <p
                  class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 font-medium"
                >
                  {{ t("properties.label.id") }}
                </p>
                <div
                  class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <span
                    class="font-mono text-xs text-gray-600 dark:text-gray-400 flex-1 truncate select-all"
                    :title="element.id"
                    >{{ element.id }}</span
                  >
                  <button
                    @click="copyId"
                    class="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                    :title="
                      copied
                        ? t('properties.action.copied')
                        : t('properties.action.copyId')
                    "
                  >
                    <Check
                      v-if="copied"
                      class="w-3.5 h-3.5 text-green-500 dark:text-green-400"
                    />
                    <ContentCopy v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div
                class="text-xs text-gray-500 flex items-center justify-between border-t border-gray-100 pt-2"
              >
                <span class="font-medium">{{
                  t("properties.label.type")
                }}</span>
                <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{{
                  t("elements." + element.type)
                }}</span>
              </div>
            </div>
          </div>

          <button
            @click="handleSaveCustom"
            class="w-full py-2 bg-white text-blue-600 rounded border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center gap-2 mb-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Save class="w-4 h-4" />
            {{ t("properties.action.saveCustom") }}
          </button>

          <button
            @click="handleDeleteSelected"
            :disabled="isEditingDisabled"
            class="w-full py-2 bg-white text-red-600 rounded border border-red-200 hover:bg-red-50 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Delete class="w-4 h-4" />
            {{ t("properties.action.deleteElement") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="p-6 text-center">
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ t("properties.empty.noSelection") }}
        </h3>
        <p class="text-sm text-gray-500 mt-2">
          {{ t("properties.empty.selectInstruction") }}
        </p>
      </div>
    </div>
  </aside>

  <InputModal
    :show="showCustomElementModal"
    :initial-value="customElementInitialName"
    :initial-values="customElementInitialValues"
    :fields="customElementModalFields"
    :title="t('properties.action.saveCustomModal')"
    :placeholder="t('elementsPanel.enterNamePlaceholder')"
    @close="showCustomElementModal = false"
    @save="onSaveCustomElement"
  />
</template>

<style scoped>
  /* custom-scrollbar inherited from global style.css */
</style>
