import { ref } from "vue";

const AI_ENABLED_STORAGE_KEY = "print-designer-ai-enabled";
export const FEATURE_FLAGS_CHANGE_EVENT = "designer:feature-flags-change";

const readAiEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AI_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const aiEnabled = ref(readAiEnabled());

const persistAiEnabled = (enabled: boolean) => {
  aiEnabled.value = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(
    new CustomEvent(FEATURE_FLAGS_CHANGE_EVENT, { detail: { aiEnabled: enabled } }),
  );
};

export const isAiEnabled = () => aiEnabled.value;

export const setAiEnabled = (enabled: boolean) => {
  persistAiEnabled(Boolean(enabled));
};

export const useFeatureFlags = () => ({
  aiEnabled,
  setAiEnabled,
});
