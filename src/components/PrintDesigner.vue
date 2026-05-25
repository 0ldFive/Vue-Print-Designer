<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { uiConfirm } from "@/utils/confirm";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { useAutoSave } from "@/composables/useAutoSave";
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
import MinimapPanel from "./layout/MinimapPanel.vue";
import HistoryPanel from "./layout/HistoryPanel.vue";
import TemplateListPanel from "./layout/TemplateListPanel.vue";
import ElementStructurePanel from "./layout/ElementStructurePanel.vue";
import InputModal from "@/components/common/InputModal.vue";
import { toast } from "@/utils/toast";
import Save from "~icons/material-symbols/save";
import SaveAs from "~icons/material-symbols/save-as";
import Logout from "~icons/material-symbols/logout";
import Close from "~icons/material-symbols/close";
import Help from "~icons/material-symbols/help";

const store = useDesignerStore();
const templateStore = useTemplateStore();
const { autoSave } = useAutoSave();
const { isDark } = useTheme();
const { t } = useI18n();

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

type FloatingPanelKey =
  | "sidebar"
  | "templates"
  | "properties"
  | "structure"
  | "minimap";
type FloatingPanelLayerKey = FloatingPanelKey | "history";
type ResizablePanelKey = Exclude<FloatingPanelKey, "minimap">;
type FloatingPanelHorizontalAnchor = "left" | "right" | "free";
type FloatingPanelVerticalAnchor = "top" | "bottom" | "free";
type FloatingPanelHeightMode = "fit" | "fixed";
const FLOAT_PANEL_MIN_WIDTH = 256;
const FLOAT_PANEL_MAX_WIDTH = 520;
const FLOAT_PANEL_MARGIN = 12;
const FLOAT_PANEL_MIN_HEIGHT = 280;
const FLOAT_PANEL_EDGE_SNAP_TOLERANCE = 16;
const TEMPLATE_PANEL_DEFAULT_WIDTH = 320;
const PROPERTIES_PANEL_DEFAULT_WIDTH = 296;
const STRUCTURE_PANEL_DEFAULT_WIDTH = 300;
const TEMPLATE_PANEL_LAYOUT_STORAGE_KEY =
  "print-designer-template-panel-layout";
const ELEMENTS_PANEL_VISIBILITY_STORAGE_KEY =
  "print-designer-elements-panel-visibility";
const STRUCTURE_PANEL_VISIBILITY_STORAGE_KEY =
  "print-designer-structure-panel-visibility";
const MINIMAP_PANEL_FALLBACK_WIDTH = 212;
const MINIMAP_PANEL_FALLBACK_HEIGHT = 252;
const MINIMAP_PANEL_MIN_WIDTH = 160;
const MINIMAP_PANEL_MAX_WIDTH = 420;
const MINIMAP_PANEL_MIN_HEIGHT = 140;
const MINIMAP_PANEL_MAX_HEIGHT = 420;
const MINIMAP_PANEL_BORDER_SIZE = 2;
const MINIMAP_PANEL_HEADER_HEIGHT = 40;
const FLOAT_PANEL_Z_BASE = 40;
const FLOAT_PANEL_Z_STEP = 20;
const FLOAT_PANEL_Z_ACTIVE_OFFSET = 10;

const loadElementsPanelVisibility = () => {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(ELEMENTS_PANEL_VISIBILITY_STORAGE_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
};

const persistElementsPanelVisibility = (visible: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ELEMENTS_PANEL_VISIBILITY_STORAGE_KEY,
      String(visible),
    );
  } catch {
    // ignore storage failures
  }
};

const loadStructurePanelVisibility = () => {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(
      STRUCTURE_PANEL_VISIBILITY_STORAGE_KEY,
    );
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
};

const persistStructurePanelVisibility = (visible: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STRUCTURE_PANEL_VISIBILITY_STORAGE_KEY,
      String(visible),
    );
  } catch {
    // ignore storage failures
  }
};

type FloatingPanelBounds = {
  minX: number;
  minY: number;
  maxRight: number;
  maxBottom: number;
  maxHeight: number;
};

const panelsHostSize = ref({ width: 0, height: 0 });
const sidebarPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const templatePanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const propertiesPanelPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const structurePanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const sidebarPanelPreferredPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const templatePanelPreferredPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const propertiesPanelPreferredPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const structurePanelPreferredPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const sidebarPanelWidth = ref(FLOAT_PANEL_MIN_WIDTH);
const templatePanelWidth = ref(TEMPLATE_PANEL_DEFAULT_WIDTH);
const propertiesPanelWidth = ref(PROPERTIES_PANEL_DEFAULT_WIDTH);
const structurePanelWidth = ref(STRUCTURE_PANEL_DEFAULT_WIDTH);
const sidebarPanelPreferredWidth = ref(FLOAT_PANEL_MIN_WIDTH);
const templatePanelPreferredWidth = ref(TEMPLATE_PANEL_DEFAULT_WIDTH);
const propertiesPanelPreferredWidth = ref(PROPERTIES_PANEL_DEFAULT_WIDTH);
const structurePanelPreferredWidth = ref(STRUCTURE_PANEL_DEFAULT_WIDTH);
const sidebarPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const templatePanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const propertiesPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const structurePanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const sidebarPanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const templatePanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const propertiesPanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const structurePanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
const minimapPanelRef = ref<HTMLElement | null>(null);
const showElementsPanel = ref(loadElementsPanelVisibility());
const showTemplatePanel = ref(true);
const showPropertiesPanel = ref(true);
const showStructurePanel = ref(loadStructurePanelVisibility());
const minimapPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
const minimapPanelPreferredPos = ref({
  x: FLOAT_PANEL_MARGIN,
  y: FLOAT_PANEL_MARGIN,
});
const minimapPanelWidth = ref(MINIMAP_PANEL_FALLBACK_WIDTH);
const minimapPanelHeight = ref(MINIMAP_PANEL_FALLBACK_HEIGHT);
const minimapPanelPreferredWidth = ref(MINIMAP_PANEL_FALLBACK_WIDTH);
const minimapPanelPreferredHeight = ref(MINIMAP_PANEL_FALLBACK_HEIGHT);
const hasInitializedFloatingPanels = ref(false);
const hasInitializedMinimapPanel = ref(false);
const sidebarPanelAnchorX = ref<FloatingPanelHorizontalAnchor>("left");
const sidebarPanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
const templatePanelAnchorX = ref<FloatingPanelHorizontalAnchor>("left");
const templatePanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
const propertiesPanelAnchorX = ref<FloatingPanelHorizontalAnchor>("right");
const propertiesPanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
const structurePanelAnchorX = ref<FloatingPanelHorizontalAnchor>("free");
const structurePanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
const sidebarPanelHeightMode = ref<FloatingPanelHeightMode>("fit");
const templatePanelHeightMode = ref<FloatingPanelHeightMode>("fit");
const propertiesPanelHeightMode = ref<FloatingPanelHeightMode>("fit");
const structurePanelHeightMode = ref<FloatingPanelHeightMode>("fit");
const restoredTemplatePanelLayout = ref({
  x: false,
  y: false,
  width: false,
  height: false,
});

