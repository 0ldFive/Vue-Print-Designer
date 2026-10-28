import { defineStore } from "pinia";
import cloneDeep from "lodash/cloneDeep";
import i18n from "@/locales";
import { useTemplateStore } from "@/stores/templates";
import { toast } from "@/utils/toast";
import {
  hasMeaningfulTemplateData,
  sanitizeTemplateData,
} from "@/utils/templateData";
import { buildTestDataFromPages } from "@/utils/variables";
import type { VariableTreeItem } from "@/types";
import {
  fetchMarketPage,
  fetchMarketTemplate,
  fetchMarketVariables,
} from "./api";
import { getMarketErrorKey, getMarketMessages } from "./locales";
import {
  MarketError,
  type MarketCategory,
  type MarketErrorCode,
  type MarketTemplateSummary,
} from "./types";
import { isVersionCompatible } from "./version";

/** 未归入清单分类的模板统一归到这一项。 */
export const UNCATEGORIZED_ID = "__uncategorized__";

export type MarketLoadStatus = "idle" | "loading" | "ready" | "error";

export interface MarketDetailEntry {
  data: any;
  variables: VariableTreeItem[];
  loadedAt: number;
}

const PAGE_SIZE = 20;

const resolveErrorCode = (error: unknown): MarketErrorCode =>
  error instanceof MarketError ? error.code : "network";

const currentMessages = () => getMarketMessages(i18n.global.locale.value);

const currentLang = () => i18n.global.locale.value;

const dispatchMarketEvent = (
  name: string,
  detail: Record<string, any>,
  instanceId?: string | null,
) => {
  if (typeof window === "undefined") return;
  const payload: Record<string, any> = { ...detail };
  if (instanceId) payload.__designerInstanceId = instanceId;
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
};

/** 无 variables.json 时从页面元素自动推导变量项。 */
const deriveVariables = (pages: unknown): VariableTreeItem[] => {
  const testData = buildTestDataFromPages(
    Array.isArray(pages) ? pages : [],
  ) as Record<string, any>;
  return Object.keys(testData).map((key) => {
    const value = testData[key];
    const item: VariableTreeItem = { id: key, label: key };
    if (Array.isArray(value)) {
      item.isArray = true;
      const first = value[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        item.children = Object.keys(first).map((childKey) => ({
          id: childKey,
          label: childKey,
        }));
      }
    }
    return item;
  });
};

