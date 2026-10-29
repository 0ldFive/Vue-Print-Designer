<script lang="ts">
// 跨 wrapper 共享的“拖动转交”标记：指针按下的是上层元素，
// 但真正要拖动的是被它盖住的下层元素时，由下层 wrapper 接管这次拖动。
type ForwardDragPayload = {
  elementId: string;
  pageIndex: number;
  x: number;
  y: number;
};

let pendingForwardDrag: ForwardDragPayload | null = null;
</script>

<script setup lang="ts">
import {
  ref,
  computed,
  inject,
  type Ref,
} from "vue";
import { useI18n } from "@/locales";
import type { PrintElement } from "@/types";
import { ElementType } from "@/types";
import { useDesignerStore } from "@/stores/designer";
import Lock from "~icons/material-symbols/lock";
import RotateRight from "~icons/material-symbols/rotate-right";
import AlignmentCenterCross from "@/components/common/AlignmentCenterCross.vue";

const props = defineProps<{
  element: PrintElement;
  isSelected: boolean;
  zoom: number;
  pageIndex: number;
  clipToPageBounds?: boolean;
  readOnly?: boolean;
  forceHover?: boolean;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const elementRef = ref<HTMLElement | null>(null);
const isHovered = ref(false);

const designerRoot = inject<Ref<HTMLElement | null>>(
  "designer-root",
  ref(null),
);
const getQueryRoot = () => {
  return (
    (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document
  );
};

type LocatedElement = {
  pageIndex: number;
  elementIndex: number;
  element: PrintElement;
};

type EmbeddedCellBounds = {
  tableId: string;
  colField: string;
  rowIndex: number;
  section: "body" | "footer";
  x: number;
  y: number;
  width: number;
  height: number;
  tableElement: PrintElement;
};

type SectionRowMetrics = {
  rowCount: number;
  totalHeight: number;
  firstHeight: number | null;
  heights: number[];
};

type TableResizeBase = {
  elementId: string;
  width: number;
  height: number;
  columns: any[] | null;
  style: Record<string, any>;
  data: any[] | null;
  footerData: any[] | null;
  headerMetrics: SectionRowMetrics;
  bodyMetrics: SectionRowMetrics;
  footerMetrics: SectionRowMetrics;
  structureSignature: string;
};

const tableResizeReference = ref<TableResizeBase | null>(null);

const findElementInPages = (id: string): LocatedElement | null => {
  for (let pageIndex = 0; pageIndex < store.pages.length; pageIndex += 1) {
    const page = store.pages[pageIndex];
    const elementIndex = page.elements.findIndex((item) => item.id === id);
    if (elementIndex === -1) continue;

    return {
      pageIndex,
      elementIndex,
      element: page.elements[elementIndex],
    };
  }

  return null;
};

const getCellBorderInsetRect = (
  cellEl: HTMLElement,
  wrapperRect: DOMRect,
  zoom: number,
) => {
  const rect = cellEl.getBoundingClientRect();
  const style = window.getComputedStyle(cellEl);
  const toViewportPx = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed * zoom : 0;
  };

  return {
    left: Math.max(
      rect.left + toViewportPx(style.borderLeftWidth),
      wrapperRect.left,
    ),
    top: Math.max(
      rect.top + toViewportPx(style.borderTopWidth),
      wrapperRect.top,
    ),
    right: Math.min(
      rect.right - toViewportPx(style.borderRightWidth),
      wrapperRect.right,
    ),
    bottom: Math.min(
      rect.bottom - toViewportPx(style.borderBottomWidth),
      wrapperRect.bottom,
    ),
  };
};

const getEmbeddedCellBounds = (): EmbeddedCellBounds | null => {
  const tableId = props.element.embeddedInTableId;
  const cellRef = props.element.embeddedInTableCell;
  if (!tableId || !cellRef) return null;

  const locatedTable = findElementInPages(tableId);
  if (!locatedTable) return null;

  const targetSection = cellRef.section === "footer" ? "footer" : "body";
  const targetRowIndex = Number(cellRef.rowIndex);
  if (!Number.isFinite(targetRowIndex)) return null;

  const tableWrapper = getQueryRoot().querySelector(
    `.element-wrapper[data-element-id="${tableId}"]`,
  ) as HTMLElement | null;
  if (!tableWrapper) return null;

  const candidateCells = tableWrapper.querySelectorAll<HTMLElement>(
    "td[data-field][data-row-index][data-section]",
  );

  let matchedCell: HTMLElement | null = null;
  for (const cellEl of candidateCells) {
    if (
      cellEl.dataset.field === cellRef.colField &&
      cellEl.dataset.rowIndex === String(targetRowIndex) &&
      (cellEl.dataset.section || "body") === targetSection
    ) {
      matchedCell = cellEl;
      break;
    }
  }

  if (!matchedCell) return null;

  const zoom = props.zoom || store.zoom || 1;
  const wrapperRect = tableWrapper.getBoundingClientRect();
  const visibleRect = getCellBorderInsetRect(matchedCell, wrapperRect, zoom);

  return {
    tableId,
    colField: cellRef.colField,
    rowIndex: targetRowIndex,
    section: targetSection,
    x: locatedTable.element.x + (visibleRect.left - wrapperRect.left) / zoom,
    y: locatedTable.element.y + (visibleRect.top - wrapperRect.top) / zoom,
    width: Math.max(0, visibleRect.right - visibleRect.left) / zoom,
    height: Math.max(0, visibleRect.bottom - visibleRect.top) / zoom,
    tableElement: locatedTable.element,
  };
};

const clampToEmbeddedCellBounds = (
  targetX: number,
  targetY: number,
  cellBounds: EmbeddedCellBounds,
) => {
  const maxX =
    cellBounds.x + Math.max(0, cellBounds.width - props.element.width);
  const maxY =
    cellBounds.y + Math.max(0, cellBounds.height - props.element.height);

  return {
    x: Math.min(Math.max(cellBounds.x, targetX), maxX),
    y: Math.min(Math.max(cellBounds.y, targetY), maxY),
  };
};

const maybeExpandEmbeddedCell = (
  requiredWidth: number,
  requiredHeight: number,
  cellBounds: EmbeddedCellBounds,
) => {
  const offsetX = Math.max(0, props.element.x - cellBounds.x);
  const offsetY = Math.max(0, props.element.y - cellBounds.y);
  const requiredCellWidth = offsetX + requiredWidth;
  const requiredCellHeight = offsetY + requiredHeight;
  const shouldExpandWidth = requiredCellWidth > cellBounds.width;
  const shouldExpandHeight = requiredCellHeight > cellBounds.height;

  if (!shouldExpandWidth && !shouldExpandHeight) return;

  const tableElement = cellBounds.tableElement;
  const nextUpdates: Partial<PrintElement> = {};
  let hasChanges = false;

  if (
    shouldExpandWidth &&
    Array.isArray(tableElement.columns) &&
    tableElement.columns.length > 0
  ) {
    const colIndex = tableElement.columns.findIndex(
      (col) => col.field === cellBounds.colField,
    );
    if (colIndex !== -1) {
      const nextColumns = tableElement.columns.map((col) => ({ ...col }));
      const currentColWidth =
        Number(nextColumns[colIndex].width) || Math.max(1, cellBounds.width);
      const widthDeficit = Math.max(0, requiredCellWidth - cellBounds.width);
      const targetColWidth = Math.ceil(currentColWidth + widthDeficit);

      if (targetColWidth > currentColWidth) {
        const widthDelta = targetColWidth - currentColWidth;
        nextColumns[colIndex] = {
          ...nextColumns[colIndex],
          width: targetColWidth,
        };
        nextUpdates.columns = nextColumns;
        nextUpdates.width = Math.max(
          tableElement.width,
          tableElement.width + widthDelta,
        );
        hasChanges = true;
      }
    }
  }

  const rowKey = cellBounds.section === "footer" ? "footerData" : "data";
  const sourceRows = (tableElement as any)[rowKey];
  if (
    shouldExpandHeight &&
    Array.isArray(sourceRows) &&
    sourceRows[cellBounds.rowIndex]
  ) {
    const nextRows = JSON.parse(JSON.stringify(sourceRows));
    const row = nextRows[cellBounds.rowIndex] || {};
    const currentRawCell = row[cellBounds.colField];
    const cellObject =
      currentRawCell && typeof currentRawCell === "object"
        ? { ...currentRawCell }
        : { value: currentRawCell ?? "" };

    const currentStyle =
      cellObject.style && typeof cellObject.style === "object"
        ? { ...cellObject.style }
        : {};

    const parsedCurrentHeight = Number.parseFloat(
      String(currentStyle.height ?? ""),
    );
    const currentCellHeight = Number.isFinite(parsedCurrentHeight)
      ? parsedCurrentHeight
      : Math.max(1, cellBounds.height);
    const heightDeficit = Math.max(0, requiredCellHeight - cellBounds.height);
    const targetCellHeight = Math.ceil(currentCellHeight + heightDeficit);

    if (targetCellHeight > currentCellHeight) {
      const heightDelta = targetCellHeight - currentCellHeight;
      cellObject.style = {
        ...currentStyle,
        height: `${targetCellHeight}px`,
      };
      row[cellBounds.colField] = cellObject;
      nextRows[cellBounds.rowIndex] = row;
      if (rowKey === "footerData") {
        nextUpdates.footerData = nextRows;
      } else {
        nextUpdates.data = nextRows;
      }

      const baseHeight =
        typeof nextUpdates.height === "number"
          ? nextUpdates.height
          : tableElement.height;
      nextUpdates.height = Math.max(
        baseHeight,
        tableElement.height + heightDelta,
      );
      hasChanges = true;
    }
  }

  if (!hasChanges) return;
  store.updateElement(tableElement.id, nextUpdates, false);
};

const actualIsSelected = computed(() => {
  const isMultiSelected =
    !props.isSelected && store.selectedElementIds.includes(props.element.id);
  return !props.readOnly && (props.isSelected || isMultiSelected);
});

const embeddedTableTextLayer = computed<"above" | "below" | null>(() => {
  if (!props.element.embeddedInTableId) return null;
  const locatedTable = findElementInPages(props.element.embeddedInTableId);
  if (!locatedTable || locatedTable.element.type !== ElementType.TABLE) {
    return null;
  }

  return locatedTable.element.embeddedCellTextLayer === "above"
    ? "above"
    : "below";
});

const shouldConstrainToCanvas = computed(
  () =>
    // The multi-label layout ignores the global "allow drag outside canvas"
    // setting and may always be dragged past the canvas edges.
    props.element.type !== ElementType.MULTI_LABEL &&
    !store.allowDragOutsideCanvas,
);

const selfBorderedTypes = [
  ElementType.TABLE,
  ElementType.LINE,
  ElementType.RECT,
  ElementType.CIRCLE,
];

const borderOverlayStyle = computed<Record<string, any> | null>(() => {
  if (selfBorderedTypes.includes(props.element.type)) {
    return null;
  }

  if (
    props.element.style.borderStyle &&
    props.element.style.borderStyle !== "none"
  ) {
    return {
      borderStyle: props.element.style.borderStyle,
      borderWidth: `${props.element.style.borderWidth || 1}px`,
      borderColor: props.element.style.borderColor || "#000",
      borderRadius: "inherit",
      boxSizing: "border-box",
    };
  }

  if (props.element.style.border) {
    return {
      border: props.element.style.border,
      borderRadius: "inherit",
      boxSizing: "border-box",
    };
  }

  return null;
});

const style = computed(() => {
  const baseStyle: Record<string, any> = {
    left: `${props.element.x}px`,
    top: `${props.element.y}px`,
    width: `${props.element.width}px`,
    height: `${props.element.height}px`,
    zIndex: props.element.style.zIndex || 1,
    transform: `rotate(${props.element.style.rotate || 0}deg)`,
    ...props.element.style,
  };

  if (props.element.embeddedInTableId) {
    const parsedZIndex = Number.parseFloat(String(baseStyle.zIndex ?? "1"));
    const resolvedZIndex = Number.isFinite(parsedZIndex) ? parsedZIndex : 1;

    baseStyle.zIndex =
      embeddedTableTextLayer.value === "above"
        ? Math.min(resolvedZIndex, 0)
        : Math.max(resolvedZIndex, 2);
  }

  if (props.element.type === ElementType.MULTI_LABEL) {
    // The layout container is a backdrop for its first-label content: keep it
    // behind the child elements so they remain clickable/selectable.
    baseStyle.zIndex = 0;
  }

  if (props.element.type === ElementType.TEXT) {
    const inheritedTextKeys = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "textAlign",
      "verticalAlign",
      "textDecoration",
      "writingMode",
      "textOrientation",
      "direction",
      "letterSpacing",
      "lineHeight",
      "textTransform",
      "color",
      "padding",
      "whiteSpace",
    ];
    inheritedTextKeys.forEach((key) => {
      delete baseStyle[key];
    });
  }

  // Handle structured border properties
  // Skip border/background for self-bordered elements (Table, Line, Rect, Circle)

  if (selfBorderedTypes.includes(props.element.type)) {
    // For these elements, background and borders are handled internally
    // We must remove them from the wrapper to avoid double rendering or artifacts (e.g. square background behind circle)
    delete baseStyle.backgroundColor;

    // Borders are already handled by not adding them below, but we also need to ensure
    // any border props in element.style don't leak through via the spread above if they match standard CSS names
    // (though usually they are structured properties like borderWidth, which don't affect CSS directly unless mapped)
    // However, 'border' shorthand might be there.
    delete baseStyle.border;
    delete baseStyle.borderWidth;
    delete baseStyle.borderStyle;
    delete baseStyle.borderColor;
    delete baseStyle.borderRadius; // Rect handles its own radius
  }

  // Render border with an overlay layer so it does not consume wrapper size.
  delete baseStyle.border;
  delete baseStyle.borderWidth;
  delete baseStyle.borderStyle;
  delete baseStyle.borderColor;
  delete baseStyle.opacity;

  // Keep outer width/height equal to the element size regardless of border width.
  baseStyle.boxSizing = "border-box";

  if (props.clipToPageBounds) {
    const pageWidth = store.canvasSize.width;
    const pageHeight = store.canvasSize.height;
    const rad = ((props.element.style.rotate || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const centerX = props.element.width / 2;
    const centerY = props.element.height / 2;
    const centerPageX = props.element.x + centerX;
    const centerPageY = props.element.y + centerY;
    // 元素四角经旋转正映射到页面坐标；四角都在页面内 ⇒ 整个元素视觉上在页面内。
    // 仅在视觉上确实越出页面时才挂 clip-path：若给"局部盒越界但视觉在页面内"的
    // 旋转元素挂上实际不裁剪任何内容的 clip-path，非整数缩放下的重栅格化会让
    // 元素边缘产生亚像素抖动。
    const cornerToPage = (px: number, py: number) => {
      const dx = px - centerX;
      const dy = py - centerY;
      return [
        centerPageX + dx * cos - dy * sin,
        centerPageY + dx * sin + dy * cos,
      ] as const;
    };
    const visualCorners = [
      cornerToPage(0, 0),
      cornerToPage(props.element.width, 0),
      cornerToPage(props.element.width, props.element.height),
      cornerToPage(0, props.element.height),
    ];
    const fullyInsidePage = visualCorners.every(
      ([qx, qy]) =>
        qx >= 0 && qy >= 0 && qx <= pageWidth && qy <= pageHeight,
    );

    if (!fullyInsidePage) {
      // clip-path 在元素旋转前的局部坐标系中生效；对带 rotate 的元素直接用
      // inset(上 右 下 左) 会把越界量裁到错误的方向上（如 rotate 90° 时上下被裁）。
      // 这里把页面矩形四角经逆旋转映射到局部坐标，用 polygon 保证任意角度下
      // 都按"视觉上的页面矩形"裁剪，选中状态切换时元素不会跳变。
      const pageCornerToLocal = (pageX: number, pageY: number) => {
        const dx = pageX - centerPageX;
        const dy = pageY - centerPageY;
        return [
          centerX + dx * cos + dy * sin,
          centerY - dx * sin + dy * cos,
        ] as const;
      };
      const corners = [
        pageCornerToLocal(0, 0),
        pageCornerToLocal(pageWidth, 0),
        pageCornerToLocal(pageWidth, pageHeight),
        pageCornerToLocal(0, pageHeight),
      ];
      baseStyle.clipPath = `polygon(${corners
        .map(([px, py]) => `${px.toFixed(4)}px ${py.toFixed(4)}px`)
        .join(", ")})`;
    } else {
      delete baseStyle.clipPath;
    }
  }

  return baseStyle;
});

const isAlignmentTarget = computed(() => {
  if (props.readOnly) return false;
  if (actualIsSelected.value) return false;
  return store.highlightedAlignedElementIds.includes(props.element.id);
});

const resolvedZoom = computed(() =>
  Number.isFinite(props.zoom) && props.zoom > 0 ? Number(props.zoom) : 1,
);

const oneDevicePixelInCanvas = computed(() => 1 / resolvedZoom.value);

const oneDevicePixelInCanvasPx = computed(
  () => `${Number(oneDevicePixelInCanvas.value.toFixed(4))}px`,
);

const resizeHandleStyles = computed(() => {
  // Pure CSS positioning — handles are absolute children of the element wrapper.
  // The wrapper sits inside transform:scale(zoom); CSS percentages & px values
  // scale automatically, so no JavaScript coordinate math is needed.
  // -2px offset centers the 5px handle bar on the 1px selection border
  // (border center is at 0.5px; handle center = -2px + 2.5px = 0.5px ✓).
  //
  // Adaptive sizing: cap each arm to dimension/3 so that the layout along every
  // axis is [corner | gap | edge | gap | corner] with 2*cornerLen+edgeLen ≤ dim,
  // preventing handles from overlapping on small elements.
  const W = props.element.width;
  const H = props.element.height;
  const thickness = 5;
  const minArm = thickness + 1; // 6px minimum so the L-arm is always visible

  // Corner size is limited by the smaller axis (square handle)
  const cornerLen = Math.max(minArm, Math.min(18, Math.floor(Math.min(W, H) / 3)));
  // Edge handle lengths are limited per-axis independently
  const edgeLenH = Math.max(minArm, Math.min(20, Math.floor(H / 3))); // left/right
  const edgeLenW = Math.max(minArm, Math.min(20, Math.floor(W / 3))); // top/bottom

  const offset = "-2px";
  const t = `${thickness}px`;
  const cL = `${cornerLen}px`;
  const eLH = `${edgeLenH}px`;
  const eLW = `${edgeLenW}px`;
  const radius = "2.5px";
  return {
    left: { width: t, height: eLH, left: offset, top: "50%", transform: "translateY(-50%)", borderRadius: radius },
    right: { width: t, height: eLH, right: offset, top: "50%", transform: "translateY(-50%)", borderRadius: radius },
    top: { width: eLW, height: t, top: offset, left: "50%", transform: "translateX(-50%)", borderRadius: radius },
    bottom: { width: eLW, height: t, bottom: offset, left: "50%", transform: "translateX(-50%)", borderRadius: radius },
    topLeftCorner: { left: offset, top: offset, width: cL, height: cL },
    topRightCorner: { right: offset, top: offset, width: cL, height: cL },
    bottomLeftCorner: { left: offset, bottom: offset, width: cL, height: cL },
    bottomRightCorner: { right: offset, bottom: offset, width: cL, height: cL },
    topLeftCornerH: { left: "0", top: "0", width: cL, height: t, borderRadius: radius },
    topLeftCornerV: { left: "0", top: "0", width: t, height: cL, borderRadius: radius },
    topRightCornerH: { right: "0", top: "0", width: cL, height: t, borderRadius: radius },
    topRightCornerV: { right: "0", top: "0", width: t, height: cL, borderRadius: radius },
    bottomLeftCornerH: { left: "0", bottom: "0", width: cL, height: t, borderRadius: radius },
    bottomLeftCornerV: { left: "0", bottom: "0", width: t, height: cL, borderRadius: radius },
    bottomRightCornerH: { right: "0", bottom: "0", width: cL, height: t, borderRadius: radius },
    bottomRightCornerV: { right: "0", bottom: "0", width: t, height: cL, borderRadius: radius },
  } as const;
});

// Resize handle cursors must follow the element's rotation: CSS cursors never rotate
// with transforms, so on a rotated element the static arrows no longer match where each
// handle visually sits. Each handle has an outward angle (degrees, clockwise from the
// +x/east axis, matching screen coordinates where +y points down). Adding the element's
// rotation and snapping (angle mod 180) to the nearest 45° bucket yields the on-screen
// resize axis. At rotation 0 this reproduces the original static cursors exactly.
const resizeHandleCursors = computed(() => {
  const rotation = props.element.style.rotate || 0;
  const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];
  const cursorFor = (baseAngle: number) => {
    const angle = (((baseAngle + rotation) % 180) + 180) % 180;
    return cursors[Math.round(angle / 45) % 4];
  };
  return {
    right: cursorFor(0),
    bottomRight: cursorFor(45),
    bottom: cursorFor(90),
    bottomLeft: cursorFor(135),
    left: cursorFor(180),
    topLeft: cursorFor(225),
    top: cursorFor(270),
    topRight: cursorFor(315),
  } as const;
});

// Dragging Logic
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let isDragging = false;
let hasSnapshot = false;

// 按下后尚未确定“点击选择”还是“拖动”时的起点：
// 首次明显移动才决定拖谁，未移动就松开则按点击处理。
let pendingPointer: { x: number; y: number } | null = null;

// 上一次点击的位置与时间，用于"同一位置重复点击循环切换重叠元素"。
let lastClickState: {
  x: number;
  y: number;
  pageIndex: number;
  time: number;
} | null = null;

const CLICK_CYCLE_DISTANCE = 3;
const DOUBLE_CLICK_INTERVAL = 350;

/**
 * 取指针位置下方当前页面的元素 id，按视觉层级从最上层到最下层排列。
 * elementsFromPoint 的顺序即浏览器命中测试顺序，天然等于"看到的上下关系"。
 */
const getHitElementIdsAt = (clientX: number, clientY: number) => {
  const root = getQueryRoot();
  const pageElement = root.getElementById(`page-${props.pageIndex}`);
  const stack = root.elementsFromPoint(clientX, clientY);
  const ids: string[] = [];

  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const wrapper = node.closest(".element-wrapper") as HTMLElement | null;
    if (!wrapper) continue;
    if (pageElement && !pageElement.contains(wrapper)) continue;
    if (wrapper.dataset.readOnly === "true") continue;
    const id = wrapper.dataset.elementId;
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }

  return ids;
};

