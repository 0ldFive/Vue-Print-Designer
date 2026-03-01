import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { useDesignerStore } from './designer';
import { getCrudConfig, buildEndpoint } from '@/utils/crudConfig';

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
    async loadTemplates() {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.list || '');
          const res = await (fetcher || fetch)(url, { headers });
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.templates || [];
          this.templates = list
            .filter((t: any) => t && typeof t.id === 'string' && typeof t.name === 'string')
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              data: t.data || {},
              updatedAt: t.updatedAt || Date.now()
            }))
            .sort((a: Template, b: Template) => b.updatedAt - a.updatedAt);
          return;
        } catch (e) {
          console.error('Failed to load templates', e);
        }
      }

      const stored = localStorage.getItem('print-designer-templates');
      if (stored) {
        try {
          this.templates = JSON.parse(stored);
          this.templates.sort((a: Template, b: Template) => b.updatedAt - a.updatedAt);
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
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
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
      try {
        if (mode === 'remote') {
          const payload = {
            id: targetId || uuidv4(),
            name,
            data,
            updatedAt: Date.now()
          };
          const url = buildEndpoint(endpoints.templates?.upsert || '');
          const res = await (fetcher || fetch)(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          const result = await res.json();
          const id = result?.id || payload.id;
          const index = this.templates.findIndex(t => t.id === id);
          const next = { ...payload, id } as Template;
          if (index >= 0) this.templates[index] = next;
          else this.templates.unshift(next);
          
          // Only update currentTemplateId if we were creating a new template (no targetId)
          // or if the user hasn't switched to another template yet
          if (!targetId || this.currentTemplateId === targetId) {
            this.currentTemplateId = id;
          }
          return;
        }

        if (targetId) {
          const index = this.templates.findIndex(t => t.id === targetId);
          if (index !== -1) {
            this.templates[index].data = data;
            this.templates[index].name = name;
            this.templates[index].updatedAt = Date.now();
          } else {
            this.createTemplate(name, data);
          }
        } else {
          this.createTemplate(name, data);
        }
        this.saveToLocalStorage();
      } finally {
        this.isSaving = false;
      }
    },

    async createTemplate(name: string, data?: any) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
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

      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.upsert || '');
          const res = await (fetcher || fetch)(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(newTemplate)
          });
          const result = await res.json();
          const id = result?.id || newTemplate.id;
          newTemplate.id = id;
        } catch (e) {
          console.error('Failed to create template', e);
        }
      }

      this.templates.unshift(newTemplate);
      this.currentTemplateId = newTemplate.id;
      if (mode !== 'remote') {
        this.saveToLocalStorage();
      }
    },

    async deleteTemplate(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      this.templates = this.templates.filter(t => t.id !== id);
      if (this.currentTemplateId === id) {
        this.currentTemplateId = null;
      }
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.delete || '', id);
          await (fetcher || fetch)(url, { method: 'DELETE', headers });
        } catch (e) {
          console.error('Failed to delete template', e);
        }
        return;
      }
      this.saveToLocalStorage();
    },

    async renameTemplate(id: string, newName: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const t = this.templates.find(t => t.id === id);
      if (t) {
        t.name = newName;
        t.updatedAt = Date.now();
        if (mode === 'remote') {
          try {
            const url = buildEndpoint(endpoints.templates?.upsert || '');
            await (fetcher || fetch)(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(t)
            });
          } catch (e) {
            console.error('Failed to rename template', e);
          }
          return;
        }
        this.saveToLocalStorage();
      }
    },

    async copyTemplate(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const t = this.templates.find(t => t.id === id);
      if (t) {
        const newTemplate: Template = {
          id: uuidv4(),
          name: `${t.name} Copy`,
          data: JSON.parse(JSON.stringify(t.data)),
          updatedAt: Date.now()
        };
        if (mode === 'remote') {
          try {
            const url = buildEndpoint(endpoints.templates?.upsert || '');
            const res = await (fetcher || fetch)(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(newTemplate)
            });
            const result = await res.json();
            newTemplate.id = result?.id || newTemplate.id;
          } catch (e) {
            console.error('Failed to copy template', e);
          }
        }
        this.templates.unshift(newTemplate);
        if (mode !== 'remote') {
          this.saveToLocalStorage();
        }
      }
    },

    async loadTemplate(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.get || '', id);
          const res = await (fetcher || fetch)(url, { headers });
          const payload = await res.json();
          const t = payload?.template || payload;
          if (!t) return;
          const designerStore = useDesignerStore();
          designerStore.resetCanvas();
          const data = t.data || {};
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
          designerStore.selectedElementId = null;
          designerStore.selectedGuideId = null;
          designerStore.historyPast = [];
          designerStore.historyFuture = [];
          this.currentTemplateId = t.id || id;
          return;
        } catch (e) {
          console.error('Failed to load template', e);
          return;
        }
      }
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
