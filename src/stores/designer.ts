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
    headerHeight: 100,
    footerHeight: 100,
    showHeaderLine: false,
    showFooterLine: false,
    showMinimap: false,
    showHelp: false,
    canvasBackground: '#ffffff',
    guides: [],
    historyPast: [],
    historyFuture: [],
    clipboard: [],
    isExporting: false,
    disableGlobalShortcuts: false,
    tableSelection: null,
  }),
  actions: {
    setDisableGlobalShortcuts(val: boolean) {
      this.disableGlobalShortcuts = val;
    },
    setIsExporting(isExporting: boolean) {
      this.isExporting = isExporting;
    },
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
          if (parsed.showMinimap !== undefined) this.showMinimap = parsed.showMinimap;
          if (parsed.showHelp !== undefined) this.showHelp = parsed.showHelp;
          if (parsed.canvasBackground !== undefined) this.canvasBackground = parsed.canvasBackground;
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
    setTableSelection(elementId: string, cell: { rowIndex: number; colField: string }, multi: boolean) {
      // If switching elements, clear previous
      if (this.tableSelection && this.tableSelection.elementId !== elementId) {
        this.tableSelection = { elementId, cells: [cell] };
        return;
      }

      if (!this.tableSelection) {
        this.tableSelection = { elementId, cells: [cell] };
        return;
      }

      if (multi) {
        // Toggle if exists
        const idx = this.tableSelection.cells.findIndex(c => c.rowIndex === cell.rowIndex && c.colField === cell.colField);
        if (idx >= 0) {
          this.tableSelection.cells.splice(idx, 1);
          if (this.tableSelection.cells.length === 0) {
            this.tableSelection = null;
          }
        } else {
          this.tableSelection.cells.push(cell);
        }
      } else {
        this.tableSelection = { elementId, cells: [cell] };
      }
    },
    setTableSelectionCells(elementId: string, cells: { rowIndex: number; colField: string }[]) {
      this.tableSelection = { elementId, cells };
    },
    clearTableSelection() {
      this.tableSelection = null;
    },
    mergeSelectedCells() {
      if (!this.tableSelection || this.tableSelection.cells.length < 2) return;

      const { elementId, cells } = this.tableSelection;
      
      // Find element
      let element: PrintElement | null = null;
      let pageIndex = -1;
      let elementIndex = -1;
      
      for (let i = 0; i < this.pages.length; i++) {
        const idx = this.pages[i].elements.findIndex(e => e.id === elementId);
        if (idx !== -1) {
          element = this.pages[i].elements[idx];
          pageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (!element || !element.data || !element.columns) return;

      // Find bounds
      const rowIndices = cells.map(c => c.rowIndex);
      const minRow = Math.min(...rowIndices);
      const maxRow = Math.max(...rowIndices);
      
      // Map columns to indices to find min/max col
      const colFields = element.columns.map(c => c.field);
      const colIndices = cells.map(c => colFields.indexOf(c.colField)).filter(i => i !== -1);
      
      if (colIndices.length !== cells.length) return; // Invalid columns

      const minColIdx = Math.min(...colIndices);
      const maxColIdx = Math.max(...colIndices);

      const rowSpan = maxRow - minRow + 1;
      const colSpan = maxColIdx - minColIdx + 1;

      // Snapshot for undo
      this.snapshot();

      // Update data
      const newData = cloneDeep(element.data);
      
      // Iterate through the bounding box
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minColIdx; c <= maxColIdx; c++) {
          const field = colFields[c];
          const row = newData[r];
          
          if (!row) continue;

          // Initialize cell object if it's just a value
          if (typeof row[field] !== 'object' || row[field] === null) {
            row[field] = { value: row[field] };
          } else if (!('value' in row[field])) {
             // If it is object but maybe custom, ensure it has structure we expect or treat as value container?
             // Actually existing logic checks 'value' in val. If not, it returns val.
             // So we should normalize to { value: ..., rowSpan: 1, colSpan: 1 }
             // But let's respect existing structure.
          }

          if (r === minRow && c === minColIdx) {
            // Top-left cell: set span
            row[field].rowSpan = rowSpan;
            row[field].colSpan = colSpan;
          } else {
            // Other cells: hide
            row[field].rowSpan = 0;
            row[field].colSpan = 0;
          }
        }
      }

      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        data: newData
      };
      
      this.tableSelection = null;
    },
    splitSelectedCells() {
        if (!this.tableSelection || this.tableSelection.cells.length !== 1) return;
        
        const { elementId, cells } = this.tableSelection;
        const cell = cells[0];
        
        // Find element
        let element: PrintElement | null = null;
        let pageIndex = -1;
        let elementIndex = -1;
        
        for (let i = 0; i < this.pages.length; i++) {
          const idx = this.pages[i].elements.findIndex(e => e.id === elementId);
          if (idx !== -1) {
            element = this.pages[i].elements[idx];
            pageIndex = i;
            elementIndex = idx;
            break;
          }
        }
  
        if (!element || !element.data || !element.columns) return;
        
        const row = element.data[cell.rowIndex];
        if (!row) return;
        
        const val = row[cell.colField];
        if (!val || typeof val !== 'object' || (!val.rowSpan && !val.colSpan)) return;
        
        // Check if actually merged
        const rowSpan = val.rowSpan || 1;
        const colSpan = val.colSpan || 1;
        
        if (rowSpan <= 1 && colSpan <= 1) return;
        
        // Snapshot
        this.snapshot();
        
        const newData = cloneDeep(element.data);
        const colFields = element.columns.map(c => c.field);
        const startColIdx = colFields.indexOf(cell.colField);
        
        // Reset all cells in the range
        for (let r = cell.rowIndex; r < cell.rowIndex + rowSpan; r++) {
            for (let c = startColIdx; c < startColIdx + colSpan; c++) {
                const field = colFields[c];
                const rData = newData[r];
                if (rData && rData[field] && typeof rData[field] === 'object') {
                    rData[field].rowSpan = 1;
                    rData[field].colSpan = 1;
                }
            }
        }
        
        this.pages[pageIndex].elements[elementIndex] = {
          ...element,
          data: newData
        };
        
        this.tableSelection = null;
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
    setShowMinimap(show: boolean) {
      this.showMinimap = show;
    },
    setShowHelp(show: boolean) {
      this.showHelp = show;
    },
    setCanvasBackground(color: string) {
      this.canvasBackground = color;
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
          if (el.locked) return; // Prevent moving locked element
          const snapped = this.getSnapPosition(el, x, y);
          this.setHighlightedGuide(snapped.highlightedGuideId || null);
          this.setHighlightedEdge(snapped.highlightedEdge || null);
          this.updateElement(id, { x: snapped.x, y: snapped.y }, createSnapshot);
          return;
        }
      }
    },
    moveSelectedElements(primaryId: string, x: number, y: number, createSnapshot: boolean = true) {
      if (createSnapshot) {
        this.snapshot();
      }

      // 1. Gather all necessary data in ONE pass
      let primaryElement: PrintElement | null = null;
      const movableElements: { pageIndex: number; elementIndex: number; element: PrintElement }[] = [];

      // Create a Set for O(1) lookup
      const selectedSet = new Set(this.selectedElementIds);

      // Iterate once to find primary element and all movable elements
      for (let pIndex = 0; pIndex < this.pages.length; pIndex++) {
        const page = this.pages[pIndex];
        for (let eIndex = 0; eIndex < page.elements.length; eIndex++) {
          const el = page.elements[eIndex];
          if (el.id === primaryId) {
            primaryElement = el;
          }
          if (selectedSet.has(el.id) && !el.locked) {
            movableElements.push({ pageIndex: pIndex, elementIndex: eIndex, element: el });
          }
        }
      }

      if (!primaryElement || primaryElement.locked) return;

      // 2. Calculate snap for primary element
      const snapped = this.getSnapPosition(primaryElement, x, y);
      
      this.setHighlightedGuide(snapped.highlightedGuideId || null);
      this.setHighlightedEdge(snapped.highlightedEdge || null);

      // 3. Calculate actual delta
      let dx = snapped.x - primaryElement.x;
      let dy = snapped.y - primaryElement.y;

      if (dx === 0 && dy === 0) return;

      // 4. Constrain delta to ensure no element leaves the canvas
      for (const item of movableElements) {
         const el = item.element;
         // Constrain X
         if (dx > 0) {
           const maxRight = this.canvasSize.width - el.width;
           if (el.x + dx > maxRight) {
             dx = maxRight - el.x;
           }
         } else if (dx < 0) {
           if (el.x + dx < 0) {
             dx = -el.x;
           }
         }

         // Constrain Y
         if (dy > 0) {
           const maxBottom = this.canvasSize.height - el.height;
           if (el.y + dy > maxBottom) {
             dy = maxBottom - el.y;
           }
         } else if (dy < 0) {
           if (el.y + dy < 0) {
             dy = -el.y;
           }
         }
      }

      if (dx === 0 && dy === 0) return;

      // 5. Apply constrained delta
      for (const item of movableElements) {
        const { pageIndex, elementIndex, element } = item;
        // Direct update to store state
        this.pages[pageIndex].elements[elementIndex] = {
          ...element,
          x: element.x + dx,
          y: element.y + dy
        };
      }
    },
    nudgeSelectedElements(dx: number, dy: number) {
      if (this.selectedElementIds.length === 0) return;
      
      // Filter out locked elements
      const movableIds = this.selectedElementIds.filter(id => {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (movableIds.length === 0) return;

      this.snapshot(); // Snapshot once for the group move

      // 1. Identify primary element for snap calculation
      // Prefer the explicitly selected element if it's movable
      let primaryId = this.selectedElementId;
      if (!primaryId || !movableIds.includes(primaryId)) {
        primaryId = movableIds[0];
      }

      let primaryElement: PrintElement | null = null;
      for (const page of this.pages) {
        const found = page.elements.find(e => e.id === primaryId);
        if (found) {
          primaryElement = found;
          break;
        }
      }

      if (!primaryElement) return;

      // 2. Calculate delta based on primary element's snapping
      const targetX = primaryElement.x + dx;
      const targetY = primaryElement.y + dy;
      const snapped = this.getSnapPosition(primaryElement, targetX, targetY, true);
      
      this.setHighlightedGuide(snapped.highlightedGuideId || null);
      this.setHighlightedEdge(snapped.highlightedEdge || null);

      let actualDx = snapped.x - primaryElement.x;
      let actualDy = snapped.y - primaryElement.y;

      // 3. Constrain delta to ensure no element leaves the canvas (similar to moveSelectedElements)
      for (const id of movableIds) {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el) {
             // Constrain X
             if (actualDx > 0) {
               const maxRight = this.canvasSize.width - el.width;
               if (el.x + actualDx > maxRight) {
                 actualDx = maxRight - el.x;
               }
             } else if (actualDx < 0) {
               if (el.x + actualDx < 0) {
                 actualDx = -el.x;
               }
             }

             // Constrain Y
             if (actualDy > 0) {
               const maxBottom = this.canvasSize.height - el.height;
               if (el.y + actualDy > maxBottom) {
                 actualDy = maxBottom - el.y;
               }
             } else if (actualDy < 0) {
               if (el.y + actualDy < 0) {
                 actualDy = -el.y;
               }
             }
          }
        }
      }

      if (actualDx === 0 && actualDy === 0) return;

      // 4. Move all movable elements by the constrained delta (Rigid Body)
      for (const id of movableIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            page.elements[index] = {
              ...el,
              x: el.x + actualDx,
              y: el.y + actualDy
            };
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
          const el = page.elements[index];
          // Prevent update if locked, unless we are updating the lock status itself
          if (el.locked && updates.locked === undefined) return;
          
          page.elements[index] = { ...page.elements[index], ...updates };
          return;
        }
      }
    },
    removeElement(id: string) {
      // Check if locked
      for (const page of this.pages) {
        const el = page.elements.find(e => e.id === id);
        if (el && el.locked) return;
      }

      this.snapshot();
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          page.elements.splice(index, 1);
          if (this.selectedElementId === id) {
            this.selectedElementId = null;
          }
          // Clear table selection if this element was selected
          if (this.tableSelection && this.tableSelection.elementId === id) {
            this.tableSelection = null;
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
      this.tableSelection = null;
    },
    setSelection(ids: string[]) {
      this.tableSelection = null;
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

      // Filter out locked elements
      const removableIds = this.selectedElementIds.filter(id => {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (removableIds.length === 0) return;

      this.snapshot();
      for (const id of removableIds) {
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
      this.tableSelection = null;
    },
    alignSelectedElements(type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
      if (this.selectedElementIds.length === 0) return;

      // Filter out locked elements
      const elements: PrintElement[] = [];
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) {
            elements.push(el);
            break;
          }
        }
      }

      if (elements.length === 0) return;
      
      this.snapshot();

      if (elements.length === 1) {
        // Align to canvas
        const el = elements[0];
        const canvasW = this.canvasSize.width;
        const canvasH = this.canvasSize.height;

        switch (type) {
          case 'left': el.x = 0; break;
          case 'center': el.x = (canvasW - el.width) / 2; break;
          case 'right': el.x = canvasW - el.width; break;
          case 'top': el.y = 0; break;
          case 'middle': el.y = (canvasH - el.height) / 2; break;
          case 'bottom': el.y = canvasH - el.height; break;
        }
      } else {
        // Align relative to selection bounds
        const minX = Math.min(...elements.map(e => e.x));
        const maxX = Math.max(...elements.map(e => e.x + e.width));
        const minY = Math.min(...elements.map(e => e.y));
        const maxY = Math.max(...elements.map(e => e.y + e.height));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        elements.forEach(el => {
          switch (type) {
            case 'left': el.x = minX; break;
            case 'center': el.x = centerX - (el.width / 2); break;
            case 'right': el.x = maxX - el.width; break;
            case 'top': el.y = minY; break;
            case 'middle': el.y = centerY - (el.height / 2); break;
            case 'bottom': el.y = maxY - el.height; break;
          }
        });
      }
    },
    resizeSelectedElements(dw: number, dh: number) {
      if (this.selectedElementIds.length === 0) return;
      
      const targetIds = this.selectedElementIds.filter(id => {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (targetIds.length === 0) return;

      this.snapshot();

      for (const id of targetIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            const newWidth = Math.max(10, el.width + dw);
            const newHeight = Math.max(10, el.height + dh);
            
            page.elements[index] = {
              ...el,
              width: newWidth,
              height: newHeight
            };
            break;
          }
        }
      }
    },
    updateSelectedElementsStyle(style: Partial<any>) {
      if (this.selectedElementIds.length === 0) return;
      
      // Check if any selected element is locked
      const hasLocked = this.selectedElementIds.some(id => {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && el.locked) return true;
        }
        return false;
      });

      // If any is locked, do we allow style update? 
      // Usually lock prevents everything. Let's prevent style update for locked elements.
      
      const targetIds = this.selectedElementIds.filter(id => {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) return true;
        }
        return false;
      });

      if (targetIds.length === 0) return;

      this.snapshot();
      
      for (const id of targetIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            const el = page.elements[index];
            page.elements[index] = {
              ...el,
              style: { ...el.style, ...style }
            };
            break;
          }
        }
      }
    },
    toggleLock() {
      if (this.selectedElementIds.length === 0) return;
      this.snapshot();

      // Determine target state based on the primary selected element
      let targetState = true;
      const primaryEl = this.selectedElement;
      if (primaryEl) {
        targetState = !primaryEl.locked;
      }

      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const index = page.elements.findIndex(e => e.id === id);
          if (index !== -1) {
            page.elements[index].locked = targetState;
            break;
          }
        }
      }
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
    copy() {
      if (this.selectedElementIds.length === 0) return;
      
      const elements: PrintElement[] = [];
      for (const id of this.selectedElementIds) {
        for (const page of this.pages) {
          const el = page.elements.find(e => e.id === id);
          if (el && !el.locked) {
            elements.push(cloneDeep(el));
            break;
          }
        }
      }
      this.clipboard = elements;
    },
    paste() {
      if (this.clipboard.length === 0) return;
      
      this.snapshot();
      
      const newIds: string[] = [];
      const offset = 20;

      for (const item of this.clipboard) {
        const newEl = cloneDeep(item);
        newEl.id = uuidv4();
        newEl.x += offset;
        newEl.y += offset;
        
        // Ensure it fits in canvas (optional, but good UX)
        if (newEl.x + newEl.width > this.canvasSize.width) {
          newEl.x = Math.max(0, this.canvasSize.width - newEl.width);
        }
        if (newEl.y + newEl.height > this.canvasSize.height) {
          newEl.y = Math.max(0, this.canvasSize.height - newEl.height);
        }

        this.pages[this.currentPageIndex].elements.push(newEl);
        newIds.push(newEl.id);
      }
      
      this.setSelection(newIds);
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
    },
    groupSelectedElements() {
      if (this.selectedElementIds.length < 2) return;
      console.log('Group selected elements:', this.selectedElementIds);
      // TODO: Implement grouping logic
      alert('Grouping feature is under development');
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
