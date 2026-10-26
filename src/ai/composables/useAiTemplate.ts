import { computed } from "vue";
import cloneDeep from "lodash/cloneDeep";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { useI18n } from "@/locales";
import { uiConfirm } from "@/utils/confirm";
import { activeAiProfile, isAiConfigReady } from "../config";
import {
  AiRequestError,
  requestAiTemplate,
  type AiChatMessage,
} from "../core/client";
import {
  buildSystemPrompt,
  buildUserMessage,
  getPromptLanguage,
} from "../core/prompt";
import { normalizeTemplate } from "../core/normalize";
import { diffTemplates } from "../core/diff";
import {
  beginPreview,
  cancelPreview,
  commitPreview,
  dropPreview,
} from "../state/preview";
import { useAiStore } from "../state/store";
import {
  getActionDefinition,
  parseModelOutput,
  resolveLocalAction,
  type AiActionDefinition,
  type AiActionOutcome,
} from "../actions";
import { createActionText } from "../locales";
import type { ActionTextKey } from "../locales/types";
import type { AiImageAttachment, AiMessage, AiTemplateData } from "../types";

const MAX_HISTORY_MESSAGES = 6;
const IMAGE_TOKEN_ESTIMATE = 1000;
/** Upper bound of model rounds for a single request. */
const MAX_AGENT_STEPS = 4;
/** Give up after the same action fails this many times in a row. */
const MAX_SAME_ACTION_FAILURES = 2;
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g;

const estimateTokens = (text: string, imageCount = 0) => {
  const cjk = text.match(CJK_PATTERN)?.length ?? 0;
  const rest = text.length - cjk;
  return Math.ceil(cjk + rest / 4) + imageCount * IMAGE_TOKEN_ESTIMATE;
};

const trimHistory = (history: AiChatMessage[], budget: number) => {
  let total = history.reduce(
    (sum, item) =>
      sum +
      (typeof item.content === "string" ? estimateTokens(item.content) : 0),
    0,
  );

  while (history.length > 0 && total > budget) {
    const removed = history.shift();
    if (removed && typeof removed.content === "string") {
      total -= estimateTokens(removed.content);
    }
  }

  return history;
};

const buildUserContent = (
  text: string,
  images: AiImageAttachment[],
): AiChatMessage["content"] => {
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl },
    })),
  ];
};

