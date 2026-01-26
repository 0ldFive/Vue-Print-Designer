import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { type DesignerState, type PrintElement, type Page, type Guide, ElementType } from '@/types';

export const useDesignerStore = defineStore('designer', {
  state: (): DesignerState => ({
    pages: [{ id: uuidv4(), elements: [] }],
    currentPageIndex: 0,
    selectedElementId: null,
    selectedElementIds: [],
    selectedGuideId: null,
    highlightedGuideId: null,
    highlightedEdge: null,
    canvasSize: { width: 794, height: 1123 }, // A4 at 96 DPI (approx)
    zoom: 1,
    isDragging: false,
    showGrid: true,
    showCornerMarkers: true,
    headerHeight: 0,
    footerHeight: 0,
    showHeaderLine: false,
    showFooterLine: false,
    guides: [],
    historyPast: [],
    historyFuture: [],
  }),
  actions: {
    loadFromLocalStorage() {
      try {
        const data = localStorage.getItem('localdata');
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.pages) this.pages = parsed.pages;
          if (parsed.canvasSize) this.canvasSize = parsed.canvasSize;
          if (parsed.guides) this.guides = parsed.guides;
          if (parsed.zoom !== undefined) this.zoom = parsed.zoom;
          if (parsed.showGrid !== undefined) this.showGrid = parsed.showGrid;
          if (parsed.headerHeight !== undefined) this.headerHeight = parsed.headerHeight;
          if (parsed.footerHeight !== undefined) this.footerHeight = parsed.footerHeight;
          if (parsed.showHeaderLine !== undefined) this.showHeaderLine = parsed.showHeaderLine;
          if (parsed.showFooterLine !== undefined) this.showFooterLine = parsed.showFooterLine;
          this.selectedElementId = null;
          this.selectedGuideId = null;
          this.currentPageIndex = 0;
          this.historyPast = [];
          this.historyFuture = [];
        }
      } catch (error) {
        console.error('Load from localStorage failed', error);
      }
    },
    setHeaderHeight(height: number) {
      this.headerHeight = height;
    },
    setFooterHeight(height: number) {
      this.footerHeight = height;
    },
    setShowHeaderLine(show: boolean) {
      this.showHeaderLine = show;
    },
    setShowFooterLine(show: boolean) {
      this.showFooterLine = show;
    },
    snapshot() {
      this.historyPast.push(cloneDeep(this.pages));
      this.historyFuture = [];
    },
    undo() {
      if (this.historyPast.length === 0) return;
      const prev = this.historyPast.pop()!;
      this.historyFuture.push(cloneDeep(this.pages));
      this.pages = cloneDeep(prev);
      // Ensure selected element indices still valid
      if (this.selectedElementId) {
        const exists = this.pages.some(p => p.elements.some(e => e.id === this.selectedElementId));
        if (!exists) {
          this.selectedElementId = null;
          this.selectedElementIds = [];
        }
      }
      // Validate multi-selection
      this.selectedElementIds = this.selectedElementIds.filter(id =>
        this.pages.some(p => p.elements.some(e => e.id === id))
      );
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = Math.max(0, this.pages.length - 1);
      }
    },
    redo() {
      if (this.historyFuture.length === 0) return;
      const next = this.historyFuture.pop()!;
      this.historyPast.push(cloneDeep(this.pages));
      this.pages = cloneDeep(next);
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = Math.max(0, this.pages.length - 1);
      }
    },
    addGuide(guide: { type: 'horizontal' | 'vertical', position: number }) {
      this.guides.push({ ...guide, id: uuidv4() });
    },
    updateGuide(id: string, position: number) {
      const guide = this.guides.find(g => g.id === id);
      if (guide) {
        guide.position = position;
      }
    },
    removeGuide(id: string) {
      const index = this.guides.findIndex(g => g.id === id);
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
    },
    setHighlightedGuide(id: string | null) {
      this.highlightedGuideId = id;
    },
    setHighlightedEdge(edge: 'left' | 'top' | 'right' | 'bottom' | null) {
      this.highlightedEdge = edge;
    },
    setShowCornerMarkers(show: boolean) {
      this.showCornerMarkers = show;
    },
    getSnapPosition(el: PrintElement, nx: number, ny: number, isKeyboard: boolean = false) {
      const threshold = 5;
      let x = nx;
      let y = ny;
      let highlightedGuideId: string | null = null;
      let highlightedEdge: 'left' | 'top' | 'right' | 'bottom' | null = null;

      const shouldSnap = (target: number, current: number, snapPoint: number) => {
        const dist = Math.abs(target - snapPoint);
        if (dist > threshold) return false;
        if (isKeyboard) {
          const oldDist = Math.abs(current - snapPoint);
          return dist < oldDist;
        }
        return true;
      };

      // Canvas edges
      const maxX = Math.max(0, this.canvasSize.width - el.width);
      const maxY = Math.max(0, this.canvasSize.height - el.height);
      
      if (shouldSnap(x, el.x, 0)) {
        x = 0;
        highlightedEdge = 'left';
      } else if (shouldSnap(x + el.width, el.x + el.width, this.canvasSize.width)) {
        x = maxX;
        highlightedEdge = 'right';
      }

      if (shouldSnap(y, el.y, 0)) {
        y = 0;
        highlightedEdge = highlightedEdge || 'top';
      } else if (shouldSnap(y + el.height, el.y + el.height, this.canvasSize.height)) {
        y = maxY;
        highlightedEdge = highlightedEdge || 'bottom';
      }

      // Guides
      for (const guide of this.guides) {
        if (guide.type === 'vertical') {
          // left edge
          if (shouldSnap(x, el.x, guide.position)) {
            x = guide.position;
            highlightedGuideId = guide.id;
          }
          // right edge
          else if (shouldSnap(x + el.width, el.x + el.width, guide.position)) {
            x = guide.position - el.width;
            highlightedGuideId = guide.id;
          }
        } else {
          // top edge
          if (shouldSnap(y, el.y, guide.position)) {
            y = guide.position;
            highlightedGuideId = guide.id;
          }
          // bottom edge
          else if (shouldSnap(y + el.height, el.y + el.height, guide.position)) {
            y = guide.position - el.height;
            highlightedGuideId = guide.id;
          }
        }
      }

      // Clamp to canvas
      x = Math.min(Math.max(0, x), maxX);
      y = Math.min(Math.max(0, y), maxY);

      return { x, y, highlightedGuideId, highlightedEdge };
    },
    moveElementWithSnap(id: string, x: number, y: number, createSnapshot: boolean = true) {
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          const el = page.elements[index];
          const snapped = this.getSnapPosition(el, x, y);
          this.setHighlightedGuide(snapped.highlightedGuideId || null);
          this.setHighlightedEdge(snapped.highlightedEdge || null);
          this.updateElement(id, { x: snapped.x, y: snapped.y }, createSnapshot);
          return;
        }
      }
    },
    nudgeSelectedElements(dx: number, dy: number) {
      if (this.selectedElementIds.length === 0) return;
      
      this.snapshot(); // Snapshot once for the group move

      // Move each selected element
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            const targetX = el.x + dx;
            const targetY = el.y + dy;
            const snapped = this.getSnapPosition(el, targetX, targetY, true);
            this.setHighlightedGuide(snapped.highlightedGuideId || null);
            this.setHighlightedEdge(snapped.highlightedEdge || null);
            this.updateElement(id, { x: snapped.x, y: snapped.y }, false);
            break;
          }
        }
      }
    },
    addElement(element: Omit<PrintElement, 'id'>) {
      this.snapshot();
      const newElement = { ...element, id: uuidv4() };
      this.pages[this.currentPageIndex].elements.push(newElement);
      this.selectedElementId = newElement.id;
    },
    updateElement(id: string, updates: Partial<PrintElement>, createSnapshot: boolean = true) {
      if (createSnapshot) {
        this.snapshot();
      }
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          page.elements[index] = { ...page.elements[index], ...updates };
          return;
        }
      }
    },
    removeElement(id: string) {
      this.snapshot();
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          page.elements.splice(index, 1);
          if (this.selectedElementId === id) {
            this.selectedElementId = null;
          }
          // Remove from multi-selection
          const multiIndex = this.selectedElementIds.indexOf(id);
          if (multiIndex !== -1) {
            this.selectedElementIds.splice(multiIndex, 1);
          }
          return;
        }
      }
    },
    selectElement(id: string | null, isMultiSelect: boolean = false) {
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
        this.selectedElementId = this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
      } else {
        // Normal selection
        this.selectedElementId = id;
        this.selectedElementIds = id ? [id] : [];
      }

      if (id) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex(p => p.elements.some(e => e.id === id));
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },
    clearSelection() {
      this.selectedElementId = null;
      this.selectedElementIds = [];
    },
    setSelection(ids: string[]) {
      this.selectedElementIds = ids;
      this.selectedElementId = ids.length > 0 ? ids[ids.length - 1] : null;
      if (ids.length > 0) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex(p => p.elements.some(e => e.id === this.selectedElementId));
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },
    removeSelectedElements() {
      if (this.selectedElementIds.length === 0) return;

      this.snapshot();
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            page.elements.splice(index, 1);
            break;
          }
        }
      }
      this.selectedElementId = null;
      this.selectedElementIds = [];
    },
    setZoom(zoom: number) {
      this.zoom = zoom;
    },
    setCanvasSize(width: number, height: number) {
      this.snapshot();
      this.canvasSize = { width, height };
    },
    setShowGrid(show: boolean) {
      this.showGrid = show;
    },
    addPage() {
      this.snapshot();
      this.pages.push({ id: uuidv4(), elements: [] });
    },
    deletePage(index: number) {
      if (this.pages.length > 1) {
        this.snapshot();
        this.pages.splice(index, 1);
        if (this.currentPageIndex >= this.pages.length) {
          this.currentPageIndex = this.pages.length - 1;
        }
      }
    },
    paginateTable(elementId: string) {
      this.snapshot();
      // 1. Find Element and Page
      let pageIndex = -1;
      let elementIndex = -1;
      let element: PrintElement | undefined;

      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex(e => e.id === elementId);
        if (idx !== -1) {
          pageIndex = i;
          elementIndex = idx;
          element = this.pages[i].elements[idx];
          break;
        }
      }

      if (!element || element.type !== ElementType.TABLE || !element.data) return;

      // 2. Constants
      const PAGE_HEIGHT = this.canvasSize.height;
      const MARGIN_BOTTOM = 50; // Safety margin
      const HEADER_HEIGHT = element.style.headerHeight || 40; // Default estimate
      const ROW_HEIGHT = element.style.rowHeight || 30; // Default estimate
      const START_Y = element.y;

      // 3. Calculate Capacity
      const availableHeight = PAGE_HEIGHT - START_Y - MARGIN_BOTTOM;
      const bodyHeight = availableHeight - HEADER_HEIGHT;
      
      if (bodyHeight < ROW_HEIGHT) {
        // Not enough space for even one row? Move to next page?
        // For now, let's just split what fits.
      }

      const rowsPerPage = Math.floor(Math.max(0, bodyHeight) / ROW_HEIGHT);
      
      // 4. Check if split is needed
      if (rowsPerPage >= element.data.length) {
        return; // All fits
      }

      // 5. Split Data
      const currentData = element.data.slice(0, rowsPerPage);
      const remainingData = element.data.slice(rowsPerPage);

      // Update current element
      this.updateElement(element.id, { 
        data: currentData,
        height: HEADER_HEIGHT + (currentData.length * ROW_HEIGHT)
      });

      // 6. Handle Next Page
      const nextPageIdx = pageIndex + 1;
      if (nextPageIdx >= this.pages.length) {
        this.addPage();
      }

      // 7. Create New Element on Next Page
      const newElement: PrintElement = {
        ...cloneDeep(element),
        id: uuidv4(),
        y: 50, // Start at top margin of next page
        data: remainingData,
        height: HEADER_HEIGHT + (remainingData.length * ROW_HEIGHT) // Initial height estimate
      };

      this.pages[nextPageIdx].elements.push(newElement);

      // 8. Recursive Call (to handle multiple pages)
      // We need to wait for state update or just call it directly?
      // Calling directly is fine as we are modifying state synchronously.
      this.paginateTable(newElement.id);
    }
  },
  getters: {
    selectedElement: (state) => {
      if (!state.selectedElementId) return null;
      for (const page of state.pages) {
        const el = page.elements.find(e => e.id === state.selectedElementId);
        if (el) return el;
      }
      return null;
    },
    currentPage: (state) => state.pages[state.currentPageIndex]
  }
});
