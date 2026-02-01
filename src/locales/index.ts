import { createI18n } from 'vue-i18n';
import en from './en';
import zh from './zh';

const messages = {
  en,
  zh,
};

// Detect browser language
const getBrowserLanguage = () => {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) {
    return 'zh';
  }
  return 'en'; // Default to English for other languages
};

const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getBrowserLanguage(),
  fallbackLocale: 'en',
  messages,
});

export default i18n;