let draggingPanel: FloatingPanelKey | null = null;
let dragStartPointer = { x: 0, y: 0 };
let dragStartPanelPos = { x: 0, y: 0 };
let resizingPanel: FloatingPanelKey | null = null;
let resizeStartPointer = { x: 0, y: 0 };
let resizeStartWidth = FLOAT_PANEL_MIN_WIDTH;
let resizeStartHeight = FLOAT_PANEL_MIN_HEIGHT;
let resizeStartPanelPos = { x: 0, y: 0 };
let resizeStartPanelAnchors: {
  x: FloatingPanelHorizontalAnchor;
  y: FloatingPanelVerticalAnchor;
} = {
  x: "free",
  y: "free",
};

const floatingPanelLayerOrder = ref<FloatingPanelLayerKey[]>([
  "sidebar",
  "templates",
  "properties",
  "structure",
  "minimap",
  "history",
]);

const handleBrandThemeUpdated = () => {
  brandTick.value += 1;
};

const isEventForCurrentDesigner = (e: Event) => {
  const eventId = (e as CustomEvent)?.detail?.__designerInstanceId;
  if (!eventId) return true;
  return eventId === designerInstanceId;
};

const emitPanelVisibility = (eventName: string, visible: boolean) => {
  const detail: Record<string, unknown> = {
    visible,
  };
  if (designerInstanceId) {
    detail.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

const emitElementsPanelVisibility = () => {
  emitPanelVisibility(
    "designer:elements-panel-visibility",
    showElementsPanel.value,
  );
};

const emitTemplatePanelVisibility = () => {
  emitPanelVisibility(
    "designer:template-panel-visibility",
    showTemplatePanel.value,
  );
};

const emitPropertiesPanelVisibility = () => {
  emitPanelVisibility(
    "designer:properties-panel-visibility",
    showPropertiesPanel.value,
  );
};

const emitStructurePanelVisibility = () => {
  emitPanelVisibility(
    "designer:structure-panel-visibility",
    showStructurePanel.value,
  );
};

const clearStructurePanelCanvasHover = () => {
  const detail: Record<string, unknown> = {
    hovering: false,
    elementId: null,
    pageIndex: null,
  };
  if (designerInstanceId) {
    detail.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(
    new CustomEvent("designer:structure-panel-hover-element", {
      detail,
    }),
  );
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const isPanelRectOverlapping = (a: PanelRect, b: PanelRect) => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

const resolveSidebarNonOverlappingPos = () => {
  const bounds = getFloatingPanelBounds();
  const templateWidth = templatePanelWidth.value;
  const templateHeight = templatePanelHeight.value;

  if (templateWidth <= 0 || templateHeight <= 0) return null;

  const sidebarWidth = clampPanelWidth(
    clampPreferredPanelWidth(sidebarPanelPreferredWidth.value),
    sidebarPanelPreferredPos.value.x,
  );
  const desiredSidebarHeight =
    sidebarPanelHeightMode.value === "fit"
      ? bounds.maxHeight
      : clampPreferredPanelHeight(sidebarPanelPreferredHeight.value);
  const sidebarHeight = clampPanelHeight(
    desiredSidebarHeight,
    sidebarPanelPreferredPos.value.y,
  );

  const templateRect: PanelRect = {
    x: templatePanelPos.value.x,
    y: templatePanelPos.value.y,
    width: templateWidth,
    height: templateHeight,
  };

  const candidates = [
    {
      x: templateRect.x + templateRect.width + FLOAT_PANEL_MARGIN,
      y: templateRect.y,
    },
    {
      x: templateRect.x - sidebarWidth - FLOAT_PANEL_MARGIN,
      y: templateRect.y,
    },
    {
      x: templateRect.x,
      y: templateRect.y + templateRect.height + FLOAT_PANEL_MARGIN,
    },
    {
      x: templateRect.x,
      y: templateRect.y - sidebarHeight - FLOAT_PANEL_MARGIN,
    },
  ];

  for (const candidate of candidates) {
    const pos = clampPanelPos(
      candidate.x,
      candidate.y,
      sidebarWidth,
      sidebarHeight,
    );
    const sidebarRect: PanelRect = {
      x: pos.x,
      y: pos.y,
      width: sidebarWidth,
      height: sidebarHeight,
    };

    if (!isPanelRectOverlapping(sidebarRect, templateRect)) {
      return pos;
    }
  }

  return null;
};

const ensureSidebarNotOverlappingTemplatePanel = () => {
  if (!showElementsPanel.value || !showTemplatePanel.value) return;
  if (templatePanelWidth.value <= 0 || templatePanelHeight.value <= 0) return;

  const currentSidebarRect: PanelRect = {
    x: sidebarPanelPos.value.x,
    y: sidebarPanelPos.value.y,
    width: sidebarPanelWidth.value,
    height: sidebarPanelHeight.value,
  };
  const currentTemplateRect: PanelRect = {
    x: templatePanelPos.value.x,
    y: templatePanelPos.value.y,
    width: templatePanelWidth.value,
    height: templatePanelHeight.value,
  };

  if (!isPanelRectOverlapping(currentSidebarRect, currentTemplateRect)) return;

  const nonOverlappingPos = resolveSidebarNonOverlappingPos();
  if (!nonOverlappingPos) return;

  sidebarPanelAnchorX.value = "free";
  sidebarPanelAnchorY.value = "free";
  sidebarPanelPreferredPos.value = { ...nonOverlappingPos };
  sidebarPanelPos.value = { ...nonOverlappingPos };
};

const handleToggleElementsPanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const wasVisible = showElementsPanel.value;
  showElementsPanel.value = !showElementsPanel.value;
  persistElementsPanelVisibility(showElementsPanel.value);
  emitElementsPanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
    if (!wasVisible && showElementsPanel.value) {
      ensureSidebarNotOverlappingTemplatePanel();
      initOrClampFloatingPanels();
    }
  });
};

const handleToggleTemplatePanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const wasVisible = showTemplatePanel.value;
  showTemplatePanel.value = !showTemplatePanel.value;
  emitTemplatePanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
    if (!wasVisible && showTemplatePanel.value) {
      ensureSidebarNotOverlappingTemplatePanel();
      initOrClampFloatingPanels();
    }
  });
};

const handleTogglePropertiesPanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  showPropertiesPanel.value = !showPropertiesPanel.value;
  emitPropertiesPanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
  });
};

const handleToggleStructurePanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const wasVisible = showStructurePanel.value;
  showStructurePanel.value = !showStructurePanel.value;
  if (wasVisible && !showStructurePanel.value) {
    showStructureHelpTooltip.value = false;
    clearStructurePanelCanvasHover();
  }
  persistStructurePanelVisibility(showStructurePanel.value);
  emitStructurePanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
    if (!wasVisible && showStructurePanel.value) {
      bringPanelToFront("structure");
      initOrClampFloatingPanels();
    }
  });
};

const handleCloseElementsPanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  if (!showElementsPanel.value) return;
  showElementsPanel.value = false;
  persistElementsPanelVisibility(false);
  emitElementsPanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
  });
};

const closeTemplatePanel = () => {
  if (!showTemplatePanel.value) return;
  showTemplateHelpTooltip.value = false;
  showTemplatePanel.value = false;
  emitTemplatePanelVisibility();
};

const handleClosePropertiesPanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  if (!showPropertiesPanel.value) return;
  showPropertiesPanel.value = false;
  emitPropertiesPanelVisibility();
  nextTick(() => {
    initOrClampFloatingPanels();
  });
};

