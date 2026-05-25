<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  nextTick,
  inject,
  type CSSProperties,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import { ElementType, type PrintElement } from "@/types";
import ElementWrapper from "../elements/ElementWrapper.vue";
import TextElement from "../elements/TextElement.vue";
import ImageElement from "../elements/ImageElement.vue";
import TableElement from "../elements/TableElement.vue";
import PageNumberElement from "../elements/PageNumberElement.vue";
import BarcodeElement from "../elements/BarcodeElement.vue";
import QRCodeElement from "../elements/QRCodeElement.vue";
import LineElement from "../elements/LineElement.vue";
import RectElement from "../elements/RectElement.vue";
import CircleElement from "../elements/CircleElement.vue";
import InputModal from "../common/InputModal.vue";
import AddIcon from "~icons/material-symbols/add";
import DeleteIcon from "~icons/material-symbols/delete";
import CopyIcon from "~icons/material-symbols/content-copy";
import PasteIcon from "~icons/material-symbols/content-paste";
import { createNewElement } from "../../utils/elementFactory";

const store = useDesignerStore();
const designerRoot = inject<Ref<HTMLElement | null>>(
  "designer-root",
  ref(null),
);
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const isHandPanActive = inject<Ref<boolean>>(
  "designer-hand-pan-active",
  ref(false),
);

type PendingTableCreateDrop = {
  x: number;
  y: number;
  pageIndex: number;
};

type StructurePanelHoverTarget = {
  elementId: string;
  pageIndex: number;
} | null;

type TableCreateMode = "testData" | "custom";

const CUSTOM_TABLE_MIN_COLUMNS = 1;
const CUSTOM_TABLE_MAX_COLUMNS = 20;
const CUSTOM_TABLE_MIN_ROWS = 1;
const CUSTOM_TABLE_MAX_ROWS = 100;
const CUSTOM_TABLE_DEFAULT_COLUMNS = 5;
const CUSTOM_TABLE_DEFAULT_ROWS = 10;
const CUSTOM_TABLE_DEFAULT_ROW_HEIGHT = 32;

const getQueryRoot = () => {
  return (
    (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document
  );
};
const { t } = useI18n();

const pages = computed(() => store.pages);
const zoom = computed(() => store.zoom);
const pageSpacingX = computed(() => store.pageSpacingX || 0);
const pageSpacingY = computed(() => store.pageSpacingY || 0);
const marginLeft = computed(() => store.pageSpacingX || 0);
const marginRight = computed(() => store.pageSpacingX || 0);
const marginTop = computed(() => store.pageSpacingY || 0);
const marginBottom = computed(() => store.pageSpacingY || 0);
const canvasSize = computed(() => store.canvasSize);
const isTemplateEditable = computed(() => store.isTemplateEditable);
const inverseZoom = computed(() => (zoom.value > 0 ? 1 / zoom.value : 1));
const pageActionsStyle = computed(() => ({
  transform: `scale(${inverseZoom.value})`,
  transformOrigin: "top right",
  right: `${-48 * inverseZoom.value}px`,
}));
const showTableCreateModal = ref(false);
const pendingTableCreateDrop = ref<PendingTableCreateDrop | null>(null);
const tableCreateInitialValues = computed(() => ({
  mode: "testData" as TableCreateMode,
  columns: CUSTOM_TABLE_DEFAULT_COLUMNS,
  rows: CUSTOM_TABLE_DEFAULT_ROWS,
}));
const tableCreateFields = computed(() => [
  {
    key: "mode",
    label: t("canvas.tableCreateMode"),
    type: "radio" as const,
    required: true,
    options: [
      {
        label: t("canvas.tableCreateWithTestData"),
        value: "testData",
      },
      {
        label: t("canvas.tableCreateCustom"),
        value: "custom",
      },
    ],
  },
  {
    key: "columns",
    label: t("canvas.tableCreateColumns"),
    type: "number" as const,
    required: true,
    min: CUSTOM_TABLE_MIN_COLUMNS,
    max: CUSTOM_TABLE_MAX_COLUMNS,
    step: 1,
    showWhen: { key: "mode", value: "custom" },
  },
  {
    key: "rows",
    label: t("canvas.tableCreateRows"),
    type: "number" as const,
    required: true,
    min: CUSTOM_TABLE_MIN_ROWS,
    max: CUSTOM_TABLE_MAX_ROWS,
    step: 1,
    showWhen: { key: "mode", value: "custom" },
  },
]);

const clampTableCount = (value: unknown, min: number, max: number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(max, Math.max(min, Math.round(numericValue)));
};

const createCustomTableElement = (
  x: number,
  y: number,
  columnCount: number,
  rowCount: number,
): Omit<PrintElement, "id"> => {
  const baseElement = createNewElement(ElementType.TABLE, x, y, t);
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    field: `col${index + 1}`,
    header: `${t("canvas.customTableColumnPrefix")} ${index + 1}`,
    width: 80,
  }));
  const data = Array.from({ length: rowCount }, () => {
    return columns.reduce<Record<string, string>>((row, col) => {
      row[col.field] = "";
      return row;
    }, {});
  });

  return {
    ...baseElement,
    width: Math.max(baseElement.width, columnCount * 80),
    style: {
      ...baseElement.style,
      rowHeight: CUSTOM_TABLE_DEFAULT_ROW_HEIGHT,
    },
    columns,
    data,
    showHeader: false,
    showFooter: false,
    tfootRepeat: false,
    autoPaginate: false,
    designOmitRows: false,
    footerData: [],
    footerDataVariable: "",
    customScript: "",
    customScriptVariable: "",
  };
};

const openTableCreateModal = (x: number, y: number, pageIndex: number) => {
  pendingTableCreateDrop.value = { x, y, pageIndex };
  showTableCreateModal.value = true;
};

const closeTableCreateModal = () => {
  showTableCreateModal.value = false;
  pendingTableCreateDrop.value = null;
};

