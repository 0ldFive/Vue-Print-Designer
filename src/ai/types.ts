import type { Page, Size, VariableTreeItem } from "@/types";

export interface AiModelProfile {
  id: string;
  alias: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  maxInputTokens: number;
  supportsVision: boolean;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed: number | null;
  forceJson: boolean;
  headers: Record<string, string>;
  extraBody: Record<string, unknown>;
}

export interface AiConfig {
  profiles: AiModelProfile[];
  activeId: string;
}

export type AiConfigInput = Partial<AiConfig> & {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  models?: string[];
  temperature?: number;
  maxTokens?: number;
};

/** 宿主注入的内置模型：不含 apiKey，仅用于对话框选择。 */
export interface AiBuiltinModel {
  id: string;
  alias: string;
  model: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
  maxInputTokens?: number;
  supportsVision?: boolean;
  headers?: Record<string, string>;
  extraBody?: Record<string, unknown>;
}

export type AiBuiltinModelInput = Partial<AiBuiltinModel>;

export type AiRole = "user" | "assistant";

export type AiMessageStatus = "streaming" | "done" | "error";

export interface AiChangeSummary {
  pages: number;
  elements: number;
  added: number;
  modified: number;
  removed: number;
}

export type AiWarningCode =
  | "unsupportedType"
  | "invalidVariable"
  | "invalidImage"
  | "truncatedPages"
  | "truncatedRows";

export interface AiWarning {
  code: AiWarningCode;
  detail?: string;
}

export type AiStepKind = "request" | "parse" | "validate" | "diff" | "preview";

export type AiStepStatus = "pending" | "running" | "done" | "warn" | "error";

export interface AiStep {
  kind: AiStepKind;
  status: AiStepStatus;
  detail?: string;
  count?: number;
}

export interface AiAgentStep {
  action: string;
  ok: boolean;
  message: string;
  /** 产生该动作的模型思考内容。 */
  reasoning?: string;
  /** 该轮思考耗时（毫秒）。 */
  reasoningMs?: number;
  /** 该轮的请求信息，如模型名与响应体积。 */
  detail?: string;
}

export interface AiMessage {
  id: string;
  role: AiRole;
  content: string;
  createdAt: number;
  status: AiMessageStatus;
  error?: string;
  errorDetail?: string;
  raw?: string;
  warnings?: AiWarning[];
  summary?: AiChangeSummary;
  images?: AiImageAttachment[];
  reasoning?: string;
  reasoningMs?: number;
  steps?: AiStep[];
  agentSteps?: AiAgentStep[];
  /** 长时间没有响应，等待用户确认是否继续等待。 */
  awaitingContinue?: boolean;
  /** 用户手动停止了本次生成。 */
  stopped?: boolean;
}

export interface AiImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiMessage[];
}

export interface AiTemplateData {
  name?: string;
  canvasSize: Size;
  pages: Page[];
  variables?: VariableTreeItem[];
}

export interface AiNormalizeContext {
  canvasSize: Size;
  availableVariables: VariableTreeItem[];
}

export interface AiNormalizeResult {
  template: AiTemplateData;
  warnings: AiWarning[];
}

export type AiStatus = "idle" | "generating" | "previewing" | "error";

export interface AiGenerateOptions {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AiGenerateResult {
  template: AiTemplateData;
  warnings: AiWarning[];
  raw: string;
}
