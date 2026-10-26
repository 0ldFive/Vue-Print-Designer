import type { useDesignerStore } from "@/stores/designer";
import type { useTemplateStore } from "@/stores/templates";
import type { AiTemplateData } from "../types";
import type { ActionTextKey } from "../locales/types";

export interface AiActionContext {
  designerStore: ReturnType<typeof useDesignerStore>;
  templateStore: ReturnType<typeof useTemplateStore>;
  text: (
    key: ActionTextKey,
    params?: Record<string, string | number>,
  ) => string;
  confirm: (message: string) => Promise<boolean>;
}

export type AiActionOutcome =
  | { kind: "message"; ok: boolean; message: string }
  | { kind: "generate" }
  | { kind: "preview"; template: AiTemplateData };

export interface AiActionDefinition {
  id: string;
  description: string;
  params?: string;
  destructive?: boolean;
  localPatterns?: RegExp[];
  parseLocal?: (text: string) => Record<string, unknown>;
  run: (
    args: Record<string, unknown>,
    ctx: AiActionContext,
  ) => Promise<AiActionOutcome>;
}
