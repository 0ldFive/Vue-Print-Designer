import { ref, computed, watch } from "vue";
import { STORAGE_KEYS, readStored, writeStored } from "@/utils/storage";

const theme = ref<string>(readStored(STORAGE_KEYS.theme) || "system");
const systemDark = ref(
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

const mq = window.matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener?.("change", (e) => {
  systemDark.value = e.matches;
});

const isDark = computed(() => {
  if (theme.value === "dark") return true;
  if (theme.value === "light") return false;
  return systemDark.value;
});

const setTheme = (newTheme: string) => {
  theme.value = newTheme;
  writeStored(STORAGE_KEYS.theme, newTheme);
};

watch(
  isDark,
  (val) => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("dark", val);
    body.classList.toggle("dark", val);
    root.setAttribute("theme-mode", val ? "dark" : "");
    body.setAttribute("theme-mode", val ? "dark" : "");
  },
  { immediate: true },
);

export function useTheme() {
  return {
    theme,
    isDark,
    setTheme,
  };
}