const closeStructurePanel = () => {
  if (!showStructurePanel.value) return;
  showStructureHelpTooltip.value = false;
  clearStructurePanelCanvasHover();
  showStructurePanel.value = false;
  persistStructurePanelVisibility(false);
  emitStructurePanelVisibility();
};

const handleCloseStructurePanelEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  if (!showStructurePanel.value) return;
  closeStructurePanel();
  nextTick(() => {
    initOrClampFloatingPanels();
  });
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
  const fallbackMaxBottom = Math.max(fallbackMinY, height - FLOAT_PANEL_MARGIN);
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
  const { minX, minY, maxRight, maxBottom } = getFloatingPanelBounds();
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
  return Math.min(
    Math.max(panelHeight, FLOAT_PANEL_MIN_HEIGHT),
    maxAllowedHeight,
  );
};

const clampPreferredPanelWidth = (panelWidth: number) => {
  return Math.min(
    Math.max(panelWidth, FLOAT_PANEL_MIN_WIDTH),
    FLOAT_PANEL_MAX_WIDTH,
  );
};

const clampPreferredPanelHeight = (panelHeight: number) => {
  return Math.max(panelHeight, FLOAT_PANEL_MIN_HEIGHT);
};

const clampPreferredMinimapPanelWidth = (panelWidth: number) => {
  return Math.min(
    Math.max(panelWidth, MINIMAP_PANEL_MIN_WIDTH),
    MINIMAP_PANEL_MAX_WIDTH,
  );
};

const clampPreferredMinimapPanelHeight = (panelHeight: number) => {
  return Math.min(
    Math.max(panelHeight, MINIMAP_PANEL_MIN_HEIGHT),
    MINIMAP_PANEL_MAX_HEIGHT,
  );
};

const clampMinimapPanelWidth = (panelWidth: number, panelX: number) => {
  const { minX, maxRight } = getFloatingPanelBounds();
  const maxWidthByBounds = Math.max(
    MINIMAP_PANEL_MIN_WIDTH,
    maxRight - Math.max(panelX, minX),
  );
  const maxWidth = Math.min(MINIMAP_PANEL_MAX_WIDTH, maxWidthByBounds);
  return Math.min(Math.max(panelWidth, MINIMAP_PANEL_MIN_WIDTH), maxWidth);
};

const clampMinimapPanelHeight = (panelHeight: number, panelY: number) => {
  const { minY, maxBottom } = getFloatingPanelBounds();
  const maxHeightByBounds = Math.max(
    MINIMAP_PANEL_MIN_HEIGHT,
    maxBottom - Math.max(panelY, minY),
  );
  const maxHeight = Math.min(MINIMAP_PANEL_MAX_HEIGHT, maxHeightByBounds);
  return Math.min(Math.max(panelHeight, MINIMAP_PANEL_MIN_HEIGHT), maxHeight);
};

const restoreTemplatePanelLayout = () => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TEMPLATE_PANEL_LAYOUT_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    const isFiniteNumber = (value: unknown): value is number =>
      typeof value === "number" && Number.isFinite(value);

    if (isFiniteNumber(parsed.x)) {
      templatePanelPreferredPos.value.x = parsed.x;
      restoredTemplatePanelLayout.value.x = true;
    }
    if (isFiniteNumber(parsed.y)) {
      templatePanelPreferredPos.value.y = parsed.y;
      restoredTemplatePanelLayout.value.y = true;
    }
    if (isFiniteNumber(parsed.width)) {
      const width = clampPreferredPanelWidth(parsed.width);
      templatePanelPreferredWidth.value = width;
      templatePanelWidth.value = width;
      restoredTemplatePanelLayout.value.width = true;
    }
    if (isFiniteNumber(parsed.height)) {
      const height = clampPreferredPanelHeight(parsed.height);
      templatePanelPreferredHeight.value = height;
      templatePanelHeight.value = height;
      restoredTemplatePanelLayout.value.height = true;
    }
  } catch (error) {
    console.warn("Failed to restore template panel layout", error);
  }
};

const persistTemplatePanelLayout = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TEMPLATE_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        x: templatePanelPreferredPos.value.x,
        y: templatePanelPreferredPos.value.y,
        width: templatePanelPreferredWidth.value,
        height: templatePanelPreferredHeight.value,
      }),
    );
  } catch (error) {
    console.warn("Failed to persist template panel layout", error);
  }
};

type FloatingPanelLayout = {
  pos: {
    x: number;
    y: number;
  };
  width: number;
  height: number;
};

type FloatingPanelLayoutOptions = {
  horizontalAnchor: FloatingPanelHorizontalAnchor;
  verticalAnchor: FloatingPanelVerticalAnchor;
  heightMode: FloatingPanelHeightMode;
};

const getPanelAnchors = (panel: ResizablePanelKey) => {
  if (panel === "sidebar") {
    return {
      x: sidebarPanelAnchorX.value,
      y: sidebarPanelAnchorY.value,
    };
  }

  if (panel === "templates") {
    return {
      x: templatePanelAnchorX.value,
      y: templatePanelAnchorY.value,
    };
  }

  if (panel === "structure") {
    return {
      x: structurePanelAnchorX.value,
      y: structurePanelAnchorY.value,
    };
  }

  return {
    x: propertiesPanelAnchorX.value,
    y: propertiesPanelAnchorY.value,
  };
};

const setPanelAnchors = (
  panel: ResizablePanelKey,
  anchors: {
    x: FloatingPanelHorizontalAnchor;
    y: FloatingPanelVerticalAnchor;
  },
) => {
  if (panel === "sidebar") {
    sidebarPanelAnchorX.value = anchors.x;
    sidebarPanelAnchorY.value = anchors.y;
    return;
  }

  if (panel === "templates") {
    templatePanelAnchorX.value = anchors.x;
    templatePanelAnchorY.value = anchors.y;
    return;
  }

  if (panel === "structure") {
    structurePanelAnchorX.value = anchors.x;
    structurePanelAnchorY.value = anchors.y;
    return;
  }

  propertiesPanelAnchorX.value = anchors.x;
  propertiesPanelAnchorY.value = anchors.y;
};

const setPanelHeightMode = (
  panel: ResizablePanelKey,
  heightMode: FloatingPanelHeightMode,
) => {
  if (panel === "sidebar") {
    sidebarPanelHeightMode.value = heightMode;
    return;
  }

  if (panel === "templates") {
    templatePanelHeightMode.value = heightMode;
    return;
  }

  if (panel === "structure") {
    structurePanelHeightMode.value = heightMode;
    return;
  }

  propertiesPanelHeightMode.value = heightMode;
};

const detectHorizontalAnchor = (
  panelX: number,
  panelWidth: number,
  bounds: FloatingPanelBounds,
  previousAnchor: FloatingPanelHorizontalAnchor,
): FloatingPanelHorizontalAnchor => {
  const leftDistance = Math.abs(panelX - bounds.minX);
  const rightDistance = Math.abs(panelX + panelWidth - bounds.maxRight);
  const nearLeft = leftDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE;
  const nearRight = rightDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE;

  if (nearLeft && nearRight) {
    if (previousAnchor === "left" || previousAnchor === "right") {
      return previousAnchor;
    }
    return leftDistance <= rightDistance ? "left" : "right";
  }

  if (nearLeft) return "left";
  if (nearRight) return "right";
  return "free";
};

