import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import i18n from './locales';
import baseStyles from './style.css?inline';
import PrintDesigner from './components/PrintDesigner.vue';
import { useTheme } from './composables/useTheme';
import { usePrint } from './utils/print';
import {
  usePrintSettings,
  type PrintMode,
  type PrintOptions,
  type LocalConnectionSettings,
  type RemoteConnectionSettings
} from './composables/usePrintSettings';
import { useDesignerStore } from './stores/designer';
import { useTemplateStore } from './stores/templates';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';
import { setCrudConfig, setCrudMode, type CrudMode, type CrudEndpoints } from './utils/crudConfig';

export type DesignerExportRequest = {
  type: 'pdf' | 'images' | 'pdfBlob' | 'imageBlob';
  filename?: string;
  filenamePrefix?: string;
  merged?: boolean;
};

export type DesignerPrintRequest = {
  mode?: PrintMode;
  options?: PrintOptions;
};

export type DesignerPrintDefaults = {
  printMode?: PrintMode;
  silentPrint?: boolean;
  exportImageMerged?: boolean;
  localSettings?: Partial<LocalConnectionSettings>;
  remoteSettings?: Partial<RemoteConnectionSettings>;
  localPrintOptions?: Partial<PrintOptions>;
  remotePrintOptions?: Partial<PrintOptions>;
};

const applyStoredBrandVars = () => {
  const stored = localStorage.getItem('print-designer-brand-vars');
  if (!stored) return;
  try {
    const vars = JSON.parse(stored) as Record<string, string>;
    if (!vars || typeof vars !== 'object') return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } catch {
    // Ignore invalid storage
  }
};

class PrintDesignerElement extends HTMLElement {
  private app: ReturnType<typeof createApp> | null = null;
  private printApi: ReturnType<typeof usePrint> | null = null;
  private printSettings: ReturnType<typeof usePrintSettings> | null = null;
  private designerStore: ReturnType<typeof useDesignerStore> | null = null;
  private templateStore: ReturnType<typeof useTemplateStore> | null = null;
  private themeApi: ReturnType<typeof useTheme> | null = null;
  private mountEl: HTMLElement | null = null;