const handleTableCreateSave = (payload: Record<string, any>) => {
  const pending = pendingTableCreateDrop.value;
  if (!pending) {
    closeTableCreateModal();
    return;
  }

  const mode = String(payload?.mode || "testData") as TableCreateMode;
  const newElement =
    mode === "custom"
      ? createCustomTableElement(
          pending.x,
          pending.y,
          clampTableCount(
            payload?.columns,
            CUSTOM_TABLE_MIN_COLUMNS,
            CUSTOM_TABLE_MAX_COLUMNS,
          ),
          clampTableCount(
            payload?.rows,
            CUSTOM_TABLE_MIN_ROWS,
            CUSTOM_TABLE_MAX_ROWS,
          ),
        )
      : createNewElement(ElementType.TABLE, pending.x, pending.y, t);

  store.addElement(newElement, pending.pageIndex);
  closeTableCreateModal();
};

// Header/Footer Dragging
const isDraggingLine = ref(false);
const draggingLineType = ref<"header" | "footer" | null>(null);
const draggingPageElement = ref<HTMLElement | null>(null);

const handleLineMouseDown = (e: MouseEvent, type: "header" | "footer") => {
  if (!store.isTemplateEditable) return;
  e.preventDefault();
  e.stopPropagation();

  isDraggingLine.value = true;
  draggingLineType.value = type;

  // Find the closest page element
  const target = e.target as HTMLElement;
  draggingPageElement.value = target.closest(".print-page") as HTMLElement;

  window.addEventListener("mousemove", handleLineMouseMove);
  window.addEventListener("mouseup", handleLineMouseUp);
};

const handleLineMouseMove = (e: MouseEvent) => {
  if (!isDraggingLine.value || !draggingPageElement.value) return;

  const rect = draggingPageElement.value.getBoundingClientRect();
  const relativeY = (e.clientY - rect.top) / store.zoom;

  // Clamp values
  const clampedY = Math.max(0, Math.min(store.canvasSize.height, relativeY));

  if (draggingLineType.value === "header") {
    const marginTop = store.pageSpacingY || 0;
    const val = Math.max(0, clampedY - marginTop);
    store.setHeaderHeight(Math.round(val));
  } else if (draggingLineType.value === "footer") {
    const marginBottom = store.pageSpacingY || 0;
    const val = Math.max(0, store.canvasSize.height - clampedY - marginBottom);
    store.setFooterHeight(Math.round(val));
  }
};

const handleLineMouseUp = () => {
  isDraggingLine.value = false;
  draggingLineType.value = null;
  draggingPageElement.value = null;

  window.removeEventListener("mousemove", handleLineMouseMove);
  window.removeEventListener("mouseup", handleLineMouseUp);
};

type HeaderFooterLineType = "header" | "footer";
type HeaderFooterLineSpanMode = "value" | "percent";
const DEFAULT_HEADER_FOOTER_LINE_COLOR = "#f87171";

const normalizeHeaderFooterLineStyle = (
  value: unknown,
): "solid" | "dashed" | "dotted" => {
  return value === "solid" || value === "dotted" ? value : "dashed";
};

const normalizeHeaderFooterLineSpanMode = (
  value: unknown,
): HeaderFooterLineSpanMode => {
  return value === "percent" ? "percent" : "value";
};

const normalizeHeaderFooterLineSpan = (
  value: unknown,
  mode: HeaderFooterLineSpanMode,
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return mode === "percent" ? 100 : 100;
  if (mode === "percent") {
    return Math.min(100, Math.max(1, Number(numeric.toFixed(2))));
  }
  return Math.max(1, Math.round(numeric));
};

const getHeaderFooterLineWidth = (type: HeaderFooterLineType) => {
  if (!store.enableHeaderFooterLineRendering) return 1;
  const raw = type === "header" ? store.headerLineWidth : store.footerLineWidth;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.round(numeric));
};

const getHeaderFooterLineColor = (type: HeaderFooterLineType) => {
  if (!store.enableHeaderFooterLineRendering) {
    return DEFAULT_HEADER_FOOTER_LINE_COLOR;
  }
  const color =
    type === "header" ? store.headerLineColor : store.footerLineColor;
  return typeof color === "string" && color.trim()
    ? color
    : DEFAULT_HEADER_FOOTER_LINE_COLOR;
};

const getHeaderFooterLineStyle = (
  type: HeaderFooterLineType,
): "solid" | "dashed" | "dotted" => {
  if (!store.enableHeaderFooterLineRendering) return "dashed";
  const style =
    type === "header" ? store.headerLineStyle : store.footerLineStyle;
  return normalizeHeaderFooterLineStyle(style);
};

const getPrintableLineAvailableWidth = () => {
  return Math.max(
    1,
    store.canvasSize.width - marginLeft.value - marginRight.value,
  );
};

const getHeaderFooterLineSpanPixels = (type: HeaderFooterLineType) => {
  const available = getPrintableLineAvailableWidth();
  if (!store.enableHeaderFooterLineRendering) return available;

  const mode = normalizeHeaderFooterLineSpanMode(
    type === "header" ? store.headerLineSpanMode : store.footerLineSpanMode,
  );
  const rawSpan =
    type === "header" ? store.headerLineSpan : store.footerLineSpan;
  const span = normalizeHeaderFooterLineSpan(rawSpan, mode);

  if (mode === "percent") {
    return Math.max(1, Math.min(available, (available * span) / 100));
  }
  return Math.max(1, Math.min(available, span));
};

const shouldIncludeHeaderFooterLineInPrint = computed(() => {
  return Boolean(store.enableHeaderFooterLineRendering);
});

const getHeaderFooterLineHitArea = (type: HeaderFooterLineType) => {
  const lineWidth = getHeaderFooterLineWidth(type);
  return Math.max(12, lineWidth + 10);
};

