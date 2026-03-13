<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import { startCase } from 'lodash';
import { formatShortcut } from '@/utils/os';
import X from '~icons/material-symbols/close';
import KeyboardIcon from '~icons/material-symbols/keyboard';
import InfoIcon from '~icons/material-symbols/info';
import pkg from '../../../../package.json';

const props = defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>();

const { t } = useI18n();
const designerStore = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));

const activeTab = ref<'shortcuts' | 'about'>('shortcuts');

const close = () => {
  emit('update:show', false);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.show) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

watch(() => props.show, (val) => {
  designerStore.setDisableGlobalShortcuts(val);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (props.show) {
    designerStore.setDisableGlobalShortcuts(false);
  }
});

const dependencies = [
  ...Object.entries(pkg.dependencies || {}),
  ...Object.entries(pkg.devDependencies || {})
].map(([name, version]) => ({
  name,
  version,
  url: `https://www.npmjs.com/package/${encodeURIComponent(name)}`
}));

const version = pkg.version;
const projectName = startCase(pkg.name);
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 pointer-events-auto" @click.self="close">
      <div class="bg-white rounded-lg shadow-xl w-[700px] max-w-full h-[500px] flex overflow-hidden">
        <!-- Sidebar Tabs -->
        <div class="w-48 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div class="h-[60px] flex items-center px-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">{{ t('help.title') }}</h3>
          </div>
          <div class="flex-1 py-2">
            <button
              @click="activeTab = 'shortcuts'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'shortcuts' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <KeyboardIcon class="w-5 h-5" />
              {{ t('shortcuts.title') }}
            </button>
            <button
              @click="activeTab = 'about'"
              class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors text-sm"
              :class="activeTab === 'about' ? 'bg-white text-blue-600 border-l-4 border-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'"
            >
              <InfoIcon class="w-5 h-5" />
              {{ t('help.about') }}
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="h-[60px] flex items-center justify-between px-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ activeTab === 'shortcuts' ? t('shortcuts.keyboardShortcuts') : t('help.aboutProject', { name: projectName }) }}
            </h3>
            <button @click="close" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Shortcuts Tab -->
            <div v-if="activeTab === 'shortcuts'" class="space-y-6">
              <div class="grid grid-cols-1 gap-6 text-sm">
                <!-- General Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('shortcuts.general') }}</h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center"><span>{{ t('common.save') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'S']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.saveAsTemplate') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Shift', 'S']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.print') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'P']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.exportPdf') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Shift', 'E']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.preview') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Shift', 'P']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.viewJson') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Shift', 'J']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.newTemplate') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Alt', 'N']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.openSettings') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', ',']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.undo') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Z']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.redo') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Y']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.openHelp') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'H']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.zoom') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Wheel']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.closeModal') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Esc']) }}</kbd></li>
                  </ul>
                </div>
                
                <!-- Editing Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('shortcuts.editing') }}</h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center"><span>{{ t('common.copy') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'C']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.cut') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'X']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.paste') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'V']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.delete') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Delete']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.selectAll') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'A']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.multiSelect') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Click']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.lock') }}/{{ t('common.unlock') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'L']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.customEditSave') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'S']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.customEditSaveAs') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Shift', 'S']) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.customEditExit') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Ctrl', 'Q']) }}</kbd></li>
                  </ul>
                </div>

                <!-- Manipulation Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('shortcuts.manipulation') }}</h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.move') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ t('shortcuts.arrow') }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.fastMove') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Shift', t('shortcuts.arrow')]) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.snapRotate') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Shift', t('shortcuts.drag')]) }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.resize') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ formatShortcut(['Shift', t('shortcuts.resize')]) }}</kbd></li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="activeTab === 'about'" class="space-y-6">
              <div class="text-center mb-8">
                <img
                  src="/src/assets/logo.png"
                  alt="Vue Print Designer"
                  class="w-12 h-12 mx-auto mb-2"
                />
                <h2 class="text-xl font-bold text-gray-800">{{ projectName }}</h2>
                <div class="mt-1 text-xs text-gray-500">{{ t('help.version') }} {{ version }}</div>
                <div class="mt-4 mx-auto max-w-md text-left">
                  <h4 class="font-medium text-gray-900 mb-2 border-b pb-1">{{ t('help.links') }}</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                      <span class="inline-flex items-center gap-1.5 text-gray-500">
                        <img src="/src/assets/favicon.ico" alt="Website" class="w-3.5 h-3.5 rounded-sm" />
                        {{ t('help.website') }}
                      </span>
                      <a href="https://printdot.cc" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-blue-600 hover:underline" title="https://printdot.cc">https://printdot.cc</a>
                    </div>
                    <div class="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                      <span class="inline-flex items-center gap-1.5 text-gray-500">
                        <svg viewBox="0 0 16 16" aria-hidden="true" class="w-3.5 h-3.5">
                          <path fill="currentColor" d="M8 0C3.58 0 0 3.73 0 8.35c0 3.7 2.29 6.83 5.47 7.94.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.56-.01-.57.63-.01 1.08.6 1.23.85.72 1.25 1.87.9 2.33.69.07-.54.28-.9.51-1.11-1.78-.21-3.64-.92-3.64-4.08 0-.9.31-1.64.82-2.22-.08-.21-.36-1.06.08-2.2 0 0 .67-.22 2.2.85.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.07 2.2-.85 2.2-.85.44 1.14.16 1.99.08 2.2.51.58.82 1.32.82 2.22 0 3.17-1.87 3.87-3.65 4.08.29.26.54.77.54 1.56 0 1.12-.01 2.03-.01 2.32 0 .22.15.48.55.4C13.71 15.18 16 12.04 16 8.35 16 3.73 12.42 0 8 0z" />
                        </svg>
                        {{ t('help.github') }}
                      </span>
                      <a href="https://github.com/0ldFive/Vue-Print-Designer" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-blue-600 hover:underline" title="https://github.com/0ldFive/Vue-Print-Designer">https://github.com/0ldFive/Vue-Print-Designer</a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('help.dependencies') }}</h4>
                <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <table class="w-full text-xs text-left">
                    <thead class="bg-gray-100 text-gray-700 font-medium">
                      <tr>
                        <th class="px-4 py-2 border-b">{{ t('help.package') }}</th>
                        <th class="px-4 py-2 border-b">{{ t('help.version') }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="dep in dependencies" :key="dep.name" class="hover:bg-gray-50">
                        <td class="px-4 py-1 text-gray-700 font-mono text-[11px]">
                          <a :href="dep.url" target="_blank" rel="noopener noreferrer" :title="dep.url" class="hover:underline hover:decoration-blue-600 hover:text-blue-600 transition-colors">{{ dep.name }}</a>
                        </td>
                        <td class="px-4 py-1 text-gray-500 text-[11px]">{{ dep.version }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
