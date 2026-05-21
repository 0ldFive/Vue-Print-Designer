<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { uiConfirm } from "@/utils/confirm";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { useAutoSave } from "@/composables/useAutoSave";
import { useTheme } from "@/composables/useTheme";
import debounce from "lodash/debounce";
import { canEditEntity } from "@/utils/entityConstraints";
import { pxToUnit, type Unit } from "@/utils/units";
import { parseColor, toRgbaString } from "@/utils/color";
import Header from "./layout/Header.vue";
import Sidebar from "./layout/Sidebar.vue";
import PropertiesPanel from "./layout/PropertiesPanel.vue";
import Canvas from "./canvas/Canvas.vue";
import Ruler from "./layout/Ruler.vue";
import Shortcuts from "./layout/Shortcuts.vue";
import Minimap from "./layout/Minimap.vue";
import HistoryPanel from "./layout/HistoryPanel.vue";
import VariablesPanel from "./layout/VariablesPanel.vue";
import InputModal from "@/components/common/InputModal.vue";
import { toast } from "@/utils/toast";
import Save from "~icons/material-symbols/save";
import SaveAs from "~icons/material-symbols/save-as";
import Logout from "~icons/material-symbols/logout";
import Close from "~icons/material-symbols/close";

const store = useDesignerStore();
const templateStore = useTemplateStore();
const { autoSave } = useAutoSave();
const { isDark } = useTheme();
const { t } = useI18n();

const props = defineProps<{ headless?: boolean }>();

