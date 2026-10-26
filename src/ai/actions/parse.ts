import { extractJsonText } from "../core/normalize";

export interface AiModelOutput {
  action: string;
  args: Record<string, unknown>;
  template?: unknown;
}

/**
 * A response without an "action" field is treated as a page generation, which
 * keeps the previous contract working for models that ignore the action list.
 */
export const parseModelOutput = (raw: string): AiModelOutput => {
  const payload = JSON.parse(extractJsonText(raw));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Model output is not a JSON object");
  }

  const source = payload as Record<string, unknown>;
  const action = typeof source.action === "string" ? source.action.trim() : "";
  if (!action) {
    return { action: "generate", args: {}, template: source };
  }

  const rawArgs = source.args;
  const args =
    rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  return { action, args, template: source };
};
