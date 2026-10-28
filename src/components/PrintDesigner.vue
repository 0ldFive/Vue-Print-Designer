<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  nextTick,
  computed,
  watch,
  defineAsyncComponent,
} from "vue";
import { useI18n } from "@/locales";
import { uiConfirm } from "@/utils/confirm";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { useAutoSave } from "@/composables/useAutoSave";
import { useFeatureFlags } from "@/composables/useFeatureFlags";
import { useTheme } from "@/composables/useTheme";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import debounce from "lodash/debounce";
import { canEditEntity } from "@/utils/entityConstraints";
import { pxToUnit, type Unit } from "@/utils/units";
import { parseColor, toRgbaString } from "@/utils/color";
import Header from "./layout/Header.vue";
import ElementsPanel from "./layout/ElementsPanel.vue";
import PropertiesPanel from "./layout/PropertiesPanel.vue";
import Canvas from "./canvas/Canvas.vue";
import Ruler from "./layout/Ruler.vue";
import Shortcuts from "./layout/Shortcuts.vue";
import HistoryPanel from "./layout/HistoryPanel.vue";
import InputModal from "@/components/common/InputModal.vue";
import { toast } from "@/utils/toast";
import StatusBar from "./layout/StatusBar.vue";
import CustomEditBanner from "./print-designer/modules/CustomEditBanner.vue";
import FloatingBasicPanel from "./print-designer/modules/FloatingBasicPanel.vue";
import FloatingMinimapPanel from "./print-designer/modules/FloatingMinimapPanel.vue";
import FloatingTemplatePanel from "./print-designer/modules/FloatingTemplatePanel.vue";
import FloatingStructurePanel from "./print-designer/modules/FloatingStructurePanel.vue";
import GlobalLoadingOverlay from "./print-designer/modules/GlobalLoadingOverlay.vue";
import { useFloatingPanels } from "./print-designer/composables/useFloatingPanels";

const store = useDesignerStore();
const templateStore = useTemplateStore();
const { autoSave } = useAutoSave();
const { aiEnabled, hiddenModules } = useFeatureFlags();
const aiHidden = computed(() => hiddenModules.value.ai === true);
const marketHidden = computed(() => hiddenModules.value.market === true);
const { isDark } = useTheme();
const { t } = useI18n();

// AI is hot-pluggable: its chunk loads only after the panel is first opened.
// A transient dev-server/module error must not permanently block the panel,
// so retry once and reset the mount flag on failure.
const hasLoadedAiPanel = ref(false);
const FloatingAiPanel = defineAsyncComponent({
  loader: () => import("@/ai/components/FloatingAiPanel.vue"),
  onError: (_error, retry, fail, attempts) => {
    if (attempts <= 1) {
      retry();
      return;
    }
    hasLoadedAiPanel.value = false;
    showAiPanel.value = false;
    fail();
  },
});

// The market gallery follows the same lazy-mount rule as the AI panel.
const hasLoadedMarket = ref(false);
const showMarket = ref(false);
const MarketModal = defineAsyncComponent({
  loader: () => import("@/market/components/MarketModal.vue"),
  onError: (_error, retry, fail, attempts) => {
    if (attempts <= 1) {
      retry();
      return;
    }
    hasLoadedMarket.value = false;
    showMarket.value = false;
    fail();
  },
});

const props = defineProps<{ headless?: boolean }>();