/**
 * 解析点击（按下后未拖动）应选中的元素，PS 式智能选择：
 * 1. 默认选中最上层；
 * 2. 按住 Alt 点击穿透到下一层；
 * 3. 在同一位置再次点击，逐层向下循环。
 * 双击间隔内不循环，避免干扰文字/图片的双击编辑。
 */
const resolveClickSelection = (e: MouseEvent) => {
  const candidateIds = getHitElementIdsAt(e.clientX, e.clientY);
  if (candidateIds.length === 0) return props.element.id;

  const now = performance.now();
  const previous = lastClickState;
  const isSameSpot =
    !!previous &&
    previous.pageIndex === props.pageIndex &&
    Math.abs(previous.x - e.clientX) <= CLICK_CYCLE_DISTANCE &&
    Math.abs(previous.y - e.clientY) <= CLICK_CYCLE_DISTANCE;
  const isDoubleClick =
    isSameSpot && now - (previous as NonNullable<typeof previous>).time <= DOUBLE_CLICK_INTERVAL;

  lastClickState = {
    x: e.clientX,
    y: e.clientY,
    pageIndex: props.pageIndex,
    time: now,
  };

  const selectedId =
    store.selectedElementIds.length === 1 ? store.selectedElementId : null;
  const selectedIndex = selectedId ? candidateIds.indexOf(selectedId) : -1;

  if (e.altKey) {
    const baseIndex =
      selectedIndex >= 0
        ? selectedIndex
        : candidateIds.indexOf(props.element.id);
    return candidateIds[(baseIndex + 1) % candidateIds.length];
  }

  if (isSameSpot && !isDoubleClick) {
    // 已选中的是最上层：再点一次切到下一层
    if (selectedIndex === 0 && candidateIds.length > 1) {
      return candidateIds[1];
    }
    // 已选中的是下层元素：保持不动，让这次按下直接拖动它
    if (selectedIndex > 0) {
      return candidateIds[selectedIndex];
    }
  }

  return candidateIds[0];
};

