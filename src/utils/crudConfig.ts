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

export type CrudScopeId = string;
const DEFAULT_CRUD_SCOPE_ID = '__global__';

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

const crudConfigs = new Map<CrudScopeId, CrudConfig>();
const explicitScopedConfigs = new Set<CrudScopeId>();

let sharedDefaultProviderScopeId: CrudScopeId | null = null;
let sharedDefaultConfig: CrudConfig | null = null;

const normalizeScopeId = (scopeId?: CrudScopeId) => {
  const next = String(scopeId || '').trim();
  return next || DEFAULT_CRUD_SCOPE_ID;
};

const mergeEndpoints = (base: CrudEndpoints, next?: CrudEndpoints): CrudEndpoints => {
  if (!next) return { ...base };
  return {
    baseUrl: next.baseUrl ?? base.baseUrl,
    templates: { ...base.templates, ...next.templates },
    customElements: { ...base.customElements, ...next.customElements }
  };
};

const cloneConfig = (source: CrudConfig): CrudConfig => ({
  mode: source.mode,
  endpoints: mergeEndpoints(defaultConfig.endpoints, source.endpoints),
  headers: { ...(source.headers || {}) },
  fetcher: source.fetcher,
});

const isScopedConfig = (scopeId: CrudScopeId) => scopeId !== DEFAULT_CRUD_SCOPE_ID;

const syncSharedDefaultFromScope = (scopeId: CrudScopeId) => {
  if (!isScopedConfig(scopeId)) return;

  if (!sharedDefaultProviderScopeId) {
    sharedDefaultProviderScopeId = scopeId;
  }
  if (sharedDefaultProviderScopeId !== scopeId) return;

  const current = crudConfigs.get(scopeId);
  if (!current) return;

  sharedDefaultConfig = cloneConfig(current);

  for (const [key] of crudConfigs.entries()) {
    if (!isScopedConfig(key)) continue;
    if (key === scopeId) continue;
    if (explicitScopedConfigs.has(key)) continue;
    crudConfigs.set(key, cloneConfig(sharedDefaultConfig));
  }
};

const getScopeConfigRef = (scopeId?: CrudScopeId): CrudConfig => {
  const key = normalizeScopeId(scopeId);
  const existing = crudConfigs.get(key);
  if (existing) return existing;

  const source =
    isScopedConfig(key) && sharedDefaultConfig
      ? sharedDefaultConfig
      : defaultConfig;
  const created = cloneConfig(source);
  crudConfigs.set(key, created);
  return created;
};

export const setCrudConfig = (next: Partial<CrudConfig>, scopeId?: CrudScopeId) => {
  if (!next || typeof next !== 'object') return;
  const key = normalizeScopeId(scopeId);
  const current = getScopeConfigRef(key);

  const updated = {
    mode: next.mode || current.mode,
    endpoints: mergeEndpoints(current.endpoints, next.endpoints),
    headers: { ...(current.headers || {}), ...(next.headers || {}) },
    fetcher: next.fetcher || current.fetcher
  };

  crudConfigs.set(key, updated);

  if (isScopedConfig(key)) {
    explicitScopedConfigs.add(key);
    syncSharedDefaultFromScope(key);
  }
};

export const getCrudConfig = (scopeId?: CrudScopeId): CrudConfig => {
  const current = getScopeConfigRef(scopeId);
  return {
    mode: current.mode,
    endpoints: mergeEndpoints(current.endpoints),
    headers: { ...(current.headers || {}) },
    fetcher: current.fetcher
  };
};

export const setCrudMode = (mode: CrudMode, scopeId?: CrudScopeId) => {
  const key = normalizeScopeId(scopeId);
  const current = getScopeConfigRef(key);

  const updated = { ...current, mode };
  crudConfigs.set(key, updated);

  if (isScopedConfig(key)) {
    explicitScopedConfigs.add(key);
    syncSharedDefaultFromScope(key);
  }
};

export const resolveUrl = (path: string, scopeId?: CrudScopeId) => {
  const current = getScopeConfigRef(scopeId);
  const baseUrl = current.endpoints.baseUrl || '';
  if (!path) return baseUrl || '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  if (path.startsWith('/')) return `${baseUrl.replace(/\/+$/, '')}${path}`;
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
};

export const buildEndpoint = (config: EndpointConfig | undefined, id?: string, scopeId?: CrudScopeId) => {
  const raw = typeof config === 'string' ? config : (config?.url || '');
  const withId = id ? raw.replace('{id}', id) : raw;
  return resolveUrl(withId, scopeId);
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
