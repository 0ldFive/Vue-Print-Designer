<script setup lang="ts">
import { computed, inject, ref, watch, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { useFeatureFlags } from "@/composables/useFeatureFlags";
import { useMarketConfig } from "@/market/config";
import { canEditEntity } from "@/utils/entityConstraints";
import HeaderToolbar from "./toolbar/HeaderToolbar.vue";
import HeaderElementsBar from "./toolbar/HeaderElementsBar.vue";
import HelpModal from "./help/HelpModal.vue";
import SettingsModal from "./settings/SettingsModal.vue";
import defaultLogo from "@/assets/logo.png";
import Save from "~icons/material-symbols/save";
import Loading from "@/svg/components/LoadingIcon.vue";
import ChevronDown from "~icons/material-symbols/expand-more";
import SaveAs from "~icons/material-symbols/save-as";
import PreviewIcon from "~icons/material-symbols/preview";
import PrinterIcon from "~icons/material-symbols/print";
import FileOutput from "~icons/material-symbols/file-download";
import DataObject from "~icons/material-symbols/data-object";
import HelpCircleIcon from "~icons/material-symbols/help";
import SettingsIcon from "~icons/material-symbols/settings";
import ReorderIcon from "~icons/material-symbols/drag-indicator";
import StorefrontIcon from "~icons/material-symbols/storefront";

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();
const { hiddenModules } = useFeatureFlags();
const { marketEnabled } = useMarketConfig();
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const modalContainer = inject<Ref<HTMLElement | null>>(
  "modal-container",
  ref(null),
);
const showExportMenu = ref(false);
const exportMenuAnchor = ref<HTMLElement | null>(null);
const exportMenuStyle = ref<Record<string, string>>({});

// 菜单 Teleport 到 modal-container 后脱离 Header 层叠上下文，需要按视口坐标定位
const updateExportMenuPosition = () => {
  const rect = exportMenuAnchor.value?.getBoundingClientRect();
  if (!rect) return;
  exportMenuStyle.value = {
    top: `${rect.bottom + 8}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
  };
};

watch(showExportMenu, (visible) => {
  window.removeEventListener("resize", updateExportMenuPosition);
  if (!visible) return;
  updateExportMenuPosition();
  window.addEventListener("resize", updateExportMenuPosition);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateExportMenuPosition);
});

const showMarketEntry = computed(
  () => marketEnabled.value && hiddenModules.value.market !== true,
);

const handleOpenAiSettings = () => {
  store.setShowSettings(true);
};

onMounted(() => {
  window.addEventListener("designer:open-ai-settings", handleOpenAiSettings);
});

onUnmounted(() => {
  window.removeEventListener("designer:open-ai-settings", handleOpenAiSettings);
});

const isSaveDisabled = computed(() => {
  if (store.previewLocked) return true;
  if (templateStore.isSaving || templateStore.isLoading) return true;
  
  if (templateStore.currentTemplateId) {
    const t = templateStore.templates.find(
      (t) => t.id === templateStore.currentTemplateId
    );
    if (t && !canEditEntity(t)) {
      return true;
    }
  }
  
  return !templateStore.hasUnsavedChanges;
});

const showLogo = computed(() => store.branding?.showLogo !== false);
const showTitle = computed(() => store.branding?.showTitle !== false);
const logoSrc = computed(() => store.branding?.logoUrl || defaultLogo);
const titleText = computed(() => store.branding?.title || t("common.appTitle"));

const dispatchDesignerEvent = (
  name: string,
  detail: Record<string, any> = {},
) => {
  const payload = { ...detail };
  if (designerInstanceId) {
    payload.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
};

const closeExportMenu = () => {
  showExportMenu.value = false;
};

watch(
  () => [
    store.isGeneratingPreview,
    store.isGeneratingPrint,
    store.isGeneratingPdf,
    store.isGeneratingHtml,
    store.isGeneratingImages,
  ],
  (newVals, oldVals) => {
    // If any was loading and now none are loading, close the menu automatically
    const wasLoading = oldVals.some((v) => v);
    const isLoading = newVals.some((v) => v);
    if (wasLoading && !isLoading) {
      closeExportMenu();
    }
  }
);

const handleSave = () => {
  if (store.previewLocked) return;
  dispatchDesignerEvent("designer:save");
};

const handleSaveAs = () => {
  if (store.previewLocked) return;
  const currentId = templateStore.currentTemplateId;
  if (currentId) {
    dispatchDesignerEvent("designer:save-as", { id: currentId });
  }
  closeExportMenu();
};

const handlePreview = () => {
  if (store.previewLocked) return;
  if (store.isGeneratingPreview) return;
  dispatchDesignerEvent("designer:preview");
};

const handlePrint = () => {
  if (store.previewLocked) return;
  if (store.isGeneratingPrint) return;
  dispatchDesignerEvent("designer:print");
};

const handleExportPdf = () => {
  if (store.previewLocked) return;
  if (store.isGeneratingPdf) return;
  dispatchDesignerEvent("designer:export-pdf");
};

const handleExportHtml = () => {
  if (store.previewLocked) return;
  if (store.isGeneratingHtml) return;
  dispatchDesignerEvent("designer:export-html");
};

const handleExportImages = () => {
  if (store.previewLocked) return;
  if (store.isGeneratingImages) return;
  dispatchDesignerEvent("designer:export-images");
};

const handleViewImageBlob = () => {
  dispatchDesignerEvent("designer:view-blob");
  closeExportMenu();
};

const handleViewPdfBlob = () => {
  dispatchDesignerEvent("designer:view-pdf-blob");
  closeExportMenu();
};

const handleViewJson = () => {
  dispatchDesignerEvent("designer:view-json");
  closeExportMenu();
};

const handleOpenHelp = () => {
  store.setShowHelp(true);
  closeExportMenu();
};

const handleToolbarReorder = () => {
  dispatchDesignerEvent("designer:toolbar-reorder");
  closeExportMenu();
};

const handleOpenSettings = () => {
  store.setShowSettings(true);
  closeExportMenu();
};
</script>

<template>
  <div class="z-[6000] relative isolate shadow-sm">
    <header
      class="h-14 bg-white border-b border-gray-200 grid grid-cols-[minmax(0,1fr)_minmax(0,clamp(360px,58vw,860px))_minmax(0,1fr)] items-center gap-3 px-4 min-w-0"
    >
      <div class="flex min-w-0 items-center gap-2 justify-self-start">
        <img
          v-if="showLogo"
          :src="logoSrc"
          alt="Logo"
          class="w-8 h-8 object-contain"
        />
        <h1
          v-if="showTitle"
          class="hidden md:block max-w-[180px] truncate font-semibold text-gray-700"
        >
          {{ titleText }}
        </h1>
        <button
          v-if="showMarketEntry"
          type="button"
          class="ml-1 flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          :title="t('settings.marketEnabled')"
          @click="dispatchDesignerEvent('designer:open-market')"
        >
          <StorefrontIcon class="w-4 h-4" />
          <span class="hidden whitespace-nowrap lg:inline">{{
            t("settings.marketEnabled")
          }}</span>
        </button>
      </div>

      <div class="min-w-0 flex justify-center overflow-hidden">
        <HeaderElementsBar />
      </div>

      <div
        ref="exportMenuAnchor"
        class="relative justify-self-end shrink-0 min-w-max"
      >
        <div class="flex items-center shadow-sm">
          <button
            @click="handleSave"
            :disabled="isSaveDisabled"
            :class="[
              'shrink-0 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-l-md transition-colors text-sm border-r border-blue-500',
              !isSaveDisabled ? 'hover:bg-blue-700' : 'cursor-not-allowed',
              (templateStore.isSaving || templateStore.isLoading) ? 'opacity-50' : ''
            ]"
          >
            <Loading
              v-if="templateStore.isSaving"
              class="w-4 h-4 animate-spin"
            />
            <Save v-else class="w-4 h-4" />
            <span class="whitespace-nowrap">{{ t("common.save") }}</span>
          </button>
          <button
            @click="showExportMenu = !showExportMenu"
            class="shrink-0 px-2 py-1.5 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors text-sm flex items-center"
          >
            <ChevronDown class="w-5 h-5" />
          </button>
        </div>

        <Teleport :to="modalContainer || 'body'">
        <div
          v-if="showExportMenu"
          :style="exportMenuStyle"
          :class="[
            'fixed w-max min-w-[160px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-1 z-[3200] flex flex-col gap-1',
            store.previewLocked ? 'pointer-events-none opacity-60' : 'pointer-events-auto',
          ]"
        >
          <button
            @click="handleSaveAs"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <SaveAs class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.saveAsTemplate") }}</span>
          </button>
          <button
            @click="handlePreview"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <Loading v-if="store.isGeneratingPreview" class="w-4 h-4 text-blue-500 animate-spin" />
            <PreviewIcon v-else class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.preview") }}</span>
          </button>
          <button
            @click="handlePrint"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <Loading v-if="store.isGeneratingPrint" class="w-4 h-4 text-blue-500 animate-spin" />
            <PrinterIcon v-else class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.print") }}</span>
          </button>
          <button
            @click="handleExportPdf"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <Loading v-if="store.isGeneratingPdf" class="w-4 h-4 text-blue-500 animate-spin" />
            <FileOutput v-else class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportPdf") }}</span>
          </button>
          <button
            @click="handleExportHtml"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <Loading v-if="store.isGeneratingHtml" class="w-4 h-4 text-blue-500 animate-spin" />
            <FileOutput v-else class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportHtml") }}</span>
          </button>
          <button
            @click="handleExportImages"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <Loading v-if="store.isGeneratingImages" class="w-4 h-4 text-blue-500 animate-spin" />
            <FileOutput v-else class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.exportImage") }}</span>
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewImageBlob"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.viewImageBlob") }}</span>
          </button>
          <button
            v-if="store.showDeveloperMode"
            @click="handleViewPdfBlob"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <DataObject class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.viewPdfBlob") }}</span>
          </button>
          <div class="h-px bg-gray-200 dark:bg-gray-700 my-0.5"></div>
          <button
            @click="handleToolbarReorder"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <ReorderIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.toolbarReorder") }}</span>
          </button>
          <button
            @click="handleOpenHelp"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <HelpCircleIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.help") }}</span>
          </button>
          <button
            @click="handleOpenSettings"
            class="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-sm text-left transition-colors whitespace-nowrap"
          >
            <SettingsIcon class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span>{{ t("editor.settings") }}</span>
          </button>
        </div>
        <div
          v-if="showExportMenu"
          class="fixed inset-0 z-[3199] pointer-events-auto"
          @click="closeExportMenu"
        ></div>
        </Teleport>
      </div>
    </header>

    <div
      class="relative z-[2001] bg-gray-100 border-b border-gray-200 flex items-center min-w-0"
    >
      <div class="flex-1 min-w-0">
        <HeaderToolbar />
      </div>
    </div>

    <HelpModal
      :show="store.showHelp"
      @update:show="store.setShowHelp($event)"
    />
    <SettingsModal
      :show="store.showSettings"
      @update:show="store.setShowSettings($event)"
    />
  </div>
</template>
