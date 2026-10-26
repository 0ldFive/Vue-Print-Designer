import type { AiActionDefinition } from "./types";

const registry = new Map<string, AiActionDefinition>();

export const registerAction = (definition: AiActionDefinition) => {
  registry.set(definition.id, definition);
};

export const registerActions = (definitions: AiActionDefinition[]) => {
  definitions.forEach(registerAction);
};

export const getActionDefinition = (id: string) =>
  registry.get(String(id || "").trim()) || null;

export const listActionDefinitions = () => Array.from(registry.values());

/** Builds the action list injected into the system prompt. */
export const buildActionPrompt = () =>
  listActionDefinitions()
    .map((definition) => {
      const args = definition.params
        ? `args ${definition.params}`
        : "args none";
      const confirm = definition.destructive
        ? " (ask the user to confirm first)"
        : "";
      return `- ${definition.id}: ${definition.description} [${args}]${confirm}`;
    })
    .join("\n");

/**
 * Local fallback used only when no model is configured. The registry decides
 * which actions can be resolved offline, so no regex lives in the send flow.
 */
export const resolveLocalAction = (prompt: string) => {
  const text = String(prompt || "");
  for (const definition of listActionDefinitions()) {
    for (const pattern of definition.localPatterns || []) {
      pattern.lastIndex = 0;
      if (!pattern.test(text)) continue;
      return {
        id: definition.id,
        args: definition.parseLocal?.(text) || {},
      };
    }
  }
  return null;
};
