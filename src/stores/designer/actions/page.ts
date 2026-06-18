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

export const pageActions = {
  setPageSpacingX(value: number) {
      this.pageSpacingX = Math.max(0, Math.round(value));
    },

  setPageSpacingY(value: number) {
      this.pageSpacingY = Math.max(0, Math.round(value));
    },

  resetCanvas() {
      this.watermark = { ...defaultWatermark };
      localStorage.setItem(
        "print-designer-watermark",
        JSON.stringify(this.watermark),
      );
      this.pages = [{ id: uuidv4(), elements: [] }];
      this.currentPageIndex = 0;
      this.testData = {};
      this.variables = {};
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.selectedGuideId = null;
      this.highlightedGuideId = null;
      this.highlightedEdge = null;
      this.highlightedAlignedElementIds = [];
      this.guides = [];
      this.historyPast = [];
      this.historyFuture = [];
      this.historyPastActionKeys = [];
      this.historyFutureActionKeys = [];
      this.headerHeight = 100;
      this.footerHeight = 100;
      this.showHeaderLine = false;
      this.showFooterLine = false;
      this.enableHeaderFooterLineRendering = false;
      this.headerLineStyle = "dashed";
      this.footerLineStyle = "dashed";
      this.headerLineColor = "#f87171";
      this.footerLineColor = "#f87171";
      this.headerLineWidth = 1;
      this.footerLineWidth = 1;
      this.headerLineSpanMode = "percent";
      this.footerLineSpanMode = "percent";
      this.headerLineSpan = 100;
      this.footerLineSpan = 100;
      this.canvasBackground = "#ffffff";
      this.pageSpacingX = 0;
      this.pageSpacingY = 0;
      this.canvasSize = { width: 794, height: 1123 };
      this.zoom = 1;
      this.isDragging = false;
      this.isResizing = false;
      this.isRotating = false;
      this.showGrid = true;
      this.allowDragOutsideCanvas = false;
      this.showCornerMarkers = true;
      this.showMinimap = false;
      this.showHistoryPanel = false;
      this.showHelp = false;
      this.showSettings = false;
      this.copiedPage = null;
    },

  copyPage(index: number) {
      if (!this.isTemplateEditable) return;
      const page = this.pages[index];
      if (!page) return;
      this.copiedPage = cloneDeep(page);
    },

  pastePage(targetIndex: number) {
      if (!this.isTemplateEditable) return;
      if (!this.copiedPage) return;

      this.snapshot(HISTORY_ACTION.PAGE_PASTE);

      const newPage = cloneDeep(this.copiedPage);
      const isCopiedFromFirstPage =
        this.pages.length > 0 && this.copiedPage.id === this.pages[0].id;

      // Elements from page 1 that are rendered globally on other pages
      // should not be duplicated into newly pasted non-first pages.
      if (isCopiedFromFirstPage && targetIndex + 1 > 0) {
        const marginTop = this.pageSpacingY || 0;
        const marginBottom = this.pageSpacingY || 0;
        const headerBoundary = this.headerHeight + marginTop;
        const footerBoundary =
          this.canvasSize.height - (this.footerHeight + marginBottom);

        newPage.elements = newPage.elements.filter((el) => {
          if (el.type === ElementType.TABLE) return true;

          const bounds = this.getElementBoundsAtPosition(el, el.x, el.y);
          const isRepeatPerPage = el.repeatPerPage === true;
          const isHeader = this.showHeaderLine && bounds.maxY <= headerBoundary;
          const isFooter = this.showFooterLine && bounds.minY >= footerBoundary;

          return !(isRepeatPerPage || isHeader || isFooter);
        });
      }
      newPage.id = uuidv4();

      // Regenerate IDs for all elements
      newPage.elements.forEach((el) => {
        el.id = uuidv4();
      });

      // Insert after targetIndex
      this.pages.splice(targetIndex + 1, 0, newPage);
      this.currentPageIndex = targetIndex + 1;
    },

  addPage() {
      if (!this.isTemplateEditable) return;
      this.snapshot(HISTORY_ACTION.PAGE_ADD);
      this.pages.push({ id: uuidv4(), elements: [] });
      this.currentPageIndex = this.pages.length - 1;
    },

  removePage(index: number) {
      if (!this.isTemplateEditable) return;
      if (this.pages.length <= 1) return;
      this.snapshot(HISTORY_ACTION.PAGE_REMOVE);
      this.pages.splice(index, 1);
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1;
      }
    },

  movePage(fromIndex: number, toIndex: number) {
      if (!this.isTemplateEditable) return;
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= this.pages.length || toIndex >= this.pages.length) return;

      this.snapshot(HISTORY_ACTION.PAGE_REORDER);

      const currentPageId = this.pages[this.currentPageIndex]?.id;
      const [page] = this.pages.splice(fromIndex, 1);
      this.pages.splice(toIndex, 0, page);

      if (currentPageId) {
        const newIndex = this.pages.findIndex((p) => p.id === currentPageId);
        if (newIndex !== -1) {
          this.currentPageIndex = newIndex;
        }
      }
    },

  setCanvasBackground(color: string) {
      this.canvasBackground = color;
    },

  setAllowDragOutsideCanvas(show: boolean) {
      this.allowDragOutsideCanvas = show;
    },

  moveElementToPage(
      id: string,
      targetPageIndex: number,
      x: number,
      y: number,
    ) {
      if (!this.isTemplateEditable) return;
      this.snapshot(HISTORY_ACTION.ELEMENT_MOVE_TO_PAGE);
      let sourcePageIndex = -1;
      let elementIndex = -1;
      let element: PrintElement | undefined;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex((e) => e.id === id);
        if (idx !== -1) {
          sourcePageIndex = i;
          elementIndex = idx;
          element = this.pages[i].elements[idx];
          break;
        }
      }

      if (!element || sourcePageIndex === -1) return;

      if (targetPageIndex < 0 || targetPageIndex >= this.pages.length) {
        return;
      }

      const originalX = element.x;
      const originalY = element.y;
      const deltaX = x - originalX;
      const deltaY = y - originalY;
      const movedTableId =
        element.type === ElementType.TABLE ? element.id : null;

      // Remove from source
      this.pages[sourcePageIndex].elements.splice(elementIndex, 1);

      // Update position and apply table behavior rules for header/footer region.
      const movedElement = this.normalizeTableForHeaderFooterRegion({
        ...element,
        x,
        y,
      });

      this.pages[targetPageIndex].elements.push(movedElement);
      this.currentPageIndex = targetPageIndex;

      if (!movedTableId) return;

      const embeddedChildren: PrintElement[] = [];
      for (const page of this.pages) {
        for (let index = page.elements.length - 1; index >= 0; index -= 1) {
          const candidate = page.elements[index];
          if (candidate.id === movedTableId) continue;
          if (candidate.embeddedInTableId !== movedTableId) continue;

          page.elements.splice(index, 1);
          embeddedChildren.push({
            ...candidate,
            x: candidate.x + deltaX,
            y: candidate.y + deltaY,
          });
        }
      }

      if (embeddedChildren.length > 0) {
        this.pages[targetPageIndex].elements.push(...embeddedChildren);
      }
    },

  setCanvasSize(width: number, height: number) {
      if (!this.isTemplateEditable) return;
      this.snapshot(HISTORY_ACTION.CANVAS_RESIZE);
      this.canvasSize = { width, height };
    },

  deletePage(index: number) {
      if (!this.isTemplateEditable) return;
      if (this.pages.length > 1) {
        this.snapshot(HISTORY_ACTION.PAGE_REMOVE);
        this.pages.splice(index, 1);
        if (this.currentPageIndex >= this.pages.length) {
          this.currentPageIndex = this.pages.length - 1;
        }
      }
    }
};
