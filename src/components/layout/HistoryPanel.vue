<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import type { Page } from "@/types";
import Close from "~icons/material-symbols/close";
import Undo2 from "~icons/material-symbols/undo";
import Redo2 from "~icons/material-symbols/redo";

const { t } = useI18n();
const store = useDesignerStore();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isResizing = ref(false);
const startPos = ref({ x: 0, y: 0 });
const resizeStart = ref({ x: 0, y: 0, width: 300, height: 320 });
const panelPos = ref({ x: -9999, y: -9999 });
const panelSize = ref({ width: 300, height: 320 });
const preferredPanelPos = ref({ x: -9999, y: -9999 });
const preferredPanelSize = ref({ width: 300, height: 320 });

const PANEL_MIN_WIDTH = 240;
const PANEL_MAX_WIDTH = 520;
const PANEL_MIN_HEIGHT = 220;
const PANEL_Z_BASE = 2000;
const PANEL_Z_ACTIVE = 5200;

const panelZIndex = computed(() =>
  isDragging.value || isResizing.value ? PANEL_Z_ACTIVE : PANEL_Z_BASE,
);

const getCanvasBounds = () => {
  const root =
    (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
  const canvasScroll = root.querySelector(".canvas-scroll") as HTMLElement | null;
  if (!canvasScroll) return null;
  return canvasScroll.getBoundingClientRect();
};

const clampPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: DOMRect,
) => {
  const minX = bounds.left;
  const minY = bounds.top;
  const maxX = Math.max(minX, bounds.right - width);
  const maxY = Math.max(minY, bounds.bottom - height);
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
};

const handleDragStart = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".panel-close-btn")) return;
  if (target.closest('[data-panel-resize-handle="true"]')) return;

  isDragging.value = true;
  startPos.value = {
    x: e.clientX - panelPos.value.x,
    y: e.clientY - panelPos.value.y,
  };
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
};

const handleDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return;

  let newX = e.clientX - startPos.value.x;
  let newY = e.clientY - startPos.value.y;
  const width = panelSize.value.width;
  const height = panelSize.value.height;
  const bounds = getCanvasBounds();

  if (bounds) {
    const clamped = clampPosition(newX, newY, width, height, bounds);
    newX = clamped.x;
    newY = clamped.y;
  } else {
    newX = Math.max(0, Math.min(newX, window.innerWidth - width));
    newY = Math.max(0, Math.min(newY, window.innerHeight - height));
  }

  panelPos.value = { x: newX, y: newY };
  preferredPanelPos.value = { x: newX, y: newY };
};

const handleDragEnd = () => {
  isDragging.value = false;
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
};

const handleResizeStart = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isResizing.value = true;
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: panelSize.value.width,
    height: panelSize.value.height,
  };
  document.addEventListener("mousemove", handleResizeMove);
  document.addEventListener("mouseup", handleResizeEnd);
};

const handleResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return;

  const deltaX = e.clientX - resizeStart.value.x;
  const deltaY = e.clientY - resizeStart.value.y;
  let nextWidth = resizeStart.value.width + deltaX;
  let nextHeight = resizeStart.value.height + deltaY;

  const bounds = getCanvasBounds();
  if (bounds) {
    const maxWidth = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(PANEL_MAX_WIDTH, bounds.right - panelPos.value.x),
    );
    const maxHeight = Math.max(PANEL_MIN_HEIGHT, bounds.bottom - panelPos.value.y);
    nextWidth = Math.max(PANEL_MIN_WIDTH, Math.min(nextWidth, maxWidth));
    nextHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(nextHeight, maxHeight));
  } else {
    const maxWidth = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(PANEL_MAX_WIDTH, window.innerWidth - panelPos.value.x),
    );
    const maxHeight = Math.max(
      PANEL_MIN_HEIGHT,
      window.innerHeight - panelPos.value.y,
    );
    nextWidth = Math.max(PANEL_MIN_WIDTH, Math.min(nextWidth, maxWidth));
    nextHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(nextHeight, maxHeight));
  }

  panelSize.value = {
    width: nextWidth,
    height: nextHeight,
  };
  preferredPanelSize.value = {
    width: nextWidth,
    height: nextHeight,
  };
};

const handleResizeEnd = () => {
  isResizing.value = false;
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
};

