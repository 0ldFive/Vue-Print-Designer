import { computed } from "vue";
import { useI18n } from "@/locales";
import de from "./de";
import en from "./en";
import ja from "./ja";
import ko from "./ko";
import zh from "./zh";
import zhHant from "./zh-Hant";
import type { MarketMessageKey, MarketMessages } from "./types";
import type { MarketErrorCode } from "../types";

export type { MarketMessageKey, MarketMessages } from "./types";

const FALLBACK: MarketMessages = en;

const MESSAGES: Record<string, MarketMessages> = {
  zh,
  "zh-Hant": zhHant,
  en,
  ja,
  ko,
  de,
};

const ERROR_KEYS: Record<MarketErrorCode, MarketMessageKey> = {
  network: "errorNetwork",
  timeout: "errorTimeout",
  notFound: "errorNotFound",
  server: "errorServer",
  invalidPayload: "errorInvalidPayload",
};

/** 错误码 → 文案键；未知错误回退到通用错误文案。 */
export const getMarketErrorKey = (
  code: MarketErrorCode | null | undefined,
): MarketMessageKey => (code ? ERROR_KEYS[code] : "error");


const format = (
  template: string,
  params?: Record<string, string | number>,
): string => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined ? match : String(params[key]),
  );
};

export const getMarketMessages = (locale: string): MarketMessages =>
  MESSAGES[locale] || FALLBACK;

export const useMarketLocale = () => {
  const { locale } = useI18n();
  const messages = computed<MarketMessages>(
    () => MESSAGES[locale.value] || FALLBACK,
  );

  const t = (
    key: MarketMessageKey,
    params?: Record<string, string | number>,
  ): string => format(messages.value[key] || FALLBACK[key] || key, params);

  return { messages, t, locale };
};