const scrollContainer = ref<HTMLElement | null>(null);
const panelsHostRef = ref<HTMLElement | null>(null);
const rootContainer = ref<HTMLElement | null>(null);
const modalContainer = ref<HTMLElement | null>(null);
const designerInstanceId = `designer-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
let resizeObserver: ResizeObserver | null = null;
const canvasContainer = ref<HTMLElement | null>(null);

// Provide root and modal container for children
import { provide } from "vue";
provide("designer-root", rootContainer);
provide("modal-container", modalContainer);
provide("designer-instance-id", designerInstanceId);
const canvasWrapper = ref<HTMLElement | null>(null);
const showSaveAsModal = ref(false);
const brandTick = ref(0);

type FloatingPanelKey = "sidebar" | "properties" | "minimap";
const FLOAT_PANEL_MIN_WIDTH = 256;
const FLOAT_PANEL_MAX_WIDTH = 520;
const FLOAT_PANEL_MARGIN = 12;
const FLOAT_PANEL_MIN_HEIGHT = 280;
const MINIMAP_PANEL_FALLBACK_WIDTH = 212;
const MINIMAP_PANEL_FALLBACK_HEIGHT = 252;

type FloatingPanelBounds = {
  minX: number;
  minY: number;
  maxRight: number;
  maxBottom: number;
  maxHeight: number;
};

const panelsHostSize = ref({ width: 0, height: 0 });
const sidebarPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const propertiesPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const sidebarPanelWidth = ref(FLOAT_PANEL_MIN_WIDTH);
const propertiesPanelWidth = ref(FLOAT_PANEL_MIN_WIDTH);
const sidebarPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const propertiesPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const minimapPanelRef = ref<HTMLElement | null>(null);
const minimapPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const hasInitializedFloatingPanels = ref(false);
const hasInitializedMinimapPanel = ref(false);

let draggingPanel: FloatingPanelKey | null = null;
let dragStartPointer = { x: 0, y: 0 };
let dragStartPanelPos = { x: 0, y: 0 };
let resizingPanel: FloatingPanelKey | null = null;
let resizeStartPointer = { x: 0, y: 0 };
let resizeStartWidth = FLOAT_PANEL_MIN_WIDTH;
let resizeStartHeight = FLOAT_PANEL_MIN_HEIGHT;

const handleBrandThemeUpdated = () => {
  brandTick.value += 1;
};

const updatePanelsHostSize = () => {
  if (!panelsHostRef.value) return;
  panelsHostSize.value = {
    width: panelsHostRef.value.clientWidth,
    height: panelsHostRef.value.clientHeight,
  };
};

const getFloatingPanelBounds = (): FloatingPanelBounds => {
  const { width, height } = panelsHostSize.value;
  const fallbackMinX = FLOAT_PANEL_MARGIN;
  const fallbackMinY = FLOAT_PANEL_MARGIN;
  const fallbackMaxRight = Math.max(fallbackMinX, width - FLOAT_PANEL_MARGIN);
  const fallbackMaxBottom = Math.max(
    fallbackMinY,
    height - FLOAT_PANEL_MARGIN,
  );
  const fallbackMaxHeight = Math.max(
    FLOAT_PANEL_MIN_HEIGHT,
    fallbackMaxBottom - fallbackMinY,
  );

  if (!panelsHostRef.value || !scrollContainer.value) {
    return {
      minX: fallbackMinX,
      minY: fallbackMinY,
      maxRight: fallbackMaxRight,
      maxBottom: fallbackMaxBottom,
      maxHeight: fallbackMaxHeight,
    };
  }

  const hostRect = panelsHostRef.value.getBoundingClientRect();
  const canvasRect = scrollContainer.value.getBoundingClientRect();

  const minX = Math.max(FLOAT_PANEL_MARGIN, canvasRect.left - hostRect.left);
  const minY = Math.max(FLOAT_PANEL_MARGIN, canvasRect.top - hostRect.top);
  const maxRight = canvasRect.right - hostRect.left;
  const maxBottom = canvasRect.bottom - hostRect.top;
  const maxHeight = Math.max(FLOAT_PANEL_MIN_HEIGHT, maxBottom - minY);

  return {
    minX,
    minY,
    maxRight,
    maxBottom,
    maxHeight,
  };
};

const clampPanelPos = (
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
) => {
  const { minX, minY, maxRight, maxBottom } =
    getFloatingPanelBounds();
  const maxX = Math.max(minX, maxRight - panelWidth);
  const maxY = Math.max(minY, maxBottom - panelHeight);

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
};

const clampPanelWidth = (panelWidth: number, panelX: number) => {
  const { minX, maxRight } = getFloatingPanelBounds();
  const maxWidthByBounds = Math.max(
    FLOAT_PANEL_MIN_WIDTH,
    maxRight - Math.max(panelX, minX),
  );
  const maxWidth = Math.min(FLOAT_PANEL_MAX_WIDTH, maxWidthByBounds);
  return Math.min(Math.max(panelWidth, FLOAT_PANEL_MIN_WIDTH), maxWidth);
};

const clampPanelHeight = (panelHeight: number, panelY: number) => {
  const { minY, maxBottom, maxHeight } = getFloatingPanelBounds();
  const localMaxHeight = Math.max(
    FLOAT_PANEL_MIN_HEIGHT,
    maxBottom - Math.max(panelY, minY),
  );
  const maxAllowedHeight = Math.min(maxHeight, localMaxHeight);
  return Math.min(Math.max(panelHeight, FLOAT_PANEL_MIN_HEIGHT), maxAllowedHeight);
};

const getMinimapPanelSize = () => {
  if (!minimapPanelRef.value) {
    return {
      width: MINIMAP_PANEL_FALLBACK_WIDTH,
      height: MINIMAP_PANEL_FALLBACK_HEIGHT,
    };
  }

  const rect = minimapPanelRef.value.getBoundingClientRect();
  return {
    width: rect.width > 0 ? rect.width : MINIMAP_PANEL_FALLBACK_WIDTH,
    height: rect.height > 0 ? rect.height : MINIMAP_PANEL_FALLBACK_HEIGHT,
  };
};

const placeMinimapNearPropertiesPanel = () => {
  const minimapSize = getMinimapPanelSize();
  const targetX =
    propertiesPanelPos.value.x - minimapSize.width - FLOAT_PANEL_MARGIN;
  const targetY = propertiesPanelPos.value.y;

  minimapPanelPos.value = clampPanelPos(
    targetX,
    targetY,
    minimapSize.width,
    minimapSize.height,
  );
  hasInitializedMinimapPanel.value = true;
};

const initOrClampFloatingPanels = () => {
  updatePanelsHostSize();
  const { width, height } = panelsHostSize.value;
  if (!width || !height) return;

  const bounds = getFloatingPanelBounds();

  if (!hasInitializedFloatingPanels.value) {
    sidebarPanelHeight.value = bounds.maxHeight;
    propertiesPanelHeight.value = bounds.maxHeight;
    sidebarPanelPos.value = { x: bounds.minX, y: bounds.minY };
    propertiesPanelPos.value = {
      x: Math.max(bounds.minX, bounds.maxRight - propertiesPanelWidth.value),
      y: bounds.minY,
    };
    hasInitializedFloatingPanels.value = true;
  }

  sidebarPanelWidth.value = clampPanelWidth(
    sidebarPanelWidth.value,
    sidebarPanelPos.value.x,
  );
  propertiesPanelWidth.value = clampPanelWidth(
    propertiesPanelWidth.value,
    propertiesPanelPos.value.x,
  );
  sidebarPanelHeight.value = clampPanelHeight(
    sidebarPanelHeight.value,
    sidebarPanelPos.value.y,
  );
  propertiesPanelHeight.value = clampPanelHeight(
    propertiesPanelHeight.value,
    propertiesPanelPos.value.y,
  );

  sidebarPanelPos.value = clampPanelPos(
    sidebarPanelPos.value.x,
    sidebarPanelPos.value.y,
    sidebarPanelWidth.value,
    sidebarPanelHeight.value,
  );
  propertiesPanelPos.value = clampPanelPos(
    propertiesPanelPos.value.x,
    propertiesPanelPos.value.y,
    propertiesPanelWidth.value,
    propertiesPanelHeight.value,
  );

  if (!store.showMinimap) return;

  if (!hasInitializedMinimapPanel.value) {
    placeMinimapNearPropertiesPanel();
    return;
  }

  const minimapSize = getMinimapPanelSize();
  minimapPanelPos.value = clampPanelPos(
    minimapPanelPos.value.x,
    minimapPanelPos.value.y,
    minimapSize.width,
    minimapSize.height,
  );
};

const sidebarPanelStyle = computed(() => {
  return {
    left: `${sidebarPanelPos.value.x}px`,
    top: `${sidebarPanelPos.value.y}px`,
    width: `${sidebarPanelWidth.value}px`,
    height: `${sidebarPanelHeight.value}px`,
  };
});

const propertiesPanelStyle = computed(() => {
  return {
    left: `${propertiesPanelPos.value.x}px`,
    top: `${propertiesPanelPos.value.y}px`,
    width: `${propertiesPanelWidth.value}px`,
    height: `${propertiesPanelHeight.value}px`,
  };
});

const minimapPanelStyle = computed(() => {
  return {
    left: `${minimapPanelPos.value.x}px`,
    top: `${minimapPanelPos.value.y}px`,
  };
});

const getPanelZIndex = (panel: FloatingPanelKey) => {
  if (draggingPanel === panel || resizingPanel === panel) {
    return 5100;
  }
  return panel === "minimap" ? 50 : 40;
};

const handlePanelDragMove = (e: MouseEvent) => {
  if (!draggingPanel) return;

  e.preventDefault();
  const deltaX = e.clientX - dragStartPointer.x;
  const deltaY = e.clientY - dragStartPointer.y;
  const panelWidth =
    draggingPanel === "sidebar"
      ? sidebarPanelWidth.value
      : draggingPanel === "properties"
        ? propertiesPanelWidth.value
        : getMinimapPanelSize().width;
  const panelHeight =
    draggingPanel === "sidebar"
      ? sidebarPanelHeight.value
      : draggingPanel === "properties"
        ? propertiesPanelHeight.value
        : getMinimapPanelSize().height;
  const nextPos = clampPanelPos(
    dragStartPanelPos.x + deltaX,
    dragStartPanelPos.y + deltaY,
    panelWidth,
    panelHeight,
  );

  if (draggingPanel === "sidebar") {
    sidebarPanelPos.value = nextPos;
    return;
  }

  if (draggingPanel === "properties") {
    propertiesPanelPos.value = nextPos;
    return;
  }

  minimapPanelPos.value = nextPos;
};

const stopPanelDrag = () => {
  draggingPanel = null;
  window.removeEventListener("mousemove", handlePanelDragMove);
  window.removeEventListener("mouseup", stopPanelDrag);
};

const handlePanelResizeMove = (e: MouseEvent) => {
  if (!resizingPanel) return;

  e.preventDefault();
  const deltaX = e.clientX - resizeStartPointer.x;
  const deltaY = e.clientY - resizeStartPointer.y;

  if (resizingPanel === "sidebar") {
    const nextWidth = clampPanelWidth(
      resizeStartWidth + deltaX,
      sidebarPanelPos.value.x,
    );
    const nextHeight = clampPanelHeight(
      resizeStartHeight + deltaY,
      sidebarPanelPos.value.y,
    );
    sidebarPanelWidth.value = nextWidth;
    sidebarPanelHeight.value = nextHeight;
    sidebarPanelPos.value = clampPanelPos(
      sidebarPanelPos.value.x,
      sidebarPanelPos.value.y,
      nextWidth,
      nextHeight,
    );
    return;
  }

  const nextWidth = clampPanelWidth(
    resizeStartWidth + deltaX,
    propertiesPanelPos.value.x,
  );
  const nextHeight = clampPanelHeight(
    resizeStartHeight + deltaY,
    propertiesPanelPos.value.y,
  );
  propertiesPanelWidth.value = nextWidth;
  propertiesPanelHeight.value = nextHeight;
  propertiesPanelPos.value = clampPanelPos(
    propertiesPanelPos.value.x,
    propertiesPanelPos.value.y,
    nextWidth,
    nextHeight,
  );
};

const stopPanelResize = () => {
  resizingPanel = null;
  window.removeEventListener("mousemove", handlePanelResizeMove);
  window.removeEventListener("mouseup", stopPanelResize);
};

const startPanelResize = (panel: FloatingPanelKey, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  stopPanelDrag();
  resizingPanel = panel;
  resizeStartPointer = { x: e.clientX, y: e.clientY };
  resizeStartWidth =
    panel === "sidebar" ? sidebarPanelWidth.value : propertiesPanelWidth.value;
  resizeStartHeight =
    panel === "sidebar"
      ? sidebarPanelHeight.value
      : propertiesPanelHeight.value;

  window.addEventListener("mousemove", handlePanelResizeMove);
  window.addEventListener("mouseup", stopPanelResize);
};

const startPanelDrag = (panel: FloatingPanelKey, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  draggingPanel = panel;
  dragStartPointer = { x: e.clientX, y: e.clientY };
  dragStartPanelPos =
    panel === "sidebar"
      ? { ...sidebarPanelPos.value }
      : panel === "properties"
        ? { ...propertiesPanelPos.value }
        : { ...minimapPanelPos.value };

  window.addEventListener("mousemove", handlePanelDragMove);
  window.addEventListener("mouseup", stopPanelDrag);
};

const handleFloatingPanelMouseDown = (panel: FloatingPanelKey, e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (target?.closest(".panel-close-btn")) {
    return;
  }
  if (!target?.closest('[data-floating-panel-drag-handle="true"]')) {
    return;
  }
  startPanelDrag(panel, e);
};

watch(
  () => store.showMinimap,
  (show) => {
    if (!show) {
      hasInitializedMinimapPanel.value = false;
      return;
    }

    hasInitializedMinimapPanel.value = false;
    nextTick(() => {
      initOrClampFloatingPanels();
    });
  },
);

const handleLayoutResize = () => {
  updateOffset();
  initOrClampFloatingPanels();
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

  nextTick(() => {
    updateOffset();
    initOrClampFloatingPanels();
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
  window.addEventListener("keyup", handleCtrlKey);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("brand-theme-updated", handleBrandThemeUpdated);

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
    toast.error(t("sidebar.editSaveFailed"));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleSaveCustomEditAs = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const ok = store.saveCustomElementEditAs(trimmed);
  if (!ok) {
    toast.error(t("sidebar.editSaveFailed"));
    return;
  }
  store.cancelCustomElementEdit();
};

const handleExitCustomEdit = async () => {
  if (!(await uiConfirm.show(t("sidebar.confirmExitEdit")))) {
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

const scrollX = ref(0);
const scrollY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const contentOffsetX = ref(0);
const contentOffsetY = ref(0);
const RULER_SIZE = 20;
const PROJECTION_LINE_OVERDRAW = 32;

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollX.value = target.scrollLeft;
  scrollY.value = target.scrollTop;
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

    scrollWidth.value = Math.max(containerClientWidth, wrapperW + paddingX);
    scrollHeight.value = Math.max(containerClientHeight, wrapperH + paddingY);

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
  }
};

onUnmounted(() => {
  debouncedAutoSave.cancel();
  stopPanelDrag();
  stopPanelResize();
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener("resize", handleLayoutResize);
  window.removeEventListener("mousemove", handleGuideMouseMove);
  window.removeEventListener("mouseup", handleGuideMouseUp);
  window.removeEventListener("keydown", handleCtrlKey);
  window.removeEventListener("keydown", handleCustomEditShortcuts);
  window.removeEventListener("keyup", handleCtrlKey);
  window.removeEventListener("blur", handleBlur);
  window.removeEventListener("brand-theme-updated", handleBrandThemeUpdated);
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
  isDraggingGuide.value = true;
  draggingGuideId.value = id;
  draggingGuideType.value = type;

  updateGuidePosFromEvent(e);

  window.addEventListener("mousemove", handleGuideMouseMove);
  window.addEventListener("mouseup", handleGuideMouseUp);
};

const updateGuidePosFromEvent = (e: MouseEvent) => {
  if (!scrollContainer.value) return;

  const rect = scrollContainer.value.getBoundingClientRect();
  const zoom = store.zoom;

  if (draggingGuideType.value === "horizontal") {
    // Relative to scrollContainer top
    const visualY = e.clientY - rect.top + scrollContainer.value.scrollTop;
    draggingGuidePos.value = (visualY - contentOffsetY.value) / zoom;
  } else {
    // Relative to scrollContainer left
    const visualX = e.clientX - rect.left + scrollContainer.value.scrollLeft;
    draggingGuidePos.value = (visualX - contentOffsetX.value) / zoom;
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
};

const handleMinimapScroll = (pos: { left: number; top: number }) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({
      left: pos.left,
      top: pos.top,
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
  if (!dragProjection.value) return { h: null, v: null };
  brandTick.value;
  const rangeColor = getThemeRgba("--brand-300", 0.6);
  const { minX, maxX, minY, maxY } = dragProjection.value;
  return {
    h: { start: minX, end: maxX, color: rangeColor },
    v: { start: minY, end: maxY, color: rangeColor },
  };
});
</script>

<template>
  <!-- Headless Wrapper (hidden) -->
  <div
    v-if="props.headless"
    class="print-designer-headless"
    style="display: none"
  >
    <div ref="rootContainer"></div>
  </div>

  <!-- Main Designer UI -->
  <div
    v-else
    ref="rootContainer"
    class="h-full w-full flex flex-col bg-gray-100 overflow-hidden"
  >
    <Header />
    <div ref="panelsHostRef" class="flex-1 flex overflow-hidden relative">
      <main class="flex-1 overflow-hidden relative flex flex-col">
        <div
          v-if="store.editingCustomElementId"
          class="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100"
        >
          <div class="text-sm font-medium">
            {{
              t("sidebar.editingElement", {
                name: editingCustomElement?.name || "",
              })
            }}
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleSaveCustomEdit"
              class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 inline-flex items-center gap-1.5"
            >
              <Save class="w-4 h-4" />
              {{ t("sidebar.saveEdit") }}
            </button>
            <button
              @click="showSaveAsModal = true"
              class="px-3 py-1.5 text-xs font-medium bg-blue-200 text-blue-900 rounded hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white inline-flex items-center gap-1.5"
            >
              <SaveAs class="w-4 h-4" />
              {{ t("sidebar.saveAs") }}
            </button>
            <button
              @click="handleExitCustomEdit"
              class="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-900 rounded hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 inline-flex items-center gap-1.5"
            >
              <Logout class="w-4 h-4" />
              {{ t("sidebar.exitEdit") }}
            </button>
          </div>
        </div>
        <Shortcuts />
        <!-- Rulers Area -->
        <div class="relative w-full h-full flex flex-col overflow-hidden">
          <!-- Top Ruler -->
          <div
            class="flex-none h-5 bg-gray-50 border-b border-gray-300 flex z-20"
          >
            <div
              class="w-5 flex-none bg-gray-100 border-r border-gray-300"
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
              class="w-5 flex-none bg-gray-50 border-r border-gray-300 h-full relative z-20 overflow-hidden"
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
              ref="scrollContainer"
              tabindex="-1"
              class="flex-1 overflow-auto p-8 flex relative canvas-scroll bg-gray-100 focus:outline-none"
              style="scrollbar-gutter: stable both-edges"
              @scroll="handleScroll"
              @click="
                (e) => {
                  if (
                    e.target === scrollContainer ||
                    e.target === e.currentTarget
                  ) {
                    store.selectGuide(null);
                  }
                }
              "
            >
              <div
                ref="canvasWrapper"
                :style="canvasStyle"
                class="mx-auto relative"
              >
                <Canvas ref="canvasContainer" class="absolute top-0 left-0" />
              </div>

              <!-- Guides Overlay -->
              <div
                class="absolute top-0 left-0 pointer-events-none z-30"
                :style="{
                  width: `${scrollWidth}px`,
                  height: `${scrollHeight}px`,
                }"
              >
                <!-- Dragging Distance Guides -->
                <template v-if="dragProjection">
                  <!-- Top Line -->
                  <div
                    class="absolute w-full border-t border-blue-500 border-dashed"
                    :style="{
                      top: `${contentOffsetY + dragProjection.minY * store.zoom}px`,
                      left: `${scrollX - PROJECTION_LINE_OVERDRAW}px`,
                      width: `${viewportWidth + PROJECTION_LINE_OVERDRAW * 2}px`,
                    }"
                  >
                    <div class="absolute top-0 left-0 w-4 border-t border-blue-500"></div>
                    <div class="absolute top-0 right-0 w-4 border-t border-blue-500"></div>
                    <div
                      class="absolute -top-6 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                      :style="{ left: `${PROJECTION_LINE_OVERDRAW + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.minY) }} {{ unitLabel }}
                    </div>
                  </div>
                  <!-- Bottom Line -->
                  <div
                    class="absolute w-full border-t border-dashed theme-border"
                    :style="{
                      top: `${contentOffsetY + dragProjection.maxY * store.zoom}px`,
                      left: `${scrollX - PROJECTION_LINE_OVERDRAW}px`,
                      width: `${viewportWidth + PROJECTION_LINE_OVERDRAW * 2}px`,
                    }"
                  >
                    <div class="absolute top-0 left-0 w-4 border-t theme-border"></div>
                    <div class="absolute top-0 right-0 w-4 border-t theme-border"></div>
                    <div
                      class="absolute -top-6 theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                      :style="{ left: `${PROJECTION_LINE_OVERDRAW + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.maxY) }} {{ unitLabel }}
                    </div>
                  </div>
                  <!-- Left Line -->
                  <div
                    class="absolute border-l border-dashed theme-border"
                    :style="{
                      left: `${contentOffsetX + dragProjection.minX * store.zoom}px`,
                      top: '-1px',
                      height: `${scrollHeight + 2}px`,
                    }"
                  >
                    <div
                      class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                      :style="{ top: `${scrollY + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.minX) }} {{ unitLabel }}
                    </div>
                  </div>
                  <!-- Right Line -->
                  <div
                    class="absolute border-l border-dashed theme-border"
                    :style="{
                      left: `${contentOffsetX + dragProjection.maxX * store.zoom}px`,
                      top: '-1px',
                      height: `${scrollHeight + 2}px`,
                    }"
                  >
                    <div
                      class="absolute -left-2 transform -translate-x-full theme-bg text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                      :style="{ top: `${scrollY + 10}px` }"
                    >
                      {{ formatUnitValue(dragProjection.maxX) }} {{ unitLabel }}
                    </div>
                  </div>
                </template>

                <!-- Existing Guides -->
                <template v-for="guide in store.guides" :key="guide.id">
                  <div
                    v-if="guide.type === 'horizontal'"
                    class="absolute left-0 w-full h-3 -mt-1.5 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                    :style="{
                      top: `${contentOffsetY + guide.position * store.zoom}px`,
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
                    class="absolute top-0 h-full w-3 -ml-1.5 cursor-col-resize pointer-events-auto group flex flex-row justify-center"
                    :style="{
                      left: `${contentOffsetX + guide.position * store.zoom}px`,
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
                      ? 'left-0 w-full border-t'
                      : 'top-0 h-full border-l',
                  ]"
                  :style="{
                    top:
                      draggingGuideType === 'horizontal'
                        ? `${contentOffsetY + draggingGuidePos * store.zoom}px`
                        : undefined,
                    left:
                      draggingGuideType === 'vertical'
                        ? `${contentOffsetX + draggingGuidePos * store.zoom}px`
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
                  class="absolute pointer-events-none"
                >
                  <div
                    v-if="store.highlightedEdge === 'top'"
                    class="absolute left-0 w-full border-t theme-border"
                    :style="{ top: `${contentOffsetY}px` }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'bottom'"
                    class="absolute left-0 w-full border-t theme-border"
                    :style="{
                      top: `${contentOffsetY + store.canvasSize.height * store.zoom}px`,
                    }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'left'"
                    class="absolute top-0 h-full border-l theme-border"
                    :style="{ left: `${contentOffsetX}px` }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'right'"
                    class="absolute top-0 h-full border-l theme-border"
                    :style="{
                      left: `${contentOffsetX + store.canvasSize.width * store.zoom}px`,
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- <footer class="h-6 bg-white border-t border-gray-200 text-xs flex items-center px-4 text-gray-500 z-30">
           Ready
        </footer> -->

        <!-- Minimap -->
        <div
          v-if="store.showMinimap"
          ref="minimapPanelRef"
          class="absolute pointer-events-none"
          :style="[minimapPanelStyle, { zIndex: getPanelZIndex('minimap') }]"
        >
          <div
              class="pointer-events-auto rounded-t-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            @mousedown="(e) => handleFloatingPanelMouseDown('minimap', e)"
          >
            <div
              class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-move select-none"
              data-floating-panel-drag-handle="true"
            >
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 m-0">
                {{ t("editor.showMinimap") }}
              </h3>
              <button
                class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                @click="store.setShowMinimap(false)"
              >
                <Close class="w-4 h-4" />
              </button>
            </div>

            <Minimap
              :scroll-width="scrollWidth"
              :scroll-height="scrollHeight"
              :viewport-width="viewportWidth"
              :viewport-height="viewportHeight"
              :scroll-left="scrollX"
              :scroll-top="scrollY"
              :pages="store.pages"
              :page-width="store.canvasSize.width"
              :page-height="store.canvasSize.height"
              :zoom="store.zoom"
              :content-offset-x="contentOffsetX"
              :content-offset-y="contentOffsetY"
              :canvas-background="store.canvasBackground"
              :show-header-line="store.showHeaderLine"
              :show-footer-line="store.showFooterLine"
              :header-height="store.headerHeight"
              :footer-height="store.footerHeight"
              :watermark="store.watermark || null"
              @update:scroll="handleMinimapScroll"
            />
          </div>
        </div>
      </main>

      <div
        class="absolute pointer-events-none"
        :style="[sidebarPanelStyle, { zIndex: getPanelZIndex('sidebar') }]"
      >
        <div
          class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          @mousedown="(e) => handleFloatingPanelMouseDown('sidebar', e)"
        >
          <Sidebar />
        </div>
        <button
          type="button"
          title="Resize panel"
          class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          @mousedown.stop.prevent="(e) => startPanelResize('sidebar', e)"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.5 14L14 6.5"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
            <path
              d="M3 14L14 3"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
            <path
              d="M9.8 14L14 9.8"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        class="absolute pointer-events-none"
        :style="[propertiesPanelStyle, { zIndex: getPanelZIndex('properties') }]"
      >
        <div
          class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          @mousedown="(e) => handleFloatingPanelMouseDown('properties', e)"
        >
          <PropertiesPanel />
        </div>
        <button
          type="button"
          title="Resize panel"
          class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          @mousedown.stop.prevent="(e) => startPanelResize('properties', e)"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.5 14L14 6.5"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
            <path
              d="M3 14L14 3"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
            <path
              d="M9.8 14L14 9.8"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <InputModal
      :show="showSaveAsModal"
      :initial-value="saveAsInitialName"
      :title="t('sidebar.saveAsCustomElement')"
      :placeholder="t('sidebar.enterNamePlaceholder')"
      @close="showSaveAsModal = false"
      @save="handleSaveCustomEditAs"
    />

    <!-- Global Loading Overlay -->
    <div
      v-if="templateStore.isLoading"
      class="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-[10000] pointer-events-auto transition-opacity duration-300"
    >
      <svg
        class="animate-spin h-8 w-8 text-gray-500 dark:text-gray-300"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <line x1="12" y1="3" x2="12" y2="7" opacity="1"></line>
        <line x1="16.5" y1="4.2" x2="14.5" y2="7.7" opacity="0.9"></line>
        <line x1="19.8" y1="7.5" x2="16.3" y2="9.5" opacity="0.8"></line>
        <line x1="21" y1="12" x2="17" y2="12" opacity="0.7"></line>
        <line x1="19.8" y1="16.5" x2="16.3" y2="14.5" opacity="0.6"></line>
        <line x1="16.5" y1="19.8" x2="14.5" y2="16.3" opacity="0.5"></line>
        <line x1="12" y1="21" x2="12" y2="17" opacity="0.4"></line>
        <line x1="7.5" y1="19.8" x2="9.5" y2="16.3" opacity="0.3"></line>
        <line x1="4.2" y1="16.5" x2="7.7" y2="14.5" opacity="0.2"></line>
        <line x1="3" y1="12" x2="7" y2="12" opacity="0.1"></line>
        <line x1="4.2" y1="7.5" x2="7.7" y2="9.5" opacity="0.1"></line>
        <line x1="7.5" y1="4.2" x2="9.5" y2="7.7" opacity="0.1"></line>
      </svg>
    </div>

    <!-- Modal Container for Teleport -->
    <div
      ref="modalContainer"
      class="print-designer-modals fixed inset-0 pointer-events-none z-[9999]"
    ></div>
    <HistoryPanel />
    <VariablesPanel />
  </div>
</template>
