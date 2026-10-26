import { uuidv4 } from "@/utils/uuid";
import type {
  AiBuiltinModel,
  AiConfig,
  AiConfigInput,
  AiModelProfile,
} from "./types";

const STORAGE_PREFIX = "print-designer-ai-config";
const LEGACY_DEFAULT_MODEL = "gpt-4o-mini";

export const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

export const sanitizeHeaders = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, string> = {};
  Object.entries(input as Record<string, unknown>)
    .slice(0, 20)
    .forEach(([key, value]) => {
      const name = key.trim();
      if (!name || typeof value !== "string") return;
      result[name] = value.trim();
    });
  return result;
};

export const sanitizeBody = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return { ...(input as Record<string, unknown>) };
};

const sanitizeSeed = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
};

const sanitizeProfile = (
  input: Partial<AiModelProfile> | null | undefined,
): AiModelProfile => ({
  id:
    typeof input?.id === "string" && input.id.trim()
      ? input.id.trim()
      : uuidv4(),
  model:
    typeof input?.model === "string" && input.model.trim()
      ? input.model.trim()
      : "",
  alias: typeof input?.alias === "string" ? input.alias.trim() : "",
  baseUrl: typeof input?.baseUrl === "string" ? input.baseUrl.trim() : "",
  apiKey: typeof input?.apiKey === "string" ? input.apiKey.trim() : "",
  temperature: clampNumber(input?.temperature, 0, 2, 0.2),
  maxTokens: Math.round(clampNumber(input?.maxTokens, 256, 128000, 16384)),
  maxInputTokens: Math.round(
    clampNumber(input?.maxInputTokens, 1024, 1000000, 128000),
  ),
  supportsVision: input?.supportsVision === true,
  topP: clampNumber(input?.topP, 0, 1, 1),
  presencePenalty: clampNumber(input?.presencePenalty, -2, 2, 0),
  frequencyPenalty: clampNumber(input?.frequencyPenalty, -2, 2, 0),
  seed: sanitizeSeed(input?.seed),
  forceJson: input?.forceJson !== false,
  headers: sanitizeHeaders(input?.headers),
  extraBody: sanitizeBody(input?.extraBody),
});

export const defaultAiConfig = (): AiConfig => ({
  profiles: [],
  activeId: "",
});

const migrateLegacyProfiles = (
  input: AiConfigInput,
): Partial<AiModelProfile>[] => {
  const legacyModels = Array.isArray(input.models)
    ? input.models.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  const legacyModel =
    typeof input.model === "string" && input.model.trim()
      ? [input.model.trim()]
      : [];
  const names = legacyModels.length ? legacyModels : legacyModel;
  if (names.length === 0 && !input.baseUrl && !input.apiKey) return [];

  return names.map((model) => ({
    model,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  }));
};

export interface ResolvedAiModel {
  profile: AiModelProfile;
  source: "builtin" | "custom";
}

/** 内置模型补齐为请求所需的完整配置，始终不带 apiKey。 */
export const toRequestProfile = (model: AiBuiltinModel): AiModelProfile => ({
  id: model.id,
  alias: model.alias || "",
  model: model.model,
  baseUrl: model.baseUrl,
  apiKey: "",
  temperature: model.temperature ?? 0.2,
  maxTokens: model.maxTokens ?? 16384,
  maxInputTokens: model.maxInputTokens ?? 128000,
  supportsVision: model.supportsVision === true,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  seed: null,
  forceJson: true,
  headers: model.headers || {},
  extraBody: model.extraBody || {},
});

/** 先找内置命中的 activeId，再找自定义，最后各自取第一个。 */
export const resolveActiveModel = (
  config: AiConfig,
  builtin: AiBuiltinModel[] = [],
): ResolvedAiModel | undefined => {
  const builtinHit = builtin.find((item) => item.id === config.activeId);
  if (builtinHit) {
    return { profile: toRequestProfile(builtinHit), source: "builtin" };
  }
  const customHit = config.profiles.find((item) => item.id === config.activeId);
  if (customHit) return { profile: customHit, source: "custom" };
  if (builtin.length > 0) {
    return { profile: toRequestProfile(builtin[0]), source: "builtin" };
  }
  if (config.profiles.length > 0) {
    return { profile: config.profiles[0], source: "custom" };
  }
  return undefined;
};

export const activeAiProfile = (
  config: AiConfig,
  builtin: AiBuiltinModel[] = [],
): AiModelProfile | undefined => resolveActiveModel(config, builtin)?.profile;

export const isAiConfigReady = (
  config: AiConfig,
  builtin: AiBuiltinModel[] = [],
) => {
  const resolved = resolveActiveModel(config, builtin);
  if (!resolved) return false;
  const { profile, source } = resolved;
  if (!profile.baseUrl || !profile.model) return false;
  // 内置模型由宿主端点负责鉴权，前端不携带 apiKey。
  return source === "builtin" || Boolean(profile.apiKey);
};

export const normalizeAiConfig = (input?: AiConfigInput | null): AiConfig => {
  if (!input || typeof input !== "object") return defaultAiConfig();

  const rawProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const sourceProfiles = rawProfiles.length
    ? rawProfiles
    : migrateLegacyProfiles(input);

  const seenIds = new Set<string>();
  const profiles = sourceProfiles.map((item) => {
    const profile = sanitizeProfile(item);
    if (seenIds.has(profile.id)) profile.id = uuidv4();
    seenIds.add(profile.id);
    return profile;
  });

  // activeId 可能指向宿主注入的内置模型，这里不校验它是否存在于 profiles。
  const requestedActiveId =
    typeof input.activeId === "string" ? input.activeId.trim() : "";

  if (profiles.length === 0) {
    return { profiles: [], activeId: requestedActiveId };
  }

  return { profiles, activeId: requestedActiveId || profiles[0].id };
};

const normalizeScopeId = (scopeId?: string) =>
  String(scopeId || "").trim() || "__global__";

export const aiConfigStorageKey = (scopeId?: string) =>
  `${STORAGE_PREFIX}:${normalizeScopeId(scopeId)}`;

const isLegacyPlaceholder = (config: AiConfig) => {
  if (config.profiles.length !== 1) return false;
  const profile = config.profiles[0];
  return (
    profile.model === LEGACY_DEFAULT_MODEL &&
    !profile.baseUrl &&
    !profile.apiKey &&
    !profile.alias
  );
};

export const loadAiConfig = (scopeId?: string): AiConfig => {
  if (typeof window === "undefined") return defaultAiConfig();
  try {
    const raw = window.localStorage.getItem(aiConfigStorageKey(scopeId));
    if (!raw) return defaultAiConfig();
    const config = normalizeAiConfig(JSON.parse(raw));
    return isLegacyPlaceholder(config) ? defaultAiConfig() : config;
  } catch {
    return defaultAiConfig();
  }
};

export const saveAiConfig = (scopeId: string | undefined, config: AiConfig) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      aiConfigStorageKey(scopeId),
      JSON.stringify(normalizeAiConfig(config)),
    );
  } catch {
    // ignore storage failures
  }
};
