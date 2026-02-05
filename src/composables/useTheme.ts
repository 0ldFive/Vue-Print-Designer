import { ref, computed, watch } from 'vue';

const theme = ref<string>(localStorage.getItem('print-designer-theme') || 'system');
const systemDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches);

const mq = window.matchMedia('(prefers-color-scheme: dark)');
mq.addEventListener?.('change', (e) => {
  systemDark.value = e.matches;
});

const isDark = computed(() => {
  if (theme.value === 'dark') return true;
  if (theme.value === 'light') return false;
  return systemDark.value;
});

const setTheme = (newTheme: string) => {
  theme.value = newTheme;
  localStorage.setItem('print-designer-theme', newTheme);
};

// Apply theme to document
watch(isDark, (val) => {
  document.documentElement.classList.toggle('dark', val);
}, { immediate: true });

export function useTheme() {
  return {
    theme,
    isDark,
    setTheme
  };
}
