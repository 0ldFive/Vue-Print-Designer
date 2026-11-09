/**
 * localStorage 键名注册表与安全读写助手。
 *
 * 键名集中在此声明：避免同一键在多个文件里手写字符串导致拼写漂移
 * （历史上 `print-designer-continuous-paper` 就散落在 5 个文件）。
 * 读写统一 try/catch：隐私模式、配额超限等场景失败时静默降级，
 * 不阻断主流程。
 */
export const STORAGE_KEYS = {
  language: "print-designer-language",
  theme: "print-designer-theme",
  unit: "print-designer-unit",
  autosave: "print-designer-autosave",
  templates: "print-designer-templates",
  watermark: "print-designer-watermark",
  continuousPaper: "print-designer-continuous-paper",
  customElements: "print-designer-custom-elements",
  brandVars: "print-designer-brand-vars",
  brandKey: "print-designer-brand-key",
  font: "print-designer-font-family",
  developerMode: "print-designer-developer-mode",
  paginationDebugLogs: "print-designer-pagination-debug-logs",
  renderDebugLogs: "print-designer-render-debug-logs",
  textQuickToolbar: "print-designer-show-text-quick-toolbar",
  statusBarVisible: "print-designer-show-status-bar",
  panelEdgeAutoHide: "print-designer-panel-edge-auto-hide",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const readStored = (key: StorageKey): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key: StorageKey, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 写入失败（隐私模式、配额超限）不影响当前会话
  }
};

export const removeStored = (key: StorageKey): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // 删除失败不影响当前会话
  }
};

export const readStoredBoolean = (
  key: StorageKey,
  fallback: boolean,
): boolean => {
  const stored = readStored(key);
  if (stored === null) return fallback;
  return stored === "true";
};

export const writeStoredBoolean = (key: StorageKey, value: boolean): void => {
  writeStored(key, String(Boolean(value)));
};

export const readStoredJson = <T>(key: StorageKey, fallback: T): T => {
  const stored = readStored(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
};

export const writeStoredJson = (key: StorageKey, value: unknown): void => {
  try {
    writeStored(key, JSON.stringify(value));
  } catch {
    // 序列化失败（循环引用等）时忽略，不阻断主流程
  }
};
