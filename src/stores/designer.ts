import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { type DesignerState, type PrintElement, type Page, type Guide, ElementType, type CustomElementTemplate, type WatermarkSettings, type CustomElementEditSnapshot, type BrandingSettings, type ListContextMenuConfig, type ListContextMenuItem, type TemplateModalFormConfig, type TemplateModalField } from '@/types';
import { getCrudConfig, buildEndpoint, buildFetchOptions } from '../utils/crudConfig';
import { toast } from '../utils/toast';
import { canCopyEntity, canDeleteEntity, canEditEntity, normalizeEntityConstraints } from '../utils/entityConstraints';
import { useTemplateStore } from './templates';
import i18n from '../locales';

const defaultWatermark: WatermarkSettings = {
  enabled: false,
  text: '',
  angle: -30,
  color: '#000000',
  opacity: 0.1,
  size: 24,
  density: 160
};

const defaultBranding: BrandingSettings = {
  title: '',
  logoUrl: '',
  showTitle: true,
  showLogo: true
};

const loadWatermark = (): WatermarkSettings => {
  const stored = localStorage.getItem('print-designer-watermark');
  if (!stored) return { ...defaultWatermark };
  try {
    return { ...defaultWatermark, ...(JSON.parse(stored) as WatermarkSettings) };
  } catch {
    return { ...defaultWatermark };
  }
};

type LayerMoveMode = 'front' | 'back' | 'forward' | 'backward';

const getElementZIndex = (element: PrintElement) => element.style?.zIndex || 1;

const getLayerSortedElements = (page: Page) => {
  return page.elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const za = getElementZIndex(a.element);
      const zb = getElementZIndex(b.element);
      if (za === zb) return a.index - b.index;
      return za - zb;
    });
};

const buildLayerAssignments = (page: Page, idSet: Set<string>, mode: LayerMoveMode) => {
  const ordered = getLayerSortedElements(page);
  const selectedCount = ordered.filter(item => idSet.has(item.element.id)).length;
  if (selectedCount === 0) return null;

  let nextOrdered = [...ordered];

  if (mode === 'front') {
    const selected = ordered.filter(item => idSet.has(item.element.id));
    const unselected = ordered.filter(item => !idSet.has(item.element.id));
    nextOrdered = [...unselected, ...selected];
  } else if (mode === 'back') {
    const selected = ordered.filter(item => idSet.has(item.element.id));
    const unselected = ordered.filter(item => !idSet.has(item.element.id));
    nextOrdered = [...selected, ...unselected];
  } else if (mode === 'forward') {
    for (let i = nextOrdered.length - 2; i >= 0; i -= 1) {
      const current = nextOrdered[i];
      const next = nextOrdered[i + 1];
      if (idSet.has(current.element.id) && !idSet.has(next.element.id)) {
        nextOrdered[i] = next;
        nextOrdered[i + 1] = current;
      }
    }
  } else {
    for (let i = 1; i < nextOrdered.length; i += 1) {
      const current = nextOrdered[i];
      const previous = nextOrdered[i - 1];
      if (idSet.has(current.element.id) && !idSet.has(previous.element.id)) {
        nextOrdered[i] = previous;
        nextOrdered[i - 1] = current;
      }
    }
  }

  const assignments = new Map<string, number>();
  nextOrdered.forEach((item, index) => {
    const targetZ = index + 1;
    if (getElementZIndex(item.element) !== targetZ) {
      assignments.set(item.element.id, targetZ);
    }
  });

  if (assignments.size === 0) return null;
  return assignments;
};

const normalizeContextMenuConfig = (config: ListContextMenuConfig | null | undefined): ListContextMenuConfig | null => {
  if (!config || !Array.isArray(config.items)) return null;

  const items = config.items
    .filter((item): item is ListContextMenuItem => Boolean(item && typeof item.key === 'string' && item.key && typeof item.label === 'string'))
    .map((item) => ({ ...item }));

  if (items.length === 0) return null;

  return {
    mode: config.mode === 'replace' ? 'replace' : 'append',
    items
  };
};

