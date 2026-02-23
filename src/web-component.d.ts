import type {
  DesignerExportRequest,
  DesignerPrintRequest,
  DesignerPrintDefaults
} from './web-component';

export interface PrintDesignerElement extends HTMLElement {
  print(request?: DesignerPrintRequest): Promise<void>;
  export(request: DesignerExportRequest): Promise<void | Blob>;
  setPrintDefaults(payload?: DesignerPrintDefaults): void;

  setBranding(payload?: { title?: string; logoUrl?: string; showTitle?: boolean; showLogo?: boolean }): void;
  setBrandVars(vars: Record<string, string>, options?: { persist?: boolean }): void;
  setTheme(theme: string): void;

  getVariables(): Record<string, any>;
  setVariables(vars: Record<string, any>, options?: { merge?: boolean }): void;

  getTemplateData(): any;
  loadTemplateData(data: any): boolean;

  getTemplates(options?: { includeData?: boolean }): Array<{ id: string; name: string; updatedAt: number } | any>;
  getTemplate(id: string): any | null;
  upsertTemplate(template: { id?: string; name: string; data?: any; updatedAt?: number }, options?: { setCurrent?: boolean }): string | null;
  setTemplates(templates: Array<{ id: string; name: string; data?: any; updatedAt?: number }>, options?: { currentTemplateId?: string }): void;
  deleteTemplate(id: string): void;
  loadTemplate(id: string): boolean;

  getCustomElements(options?: { includeElement?: boolean }): Array<{ id: string; name: string } | any>;
  upsertCustomElement(customElement: { id?: string; name: string; element: any }): string | null;
  setCustomElements(customElements: Array<{ id: string; name: string; element: any }>): void;
  deleteCustomElement(id: string): void;

  setCrudMode(mode: 'local' | 'remote'): void;
  setCrudEndpoints(endpoints: {
    baseUrl?: string;
    templates?: { list?: string; get?: string; upsert?: string; delete?: string };
    customElements?: { list?: string; get?: string; upsert?: string; delete?: string };
  }, options?: { baseUrl?: string; headers?: Record<string, string> }): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'print-designer': PrintDesignerElement;
  }
}

export {};
