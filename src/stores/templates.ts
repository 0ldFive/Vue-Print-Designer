import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import cloneDeep from 'lodash/cloneDeep';
import { useDesignerStore } from './designer';
import { toast } from '../utils/toast';
import { getCrudConfig, buildEndpoint, buildFetchOptions } from '../utils/crudConfig';
import { canCopyEntity, canDeleteEntity, canEditEntity, normalizeEntityConstraints } from '../utils/entityConstraints';
import i18n from '../locales';

export interface Template {
  id: string;
  name: string;
  data: any;
  updatedAt: number;
  system?: boolean;
  editable?: boolean;
  deletable?: boolean;
  copyable?: boolean;
  permissions?: {
    system?: boolean;
    editable?: boolean;
    deletable?: boolean;
    copyable?: boolean;
  };
  ext?: Record<string, any>;
  [key: string]: any;
}

const sanitizeElement = (element: any) => {
  if (!element || typeof element !== 'object') return null;
  if (typeof element.id !== 'string' || !element.id) return null;
  if (typeof element.type !== 'string' || !element.type) return null;
  return {
    ...element,
    style: element.style && typeof element.style === 'object' ? element.style : {}
  };
};

const sanitizePages = (pages: any) => {
  if (!Array.isArray(pages)) return [];
  return pages
    .filter((page) => page && typeof page === 'object')
    .map((page, index) => ({
      ...page,
      id: typeof page.id === 'string' && page.id ? page.id : `page-${index + 1}`,
      elements: Array.isArray(page.elements)
        ? page.elements.map(sanitizeElement).filter(Boolean)
        : []
    }));
};

const sanitizeTemplateData = (data: any) => {
  const base = data && typeof data === 'object' ? data : {};
  return {
    ...base,
    pages: sanitizePages(base.pages)
  };
};

const normalizeModalExtraValues = (values?: Record<string, any>) => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
  const payload: Record<string, any> = {};
  Object.keys(values).forEach((key) => {
    if (!key) return;
    payload[key] = values[key];
  });
  return Object.keys(payload).length > 0 ? cloneDeep(payload) : null;
};

const applyModalExtraValues = (
  templateLike: Record<string, any>,
  mode: 'create' | 'edit' | 'copy',
  values?: Record<string, any>
) => {
  const normalized = normalizeModalExtraValues(values);
  const ext = templateLike.ext && typeof templateLike.ext === 'object' ? templateLike.ext : {};
  const templateModalForm = ext.templateModalForm && typeof ext.templateModalForm === 'object'
    ? ext.templateModalForm
    : {};

  const lastMode = templateModalForm.lastMode;
  let modeData = normalized;

  if (!modeData) {
    if (templateModalForm[mode]) {
      modeData = templateModalForm[mode];
    } else if (lastMode && templateModalForm[lastMode]) {
      modeData = templateModalForm[lastMode];
    }
  }

  return {
    ...templateLike,
    ext: {
      ...ext,
      templateModalForm: {
        ...templateModalForm,
        ...(modeData ? { [mode]: modeData } : {}),
        lastMode: mode,
        updatedAt: Date.now()
      }
    }
  };
};