/**
 * 把这次拖动转交给真正的目标图层：派发一次带原始按下坐标的 mousedown，
 * 交给目标 wrapper 自己处理，保证它的锁定、嵌入单元格约束等逻辑都生效。
 */
const forwardDragTo = (
  elementId: string,
  originX: number,
  originY: number,
) => {
  const root = getQueryRoot();
  const pageElement = root.getElementById(`page-${props.pageIndex}`);
  const scope = pageElement ?? root;
  const target = Array.from(
    scope.querySelectorAll<HTMLElement>(".element-wrapper"),
  ).find(
    (wrapper) =>
      wrapper.dataset.elementId === elementId &&
      wrapper.dataset.readOnly !== "true",
  );
  if (!target) return;

  pendingForwardDrag = {
    elementId,
    pageIndex: props.pageIndex,
    x: originX,
    y: originY,
  };
  target.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: originX,
      clientY: originY,
      button: 0,
      buttons: 1,
    }),
  );
  // 目标未接管（被锁定等）时清掉标记，避免污染下一次点击
  if (pendingForwardDrag && pendingForwardDrag.elementId === elementId) {
    pendingForwardDrag = null;
  }
};

/** 开始拖动当前元素；返回 false 表示不应拖动（如已锁定）。 */
const beginDrag = (clientX: number, clientY: number) => {
  if (props.element.locked) return false;

  // 拖动前确保它被选中（多选时它已在选中集合里，不会打断群组拖动）
  if (!store.selectedElementIds.includes(props.element.id)) {
    store.selectElement(props.element.id, false, false);
  }

  isDragging = true;
  store.setDragging(true);
  store.setResizing(false);
  store.setRotating(false);
  hasSnapshot = false;
  startX = clientX;
  startY = clientY;
  initialLeft = props.element.x;
  initialTop = props.element.y;

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  return true;
};