const headerLineStrokeStyle = computed<CSSProperties>(() => ({
  borderTopWidth: `${getHeaderFooterLineWidth("header")}px`,
  borderTopStyle: getHeaderFooterLineStyle("header"),
  borderTopColor: getHeaderFooterLineColor("header"),
  width: `${getHeaderFooterLineSpanPixels("header")}px`,
  marginLeft: "auto",
  marginRight: "auto",
}));

const footerLineStrokeStyle = computed<CSSProperties>(() => ({
  borderTopWidth: `${getHeaderFooterLineWidth("footer")}px`,
  borderTopStyle: getHeaderFooterLineStyle("footer"),
  borderTopColor: getHeaderFooterLineColor("footer"),
  width: `${getHeaderFooterLineSpanPixels("footer")}px`,
  marginLeft: "auto",
  marginRight: "auto",
}));

const headerLineHitAreaStyle = computed(() => {
  const hitArea = getHeaderFooterLineHitArea("header");
  return {
    height: `${hitArea}px`,
    marginTop: `${-hitArea / 2}px`,
  };
});

const footerLineHitAreaStyle = computed(() => {
  const hitArea = getHeaderFooterLineHitArea("footer");
  return {
    height: `${hitArea}px`,
    marginBottom: `${-hitArea / 2}px`,
  };
});

onUnmounted(() => {
  window.removeEventListener("mousemove", handleLineMouseMove);
  window.removeEventListener("mouseup", handleLineMouseUp);
});

const pageStyle = computed(() => {
  const base = {
    width: `${store.canvasSize.width}px`,
    height: `${store.canvasSize.height}px`,
    backgroundColor: store.canvasBackground,
  } as const;

  if (!watermarkStyle.value) return base;
  return { ...base, ...watermarkStyle.value } as const;
});

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const watermarkStyle = computed(() => {
  const watermark = store.watermark;
  if (!watermark || !watermark.enabled || !watermark.text) return null;

  const text = escapeXml(watermark.text);
  const angle = Number.isFinite(watermark.angle) ? watermark.angle : -30;
  const size = Math.max(6, watermark.size || 24);
  const density = Math.max(40, watermark.density || 160);
  const color = watermark.color || "#000000";
  const opacity = Math.min(1, Math.max(0, watermark.opacity ?? 0.1));

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${density}" height="${density}">` +
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"` +
    ` fill="${color}" fill-opacity="${opacity}" font-size="${size}"` +
    ` transform="rotate(${angle} ${density / 2} ${density / 2})">${text}</text>` +
    `</svg>`;

  const encoded = encodeURIComponent(svg);
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundRepeat: "repeat",
    backgroundSize: `${density}px ${density}px`,
  } as const;
});

// Selection box state
const isBoxSelecting = ref(false);
const boxSelectionStart = ref({ x: 0, y: 0 });
const boxSelectionEnd = ref({ x: 0, y: 0 });
const currentSelectingPageIndex = ref<number | null>(null);
const justFinishedBoxSelection = ref(false);

const selectionBoxStyle = computed(() => {
  if (!isBoxSelecting.value) return { display: "none" } as const;

  const x = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  const width = Math.abs(boxSelectionEnd.value.x - boxSelectionStart.value.x);
  const height = Math.abs(boxSelectionEnd.value.y - boxSelectionStart.value.y);

  return {
    position: "absolute" as const,
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    border: "1px solid var(--brand-500)",
    backgroundColor: "var(--brand-500-alpha-10)",
    pointerEvents: "none" as const,
    zIndex: 1000,
  };
});

const getComponent = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT:
      return TextElement;
    case ElementType.IMAGE:
      return ImageElement;
    case ElementType.TABLE:
      return TableElement;
    case ElementType.PAGE_NUMBER:
      return PageNumberElement;
    case ElementType.BARCODE:
      return BarcodeElement;
    case ElementType.QRCODE:
      return QRCodeElement;
    case ElementType.LINE:
      return LineElement;
    case ElementType.RECT:
      return RectElement;
    case ElementType.CIRCLE:
      return CircleElement;
    default:
      return TextElement;
  }
};

const isRenderableElement = (
  element: PrintElement | null | undefined,
): element is PrintElement => {
  return (
    !!element &&
    typeof element.id === "string" &&
    typeof element.type === "string"
  );
};

const getRenderableElements = (
  elements: Array<PrintElement | null | undefined>,
) => {
  return elements.filter(isRenderableElement);
};

const selectedElementIdSet = computed(() => {
  const ids = new Set(store.selectedElementIds);
  if (store.selectedElementId) {
    ids.add(store.selectedElementId);
  }
  return ids;
});

const isElementSelected = (id: string) => selectedElementIdSet.value.has(id);

const pageHasSelection = computed(() => {
  return pages.value.map((page) =>
    getRenderableElements(page.elements).some((element) =>
      isElementSelected(element.id),
    ),
  );
});

const shouldClipElementToPage = (pageIndex: number, elementId: string) => {
  return (
    Boolean(pageHasSelection.value[pageIndex]) && !isElementSelected(elementId)
  );
};

const toAtVariable = (raw: string) => {
  const normalized = String(raw || "").trim();
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
};

type DragPayload = {
  type?: ElementType;
  payload?: PrintElement;
  variable?: string;
  dataVariable?: string;
};

const VARIABLE_DRAG_MIME = "application/x-print-designer-variable";
const DATA_VARIABLE_DRAG_MIME = "application/x-print-designer-data-variable";
const DIRECT_VARIABLE_BINDING_TYPES = new Set<ElementType>([
  ElementType.TEXT,
  ElementType.IMAGE,
  ElementType.BARCODE,
  ElementType.QRCODE,
]);

