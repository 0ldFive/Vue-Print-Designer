import type { AiConversation, AiMessage } from "../types";

const MAX_CONVERSATIONS = 20;

export const conversationsStorageKey = (scopeId: string) =>
  `print-designer-ai-conversations:${scopeId || "__global__"}`;

export const buildConversationTitle = (messages: AiMessage[]) => {
  const first = messages.find(
    (message) => message.role === "user" && message.content.trim(),
  );
  if (!first) return "";
  return first.content.trim().replace(/\s+/g, " ").slice(0, 24);
};

export const loadConversations = (scopeId: string): AiConversation[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(conversationsStorageKey(scopeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.createdAt === "number" &&
          Array.isArray(item.messages),
      )
      .map((item) => ({
        id: item.id,
        title: typeof item.title === "string" ? item.title : "",
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
        messages: item.messages as AiMessage[],
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
};

export const saveConversations = (
  scopeId: string,
  list: AiConversation[],
): AiConversation[] => {
  if (typeof localStorage === "undefined") return list;
  let next = list.slice(0, MAX_CONVERSATIONS);
  while (next.length > 0) {
    try {
      localStorage.setItem(
        conversationsStorageKey(scopeId),
        JSON.stringify(next),
      );
      return next;
    } catch {
      if (next.length === 1) break;
      next = next.slice(0, -1);
    }
  }
  try {
    localStorage.removeItem(conversationsStorageKey(scopeId));
  } catch {
    // ignore
  }
  return [];
};
