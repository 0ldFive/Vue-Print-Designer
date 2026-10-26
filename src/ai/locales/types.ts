import type { AiErrorCode } from "../core/client";
import type { AiWarningCode } from "../types";

/** Feedback messages returned by AI actions (registry-driven operations). */
export type ActionTextKey =
  | "blankTemplateName"
  | "createTemplateDone"
  | "createTemplateFailed"
  | "duplicateTemplateDone"
  | "renameTemplateDone"
  | "deleteTemplateDone"
  | "deleteTemplateConfirm"
  | "deleteTemplateFailed"
  | "switchTemplateDone"
  | "saveTemplateDone"
  | "saveTemplateAsDone"
  | "addPageDone"
  | "pageEditBlocked"
  | "deletePageDone"
  | "deletePageConfirm"
  | "deletePageFailed"
  | "duplicatePageDone"
  | "setCanvasSizeDone"
  | "setCanvasSizeFailed"
  | "importTemplateDone"
  | "generatePreviewReady"
  | "importTemplateEmpty"
  | "printStarted"
  | "exportStarted"
  | "viewJsonDone"
  | "templateNotFound"
  | "pageNotFound"
  | "singlePageOnly"
  | "cancelled"
  | "failed"
  | "unknownAction"
  | "finishDone"
  | "maxStepsReached";

export type AiActionMessages = Record<ActionTextKey, string>;

export interface AiMessages {
  title: string;
  subtitle: string;
  resize: string;
  empty: string;
  welcomeTitle: string;
  thinking: string;
  thought: string;
  hours: string;
  minutes: string;
  seconds: string;
  copy: string;
  copied: string;
  edit: string;
  deleteMessage: string;
  newChat: string;
  historyTitle: string;
  noHistory: string;
  untitledChat: string;
  messageCount: string;
  deleteChat: string;
  stepsTitle: string;
  stepRequest: string;
  stepParse: string;
  stepValidate: string;
  stepDiff: string;
  stepPreview: string;
  stepElements: string;
  stepWarnings: string;
  inputPlaceholder: string;
  send: string;
  stop: string;
  regenerate: string;
  apply: string;
  discard: string;
  applyDone: string;
  notConfigured: string;
  openSettings: string;
  settingsTitle: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelAlias: string;
  modelAliasPlaceholder: string;
  modelId: string;
  modelPlaceholder: string;
  modelFilterPlaceholder: string;
  addModel: string;
  addModelTitle: string;
  editModelTitle: string;
  removeModel: string;
  noModelMatched: string;
  builtinModels: string;
  customModels: string;
  builtinOnlyHint: string;
  inUse: string;
  actions: string;
  temperature: string;
  maxInputTokens: string;
  maxTokens: string;
  topP: string;
  seed: string;
  presencePenalty: string;
  frequencyPenalty: string;
  sectionConnection: string;
  testConnection: string;
  testing: string;
  testSuccess: string;
  testFailed: string;
  sectionAdvanced: string;
  supportsVision: string;
  forceJson: string;
  customHeaders: string;
  extraBody: string;
  invalidJson: string;
  addImage: string;
  removeImage: string;
  imageTooLarge: string;
  imageLimitReached: string;
  imageUnsupported: string;
  keyWarning: string;
  save: string;
  cancel: string;
  examples: string;
  exampleList: string[];
  summaryPages: string;
  summaryElements: string;
  summaryAdded: string;
  summaryModified: string;
  summaryRemoved: string;
  warnings: string;
  viewRaw: string;
  hideRaw: string;
  previewBar: string;
  /** 长时间没有响应时的提示，附「继续等待」按钮。 */
  slowResponseHint: string;
  continueWaiting: string;
  stopped: string;
  actionMessages: AiActionMessages;
  /** Human-readable action names used by the agent step timeline. */
  actionNames: Record<string, string>;
  errors: Record<AiErrorCode, string>;
  warningsText: Record<AiWarningCode, string>;
}