export const useMarketStore = defineStore("market", {
  state: () => ({
    instanceId: null as string | null,
    isOpen: false,
    categories: [] as MarketCategory[],
    items: [] as MarketTemplateSummary[],
    activeCategoryId: null as string | null,
    keyword: "",
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    /** 当前列表数据对应的语言，用于界面语言切换后重载。 */
    loadedLang: "",
    listStatus: "idle" as MarketLoadStatus,
    listError: null as MarketErrorCode | null,
    loadingMore: false,
    detailCache: {} as Record<string, MarketDetailEntry>,
    invalidIds: [] as string[],
    detailId: null as string | null,
    detailStatus: "idle" as MarketLoadStatus,
    detailError: null as MarketErrorCode | null,
    usingId: null as string | null,
    previewImage: null as { src: string; alt?: string } | null,
  }),
  getters: {
    /** 分类计数由服务端下发，不受关键词影响；这里补一个按 id 的索引。 */
    categoryCounts(state): Record<string, number> {
      const counts: Record<string, number> = {};
      state.categories.forEach((item) => {
        counts[item.id] = item.count;
      });
      return counts;
    },
    detailItem(state): MarketTemplateSummary | null {
      if (!state.detailId) return null;
      return state.items.find((item) => item.id === state.detailId) || null;
    },
    detail(state): MarketDetailEntry | null {
      if (!state.detailId) return null;
      return state.detailCache[state.detailId] || null;
    },
    /** 已加载条数，用于「加载更多（n / total）」。 */
    loadedCount(state): number {
      return state.items.length;
    },
  },
  actions: {
    setInstanceId(instanceId: string | null) {
      this.instanceId = instanceId;
    },
    async open() {
      this.isOpen = true;
      if (this.listStatus === "idle" || this.listStatus === "error") {
        await this.loadPage(1, false);
        return;
      }
      // 打开时界面语言可能已变化，需要按新语言重拉。
      if (this.loadedLang !== currentLang()) {
        await this.loadPage(1, false);
      }
    },
    close() {
      this.isOpen = false;
      this.closeDetail();
      this.closePreview();
    },
    /** 拉取一页；append 为 false 时替换现有列表。 */
    async loadPage(page: number, append: boolean) {
      const targetPage = Math.max(1, page);
      if (append) {
        if (this.loadingMore || !this.hasMore) return;
        this.loadingMore = true;
      } else {
        this.listStatus = "loading";
        this.listError = null;
      }

      const lang = currentLang();
      try {
        const result = await fetchMarketPage({
          lang,
          page: targetPage,
          pageSize: this.pageSize,
          category: this.activeCategoryId,
          keyword: this.keyword.trim(),
        });

        // 版本不兼容的条目对当前客户端不可用，二次过滤兜底。
        const incoming = result.templates.filter((item) =>
          isVersionCompatible(item.minDesignerVersion),
        );
        const nextItems = append ? [...this.items, ...incoming] : incoming;

        this.items = nextItems.filter(
          (item) => !this.invalidIds.includes(item.id),
        );
        this.categories = result.categories;
        this.page = result.page;
        this.total = result.total;
        this.hasMore = result.hasMore;
        this.loadedLang = result.lang;
        this.listStatus = "ready";

        // 清单刷新后分类可能被移除，清掉已失效的选中项。
        if (
          this.activeCategoryId &&
          this.activeCategoryId !== UNCATEGORIZED_ID &&
          !result.categories.some((item) => item.id === this.activeCategoryId)
        ) {
          this.activeCategoryId = null;
        }
      } catch (error) {
        const code = resolveErrorCode(error);
        if (append) {
          // 翻页失败保留已加载内容，只提示错误。
          toast.error(currentMessages()[getMarketErrorKey(code)]);
        } else {
          this.listStatus = "error";
          this.listError = code;
          this.items = [];
          this.categories = [];
          this.total = 0;
          this.hasMore = false;
        }
      } finally {
        if (append) this.loadingMore = false;
      }
    },
    async loadMore() {
      if (!this.hasMore || this.loadingMore) return;
      await this.loadPage(this.page + 1, true);
    },
    async reload() {
      this.page = 1;
      await this.loadPage(1, false);
    },
    async setCategory(categoryId: string | null) {
      if (this.activeCategoryId === categoryId) return;
      this.activeCategoryId = categoryId;
      await this.reload();
    },
    async setKeyword(keyword: string) {
      const next = typeof keyword === "string" ? keyword : "";
      if (this.keyword === next) return;
      this.keyword = next;
      await this.reload();
    },
    /** 详情拉取后确认不可用的模板，从当前列表移除，避免反复出现坏卡片。 */
    markInvalid(id: string) {
      if (!this.invalidIds.includes(id)) this.invalidIds.push(id);
      if (this.detailCache[id]) {
        const next = { ...this.detailCache };
        delete next[id];
        this.detailCache = next;
      }
      this.items = this.items.filter((item) => item.id !== id);
      this.total = Math.max(0, this.total - 1);
      if (this.detailId === id) this.closeDetail();
    },
    async fetchDetail(id: string): Promise<MarketDetailEntry> {
      const cached = this.detailCache[id];
      if (cached) return cached;

      const [raw, declaredVariables] = await Promise.all([
        fetchMarketTemplate(id),
        // 变量文件是可选的：缺失或解析失败都退化为按页面推导。
        fetchMarketVariables(id).catch(() => [] as VariableTreeItem[]),
      ]);
      const data = sanitizeTemplateData(raw);
      if (!hasMeaningfulTemplateData(data)) {
        throw new MarketError("invalidPayload");
      }
      const entry: MarketDetailEntry = {
        data,
        variables:
          declaredVariables.length > 0
            ? declaredVariables
            : deriveVariables(data.pages),
        loadedAt: Date.now(),
      };
      this.detailCache = { ...this.detailCache, [id]: entry };
      return entry;
    },
    async openDetail(id: string) {
      this.detailId = id;
      this.detailError = null;
      if (this.detailCache[id]) {
        this.detailStatus = "ready";
        return;
      }
      this.detailStatus = "loading";
      try {
        await this.fetchDetail(id);
        if (this.detailId === id) this.detailStatus = "ready";
      } catch (error) {
        if (this.detailId !== id) return;
        const code = resolveErrorCode(error);
        this.detailStatus = "error";
        this.detailError = code;
        // 数据损坏或资源缺失的模板不再展示；网络类错误允许重试。
        if (code === "invalidPayload" || code === "notFound") {
          toast.error(currentMessages()[getMarketErrorKey(code)]);
          this.markInvalid(id);
        }
      }
    },
    closeDetail() {
      this.detailId = null;
      this.detailStatus = "idle";
      this.detailError = null;
    },
    openPreview(src: string, alt?: string) {
      this.previewImage = src ? { src, alt } : null;
    },
    closePreview() {
      this.previewImage = null;
    },
    async useTemplate(
      id: string,
      instanceId?: string | null,
    ): Promise<{ templateId: string } | null> {
      if (this.usingId) return null;
      const item = this.items.find((entry) => entry.id === id);
      if (item && !isVersionCompatible(item.minDesignerVersion)) return null;

      const eventInstanceId = instanceId ?? this.instanceId;
      const messages = currentMessages();
      this.usingId = id;
      try {
        let entry: MarketDetailEntry;
        try {
          entry = await this.fetchDetail(id);
        } catch (error) {
          const code = resolveErrorCode(error);
          toast.error(messages[getMarketErrorKey(code)]);
          dispatchMarketEvent("market:error", { code }, eventInstanceId);
          if (code === "invalidPayload" || code === "notFound") {
            this.markInvalid(id);
          }
          return null;
        }

        const templateStore = useTemplateStore();
        const currentId = templateStore.currentTemplateId;
        const currentTemplate = currentId
          ? templateStore.templates.find((tpl) => tpl.id === currentId)
          : undefined;
        if (currentTemplate && templateStore.hasUnsavedChanges) {
          await templateStore.saveCurrentTemplate(currentTemplate.name, true);
        }

        // 列表里没有该条时（宿主直接调用），退回模板数据自带的名称。
        const templateName = item?.name || entry.data?.name || id;
        const templateId = await templateStore.createTemplate(
          templateName,
          cloneDeep(entry.data),
          undefined,
          "create",
          {
            market: {
              id,
              version: item?.version,
              source: "printdot",
              usedAt: Date.now(),
            },
          },
        );
        if (!templateId) {
          toast.error(messages.toastAddFailed);
          return null;
        }

        await templateStore.loadTemplate(templateId);
        this.isOpen = false;
        this.closeDetail();
        toast.success(messages.toastAdded);
        dispatchMarketEvent(
          "market:used",
          { marketId: id, templateId },
          eventInstanceId,
        );
        return { templateId };
      } finally {
        this.usingId = null;
      }
    },
    reset() {
      this.isOpen = false;
      this.categories = [];
      this.items = [];
      this.activeCategoryId = null;
      this.keyword = "";
      this.page = 1;
      this.total = 0;
      this.hasMore = false;
      this.loadedLang = "";
      this.listStatus = "idle";
      this.listError = null;
      this.loadingMore = false;
      this.detailCache = {};
      this.invalidIds = [];
      this.detailId = null;
      this.detailStatus = "idle";
      this.detailError = null;
      this.usingId = null;
      this.previewImage = null;
    },
  },
});