const handleMouseDown = (e: MouseEvent) => {
  if (props.readOnly) return;
  if (e.button !== 0) return; // Only left click
  // Don't start drag if clicking on resize/rotate handles
  if (
    (e.target as HTMLElement).closest(".resize-handle") ||
    (e.target as HTMLElement).closest(".rotate-handle")
  )
    return;

  // Prevent bubbling to page-level marquee selection start.
  e.stopPropagation();

  // 由上层元素转交过来的拖动：用原始按下坐标直接拖动本元素
  const forwarded = pendingForwardDrag;
  if (
    forwarded &&
    forwarded.elementId === props.element.id &&
    forwarded.pageIndex === props.pageIndex
  ) {
    pendingForwardDrag = null;
    beginDrag(forwarded.x, forwarded.y);
    return;
  }

  // Check for multi-select (Ctrl/Cmd key)
  const isMultiSelect = e.ctrlKey || e.metaKey;

  if (isMultiSelect) {
    store.selectElement(props.element.id, true, false);
    beginDrag(e.clientX, e.clientY);
    return;
  }

  // 单击：此时还不知道用户是要“点击选择”还是“拖动”，
  // 先只记录起点，等鼠标真正移动再决定拖谁；
  // 没移动就松开则按 PS 式规则确定选中项（见 resolveClickSelection）。
  // 这样选中下层元素后拖动，不会被上层元素抢走。
  pendingPointer = { x: e.clientX, y: e.clientY };
  isDragging = false;
  hasSnapshot = false;
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
};

const applyDrag = (e: MouseEvent) => {
  const dx = (e.clientX - startX) / props.zoom;
  const dy = (e.clientY - startY) / props.zoom;

  // If we moved significantly, it's a drag operation
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    if (!hasSnapshot) {
      store.snapshot("editor.historyAction.elementMove");
      hasSnapshot = true;
    }

    const embeddedCellBounds = getEmbeddedCellBounds();
    if (embeddedCellBounds) {
      const clamped = clampToEmbeddedCellBounds(
        initialLeft + dx,
        initialTop + dy,
        embeddedCellBounds,
      );

      store.setHighlightedGuide(null);
      store.setHighlightedEdge(null);
      store.setHighlightedAlignedElements([]);

      store.updateElement(
        props.element.id,
        {
          x: clamped.x,
          y: clamped.y,
        },
        false,
      );
      return;
    }

    if (
      store.selectedElementIds.length > 1 &&
      store.selectedElementIds.includes(props.element.id)
    ) {
      store.moveSelectedElements(
        props.element.id,
        initialLeft + dx,
        initialTop + dy,
        false,
        shouldConstrainToCanvas.value,
      );
    } else {
      store.moveElementWithSnap(
        props.element.id,
        initialLeft + dx,
        initialTop + dy,
        false,
        shouldConstrainToCanvas.value,
      );
    }
  }
};

const handleMouseMove = (e: MouseEvent) => {
  // 还没开始拖动：第一次明显移动时才决定拖哪个元素
  if (!isDragging) {
    if (!pendingPointer) return;
    if (
      Math.abs(e.clientX - pendingPointer.x) <= 2 &&
      Math.abs(e.clientY - pendingPointer.y) <= 2
    )
      return;

    const originX = pendingPointer.x;
    const originY = pendingPointer.y;
    pendingPointer = null;

    const candidateIds = getHitElementIdsAt(originX, originY);
    const selectedId =
      store.selectedElementIds.length === 1 ? store.selectedElementId : null;
    const selectedIndex = selectedId ? candidateIds.indexOf(selectedId) : -1;

    // 当前选中的图层就在指针下方（可能被上层盖住）：继续拖它；
    // 否则拖指针命中的最上层元素。
    const targetId =
      selectedIndex >= 0
        ? (selectedId as string)
        : (candidateIds[0] ?? props.element.id);

    if (targetId !== props.element.id) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      forwardDragTo(targetId, originX, originY);
      return;
    }

    if (!beginDrag(originX, originY)) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      return;
    }
  }

  applyDrag(e);
};

const handleMouseUp = (e: MouseEvent) => {
  // 没有发生拖动：这次按下就是一次点击，按 PS 式规则确定选中项
  if (pendingPointer) {
    pendingPointer = null;
    const targetId = resolveClickSelection(e);
    store.selectElement(targetId, false, false);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    return;
  }

  if (isDragging && hasSnapshot) {
    const root = getQueryRoot();
    const elementsFromPoint = root.elementsFromPoint(e.clientX, e.clientY);
    const pageElement = elementsFromPoint.find((el) =>
      el.classList.contains("print-page"),
    ) as HTMLElement;

    if (pageElement) {
      const pageId = pageElement.id;
      const pageIndex = parseInt(pageId.replace("page-", ""), 10);

      if (!isNaN(pageIndex) && pageIndex !== props.pageIndex) {
        // Dropped on different page
        const oldPageElement = root.getElementById(`page-${props.pageIndex}`);
        if (oldPageElement) {
          const oldRect = oldPageElement.getBoundingClientRect();
          const newRect = pageElement.getBoundingClientRect();

          const dxPage = (oldRect.left - newRect.left) / props.zoom;
          const dyPage = (oldRect.top - newRect.top) / props.zoom;

          const idsToMove =
            store.selectedElementIds.length > 1 &&
            store.selectedElementIds.includes(props.element.id)
              ? [...store.selectedElementIds]
              : [props.element.id];

          idsToMove.forEach((id) => {
            const page = store.pages[props.pageIndex];
            const el = page.elements.find((e) => e.id === id);
            if (el) {
              store.moveElementToPage(
                id,
                pageIndex,
                el.x + dxPage,
                el.y + dyPage,
              );
            }
          });
        }
      }
    }
  }

  isDragging = false;
  store.setDragging(false);
  store.setResizing(false);
  store.setRotating(false);
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
  store.setHighlightedAlignedElements([]);
};

// Resizing Logic (Simple bottom-right handle for now)
const isRotating = ref(false);
const isSnapped = ref(false);
const currentRotationDisplay = ref(0);

