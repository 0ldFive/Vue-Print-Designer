<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@/composables/useTheme';
import { useAutoSave } from '@/composables/useAutoSave';
import { usePrintSettings } from '@/composables/usePrintSettings';
import { useDesignerStore } from '@/stores/designer';
import ColorPicker from '@/components/common/ColorPicker.vue';
import { parseColor, hsvToRgb } from '@/utils/color';
import X from '~icons/material-symbols/close';
import SettingsIcon from '~icons/material-symbols/settings';
import TranslateIcon from '~icons/material-symbols/translate';
import PrintIcon from '~icons/material-symbols/print';
import CloudIcon from '~icons/material-symbols/cloud';
import LinkIcon from '~icons/material-symbols/link';
import LinkOffIcon from '~icons/material-symbols/link-off';

const props = defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>();

const { t, locale } = useI18n();
const { theme: selectedTheme, setTheme } = useTheme();
const { autoSave } = useAutoSave();
const designerStore = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));
const {
  printMode,
  silentPrint,
  exportImageMerged,
  localSettings,
  remoteSettings,
  localStatus,
  remoteStatus,
  localRetryCount,
  remoteRetryCount,
  remoteClients,
  remoteSelectedClientId,
  localWsUrl,
  remoteWsUrl,
  cancelLocalRetry,
  cancelRemoteRetry,
  connectLocal,
  disconnectLocal,
  connectRemote,
  disconnectRemote,
  fetchRemoteClients
} = usePrintSettings();

const activeTab = ref<'basic' | 'language' | 'local' | 'remote'>('basic');
const selectedLang = ref<string>(locale.value as string);
const selectedBrandKey = ref<string>(localStorage.getItem('print-designer-brand-key') || 'default');
const customBrandHex = ref<string>(localStorage.getItem('print-designer-brand-custom-hex') || '#3b82f6');
const localStatusValue = computed(() => localStatus.value || 'disconnected');
const remoteStatusValue = computed(() => remoteStatus.value || 'disconnected');
const localRetryCountValue = computed(() => localRetryCount.value || 0);
const remoteRetryCountValue = computed(() => remoteRetryCount.value || 0);
const remoteClientsSafe = computed(() => remoteClients.value || []);
const localConnected = computed(() => localStatusValue.value === 'connected');
const remoteConnected = computed(() => remoteStatusValue.value === 'connected');
const localConnecting = computed(() => localStatusValue.value === 'connecting');
const remoteConnecting = computed(() => remoteStatusValue.value === 'connecting');
const localHasConfig = computed(() => Boolean(localSettings.wsAddress));
const remoteHasConfig = computed(() => Boolean(remoteSettings.apiBaseUrl && remoteSettings.username && remoteSettings.password));

const localButtonLabel = computed(() => {
  return localConnected.value ? t('settings.status.connected') : t('settings.status.disconnected');
});

const remoteButtonLabel = computed(() => {
  return remoteConnected.value ? t('settings.status.connected') : t('settings.status.disconnected');
});

const connectionButtonClass = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
  if (status === 'connected') return 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600';
  return 'bg-transparent text-blue-600 border border-blue-600 hover:bg-blue-50';
};