const scrollContainer = ref<HTMLElement | null>(null);
const projectionViewportRef = ref<HTMLElement | null>(null);
const panelsHostRef = ref<HTMLElement | null>(null);
const rootContainer = ref<HTMLElement | null>(null);
const modalContainer = ref<HTMLElement | null>(null);
const isHandPanActive = ref(false);
const isHandPanning = ref(false);
const designerInstanceId = `designer-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
const HAND_PAN_MIN_EDGE_SPACE = 320;
const HAND_PAN_IGNORED_TARGET_SELECTOR =
  "button, a, input, textarea, select, label, [role='button'], [role='menuitem'], [contenteditable='true'], [data-hand-pan-ignore='true'], .resize-handle, .rotate-handle";
let resizeObserver: ResizeObserver | null = null;
const canvasContainer = ref<HTMLElement | null>(null);

// Provide root and modal container for children
import { provide } from "vue";
provide("designer-root", rootContainer);
provide("modal-container", modalContainer);
provide("designer-instance-id", designerInstanceId);
provide("designer-hand-pan-active", isHandPanActive);
const canvasWrapper = ref<HTMLElement | null>(null);
const showSaveAsModal = ref(false);
const brandTick = ref(0);
const showTemplateHelpTooltip = ref(false);
const templateHelpButtonRef = ref<HTMLElement | null>(null);
const templateHelpTooltipRef = ref<HTMLElement | null>(null);
const showStructureHelpTooltip = ref(false);
const structureHelpButtonRef = ref<HTMLElement | null>(null);
const structureHelpTooltipRef = ref<HTMLElement | null>(null);
const normalizeRefElement = (el: any): HTMLElement | null => {
  if (el instanceof HTMLElement) return el;
  if (el && el.$el instanceof HTMLElement) return el.$el;
  return null;
};
const setTemplateHelpButtonRef = (el: any) => {
  templateHelpButtonRef.value = normalizeRefElement(el);
};
const setTemplateHelpTooltipRef = (el: any) => {
  templateHelpTooltipRef.value = normalizeRefElement(el);
};
const setStructureHelpButtonRef = (el: any) => {
  structureHelpButtonRef.value = normalizeRefElement(el);
};
const setStructureHelpTooltipRef = (el: any) => {
  structureHelpTooltipRef.value = normalizeRefElement(el);
};
const templatePanelHelp = computed(() => ({
  title: t("template.help.title"),
  items: [
    t("template.help.items.manage"),
    t("template.help.items.variables"),
    t("template.help.items.persist"),
  ],
}));
const {
  arrowStyle: templateHelpArrowStyle,
  placement: templateHelpPlacement,
  toggleTooltip: toggleTemplateHelpTooltip,
  tooltipStyle: templateHelpTooltipStyle,
} = useFloatingTooltip(
  showTemplateHelpTooltip,
  templateHelpButtonRef,
  templateHelpTooltipRef,
  { width: 288 },
);
const structurePanelHelp = computed(() => ({
  title: t("elementsPanel.layoutHelp.title"),
  items: [
    t("elementsPanel.layoutHelp.items.overview"),
    t("elementsPanel.layoutHelp.items.select"),
    t("elementsPanel.layoutHelp.items.actions"),
  ],
}));
const {
  arrowStyle: structureHelpArrowStyle,
  placement: structureHelpPlacement,
  toggleTooltip: toggleStructureHelpTooltip,
  tooltipStyle: structureHelpTooltipStyle,
} = useFloatingTooltip(
  showStructureHelpTooltip,
  structureHelpButtonRef,
  structureHelpTooltipRef,
  { width: 288 },
);

const {
  showElementsPanel,
  showTemplatePanel,
  showPropertiesPanel,
  showStructurePanel,
  showAiPanel,
  sidebarPanelStyle,
  templatePanelStyle,
  propertiesPanelStyle,
  structurePanelStyle,
  aiPanelStyle,
  historyPanelStyle,
  minimapPanelStyle,
  minimapPreviewWidth,
  minimapPreviewMaxHeight,
  getPanelZIndex,
  handleFloatingPanelMouseDown,
  startPanelResize,
  closeTemplatePanel,
  closeStructurePanel,
  closeAiPanel,
  initOrClampFloatingPanels,
  ensureSidebarNotOverlappingTemplatePanel,
  restoreTemplatePanelLayout,
  resetTemplateLayoutWhenElementsPanelHidden,
  emitElementsPanelVisibility,
  emitTemplatePanelVisibility,
  emitPropertiesPanelVisibility,
  emitStructurePanelVisibility,
  handleToggleElementsPanelEvent,
  handleCloseElementsPanelEvent,
  handleToggleTemplatePanelEvent,
  handleTogglePropertiesPanelEvent,
  handleToggleStructurePanelEvent,
  handleClosePropertiesPanelEvent,
  handleCloseStructurePanelEvent,
  handleToggleAiPanelEvent,
  handleCloseAiPanelEvent,
  handleBringPanelToFrontEvent,
  stopPanelDrag,
  stopPanelResize,
} = useFloatingPanels({
  store,
  panelsHostRef,
  scrollContainer,
  designerInstanceId,
  showTemplateHelpTooltip,
  showStructureHelpTooltip,
});

const handleBrandThemeUpdated = () => {
  brandTick.value += 1;
};

const isEventForCurrentDesigner = (e: Event) => {
  const eventId = (e as CustomEvent)?.detail?.__designerInstanceId;
  if (!eventId) return true;
  return eventId === designerInstanceId;
};

const handleOpenMarketEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  if (marketHidden.value) return;
  hasLoadedMarket.value = true;
  showMarket.value = true;
};

let handPanStartPointer = { x: 0, y: 0 };
let handPanStartScroll = { left: 0, top: 0 };
let suppressNextHandPanClick = false;

const isElementInsideScrollContainer = (
  element: Element | null | undefined,
  container: HTMLElement,
) => {
  return !!element && (element === container || container.contains(element));
};

const isHandPanIgnoredTarget = (e: MouseEvent) => {
  const path =
    typeof e.composedPath === "function" ? e.composedPath() : [e.target];

  return path.some((item) => {
    if (!(item instanceof Element)) return false;
    return !!item.closest(HAND_PAN_IGNORED_TARGET_SELECTOR);
  });
};

const isEventInsideScrollContainer = (e: MouseEvent) => {
  if (!scrollContainer.value) return false;

  const container = scrollContainer.value;

  const path =
    typeof e.composedPath === "function" ? e.composedPath() : undefined;
  if (path && path.length > 0) {
    if (path.includes(container)) {
      return true;
    }
  }

  const target = e.target as Node | null;
  if (target && container.contains(target)) {
    return true;
  }

  const root = container.getRootNode() as Document | ShadowRoot;
  const elementsFromPoint =
    typeof root.elementsFromPoint === "function"
      ? root.elementsFromPoint(e.clientX, e.clientY)
      : [];
  const topElement = elementsFromPoint[0];

  return isElementInsideScrollContainer(topElement, container);
};

const handleHandPanMove = (e: MouseEvent) => {
  if (!isHandPanning.value || !scrollContainer.value) return;

  e.preventDefault();
  const deltaX = e.clientX - handPanStartPointer.x;
  const deltaY = e.clientY - handPanStartPointer.y;

  scrollContainer.value.scrollLeft = handPanStartScroll.left - deltaX;
  scrollContainer.value.scrollTop = handPanStartScroll.top - deltaY;
};

const stopHandPan = () => {
  if (!isHandPanning.value) return;

  isHandPanning.value = false;
  window.removeEventListener("mousemove", handleHandPanMove);
  window.removeEventListener("mouseup", stopHandPan);
};

const getCanvasViewportPosition = () => {
  if (!scrollContainer.value || !canvasWrapper.value) return null;

  const containerRect = scrollContainer.value.getBoundingClientRect();
  const wrapperRect = canvasWrapper.value.getBoundingClientRect();

  return {
    left:
      wrapperRect.left -
      containerRect.left -
      (scrollContainer.value.clientLeft || 0),
    top:
      wrapperRect.top -
      containerRect.top -
      (scrollContainer.value.clientTop || 0),
  };
};

const restoreCanvasViewportPosition = (
  previousPosition: { left: number; top: number } | null,
) => {
  if (!previousPosition) return;

  nextTick(() => {
    const currentPosition = getCanvasViewportPosition();
    if (!currentPosition || !scrollContainer.value) return;

    scrollContainer.value.scrollLeft +=
      currentPosition.left - previousPosition.left;
    scrollContainer.value.scrollTop +=
      currentPosition.top - previousPosition.top;
    updateOffset();
  });
};

// Deselect elements only when clicking completely outside the designer root.
// Inside the designer, deselection is handled by specific canvas handlers:
// - scrollContainer @click (gray background)
// - Canvas handleBackgroundClick (page white area, .self)
const handleOutsideClickDeselect = (e: MouseEvent) => {
  if (store.selectedElementIds.length === 0) return;
  if (!rootContainer.value) return;
  const path = e.composedPath();
  // Any click still inside the designer root - let canvas handlers decide.
  if (path.includes(rootContainer.value)) return;
  // Exempt the properties panel which may be teleported outside rootContainer.
  for (const node of path) {
    if (
      node instanceof Element &&
      node.getAttribute("data-floating-panel-key") === "properties"
    )
      return;
  }
  store.clearSelection();
};

const handleGlobalHandPanMouseDown = (e: MouseEvent) => {
  if (!isHandPanActive.value) return;
  if (e.button !== 0) return;
  if (!scrollContainer.value) return;
  if (isHandPanIgnoredTarget(e)) return;
  if (!isEventInsideScrollContainer(e)) return;

  e.preventDefault();
  e.stopPropagation();

  suppressNextHandPanClick = true;
  isHandPanning.value = true;
  handPanStartPointer = {
    x: e.clientX,
    y: e.clientY,
  };
  handPanStartScroll = {
    left: scrollContainer.value.scrollLeft,
    top: scrollContainer.value.scrollTop,
  };

  window.addEventListener("mousemove", handleHandPanMove);
  window.addEventListener("mouseup", stopHandPan);
};

const handleGlobalHandPanClickCapture = (e: MouseEvent) => {
  if (!isHandPanActive.value) return;
  if (!suppressNextHandPanClick) return;

  suppressNextHandPanClick = false;

  e.preventDefault();
  e.stopPropagation();
};

const handleSetHandPanModeEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const active = (e as CustomEvent)?.detail?.active;
  if (typeof active !== "boolean") return;

  const previousPosition = getCanvasViewportPosition();
  if (active) {
    store.clearSelection();
  }
  isHandPanActive.value = active;
  if (!active) {
    suppressNextHandPanClick = false;
    stopHandPan();
  }
  restoreCanvasViewportPosition(previousPosition);
};

const handleLayoutResize = () => {
  updateOffset();
  initOrClampFloatingPanels();
  requestAnimationFrame(() => {
    updateOffset();
    initOrClampFloatingPanels();
  });
};

const getThemeRgba = (cssVar: string, alpha: number) => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  const parsed = parseColor(value);
  if (!parsed) return `rgba(59, 130, 246, ${alpha})`;
  return toRgbaString(parsed.h, parsed.s, parsed.v, alpha);
};

const editingCustomElement = computed(() => store.editingCustomElement);
const saveAsInitialName = computed(() => {
  if (!editingCustomElement.value) return "";
  return `${editingCustomElement.value.name} Copy`;
});

onMounted(() => {
  // Reset isExporting flag on mount to ensure table truncation logic works in designer
  store.setIsExporting(false);
  restoreTemplatePanelLayout();
  resetTemplateLayoutWhenElementsPanelHidden();

  emitElementsPanelVisibility();
  emitTemplatePanelVisibility();
  emitPropertiesPanelVisibility();
  emitStructurePanelVisibility();

  nextTick(() => {
    updateOffset();
    initOrClampFloatingPanels();
    if (showElementsPanel.value && showTemplatePanel.value) {
      ensureSidebarNotOverlappingTemplatePanel();
      initOrClampFloatingPanels();
    }
  });

  resizeObserver = new ResizeObserver(() => {
    updateOffset();
    initOrClampFloatingPanels();
  });

  if (scrollContainer.value) {
    resizeObserver.observe(scrollContainer.value);
  }
  if (panelsHostRef.value) {
    resizeObserver.observe(panelsHostRef.value);
  }

  window.addEventListener("resize", handleLayoutResize);
  window.addEventListener("keydown", handleCtrlKey);
  window.addEventListener("keydown", handleCustomEditShortcuts);
  window.addEventListener("keydown", handleGuideDeleteShortcut, {
    capture: true,
  });
  window.addEventListener("keyup", handleCtrlKey);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("brand-theme-updated", handleBrandThemeUpdated);
  window.addEventListener(
    "designer:toggle-elements-panel",
    handleToggleElementsPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:close-elements-panel",
    handleCloseElementsPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:toggle-template-panel",
    handleToggleTemplatePanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:toggle-properties-panel",
    handleTogglePropertiesPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:toggle-structure-panel",
    handleToggleStructurePanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:close-properties-panel",
    handleClosePropertiesPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:close-structure-panel",
    handleCloseStructurePanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:toggle-ai-panel",
    handleToggleAiPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:close-ai-panel",
    handleCloseAiPanelEvent as EventListener,
  );
  window.addEventListener(
    "designer:open-market",
    handleOpenMarketEvent as EventListener,
  );
  window.addEventListener(
    "designer:panel-bring-to-front",
    handleBringPanelToFrontEvent as EventListener,
  );
  window.addEventListener(
    "designer:set-hand-pan-mode",
    handleSetHandPanModeEvent as EventListener,
  );
  // AI panel: load its chunk lazily on first open, and close on flag/template changes.
  watch(
    showAiPanel,
    (visible) => {
      if (visible) hasLoadedAiPanel.value = true;
    },
    { immediate: true },
  );

  watch(aiEnabled, (enabled) => {
    if (!enabled) closeAiPanel();
  });

  watch(aiHidden, (hidden) => {
    if (hidden) closeAiPanel();
  });

  watch(marketHidden, (hidden) => {
    if (hidden) showMarket.value = false;
  });

  watch(
    () => store.editingCustomElementId,
    (id) => {
      if (id) window.dispatchEvent(new CustomEvent("designer:close-ai-panel"));
    },
  );

  watch(
    () => templateStore.currentTemplateId,
    () => {
      window.dispatchEvent(new CustomEvent("designer:template-replaced"));
    },
  );

  window.addEventListener("mousedown", handleOutsideClickDeselect, true);
  window.addEventListener("mousedown", handleGlobalHandPanMouseDown, true);
  window.addEventListener("click", handleGlobalHandPanClickCapture, true);

  // Watch for layout changes
  watch(
    [
      () => store.pages.length,
      () => store.canvasSize.width,
      () => store.canvasSize.height,
      () => store.zoom,
      () => store.showMinimap,
    ],
    () => {
      nextTick(updateOffset);
    },
  );

  // Apply dark mode class to root container for Shadow DOM compatibility
  watch(
    isDark,
    (val) => {
      if (rootContainer.value) {
        rootContainer.value.classList.toggle("dark", val);
      }
    },
    { immediate: true },
  );

  // Preview lock disables global editing shortcuts while a candidate is rendered.
  watch(
    () => store.previewLocked,
    (locked) => {
      store.setDisableGlobalShortcuts(locked);
    },
  );

  // Auto-save watcher
  watch(
    [
      () => store.pages,
      () => store.canvasSize,
      () => store.guides,
      () => store.headerHeight,
      () => store.footerHeight,
      () => store.showHeaderLine,
      () => store.showFooterLine,
      () => store.enableHeaderFooterLineRendering,
      () => store.headerLineStyle,
      () => store.footerLineStyle,
      () => store.headerLineColor,
      () => store.footerLineColor,
      () => store.headerLineWidth,
      () => store.footerLineWidth,
      () => store.headerLineSpanMode,
      () => store.footerLineSpanMode,
      () => store.headerLineSpan,
      () => store.footerLineSpan,
      () => store.canvasBackground,
      () => store.pageSpacingX,
      () => store.pageSpacingY,
      () => store.watermark,
      () => store.showMinimap,
      () => store.showHistoryPanel,
    ],
    () => {
      if (templateStore.isLoading) return;
      debouncedAutoSave();
    },
    { deep: true },
  );
});

const debouncedAutoSave = debounce(async () => {
  if (templateStore.isLoading) return;
  if (store.editingCustomElementId) return;
  if (store.previewLocked) return;
  if (autoSave.value && templateStore.currentTemplateId) {
    const currentTemplate = templateStore.templates.find(
      (t) => t.id === templateStore.currentTemplateId,
    );
    if (currentTemplate && canEditEntity(currentTemplate)) {
      if (templateStore.isSaving) {
        // If already saving, we must not drop this save.
        // Schedule another check shortly after.
        setTimeout(() => debouncedAutoSave(), 500);
        return;
      }
      await templateStore.saveCurrentTemplate(currentTemplate.name, true);
    }
  }
}, 1000);

const handleSaveCustomEdit = () => {
  const ok = store.commitCustomElementEdit();
  if (!ok) {
    toast.error(t("elementsPanel.editSaveFailed"));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleSaveCustomEditAs = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const ok = store.saveCustomElementEditAs(trimmed);
  if (!ok) {
    toast.error(t("elementsPanel.editSaveFailed"));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleExitCustomEdit = async () => {
  if (!(await uiConfirm.show(t("elementsPanel.confirmExitEdit")))) {
    return;
  }
  store.cancelCustomElementEdit();
  requestAnimationFrame(() => {
    scrollContainer.value?.focus?.();
  });
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
};

const handleCustomEditShortcuts = (e: KeyboardEvent) => {
  if (store.disableGlobalShortcuts) return;
  if (!store.editingCustomElementId) return;
  if (showSaveAsModal.value) return;
  if (isTypingTarget(e.target)) return;

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  const key = e.key.toLowerCase();
  if (key === "s" && e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    showSaveAsModal.value = true;
    return;
  }

  if (key === "s") {
    e.preventDefault();
    e.stopPropagation();
    handleSaveCustomEdit();
    return;
  }

  if (key === "q") {
    e.preventDefault();
    e.stopPropagation();
    handleExitCustomEdit();
  }
};

const handleGuideDeleteShortcut = (e: KeyboardEvent) => {
  if (store.disableGlobalShortcuts) return;
  if (!store.selectedGuideId) return;
  if (isTypingTarget(e.target)) return;
  if (e.key !== "Delete" && e.key !== "Del") return;

  e.preventDefault();
  e.stopPropagation();
  store.removeGuide(store.selectedGuideId);
  store.setHighlightedGuide(null);
};

const scrollX = ref(0);
const scrollY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const contentOffsetX = ref(0);
const contentOffsetY = ref(0);
const RULER_SIZE = 20;
const PROJECTION_LINE_OVERDRAW = 0;
const PROJECTION_STROKE_PX = 1;
const projectionViewportOffsetX = ref(0);
const projectionViewportOffsetY = ref(0);

const updateProjectionViewportOffset = () => {
  if (!projectionViewportRef.value || !canvasWrapper.value) {
    projectionViewportOffsetX.value = contentOffsetX.value - scrollX.value;
    projectionViewportOffsetY.value = offsetY.value - scrollY.value;
    return;
  }

  const viewportRect = projectionViewportRef.value.getBoundingClientRect();
  const wrapperRect = canvasWrapper.value.getBoundingClientRect();

  projectionViewportOffsetX.value = wrapperRect.left - viewportRect.left;
  projectionViewportOffsetY.value = wrapperRect.top - viewportRect.top;
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollX.value = target.scrollLeft;
  scrollY.value = target.scrollTop;
  updateProjectionViewportOffset();
};

const getProjectionHorizontalLineStyle = (y: number, alignEnd = false) => {
  return {
    top: `${projectionViewportOffsetY.value + y * store.zoom - (alignEnd ? PROJECTION_STROKE_PX : 0)}px`,
  };
};

const getProjectionVerticalLineStyle = (x: number, alignEnd = false) => {
  return {
    left: `${projectionViewportOffsetX.value + x * store.zoom - (alignEnd ? PROJECTION_STROKE_PX : 0)}px`,
  };
};

const scrollWidth = ref(0);
const scrollHeight = ref(0);
const viewportWidth = ref(0);
const viewportHeight = ref(0);
const unitLabel = computed(() => store.unit || "mm");
const formatUnitValue = (px: number) => {
  const value = pxToUnit(px, (store.unit || "mm") as Unit);
  return store.unit === "px" ? Math.round(value) : Number(value.toFixed(1));
};

const canvasStyle = computed(() => {
  const pagesCount = store.pages.length;
  const pageHeight = store.canvasSize.height;
  const pageWidth = store.canvasSize.width;
  const gapY = 20;
  // const paddingBottom = 80; // pb-20 - Removed to prevent unnecessary scrollbars

  const unscaledHeight =
    pagesCount > 0 ? pagesCount * pageHeight + (pagesCount - 1) * gapY : 0;

  const unscaledWidth = pageWidth;

  return {
    width: `${unscaledWidth * store.zoom}px`,
    height: `${unscaledHeight * store.zoom}px`,
  };
});

const getHandPanEdgeSpace = (viewportLength: number) => {
  if (!isHandPanActive.value) return 0;
  return Math.max(viewportLength || 0, HAND_PAN_MIN_EDGE_SPACE);
};

const canvasWrapperStyle = computed(() => {
  const style: Record<string, string> = { ...canvasStyle.value };
  if (!isHandPanActive.value) return style;

  const horizontalSpace = getHandPanEdgeSpace(viewportWidth.value);
  const verticalSpace = getHandPanEdgeSpace(viewportHeight.value);

  return {
    ...style,
    marginLeft: `${horizontalSpace}px`,
    marginRight: `${horizontalSpace}px`,
    marginTop: `${verticalSpace}px`,
    marginBottom: `${verticalSpace}px`,
  };
});

const minimapHandPanEdgeX = computed(() =>
  getHandPanEdgeSpace(viewportWidth.value),
);
const minimapHandPanEdgeY = computed(() =>
  getHandPanEdgeSpace(viewportHeight.value),
);
const minimapScrollWidth = computed(() =>
  Math.max(
    viewportWidth.value,
    scrollWidth.value - minimapHandPanEdgeX.value * 2,
  ),
);
const minimapScrollHeight = computed(() =>
  Math.max(
    viewportHeight.value,
    scrollHeight.value - minimapHandPanEdgeY.value * 2,
  ),
);
const minimapScrollX = computed(() => {
  const maxLeft = Math.max(0, minimapScrollWidth.value - viewportWidth.value);
  return Math.max(
    0,
    Math.min(maxLeft, scrollX.value - minimapHandPanEdgeX.value),
  );
});
const minimapScrollY = computed(() => {
  const maxTop = Math.max(0, minimapScrollHeight.value - viewportHeight.value);
  return Math.max(
    0,
    Math.min(maxTop, scrollY.value - minimapHandPanEdgeY.value),
  );
});
const minimapContentOffsetX = computed(() => {
  if (!isHandPanActive.value) return contentOffsetX.value;

  const wrapperWidth = parseFloat(canvasStyle.value.width) || 0;
  return Math.max(0, (minimapScrollWidth.value - wrapperWidth) / 2);
});
const minimapContentOffsetY = computed(
  () => contentOffsetY.value - minimapHandPanEdgeY.value,
);

const updateOffset = () => {
  if (scrollContainer.value && canvasWrapper.value) {
    // Calculate expected scroll dimensions based on canvas size to avoid loop with overlay size
    const containerClientWidth = scrollContainer.value.clientWidth;
    const containerClientHeight = scrollContainer.value.clientHeight;

    viewportWidth.value = containerClientWidth;
    viewportHeight.value = containerClientHeight;

    const wrapperW = parseFloat(canvasStyle.value.width);
    const wrapperH = parseFloat(canvasStyle.value.height);

    // p-8 = 32px padding on each side
    const paddingX = 64;
    const paddingY = 64;
    const handPanEdgeSpaceX = getHandPanEdgeSpace(containerClientWidth);
    const handPanEdgeSpaceY = getHandPanEdgeSpace(containerClientHeight);

    scrollWidth.value = Math.max(
      containerClientWidth,
      wrapperW + paddingX + handPanEdgeSpaceX * 2,
    );
    scrollHeight.value = Math.max(
      containerClientHeight,
      wrapperH + paddingY + handPanEdgeSpaceY * 2,
    );

    // Fix: If the wrapper fits within the container, force scroll dimensions to client dimensions
    // This prevents scrollbars from appearing when they shouldn't due to slight pixel differences
    if (wrapperW + paddingX <= containerClientWidth) {
      scrollWidth.value = containerClientWidth;
    }
    if (wrapperH + paddingY <= containerClientHeight) {
      scrollHeight.value = containerClientHeight;
    }

    scrollX.value = scrollContainer.value.scrollLeft;
    scrollY.value = scrollContainer.value.scrollTop;

    // Ruler offset: keep the 0 mark aligned with the canvas origin.
    offsetX.value = canvasWrapper.value.offsetLeft;
    offsetY.value = canvasWrapper.value.offsetTop;

    // Overlay offset: derived from visual rects to stay aligned with scroll content,
    // including scrollbar-gutter/layout differences.
    const containerRect = scrollContainer.value.getBoundingClientRect();
    const wrapperRect = canvasWrapper.value.getBoundingClientRect();
    const clientLeft = scrollContainer.value.clientLeft || 0;
    const clientTop = scrollContainer.value.clientTop || 0;

    contentOffsetX.value =
      wrapperRect.left -
      containerRect.left +
      scrollContainer.value.scrollLeft -
      clientLeft;
    contentOffsetY.value =
      wrapperRect.top -
      containerRect.top +
      scrollContainer.value.scrollTop -
      clientTop;

    updateProjectionViewportOffset();
  }
};

onUnmounted(() => {
  debouncedAutoSave.cancel();
  stopPanelDrag();
  stopPanelResize();
  stopHandPan();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener("resize", handleLayoutResize);
  window.removeEventListener("mousemove", handleGuideMouseMove);
  window.removeEventListener("mouseup", handleGuideMouseUp);
  window.removeEventListener("keydown", handleCtrlKey);
  window.removeEventListener("keydown", handleCustomEditShortcuts);
  window.removeEventListener("keydown", handleGuideDeleteShortcut, {
    capture: true,
  });
  window.removeEventListener("keyup", handleCtrlKey);
  window.removeEventListener("blur", handleBlur);
  window.removeEventListener("brand-theme-updated", handleBrandThemeUpdated);
  window.removeEventListener(
    "designer:toggle-elements-panel",
    handleToggleElementsPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:close-elements-panel",
    handleCloseElementsPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:toggle-template-panel",
    handleToggleTemplatePanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:toggle-properties-panel",
    handleTogglePropertiesPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:toggle-structure-panel",
    handleToggleStructurePanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:close-properties-panel",
    handleClosePropertiesPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:close-structure-panel",
    handleCloseStructurePanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:toggle-ai-panel",
    handleToggleAiPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:close-ai-panel",
    handleCloseAiPanelEvent as EventListener,
  );
  window.removeEventListener(
    "designer:open-market",
    handleOpenMarketEvent as EventListener,
  );
  window.removeEventListener(
    "designer:panel-bring-to-front",
    handleBringPanelToFrontEvent as EventListener,
  );
  window.removeEventListener(
    "designer:set-hand-pan-mode",
    handleSetHandPanModeEvent as EventListener,
  );
  window.removeEventListener("mousedown", handleOutsideClickDeselect, true);
  window.removeEventListener("mousedown", handleGlobalHandPanMouseDown, true);
  window.removeEventListener("click", handleGlobalHandPanClickCapture, true);
  scrollContainer.value?.removeEventListener("wheel", handleZoomWheel);
});

// Guides Logic
const isDraggingGuide = ref(false);
const draggingGuideId = ref<string | null>(null);
const draggingGuideType = ref<"horizontal" | "vertical">("horizontal");
const draggingGuidePos = ref(0);

const handleGuideDragStart = (
  e: MouseEvent,
  type: "horizontal" | "vertical",
  id: string | null = null,
) => {
  e.preventDefault();
  scrollContainer.value?.focus();
  isDraggingGuide.value = true;
  draggingGuideId.value = id;
  draggingGuideType.value = type;

  updateGuidePosFromEvent(e);

  window.addEventListener("mousemove", handleGuideMouseMove);
  window.addEventListener("mouseup", handleGuideMouseUp);
};

const updateGuidePosFromEvent = (e: MouseEvent) => {
  if (!scrollContainer.value) return;

  const viewportRect = projectionViewportRef.value
    ? projectionViewportRef.value.getBoundingClientRect()
    : scrollContainer.value.getBoundingClientRect();
  const zoom = store.zoom;

  if (draggingGuideType.value === "horizontal") {
    // Keep drag math in the same coordinate space used by projection rendering.
    const viewportY = e.clientY - viewportRect.top;
    draggingGuidePos.value =
      (viewportY - projectionViewportOffsetY.value) / zoom;
  } else {
    const viewportX = e.clientX - viewportRect.left;
    draggingGuidePos.value =
      (viewportX - projectionViewportOffsetX.value) / zoom;
  }
};

const handleGuideMouseMove = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;
  e.preventDefault();
  updateGuidePosFromEvent(e);

  // Real-time update for existing guides
  if (draggingGuideId.value) {
    store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
  }
};

const handleGuideMouseUp = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;

  const rect = scrollContainer.value!.getBoundingClientRect();
  let shouldDelete = false;

  // Delete if dragged back to ruler or out of bounds (top/left)
  if (draggingGuideType.value === "horizontal") {
    if (e.clientY < rect.top) shouldDelete = true;
  } else {
    if (e.clientX < rect.left) shouldDelete = true;
  }

  if (shouldDelete) {
    if (draggingGuideId.value) {
      store.removeGuide(draggingGuideId.value);
    }
  } else {
    if (draggingGuideId.value) {
      store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
    } else {
      store.addGuide({
        type: draggingGuideType.value,
        position: draggingGuidePos.value,
      });
    }
  }

  isDraggingGuide.value = false;
  draggingGuideId.value = null;
  window.removeEventListener("mousemove", handleGuideMouseMove);
  window.removeEventListener("mouseup", handleGuideMouseUp);
};

const handleZoomWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom In
      store.setZoom(Math.min(5, store.zoom + 0.1));
    } else {
      // Zoom Out
      store.setZoom(Math.max(0.2, store.zoom - 0.1));
    }
  }
};

const handleCtrlKey = (e: KeyboardEvent) => {
  if (store.disableGlobalShortcuts) return;
  if (e.key === "Control" || e.key === "Meta") {
    if (e.type === "keydown" && !e.repeat) {
      scrollContainer.value?.addEventListener("wheel", handleZoomWheel, {
        passive: false,
      });
    } else if (e.type === "keyup") {
      scrollContainer.value?.removeEventListener("wheel", handleZoomWheel);
    }
  }
};

const handleBlur = () => {
  scrollContainer.value?.removeEventListener("wheel", handleZoomWheel);
  stopHandPan();
};

const handleMinimapScroll = (pos: { left: number; top: number }) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({
      left: isHandPanActive.value
        ? scrollContainer.value.scrollLeft
        : pos.left + minimapHandPanEdgeX.value,
      top: pos.top + minimapHandPanEdgeY.value,
      behavior: "auto",
    });
  }
};

const getRotatedBounds = (el: any) => {
  const rotation = el.style?.rotate || 0;
  if (rotation === 0) {
    return {
      minX: el.x,
      maxX: el.x + el.width,
      minY: el.y,
      maxY: el.y + el.height,
    };
  }

  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x, y: el.y + el.height },
    { x: el.x + el.width, y: el.y + el.height },
  ];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const p of corners) {
    const nx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
    const ny = cy + (p.x - cx) * sin + (p.y - cy) * cos;

    if (nx < minX) minX = nx;
    if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny;
    if (ny > maxY) maxY = ny;
  }

  return { minX, maxX, minY, maxY };
};

const dragProjection = computed(() => {
  if (!store.isDragging || store.selectedElementIds.length === 0) return null;

  const elements: { el: any; pageIndex: number }[] = [];
  for (const id of store.selectedElementIds) {
    for (let i = 0; i < store.pages.length; i++) {
      const page = store.pages[i];
      const el = page.elements.find((e) => e.id === id);
      if (el) elements.push({ el, pageIndex: i });
    }
  }

  if (elements.length === 0) return null;

  let globalMinX = Infinity;
  let globalMaxX = -Infinity;
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  const gapY = 20; // Match Canvas.vue rowGap

  for (const { el, pageIndex } of elements) {
    const bounds = getRotatedBounds(el);
    const pageOffset = pageIndex * (store.canvasSize.height + gapY);

    // Apply page offset to Y coordinates
    bounds.minY += pageOffset;
    bounds.maxY += pageOffset;

    if (bounds.minX < globalMinX) globalMinX = bounds.minX;
    if (bounds.maxX > globalMaxX) globalMaxX = bounds.maxX;
    if (bounds.minY < globalMinY) globalMinY = bounds.minY;
    if (bounds.maxY > globalMaxY) globalMaxY = bounds.maxY;
  }

  const centerX = (globalMinX + globalMaxX) / 2;
  const centerY = (globalMinY + globalMaxY) / 2;

  return {
    minX: globalMinX,
    maxX: globalMaxX,
    minY: globalMinY,
    maxY: globalMaxY,
    centerX,
    centerY,
  };
});

const rulerIndicators = computed(() => {
  if (!dragProjection.value) return { h: [], v: [] };
  brandTick.value;
  const indicatorColor = getThemeRgba("--brand-500", 0.5);

  const { minX, maxX, minY, maxY } = dragProjection.value;

  return {
    h: [
      { position: minX, color: indicatorColor },
      { position: maxX, color: indicatorColor },
    ],
    v: [
      { position: minY, color: indicatorColor },
      { position: maxY, color: indicatorColor },
    ],
  };
});

const rulerRanges = computed(() => {
  brandTick.value;
  const rangeColor = getThemeRgba("--brand-300", 0.6);

  if (dragProjection.value) {
    const { minX, maxX, minY, maxY } = dragProjection.value;
    return {
      h: { start: minX, end: maxX, color: rangeColor },
      v: { start: minY, end: maxY, color: rangeColor },
    };
  }

  if (store.selectedElementIds.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const page of store.pages) {
      for (const el of page.elements) {
        if (store.selectedElementIds.includes(el.id)) {
          const bounds = store.getElementBoundsAtPosition(el, el.x, el.y);
          minX = Math.min(minX, bounds.minX);
          maxX = Math.max(maxX, bounds.maxX);
          minY = Math.min(minY, bounds.minY);
          maxY = Math.max(maxY, bounds.maxY);
        }
      }
    }

    if (minX !== Infinity) {
      return {
        h: { start: minX, end: maxX, color: rangeColor },
        v: { start: minY, end: maxY, color: rangeColor },
      };
    }
  }

  return { h: null, v: null };
});
</script>

<template>
  <!-- Headless Wrapper (hidden) -->
  <div
    v-if="props.headless"
    class="print-designer-headless"
    style="display: none"
  >
    <div ref="rootContainer" data-designer-root></div>
  </div>

  <!-- Main Designer UI -->
  <div
    v-else
    ref="rootContainer"
    data-designer-root="true"
    class="h-full w-full flex flex-col bg-gray-100 overflow-hidden"
  >
    <Header />
    <div
      ref="panelsHostRef"
      data-floating-panels-host="true"
      class="flex-1 flex overflow-hidden relative"
    >
      <main class="flex-1 overflow-hidden relative flex flex-col">
        <CustomEditBanner
          :visible="!!store.editingCustomElementId"
          :title="
            t('elementsPanel.editingElement', {
              name: editingCustomElement?.name || '',
            })
          "
          :save-text="t('elementsPanel.saveEdit')"
          :save-as-text="t('elementsPanel.saveAs')"
          :exit-text="t('elementsPanel.exitEdit')"
          @save="handleSaveCustomEdit"
          @save-as="showSaveAsModal = true"
          @exit="handleExitCustomEdit"
        />
        <Shortcuts />
        <!-- Rulers Area -->
        <div class="relative w-full h-full flex flex-col overflow-hidden">
          <!-- Top Ruler -->
          <div
            class="flex-none h-[21px] bg-gray-50 border-b border-gray-300 flex z-20"
          >
            <div
              class="w-[21px] flex-none bg-gray-100 border-r border-gray-300"
            ></div>
            <!-- Corner -->
            <div class="flex-1 relative overflow-hidden">
              <Ruler
                type="horizontal"
                :zoom="store.zoom"
                :scroll="scrollX"
                :offset="offsetX"
                :thick="20"
                :unit="(store.unit || 'mm') as Unit"
                :indicators="rulerIndicators.h"
                :range="rulerRanges.h"
                @guide-drag-start="(e) => handleGuideDragStart(e, 'horizontal')"
              />
            </div>
          </div>

          <div class="flex-1 flex overflow-hidden relative">
            <!-- Left Ruler -->
            <div
              class="w-[21px] flex-none bg-gray-50 border-r border-gray-300 h-full relative z-20 overflow-hidden"
            >
              <Ruler
                type="vertical"
                :zoom="store.zoom"
                :scroll="scrollY"
                :offset="offsetY"
                :thick="20"
                :unit="(store.unit || 'mm') as Unit"
                :indicators="rulerIndicators.v"
                :range="rulerRanges.v"
                @guide-drag-start="(e) => handleGuideDragStart(e, 'vertical')"
              />
            </div>

            <!-- Canvas Area -->
            <div
              ref="projectionViewportRef"
              class="flex-1 relative overflow-hidden"
            >
              <div
                ref="scrollContainer"
                tabindex="-1"
                :class="[
                  'h-full overflow-auto p-8 flex relative canvas-scroll bg-gray-100 focus:outline-none',
                  isHandPanActive
                    ? isHandPanning
                      ? 'cursor-grabbing select-none'
                      : 'cursor-grab'
                    : '',
                ]"
                style="scrollbar-gutter: stable both-edges"
                @scroll="handleScroll"
                @click="
                  (e) => {
                    if (
                      e.target === scrollContainer ||
                      e.target === e.currentTarget
                    ) {
                      store.selectGuide(null);
                      // Clicking the canvas background (not on any element)
                      // should deselect all elements.
                      store.clearSelection();
                    }
                  }
                "
              >
                <div
                  ref="canvasWrapper"
                  :style="canvasWrapperStyle"
                  :class="[
                    'relative',
                    isHandPanActive ? '' : 'mx-auto',
                    store.previewLocked
                      ? 'pointer-events-none cursor-not-allowed'
                      : '',
                  ]"
                >
                  <Canvas ref="canvasContainer" class="absolute top-0 left-0" />
                </div>
              </div>

              <!-- Preview lock overlay: keeps canvas editing disabled while an external candidate is rendered,
                   but lets wheel/scroll pass through so the preview stays scrollable -->
              <div
                v-if="store.previewLocked"
                data-preview-lock-overlay="true"
                class="pointer-events-none absolute inset-0 z-40 bg-transparent"
              ></div>

              <!-- Guides Overlay (Viewport Layer) -->
              <div
                class="absolute inset-0 pointer-events-none z-30 overflow-hidden"
              >
                <!-- Existing Guides -->
                <template v-for="guide in store.guides" :key="guide.id">
                  <div
                    v-if="guide.type === 'horizontal'"
                    data-hand-pan-ignore="true"
                    class="absolute left-0 right-0 h-3 -mt-1.5 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                    :style="{
                      top: `${projectionViewportOffsetY + guide.position * store.zoom}px`,
                    }"
                    @mousedown.stop="
                      (e) => {
                        store.selectGuide(guide.id);
                        handleGuideDragStart(e, 'horizontal', guide.id);
                      }
                    "
                  >
                    <div
                      :class="[
                        'w-full',
                        store.highlightedGuideId === guide.id
                          ? 'border-t-2 theme-border-strong'
                          : 'border-t theme-border',
                        'theme-border-hover',
                      ]"
                    ></div>
                    <div
                      class="absolute left-2 -top-4 theme-bg text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap"
                    >
                      {{ formatUnitValue(guide.position) }}{{ unitLabel }}
                    </div>
                  </div>
                  <div
                    v-else
                    data-hand-pan-ignore="true"
                    class="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize pointer-events-auto group flex flex-row justify-center"
                    :style="{
                      left: `${projectionViewportOffsetX + guide.position * store.zoom}px`,
                    }"
                    @mousedown.stop="
                      (e) => {
                        store.selectGuide(guide.id);
                        handleGuideDragStart(e, 'vertical', guide.id);
                      }
                    "
                  >
                    <div
                      :class="[
                        'h-full',
                        store.highlightedGuideId === guide.id
                          ? 'border-l-2 theme-border-strong'
                          : 'border-l theme-border',
                        'theme-border-hover',
                      ]"
                    ></div>
                    <div
                      class="absolute top-2 -left-4 theme-bg text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap"
                    >
                      {{ formatUnitValue(guide.position) }}{{ unitLabel }}
                    </div>
                  </div>
                </template>

                <!-- Dragging Preview -->
                <div
                  v-if="isDraggingGuide && !draggingGuideId"
                  :class="[
                    'absolute border-dashed pointer-events-none theme-border',
                    draggingGuideType === 'horizontal'
                      ? 'left-0 right-0 border-t'
                      : 'top-0 bottom-0 border-l',
                  ]"
                  :style="{
                    top:
                      draggingGuideType === 'horizontal'
                        ? `${projectionViewportOffsetY + draggingGuidePos * store.zoom}px`
                        : undefined,
                    left:
                      draggingGuideType === 'vertical'
                        ? `${projectionViewportOffsetX + draggingGuidePos * store.zoom}px`
                        : undefined,
                  }"
                >
                  <div
                    :class="[
                      'absolute theme-bg text-white text-[10px] px-1 rounded',
                      draggingGuideType === 'horizontal'
                        ? 'left-2 -top-4'
                        : 'top-2 -left-4',
                    ]"
                  >
                    {{ formatUnitValue(draggingGuidePos) }}{{ unitLabel }}
                  </div>
                </div>

                <!-- Edge Highlight -->
                <div
                  v-if="store.highlightedEdge"
                  class="absolute inset-0 pointer-events-none"
                >
                  <div
                    v-if="store.highlightedEdge === 'top'"
                    class="absolute left-0 right-0 border-t theme-border"
                    :style="
                      getProjectionHorizontalLineStyle(store.pageSpacingY || 0)
                    "
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'bottom'"
                    class="absolute left-0 right-0 border-t theme-border"
                    :style="
                      getProjectionHorizontalLineStyle(
                        store.canvasSize.height - (store.pageSpacingY || 0),
                        true,
                      )
                    "
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'left'"
                    class="absolute top-0 bottom-0 border-l theme-border"
                    :style="
                      getProjectionVerticalLineStyle(store.pageSpacingX || 0)
                    "
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'right'"
                    class="absolute top-0 bottom-0 border-l theme-border"
                    :style="
                      getProjectionVerticalLineStyle(
                        store.canvasSize.width - (store.pageSpacingX || 0),
                        true,
                      )
                    "
                  ></div>
                </div>
              </div>

              <!-- Dragging Distance Guides (Viewport Layer) -->
              <template v-if="dragProjection">
                <div
                  class="absolute inset-0 pointer-events-none z-30 overflow-hidden"
                >
                  <!-- Top Line -->
                  <div
                    class="absolute left-0 right-0 border-t border-blue-500 border-dashed"
                    :style="
                      getProjectionHorizontalLineStyle(dragProjection.minY)
                    "
                  >
                    <div
                      class="absolute -top-6 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                      :style="{ left: `${PROJECTION_LINE_OVERDRAW + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.minY) }} {{ unitLabel }}
                    </div>
                  </div>

                  <!-- Bottom Line -->
                  <div
                    class="absolute left-0 right-0 border-t border-dashed theme-border"
                    :style="
                      getProjectionHorizontalLineStyle(
                        dragProjection.maxY,
                        true,
                      )
                    "
                  >
                    <div
                      class="absolute -top-6 theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                      :style="{ left: `${PROJECTION_LINE_OVERDRAW + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.maxY) }} {{ unitLabel }}
                    </div>
                  </div>

                  <!-- Left Line -->
                  <div
                    class="absolute top-0 bottom-0 border-l border-dashed theme-border"
                    :style="getProjectionVerticalLineStyle(dragProjection.minX)"
                  >
                    <div
                      class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                      :style="{ top: '10px' }"
                    >
                      {{ formatUnitValue(dragProjection.minX) }} {{ unitLabel }}
                    </div>
                  </div>

                  <!-- Right Line -->
                  <div
                    class="absolute top-0 bottom-0 border-l border-dashed theme-border"
                    :style="
                      getProjectionVerticalLineStyle(dragProjection.maxX, true)
                    "
                  >
                    <div
                      class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                      :style="{ top: '10px' }"
                    >
                      {{ formatUnitValue(dragProjection.maxX) }} {{ unitLabel }}
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- <footer class="h-6 bg-white border-t border-gray-200 text-xs flex items-center px-4 text-gray-500 z-30">
           Ready
        </footer> -->

        <StatusBar v-if="store.showStatusBar" />

        <FloatingMinimapPanel
          :show="store.showMinimap"
          :panel-style="minimapPanelStyle"
          :z-index="getPanelZIndex('minimap')"
          :title="t('editor.showMinimap')"
          :resize-title="t('common.resizePanel')"
          :scroll-width="minimapScrollWidth"
          :scroll-height="minimapScrollHeight"
          :viewport-width="viewportWidth"
          :viewport-height="viewportHeight"
          :scroll-left="minimapScrollX"
          :scroll-top="minimapScrollY"
          :pages="store.pages"
          :page-width="store.canvasSize.width"
          :page-height="store.canvasSize.height"
          :zoom="store.zoom"
          :content-offset-x="minimapContentOffsetX"
          :content-offset-y="minimapContentOffsetY"
          :canvas-background="store.canvasBackground"
          :show-header-line="store.showHeaderLine"
          :show-footer-line="store.showFooterLine"
          :header-height="store.headerHeight"
          :footer-height="store.footerHeight"
          :page-spacing-y="store.pageSpacingY || 0"
          :watermark="store.watermark || null"
          :preview-width="minimapPreviewWidth"
          :preview-max-height="minimapPreviewMaxHeight"
          @panel-mousedown="(e) => handleFloatingPanelMouseDown('minimap', e)"
          @close="store.setShowMinimap(false)"
          @resize-mousedown="(e) => startPanelResize('minimap', e)"
          @update-scroll="handleMinimapScroll"
        />
      </main>

      <FloatingBasicPanel
        :visible="showElementsPanel"
        :panel-style="sidebarPanelStyle"
        :z-index="getPanelZIndex('sidebar')"
        :resize-title="t('common.resizePanel')"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('sidebar', e)"
        @resize-mousedown="(e) => startPanelResize('sidebar', e)"
      >
        <ElementsPanel />
      </FloatingBasicPanel>

      <FloatingTemplatePanel
        :show="showTemplatePanel"
        :panel-style="templatePanelStyle"
        :z-index="getPanelZIndex('templates')"
        :title="t('editor.templates')"
        :subtitle="t('template.select')"
        :help-content="templatePanelHelp"
        :show-help="showTemplateHelpTooltip"
        :help-placement="templateHelpPlacement"
        :help-tooltip-style="templateHelpTooltipStyle"
        :help-arrow-style="templateHelpArrowStyle"
        :help-label="t('template.help.title')"
        :modal-target="modalContainer"
        :resize-title="t('common.resizePanel')"
        :set-help-button-ref="setTemplateHelpButtonRef"
        :set-help-tooltip-ref="setTemplateHelpTooltipRef"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('templates', e)"
        @toggle-help="toggleTemplateHelpTooltip"
        @close="closeTemplatePanel"
        @resize-mousedown="(e) => startPanelResize('templates', e)"
      />

      <FloatingBasicPanel
        :visible="showPropertiesPanel"
        :panel-style="propertiesPanelStyle"
        :z-index="getPanelZIndex('properties')"
        :resize-title="t('common.resizePanel')"
        panel-key="properties"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('properties', e)"
        @resize-mousedown="(e) => startPanelResize('properties', e)"
      >
        <PropertiesPanel />
      </FloatingBasicPanel>

      <FloatingStructurePanel
        :show="showStructurePanel"
        :panel-style="structurePanelStyle"
        :z-index="getPanelZIndex('structure')"
        :title="t('elementsPanel.layout')"
        :subtitle="t('elementsPanel.layoutSubtitle')"
        :help-content="structurePanelHelp"
        :show-help="showStructureHelpTooltip"
        :help-placement="structureHelpPlacement"
        :help-tooltip-style="structureHelpTooltipStyle"
        :help-arrow-style="structureHelpArrowStyle"
        :help-label="t('elementsPanel.layoutHelp.title')"
        :modal-target="modalContainer"
        :resize-title="t('common.resizePanel')"
        :set-help-button-ref="setStructureHelpButtonRef"
        :set-help-tooltip-ref="setStructureHelpTooltipRef"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('structure', e)"
        @toggle-help="toggleStructureHelpTooltip"
        @close="closeStructurePanel"
        @resize-mousedown="(e) => startPanelResize('structure', e)"
      />
      <FloatingAiPanel
        v-if="!headless && aiEnabled && !aiHidden && hasLoadedAiPanel"
        :show="showAiPanel"
        :panel-style="aiPanelStyle"
        :z-index="getPanelZIndex('ai')"
        :resize-title="t('common.resizePanel')"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('ai', e)"
        @resize-mousedown="(e) => startPanelResize('ai', e)"
        @close="closeAiPanel"
      />
      <MarketModal
        v-if="!headless && hasLoadedMarket && showMarket"
        @close="showMarket = false"
      />
      <FloatingBasicPanel
        :visible="store.showHistoryPanel"
        :panel-style="historyPanelStyle"
        :z-index="getPanelZIndex('history')"
        :resize-title="t('common.resizePanel')"
        panel-key="history"
        @panel-mousedown="(e) => handleFloatingPanelMouseDown('history', e)"
        @resize-mousedown="(e) => startPanelResize('history', e)"
      >
        <HistoryPanel />
      </FloatingBasicPanel>
    </div>

    <InputModal
      :show="showSaveAsModal"
      :initial-value="saveAsInitialName"
      :title="t('elementsPanel.saveAsCustomElement')"
      :placeholder="t('elementsPanel.enterNamePlaceholder')"
      @close="showSaveAsModal = false"
      @save="handleSaveCustomEditAs"
    />

    <GlobalLoadingOverlay :visible="templateStore.isLoading" />

    <!-- Modal Container for Teleport -->
    <div
      ref="modalContainer"
      class="print-designer-modals fixed inset-0 pointer-events-none z-[9999]"
    ></div>
  </div>
</template>
