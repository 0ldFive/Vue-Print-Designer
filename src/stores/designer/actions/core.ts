// @ts-nocheck
import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import cloneDeep from "lodash/cloneDeep";
import { applyTemplateDataFields } from "../applyTemplateData";
import {
  STORAGE_KEYS,
  writeStored,
  writeStoredBoolean,
  writeStoredJson,
} from "@/utils/storage";
import {
  type DesignerState,
  type PrintElement,
  type TableColumn,
  type Page,
  type Guide,
  ElementType,
  type CustomElementTemplate,
  type WatermarkSettings,
  type CanvasBackgroundImageSettings,
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
      writeStoredJson(STORAGE_KEYS.watermark, this.watermark);
    },

  setCanvasBackgroundImage(update: Partial<CanvasBackgroundImageSettings>) {
      const base: CanvasBackgroundImageSettings = this.canvasBackgroundImage ?? {
        url: "",
        fit: "cover",
        opacity: 1,
        visible: true,
      };
      const next = { ...base, ...update };
      const cleared = update.url !== undefined && !String(update.url).trim();
      this.canvasBackgroundImage = cleared ? null : next;
    },

  clearCanvasBackgroundImage() {
      this.canvasBackgroundImage = null;
    },

  setUnit(unit: "mm" | "px" | "pt" | "in" | "cm") {
      this.unit = unit;
      writeStored(STORAGE_KEYS.unit, unit);
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
      writeStoredBoolean(STORAGE_KEYS.statusBarVisible, show);
    },

  setPanelEdgeAutoHide(enabled: boolean) {
      this.panelEdgeAutoHide = enabled;
      writeStoredBoolean(STORAGE_KEYS.panelEdgeAutoHide, enabled);
    },

  setShowTextQuickToolbar(show: boolean) {
      this.showTextQuickToolbar = show;
      writeStoredBoolean(STORAGE_KEYS.textQuickToolbar, show);
    },

  setShowDeveloperMode(show: boolean) {
      this.showDeveloperMode = show;
      writeStoredBoolean(STORAGE_KEYS.developerMode, show);

      if (!show) {
        this.showPaginationDebugLogs = false;
        this.showRenderDebugLogs = false;
        writeStoredBoolean(STORAGE_KEYS.paginationDebugLogs, false);
        writeStoredBoolean(STORAGE_KEYS.renderDebugLogs, false);
      }
    },

  setShowPaginationDebugLogs(show: boolean) {
      const next = this.showDeveloperMode && show;
      this.showPaginationDebugLogs = next;
      writeStoredBoolean(STORAGE_KEYS.paginationDebugLogs, next);
    },

  setShowRenderDebugLogs(show: boolean) {
      const next = this.showDeveloperMode && show;
      this.showRenderDebugLogs = next;
      writeStoredBoolean(STORAGE_KEYS.renderDebugLogs, next);
    },

  setShowHelp(show: boolean) {
      this.showHelp = show;
    },

  setShowSettings(show: boolean) {
      this.showSettings = show;
    },

  applyTemplateJsonToDesigner(data: Record<string, any>) {
      // 字段级恢复统一由 applyTemplateDataFields 实现（与模板加载共用）。
      applyTemplateDataFields(this, data);
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