// Rotation Logic
const handleRotateStart = (e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();

  if (!elementRef.value) return;

  isRotating.value = true;
  store.setDragging(false);
  store.setResizing(false);
  store.setRotating(true);
  isSnapped.value = false;
  hasSnapshot = false;
  currentRotationDisplay.value = props.element.style.rotate || 0;

  const rect = elementRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  const initialRotation = props.element.style.rotate || 0;

  const handleRotateMove = (moveEvent: MouseEvent) => {
    const currentAngle = Math.atan2(
      moveEvent.clientY - centerY,
      moveEvent.clientX - centerX,
    );
    const degrees = (currentAngle - startAngle) * (180 / Math.PI);
    let newRotation = initialRotation + degrees;

    // Normalize to 0-360
    newRotation = newRotation % 360;
    if (newRotation < 0) newRotation += 360;

    isSnapped.value = false;

    // Snap to 45 degrees
    if (moveEvent.shiftKey) {
      newRotation = Math.round(newRotation / 45) * 45;
      isSnapped.value = true;
    } else if (!moveEvent.ctrlKey) {
      // Magnetic snap to 0, 90, 180, 270
      // User can hold Ctrl to disable snapping for fine adjustments
      const snapThreshold = 5;
      const targets = [0, 90, 180, 270, 360];

      for (const target of targets) {
        if (Math.abs(newRotation - target) <= snapThreshold) {
          newRotation = target === 360 ? 0 : target;
          isSnapped.value = true;
          break;
        }
      }
    }

    // Round to integer (Step 1)
    newRotation = Math.round(newRotation);
    if (newRotation === 360) newRotation = 0;

    currentRotationDisplay.value = newRotation;

    if (!hasSnapshot) {
      store.snapshot("editor.historyAction.elementRotate");
      hasSnapshot = true;
    }

    store.updateElement(
      props.element.id,
      {
        style: {
          ...props.element.style,
          rotate: newRotation,
        },
      },
      false,
    );
  };

  const handleRotateUp = () => {
    isRotating.value = false;
    store.setRotating(false);
    window.removeEventListener("mousemove", handleRotateMove);
    window.removeEventListener("mouseup", handleRotateUp);
  };

  window.addEventListener("mousemove", handleRotateMove);
  window.addEventListener("mouseup", handleRotateUp);
};

type ResizeHandleDirection =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
type ResizeEdge = "left" | "top" | "right" | "bottom";