type VariableDropTargetKind = "text" | "directVariable" | "table";
type TableCellDropTarget = {
  rowIndex: number;
  colField: string;
  section: "body" | "footer";
};
type VariableDropTarget = {
  element: PrintElement;
  kind: VariableDropTargetKind | "tableCell";
  tableCell?: TableCellDropTarget;
};
type TableVariableBindingKey =
  | "variable"
  | "columnsVariable"
  | "footerDataVariable"
  | "customScriptVariable";

const TABLE_VARIABLE_BINDING_KEYS: TableVariableBindingKey[] = [
  "variable",
  "columnsVariable",
  "footerDataVariable",
  "customScriptVariable",
];

const variableDropHover = ref<{
  pageIndex: number;
  elementId: string;
  tableCell?: TableCellDropTarget;
} | null>(null);

const showTableVariableTargetModal = ref(false);
const pendingTableVariableDrop = ref<{
  elementId: string;
  atVariable: string;
  suggestedTarget: TableVariableBindingKey;
} | null>(null);

const tableVariableTargetFields = computed(() => [
  {
    key: "target",
    label: t("canvas.tableVariableTargetLabel"),
    type: "select" as const,
    required: true,
    options: [
      {
        label: t("properties.label.dataVariable"),
        value: "variable",
      },
      {
        label: t("properties.label.columnsVariable"),
        value: "columnsVariable",
      },
      {
        label: t("properties.label.footerDataVariable"),
        value: "footerDataVariable",
      },
      {
        label: t("properties.label.customScriptVariable"),
        value: "customScriptVariable",
      },
    ],
  },
]);

const tableVariableTargetInitialValues = computed(() => ({
  target: pendingTableVariableDrop.value?.suggestedTarget || "variable",
}));

const VARIABLE_TOKEN_RE = /@[A-Za-z0-9_.-]+/;

const parseDragPayload = (event: DragEvent): DragPayload | null => {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return null;

  const raw = dataTransfer.getData("application/json");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DragPayload;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      // Fallback for browsers where JSON payload is empty during dragover.
    }
  }

  const types = Array.from(dataTransfer.types || []);
  const hasVariableMime = types.includes(VARIABLE_DRAG_MIME);
  const hasDataVariableMime = types.includes(DATA_VARIABLE_DRAG_MIME);

  if (!hasVariableMime && !hasDataVariableMime) {
    return null;
  }

  const plainValue = dataTransfer.getData("text/plain");
  return {
    variable: hasVariableMime
      ? dataTransfer.getData(VARIABLE_DRAG_MIME) || plainValue
      : undefined,
    dataVariable: hasDataVariableMime
      ? dataTransfer.getData(DATA_VARIABLE_DRAG_MIME) || plainValue
      : undefined,
  };
};

const isVariableDragPayload = (
  payload: DragPayload | null,
): payload is DragPayload => {
  return Boolean(
    payload &&
    (payload.variable !== undefined || payload.dataVariable !== undefined),
  );
};

const normalizeTableCellSection = (section?: string): "body" | "footer" => {
  return section === "footer" ? "footer" : "body";
};

const getSelectedTableCellDropTarget = (
  tableElementId: string,
): TableCellDropTarget | null => {
  const selection = store.tableSelection;
  if (
    !selection ||
    selection.elementId !== tableElementId ||
    selection.cells.length !== 1
  ) {
    return null;
  }

  const selectedCell = selection.cells[0];
  return {
    rowIndex: selectedCell.rowIndex,
    colField: selectedCell.colField,
    section: selectedCell.section || "body",
  };
};

const resolveTableCellDropTarget = (
  event: DragEvent,
  tableElementId: string,
): TableCellDropTarget | null => {
  const path =
    typeof event.composedPath === "function" ? event.composedPath() : [];

  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName !== "TD") continue;

    const colField = node.dataset.field;
    const rowIndexRaw = node.dataset.rowIndex;
    if (!colField || rowIndexRaw === undefined) continue;

    const rowIndex = Number.parseInt(rowIndexRaw, 10);
    if (!Number.isFinite(rowIndex)) continue;

    const wrapper = node.closest(".element-wrapper[data-element-id]");
    if (
      !wrapper ||
      wrapper.getAttribute("data-element-id") !== tableElementId
    ) {
      continue;
    }

    return {
      rowIndex,
      colField,
      section: normalizeTableCellSection(node.dataset.section),
    };
  }

  const queryRoot = getQueryRoot();
  const tableWrapper = queryRoot.querySelector(
    `.element-wrapper[data-element-id="${tableElementId}"]`,
  ) as HTMLElement | null;
  if (!tableWrapper) return null;

  const candidateCells = tableWrapper.querySelectorAll<HTMLElement>(
    "td[data-field][data-row-index][data-section]",
  );
  for (const cellEl of Array.from(candidateCells)) {
    const cellRect = cellEl.getBoundingClientRect();
    if (
      event.clientX >= cellRect.left &&
      event.clientX <= cellRect.right &&
      event.clientY >= cellRect.top &&
      event.clientY <= cellRect.bottom
    ) {
      const colField = cellEl.dataset.field;
      const rowIndexRaw = cellEl.dataset.rowIndex;
      if (!colField || rowIndexRaw === undefined) continue;

      const rowIndex = Number.parseInt(rowIndexRaw, 10);
      if (!Number.isFinite(rowIndex)) continue;

      return {
        rowIndex,
        colField,
        section: normalizeTableCellSection(cellEl.dataset.section),
      };
    }
  }

  return null;
};