const detectVerticalAnchor = (
  panelY: number,
  panelHeight: number,
  bounds: FloatingPanelBounds,
  previousAnchor: FloatingPanelVerticalAnchor,
): FloatingPanelVerticalAnchor => {
  const topDistance = Math.abs(panelY - bounds.minY);
  const bottomDistance = Math.abs(panelY + panelHeight - bounds.maxBottom);
  const nearTop = topDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE;
  const nearBottom = bottomDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE;

  if (nearTop && nearBottom) {
    if (previousAnchor === "top" || previousAnchor === "bottom") {
      return previousAnchor;
    }
    return topDistance <= bottomDistance ? "top" : "bottom";
  }

  if (nearTop) return "top";
  if (nearBottom) return "bottom";
  return "free";
};

const detectPanelAnchors = (
  panel: ResizablePanelKey,
  panelPos: { x: number; y: number },
  panelWidth: number,
  panelHeight: number,
): {
  x: FloatingPanelHorizontalAnchor;
  y: FloatingPanelVerticalAnchor;
} => {
  const bounds = getFloatingPanelBounds();
  const previousAnchors = getPanelAnchors(panel);

  return {
    x: detectHorizontalAnchor(
      panelPos.x,
      panelWidth,
      bounds,
      previousAnchors.x,
    ),
    y: detectVerticalAnchor(panelPos.y, panelHeight, bounds, previousAnchors.y),
  };
};

const resolvePanelLayout = (
  preferredPos: { x: number; y: number },
  preferredWidth: number,
  preferredHeight: number,
  options: FloatingPanelLayoutOptions,
): FloatingPanelLayout => {
  const bounds = getFloatingPanelBounds();
  const desiredWidth = clampPreferredPanelWidth(preferredWidth);
  const desiredHeight =
    options.heightMode === "fit"
      ? bounds.maxHeight
      : clampPreferredPanelHeight(preferredHeight);

  let nextX = preferredPos.x;
  let nextY = preferredPos.y;

  if (options.horizontalAnchor === "left") {
    nextX = bounds.minX;
  } else if (options.horizontalAnchor === "right") {
    nextX = bounds.maxRight - desiredWidth;
  }

  if (options.verticalAnchor === "top") {
    nextY = bounds.minY;
  } else if (options.verticalAnchor === "bottom") {
    nextY = bounds.maxBottom - desiredHeight;
  }

  let width = clampPanelWidth(desiredWidth, nextX);
  let height = clampPanelHeight(desiredHeight, nextY);

  if (options.horizontalAnchor === "left") {
    nextX = bounds.minX;
  } else if (options.horizontalAnchor === "right") {
    nextX = bounds.maxRight - width;
  }

  if (options.verticalAnchor === "top") {
    nextY = bounds.minY;
  } else if (options.verticalAnchor === "bottom") {
    nextY = bounds.maxBottom - height;
  }

  let pos = clampPanelPos(nextX, nextY, width, height);

  width = clampPanelWidth(desiredWidth, pos.x);
  height = clampPanelHeight(desiredHeight, pos.y);

  if (options.horizontalAnchor === "left") {
    nextX = bounds.minX;
  } else if (options.horizontalAnchor === "right") {
    nextX = bounds.maxRight - width;
  } else {
    nextX = pos.x;
  }

  if (options.verticalAnchor === "top") {
    nextY = bounds.minY;
  } else if (options.verticalAnchor === "bottom") {
    nextY = bounds.maxBottom - height;
  } else {
    nextY = pos.y;
  }

  pos = clampPanelPos(nextX, nextY, width, height);

  return {
    pos,
    width,
    height,
  };
};

const resolvePanelResizeLayout = (
  startPos: { x: number; y: number },
  startWidth: number,
  startHeight: number,
  deltaX: number,
  deltaY: number,
  anchors: {
    x: FloatingPanelHorizontalAnchor;
    y: FloatingPanelVerticalAnchor;
  },
) => {
  const desiredWidth = clampPreferredPanelWidth(startWidth + deltaX);
  const desiredHeight = clampPreferredPanelHeight(startHeight + deltaY);

  const startRight = startPos.x + startWidth;
  const startBottom = startPos.y + startHeight;

  let nextX = startPos.x;
  let nextY = startPos.y;

  if (anchors.x === "right") {
    nextX = startRight - desiredWidth;
  }
  if (anchors.y === "bottom") {
    nextY = startBottom - desiredHeight;
  }

  let width = clampPanelWidth(desiredWidth, nextX);
  let height = clampPanelHeight(desiredHeight, nextY);

  if (anchors.x === "right") {
    nextX = startRight - width;
  }
  if (anchors.y === "bottom") {
    nextY = startBottom - height;
  }

  const pos = clampPanelPos(nextX, nextY, width, height);

  return {
    pos,
    width,
    height,
  };
};

const resolveMinimapPanelLayout = (
  preferredPos: { x: number; y: number },
  preferredWidth: number,
  preferredHeight: number,
): FloatingPanelLayout => {
  const desiredWidth = clampPreferredMinimapPanelWidth(preferredWidth);
  const desiredHeight = clampPreferredMinimapPanelHeight(preferredHeight);
  let width = clampMinimapPanelWidth(desiredWidth, preferredPos.x);
  let height = clampMinimapPanelHeight(desiredHeight, preferredPos.y);
  let pos = clampPanelPos(preferredPos.x, preferredPos.y, width, height);

  width = clampMinimapPanelWidth(desiredWidth, pos.x);
  height = clampMinimapPanelHeight(desiredHeight, pos.y);
  pos = clampPanelPos(pos.x, pos.y, width, height);

  return { pos, width, height };
};

const resolveMinimapPanelResizeLayout = (
  startPos: { x: number; y: number },
  startWidth: number,
  startHeight: number,
  deltaX: number,
  deltaY: number,
): FloatingPanelLayout => {
  return resolveMinimapPanelLayout(
    startPos,
    startWidth + deltaX,
    startHeight + deltaY,
  );
};

const getMinimapPanelSize = () => {
  return {
    width: minimapPanelWidth.value,
    height: minimapPanelHeight.value,
  };
};

const placeMinimapNearPropertiesPanel = () => {
  const minimapSize = getMinimapPanelSize();
  const targetX =
    propertiesPanelPos.value.x - minimapSize.width - FLOAT_PANEL_MARGIN;
  const targetY = propertiesPanelPos.value.y;

  minimapPanelPreferredPos.value = {
    x: targetX,
    y: targetY,
  };

  const minimapLayout = resolveMinimapPanelLayout(
    minimapPanelPreferredPos.value,
    minimapPanelPreferredWidth.value,
    minimapPanelPreferredHeight.value,
  );
  minimapPanelPos.value = minimapLayout.pos;
  minimapPanelWidth.value = minimapLayout.width;
  minimapPanelHeight.value = minimapLayout.height;
  minimapPanelPreferredPos.value = { ...minimapLayout.pos };
  hasInitializedMinimapPanel.value = true;
};

