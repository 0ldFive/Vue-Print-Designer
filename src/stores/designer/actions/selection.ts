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

export const selectionActions = {
  moveSelectedElements(
      primaryId: string,
      x: number,
      y: number,
      createSnapshot: boolean = true,
      constrain: boolean = true,
    ) {
      if (!this.isTemplateEditable) return;
      if (createSnapshot) {
        this.snapshot(HISTORY_ACTION.ELEMENT_MOVE);
      }

      // 1. Gather all necessary data in ONE pass
      let primaryElement: PrintElement | null = null;
      let primaryPageIndex: number = -1;
      const movableElements: {
        pageIndex: number;
        elementIndex: number;
        element: PrintElement;
      }[] = [];

      // Create a Set for O(1) lookup
      const selectedSet = new Set(this.selectedElementIds);

      // Iterate once to find primary element and all movable elements
      for (let pIndex = 0; pIndex < this.pages.length; pIndex++) {
        const page = this.pages[pIndex];
        for (let eIndex = 0; eIndex < page.elements.length; eIndex++) {
          const el = page.elements[eIndex];
          if (el.id === primaryId) {
            primaryElement = el;
            primaryPageIndex = pIndex;
          }
          if (selectedSet.has(el.id) && !el.locked) {
            movableElements.push({
              pageIndex: pIndex,
              elementIndex: eIndex,
              element: el,
            });
          }
        }
      }

      if (!primaryElement || primaryElement.locked) return;

      // 2. Calculate snap for primary element
      const snapped = this.getSnapPosition(
        primaryElement,
        x,
        y,
        false,
        constrain,
        primaryPageIndex,
      );

      this.setHighlightedGuide(snapped.highlightedGuideId || null);
      this.setHighlightedEdge(snapped.highlightedEdge || null);
      this.setHighlightedAlignedElements(
        snapped.highlightedAlignedElementIds || [],
      );

      // 3. Calculate actual delta
      let dx = snapped.x - primaryElement.x;
      let dy = snapped.y - primaryElement.y;

      if (dx === 0 && dy === 0) return;

      // 4. Constrain delta to ensure no element leaves the canvas (respecting margins)
      let checkX = constrain;
      let checkYStrict = constrain;
      let checkYPartial = false;

      if (!constrain) {
        checkX = false;
        checkYStrict = false;
        checkYPartial = false;
      }

      if (checkX || checkYStrict || checkYPartial) {
        for (const item of movableElements) {
          const el = item.element;
          const pIndex = item.pageIndex;
          const movementBounds = this.getElementMovementBounds(el);

          if (checkX) {
            if (dx > 0) {
              if (el.x + dx > movementBounds.maxX) {
                dx = movementBounds.maxX - el.x;
              }
            } else if (dx < 0) {
              if (el.x + dx < movementBounds.minX) {
                dx = movementBounds.minX - el.x;
              }
            }
          }

          if (checkYStrict) {
            if (dy > 0) {
              if (el.y + dy > movementBounds.maxY) {
                dy = movementBounds.maxY - el.y;
              }
            } else if (dy < 0) {
              if (el.y + dy < movementBounds.minY) {
                dy = movementBounds.minY - el.y;
              }
            }
          } else if (checkYPartial) {
            if (pIndex === 0) {
              if (dy < 0) {
                if (el.y + dy < movementBounds.minY)
                  dy = movementBounds.minY - el.y;
              }
            }

            if (pIndex === this.pages.length - 1) {
              if (dy > 0) {
                if (el.y + dy > movementBounds.maxY)
                  dy = movementBounds.maxY - el.y;
              }
            }
          }
        }
      }

      if (dx === 0 && dy === 0) return;

      const movedTableDeltaById = new Map<string, { dx: number; dy: number }>();
      for (const item of movableElements) {
        if (item.element.type !== ElementType.TABLE) continue;
        movedTableDeltaById.set(item.element.id, { dx, dy });
      }

      // 5. Apply constrained delta
      for (const item of movableElements) {
        const { pageIndex, elementIndex, element } = item;
        // Direct update to store state
        const movedElement = {
          ...element,
          x: element.x + dx,
          y: element.y + dy,
        };
        this.pages[pageIndex].elements[elementIndex] =
          this.normalizeTableForHeaderFooterRegion(movedElement);
      }

      this.moveEmbeddedElementsByTableDelta(movedTableDeltaById, {
        excludeIds: selectedSet,
      });
    },

  nudgeSelectedElements(dx: number, dy: number) {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;

      // Filter out locked elements
      const movableIds = this.selectedElementIds.filter((id) => {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (movableIds.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_NUDGE); // Snapshot once for the group move

      // 1. Identify primary element for snap calculation
      // Prefer the explicitly selected element if it's movable
      let primaryId = this.selectedElementId;
      if (!primaryId || !movableIds.includes(primaryId)) {
        primaryId = movableIds[0];
      }

      let primaryElement: PrintElement | null = null;
      let primaryPageIndex = -1;
      for (const page of this.pages) {
        const found = page.elements.find((e) => e.id === primaryId);
        if (found) {
          primaryElement = found;
          primaryPageIndex = this.pages.indexOf(page);
          break;
        }
      }

      if (!primaryElement) return;

      // 2. Calculate delta based on primary element's snapping
      const targetX = primaryElement.x + dx;
      const targetY = primaryElement.y + dy;
      const snapped = this.getSnapPosition(
        primaryElement,
        targetX,
        targetY,
        true,
        true,
        primaryPageIndex,
      );

      this.setHighlightedGuide(snapped.highlightedGuideId || null);
      this.setHighlightedEdge(snapped.highlightedEdge || null);
      this.setHighlightedAlignedElements(
        snapped.highlightedAlignedElementIds || [],
      );

      let actualDx = snapped.x - primaryElement.x;
      let actualDy = snapped.y - primaryElement.y;

      // 3. Constrain delta to ensure no element leaves the canvas (similar to moveSelectedElements)
      for (const id of movableIds) {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el) {
            const movementBounds = this.getElementMovementBounds(el);
            if (actualDx > 0) {
              if (el.x + actualDx > movementBounds.maxX) {
                actualDx = movementBounds.maxX - el.x;
              }
            } else if (actualDx < 0) {
              if (el.x + actualDx < movementBounds.minX) {
                actualDx = movementBounds.minX - el.x;
              }
            }

            if (actualDy > 0) {
              if (el.y + actualDy > movementBounds.maxY) {
                actualDy = movementBounds.maxY - el.y;
              }
            } else if (actualDy < 0) {
              if (el.y + actualDy < movementBounds.minY) {
                actualDy = movementBounds.minY - el.y;
              }
            }
          }
        }
      }

      if (actualDx === 0 && actualDy === 0) return;

      const movedIdsSet = new Set(movableIds);
      const movedTableDeltaById = new Map<string, { dx: number; dy: number }>();
      const alignedElementIds = new Set<string>(
        snapped.highlightedAlignedElementIds || [],
      );
      const alignEpsilon = 0.5;
      const getCenter = (min: number, max: number) => (min + max) / 2;

      for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
        const page = this.pages[pageIndex];
        const movingElements = page.elements.filter((item) =>
          movedIdsSet.has(item.id),
        );
        if (movingElements.length === 0) continue;

        const movingTableIds = new Set(
          movingElements
            .filter((item) => item.type === ElementType.TABLE)
            .map((item) => item.id),
        );
        const referenceElements = page.elements.filter(
          (item) =>
            !movedIdsSet.has(item.id) &&
            (!item.embeddedInTableId ||
              !movingTableIds.has(item.embeddedInTableId)),
        );

        for (const movingElement of movingElements) {
          const movedBounds = this.getElementBoundsAtPosition(
            movingElement,
            movingElement.x + actualDx,
            movingElement.y + actualDy,
          );
          const movedXPoints = [
            movedBounds.minX,
            getCenter(movedBounds.minX, movedBounds.maxX),
            movedBounds.maxX,
          ];
          const movedYPoints = [
            movedBounds.minY,
            getCenter(movedBounds.minY, movedBounds.maxY),
            movedBounds.maxY,
          ];

          for (const referenceElement of referenceElements) {
            const referenceBounds = this.getElementBoundsAtPosition(
              referenceElement,
              referenceElement.x,
              referenceElement.y,
            );
            const referenceXPoints = [
              referenceBounds.minX,
              getCenter(referenceBounds.minX, referenceBounds.maxX),
              referenceBounds.maxX,
            ];
            const referenceYPoints = [
              referenceBounds.minY,
              getCenter(referenceBounds.minY, referenceBounds.maxY),
              referenceBounds.maxY,
            ];
            const hasXAlignment = movedXPoints.some((movedPoint) =>
              referenceXPoints.some(
                (referencePoint) =>
                  Math.abs(referencePoint - movedPoint) <= alignEpsilon,
              ),
            );
            const hasYAlignment = movedYPoints.some((movedPoint) =>
              referenceYPoints.some(
                (referencePoint) =>
                  Math.abs(referencePoint - movedPoint) <= alignEpsilon,
              ),
            );

            if (hasXAlignment || hasYAlignment) {
              alignedElementIds.add(referenceElement.id);
            }
          }
        }
      }

      this.setHighlightedAlignedElements(Array.from(alignedElementIds));

      for (const id of movableIds) {
        for (const page of this.pages) {
          const el = page.elements.find((item) => item.id === id);
          if (!el) continue;
          if (el.type === ElementType.TABLE) {
            movedTableDeltaById.set(el.id, { dx: actualDx, dy: actualDy });
          }
          break;
        }
      }

      // 4. Move all movable elements by the constrained delta (Rigid Body)
      for (const id of movableIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex((e) => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            // A multi-label container drags its in-region label content along.
            if (el.type === ElementType.MULTI_LABEL) {
              const rx = el.x;
              const ry = el.y;
              const rw = el.width || 1;
              const rh = el.height || 1;
              for (let ci = 0; ci < page.elements.length; ci += 1) {
                const other = page.elements[ci];
                if (other.id === el.id) continue;
                if (other.type === ElementType.MULTI_LABEL) continue;
                if (movedIdsSet.has(other.id)) continue;
                if (other.locked) continue;
                const cx = (other.x || 0) + (other.width || 0) / 2;
                const cy = (other.y || 0) + (other.height || 0) / 2;
                if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) {
                  page.elements[ci] = {
                    ...other,
                    x: (other.x || 0) + actualDx,
                    y: (other.y || 0) + actualDy,
                  };
                }
              }
            }
            const movedElement = {
              ...el,
              x: el.x + actualDx,
              y: el.y + actualDy,
            };
            page.elements[index] =
              this.normalizeTableForHeaderFooterRegion(movedElement);
            break;
          }
        }
      }

      this.moveEmbeddedElementsByTableDelta(movedTableDeltaById, {
        excludeIds: movedIdsSet,
      });
    },

  selectElement(
      id: string | null,
      isMultiSelect: boolean = false,
      autoBringToFront: boolean = true,
    ) {
      // Clear guide selection when selecting elements
      if (id) {
        this.selectedGuideId = null;
      }

      // Always clear table selection when changing element selection
      if (this.tableSelection) {
        this.tableSelection = null;
      }

      if (isMultiSelect && id) {
        // Ctrl/Cmd multi-select
        if (this.selectedElementIds.includes(id)) {
          // Deselect if already selected
          const index = this.selectedElementIds.indexOf(id);
          this.selectedElementIds.splice(index, 1);
        } else {
          // Add to selection
          this.selectedElementIds.push(id);
        }
        // Update selectedElementId to the last selected
        this.selectedElementId =
          this.selectedElementIds.length > 0
            ? this.selectedElementIds[this.selectedElementIds.length - 1]
            : null;
      } else {
        // Normal selection
        this.selectedElementId = id;
        this.selectedElementIds = id ? [id] : [];
      }

      const hasUnlockedSelected = this.selectedElementIds.some((selectedId) =>
        this.pages.some((page) =>
          page.elements.some((el) => el.id === selectedId && !el.locked),
        ),
      );

      if (autoBringToFront && hasUnlockedSelected) {
        this.bringElementsToFront(this.selectedElementIds);
      }

      if (id) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex((p) =>
          p.elements.some((e) => e.id === id),
        );
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },

  clearSelection() {
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.tableSelection = null;
    },

  selectAllElements() {
      this.tableSelection = null;
      this.selectedGuideId = null;

      const allIds: string[] = [];
      for (const page of this.pages) {
        for (const element of page.elements) {
          allIds.push(element.id);
        }
      }

      this.selectedElementIds = allIds;
      if (allIds.length === 0) {
        this.selectedElementId = null;
        return;
      }

      const currentPage = this.pages[this.currentPageIndex];
      const fallbackId = allIds[allIds.length - 1];
      const currentPageLastId =
        currentPage && currentPage.elements.length > 0
          ? currentPage.elements[currentPage.elements.length - 1].id
          : null;

      this.selectedElementId = currentPageLastId || fallbackId;
    },

  setSelection(ids: string[]) {
      this.tableSelection = null;
      if (ids.length > 0) {
        this.selectedGuideId = null;
      }
      this.selectedElementIds = ids;
      this.selectedElementId = ids.length > 0 ? ids[ids.length - 1] : null;
      if (ids.length > 0) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex((p) =>
          p.elements.some((e) => e.id === this.selectedElementId),
        );
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },

  removeSelectedElements() {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;

      // Filter out locked elements
      const removableIds = this.selectedElementIds.filter((id) => {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (removableIds.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_REMOVE);
      const idsToRemove =
        this.collectElementIdsWithEmbeddedChildren(removableIds);
      for (const id of idsToRemove) {
        for (const page of this.pages) {
          const index = page.elements.findIndex((e) => e.id === id);
          if (index !== -1) {
            page.elements.splice(index, 1);
            break;
          }
        }
      }
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.tableSelection = null;
    },

  resizeSelectedElements(dw: number, dh: number) {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;

      const targetIds = this.selectedElementIds.filter((id) => {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (targetIds.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_RESIZE);

      for (const id of targetIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex((e) => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            const newWidth = Math.max(10, el.width + dw);
            const newHeight = Math.max(10, el.height + dh);

            page.elements[index] = {
              ...el,
              width: newWidth,
              height: newHeight,
            };
            break;
          }
        }
      }
    },

  updateSelectedElementsStyle(style: Partial<any>) {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;

      // Check if any selected element is locked
      const hasLocked = this.selectedElementIds.some((id) => {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && el.locked) return true;
        }
        return false;
      });

      // If any is locked, do we allow style update?
      // Usually lock prevents everything. Let's prevent style update for locked elements.

      const targetIds = this.selectedElementIds.filter((id) => {
        for (const page of this.pages) {
          const el = page.elements.find((e) => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (targetIds.length === 0) return;

      this.snapshot(HISTORY_ACTION.ELEMENT_STYLE);
      const updatedTableIds = new Set<string>();

      for (const id of targetIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex((e) => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            const nextElement = {
              ...el,
              style: { ...el.style, ...style },
            };
            page.elements[index] = nextElement;

            if (
              el.type === ElementType.TABLE &&
              getElementZIndex(nextElement) !== getElementZIndex(el)
            ) {
              updatedTableIds.add(el.id);
            }
            break;
          }
        }
      }

      this.ensureEmbeddedElementsAboveTables(updatedTableIds);
    }
};
