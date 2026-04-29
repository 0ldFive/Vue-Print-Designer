<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDesignerStore } from '@/stores/designer';
import Close from '~icons/material-symbols/close';
import Type from '~icons/material-symbols/text-fields';
import Table from '~icons/material-symbols/table-chart';
import KeyboardArrowRight from '~icons/material-symbols/keyboard-arrow-right';
import KeyboardArrowDown from '~icons/material-symbols/keyboard-arrow-down';
import { ElementType } from '@/types';

const { t } = useI18n();
const store = useDesignerStore();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const startPos = ref({ x: 0, y: 0 });
const panelPos = ref({ x: -9999, y: -9999 }); // Default off-screen until watch calculates it
const maxPanelHeight = ref<string>('70vh');

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

// Handle dragging the panel itself
const handleDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.panel-close-btn')) return;
  isDragging.value = true;
  startPos.value = {
    x: e.clientX - panelPos.value.x,
    y: e.clientY - panelPos.value.y
  };
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
};

const handleDragMove = (e: MouseEvent) => {
  if (!isDragging.value || !panelRef.value) return;
  
  let newX = e.clientX - startPos.value.x;
  let newY = e.clientY - startPos.value.y;

  const panelRect = panelRef.value.getBoundingClientRect();
  const root = (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
  const canvasScroll = root.querySelector('.canvas-scroll');
  
  if (canvasScroll) {
    const bounds = canvasScroll.getBoundingClientRect();
    
    // In PrintDesigner, the actual visible area is represented by canvas-scroll bounds
    // We want the panel to stay strictly within these bounds
    const minX = bounds.left;
    const minY = bounds.top;
    const maxX = bounds.right - panelRect.width;
    const maxY = bounds.bottom - panelRect.height;
    
    newX = Math.max(minX, Math.min(newX, maxX));
    newY = Math.max(minY, Math.min(newY, maxY));

    // Magnetic snap to edges
    const SNAP_DISTANCE = 12;
    if (Math.abs(newX - minX) < SNAP_DISTANCE) newX = minX;
    if (Math.abs(newY - minY) < SNAP_DISTANCE) newY = minY;
    if (Math.abs(maxX - newX) < SNAP_DISTANCE) newX = maxX;
    if (Math.abs(maxY - newY) < SNAP_DISTANCE) newY = maxY;
  } else {
    // Fallback to window bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - panelRect.width));
    newY = Math.max(0, Math.min(newY, window.innerHeight - panelRect.height));
  }

  panelPos.value = { x: newX, y: newY };
};

const handleDragEnd = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
};

// Handle dragging variables to canvas
const handleVarDragStart = (event: DragEvent, item: any) => {
  if (event.dataTransfer) {
    if (item.isArray) {
      event.dataTransfer.setData('application/json', JSON.stringify({ 
        type: ElementType.TABLE,
        dataVariable: item.id
      }));
    } else {
      event.dataTransfer.setData('application/json', JSON.stringify({ 
        type: ElementType.TEXT,
        variable: item.id
      }));
    }
    event.dataTransfer.effectAllowed = 'copy';
  }
};

let retryCount = 0;
const updatePosition = async () => {
  await nextTick();
  const root = (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
  const canvasScroll = root.querySelector('.canvas-scroll');
  if (canvasScroll) {
    const bounds = canvasScroll.getBoundingClientRect();
    // Sometimes getBoundingClientRect is 0 on mount, wait for a frame if needed
    if (bounds.width === 0 && retryCount < 10) {
      retryCount++;
      setTimeout(updatePosition, 50);
      return;
    }
    retryCount = 0;
    
    const defaultX = bounds.left;
    const defaultY = bounds.top;
    
    const minX = bounds.left;
    const minY = bounds.top;
    
    // Ensure panel fits inside canvas
    const availableHeight = bounds.bottom - bounds.top;
    maxPanelHeight.value = `${Math.max(200, availableHeight)}px`;
    
    await nextTick(); // wait for max height to apply
    
    const panelWidth = panelRef.value ? panelRef.value.getBoundingClientRect().width : 280;
    const panelHeight = panelRef.value ? panelRef.value.getBoundingClientRect().height : 400;

    const maxX = Math.max(minX, bounds.right - panelWidth);
    const maxY = Math.max(minY, bounds.bottom - panelHeight);
    
    if (panelPos.value.x < minX || panelPos.value.x > maxX || panelPos.value.y < minY || panelPos.value.y > maxY) {
       panelPos.value = { 
         x: Math.max(minX, Math.min(panelPos.value.x, maxX)), 
         y: Math.max(minY, Math.min(panelPos.value.y, maxY)) 
       };
    }
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
    }
  }
};

watch(() => store.showVariablesPanel, (show) => {
  if (show) {
    updatePosition();
    
    nextTick(() => {
      if (!resizeObserver) {
        const root = (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
        const canvasScroll = root.querySelector('.canvas-scroll');
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
});

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (store.showVariablesPanel) {
    updatePosition();
    nextTick(() => {
      const root = (panelRef.value?.getRootNode() as Document | ShadowRoot) || document;
      const canvasScroll = root.querySelector('.canvas-scroll');
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
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

</script>

<template>
  <div 
    v-if="store.showVariablesPanel"
    ref="panelRef"
    class="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col z-[2000] overflow-hidden"
    :style="{ left: `${panelPos.x}px`, top: `${panelPos.y}px`, width: '280px', maxHeight: maxPanelHeight }"
  >
    <!-- Header -->
    <div 
      class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-move select-none"
      @mousedown="handleDragStart"
    >
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 m-0">{{ t('common.variables') }}</h3>
      <button 
          class="panel-close-btn p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          @click="store.setShowVariablesPanel(false)"
        >
          <Close class="w-4 h-4" />
        </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
      <div v-if="variables.length === 0" class="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
        {{ t('common.noData') }}
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
                <KeyboardArrowDown v-if="expandedNodes.has(item.id)" class="w-4 h-4" />
                <KeyboardArrowRight v-else class="w-4 h-4" />
              </button>
              <div v-else class="w-4 h-4 mr-1"></div>
              
              <span class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1" :title="item.label">{{ item.label }}</span>
              <span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]" :title="`@${item.id}`">@{{ item.id }}</span>
            </div>
            
            <!-- Children -->
            <div v-if="item.children && item.children.length > 0 && expandedNodes.has(item.id)" class="ml-6 border-l border-gray-200 dark:border-gray-600 pl-1 mt-1 space-y-1">
              <div 
                v-for="child in item.children" 
                :key="child.id"
                class="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing"
                :draggable="true"
                @dragstart="handleVarDragStart($event, child)"
              >
                <span class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1" :title="child.label">{{ child.label }}</span>
                <span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]" :title="`@${child.id}`">@{{ child.id }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
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
