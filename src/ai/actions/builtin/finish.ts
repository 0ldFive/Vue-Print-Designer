import type { AiActionDefinition } from "../types";
import { readString } from "./shared";

/**
 * Terminal action: the model replies without touching the document. It keeps
 * the loop contract uniform, so every round ends with an action id.
 */
export const finishAction: AiActionDefinition = {
  id: "finish",
  description:
    "Finish the run and reply to the user. Use it when the request is already satisfied or cannot be done.",
  params: '{ "message": string }',
  run: async (args, ctx) => ({
    kind: "message",
    ok: true,
    message: readString(args.message) || ctx.text("finishDone"),
  }),
};
