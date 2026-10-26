import { clampNumber, sanitizeBody, sanitizeHeaders } from "../config";
import type { AiBuiltinModel, AiBuiltinModelInput } from "../types";

const registry = new Map<string, AiBuiltinModel[]>();

const normalizeScopeId = (scopeId?: string) =>
  String(scopeId || "").trim() || "__global__";

export const normalizeBuiltinModel = (
  input: AiBuiltinModelInput | null | undefined,
): AiBuiltinModel | null => {
  const id = typeof input?.id === "string" ? input.id.trim() : "";
  const model = typeof input?.model === "string" ? input.model.trim() : "";
  const baseUrl =
    typeof input?.baseUrl === "string" ? input.baseUrl.trim() : "";
  if (!id || !model || !baseUrl) return null;

  const result: AiBuiltinModel = {
    id,
    alias: typeof input?.alias === "string" ? input.alias.trim() : "",
    model,
    baseUrl,
    headers: sanitizeHeaders(input?.headers),
    extraBody: sanitizeBody(input?.extraBody),
  };
  if (input?.temperature !== undefined) {
    result.temperature = clampNumber(input.temperature, 0, 2, 0.2);
  }
  if (input?.maxTokens !== undefined) {
    result.maxTokens = Math.round(
      clampNumber(input.maxTokens, 256, 128000, 16384),
    );
  }
  if (input?.maxInputTokens !== undefined) {
    result.maxInputTokens = Math.round(
      clampNumber(input.maxInputTokens, 1024, 1000000, 128000),
    );
  }
  if (input?.supportsVision !== undefined) {
    result.supportsVision = input.supportsVision === true;
  }
  return result;
};

/** 覆盖式写入，传空数组即清空该 scope 的内置模型。 */
export const setBuiltinModels = (
  scopeId: string | undefined,
  input: unknown,
): AiBuiltinModel[] => {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const models: AiBuiltinModel[] = [];
  list.forEach((item) => {
    const model = normalizeBuiltinModel(item as AiBuiltinModelInput);
    if (!model || seen.has(model.id)) return;
    seen.add(model.id);
    models.push(model);
  });

  const key = normalizeScopeId(scopeId);
  if (models.length > 0) registry.set(key, models);
  else registry.delete(key);
  return models;
};

export const getBuiltinModels = (scopeId?: string): AiBuiltinModel[] =>
  registry.get(normalizeScopeId(scopeId)) || [];
