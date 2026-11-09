import { createApp } from "vue";
import { createPinia } from "pinia";
import i18n from "./locales";
import "./style.css";
import App from "./App.vue";
import { useTheme } from "./composables/useTheme";
import { expandBrandVars } from "./utils/color";
import { STORAGE_KEYS, readStoredJson } from "./utils/storage";
import { loader } from "@guolao/vue-monaco-editor";

loader.config({
  "vs/nls": {
    availableLanguages: {
      "*": "en",
    },
  },
});

const pinia = createPinia();
const app = createApp(App);

// Initialize theme
useTheme();

const applyStoredBrandVars = () => {
  const vars = readStoredJson<Record<string, string> | null>(
    STORAGE_KEYS.brandVars,
    null,
  );
  if (!vars || typeof vars !== "object") return;
  const root = document.documentElement;
  Object.entries(expandBrandVars(vars)).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

applyStoredBrandVars();

app.use(pinia);
app.use(i18n);
app.mount("#app");
