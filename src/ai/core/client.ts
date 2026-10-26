import type { AiModelProfile } from "../types";

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string | AiContentPart[];
}

export interface AiRequestOptions {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  /** 长时间没有数据返回时触发，调用 resume 可继续等待。 */
  onIdle?: (resume: () => void) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type AiErrorCode =
  | "unauthorized"
  | "notFound"
  | "rateLimited"
  | "network"
  | "timeout"
  | "aborted"
  | "emptyResponse"
  | "invalidOutput"
  | "http";

export class AiRequestError extends Error {
  code: AiErrorCode;
  status?: number;
  detail?: string;

  constructor(code: AiErrorCode, status?: number, detail?: string) {
    super(code);
    this.name = "AiRequestError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const DEFAULT_TIMEOUT_MS = 300000;

export const resolveChatEndpoint = (baseUrl: string) => {
  const trimmed = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
};

/** 开发环境下把跨域地址交给本地代理转发，避免服务端不允许浏览器直连。 */
const resolveFetchEndpoint = (endpoint: string) =>
  import.meta.env.DEV && /^https?:\/\//i.test(endpoint)
    ? `/ai-proxy?url=${encodeURIComponent(endpoint)}`
    : endpoint;

const mapStatusToCode = (status: number): AiErrorCode => {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "http";
};

/** 空响应时用于说明上游到底返回了什么，便于定位代理或压缩问题。 */
interface ReadStats {
  bytes: number;
  chunks: number;
}

const readStreamContent = async (
  response: Response,
  onDelta?: (text: string) => void,
  onReasoning?: (text: string) => void,
  onActivity?: () => void,
): Promise<{ content: string; stats: ReadStats }> => {
  const stats: ReadStats = { bytes: 0, chunks: 0 };
  const reader = response.body?.getReader();
  if (!reader) return { content: "", stats };

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta;
      const text = delta?.content;
      if (typeof text === "string" && text) {
        content += text;
        onDelta?.(text);
      }
      const reasoning = delta?.reasoning_content ?? delta?.reasoning;
      if (typeof reasoning === "string" && reasoning) {
        onReasoning?.(reasoning);
      }
    } catch {
      // Ignore partial or non-JSON chunks.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onActivity?.();
    stats.bytes += value.byteLength;
    stats.chunks += 1;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(flushLine);
  }

  buffer += decoder.decode();
  if (buffer.trim()) flushLine(buffer);

  return { content, stats };
};

const readJsonContent = async (
  response: Response,
  onReasoning?: (text: string) => void,
): Promise<{ content: string; stats: ReadStats }> => {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    // 非 JSON 响应保留原文，交给调用方诊断。
  }
  const message = (
    payload as { choices?: { message?: Record<string, unknown> }[] }
  )?.choices?.[0]?.message;
  const reasoning = message?.reasoning_content ?? message?.reasoning;
  if (typeof reasoning === "string" && reasoning) onReasoning?.(reasoning);
  return {
    content: typeof message?.content === "string" ? message.content : "",
    stats: { bytes: text.length, chunks: 1 },
  };
};

export const requestAiTemplate = async (
  profile: AiModelProfile,
  messages: AiChatMessage[],
  options: AiRequestOptions = {},
): Promise<string> => {
  const endpoint = resolveChatEndpoint(profile.baseUrl);
  if (!endpoint) {
    throw new AiRequestError("http", undefined, "missing baseUrl");
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs as number) > 0
      ? (options.timeoutMs as number)
      : DEFAULT_TIMEOUT_MS;

  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  /** 空闲超时：长时间没有数据时询问是否继续等待，而不是直接报错。 */
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (options.onIdle) {
        options.onIdle(armIdleTimer);
        return;
      }
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  };
  armIdleTimer();

  const abortListener = () => controller.abort();
  options.signal?.addEventListener("abort", abortListener);

  try {
    const response = await fetch(resolveFetchEndpoint(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.apiKey}`,
        ...profile.headers,
      },
      body: JSON.stringify({
        model: profile.model,
        messages,
        temperature: profile.temperature,
        max_tokens: profile.maxTokens,
        top_p: profile.topP,
        presence_penalty: profile.presencePenalty,
        frequency_penalty: profile.frequencyPenalty,
        ...(profile.seed !== null ? { seed: profile.seed } : {}),
        ...(profile.forceJson
          ? { response_format: { type: "json_object" } }
          : {}),
        stream: true,
        ...profile.extraBody,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 500);
      } catch {
        // ignore body read failures
      }
      throw new AiRequestError(
        mapStatusToCode(response.status),
        response.status,
        detail,
      );
    }

    const contentType = response.headers.get("content-type") || "";
    armIdleTimer();
    const { content, stats } = contentType.includes("text/event-stream")
      ? await readStreamContent(
          response,
          options.onDelta,
          options.onReasoning,
          armIdleTimer,
        )
      : await readJsonContent(response, options.onReasoning);

    if (!content.trim()) {
      throw new AiRequestError(
        "emptyResponse",
        response.status,
        `${contentType || "no-content-type"}; ${stats.bytes}B/${stats.chunks}chunks`,
      );
    }

    return content;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if (timedOut) throw new AiRequestError("timeout");
    if (options.signal?.aborted) throw new AiRequestError("aborted");
    throw new AiRequestError(
      "network",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    options.signal?.removeEventListener("abort", abortListener);
  }
};
