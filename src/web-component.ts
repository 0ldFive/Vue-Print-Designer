import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import i18n, { createI18nInstance } from './locales';
import baseStyles from './style.css?inline';
import PrintDesigner from './components/PrintDesigner.vue';
import { useTheme } from './composables/useTheme';
import { usePrint } from './utils/print';
import {
  usePrintSettings,
  type PrintMode,
  type PrintOptions,
  type LocalConnectionSettings,
  type RemoteConnectionSettings,
  type LocalPrinterInfo,
  type RemotePrinterInfo,
  type LocalPrinterCaps,
  type RemoteClientInfo
} from './composables/usePrintSettings';
import { useDesignerStore } from './stores/designer';
import { useTemplateStore } from './stores/templates';
import { cloneDeep } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { setCrudConfig, setCrudMode, getCrudConfig, buildEndpoint, buildFetchOptions, type CrudMode, type CrudEndpoints, type EndpointConfig } from './utils/crudConfig';
import { loader } from '@guolao/vue-monaco-editor';
import type { ListContextMenuConfig, ListContextMenuSource, ListContextMenuItem, TemplateModalFormConfig } from './types';
import { canDeleteEntity, canEditEntity, normalizeEntityConstraints, mergeExt } from './utils/entityConstraints';
import { buildTestDataFromPages } from './utils/variables';

loader.config({
  'vs/nls': {
    availableLanguages: {
      '*': 'en'
    }
  }
});

