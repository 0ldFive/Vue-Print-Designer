import { defineStore } from "pinia";
import { uuidv4 } from "@/utils/uuid";
import {
  defaultAiConfig,
  loadAiConfig,
  normalizeAiConfig,
  saveAiConfig,
} from "../config";
import {
  buildConversationTitle,
  loadConversations,
  saveConversations,
} from "./conversations";
 import { getBuiltinModels } from "./builtin";
import type {
  AiAgentStep,
  AiBuiltinModel,
  AiChangeSummary,
  AiConfig,
  AiConversation,
  AiImageAttachment,
  AiMessage,
  AiModelProfile,
  AiRole,
  AiStatus,
  AiStep,
  AiStepKind,
  AiStepStatus,
  AiTemplateData,
  AiWarning,
} from "../types";

const DEFAULT_PROFILE = {
  alias: "",
  model: "",
  baseUrl: "",
  apiKey: "",
  temperature: 0.2,
  maxTokens: 16384,
  maxInputTokens: 128000,
  supportsVision: false,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  seed: null as number | null,
  forceJson: true,
  headers: {} as Record<string, string>,
  extraBody: {} as Record<string, unknown>,
};

const buildMessage = (role: AiRole, content: string): AiMessage => ({
  id: uuidv4(),
  role,
  content,
  createdAt: Date.now(),
  status: "done",
});

const MAX_STORED_REASONING = 4000;

const toStoredMessage = (message: AiMessage): AiMessage => {
  const { raw: _raw, errorDetail: _errorDetail, ...rest } = message;
  return {
    ...rest,
    status: message.status === "streaming" ? "done" : message.status,
    steps: message.steps
      ?.filter((step) => step.status !== "pending")
      .map((step): AiStep =>
        step.status === "running" ? { ...step, status: "done" } : step,
      ),
    agentSteps: message.agentSteps?.map((step) =>
      step.reasoning && step.reasoning.length > MAX_STORED_REASONING
        ? { ...step, reasoning: step.reasoning.slice(0, MAX_STORED_REASONING) }
        : step,
    ),
  };
};

