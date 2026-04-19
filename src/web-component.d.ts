import type {
  DesignerExportRequest,
  DesignerPrintRequest,
  DesignerPrintDefaults,
  DesignerListContextMenuConfig,
  DesignerListContextMenuItem,
  DesignerTemplateTagResolver
} from './web-component';
import type {
  LocalPrinterInfo,
  RemotePrinterInfo,
  LocalPrinterCaps,
  RemoteClientInfo
} from './composables/usePrintSettings';

export type EndpointConfig = string | {
  url: string;
  method?: string;
  data?: Record<string, any>;
};

export type CrudEndpoints = {
  baseUrl?: string;
  templates?: {
    list?: EndpointConfig;
    get?: EndpointConfig;
    upsert?: EndpointConfig;
    delete?: EndpointConfig;
  };
  customElements?: {
    list?: EndpointConfig;
    get?: EndpointConfig;
    upsert?: EndpointConfig;
    delete?: EndpointConfig;
  };
};

export interface PrintDesignerElement extends HTMLElement {
  print(request?: DesignerPrintRequest): Promise<void>;
  export(request: DesignerExportRequest): Promise<void | Blob>;
  setPrintDefaults(payload?: DesignerPrintDefaults): void;
  fetchLocalPrinters(): Promise<LocalPrinterInfo[]>;
  fetchLocalPrinterCaps(printer: string): Promise<LocalPrinterCaps | undefined>;
  fetchRemotePrinters(clientId?: string): Promise<RemotePrinterInfo[]>;
  fetchRemoteClients(): Promise<RemoteClientInfo[]>;

  setBranding(payload?: { title?: string; logoUrl?: string; showTitle?: boolean; showLogo?: boolean }): void;
  setBrandVars(vars: Record<string, string>, options?: { persist?: boolean }): void;
  setTheme(theme: string): void;
  setDesignerFont(fontFamily: string, options?: { persist?: boolean }): void;
  setLanguage(lang: 'zh' | 'en'): void;
  getPrintQuality(): 'fast' | 'normal' | 'high' | 'ultra';
  setPrintQuality(quality: 'fast' | 'normal' | 'high' | 'ultra'): void;

  getTestData(): Record<string, any>;
  setTestData(data: Record<string, any>, options?: { merge?: boolean }): Promise<void>;

  getVariables(): Record<string, any>;
  setVariables(data: Record<string, any>, options?: { merge?: boolean }): Promise<void>;

  getTemplateVariables(): Record<string, any>;

  getTemplateData(): any;
  loadTemplateData(data: any): boolean;

  getTemplates(options?: { includeData?: boolean }): Array<{ id: string; name: string; updatedAt: number } | any>;
  refreshTemplates(options?: { includeData?: boolean }): Promise<Array<{ id: string; name: string; updatedAt: number } | any>>;
  getTemplate(id: string): any | null;
  upsertTemplate(template: { id?: string; name: string; data?: any; updatedAt?: number; [key: string]: any }, options?: { setCurrent?: boolean }): Promise<string | null>;
  setTemplates(templates: Array<{ id: string; name: string; data?: any; updatedAt?: number; [key: string]: any }>, options?: { currentTemplateId?: string }): void;
  deleteTemplate(id: string, options?: { confirm?: boolean }): Promise<void>;
  loadTemplate(id: string): boolean;

  getCustomElements(options?: { includeElement?: boolean }): Array<{ id: string; name: string } | any>;
  refreshCustomElements(options?: { includeElement?: boolean }): Promise<Array<{ id: string; name: string } | any>>;
  upsertCustomElement(customElement: { id?: string; name: string; element: any; [key: string]: any }): Promise<string | null>;
  setCustomElements(customElements: Array<{ id: string; name: string; element: any; [key: string]: any }>): void;
  deleteCustomElement(id: string, options?: { confirm?: boolean }): Promise<void>;
  setTemplateContextMenu(config: DesignerListContextMenuConfig | DesignerListContextMenuItem[]): void;
  clearTemplateContextMenu(): void;
  setCustomElementContextMenu(config: DesignerListContextMenuConfig | DesignerListContextMenuItem[]): void;
  clearCustomElementContextMenu(): void;
  setTemplateTagResolver(resolver: DesignerTemplateTagResolver): void;
  clearTemplateTagResolver(): void;

  setCrudMode(mode: 'local' | 'remote'): void;
  setCrudEndpoints(endpoints: CrudEndpoints, options?: { baseUrl?: string; headers?: Record<string, string>; fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'print-designer': PrintDesignerElement;
  }
}

export {};