export const useTemplateStore = defineStore('templates', {
  state: () => ({
    templates: [] as Template[],
    templateDetailCache: {} as Record<string, any>,
    currentTemplateId: null as string | null,
    isSaving: false,
  }),
  actions: {
    async loadTemplates() {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.list, '');
          const options = buildFetchOptions(endpoints.templates?.list, 'GET', headers);
          const res = await (fetcher || fetch)(url, options);
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.templates || [];
          this.templates = list
            .filter((t: any) => t && typeof t.id === 'string' && typeof t.name === 'string')
            .map((t: any) => {
              const existing = this.templates.find(e => e.id === t.id);
              const cached = this.templateDetailCache[t.id];
              const merged = {
                id: t.id,
                name: t.name,
                data: t.data ? sanitizeTemplateData(t.data) : (cached?.data || existing?.data || sanitizeTemplateData(undefined)),
                updatedAt: t.updatedAt || cached?.updatedAt || existing?.updatedAt || Date.now(),
                system: t.system ?? cached?.system ?? existing?.system,
                editable: t.editable ?? cached?.editable ?? existing?.editable,
                deletable: t.deletable ?? cached?.deletable ?? existing?.deletable,
                copyable: t.copyable ?? cached?.copyable ?? existing?.copyable,
                permissions: t.permissions ?? cached?.permissions ?? existing?.permissions,
                ext: { ...(existing?.ext || {}), ...(cached?.ext || {}), ...(t.ext || {}) }
              };
              const normalized = normalizeEntityConstraints(merged);
              this.templateDetailCache[t.id] = normalized;
              return normalized as Template;
            });
          return;
        } catch (e) {
          console.error('Failed to load templates', e);
          this.templates = [];
          return;
        }
      }

      const stored = localStorage.getItem('print-designer-templates');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const list = Array.isArray(parsed) ? parsed : [];
          this.templates = list
            .filter((t: any) => t && typeof t.id === 'string' && typeof t.name === 'string')
            .map((t: any) => {
              const existing = this.templates.find(e => e.id === t.id);
              return normalizeEntityConstraints({
                id: t.id,
                name: t.name,
                data: t.data ? sanitizeTemplateData(t.data) : (existing?.data || sanitizeTemplateData(undefined)),
                updatedAt: t.updatedAt || existing?.updatedAt || Date.now(),
                system: t.system ?? existing?.system,
                editable: t.editable ?? existing?.editable,
                deletable: t.deletable ?? existing?.deletable,
                copyable: t.copyable ?? existing?.copyable,
                permissions: t.permissions ?? existing?.permissions,
                ext: { ...(existing?.ext || {}), ...(t.ext || {}) }
              }) as Template;
            });
        } catch (e) {
          console.error('Failed to parse templates', e);
          this.templates = [];
        }
      }
    },
    
    saveToLocalStorage() {
      const { mode } = getCrudConfig();
      if (mode === 'remote') return;
      localStorage.setItem('print-designer-templates', JSON.stringify(this.templates));
    },

    async saveCurrentTemplate(name: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const designerStore = useDesignerStore();
      // Capture current ID synchronously to prevent race conditions if template changes during async save
      const targetId = this.currentTemplateId;
      const existingTemplate = targetId ? this.templates.find(t => t.id === targetId) : undefined;
      if (targetId && existingTemplate && !canEditEntity(existingTemplate)) {
        toast.warning(i18n.global.t('toast.templateReadOnly'));
        return;
      }
      
      const data = {
        ...(existingTemplate?.data || {}),
        pages: sanitizePages(cloneDeep(designerStore.pages)),
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
          try {
            const upsertBase: any = targetId ? (this.templateDetailCache[targetId] || existingTemplate || {}) : {};
            const payload = normalizeEntityConstraints({
              id: targetId || uuidv4(),
              name,
              data: {
                ...(upsertBase?.data || {}),
                ...data
              },
              updatedAt: Date.now(),
              system: upsertBase?.system,
              editable: upsertBase?.editable,
              deletable: upsertBase?.deletable,
              copyable: upsertBase?.copyable,
              permissions: upsertBase?.permissions,
              ext: upsertBase?.ext || {}
            });
            const url = buildEndpoint(endpoints.templates?.upsert, '');
            const options = buildFetchOptions(endpoints.templates?.upsert, 'POST', headers, payload);
            const res = await (fetcher || fetch)(url, options);
            const result = await res.json();
            const id = result?.id || payload.id;
            const index = this.templates.findIndex(t => t.id === id);
            const resultExt = result && typeof result === 'object' && result.ext ? result.ext : {};
            const next = normalizeEntityConstraints({ ...payload, ext: { ...payload.ext, ...resultExt }, id }) as Template;
            if (index >= 0) this.templates[index] = next;
            else this.templates.push(next);
            this.templateDetailCache[id] = { ...(this.templateDetailCache[id] || {}), ...next };
            
            // Only update currentTemplateId if we were creating a new template (no targetId)
            // or if the user hasn't switched to another template yet
            if (!targetId || this.currentTemplateId === targetId) {
              this.currentTemplateId = id;
            }
            
            // Auto refresh list from remote
            await this.loadTemplates();
            
            return;
          } catch (e) {
            console.error('Failed to save template', e);
            toast.error(i18n.global.t('toast.templateSaveFailed'));
            throw e; // rethrow to let caller know
          }
        }

        if (targetId) {
          const idx = this.templates.findIndex(t => t.id === targetId);
          if (idx >= 0) {
            this.templates[idx] = normalizeEntityConstraints({
              ...this.templates[idx],
              name,
              data,
              updatedAt: Date.now()
            }) as Template;
          }
        } else {
          this.createTemplate(name, data);
        }
        this.saveToLocalStorage();
      } finally {
        this.isSaving = false;
      }
    },

    async createTemplate(name: string, data?: any, extraValues?: Record<string, any>) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const designerStore = useDesignerStore();
      const nextData = data || {
        pages: designerStore.pages,
        canvasSize: designerStore.canvasSize,
        pageSpacingX: designerStore.pageSpacingX,
        pageSpacingY: designerStore.pageSpacingY,
        unit: designerStore.unit,
        watermark: designerStore.watermark,
        testData: cloneDeep(designerStore.testData || {}),
        // ... capture current state if data not provided
      };
      const newData = sanitizeTemplateData(nextData);
      
      const templateBase = applyModalExtraValues({
        id: uuidv4(),
        name,
        data: newData,
        updatedAt: Date.now()
      }, 'create', extraValues);
      const newTemplate: Template = normalizeEntityConstraints(templateBase) as Template;

      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.upsert, '');
          const options = buildFetchOptions(endpoints.templates?.upsert, 'POST', headers, newTemplate);
          const res = await (fetcher || fetch)(url, options);
          const result = await res.json();
          if (result && typeof result === 'object') {
            if (result.ext) {
              newTemplate.ext = { ...(newTemplate.ext || {}), ...result.ext };
            }
          }
          const id = result?.id || newTemplate.id;
          newTemplate.id = id;
          const cached = this.templateDetailCache[id];
          this.templateDetailCache[id] = normalizeEntityConstraints({
            id: newTemplate.id,
            name: newTemplate.name,
            data: newTemplate.data || cached?.data,
            updatedAt: newTemplate.updatedAt || cached?.updatedAt,
            system: newTemplate.system ?? cached?.system,
            editable: newTemplate.editable ?? cached?.editable,
            deletable: newTemplate.deletable ?? cached?.deletable,
            copyable: newTemplate.copyable ?? cached?.copyable,
            permissions: newTemplate.permissions ?? cached?.permissions,
            ext: { ...(cached?.ext || {}), ...(newTemplate.ext || {}) }
          });
          
          await this.loadTemplates();
        } catch (e) {
          console.error('Failed to create template', e);
        }
      } else {
        this.templates.push(newTemplate);
        this.saveToLocalStorage();
      }

      this.currentTemplateId = newTemplate.id;
    },

    async deleteTemplate(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const existing = this.templates.find(t => t.id === id);
      if (existing && !canDeleteEntity(existing)) {
        toast.warning(i18n.global.t('toast.templateDeleteNotAllowed'));
        return;
      }
      this.templates = this.templates.filter(t => t.id !== id);
      delete this.templateDetailCache[id];
      if (this.currentTemplateId === id) {
        this.currentTemplateId = null;
      }
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.delete, id);
          const options = buildFetchOptions(endpoints.templates?.delete, 'DELETE', headers);
          await (fetcher || fetch)(url, options);
        } catch (e) {
          console.error('Failed to delete template', e);
          toast.error(i18n.global.t('toast.templateDeleteFailed'));
        }
        return;
      }
      this.saveToLocalStorage();
    },

    async editTemplate(id: string, newName: string, extraValues?: Record<string, any>) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const t = this.templates.find(t => t.id === id);
      if (t) {
        if (!canEditEntity(t)) {
          toast.warning(i18n.global.t('toast.templateReadOnly'));
          return;
        }
        t.name = newName;
        t.updatedAt = Date.now();
        const nextTemplate = applyModalExtraValues(t as Record<string, any>, 'edit', extraValues) as Template;
        if (nextTemplate !== t) {
          Object.assign(t, nextTemplate);
        }
        if (mode === 'remote') {
          try {
            const cachedTemplate = this.templateDetailCache[id];
            const payloadBase = applyModalExtraValues({
              id: t.id,
              name: newName,
              data: t.data || cachedTemplate?.data || {},
              updatedAt: t.updatedAt,
              system: t.system ?? cachedTemplate?.system,
              editable: t.editable ?? cachedTemplate?.editable,
              deletable: t.deletable ?? cachedTemplate?.deletable,
              copyable: t.copyable ?? cachedTemplate?.copyable,
              permissions: t.permissions ?? cachedTemplate?.permissions,
              ext: { ...(cachedTemplate?.ext || {}), ...(t.ext || {}) }
            }, 'edit', extraValues);
            const payload = normalizeEntityConstraints(payloadBase);
            const url = buildEndpoint(endpoints.templates?.upsert, '');
            const options = buildFetchOptions(endpoints.templates?.upsert, 'POST', headers, payload);
            await (fetcher || fetch)(url, options);
            this.templateDetailCache[id] = { ...(this.templateDetailCache[id] || {}), ...payload };
            
            await this.loadTemplates();
          } catch (e) {
            console.error('Failed to edit template', e);
            toast.error(i18n.global.t('toast.templateEditFailed'));
          }
          return;
        }
        this.saveToLocalStorage();
      }
    },

    async copyTemplate(id: string, newName?: string, extraValues?: Record<string, any>) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      const t = this.templates.find(t => t.id === id);
      if (t) {
        if (!canCopyEntity(t)) {
          toast.warning(i18n.global.t('toast.templateCopyNotAllowed'));
          return;
        }
        const cachedTemplate = this.templateDetailCache[id];
        const source: any = mode === 'remote'
          ? {
              id: t.id,
              name: t.name,
              data: t.data || cachedTemplate?.data,
              ext: { ...(cachedTemplate?.ext || {}), ...(t.ext || {}) }
            }
          : t;
        const newTemplateBase = applyModalExtraValues({
          id: uuidv4(),
          name: typeof newName === 'string' && newName.trim() ? newName.trim() : `${source.name} Copy`,
          data: sanitizeTemplateData(JSON.parse(JSON.stringify(source.data))),
          updatedAt: Date.now(),
          ext: source.ext,
          // A copied template should be a normal editable template by default,
          // instead of inheriting source read-only/system flags.
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
        }, 'copy', extraValues);
        const newTemplate: Template = normalizeEntityConstraints(newTemplateBase) as Template;
        if (mode === 'remote') {
          try {
            const url = buildEndpoint(endpoints.templates?.upsert, '');
            const options = buildFetchOptions(endpoints.templates?.upsert, 'POST', headers, newTemplate);
            const res = await (fetcher || fetch)(url, options);
            const result = await res.json();
            if (result && typeof result === 'object') {
              if (result.ext) {
                newTemplate.ext = { ...(newTemplate.ext || {}), ...result.ext };
              }
            }
            newTemplate.id = result?.id || newTemplate.id;
            const cached = this.templateDetailCache[newTemplate.id];
              this.templateDetailCache[newTemplate.id] = normalizeEntityConstraints({
                id: newTemplate.id,
                name: newTemplate.name,
                data: newTemplate.data || cached?.data,
                updatedAt: newTemplate.updatedAt || cached?.updatedAt,
                system: newTemplate.system ?? cached?.system,
                editable: newTemplate.editable ?? cached?.editable,
                deletable: newTemplate.deletable ?? cached?.deletable,
                copyable: newTemplate.copyable ?? cached?.copyable,
                permissions: newTemplate.permissions ?? cached?.permissions,
                ext: { ...(cached?.ext || {}), ...(newTemplate.ext || {}) }
              });
            
            await this.loadTemplates();
            this.currentTemplateId = newTemplate.id;
            await this.loadTemplate(newTemplate.id);
          } catch (e) {
            console.error('Failed to copy template', e);
            toast.error(i18n.global.t('toast.templateCopyFailed'));
          }
        } else {
          this.templates.unshift(newTemplate);
          this.saveToLocalStorage();
          this.currentTemplateId = newTemplate.id;
          await this.loadTemplate(newTemplate.id);
        }
      }
    },

    async loadTemplate(id: string) {
      const { mode, endpoints, headers, fetcher } = getCrudConfig();
      if (mode === 'remote') {
        try {
          const url = buildEndpoint(endpoints.templates?.get, id);
          const options = buildFetchOptions(endpoints.templates?.get, 'GET', headers);
          const res = await (fetcher || fetch)(url, options);
          const payload = await res.json();
          const t = payload?.template || payload;
          if (!t) return;
          const designerStore = useDesignerStore();
          designerStore.resetCanvas();
          const data = sanitizeTemplateData(t.data);
          if (data.pages.length > 0) designerStore.pages = data.pages;
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
          const currentId = t.id || id;
          this.currentTemplateId = currentId;
          this.templateDetailCache[currentId] = {
            id: t.id || currentId,
            name: t.name || '',
            data,
            updatedAt: t.updatedAt || Date.now(),
            system: t.system,
            editable: t.editable,
            deletable: t.deletable,
            copyable: t.copyable,
            permissions: t.permissions,
            ext: t.ext || {}
          };
          
          const existingIndex = this.templates.findIndex(item => item.id === currentId);
          if (existingIndex >= 0) {
            this.templates[existingIndex] = normalizeEntityConstraints({
              id: currentId,
              name: t.name || this.templates[existingIndex].name,
              data,
              updatedAt: t.updatedAt || this.templates[existingIndex].updatedAt,
              system: t.system ?? this.templates[existingIndex].system,
              editable: t.editable ?? this.templates[existingIndex].editable,
              deletable: t.deletable ?? this.templates[existingIndex].deletable,
              copyable: t.copyable ?? this.templates[existingIndex].copyable,
              permissions: t.permissions ?? this.templates[existingIndex].permissions,
              ext: { ...(this.templates[existingIndex].ext || {}), ...(t.ext || {}) }
            }) as Template;
          } else {
            this.templates.push(normalizeEntityConstraints({
              id: currentId,
              name: t.name || '',
              data,
              updatedAt: t.updatedAt || Date.now(),
              system: t.system,
              editable: t.editable,
              deletable: t.deletable,
              copyable: t.copyable,
              permissions: t.permissions,
              ext: t.ext || {}
            }) as Template);
          }
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
        
        const data = sanitizeTemplateData(t.data);
        
        // Restore state
        if (data.pages.length > 0) designerStore.pages = data.pages;
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
