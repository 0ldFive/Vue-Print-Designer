<script setup lang="ts">
import type { CSSProperties } from "vue";
import Close from "~icons/material-symbols/close";
import PanelResizeIcon from "@/svg/components/PanelResizeIcon.vue";
import MinimapPanel from "@/components/layout/MinimapPanel.vue";

defineProps<{
  show: boolean;
  panelStyle: CSSProperties;
  zIndex: number;
  title: string;
  resizeTitle: string;
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
  pages: any[];
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  contentOffsetX: number;
  contentOffsetY: number;
  canvasBackground: string;
  showHeaderLine: boolean;
  showFooterLine: boolean;
  headerHeight: number;
  footerHeight: number;
  pageSpacingY: number;
  watermark: any;
  previewWidth: number;
  previewMaxHeight: number;
}>();

const emit = defineEmits<{
  (e: "panel-mousedown", event: MouseEvent): void;
  (e: "close"): void;
  (e: "resize-mousedown", event: MouseEvent): void;
  (e: "update-scroll", pos: { left: number; top: number }): void;
}>();
</script>

<template>
  <div
    v-if="show"
    data-floating-panel-surface="true"
    data-floating-panel-key="minimap"
    class="absolute pointer-events-none"
    :style="[panelStyle, { zIndex }]"
  >
    <div
      class="relative h-full w-full pointer-events-auto rounded-t-lg overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
      @mousedown="emit('panel-mousedown', $event)"
    >
      <div
        class="flex shrink-0 items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-move select-none rounded-t"
        data-floating-panel-drag-handle="true"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 m-0">
          {{ title }}
        </h3>
        <button
          class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          @click="emit('close')"
        >
          <Close class="w-4 h-4" />
        </button>
      </div>

      <div class="min-h-0 flex-1 bg-gray-100 dark:bg-gray-700">
        <MinimapPanel
          :scroll-width="scrollWidth"
          :scroll-height="scrollHeight"
          :viewport-width="viewportWidth"
          :viewport-height="viewportHeight"
          :scroll-left="scrollLeft"
          :scroll-top="scrollTop"
          :pages="pages"
          :page-width="pageWidth"
          :page-height="pageHeight"
          :zoom="zoom"
          :content-offset-x="contentOffsetX"
          :content-offset-y="contentOffsetY"
          :canvas-background="canvasBackground"
          :show-header-line="showHeaderLine"
          :show-footer-line="showFooterLine"
          :header-height="headerHeight"
          :footer-height="footerHeight"
          :page-spacing-y="pageSpacingY"
          :watermark="watermark"
          :preview-width="previewWidth"
          :preview-max-height="previewMaxHeight"
          @update:scroll="emit('update-scroll', $event)"
        />
      </div>
    </div>

    <button
      type="button"
      :title="resizeTitle"
      class="absolute bottom-0.5 right-0.5 z-[1100] h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
      @mousedown.stop.prevent="emit('resize-mousedown', $event)"
    >
      <PanelResizeIcon class="h-4 w-4" />
    </button>
  </div>
</template>