const normalizeTemplateModalFields = (fields: TemplateModalField[] | undefined): TemplateModalField[] | undefined => {
  if (!Array.isArray(fields)) return undefined;
  const normalized = fields
    .filter((field) => field && typeof field.key === 'string' && field.key && typeof field.type === 'string')
    .map((field) => ({
      ...field,
      options: Array.isArray(field.options)
        ? field.options.filter(opt => opt && typeof opt.label === 'string')
        : undefined
    }));
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeTemplateModalFormConfig = (config: TemplateModalFormConfig | null | undefined): TemplateModalFormConfig | null => {
  if (!config || typeof config !== 'object') return null;
  const next: TemplateModalFormConfig = {};
  (['create', 'edit', 'copy'] as const).forEach((mode) => {
    const item = config[mode];
    if (!item || typeof item !== 'object') return;
    const fields = normalizeTemplateModalFields(item.fields);
    const initialValues = item.initialValues && typeof item.initialValues === 'object'
      ? { ...item.initialValues }
      : undefined;
    if (fields || initialValues) {
      next[mode] = {
        ...(fields ? { fields } : {}),
        ...(initialValues ? { initialValues } : {})
      };
    }
  });
  return Object.keys(next).length > 0 ? next : null;
};

export const useDesignerStore = defineStore('designer', {
  state: (): DesignerState => ({
    unit: (localStorage.getItem('print-designer-unit') as 'mm' | 'px' | 'pt' | 'in' | 'cm') || 'mm',
    watermark: loadWatermark(),
    branding: { ...defaultBranding },
    pages: [{ id: uuidv4(), elements: [] }],
    currentPageIndex: 0,
    customElements: JSON.parse(localStorage.getItem('print-designer-custom-elements') || '[]'),
    customElementDetailCache: {} as Record<string, any>,
    templateContextMenuConfig: null,
    customElementContextMenuConfig: null,
    templateModalFormConfig: null,
    contextMenuEventEmitter: null,
    testData: {},
    editingCustomElementId: null,
    customElementEditSnapshot: null,
    selectedElementId: null,
    selectedElementIds: [],
    selectedGuideId: null,
    highlightedGuideId: null,
    highlightedEdge: null,
    canvasSize: { width: 794, height: 1123 }, // A4 at 96 DPI (approx)
    zoom: 1,
    isDragging: false,
    showGrid: true,
    showMarginLines: true,
    showCornerMarkers: true,
    headerHeight: 100,
    footerHeight: 100,
    showHeaderLine: false,
    showFooterLine: false,
    showMinimap: false,
    showHelp: false,
    showSettings: false,
    canvasBackground: '#ffffff',
    pageSpacingX: 0,
    pageSpacingY: 0,
    guides: [],
    historyPast: [],
    historyFuture: [],
    clipboard: [],
    copiedPage: null,
    isExporting: false,
    disableGlobalShortcuts: false,
    disableShortcutsCount: 0,
    tableSelection: null,
    clientUrl: 'https://github.com/0ldFive/PrintDot-Client/releases',
    cloudUrl: 'https://printdot.cc/cloud-print',
    showClientLink: true,
    showCloudLink: true,
  }),
  actions: {
    setContextMenuEventEmitter(emitter: ((eventName: string, detail: Record<string, any>) => void) | null) {
      this.contextMenuEventEmitter = emitter;
    },
    emitContextMenuEvent(eventName: string, detail: Record<string, any>) {
      if (!eventName || typeof eventName !== 'string') return;
      this.contextMenuEventEmitter?.(eventName, detail || {});
    },
    setTemplateContextMenuConfig(config: ListContextMenuConfig | null) {
      this.templateContextMenuConfig = normalizeContextMenuConfig(config);
    },
    setCustomElementContextMenuConfig(config: ListContextMenuConfig | null) {
      this.customElementContextMenuConfig = normalizeContextMenuConfig(config);
    },
    setTemplateModalFormConfig(config: TemplateModalFormConfig | null) {
      this.templateModalFormConfig = normalizeTemplateModalFormConfig(config);
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
      if (!update || typeof update !== 'object') return;
      const next = { ...this.branding, ...update };
      if (update.showTitle !== undefined) next.showTitle = Boolean(update.showTitle);
      if (update.showLogo !== undefined) next.showLogo = Boolean(update.showLogo);
      this.branding = next;
    },
    setWatermark(update: Partial<WatermarkSettings>) {
      this.watermark = { ...(this.watermark || defaultWatermark), ...update };
      localStorage.setItem('print-designer-watermark', JSON.stringify(this.watermark));
    },
    setUnit(unit: 'mm' | 'px' | 'pt' | 'in' | 'cm') {
      this.unit = unit;
      localStorage.setItem('print-designer-unit', unit);
    },
    setDragging(isDragging: boolean) {
      this.isDragging = isDragging;
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
    setPageSpacingX(value: number) {
      this.pageSpacingX = Math.max(0, Math.round(value));
    },
    setPageSpacingY(value: number) {
      this.pageSpacingY = Math.max(0, Math.round(value));
    },
    resetCanvas() {
      this.watermark = { ...defaultWatermark };
      localStorage.setItem('print-designer-watermark', JSON.stringify(this.watermark));
      this.pages = [{ id: uuidv4(), elements: [] }];
      this.currentPageIndex = 0;
      this.testData = {};
      this.selectedElementId = null;
      this.selectedElementIds = [];
      this.selectedGuideId = null;
      this.guides = [];
      this.historyPast = [];
      this.historyFuture = [];
      this.headerHeight = 100;
      this.footerHeight = 100;
      this.showHeaderLine = false;
      this.showFooterLine = false;
      this.canvasBackground = '#ffffff';
      this.pageSpacingX = 0;
      this.pageSpacingY = 0;
      this.canvasSize = { width: 794, height: 1123 };
      this.zoom = 1;
      this.showGrid = true;
      this.showCornerMarkers = true;
      this.showMinimap = false;
      this.showHelp = false;
      this.showSettings = false;
      this.copiedPage = null;
    },
    startCustomElementEdit(id: string) {
      const template = this.customElements.find(el => el.id === id);
      if (!template) return;

      if (!this.customElementEditSnapshot) {
        this.customElementEditSnapshot = {
          pages: cloneDeep(this.pages),
          historyPast: cloneDeep(this.historyPast),
          historyFuture: cloneDeep(this.historyFuture),
          canvasSize: cloneDeep(this.canvasSize),
          guides: cloneDeep(this.guides),
          zoom: this.zoom,
          showGrid: this.showGrid,
          showMarginLines: this.showMarginLines,
          showCornerMarkers: this.showCornerMarkers,
          headerHeight: this.headerHeight,
          footerHeight: this.footerHeight,
          showHeaderLine: this.showHeaderLine,
          showFooterLine: this.showFooterLine,
          showMinimap: this.showMinimap,
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
      this.canvasSize = snapshot.canvasSize;
      this.guides = snapshot.guides;
      this.zoom = snapshot.zoom;
      this.showGrid = snapshot.showGrid;
      this.showMarginLines = snapshot.showMarginLines;
      this.showCornerMarkers = snapshot.showCornerMarkers;
      this.headerHeight = snapshot.headerHeight;
      this.footerHeight = snapshot.footerHeight;
      this.showHeaderLine = snapshot.showHeaderLine;
      this.showFooterLine = snapshot.showFooterLine;
      this.showMinimap = snapshot.showMinimap;
      this.canvasBackground = snapshot.canvasBackground;
      this.pageSpacingX = snapshot.pageSpacingX ?? this.pageSpacingX;
      this.pageSpacingY = snapshot.pageSpacingY ?? this.pageSpacingY;
      this.unit = snapshot.unit || this.unit;
      if (snapshot.unit) {
        localStorage.setItem('print-designer-unit', snapshot.unit);
      }
      if (snapshot.watermark) {
        this.watermark = cloneDeep(snapshot.watermark);
        localStorage.setItem('print-designer-watermark', JSON.stringify(this.watermark));
      }
      this.testData = snapshot.testData || {};
      this.currentPageIndex = snapshot.currentPageIndex;
      this.selectedElementId = snapshot.selectedElementId;
      this.selectedElementIds = snapshot.selectedElementIds;
      this.selectedGuideId = snapshot.selectedGuideId;
      this.highlightedGuideId = snapshot.highlightedGuideId;
      this.highlightedEdge = snapshot.highlightedEdge;
      this.tableSelection = null;
    },
    async commitCustomElementEdit() {
      if (!this.editingCustomElementId) return false;
      const template = this.customElements.find(el => el.id === this.editingCustomElementId);
      if (!template) return false;

      const element = this.selectedElement || this.pages[0]?.elements[0];
      if (!element) return false;

      if (!canEditEntity(template)) {
        toast.warning(i18n.global.t('toast.customElementReadOnly'));
        return false;
      }

      template.element = cloneDeep(element);
      
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode === 'remote') {
        try {
          const cachedTemplate = this.customElementDetailCache[template.id];
          const payload = normalizeEntityConstraints({
            id: template.id,
            name: template.name,
            element: cloneDeep(template.element),
            testData: template.testData,
            system: template.system ?? cachedTemplate?.system,
            editable: template.editable ?? cachedTemplate?.editable,
            deletable: template.deletable ?? cachedTemplate?.deletable,
            copyable: template.copyable ?? cachedTemplate?.copyable,
            permissions: template.permissions ?? cachedTemplate?.permissions,
            ext: { ...(cachedTemplate?.ext || {}), ...(template.ext || {}) }
          });
          const url = buildEndpoint(endpoints.customElements?.upsert, '');
          const options = buildFetchOptions(endpoints.customElements?.upsert, 'POST', headers, payload);
          await (fetcher || fetch)(url, options);
          const cached = this.customElementDetailCache[template.id];
          this.customElementDetailCache[template.id] = normalizeEntityConstraints({
            id: payload.id,
            name: payload.name,
            element: cloneDeep(payload.element || cached?.element || {}),
            testData: payload.testData || cached?.testData,
            system: payload.system ?? cached?.system,
            editable: payload.editable ?? cached?.editable,
            deletable: payload.deletable ?? cached?.deletable,
            copyable: payload.copyable ?? cached?.copyable,
            permissions: payload.permissions ?? cached?.permissions,
            ext: { ...(cached?.ext || {}), ...(payload.ext || {}) }
          }) as CustomElementTemplate;
        } catch (e) {
          console.error('Failed to commit custom element edit', e);
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
    copyPage(index: number) {
      if (!this.isTemplateEditable) return;
      const page = this.pages[index];
      if (!page) return;
      this.copiedPage = cloneDeep(page);
    },
    pastePage(targetIndex: number) {
      if (!this.isTemplateEditable) return;
      if (!this.copiedPage) return;

      this.snapshot();

      const newPage = cloneDeep(this.copiedPage);
      newPage.id = uuidv4();

      // Regenerate IDs for all elements
      newPage.elements.forEach(el => {
        el.id = uuidv4();
      });

      // Insert after targetIndex
      this.pages.splice(targetIndex + 1, 0, newPage);
      this.currentPageIndex = targetIndex + 1;
    },
    addPage() {
      if (!this.isTemplateEditable) return;
      this.snapshot();
      this.pages.push({ id: uuidv4(), elements: [] });
      this.currentPageIndex = this.pages.length - 1;
    },
    removePage(index: number) {
      if (!this.isTemplateEditable) return;
      if (this.pages.length <= 1) return;
      this.snapshot();
      this.pages.splice(index, 1);
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1;
      }
    },
    setTableSelection(elementId: string, cell: { rowIndex: number; colField: string; section?: 'body' | 'footer' }, multi: boolean) {
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
        const idx = this.tableSelection.cells.findIndex(c => c.rowIndex === cell.rowIndex && c.colField === cell.colField && c.section === cell.section);
        if (idx >= 0) {
          this.tableSelection.cells.splice(idx, 1);
          if (this.tableSelection.cells.length === 0) {
            this.tableSelection = null;
          }
        } else {
          // Ensure we don't mix sections
          if (this.tableSelection.cells.length > 0 && this.tableSelection.cells[0].section !== cell.section) {
             // If mixed, reset to new selection
             this.tableSelection = { elementId, cells: [cell] };
          } else {
             this.tableSelection.cells.push(cell);
          }
        }
      } else {
        this.tableSelection = { elementId, cells: [cell] };
      }
    },
    setTableSelectionCells(elementId: string, cells: { rowIndex: number; colField: string; section?: 'body' | 'footer' }[]) {
      this.tableSelection = { elementId, cells };
    },
    clearTableSelection() {
      this.tableSelection = null;
    },
    mergeSelectedCells() {
      if (!this.isTemplateEditable) return;
      if (!this.tableSelection || this.tableSelection.cells.length < 2) return;

      const { elementId, cells } = this.tableSelection;
      const section = cells[0].section || 'body';
      
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

      if (!element || !element.columns) return;
      
      const targetDataKey = section === 'footer' ? 'footerData' : 'data';
      if (!element[targetDataKey]) return;

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
      const newData = cloneDeep(element[targetDataKey]);
      
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
            // Other cells: hide and clear value
            row[field].rowSpan = 0;
            row[field].colSpan = 0;
            row[field].value = '';
          }
        }
      }

      this.pages[pageIndex].elements[elementIndex] = {
        ...element,
        [targetDataKey]: newData
      };
      
      this.tableSelection = null;
    },
    splitSelectedCells() {
        if (!this.isTemplateEditable) return;
        if (!this.tableSelection || this.tableSelection.cells.length !== 1) return;
        
        const { elementId, cells } = this.tableSelection;
        const cell = cells[0];
        const section = cell.section || 'body';
        
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
  
        if (!element || !element.columns) return;
        
        const targetDataKey = section === 'footer' ? 'footerData' : 'data';
        if (!element[targetDataKey]) return;

        const row = element[targetDataKey][cell.rowIndex];
        if (!row) return;
        
        const val = row[cell.colField];
        if (!val || typeof val !== 'object' || (!val.rowSpan && !val.colSpan)) return;
        
        // Check if actually merged
        const rowSpan = val.rowSpan || 1;
        const colSpan = val.colSpan || 1;
        
        if (rowSpan <= 1 && colSpan <= 1) return;
        
        // Snapshot
        this.snapshot();
        
        const newData = cloneDeep(element[targetDataKey]);
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
          [targetDataKey]: newData
        };
        
        this.tableSelection = null;
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
    setShowMinimap(show: boolean) {
      this.showMinimap = show;
    },
    setShowHelp(show: boolean) {
      this.showHelp = show;
    },
    setShowSettings(show: boolean) {
      this.showSettings = show;
    },
    setCanvasBackground(color: string) {
      this.canvasBackground = color;
    },
    snapshot() {
      if (this.historyPast.length >= 20) {
        this.historyPast.shift();
      }
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
      if (id) {
        this.selectedElementId = null;
        this.selectedElementIds = [];
        this.tableSelection = null;
      }
    },
    setHighlightedGuide(id: string | null) {
      this.highlightedGuideId = id;
    },
    setHighlightedEdge(edge: 'left' | 'top' | 'right' | 'bottom' | null) {
      this.highlightedEdge = edge;
    },
    setShowMarginLines(show: boolean) {
      this.showMarginLines = show;
    },
    setShowCornerMarkers(show: boolean) {
      this.showCornerMarkers = show;
    },
    getElementBoundsAtPosition(el: PrintElement, x: number, y: number) {
      const rotation = el.style?.rotate || 0;
      const normalized = ((rotation % 360) + 360) % 360;
      if (normalized === 0) {
        return {
          minX: x,
          maxX: x + el.width,
          minY: y,
          maxY: y + el.height
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
        { x: x + el.width, y: y + el.height }
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

      return { minX, maxX, minY, maxY, maxXBoundary, maxYBoundary, originBounds };
    },
    getSnapPosition(el: PrintElement, nx: number, ny: number, isKeyboard: boolean = false, constrain: boolean = true, pageIndex: number = -1) {
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

      const currentBounds = this.getElementBoundsAtPosition(el, el.x, el.y);
      const movementBounds = this.getElementMovementBounds(el);
      const { minX, maxX, minY, maxY, maxXBoundary, maxYBoundary, originBounds } = movementBounds;
      const minXBoundary = this.pageSpacingX || 0;
      const minYBoundary = this.pageSpacingY || 0;
      const targetBounds = this.getElementBoundsAtPosition(el, x, y);
      
      if (shouldSnap(targetBounds.minX, currentBounds.minX, minXBoundary)) {
        x = minX;
        highlightedEdge = 'left';
      } else if (shouldSnap(targetBounds.maxX, currentBounds.maxX, maxXBoundary)) {
        x = maxX;
        highlightedEdge = 'right';
      }

      const targetBoundsY = this.getElementBoundsAtPosition(el, x, y);
      if (shouldSnap(targetBoundsY.minY, currentBounds.minY, minYBoundary)) {
        y = minY;
        highlightedEdge = highlightedEdge || 'top';
      } else if (shouldSnap(targetBoundsY.maxY, currentBounds.maxY, maxYBoundary)) {
        y = maxY;
        highlightedEdge = highlightedEdge || 'bottom';
      }

      for (const guide of this.guides) {
        if (guide.type === 'vertical') {
          const guideBounds = this.getElementBoundsAtPosition(el, x, y);
          if (shouldSnap(guideBounds.minX, currentBounds.minX, guide.position)) {
            x = guide.position - originBounds.minX;
            highlightedGuideId = guide.id;
          } else if (shouldSnap(guideBounds.maxX, currentBounds.maxX, guide.position)) {
            x = guide.position - originBounds.maxX;
            highlightedGuideId = guide.id;
          }
        } else {
          const guideBounds = this.getElementBoundsAtPosition(el, x, y);
          if (shouldSnap(guideBounds.minY, currentBounds.minY, guide.position)) {
            y = guide.position - originBounds.minY;
            highlightedGuideId = guide.id;
          } else if (shouldSnap(guideBounds.maxY, currentBounds.maxY, guide.position)) {
            y = guide.position - originBounds.maxY;
            highlightedGuideId = guide.id;
          }
        }
      }

      let applyStrictX = constrain;
      let applyStrictY = constrain;
      let applyPartialTop = false;
      let applyPartialBottom = false;
      
      if (!constrain) {
         if (this.pages.length <= 1) {
             applyStrictX = true;
             applyStrictY = true;
         } else {
             applyStrictX = true;
             
             if (pageIndex === 0) {
                 applyPartialTop = true;
             }
             if (pageIndex === this.pages.length - 1) {
                 applyPartialBottom = true;
             }
         }
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

      return { x, y, highlightedGuideId, highlightedEdge };
    },
    moveElementWithSnap(id: string, x: number, y: number, createSnapshot: boolean = true, constrain: boolean = true) {
      if (!this.isTemplateEditable) return;
      for (let i = 0; i < this.pages.length; i++) {
        const page = this.pages[i];
        const index = page.elements.findIndex(e => e.id === id);
        if (index !== -1) {
          const el = page.elements[index];
          if (el.locked) return; // Prevent moving locked element
          const snapped = this.getSnapPosition(el, x, y, false, constrain, i);
          this.setHighlightedGuide(snapped.highlightedGuideId || null);
          this.setHighlightedEdge(snapped.highlightedEdge || null);
          this.updateElement(id, { x: snapped.x, y: snapped.y }, createSnapshot);
          return;
        }
      }
    },
    moveSelectedElements(primaryId: string, x: number, y: number, createSnapshot: boolean = true, constrain: boolean = true) {
      if (!this.isTemplateEditable) return;
      if (createSnapshot) {
        this.snapshot();
      }

      // 1. Gather all necessary data in ONE pass
      let primaryElement: PrintElement | null = null;
      let primaryPageIndex: number = -1;
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
            primaryPageIndex = pIndex;
          }
          if (selectedSet.has(el.id) && !el.locked) {
            movableElements.push({ pageIndex: pIndex, elementIndex: eIndex, element: el });
          }
        }
      }

      if (!primaryElement || primaryElement.locked) return;

      // 2. Calculate snap for primary element
      const snapped = this.getSnapPosition(primaryElement, x, y, false, constrain, primaryPageIndex);
      
      this.setHighlightedGuide(snapped.highlightedGuideId || null);
      this.setHighlightedEdge(snapped.highlightedEdge || null);

      // 3. Calculate actual delta
      let dx = snapped.x - primaryElement.x;
      let dy = snapped.y - primaryElement.y;

      if (dx === 0 && dy === 0) return;

      // 4. Constrain delta to ensure no element leaves the canvas (respecting margins)
      let checkX = constrain;
      let checkYStrict = constrain;

      if (!constrain) {
          if (this.pages.length <= 1) {
              checkX = true;
              checkYStrict = true;
          } else {
              checkX = true;
              checkYStrict = false;
          }
      }

      if (checkX || checkYStrict || (!checkYStrict && this.pages.length > 1)) {
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
           } else {
             if (pIndex === 0) {
                 if (dy < 0) {
                    if (el.y + dy < movementBounds.minY) dy = movementBounds.minY - el.y;
                 }
             }
             
             if (pIndex === this.pages.length - 1) {
                 if (dy > 0) {
                    if (el.y + dy > movementBounds.maxY) dy = movementBounds.maxY - el.y;
                 }
             }
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
      if (!this.isTemplateEditable) return;
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
    addElement(element: Omit<PrintElement, 'id'>, pageIndex?: number) {
      if (!this.isTemplateEditable) return;
      this.snapshot();
      const newElement = { ...element, id: uuidv4() };
      const targetPageIdx = pageIndex !== undefined && pageIndex >= 0 && pageIndex < this.pages.length 
        ? pageIndex 
        : this.currentPageIndex;
      this.pages[targetPageIdx].elements.push(newElement);
      this.selectedElementId = newElement.id;
      this.currentPageIndex = targetPageIdx;
    },
    moveElementToPage(id: string, targetPageIndex: number, x: number, y: number) {
       if (!this.isTemplateEditable) return;
       this.snapshot();
       let sourcePageIndex = -1;
       let elementIndex = -1;
       let element: PrintElement | undefined;
       
       for (let i = 0; i < this.pages.length; i++) {
         const idx = this.pages[i].elements.findIndex(e => e.id === id);
         if (idx !== -1) {
           sourcePageIndex = i;
           elementIndex = idx;
           element = this.pages[i].elements[idx];
           break;
         }
       }

       if (!element || sourcePageIndex === -1) return;
       
       // Remove from source
       this.pages[sourcePageIndex].elements.splice(elementIndex, 1);
       
       // Update position
       element.x = x;
       element.y = y;
       
       // Add to target
       if (targetPageIndex >= 0 && targetPageIndex < this.pages.length) {
         this.pages[targetPageIndex].elements.push(element);
         this.currentPageIndex = targetPageIndex;
       } else {
         // Fallback: put it back
         this.pages[sourcePageIndex].elements.push(element);
       }
    },
    bringElementsToFront(ids: string[]) {
      if (!ids || ids.length === 0) return;
      const idSet = new Set(ids);
      for (const page of this.pages) {
        const selectedInPage = page.elements.filter(el => idSet.has(el.id));
        if (selectedInPage.length === 0) continue;
        let maxNonSelected = 0;
        for (const el of page.elements) {
          if (idSet.has(el.id)) continue;
          maxNonSelected = Math.max(maxNonSelected, el.style.zIndex || 1);
        }
        const needsRaise = selectedInPage.some(el => (el.style.zIndex || 1) <= maxNonSelected);
        if (!needsRaise) continue;
        let nextZ = maxNonSelected + 1;
        const orderedIds = ids.filter(id => selectedInPage.some(el => el.id === id));
        for (const id of orderedIds) {
          const index = page.elements.findIndex(el => el.id === id);
          if (index === -1) continue;
          const el = page.elements[index];
          page.elements[index] = { ...el, style: { ...el.style, zIndex: nextZ } };
          nextZ += 1;
        }
      }
    },
    moveElementsLayer(ids: string[], mode: LayerMoveMode) {
      if (!this.isTemplateEditable) return;
      if (!ids || ids.length === 0) return;

      const idSet = new Set(ids);
      const unlockedIds = new Set<string>();
      for (const page of this.pages) {
        for (const el of page.elements) {
          if (idSet.has(el.id) && !el.locked) {
            unlockedIds.add(el.id);
          }
        }
      }
      if (unlockedIds.size === 0) return;

      const pageAssignments: Array<{ pageIndex: number; assignments: Map<string, number> }> = [];
      for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
        const assignments = buildLayerAssignments(this.pages[pageIndex], unlockedIds, mode);
        if (assignments && assignments.size > 0) {
          pageAssignments.push({ pageIndex, assignments });
        }
      }

      if (pageAssignments.length === 0) return;

      this.snapshot();
      for (const { pageIndex, assignments } of pageAssignments) {
        const page = this.pages[pageIndex];
        for (let i = 0; i < page.elements.length; i += 1) {
          const el = page.elements[i];
          const targetZ = assignments.get(el.id);
          if (!targetZ || getElementZIndex(el) === targetZ) continue;
          page.elements[i] = {
            ...el,
            style: {
              ...el.style,
              zIndex: targetZ
            }
          };
        }
      }
    },
    sendElementsToBack(ids: string[]) {
      this.moveElementsLayer(ids, 'back');
    },
    moveElementsForward(ids: string[]) {
      this.moveElementsLayer(ids, 'forward');
    },
    moveElementsBackward(ids: string[]) {
      this.moveElementsLayer(ids, 'backward');
    },
    updateElement(id: string, updates: Partial<PrintElement>, createSnapshot: boolean = true) {
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
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
        this.selectedElementId = this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
      } else {
        // Normal selection
        this.selectedElementId = id;
        this.selectedElementIds = id ? [id] : [];
      }

      if (this.selectedElementIds.length > 0) {
        this.bringElementsToFront(this.selectedElementIds);
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
      if (ids.length > 0) {
        this.selectedGuideId = null;
      }
      this.selectedElementIds = ids;
      this.selectedElementId = ids.length > 0 ? ids[ids.length - 1] : null;
      if (ids.length > 0) {
        this.bringElementsToFront(ids);
      }
      if (ids.length > 0) {
        // Find page and update current index
        const pageIndex = this.pages.findIndex(p => p.elements.some(e => e.id === this.selectedElementId));
        if (pageIndex !== -1) {
          this.currentPageIndex = pageIndex;
        }
      }
    },
    removeSelectedElements() {
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
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
        // Align to canvas (respecting margins)
        const el = elements[0];
        const canvasW = this.canvasSize.width;
        const canvasH = this.canvasSize.height;
        const marginX = this.pageSpacingX || 0;
        const marginY = this.pageSpacingY || 0;
        
        // Effective content area
        const contentX = marginX;
        const contentY = marginY;
        const contentW = Math.max(0, canvasW - marginX * 2);
        const contentH = Math.max(0, canvasH - marginY * 2);

        switch (type) {
          case 'left': el.x = contentX; break;
          case 'center': el.x = contentX + (contentW - el.width) / 2; break;
          case 'right': el.x = contentX + contentW - el.width; break;
          case 'top': el.y = contentY; break;
          case 'middle': el.y = contentY + (contentH - el.height) / 2; break;
          case 'bottom': el.y = contentY + contentH - el.height; break;
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
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
      this.snapshot();
      this.canvasSize = { width, height };
    },
    setShowGrid(show: boolean) {
      this.showGrid = show;
    },
    deletePage(index: number) {
      if (!this.isTemplateEditable) return;
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
    cut() {
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length === 0) return;
      this.copy();
      this.removeSelectedElements();
    },
    paste(position?: { x: number, y: number, pageIndex: number }) {
      if (!this.isTemplateEditable) return;
      if (this.clipboard.length === 0) return;
      
      this.snapshot();
      
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
      if (targetPageIndex !== this.currentPageIndex && this.pages[targetPageIndex]) {
        this.currentPageIndex = targetPageIndex;
      }

      this.setSelection(newIds);
    },
    paginateTable(elementId: string) {
      if (!this.isTemplateEditable) return;
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
      if (!this.isTemplateEditable) return;
      if (this.selectedElementIds.length < 2) return;
      console.log('Group selected elements:', this.selectedElementIds);
      // TODO: Implement grouping logic
      alert('Grouping feature is under development');
    },
    async loadCustomElements() {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode !== 'remote') return;
      try {
        const url = buildEndpoint(endpoints.customElements?.list, '');
        const options = buildFetchOptions(endpoints.customElements?.list, 'GET', headers);
        const res = await (fetcher || fetch)(url, options);
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.customElements || [];
        this.customElements = list
          .filter((el: any) => el && typeof el.id === 'string' && typeof el.name === 'string' && (el.element || this.customElements.some(e => e.id === el.id) || this.customElementDetailCache[el.id]))
          .map((el: any) => {
            const existing = this.customElements.find(e => e.id === el.id);
            const cached = this.customElementDetailCache[el.id];
            const merged = {
              id: el.id,
              name: el.name,
              element: el.element ? cloneDeep(el.element) : cloneDeep(cached?.element || existing?.element || {}),
              testData: el.testData || cached?.testData || existing?.testData,
              system: el.system ?? cached?.system ?? existing?.system,
              editable: el.editable ?? cached?.editable ?? existing?.editable,
              deletable: el.deletable ?? cached?.deletable ?? existing?.deletable,
              copyable: el.copyable ?? cached?.copyable ?? existing?.copyable,
              permissions: el.permissions ?? cached?.permissions ?? existing?.permissions,
              ext: { ...(existing?.ext || {}), ...(cached?.ext || {}), ...(el.ext || {}) }
            };
            const normalized = normalizeEntityConstraints(merged);
            this.customElementDetailCache[el.id] = normalized;
            return normalized as CustomElementTemplate;
          });
      } catch (e) {
        console.error('Failed to load custom elements', e);
      }
    },
    async copyCustomElement(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const el = this.customElements.find(el => el.id === id);
      if (!el) return;
      if (!canCopyEntity(el)) {
        toast.warning(i18n.global.t('toast.customElementCopyNotAllowed'));
        return;
      }
      const cachedElement = this.customElementDetailCache[id];
      const source: any = mode === 'remote'
        ? {
            id: el.id,
            name: el.name,
            element: (el as any).element || cachedElement?.element,
            testData: (el as any).testData || cachedElement?.testData,
            ext: { ...(cachedElement?.ext || {}), ...(el.ext || {}) }
          }
        : el;
      const template: CustomElementTemplate = normalizeEntityConstraints({
        id: uuidv4(),
        name: `${source.name} Copy`,
        element: cloneDeep(source.element),
        testData: cloneDeep(source.testData),
        ext: source.ext,
        // A copied custom element should become a normal editable entity by default.
        system: false,
        editable: true,
        deletable: true,
        copyable: true,
        permissions: {
          ...(source.permissions && typeof source.permissions === 'object' ? source.permissions : {}),
          system: false,
          editable: true,
          deletable: true,
          copyable: true
        }
      }) as CustomElementTemplate;
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.customElements?.upsert, '');
          const options = buildFetchOptions(endpoints.customElements?.upsert, 'POST', headers, template);
          const res = await (fetcher || fetch)(url, options);
          const result = await res.json();
          if (result && typeof result === 'object') {
            if (result.ext) {
              template.ext = { ...(template.ext || {}), ...result.ext };
            }
          }
          template.id = result?.id || template.id;
          const cached = this.customElementDetailCache[template.id];
          this.customElementDetailCache[template.id] = normalizeEntityConstraints({
            id: template.id,
            name: template.name,
            element: cloneDeep(template.element || cached?.element || {}),
            testData: template.testData || cached?.testData,
            system: template.system ?? cached?.system,
            editable: template.editable ?? cached?.editable,
            deletable: template.deletable ?? cached?.deletable,
            copyable: template.copyable ?? cached?.copyable,
            permissions: template.permissions ?? cached?.permissions,
            ext: { ...(cached?.ext || {}), ...(template.ext || {}) }
          }) as CustomElementTemplate;
          
          await this.loadCustomElements();
        } catch (e) {
          console.error('Failed to copy custom element', e);
          toast.error(i18n.global.t('toast.customElementCopyFailed'));
        }
      } else {
        this.customElements.push(template);
        this.saveCustomElements();
      }
    },
    async addCustomElement(name: string, element: PrintElement) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const template: CustomElementTemplate = normalizeEntityConstraints({
        id: uuidv4(),
        name,
        element: cloneDeep(element)
      }) as CustomElementTemplate;
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.customElements?.upsert, '');
          const options = buildFetchOptions(endpoints.customElements?.upsert, 'POST', headers, template);
          const res = await (fetcher || fetch)(url, options);
          const result = await res.json();
          if (result && typeof result === 'object') {
            if (result.ext) {
              template.ext = { ...(template.ext || {}), ...result.ext };
            }
          }
          template.id = result?.id || template.id;
          const cached = this.customElementDetailCache[template.id];
          this.customElementDetailCache[template.id] = normalizeEntityConstraints({
            id: template.id,
            name: template.name,
            element: cloneDeep(template.element || cached?.element || {}),
            testData: template.testData || cached?.testData,
            system: template.system ?? cached?.system,
            editable: template.editable ?? cached?.editable,
            deletable: template.deletable ?? cached?.deletable,
            copyable: template.copyable ?? cached?.copyable,
            permissions: template.permissions ?? cached?.permissions,
            ext: { ...(cached?.ext || {}), ...(template.ext || {}) }
          }) as CustomElementTemplate;
          
          await this.loadCustomElements();
        } catch (e) {
          console.error('Failed to add custom element', e);
          toast.error(i18n.global.t('toast.customElementAddFailed'));
        }
      } else {
        this.customElements.push(template);
        this.saveCustomElements();
      }
    },
    async removeCustomElement(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const existing = this.customElements.find(el => el.id === id);
      if (existing && !canDeleteEntity(existing)) {
        toast.warning(i18n.global.t('toast.customElementDeleteNotAllowed'));
        return;
      }
      const index = this.customElements.findIndex(el => el.id === id);
      if (index !== -1) {
        this.customElements.splice(index, 1);
        delete this.customElementDetailCache[id];
        if (mode === 'remote') {
          try {
            const url = buildEndpoint(endpoints.customElements?.delete, id);
            const options = buildFetchOptions(endpoints.customElements?.delete, 'DELETE', headers);
            await (fetcher || fetch)(url, options);
          } catch (e) {
            console.error('Failed to remove custom element', e);
            toast.error(i18n.global.t('toast.customElementRemoveFailed'));
          }
          return;
        }
        this.saveCustomElements();
      }
    },
    async editCustomElement(id: string, newName: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const template = this.customElements.find(el => el.id === id);
      if (template) {
        if (!canEditEntity(template)) {
          toast.warning(i18n.global.t('toast.customElementReadOnly'));
          return;
        }
        template.name = newName;
        if (mode === 'remote') {
          try {
            const cachedTemplate = this.customElementDetailCache[id];
            const payload = normalizeEntityConstraints({
              id: template.id,
              name: newName,
              element: cloneDeep(template.element),
              testData: template.testData,
              system: template.system ?? cachedTemplate?.system,
              editable: template.editable ?? cachedTemplate?.editable,
              deletable: template.deletable ?? cachedTemplate?.deletable,
              copyable: template.copyable ?? cachedTemplate?.copyable,
              permissions: template.permissions ?? cachedTemplate?.permissions,
              ext: { ...(cachedTemplate?.ext || {}), ...(template.ext || {}) }
            });
            const url = buildEndpoint(endpoints.customElements?.upsert, '');
            const options = buildFetchOptions(endpoints.customElements?.upsert, 'POST', headers, payload);
            await (fetcher || fetch)(url, options);
            const cached = this.customElementDetailCache[id];
            this.customElementDetailCache[id] = normalizeEntityConstraints({
              id: payload.id,
              name: payload.name,
              element: cloneDeep(payload.element || cached?.element || {}),
              testData: payload.testData || cached?.testData,
              system: payload.system ?? cached?.system,
              editable: payload.editable ?? cached?.editable,
              deletable: payload.deletable ?? cached?.deletable,
              copyable: payload.copyable ?? cached?.copyable,
              permissions: payload.permissions ?? cached?.permissions,
              ext: { ...(cached?.ext || {}), ...(payload.ext || {}) }
            }) as CustomElementTemplate;
          } catch (e) {
            console.error('Failed to edit custom element', e);
            toast.error(i18n.global.t('toast.customElementEditFailed'));
          }
          return;
        }
        this.saveCustomElements();
      }
    },
    saveCustomElements() {
      const { mode } = getCrudConfig();
      if (mode === 'remote') return;
      localStorage.setItem('print-designer-custom-elements', JSON.stringify(this.customElements));
    }
  },
  getters: {
    isTemplateEditable: (state) => {
      if (state.editingCustomElementId) return true;
      const templateStore = useTemplateStore();
      if (!templateStore.currentTemplateId) return true;
      const template = templateStore.templates.find(t => t.id === templateStore.currentTemplateId);
      if (!template) return true;
      return canEditEntity(template);
    },
    selectedElement: (state) => {
      if (!state.selectedElementId) return null;
      for (const page of state.pages) {
        const el = page.elements.find(e => e.id === state.selectedElementId);
        if (el) return el;
      }
      return null;
    },
    currentPage: (state) => state.pages[state.currentPageIndex],
    editingCustomElement: (state) => {
      if (!state.editingCustomElementId) return null;
      return state.customElements.find(el => el.id === state.editingCustomElementId) || null;
    }
  }
});