export const useAiStore = defineStore("ai-template", {
  state: () => ({
    scopeId: "__global__",
    configLoaded: false,
    config: defaultAiConfig(),
    builtinModels: [] as AiBuiltinModel[],
    status: "idle" as AiStatus,
    messages: [] as AiMessage[],
    conversations: [] as AiConversation[],
    conversationsScope: "",
    conversationsLoaded: false,
    activeConversationId: "",
    candidate: null as AiTemplateData | null,
    warnings: [] as AiWarning[],
    summary: null as AiChangeSummary | null,
    error: null as string | null,
    lastRaw: "",
  }),
  actions: {
    syncConfig(scopeId?: string) {
      const next = String(scopeId || "").trim() || "__global__";
      if (this.configLoaded && this.scopeId === next) return;
      this.scopeId = next;
      this.config = loadAiConfig(next);
      this.builtinModels = getBuiltinModels(next);
      this.configLoaded = true;
    },

    syncBuiltinModels(scopeId?: string) {
      this.builtinModels = getBuiltinModels(scopeId || this.scopeId);
    },

    syncConversations(scopeId?: string) {
      const next = String(scopeId || "").trim() || "__global__";
      if (this.conversationsLoaded && this.conversationsScope === next) return;
      this.conversationsScope = next;
      this.conversations = loadConversations(next);
      this.conversationsLoaded = true;
      // 刷新后回到最近一次对话，否则历史消息看起来像被收起来了。
      if (!this.activeConversationId && this.conversations.length > 0) {
        this.openConversation(this.conversations[0].id);
      }
    },

    persistConversation() {
      const source = this.messages.filter(
        (message) => message.status !== "streaming",
      );
      if (source.length === 0) return;
      const now = Date.now();
      let conversation = this.conversations.find(
        (item) => item.id === this.activeConversationId,
      );
      if (!conversation) {
        conversation = {
          id: this.activeConversationId || uuidv4(),
          title: "",
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        this.activeConversationId = conversation.id;
        this.conversations.unshift(conversation);
      }
      conversation.messages = source.map(toStoredMessage);
      if (!conversation.title) {
        conversation.title = buildConversationTitle(source);
      }
      conversation.updatedAt = now;
      const scope = this.conversationsScope || this.scopeId;
      this.conversations = saveConversations(
        scope,
        [...this.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
      );
    },

    newConversation() {
      this.persistConversation();
      this.resetSession();
    },

    openConversation(id: string) {
      const conversation = this.conversations.find((item) => item.id === id);
      if (!conversation) return;
      this.resetSession();
      this.activeConversationId = conversation.id;
      this.messages = conversation.messages.map((message) => ({
        ...message,
        // 等待确认的状态依赖进行中的请求，重新打开时不再有效。
        awaitingContinue: false,
      }));
    },

    deleteConversation(id: string) {
      const scope = this.conversationsScope || this.scopeId;
      this.conversations = saveConversations(
        scope,
        this.conversations.filter((item) => item.id !== id),
      );
      if (this.activeConversationId === id) this.resetSession();
    },

    updateConfig(patch: Partial<AiConfig>) {
      this.config = normalizeAiConfig({ ...this.config, ...patch });
      saveAiConfig(this.scopeId, this.config);
    },

    setActiveProfile(id: string) {
      const exists =
        this.config.profiles.some((item) => item.id === id) ||
        this.builtinModels.some((item) => item.id === id);
      if (!exists) return;
      this.updateConfig({ activeId: id });
    },

    updateProfile(id: string, patch: Partial<AiModelProfile>) {
      const profiles = this.config.profiles.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      this.updateConfig({ profiles });
    },

    addProfile(profile: Partial<AiModelProfile>) {
      const next: AiModelProfile = {
        id: uuidv4(),
        alias: profile.alias?.trim() || DEFAULT_PROFILE.alias,
        model: profile.model?.trim() || DEFAULT_PROFILE.model,
        baseUrl: profile.baseUrl ?? DEFAULT_PROFILE.baseUrl,
        apiKey: profile.apiKey ?? DEFAULT_PROFILE.apiKey,
        temperature: profile.temperature ?? DEFAULT_PROFILE.temperature,
        maxTokens: profile.maxTokens ?? DEFAULT_PROFILE.maxTokens,
        maxInputTokens:
          profile.maxInputTokens ?? DEFAULT_PROFILE.maxInputTokens,
        supportsVision:
          profile.supportsVision ?? DEFAULT_PROFILE.supportsVision,
        topP: profile.topP ?? DEFAULT_PROFILE.topP,
        presencePenalty:
          profile.presencePenalty ?? DEFAULT_PROFILE.presencePenalty,
        frequencyPenalty:
          profile.frequencyPenalty ?? DEFAULT_PROFILE.frequencyPenalty,
        seed: profile.seed ?? null,
        forceJson: profile.forceJson ?? DEFAULT_PROFILE.forceJson,
        headers: profile.headers ?? {},
        extraBody: profile.extraBody ?? {},
      };
      this.updateConfig({
        profiles: [...this.config.profiles, next],
        activeId: next.id,
      });
      return next.id;
    },

    removeProfile(id: string) {
      if (this.config.profiles.length <= 1) return;
      const profiles = this.config.profiles.filter((item) => item.id !== id);
      this.updateConfig({
        profiles,
        activeId:
          this.config.activeId === id ? profiles[0].id : this.config.activeId,
      });
    },

    createMessage(
      role: AiRole,
      content: string,
      images: AiImageAttachment[] = [],
    ) {
      const message = buildMessage(role, content);
      if (images.length > 0) message.images = images;
      this.messages.push(message);
      return message.id;
    },

    updateMessage(id: string, patch: Partial<AiMessage>) {
      const message = this.messages.find((item) => item.id === id);
      if (message) Object.assign(message, patch);
    },

    removeMessage(id: string) {
      this.messages = this.messages.filter((item) => item.id !== id);
    },

    // 删除一条消息时，一并删掉它对应的回复，避免只删掉提问却留下回答。
    removeMessageWithReply(id: string) {
      const index = this.messages.findIndex((item) => item.id === id);
      if (index === -1) return;

      const target = this.messages[index];
      const next = this.messages[index + 1];
      const removeIds = new Set<string>([id]);
      if (target.role === "user" && next?.role === "assistant") {
        removeIds.add(next.id);
      }

      this.messages = this.messages.filter((item) => !removeIds.has(item.id));
    },

    setStep(id: string, kind: AiStepKind, patch: Partial<AiStep> = {}) {
      const message = this.messages.find((item) => item.id === id);
      if (!message) return;
      const steps = message.steps ? [...message.steps] : [];
      const index = steps.findIndex((step) => step.kind === kind);
      if (index >= 0) {
        steps[index] = { ...steps[index], ...patch };
      } else {
        steps.push({ kind, status: "running", ...patch });
      }
      message.steps = steps;
    },

    pushAgentStep(id: string, step: AiAgentStep) {
      const message = this.messages.find((item) => item.id === id);
      if (!message) return;
      message.agentSteps = [...(message.agentSteps || []), step];
    },

    settleSteps(id: string, status: AiStepStatus) {
      const message = this.messages.find((item) => item.id === id);
      if (!message?.steps) return;
      message.steps = message.steps
        .filter((step) => step.status !== "pending")
        .map((step) =>
          step.status === "running" ? { ...step, status } : step,
        );
    },

    resetSession() {
      this.status = "idle";
      this.messages = [];
      this.activeConversationId = "";
      this.candidate = null;
      this.warnings = [];
      this.summary = null;
      this.error = null;
      this.lastRaw = "";
    },
  },
});
