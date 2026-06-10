import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
  type Ref,
} from "vue";

type TooltipPlacement = "top" | "bottom";

interface FloatingTooltipOptions {
  width?: number;
  gap?: number;
  padding?: number;
  minHeight?: number;
  zIndex?: number;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const useFloatingTooltip = (
  isOpen: Ref<boolean>,
  buttonRef: Ref<HTMLElement | null>,
  tooltipRef: Ref<HTMLElement | null>,
  options: FloatingTooltipOptions = {},
) => {
  const tooltipStyle = ref<CSSProperties>({});
  const arrowStyle = ref<CSSProperties>({});
  const placement = ref<TooltipPlacement>("bottom");
  const suppressNextOutsideClose = ref(false);
  const pointerDownStartedInside = ref(false);

  const isInsideTooltipOrButton = (target: Node | null) => {
    if (!target) return false;
    return !!(
      buttonRef.value?.contains(target) || tooltipRef.value?.contains(target)
    );
  };

  const isPointInsideElement = (
    element: HTMLElement | null,
    x: number,
    y: number,
  ) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  };

  const isEventInsideTooltipOrButton = (event: Event) => {
    if (isInsideTooltipOrButton(event.target as Node | null)) {
      return true;
    }

    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];

    for (const node of path) {
      if (node === buttonRef.value || node === tooltipRef.value) {
        return true;
      }
      if (node instanceof Node && isInsideTooltipOrButton(node)) {
        return true;
      }
    }

    if (event instanceof MouseEvent || event instanceof PointerEvent) {
      const x = event.clientX;
      const y = event.clientY;
      if (
        isPointInsideElement(buttonRef.value, x, y) ||
        isPointInsideElement(tooltipRef.value, x, y)
      ) {
        return true;
      }
    }

    return false;
  };

  const isEventOnPanelDragHandle = (event: Event) => {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];

    for (const node of path) {
      if (!(node instanceof Element)) continue;

      const closestHandle = node.closest(
        '[data-floating-panel-drag-handle="true"]',
      );
      if (!closestHandle) continue;

      if (node.closest(".panel-help-btn")) return false;
      if (node.closest(".panel-close-btn")) return false;

      return true;
    }

    return false;
  };

  const updateTooltipPosition = async () => {
    await nextTick();

    const button = buttonRef.value;
    if (!isOpen.value || !button || typeof window === "undefined") return;

    const gap = options.gap ?? 8;
    const padding = options.padding ?? 8;
    const minHeight = options.minHeight ?? 120;
    const tooltipWidth = Math.min(
      options.width ?? 288,
      window.innerWidth - padding * 2,
    );
    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - gap - padding;
    const spaceAbove = rect.top - gap - padding;
    const measuredHeight = tooltipRef.value?.offsetHeight ?? 240;
    const shouldPlaceAbove =
      spaceBelow < Math.min(measuredHeight, minHeight) &&
      spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      minHeight,
      shouldPlaceAbove ? spaceAbove : spaceBelow,
    );
    const tooltipHeight = Math.min(measuredHeight, availableHeight);
    const top = shouldPlaceAbove
      ? Math.max(padding, rect.top - gap - tooltipHeight)
      : Math.min(
          viewportHeight - padding - Math.min(minHeight, availableHeight),
          rect.bottom + gap,
        );
    const maxLeft = Math.max(
      padding,
      window.innerWidth - tooltipWidth - padding,
    );
    const left = clamp(rect.right - tooltipWidth, padding, maxLeft);
    const arrowLeft = clamp(
      rect.left + rect.width / 2 - left,
      12,
      tooltipWidth - 12,
    );

    placement.value = shouldPlaceAbove ? "top" : "bottom";
    tooltipStyle.value = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      maxHeight: `${availableHeight}px`,
      zIndex: options.zIndex ?? 10000,
    };
    arrowStyle.value = {
      left: `${arrowLeft}px`,
    };
  };

  const hasSelectionInsideTooltip = () => {
    const tooltip = tooltipRef.value;
    if (!tooltip || typeof window === "undefined") return false;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    return !!(
      (anchorNode && tooltip.contains(anchorNode)) ||
      (focusNode && tooltip.contains(focusNode))
    );
  };

  const handleSelectionChange = () => {
    if (!isOpen.value) return;
    if (hasSelectionInsideTooltip()) {
      suppressNextOutsideClose.value = true;
    }
  };

  const handleCopyEvent = (event: ClipboardEvent) => {
    if (!isOpen.value) return;

    const tooltip = tooltipRef.value;
    if (!tooltip) return;

    const target = event.target as Node | null;
    if ((target && tooltip.contains(target)) || hasSelectionInsideTooltip()) {
      suppressNextOutsideClose.value = true;
    }
  };

  const handleWindowPointerDown = (event: PointerEvent) => {
    if (!isOpen.value) return;

    pointerDownStartedInside.value = isEventInsideTooltipOrButton(event);

    // Close the tooltip immediately when the user starts dragging any
    // floating panel (mousedown on its drag handle). This works in both
    // regular mount and web component (shadow DOM) mode because the check
    // walks `composedPath`, which is shadow-DOM aware.
    if (
      !pointerDownStartedInside.value &&
      isEventOnPanelDragHandle(event)
    ) {
      isOpen.value = false;
      pointerDownStartedInside.value = false;
      suppressNextOutsideClose.value = false;
    }
  };

  const handleWindowClick = (event: MouseEvent) => {
    if (!isOpen.value) return;

    if (isEventInsideTooltipOrButton(event)) {
      pointerDownStartedInside.value = false;
      return;
    }

    if (pointerDownStartedInside.value) {
      pointerDownStartedInside.value = false;
      return;
    }

    if (suppressNextOutsideClose.value) {
      suppressNextOutsideClose.value = false;
      return;
    }

    // Do not close immediately when user is selecting/copying tooltip text.
    if (hasSelectionInsideTooltip()) return;

    isOpen.value = false;
    pointerDownStartedInside.value = false;
  };

  const updateWhenOpen = () => {
    if (!isOpen.value) return;
    void updateTooltipPosition();
  };

  const toggleTooltip = () => {
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      suppressNextOutsideClose.value = false;
      pointerDownStartedInside.value = false;
    }
    updateWhenOpen();
  };

  onMounted(() => {
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("click", handleWindowClick, true);
    document.addEventListener("selectionchange", handleSelectionChange, true);
    window.addEventListener("copy", handleCopyEvent, true);
    window.addEventListener("resize", updateWhenOpen);
    window.addEventListener("scroll", updateWhenOpen, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleWindowPointerDown, true);
    window.removeEventListener("click", handleWindowClick, true);
    document.removeEventListener(
      "selectionchange",
      handleSelectionChange,
      true,
    );
    window.removeEventListener("copy", handleCopyEvent, true);
    window.removeEventListener("resize", updateWhenOpen);
    window.removeEventListener("scroll", updateWhenOpen, true);
  });

  watch(isOpen, (open) => {
    if (open) {
      void updateTooltipPosition();
    }
  });

  return {
    arrowStyle,
    placement,
    toggleTooltip,
    tooltipStyle,
    updateTooltipPosition,
  };
};
