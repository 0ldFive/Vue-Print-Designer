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
import {
  classifyLabelElements,
  multiLabelSettingsFromElement,
} from "../../../utils/multiLabel";
import i18n from "../../../locales";
import { defaultWatermark, defaultBranding, HISTORY_ACTION, hasOwn, inferElementUpdateHistoryAction, loadWatermark, loadDeveloperMode, loadPaginationDebugLogs, loadRenderDebugLogs, loadTextQuickToolbarEnabled, loadStatusBarVisible, getElementZIndex, getLayerSortedElements, buildLayerAssignments, canLayerMoveInPage, normalizeContextMenuConfig, normalizeTemplateModalFields, normalizeTemplateModalFormConfig, inferVariableFromContent, normalizeDesignerFontOptions, getEffectiveTableColumns, getNumericCellStyleHeight, getTableRowExplicitHeight, isHeaderFooterLineStyle, normalizeHeaderFooterLineStyle, normalizeHeaderFooterLineColor, normalizeHeaderFooterLineWidth, normalizeHeaderFooterLineSpanMode, normalizeHeaderFooterLineSpan, normalizeHeaderFooterLineRenderingEnabled, escapeAttributeSelectorValue, getCellBorderInsetRect, querySelectorAcrossDocumentAndShadowRoots } from '../helpers';
import type { LayerMoveMode, HeaderFooterLineStyle, HeaderFooterLineSpanMode, EmbeddedCellBounds, EffectiveTableRows } from '../helpers';

