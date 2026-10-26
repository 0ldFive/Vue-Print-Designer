import { registerActions } from "./registry";
import { finishAction } from "./builtin/finish";
import { generateAction } from "./builtin/generate";
import { outputActions } from "./builtin/output";
import { pageActions } from "./builtin/page";
import { templateActions } from "./builtin/template";

registerActions([
  finishAction,
  generateAction,
  ...templateActions,
  ...pageActions,
  ...outputActions,
]);

export * from "./types";
export * from "./registry";
export * from "./parse";