const resolveVariableDropTarget = (
  pageIndex: number,
  x: number,
  y: number,
  payload: DragPayload,
  event?: DragEvent,
): VariableDropTarget | null => {
  const hasVariablePayload =
    payload.variable !== undefined || payload.dataVariable !== undefined;
  if (!hasVariablePayload) return null;

  const page = store.pages[pageIndex];
  if (!page) return null;

  const renderableElements = getRenderableElements(page.elements);
  for (let i = renderableElements.length - 1; i >= 0; i--) {
    const element = renderableElements[i];
    const isPointInside =
      x >= element.x &&
      x <= element.x + element.width &&
      y >= element.y &&
      y <= element.y + element.height;

    if (!isPointInside) continue;

    if (element.type === ElementType.TABLE) {
      const tableCellTarget = event
        ? resolveTableCellDropTarget(event, element.id)
        : null;
      if (tableCellTarget) {
        return { element, kind: "tableCell", tableCell: tableCellTarget };
      }

      const selectedCellTarget = getSelectedTableCellDropTarget(element.id);
      if (selectedCellTarget) {
        return { element, kind: "tableCell", tableCell: selectedCellTarget };
      }

      return { element, kind: "table" };
    }

    if (!DIRECT_VARIABLE_BINDING_TYPES.has(element.type)) continue;

    if (element.type === ElementType.TEXT) {
      return { element, kind: "text" };
    }

    return { element, kind: "directVariable" };
  }

  return null;
};

const clearVariableDropHover = () => {
  variableDropHover.value = null;
};

const structurePanelHoverTarget = ref<StructurePanelHoverTarget>(null);

const isEventForCurrentDesigner = (e: Event) => {
  const eventId = (e as CustomEvent)?.detail?.__designerInstanceId;
  if (!eventId || !designerInstanceId) return true;
  return eventId === designerInstanceId;
};

const handleStructurePanelHoverEvent = (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;

  const detail = (e as CustomEvent)?.detail || {};
  if (!detail.hovering) {
    structurePanelHoverTarget.value = null;
    return;
  }

  const elementId = String(detail.elementId || "").trim();
  const pageIndex = Number(detail.pageIndex);
  if (!elementId || !Number.isInteger(pageIndex) || pageIndex < 0) {
    structurePanelHoverTarget.value = null;
    return;
  }

  structurePanelHoverTarget.value = {
    elementId,
    pageIndex,
  };
};

onMounted(() => {
  window.addEventListener("dragend", clearVariableDropHover);
  window.addEventListener("drop", clearVariableDropHover);
  window.addEventListener(
    "designer:structure-panel-hover-element",
    handleStructurePanelHoverEvent,
  );
});

onUnmounted(() => {
  window.removeEventListener("dragend", clearVariableDropHover);
  window.removeEventListener("drop", clearVariableDropHover);
  window.removeEventListener(
    "designer:structure-panel-hover-element",
    handleStructurePanelHoverEvent,
  );
});

const isVariableDropHovered = (elementId: string, pageIndex: number) => {
  const hover = variableDropHover.value;
  return Boolean(
    hover && hover.elementId === elementId && hover.pageIndex === pageIndex,
  );
};

const isStructurePanelHovered = (elementId: string, pageIndex: number) => {
  const hover = structurePanelHoverTarget.value;
  return Boolean(
    hover && hover.elementId === elementId && hover.pageIndex === pageIndex,
  );
};

const getVariableDropHoverTableCell = (
  elementId: string,
  pageIndex: number,
) => {
  const hover = variableDropHover.value;
  if (!hover) return null;
  if (hover.elementId !== elementId || hover.pageIndex !== pageIndex) {
    return null;
  }

  return hover.tableCell || null;
};

const getSuggestedTableVariableTarget = (
  element: PrintElement,
): TableVariableBindingKey => {
  for (const key of TABLE_VARIABLE_BINDING_KEYS) {
    const value = (element as any)[key];
    if (!String(value || "").trim()) {
      return key;
    }
  }
  return "variable";
};

const openTableVariableTargetModal = (
  element: PrintElement,
  droppedVariable: string,
) => {
  const atVariable = toAtVariable(droppedVariable);
  if (!atVariable) return;

  pendingTableVariableDrop.value = {
    elementId: element.id,
    atVariable,
    suggestedTarget: getSuggestedTableVariableTarget(element),
  };
  showTableVariableTargetModal.value = true;
};

const closeTableVariableTargetModal = () => {
  showTableVariableTargetModal.value = false;
  pendingTableVariableDrop.value = null;
};

const handleTableVariableTargetSave = (payload: Record<string, any>) => {
  const pending = pendingTableVariableDrop.value;
  if (!pending) {
    closeTableVariableTargetModal();
    return;
  }

  const target = String(payload?.target || "") as TableVariableBindingKey;
  if (!TABLE_VARIABLE_BINDING_KEYS.includes(target)) {
    closeTableVariableTargetModal();
    return;
  }

  store.updateElement(pending.elementId, {
    [target]: pending.atVariable,
  } as Partial<PrintElement>);

  closeTableVariableTargetModal();
};

const replaceDroppedVariableInContent = (
  content: string | undefined,
  currentVariable: string | undefined,
  nextVariable: string,
) => {
  const baseContent = String(content || "");
  if (!baseContent) return nextVariable;

  const normalizedCurrentVariable = toAtVariable(currentVariable || "");
  if (
    normalizedCurrentVariable &&
    baseContent.includes(normalizedCurrentVariable)
  ) {
    return baseContent.replace(normalizedCurrentVariable, nextVariable);
  }

  if (VARIABLE_TOKEN_RE.test(baseContent)) {
    return baseContent.replace(VARIABLE_TOKEN_RE, nextVariable);
  }

  return `${baseContent}${nextVariable}`;
};

