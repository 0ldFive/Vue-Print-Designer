import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { type DesignerState, type PrintElement, type Page, ElementType } from '@/types';

export const useDesignerStore = defineStore('designer', {
  state: (): DesignerState => ({
    pages: [{ id: uuidv4(), elements: [] }],
    currentPageIndex: 0,
    selectedElementId: null,
    canvasSize: { width: 794, height: 1123 }, // A4 at 96 DPI (approx)
    zoom: 1,
    isDragging: false,
    showGrid: true,
    guides: [],
  }),
  actions: {
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
      }
    },
    clearGuides() {
      this.guides = [];
    },
    addElement(element: Omit<PrintElement, 'id'>) {
      const newElement = { ...element, id: uuidv4() };
      this.pages[this.currentPageIndex].elements.push(newElement);
      this.selectedElementId = newElement.id;
    },
    updateElement(id: string, updates: Partial<PrintElement>) {
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          page.elements[index] = { ...page.elements[index], ...updates };
          return;
        }
      }
    },
    removeElement(id: string) {
      for (const page of this.pages) {
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          page.elements.splice(index, 1);
          if (this.selectedElementId === id) {
            this.selectedElementId = null;
          }
          return;
        }
      }
    },
    selectElement(id: string | null) {
      this.selectedElementId = id;
      if (id) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex(p => p.elements.some(e => e.id === id));
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },
    setZoom(zoom: number) {
      this.zoom = zoom;
    },
    setCanvasSize(width: number, height: number) {
      this.canvasSize = { width, height };
    },
    setShowGrid(show: boolean) {
      this.showGrid = show;
    },
    addPage() {
      this.pages.push({ id: uuidv4(), elements: [] });
    },
    deletePage(index: number) {
      if (this.pages.length > 1) {
        this.pages.splice(index, 1);
        if (this.currentPageIndex >= this.pages.length) {
          this.currentPageIndex = this.pages.length - 1;
        }
      }
    },
    paginateTable(elementId: string) {
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
