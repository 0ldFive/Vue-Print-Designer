<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  inject,
  type Ref,
} from "vue";
import { useDesignerStore } from "@/stores/designer";
import Printer from "~icons/material-symbols/print";
import Preview from "~icons/material-symbols/preview";
import HtmlIcon from "~icons/material-symbols/html";
import FilePdf from "~icons/material-symbols/picture-as-pdf";
import Image from "~icons/material-symbols/image";
import ZoomIn from "~icons/material-symbols/zoom-in";
import ZoomOut from "~icons/material-symbols/zoom-out";
import PanTool from "~icons/material-symbols/pan-tool";
import Tune from "~icons/material-symbols/tune";
import Undo2 from "~icons/material-symbols/undo";
import Redo2 from "~icons/material-symbols/redo";
import Trash2 from "~icons/material-symbols/delete";
import CutIcon from "~icons/material-symbols/content-cut";
import SelectAllIcon from "~icons/material-symbols/select-all";
import HelpCircle from "~icons/material-symbols/help";
import AlignLeft from "~icons/material-symbols/format-align-left";
import AlignCenterHorizontal from "~icons/material-symbols/format-align-center";
import AlignRight from "~icons/material-symbols/format-align-right";
import AlignStartVertical from "~icons/material-symbols/vertical-align-top";
import AlignCenterVertical from "~icons/material-symbols/vertical-align-center";
import AlignEndVertical from "~icons/material-symbols/vertical-align-bottom";
import CellMerge from "~icons/material-symbols/cell-merge";
import MoveUpIcon from "~icons/material-symbols/arrow-upward";
import MoveDownIcon from "~icons/material-symbols/arrow-downward";
import Bold from "~icons/material-symbols/format-bold";
import Italic from "~icons/material-symbols/format-italic";
import FormatUnderlined from "~icons/material-symbols/format-underlined";
import StrikethroughS from "~icons/material-symbols/strikethrough-s";
import FormatClear from "~icons/material-symbols/format-clear";
import TextRotateVertical from "~icons/material-symbols/text-rotate-vertical";
import RotateCcw from "~icons/material-symbols/rotate-left";
import WidthIcon from "~icons/material-symbols/width";
import HeightIcon from "~icons/material-symbols/height";
import AspectRatioIcon from "~icons/material-symbols/aspect-ratio";
import HorizontalDistribute from "~icons/material-symbols/horizontal-distribute";
import VerticalDistribute from "~icons/material-symbols/vertical-distribute";
import Copy from "~icons/material-symbols/content-copy";
import FontDownload from "~icons/material-symbols/font-download";
import FormatColorFill from "~icons/material-symbols/format-color-fill";
import ClipboardPaste from "~icons/material-symbols/content-paste";
import Lock from "~icons/material-symbols/lock";
import Unlock from "~icons/material-symbols/lock-open";
import ChevronDown from "~icons/material-symbols/expand-more";
import KeyboardArrowLeft from "~icons/material-symbols/keyboard-arrow-left";
import KeyboardArrowRight from "~icons/material-symbols/keyboard-arrow-right";
import ViewSidebar from "~icons/material-symbols/view-sidebar";
import ListIcon from "~icons/material-symbols/list";
import GridView from "~icons/material-symbols/grid-view";
import GridViewOutline from "~icons/material-symbols/grid-view-outline";
import History from "~icons/material-symbols/history";
import SettingsIcon from "~icons/material-symbols/settings";
import { usePrint } from "@/utils/print";
import {
  usePrintSettings,
  type PrintOptions,
} from "@/composables/usePrintSettings";
import { useJsonBlobModal } from "@/composables/useJsonBlobModal";
import { ElementType } from "@/types";
import PreviewModal from "../PreviewModal.vue";
import ColorPicker from "@/components/common/ColorPicker.vue";
import PaperSettings from "./PaperSettings.vue";
import InputModal from "@/components/common/InputModal.vue";
import { useTemplateStore } from "@/stores/templates";
import CodeEditorModal from "@/components/common/CodeEditorModal.vue";
import { useI18n } from "vue-i18n";
import { formatShortcut } from "@/utils/os";
import { toast } from "@/utils/toast";
import PrintDialog from "../PrintDialog.vue";

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();