const handleResizeStart = (e: MouseEvent, direction: ResizeHandleDirection) => {
  e.stopPropagation();
  e.preventDefault();

  type ResizeSnapCandidate = {
    point: number;
    type: "edge" | "guide" | "element";
    edge?: ResizeEdge;
    guideId?: string;
  };

  const SNAP_THRESHOLD = 6;
  const MIN_SIZE = 10;
  const ALIGN_EPSILON = 0.5;
  const resizesFromLeft =
    direction === "left" ||
    direction === "top-left" ||
    direction === "bottom-left";
  const resizesFromRight =
    direction === "right" ||
    direction === "top-right" ||
    direction === "bottom-right";
  const resizesFromTop =
    direction === "top" ||
    direction === "top-left" ||
    direction === "top-right";
  const resizesFromBottom =
    direction === "bottom" ||
    direction === "bottom-left" ||
    direction === "bottom-right";

  const findBestSnap = (target: number, candidates: ResizeSnapCandidate[]) => {
    let best: ResizeSnapCandidate | null = null;
    let bestDist = Infinity;

    for (const candidate of candidates) {
      const dist = Math.abs(target - candidate.point);
      if (dist > SNAP_THRESHOLD) continue;
      if (dist < bestDist - 1e-6) {
        best = candidate;
        bestDist = dist;
      }
    }

    return best;
  };

  const getResizeSnapResult = (
    targetX: number,
    targetY: number,
    targetWidth: number,
    targetHeight: number,
  ) => {
    let x = targetX;
    let y = targetY;
    let width = Math.max(MIN_SIZE, targetWidth);
    let height = Math.max(MIN_SIZE, targetHeight);

    const marginX = store.pageSpacingX || 0;
    const marginY = store.pageSpacingY || 0;
    const minLeftBoundary = marginX;
    const minTopBoundary = marginY;
    const maxRightBoundary = store.canvasSize.width - marginX;
    const maxBottomBoundary = store.canvasSize.height - marginY;

    const page = store.pages[props.pageIndex];
    const selectedSet = new Set(store.selectedElementIds);
    selectedSet.add(props.element.id);
    const referenceElements = page
      ? page.elements.filter((item) => !selectedSet.has(item.id))
      : [];

    const right = x + width;
    const bottom = y + height;
    const xCandidates: ResizeSnapCandidate[] = [];
    const yCandidates: ResizeSnapCandidate[] = [];

    if (resizesFromRight) {
      if (maxRightBoundary - x >= MIN_SIZE) {
        xCandidates.push({
          point: maxRightBoundary,
          type: "edge",
          edge: "right",
        });
      }

      for (const guide of store.guides) {
        if (guide.type === "vertical" && guide.position - x >= MIN_SIZE) {
          xCandidates.push({
            point: guide.position,
            type: "guide",
            guideId: guide.id,
          });
        }
      }

      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX];
        for (const point of points) {
          if (point - x >= MIN_SIZE) {
            xCandidates.push({ point, type: "element" });
          }
        }
      }

      const bestX = findBestSnap(right, xCandidates);
      if (bestX) {
        width = Math.max(MIN_SIZE, bestX.point - x);
      }
    } else if (resizesFromLeft) {
      if (right - minLeftBoundary >= MIN_SIZE) {
        xCandidates.push({
          point: minLeftBoundary,
          type: "edge",
          edge: "left",
        });
      }

      for (const guide of store.guides) {
        if (guide.type === "vertical" && right - guide.position >= MIN_SIZE) {
          xCandidates.push({
            point: guide.position,
            type: "guide",
            guideId: guide.id,
          });
        }
      }

      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX];
        for (const point of points) {
          if (right - point >= MIN_SIZE) {
            xCandidates.push({ point, type: "element" });
          }
        }
      }

      const bestX = findBestSnap(x, xCandidates);
      if (bestX) {
        x = bestX.point;
        width = Math.max(MIN_SIZE, right - x);
      }
    }

    if (resizesFromBottom) {
      if (maxBottomBoundary - y >= MIN_SIZE) {
        yCandidates.push({
          point: maxBottomBoundary,
          type: "edge",
          edge: "bottom",
        });
      }

      for (const guide of store.guides) {
        if (guide.type === "horizontal" && guide.position - y >= MIN_SIZE) {
          yCandidates.push({
            point: guide.position,
            type: "guide",
            guideId: guide.id,
          });
        }
      }

      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY];
        for (const point of points) {
          if (point - y >= MIN_SIZE) {
            yCandidates.push({ point, type: "element" });
          }
        }
      }

      const bestY = findBestSnap(bottom, yCandidates);
      if (bestY) {
        height = Math.max(MIN_SIZE, bestY.point - y);
      }
    } else if (resizesFromTop) {
      if (bottom - minTopBoundary >= MIN_SIZE) {
        yCandidates.push({
          point: minTopBoundary,
          type: "edge",
          edge: "top",
        });
      }

      for (const guide of store.guides) {
        if (guide.type === "horizontal" && bottom - guide.position >= MIN_SIZE) {
          yCandidates.push({
            point: guide.position,
            type: "guide",
            guideId: guide.id,
          });
        }
      }

      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY];
        for (const point of points) {
          if (bottom - point >= MIN_SIZE) {
            yCandidates.push({ point, type: "element" });
          }
        }
      }

      const bestY = findBestSnap(y, yCandidates);
      if (bestY) {
        y = bestY.point;
        height = Math.max(MIN_SIZE, bottom - y);
      }
    }

    const bestX =
      resizesFromLeft || resizesFromRight
        ? findBestSnap(
            resizesFromLeft ? x : x + width,
            xCandidates,
          )
        : null;
    const bestY =
      resizesFromTop || resizesFromBottom
        ? findBestSnap(
            resizesFromTop ? y : y + height,
            yCandidates,
          )
        : null;

    const highlightedAlignedElementIds = new Set<string>();
    if (bestX?.type === "element") {
      const snappedX = resizesFromLeft ? x : x + width;
      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX];
        if (points.some((point) => Math.abs(point - snappedX) <= ALIGN_EPSILON)) {
          highlightedAlignedElementIds.add(item.id);
        }
      }
    }
    if (bestY?.type === "element") {
      const snappedY = resizesFromTop ? y : y + height;
      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        const points = [bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY];
        if (points.some((point) => Math.abs(point - snappedY) <= ALIGN_EPSILON)) {
          highlightedAlignedElementIds.add(item.id);
        }
      }
    }

    let highlightedEdge: "left" | "top" | "right" | "bottom" | null = null;
    if (bestX?.type === "edge") {
      highlightedEdge = bestX.edge || null;
    }
    if (!highlightedEdge && bestY?.type === "edge") {
      highlightedEdge = bestY.edge || null;
    }

    let highlightedGuideId: string | null = null;
    if (bestX?.type === "guide") {
      highlightedGuideId = bestX.guideId || null;
    }
    if (!highlightedGuideId && bestY?.type === "guide") {
      highlightedGuideId = bestY.guideId || null;
    }

    return {
      x,
      y,
      width,
      height,
      highlightedEdge,
      highlightedGuideId,
      highlightedAlignedElementIds: Array.from(highlightedAlignedElementIds),
    };
  };

  const startX = e.clientX;
  const startY = e.clientY;
  const initialLeft = props.element.x;
  const initialTop = props.element.y;
  const initialWidth = props.element.width;
  const initialHeight = props.element.height;
  const initialRight = initialLeft + initialWidth;
  const initialBottom = initialTop + initialHeight;

  // For proportional (Shift+corner) resize: lock the driving axis at drag start
  // so it never switches mid-drag and causes jitter.
  // "width drives" = true means width is the reference axis; false = height drives.
  const isCornerHandle =
    (direction === "top-left" || direction === "top-right" ||
     direction === "bottom-left" || direction === "bottom-right");
  // Default: the axis whose initial dimension is larger drives (wider → width drives).
  const proportionalWidthDrives = initialWidth >= initialHeight;
  const isTableResize = props.element.type === ElementType.TABLE;
  const MIN_TABLE_CELL_SIZE = 0.01;

  const toFinitePositive = (value: unknown): number | null => {
    const parsed =
      typeof value === "number"
        ? value
        : Number.parseFloat(String(value ?? ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const getRowMetricsFromElements = (
    rows: HTMLElement[],
  ): SectionRowMetrics => {
    const heights = rows
      .map((row) =>
        toFinitePositive(row.getBoundingClientRect().height / props.zoom),
      )
      .filter((height): height is number => height !== null);

    return {
      rowCount: heights.length,
      totalHeight: heights.reduce((total, height) => total + height, 0),
      firstHeight: heights[0] ?? null,
      heights,
    };
  };

  const getRowMetrics = (selector: string): SectionRowMetrics => {
    const host = elementRef.value;
    if (!host)
      return { rowCount: 0, totalHeight: 0, firstHeight: null, heights: [] };
    return getRowMetricsFromElements(
      Array.from(host.querySelectorAll<HTMLElement>(selector)),
    );
  };

  const getCellSectionRowMetrics = (selector: string): SectionRowMetrics => {
    const host = elementRef.value;
    if (!host)
      return { rowCount: 0, totalHeight: 0, firstHeight: null, heights: [] };

    const rowSet = new Set<HTMLElement>();
    for (const cell of Array.from(
      host.querySelectorAll<HTMLElement>(selector),
    )) {
      const row = cell.closest("tr") as HTMLElement | null;
      if (row) rowSet.add(row);
    }

    return getRowMetricsFromElements(Array.from(rowSet));
  };

  const getRowStyleHeight = (row: any) => {
    if (!row || typeof row !== "object") return null;

    for (const key of Object.keys(row)) {
      const cell = row[key];
      if (!cell || typeof cell !== "object") continue;
      const height = toFinitePositive((cell.style as any)?.height);
      if (height) return height;
    }

    return null;
  };

  const getRowsStyleHeights = (rows: any[] | null) => {
    return Array.isArray(rows)
      ? rows.map((row) => getRowStyleHeight(row) || 0)
      : [];
  };

  const getColumnWidths = (columns: any[] | null) => {
    return Array.isArray(columns)
      ? columns.map((col) => toFinitePositive(col.width) || 0)
      : [];
  };

  const areUniformlyScaled = (base: number[], current: number[]) => {
    if (base.length !== current.length) return false;

    let scale: number | null = null;
    for (let index = 0; index < base.length; index += 1) {
      const baseValue = base[index];
      const currentValue = current[index];
      if (baseValue <= 0 && currentValue <= 0) continue;
      if (baseValue <= 0 || currentValue <= 0) return false;

      const nextScale = currentValue / baseValue;
      if (scale === null) {
        scale = nextScale;
        continue;
      }

      const tolerance = Math.max(0.03, 1.5 / Math.max(baseValue, currentValue));
      if (Math.abs(nextScale - scale) > tolerance) return false;
    }

    return true;
  };

  const isCurrentTableResizeBaseDerivedFromReference = (
    reference: TableResizeBase,
    current: TableResizeBase,
  ) => {
    return (
      areUniformlyScaled(
        getColumnWidths(reference.columns),
        getColumnWidths(current.columns),
      ) &&
      areUniformlyScaled(
        getRowsStyleHeights(reference.data),
        getRowsStyleHeights(current.data),
      ) &&
      areUniformlyScaled(
        getRowsStyleHeights(reference.footerData),
        getRowsStyleHeights(current.footerData),
      )
    );
  };

  const getTableResizeStructureSignature = () => {
    const columnSignature = Array.isArray(props.element.columns)
      ? props.element.columns.map((col) => col.field).join("|")
      : "";
    const dataCount = Array.isArray(props.element.data)
      ? props.element.data.length
      : 0;
    const footerCount = Array.isArray(props.element.footerData)
      ? props.element.footerData.length
      : 0;

    return `${columnSignature}/${dataCount}/${footerCount}`;
  };

  const captureTableResizeBase = (): TableResizeBase => ({
    elementId: props.element.id,
    width: Math.max(MIN_SIZE, props.element.width || initialWidth),
    height: Math.max(MIN_SIZE, props.element.height || initialHeight),
    columns: Array.isArray(props.element.columns)
      ? props.element.columns.map((col) => ({ ...col }))
      : null,
    style: { ...(props.element.style || {}) },
    data: Array.isArray(props.element.data)
      ? JSON.parse(JSON.stringify(props.element.data))
      : null,
    footerData: Array.isArray(props.element.footerData)
      ? JSON.parse(JSON.stringify(props.element.footerData))
      : null,
    headerMetrics: getRowMetrics("thead tr"),
    bodyMetrics: getRowMetrics("tbody tr:not([data-table-spacer-row])"),
    footerMetrics: getCellSectionRowMetrics('td[data-section="footer"]'),
    structureSignature: getTableResizeStructureSignature(),
  });

  const currentTableResizeBase = isTableResize
    ? captureTableResizeBase()
    : null;
  if (currentTableResizeBase) {
    const reference = tableResizeReference.value;
    const shouldReplaceReference =
      !reference ||
      reference.elementId !== props.element.id ||
      reference.structureSignature !==
        currentTableResizeBase.structureSignature ||
      !isCurrentTableResizeBaseDerivedFromReference(
        reference,
        currentTableResizeBase,
      ) ||
      (currentTableResizeBase.width >= reference.width - 0.5 &&
        currentTableResizeBase.height >= reference.height - 0.5);

    if (shouldReplaceReference) {
      tableResizeReference.value = currentTableResizeBase;
    }
  }

  const scaleRowsCellStyleHeight = (
    rows: any[] | null,
    scaleY: number,
  ): { rows: any[] | null; changed: boolean } => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { rows, changed: false };
    }

    const nextRows = JSON.parse(JSON.stringify(rows));
    let changed = false;

    for (const row of nextRows) {
      if (!row || typeof row !== "object") continue;
      for (const key of Object.keys(row)) {
        const cell = row[key];
        if (!cell || typeof cell !== "object") continue;
        const style = cell.style;
        if (!style || typeof style !== "object") continue;

        const rawHeight = (style as any).height;
        const parsedHeight = toFinitePositive(rawHeight);
        if (!parsedHeight) continue;

        const scaledHeight = Number(
          Math.max(MIN_TABLE_CELL_SIZE, parsedHeight * scaleY).toFixed(2),
        );
        row[key] = {
          ...cell,
          style: {
            ...(style as any),
            height: `${scaledHeight}px`,
          },
        };
        changed = true;
      }
    }

    return { rows: nextRows, changed };
  };

  const tableResizeBase = isTableResize
    ? tableResizeReference.value || currentTableResizeBase
    : null;

  const buildScaledTableUpdates = (
    width: number,
    height: number,
  ): Partial<PrintElement> => {
    if (
      !tableResizeBase ||
      tableResizeBase.width <= 0 ||
      tableResizeBase.height <= 0
    ) {
      return { width, height };
    }

    const scaleX = width / tableResizeBase.width;
    const updates: Partial<PrintElement> = {
      width,
      height,
    };

    if (Array.isArray(tableResizeBase.columns)) {
      const scaledColumns = tableResizeBase.columns.map((col) => {
        const baseWidth = toFinitePositive(col.width) || 1;
        return {
          ...col,
          width: Math.max(MIN_TABLE_CELL_SIZE, baseWidth * scaleX),
        };
      });
      const totalScaledWidth = scaledColumns.reduce(
        (total, col) => total + (toFinitePositive(col.width) || 0),
        0,
      );
      const columnNormalizeScale =
        totalScaledWidth > 0 ? width / totalScaledWidth : 1;
      updates.columns = scaledColumns.map((col) => ({
        ...col,
        width: Number(
          Math.max(
            MIN_TABLE_CELL_SIZE,
            (toFinitePositive(col.width) || MIN_TABLE_CELL_SIZE) *
              columnNormalizeScale,
          ).toFixed(2),
        ),
      }));
    }

    // Keep row heights stable when resizing the table by wrapper handle.
    // Only table frame size and column widths are scaled here.

    return updates;
  };
  hasSnapshot = false;
  store.setDragging(true);
  store.setResizing(true);
  store.setRotating(false);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
  store.setHighlightedAlignedElements([]);

  const handleResizeMove = (moveEvent: MouseEvent) => {
    const rawDx = (moveEvent.clientX - startX) / props.zoom;
    const rawDy = (moveEvent.clientY - startY) / props.zoom;

    if (!hasSnapshot) {
      store.snapshot("editor.historyAction.elementResize");
      hasSnapshot = true;
    }

    // Resize must follow the element's current orientation. The wrapper is rotated via
    // CSS transform, so a screen-space mouse delta has to be projected onto the element's
    // local width/height axes; and the opposite anchor (corner/edge) must stay fixed in
    // SCREEN space, otherwise the element drifts because rotation pivots around its center.
    // At rotation 0 (cos=1, sin=0) every formula below reduces to the original behavior.
    const rotationDeg = props.element.style.rotate || 0;
    const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
    const isRotated = normalizedRotation > 0.01 && normalizedRotation < 359.99;
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = rawDx * cos + rawDy * sin; // delta along local width axis
    const dy = -rawDx * sin + rawDy * cos; // delta along local height axis

    let newWidth = initialWidth;
    let newHeight = initialHeight;

    if (moveEvent.shiftKey && isCornerHandle && initialWidth > 0 && initialHeight > 0) {
      // --- Shift + corner handle: proportional resize ---
      // Always use the locked driving axis so there is no per-frame oscillation.
      const aspectRatio = initialWidth / initialHeight;
      let effectiveDx: number;
      let effectiveDy: number;
      if (proportionalWidthDrives) {
        effectiveDx = dx;
        effectiveDy = (Math.abs(dx) / aspectRatio) * Math.sign(dy || dx);
      } else {
        effectiveDy = dy;
        effectiveDx = Math.abs(dy) * aspectRatio * Math.sign(dx || dy);
      }
      newWidth = resizesFromRight
        ? initialWidth + effectiveDx
        : initialWidth - effectiveDx;
      newHeight = resizesFromBottom
        ? initialHeight + effectiveDy
        : initialHeight - effectiveDy;
    } else {
      // --- Normal resize ---
      if (resizesFromRight) newWidth = initialWidth + dx;
      else if (resizesFromLeft) newWidth = initialWidth - dx;

      if (resizesFromBottom) newHeight = initialHeight + dy;
      else if (resizesFromTop) newHeight = initialHeight - dy;
    }

    if (newWidth < MIN_SIZE) newWidth = MIN_SIZE;
    if (newHeight < MIN_SIZE) newHeight = MIN_SIZE;

    // Keep the opposite anchor fixed in screen space. ax/ay are the anchor's sign along
    // the element's local axes relative to its center (the edge that should NOT move).
    const ax = resizesFromLeft ? 1 : resizesFromRight ? -1 : 0;
    const ay = resizesFromTop ? 1 : resizesFromBottom ? -1 : 0;
    const cx0 = initialLeft + initialWidth / 2;
    const cy0 = initialTop + initialHeight / 2;
    const ah0x = (ax * initialWidth) / 2;
    const ah0y = (ay * initialHeight) / 2;
    const anchorScreenX = cx0 + (ah0x * cos - ah0y * sin);
    const anchorScreenY = cy0 + (ah0x * sin + ah0y * cos);
    const ahNx = (ax * newWidth) / 2;
    const ahNy = (ay * newHeight) / 2;
    const cxNew = anchorScreenX - (ahNx * cos - ahNy * sin);
    const cyNew = anchorScreenY - (ahNx * sin + ahNy * cos);
    const newX = cxNew - newWidth / 2;
    const newY = cyNew - newHeight / 2;

    const isProportional = moveEvent.shiftKey && isCornerHandle;

    // Model-space snapping (guides/edges/sibling alignment) only makes sense for an
    // axis-aligned (unrotated) bounding box; skip it once the element is rotated.
    const snapped = isRotated
      ? {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          highlightedEdge: null as ResizeEdge | null,
          highlightedGuideId: null as string | null,
          highlightedAlignedElementIds: [] as string[],
        }
      : getResizeSnapResult(newX, newY, newWidth, newHeight);

    if (!isRotated && isProportional && initialWidth > 0 && initialHeight > 0) {
      const aspectRatio = initialWidth / initialHeight;
      // Recompute non-driving axis from the snapped driving-axis value.
      // Also fix the anchor position for edges that move (left/top).
      if (proportionalWidthDrives) {
        snapped.height = snapped.width / aspectRatio;
        if (resizesFromTop)  snapped.y = initialBottom - snapped.height;
        if (resizesFromLeft) snapped.x = initialRight  - snapped.width;
      } else {
        snapped.width = snapped.height * aspectRatio;
        if (resizesFromLeft) snapped.x = initialRight  - snapped.width;
        if (resizesFromTop)  snapped.y = initialBottom - snapped.height;
      }
    }

    store.setHighlightedGuide(snapped.highlightedGuideId || null);
    store.setHighlightedEdge(snapped.highlightedEdge || null);
    store.setHighlightedAlignedElements(
      snapped.highlightedAlignedElementIds || [],
    );

    const embeddedCellBounds = getEmbeddedCellBounds();
    if (embeddedCellBounds) {
      maybeExpandEmbeddedCell(
        snapped.width,
        snapped.height,
        embeddedCellBounds,
      );
    }

    const updates = isTableResize
      ? buildScaledTableUpdates(snapped.width, snapped.height)
      : {
          width: snapped.width,
          height: snapped.height,
        };

    updates.x = snapped.x;
    updates.y = snapped.y;

    store.updateElement(props.element.id, updates, false);
  };

  const handleResizeUp = () => {
    store.setDragging(false);
    store.setResizing(false);
    store.setHighlightedGuide(null);
    store.setHighlightedEdge(null);
    store.setHighlightedAlignedElements([]);
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeUp);
  };

  window.addEventListener("mousemove", handleResizeMove);
  window.addEventListener("mouseup", handleResizeUp);
};
</script>