  private ensureShadowRoot() {
    const shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });

    if (!shadow.querySelector('style[data-print-designer-inline]')) {
      const style = document.createElement('style');
      style.setAttribute('data-print-designer-inline', 'true');
      style.textContent = baseStyles;
      shadow.appendChild(style);
    }

    const existingLinks = new Set(
      Array.from(shadow.querySelectorAll('link[data-print-designer-clone]')).map((node) =>
        (node as HTMLLinkElement).href
      )
    );

    const headLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    headLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href || !href.includes('print-designer')) return;
      if (existingLinks.has(link.href)) return;
      const clone = link.cloneNode(true) as HTMLLinkElement;
      clone.setAttribute('data-print-designer-clone', 'true');
      shadow.appendChild(clone);
    });

    return shadow;
  }

  connectedCallback() {
    if (this.app) return;

    const pinia = createPinia();
    setActivePinia(pinia);

    const app = createApp(PrintDesigner);
    this.themeApi = useTheme();
    applyStoredBrandVars();

    app.use(pinia);
    app.use(i18n);

    const shadow = this.ensureShadowRoot();
    if (!this.mountEl) {
      this.mountEl = document.createElement('div');
      shadow.appendChild(this.mountEl);
    }

    app.mount(this.mountEl);

    this.printApi = usePrint();
    this.printSettings = usePrintSettings();
    this.designerStore = useDesignerStore(pinia);
    this.templateStore = useTemplateStore(pinia);

    this.app = app;
    this.dispatchEvent(new CustomEvent('ready'));
  }

  disconnectedCallback() {
    if (!this.app) return;
    this.app.unmount();
    this.app = null;
    this.printApi = null;
    this.printSettings = null;
    this.designerStore = null;
    this.templateStore = null;
    this.themeApi = null;
    this.mountEl = null;
  }

  private getPrintPages() {
    const root = this.shadowRoot || this;
    return Array.from(root.querySelectorAll('.print-page')) as HTMLElement[];
  }

  async print(request: DesignerPrintRequest = {}) {
    if (!this.printApi) return;
    const pages = this.getPrintPages();
    this.dispatchEvent(new CustomEvent('print', { detail: { request } }));
    try {
      await this.printApi.print(pages, { mode: request.mode, options: request.options });
      this.dispatchEvent(new CustomEvent('printed', { detail: { request } }));
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { scope: 'print', error } }));
      throw error;
    }
  }

  async export(request: DesignerExportRequest) {
    if (!this.printApi || !this.printSettings) return;
    const type = request?.type;
    const previousMerged = this.printSettings.exportImageMerged.value;
    if (request?.merged !== undefined) {
      this.printSettings.exportImageMerged.value = Boolean(request.merged);
    }

    try {
      this.dispatchEvent(new CustomEvent('export', { detail: { request } }));
      if (type === 'pdf') {
        await this.printApi.exportPdf(undefined, request.filename || 'print-design.pdf');
        this.dispatchEvent(new CustomEvent('exported', { detail: { request } }));
        return;
      }
      if (type === 'images') {
        await this.printApi.exportImages(undefined, request.filenamePrefix || 'print-design');
        this.dispatchEvent(new CustomEvent('exported', { detail: { request } }));
        return;
      }
      if (type === 'pdfBlob') {
        const blob = await this.printApi.getPdfBlob(this.getPrintPages());
        this.dispatchEvent(new CustomEvent('exported', { detail: { request, blob } }));
        return blob;
      }
      if (type === 'imageBlob') {
        const blob = await this.printApi.getImageBlob(this.getPrintPages());
        this.dispatchEvent(new CustomEvent('exported', { detail: { request, blob } }));
        return blob;
      }
      throw new Error('export type not supported');
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { scope: 'export', error } }));
      throw error;
    } finally {
      this.printSettings.exportImageMerged.value = previousMerged;
    }
  }

  setBranding(payload: { title?: string; logoUrl?: string; showTitle?: boolean; showLogo?: boolean } = {}) {
    if (!this.designerStore) return;
    this.designerStore.setBranding(payload);
  }

  setBrandVars(vars: Record<string, string>, options: { persist?: boolean } = {}) {
    if (!vars || typeof vars !== 'object') return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    if (options.persist !== false) {
      localStorage.setItem('print-designer-brand-vars', JSON.stringify(vars));
    }
  }

  setTheme(theme: string) {
    if (!this.themeApi) return;
    this.themeApi.setTheme(theme);
  }

  getVariables() {
    if (!this.designerStore) return {};
    return cloneDeep(this.designerStore.testData || {});
  }

  setVariables(vars: Record<string, any>, options: { merge?: boolean } = {}) {
    if (!this.designerStore || !vars || typeof vars !== 'object') return;
    if (options.merge) {
      this.designerStore.testData = { ...(this.designerStore.testData || {}), ...vars };
      return;
    }
    this.designerStore.testData = vars;
  }

  getTemplateData() {
    if (!this.designerStore) return null;
    return {
      pages: cloneDeep(this.designerStore.pages),
      canvasSize: cloneDeep(this.designerStore.canvasSize),
      guides: cloneDeep(this.designerStore.guides),
      zoom: this.designerStore.zoom,
      showGrid: this.designerStore.showGrid,
      headerHeight: this.designerStore.headerHeight,
      footerHeight: this.designerStore.footerHeight,
      showHeaderLine: this.designerStore.showHeaderLine,
      showFooterLine: this.designerStore.showFooterLine,
      showMinimap: this.designerStore.showMinimap,
      canvasBackground: this.designerStore.canvasBackground,
      pageSpacingX: this.designerStore.pageSpacingX,
      pageSpacingY: this.designerStore.pageSpacingY,
      unit: this.designerStore.unit,
      watermark: cloneDeep(this.designerStore.watermark),
      testData: cloneDeep(this.designerStore.testData || {})
    };
  }

  loadTemplateData(data: any) {
    if (!this.designerStore) return false;
    if (this.designerStore.editingCustomElementId) return false;
    if (!data) return false;
    this.designerStore.resetCanvas();
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      this.designerStore.pages = data.pages;
    }
    if (data.canvasSize) this.designerStore.canvasSize = data.canvasSize;
    if (data.guides) this.designerStore.guides = data.guides;
    if (data.zoom !== undefined) this.designerStore.zoom = data.zoom;
    if (data.showGrid !== undefined) this.designerStore.showGrid = data.showGrid;
    if (data.headerHeight !== undefined) this.designerStore.headerHeight = data.headerHeight;
    if (data.footerHeight !== undefined) this.designerStore.footerHeight = data.footerHeight;
    if (data.showHeaderLine !== undefined) this.designerStore.showHeaderLine = data.showHeaderLine;
    if (data.showFooterLine !== undefined) this.designerStore.showFooterLine = data.showFooterLine;
    if (data.showMinimap !== undefined) this.designerStore.showMinimap = data.showMinimap;
    if (data.canvasBackground !== undefined) this.designerStore.canvasBackground = data.canvasBackground;
    if (data.pageSpacingX !== undefined) this.designerStore.pageSpacingX = data.pageSpacingX;
    if (data.pageSpacingY !== undefined) this.designerStore.pageSpacingY = data.pageSpacingY;
    if (data.unit !== undefined) this.designerStore.unit = data.unit;
    if (data.watermark !== undefined) this.designerStore.watermark = data.watermark;
    this.designerStore.testData = data.testData || {};
    this.designerStore.selectedElementId = null;
    this.designerStore.selectedGuideId = null;
    this.designerStore.historyPast = [];
    this.designerStore.historyFuture = [];
    return true;
  }

  setPrintDefaults(payload: DesignerPrintDefaults = {}) {
    if (!this.printSettings) return;
    if (payload.printMode) {
      this.printSettings.printMode.value = payload.printMode;
    }
    if (payload.silentPrint !== undefined) {
      this.printSettings.silentPrint.value = Boolean(payload.silentPrint);
    }
    if (payload.exportImageMerged !== undefined) {
      this.printSettings.exportImageMerged.value = Boolean(payload.exportImageMerged);
    }
    if (payload.localSettings) {
      Object.assign(this.printSettings.localSettings, payload.localSettings);
    }
    if (payload.remoteSettings) {
      Object.assign(this.printSettings.remoteSettings, payload.remoteSettings);
    }
    if (payload.localPrintOptions) {
      Object.assign(this.printSettings.localPrintOptions, payload.localPrintOptions);
    }
    if (payload.remotePrintOptions) {
      Object.assign(this.printSettings.remotePrintOptions, payload.remotePrintOptions);
    }
  }

  setCrudMode(mode: CrudMode) {
    setCrudMode(mode);
    if (mode === 'remote') {
      this.templateStore?.loadTemplates();
      this.designerStore?.loadCustomElements();
    }
  }

  setCrudEndpoints(endpoints: CrudEndpoints, options: { baseUrl?: string; headers?: Record<string, string> } = {}) {
    setCrudConfig({ endpoints: { ...endpoints, baseUrl: options.baseUrl }, headers: options.headers });
  }

  getTemplates(options: { includeData?: boolean } = {}) {
    if (!this.templateStore) return [];
    if (options.includeData) {
      return cloneDeep(this.templateStore.templates);
    }
    return this.templateStore.templates.map((t) => ({
      id: t.id,
      name: t.name,
      updatedAt: t.updatedAt
    }));
  }

  getTemplate(id: string) {
    if (!this.templateStore) return null;
    const template = this.templateStore.templates.find((t) => t.id === id);
    return template ? cloneDeep(template) : null;
  }

  upsertTemplate(template: { id?: string; name: string; data?: any; updatedAt?: number }, options: { setCurrent?: boolean } = {}) {
    if (!this.templateStore) return null;
    if (!template || typeof template.name !== 'string') return null;
    const id = template.id || uuidv4();
    const index = this.templateStore.templates.findIndex((t) => t.id === id);
    const next = {
      id,
      name: template.name,
      data: template.data || this.templateStore.templates[index]?.data || {},
      updatedAt: template.updatedAt || Date.now()
    };
    if (index >= 0) {
      this.templateStore.templates[index] = next;
    } else {
      this.templateStore.templates.unshift(next);
    }
    if (options.setCurrent) {
      this.templateStore.currentTemplateId = id;
    }
    this.templateStore.saveToLocalStorage();
    return id;
  }

  setTemplates(templates: Array<{ id: string; name: string; data?: any; updatedAt?: number }>, options: { currentTemplateId?: string } = {}) {
    if (!this.templateStore) return;
    if (!Array.isArray(templates)) return;
    this.templateStore.templates = templates
      .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string')
      .map((t) => ({
        id: t.id,
        name: t.name,
        data: t.data || {},
        updatedAt: t.updatedAt || Date.now()
      }));
    if (options.currentTemplateId) {
      this.templateStore.currentTemplateId = options.currentTemplateId;
    }
    this.templateStore.saveToLocalStorage();
  }

  deleteTemplate(id: string) {
    if (!this.templateStore) return;
    this.templateStore.deleteTemplate(id);
  }

  loadTemplate(id: string) {
    if (!this.templateStore || !this.designerStore) return false;
    if (this.designerStore.editingCustomElementId) return false;
    this.templateStore.loadTemplate(id);
    return true;
  }

  getCustomElements(options: { includeElement?: boolean } = {}) {
    if (!this.designerStore) return [];
    if (options.includeElement) {
      return cloneDeep(this.designerStore.customElements);
    }
    return this.designerStore.customElements.map((el) => ({ id: el.id, name: el.name }));
  }

  upsertCustomElement(customElement: { id?: string; name: string; element: any }) {
    if (!this.designerStore) return null;
    if (!customElement || typeof customElement.name !== 'string' || !customElement.element) return null;
    const id = customElement.id || uuidv4();
    const index = this.designerStore.customElements.findIndex((el) => el.id === id);
    const next = { id, name: customElement.name, element: cloneDeep(customElement.element) };
    if (index >= 0) {
      this.designerStore.customElements.splice(index, 1, next);
    } else {
      this.designerStore.customElements.push(next);
    }
    this.designerStore.saveCustomElements();
    return id;
  }

  setCustomElements(customElements: Array<{ id: string; name: string; element: any }>) {
    if (!this.designerStore) return;
    if (!Array.isArray(customElements)) return;
    this.designerStore.customElements = customElements
      .filter((el) => el && typeof el.id === 'string' && typeof el.name === 'string' && el.element)
      .map((el) => ({ id: el.id, name: el.name, element: cloneDeep(el.element) }));
    this.designerStore.saveCustomElements();
  }

  deleteCustomElement(id: string) {
    if (!this.designerStore) return;
    this.designerStore.removeCustomElement(id);
  }
}

const elementName = 'print-designer';
if (!customElements.get(elementName)) {
  customElements.define(elementName, PrintDesignerElement);
}

export { PrintDesignerElement };
