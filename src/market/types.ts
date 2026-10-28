import type { SupportedLanguage } from "@/locales";

/** 清单里可翻译的展示文案；服务端已按 lang 投影，前端拿到的就是目标语言。 */
export interface MarketLocalizedText {
  name?: string;
  description?: string;
  tags?: string[];
}

/** `index.json` 中每条模板附带的译文；键取 `zh / zh-Hant / en / ja / ko / de`。 */
export type MarketI18n = Partial<Record<SupportedLanguage, MarketLocalizedText>>;

export interface MarketCategory {
  id: string;
  name: string;
  /** 后端下发的 material-symbols 图标名，前端按名称解析；缺失时回退 folder。 */
  icon?: string;
  /** 该分类下模板总数，按语言全量统计，不受关键词影响。 */
  count: number;
}

export interface MarketTemplateSummary {
  id: string;
  name: string;
  category?: string;
  tags: string[];
  cover?: string;
  paper?: string;
  pages?: number;
  description?: string;
  author?: string;
  version?: string;
  minDesignerVersion?: string;
}

/** `GET /market` 的分页响应；服务端完成语言投影、筛选与切片。 */
export interface MarketPage {
  version: number;
  updatedAt?: string;
  lang: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  categories: MarketCategory[];
  templates: MarketTemplateSummary[];
}

/** 清单请求参数，空字段不参与拼接。 */
export interface MarketListQuery {
  lang: string;
  page: number;
  pageSize: number;
  category?: string | null;
  keyword?: string;
}

export type MarketErrorCode =
  | "network"
  | "timeout"
  | "notFound"
  | "server"
  | "invalidPayload";

export class MarketError extends Error {
  code: MarketErrorCode;

  constructor(code: MarketErrorCode, message?: string) {
    super(message || code);
    this.name = "MarketError";
    this.code = code;
  }
}

export interface UseTemplateResult {
  templateId: string;
}
