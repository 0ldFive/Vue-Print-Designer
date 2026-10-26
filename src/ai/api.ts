import { isAiEnabled, setAiEnabled } from "@/composables/useFeatureFlags";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import cloneDeep from "lodash/cloneDeep";
import {
  activeAiProfile,
  loadAiConfig,
  normalizeAiConfig,
  saveAiConfig,
} from "./config";
import { requestAiTemplate, type AiChatMessage } from "./core/client";
import { buildSystemPrompt, buildUserMessage } from "./core/prompt";
import { normalizeTemplate } from "./core/normalize";
import { cancelPreview, commitPreview } from "./state/preview";
import { getBuiltinModels, setBuiltinModels } from "./state/builtin";
import { useAiStore } from "./state/store";
import type {
  AiBuiltinModelInput,
  AiConfig,
  AiConfigInput,
  AiGenerateResult,
} from "./types";
import { useI18n } from "@/locales";

const resolveScopeId = (scopeId?: string) => {
  if (scopeId) return scopeId;
  try {
    return useTemplateStore().crudScopeId;
  } catch {
    return "__global__";
  }
};

export const getAiConfig = (scopeId?: string): AiConfig =>
  loadAiConfig(resolveScopeId(scopeId));

export const setAiConfig = (config: AiConfigInput, scopeId?: string) => {
  const scope = resolveScopeId(scopeId);
  const next = normalizeAiConfig(config);
  saveAiConfig(scope, next);
  try {
    useAiStore().syncConfig(scope);
    useAiStore().updateConfig(next);
  } catch {
    // store is optional for headless usage
  }
  return next;
};

export { isAiEnabled, setAiEnabled };

/** 注入内置模型列表，覆盖式生效；传空数组即清空。 */
export const setAiModels = (
  models: AiBuiltinModelInput[],
  scopeId?: string,
) => {
  const scope = resolveScopeId(scopeId);
  const next = setBuiltinModels(scope, models);
  try {
    useAiStore().syncBuiltinModels(scope);
  } catch {
    // store is optional for headless usage
  }
  return next;
};

export const openAiPanel = () => {
  window.dispatchEvent(
    new CustomEvent("designer:toggle-ai-panel", { detail: { open: true } }),
  );
};

export const closeAiPanel = () => {
  window.dispatchEvent(
    new CustomEvent("designer:close-ai-panel", { detail: {} }),
  );
};

export const applyAiPreview = (): boolean => commitPreview();

export const discardAiPreview = (): void => {
  cancelPreview();
  try {
    const store = useAiStore();
    store.status = "idle";
    store.candidate = null;
    store.warnings = [];
    store.summary = null;
  } catch {
    // store is optional for headless usage
  }
};

export interface GenerateTemplateOptions {
  scopeId?: string;
  config?: AiConfigInput;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
}

export const generateTemplate = async (
  prompt: string,
  options: GenerateTemplateOptions = {},
): Promise<AiGenerateResult> => {
  const instruction = String(prompt || "").trim();
  if (!instruction) throw new Error("prompt is required");

  const designerStore = useDesignerStore();
  const config = options.config
    ? normalizeAiConfig(options.config)
    : getAiConfig(options.scopeId);

  let locale = "en";
  try {
    locale = useI18n().locale.value;
  } catch {
    // i18n is optional for headless usage
  }

  const baseline = {
    canvasSize: cloneDeep(designerStore.canvasSize),
    pages: cloneDeep(designerStore.pages),
    variables: cloneDeep(designerStore.availableVariables || []),
  };

  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        canvasSize: baseline.canvasSize,
        availableVariables: designerStore.availableVariables || [],
        locale,
        template: baseline,
      }),
    },
    { role: "user", content: buildUserMessage(instruction, baseline) },
  ];

  const profile = activeAiProfile(
    config,
    getBuiltinModels(resolveScopeId(options.scopeId)),
  );
  if (!profile) throw new Error("AI model is not configured");

  const raw = await requestAiTemplate(profile, messages, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onDelta: options.onDelta,
  });

  const { template, warnings } = normalizeTemplate(raw, {
    canvasSize: baseline.canvasSize,
    availableVariables: designerStore.availableVariables || [],
  });

  window.dispatchEvent(
    new CustomEvent("ai:generated", { detail: { template, warnings } }),
  );

  return { template, warnings, raw };
};