export const elementActions = {
  setCustomElementContextMenuConfig(config: ListContextMenuConfig | null) {
      this.customElementContextMenuConfig = normalizeContextMenuConfig(config);
    },

  setCustomElementModalFormConfig(config: TemplateModalFormConfig | null) {
      this.customElementModalFormConfig =
        normalizeTemplateModalFormConfig(config);
    },

  startCustomElementEdit(id: string) {
      const template = this.customElements.find((el) => el.id === id);
      if (!template) return;

      if (!this.customElementEditSnapshot) {
        this.customElementEditSnapshot = {
          pages: cloneDeep(this.pages),
          historyPast: cloneDeep(this.historyPast),
          historyFuture: cloneDeep(this.historyFuture),
          historyPastActionKeys: cloneDeep(this.historyPastActionKeys),
          historyFutureActionKeys: cloneDeep(this.historyFutureActionKeys),
          canvasSize: cloneDeep(this.canvasSize),
          guides: cloneDeep(this.guides),
          zoom: this.zoom,
          showGrid: this.showGrid,
          showMarginLines: this.showMarginLines,
          allowDragOutsideCanvas: this.allowDragOutsideCanvas,
          showCornerMarkers: this.showCornerMarkers,
          headerHeight: this.headerHeight,
          footerHeight: this.footerHeight,
          showHeaderLine: this.showHeaderLine,
          showFooterLine: this.showFooterLine,
          enableHeaderFooterLineRendering: this.enableHeaderFooterLineRendering,
          headerLineStyle: this.headerLineStyle,
          footerLineStyle: this.footerLineStyle,
          headerLineColor: this.headerLineColor,
          footerLineColor: this.footerLineColor,
          headerLineWidth: this.headerLineWidth,
          footerLineWidth: this.footerLineWidth,
          headerLineSpanMode: this.headerLineSpanMode,
          footerLineSpanMode: this.footerLineSpanMode,
          headerLineSpan: this.headerLineSpan,
          footerLineSpan: this.footerLineSpan,
          showMinimap: this.showMinimap,
          showHistoryPanel: this.showHistoryPanel,
          canvasBackground: this.canvasBackground,
          pageSpacingX: this.pageSpacingX,
          pageSpacingY: this.pageSpacingY,
          unit: this.unit,
          watermark: cloneDeep(this.watermark),
          testData: cloneDeep(this.testData),
          currentPageIndex: this.currentPageIndex,
          selectedElementId: this.selectedElementId,
          selectedElementIds: cloneDeep(this.selectedElementIds),
          selectedGuideId: this.selectedGuideId,
          highlightedGuideId: this.highlightedGuideId,
          highlightedEdge: this.highlightedEdge,
          highlightedAlignedElementIds: cloneDeep(
            this.highlightedAlignedElementIds,
          ),
        } satisfies CustomElementEditSnapshot;
      }

      this.editingCustomElementId = id;
      this.resetCanvas();

      const element = cloneDeep(template.element);
      element.id = uuidv4();

      this.pages = [{ id: uuidv4(), elements: [element] }];
      this.currentPageIndex = 0;
      this.selectedElementId = element.id;
      this.selectedElementIds = [element.id];
      this.historyPast = [];
      this.historyFuture = [];
      this.historyPastActionKeys = [];
      this.historyFutureActionKeys = [];
      this.guides = [];
      this.tableSelection = null;
    },

  cancelCustomElementEdit() {
      const snapshot = this.customElementEditSnapshot;
      this.editingCustomElementId = null;
      this.customElementEditSnapshot = null;
      if (!snapshot) return;

      this.pages = snapshot.pages;
      this.historyPast = snapshot.historyPast || [];
      this.historyFuture = snapshot.historyFuture || [];
      this.historyPastActionKeys = snapshot.historyPastActionKeys || [];
      this.historyFutureActionKeys = snapshot.historyFutureActionKeys || [];
      this.canvasSize = snapshot.canvasSize;
      this.guides = snapshot.guides;
      this.zoom = snapshot.zoom;
      this.showGrid = snapshot.showGrid;
      this.showMarginLines = snapshot.showMarginLines;
      this.allowDragOutsideCanvas =
        snapshot.allowDragOutsideCanvas ?? this.allowDragOutsideCanvas;
      this.showCornerMarkers = snapshot.showCornerMarkers;
      this.headerHeight = snapshot.headerHeight;
      this.footerHeight = snapshot.footerHeight;
      this.showHeaderLine = snapshot.showHeaderLine;
      this.showFooterLine = snapshot.showFooterLine;
      this.enableHeaderFooterLineRendering =
        normalizeHeaderFooterLineRenderingEnabled(
          snapshot.enableHeaderFooterLineRendering,
        );
      this.headerLineStyle = normalizeHeaderFooterLineStyle(
        snapshot.headerLineStyle,
      );
      this.footerLineStyle = normalizeHeaderFooterLineStyle(
        snapshot.footerLineStyle,
      );
      this.headerLineColor = normalizeHeaderFooterLineColor(
        snapshot.headerLineColor,
      );
      this.footerLineColor = normalizeHeaderFooterLineColor(
        snapshot.footerLineColor,
      );
      this.headerLineWidth = normalizeHeaderFooterLineWidth(
        snapshot.headerLineWidth,
      );
      this.footerLineWidth = normalizeHeaderFooterLineWidth(
        snapshot.footerLineWidth,
      );
      this.headerLineSpanMode = normalizeHeaderFooterLineSpanMode(
        snapshot.headerLineSpanMode,
      );
      this.footerLineSpanMode = normalizeHeaderFooterLineSpanMode(
        snapshot.footerLineSpanMode,
      );
      this.headerLineSpan = normalizeHeaderFooterLineSpan(
        snapshot.headerLineSpan,
        this.headerLineSpanMode,
      );
      this.footerLineSpan = normalizeHeaderFooterLineSpan(
        snapshot.footerLineSpan,
        this.footerLineSpanMode,
      );
      this.showMinimap = snapshot.showMinimap;
      this.showHistoryPanel = snapshot.showHistoryPanel;
      this.canvasBackground = snapshot.canvasBackground;
      this.pageSpacingX = snapshot.pageSpacingX ?? this.pageSpacingX;
      this.pageSpacingY = snapshot.pageSpacingY ?? this.pageSpacingY;
      this.unit = snapshot.unit || this.unit;
      if (snapshot.unit) {
        localStorage.setItem("print-designer-unit", snapshot.unit);
      }
      if (snapshot.watermark) {
        this.watermark = cloneDeep(snapshot.watermark);
        localStorage.setItem(
          "print-designer-watermark",
          JSON.stringify(this.watermark),
        );
      }
      this.testData = snapshot.testData || {};
      this.currentPageIndex = snapshot.currentPageIndex;
      this.selectedElementId = snapshot.selectedElementId;
      this.selectedElementIds = snapshot.selectedElementIds;
      this.selectedGuideId = snapshot.selectedGuideId;
      this.highlightedGuideId = snapshot.highlightedGuideId;
      this.highlightedEdge = snapshot.highlightedEdge;
      this.highlightedAlignedElementIds =
        snapshot.highlightedAlignedElementIds || [];
      this.tableSelection = null;
    },

  async commitCustomElementEdit() {
      if (!this.editingCustomElementId) return false;
      const template = this.customElements.find(
        (el) => el.id === this.editingCustomElementId,
      );
      if (!template) return false;

      const element = this.selectedElement || this.pages[0]?.elements[0];
      if (!element) return false;

      if (!canEditEntity(template)) {
        toast.warning(i18n.global.t("toast.customElementReadOnly"));
        return false;
      }

      template.element = cloneDeep(element);

      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      if (mode === "remote") {
        try {
          const cachedTemplate = this.customElementDetailCache[template.id];
          const payloadBase = {
            id: template.id,
            name: template.name,
            element: cloneDeep(template.element),
            testData: template.testData,
            permissions: template.permissions ?? cachedTemplate?.permissions,
            ext: mergeExt(cachedTemplate?.ext, template.ext),
          };
          const payload = normalizeEntityConstraints(
            applyModalExtraValues(payloadBase, "edit"),
          );
          const url = buildEndpoint(
            endpoints.customElements?.upsert,
            "",
            this.crudScopeId,
          );
          const options = buildFetchOptions(
            endpoints.customElements?.upsert,
            "POST",
            headers,
            payload,
          );
          await (fetcher || fetch)(url, options);
          const cached = this.customElementDetailCache[template.id];
          this.customElementDetailCache[template.id] =
            normalizeEntityConstraints({
              id: payload.id,
              name: payload.name,
              element: cloneDeep(payload.element || cached?.element || {}),
              testData: payload.testData || cached?.testData,
              permissions: payload.permissions ?? cached?.permissions,
              ext: mergeExt(cached?.ext, payload.ext),
            }) as CustomElementTemplate;
        } catch (e) {
          console.error("Failed to commit custom element edit", e);
        }
      } else {
        this.saveCustomElements();
      }
      return true;
    },

  saveCustomElementEditAs(name: string) {
      const element = this.selectedElement || this.pages[0]?.elements[0];
      if (!element) return false;
      this.addCustomElement(name, element);
      return true;
    },

  getElementBoundsAtPosition(el: PrintElement, x: number, y: number) {
      // The multi-label container's footprint is its whole repeated grid (every
      // label cell, including the ghost previews), so snapping, center-point
      // alignment and movement bounds all treat the grid box as the element's
      // bounds — its center is the center of the whole grid, not the first cell.
      if (el.type === ElementType.MULTI_LABEL) {
        const cols = Math.max(1, Math.round(el.cols || 1));
        const rows = Math.max(1, Math.round(el.rows || 1));
        const gapX = Math.max(0, el.gapX || 0);
        const gapY = Math.max(0, el.gapY || 0);
        const gridW = cols * el.width + (cols - 1) * gapX;
        const gridH = rows * el.height + (rows - 1) * gapY;
        return {
          minX: x,
          maxX: x + gridW,
          minY: y,
          maxY: y + gridH,
        };
      }

      const rotation = el.style?.rotate || 0;
      const normalized = ((rotation % 360) + 360) % 360;
      if (normalized === 0) {
        return {
          minX: x,
          maxX: x + el.width,
          minY: y,
          maxY: y + el.height,
        };
      }

      const cx = x + el.width / 2;
      const cy = y + el.height / 2;
      const rad = (normalized * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const corners = [
        { x, y },
        { x: x + el.width, y },
        { x, y: y + el.height },
        { x: x + el.width, y: y + el.height },
      ];

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const p of corners) {
        const nx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
        const ny = cy + (p.x - cx) * sin + (p.y - cy) * cos;
        if (nx < minX) minX = nx;
        if (nx > maxX) maxX = nx;
        if (ny < minY) minY = ny;
        if (ny > maxY) maxY = ny;
      }

      return { minX, maxX, minY, maxY };
    },

  getElementMovementBounds(el: PrintElement) {
      const marginX = this.pageSpacingX || 0;
      const marginY = this.pageSpacingY || 0;
      const maxXBoundary = this.canvasSize.width - marginX;
      const maxYBoundary = this.canvasSize.height - marginY;
      const originBounds = this.getElementBoundsAtPosition(el, 0, 0);

      const minX = marginX - originBounds.minX;
      const maxX = Math.max(minX, maxXBoundary - originBounds.maxX);
      const minY = marginY - originBounds.minY;
      const maxY = Math.max(minY, maxYBoundary - originBounds.maxY);

      return {
        minX,
        maxX,
        minY,
        maxY,
        maxXBoundary,
        maxYBoundary,
        originBounds,
      };
    },

  constrainElementPositionToBounds(
      element: PrintElement,
      x: number,
      y: number,
      bounds: EmbeddedCellBounds,
    ) {
      const maxX = bounds.x + Math.max(0, bounds.width - element.width);
      const maxY = bounds.y + Math.max(0, bounds.height - element.height);

      return {
        x: Math.min(Math.max(bounds.x, x), maxX),
        y: Math.min(Math.max(bounds.y, y), maxY),
      };
    },

  isElementInHeaderOrFooterRegion(element: PrintElement) {
      if (!this.showHeaderLine && !this.showFooterLine) return false;

      const marginTop = this.pageSpacingY || 0;
      const marginBottom = this.pageSpacingY || 0;
      const headerBoundary = this.headerHeight + marginTop;
      const footerBoundary =
        this.canvasSize.height - (this.footerHeight + marginBottom);
      const bounds = this.getElementBoundsAtPosition(
        element,
        element.x,
        element.y,
      );

      const isHeader = this.showHeaderLine && bounds.maxY <= headerBoundary;
      const isFooter = this.showFooterLine && bounds.minY >= footerBoundary;
      return isHeader || isFooter;
    },

  addElement(element: Omit<PrintElement, "id">, pageIndex?: number) {
      if (!this.isTemplateEditable) return;
      this.snapshot(HISTORY_ACTION.ELEMENT_ADD);
      const newElement = this.normalizeTableForHeaderFooterRegion({
        ...element,
        id: uuidv4(),
      });
      const targetPageIdx =
        pageIndex !== undefined &&
        pageIndex >= 0 &&
        pageIndex < this.pages.length
          ? pageIndex
          : this.currentPageIndex;
      this.pages[targetPageIdx].elements.push(newElement);
      this.selectedElementId = newElement.id;
      this.currentPageIndex = targetPageIdx;
    },

  moveElementsForward(ids: string[]) {
      this.moveElementsLayer(ids, "forward");
    },

  updateElement(
      id: string,
      updates: Partial<PrintElement>,
      createSnapshot: boolean = true,
    ) {
      if (!this.isTemplateEditable) return;
      if (createSnapshot) {
        this.snapshot(inferElementUpdateHistoryAction(updates));
      }
      for (const page of this.pages) {
        const index = page.elements.findIndex((e) => e.id === id);
        if (index !== -1) {
          const el = page.elements[index];
          // Prevent update if locked, unless we are updating the lock status itself
          if (el.locked && updates.locked === undefined) return;

          const nextUpdates: Partial<PrintElement> = { ...updates };
          const hasExplicitVariableUpdate =
            Object.prototype.hasOwnProperty.call(nextUpdates, "variable");
          if (
            !hasExplicitVariableUpdate &&
            typeof nextUpdates.content === "string"
          ) {
            const inferredVariable = inferVariableFromContent(
              nextUpdates.content,
            );
            nextUpdates.variable = inferredVariable ? inferredVariable : "";
          }

          if (el.type === ElementType.TEXT) {
            const touchedRepeatPerPage = Object.prototype.hasOwnProperty.call(
              nextUpdates,
              "repeatPerPage",
            );
            const touchedAutoHeight =
              !!nextUpdates.style &&
              Object.prototype.hasOwnProperty.call(
                nextUpdates.style,
                "autoHeight",
              );

            const nextRepeatPerPage = touchedRepeatPerPage
              ? nextUpdates.repeatPerPage === true
              : el.repeatPerPage === true;
            const nextAutoHeight = touchedAutoHeight
              ? nextUpdates.style?.autoHeight === true
              : el.style?.autoHeight === true;

            if (nextRepeatPerPage && nextAutoHeight) {
              if (touchedAutoHeight && !touchedRepeatPerPage) {
                nextUpdates.repeatPerPage = false;
              } else {
                nextUpdates.style = {
                  ...el.style,
                  ...(nextUpdates.style || {}),
                  autoHeight: false,
                };
              }
            }
          }

          const mergedElement = { ...page.elements[index], ...nextUpdates };
          const nextElement =
            this.normalizeTableForHeaderFooterRegion(mergedElement);
          page.elements[index] = nextElement;

          const tableZIndexChanged =
            el.type === ElementType.TABLE &&
            getElementZIndex(nextElement) !== getElementZIndex(el);

          if (el.type === ElementType.TABLE) {
            const deltaX = nextElement.x - el.x;
            const deltaY = nextElement.y - el.y;
            if (deltaX !== 0 || deltaY !== 0) {
              this.moveEmbeddedElementsByTableDelta(
                new Map([[el.id, { dx: deltaX, dy: deltaY }]]),
                { excludeIds: new Set([el.id]) },
              );
            }

            if (tableZIndexChanged) {
              this.ensureEmbeddedElementsAboveTables(new Set([el.id]));
            }
          }

          return;
        }
      }
    },

  collectElementIdsWithEmbeddedChildren(rootIds: Iterable<string>) {
      const ids = new Set(rootIds);
      let changed = true;

      while (changed) {
        changed = false;
        for (const page of this.pages) {
          for (const element of page.elements) {
            if (!element.embeddedInTableId) continue;
            if (!ids.has(element.embeddedInTableId)) continue;
            if (ids.has(element.id)) continue;

            ids.add(element.id);
            changed = true;
          }
        }
      }

      return ids;
    },

  removeElement(id: string) {
      if (!this.isTemplateEditable) return;
      let targetElement: PrintElement | null = null;
      for (const page of this.pages) {
        const el = page.elements.find((e) => e.id === id);
        if (!el) continue;
        targetElement = el;
        break;
      }
      if (!targetElement || targetElement.locked) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_REMOVE);
      const idsToRemove = this.collectElementIdsWithEmbeddedChildren([id]);

      // When deleting a MULTI_LABEL container, also remove all elements
      // inside the label #1 region (the per-label template elements).
      if (targetElement.type === ElementType.MULTI_LABEL) {
        const ml = multiLabelSettingsFromElement(targetElement);
        for (const page of this.pages) {
          const { labelElements } = classifyLabelElements(page.elements, ml);
          labelElements.forEach((el) => idsToRemove.add(el.id));
        }
      }

      for (const page of this.pages) {
        for (let index = page.elements.length - 1; index >= 0; index -= 1) {
          if (idsToRemove.has(page.elements[index].id)) {
            page.elements.splice(index, 1);
          }
        }
      }
      if (this.selectedElementId && idsToRemove.has(this.selectedElementId)) {
        this.selectedElementId = null;
      }
      if (
        this.tableSelection &&
        idsToRemove.has(this.tableSelection.elementId)
      ) {
        this.tableSelection = null;
      }
      this.selectedElementIds = this.selectedElementIds.filter(
        (selectedId) => !idsToRemove.has(selectedId),
      );
    },

  async loadCustomElements() {
      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      if (mode !== "remote") return;
      try {
        const url = buildEndpoint(
          endpoints.customElements?.list,
          "",
          this.crudScopeId,
        );
        const options = buildFetchOptions(
          endpoints.customElements?.list,
          "GET",
          headers,
        );
        const res = await (fetcher || fetch)(url, options);
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.customElements || [];
        this.customElements = list
          .filter(
            (el: any) =>
              el &&
              typeof el.id === "string" &&
              typeof el.name === "string" &&
              (el.element ||
                this.customElements.some((e) => e.id === el.id) ||
                this.customElementDetailCache[el.id]),
          )
          .map((el: any) => {
            const existing = this.customElements.find((e) => e.id === el.id);
            const cached = this.customElementDetailCache[el.id];
            const merged = {
              id: el.id,
              name: el.name,
              element: el.element
                ? cloneDeep(el.element)
                : cloneDeep(cached?.element || existing?.element || {}),
              testData: el.testData || cached?.testData || existing?.testData,
              permissions:
                el.permissions ?? cached?.permissions ?? existing?.permissions,
              ext: mergeExt(existing?.ext, cached?.ext, el.ext),
            };
            const normalized = normalizeEntityConstraints(merged);
            this.customElementDetailCache[el.id] = normalized;
            return normalized as CustomElementTemplate;
          });
      } catch (e) {
        console.error("Failed to load custom elements", e);
      }
    },

  async copyCustomElement(id: string, extraValues?: Record<string, any>) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      const el = this.customElements.find((el) => el.id === id);
      if (!el) return;
      if (!canCopyEntity(el)) {
        toast.warning(i18n.global.t("toast.customElementCopyNotAllowed"));
        return;
      }
      const cachedElement = this.customElementDetailCache[id];
      const source: any =
        mode === "remote"
          ? {
              id: el.id,
              name: el.name,
              element: (el as any).element || cachedElement?.element,
              testData: (el as any).testData || cachedElement?.testData,
              ext: mergeExt(cachedElement?.ext, el.ext),
            }
          : el;

      let targetName = `${source.name} Copy`;
      if (extraValues && extraValues.name) {
        targetName = extraValues.name;
        delete extraValues.name;
      }

      const templateBase = applyModalExtraValues(
        {
          id: uuidv4(),
          name: targetName,
          element: cloneDeep(source.element),
          testData: cloneDeep(source.testData),
          ext: source.ext,
          // A copied custom element should become a normal editable entity by default.
          permissions: {
            ...(source.permissions && typeof source.permissions === "object"
              ? source.permissions
              : {}),
          },
        },
        "copy",
        extraValues,
      );

      const template: CustomElementTemplate = normalizeEntityConstraints(
        templateBase,
      ) as CustomElementTemplate;
      if (mode === "remote") {
        try {
          const url = buildEndpoint(
            endpoints.customElements?.upsert,
            "",
            this.crudScopeId,
          );
          const options = buildFetchOptions(
            endpoints.customElements?.upsert,
            "POST",
            headers,
            template,
          );
          const res = await (fetcher || fetch)(url, options);
          const result = await res.json();
          if (result && typeof result === "object") {
            if (result.ext) {
              template.ext = { ...(template.ext || {}), ...result.ext };
            }
          }
          template.id = result?.id || template.id;
          const cached = this.customElementDetailCache[template.id];
          this.customElementDetailCache[template.id] =
            normalizeEntityConstraints({
              id: template.id,
              name: template.name,
              element: cloneDeep(template.element || cached?.element || {}),
              testData: template.testData || cached?.testData,
              permissions: template.permissions ?? cached?.permissions,
              ext: mergeExt(cached?.ext, template.ext),
            }) as CustomElementTemplate;

          await this.loadCustomElements();
        } catch (e) {
          console.error("Failed to copy custom element", e);
          toast.error(i18n.global.t("toast.customElementCopyFailed"));
        }
      } else {
        this.customElements.push(template);
        this.saveCustomElements();
      }
    },

  async addCustomElement(
      name: string,
      element: PrintElement,
      extraValues?: Record<string, any>,
    ) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      const template = applyModalExtraValues(
        {
          id: uuidv4(),
          name,
          element: cloneDeep(element),
          ext: {},
        },
        "create",
        extraValues,
      ) as CustomElementTemplate;

      const payloadTemplate = normalizeEntityConstraints(
        template,
      ) as CustomElementTemplate;

      if (mode === "remote") {
        try {
          const url = buildEndpoint(
            endpoints.customElements?.upsert,
            "",
            this.crudScopeId,
          );
          const options = buildFetchOptions(
            endpoints.customElements?.upsert,
            "POST",
            headers,
            payloadTemplate,
          );
          const res = await (fetcher || fetch)(url, options);
          const result = await res.json();
          if (result && typeof result === "object") {
            if (result.ext) {
              payloadTemplate.ext = {
                ...(payloadTemplate.ext || {}),
                ...result.ext,
              };
            }
          }
          payloadTemplate.id = result?.id || payloadTemplate.id;
          const cached = this.customElementDetailCache[payloadTemplate.id];
          this.customElementDetailCache[payloadTemplate.id] =
            normalizeEntityConstraints({
              id: payloadTemplate.id,
              name: payloadTemplate.name,
              element: cloneDeep(
                payloadTemplate.element || cached?.element || {},
              ),
              testData: payloadTemplate.testData || cached?.testData,
              permissions: payloadTemplate.permissions ?? cached?.permissions,
              ext: mergeExt(cached?.ext, payloadTemplate.ext),
            }) as CustomElementTemplate;

          await this.loadCustomElements();
        } catch (e) {
          console.error("Failed to add custom element", e);
          toast.error(i18n.global.t("toast.customElementAddFailed"));
        }
      } else {
        this.customElements.push(payloadTemplate);
        this.saveCustomElements();
      }
    },

  async removeCustomElement(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      const existing = this.customElements.find((el) => el.id === id);
      if (existing && !canDeleteEntity(existing)) {
        toast.warning(i18n.global.t("toast.customElementDeleteNotAllowed"));
        return;
      }
      const index = this.customElements.findIndex((el) => el.id === id);
      if (index !== -1) {
        this.customElements.splice(index, 1);
        delete this.customElementDetailCache[id];
        if (mode === "remote") {
          try {
            const url = buildEndpoint(
              endpoints.customElements?.delete,
              id,
              this.crudScopeId,
            );
            const options = buildFetchOptions(
              endpoints.customElements?.delete,
              "DELETE",
              headers,
            );
            await (fetcher || fetch)(url, options);
            await this.loadCustomElements();
          } catch (e) {
            console.error("Failed to remove custom element", e);
            toast.error(i18n.global.t("toast.customElementRemoveFailed"));
          }
          return;
        }
        this.saveCustomElements();
      }
    },

  async editCustomElement(
      id: string,
      newName: string,
      extraValues?: Record<string, any>,
    ) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig(
        this.crudScopeId,
      );
      const template = this.customElements.find((el) => el.id === id);
      if (template) {
        if (!canEditEntity(template)) {
          toast.warning(i18n.global.t("toast.customElementReadOnly"));
          return;
        }
        template.name = newName;
        const cachedTemplate = this.customElementDetailCache[id];

        const mergedTemplate = applyModalExtraValues(
          {
            ...template,
            ext: mergeExt(cachedTemplate?.ext, template.ext),
          },
          "edit",
          extraValues,
        );

        template.ext = mergedTemplate.ext;

        if (mode === "remote") {
          try {
            const payload = normalizeEntityConstraints({
              id: template.id,
              name: newName,
              element: cloneDeep(template.element),
              testData: template.testData,
              permissions: template.permissions ?? cachedTemplate?.permissions,
              ext: mergedTemplate.ext,
            }) as CustomElementTemplate;
            const url = buildEndpoint(
              endpoints.customElements?.upsert,
              "",
              this.crudScopeId,
            );
            const options = buildFetchOptions(
              endpoints.customElements?.upsert,
              "POST",
              headers,
              payload,
            );
            await (fetcher || fetch)(url, options);
            const cached = this.customElementDetailCache[id];
            this.customElementDetailCache[id] = normalizeEntityConstraints({
              id: payload.id,
              name: payload.name,
              element: cloneDeep(payload.element || cached?.element || {}),
              testData: payload.testData || cached?.testData,
              permissions: payload.permissions ?? cached?.permissions,
              ext: mergeExt(cached?.ext, payload.ext),
            }) as CustomElementTemplate;
            await this.loadCustomElements();
          } catch (e) {
            console.error("Failed to edit custom element", e);
            toast.error(i18n.global.t("toast.customElementEditFailed"));
          }
          return;
        }
        this.saveCustomElements();
      }
    },

  saveCustomElements() {
      const { mode } = getCrudConfig(this.crudScopeId);
      if (mode === "remote") return;
      localStorage.setItem(
        "print-designer-custom-elements",
        JSON.stringify(this.customElements),
      );
    }
};
