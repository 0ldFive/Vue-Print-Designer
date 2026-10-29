import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";

export type FloatingPanelKey =
  | "sidebar"
  | "templates"
  | "properties"
  | "structure"
  | "minimap"
  | "history"
  | "ai";

type FloatingPanelLayerKey = FloatingPanelKey;
type ResizablePanelKey = Exclude<FloatingPanelKey, "minimap">;
export type FloatingPanelEdge = "left" | "right" | "top" | "bottom";
type FloatingPanelDockEdgeMap = Record<FloatingPanelKey, FloatingPanelEdge | null>;
type FloatingPanelCollapsedMap = Record<FloatingPanelKey, boolean>;
type FloatingPanelHorizontalAnchor = "left" | "right" | "free";
type FloatingPanelVerticalAnchor = "top" | "bottom" | "free";
type FloatingPanelHeightMode = "fit" | "fixed";

const FLOAT_PANEL_MIN_WIDTH = 256;
const FLOAT_PANEL_MAX_WIDTH = 520;
const FLOAT_PANEL_MARGIN = 12;
const FLOAT_PANEL_MIN_HEIGHT = 280;
const FLOAT_PANEL_EDGE_SNAP_TOLERANCE = 16;
const FLOAT_PANEL_STATUS_BAR_SNAP = 16;
const FLOAT_PANEL_EDGE_OVERDRAG = 6;
const FLOAT_PANEL_EDGE_HIT_TOLERANCE = 3;
const TEMPLATE_PANEL_DEFAULT_WIDTH = 320;
const PROPERTIES_PANEL_DEFAULT_WIDTH = 296;
const STRUCTURE_PANEL_DEFAULT_WIDTH = 300;
const TEMPLATE_PANEL_LAYOUT_STORAGE_KEY =
  "print-designer-template-panel-layout";
const ELEMENTS_PANEL_VISIBILITY_STORAGE_KEY =
  "print-designer-elements-panel-visibility";
const STRUCTURE_PANEL_VISIBILITY_STORAGE_KEY =
  "print-designer-structure-panel-visibility";
const MINIMAP_PANEL_FALLBACK_WIDTH = 160;
const MINIMAP_PANEL_FALLBACK_HEIGHT = 252;
const MINIMAP_PANEL_MIN_WIDTH = 160;
const HISTORY_PANEL_DEFAULT_WIDTH = 280;
const AI_PANEL_DEFAULT_WIDTH = 340;
const AI_PANEL_VISIBILITY_STORAGE_KEY =
  "print-designer-ai-panel-visibility";
const MINIMAP_PANEL_MAX_WIDTH = 420;
const MINIMAP_PANEL_MIN_HEIGHT = 140;
const MINIMAP_PANEL_MAX_HEIGHT = 420;
const MINIMAP_PANEL_BORDER_SIZE = 2;
const MINIMAP_PANEL_HEADER_HEIGHT = 40;
const FLOAT_PANEL_Z_BASE = 6100;
const FLOAT_PANEL_Z_STEP = 20;
const FLOAT_PANEL_Z_ACTIVE_OFFSET = 10;
const FLOAT_PANEL_EDGE_AUTO_HIDE_PEEK = 6;
const FLOAT_PANEL_EDGE_AUTO_HIDE_DELAY = 350;
const FLOAT_PANEL_EDGE_TRANSITION = "left 0.24s ease, top 0.24s ease";
// 贴边后在窗口内侧投出轻度阴影，提示面板可从边缘拉出
const FLOAT_PANEL_EDGE_RADIUS = "0.5rem 0.5rem 0 0";
const FLOAT_PANEL_EDGE_SHADOWS: Record<FloatingPanelEdge, string> = {
  left: "6px 0 14px -4px rgba(15, 23, 42, 0.22)",
  right: "-6px 0 14px -4px rgba(15, 23, 42, 0.22)",
  top: "0 6px 14px -4px rgba(15, 23, 42, 0.22)",
  bottom: "0 -6px 14px -4px rgba(15, 23, 42, 0.22)",
};

type FloatingPanelBounds = {
  minX: number;
  minY: number;
  maxRight: number;
  maxBottom: number;
  maxHeight: number;
};

type FloatingPanelLayout = {
  pos: {
    x: number;
    y: number;
  };
  width: number;
  height: number;
};

type PersistedTemplatePanelLayout = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  heightMode: FloatingPanelHeightMode;
}>;

type FloatingPanelLayoutOptions = {
  horizontalAnchor: FloatingPanelHorizontalAnchor;
  verticalAnchor: FloatingPanelVerticalAnchor;
  heightMode: FloatingPanelHeightMode;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface FloatingPanelStoreLike {
  showMinimap: boolean;
  showHistoryPanel: boolean;
  panelEdgeAutoHide?: boolean;
}

interface UseFloatingPanelsOptions {
  store: FloatingPanelStoreLike;
  panelsHostRef: Ref<HTMLElement | null>;
  scrollContainer: Ref<HTMLElement | null>;
  designerInstanceId: string;
  showTemplateHelpTooltip: Ref<boolean>;
  showStructureHelpTooltip: Ref<boolean>;
}

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

const loadAiPanelVisibility = () => {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(AI_PANEL_VISIBILITY_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
};

const persistAiPanelVisibility = (visible: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AI_PANEL_VISIBILITY_STORAGE_KEY,
      String(visible),
    );
  } catch {
    // ignore storage failures
  }
};

