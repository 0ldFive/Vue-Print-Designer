<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import Close from "~icons/material-symbols/close";
import Type from "~icons/material-symbols/text-fields";
import Table from "~icons/material-symbols/table-chart";
import KeyboardArrowRight from "~icons/material-symbols/keyboard-arrow-right";
import KeyboardArrowDown from "~icons/material-symbols/keyboard-arrow-down";
import { ElementType } from "@/types";

const { t } = useI18n();
const store = useDesignerStore();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isResizing = ref(false);
const startPos = ref({ x: 0, y: 0 });
const resizeStart = ref({ x: 0, y: 0, width: 280, height: 360 });
const panelPos = ref({ x: -9999, y: -9999 }); // Default off-screen until watch calculates it
const panelSize = ref({ width: 280, height: 360 });
const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_WIDTH = 520;
const PANEL_MIN_HEIGHT = 200;
const PANEL_Z_BASE = 2000;
const PANEL_Z_ACTIVE = 5200;
const VARIABLE_DRAG_MIME = "application/x-print-designer-variable";
const DATA_VARIABLE_DRAG_MIME = "application/x-print-designer-data-variable";
const panelZIndex = computed(() =>
  isDragging.value || isResizing.value ? PANEL_Z_ACTIVE : PANEL_Z_BASE,
);

const variables = computed(() => store.availableVariables || []);

// Expanded state for tree nodes
const expandedNodes = ref<Set<string>>(new Set());

const toggleExpand = (id: string) => {
  const newSet = new Set(expandedNodes.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  expandedNodes.value = newSet;
  nextTick(() => {
    updatePosition();
  });
};

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

    const SNAP_DISTANCE = 12;
    const maxX = Math.max(bounds.left, bounds.right - width);
    const maxY = Math.max(bounds.top, bounds.bottom - height);
    if (Math.abs(newX - bounds.left) < SNAP_DISTANCE) newX = bounds.left;
    if (Math.abs(newY - bounds.top) < SNAP_DISTANCE) newY = bounds.top;
    if (Math.abs(maxX - newX) < SNAP_DISTANCE) newX = maxX;
    if (Math.abs(maxY - newY) < SNAP_DISTANCE) newY = maxY;
  } else {
    newX = Math.max(0, Math.min(newX, window.innerWidth - width));
    newY = Math.max(0, Math.min(newY, window.innerHeight - height));
  }

  panelPos.value = { x: newX, y: newY };
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
};

const handleResizeEnd = () => {
  isResizing.value = false;
  document.removeEventListener("mousemove", handleResizeMove);
  document.removeEventListener("mouseup", handleResizeEnd);
};

// Handle dragging variables to canvas
const handleVarDragStart = (event: DragEvent, item: any) => {
  if (event.dataTransfer) {
    const variableId = String(item?.id || "");

    if (item.isArray) {
      event.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: ElementType.TABLE,
          dataVariable: variableId,
        }),
      );
      event.dataTransfer.setData(DATA_VARIABLE_DRAG_MIME, variableId);
    } else {
      event.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          type: ElementType.TEXT,
          variable: variableId,
        }),
      );
      event.dataTransfer.setData(VARIABLE_DRAG_MIME, variableId);
    }

    event.dataTransfer.setData("text/plain", variableId);
    event.dataTransfer.effectAllowed = "copy";
  }
};

let retryCount = 0;
const updatePosition = async () => {
  await nextTick();
  const bounds = getCanvasBounds();
  if (bounds) {
    // Sometimes getBoundingClientRect is 0 on mount, wait for a frame if needed
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
    panelSize.value = {
      width: Math.min(
        Math.max(panelSize.value.width, PANEL_MIN_WIDTH),
        maxWidthByBounds,
      ),
      height: Math.min(
        Math.max(panelSize.value.height, PANEL_MIN_HEIGHT),
        maxHeightByBounds,
      ),
    };

    const seedX = panelPos.value.x < 0 ? bounds.left : panelPos.value.x;
    const seedY = panelPos.value.y < 0 ? bounds.top : panelPos.value.y;
    panelPos.value = clampPosition(
      seedX,
      seedY,
      panelSize.value.width,
      panelSize.value.height,
      bounds,
    );
  } else {
    // Retry if canvasScroll not found yet
    if (retryCount < 10) {
      retryCount++;
      setTimeout(updatePosition, 50);
    } else {
      // Fallback
      if (panelPos.value.x < 0 || panelPos.value.y < 0) {
        panelPos.value = { x: 250, y: 100 };
      }
      panelSize.value = {
        width: Math.min(
          PANEL_MAX_WIDTH,
          Math.max(PANEL_MIN_WIDTH, panelSize.value.width),
        ),
        height: Math.max(PANEL_MIN_HEIGHT, panelSize.value.height),
      };
    }
  }
};

watch(
  () => store.showVariablesPanel,
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
              if (store.showVariablesPanel) {
                updatePosition();
              }
            });
            resizeObserver.observe(canvasScroll);
          }
        }
      });
    } else {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    }
  },
);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (store.showVariablesPanel) {
    updatePosition();
    nextTick(() => {
      const root =
        (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
      const canvasScroll = root.querySelector(".canvas-scroll");
      if (canvasScroll) {
        resizeObserver = new ResizeObserver(() => {
          if (store.showVariablesPanel) {
            updatePosition();
          }
        });
        resizeObserver.observe(canvasScroll);
      }
    });
  }
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
    v-if="store.showVariablesPanel"
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
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-move select-none"
      @mousedown="handleDragStart"
    >
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 m-0">
        {{ t("common.variables") }}
      </h3>
      <button
        class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
        @click="store.setShowVariablesPanel(false)"
      >
        <Close class="w-4 h-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
      <div
        v-if="variables.length === 0"
        class="text-xs text-gray-500 dark:text-gray-400 text-center py-4"
      >
        {{ t("common.noData") }}
      </div>

      <div v-else class="space-y-1">
        <!-- Recursive template would be better, but we can inline a simple tree for now -->
        <template v-for="item in variables" :key="item.id">
          <div class="flex flex-col">
            <!-- Item row -->
            <div
              class="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 group cursor-grab active:cursor-grabbing"
              :draggable="true"
              @dragstart="handleVarDragStart($event, item)"
            >
              <button
                v-if="item.children && item.children.length > 0"
                class="w-4 h-4 flex items-center justify-center mr-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                @click.stop="toggleExpand(item.id)"
              >
                <KeyboardArrowDown
                  v-if="expandedNodes.has(item.id)"
                  class="w-4 h-4"
                />
                <KeyboardArrowRight v-else class="w-4 h-4" />
              </button>
              <div v-else class="w-4 h-4 mr-1"></div>

              <span
                class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1"
                :title="item.label"
                >{{ item.label }}</span
              >
              <span
                class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]"
                :title="`@${item.id}`"
                >@{{ item.id }}</span
              >
            </div>

            <!-- Children -->
            <div
              v-if="
                item.children &&
                item.children.length > 0 &&
                expandedNodes.has(item.id)
              "
              class="ml-6 border-l border-gray-200 dark:border-gray-600 pl-1 mt-1 space-y-1"
            >
              <div
                v-for="child in item.children"
                :key="child.id"
                class="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing"
                :draggable="true"
                @dragstart="handleVarDragStart($event, child)"
              >
                <span
                  class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1"
                  :title="child.label"
                  >{{ child.label }}</span
                >
                <span
                  class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]"
                  :title="`@${child.id}`"
                  >@{{ child.id }}</span
                >
              </div>
            </div>
          </div>
        </template>
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
