<script setup lang="ts">
import { reactive, watch, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import X from '~icons/material-symbols/close';
import { usePrintSettings } from '@/composables/usePrintSettings';
import type { PrintOptions, PrintMode, LocalPrinterCaps } from '@/composables/usePrintSettings';

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
const {
  localPrinters,
  remotePrinters,
  remoteClients,
  remoteSelectedClientId,
  localPrinterCaps,
  fetchLocalPrinters,
  fetchRemoteClients,
  fetchRemotePrinters,
  fetchLocalPrinterCaps
} = usePrintSettings();

const isLoadingPrinters = ref(false);
const isLoadingCaps = ref(false);
const printerLoadError = ref('');
const selectedClientId = ref('');

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
  trayBin: ''
});

watch(() => props.show, (val) => {
  if (!val) return;
  Object.assign(form, JSON.parse(JSON.stringify(props.options)) as PrintOptions);
  selectedClientId.value = remoteSelectedClientId.value;
  loadPrinters();
});

watch(() => props.mode, () => {
  if (!props.show) return;
  loadPrinters();
});

const activePrinters = computed(() => {
  return props.mode === 'remote' ? remotePrinters.value : localPrinters.value;
});

const localCaps = computed<LocalPrinterCaps | undefined>(() => {
  if (props.mode !== 'local' || !form.printer) return undefined;
  return localPrinterCaps[form.printer];
});

const paperSizeOptions = computed(() => {
  if (props.mode !== 'local') return [];
  const caps = localCaps.value;
  const sizes = caps?.printerPaperNames?.length ? caps.printerPaperNames : caps?.paperSizes || [];
  return Array.from(new Set(sizes)).filter(Boolean);
});

const colorSupported = computed(() => {
  if (props.mode !== 'local') return true;
  return localCaps.value?.colorSupported !== false;
});

const duplexSupported = computed(() => {
  if (props.mode !== 'local') return true;
  return localCaps.value?.duplexSupported !== false;
});

const selectedRemotePrinter = computed(() => {
  if (props.mode !== 'remote') return undefined;
  return remotePrinters.value.find(p => p.printer_name === form.printer);
});

const loadPrinters = async () => {
  isLoadingPrinters.value = true;
  printerLoadError.value = '';
  try {
    if (props.mode === 'remote') {
      await fetchRemoteClients();
      if (!selectedClientId.value || !remoteClients.value.some(c => c.client_id === selectedClientId.value)) {
        selectedClientId.value = remoteSelectedClientId.value;
      }

      if (selectedClientId.value) {
        await fetchRemotePrinters(selectedClientId.value);
      } else {
        remotePrinters.value = [];
      }
    } else if (props.mode === 'local') {
      await fetchLocalPrinters();
    }

    if (!form.printer && activePrinters.value.length > 0) {
      const preferred = props.mode === 'local'
        ? activePrinters.value.find((p: any) => p.isDefault) || activePrinters.value[0]
        : activePrinters.value[0];
      form.printer = props.mode === 'local' ? (preferred as any).name : (preferred as any).printer_name;
    }

    if (props.mode === 'local' && form.printer) {
      await loadCaps(form.printer);
    }
  } catch (error) {
    printerLoadError.value = (error as Error).message || t('printDialog.printerLoadFailed');
  } finally {
    isLoadingPrinters.value = false;
  }
};

const loadCaps = async (printer: string) => {
  if (!printer || props.mode !== 'local') return;
  isLoadingCaps.value = true;
  try {
    await fetchLocalPrinterCaps(printer);
  } finally {
    isLoadingCaps.value = false;
  }
};

watch(selectedClientId, async (next, prev) => {
  if (!props.show || props.mode !== 'remote' || next === prev) return;
  remoteSelectedClientId.value = next;
  form.printer = '';
  isLoadingPrinters.value = true;
  printerLoadError.value = '';
  try {
    if (next) {
      await fetchRemotePrinters(next);
    } else {
      remotePrinters.value = [];
    }
  } catch (error) {
    printerLoadError.value = (error as Error).message || t('printDialog.printerLoadFailed');
  } finally {
    isLoadingPrinters.value = false;
  }
});

