import { computed, ref } from "vue";
import {
  hiddenModules,
  isModuleHidden,
  setModuleHidden,
} from "@/composables/useFeatureFlags";

const MARKET_CONFIG_STORAGE_KEY = "print-designer-market-config";
const MARKET_ENABLED_STORAGE_KEY = "print-designer-market-enabled";

export const MARKET_ENABLED_CHANGE_EVENT = "designer:market-enabled-change";
export const MARKET_CONFIG_CHANGE_EVENT = "designer:market-config-change";

export type MarketFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface MarketConfig {
  /** 市场静态目录地址，默认 http://localhost:8000/market（本地联调） */
  baseUrl: string;
  headers?: Record<string, string>;
  fetcher?: MarketFetcher;
  /** 单次请求超时，默认 15000ms */
  timeoutMs: number;
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  baseUrl: "https://printdot.cc/market",
  timeoutMs: 15000,
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeBaseUrl = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_MARKET_CONFIG.baseUrl;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_MARKET_CONFIG.baseUrl;
  return trimmed.replace(/\/+$/, "");
};

const normalizeTimeout = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_MARKET_CONFIG.timeoutMs;
  }
  return Math.max(1000, Math.round(numeric));
};

const normalizeHeaders = (
  value: unknown,
): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const result: Record<string, string> = {};
  Object.entries(value).forEach(([key, headerValue]) => {
    if (typeof headerValue === "string") result[key] = headerValue;
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

const readStoredConfig = (): Record<string, any> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MARKET_CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const toConfig = (source: Record<string, any>): MarketConfig => ({
  baseUrl: normalizeBaseUrl(source.baseUrl),
  headers: normalizeHeaders(source.headers),
  fetcher:
    typeof source.fetcher === "function" ? source.fetcher : undefined,
  timeoutMs: normalizeTimeout(source.timeoutMs),
});

const marketConfig = ref<MarketConfig>(toConfig(readStoredConfig()));

/** 默认开启：只有宿主持久化过 "false" 才视为关闭。 */
const readEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MARKET_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return false;
  }
};

export const marketEnabled = ref(readEnabled());

const dispatchEvent = (name: string, detail: Record<string, any>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const persistStoredConfig = (config: MarketConfig) => {
  if (typeof window === "undefined") return;
  try {
    const { fetcher: _fetcher, ...serializable } = config;
    window.localStorage.setItem(
      MARKET_CONFIG_STORAGE_KEY,
      JSON.stringify(serializable),
    );
  } catch {
    // ignore storage failures
  }
};

export const getMarketConfig = (): MarketConfig => toConfig(marketConfig.value);

export const setMarketConfig = (next: Partial<MarketConfig>) => {
  const merged = toConfig({
    ...marketConfig.value,
    ...(isRecord(next) ? next : {}),
    fetcher:
      typeof next?.fetcher === "function"
        ? next.fetcher
        : marketConfig.value.fetcher,
  });
  marketConfig.value = merged;
  persistStoredConfig(merged);
  dispatchEvent(MARKET_CONFIG_CHANGE_EVENT, { config: getMarketConfig() });
};

export const isMarketEnabled = () => marketEnabled.value;

/** 市场是否被宿主整体隐藏；隐藏后入口与设置页签都不再出现。 */
export const isMarketHidden = (): boolean => isModuleHidden("market");

export const setMarketHidden = (hidden: boolean) => {
  setModuleHidden("market", Boolean(hidden));
};

/** 响应式的隐藏状态，供模板直接绑定。 */
export const marketHidden = computed(() => hiddenModules.value.market === true);

export const setMarketEnabled = (enabled: boolean) => {
  const next = Boolean(enabled);
  marketEnabled.value = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MARKET_ENABLED_STORAGE_KEY, String(next));
    } catch {
      // ignore storage failures
    }
  }
  dispatchEvent(MARKET_ENABLED_CHANGE_EVENT, { enabled: next });
};

export const useMarketConfig = () => ({
  marketEnabled,
  marketHidden,
  getMarketConfig,
  setMarketConfig,
  isMarketEnabled,
  setMarketEnabled,
  isMarketHidden,
  setMarketHidden,
});
