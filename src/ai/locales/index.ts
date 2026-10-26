import { computed } from "vue";
import { useI18n } from "@/locales";
import de from "./de";
import en from "./en";
import ja from "./ja";
import ko from "./ko";
import zh from "./zh";
import zhHant from "./zh-Hant";
import type { ActionTextKey, AiMessages } from "./types";

export type { ActionTextKey, AiActionMessages, AiMessages } from "./types";

const FALLBACK: AiMessages = en;

const MESSAGES: Record<string, AiMessages> = {
  zh,
  "zh-Hant": zhHant,
  en,
  ja,
  ko,
  de,
};

export const useAiLocale = () => {
  const { locale } = useI18n();
  const messages = computed<AiMessages>(
    () => MESSAGES[locale.value] || FALLBACK,
  );
  return { messages, locale };
};

export const getAiMessages = (locale: string): AiMessages =>
  MESSAGES[locale] || FALLBACK;

const format = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined ? match : String(params[key]),
  );
};

/** Resolves an action feedback message in the current UI language. */
export const createActionText =
  (locale: string) =>
  (key: ActionTextKey, params?: Record<string, string | number>): string => {
    const messages = getAiMessages(locale).actionMessages;
    return format(messages[key] || FALLBACK.actionMessages[key] || key, params);
  };
