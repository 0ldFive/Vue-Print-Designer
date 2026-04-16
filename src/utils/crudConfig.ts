export type CrudMode = 'local' | 'remote';

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
  let finalUrl = resolveUrl(withId);

  // If GET or DELETE, append data to query string
  const method = typeof config === 'object' && config.method ? config.method.toUpperCase() : '';
  const isQueryMethod = !method || method === 'GET' || method === 'DELETE';
  
  if (typeof config === 'object' && config.data && isQueryMethod) {
    try {
      const urlObj = new URL(finalUrl, window.location.origin);
      Object.entries(config.data).forEach(([key, value]) => {
        if (value !== undefined) {
          urlObj.searchParams.append(key, String(value));
        }
      });
      finalUrl = finalUrl.startsWith('http') ? urlObj.toString() : `${urlObj.pathname}${urlObj.search}`;
    } catch (e) {
      console.warn('Failed to append query params', e);
    }
  }

  return finalUrl;
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
    headers: defaultHeaders
  };

  if (isBodyMethod) {
    let payload = defaultPayload;
    if (typeof config === 'object' && config.data) {
      if (typeof payload === 'object' && !Array.isArray(payload)) {
        payload = { ...payload, ...config.data };
      } else if (payload === undefined) {
        payload = config.data;
      }
    }
    if (payload !== undefined) {
      options.body = JSON.stringify(payload);
    }
  }

  return options;
};