const designerRoot = inject<Ref<HTMLElement | null>>(
  "designer-root",
  ref(null),
);
const modalContainer = inject<Ref<HTMLElement | null>>(
  "modal-container",
  ref(null),
);
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const getQueryRoot = () => {
  return (
    (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document
  );
};

const dispatchDesignerEvent = (
  name: string,
  detail: Record<string, any> = {},
) => {
  const payload = { ...detail };
  if (designerInstanceId) {
    payload.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
};

const isEventForCurrentDesigner = (e: Event) => {
  const eventId = (e as CustomEvent)?.detail?.__designerInstanceId;
  if (!eventId || !designerInstanceId) return true;
  return eventId === designerInstanceId;
};

const { printMode, silentPrint, localPrintOptions, remotePrintOptions } =
  usePrintSettings();
const printModeValue = computed(() => printMode.value || "browser");

const {
  getPrintHtml,
  print,
  exportPdf,
  exportHtml,
  getPdfBlob,
  exportImages,
  getImageBlob,
} = usePrint();

const {
  showJsonModal,
  jsonContent,
  modalTitle,
  modalLanguage,
  canSaveJson,
  handleViewJson,
  handleViewImageBlob,
  handleViewPdfBlob,
  handleSaveJson,
} = useJsonBlobModal({
  getPages: () =>
    Array.from(getQueryRoot().querySelectorAll(".print-page")) as HTMLElement[],
  getImageBlob,
  getPdfBlob,
});

const showPreview = ref(false);
const previewContent = ref("");
const showPrintDialog = ref(false);
const pendingPrintContent = ref<HTMLElement[] | HTMLElement | string | null>(
  null,
);

const activePrintOptions = computed<PrintOptions>(() => {
  return printMode.value === "remote" ? remotePrintOptions : localPrintOptions;
});

const showZoomSettings = ref(false);
const zoomPercent = ref(Math.round(store.zoom * 100));
const isHandPanActive = inject<Ref<boolean>>(
  "designer-hand-pan-active",
  ref(false),
);
const isElementsPanelVisible = ref(false);
const isTemplatePanelVisible = ref(true);
const isPropertiesPanelVisible = ref(true);
const zoomTriggerRef = ref<HTMLElement | null>(null);
const zoomSettingsMenuStyle = ref<Record<string, string>>({});
const toolbarScrollRef = ref<HTMLElement | null>(null);
const toolbarScrollContentRef = ref<HTMLElement | null>(null);
const isToolbarOverflowing = ref(false);
const canScrollToolbarLeft = ref(false);
const canScrollToolbarRight = ref(false);
let toolbarResizeObserver: ResizeObserver | null = null;
let hasToolbarManualScroll = false;
let suppressToolbarScrollEvent = false;

const updateToolbarScrollState = (autoAlignRight = false) => {
  const container = toolbarScrollRef.value;
  if (!container) {
    isToolbarOverflowing.value = false;
    canScrollToolbarLeft.value = false;
    canScrollToolbarRight.value = false;
    return;
  }

  const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
  if (autoAlignRight && maxScrollLeft > 4) {
    suppressToolbarScrollEvent = true;
    container.scrollLeft = maxScrollLeft;
    requestAnimationFrame(() => {
      suppressToolbarScrollEvent = false;
    });
  }

  isToolbarOverflowing.value = maxScrollLeft > 4;
  canScrollToolbarLeft.value = container.scrollLeft > 2;
  canScrollToolbarRight.value = container.scrollLeft < maxScrollLeft - 2;
};

const scrollToolbar = (direction: "backward" | "forward") => {
  const container = toolbarScrollRef.value;
  if (!container) return;

  hasToolbarManualScroll = true;

  const offset = Math.max(Math.round(container.clientWidth * 0.6), 240);
  const delta = direction === "backward" ? -offset : offset;
  container.scrollBy({ left: delta, behavior: "smooth" });
};

const handleToolbarScroll = () => {
  if (suppressToolbarScrollEvent) return;
  hasToolbarManualScroll = true;
  updateToolbarScrollState();
};

const handleToolbarResize = () => {
  updateToolbarScrollState(!hasToolbarManualScroll);
};

const updateZoomSettingsMenuPosition = () => {
  if (!showZoomSettings.value) return;
  const trigger = zoomTriggerRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const menuWidth = 256;
  const viewportPadding = 8;
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - menuWidth - viewportPadding,
  );
  const top = Math.max(rect.bottom + 8, viewportPadding);

  zoomSettingsMenuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
};

const handleZoomSettingsViewportChange = () => {
  updateZoomSettingsMenuPosition();
};

// Font State
const selectedFont = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.fontFamily || "";
    }
    return "";
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ fontFamily: val });
  },
});

const selectedFontSize = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.fontSize || 12;
    }
    return 12;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ fontSize: val });
  },
});

const isBold = computed(() => {
  return (
    store.selectedElement?.style.fontWeight === "700" ||
    store.selectedElement?.style.fontWeight === "bold"
  );
});

const isItalic = computed(() => {
  return store.selectedElement?.style.fontStyle === "italic";
});

const getTextDecorationSet = (value?: string) => {
  const tokens = (value || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token !== "none");

  return new Set(tokens);
};

const isUnderline = computed(() => {
  return getTextDecorationSet(store.selectedElement?.style.textDecoration).has(
    "underline",
  );
});

const isStrikethrough = computed(() => {
  return getTextDecorationSet(store.selectedElement?.style.textDecoration).has(
    "line-through",
  );
});

const isVertical = computed(() => {
  return store.selectedElement?.style.writingMode === "vertical-rl";
});

const selectedColor = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.color;
    }
    return undefined;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ color: val });
  },
});

const selectedBackgroundColor = computed({
  get: () => {
    if (store.selectedElement) {
      return store.selectedElement.style.backgroundColor;
    }
    return undefined;
  },
  set: (val) => {
    store.updateSelectedElementsStyle({ backgroundColor: val });
  },
});

const isLocked = computed(() => {
  if (store.selectedElementIds.length === 0) return false;
  return store.selectedElement?.locked || false;
});

