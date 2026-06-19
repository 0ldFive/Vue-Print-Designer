import { computed, nextTick, ref, watch, type Ref } from "vue";

export type FloatingPanelKey =
  | "sidebar"
  | "templates"
  | "properties"
  | "structure"
  | "minimap"
  | "history";

type FloatingPanelLayerKey = FloatingPanelKey;
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
const MINIMAP_PANEL_FALLBACK_WIDTH = 160;
const MINIMAP_PANEL_FALLBACK_HEIGHT = 252;
const MINIMAP_PANEL_MIN_WIDTH = 160;
const HISTORY_PANEL_DEFAULT_WIDTH = 280;
const MINIMAP_PANEL_MAX_WIDTH = 420;
const MINIMAP_PANEL_MIN_HEIGHT = 140;
const MINIMAP_PANEL_MAX_HEIGHT = 420;
const MINIMAP_PANEL_BORDER_SIZE = 2;
const MINIMAP_PANEL_HEADER_HEIGHT = 40;
const FLOAT_PANEL_Z_BASE = 40;
const FLOAT_PANEL_Z_STEP = 20;
const FLOAT_PANEL_Z_ACTIVE_OFFSET = 10;

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

  const historyPanelStyle = computed(() => {
    return {
      left: `${historyPanelPos.value.x}px`,
      top: `${historyPanelPos.value.y}px`,
      width: `${historyPanelWidth.value}px`,
      height: `${historyPanelHeight.value}px`,
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
      setPanelAnchors(
        "history",
        detectPanelAnchors(
          "history",
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
              : panel === "history"
                ? historyPanelWidth.value
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
              : panel === "history"
                ? { ...historyPanelPos.value }
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

  return {
    showElementsPanel,
    showTemplatePanel,
    showPropertiesPanel,
    showStructurePanel,
    sidebarPanelStyle,
    templatePanelStyle,
    propertiesPanelStyle,
    structurePanelStyle,
    historyPanelStyle,
    minimapPanelStyle,
    minimapPreviewWidth,
    minimapPreviewMaxHeight,
    getPanelZIndex,
    handleFloatingPanelMouseDown,
    startPanelResize,
    closeTemplatePanel,
    closeStructurePanel,
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
    handleBringPanelToFrontEvent,
    stopPanelDrag,
    stopPanelResize,
  };
};
