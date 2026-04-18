export type CrudMode = 'local' | 'remote';

export type EndpointConfig = string | {
  url: string;
  method?: string;
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

export type CrudConfig = {
  mode: CrudMode;
  endpoints: CrudEndpoints;
  headers?: Record<string, string>;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const defaultConfig: CrudConfig = {
  mode: 'local',
  endpoints: {
    baseUrl: '',
    templates: {
      list: '/api/print/templates',
      get: '/api/print/templates/{id}',
      upsert: '/api/print/templates',
      delete: '/api/print/templates/{id}'
    },
    customElements: {
      list: '/api/print/custom-elements',
      get: '/api/print/custom-elements/{id}',
      upsert: '/api/print/custom-elements',
      delete: '/api/print/custom-elements/{id}'
    }
  },
  headers: {
    'Content-Type': 'application/json'
  }
};

let config: CrudConfig = { ...defaultConfig };

const mergeEndpoints = (base: CrudEndpoints, next?: CrudEndpoints): CrudEndpoints => {
  if (!next) return { ...base };
  return {
    baseUrl: next.baseUrl ?? base.baseUrl,
    templates: { ...base.templates, ...next.templates },
    customElements: { ...base.customElements, ...next.customElements }
  };
};

export const setCrudConfig = (next: Partial<CrudConfig>) => {
  if (!next || typeof next !== 'object') return;
  config = {
    mode: next.mode || config.mode,
    endpoints: mergeEndpoints(config.endpoints, next.endpoints),
    headers: { ...config.headers, ...(next.headers || {}) },
    fetcher: next.fetcher || config.fetcher
  };
};

export const getCrudConfig = (): CrudConfig => ({
  mode: config.mode,
  endpoints: mergeEndpoints(config.endpoints),
  headers: { ...(config.headers || {}) },
  fetcher: config.fetcher
});

export const setCrudMode = (mode: CrudMode) => {
  config = { ...config, mode };
};

export const resolveUrl = (path: string) => {
  const baseUrl = config.endpoints.baseUrl || '';
  if (!path) return baseUrl || '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  if (path.startsWith('/')) return `${baseUrl.replace(/\/+$/, '')}${path}`;
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
};

export const buildEndpoint = (config: EndpointConfig | undefined, id?: string) => {
  const raw = typeof config === 'string' ? config : (config?.url || '');
  const withId = id ? raw.replace('{id}', id) : raw;
  return resolveUrl(withId);
};

export const buildFetchOptions = (
  config: EndpointConfig | undefined,
  defaultMethod: string,
  defaultHeaders: Record<string, string> | undefined,
  defaultPayload?: any
): RequestInit => {
  const method = (typeof config === 'object' && config.method) ? config.method.toUpperCase() : defaultMethod.toUpperCase();
  const isBodyMethod = method === 'POST' || method === 'PUT' || method === 'PATCH';
  
  const options: RequestInit = {
    method,
    headers: defaultHeaders,
    cache: 'no-store' // Prevent browser caching for list and details
  };

  if (isBodyMethod) {
    if (defaultPayload !== undefined) {
      options.body = JSON.stringify(defaultPayload);
    }
  }

  return options;
};