const applyDroppedVariableToTableCell = (
  element: PrintElement,
  tableCell: TableCellDropTarget,
  atVariable: string,
) => {
  const targetDataKey = tableCell.section === "footer" ? "footerData" : "data";
  const rawData = (element as any)[targetDataKey];
  const nextData = Array.isArray(rawData)
    ? JSON.parse(JSON.stringify(rawData))
    : [];

  while (nextData.length <= tableCell.rowIndex) {
    nextData.push({});
  }

  if (
    !nextData[tableCell.rowIndex] ||
    typeof nextData[tableCell.rowIndex] !== "object"
  ) {
    nextData[tableCell.rowIndex] = {};
  }

  const row = nextData[tableCell.rowIndex] as Record<string, any>;
  const currentValue = row[tableCell.colField];

  if (currentValue && typeof currentValue === "object") {
    row[tableCell.colField] = {
      ...currentValue,
      value: replaceDroppedVariableInContent(
        currentValue.value,
        undefined,
        atVariable,
      ),
    };
  } else {
    row[tableCell.colField] = replaceDroppedVariableInContent(
      currentValue !== undefined && currentValue !== null
        ? String(currentValue)
        : "",
      undefined,
      atVariable,
    );
  }

  store.updateElement(element.id, {
    [targetDataKey]: nextData,
  } as Partial<PrintElement>);
};

const handleDrop = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();
  clearVariableDropHover();
  if (!store.isTemplateEditable) return;
  const parsedPayload = parseDragPayload(event);
  if (!parsedPayload) return;

  const { type, payload, variable, dataVariable } = parsedPayload;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / store.zoom;
  const y = (event.clientY - rect.top) / store.zoom;

  if (payload) {
    store.addElement(
      {
        ...payload,
        x,
        y,
        locked: false,
      },
      pageIndex,
    );
    return;
  }

  // Handle dropping a variable directly to canvas
  if (variable || dataVariable) {
    const target = resolveVariableDropTarget(
      pageIndex,
      x,
      y,
      parsedPayload,
      event,
    );
    if (target) {
      const droppedVariable = variable || dataVariable;
      const atVariable = toAtVariable(droppedVariable || "");
      if (!atVariable) return;

      if (target.kind === "text") {
        const nextContent = replaceDroppedVariableInContent(
          target.element.content,
          target.element.variable,
          atVariable,
        );
        store.updateElement(target.element.id, {
          variable: atVariable,
          content: nextContent,
        });
        return;
      }

      if (target.kind === "directVariable") {
        store.updateElement(target.element.id, {
          variable: atVariable,
        });
        return;
      }

      if (target.kind === "tableCell" && target.tableCell) {
        applyDroppedVariableToTableCell(
          target.element,
          target.tableCell,
          atVariable,
        );
        return;
      }

      if (target.kind === "table") {
        openTableVariableTargetModal(target.element, atVariable);
        return;
      }
    }

    // Do not create new elements if dropping a variable on empty space
    return;
  }

  // Handle dropping a regular element from the left panel
  if (type) {
    if (type === ElementType.TABLE) {
      openTableCreateModal(x, y, pageIndex);
      return;
    }

    const newElement = createNewElement(type as ElementType, x, y, t);
    store.addElement(newElement as PrintElement, pageIndex);
  }
};

const handleDragOver = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();

  const payload = parseDragPayload(event);
  if (!isVariableDragPayload(payload)) {
    if (variableDropHover.value?.pageIndex === pageIndex) {
      clearVariableDropHover();
    }
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / store.zoom;
  const y = (event.clientY - rect.top) / store.zoom;

  const target = resolveVariableDropTarget(pageIndex, x, y, payload, event);
  if (target) {
    variableDropHover.value = {
      pageIndex,
      elementId: target.element.id,
      tableCell: target.kind === "tableCell" ? target.tableCell : undefined,
    };
  } else if (variableDropHover.value?.pageIndex === pageIndex) {
    clearVariableDropHover();
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = target ? "copy" : "none";
  }
};

const handlePageDragLeave = (event: DragEvent, pageIndex: number) => {
  const currentTarget = event.currentTarget as HTMLElement | null;
  const relatedTarget = event.relatedTarget as Node | null;

  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }

  if (variableDropHover.value?.pageIndex === pageIndex) {
    clearVariableDropHover();
  }
};

const handleBackgroundClick = (e: MouseEvent) => {
  // Don't clear selection if Ctrl key is pressed (multi-select mode)
  // Also don't clear if we just finished box selection
  if (!e.ctrlKey && !e.metaKey && !justFinishedBoxSelection.value) {
    store.selectElement(null);
  }
};

// Box selection handlers
const handlePageMouseDown = (e: MouseEvent, pageIndex: number) => {
  if (!store.isTemplateEditable) return;
  // Only left click and when not Ctrl pressed
  if (e.button !== 0 || e.ctrlKey || e.metaKey) return;

  // Check if clicking on an element (should be handled by ElementWrapper)
  const target = e.target as HTMLElement;
  if (target.closest(".element-wrapper")) return;

  // Start box selection
  e.preventDefault();
  // e.stopPropagation();

  isBoxSelecting.value = true;
  currentSelectingPageIndex.value = pageIndex;

  const pageElement = e.currentTarget as HTMLElement;
  const rect = pageElement.getBoundingClientRect();

  // Convert to page coordinates (consider zoom)
  boxSelectionStart.value = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value,
  };
  boxSelectionEnd.value = { ...boxSelectionStart.value };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isBoxSelecting.value || currentSelectingPageIndex.value === null) return;

  // Find the page element that started the selection within the same shadow root or document
  const root = getQueryRoot();
  const pageElement = root.getElementById(
    `page-${currentSelectingPageIndex.value}`,
  ) as HTMLElement;
  if (!pageElement) return;

  const rect = pageElement.getBoundingClientRect();
  boxSelectionEnd.value = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value,
  };
};