const clamp = (value: number, min = 0, max = 255) => Math.min(Math.max(value, min), max);

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) => clamp(Math.round(v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixRgb = (base: { r: number; g: number; b: number }, mix: { r: number; g: number; b: number }, ratio: number) => ({
  r: base.r + (mix.r - base.r) * ratio,
  g: base.g + (mix.g - base.g) * ratio,
  b: base.b + (mix.b - base.b) * ratio
});

const buildScaleFromHex = (hex: string) => {
  const parsed = parseColor(hex);
  if (!parsed) return null;
  const baseRgb = hsvToRgb(parsed.h, parsed.s, parsed.v);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const c50 = mixRgb(baseRgb, white, 0.92);
  const c100 = mixRgb(baseRgb, white, 0.84);
  const c200 = mixRgb(baseRgb, white, 0.68);
  const c300 = mixRgb(baseRgb, white, 0.5);
  const c400 = mixRgb(baseRgb, white, 0.32);
  const c500 = mixRgb(baseRgb, white, 0.16);
  const c700 = mixRgb(baseRgb, black, 0.12);
  const c800 = mixRgb(baseRgb, black, 0.24);
  const c900 = mixRgb(baseRgb, black, 0.36);
  const c950 = mixRgb(baseRgb, black, 0.5);

  return {
    '--brand-50': rgbToHex(c50.r, c50.g, c50.b),
    '--brand-100': rgbToHex(c100.r, c100.g, c100.b),
    '--brand-200': rgbToHex(c200.r, c200.g, c200.b),
    '--brand-300': rgbToHex(c300.r, c300.g, c300.b),
    '--brand-400': rgbToHex(c400.r, c400.g, c400.b),
    '--brand-500': rgbToHex(c500.r, c500.g, c500.b),
    '--brand-600': rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b),
    '--brand-700': rgbToHex(c700.r, c700.g, c700.b),
    '--brand-800': rgbToHex(c800.r, c800.g, c800.b),
    '--brand-900': rgbToHex(c900.r, c900.g, c900.b),
    '--brand-950': rgbToHex(c950.r, c950.g, c950.b)
  };
};

const customBrandVars = computed<Record<string, string>>(() => buildScaleFromHex(customBrandHex.value) || {});

const brandPresets = computed(() => [
  {
    key: 'default',
    labelKey: 'settings.themePresetDefault',
    colors: {
      '--brand-50': '#eff6ff',
      '--brand-100': '#dbeafe',
      '--brand-200': '#bfdbfe',
      '--brand-300': '#93c5fd',
      '--brand-400': '#60a5fa',
      '--brand-500': '#3b82f6',
      '--brand-600': '#2563eb',
      '--brand-700': '#1d4ed8',
      '--brand-800': '#1e40af',
      '--brand-900': '#1e3a8a',
      '--brand-950': '#172554'
    }
  },
  {
    key: 'emerald',
    labelKey: 'settings.themePresetEmerald',
    colors: {
      '--brand-50': '#ecfdf5',
      '--brand-100': '#d1fae5',
      '--brand-200': '#a7f3d0',
      '--brand-300': '#6ee7b7',
      '--brand-400': '#34d399',
      '--brand-500': '#10b981',
      '--brand-600': '#059669',
      '--brand-700': '#047857',
      '--brand-800': '#065f46',
      '--brand-900': '#064e3b',
      '--brand-950': '#022c22'
    }
  },
  {
    key: 'amber',
    labelKey: 'settings.themePresetAmber',
    colors: {
      '--brand-50': '#fffbeb',
      '--brand-100': '#fef3c7',
      '--brand-200': '#fde68a',
      '--brand-300': '#fcd34d',
      '--brand-400': '#fbbf24',
      '--brand-500': '#f59e0b',
      '--brand-600': '#d97706',
      '--brand-700': '#b45309',
      '--brand-800': '#92400e',
      '--brand-900': '#78350f',
      '--brand-950': '#451a03'
    }
  },
  {
    key: 'rose',
    labelKey: 'settings.themePresetRose',
    colors: {
      '--brand-50': '#fff1f2',
      '--brand-100': '#ffe4e6',
      '--brand-200': '#fecdd3',
      '--brand-300': '#fda4af',
      '--brand-400': '#fb7185',
      '--brand-500': '#f43f5e',
      '--brand-600': '#e11d48',
      '--brand-700': '#be123c',
      '--brand-800': '#9f1239',
      '--brand-900': '#881337',
      '--brand-950': '#4c0519'
    }
  },
  {
    key: 'custom',
    labelKey: 'settings.themePresetCustom',
    colors: customBrandVars.value
  }
]);

const applyBrandVars = (vars: Record<string, string>) => {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  window.dispatchEvent(new CustomEvent('brand-theme-updated'));
};

const persistBrandVars = (vars: Record<string, string>) => {
  localStorage.setItem('print-designer-brand-vars', JSON.stringify(vars));
};

const applyBrandPreset = (presetKey: string) => {
  const preset = brandPresets.value.find(p => p.key === presetKey) || brandPresets.value[0];
  if (!preset.colors) return;
  applyBrandVars(preset.colors);
  persistBrandVars(preset.colors);
  localStorage.setItem('print-designer-brand-key', preset.key);
};

const loadStoredBrandVars = () => {
  const stored = localStorage.getItem('print-designer-brand-vars');
  if (!stored) return;
  try {
    const vars = JSON.parse(stored) as Record<string, string>;
    if (vars && typeof vars === 'object') {
      applyBrandVars(vars);
    }
  } catch {
    // Ignore invalid storage
  }
};

loadStoredBrandVars();

const handleLocalConnection = async () => {
  try {
    if (localConnecting.value) return;
    if (localConnected.value) {
      disconnectLocal();
      return;
    }
    await connectLocal();
  } catch (error) {
    console.error('Local connection error:', error);
  }
};

const handleRemoteConnection = async () => {
  try {
    if (remoteConnecting.value) return;
    if (remoteConnected.value) {
      disconnectRemote();
      return;
    }
    await connectRemote();
  } catch (error) {
    console.error('Remote connection error:', error);
  }
};

watch(selectedLang, (val) => {
  locale.value = val;
  localStorage.setItem('print-designer-language', val);
});

watch(locale, (val) => {
  if (selectedLang.value !== val) {
    selectedLang.value = val as string;
  }
});

watch(selectedTheme, (val) => {
  setTheme(val);
});

watch(() => props.show, (val) => {
  designerStore.setDisableGlobalShortcuts(val);
});

watch(customBrandHex, (val) => {
  if (!val) return;
  localStorage.setItem('print-designer-brand-custom-hex', val);
  if (selectedBrandKey.value === 'custom') {
    applyBrandPreset('custom');
  }
});

watch(selectedBrandKey, (val) => {
  applyBrandPreset(val);
}, { immediate: true });

watch([activeTab, remoteStatus], ([tab, status]) => {
  if (tab !== 'remote' || status !== 'connected') return;
  fetchRemoteClients();
});

const close = () => {
  try {
    emit('update:show', false);
  } catch (error) {
    console.error('Error closing modal:', error);
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  try {
    if (!props.show) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  } catch (error) {
    console.error('Error in keydown handler:', error);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (props.show) {
    designerStore.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto" @click.self="close">
      <div class="bg-white rounded-lg shadow-xl w-[700px] max-w-full h-[500px] flex overflow-hidden">
        <!-- Sidebar Tabs -->
        <div class="w-48 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div class="h-[60px] flex items-center px-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">{{ t('settings.title') }}</h3>
          </div>
          <div class="flex-1 py-2">
            <button
              @click="activeTab = 'basic'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'basic' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <SettingsIcon class="w-5 h-5" />
              {{ t('settings.basic') }}
            </button>
            <button
              @click="activeTab = 'language'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'language' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <TranslateIcon class="w-5 h-5" />
              {{ t('settings.language') }}
            </button>
            <button
              @click="activeTab = 'local'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'local' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <PrintIcon class="w-5 h-5" />
              {{ t('settings.localConnection') }}
            </button>
            <button
              @click="activeTab = 'remote'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'remote' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <CloudIcon class="w-5 h-5" />
              {{ t('settings.remoteConnection') }}
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col min-w-0 relative">
          <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ 
                activeTab === 'basic' ? t('settings.basic') :
                activeTab === 'language' ? t('settings.language') :
                activeTab === 'local' ? t('settings.localConnection') :
                t('settings.remoteConnection')
              }}
            </h3>
            <button @click="close" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Basic Tab -->
            <div v-if="activeTab === 'basic'" class="space-y-4 text-sm text-gray-700">
              <div>
                <div class="mb-2 font-medium text-gray-900">{{ t('settings.theme') }}</div>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer" :class="selectedTheme === 'system' ? 'border-blue-600 text-blue-700' : 'border-gray-300'">
                    <input type="radio" value="system" v-model="selectedTheme" />
                    <span>{{ t('settings.themeSystem') }}</span>
                  </label>
                  <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer" :class="selectedTheme === 'light' ? 'border-blue-600 text-blue-700' : 'border-gray-300'">
                    <input type="radio" value="light" v-model="selectedTheme" />
                    <span>{{ t('settings.themeLight') }}</span>
                  </label>
                  <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer" :class="selectedTheme === 'dark' ? 'border-blue-600 text-blue-700' : 'border-gray-300'">
                    <input type="radio" value="dark" v-model="selectedTheme" />
                    <span>{{ t('settings.themeDark') }}</span>
                  </label>
                </div>
                <p class="text-xs text-gray-500 mt-2">{{ t('settings.themeDesc') }}</p>
              </div>

              <div class="border-t border-gray-200 pt-4">
                <div class="mb-2 font-medium text-gray-900">{{ t('settings.themeColor') }}</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="preset in brandPresets.filter(p => p.key !== 'custom')"
                    :key="preset.key"
                    type="button"
                    class="flex items-center gap-2 px-3 py-2 border rounded text-xs transition-colors"
                    :class="selectedBrandKey === preset.key ? 'border-blue-600 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'"
                    @click="selectedBrandKey = preset.key"
                  >
                    <span class="inline-block w-3.5 h-3.5 rounded-full" :style="{ backgroundColor: preset.colors['--brand-600'] }"></span>
                    <span>{{ t(preset.labelKey) }}</span>
                  </button>

                  <ColorPicker
                    :model-value="customBrandHex"
                    @update:model-value="(val) => { if (val) { customBrandHex = val; selectedBrandKey = 'custom'; } }"
                    :default-color="customBrandHex"
                    :teleport-to-body="true"
                  >
                    <template #trigger="{ color, open }">
                      <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-2 border rounded text-xs transition-colors"
                        :class="selectedBrandKey === 'custom' ? 'border-blue-600 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'"
                        @click="selectedBrandKey = 'custom'"
                      >
                        <span
                          class="inline-block w-3.5 h-3.5 rounded-full border border-gray-200"
                          :class="{ 'ring-2 ring-blue-500 ring-offset-1': open }"
                          :style="{ backgroundColor: color || customBrandHex }"
                        ></span>
                        <span>{{ t('settings.themePresetCustom') }}</span>
                      </button>
                    </template>
                  </ColorPicker>
                </div>
                <p class="text-xs text-gray-500 mt-2">{{ t('settings.themeColorDesc') }}</p>
              </div>

              <div class="border-t border-gray-200 pt-4">
                <div class="flex items-center justify-between">
                  <div class="font-medium text-gray-900">{{ t('settings.autoSave') }}</div>
                  <button 
                    @click="autoSave = !autoSave"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    :class="autoSave ? 'bg-blue-600' : 'bg-gray-200'"
                  >
                    <span class="sr-only">{{ t('settings.autoSave') }}</span>
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="autoSave ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">{{ t('settings.autoSaveDesc') }}</p>
              </div>

              <div class="border-t border-gray-200 pt-4">
                <div class="flex items-center justify-between">
                  <div class="font-medium text-gray-900">{{ t('settings.exportImageMerged') }}</div>
                  <button 
                    @click="exportImageMerged = !exportImageMerged"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    :class="exportImageMerged ? 'bg-blue-600' : 'bg-gray-200'"
                  >
                    <span class="sr-only">{{ t('settings.exportImageMerged') }}</span>
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="exportImageMerged ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">{{ t('settings.exportImageMergedDesc') }}</p>
              </div>

              <div class="border-t border-gray-200 pt-4 space-y-3">
                <div>
                  <div class="mb-2 font-medium text-gray-900">{{ t('settings.printMode') }}</div>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                      :class="printMode === 'browser' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                    >
                      <input type="radio" value="browser" v-model="printMode" />
                      <span>{{ t('settings.printModeBrowser') }}</span>
                    </label>
                    <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                      :class="printMode === 'local' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                    >
                      <input type="radio" value="local" v-model="printMode" :disabled="!localConnected" />
                      <span>{{ t('settings.printModeLocal') }}</span>
                    </label>
                    <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                      :class="printMode === 'remote' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                    >
                      <input type="radio" value="remote" v-model="printMode" :disabled="!remoteConnected" />
                      <span>{{ t('settings.printModeRemote') }}</span>
                    </label>
                  </div>
                  <p class="text-xs text-gray-500 mt-2">{{ t('settings.printModeDesc') }}</p>
                </div>

                <div class="flex items-center justify-between">
                  <div class="font-medium text-gray-900">{{ t('settings.silentPrint') }}</div>
                  <button 
                    @click="silentPrint = !silentPrint"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    :class="silentPrint ? 'bg-blue-600' : 'bg-gray-200'"
                  >
                    <span class="sr-only">{{ t('settings.silentPrint') }}</span>
                    <span
                      aria-hidden="true"
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="silentPrint ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
                <p class="text-xs text-gray-500">{{ t('settings.silentPrintDesc') }}</p>
              </div>
            </div>

            <!-- Language Tab -->
            <div v-if="activeTab === 'language'" class="space-y-4 text-sm text-gray-700">
              <div class="mb-2 font-medium text-gray-900">{{ t('settings.selectLanguage') }}</div>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer" :class="selectedLang === 'zh' ? 'border-blue-600 text-blue-700' : 'border-gray-300'">
                  <input type="radio" value="zh" v-model="selectedLang" />
                  <span>{{ t('settings.zhLabel') }}</span>
                </label>
                <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer" :class="selectedLang === 'en' ? 'border-blue-600 text-blue-700' : 'border-gray-300'">
                  <input type="radio" value="en" v-model="selectedLang" />
                  <span>{{ t('settings.enLabel') }}</span>
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-2">{{ t('settings.languageDesc') }}</p>
            </div>

            <!-- Local Connection Tab -->
            <div v-if="activeTab === 'local'" class="space-y-4 text-sm text-gray-700">
                <div class="space-y-2">
                  <div class="font-medium text-gray-900">{{ t('settings.localClientTitle') }}</div>
                  <p class="text-xs text-gray-500">{{ t('settings.localClientDesc') }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.wsAddress') }}</span>
                    <input v-model="localSettings.wsAddress" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('settings.localWsAddressPlaceholder')" />
                  </label>
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.secretKey') }}</span>
                    <input v-model="localSettings.secretKey" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                </div>
                <div class="rounded bg-gray-100 px-3 py-2 text-xs text-gray-600 break-all">
                  <span class="font-medium text-gray-700">{{ t('settings.connectionUrl') }}: </span>
                  <span>{{ localWsUrl }}</span>
                </div>
                <div class="w-full pt-2">
                  <button
                    @click="handleLocalConnection"
                    :disabled="localConnecting || localRetryCountValue > 0 || (!localConnected && !localHasConfig)"
                    class="w-full inline-flex items-center justify-center gap-2 px-3 h-9 rounded transition-colors text-sm shadow-sm disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    :class="connectionButtonClass(localStatusValue)"
                  >
                    <LinkIcon v-if="localConnected" class="w-4 h-4" />
                    <LinkOffIcon v-else class="w-4 h-4" />
                    <span>{{ localButtonLabel }}</span>
                  </button>
                  <div v-if="localRetryCountValue > 0 && !localConnected" class="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{{ t('settings.retrying', { count: localRetryCountValue, max: 10 }) }}</span>
                    <button @click="cancelLocalRetry" class="text-blue-600 hover:text-blue-700">
                      {{ t('settings.cancelRetry') }}
                    </button>
                  </div>
                </div>
            </div>

            <!-- Remote Connection Tab -->
            <div v-if="activeTab === 'remote'" class="space-y-4 text-sm text-gray-700">
                <div class="space-y-2">
                  <div class="font-medium text-gray-900">{{ t('settings.remoteLoginTitle') }}</div>
                  <p class="text-xs text-gray-500">{{ t('settings.remoteLoginDesc') }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.apiBaseUrl') }}</span>
                    <input v-model="remoteSettings.apiBaseUrl" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('settings.apiBasePlaceholder')" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.username') }}</span>
                    <input v-model="remoteSettings.username" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.password') }}</span>
                    <input v-model="remoteSettings.password" type="password" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                </div>
                <div class="space-y-2 pt-2 border-t border-gray-200">
                  <div class="font-medium text-gray-900">{{ t('settings.remoteWsTitle') }}</div>
                  <p class="text-xs text-gray-500">{{ t('settings.remoteWsDesc') }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.wsAddress') }}</span>
                    <input v-model="remoteSettings.wsAddress" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('settings.wsAddressPlaceholder')" />
                  </label>
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.remoteClient') }}</span>
                    <select
                      v-model="remoteSelectedClientId"
                      class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      :disabled="remoteStatusValue !== 'connected' || remoteClientsSafe.length === 0"
                    >
                      <option value="">{{ t('settings.remoteClientPlaceholder') }}</option>
                      <option
                        v-for="client in remoteClientsSafe"
                        :key="client.client_id"
                        :value="client.client_id"
                        :disabled="client.online === false"
                      >
                        {{ client.client_name || client.client_id }}{{ client.online === false ? ' (offline)' : '' }}
                      </option>
                    </select>
                  </label>
                </div>
                <div class="rounded bg-gray-100 px-3 py-2 text-xs text-gray-600 break-all">
                  <span class="font-medium text-gray-700">{{ t('settings.connectionUrl') }}: </span>
                  <span>{{ remoteWsUrl }}</span>
                </div>
                <p class="text-xs text-gray-500">{{ t('settings.remoteAuthHint') }}</p>
                <div class="w-full pt-2">
                  <button
                    @click="handleRemoteConnection"
                    :disabled="remoteConnecting || remoteRetryCountValue > 0 || (!remoteConnected && !remoteHasConfig)"
                    class="w-full inline-flex items-center justify-center gap-2 px-3 h-9 rounded transition-colors text-sm shadow-sm disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
                    :class="connectionButtonClass(remoteStatusValue)"
                  >
                    <LinkIcon v-if="remoteConnected" class="w-4 h-4" />
                    <LinkOffIcon v-else class="w-4 h-4" />
                    <span>{{ remoteButtonLabel }}</span>
                  </button>
                  <div v-if="remoteRetryCountValue > 0 && !remoteConnected" class="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{{ t('settings.retrying', { count: remoteRetryCountValue, max: 10 }) }}</span>
                    <button @click="cancelRemoteRetry" class="text-blue-600 hover:text-blue-700">
                      {{ t('settings.cancelRetry') }}
                    </button>
                  </div>
                </div>
            </div>
          </div>
          
          <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-br-lg">
            <button @click="close" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

