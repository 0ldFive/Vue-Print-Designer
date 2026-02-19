<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import X from '~icons/material-symbols/close';
import type { PrintOptions, PrintMode } from '@/composables/usePrintSettings';

const props = defineProps<{
  show: boolean;
  mode: PrintMode;
  options: PrintOptions;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', value: PrintOptions): void;
}>();

const { t } = useI18n();

const form = reactive<PrintOptions>({
  printer: '',
  jobName: '',
  copies: 1,
  intervalMs: 0,
  pageRange: '',
  pageSet: '',
  scale: 'fit',
  orientation: 'portrait',
  colorMode: 'color',
  sidesMode: 'simplex',
  paperSize: '',
  trayBin: '',
  sumatraSettings: ''
});

watch(() => props.show, (val) => {
  if (!val) return;
  Object.assign(form, JSON.parse(JSON.stringify(props.options)) as PrintOptions);
});

const close = () => {
  emit('update:show', false);
};

const confirm = () => {
  emit('confirm', JSON.parse(JSON.stringify(form)) as PrintOptions);
};

const modeTitle = computed(() => {
  if (props.mode === 'local') return t('printDialog.titleLocal');
  if (props.mode === 'remote') return t('printDialog.titleRemote');
  return t('printDialog.title');
});
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="close">
      <div class="bg-white rounded-lg shadow-xl w-[700px] max-w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div class="h-[56px] flex items-center justify-between px-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">{{ modeTitle }}</h3>
          <button @click="close" class="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-gray-700">
          <div class="space-y-3">
            <div class="font-medium text-gray-900">{{ t('printDialog.sectionBasic') }}</div>
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.printer') }}</span>
                <input v-model="form.printer" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.printerPlaceholder')" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.jobName') }}</span>
                <input v-model="form.jobName" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.jobNamePlaceholder')" />
              </label>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.copies') }}</span>
                <input v-model.number="form.copies" type="number" min="1" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.intervalMs') }}</span>
                <input v-model.number="form.intervalMs" type="number" min="0" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.pageRange') }}</span>
                <input v-model="form.pageRange" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.pageRangePlaceholder')" />
              </label>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.pageSet') }}</span>
                <select v-model="form.pageSet" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="">{{ t('printDialog.pageSetAll') }}</option>
                  <option value="odd">{{ t('printDialog.pageSetOdd') }}</option>
                  <option value="even">{{ t('printDialog.pageSetEven') }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.scale') }}</span>
                <select v-model="form.scale" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="noscale">{{ t('printDialog.scaleNo') }}</option>
                  <option value="shrink">{{ t('printDialog.scaleShrink') }}</option>
                  <option value="fit">{{ t('printDialog.scaleFit') }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.orientation') }}</span>
                <select v-model="form.orientation" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="portrait">{{ t('printDialog.portrait') }}</option>
                  <option value="landscape">{{ t('printDialog.landscape') }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="space-y-3">
            <div class="font-medium text-gray-900">{{ t('printDialog.sectionAdvanced') }}</div>
            <div class="grid grid-cols-3 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.colorMode') }}</span>
                <select v-model="form.colorMode" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="color">{{ t('printDialog.color') }}</option>
                  <option value="monochrome">{{ t('printDialog.monochrome') }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.sidesMode') }}</span>
                <select v-model="form.sidesMode" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="simplex">{{ t('printDialog.simplex') }}</option>
                  <option value="duplex">{{ t('printDialog.duplex') }}</option>
                  <option value="duplexshort">{{ t('printDialog.duplexShort') }}</option>
                  <option value="duplexlong">{{ t('printDialog.duplexLong') }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.paperSize') }}</span>
                <input v-model="form.paperSize" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.paperSizePlaceholder')" />
              </label>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.trayBin') }}</span>
                <input v-model="form.trayBin" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.trayBinPlaceholder')" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.sumatraSettings') }}</span>
                <input v-model="form.sumatraSettings" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.sumatraPlaceholder')" />
              </label>
            </div>
            <p class="text-xs text-gray-500">{{ t('printDialog.sumatraHint') }}</p>
          </div>
        </div>

        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <button @click="close" class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 text-sm text-gray-700">
            {{ t('common.close') }}
          </button>
          <button @click="confirm" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
            {{ t('printDialog.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
