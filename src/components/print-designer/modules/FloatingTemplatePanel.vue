<script setup lang="ts">
import type { CSSProperties } from "vue";
import Close from "~icons/material-symbols/close";
import Help from "~icons/material-symbols/help";
import PanelResizeIcon from "@/svg/components/PanelResizeIcon.vue";
import TemplateListPanel from "@/components/layout/TemplateListPanel.vue";

defineProps<{
  show: boolean;
  panelStyle: CSSProperties;
  zIndex: number;
  title: string;
  subtitle: string;
  helpContent: {
    title: string;
    items: string[];
  };
  showHelp: boolean;
  helpPlacement: string;
  helpTooltipStyle: CSSProperties & {
    maxHeight?: string | number;
  };
  helpArrowStyle: CSSProperties;
  helpLabel: string;
  modalTarget: HTMLElement | null;
  resizeTitle: string;
  setHelpButtonRef: (el: any) => void;
  setHelpTooltipRef: (el: any) => void;
}>();

const emit = defineEmits<{
  (e: "panel-mousedown", event: MouseEvent): void;
  (e: "toggle-help"): void;
  (e: "close"): void;
  (e: "resize-mousedown", event: MouseEvent): void;
}>();
</script>

<template>
  <div
    v-show="show"
    data-floating-panel-surface="true"
    class="absolute pointer-events-none"
    :style="[panelStyle, { zIndex }]"
  >
    <div
      class="relative h-full w-full pointer-events-auto rounded-t-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
      @mousedown="emit('panel-mousedown', $event)"
    >
      <div
        class="relative p-4 min-h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-move select-none rounded-t"
        data-floating-panel-drag-handle="true"
      >
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100 pr-16">
            {{ title }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ subtitle }}
          </p>
        </div>

        <div class="absolute right-0 top-0 z-50 flex items-center gap-0">
          <button
            :ref="setHelpButtonRef"
            type="button"
            :class="[
              'panel-help-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200',
              showHelp
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                : '',
            ]"
            :aria-label="helpLabel"
            :aria-pressed="showHelp"
            @mousedown.stop.prevent="emit('toggle-help')"
          >
            <Help class="w-4 h-4" />
          </button>

          <button
            type="button"
            class="panel-close-btn h-8 w-8 inline-flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
            @mousedown.stop
            @click.stop="emit('close')"
          >
            <Close class="w-4 h-4" />
          </button>
        </div>
      </div>

      <Teleport :to="modalTarget || 'body'">
        <div
          v-if="showHelp"
          :ref="setHelpTooltipRef"
          role="tooltip"
          class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
          :style="helpTooltipStyle"
          @click.stop
        >
          <div
            v-if="helpPlacement === 'bottom'"
            class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            :style="helpArrowStyle"
          ></div>
          <div
            v-else
            class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            :style="helpArrowStyle"
          ></div>

          <div class="overflow-y-auto p-3" :style="{ maxHeight: helpTooltipStyle.maxHeight }">
            <div class="flex items-start gap-2">
              <Help class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ helpContent.title }}
                </h3>
                <ul
                  class="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-gray-600 dark:text-gray-300"
                >
                  <li v-for="item in helpContent.items" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <div class="min-h-0 flex-1">
        <TemplateListPanel />
      </div>
    </div>

    <button
      type="button"
      :title="resizeTitle"
      class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
      @mousedown.stop.prevent="emit('resize-mousedown', $event)"
    >
      <PanelResizeIcon class="h-4 w-4" />
    </button>
  </div>
</template>