watch(() => form.printer, async (next, prev) => {
  if (!props.show || next === prev) return;
  if (props.mode === 'local') {
    await loadCaps(next);
    if (paperSizeOptions.value.length && !form.paperSize) {
      form.paperSize = paperSizeOptions.value[0];
    }
  } else if (props.mode === 'remote') {
    const info = remotePrinters.value.find(p => p.printer_name === next);
    if (info?.paper_spec && !form.paperSize) {
      form.paperSize = info.paper_spec;
    }
  }
});

watch(localCaps, (caps) => {
  if (!caps) return;
  if (caps.colorSupported === false && form.colorMode === 'color') {
    form.colorMode = 'monochrome';
  }
  if (caps.duplexSupported === false && form.sidesMode.startsWith('duplex')) {
    form.sidesMode = 'simplex';
  }
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
            <div v-if="props.mode === 'remote'" class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-gray-500">{{ t('printDialog.remoteClient') }}</span>
                <select
                  v-model="selectedClientId"
                  class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  :disabled="isLoadingPrinters"
                >
                  <option value="">{{ t('printDialog.remoteClientPlaceholder') }}</option>
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
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.printer') }}</span>
                <select
                  v-model="form.printer"
                  class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  :disabled="isLoadingPrinters || isLoadingCaps || (props.mode === 'remote' && !selectedClientId)"
                >
                  <option value="">{{ t('printDialog.printerSelect') }}</option>
                  <option
                    v-for="printer in activePrinters"
                    :key="props.mode === 'local' ? (printer as any).name : (printer as any).printer_name"
                    :value="props.mode === 'local' ? (printer as any).name : (printer as any).printer_name"
                  >
                    {{ props.mode === 'local' ? (printer as any).name : (printer as any).printer_name }}
                  </option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.jobName') }}</span>
                <input v-model="form.jobName" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.jobNamePlaceholder')" />
              </label>
            </div>
            <div v-if="printerLoadError" class="text-xs text-red-600">{{ printerLoadError }}</div>
            <div v-else-if="props.mode === 'remote' && remoteClients.length === 0" class="text-xs text-gray-500">
              {{ t('printDialog.remoteClientEmpty') }}
            </div>
            <div v-else-if="activePrinters.length === 0" class="text-xs text-gray-500">{{ t('printDialog.printerEmpty') }}</div>
            <div v-if="props.mode === 'remote' && selectedRemotePrinter" class="text-xs text-gray-500">
              {{ t('printDialog.remotePrinterInfo', {
                type: selectedRemotePrinter.printer_type || '-',
                paper: selectedRemotePrinter.paper_spec || '-',
                format: selectedRemotePrinter.supported_format || '-'
              }) }}
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
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.colorMode') }}</span>
                <select v-model="form.colorMode" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :disabled="!colorSupported">
                  <option value="color">{{ t('printDialog.color') }}</option>
                  <option value="monochrome">{{ t('printDialog.monochrome') }}</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.sidesMode') }}</span>
                <select v-model="form.sidesMode" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :disabled="!duplexSupported">
                  <option value="simplex">{{ t('printDialog.simplex') }}</option>
                  <option value="duplex">{{ t('printDialog.duplex') }}</option>
                  <option value="duplexshort">{{ t('printDialog.duplexShort') }}</option>
                  <option value="duplexlong">{{ t('printDialog.duplexLong') }}</option>
                </select>
              </label>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.paperSize') }}</span>
                <select v-if="paperSizeOptions.length" v-model="form.paperSize" class="w-full px-3 py-2 border rounded bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option v-for="size in paperSizeOptions" :key="size" :value="size">{{ size }}</option>
                </select>
                <input v-else v-model="form.paperSize" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.paperSizePlaceholder')" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-gray-500">{{ t('printDialog.trayBin') }}</span>
                <input v-model="form.trayBin" type="text" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600" :placeholder="t('printDialog.trayBinPlaceholder')" />
              </label>
            </div>
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
