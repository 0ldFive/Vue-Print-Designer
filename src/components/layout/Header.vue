<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import HeaderToolbar from './toolbar/HeaderToolbar.vue';
import HelpModal from './help/HelpModal.vue';

const { t } = useI18n();
const store = useDesignerStore();
</script>

<template>
  <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-[2000] relative shadow-sm">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">P</div>
      <h1 class="font-semibold text-gray-700">{{ t('common.appTitle') }}</h1>
    </div>

    <HeaderToolbar @toggle-help="store.setShowHelp(true)" />

    <HelpModal 
      :show="store.showHelp" 
      @update:show="store.setShowHelp($event)"
    />
  </header>
</template>