<template>
  <div
    ref="elementRef"
    class="element-wrapper absolute select-none"
    :data-element-id="element.id"
    :data-read-only="readOnly ? 'true' : 'false'"
    :data-repeat-per-page="element.repeatPerPage === true ? 'true' : null"
    :data-print-exclude="element.printable === false ? 'true' : null"
    :data-embedded-table-id="element.embeddedInTableId || null"
    :data-embedded-cell-row-index="
      element.embeddedInTableCell
        ? String(element.embeddedInTableCell.rowIndex)
        : null
    "
    :data-embedded-cell-col-field="
      element.embeddedInTableCell?.colField || null
    "
    :data-embedded-cell-section="
      element.embeddedInTableCell
        ? element.embeddedInTableCell.section || 'body'
        : null
    "
    :data-embedded-anchor-offset-x-ratio="
      element.embeddedInTableAnchor?.offsetXRatio ?? null
    "
    :data-embedded-anchor-offset-y-ratio="
      element.embeddedInTableAnchor?.offsetYRatio ?? null
    "
    :data-embedded-anchor-width-ratio="
      element.embeddedInTableAnchor?.widthRatio ?? null
    "
    :data-embedded-anchor-height-ratio="
      element.embeddedInTableAnchor?.heightRatio ?? null
    "
    :data-embedded-anchor-fills-width="
      element.embeddedInTableAnchor?.fillsWidth === true ? 'true' : null
    "
    :data-embedded-anchor-fills-height="
      element.embeddedInTableAnchor?.fillsHeight === true ? 'true' : null
    "
    :data-alignment-target="isAlignmentTarget ? 'true' : null"
    :class="[
      readOnly ? 'cursor-not-allowed' : '',
      !readOnly && element.locked ? 'cursor-not-allowed' : '',
      !readOnly && !element.locked ? 'cursor-move' : '',
    ]"
    :style="style"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @mousedown="handleMouseDown"
  >
    <!-- Slot for specific element content -->
    <slot></slot>

    <!-- Placeholder dashed outline — always visible in edit mode -->
    <div
      v-if="!readOnly"
      data-print-exclude="true"
      class="absolute inset-0 pointer-events-none z-10"
      :style="{
        borderWidth: oneDevicePixelInCanvasPx,
        borderStyle: 'dashed',
        borderColor: 'rgba(100,130,200,0.25)',
      }"
    ></div>

    <div
      v-if="borderOverlayStyle"
      class="absolute inset-0 pointer-events-none z-20"
      :style="borderOverlayStyle"
    ></div>

    <div
      v-if="!readOnly && !actualIsSelected"
      data-print-exclude="true"
      :class="[
        // 不用 transition-opacity：opacity 过渡会在鼠标进出元素时创建/销毁合成层，
        // 触发缩放画布整体重栅格化，非整数 zoom 下表现为页面内容亚像素抖动。
        'absolute inset-0 box-border border pointer-events-none z-30',
        isHovered || forceHover ? 'opacity-100' : 'opacity-0',
      ]"
      :style="{
        borderColor: 'var(--brand-300)',
        borderWidth: oneDevicePixelInCanvasPx,
      }"
    ></div>

    <div
      v-if="actualIsSelected"
      data-print-exclude="true"
      :class="[
        'absolute inset-0 box-border border pointer-events-none z-40',
        element.locked ? 'border-red-500' : 'theme-border-strong',
      ]"
      :style="{ borderWidth: oneDevicePixelInCanvasPx }"
    ></div>

    <template v-if="isAlignmentTarget && element.type !== ElementType.MULTI_LABEL">
      <div
        data-print-exclude="true"
        class="absolute inset-0 pointer-events-none z-30"
      >
        <div
          class="absolute inset-0 border theme-border"
          :style="{ borderWidth: oneDevicePixelInCanvasPx }"
        ></div>
        <div
          class="absolute inset-0"
          style="background-color: var(--brand-500-alpha-10)"
        ></div>
        <AlignmentCenterCross />
      </div>
    </template>

    <!-- Locked Indicator -->
    <div
      v-if="!readOnly && element.locked && isSelected"
      data-print-exclude="true"
      class="absolute -top-3 -right-3 bg-red-500 rounded-full p-1 shadow-md z-50"
    >
      <Lock class="w-3 h-3 text-white" />
    </div>

    <!-- Resize Handles (only visible when selected and not multi-selected) -->
    <template
      v-if="
        !readOnly &&
        isSelected &&
        store.selectedElementIds.length <= 1 &&
        !element.locked
      "
    >
      <!-- Resize Handles (absolute children, centered on selection border) -->
        <!-- Edge handles -->
        <div
          data-print-exclude="true"
          class="resize-handle absolute theme-bg opacity-85 hover:opacity-100"
          :style="[resizeHandleStyles.left, { cursor: resizeHandleCursors.left }]"
          @mousedown="(e) => handleResizeStart(e, 'left')"
        ></div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute theme-bg opacity-85 hover:opacity-100"
          :style="[resizeHandleStyles.right, { cursor: resizeHandleCursors.right }]"
          @mousedown="(e) => handleResizeStart(e, 'right')"
        ></div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute theme-bg opacity-85 hover:opacity-100"
          :style="[resizeHandleStyles.top, { cursor: resizeHandleCursors.top }]"
          @mousedown="(e) => handleResizeStart(e, 'top')"
        ></div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute theme-bg opacity-85 hover:opacity-100"
          :style="[resizeHandleStyles.bottom, { cursor: resizeHandleCursors.bottom }]"
          @mousedown="(e) => handleResizeStart(e, 'bottom')"
        ></div>

        <!-- Corner L-handles -->
        <div
          data-print-exclude="true"
          class="resize-handle absolute opacity-90 hover:opacity-100"
          :style="[resizeHandleStyles.topLeftCorner, { cursor: resizeHandleCursors.topLeft }]"
          @mousedown="(e) => handleResizeStart(e, 'top-left')"
        >
          <span class="absolute theme-bg" :style="resizeHandleStyles.topLeftCornerH"></span>
          <span class="absolute theme-bg" :style="resizeHandleStyles.topLeftCornerV"></span>
        </div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute opacity-90 hover:opacity-100"
          :style="[resizeHandleStyles.topRightCorner, { cursor: resizeHandleCursors.topRight }]"
          @mousedown="(e) => handleResizeStart(e, 'top-right')"
        >
          <span class="absolute theme-bg" :style="resizeHandleStyles.topRightCornerH"></span>
          <span class="absolute theme-bg" :style="resizeHandleStyles.topRightCornerV"></span>
        </div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute opacity-90 hover:opacity-100"
          :style="[resizeHandleStyles.bottomLeftCorner, { cursor: resizeHandleCursors.bottomLeft }]"
          @mousedown="(e) => handleResizeStart(e, 'bottom-left')"
        >
          <span class="absolute theme-bg" :style="resizeHandleStyles.bottomLeftCornerH"></span>
          <span class="absolute theme-bg" :style="resizeHandleStyles.bottomLeftCornerV"></span>
        </div>
        <div
          data-print-exclude="true"
          class="resize-handle absolute opacity-90 hover:opacity-100"
          :style="[resizeHandleStyles.bottomRightCorner, { cursor: resizeHandleCursors.bottomRight }]"
          @mousedown="(e) => handleResizeStart(e, 'bottom-right')"
        >
          <span class="absolute theme-bg" :style="resizeHandleStyles.bottomRightCornerH"></span>
          <span class="absolute theme-bg" :style="resizeHandleStyles.bottomRightCornerV"></span>
        </div>

      <!-- Rotation Handle (top right, no background) — hidden for multi-label -->
      <div
        v-if="element.type !== ElementType.MULTI_LABEL"
        data-print-exclude="true"
        class="rotate-handle absolute -top-4 -right-5 w-5 h-5 flex items-center justify-center cursor-grab z-50 theme-text theme-text-hover"
        :title="t('common.rotate')"
        @mousedown="handleRotateStart"
      >
        <!-- Material Symbol Icon -->
        <RotateRight class="w-3 h-3" />

        <!-- Angle Tooltip -->
        <div
          v-if="isRotating"
          :class="[
            'absolute top-6 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none font-sans font-normal not-italic leading-none tracking-normal normal-case',
            isSnapped
              ? 'theme-bg-strong text-white'
              : 'theme-bg-soft text-white',
          ]"
        >
          {{ currentRotationDisplay }}°
        </div>
      </div>
    </template>
  </div>
</template>
