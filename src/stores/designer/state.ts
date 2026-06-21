
import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import cloneDeep from "lodash/cloneDeep";
import {
  type DesignerState,
  type PrintElement,
  type TableColumn,
  type Page,
  type Guide,
  ElementType,
  type CustomElementTemplate,
  type WatermarkSettings,
  type CustomElementEditSnapshot,
  type BrandingSettings,
  type DesignerFontOption,
  type ListContextMenuConfig,
  type ListContextMenuItem,
  type TemplateModalFormConfig,
  type TemplateModalField,
} from "@/types";
import {
  getCrudConfig,
  buildEndpoint,
  buildFetchOptions,
} from "../../utils/crudConfig";
import { toast } from "../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../utils/entityConstraints";
import { useTemplateStore } from "../templates";
import { normalizeVariableKey } from "../../utils/variables";
import i18n from "../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from './helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from './helpers';

export const state = (): DesignerState => ({
    unit:
      (localStorage.getItem("print-designer-unit") as
        | "mm"
        | "px"
        | "pt"
        | "in"
        | "cm") || "mm",
    watermark: loadWatermark(),
    branding: { ...defaultBranding },
    pages: [{ id: uuidv4(), elements: [] }],
    currentPageIndex: 0,
    customElements: JSON.parse(
      localStorage.getItem("print-designer-custom-elements") || "[]",
    ),
    customElementDetailCache: {} as Record<string, any>,
    templateContextMenuConfig: null as ListContextMenuConfig | null,
    customElementContextMenuConfig: null as ListContextMenuConfig | null,
    templateModalFormConfig: null as TemplateModalFormConfig | null,
    customElementModalFormConfig: null as TemplateModalFormConfig | null,
    contextMenuEventEmitter: null as
      | ((eventName: string, detail: Record<string, any>) => void)
      | null,
    crudScopeId: "__global__",
    testData: {},
    variables: {},
    fontOptions: [] as DesignerFontOption[],
    availableVariables: [] as import("../../types").VariableTreeItem[],
    editingCustomElementId: null,
    customElementEditSnapshot: null,
    selectedElementId: null,
    selectedElementIds: [],
    selectedGuideId: null,
    highlightedGuideId: null,
    highlightedEdge: null,
    highlightedAlignedElementIds: [],
    canvasSize: { width: 794, height: 1123 }, // A4 at 96 DPI (approx)
    zoom: 1,
    isDragging: false,
    isResizing: false,
    isRotating: false,
    showGrid: true,
    showMarginLines: true,
    allowDragOutsideCanvas: false,
    showCornerMarkers: true,
    headerHeight: 100,
    footerHeight: 100,
    showHeaderLine: false,
    showFooterLine: false,
    enableHeaderFooterLineRendering: false,
    headerLineStyle: "dashed",
    footerLineStyle: "dashed",
    headerLineColor: "#f87171",
    footerLineColor: "#f87171",
    headerLineWidth: 1,
    footerLineWidth: 1,
    headerLineSpanMode: "percent",
    footerLineSpanMode: "percent",
    headerLineSpan: 100,
    footerLineSpan: 100,
    showMinimap: false,
    showHistoryPanel: false,
    showStatusBar: loadStatusBarVisible(),
    showTextQuickToolbar: loadTextQuickToolbarEnabled(),
    showDeveloperMode: loadDeveloperMode(),
    showPaginationDebugLogs: loadDeveloperMode() && loadPaginationDebugLogs(),
    showRenderDebugLogs: loadDeveloperMode() && loadRenderDebugLogs(),
    showHelp: false,
    showSettings: false,
    canvasBackground: "#ffffff",
    pageSpacingX: 0,
    pageSpacingY: 0,
    guides: [],
    historyPast: [],
    historyFuture: [],
    historyPastActionKeys: [],
    historyFutureActionKeys: [],
    clipboard: [],
    copiedPage: null,
    isExporting: false,
    isGeneratingPreview: false,
    isGeneratingPrint: false,
    isGeneratingPdf: false,
    isGeneratingHtml: false,
    isGeneratingImages: false,
    printProgress: null as { phase: string; current: number; total: number; message: string } | null,
    disableGlobalShortcuts: false,
    disableShortcutsCount: 0,
    tableSelection: null,
    clientUrl: "https://printdot.cc/client",
    cloudUrl: "https://printdot.cc/cloud-print",
    showClientLink: true,
    showCloudLink: true,
  });
