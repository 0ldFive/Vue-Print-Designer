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

export const guideActions = {
  snapshot(actionKey: string = HISTORY_ACTION.UNKNOWN) {
      if (this.historyPast.length >= 20) {
        this.historyPast.shift();
        this.historyPastActionKeys.shift();
      }
      this.historyPast.push(cloneDeep(this.pages));
      this.historyPastActionKeys.push(actionKey);
      this.historyFuture = [];
      this.historyFutureActionKeys = [];
    },

  addGuide(guide: { type: "horizontal" | "vertical"; position: number }) {
      this.guides.push({ ...guide, id: uuidv4() });
    },

  updateGuide(id: string, position: number) {
      const guide = this.guides.find((g) => g.id === id);
      if (guide) {
        guide.position = position;
      }
    },

  removeGuide(id: string) {
      const index = this.guides.findIndex((g) => g.id === id);
      if (index !== -1) {
        this.guides.splice(index, 1);
        if (this.selectedGuideId === id) {
          this.selectedGuideId = null;
        }
      }
    },

  clearGuides() {
      this.guides = [];
    },

  selectGuide(id: string | null) {
      this.selectedGuideId = id;
      if (id) {
        this.selectedElementId = null;
        this.selectedElementIds = [];
        this.tableSelection = null;
      }
    },

  setHighlightedGuide(id: string | null) {
      this.highlightedGuideId = id;
    },

  setHighlightedEdge(edge: "left" | "top" | "right" | "bottom" | null) {
      this.highlightedEdge = edge;
    },

  setHighlightedAlignedElements(ids: string[]) {
      this.highlightedAlignedElementIds = Array.from(new Set(ids));
    },

  setShowMarginLines(show: boolean) {
      this.showMarginLines = show;
    },

  getSnapPosition(
      el: PrintElement,
      nx: number,
      ny: number,
      isKeyboard: boolean = false,
      constrain: boolean = true,
      pageIndex: number = -1,
    ) {
      const threshold = 6;
      const epsilon = 0.5;
      let x = nx;
      let y = ny;
      let highlightedGuideId: string | null = null;
      let highlightedEdge: "left" | "top" | "right" | "bottom" | null = null;
      const highlightedAlignedElementIds = new Set<string>();
      let guideSnappedX = false;
      let guideSnappedY = false;

      const getCenter = (min: number, max: number) => (min + max) / 2;

      const shouldSnap = (
        target: number,
        current: number,
        snapPoint: number,
      ) => {
        const dist = Math.abs(target - snapPoint);
        if (dist > threshold) return false;
        if (isKeyboard) {
          const oldDist = Math.abs(current - snapPoint);
          return dist < oldDist;
        }
        return true;
      };

      const currentBounds = this.getElementBoundsAtPosition(el, el.x, el.y);
      const movementBounds = this.getElementMovementBounds(el);
      const {
        minX,
        maxX,
        minY,
        maxY,
        maxXBoundary,
        maxYBoundary,
        originBounds,
      } = movementBounds;
      const minXBoundary = this.pageSpacingX || 0;
      const minYBoundary = this.pageSpacingY || 0;

      // 1) Snap to canvas edges
      const targetBounds = this.getElementBoundsAtPosition(el, x, y);
      if (shouldSnap(targetBounds.minX, currentBounds.minX, minXBoundary)) {
        x = minX;
        highlightedEdge = "left";
      } else if (
        shouldSnap(targetBounds.maxX, currentBounds.maxX, maxXBoundary)
      ) {
        x = maxX;
        highlightedEdge = "right";
      }

      const targetBoundsY = this.getElementBoundsAtPosition(el, x, y);
      if (shouldSnap(targetBoundsY.minY, currentBounds.minY, minYBoundary)) {
        y = minY;
        highlightedEdge = highlightedEdge || "top";
      } else if (
        shouldSnap(targetBoundsY.maxY, currentBounds.maxY, maxYBoundary)
      ) {
        y = maxY;
        highlightedEdge = highlightedEdge || "bottom";
      }

      // 2) Snap to custom guides
      for (const guide of this.guides) {
        if (guide.type === "vertical") {
          const guideBounds = this.getElementBoundsAtPosition(el, x, y);
          if (
            shouldSnap(guideBounds.minX, currentBounds.minX, guide.position)
          ) {
            x = guide.position - originBounds.minX;
            highlightedGuideId = guide.id;
            guideSnappedX = true;
          } else if (
            shouldSnap(guideBounds.maxX, currentBounds.maxX, guide.position)
          ) {
            x = guide.position - originBounds.maxX;
            highlightedGuideId = guide.id;
            guideSnappedX = true;
          }
        } else {
          const guideBounds = this.getElementBoundsAtPosition(el, x, y);
          if (
            shouldSnap(guideBounds.minY, currentBounds.minY, guide.position)
          ) {
            y = guide.position - originBounds.minY;
            highlightedGuideId = guide.id;
            guideSnappedY = true;
          } else if (
            shouldSnap(guideBounds.maxY, currentBounds.maxY, guide.position)
          ) {
            y = guide.position - originBounds.maxY;
            highlightedGuideId = guide.id;
            guideSnappedY = true;
          }
        }
      }

      // 3) Snap to other elements on the same page (left/center/right and top/middle/bottom)
      let activePageIndex = pageIndex;
      if (activePageIndex < 0 || activePageIndex >= this.pages.length) {
        activePageIndex = this.pages.findIndex((page) =>
          page.elements.some((item) => item.id === el.id),
        );
      }

      const selectedSet = new Set(this.selectedElementIds);
      selectedSet.add(el.id);

      const movingTableIds = new Set<string>();
      if (activePageIndex >= 0) {
        for (const item of this.pages[activePageIndex].elements) {
          if (!selectedSet.has(item.id)) continue;
          if (item.type === ElementType.TABLE) {
            movingTableIds.add(item.id);
          }
        }
      }

      const referenceElements =
        activePageIndex >= 0
          ? this.pages[activePageIndex].elements.filter(
              (item) =>
                !selectedSet.has(item.id) &&
                (!item.embeddedInTableId ||
                  !movingTableIds.has(item.embeddedInTableId)),
            )
          : [];

      if (referenceElements.length > 0) {
        type XPointKey = "left" | "center" | "right";
        type YPointKey = "top" | "middle" | "bottom";

        let bestX: {
          dist: number;
          priority: number;
          newPos: number;
          movingKey: XPointKey;
          snapPoint: number;
        } | null = null;
        let bestY: {
          dist: number;
          priority: number;
          newPos: number;
          movingKey: YPointKey;
          snapPoint: number;
        } | null = null;

        const evalBounds = this.getElementBoundsAtPosition(el, x, y);
        const movingXPoints: Array<{
          key: XPointKey;
          target: number;
          current: number;
        }> = [
          { key: "left", target: evalBounds.minX, current: currentBounds.minX },
          {
            key: "center",
            target: getCenter(evalBounds.minX, evalBounds.maxX),
            current: getCenter(currentBounds.minX, currentBounds.maxX),
          },
          {
            key: "right",
            target: evalBounds.maxX,
            current: currentBounds.maxX,
          },
        ];
        const movingYPoints: Array<{
          key: YPointKey;
          target: number;
          current: number;
        }> = [
          { key: "top", target: evalBounds.minY, current: currentBounds.minY },
          {
            key: "middle",
            target: getCenter(evalBounds.minY, evalBounds.maxY),
            current: getCenter(currentBounds.minY, currentBounds.maxY),
          },
          {
            key: "bottom",
            target: evalBounds.maxY,
            current: currentBounds.maxY,
          },
        ];

        for (const item of referenceElements) {
          const otherBounds = this.getElementBoundsAtPosition(
            item,
            item.x,
            item.y,
          );
          const otherXPoints = [
            otherBounds.minX,
            getCenter(otherBounds.minX, otherBounds.maxX),
            otherBounds.maxX,
          ];
          const otherYPoints = [
            otherBounds.minY,
            getCenter(otherBounds.minY, otherBounds.maxY),
            otherBounds.maxY,
          ];

          for (const movingPoint of movingXPoints) {
            for (const snapPoint of otherXPoints) {
              if (
                !shouldSnap(movingPoint.target, movingPoint.current, snapPoint)
              )
                continue;
              const dist = Math.abs(movingPoint.target - snapPoint);
              const priority = movingPoint.key === "center" ? 0 : 1;
              const isBetter =
                !bestX ||
                dist < bestX.dist - 1e-6 ||
                (Math.abs(dist - bestX.dist) <= 1e-6 &&
                  priority < bestX.priority);
              if (isBetter) {
                bestX = {
                  dist,
                  priority,
                  newPos: x + (snapPoint - movingPoint.target),
                  movingKey: movingPoint.key,
                  snapPoint,
                };
              }
            }
          }

          for (const movingPoint of movingYPoints) {
            for (const snapPoint of otherYPoints) {
              if (
                !shouldSnap(movingPoint.target, movingPoint.current, snapPoint)
              )
                continue;
              const dist = Math.abs(movingPoint.target - snapPoint);
              const priority = movingPoint.key === "middle" ? 0 : 1;
              const isBetter =
                !bestY ||
                dist < bestY.dist - 1e-6 ||
                (Math.abs(dist - bestY.dist) <= 1e-6 &&
                  priority < bestY.priority);
              if (isBetter) {
                bestY = {
                  dist,
                  priority,
                  newPos: y + (snapPoint - movingPoint.target),
                  movingKey: movingPoint.key,
                  snapPoint,
                };
              }
            }
          }
        }

        const appliedBestX = guideSnappedX ? null : bestX;
        const appliedBestY = guideSnappedY ? null : bestY;

        if (appliedBestX) {
          x = appliedBestX.newPos;
        }
        if (appliedBestY) {
          y = appliedBestY.newPos;
        }

        if (appliedBestX || appliedBestY) {
          const snappedBounds = this.getElementBoundsAtPosition(el, x, y);
          const snappedX = !appliedBestX
            ? null
            : appliedBestX.movingKey === "left"
              ? snappedBounds.minX
              : appliedBestX.movingKey === "right"
                ? snappedBounds.maxX
                : getCenter(snappedBounds.minX, snappedBounds.maxX);
          const snappedY = !appliedBestY
            ? null
            : appliedBestY.movingKey === "top"
              ? snappedBounds.minY
              : appliedBestY.movingKey === "bottom"
                ? snappedBounds.maxY
                : getCenter(snappedBounds.minY, snappedBounds.maxY);

          for (const item of referenceElements) {
            const otherBounds = this.getElementBoundsAtPosition(
              item,
              item.x,
              item.y,
            );
            if (snappedX !== null) {
              const xPoints = [
                otherBounds.minX,
                getCenter(otherBounds.minX, otherBounds.maxX),
                otherBounds.maxX,
              ];
              if (
                xPoints.some((point) => Math.abs(point - snappedX) <= epsilon)
              ) {
                highlightedAlignedElementIds.add(item.id);
              }
            }
            if (snappedY !== null) {
              const yPoints = [
                otherBounds.minY,
                getCenter(otherBounds.minY, otherBounds.maxY),
                otherBounds.maxY,
              ];
              if (
                yPoints.some((point) => Math.abs(point - snappedY) <= epsilon)
              ) {
                highlightedAlignedElementIds.add(item.id);
              }
            }
          }
        }
      }

      // 4) Keep element(s) inside movement constraints
      let applyStrictX = constrain;
      let applyStrictY = constrain;
      let applyPartialTop = false;
      let applyPartialBottom = false;

      if (!constrain) {
        applyStrictX = false;
        applyStrictY = false;
      }

      if (applyStrictX) {
        x = Math.min(Math.max(minX, x), maxX);
      }

      if (applyStrictY) {
        y = Math.min(Math.max(minY, y), maxY);
      } else {
        if (applyPartialTop) {
          y = Math.max(minY, y);
        }
        if (applyPartialBottom) {
          y = Math.min(y, maxY);
        }
      }

      return {
        x,
        y,
        highlightedGuideId,
        highlightedEdge,
        highlightedAlignedElementIds: Array.from(highlightedAlignedElementIds),
      };
    },

  moveElementWithSnap(
      id: string,
      x: number,
      y: number,
      createSnapshot: boolean = true,
      constrain: boolean = true,
    ) {
      if (!this.isTemplateEditable) return;
      for (let i = 0; i < this.pages.length; i++) {
        const page = this.pages[i];
        const index = page.elements.findIndex((e) => e.id === id);
        if (index !== -1) {
          const el = page.elements[index];
          if (el.locked) return; // Prevent moving locked element
          const snapped = this.getSnapPosition(el, x, y, false, constrain, i);
          this.setHighlightedGuide(snapped.highlightedGuideId || null);
          this.setHighlightedEdge(snapped.highlightedEdge || null);
          this.setHighlightedAlignedElements(
            snapped.highlightedAlignedElementIds || [],
          );
          this.updateElement(
            id,
            { x: snapped.x, y: snapped.y },
            createSnapshot,
          );
          return;
        }
      }
    },

  alignSelectedElements(
      type: "left" | "center" | "right" | "top" | "middle" | "bottom",
    ) {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;

      // Filter out locked elements
      const elements: PrintElement[] = [];
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) {
            elements.push(el);
            break;
          }
        }
      }

      if (elements.length === 0) return;

      const normalElements: PrintElement[] = [];
      const embeddedElements: Array<{
        element: PrintElement;
        bounds: EmbeddedCellBounds;
      }> = [];

      for (const element of elements) {
        const isEmbeddedElement =
          !!element.embeddedInTableId && !!element.embeddedInTableCell;
        if (!isEmbeddedElement) {
          normalElements.push(element);
          continue;
        }

        const bounds = this.getEmbeddedElementCellBounds(element);
        if (!bounds) continue;

        embeddedElements.push({ element, bounds });
      }

      if (normalElements.length === 0 && embeddedElements.length === 0) {
        return;
      }

      const selectedIdSet = new Set(this.selectedElementIds);
      const tablePositionBeforeAlign = new Map<
        string,
        { element: PrintElement; x: number; y: number }
      >();
      for (const element of normalElements) {
        if (element.type !== ElementType.TABLE) continue;
        tablePositionBeforeAlign.set(element.id, {
          element,
          x: element.x,
          y: element.y,
        });
      }

      this.snapshot(HISTORY_ACTION.ELEMENT_ALIGN);

      const canvasW = this.canvasSize.width;
      const canvasH = this.canvasSize.height;
      const marginX = this.pageSpacingX || 0;
      const marginY = this.pageSpacingY || 0;
      const contentX = marginX;
      const contentW = Math.max(0, canvasW - marginX * 2);
      // Body area: excludes header/footer ranges when they are enabled
      const bodyY = this.showHeaderLine ? marginY + this.headerHeight : marginY;
      const bodyBottom = this.showFooterLine
        ? canvasH - (this.footerHeight + marginY)
        : canvasH - marginY;
      const bodyH = Math.max(0, bodyBottom - bodyY);
      const isVerticalAlignment =
        type === "top" || type === "middle" || type === "bottom";
      const headerBoundary = marginY + this.headerHeight;
      const footerBoundary = canvasH - (this.footerHeight + marginY);
      const getVerticalAlignmentArea = (el: PrintElement) => {
        if (!isVerticalAlignment) return null;

        const bounds = this.getElementBoundsAtPosition(el, el.x, el.y);
        if (this.showHeaderLine && bounds.maxY <= headerBoundary) {
          return {
            y: marginY,
            height: Math.max(0, this.headerHeight),
          };
        }

        if (this.showFooterLine && bounds.minY >= footerBoundary) {
          return {
            y: footerBoundary,
            height: Math.max(0, this.footerHeight),
          };
        }

        return null;
      };
      const getBodyVerticalArea = () => ({
        y: bodyY,
        height: bodyH,
      });
      let handledAsGroupAlignment = false;

      if (elements.length > 1) {
        const minX = Math.min(...elements.map((e) => e.x));
        const maxX = Math.max(...elements.map((e) => e.x + e.width));
        const minY = Math.min(...elements.map((e) => e.y));
        const maxY = Math.max(...elements.map((e) => e.y + e.height));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const normalVerticalAreas = normalElements.map((el) =>
          getVerticalAlignmentArea(el),
        );
        const sharedVerticalArea =
          normalElements.length === elements.length &&
          normalVerticalAreas[0] &&
          normalVerticalAreas.every(
            (area) =>
              area &&
              area.y === normalVerticalAreas[0]!.y &&
              area.height === normalVerticalAreas[0]!.height,
          )
            ? normalVerticalAreas[0]
            : null;
        const verticalTargetArea = sharedVerticalArea || {
          y: bodyY,
          height: bodyH,
        };
        let offsetX = 0;
        let offsetY = 0;

        switch (type) {
          case "left":
            offsetX = contentX - minX;
            break;
          case "center":
            offsetX = contentX + contentW / 2 - centerX;
            break;
          case "right":
            offsetX = contentX + contentW - maxX;
            break;
          case "top":
            offsetY = verticalTargetArea.y - minY;
            break;
          case "middle":
            offsetY = verticalTargetArea.y + verticalTargetArea.height / 2 - centerY;
            break;
          case "bottom":
            offsetY = verticalTargetArea.y + verticalTargetArea.height - maxY;
            break;
        }

        const embeddedBoundsById = new Map(
          embeddedElements.map((item) => [item.element.id, item.bounds]),
        );

        elements.forEach((el) => {
          const targetX = el.x + offsetX;
          const targetY = el.y + offsetY;
          const embeddedBounds = embeddedBoundsById.get(el.id);

          if (embeddedBounds) {
            const constrained = this.constrainElementPositionToBounds(
              el,
              targetX,
              targetY,
              embeddedBounds,
            );
            el.x = constrained.x;
            el.y = constrained.y;
            return;
          }

          el.x = targetX;
          el.y = targetY;
        });

        handledAsGroupAlignment = true;
      } else if (normalElements.length === 1) {
        // Align to canvas (respecting margins)
        const el = normalElements[0];
        const verticalArea = getVerticalAlignmentArea(el) || getBodyVerticalArea();

        switch (type) {
          case "left":
            el.x = contentX;
            break;
          case "center":
            el.x = contentX + (contentW - el.width) / 2;
            break;
          case "right":
            el.x = contentX + contentW - el.width;
            break;
          case "top":
            el.y = verticalArea.y;
            break;
          case "middle":
            el.y = verticalArea.y + (verticalArea.height - el.height) / 2;
            break;
          case "bottom":
            el.y = verticalArea.y + verticalArea.height - el.height;
            break;
        }
      }

      if (!handledAsGroupAlignment) embeddedElements.forEach(({ element, bounds }) => {
        let x = element.x;
        let y = element.y;

        switch (type) {
          case "left":
            x = bounds.x;
            break;
          case "center":
            x = bounds.x + (bounds.width - element.width) / 2;
            break;
          case "right":
            x = bounds.x + bounds.width - element.width;
            break;
          case "top":
            y = bounds.y;
            break;
          case "middle":
            y = bounds.y + (bounds.height - element.height) / 2;
            break;
          case "bottom":
            y = bounds.y + bounds.height - element.height;
            break;
        }

        const constrained = this.constrainElementPositionToBounds(
          element,
          x,
          y,
          bounds,
        );
        element.x = constrained.x;
        element.y = constrained.y;
      });

      const movedTableDeltaById = new Map<string, { dx: number; dy: number }>();
      for (const [tableId, before] of tablePositionBeforeAlign) {
        const dx = before.element.x - before.x;
        const dy = before.element.y - before.y;
        if (dx === 0 && dy === 0) continue;
        movedTableDeltaById.set(tableId, { dx, dy });
      }
      this.moveEmbeddedElementsByTableDelta(movedTableDeltaById, {
        excludeIds: selectedIdSet,
      });
    },

  matchSelectedElementsSize(mode: "width" | "height" | "both") {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length < 2) return;

      const primaryElement = this.selectedElement;
      if (!primaryElement || primaryElement.locked) return;

      const selectedSet = new Set(this.selectedElementIds);
      const targetElements: PrintElement[] = [];
      for (const page of this.pages) {
        for (const el of page.elements) {
          if (selectedSet.has(el.id) && !el.locked) {
            targetElements.push(el);
          }
        }
      }

      if (targetElements.length < 2) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_RESIZE);
      targetElements.forEach((el) => {
        if (mode === "width" || mode === "both") {
          el.width = primaryElement.width;
        }
        if (mode === "height" || mode === "both") {
          el.height = primaryElement.height;
        }
      });
    },

  distributeSelectedElements(axis: "horizontal" | "vertical") {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length < 3) return;

      const selectedSet = new Set(this.selectedElementIds);
      const normalGroups: PrintElement[][] = [];
      const embeddedGroupMap = new Map<
        string,
        Array<{ element: PrintElement; bounds: EmbeddedCellBounds }>
      >();

      for (const page of this.pages) {
        const normalElements: PrintElement[] = [];

        for (const element of page.elements) {
          if (!selectedSet.has(element.id) || element.locked) continue;

          const isEmbeddedElement =
            !!element.embeddedInTableId && !!element.embeddedInTableCell;
          if (!isEmbeddedElement) {
            normalElements.push(element);
            continue;
          }

          const bounds = this.getEmbeddedElementCellBounds(element);
          if (!bounds) continue;

          const cell = element.embeddedInTableCell!;
          const section = cell.section === "footer" ? "footer" : "body";
          const groupKey = `${element.embeddedInTableId}|${section}|${cell.rowIndex}|${cell.colField}`;

          if (!embeddedGroupMap.has(groupKey)) {
            embeddedGroupMap.set(groupKey, []);
          }

          embeddedGroupMap.get(groupKey)!.push({ element, bounds });
        }

        if (normalElements.length >= 3) {
          normalGroups.push(normalElements);
        }
      }

      const embeddedGroups = Array.from(embeddedGroupMap.values()).filter(
        (group) => group.length >= 3,
      );

      if (normalGroups.length === 0 && embeddedGroups.length === 0) return;

      const tablePositionBeforeDistribute = new Map<
        string,
        { element: PrintElement; x: number; y: number }
      >();
      for (const elements of normalGroups) {
        for (const element of elements) {
          if (element.type !== ElementType.TABLE) continue;
          if (tablePositionBeforeDistribute.has(element.id)) continue;
          tablePositionBeforeDistribute.set(element.id, {
            element,
            x: element.x,
            y: element.y,
          });
        }
      }

      this.snapshot(HISTORY_ACTION.ELEMENT_ALIGN);
      normalGroups.forEach((elements) => {
        const sorted = [...elements].sort((a, b) => {
          const centerA =
            axis === "horizontal" ? a.x + a.width / 2 : a.y + a.height / 2;
          const centerB =
            axis === "horizontal" ? b.x + b.width / 2 : b.y + b.height / 2;
          return centerA - centerB;
        });

        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const start =
          axis === "horizontal"
            ? first.x + first.width / 2
            : first.y + first.height / 2;
        const end =
          axis === "horizontal"
            ? last.x + last.width / 2
            : last.y + last.height / 2;
        const gap = (end - start) / (sorted.length - 1);

        sorted.forEach((el, index) => {
          if (index === 0 || index === sorted.length - 1) return;

          const center = start + gap * index;
          if (axis === "horizontal") {
            el.x = center - el.width / 2;
          } else {
            el.y = center - el.height / 2;
          }
        });
      });

      embeddedGroups.forEach((elements) => {
        const sorted = [...elements].sort((a, b) => {
          const centerA =
            axis === "horizontal"
              ? a.element.x + a.element.width / 2
              : a.element.y + a.element.height / 2;
          const centerB =
            axis === "horizontal"
              ? b.element.x + b.element.width / 2
              : b.element.y + b.element.height / 2;
          return centerA - centerB;
        });

        sorted.forEach((item) => {
          const constrained = this.constrainElementPositionToBounds(
            item.element,
            item.element.x,
            item.element.y,
            item.bounds,
          );
          item.element.x = constrained.x;
          item.element.y = constrained.y;
        });

        const first = sorted[0].element;
        const last = sorted[sorted.length - 1].element;
        const start =
          axis === "horizontal"
            ? first.x + first.width / 2
            : first.y + first.height / 2;
        const end =
          axis === "horizontal"
            ? last.x + last.width / 2
            : last.y + last.height / 2;
        const gap = (end - start) / (sorted.length - 1);

        sorted.forEach((item, index) => {
          if (index === 0 || index === sorted.length - 1) return;

          const center = start + gap * index;
          let x = item.element.x;
          let y = item.element.y;

          if (axis === "horizontal") {
            x = center - item.element.width / 2;
          } else {
            y = center - item.element.height / 2;
          }

          const constrained = this.constrainElementPositionToBounds(
            item.element,
            x,
            y,
            item.bounds,
          );
          item.element.x = constrained.x;
          item.element.y = constrained.y;
        });
      });

      const movedTableDeltaById = new Map<string, { dx: number; dy: number }>();
      for (const [tableId, before] of tablePositionBeforeDistribute) {
        const dx = before.element.x - before.x;
        const dy = before.element.y - before.y;
        if (dx === 0 && dy === 0) continue;
        movedTableDeltaById.set(tableId, { dx, dy });
      }
      this.moveEmbeddedElementsByTableDelta(movedTableDeltaById, {
        excludeIds: selectedSet,
      });
    }
};
