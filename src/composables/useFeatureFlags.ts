import { ref } from "vue";

const AI_ENABLED_STORAGE_KEY = "print-designer-ai-enabled";
const HIDDEN_MODULES_STORAGE_KEY = "print-designer-hidden-modules";
export const FEATURE_FLAGS_CHANGE_EVENT = "designer:feature-flags-change";

/** 可整体隐藏的增值模块；隐藏后入口与设置页签都不再出现。 */
export type FeatureModule = "ai" | "market";

/** 默认开启：只有宿主持久化过 "false" 才视为关闭。 */
const readAiEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AI_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return false;
  }
};

const readHiddenModules = (): Record<string, boolean> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HIDDEN_MODULES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, boolean> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value === true) result[key] = true;
    });
    return result;
  } catch {
    return {};
  }
};

const aiEnabled = ref(readAiEnabled());
export const hiddenModules = ref<Record<string, boolean>>(readHiddenModules());

const dispatchChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FEATURE_FLAGS_CHANGE_EVENT, {
      detail: {
        aiEnabled: aiEnabled.value,
        hiddenModules: { ...hiddenModules.value },
      },
    }),
  );
};

const persistAiEnabled = (enabled: boolean) => {
  aiEnabled.value = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage failures
  }
  dispatchChange();
};

const persistHiddenModules = (next: Record<string, boolean>) => {
  hiddenModules.value = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HIDDEN_MODULES_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // ignore storage failures
  }
  dispatchChange();
};

export const isAiEnabled = () => aiEnabled.value;

export const setAiEnabled = (enabled: boolean) => {
  persistAiEnabled(Boolean(enabled));
};

/** 模块是否被宿主整体隐藏；默认 false。 */
export const isModuleHidden = (module: FeatureModule): boolean =>
  hiddenModules.value[module] === true;

/** 隐藏 / 显示某个模块，隐藏状态会持久化并在刷新后保留。 */
export const setModuleHidden = (module: FeatureModule, hidden: boolean) => {
  const next = { ...hiddenModules.value };
  if (hidden) {
    next[module] = true;
  } else {
    delete next[module];
  }
  persistHiddenModules(next);
};

export const useFeatureFlags = () => ({
  aiEnabled,
  setAiEnabled,
  hiddenModules,
  isModuleHidden,
  setModuleHidden,
});