const isFontControlsDisabled = computed(() => {
  return (
    isHandPanActive.value ||
    !store.selectedElementId ||
    isLocked.value ||
    store.selectedElement?.type === ElementType.IMAGE ||
    !store.isTemplateEditable
  );
});

const canBringToFront = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "front");
});

const canSendToBack = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "back");
});

const canMoveLayerUp = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "forward");
});

const canMoveLayerDown = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "backward");
});

const canMatchSelectedSize = computed(() => {
  return (
    store.selectedElementIds.length > 1 &&
    !isLocked.value &&
    store.isTemplateEditable
  );
});

const canDistributeSelectedElements = computed(() => {
  return (
    store.selectedElementIds.length > 2 &&
    !isLocked.value &&
    store.isTemplateEditable
  );
});

const canSelectAllCurrentPage = computed(() => {
  if (!store.isTemplateEditable || isHandPanActive.value) return false;
  return store.pages.some((page) => page.elements.length > 0);
});

const selectedTableSelectionElement = computed(() => {
  const selection = store.tableSelection;
  if (!selection) return null;

  for (const page of store.pages) {
    const element = page.elements.find((item) => item.id === selection.elementId);
    if (element?.type === ElementType.TABLE) return element;
  }

  return null;
});

const canMergeSelectedTableCells = computed(() => {
  const selection = store.tableSelection;
  const element = selectedTableSelectionElement.value;
  if (!store.isTemplateEditable || !selection || !element || element.locked) {
    return false;
  }
  if (selection.cells.length < 2) return false;
  const section = selection.cells[0].section || "body";
  return selection.cells.every((cell) => (cell.section || "body") === section);
});

const canSplitSelectedTableCell = computed(() => {
  const selection = store.tableSelection;
  const element = selectedTableSelectionElement.value;
  if (!store.isTemplateEditable || !selection || !element || element.locked) {
    return false;
  }
  if (selection.cells.length !== 1) return false;

  const cell = selection.cells[0];
  const targetData = (cell.section || "body") === "footer" ? element.footerData : element.data;
  const row = targetData?.[cell.rowIndex];
  const value = row?.[cell.colField];
  if (!value || typeof value !== "object") return false;

  return (value.rowSpan || 1) > 1 || (value.colSpan || 1) > 1;
});

const handleSelectAll = () => {
  store.selectAllElements();
};

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

