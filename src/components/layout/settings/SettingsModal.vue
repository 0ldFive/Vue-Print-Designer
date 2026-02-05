<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

const activeTab = ref<'basic' | 'language' | 'connection'>('basic');
const selectedLang = ref<string>(locale.value as string);
const selectedTheme = ref<string>(localStorage.getItem('print-designer-theme') || 'system');

watch(selectedLang, (val) => {
  locale.value = val;
  localStorage.setItem('print-designer-language', val);
});

const applyTheme = (theme: string) => {
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = theme === 'dark' ? true : theme === 'light' ? false : mq.matches;
  root.classList.toggle('dark', isDark);
  localStorage.setItem('print-designer-theme', theme);
};

watch(selectedTheme, (val) => {
  applyTheme(val);
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
              <p class="text-gray-600">{{ t('settings.basicDesc') }}</p>
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
            </div>

            <!-- Connection Tab -->
            <div v-if="activeTab === 'connection'" class="space-y-4 text-sm text-gray-700">
              <p class="text-gray-600">{{ t('settings.connectionDesc') }}</p>
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
