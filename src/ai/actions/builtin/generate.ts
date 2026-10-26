import type { AiActionDefinition } from "../types";

/**
 * The default action. Its work is the existing normalize → diff → preview
 * pipeline in useAiTemplate, so run() only signals the caller to take that
 * path instead of executing a store operation.
 */
export const generateAction: AiActionDefinition = {
  id: "generate",
  description:
    'Create or edit the page content of the current template. Return the template JSON directly (canvasSize, variables, pages) with no action field. Never use it for a "new template" request: call create_template first, then return the JSON in the next round.',
  params: "the template JSON itself",
  run: async () => ({ kind: "generate" }),
};