const isPanelRectOverlapping = (a: PanelRect, b: PanelRect) => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

export const useFloatingPanels = ({
  store,
  panelsHostRef,
  scrollContainer,
  designerInstanceId,
  showTemplateHelpTooltip,
  showStructureHelpTooltip,
}: UseFloatingPanelsOptions) => {
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
  const historyPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
  const historyPanelPreferredPos = ref({
    x: FLOAT_PANEL_MARGIN,
    y: FLOAT_PANEL_MARGIN,
  });
  const historyPanelWidth = ref(HISTORY_PANEL_DEFAULT_WIDTH);
  const historyPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
  const historyPanelPreferredWidth = ref(HISTORY_PANEL_DEFAULT_WIDTH);
  const historyPanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
  const hasInitializedHistoryPanel = ref(false);
  const historyPanelAnchorX = ref<FloatingPanelHorizontalAnchor>("free");
  const historyPanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
  const historyPanelHeightMode = ref<FloatingPanelHeightMode>("fit");
  const aiPanelPos = ref({ x: FLOAT_PANEL_MARGIN, y: FLOAT_PANEL_MARGIN });
  const aiPanelPreferredPos = ref({
    x: FLOAT_PANEL_MARGIN,
    y: FLOAT_PANEL_MARGIN,
  });
  const aiPanelWidth = ref(AI_PANEL_DEFAULT_WIDTH);
  const aiPanelHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
  const aiPanelPreferredWidth = ref(AI_PANEL_DEFAULT_WIDTH);
  const aiPanelPreferredHeight = ref(FLOAT_PANEL_MIN_HEIGHT);
  const showAiPanel = ref(loadAiPanelVisibility());
  const hasInitializedAiPanel = ref(false);
  const aiPanelAnchorX = ref<FloatingPanelHorizontalAnchor>("free");
  const aiPanelAnchorY = ref<FloatingPanelVerticalAnchor>("top");
  const aiPanelHeightMode = ref<FloatingPanelHeightMode>("fit");
  const restoredTemplatePanelLayout = ref({
    x: false,
    y: false,
    width: false,
    height: false,
  });
  const panelDockEdges = ref<FloatingPanelDockEdgeMap>({
    sidebar: null,
    templates: null,
    properties: null,
    structure: null,
    minimap: null,
    history: null,
    ai: null,
  });
  const collapsedPanels = ref<FloatingPanelCollapsedMap>({
    sidebar: false,
    templates: false,
    properties: false,
    structure: false,
    minimap: false,
    history: false,
    ai: false,
  });
  const interactionPanel = ref<FloatingPanelKey | null>(null);
  const edgeAutoHideEnabled = computed(() => store.panelEdgeAutoHide === true);
  const panelAutoHideTimers = new Map<FloatingPanelKey, number>();

  let draggingPanel: FloatingPanelKey | null = null;
  let dragStartPointer = { x: 0, y: 0 };
  let dragStartPanelPos = { x: 0, y: 0 };
  let lastPointerPosition: { x: number; y: number } | null = null;
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
    "ai",
  ]);

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

  const getFloatingPanelWindowBounds = (): FloatingPanelBounds => {
    const { width, height } = panelsHostSize.value;
    const fallback: FloatingPanelBounds = {
      minX: 0,
      minY: 0,
      maxRight: Math.max(0, width),
      maxBottom: Math.max(0, height),
      maxHeight: Math.max(FLOAT_PANEL_MIN_HEIGHT, height),
    };

    if (!panelsHostRef.value || typeof window === "undefined") {
      return fallback;
    }

    const hostRect = panelsHostRef.value.getBoundingClientRect();
    const minX = -hostRect.left;
    const minY = -hostRect.top;
    const maxRight = window.innerWidth - hostRect.left;
    const maxBottom = window.innerHeight - hostRect.top;

    return {
      minX,
      minY,
      maxRight,
      maxBottom,
      maxHeight: Math.max(FLOAT_PANEL_MIN_HEIGHT, maxBottom - minY),
    };
  };

  const getActivePanelBounds = (): FloatingPanelBounds =>
    edgeAutoHideEnabled.value
      ? getFloatingPanelWindowBounds()
      : getFloatingPanelBounds();

  // 底部状态栏上沿在 panelsHost 坐标系中的位置，状态栏未渲染时返回 null
  const getStatusBarTop = () => {
    if (typeof document === "undefined" || !panelsHostRef.value) return null;
    const statusBar = panelsHostRef.value.querySelector("footer");
    if (!statusBar) return null;
    const hostRect = panelsHostRef.value.getBoundingClientRect();
    return statusBar.getBoundingClientRect().top - hostRect.top;
  };

  // resize 放大时底边接近状态栏上沿就吸附贴合，避免面板遮住状态栏
  const snapPanelHeightToStatusBar = (
    panelY: number,
    panelHeight: number,
    minHeight: number,
    maxHeight: number,
  ) => {
    const statusBarTop = getStatusBarTop();
    if (statusBarTop === null) return panelHeight;

    const bottomDistance = Math.abs(panelY + panelHeight - statusBarTop);
    if (bottomDistance > FLOAT_PANEL_STATUS_BAR_SNAP) return panelHeight;

    const snappedHeight = statusBarTop - panelY;
    if (snappedHeight < minHeight || snappedHeight > maxHeight) {
      return panelHeight;
    }
    return snappedHeight;
  };

  const clampPanelPos = (
    x: number,
    y: number,
    panelWidth: number,
    panelHeight: number,
  ) => {
    const { minX, minY, maxRight, maxBottom } = getActivePanelBounds();
    const maxX = Math.max(minX, maxRight - panelWidth);
    const maxY = Math.max(minY, maxBottom - panelHeight);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  // 拖动时允许越过窗口边缘最多 FLOAT_PANEL_EDGE_OVERDRAG，松手后按越界量判定是否贴边收起
  const clampPanelPosForDrag = (
    x: number,
    y: number,
    panelWidth: number,
    panelHeight: number,
  ) => {
    if (!edgeAutoHideEnabled.value) {
      return {
        pos: clampPanelPos(x, y, panelWidth, panelHeight),
        pinned: false,
      };
    }

    const { minX, minY, maxRight, maxBottom } = getActivePanelBounds();
    const maxX = Math.max(minX, maxRight - panelWidth);
    const maxY = Math.max(minY, maxBottom - panelHeight);
    const over = FLOAT_PANEL_EDGE_OVERDRAG;

    const nextX = Math.min(Math.max(x, minX - over), maxX + over);
    const nextY = Math.min(Math.max(y, minY - over), maxY + over);

    // 面板贴住或越出窗口边缘时跳过画布吸附，避免被吸回边界内
    const pinned =
      nextX <= minX || nextX >= maxX || nextY <= minY || nextY >= maxY;

    return { pos: { x: nextX, y: nextY }, pinned };
  };

  const clampPanelWidth = (panelWidth: number, panelX: number) => {
    const { minX, maxRight } = getActivePanelBounds();
    const maxWidthByBounds = Math.max(
      FLOAT_PANEL_MIN_WIDTH,
      maxRight - Math.max(panelX, minX),
    );
    const maxWidth = Math.min(FLOAT_PANEL_MAX_WIDTH, maxWidthByBounds);
    return Math.min(Math.max(panelWidth, FLOAT_PANEL_MIN_WIDTH), maxWidth);
  };

  const clampPanelHeight = (panelHeight: number, panelY: number) => {
    const { minY, maxBottom, maxHeight } = getActivePanelBounds();
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
    const { minX, maxRight } = getActivePanelBounds();
    const maxWidthByBounds = Math.max(
      MINIMAP_PANEL_MIN_WIDTH,
      maxRight - Math.max(panelX, minX),
    );
    const maxWidth = Math.min(MINIMAP_PANEL_MAX_WIDTH, maxWidthByBounds);
    return Math.min(Math.max(panelWidth, MINIMAP_PANEL_MIN_WIDTH), maxWidth);
  };

  const clampMinimapPanelHeight = (panelHeight: number, panelY: number) => {
    const { minY, maxBottom } = getActivePanelBounds();
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

      const parsed = JSON.parse(raw) as PersistedTemplatePanelLayout;
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
      if (parsed.heightMode === "fixed" && isFiniteNumber(parsed.height)) {
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
          heightMode: templatePanelHeightMode.value,
        }),
      );
    } catch (error) {
      console.warn("Failed to persist template panel layout", error);
    }
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

    if (panel === "history") {
      return {
        x: historyPanelAnchorX.value,
        y: historyPanelAnchorY.value,
      };
    }

    if (panel === "ai") {
      return {
        x: aiPanelAnchorX.value,
        y: aiPanelAnchorY.value,
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

    if (panel === "history") {
      historyPanelAnchorX.value = anchors.x;
      historyPanelAnchorY.value = anchors.y;
      return;
    }

    if (panel === "ai") {
      aiPanelAnchorX.value = anchors.x;
      aiPanelAnchorY.value = anchors.y;
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

    if (panel === "history") {
      historyPanelHeightMode.value = heightMode;
      return;
    }

    if (panel === "ai") {
      aiPanelHeightMode.value = heightMode;
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

    // 底边随高度变化时（非底边锚定），接近底部状态栏上沿就吸附贴合
    if (anchors.y !== "bottom") {
      const bounds = getActivePanelBounds();
      const maxHeight = Math.min(
        bounds.maxHeight,
        Math.max(FLOAT_PANEL_MIN_HEIGHT, bounds.maxBottom - pos.y),
      );
      height = snapPanelHeightToStatusBar(
        pos.y,
        height,
        FLOAT_PANEL_MIN_HEIGHT,
        maxHeight,
      );
    }

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
    // 小地图最高 420px，够不到底部状态栏，无需吸附
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

  const getPanelFrame = (panel: FloatingPanelKey) => {
    if (panel === "sidebar") {
      return {
        pos: sidebarPanelPos.value,
        width: sidebarPanelWidth.value,
        height: sidebarPanelHeight.value,
      };
    }

    if (panel === "templates") {
      return {
        pos: templatePanelPos.value,
        width: templatePanelWidth.value,
        height: templatePanelHeight.value,
      };
    }

    if (panel === "properties") {
      return {
        pos: propertiesPanelPos.value,
        width: propertiesPanelWidth.value,
        height: propertiesPanelHeight.value,
      };
    }

    if (panel === "structure") {
      return {
        pos: structurePanelPos.value,
        width: structurePanelWidth.value,
        height: structurePanelHeight.value,
      };
    }

    if (panel === "history") {
      return {
        pos: historyPanelPos.value,
        width: historyPanelWidth.value,
        height: historyPanelHeight.value,
      };
    }

    if (panel === "ai") {
      return {
        pos: aiPanelPos.value,
        width: aiPanelWidth.value,
        height: aiPanelHeight.value,
      };
    }

    return {
      pos: minimapPanelPos.value,
      width: minimapPanelWidth.value,
      height: minimapPanelHeight.value,
    };
  };

  const setPanelPosition = (
    panel: FloatingPanelKey,
    pos: { x: number; y: number },
  ) => {
    if (panel === "sidebar") {
      sidebarPanelPos.value = { ...pos };
      sidebarPanelPreferredPos.value = { ...pos };
      return;
    }

    if (panel === "templates") {
      templatePanelPos.value = { ...pos };
      templatePanelPreferredPos.value = { ...pos };
      return;
    }

    if (panel === "properties") {
      propertiesPanelPos.value = { ...pos };
      propertiesPanelPreferredPos.value = { ...pos };
      return;
    }

    if (panel === "structure") {
      structurePanelPos.value = { ...pos };
      structurePanelPreferredPos.value = { ...pos };
      return;
    }

    if (panel === "history") {
      historyPanelPos.value = { ...pos };
      historyPanelPreferredPos.value = { ...pos };
      return;
    }

    if (panel === "ai") {
      aiPanelPos.value = { ...pos };
      aiPanelPreferredPos.value = { ...pos };
      return;
    }

    minimapPanelPos.value = { ...pos };
    minimapPanelPreferredPos.value = { ...pos };
  };

  const clearPanelAutoHideTimer = (panel: FloatingPanelKey) => {
    const timer = panelAutoHideTimers.get(panel);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    panelAutoHideTimers.delete(panel);
  };

  const clearAllPanelAutoHideTimers = () => {
    panelAutoHideTimers.forEach((timer) => window.clearTimeout(timer));
    panelAutoHideTimers.clear();
  };

  const resetPanelDockState = () => {
    (Object.keys(panelDockEdges.value) as FloatingPanelKey[]).forEach(
      (panel) => {
        panelDockEdges.value[panel] = null;
        collapsedPanels.value[panel] = false;
      },
    );
    interactionPanel.value = null;
  };

  const getDockedPanelPos = (
    panel: FloatingPanelKey,
    edge: FloatingPanelEdge,
  ) => {
    const bounds = getFloatingPanelWindowBounds();
    const frame = getPanelFrame(panel);
    const over = FLOAT_PANEL_EDGE_OVERDRAG;
    const nextPos = { ...frame.pos };

    if (edge === "left") {
      nextPos.x = bounds.minX - over;
    } else if (edge === "right") {
      nextPos.x = bounds.maxRight - frame.width + over;
    } else if (edge === "top") {
      nextPos.y = bounds.minY - over;
    } else {
      nextPos.y = bounds.maxBottom - frame.height + over;
    }

    return nextPos;
  };

  const getPanelEdgeOverdrags = (panel: FloatingPanelKey) => {
    const bounds = getFloatingPanelWindowBounds();
    const frame = getPanelFrame(panel);
    return {
      left: bounds.minX - frame.pos.x,
      right: frame.pos.x + frame.width - bounds.maxRight,
      top: bounds.minY - frame.pos.y,
      bottom: frame.pos.y + frame.height - bounds.maxBottom,
    };
  };

  const detectWindowDockEdge = (
    panel: FloatingPanelKey,
  ): FloatingPanelEdge | null => {
    const over = getPanelEdgeOverdrags(panel);
    // 面板被拖出窗口边缘满 6px 才收起，未达门槛只吸附停留
    const threshold = FLOAT_PANEL_EDGE_OVERDRAG - 0.5;

    const candidates = [
      { edge: "left" as FloatingPanelEdge, ok: over.left >= threshold, weight: over.left },
      { edge: "right" as FloatingPanelEdge, ok: over.right >= threshold, weight: over.right },
      { edge: "top" as FloatingPanelEdge, ok: over.top >= threshold, weight: over.top },
      {
        edge: "bottom" as FloatingPanelEdge,
        ok: over.bottom >= threshold,
        weight: over.bottom,
      },
    ]
      .filter((candidate) => candidate.ok)
      .sort((a, b) => b.weight - a.weight);

    return candidates.length > 0 ? candidates[0].edge : null;
  };

  const dockPanelToEdge = (
    panel: FloatingPanelKey,
    edge: FloatingPanelEdge,
  ) => {
    clearPanelAutoHideTimer(panel);
    setPanelPosition(panel, getDockedPanelPos(panel, edge));
    panelDockEdges.value[panel] = edge;
    collapsedPanels.value[panel] = false;
  };

  const undockPanel = (panel: FloatingPanelKey) => {
    if (!panelDockEdges.value[panel]) return;
    clearPanelAutoHideTimer(panel);
    panelDockEdges.value[panel] = null;
    collapsedPanels.value[panel] = false;
  };

  const syncDockedPanelPositions = () => {
    if (!edgeAutoHideEnabled.value) return;

    (Object.keys(panelDockEdges.value) as FloatingPanelKey[]).forEach(
      (panel) => {
        const edge = panelDockEdges.value[panel];
        if (!edge) return;
        setPanelPosition(panel, getDockedPanelPos(panel, edge));
      },
    );
  };

  const snapPanelPosToCanvasEdges = (
    x: number,
    y: number,
    panelWidth: number,
    panelHeight: number,
  ) => {
    if (!edgeAutoHideEnabled.value) return { x, y };

    const bounds = getFloatingPanelBounds();
    let nextX = x;
    let nextY = y;

    const leftDistance = Math.abs(x - bounds.minX);
    const rightDistance = Math.abs(x + panelWidth - bounds.maxRight);
    if (leftDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE) {
      nextX = bounds.minX;
    } else if (rightDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE) {
      nextX = bounds.maxRight - panelWidth;
    }

    const topDistance = Math.abs(y - bounds.minY);
    const bottomDistance = Math.abs(y + panelHeight - bounds.maxBottom);
    if (topDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE) {
      nextY = bounds.minY;
    } else if (bottomDistance <= FLOAT_PANEL_EDGE_SNAP_TOLERANCE) {
      nextY = bounds.maxBottom - panelHeight;
    }

    return { x: nextX, y: nextY };
  };

  // 收起偏移按窗口边缘计算，保证隐藏后只在窗口内露出 peek 像素的细条
  const getPanelDockOffset = (
    panel: FloatingPanelKey,
    pos: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
  ) => {
    if (!edgeAutoHideEnabled.value) return { x: 0, y: 0 };

    const edge = panelDockEdges.value[panel];
    if (!edge || !collapsedPanels.value[panel]) return { x: 0, y: 0 };

    const bounds = getFloatingPanelWindowBounds();
    const peek = FLOAT_PANEL_EDGE_AUTO_HIDE_PEEK;

    if (edge === "left") {
      return { x: bounds.minX + peek - (pos.x + panelWidth), y: 0 };
    }
    if (edge === "right") {
      return { x: bounds.maxRight - peek - pos.x, y: 0 };
    }
    if (edge === "top") {
      return { x: 0, y: bounds.minY + peek - (pos.y + panelHeight) };
    }
    return { x: 0, y: bounds.maxBottom - peek - pos.y };
  };

  const buildPanelStyle = (
    panel: FloatingPanelKey,
    pos: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
  ) => {
    const offset = getPanelDockOffset(panel, pos, panelWidth, panelHeight);
    const dockEdge = panelDockEdges.value[panel];
    // 只有收起的细条状态才带阴影，展开后不显示阴影
    const dockShadow =
      dockEdge && collapsedPanels.value[panel]
        ? FLOAT_PANEL_EDGE_SHADOWS[dockEdge]
        : undefined;
    return {
      left: `${pos.x + offset.x}px`,
      top: `${pos.y + offset.y}px`,
      width: `${panelWidth}px`,
      height: `${panelHeight}px`,
      // 根元素与内容层保持相同圆角，避免阴影沿直角绘制、在圆角处露出白色三角
      borderRadius: dockShadow ? FLOAT_PANEL_EDGE_RADIUS : undefined,
      boxShadow: dockShadow,
      transition:
        dockEdge && interactionPanel.value !== panel
          ? FLOAT_PANEL_EDGE_TRANSITION
          : "none",
    };
  };

  const handleFloatingPanelMouseEnter = (panel: FloatingPanelKey) => {
    clearPanelAutoHideTimer(panel);
    if (!edgeAutoHideEnabled.value) return;
    if (!panelDockEdges.value[panel]) return;
    if (collapsedPanels.value[panel]) {
      collapsedPanels.value[panel] = false;
    }
  };

  const getPanelSurfaceRect = (panel: FloatingPanelKey) => {
    const surface = panelsHostRef.value?.querySelector<HTMLElement>(
      `[data-floating-panel-key="${panel}"]`,
    );
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  };

  const isPointerInsidePanelRect = (
    rect: { left: number; right: number; top: number; bottom: number },
    pointer: { x: number; y: number },
  ) => {
    const tolerance = FLOAT_PANEL_EDGE_HIT_TOLERANCE;
    return (
      pointer.x >= rect.left - tolerance &&
      pointer.x <= rect.right + tolerance &&
      pointer.y >= rect.top - tolerance &&
      pointer.y <= rect.bottom + tolerance
    );
  };

  const schedulePanelAutoHide = (panel: FloatingPanelKey) => {
    if (panelAutoHideTimers.has(panel)) return;

    const timer = window.setTimeout(() => {
      panelAutoHideTimers.delete(panel);
      if (!edgeAutoHideEnabled.value) return;
      if (!panelDockEdges.value[panel]) return;
      if (draggingPanel || resizingPanel || interactionPanel.value) return;

      const rect = getPanelSurfaceRect(panel);
      if (
        rect &&
        lastPointerPosition &&
        isPointerInsidePanelRect(rect, lastPointerPosition)
      ) {
        return;
      }

      collapsedPanels.value[panel] = true;
    }, FLOAT_PANEL_EDGE_AUTO_HIDE_DELAY);

    panelAutoHideTimers.set(panel, timer);
  };

  const syncPanelAutoHideByPointer = (pointer: { x: number; y: number }) => {
    lastPointerPosition = pointer;
    if (!edgeAutoHideEnabled.value) return;
    if (draggingPanel || resizingPanel || interactionPanel.value) return;

    (Object.keys(panelDockEdges.value) as FloatingPanelKey[]).forEach(
      (panel) => {
        if (!panelDockEdges.value[panel]) return;

        const rect = getPanelSurfaceRect(panel);
        if (!rect) return;

        if (isPointerInsidePanelRect(rect, pointer)) {
          clearPanelAutoHideTimer(panel);
          if (collapsedPanels.value[panel]) {
            collapsedPanels.value[panel] = false;
          }
          return;
        }

        if (collapsedPanels.value[panel]) return;
        schedulePanelAutoHide(panel);
      },
    );
  };

  const handleGlobalPointerMove = (e: MouseEvent) => {
    // 拖到窗口外松手时 mouseup 可能丢失，这里按左键状态兜底结束拖动
    if (draggingPanel && e.buttons === 0) {
      stopPanelDrag();
    }
    syncPanelAutoHideByPointer({ x: e.clientX, y: e.clientY });
  };

  onMounted(() => {
    window.addEventListener("mousemove", handleGlobalPointerMove, {
      passive: true,
    });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("mousemove", handleGlobalPointerMove);
    clearAllPanelAutoHideTimers();
  });

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

  const initOrClampFloatingPanelsCore = () => {
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

    if (!hasInitializedAiPanel.value) {
      aiPanelAnchorX.value = "free";
      aiPanelAnchorY.value = "top";
      aiPanelHeightMode.value = "fit";
      aiPanelPreferredHeight.value = bounds.maxHeight;
      aiPanelPreferredWidth.value = AI_PANEL_DEFAULT_WIDTH;
      aiPanelPreferredPos.value = {
        x: Math.max(
          bounds.minX,
          bounds.maxRight -
            propertiesPanelWidth.value -
            structurePanelWidth.value -
            AI_PANEL_DEFAULT_WIDTH -
            FLOAT_PANEL_MARGIN * 2,
        ),
        y: bounds.minY,
      };
      hasInitializedAiPanel.value = true;
    }

    aiPanelPreferredWidth.value = clampPreferredPanelWidth(
      aiPanelPreferredWidth.value,
    );
    aiPanelPreferredHeight.value = clampPreferredPanelHeight(
      aiPanelPreferredHeight.value,
    );

    const aiLayout = resolvePanelLayout(
      aiPanelPreferredPos.value,
      aiPanelPreferredWidth.value,
      aiPanelPreferredHeight.value,
      {
        horizontalAnchor: aiPanelAnchorX.value,
        verticalAnchor: aiPanelAnchorY.value,
        heightMode: aiPanelHeightMode.value,
      },
    );
    aiPanelPos.value = aiLayout.pos;
    aiPanelWidth.value = aiLayout.width;
    aiPanelHeight.value = aiLayout.height;

    if (!store.showMinimap) {
      if (store.showHistoryPanel) {
        if (!hasInitializedHistoryPanel.value) {
          historyPanelAnchorX.value = "free";
          historyPanelAnchorY.value = "top";
          historyPanelHeightMode.value = "fit";
          historyPanelPreferredHeight.value = bounds.maxHeight;
          historyPanelPreferredPos.value = {
            x: Math.max(
              bounds.minX,
              bounds.maxRight -
                propertiesPanelWidth.value -
                HISTORY_PANEL_DEFAULT_WIDTH -
                FLOAT_PANEL_MARGIN * 2,
            ),
            y: bounds.minY,
          };
          historyPanelPreferredWidth.value = HISTORY_PANEL_DEFAULT_WIDTH;
          hasInitializedHistoryPanel.value = true;
        }
        historyPanelPreferredWidth.value = clampPreferredPanelWidth(
          historyPanelPreferredWidth.value,
        );
        historyPanelPreferredHeight.value = clampPreferredPanelHeight(
          historyPanelPreferredHeight.value,
        );
        const historyLayout = resolvePanelLayout(
          historyPanelPreferredPos.value,
          historyPanelPreferredWidth.value,
          historyPanelPreferredHeight.value,
          {
            horizontalAnchor: historyPanelAnchorX.value,
            verticalAnchor: historyPanelAnchorY.value,
            heightMode: historyPanelHeightMode.value,
          },
        );
        historyPanelPos.value = historyLayout.pos;
        historyPanelWidth.value = historyLayout.width;
        historyPanelHeight.value = historyLayout.height;
      }
      return;
    }

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

    if (store.showHistoryPanel) {
      if (!hasInitializedHistoryPanel.value) {
        historyPanelAnchorX.value = "free";
        historyPanelAnchorY.value = "top";
        historyPanelHeightMode.value = "fit";
        historyPanelPreferredHeight.value = bounds.maxHeight;
        historyPanelPreferredPos.value = {
          x: Math.max(
            bounds.minX,
            bounds.maxRight -
              propertiesPanelWidth.value -
              HISTORY_PANEL_DEFAULT_WIDTH -
              FLOAT_PANEL_MARGIN * 2,
          ),
          y: bounds.minY,
        };
        historyPanelPreferredWidth.value = HISTORY_PANEL_DEFAULT_WIDTH;
        hasInitializedHistoryPanel.value = true;
      }
      historyPanelPreferredWidth.value = clampPreferredPanelWidth(
        historyPanelPreferredWidth.value,
      );
      historyPanelPreferredHeight.value = clampPreferredPanelHeight(
        historyPanelPreferredHeight.value,
      );
      const historyLayout = resolvePanelLayout(
        historyPanelPreferredPos.value,
        historyPanelPreferredWidth.value,
        historyPanelPreferredHeight.value,
        {
          horizontalAnchor: historyPanelAnchorX.value,
          verticalAnchor: historyPanelAnchorY.value,
          heightMode: historyPanelHeightMode.value,
        },
      );
      historyPanelPos.value = historyLayout.pos;
      historyPanelWidth.value = historyLayout.width;
      historyPanelHeight.value = historyLayout.height;
    }
  };

  const initOrClampFloatingPanels = () => {
    // 已贴边面板的坐标由窗口 bounds 决定，不能被画布 bounds 的 clamp 覆盖
    const dockedPositions = (
      Object.keys(panelDockEdges.value) as FloatingPanelKey[]
    )
      .filter((panel) => !!panelDockEdges.value[panel])
      .map((panel) => ({ panel, pos: { ...getPanelFrame(panel).pos } }));

    initOrClampFloatingPanelsCore();

    dockedPositions.forEach(({ panel, pos }) => {
      setPanelPosition(panel, pos);
    });
    syncDockedPanelPositions();
  };

  const sidebarPanelStyle = computed(() =>
    buildPanelStyle(
      "sidebar",
      sidebarPanelPos.value,
      sidebarPanelWidth.value,
      sidebarPanelHeight.value,
    ),
  );

  const templatePanelStyle = computed(() =>
    buildPanelStyle(
      "templates",
      templatePanelPos.value,
      templatePanelWidth.value,
      templatePanelHeight.value,
    ),
  );

  const propertiesPanelStyle = computed(() =>
    buildPanelStyle(
      "properties",
      propertiesPanelPos.value,
      propertiesPanelWidth.value,
      propertiesPanelHeight.value,
    ),
  );

  const structurePanelStyle = computed(() =>
    buildPanelStyle(
      "structure",
      structurePanelPos.value,
      structurePanelWidth.value,
      structurePanelHeight.value,
    ),
  );

  const aiPanelStyle = computed(() =>
    buildPanelStyle(
      "ai",
      aiPanelPos.value,
      aiPanelWidth.value,
      aiPanelHeight.value,
    ),
  );

  const historyPanelStyle = computed(() =>
    buildPanelStyle(
      "history",
      historyPanelPos.value,
      historyPanelWidth.value,
      historyPanelHeight.value,
    ),
  );

  const minimapPanelStyle = computed(() =>
    buildPanelStyle(
      "minimap",
      minimapPanelPos.value,
      minimapPanelWidth.value,
      minimapPanelHeight.value,
    ),
  );

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
      value === "history" ||
      value === "ai"
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

  const handleBringPanelToFrontEvent = (e: Event) => {
    if (!isEventForCurrentDesigner(e)) return;
    const panel = (e as CustomEvent)?.detail?.panel;
    if (!isFloatingPanelLayerKey(panel)) return;
    bringPanelToFront(panel);
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
              : draggingPanel === "history"
              ? historyPanelWidth.value
              : draggingPanel === "ai"
                ? aiPanelWidth.value
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
              : draggingPanel === "history"
                ? historyPanelHeight.value
                : draggingPanel === "ai"
                  ? aiPanelHeight.value
                  : getMinimapPanelSize().height;
    const dragResult = clampPanelPosForDrag(
      dragStartPanelPos.x + deltaX,
      dragStartPanelPos.y + deltaY,
      panelWidth,
      panelHeight,
    );
    // 面板已贴住或越出窗口边缘时不做画布吸附，否则会被吸回边界内
    const nextPos = dragResult.pinned
      ? dragResult.pos
      : snapPanelPosToCanvasEdges(
          dragResult.pos.x,
          dragResult.pos.y,
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

    if (draggingPanel === "history") {
      historyPanelPos.value = nextPos;
      historyPanelPreferredPos.value = { ...nextPos };
      setPanelAnchors(
        "history",
        detectPanelAnchors(
          "history",
          nextPos,
          historyPanelWidth.value,
          historyPanelHeight.value,
        ),
      );
      return;
    }

    if (draggingPanel === "ai") {
      aiPanelPos.value = nextPos;
      aiPanelPreferredPos.value = { ...nextPos };
      setPanelAnchors(
        "ai",
        detectPanelAnchors(
          "ai",
          nextPos,
          aiPanelWidth.value,
          aiPanelHeight.value,
        ),
      );
      return;
    }

    minimapPanelPos.value = nextPos;
    minimapPanelPreferredPos.value = { ...nextPos };
  };

  const stopPanelDrag = () => {
    const panel = draggingPanel;
    draggingPanel = null;
    interactionPanel.value = null;
    window.removeEventListener("mousemove", handlePanelDragMove);
    window.removeEventListener("mouseup", stopPanelDrag);

    if (!panel || !edgeAutoHideEnabled.value) return;

    // 越出窗口满 6px 才贴边收起；未达门槛则吸回窗口内并保持展开
    const edge = detectWindowDockEdge(panel);
    if (!edge) {
      const frame = getPanelFrame(panel);
      const clampedPos = clampPanelPos(
        frame.pos.x,
        frame.pos.y,
        frame.width,
        frame.height,
      );
      if (clampedPos.x !== frame.pos.x || clampedPos.y !== frame.pos.y) {
        setPanelPosition(panel, clampedPos);
      }
      return;
    }

    dockPanelToEdge(panel, edge);
    collapsedPanels.value[panel] = true;
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
      return;
    }

    if (resizingPanel === "ai") {
      const resizedLayout = resolvePanelResizeLayout(
        resizeStartPanelPos,
        resizeStartWidth,
        resizeStartHeight,
        deltaX,
        deltaY,
        resizeStartPanelAnchors,
      );

      aiPanelWidth.value = resizedLayout.width;
      aiPanelHeight.value = resizedLayout.height;
      aiPanelPos.value = resizedLayout.pos;
      aiPanelPreferredWidth.value = resizedLayout.width;
      aiPanelPreferredHeight.value = resizedLayout.height;
      aiPanelPreferredPos.value = { ...resizedLayout.pos };
      setPanelHeightMode("ai", "fixed");
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
      return;
    }

    if (resizingPanel === "history") {
      const resizedLayout = resolvePanelResizeLayout(
        resizeStartPanelPos,
        resizeStartWidth,
        resizeStartHeight,
        deltaX,
        deltaY,
        resizeStartPanelAnchors,
      );

      historyPanelWidth.value = resizedLayout.width;
      historyPanelHeight.value = resizedLayout.height;
      historyPanelPos.value = resizedLayout.pos;
      historyPanelPreferredWidth.value = resizedLayout.width;
      historyPanelPreferredHeight.value = resizedLayout.height;
      historyPanelPreferredPos.value = { ...resizedLayout.pos };
      setPanelHeightMode("history", "fixed");
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
  };

  const stopPanelResize = () => {
    const panel = resizingPanel;
    resizingPanel = null;
    interactionPanel.value = null;
    window.removeEventListener("mousemove", handlePanelResizeMove);
    window.removeEventListener("mouseup", stopPanelResize);
    // 松手后才刷新锚点，避免放大到底部吸附时锚点中途变成 bottom 把面板锁死在状态栏上沿
    if (panel && panel !== "minimap") {
      const frame = getPanelFrame(panel);
      const anchors = detectPanelAnchors(
        panel,
        frame.pos,
        frame.width,
        frame.height,
      );
      const statusBarTop = getStatusBarTop();
      // 吸附在状态栏上沿时保持 free 锚点，下次仍可继续向下放大越过状态栏
      if (
        statusBarTop !== null &&
        Math.abs(frame.pos.y + frame.height - statusBarTop) < 1
      ) {
        anchors.y = "free";
      }
      setPanelAnchors(panel, anchors);
    }
    syncDockedPanelPositions();
  };

  const startPanelResize = (panel: FloatingPanelKey, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    stopPanelDrag();
    bringPanelToFront(panel);
    clearPanelAutoHideTimer(panel);
    interactionPanel.value = panel;
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
              : panel === "history"
                ? historyPanelWidth.value
                : panel === "ai"
                  ? aiPanelWidth.value
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
              : panel === "history"
                ? historyPanelHeight.value
                : panel === "ai"
                  ? aiPanelHeight.value
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
              : panel === "history"
                ? { ...historyPanelPos.value }
                : panel === "ai"
                  ? { ...aiPanelPos.value }
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
    undockPanel(panel);
    interactionPanel.value = panel;
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
              : panel === "history"
              ? { ...historyPanelPos.value }
              : panel === "ai"
                ? { ...aiPanelPos.value }
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

  const emitAiPanelVisibility = () => {
    emitPanelVisibility("designer:ai-panel-visibility", showAiPanel.value);
  };

  const closeAiPanel = () => {
    if (!showAiPanel.value) return;
    showAiPanel.value = false;
    persistAiPanelVisibility(false);
    emitAiPanelVisibility();
    nextTick(() => {
      initOrClampFloatingPanels();
    });
  };

  const handleToggleAiPanelEvent = (e: Event) => {
    if (!isEventForCurrentDesigner(e)) return;
    const wasVisible = showAiPanel.value;
    showAiPanel.value = !showAiPanel.value;
    persistAiPanelVisibility(showAiPanel.value);
    emitAiPanelVisibility();
    nextTick(() => {
      initOrClampFloatingPanels();
      if (!wasVisible && showAiPanel.value) {
        bringPanelToFront("ai");
        initOrClampFloatingPanels();
      }
    });
  };

  const handleCloseAiPanelEvent = (e: Event) => {
    if (!isEventForCurrentDesigner(e)) return;
    closeAiPanel();
  };

  const resetTemplateLayoutWhenElementsPanelHidden = () => {
    if (!showElementsPanel.value) {
      restoredTemplatePanelLayout.value.x = false;
      restoredTemplatePanelLayout.value.y = false;
      templatePanelPreferredPos.value = { ...sidebarPanelPreferredPos.value };
    }
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
      if (!show) {
        hasInitializedHistoryPanel.value = false;
        return;
      }
      bringPanelToFront("history");
      nextTick(() => initOrClampFloatingPanels());
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

  watch(
    () => edgeAutoHideEnabled.value,
    (enabled) => {
      clearAllPanelAutoHideTimers();
      resetPanelDockState();
      if (!enabled) {
        nextTick(() => initOrClampFloatingPanels());
      }
    },
  );

  return {
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
    handleFloatingPanelMouseEnter,
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
  };
};
