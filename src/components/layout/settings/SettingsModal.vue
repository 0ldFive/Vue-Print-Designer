<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@/composables/useTheme';
import { useAutoSave } from '@/composables/useAutoSave';
import { usePrintSettings } from '@/composables/usePrintSettings';
import X from '~icons/material-symbols/close';
import SettingsIcon from '~icons/material-symbols/settings';
import TranslateIcon from '~icons/material-symbols/translate';
import LinkIcon from '~icons/material-symbols/link';

defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>();

const { t, locale } = useI18n();
const { theme: selectedTheme, setTheme } = useTheme();
const { autoSave } = useAutoSave();
const {
  printMode,
  silentPrint,
  localSettings,
  remoteSettings,
  localStatus,
  remoteStatus,
  remoteClients,
  remoteSelectedClientId,
  localWsUrl,
  remoteWsUrl,
  connectLocal,
  disconnectLocal,
  connectRemote,
  disconnectRemote,
  fetchRemoteClients
} = usePrintSettings();

const activeTab = ref<'basic' | 'language' | 'connection'>('basic');
const activeConnectionTab = ref<'local' | 'remote'>('local');
const selectedLang = ref<string>(locale.value as string);
const localConnected = computed(() => localStatus.value === 'connected');
const remoteConnected = computed(() => remoteStatus.value === 'connected');
const localConnecting = computed(() => localStatus.value === 'connecting');
const remoteConnecting = computed(() => remoteStatus.value === 'connecting');
const localHasConfig = computed(() => Boolean(localSettings.host && localSettings.port));
const remoteHasConfig = computed(() => Boolean(remoteSettings.apiBaseUrl && remoteSettings.username && remoteSettings.password));

const localButtonLabel = computed(() => {
  if (localConnecting.value) return t('settings.connecting');
  return localConnected.value ? t('settings.disconnect') : t('settings.connect');
});

const remoteButtonLabel = computed(() => {
  if (remoteConnecting.value) return t('settings.connecting');
  return remoteConnected.value ? t('settings.disconnect') : t('settings.connect');
});

const connectionButtonClass = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
  if (status === 'connecting') return 'bg-gray-400 hover:bg-gray-400';
  if (status === 'connected') return 'bg-red-600 hover:bg-red-700';
  return 'bg-blue-600 hover:bg-blue-700';
};

const handleLocalConnection = async () => {
  if (localConnecting.value) return;
  if (localConnected.value) {
    disconnectLocal();
    return;
  }
  await connectLocal();
};

const handleRemoteConnection = async () => {
  if (remoteConnecting.value) return;
  if (remoteConnected.value) {
    disconnectRemote();
    return;
  }
  await connectRemote();
};

watch(selectedLang, (val) => {
  locale.value = val;
  localStorage.setItem('print-designer-language', val);
});

watch(selectedTheme, (val) => {
  setTheme(val);
});

watch([activeConnectionTab, remoteStatus], ([tab, status]) => {
  if (tab !== 'remote' || status !== 'connected') return;
  fetchRemoteClients();
});

const close = () => {
  emit('update:show', false);
};
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="close">
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
              @click="activeTab = 'connection'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'connection' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <LinkIcon class="w-5 h-5" />
              {{ t('settings.connection') }}
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ 
                activeTab === 'basic' ? t('settings.basic') :
                activeTab === 'language' ? t('settings.language') :
                t('settings.connection')
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

              <div class="border-t border-gray-200 pt-4 space-y-3">
                <div>
                  <div class="mb-2 font-medium text-gray-900">{{ t('settings.printMode') }}</div>
                  <div class="flex items-center gap-3">
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
                    <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                      :class="printMode === 'browser' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                    >
                      <input type="radio" value="browser" v-model="printMode" />
                      <span>{{ t('settings.printModeBrowser') }}</span>
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

            <!-- Connection Tab -->
            <div v-if="activeTab === 'connection'" class="space-y-4 text-sm text-gray-700">
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                  :class="activeConnectionTab === 'local' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                >
                  <input type="radio" value="local" v-model="activeConnectionTab" />
                  <span>{{ t('settings.localConnection') }}</span>
                </label>
                <label class="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer"
                  :class="activeConnectionTab === 'remote' ? 'border-blue-600 text-blue-700' : 'border-gray-300'"
                >
                  <input type="radio" value="remote" v-model="activeConnectionTab" />
                  <span>{{ t('settings.remoteConnection') }}</span>
                </label>
              </div>

              <div v-if="activeConnectionTab === 'local'" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.host') }}</span>
                    <input v-model="localSettings.host" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.port') }}</span>
                    <input v-model="localSettings.port" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.wsPath') }}</span>
                    <input v-model="localSettings.path" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.protocol') }}</span>
                    <select v-model="localSettings.protocol" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                      <option value="ws">ws</option>
                      <option value="wss">wss</option>
                    </select>
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
                <div class="flex justify-end">
                  <button
                    @click="handleLocalConnection"
                    :disabled="localConnecting || (!localConnected && !localHasConfig)"
                    class="px-4 py-2 text-white rounded transition-colors text-sm disabled:opacity-50"
                    :class="connectionButtonClass(localStatus)"
                  >
                    {{ localButtonLabel }}
                  </button>
                </div>
              </div>

              <div v-if="activeConnectionTab === 'remote'" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.host') }}</span>
                    <input v-model="remoteSettings.host" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.port') }}</span>
                    <input v-model="remoteSettings.wsPort" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.wsPath') }}</span>
                    <input v-model="remoteSettings.wsPath" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.protocol') }}</span>
                    <select v-model="remoteSettings.wsProtocol" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                      <option value="ws">ws</option>
                      <option value="wss">wss</option>
                    </select>
                  </label>
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
                  <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-gray-500">{{ t('settings.remoteClient') }}</span>
                    <select
                      v-model="remoteSelectedClientId"
                      class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                      :disabled="remoteStatus !== 'connected' || remoteClients.length === 0"
                    >
                      <option value="">{{ t('settings.remoteClientPlaceholder') }}</option>
                      <option
                        v-for="client in remoteClients"
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
                <div class="flex justify-end">
                  <button
                    @click="handleRemoteConnection"
                    :disabled="remoteConnecting || (!remoteConnected && !remoteHasConfig)"
                    class="px-4 py-2 text-white rounded transition-colors text-sm disabled:opacity-50"
                    :class="connectionButtonClass(remoteStatus)"
                  >
                    {{ remoteButtonLabel }}
                  </button>
                </div>
                <p class="text-xs text-gray-500">{{ t('settings.remoteAuthHint') }}</p>
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
