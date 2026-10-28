import type { VariableTreeItem } from "@/types";
import { getMarketConfig } from "./config";
import {
  MarketError,
  type MarketCategory,
  type MarketListQuery,
  type MarketPage,
  type MarketTemplateSummary,
} from "./types";

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const readPositiveInt = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.round(numeric);
};

const readNonNegativeInt = (value: unknown): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return Math.round(numeric);
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  value.forEach((item) => {
    const tag = readString(item);
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    tags.push(tag);
  });
  return tags.slice(0, 4);
};

/** 封面只接受 http(s) 绝对地址；相对值统一走 {baseUrl}/{id}/cover。 */
const normalizeAssetPath = (value: unknown): string | undefined => {
  const path = readString(value);
  if (!path) return undefined;
  return /^https?:\/\//i.test(path) ? path : undefined;
};

const normalizeSummary = (value: unknown): MarketTemplateSummary | null => {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    category: readString(value.category),
    tags: normalizeTags(value.tags),
    cover: normalizeAssetPath(value.cover),
    paper: readString(value.paper),
    pages: readPositiveInt(value.pages),
    description: readString(value.description),
    author: readString(value.author),
    version: readString(value.version),
    minDesignerVersion: readString(value.minDesignerVersion),
  };
};

const normalizeCategory = (value: unknown): MarketCategory | null => {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    icon: readString(value.icon) || undefined,
    count: readNonNegativeInt(value.count) ?? 0,
  };
};

const normalizeTemplates = (value: unknown): MarketTemplateSummary[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const templates: MarketTemplateSummary[] = [];
  value.forEach((item) => {
    const normalized = normalizeSummary(item);
    if (!normalized || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    templates.push(normalized);
  });
  return templates;
};

const normalizeCategories = (value: unknown): MarketCategory[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const categories: MarketCategory[] = [];
  value.forEach((item) => {
    const normalized = normalizeCategory(item);
    if (!normalized || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    categories.push(normalized);
  });
  return categories;
};

/** baseUrl 补齐为绝对地址，path 为空时返回市场根路由本身。 */
const resolveUrl = (path = "", query?: Record<string, string>): string => {
  const { baseUrl } = getMarketConfig();
  const base = /^https?:\/\//i.test(path)
    ? path
    : (() => {
        const root = /^https?:\/\//i.test(baseUrl)
          ? baseUrl
          : new URL(
              baseUrl,
              typeof window !== "undefined"
                ? window.location.href
                : "http://localhost/",
            ).toString();
        const cleanBase = root.replace(/\/+$/, "");
        const cleanPath = path.replace(/^\/+/, "");
        return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
      })();

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

const requestJson = async (
  path = "",
  query?: Record<string, string>,
): Promise<unknown> => {
  const config = getMarketConfig();
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), config.timeoutMs)
    : null;

  let response: Response;
  try {
    const fetcher = config.fetcher || fetch;
    response = await fetcher(resolveUrl(path, query), {
      method: "GET",
      headers: config.headers,
      cache: "no-store",
      signal: controller?.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new MarketError("timeout");
    }
    throw new MarketError("network");
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 404) throw new MarketError("notFound");
    throw new MarketError("server");
  }

  try {
    return await response.json();
  } catch {
    throw new MarketError("invalidPayload");
  }
};

/** 拉取一页清单；语言投影、分类与关键词筛选、分页都由服务端完成。 */
export const fetchMarketPage = async (
  query: MarketListQuery,
): Promise<MarketPage> => {
  const raw = await requestJson("", {
    lang: query.lang,
    page: String(query.page),
    pageSize: String(query.pageSize),
    category: query.category || "",
    keyword: query.keyword || "",
  });
  if (!isRecord(raw) || !Array.isArray(raw.templates)) {
    throw new MarketError("invalidPayload");
  }

  const templates = normalizeTemplates(raw.templates);
  const total = readNonNegativeInt(raw.total) ?? templates.length;
  const page = readPositiveInt(raw.page) ?? query.page;
  const pageSize = readPositiveInt(raw.pageSize) ?? query.pageSize;

  return {
    version: readPositiveInt(raw.version) ?? 1,
    updatedAt: readString(raw.updatedAt),
    lang: readString(raw.lang) || query.lang,
    page,
    pageSize,
    total,
    hasMore: typeof raw.hasMore === "boolean" ? raw.hasMore : page * pageSize < total,
    categories: normalizeCategories(raw.categories),
    templates,
  };
};

export const fetchMarketTemplate = async (id: string): Promise<any> => {
  const raw = await requestJson(encodeURIComponent(id));
  const source =
    isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.pages)
      ? raw.data
      : raw;
  if (!isRecord(source) || !Array.isArray(source.pages) || source.pages.length === 0) {
    throw new MarketError("invalidPayload");
  }
  return source;
};

const sanitizeVariableList = (list: unknown): VariableTreeItem[] => {
  if (!Array.isArray(list)) return [];
  const used = new Set<string>();
  const result: VariableTreeItem[] = [];
  list.forEach((item) => {
    if (!isRecord(item)) return;
    const id = readString(item.id);
    if (!id || used.has(id)) return;
    used.add(id);
    const children = Array.isArray(item.children)
      ? sanitizeVariableList(item.children)
      : undefined;
    const next: Record<string, any> = {
      ...item,
      id,
      label: readString(item.label) || id,
    };
    if (children && children.length > 0) next.children = children;
    result.push(next as VariableTreeItem);
  });
  return result;
};

export const fetchMarketVariables = async (
  id: string,
): Promise<VariableTreeItem[]> => {
  try {
    const raw = await requestJson(
      `${encodeURIComponent(id)}/variables`,
    );
    const source =
      isRecord(raw) && Array.isArray(raw.variables) ? raw.variables : raw;
    return sanitizeVariableList(source);
  } catch (error) {
    // 变量文件是可选的，缺失时交给上层按页面元素推导。
    if (error instanceof MarketError && error.code === "notFound") return [];
    throw error;
  }
};

/** 列表与详情共用的缩略图地址；cover 仅支持绝对地址，否则走 {id}/cover。 */
export const buildMarketCoverUrl = (
  template: Pick<MarketTemplateSummary, "id" | "cover">,
): string => {
  const cover = template.cover?.trim();
  if (cover && /^https?:\/\//i.test(cover)) return cover;
  return resolveUrl(`${encodeURIComponent(template.id)}/cover`);
};
