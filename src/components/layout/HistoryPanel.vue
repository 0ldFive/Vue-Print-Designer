<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useI18n } from "@/locales";
import { useDesignerStore } from "@/stores/designer";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import type { Page } from "@/types";
import Close from "~icons/material-symbols/close";
import Help from "~icons/material-symbols/help";
import Undo2 from "~icons/material-symbols/undo";
import Redo2 from "~icons/material-symbols/redo";

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const showHistoryHelpTooltip = ref(false);
const historyHelpButtonRef = ref<HTMLElement | null>(null);
const historyHelpTooltipRef = ref<HTMLElement | null>(null);
const activeTab = ref<"undo" | "redo">("undo");
const historyPanelHelp = computed(() => ({
  title: t("editor.historyHelp.title"),
  items: [
    t("editor.historyHelp.items.undo"),
    t("editor.historyHelp.items.redo"),
    t("editor.historyHelp.items.panel"),
  ],
}));
const {
  arrowStyle: historyHelpArrowStyle,
  placement: historyHelpPlacement,
  toggleTooltip: toggleHistoryHelpTooltip,
  tooltipStyle: historyHelpTooltipStyle,
} = useFloatingTooltip(
  showHistoryHelpTooltip,
  historyHelpButtonRef,
  historyHelpTooltipRef,
  { width: 288 },
);

const closeHistoryPanel = () => {
  showHistoryHelpTooltip.value = false;
  store.setShowHistoryPanel(false);
};

const summarizeSnapshot = (pages: Page[]) => {
  const pageCount = Array.isArray(pages) ? pages.length : 0;
  const elementCount = (pages || []).reduce(
    (total, page) =>
      total + (Array.isArray(page?.elements) ? page.elements.length : 0),
    0,
  );
  return t("editor.historySnapshotInfo", {
    pages: pageCount,
    elements: elementCount,
  });
};

const resolveActionTitle = (actionKey?: string) => {
  if (!actionKey) return t("editor.historyAction.unknown");
  const translated = t(actionKey);
  return translated === actionKey
    ? t("editor.historyAction.unknown")
    : translated;
};

const pastRecords = computed(() => {
  const total = store.historyPast.length;
  return store.historyPast
    .map((pages, index) => ({
      id: `past-${index}`,
      title: resolveActionTitle(store.historyPastActionKeys[index]),
      stepLabel: t("editor.historyStep", { index: total - index }),
      summary: summarizeSnapshot(pages),
    }))
    .reverse();
});

const futureRecords = computed(() => {
  const total = store.historyFuture.length;
  return store.historyFuture
    .map((pages, index) => ({
      id: `future-${index}`,
      title: resolveActionTitle(store.historyFutureActionKeys[index]),
      stepLabel: t("editor.historyStep", { index: total - index }),
      summary: summarizeSnapshot(pages),
    }))
    .reverse();
});

const activeRecords = computed(() =>
  activeTab.value === "undo" ? pastRecords.value : futureRecords.value,
);
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="relative p-4 min-h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-move select-none rounded-t-lg"
      data-floating-panel-drag-handle="true"
    >
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 pr-16">
          {{ t("editor.historyPanel") }}
        </h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t("editor.historyPanelSubtitle") }}
        </p>
      </div>
      <div class="absolute right-0 top-0 z-50 flex items-center gap-0">
        <button
          ref="historyHelpButtonRef"
          type="button"
          :class="[
            'panel-help-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
            showHistoryHelpTooltip
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
              : '',
          ]"
          :aria-label="t('editor.historyHelp.title')"
          :aria-pressed="showHistoryHelpTooltip"
          @mousedown.stop.prevent="toggleHistoryHelpTooltip"
        >
          <Help class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="panel-close-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
          @mousedown.stop
          @click.stop="closeHistoryPanel"
        >
          <Close class="w-4 h-4" />
        </button>
      </div>
    </div>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="showHistoryHelpTooltip"
        ref="historyHelpTooltipRef"
        role="tooltip"
        class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
        :style="historyHelpTooltipStyle"
        @click.stop
      >
        <div
          v-if="historyHelpPlacement === 'bottom'"
          class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="historyHelpArrowStyle"
        ></div>
        <div
          v-else
          class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          :style="historyHelpArrowStyle"
        ></div>
        <div
          class="overflow-y-auto p-3"
          :style="{ maxHeight: historyHelpTooltipStyle.maxHeight }"
        >
          <div class="flex items-start gap-2">
            <Help
              class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300"
            />
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ historyPanelHelp.title }}
              </h3>
              <ul
                class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
              >
                <li v-for="item in historyPanelHelp.items" :key="item">
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button
        type="button"
        :class="[
          'flex-1 py-3 text-sm font-medium transition-colors relative',
          activeTab === 'undo'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
        ]"
        @click="activeTab = 'undo'"
      >
        {{ t("editor.historyUndoStack") }}
        <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">
          {{ store.historyPast.length }}
        </span>
        <div
          v-if="activeTab === 'undo'"
          class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"
        ></div>
      </button>
      <button
        type="button"
        :class="[
          'flex-1 py-3 text-sm font-medium transition-colors relative',
          activeTab === 'redo'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
        ]"
        @click="activeTab = 'redo'"
      >
        {{ t("editor.historyRedoStack") }}
        <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">
          {{ store.historyFuture.length }}
        </span>
        <div
          v-if="activeTab === 'redo'"
          class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"
        ></div>
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      <div
        v-if="activeRecords.length === 0"
        class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
      >
        {{ t("editor.historyNoRecords") }}
      </div>

      <div v-else>
        <div
          v-for="item in activeRecords"
          :key="item.id"
          class="border-b border-gray-100 dark:border-gray-700 last:border-b-0 px-3 py-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
              {{ item.title }}
            </span>
            <span class="text-[11px] text-gray-500 dark:text-gray-400">
              {{ item.stepLabel }}
            </span>
          </div>
          <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ item.summary }}
          </div>
        </div>
      </div>
    </div>

    <div class="shrink-0 border-t border-gray-100 dark:border-gray-700 p-2">
      <div class="flex items-center gap-2">
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="store.historyPast.length === 0"
          @click="store.undo()"
        >
          <Undo2 class="w-4 h-4" />
          {{ t("common.undo") }}
        </button>
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="store.historyFuture.length === 0"
          @click="store.redo()"
        >
          <Redo2 class="w-4 h-4" />
          {{ t("common.redo") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* custom-scrollbar inherited from global style.css */
</style>