const initOrClampFloatingPanels = () => {
  updatePanelsHostSize();
  const { width, height } = panelsHostSize.value;
  if (!width || !height) return;

  const bounds = getFloatingPanelBounds();

  if (!hasInitializedFloatingPanels.value) {
    sidebarPanelAnchorX.value = "left";
    sidebarPanelAnchorY.value = "top";
    templatePanelAnchorX.value = restoredTemplatePanelLayout.value.x
      ? "free"
      : "left";
    templatePanelAnchorY.value = restoredTemplatePanelLayout.value.y
      ? "free"
      : "top";
    propertiesPanelAnchorX.value = "right";
    propertiesPanelAnchorY.value = "top";
    structurePanelAnchorX.value = "free";
    structurePanelAnchorY.value = "top";

    sidebarPanelHeightMode.value = "fit";
    propertiesPanelHeightMode.value = "fit";
    structurePanelHeightMode.value = "fit";

    sidebarPanelPreferredHeight.value = bounds.maxHeight;
    propertiesPanelPreferredHeight.value = bounds.maxHeight;
    structurePanelPreferredHeight.value = bounds.maxHeight;
    sidebarPanelPreferredPos.value = {
      x: Math.max(
        bounds.minX,
        bounds.minX + templatePanelPreferredWidth.value + FLOAT_PANEL_MARGIN,
      ),
      y: bounds.minY,
    };

    const defaultTemplatePos = {
      x: bounds.minX,
      y: bounds.minY,
    };
    templatePanelPreferredPos.value = {
      x: restoredTemplatePanelLayout.value.x
        ? templatePanelPreferredPos.value.x
        : defaultTemplatePos.x,
      y: restoredTemplatePanelLayout.value.y
        ? templatePanelPreferredPos.value.y
        : defaultTemplatePos.y,
    };

    const restoredTemplateHeightDelta = Math.abs(
      templatePanelPreferredHeight.value - bounds.maxHeight,
    );
    templatePanelHeightMode.value =
      restoredTemplatePanelLayout.value.height &&
      restoredTemplateHeightDelta > FLOAT_PANEL_EDGE_SNAP_TOLERANCE
        ? "fixed"
        : "fit";

    if (templatePanelHeightMode.value === "fit") {
      templatePanelPreferredHeight.value = bounds.maxHeight;
    }

    propertiesPanelPreferredPos.value = {
      x: Math.max(
        bounds.minX,
        bounds.maxRight - propertiesPanelPreferredWidth.value,
      ),
      y: bounds.minY,
    };

    structurePanelPreferredPos.value = {
      x: Math.max(
        bounds.minX,
        bounds.maxRight -
          propertiesPanelPreferredWidth.value -
          structurePanelPreferredWidth.value -
          FLOAT_PANEL_MARGIN,
      ),
      y: bounds.minY,
    };
    hasInitializedFloatingPanels.value = true;
  }

  sidebarPanelPreferredWidth.value = clampPreferredPanelWidth(
    sidebarPanelPreferredWidth.value,
  );
  templatePanelPreferredWidth.value = clampPreferredPanelWidth(
    templatePanelPreferredWidth.value,
  );
  propertiesPanelPreferredWidth.value = clampPreferredPanelWidth(
    propertiesPanelPreferredWidth.value,
  );
  structurePanelPreferredWidth.value = clampPreferredPanelWidth(
    structurePanelPreferredWidth.value,
  );
  sidebarPanelPreferredHeight.value = clampPreferredPanelHeight(
    sidebarPanelPreferredHeight.value,
  );
  templatePanelPreferredHeight.value = clampPreferredPanelHeight(
    templatePanelPreferredHeight.value,
  );
  propertiesPanelPreferredHeight.value = clampPreferredPanelHeight(
    propertiesPanelPreferredHeight.value,
  );
  structurePanelPreferredHeight.value = clampPreferredPanelHeight(
    structurePanelPreferredHeight.value,
  );

  const sidebarLayout = resolvePanelLayout(
    sidebarPanelPreferredPos.value,
    sidebarPanelPreferredWidth.value,
    sidebarPanelPreferredHeight.value,
    {
      horizontalAnchor: sidebarPanelAnchorX.value,
      verticalAnchor: sidebarPanelAnchorY.value,
      heightMode: sidebarPanelHeightMode.value,
    },
  );
  sidebarPanelPos.value = sidebarLayout.pos;
  sidebarPanelWidth.value = sidebarLayout.width;
  sidebarPanelHeight.value = sidebarLayout.height;

  const templateLayout = resolvePanelLayout(
    templatePanelPreferredPos.value,
    templatePanelPreferredWidth.value,
    templatePanelPreferredHeight.value,
    {
      horizontalAnchor: templatePanelAnchorX.value,
      verticalAnchor: templatePanelAnchorY.value,
      heightMode: templatePanelHeightMode.value,
    },
  );
  templatePanelPos.value = templateLayout.pos;
  templatePanelWidth.value = templateLayout.width;
  templatePanelHeight.value = templateLayout.height;

  const propertiesLayout = resolvePanelLayout(
    propertiesPanelPreferredPos.value,
    propertiesPanelPreferredWidth.value,
    propertiesPanelPreferredHeight.value,
    {
      horizontalAnchor: propertiesPanelAnchorX.value,
      verticalAnchor: propertiesPanelAnchorY.value,
      heightMode: propertiesPanelHeightMode.value,
    },
  );
  propertiesPanelPos.value = propertiesLayout.pos;
  propertiesPanelWidth.value = propertiesLayout.width;
  propertiesPanelHeight.value = propertiesLayout.height;

  const structureLayout = resolvePanelLayout(
    structurePanelPreferredPos.value,
    structurePanelPreferredWidth.value,
    structurePanelPreferredHeight.value,
    {
      horizontalAnchor: structurePanelAnchorX.value,
      verticalAnchor: structurePanelAnchorY.value,
      heightMode: structurePanelHeightMode.value,
    },
  );
  structurePanelPos.value = structureLayout.pos;
  structurePanelWidth.value = structureLayout.width;
  structurePanelHeight.value = structureLayout.height;

  if (!store.showMinimap) return;

  if (!hasInitializedMinimapPanel.value) {
    placeMinimapNearPropertiesPanel();
    return;
  }

  const minimapLayout = resolveMinimapPanelLayout(
    minimapPanelPreferredPos.value,
    minimapPanelPreferredWidth.value,
    minimapPanelPreferredHeight.value,
  );
  minimapPanelPos.value = minimapLayout.pos;
  minimapPanelWidth.value = minimapLayout.width;
  minimapPanelHeight.value = minimapLayout.height;
  minimapPanelPreferredPos.value = { ...minimapLayout.pos };
};

const sidebarPanelStyle = computed(() => {
  return {
    left: `${sidebarPanelPos.value.x}px`,
    top: `${sidebarPanelPos.value.y}px`,
    width: `${sidebarPanelWidth.value}px`,
    height: `${sidebarPanelHeight.value}px`,
  };
});