export type DesignerExportRequest = {
  type: 'pdf' | 'html' | 'images' | 'pdfBlob' | 'imageBlob';
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

const designerFontStorageKey = 'print-designer-font-family';

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

const getStoredDesignerFont = () => localStorage.getItem(designerFontStorageKey)?.trim() || '';

export type DesignerListContextMenuItem = Omit<ListContextMenuItem, 'hidden' | 'disabled' | 'onClick'>;
export interface DesignerListContextMenuConfig {
  mode?: 'replace' | 'append';
  items: DesignerListContextMenuItem[];
}
export type DesignerTemplateModalFormConfig = TemplateModalFormConfig;

import { toast } from './utils/toast';
import { uiConfirm } from './utils/confirm';

class PrintDesignerElement extends HTMLElement {
  private app: ReturnType<typeof createApp> | null = null;
  private printApi: ReturnType<typeof usePrint> | null = null;
  private printSettings: ReturnType<typeof usePrintSettings> | null = null;
  private designerStore: ReturnType<typeof useDesignerStore> | null = null;
  private templateStore: ReturnType<typeof useTemplateStore> | null = null;
  private themeApi: ReturnType<typeof useTheme> | null = null;
  private i18n: ReturnType<typeof createI18nInstance> | null = null;
  private mountEl: HTMLElement | null = null;
  private headObserver: MutationObserver | null = null;
  private _pendingClientUrl: string | null = null;
  private _pendingCloudUrl: string | null = null;
  private _pendingHideClientLink: boolean | null = null;
  private _pendingHideCloudLink: boolean | null = null;
  public isReady: boolean = false;

  static get observedAttributes() {
    return ['lang', 'client-url', 'cloud-url', 'hide-links', 'hide-client-link', 'hide-cloud-link'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'lang' && newValue !== oldValue) {
      this.setLanguage(newValue);
    }
    if (name === 'client-url' && newValue !== oldValue) {
      this.setClientLink(newValue);
    }
    if (name === 'cloud-url' && newValue !== oldValue) {
      this.setCloudLink(newValue);
    }
    if (name === 'hide-links' && newValue !== oldValue) {
      this.hideLinks(newValue === 'true' || newValue === '');
    }
    if (name === 'hide-client-link' && newValue !== oldValue) {
      this.hideClientLink(newValue === 'true' || newValue === '');
    }
    if (name === 'hide-cloud-link' && newValue !== oldValue) {
      this.hideCloudLink(newValue === 'true' || newValue === '');
    }
  }

  setClientLink(url: string) {
    if (this.designerStore) {
      this.designerStore.setClientUrl(url);
    } else {
      this._pendingClientUrl = url;
    }
  }

  setCloudLink(url: string) {
    if (this.designerStore) {
      this.designerStore.setCloudUrl(url);
    } else {
      this._pendingCloudUrl = url;
    }
  }

  hideLinks(hide: boolean) {
    this.hideClientLink(hide);
    this.hideCloudLink(hide);
  }

  hideClientLink(hide: boolean) {
    if (this.designerStore) {
      this.designerStore.setShowClientLink(!hide);
    } else {
      this._pendingHideClientLink = hide;
    }
  }

  hideCloudLink(hide: boolean) {
    if (this.designerStore) {
      this.designerStore.setShowCloudLink(!hide);
    } else {
      this._pendingHideCloudLink = hide;
    }
  }

  setLanguage(lang: string) {
    if (lang === 'zh' || lang === 'en') {
      if (this.i18n) {
        // @ts-ignore
        this.i18n.global.locale.value = lang;
      }
      localStorage.setItem('print-designer-language', lang);
    }
  }

  private syncMonacoStyles() {
    const shadow = this.shadowRoot;
    if (!shadow) return;

    // Sync <style> tags
    const monacoStyles = Array.from(document.querySelectorAll('style')).filter(style => 
      style.textContent?.includes('.monaco-editor') || 
      style.id?.startsWith('monaco-') ||
      style.textContent?.includes('print-designer')
    );
    
    monacoStyles.forEach(style => {
      // Use the style ID if present, or a content-based hash if possible. 
      // For simplicity, let's just use a special attribute to track clones.
      const existingClone = Array.from(shadow.querySelectorAll('style')).find(s => 
        s.textContent === style.textContent
      );
      
      if (!existingClone) {
        const clone = style.cloneNode(true) as HTMLStyleElement;
        clone.setAttribute('data-monaco-clone', 'true');
        shadow.appendChild(clone);
      }
    });

    // Sync <link> tags
    const monacoLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(link => {
      const href = link.getAttribute('href') || '';
      return href.includes('monaco') || href.includes('print-designer');
    }) as HTMLLinkElement[];

    monacoLinks.forEach(link => {
      const existingClone = shadow.querySelector(`link[href="${link.href}"]`);
      if (!existingClone) {
        const clone = link.cloneNode(true) as HTMLLinkElement;
        clone.setAttribute('data-monaco-clone', 'true');
        shadow.appendChild(clone);
      }
    });
  }

  private ensureShadowRoot() {
    const shadow = this.shadowRoot || this.attachShadow({ mode: 'open' });

    if (!shadow.querySelector('style[data-print-designer-inline]')) {
      const style = document.createElement('style');
      style.setAttribute('data-print-designer-inline', 'true');
      style.textContent = baseStyles;
      shadow.appendChild(style);
    }

    // Designer styles and monaco styles will be synced via observer
    this.syncMonacoStyles();

    return shadow;
  }

  connectedCallback() {
    if (this.app) return;

    // Start observing head for Monaco styles
    this.headObserver = new MutationObserver(() => {
      this.syncMonacoStyles();
    });
    this.headObserver.observe(document.head, { childList: true, subtree: true });

    const pinia = createPinia();
    setActivePinia(pinia);

    const app = createApp(PrintDesigner);
    this.themeApi = useTheme();
    applyStoredBrandVars();

    app.use(pinia);
    
    const lang = this.getAttribute('lang') as 'zh' | 'en' | null;
    const i18n = createI18nInstance(lang || undefined);
    this.i18n = i18n;
    app.use(i18n);

    const shadow = this.ensureShadowRoot();
    if (!this.mountEl) {
      this.mountEl = document.createElement('div');
      this.mountEl.style.width = '100%';
      this.mountEl.style.height = '100%';
      shadow.appendChild(this.mountEl);
    }
    const storedDesignerFont = getStoredDesignerFont();
    if (storedDesignerFont) {
      this.mountEl.style.fontFamily = storedDesignerFont;
    }

    app.mount(this.mountEl);

    this.printApi = usePrint();
    this.printSettings = usePrintSettings();
    this.designerStore = useDesignerStore(pinia);
    
    this.designerStore.setContextMenuEventEmitter((eventName, detail) => {
      this.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    
    if (this._pendingClientUrl !== null) {
      this.designerStore.setClientUrl(this._pendingClientUrl);
      this._pendingClientUrl = null;
    }
    if (this._pendingCloudUrl !== null) {
      this.designerStore.setCloudUrl(this._pendingCloudUrl);
      this._pendingCloudUrl = null;
    }
    if (this._pendingHideClientLink !== null) {
      this.designerStore.setShowClientLink(!this._pendingHideClientLink);
      this._pendingHideClientLink = null;
    }
    if (this._pendingHideCloudLink !== null) {
      this.designerStore.setShowCloudLink(!this._pendingHideCloudLink);
      this._pendingHideCloudLink = null;
    }

    this.templateStore = useTemplateStore(pinia);

    this.app = app;
    this.isReady = true;
    
    // Dispatch in the next tick to ensure consumers have a chance to add event listeners
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('ready'));
    }, 0);
  }

  disconnectedCallback() {
    if (this.headObserver) {
      this.headObserver.disconnect();
      this.headObserver = null;
    }
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }
    this.printApi = null;
    this.printSettings = null;
    this.designerStore = null;
    this.templateStore = null;
    this.themeApi = null;
    this.i18n = null;
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
      const result = await this.printApi.print(pages, { mode: request.mode, options: request.options });
      this.dispatchEvent(new CustomEvent('printed', { detail: { request, result } }));
      return result;
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { scope: 'print', error } }));
      throw error;
    }
  }

  async getPreviewHtml() {
    if (!this.printApi) return '';
    try {
      return await this.printApi.getPrintHtml(this.getPrintPages());
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { scope: 'getPreviewHtml', error } }));
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
        await this.printApi.exportPdf(this.getPrintPages(), request.filename || 'print-design.pdf');
        this.dispatchEvent(new CustomEvent('exported', { detail: { request } }));
        return;
      }
      if (type === 'html') {
        await this.printApi.exportHtml(this.getPrintPages(), request.filename || 'print-design.html');
        this.dispatchEvent(new CustomEvent('exported', { detail: { request } }));
        return;
      }
      if (type === 'images') {
        await this.printApi.exportImages(this.getPrintPages(), request.filenamePrefix || 'print-design');
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

  setDesignerFont(fontFamily: string, options: { persist?: boolean } = {}) {
    if (!this.mountEl) return;
    const normalized = (fontFamily || '').trim();
    if (normalized) {
      this.mountEl.style.fontFamily = normalized;
    } else {
      this.mountEl.style.removeProperty('font-family');
    }
    if (options.persist !== false) {
      if (normalized) {
        localStorage.setItem(designerFontStorageKey, normalized);
      } else {
        localStorage.removeItem(designerFontStorageKey);
      }
    }
  }

  getPrintQuality() {
    return this.printSettings?.printQuality.value ?? 'normal';
  }

  setPrintQuality(quality: 'fast' | 'normal' | 'high' | 'ultra') {
    if (this.printSettings) {
      this.printSettings.printQuality.value = quality;
    }
  }

  getTestData() {
    if (!this.designerStore) return {};
    return cloneDeep(this.designerStore.testData || {});
  }

  async setTestData(data: Record<string, any>, options: { merge?: boolean } = {}) {
    if (!this.designerStore || !data || typeof data !== 'object') return;
    if (options.merge) {
      this.designerStore.testData = { ...(this.designerStore.testData || {}), ...data };
    } else {
      this.designerStore.testData = data;
    }
    await nextTick();
  }

  getVariables() {
    if (!this.designerStore) return {};
    return cloneDeep(this.designerStore.variables || {});
  }

  async setVariables(data: Record<string, any>, options: { merge?: boolean } = {}) {
    if (!this.designerStore || !data || typeof data !== 'object') return;
    if (options.merge) {
      this.designerStore.variables = { ...(this.designerStore.variables || {}), ...data };
    } else {
      this.designerStore.variables = data;
    }
    await nextTick();
  }

  getTemplateVariables(): Record<string, any> {
    if (!this.designerStore) return {};
    const testData = buildTestDataFromPages(this.designerStore.pages, {});
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(testData)) {
      if (Array.isArray(value)) {
        result[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        result[key] = {};
      } else if (typeof value === 'number') {
        result[key] = 0;
      } else if (typeof value === 'boolean') {
        result[key] = false;
      } else {
        result[key] = '';
      }
    }
    return result;
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
      this.designerStore.pages = cloneDeep(data.pages);
    }
    if (data.canvasSize) this.designerStore.canvasSize = cloneDeep(data.canvasSize);
    if (data.guides) this.designerStore.guides = cloneDeep(data.guides);
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
    if (data.watermark !== undefined) this.designerStore.watermark = cloneDeep(data.watermark);
    this.designerStore.testData = cloneDeep(data.testData || {});
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

  async fetchLocalPrinters(): Promise<LocalPrinterInfo[]> {
    if (!this.printSettings) return [];
    return this.printSettings.fetchLocalPrinters();
  }

  async fetchLocalPrinterCaps(printer: string): Promise<LocalPrinterCaps | undefined> {
    if (!this.printSettings || !printer) return undefined;
    return this.printSettings.fetchLocalPrinterCaps(printer);
  }

  async fetchRemotePrinters(clientId?: string): Promise<RemotePrinterInfo[]> {
    if (!this.printSettings) return [];
    return this.printSettings.fetchRemotePrinters(clientId);
  }

  async fetchRemoteClients(): Promise<RemoteClientInfo[]> {
    if (!this.printSettings) return [];
    return this.printSettings.fetchRemoteClients();
  }

  setCrudMode(mode: CrudMode) {
    setCrudMode(mode);
    if (mode === 'remote') {
      this.templateStore?.loadTemplates().then(() => {
        if (this.templateStore && !this.templateStore.currentTemplateId && this.templateStore.templates.length > 0) {
          this.templateStore.loadTemplate(this.templateStore.templates[0].id);
        }
      });
      this.designerStore?.loadCustomElements();
    }
  }

  setCrudEndpoints(endpoints: CrudEndpoints, options: { baseUrl?: string; headers?: Record<string, string>; fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } = {}) {
    const finalBaseUrl = options.baseUrl !== undefined ? options.baseUrl : endpoints.baseUrl;
    setCrudConfig({ endpoints: { ...endpoints, baseUrl: finalBaseUrl }, headers: options.headers, fetcher: options.fetcher });
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

  async refreshTemplates(options: { includeData?: boolean } = {}) {
    if (!this.templateStore) return [];
    await this.templateStore.loadTemplates();
    return this.getTemplates(options);
  }

  async refreshCustomElements(options: { includeElement?: boolean } = {}) {
    if (!this.designerStore) return [];
    await this.designerStore.loadCustomElements();
    return this.getCustomElements(options);
  }

  async upsertTemplate(template: { id?: string; name: string; data?: any; updatedAt?: number; [key: string]: any }, options: { setCurrent?: boolean } = {}) {
    if (!this.templateStore) return null;
    if (!template || typeof template.name !== 'string') return null;
    const { mode, endpoints, headers, fetcher } = getCrudConfig();
    const id = template.id || uuidv4();
    const index = this.templateStore.templates.findIndex((t) => t.id === id);
    const existing: any = index >= 0 ? this.templateStore.templates[index] : {};
    if (index >= 0 && !canEditEntity(existing)) {
      toast.warning(i18n.global.t('toast.templateReadOnly'));
      return null;
    }
    const next = normalizeEntityConstraints({
      id,
      name: template.name,
      data: template.data || this.templateStore.templates[index]?.data || {},
      updatedAt: template.updatedAt || Date.now(),
      permissions: template.permissions ?? existing?.permissions,
      ext: mergeExt(existing?.ext, template.ext)
    });
    if (index >= 0) {
      this.templateStore.templates[index] = next;
    } else {
      this.templateStore.templates.push(next);
    }
    if (options.setCurrent) {
      this.templateStore.currentTemplateId = id;
    }
    if (mode === 'remote') {
      try {
        const cachedTemplate = (this.templateStore as any).templateDetailCache?.[id] || {};
        const requestPayload = normalizeEntityConstraints({
          id: next.id,
          name: next.name,
          data: next.data || cachedTemplate.data || {},
          updatedAt: next.updatedAt || cachedTemplate.updatedAt,
          permissions: next.permissions ?? cachedTemplate.permissions,
          ext: mergeExt(cachedTemplate.ext, next.ext)
        });
        const url = buildEndpoint(endpoints.templates?.upsert || '');
        const fetchOptions = buildFetchOptions(endpoints.templates?.upsert, 'POST', headers, requestPayload);
        const res = await (fetcher || fetch)(url, fetchOptions);
        const result = await res.json();
        const resultObj = result && typeof result === 'object' ? result : {};
        const mergedExt = { ...(requestPayload.ext || {}), ...(resultObj.ext || {}) };
        const remoteId = resultObj.id || requestPayload.id;
        const targetIndex = this.templateStore.templates.findIndex((t) => t.id === requestPayload.id);
        const updated = normalizeEntityConstraints({
          id: remoteId,
          name: resultObj.name || requestPayload.name,
          data: resultObj.data || requestPayload.data,
          updatedAt: resultObj.updatedAt || requestPayload.updatedAt,
          permissions: resultObj.permissions ?? requestPayload.permissions,
          ext: mergedExt
        });
        if (targetIndex >= 0) this.templateStore.templates[targetIndex] = updated;
        else this.templateStore.templates.push(updated);
        (this.templateStore as any).templateDetailCache = (this.templateStore as any).templateDetailCache || {};
        (this.templateStore as any).templateDetailCache[remoteId] = updated;
        if (this.templateStore.currentTemplateId === requestPayload.id) {
          this.templateStore.currentTemplateId = remoteId;
        }
        
        await this.templateStore.loadTemplates();
        return remoteId;
      } catch (e) {
        console.error('Failed to upsert template', e);
        toast.error(i18n.global.t('toast.templateUpsertFailed'));
        return next.id;
      }
    }
    this.templateStore.saveToLocalStorage();
    return next.id;
  }

  setTemplates(templates: Array<{ id: string; name: string; data?: any; updatedAt?: number; [key: string]: any }>, options: { currentTemplateId?: string } = {}) {
    if (!this.templateStore) return;
    if (!Array.isArray(templates)) return;
    const { mode } = getCrudConfig();
    this.templateStore.templates = templates
      .filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string')
      .map((t) => normalizeEntityConstraints({
        id: t.id,
        name: t.name,
        data: t.data || {},
        updatedAt: t.updatedAt || Date.now(),
        permissions: t.permissions,
        ext: t.ext || {}
      }));
    let targetId = options.currentTemplateId || this.templateStore.currentTemplateId;
    if (targetId && !this.templateStore.templates.some((t) => t.id === targetId)) {
      targetId = null;
    }
    if (!targetId && this.templateStore.templates.length > 0) {
      targetId = this.templateStore.templates[0].id;
    }
    if (targetId) {
      this.templateStore.currentTemplateId = targetId;
      if (this.designerStore && !this.designerStore.editingCustomElementId) {
        this.templateStore.loadTemplate(targetId);
      }
    }
    if (mode !== 'remote') {
      this.templateStore.saveToLocalStorage();
    }
  }

  async deleteTemplate(id: string, options: { confirm?: boolean } = {}) {
    if (!this.templateStore) return;
    const existing = this.templateStore.templates.find(t => t.id === id);
    if (existing && !canDeleteEntity(existing)) {
      toast.warning(i18n.global.t('toast.templateDeleteNotAllowed'));
      return;
    }
    if (options.confirm !== false) {
      const tpl = this.templateStore.templates.find(t => t.id === id);
      if (tpl && !await uiConfirm.show(`Are you sure you want to delete template "${tpl.name}"?`)) return;
    }
    await this.templateStore.deleteTemplate(id);
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

  getCustomElement(id: string) {
    if (!this.designerStore) return null;
    const element = this.designerStore.customElements.find((el) => el.id === id);
    return element ? cloneDeep(element) : null;
  }

  async upsertCustomElement(customElement: { id?: string; name: string; element: any; [key: string]: any }) {
    if (!this.designerStore) return null;
    if (!customElement || typeof customElement.name !== 'string' || !customElement.element) return null;
    const { mode, endpoints, headers, fetcher } = getCrudConfig();
    const id = customElement.id || uuidv4();
    const index = this.designerStore.customElements.findIndex((el) => el.id === id);
    const existing: any = index >= 0 ? this.designerStore.customElements[index] : {};
    if (index >= 0 && !canEditEntity(existing)) {
      toast.warning(i18n.global.t('toast.customElementReadOnly'));
      return null;
    }
    const next = normalizeEntityConstraints({
      id,
      name: customElement.name,
      element: cloneDeep(customElement.element),
      testData: customElement.testData,
      permissions: customElement.permissions ?? existing?.permissions,
      ext: mergeExt(existing?.ext, customElement.ext)
    });
    if (index >= 0) {
      this.designerStore.customElements.splice(index, 1, next);
    } else {
      this.designerStore.customElements.push(next);
    }
    if (mode === 'remote') {
      try {
        const cachedCustomElement = (this.designerStore as any).customElementDetailCache?.[id] || {};
        const requestPayload = normalizeEntityConstraints({
          id: next.id,
          name: next.name,
          element: cloneDeep(next.element || cachedCustomElement.element || {}),
          testData: next.testData || cachedCustomElement.testData,
          permissions: next.permissions ?? cachedCustomElement.permissions,
          ext: mergeExt(cachedCustomElement.ext, next.ext)
        });
        const url = buildEndpoint(endpoints.customElements?.upsert || '');
        const fetchOptions = buildFetchOptions(endpoints.customElements?.upsert, 'POST', headers, requestPayload);
        const res = await (fetcher || fetch)(url, fetchOptions);
        const result = await res.json();
        const resultObj = result && typeof result === 'object' ? result : {};
        const mergedExt = { ...(requestPayload.ext || {}), ...(resultObj.ext || {}) };
        const remoteId = resultObj.id || requestPayload.id;
        const targetIndex = this.designerStore.customElements.findIndex((el) => el.id === requestPayload.id);
        const updated = normalizeEntityConstraints({
          id: remoteId,
          name: resultObj.name || requestPayload.name,
          element: cloneDeep(resultObj.element || requestPayload.element),
          testData: resultObj.testData || requestPayload.testData,
          permissions: resultObj.permissions ?? requestPayload.permissions,
          ext: mergedExt
        });
        if (targetIndex >= 0) this.designerStore.customElements.splice(targetIndex, 1, updated);
        else this.designerStore.customElements.push(updated);
        (this.designerStore as any).customElementDetailCache = (this.designerStore as any).customElementDetailCache || {};
        (this.designerStore as any).customElementDetailCache[remoteId] = updated;
        
        await this.designerStore.loadCustomElements();
        return remoteId;
      } catch (e) {
        console.error('Failed to upsert custom element', e);
        toast.error(i18n.global.t('toast.customElementUpsertFailed'));
        return next.id;
      }
    }
    this.designerStore.saveCustomElements();
    return next.id;
  }

  setCustomElements(customElements: Array<{ id: string; name: string; element: any; [key: string]: any }>) {
    if (!this.designerStore) return;
    if (!Array.isArray(customElements)) return;
    const { mode } = getCrudConfig();
    this.designerStore.customElements = customElements
      .filter((el) => el && typeof el.id === 'string' && typeof el.name === 'string' && el.element)
      .map((el) => normalizeEntityConstraints({
        id: el.id,
        name: el.name,
        element: cloneDeep(el.element),
        testData: el.testData,
        permissions: el.permissions,
        ext: el.ext || {}
      }));
    if (mode !== 'remote') {
      this.designerStore.saveCustomElements();
    }
  }

  async deleteCustomElement(id: string, options: { confirm?: boolean } = {}) {
    if (!this.designerStore) return;
    const existing = this.designerStore.customElements.find(e => e.id === id);
    if (existing && !canDeleteEntity(existing)) {
      toast.warning(i18n.global.t('toast.customElementDeleteNotAllowed'));
      return;
    }
    if (options.confirm !== false) {
      const el = this.designerStore.customElements.find(e => e.id === id);
      if (el && !await uiConfirm.show(`Are you sure you want to delete custom element "${el.name}"?`)) return;
    }
    await this.designerStore.removeCustomElement(id);
  }

  private normalizeListContextMenuConfig(
    source: ListContextMenuSource,
    input: DesignerListContextMenuConfig | DesignerListContextMenuItem[]
  ): ListContextMenuConfig | null {
    const config = Array.isArray(input) ? { items: input } : input;
    if (!config || !Array.isArray(config.items)) return null;

    const items = config.items
      .filter((item): item is DesignerListContextMenuItem => 
        Boolean(item && typeof item.key === 'string' && item.key && typeof item.label === 'string')
      )
      .map((item) => ({ ...item } as ListContextMenuItem));

    if (items.length === 0) return null;

    return {
      mode: config.mode === 'replace' ? 'replace' : 'append',
      items
    };
  }

  setTemplateContextMenu(config: DesignerListContextMenuConfig | DesignerListContextMenuItem[]) {
    if (!this.designerStore) return;
    const normalized = this.normalizeListContextMenuConfig('template', config);
    this.designerStore.setTemplateContextMenuConfig(normalized);
  }

  clearTemplateContextMenu() {
    if (!this.designerStore) return;
    this.designerStore.setTemplateContextMenuConfig(null);
  }

  setCustomElementContextMenu(config: DesignerListContextMenuConfig | DesignerListContextMenuItem[]) {
    if (!this.designerStore) return;
    const normalized = this.normalizeListContextMenuConfig('customElement', config);
    this.designerStore.setCustomElementContextMenuConfig(normalized);
  }

  clearCustomElementContextMenu() {
    if (!this.designerStore) return;
    this.designerStore.setCustomElementContextMenuConfig(null);
  }

  setTemplateModalForm(config: DesignerTemplateModalFormConfig) {
    if (!this.designerStore) return;
    this.designerStore.setTemplateModalFormConfig(config || null);
  }

  clearTemplateModalForm() {
    if (!this.designerStore) return;
    this.designerStore.setTemplateModalFormConfig(null);
  }

  setCustomElementModalForm(config: DesignerTemplateModalFormConfig) {
    if (!this.designerStore) return;
    this.designerStore.setCustomElementModalFormConfig(config || null);
  }

  clearCustomElementModalForm() {
    if (!this.designerStore) return;
    this.designerStore.setCustomElementModalFormConfig(null);
  }

  // Testing hooks
  _setGlobalLoading(isLoading: boolean) {
    if (!this.templateStore) return;
    this.templateStore.isLoading = isLoading;
  }
}

const elementName = 'print-designer';
if (!customElements.get(elementName)) {
  customElements.define(elementName, PrintDesignerElement);
}

export { PrintDesignerElement };