const handleMouseUp = () => {
  if (!isBoxSelecting.value) return;

  // Calculate selection bounds
  const x = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x);
  const y = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y);
  const width = Math.abs(boxSelectionEnd.value.x - boxSelectionStart.value.x);
  const height = Math.abs(boxSelectionEnd.value.y - boxSelectionStart.value.y);

  // Find elements within selection box
  const selectedIds: string[] = [];
  if (currentSelectingPageIndex.value !== null) {
    const page = pages.value[currentSelectingPageIndex.value];
    if (page) {
      for (const element of getRenderableElements(page.elements)) {
        // Check if element intersects with selection box
        const elementRight = element.x + element.width;
        const elementBottom = element.y + element.height;
        const selectionRight = x + width;
        const selectionBottom = y + height;

        if (
          element.x < selectionRight &&
          elementRight > x &&
          element.y < selectionBottom &&
          elementBottom > y
        ) {
          selectedIds.push(element.id);
        }
      }
    }
  }

  store.setSelection(selectedIds);

  isBoxSelecting.value = false;
  currentSelectingPageIndex.value = null;
  justFinishedBoxSelection.value = true;

  setTimeout(() => {
    justFinishedBoxSelection.value = false;
  }, 50);

  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
};

const handleContextMenu = (e: MouseEvent, pageIndex: number) => {
  const pageElement = e.currentTarget as HTMLElement;
  const rect = pageElement.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoom.value;
  const y = (e.clientY - rect.top) / zoom.value;

  const page = pages.value[pageIndex];
  if (!page) return;

  let targetId: string | null = null;
  let topZ = -Infinity;

  const renderableElements = getRenderableElements(page.elements);
  for (let i = 0; i < renderableElements.length; i++) {
    const el = renderableElements[i];
    const within =
      x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
    if (within) {
      const z = (el.style?.zIndex as number) ?? 1;
      if (z >= topZ) {
        topZ = z;
        targetId = el.id;
      }
    }
  }

  if (targetId) {
    const isAlreadySelected = store.selectedElementIds.includes(targetId);
    if (!isAlreadySelected) {
      store.selectElement(targetId, false, false);
    }
  }
};

const getGlobalElements = () => {
  if (pages.value.length === 0) return [];
  const firstPage = pages.value[0];
  const marginTop = store.pageSpacingY || 0;
  const marginBottom = store.pageSpacingY || 0;
  const headerBoundary = store.headerHeight + marginTop;
  const footerBoundary =
    store.canvasSize.height - (store.footerHeight + marginBottom);

  return getRenderableElements(firstPage.elements).filter((el) => {
    const bounds = store.getElementBoundsAtPosition(el, el.x, el.y);
    const isRepeatPerPage =
      el.type !== ElementType.TABLE && el.repeatPerPage === true;
    const isHeader = store.showHeaderLine && bounds.maxY <= headerBoundary;
    const isFooter = store.showFooterLine && bounds.minY >= footerBoundary;
    return isRepeatPerPage || isHeader || isFooter;
  });
};
</script>