const resetAlignmentCycle = () => {
  alignmentCycle.value = createAlignmentCycle();
  isContentAlignmentMode.value = false;
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

const handleAlignmentClick = (type: AlignmentType) => {
  if (isContentAlignmentMode.value) {
    if (isHorizontalAlignment(type)) {
      if (store.selectedElement?.style.textAlign === type) {
        store.updateSelectedElementsStyle({ textAlign: "" });
        resetAlignmentCycle();
      } else {
        store.updateSelectedElementsStyle({ textAlign: type });
      }
    } else if (store.selectedElement?.style.verticalAlign === type) {
      store.updateSelectedElementsStyle({ verticalAlign: "" });
      resetAlignmentCycle();
    } else {
      store.updateSelectedElementsStyle({ verticalAlign: type });
    }
    return;
  }

  const step = alignmentCycle.value[type];

  if (step === "element") {
    store.alignSelectedElements(type);
    setNextAlignmentCycleStep(type, "content");
    return;
  }

  if (step === "content") {
    if (isHorizontalAlignment(type)) {
      store.updateSelectedElementsStyle({ textAlign: type });
    } else {
      store.updateSelectedElementsStyle({ verticalAlign: type });
    }
    isContentAlignmentMode.value = true;
    return;
  }
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

const toggleTextDecoration = (token: "underline" | "line-through") => {
  const next = getTextDecorationSet(store.selectedElement?.style.textDecoration);

  if (next.has(token)) {
    next.delete(token);
  } else {
    next.add(token);
  }

  store.updateSelectedElementsStyle({
    textDecoration: next.size > 0 ? Array.from(next).join(" ") : "none",
  });
};

const toggleUnderline = () => {
  toggleTextDecoration("underline");
};

const toggleStrikethrough = () => {
  toggleTextDecoration("line-through");
};

const toggleVertical = () => {
  store.updateSelectedElementsStyle({
    writingMode: isVertical.value ? "horizontal-tb" : "vertical-rl",
  });
};

const resetRotation = () => {
  store.updateSelectedElementsStyle({ rotate: 0 });
};

const clearTextFormatting = () => {
  store.updateSelectedElementsStyle({
    fontFamily: "",
    fontSize: 12,
    fontWeight: "400",
    fontStyle: "normal",
    textDecoration: "none",
    writingMode: "horizontal-tb",
    color: "#000000",
    backgroundColor: "transparent",
  });
};

const handleLayerMove = (mode: "front" | "back" | "forward" | "backward") => {
  const ids = [...store.selectedElementIds];
  if (ids.length === 0) return;

  if (mode === "back") {
    store.sendElementsToBack(ids);
    return;
  }

  if (mode === "forward") {
    store.moveElementsForward(ids);
    return;
  }

  if (mode === "backward") {
    store.moveElementsBackward(ids);
    return;
  }

  store.moveElementsLayer(ids, "front");
};

type FontOption = {
  label: string;
  value: string;
};

type FontGroup = {
  label: string;
  options: FontOption[];
};

const defaultFontGroups = computed<FontGroup[]>(() => [
  {
    label: t("editor.fontGroups.common"),
    options: [{ label: t("editor.fonts.default"), value: "" }],
  },
  {
    label: t("editor.fontGroups.chinese"),
    options: [
      {
        label: t("editor.fonts.microsoftYaHei"),
        value: '"Microsoft YaHei", "微软雅黑", sans-serif',
      },
      {
        label: t("editor.fonts.pingFangSC"),
        value: '"PingFang SC", "Microsoft YaHei", sans-serif',
      },
      { label: t("editor.fonts.simSun"), value: "SimSun, serif" },
      { label: t("editor.fonts.simHei"), value: "SimHei, sans-serif" },
      { label: t("editor.fonts.kaiTi"), value: "KaiTi, STKaiti, serif" },
      {
        label: t("editor.fonts.fangSong"),
        value: "FangSong, STFangsong, serif",
      },
      { label: t("editor.fonts.dengXian"), value: "DengXian, sans-serif" },
    ],
  },
  {
    label: t("editor.fontGroups.western"),
    options: [
      { label: t("editor.fonts.arial"), value: "Arial, sans-serif" },
      {
        label: t("editor.fonts.timesNewRoman"),
        value: '"Times New Roman", serif',
      },
      { label: t("editor.fonts.verdana"), value: "Verdana, sans-serif" },
      { label: t("editor.fonts.georgia"), value: "Georgia, serif" },
      { label: t("editor.fonts.tahoma"), value: "Tahoma, sans-serif" },
    ],
  },
  {
    label: t("editor.fontGroups.monospace"),
    options: [
      {
        label: t("editor.fonts.courierNew"),
        value: '"Courier New", monospace',
      },
    ],
  },
]);

const fontGroups = computed<FontGroup[]>(() => {
  const customOptions = store.fontOptions || [];
  if (!customOptions.length) {
    return defaultFontGroups.value;
  }

  const normalizedCustom = customOptions.map((opt) => ({
    label: (opt.label || opt.value || "").trim(),
    value: opt.value,
  }));
  const customFontGroup = {
    label: t("editor.fontGroups.custom"),
    options: normalizedCustom,
  };
  const hasDefaultOption = normalizedCustom.some((opt) => opt.value === "");

  if (hasDefaultOption) {
    return [customFontGroup];
  }

  return [...defaultFontGroups.value, customFontGroup];
});

const handleZoomIn = () => {
  const currentPercent = Math.round(store.zoom * 100);
  const nextPercent = Math.min(currentPercent + 10, 500);
  store.setZoom(nextPercent / 100);
  zoomPercent.value = nextPercent;
};

const handleZoomOut = () => {
  const currentPercent = Math.round(store.zoom * 100);
  const nextPercent = Math.max(currentPercent - 10, 20);
  store.setZoom(nextPercent / 100);
  zoomPercent.value = nextPercent;
};

watch(
  () => store.zoom,
  (z) => {
    zoomPercent.value = Math.round(z * 100);
  },
);

watch(
  () => store.selectedElementIds.length,
  () => {
    nextTick(() => {
      updateToolbarScrollState(!hasToolbarManualScroll);
    });
  },
);

watch(showZoomSettings, (val) => {
  if (!val) return;
  nextTick(() => {
    updateZoomSettingsMenuPosition();
  });
});

const handleZoomSlider = () => {
  const clamped = Math.max(20, Math.min(500, zoomPercent.value));
  zoomPercent.value = clamped;
  store.setZoom(clamped / 100);
};

const toggleHandPanMode = () => {
  const nextActive = !isHandPanActive.value;
  if (nextActive) {
    store.clearSelection();
  }
  isHandPanActive.value = nextActive;
  dispatchDesignerEvent("designer:set-hand-pan-mode", {
    active: isHandPanActive.value,
  });
};

const toggleElementsPanel = () => {
  dispatchDesignerEvent("designer:toggle-elements-panel");
};

const toggleTemplatePanel = () => {
  dispatchDesignerEvent("designer:toggle-template-panel");
};

const togglePropertiesPanel = () => {
  dispatchDesignerEvent("designer:toggle-properties-panel");
};

const toggleMinimapPanel = () => {
  store.setShowMinimap(!store.showMinimap);
};

const toggleHistoryPanel = () => {
  store.setShowHistoryPanel(!store.showHistoryPanel);
};

const openHelpPanel = () => {
  store.setShowHelp(true);
};

const openSettingsPanel = () => {
  store.setShowSettings(true);
};

const handlePreview = async () => {
  try {
    const pages = Array.from(
      getQueryRoot().querySelectorAll(".print-page"),
    ) as HTMLElement[];
    previewContent.value = await getPrintHtml(pages);
    showPreview.value = true;
  } catch (e) {
    console.error(e);
    toast.error("Preview generation failed");
  }
};

const handlePrint = async () => {
  // Use real DOM elements to ensure computed styles are captured correctly, similar to exportPdf
  const pages = Array.from(
    getQueryRoot().querySelectorAll(".print-page"),
  ) as HTMLElement[];
  if (printMode.value !== "browser" && !silentPrint.value) {
    pendingPrintContent.value = pages;
    showPrintDialog.value = true;
    return;
  }
  await print(pages, { mode: printModeValue.value });
};

const handlePrintConfirm = async (options: PrintOptions) => {
  if (printMode.value === "local") {
    Object.assign(localPrintOptions, options);
  }
  if (printMode.value === "remote") {
    Object.assign(remotePrintOptions, options);
  }

  const content =
    pendingPrintContent.value ||
    (Array.from(
      getQueryRoot().querySelectorAll(".print-page"),
    ) as HTMLElement[]);
  pendingPrintContent.value = null;
  showPrintDialog.value = false;
  await print(content, { mode: printModeValue.value, options });
};

const handleExport = async () => {
  const baseName = getExportBaseName();
  await exportPdf(undefined, `${baseName}.pdf`);
};

const handleExportHtmlBtn = async () => {
  const baseName = getExportBaseName();
  await exportHtml(undefined, `${baseName}.html`);
};

const handleExportImages = async () => {
  const baseName = getExportBaseName();
  await exportImages(undefined, baseName);
};

const handleSave = () => {
  if (templateStore.currentTemplateId) {
    const t = templateStore.templates.find(
      (t) => t.id === templateStore.currentTemplateId,
    );
    if (t) {
      templateStore.saveCurrentTemplate(t.name);
      // Optional: feedback
      return;
    }
  }
  dispatchDesignerEvent("designer:new-template");
};

const getExportBaseName = () => {
  const current = templateStore.templates.find(
    (t) => t.id === templateStore.currentTemplateId,
  );
  const rawName = (current?.name || "print-design").trim();
  const safeName =
    rawName
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "print-design";
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${safeName}-${yyyy}${mm}${dd}`;
};

const handlePreviewEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handlePreview();
};

const handleSaveEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleSave();
};

const handlePrintEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handlePrint();
};

const handleExportEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleExport();
};

const handleExportHtmlEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleExportHtmlBtn();
};

const handleExportImagesEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleExportImages();
};

const handleViewJsonEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleViewJson();
};

const handleViewImageBlobEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleViewImageBlob();
};

const handleViewPdfBlobEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  handleViewPdfBlob();
};

const handleElementsPanelVisibilityEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const visible = (e as CustomEvent)?.detail?.visible;
  if (typeof visible !== "boolean") return;
  isElementsPanelVisible.value = visible;
};

const handleTemplatePanelVisibilityEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const visible = (e as CustomEvent)?.detail?.visible;
  if (typeof visible !== "boolean") return;
  isTemplatePanelVisible.value = visible;
};

const handlePropertiesPanelVisibilityEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const visible = (e as CustomEvent)?.detail?.visible;
  if (typeof visible !== "boolean") return;
  isPropertiesPanelVisible.value = visible;
};

onMounted(() => {
  window.addEventListener("designer:preview", handlePreviewEvent);
  window.addEventListener("designer:save", handleSaveEvent);
  window.addEventListener("designer:print", handlePrintEvent);
  window.addEventListener("designer:export-pdf", handleExportEvent);
  window.addEventListener("designer:export-html", handleExportHtmlEvent);
  window.addEventListener("designer:export-images", handleExportImagesEvent);
  window.addEventListener("designer:view-json", handleViewJsonEvent);
  window.addEventListener("designer:view-blob", handleViewImageBlobEvent);
  window.addEventListener("designer:view-pdf-blob", handleViewPdfBlobEvent);
  window.addEventListener(
    "designer:elements-panel-visibility",
    handleElementsPanelVisibilityEvent,
  );
  window.addEventListener(
    "designer:template-panel-visibility",
    handleTemplatePanelVisibilityEvent,
  );
  window.addEventListener(
    "designer:properties-panel-visibility",
    handlePropertiesPanelVisibilityEvent,
  );
  window.addEventListener("resize", handleToolbarResize);
  window.addEventListener("resize", handleZoomSettingsViewportChange);
  window.addEventListener("scroll", handleZoomSettingsViewportChange, true);

  dispatchDesignerEvent("designer:set-hand-pan-mode", {
    active: isHandPanActive.value,
  });

  nextTick(() => {
    updateToolbarScrollState(true);
    toolbarResizeObserver = new ResizeObserver(() => {
      updateToolbarScrollState(!hasToolbarManualScroll);
    });

    if (toolbarScrollRef.value) {
      toolbarResizeObserver.observe(toolbarScrollRef.value);
    }
    if (toolbarScrollContentRef.value) {
      toolbarResizeObserver.observe(toolbarScrollContentRef.value);
    }
  });
});

onUnmounted(() => {
  dispatchDesignerEvent("designer:set-hand-pan-mode", {
    active: false,
  });

  window.removeEventListener("designer:preview", handlePreviewEvent);
  window.removeEventListener("designer:save", handleSaveEvent);
  window.removeEventListener("designer:print", handlePrintEvent);
  window.removeEventListener("designer:export-pdf", handleExportEvent);
  window.removeEventListener("designer:export-html", handleExportHtmlEvent);
  window.removeEventListener("designer:export-images", handleExportImagesEvent);
  window.removeEventListener("designer:view-json", handleViewJsonEvent);
  window.removeEventListener("designer:view-blob", handleViewImageBlobEvent);
  window.removeEventListener("designer:view-pdf-blob", handleViewPdfBlobEvent);
  window.removeEventListener(
    "designer:elements-panel-visibility",
    handleElementsPanelVisibilityEvent,
  );
  window.removeEventListener(
    "designer:template-panel-visibility",
    handleTemplatePanelVisibilityEvent,
  );
  window.removeEventListener(
    "designer:properties-panel-visibility",
    handlePropertiesPanelVisibilityEvent,
  );
  window.removeEventListener("resize", handleToolbarResize);
  window.removeEventListener("resize", handleZoomSettingsViewportChange);
  window.removeEventListener("scroll", handleZoomSettingsViewportChange, true);

  if (toolbarResizeObserver) {
    toolbarResizeObserver.disconnect();
    toolbarResizeObserver = null;
  }
});
</script>

<template>
  <div
    class="flex min-w-0 flex-1 items-stretch justify-end gap-0 text-gray-700 dark:text-gray-200"
  >
    <button
      v-if="isToolbarOverflowing"
      type="button"
      class="shrink-0 self-stretch relative z-10 overflow-hidden flex items-center justify-center px-2 rounded-none border-r border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      :disabled="!canScrollToolbarLeft"
      :title="t('editor.toolbarScrollPrev')"
      :aria-label="t('editor.toolbarScrollPrev')"
      @click="scrollToolbar('backward')"
    >
      <KeyboardArrowLeft class="relative z-10 h-4 w-4" />
    </button>

    <div
      ref="toolbarScrollRef"
      class="no-scrollbar min-w-0 flex-1 overflow-x-auto flex items-center"
      @scroll="handleToolbarScroll"
    >
      <div
        ref="toolbarScrollContentRef"
        class="flex w-max min-w-max items-center gap-1 pr-1"
        :class="{ 'ml-auto': !isToolbarOverflowing }"
      >
    <!-- Font Controls -->
    <div
      class="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 px-2"
    >
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <!-- Font Family -->
      <select
        v-model="selectedFont"
        :disabled="isFontControlsDisabled"
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

      <!-- Font Size -->
      <div class="flex items-center gap-1">
        <button
          @click="selectedFontSize--"
          :disabled="isFontControlsDisabled"
          class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          -
        </button>
        <input
          type="number"
          v-model="selectedFontSize"
          :disabled="isFontControlsDisabled"
          class="w-12 text-center text-sm bg-transparent dark:bg-gray-800 border-none outline-none focus:ring-0 p-0 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:text-gray-200"
          min="1"
          max="200"
        />
        <button
          @click="selectedFontSize++"
          :disabled="isFontControlsDisabled"
          class="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>

      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <!-- Style Toggles -->
      <button
        @click="toggleBold"
        :disabled="isFontControlsDisabled"
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
        :disabled="isFontControlsDisabled"
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
        :disabled="isFontControlsDisabled"
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
        @click="toggleStrikethrough"
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isStrikethrough,
        }"
        :title="t('editor.strikethrough')"
      >
        <StrikethroughS class="w-4 h-4" />
      </button>

      <button
        @click="toggleVertical"
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isVertical,
        }"
        :title="t('editor.verticalText')"
      >
        <TextRotateVertical class="w-4 h-4" />
      </button>

      <ColorPicker
        v-model="selectedColor"
        :disabled="isFontControlsDisabled"
        default-color="#000000"
        :teleport-to-body="true"
      >
        <template #trigger="{ color }">
          <button
            type="button"
            class="flex items-center gap-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isFontControlsDisabled"
            :title="t('editor.textColor')"
          >
            <FontDownload class="w-4 h-4" />
            <div
              class="w-1 h-3.5 rounded-[1px] border border-gray-300 dark:border-gray-600"
              :style="{ backgroundColor: color }"
            ></div>
          </button>
        </template>
      </ColorPicker>

      <ColorPicker
        v-model="selectedBackgroundColor"
        :disabled="isFontControlsDisabled"
        :allow-transparent="true"
        default-color="transparent"
        :teleport-to-body="true"
      >
        <template #trigger="{ color }">
          <button
            type="button"
            class="flex items-center gap-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isFontControlsDisabled"
            :title="t('editor.backgroundColor')"
          >
            <FormatColorFill class="w-4 h-4" />
            <div
              class="w-1 h-3.5 rounded-[1px] border border-gray-300 dark:border-gray-600 relative overflow-hidden bg-white"
            >
              <div
                v-if="color === 'transparent'"
                class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50 bg-repeat bg-[length:6px_6px]"
              ></div>
              <div
                class="absolute inset-0"
                :style="{
                  backgroundColor:
                    color === 'transparent' ? 'transparent' : color,
                }"
              ></div>
              <div
                v-if="color === 'transparent'"
                class="absolute inset-0 flex items-center justify-center"
              >
                <div
                  class="w-full h-[1px] bg-red-500 rotate-90 transform scale-150"
                ></div>
              </div>
            </div>
          </button>
        </template>
      </ColorPicker>

      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <button
        @click="clearTextFormatting"
        :disabled="isFontControlsDisabled"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :title="t('editor.clearTextFormat')"
      >
        <FormatClear class="w-4 h-4" />
      </button>

      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700"></div>

      <button
        @click="resetRotation"
        :disabled="
          isHandPanActive ||
          isLocked ||
          !store.selectedElementId ||
          !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :title="t('editor.resetRotation')"
      >
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Alignment -->
    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="handleAlignmentClick('left')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignLeft')"
      >
        <AlignLeft class="w-4 h-4" />
      </button>
      <button
        @click="handleAlignmentClick('center')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignCenter')"
      >
        <AlignCenterHorizontal class="w-4 h-4" />
      </button>
      <button
        @click="handleAlignmentClick('right')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignRight')"
      >
        <AlignRight class="w-4 h-4" />
      </button>
      <button
        @click="handleAlignmentClick('top')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignTop')"
      >
        <AlignLeft class="w-4 h-4 rotate-90" />
      </button>
      <button
        @click="handleAlignmentClick('middle')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignMiddle')"
      >
        <AlignCenterHorizontal class="w-4 h-4 rotate-90" />
      </button>
      <button
        @click="handleAlignmentClick('bottom')"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.alignBottom')"
      >
        <AlignRight class="w-4 h-4 rotate-90" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button
        @click="store.splitSelectedCells()"
        :disabled="!canSplitSelectedTableCell"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.splitCells')"
      >
        <GridViewOutline class="w-4 h-4" />
      </button>
      <button
        @click="store.mergeSelectedCells()"
        :disabled="!canMergeSelectedTableCells"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.mergeCells')"
      >
        <CellMerge class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Size & Distribution -->
    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="store.matchSelectedElementsSize('width')"
        :disabled="!canMatchSelectedSize"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.matchWidth')"
      >
        <WidthIcon class="w-4 h-4" />
      </button>
      <button
        @click="store.matchSelectedElementsSize('height')"
        :disabled="!canMatchSelectedSize"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.matchHeight')"
      >
        <HeightIcon class="w-4 h-4" />
      </button>
      <button
        @click="store.matchSelectedElementsSize('both')"
        :disabled="!canMatchSelectedSize"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.matchSize')"
      >
        <AspectRatioIcon class="w-4 h-4" />
      </button>
      <button
        @click="store.distributeSelectedElements('horizontal')"
        :disabled="!canDistributeSelectedElements"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.distributeHorizontal')"
      >
        <HorizontalDistribute class="w-4 h-4" />
      </button>
      <button
        @click="store.distributeSelectedElements('vertical')"
        :disabled="!canDistributeSelectedElements"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('editor.distributeVertical')"
      >
        <VerticalDistribute class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Layer Arrangement -->
    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="handleLayerMove('front')"
        :disabled="!canBringToFront"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('properties.action.bringToFront')"
      >
        <AlignStartVertical class="w-4 h-4" />
      </button>
      <button
        @click="handleLayerMove('back')"
        :disabled="!canSendToBack"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('properties.action.sendToBack')"
      >
        <AlignEndVertical class="w-4 h-4" />
      </button>
      <button
        @click="handleLayerMove('forward')"
        :disabled="!canMoveLayerUp"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('properties.action.moveUp')"
      >
        <MoveUpIcon class="w-4 h-4" />
      </button>
      <button
        @click="handleLayerMove('backward')"
        :disabled="!canMoveLayerDown"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('properties.action.moveDown')"
      >
        <MoveDownIcon class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- History & Edit -->
    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="store.undo()"
        :disabled="store.historyPast.length === 0"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.undo') + ' (' + formatShortcut(['Ctrl', 'Z']) + ')'"
      >
        <Undo2 class="w-4 h-4" />
      </button>
      <button
        @click="store.redo()"
        :disabled="store.historyFuture.length === 0"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.redo') + ' (' + formatShortcut(['Ctrl', 'Y']) + ')'"
      >
        <Redo2 class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button
        @click="handleSelectAll"
        :disabled="!canSelectAllCurrentPage"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="
          t('common.selectAll') + ' (' + formatShortcut(['Ctrl', 'A']) + ')'
        "
      >
        <SelectAllIcon class="w-4 h-4" />
      </button>
      <button
        @click="store.cut()"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.cut') + ' (' + formatShortcut(['Ctrl', 'X']) + ')'"
      >
        <CutIcon class="w-4 h-4" />
      </button>
      <button
        @click="store.copy()"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.copy') + ' (' + formatShortcut(['Ctrl', 'C']) + ')'"
      >
        <Copy class="w-4 h-4" />
      </button>
      <button
        @click="store.paste()"
        :disabled="store.clipboard.length === 0 || !store.isTemplateEditable"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.paste') + ' (' + formatShortcut(['Ctrl', 'V']) + ')'"
      >
        <ClipboardPaste class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button
        @click="store.toggleLock()"
        :disabled="!store.selectedElementId || !store.isTemplateEditable"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="
          (isLocked ? t('editor.unlock') : t('editor.lock')) +
          ' (' +
          formatShortcut(['Ctrl', 'L']) +
          ')'
        "
      >
        <Unlock v-if="isLocked" class="w-4 h-4 text-red-500" />
        <Lock v-else class="w-4 h-4" />
      </button>
      <button
        @click="store.removeSelectedElements()"
        :disabled="
          !store.selectedElementId || isLocked || !store.isTemplateEditable
        "
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
        :title="t('common.delete') + ' (' + formatShortcut(['Del']) + ')'"
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Paper Settings -->
    <PaperSettings />

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Zoom Settings -->
    <div class="relative" ref="zoomTriggerRef">
      <div
        class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
      >
        <button
          @click="handleZoomOut"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          :title="t('editor.zoomOut')"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          @click="showZoomSettings = !showZoomSettings"
          class="text-xs w-12 text-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1 py-0.5"
          :title="t('editor.zoomSettings')"
        >
          {{ Math.round(store.zoom * 100) }}%
        </button>
        <button
          @click="handleZoomIn"
          class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          :title="t('editor.zoomIn')"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="toggleHandPanMode"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isHandPanActive,
        }"
        :title="t('editor.handPan')"
      >
        <PanTool class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="toggleElementsPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isElementsPanelVisible,
        }"
        :title="t('sidebar.elements')"
      >
        <ViewSidebar class="w-4 h-4" />
      </button>
      <button
        @click="toggleTemplatePanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isTemplatePanelVisible,
        }"
        :title="t('editor.templates')"
      >
        <ListIcon class="w-4 h-4" />
      </button>
      <button
        @click="togglePropertiesPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            isPropertiesPanelVisible,
        }"
        :title="t('properties.title')"
      >
        <Tune class="w-4 h-4" />
      </button>
      <button
        @click="toggleMinimapPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            store.showMinimap,
        }"
        :title="t('editor.showMinimap')"
      >
        <GridView class="w-4 h-4" />
      </button>
      <button
        @click="toggleHistoryPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :class="{
          'bg-gray-300 dark:bg-gray-700 text-blue-700 dark:text-blue-400':
            store.showHistoryPanel,
        }"
        :title="t('editor.showHistoryPanel')"
      >
        <History class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <!-- Quick Access (Office-like) -->
    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="handlePreview"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.preview') + ' (' + formatShortcut(['Ctrl', 'Shift', 'P']) + ')'"
      >
        <Preview class="w-4 h-4" />
      </button>
      <button
        @click="handlePrint"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.print') + ' (' + formatShortcut(['Ctrl', 'P']) + ')'"
      >
        <Printer class="w-4 h-4" />
      </button>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button
        @click="handleExport"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.exportPdf')"
      >
        <FilePdf class="w-4 h-4" />
      </button>
      <button
        @click="handleExportHtmlBtn"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.exportHtml')"
      >
        <HtmlIcon class="w-4 h-4" />
      </button>
      <button
        @click="handleExportImages"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.exportImage')"
      >
        <Image class="w-4 h-4" />
      </button>
    </div>

    <div class="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

    <div
      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
    >
      <button
        @click="openHelpPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.help')"
      >
        <HelpCircle class="w-4 h-4" />
      </button>
      <button
        @click="openSettingsPanel"
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        :title="t('editor.settings')"
      >
        <SettingsIcon class="w-4 h-4" />
      </button>
    </div>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showZoomSettings"
        class="fixed inset-0 z-[1999] pointer-events-auto"
        @click="showZoomSettings = false"
      ></div>

      <div
        v-if="showZoomSettings"
        class="fixed w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-4 z-[2000] pointer-events-auto"
        :style="zoomSettingsMenuStyle"
        @click.stop
      >
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          {{ t("editor.zoomLevel") }}
        </h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >{{ t("editor.zoomLevel") }} (20% - 500%)</label
            >
            <input
              type="range"
              min="20"
              max="500"
              step="10"
              v-model.number="zoomPercent"
              @input="handleZoomSlider"
              class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 dark:[&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 dark:[&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110"
            />
            <div
              class="text-right text-xs text-gray-600 dark:text-gray-400 mt-1"
            >
              {{ zoomPercent }}%
            </div>
          </div>
        </div>
      </div>
    </Teleport>

        <!-- Help moved to dropdown -->
      </div>
    </div>

    <button
      v-if="isToolbarOverflowing"
      type="button"
      class="shrink-0 self-stretch relative z-10 overflow-hidden flex items-center justify-center px-2 rounded-none border-l border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      :disabled="!canScrollToolbarRight"
      :title="t('editor.toolbarScrollNext')"
      :aria-label="t('editor.toolbarScrollNext')"
      @click="scrollToolbar('forward')"
    >
      <KeyboardArrowRight class="relative z-10 h-4 w-4" />
    </button>
  </div>

  <PreviewModal
    v-model:visible="showPreview"
    :html-content="previewContent"
    :width="store.canvasSize.width"
  />

  <PrintDialog
    v-model:show="showPrintDialog"
    :mode="printModeValue"
    :options="activePrintOptions"
    @confirm="handlePrintConfirm"
  />

  <CodeEditorModal
    v-model:visible="showJsonModal"
    :title="modalTitle"
    :value="jsonContent"
    :language="modalLanguage"
    :read-only="!canSaveJson"
    :show-save-button="canSaveJson"
    :show-copy-button="true"
    @update:value="jsonContent = $event"
    @save="handleSaveJson"
  />
</template>
