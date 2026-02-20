import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { useDesignerStore } from './designer';

export interface Template {
  id: string;
  name: string;
  data: any;
  updatedAt: number;
}

export const useTemplateStore = defineStore('templates', {
  state: () => ({
    templates: [] as Template[],
    currentTemplateId: null as string | null,
    isSaving: false,
  }),
  actions: {
    loadTemplates() {
      const stored = localStorage.getItem('print-designer-templates');
      if (stored) {
        try {
          this.templates = JSON.parse(stored);
          // Sort by updatedAt desc
          this.templates.sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (e) {
          console.error('Failed to parse templates', e);
          this.templates = [];
        }
      }
    },
    
    saveToLocalStorage() {
      localStorage.setItem('print-designer-templates', JSON.stringify(this.templates));
    },

    async saveCurrentTemplate(name: string) {
      const designerStore = useDesignerStore();
      // Capture current ID synchronously to prevent race conditions if template changes during async save
      const targetId = this.currentTemplateId;

      const data = {
        pages: cloneDeep(designerStore.pages),
        canvasSize: cloneDeep(designerStore.canvasSize),
        guides: cloneDeep(designerStore.guides),
        zoom: designerStore.zoom,
        showGrid: designerStore.showGrid,
        headerHeight: designerStore.headerHeight,
        footerHeight: designerStore.footerHeight,
        showHeaderLine: designerStore.showHeaderLine,
        showFooterLine: designerStore.showFooterLine,
        showMinimap: designerStore.showMinimap,
        canvasBackground: designerStore.canvasBackground,
        pageSpacingX: designerStore.pageSpacingX,
        pageSpacingY: designerStore.pageSpacingY,
        unit: designerStore.unit,
        watermark: cloneDeep(designerStore.watermark),
        testData: cloneDeep(designerStore.testData || {}),
        // Add other necessary state here
      };

      this.isSaving = true;
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 600));

      try {
        if (targetId) {
          // Update existing
          const index = this.templates.findIndex(t => t.id === targetId);
          if (index !== -1) {
            this.templates[index].data = data;
            this.templates[index].name = name; // Update name just in case
            this.templates[index].updatedAt = Date.now();
          } else {
            // ID exists but not found? Treat as new.
            this.createTemplate(name, data);
          }
        } else {
          // Create new
          this.createTemplate(name, data);
        }
        this.saveToLocalStorage();
      } finally {
        this.isSaving = false;
      }
    },

    createTemplate(name: string, data?: any) {
      const designerStore = useDesignerStore();
      const newData = data || {
        pages: designerStore.pages,
        canvasSize: designerStore.canvasSize,
        pageSpacingX: designerStore.pageSpacingX,
        pageSpacingY: designerStore.pageSpacingY,
        unit: designerStore.unit,
        watermark: designerStore.watermark,
        testData: cloneDeep(designerStore.testData || {}),
        // ... capture current state if data not provided
      };
      
      const newTemplate: Template = {
        id: uuidv4(),
        name,
        data: newData,
        updatedAt: Date.now()
      };
      
      this.templates.unshift(newTemplate);
      this.currentTemplateId = newTemplate.id;
      this.saveToLocalStorage();
    },

    deleteTemplate(id: string) {
      this.templates = this.templates.filter(t => t.id !== id);
      if (this.currentTemplateId === id) {
        this.currentTemplateId = null;
      }
      this.saveToLocalStorage();
    },

    renameTemplate(id: string, newName: string) {
      const t = this.templates.find(t => t.id === id);
      if (t) {
        t.name = newName;
        t.updatedAt = Date.now();
        this.saveToLocalStorage();
      }
    },

    copyTemplate(id: string) {
      const t = this.templates.find(t => t.id === id);
      if (t) {
        const newTemplate: Template = {
          id: uuidv4(),
          name: `${t.name} Copy`,
          data: JSON.parse(JSON.stringify(t.data)),
          updatedAt: Date.now()
        };
        this.templates.unshift(newTemplate);
        this.saveToLocalStorage();
      }
    },

    loadTemplate(id: string) {
      const t = this.templates.find(t => t.id === id);
      if (t) {
        const designerStore = useDesignerStore();
        
        // Reset canvas to defaults first to avoid inheriting settings from previous template
        designerStore.resetCanvas();
        
        const data = t.data;
        
        // Restore state
        if (data.pages) designerStore.pages = data.pages;
        if (data.canvasSize) designerStore.canvasSize = data.canvasSize;
        if (data.guides) designerStore.guides = data.guides;
        if (data.zoom !== undefined) designerStore.zoom = data.zoom;
        if (data.showGrid !== undefined) designerStore.showGrid = data.showGrid;
        if (data.headerHeight !== undefined) designerStore.headerHeight = data.headerHeight;
        if (data.footerHeight !== undefined) designerStore.footerHeight = data.footerHeight;
        if (data.showHeaderLine !== undefined) designerStore.showHeaderLine = data.showHeaderLine;
        if (data.showFooterLine !== undefined) designerStore.showFooterLine = data.showFooterLine;
        if (data.showMinimap !== undefined) designerStore.showMinimap = data.showMinimap;
        if (data.canvasBackground !== undefined) designerStore.canvasBackground = data.canvasBackground;
        if (data.pageSpacingX !== undefined) designerStore.pageSpacingX = data.pageSpacingX;
        if (data.pageSpacingY !== undefined) designerStore.pageSpacingY = data.pageSpacingY;
        if (data.unit !== undefined) designerStore.unit = data.unit;
        if (data.watermark !== undefined) designerStore.watermark = data.watermark;
        designerStore.testData = data.testData || {};
        
        // Reset selection and history
        designerStore.selectedElementId = null;
        designerStore.selectedGuideId = null;
        designerStore.historyPast = [];
        designerStore.historyFuture = [];
        
        this.currentTemplateId = id;
      }
    }
  }
});