const emitAiEvent = (name: string, detail: Record<string, any> = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const buildHistory = (
  messages: AiMessage[],
  excludeIds: Set<string>,
): AiChatMessage[] => {
  return messages
    .filter(
      (message) =>
        !excludeIds.has(message.id) &&
        message.role === "user" &&
        message.status !== "streaming",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content) as AiChatMessage[];
};

const formatObservation = (payload: {
  action: string;
  ok: boolean;
  message: string;
}) => `TOOL RESULT: ${JSON.stringify(payload)}`;

export const useAiTemplate = () => {
  const store = useAiStore();
  const designerStore = useDesignerStore();
  const templateStore = useTemplateStore();
  const { locale } = useI18n();

  let controller: AbortController | null = null;
  /** 等待用户确认是否继续等待时保存的恢复回调。 */
  let resumeIdle: (() => void) | null = null;
  /** Actions may replace the template, which must not interrupt the agent loop. */
  let actionDepth = 0;

  const isReady = computed(() =>
    isAiConfigReady(store.config, store.builtinModels),
  );
  const isGenerating = computed(() => store.status === "generating");
  const isPreviewing = computed(
    () => store.status === "previewing" && Boolean(store.candidate),
  );

  const actionText = (key: ActionTextKey, params?: Record<string, any>) =>
    createActionText(locale.value)(key, params);

  /** True when the prompt can be handled without a configured model. */
  const canHandleLocally = (text: string) =>
    Boolean(resolveLocalAction(String(text || "")));

  const buildBaseline = (): AiTemplateData => {
    if (store.candidate) return store.candidate;
    return {
      canvasSize: cloneDeep(designerStore.canvasSize),
      pages: cloneDeep(designerStore.pages),
      variables: cloneDeep(designerStore.availableVariables || []),
    };
  };

  const applyActionOutcome = (
    outcome: AiActionOutcome,
    assistantId: string,
  ): boolean => {
    if (outcome.kind === "generate") {
      // generate is executed by the caller's preview pipeline.
      store.status = store.candidate ? "previewing" : "idle";
      return false;
    }

    if (outcome.kind === "preview") {
      try {
        const baseline = buildBaseline();
        const result = normalizeTemplate(outcome.template, {
          canvasSize: designerStore.canvasSize,
          availableVariables: designerStore.availableVariables || [],
        });
        const summary = diffTemplates(baseline.pages, result.template);
        beginPreview(result.template);
        store.candidate = result.template;
        store.warnings = result.warnings;
        store.summary = summary;
        store.status = "previewing";
        store.updateMessage(assistantId, {
          status: "done",
          content: actionText("importTemplateDone"),
          warnings: result.warnings,
          summary,
          steps: [],
        });
        store.persistConversation();
        return true;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        store.updateMessage(assistantId, {
          status: "done",
          content: actionText("failed", { reason }),
          steps: [],
        });
        store.status = "idle";
        store.persistConversation();
        return false;
      }
    }

    store.updateMessage(assistantId, {
      status: "done",
      content: outcome.message,
      steps: [],
    });
    store.status = "idle";
    store.persistConversation();
    return outcome.ok;
  };

  /**
   * Executes one action and reports the result without touching the assistant
   * message, so the agent loop can feed it back as an observation.
   */
  const runActionStep = async (
    definition: AiActionDefinition,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; message: string; outcome: AiActionOutcome }> => {
    // An action edits the document directly, so any pending preview must be
    // dropped first; otherwise committing it later would overwrite the action.
    if (store.candidate || store.status === "previewing") discard();

    const text = createActionText(locale.value);
    store.status = "generating";

    let outcome: AiActionOutcome;
    actionDepth += 1;
    try {
      outcome = await definition.run(args, {
        designerStore,
        templateStore,
        text,
        confirm: (message) => uiConfirm.show(message),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      outcome = {
        kind: "message",
        ok: false,
        message: text("failed", { reason }),
      };
    } finally {
      actionDepth -= 1;
    }

    if (outcome.kind === "message") {
      return { ok: outcome.ok, message: outcome.message, outcome };
    }
    return { ok: true, message: "", outcome };
  };

  const runAction = async (
    definition: AiActionDefinition,
    args: Record<string, unknown>,
    assistantId: string,
  ): Promise<boolean> => {
    const result = await runActionStep(definition, args);
    if (result.outcome.kind === "generate") {
      store.status = store.candidate ? "previewing" : "idle";
      return false;
    }
    return applyActionOutcome(result.outcome, assistantId);
  };

  const send = async (
    instruction: string,
    options: {
      excludeUserMessageId?: string;
      appendUserMessage?: boolean;
      images?: AiImageAttachment[];
    } = {},
  ): Promise<boolean> => {
    const prompt = String(instruction || "").trim();
    if (!prompt || store.status === "generating") return false;

    const images = options.images ?? [];

    // Without a model only the locally resolvable actions (declared in the
    // registry) can run, e.g. creating a blank template.
    if (!isAiConfigReady(store.config, store.builtinModels)) {
      const local = resolveLocalAction(prompt);
      const localDefinition = local ? getActionDefinition(local.id) : null;
      if (!local || !localDefinition) return false;

      if (options.appendUserMessage !== false) {
        store.createMessage("user", prompt, images);
      }
      const assistantId = store.createMessage("assistant", "");
      return runAction(localDefinition, local.args, assistantId);
    }

    const profile = activeAiProfile(store.config, store.builtinModels);
    if (!profile) return false;

    store.error = null;
    if (options.appendUserMessage !== false) {
      store.createMessage("user", prompt, images);
    }
    const assistantId = store.createMessage("assistant", "");
    store.updateMessage(assistantId, { status: "streaming" });
    store.setStep(assistantId, "request", {
      status: "running",
      detail: profile.alias || profile.model,
    });
    store.status = "generating";

    const baseline = buildBaseline();
    const excludeIds = new Set<string>([assistantId]);
    if (options.excludeUserMessageId) {
      excludeIds.add(options.excludeUserMessageId);
    }

    const systemPrompt = buildSystemPrompt({
      canvasSize: baseline.canvasSize,
      availableVariables: designerStore.availableVariables || [],
      locale: locale.value,
      template: baseline,
      hasImages: images.length > 0,
    });
    const language = getPromptLanguage(locale.value);
    const currentText = buildUserMessage(prompt, baseline, language);
    const budget =
      Math.max(1024, profile.maxInputTokens) -
      estimateTokens(systemPrompt) -
      estimateTokens(currentText, images.length);
    const history = trimHistory(
      buildHistory(store.messages, excludeIds),
      budget,
    );

    const describeState = () => {
      const pages = designerStore.pages;
      const elements = pages.reduce(
        (total, page) => total + page.elements.length,
        0,
      );
      return `CURRENT STATE: canvas ${designerStore.canvasSize.width}x${designerStore.canvasSize.height}, pages ${pages.length}, elements ${elements}`;
    };

    // The loop keeps one growing conversation: the model's previous decision is
    // echoed back as an assistant turn, followed by the action result. This is
    // closer to the chat protocol than re-sending the whole template each round.
    const conversation: AiChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: buildUserContent(currentText, images) },
    ];

    const modelLabel = profile.alias || profile.model;
    const startedAt = Date.now();
    let lastRaw = "";
    let observation = "";
    let failedAction = "";
    let failedCount = 0;

    let awaitingNotice = false;

    const clearIdleNotice = () => {
      if (!awaitingNotice) return;
      awaitingNotice = false;
      resumeIdle = null;
      store.updateMessage(assistantId, { awaitingContinue: false });
    };

    const finishRun = (content: string, ok: boolean): boolean => {
      awaitingNotice = false;
      resumeIdle = null;
      store.settleSteps(assistantId, "done");
      store.updateMessage(assistantId, {
        status: "done",
        content,
        raw: lastRaw,
        reasoningMs: Date.now() - startedAt,
        awaitingContinue: false,
      });
      store.status = "idle";
      return ok;
    };

    controller = new AbortController();

    try {
      for (let step = 1; step <= MAX_AGENT_STEPS; step += 1) {
        const messages = conversation.slice();

        let rawBuffer = "";
        let reasoningBuffer = "";
        let roundStartedAt = Date.now();
        const roundName =
          step === 1 ? modelLabel : `${modelLabel} · step ${step}`;
        let roundDetail = `${roundName} · 0 KB`;
        let lastProgressAt = 0;

        // 每轮的思考会挂到对应动作上，这里只保留当前轮的实时预览。
        store.updateMessage(assistantId, { reasoning: undefined });

        store.setStep(assistantId, "request", {
          status: "running",
          detail: roundDetail,
        });

        /** 按已收到的字符数刷新体积计数，思考与正文都计入。 */
        const reportProgress = (bytes: number) => {
          const now = Date.now();
          if (now - lastProgressAt < 150) return;
          lastProgressAt = now;
          const kb = Math.max(1, Math.round(bytes / 1024));
          roundDetail = `${roundName} · ${kb} KB`;
          store.setStep(assistantId, "request", { detail: roundDetail });
        };

        const requestRound = () =>
          requestAiTemplate(profile, messages, {
            signal: controller!.signal,
            onIdle: (resume) => {
              awaitingNotice = true;
              resumeIdle = () => {
                resume();
                clearIdleNotice();
              };
              store.updateMessage(assistantId, { awaitingContinue: true });
            },
            onDelta: (delta) => {
              clearIdleNotice();
              rawBuffer += delta;
              store.updateMessage(assistantId, { raw: rawBuffer });
              reportProgress(rawBuffer.length);
            },
            onReasoning: (delta) => {
              clearIdleNotice();
              reasoningBuffer += delta;
              store.updateMessage(assistantId, { reasoning: reasoningBuffer });
              reportProgress(reasoningBuffer.length);
            },
          });

        let raw: string;
        try {
          raw = await requestRound();
        } catch (error) {
          // A follow-up round occasionally comes back empty; retry once before
          // reporting it as a failure.
          if (
            error instanceof AiRequestError &&
            error.code === "emptyResponse" &&
            !controller?.signal.aborted
          ) {
            rawBuffer = "";
            reasoningBuffer = "";
            roundStartedAt = Date.now();
            raw = await requestRound();
          } else {
            throw error;
          }
        }

        lastRaw = raw;
        store.setStep(assistantId, "request", { status: "done" });

        let output: ReturnType<typeof parseModelOutput>;
        try {
          output = parseModelOutput(raw);
        } catch (error) {
          // 模型输出被截断或不是合法 JSON，单独报错，避免误报为「没有内容」。
          const detail = error instanceof Error ? error.message : String(error);
          throw new AiRequestError("invalidOutput", undefined, detail);
        }
        const definition = getActionDefinition(output.action);

        if (!definition) {
          const message = actionText("unknownAction", { id: output.action });
          store.pushAgentStep(assistantId, {
            action: output.action,
            ok: false,
            message,
            reasoning: reasoningBuffer,
            reasoningMs: Date.now() - roundStartedAt,
            detail: roundDetail,
          });
          failedCount = failedAction === output.action ? failedCount + 1 : 1;
          failedAction = output.action;
          if (failedCount >= MAX_SAME_ACTION_FAILURES) {
            return finishRun(message, false);
          }
          observation = formatObservation({
            action: output.action,
            ok: false,
            message,
          });
          conversation.push({ role: "assistant", content: raw });
          conversation.push({
            role: "user",
            content: `${observation}\n\n${describeState()}\n\nReply in ${language}. Return the next step as a JSON object, for example {"action":"finish","args":{"message":"done"}}.`,
          });
          continue;
        }

        if (definition.id === "generate") {
          store.setStep(assistantId, "parse", { status: "running" });
          const result = normalizeTemplate(output.template ?? raw, {
            canvasSize: designerStore.canvasSize,
            availableVariables: designerStore.availableVariables || [],
          });

          const elementCount = result.template.pages.reduce(
            (total, page) => total + page.elements.length,
            0,
          );
          // An explicit blank template has no elements but still has a page;
          // only a response without any usable page counts as empty.
          if (result.template.pages.length === 0) {
            throw new AiRequestError("emptyResponse");
          }

          store.setStep(assistantId, "parse", {
            status: "done",
            count: elementCount,
          });
          store.setStep(assistantId, "validate", {
            status: result.warnings.length > 0 ? "warn" : "done",
            count: result.warnings.length || undefined,
          });

          const summary = diffTemplates(buildBaseline().pages, result.template);
          store.setStep(assistantId, "diff", {
            status: "done",
            detail: `+${summary.added} ~${summary.modified} -${summary.removed}`,
          });
          beginPreview(result.template);
          store.setStep(assistantId, "preview", { status: "done" });
          store.pushAgentStep(assistantId, {
            action: "generate",
            ok: true,
            message: actionText("generatePreviewReady"),
            reasoning: reasoningBuffer,
            reasoningMs: Date.now() - roundStartedAt,
            detail: roundDetail,
          });

          store.candidate = result.template;
          store.warnings = result.warnings;
          store.summary = summary;
          store.lastRaw = raw;
          store.status = "previewing";
          store.updateMessage(assistantId, {
            status: "done",
            raw,
            warnings: result.warnings,
            summary,
            reasoningMs: Date.now() - startedAt,
          });

          emitAiEvent("ai:generated", {
            template: result.template,
            warnings: result.warnings,
            summary,
          });
          return true;
        }

        if (definition.id === "finish") {
          const result = await runActionStep(definition, output.args);
          store.pushAgentStep(assistantId, {
            action: definition.id,
            ok: true,
            message: result.message,
            reasoning: reasoningBuffer,
            reasoningMs: Date.now() - roundStartedAt,
            detail: roundDetail,
          });
          return finishRun(result.message, true);
        }

        const result = await runActionStep(definition, output.args);

        if (result.outcome.kind === "preview") {
          store.pushAgentStep(assistantId, {
            action: definition.id,
            ok: true,
            message: actionText("importTemplateDone"),
            reasoning: reasoningBuffer,
            reasoningMs: Date.now() - roundStartedAt,
            detail: roundDetail,
          });
          return applyActionOutcome(result.outcome, assistantId);
        }

        store.pushAgentStep(assistantId, {
          action: definition.id,
          ok: result.ok,
          message: result.message,
          reasoning: reasoningBuffer,
          reasoningMs: Date.now() - roundStartedAt,
          detail: roundDetail,
        });

        if (result.ok) {
          failedAction = "";
          failedCount = 0;
        } else {
          failedCount = failedAction === definition.id ? failedCount + 1 : 1;
          failedAction = definition.id;
          if (failedCount >= MAX_SAME_ACTION_FAILURES) {
            return finishRun(result.message, false);
          }
        }

        observation = formatObservation({
          action: definition.id,
          ok: result.ok,
          message: result.message,
        });
        conversation.push({ role: "assistant", content: raw });
        conversation.push({
          role: "user",
          content: `${observation}\n\n${describeState()}\n\nReply in ${language}. Return the next step as a JSON object, for example {"action":"finish","args":{"message":"done"}}.`,
        });
      }

      return finishRun(
        actionText("maxStepsReached", { count: MAX_AGENT_STEPS }),
        false,
      );
    } catch (error) {
      if (error instanceof AiRequestError && error.code === "aborted") {
        store.settleSteps(assistantId, "done");
        store.updateMessage(assistantId, {
          status: "done",
          raw: lastRaw,
          reasoningMs: Date.now() - startedAt,
          awaitingContinue: false,
          stopped: true,
        });
        store.status = store.candidate ? "previewing" : "idle";
        return false;
      }

      store.settleSteps(assistantId, "error");
      const code =
        error instanceof AiRequestError ? error.code : "emptyResponse";
      const detail =
        error instanceof AiRequestError
          ? error.detail
          : error instanceof Error
            ? error.message
            : String(error);

      store.error = code;
      store.updateMessage(assistantId, {
        status: "error",
        error: code,
        errorDetail: detail,
        raw: lastRaw,
        reasoningMs: Date.now() - startedAt,
        awaitingContinue: false,
      });
      store.status = store.candidate ? "previewing" : "error";

      emitAiEvent("ai:error", { code, detail });
      return false;
    } finally {
      controller = null;
      store.persistConversation();
    }
  };

  const regenerate = async (): Promise<boolean> => {
    // Re-generating must start from the original document, not from the
    // pending preview, otherwise the model echoes the candidate back and the
    // diff is always 0.
    if (store.status === "previewing") discard();

    const lastUserMessage = [...store.messages]
      .reverse()
      .find((message) => message.role === "user" && message.content.trim());
    if (!lastUserMessage) return false;

    const lastAssistant = [...store.messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (lastAssistant) {
      store.messages = store.messages.filter(
        (message) => message.id !== lastAssistant.id,
      );
    }

    return send(lastUserMessage.content, {
      excludeUserMessageId: lastUserMessage.id,
      appendUserMessage: false,
      images: lastUserMessage.images ?? [],
    });
  };

  const abort = () => {
    controller?.abort();
  };

  /** 用户确认继续等待：重新开始空闲计时。 */
  const continueWaiting = () => {
    resumeIdle?.();
  };

  const apply = (): boolean => {
    if (!store.candidate) return false;
    const changed = commitPreview();
    store.status = "idle";
    store.candidate = null;
    store.warnings = [];
    store.summary = null;
    if (changed) {
      emitAiEvent("ai:applied", {});
      // 应用即落盘：画布内容刚被确认，不应停留在未保存状态。
      const target = templateStore.templates.find(
        (item) => item.id === templateStore.currentTemplateId,
      );
      if (target) void templateStore.saveCurrentTemplate(target.name, true);
    }
    return changed;
  };

  const discard = () => {
    if (store.candidate || store.status === "previewing") {
      cancelPreview();
    }
    store.status = "idle";
    store.candidate = null;
    store.warnings = [];
    store.summary = null;
    store.error = null;
  };

  /**
   * The document was replaced (template switch / AI action). Pending preview is
   * no longer valid, but the panel and the conversation stay intact so the user
   * can keep talking about the new template.
   */
  const resetForTemplateSwitch = () => {
    // A template replaced by one of our own actions is part of the running
    // loop, so only a user-driven switch may cancel the request.
    if (actionDepth === 0) {
      controller?.abort();
      controller = null;
    }
    dropPreview();
    // Keep the running loop marked as generating; a user-driven switch means
    // no request is in flight any more.
    if (actionDepth === 0) store.status = "idle";
    store.candidate = null;
    store.warnings = [];
    store.summary = null;
    store.error = null;
    store.persistConversation();
  };

  const reset = (options: { restore?: boolean } = {}) => {
    controller?.abort();
    controller = null;
    if (options.restore === false) {
      dropPreview();
    } else {
      cancelPreview();
    }
    store.resetSession();
  };

  return {
    store,
    isReady,
    isGenerating,
    isPreviewing,
    canHandleLocally,
    send,
    regenerate,
    abort,
    continueWaiting,
    apply,
    discard,
    resetForTemplateSwitch,
    reset,
  };
};
