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
  localStatusMessage,
  remoteStatusMessage,
  localWsUrl,
  remoteWsUrl,
  remoteAuthToken
} = usePrintSettings();

const activeTab = ref<'basic' | 'language' | 'connection'>('basic');
const activeConnectionTab = ref<'local' | 'remote'>('local');
const selectedLang = ref<string>(locale.value as string);
const localTesting = ref(false);
const remoteTesting = ref(false);

const localConnected = computed(() => localStatus.value === 'connected');
const remoteConnected = computed(() => remoteStatus.value === 'connected');

const statusClass = (status: string) => {
  if (status === 'connected') return 'text-green-600';
  if (status === 'error') return 'text-red-600';
  if (status === 'connecting') return 'text-blue-600';
  return 'text-gray-500';
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

const testLocalConnection = async () => {
  if (localTesting.value) return;
  localTesting.value = true;
  localStatus.value = 'connecting';
  localStatusMessage.value = t('settings.connectionTesting');

  let socket: WebSocket | null = null;
  let resolved = false;

  const cleanup = () => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    socket = null;
    localTesting.value = false;
  };

  const timeoutId = window.setTimeout(() => {
    if (resolved) return;
    localStatus.value = 'error';
    localStatusMessage.value = t('settings.connectionTimeout');
    cleanup();
  }, 5000);

  try {
    socket = new WebSocket(localWsUrl.value);
    socket.onopen = () => {
      socket?.send(JSON.stringify({ type: 'get_printers' }));
    };
    socket.onmessage = (event) => {
      if (resolved) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'printer_list') {
          resolved = true;
          localStatus.value = 'connected';
          localStatusMessage.value = t('settings.connectionOk');
        }
      } catch {
        resolved = true;
        localStatus.value = 'connected';
        localStatusMessage.value = t('settings.connectionOk');
      }
      window.clearTimeout(timeoutId);
      cleanup();
    };
    socket.onerror = () => {
      if (resolved) return;
      resolved = true;
      localStatus.value = 'error';
      localStatusMessage.value = t('settings.connectionFailed');
      window.clearTimeout(timeoutId);
      cleanup();
    };
  } catch (error) {
    resolved = true;
    localStatus.value = 'error';
    localStatusMessage.value = (error as Error).message || t('settings.connectionFailed');
    window.clearTimeout(timeoutId);
    cleanup();
  }
};

const testRemoteConnection = async () => {
  if (remoteTesting.value) return;
  remoteTesting.value = true;
  remoteStatus.value = 'connecting';
  remoteStatusMessage.value = t('settings.connectionTesting');

  try {
    if (!remoteSettings.apiBaseUrl || !remoteSettings.username || !remoteSettings.password) {
      remoteStatus.value = 'error';
      remoteStatusMessage.value = t('settings.connectionMissingFields');
      remoteTesting.value = false;
      return;
    }

    const baseUrl = normalizeBaseUrl(remoteSettings.apiBaseUrl);
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: remoteSettings.username,
        password: remoteSettings.password
      })
    });

    if (!loginResponse.ok) {
      const msg = await loginResponse.text();
      throw new Error(msg || `HTTP ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    if (!loginData?.token) {
      throw new Error(t('settings.connectionMissingToken'));
    }

    remoteAuthToken.value = loginData.token;

    const meResponse = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });

    if (meResponse.ok) {
      const meData = await meResponse.json();
      if (meData?.user_id) {
        remoteStatusMessage.value = t('settings.connectionOkWithUser', { userId: meData.user_id });
      } else {
        remoteStatusMessage.value = t('settings.connectionOk');
      }
    } else {
      remoteStatusMessage.value = t('settings.connectionOk');
    }

    remoteStatus.value = 'connected';
  } catch (error) {
    remoteStatus.value = 'error';
    remoteStatusMessage.value = (error as Error).message || t('settings.connectionFailed');
  } finally {
    remoteTesting.value = false;
  }
};

watch(selectedLang, (val) => {
  locale.value = val;
  localStorage.setItem('print-designer-language', val);
});

watch(selectedTheme, (val) => {
  setTheme(val);
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
              <div class="flex items-center gap-2 border-b border-gray-200">
                <button
                  class="px-4 py-2 text-sm border-b-2"
                  :class="activeConnectionTab === 'local' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'"
                  @click="activeConnectionTab = 'local'"
                >
                  {{ t('settings.localConnection') }}
                </button>
                <button
                  class="px-4 py-2 text-sm border-b-2"
                  :class="activeConnectionTab === 'remote' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'"
                  @click="activeConnectionTab = 'remote'"
                >
                  {{ t('settings.remoteConnection') }}
                </button>
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
                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-500">
                    <span class="font-medium text-gray-700">{{ t('settings.connectionUrl') }}: </span>
                    <span>{{ localWsUrl }}</span>
                  </div>
                  <button
                    @click="testLocalConnection"
                    :disabled="localTesting"
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {{ localTesting ? t('settings.testing') : t('settings.testConnection') }}
                  </button>
                </div>
                <div class="text-xs" :class="statusClass(localStatus)">
                  {{ t(`settings.status.${localStatus}`) }}<span v-if="localStatusMessage"> - {{ localStatusMessage }}</span>
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
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.clientId') }}</span>
                    <input v-model="remoteSettings.clientId" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs text-gray-500">{{ t('settings.clientKey') }}</span>
                    <input v-model="remoteSettings.clientKey" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  </label>
                </div>
                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-500">
                    <span class="font-medium text-gray-700">{{ t('settings.connectionUrl') }}: </span>
                    <span>{{ remoteWsUrl }}</span>
                  </div>
                  <button
                    @click="testRemoteConnection"
                    :disabled="remoteTesting"
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {{ remoteTesting ? t('settings.testing') : t('settings.testConnection') }}
                  </button>
                </div>
                <div class="text-xs" :class="statusClass(remoteStatus)">
                  {{ t(`settings.status.${remoteStatus}`) }}<span v-if="remoteStatusMessage"> - {{ remoteStatusMessage }}</span>
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