<template>
  <div
    class="flex flex-col"
    :style="{
      transform: `scale(${zoom})`,
      transformOrigin: 'top left',
      width: 'fit-content',
      rowGap: '20px',
    }"
  >
    <div v-for="(page, index) in pages" :key="page.id" class="relative group">
      <div
        class="absolute top-0 flex flex-col gap-2 z-10"
        :style="pageActionsStyle"
      >
        <button
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.addPage')"
          :disabled="!isTemplateEditable"
          @click="store.addPage()"
        >
          <AddIcon />
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.copyPage')"
          :disabled="!isTemplateEditable"
          @click="store.copyPage(index)"
        >
          <CopyIcon />
        </button>
        <button
          v-if="store.copiedPage"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-blue-50 hover:text-blue-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.pastePage')"
          :disabled="!isTemplateEditable"
          @click="store.pastePage(index)"
        >
          <PasteIcon />
        </button>
        <button
          v-if="index > 0"
          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded shadow hover:bg-red-50 hover:text-red-600 text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :title="t('canvas.deletePage')"
          :disabled="!isTemplateEditable"
          @click="store.removePage(index)"
        >
          <DeleteIcon />
        </button>
      </div>

      <div
        :id="`page-${index}`"
        class="print-page shadow-lg relative overflow-hidden transition-all"
        :style="[
          pageStyle,
          {
            overflow: pageHasSelection[index] ? 'visible' : 'hidden',
            zIndex: pageHasSelection[index] ? 50 : 1,
          },
        ]"
        @drop="(e) => handleDrop(e, index)"
        @dragover="(e) => handleDragOver(e, index)"
        @dragleave="(e) => handlePageDragLeave(e, index)"
        @mousedown="(e) => handlePageMouseDown(e, index)"
        @contextmenu="(e) => handleContextMenu(e, index)"
        @click.self="handleBackgroundClick"
      >
        <!-- Grid Background -->
        <div
          v-if="store.showGrid"
          data-print-exclude="true"
          class="absolute inset-0 pointer-events-none opacity-50"
          style="
            background-image:
              linear-gradient(#e5e7eb 1px, transparent 1px),
              linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
            background-size: 20px 20px;
          "
        ></div>

        <!-- Selection Box -->
        <div
          v-if="isBoxSelecting && currentSelectingPageIndex === index"
          data-print-exclude="true"
          :style="selectionBoxStyle"
        ></div>

        <!-- Header & Footer Lines -->
        <template v-if="store.showHeaderLine">
          <div
            data-print-line-role="header"
            :data-print-exclude="
              shouldIncludeHeaderFooterLineInPrint ? undefined : 'true'
            "
            class="absolute left-0 w-full z-20 group flex flex-col justify-center items-center"
            :class="
              index === 0 && isTemplateEditable
                ? 'cursor-row-resize'
                : 'cursor-default'
            "
            :style="{
              top: `${store.headerHeight + marginTop}px`,
              left: `${marginLeft}px`,
              width: `${store.canvasSize.width - marginLeft - marginRight}px`,
              ...headerLineHitAreaStyle,
            }"
            @mousedown="(e) => index === 0 && handleLineMouseDown(e, 'header')"
          >
            <div class="border-t" :style="headerLineStrokeStyle"></div>
            <div
              class="absolute right-0 -top-4 text-xs bg-white/80 px-1 pointer-events-none"
              data-print-exclude="true"
              :class="index === 0 ? 'text-red-400' : 'text-gray-400'"
            >
              {{ t("canvas.headerLabel") }}
            </div>
          </div>
        </template>

        <template v-if="store.showFooterLine">
          <div
            data-print-line-role="footer"
            :data-print-exclude="
              shouldIncludeHeaderFooterLineInPrint ? undefined : 'true'
            "
            class="absolute left-0 w-full z-20 group flex flex-col justify-center items-center"
            :class="
              index === 0 && isTemplateEditable
                ? 'cursor-row-resize'
                : 'cursor-default'
            "
            :style="{
              bottom: `${store.footerHeight + marginBottom}px`,
              left: `${marginLeft}px`,
              width: `${store.canvasSize.width - marginLeft - marginRight}px`,
              ...footerLineHitAreaStyle,
            }"
            @mousedown="(e) => index === 0 && handleLineMouseDown(e, 'footer')"
          >
            <div class="border-t" :style="footerLineStrokeStyle"></div>
            <div
              class="absolute right-0 -bottom-4 text-xs bg-white/80 px-1 pointer-events-none"
              data-print-exclude="true"
              :class="index === 0 ? 'text-red-400' : 'text-gray-400'"
            >
              {{ t("canvas.footerLabel") }}
            </div>
          </div>
        </template>

        <!-- Global Header/Footer Elements (from Page 1) -->
        <template v-if="index > 0 && pages.length > 0">
          <ElementWrapper
            v-for="element in getGlobalElements()"
            :key="`global-${element.id}`"
            :class="{ 'pointer-events-none': isHandPanActive }"
            :element="element"
            :is-selected="isElementSelected(element.id)"
            :zoom="zoom"
            :page-index="0"
            :clip-to-page-bounds="shouldClipElementToPage(index, element.id)"
            :read-only="true"
          >
            <component
              :is="getComponent(element.type)"
              :element="element"
              :page-index="index"
              :total-pages="pages.length"
            />
          </ElementWrapper>
        </template>

        <!-- Elements -->
        <ElementWrapper
          v-for="element in getRenderableElements(page.elements)"
          :key="element.id"
          :class="{ 'pointer-events-none': isHandPanActive }"
          :element="element"
          :is-selected="isElementSelected(element.id)"
          :zoom="zoom"
          :page-index="index"
          :clip-to-page-bounds="shouldClipElementToPage(index, element.id)"
          :read-only="!isTemplateEditable || isHandPanActive"
          :force-hover="
            !isHandPanActive &&
            (isVariableDropHovered(element.id, index) ||
              isStructurePanelHovered(element.id, index))
          "
        >
          <component
            :is="getComponent(element.type)"
            :element="element"
            :page-index="index"
            :total-pages="pages.length"
            v-bind="
              element.type === ElementType.TABLE
                ? {
                    variableDropHoverCell: getVariableDropHoverTableCell(
                      element.id,
                      index,
                    ),
                  }
                : {}
            "
          />
        </ElementWrapper>

        <!-- Corner Markers -->
        <div
          v-if="store.showCornerMarkers"
          data-print-exclude="true"
          class="marker absolute inset-0 pointer-events-none z-50 opacity-50"
        >
          <!-- Top Left -->
          <div
            class="absolute w-3 h-3 border-t-2 border-l-2 border-gray-300"
            :style="{ top: `${marginTop}px`, left: `${marginLeft}px` }"
          ></div>
          <!-- Top Right -->
          <div
            class="absolute w-3 h-3 border-t-2 border-r-2 border-gray-300"
            :style="{ top: `${marginTop}px`, right: `${marginRight}px` }"
          ></div>
          <!-- Bottom Left -->
          <div
            class="absolute w-3 h-3 border-b-2 border-l-2 border-gray-300"
            :style="{ bottom: `${marginBottom}px`, left: `${marginLeft}px` }"
          ></div>
          <!-- Bottom Right -->
          <div
            class="absolute w-3 h-3 border-b-2 border-r-2 border-gray-300"
            :style="{ bottom: `${marginBottom}px`, right: `${marginRight}px` }"
          ></div>
        </div>

        <!-- Margin Guides -->
        <div
          v-if="store.showMarginLines && (marginLeft > 0 || marginTop > 0)"
          data-print-exclude="true"
          class="margin-guides absolute inset-0 pointer-events-none z-40"
        >
          <!-- Top Line -->
          <div
            v-if="marginTop > 0"
            class="absolute border-t border-dashed border-gray-400 w-full"
            :style="{ top: `${marginTop}px` }"
          ></div>
          <!-- Bottom Line -->
          <div
            v-if="marginBottom > 0"
            class="absolute border-b border-dashed border-gray-400 w-full"
            :style="{ bottom: `${marginBottom}px` }"
          ></div>
          <!-- Left Line -->
          <div
            v-if="marginLeft > 0"
            class="absolute border-l border-dashed border-gray-400 h-full"
            :style="{ left: `${marginLeft}px` }"
          ></div>
          <!-- Right Line -->
          <div
            v-if="marginRight > 0"
            class="absolute border-r border-dashed border-gray-400 h-full"
            :style="{ right: `${marginRight}px` }"
          ></div>
        </div>
      </div>
    </div>

    <InputModal
      :show="showTableCreateModal"
      :title="t('canvas.tableCreateModalTitle')"
      :fields="tableCreateFields"
      :initial-values="tableCreateInitialValues"
      @close="closeTableCreateModal"
      @save="handleTableCreateSave"
    />

    <InputModal
      :show="showTableVariableTargetModal"
      :title="t('canvas.tableVariableModalTitle')"
      :fields="tableVariableTargetFields"
      :initial-values="tableVariableTargetInitialValues"
      @close="closeTableVariableTargetModal"
      @save="handleTableVariableTargetSave"
    />
  </div>
</template>
