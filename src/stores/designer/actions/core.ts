// @ts-nocheck
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
} from "../../../utils/crudConfig";
import { toast } from "../../../utils/toast";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
  normalizeEntityConstraints,
  applyModalExtraValues,
  mergeExt,
} from "../../../utils/entityConstraints";
import { useTemplateStore } from "../../templates";
import { normalizeVariableKey } from "../../../utils/variables";
import i18n from "../../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from '../helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from '../helpers';

export const coreActions = {
  setContextMenuEventEmitter(
      emitter:
        | ((eventName: string, detail: Record<string, any>) => void)
        | null,
    ) {
      this.contextMenuEventEmitter = emitter;
    },

  setCrudScopeId(scopeId: string) {
      this.crudScopeId = String(scopeId || "").trim() || "__global__";
    },

  setAvailableVariables(variables: import("../types").VariableTreeItem[]) {
      this.availableVariables = variables;
    },

  emitContextMenuEvent(eventName: string, detail: Record<string, any>) {
      if (!eventName || typeof eventName !== "string") return;
      this.contextMenuEventEmitter?.(eventName, detail || {});
    },

  setTemplateContextMenuConfig(config: ListContextMenuConfig | null) {
      this.templateContextMenuConfig = normalizeContextMenuConfig(config);
    },

  setTemplateModalFormConfig(config: TemplateModalFormConfig | null) {
      this.templateModalFormConfig = normalizeTemplateModalFormConfig(config);
    },

  setTemplateTagResolver(resolver: ((template: any) => any) | null) {
      this.templateTagResolver = typeof resolver === "function" ? resolver : null;
    },

  setClientUrl(url: string) {
      this.clientUrl = url;
    },

  setCloudUrl(url: string) {
      this.cloudUrl = url;
    },

  setShowClientLink(show: boolean) {
      this.showClientLink = show;
    },

  setShowCloudLink(show: boolean) {
      this.showCloudLink = show;
    },

  setShowLinks(show: boolean) {
      this.showClientLink = show;
      this.showCloudLink = show;
    },

  setBranding(update: Partial<BrandingSettings>) {
      if (!update || typeof update !== "object") return;
      const next = { ...this.branding, ...update };
      if (update.showTitle !== undefined)
        next.showTitle = Boolean(update.showTitle);
      if (update.showLogo !== undefined)
        next.showLogo = Boolean(update.showLogo);
      this.branding = next;
    },

  setFontOptions(options: DesignerFontOption[] = []) {
      this.fontOptions = normalizeDesignerFontOptions(options);
    },

  setWatermark(update: Partial<WatermarkSettings>) {
      this.watermark = { ...(this.watermark || defaultWatermark), ...update };
      localStorage.setItem(
        "print-designer-watermark",
        JSON.stringify(this.watermark),
      );
    },

  setUnit(unit: "mm" | "px" | "pt" | "in" | "cm") {
      this.unit = unit;
      localStorage.setItem("print-designer-unit", unit);
    },

  setDragging(isDragging: boolean) {
      this.isDragging = isDragging;
    },

  setResizing(isResizing: boolean) {
      this.isResizing = isResizing;
    },

  setRotating(isRotating: boolean) {
      this.isRotating = isRotating;
    },

  setDisableGlobalShortcuts(val: boolean) {
      const current = this.disableShortcutsCount || 0;
      if (val) {
        this.disableShortcutsCount = current + 1;
      } else {
        this.disableShortcutsCount = Math.max(0, current - 1);
      }
      this.disableGlobalShortcuts = this.disableShortcutsCount > 0;
    },

  setIsExporting(isExporting: boolean) {
      this.isExporting = isExporting;
    },

  setPrintProgress(progress: { phase: string; current: number; total: number; message: string } | null) {
      this.printProgress = progress;
    },

  setHeaderHeight(height: number) {
      if (!this.isTemplateEditable) return;
      this.headerHeight = height;
    },

  setFooterHeight(height: number) {
      if (!this.isTemplateEditable) return;
      this.footerHeight = height;
    },

  setShowHeaderLine(show: boolean) {
      this.showHeaderLine = show;
    },

  setShowFooterLine(show: boolean) {
      this.showFooterLine = show;
    },

  setEnableHeaderFooterLineRendering(enable: boolean) {
      if (!this.isTemplateEditable) return;
      this.enableHeaderFooterLineRendering =
        normalizeHeaderFooterLineRenderingEnabled(enable);
    },

  setHeaderLineStyle(style: HeaderFooterLineStyle) {
      if (!this.isTemplateEditable) return;
      this.headerLineStyle = normalizeHeaderFooterLineStyle(style);
    },

  setFooterLineStyle(style: HeaderFooterLineStyle) {
      if (!this.isTemplateEditable) return;
      this.footerLineStyle = normalizeHeaderFooterLineStyle(style);
    },

  setHeaderLineColor(color: string) {
      if (!this.isTemplateEditable) return;
      this.headerLineColor = normalizeHeaderFooterLineColor(color);
    },

  setFooterLineColor(color: string) {
      if (!this.isTemplateEditable) return;
      this.footerLineColor = normalizeHeaderFooterLineColor(color);
    },

  setHeaderLineWidth(width: number) {
      if (!this.isTemplateEditable) return;
      this.headerLineWidth = normalizeHeaderFooterLineWidth(width);
    },

  setFooterLineWidth(width: number) {
      if (!this.isTemplateEditable) return;
      this.footerLineWidth = normalizeHeaderFooterLineWidth(width);
    },

  setHeaderLineSpanMode(mode: HeaderFooterLineSpanMode) {
      if (!this.isTemplateEditable) return;
      this.headerLineSpanMode = normalizeHeaderFooterLineSpanMode(mode);
      this.headerLineSpan = normalizeHeaderFooterLineSpan(
        this.headerLineSpan,
        this.headerLineSpanMode,
      );
    },

  setFooterLineSpanMode(mode: HeaderFooterLineSpanMode) {
      if (!this.isTemplateEditable) return;
      this.footerLineSpanMode = normalizeHeaderFooterLineSpanMode(mode);
      this.footerLineSpan = normalizeHeaderFooterLineSpan(
        this.footerLineSpan,
        this.footerLineSpanMode,
      );
    },

  setHeaderLineSpan(span: number) {
      if (!this.isTemplateEditable) return;
      this.headerLineSpan = normalizeHeaderFooterLineSpan(
        span,
        this.headerLineSpanMode,
      );
    },

  setFooterLineSpan(span: number) {
      if (!this.isTemplateEditable) return;
      this.footerLineSpan = normalizeHeaderFooterLineSpan(
        span,
        this.footerLineSpanMode,
      );
    },

  setShowMinimap(show: boolean) {
      this.showMinimap = show;
    },

  setShowStatusBar(show: boolean) {
      this.showStatusBar = show;
      localStorage.setItem(
        "print-designer-show-status-bar",
        show ? "true" : "false",
      );
    },

  setPanelEdgeAutoHide(enabled: boolean) {
      this.panelEdgeAutoHide = enabled;
      localStorage.setItem(
        "print-designer-panel-edge-auto-hide",
        enabled ? "true" : "false",
      );
    },

  setShowTextQuickToolbar(show: boolean) {
      this.showTextQuickToolbar = show;
      localStorage.setItem(
        "print-designer-show-text-quick-toolbar",
        show ? "true" : "false",
      );
    },

  setShowDeveloperMode(show: boolean) {
      this.showDeveloperMode = show;
      localStorage.setItem(
        "print-designer-developer-mode",
        show ? "true" : "false",
      );

      if (!show) {
        this.showPaginationDebugLogs = false;
        this.showRenderDebugLogs = false;
        localStorage.setItem("print-designer-pagination-debug-logs", "false");
        localStorage.setItem("print-designer-render-debug-logs", "false");
      }
    },

  setShowPaginationDebugLogs(show: boolean) {
      const next = this.showDeveloperMode && show;
      this.showPaginationDebugLogs = next;
      localStorage.setItem(
        "print-designer-pagination-debug-logs",
        next ? "true" : "false",
      );
    },

  setShowRenderDebugLogs(show: boolean) {
      const next = this.showDeveloperMode && show;
      this.showRenderDebugLogs = next;
      localStorage.setItem(
        "print-designer-render-debug-logs",
        next ? "true" : "false",
      );
    },

  setShowHelp(show: boolean) {
      this.showHelp = show;
    },

  setShowSettings(show: boolean) {
      this.showSettings = show;
    },

  applyTemplateJsonToDesigner(data: Record<string, any>) {
      if (!data || typeof data !== "object" || Array.isArray(data)) return;

      if (Array.isArray(data.pages) && data.pages.length > 0) {
        this.pages = cloneDeep(data.pages);
        if (this.currentPageIndex >= data.pages.length) {
          this.currentPageIndex = Math.max(data.pages.length - 1, 0);
        }
      }

      if (data.canvasSize && typeof data.canvasSize === "object") {
        this.canvasSize = cloneDeep(data.canvasSize);
      }
      if (Array.isArray(data.guides)) {
        this.guides = cloneDeep(data.guides);
      }
      if (typeof data.zoom === "number") this.zoom = data.zoom;
      if (typeof data.showGrid === "boolean") this.showGrid = data.showGrid;
      if (typeof data.allowDragOutsideCanvas === "boolean") {
        this.allowDragOutsideCanvas = data.allowDragOutsideCanvas;
      }
      if (typeof data.headerHeight === "number") {
        this.headerHeight = data.headerHeight;
      }
      if (typeof data.footerHeight === "number") {
        this.footerHeight = data.footerHeight;
      }
      if (typeof data.showHeaderLine === "boolean") {
        this.showHeaderLine = data.showHeaderLine;
      }
      if (typeof data.showFooterLine === "boolean") {
        this.showFooterLine = data.showFooterLine;
      }
      if (typeof data.enableHeaderFooterLineRendering === "boolean") {
        this.enableHeaderFooterLineRendering =
          normalizeHeaderFooterLineRenderingEnabled(
            data.enableHeaderFooterLineRendering,
          );
      }
      if (typeof data.headerLineStyle === "string") {
        this.headerLineStyle = normalizeHeaderFooterLineStyle(
          data.headerLineStyle,
        );
      }
      if (typeof data.footerLineStyle === "string") {
        this.footerLineStyle = normalizeHeaderFooterLineStyle(
          data.footerLineStyle,
        );
      }
      if (typeof data.headerLineColor === "string") {
        this.headerLineColor = normalizeHeaderFooterLineColor(
          data.headerLineColor,
        );
      }
      if (typeof data.footerLineColor === "string") {
        this.footerLineColor = normalizeHeaderFooterLineColor(
          data.footerLineColor,
        );
      }
      if (data.headerLineWidth !== undefined) {
        this.headerLineWidth = normalizeHeaderFooterLineWidth(
          data.headerLineWidth,
        );
      }
      if (data.footerLineWidth !== undefined) {
        this.footerLineWidth = normalizeHeaderFooterLineWidth(
          data.footerLineWidth,
        );
      }
      if (typeof data.headerLineSpanMode === "string") {
        this.headerLineSpanMode = normalizeHeaderFooterLineSpanMode(
          data.headerLineSpanMode,
        );
      }
      if (typeof data.footerLineSpanMode === "string") {
        this.footerLineSpanMode = normalizeHeaderFooterLineSpanMode(
          data.footerLineSpanMode,
        );
      }
      if (data.headerLineSpan !== undefined) {
        this.headerLineSpan = normalizeHeaderFooterLineSpan(
          data.headerLineSpan,
          this.headerLineSpanMode,
        );
      }
      if (data.footerLineSpan !== undefined) {
        this.footerLineSpan = normalizeHeaderFooterLineSpan(
          data.footerLineSpan,
          this.footerLineSpanMode,
        );
      }
      if (typeof data.showMinimap === "boolean") {
        this.showMinimap = data.showMinimap;
      }
      if (typeof data.showHistoryPanel === "boolean") {
        this.showHistoryPanel = data.showHistoryPanel;
      }
      if (typeof data.canvasBackground === "string") {
        this.canvasBackground = data.canvasBackground;
      }

      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.selectedGuideId = null;
      this.highlightedGuideId = null;
      this.highlightedEdge = null;
      this.highlightedAlignedElementIds = [];
      this.tableSelection = null;
      this.historyPast = [];
      this.historyFuture = [];
      this.historyPastActionKeys = [];
      this.historyFutureActionKeys = [];
    },

  setShowCornerMarkers(show: boolean) {
      this.showCornerMarkers = show;
    },

  toggleLock() {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;
      this.snapshot(HISTORY_ACTION.ELEMENT_LOCK);

      // Determine target state based on the primary selected element
      let targetState = true;
      const primaryEl = this.selectedElement;
      if (primaryEl) {
        targetState = !primaryEl.locked;
      }

      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex((e) => e.id === id);
          if (index !== -1) {
            page.elements[index].locked = targetState;
            // Locking a multi-label container locks/unlocks its label content
            // (the elements inside the first cell) together.
            if (page.elements[index].type === ElementType.MULTI_LABEL) {
              const ml = page.elements[index];
              const rx = ml.x;
              const ry = ml.y;
              const rw = ml.width || 1;
              const rh = ml.height || 1;
              for (const other of page.elements) {
                if (other.id === ml.id) continue;
                if (other.type === ElementType.MULTI_LABEL) continue;
                const cx = (other.x || 0) + (other.width || 0) / 2;
                const cy = (other.y || 0) + (other.height || 0) / 2;
                if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) {
                  other.locked = targetState;
                }
              }
            }
            break;
          }
        }
      }
    },

  setZoom(zoom: number) {
      this.zoom = zoom;
    },

  setShowGrid(show: boolean) {
      this.showGrid = show;
    },

  copy() {
      if (this.selectedElementIds.length === 0) return;

      const elements: PrintElement[] = [];
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) {
            elements.push(cloneDeep(el));
            break;
          }
        }
      }
      this.clipboard = elements;
    },

  cut() {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;
      this.copy();
      this.removeSelectedElements();
    },

  paste(position?: { x: number; y: number; pageIndex: number }) {
      if (!this.isTemplateEditable) return;
      if (this.clipboard.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_PASTE);

      const newIds: string[] = [];
      const targetPageIndex = position?.pageIndex ?? this.currentPageIndex;

      // Calculate bounding box if position is provided
      let minX = Infinity;
      let minY = Infinity;
      if (position) {
        for (const item of this.clipboard) {
          minX = Math.min(minX, item.x);
          minY = Math.min(minY, item.y);
        }
      }

      for (const item of this.clipboard) {
        const newEl = cloneDeep(item);
        newEl.id = uuidv4();

        if (position) {
          // Place relative to the new position
          const dx = item.x - minX;
          const dy = item.y - minY;
          newEl.x = position.x + dx;
          newEl.y = position.y + dy;
        } else {
          // Default offset
          newEl.x += 20;
          newEl.y += 20;
        }

        // Ensure it fits in canvas (optional, but good UX)
        if (newEl.x + newEl.width > this.canvasSize.width) {
          newEl.x = Math.max(0, this.canvasSize.width - newEl.width);
        }
        if (newEl.y + newEl.height > this.canvasSize.height) {
          newEl.y = Math.max(0, this.canvasSize.height - newEl.height);
        }

        // Clamp negative values
        newEl.x = Math.max(0, newEl.x);
        newEl.y = Math.max(0, newEl.y);

        if (this.pages[targetPageIndex]) {
          this.pages[targetPageIndex].elements.push(newEl);
        } else {
          this.pages[this.currentPageIndex].elements.push(newEl);
        }
        newIds.push(newEl.id);
      }

      // Switch to the target page if different
      if (
        targetPageIndex !== this.currentPageIndex &&
        this.pages[targetPageIndex]
      ) {
        this.currentPageIndex = targetPageIndex;
      }

      this.setSelection(newIds);
    }
};