const templatePanelStyle = computed(() => {
  return {
    left: `${templatePanelPos.value.x}px`,
    top: `${templatePanelPos.value.y}px`,
    width: `${templatePanelWidth.value}px`,
    height: `${templatePanelHeight.value}px`,
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

const structurePanelStyle = computed(() => {
  return {
    left: `${structurePanelPos.value.x}px`,
    top: `${structurePanelPos.value.y}px`,
    width: `${structurePanelWidth.value}px`,
    height: `${structurePanelHeight.value}px`,
  };
});

const minimapPanelStyle = computed(() => {
  return {
    left: `${minimapPanelPos.value.x}px`,
    top: `${minimapPanelPos.value.y}px`,
    width: `${minimapPanelWidth.value}px`,
    height: `${minimapPanelHeight.value}px`,
  };
});

const minimapPreviewWidth = computed(() =>
  Math.max(120, minimapPanelWidth.value - MINIMAP_PANEL_BORDER_SIZE),
);
const minimapPreviewMaxHeight = computed(() =>
  Math.max(
    80,
    minimapPanelHeight.value -
      MINIMAP_PANEL_HEADER_HEIGHT -
      MINIMAP_PANEL_BORDER_SIZE,
  ),
);

const isFloatingPanelLayerKey = (
  value: unknown,
): value is FloatingPanelLayerKey => {
  return (
    value === "sidebar" ||
    value === "templates" ||
    value === "properties" ||
    value === "structure" ||
    value === "minimap" ||
    value === "history"
  );
};

const bringPanelToFront = (panel: FloatingPanelLayerKey) => {
  const currentOrder = floatingPanelLayerOrder.value.filter(
    (item) => item !== panel,
  );
  currentOrder.push(panel);
  floatingPanelLayerOrder.value = currentOrder;
};

const getPanelLayerBaseZIndex = (panel: FloatingPanelLayerKey) => {
  const panelIndex = floatingPanelLayerOrder.value.indexOf(panel);
  const normalizedIndex = panelIndex < 0 ? 0 : panelIndex;
  return FLOAT_PANEL_Z_BASE + normalizedIndex * FLOAT_PANEL_Z_STEP;
};

const getPanelZIndex = (panel: FloatingPanelKey) => {
  const panelBaseZIndex = getPanelLayerBaseZIndex(panel);
  if (draggingPanel === panel || resizingPanel === panel) {
    return panelBaseZIndex + FLOAT_PANEL_Z_ACTIVE_OFFSET;
  }
  return panelBaseZIndex;
};

const historyPanelBaseZIndex = computed(() =>
  getPanelLayerBaseZIndex("history"),
);

const handleBringPanelToFrontEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  const panel = (e as CustomEvent)?.detail?.panel;
  if (!isFloatingPanelLayerKey(panel)) return;
  bringPanelToFront(panel);
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

const handlePanelDragMove = (e: MouseEvent) => {
  if (!draggingPanel) return;

  e.preventDefault();
  const deltaX = e.clientX - dragStartPointer.x;
  const deltaY = e.clientY - dragStartPointer.y;
  const panelWidth =
    draggingPanel === "sidebar"
      ? sidebarPanelWidth.value
      : draggingPanel === "templates"
        ? templatePanelWidth.value
        : draggingPanel === "properties"
          ? propertiesPanelWidth.value
          : draggingPanel === "structure"
            ? structurePanelWidth.value
          : getMinimapPanelSize().width;
  const panelHeight =
    draggingPanel === "sidebar"
      ? sidebarPanelHeight.value
      : draggingPanel === "templates"
        ? templatePanelHeight.value
        : draggingPanel === "properties"
          ? propertiesPanelHeight.value
          : draggingPanel === "structure"
            ? structurePanelHeight.value
          : getMinimapPanelSize().height;
  const nextPos = clampPanelPos(
    dragStartPanelPos.x + deltaX,
    dragStartPanelPos.y + deltaY,
    panelWidth,
    panelHeight,
  );

  if (draggingPanel === "sidebar") {
    sidebarPanelPos.value = nextPos;
    sidebarPanelPreferredPos.value = { ...nextPos };
    setPanelAnchors(
      "sidebar",
      detectPanelAnchors(
        "sidebar",
        nextPos,
        sidebarPanelWidth.value,
        sidebarPanelHeight.value,
      ),
    );
    return;
  }

  if (draggingPanel === "templates") {
    templatePanelPos.value = nextPos;
    templatePanelPreferredPos.value = { ...nextPos };
    setPanelAnchors(
      "templates",
      detectPanelAnchors(
        "templates",
        nextPos,
        templatePanelWidth.value,
        templatePanelHeight.value,
      ),
    );
    return;
  }

  if (draggingPanel === "properties") {
    propertiesPanelPos.value = nextPos;
    propertiesPanelPreferredPos.value = { ...nextPos };
    setPanelAnchors(
      "properties",
      detectPanelAnchors(
        "properties",
        nextPos,
        propertiesPanelWidth.value,
        propertiesPanelHeight.value,
      ),
    );
    return;
  }

  if (draggingPanel === "structure") {
    structurePanelPos.value = nextPos;
    structurePanelPreferredPos.value = { ...nextPos };
    setPanelAnchors(
      "structure",
      detectPanelAnchors(
        "structure",
        nextPos,
        structurePanelWidth.value,
        structurePanelHeight.value,
      ),
    );
    return;
  }

  minimapPanelPos.value = nextPos;
  minimapPanelPreferredPos.value = { ...nextPos };
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

  if (resizingPanel === "minimap") {
    const resizedLayout = resolveMinimapPanelResizeLayout(
      resizeStartPanelPos,
      resizeStartWidth,
      resizeStartHeight,
      deltaX,
      deltaY,
    );

    minimapPanelWidth.value = resizedLayout.width;
    minimapPanelHeight.value = resizedLayout.height;
    minimapPanelPos.value = resizedLayout.pos;
    minimapPanelPreferredWidth.value = resizedLayout.width;
    minimapPanelPreferredHeight.value = resizedLayout.height;
    minimapPanelPreferredPos.value = { ...resizedLayout.pos };
    return;
  }

  if (resizingPanel === "sidebar") {
    const resizedLayout = resolvePanelResizeLayout(
      resizeStartPanelPos,
      resizeStartWidth,
      resizeStartHeight,
      deltaX,
      deltaY,
      resizeStartPanelAnchors,
    );

    sidebarPanelWidth.value = resizedLayout.width;
    sidebarPanelHeight.value = resizedLayout.height;
    sidebarPanelPos.value = resizedLayout.pos;
    sidebarPanelPreferredWidth.value = resizedLayout.width;
    sidebarPanelPreferredHeight.value = resizedLayout.height;
    sidebarPanelPreferredPos.value = { ...resizedLayout.pos };
    setPanelHeightMode("sidebar", "fixed");
    setPanelAnchors(
      "sidebar",
      detectPanelAnchors(
        "sidebar",
        resizedLayout.pos,
        resizedLayout.width,
        resizedLayout.height,
      ),
    );
    return;
  }

  if (resizingPanel === "templates") {
    const resizedLayout = resolvePanelResizeLayout(
      resizeStartPanelPos,
      resizeStartWidth,
      resizeStartHeight,
      deltaX,
      deltaY,
      resizeStartPanelAnchors,
    );

    templatePanelWidth.value = resizedLayout.width;
    templatePanelHeight.value = resizedLayout.height;
    templatePanelPos.value = resizedLayout.pos;
    templatePanelPreferredWidth.value = resizedLayout.width;
    templatePanelPreferredHeight.value = resizedLayout.height;
    templatePanelPreferredPos.value = { ...resizedLayout.pos };
    setPanelHeightMode("templates", "fixed");
    setPanelAnchors(
      "templates",
      detectPanelAnchors(
        "templates",
        resizedLayout.pos,
        resizedLayout.width,
        resizedLayout.height,
      ),
    );
    return;
  }

  if (resizingPanel === "structure") {
    const resizedLayout = resolvePanelResizeLayout(
      resizeStartPanelPos,
      resizeStartWidth,
      resizeStartHeight,
      deltaX,
      deltaY,
      resizeStartPanelAnchors,
    );

    structurePanelWidth.value = resizedLayout.width;
    structurePanelHeight.value = resizedLayout.height;
    structurePanelPos.value = resizedLayout.pos;
    structurePanelPreferredWidth.value = resizedLayout.width;
    structurePanelPreferredHeight.value = resizedLayout.height;
    structurePanelPreferredPos.value = { ...resizedLayout.pos };
    setPanelHeightMode("structure", "fixed");
    setPanelAnchors(
      "structure",
      detectPanelAnchors(
        "structure",
        resizedLayout.pos,
        resizedLayout.width,
        resizedLayout.height,
      ),
    );
    return;
  }

  const resizedLayout = resolvePanelResizeLayout(
    resizeStartPanelPos,
    resizeStartWidth,
    resizeStartHeight,
    deltaX,
    deltaY,
    resizeStartPanelAnchors,
  );

  propertiesPanelWidth.value = resizedLayout.width;
  propertiesPanelHeight.value = resizedLayout.height;
  propertiesPanelPos.value = resizedLayout.pos;
  propertiesPanelPreferredWidth.value = resizedLayout.width;
  propertiesPanelPreferredHeight.value = resizedLayout.height;
  propertiesPanelPreferredPos.value = { ...resizedLayout.pos };
  setPanelHeightMode("properties", "fixed");
  setPanelAnchors(
    "properties",
    detectPanelAnchors(
      "properties",
      resizedLayout.pos,
      resizedLayout.width,
      resizedLayout.height,
    ),
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
  bringPanelToFront(panel);
  resizingPanel = panel;
  resizeStartPointer = { x: e.clientX, y: e.clientY };
  resizeStartWidth =
    panel === "sidebar"
      ? sidebarPanelWidth.value
      : panel === "templates"
        ? templatePanelWidth.value
        : panel === "properties"
          ? propertiesPanelWidth.value
          : panel === "structure"
            ? structurePanelWidth.value
          : minimapPanelWidth.value;
  resizeStartHeight =
    panel === "sidebar"
      ? sidebarPanelHeight.value
      : panel === "templates"
        ? templatePanelHeight.value
        : panel === "properties"
          ? propertiesPanelHeight.value
          : panel === "structure"
            ? structurePanelHeight.value
          : minimapPanelHeight.value;
  resizeStartPanelPos =
    panel === "sidebar"
      ? { ...sidebarPanelPos.value }
      : panel === "templates"
        ? { ...templatePanelPos.value }
        : panel === "properties"
          ? { ...propertiesPanelPos.value }
          : panel === "structure"
            ? { ...structurePanelPos.value }
          : { ...minimapPanelPos.value };
  resizeStartPanelAnchors =
    panel === "minimap"
      ? { x: "free", y: "free" }
      : getPanelAnchors(panel as ResizablePanelKey);

  window.addEventListener("mousemove", handlePanelResizeMove);
  window.addEventListener("mouseup", stopPanelResize);
};

const startPanelDrag = (panel: FloatingPanelKey, e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();

  bringPanelToFront(panel);
  draggingPanel = panel;
  dragStartPointer = { x: e.clientX, y: e.clientY };
  dragStartPanelPos =
    panel === "sidebar"
      ? { ...sidebarPanelPos.value }
      : panel === "templates"
        ? { ...templatePanelPos.value }
        : panel === "properties"
          ? { ...propertiesPanelPos.value }
          : panel === "structure"
            ? { ...structurePanelPos.value }
          : { ...minimapPanelPos.value };

  window.addEventListener("mousemove", handlePanelDragMove);
  window.addEventListener("mouseup", stopPanelDrag);
};

const handleFloatingPanelMouseDown = (
  panel: FloatingPanelKey,
  e: MouseEvent,
) => {
  const target = e.target as HTMLElement | null;
  if (
    target?.closest(".panel-close-btn") ||
    target?.closest(".panel-help-btn")
  ) {
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

watch(
  () => store.showHistoryPanel,
  (show) => {
    if (!show) return;
    bringPanelToFront("history");
  },
);

watch(
  [
    () => templatePanelPreferredPos.value.x,
    () => templatePanelPreferredPos.value.y,
    () => templatePanelPreferredWidth.value,
    () => templatePanelPreferredHeight.value,
  ],
  () => {
    persistTemplatePanelLayout();
  },
);

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

  if (!showElementsPanel.value) {
    restoredTemplatePanelLayout.value.x = false;
    restoredTemplatePanelLayout.value.y = false;
    templatePanelPreferredPos.value = { ...sidebarPanelPreferredPos.value };
  }

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
    "designer:panel-bring-to-front",
    handleBringPanelToFrontEvent as EventListener,
  );
  window.addEventListener(
    "designer:set-hand-pan-mode",
    handleSetHandPanModeEvent as EventListener,
  );
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

const getProjectionHorizontalLineStyle = (y: number) => {
  return {
    top: `${projectionViewportOffsetY.value + y * store.zoom}px`,
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
    "designer:panel-bring-to-front",
    handleBringPanelToFrontEvent as EventListener,
  );
  window.removeEventListener(
    "designer:set-hand-pan-mode",
    handleSetHandPanModeEvent as EventListener,
  );
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
        <div
          v-if="store.editingCustomElementId"
          class="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100"
        >
          <div class="text-sm font-medium">
            {{
              t("elementsPanel.editingElement", {
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
              {{ t("elementsPanel.saveEdit") }}
            </button>
            <button
              @click="showSaveAsModal = true"
              class="px-3 py-1.5 text-xs font-medium bg-blue-200 text-blue-900 rounded hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white inline-flex items-center gap-1.5"
            >
              <SaveAs class="w-4 h-4" />
              {{ t("elementsPanel.saveAs") }}
            </button>
            <button
              @click="handleExitCustomEdit"
              class="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-900 rounded hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 inline-flex items-center gap-1.5"
            >
              <Logout class="w-4 h-4" />
              {{ t("elementsPanel.exitEdit") }}
            </button>
          </div>
        </div>
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
                    }
                  }
                "
              >
                <div
                  ref="canvasWrapper"
                  :style="canvasWrapperStyle"
                  :class="['relative', isHandPanActive ? '' : 'mx-auto']"
                >
                  <Canvas ref="canvasContainer" class="absolute top-0 left-0" />
                </div>
              </div>

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
                    :style="{ top: `${projectionViewportOffsetY}px` }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'bottom'"
                    class="absolute left-0 right-0 border-t theme-border"
                    :style="{
                      top: `${projectionViewportOffsetY + store.canvasSize.height * store.zoom}px`,
                    }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'left'"
                    class="absolute top-0 bottom-0 border-l theme-border"
                    :style="{ left: `${projectionViewportOffsetX}px` }"
                  ></div>
                  <div
                    v-else-if="store.highlightedEdge === 'right'"
                    class="absolute top-0 bottom-0 border-l theme-border"
                    :style="{
                      left: `${projectionViewportOffsetX + store.canvasSize.width * store.zoom}px`,
                    }"
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
                      getProjectionHorizontalLineStyle(dragProjection.maxY)
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
                    :style="{
                      left: `${projectionViewportOffsetX + dragProjection.minX * store.zoom}px`,
                    }"
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
                    :style="{
                      left: `${projectionViewportOffsetX + dragProjection.maxX * store.zoom}px`,
                    }"
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

        <!-- Minimap -->
        <div
          v-if="store.showMinimap"
          ref="minimapPanelRef"
          data-floating-panel-surface="true"
          class="absolute pointer-events-none"
          :style="[minimapPanelStyle, { zIndex: getPanelZIndex('minimap') }]"
        >
          <div
            class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
            @mousedown="(e) => handleFloatingPanelMouseDown('minimap', e)"
          >
            <div
              class="flex shrink-0 items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-move select-none"
              data-floating-panel-drag-handle="true"
            >
              <h3
                class="text-sm font-semibold text-gray-700 dark:text-gray-200 m-0"
              >
                {{ t("editor.showMinimap") }}
              </h3>
              <button
                class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                @click="store.setShowMinimap(false)"
              >
                <Close class="w-4 h-4" />
              </button>
            </div>

            <div class="min-h-0 flex-1 bg-gray-100 dark:bg-gray-800">
              <MinimapPanel
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
                @update:scroll="handleMinimapScroll"
              />
            </div>
          </div>
          <button
            type="button"
            title="Resize panel"
            class="absolute bottom-0.5 right-0.5 z-[1100] h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
            @mousedown.stop.prevent="(e) => startPanelResize('minimap', e)"
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
      </main>

      <div
        v-show="showElementsPanel"
        data-floating-panel-surface="true"
        class="absolute pointer-events-none"
        :style="[sidebarPanelStyle, { zIndex: getPanelZIndex('sidebar') }]"
      >
        <div
          class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          @mousedown="(e) => handleFloatingPanelMouseDown('sidebar', e)"
        >
          <ElementsPanel />
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
        v-show="showTemplatePanel"
        data-floating-panel-surface="true"
        class="absolute pointer-events-none"
        :style="[templatePanelStyle, { zIndex: getPanelZIndex('templates') }]"
      >
        <div
          class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
          @mousedown="(e) => handleFloatingPanelMouseDown('templates', e)"
        >
          <div
            class="relative p-4 pr-20 min-h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-move select-none"
            data-floating-panel-drag-handle="true"
          >
            <div class="min-w-0">
              <h2
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {{ t("editor.templates") }}
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ t("template.select") }}
              </p>
            </div>
            <div class="absolute right-0 top-0 z-50 flex items-center gap-0">
              <button
                ref="templateHelpButtonRef"
                type="button"
                :class="[
                  'panel-help-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
                  showTemplateHelpTooltip
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                    : '',
                ]"
                :aria-label="t('template.help.title')"
                :aria-pressed="showTemplateHelpTooltip"
                @mousedown.stop.prevent="toggleTemplateHelpTooltip"
              >
                <Help class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="panel-close-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                @mousedown.stop
                @click.stop="closeTemplatePanel"
              >
                <Close class="w-4 h-4" />
              </button>
            </div>
          </div>
          <Teleport :to="modalContainer || 'body'">
            <div
              v-if="showTemplateHelpTooltip"
              ref="templateHelpTooltipRef"
              role="tooltip"
              class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
              :style="templateHelpTooltipStyle"
              @click.stop
            >
              <div
                v-if="templateHelpPlacement === 'bottom'"
                class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                :style="templateHelpArrowStyle"
              ></div>
              <div
                v-else
                class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                :style="templateHelpArrowStyle"
              ></div>
              <div
                class="overflow-y-auto p-3"
                :style="{ maxHeight: templateHelpTooltipStyle.maxHeight }"
              >
                <div class="flex items-start gap-2">
                  <Help
                    class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                  />
                  <div class="min-w-0">
                    <h3
                      class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {{ templatePanelHelp.title }}
                    </h3>
                    <ul
                      class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
                    >
                      <li v-for="item in templatePanelHelp.items" :key="item">
                        {{ item }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Teleport>
          <div class="min-h-0 flex-1">
            <TemplateListPanel />
          </div>
        </div>
        <button
          type="button"
          title="Resize panel"
          class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          @mousedown.stop.prevent="(e) => startPanelResize('templates', e)"
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
        v-show="showPropertiesPanel"
        data-floating-panel-surface="true"
        data-floating-panel-key="properties"
        class="absolute pointer-events-none"
        :style="[
          propertiesPanelStyle,
          { zIndex: getPanelZIndex('properties') },
        ]"
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

      <div
        v-show="showStructurePanel"
        data-floating-panel-surface="true"
        data-floating-panel-key="structure"
        class="absolute pointer-events-none"
        :style="[
          structurePanelStyle,
          { zIndex: getPanelZIndex('structure') },
        ]"
      >
        <div
          class="relative h-full w-full pointer-events-auto rounded-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
          @mousedown="(e) => handleFloatingPanelMouseDown('structure', e)"
        >
          <div
            class="relative p-4 pr-20 min-h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-move select-none"
            data-floating-panel-drag-handle="true"
          >
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ t("elementsPanel.layout") }}
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ t("elementsPanel.layoutSubtitle") }}
              </p>
            </div>
            <div class="absolute right-0 top-0 z-50 flex items-center gap-0">
              <button
                ref="structureHelpButtonRef"
                type="button"
                :class="[
                  'panel-help-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
                  showStructureHelpTooltip
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                    : '',
                ]"
                :aria-label="t('elementsPanel.layoutHelp.title')"
                :aria-pressed="showStructureHelpTooltip"
                @mousedown.stop.prevent="toggleStructureHelpTooltip"
              >
                <Help class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="panel-close-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                @mousedown.stop
                @click.stop="closeStructurePanel"
              >
                <Close class="w-4 h-4" />
              </button>
            </div>
          </div>
          <Teleport :to="modalContainer || 'body'">
            <div
              v-if="showStructureHelpTooltip"
              ref="structureHelpTooltipRef"
              role="tooltip"
              class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
              :style="structureHelpTooltipStyle"
              @click.stop
            >
              <div
                v-if="structureHelpPlacement === 'bottom'"
                class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                :style="structureHelpArrowStyle"
              ></div>
              <div
                v-else
                class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                :style="structureHelpArrowStyle"
              ></div>
              <div
                class="overflow-y-auto p-3"
                :style="{ maxHeight: structureHelpTooltipStyle.maxHeight }"
              >
                <div class="flex items-start gap-2">
                  <Help
                    class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
                  />
                  <div class="min-w-0">
                    <h3
                      class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {{ structurePanelHelp.title }}
                    </h3>
                    <ul
                      class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
                    >
                      <li v-for="item in structurePanelHelp.items" :key="item">
                        {{ item }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Teleport>
          <div class="min-h-0 flex-1">
            <ElementStructurePanel />
          </div>
        </div>
        <button
          type="button"
          title="Resize panel"
          class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          @mousedown.stop.prevent="(e) => startPanelResize('structure', e)"
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
      :title="t('elementsPanel.saveAsCustomElement')"
      :placeholder="t('elementsPanel.enterNamePlaceholder')"
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
    <HistoryPanel :base-z-index="historyPanelBaseZIndex" />
  </div>
</template>
