<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { startCase } from 'lodash';
import X from '~icons/material-symbols/close';
import KeyboardIcon from '~icons/material-symbols/keyboard';
import InfoIcon from '~icons/material-symbols/info';
import pkg from '../../../../package.json';

defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>();

const { t } = useI18n();

const activeTab = ref<'shortcuts' | 'about'>('shortcuts');

const close = () => {
  emit('update:show', false);
};

const dependencies = Object.entries(pkg.dependencies).map(([name, version]) => ({
  name,
  version
}));

const version = pkg.version;
const projectName = startCase(pkg.name);
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="close">
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
                    <li class="flex justify-between items-center"><span>{{ t('common.save') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + S</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.print') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + P</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.exportPdf') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Shift + E</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.preview') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Shift + P</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('editor.viewJson') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Shift + J</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.newTemplate') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Alt + N</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.undo') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Z</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.redo') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Y</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.openHelp') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + H</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.zoom') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Wheel</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.closeModal') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Esc</kbd></li>
                  </ul>
                </div>
                
                <!-- Editing Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('shortcuts.editing') }}</h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center"><span>{{ t('common.copy') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + C</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.cut') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + X</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.paste') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + V</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.delete') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Delete</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.selectAll') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + A</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.multiSelect') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Click</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('common.lock') }}/{{ t('common.unlock') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + L</kbd></li>
                  </ul>
                </div>

                <!-- Manipulation Section -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('shortcuts.manipulation') }}</h4>
                  <ul class="space-y-2 text-gray-600">
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.move') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">{{ t('shortcuts.arrow') }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.fastMove') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + {{ t('shortcuts.arrow') }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.snapRotate') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + {{ t('shortcuts.drag') }}</kbd></li>
                    <li class="flex justify-between items-center"><span>{{ t('shortcuts.resize') }}</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + {{ t('shortcuts.resize') }}</kbd></li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- About Tab -->
            <div v-if="activeTab === 'about'" class="space-y-6">
              <div class="text-center mb-8">
                <div class="text-4xl mb-2">🖨️</div>
                <h2 class="text-xl font-bold text-gray-800">{{ projectName }}</h2>
                <p class="text-gray-500 mt-1">{{ t('help.version') }} {{ version }}</p>
              </div>

              <div>
                <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">{{ t('help.dependencies') }}</h4>
                <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-700 font-medium">
                      <tr>
                        <th class="px-4 py-2 border-b">{{ t('help.package') }}</th>
                        <th class="px-4 py-2 border-b">{{ t('help.version') }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="dep in dependencies" :key="dep.name" class="hover:bg-gray-50">
                        <td class="px-4 py-2 text-gray-700 font-mono">{{ dep.name }}</td>
                        <td class="px-4 py-2 text-gray-500">{{ dep.version }}</td>
                      </tr>
                    </tbody>
                  </table>
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