const summarizeSnapshot = (pages: Page[]) => {
  const pageCount = Array.isArray(pages) ? pages.length : 0;
  const elementCount = (pages || []).reduce(
    (total, page) => total + (Array.isArray(page?.elements) ? page.elements.length : 0),
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
  return translated === actionKey ? t("editor.historyAction.unknown") : translated;
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

let retryCount = 0;
const updatePosition = async () => {
  await nextTick();
  const bounds = getCanvasBounds();

  if (bounds) {
    if (bounds.width === 0 && retryCount < 10) {
      retryCount++;
      setTimeout(updatePosition, 50);
      return;
    }

    retryCount = 0;

    const maxWidthByBounds = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(PANEL_MAX_WIDTH, bounds.width),
    );
    const maxHeightByBounds = Math.max(PANEL_MIN_HEIGHT, bounds.height);
    const normalizedPreferredWidth = Math.min(
      Math.max(preferredPanelSize.value.width, PANEL_MIN_WIDTH),
      PANEL_MAX_WIDTH,
    );
    const normalizedPreferredHeight = Math.max(
      preferredPanelSize.value.height,
      PANEL_MIN_HEIGHT,
    );

    preferredPanelSize.value = {
      width: normalizedPreferredWidth,
      height: normalizedPreferredHeight,
    };

    const nextWidth = Math.min(normalizedPreferredWidth, maxWidthByBounds);
    const nextHeight = Math.min(normalizedPreferredHeight, maxHeightByBounds);

    const hasPreferredPos =
      preferredPanelPos.value.x >= 0 && preferredPanelPos.value.y >= 0;
    const initialX = bounds.right - nextWidth - 16;
    const initialY = bounds.top + 96;
    const seedX = hasPreferredPos ? preferredPanelPos.value.x : initialX;
    const seedY = hasPreferredPos ? preferredPanelPos.value.y : initialY;
    const clampedPos = clampPosition(
      seedX,
      seedY,
      nextWidth,
      nextHeight,
      bounds,
    );

    panelSize.value = {
      width: nextWidth,
      height: nextHeight,
    };
    panelPos.value = clampedPos;

    if (!hasPreferredPos) {
      preferredPanelPos.value = { ...clampedPos };
    }
    return;
  }

  if (retryCount < 10) {
    retryCount++;
    setTimeout(updatePosition, 50);
  } else {
    if (preferredPanelPos.value.x < 0 || preferredPanelPos.value.y < 0) {
      preferredPanelPos.value = { x: 300, y: 120 };
    }

    preferredPanelSize.value = {
      width: Math.min(
        PANEL_MAX_WIDTH,
        Math.max(PANEL_MIN_WIDTH, preferredPanelSize.value.width),
      ),
      height: Math.max(PANEL_MIN_HEIGHT, preferredPanelSize.value.height),
    };

    panelPos.value = { ...preferredPanelPos.value };
    panelSize.value = { ...preferredPanelSize.value };
  }
};

let resizeObserver: ResizeObserver | null = null;

watch(
  () => store.showHistoryPanel,
  (show) => {
    if (show) {
      updatePosition();

      nextTick(() => {
        if (!resizeObserver) {
          const root =
            (panelRef.value?.getRootNode() as Document | ShadowRoot) ||
            document;
          const canvasScroll = root.querySelector(".canvas-scroll");
          if (canvasScroll) {
            resizeObserver = new ResizeObserver(() => {
              if (store.showHistoryPanel) {
                updatePosition();
              }
            });
            resizeObserver.observe(canvasScroll);
          }
        }
      });
      return;
    }

    handleDragEnd();
    handleResizeEnd();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  },
);

onMounted(() => {
  if (!store.showHistoryPanel) return;

  updatePosition();
  nextTick(() => {
    const root =
      (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
    const canvasScroll = root.querySelector(".canvas-scroll");
    if (canvasScroll) {
      resizeObserver = new ResizeObserver(() => {
        if (store.showHistoryPanel) {
          updatePosition();
        }
      });
      resizeObserver.observe(canvasScroll);
    }
  });
});

onUnmounted(() => {
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<template>
  <div
    v-if="store.showHistoryPanel"
    ref="panelRef"
    class="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
    :style="{
      left: `${panelPos.x}px`,
      top: `${panelPos.y}px`,
      width: `${panelSize.width}px`,
      height: `${panelSize.height}px`,
      zIndex: panelZIndex,
    }"
  >
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-move select-none"
      @mousedown="handleDragStart"
    >
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 m-0">
        {{ t("editor.historyPanel") }}
      </h3>
      <button
        class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
        @click="store.setShowHistoryPanel(false)"
      >
        <Close class="w-4 h-4" />
      </button>
    </div>

    <div class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-700">
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

    <div class="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
      <div>
        <div class="mb-1 flex items-center justify-between">
          <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {{ t("editor.historyUndoStack") }}
          </h4>
          <span class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ store.historyPast.length }}
          </span>
        </div>
        <ul v-if="pastRecords.length" class="space-y-1">
          <li
            v-for="item in pastRecords"
            :key="item.id"
            class="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5"
          >
            <div class="text-xs font-medium text-gray-700 dark:text-gray-200">
              {{ item.title }}
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400">
              {{ item.stepLabel }} · {{ item.summary }}
            </div>
          </li>
        </ul>
        <div v-else class="text-xs text-gray-400 dark:text-gray-500 py-1">
          {{ t("editor.historyNoRecords") }}
        </div>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between">
          <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {{ t("editor.historyRedoStack") }}
          </h4>
          <span class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ store.historyFuture.length }}
          </span>
        </div>
        <ul v-if="futureRecords.length" class="space-y-1">
          <li
            v-for="item in futureRecords"
            :key="item.id"
            class="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5"
          >
            <div class="text-xs font-medium text-gray-700 dark:text-gray-200">
              {{ item.title }}
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400">
              {{ item.stepLabel }} · {{ item.summary }}
            </div>
          </li>
        </ul>
        <div v-else class="text-xs text-gray-400 dark:text-gray-500 py-1">
          {{ t("editor.historyNoRecords") }}
        </div>
      </div>
    </div>

    <button
      type="button"
      title="Resize panel"
      data-panel-resize-handle="true"
      class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
      @mousedown.stop.prevent="handleResizeStart"
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6.5 14L14 6.5"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <path
          d="M3 14L14 3"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <path
          d="M9.8 14L14 9.8"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #374151;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #4b5563;
}
</style>
