<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import Header from './layout/Header.vue';
import Sidebar from './layout/Sidebar.vue';
import PropertiesPanel from './layout/PropertiesPanel.vue';
import Canvas from './canvas/Canvas.vue';
import Ruler from './layout/Ruler.vue';
import Shortcuts from './layout/Shortcuts.vue';
import Minimap from './layout/Minimap.vue';

const store = useDesignerStore();
const scrollContainer = ref<HTMLElement | null>(null);
const canvasContainer = ref<HTMLElement | null>(null);
const canvasWrapper = ref<HTMLElement | null>(null);

onMounted(() => {
  // Load data from localStorage on startup
  store.loadFromLocalStorage();
  updateOffset();
  window.addEventListener('resize', updateOffset);
  // Also watch for store changes that might affect layout
  store.$subscribe(() => {
    nextTick(updateOffset);
  });
});

const scrollX = ref(0);
const scrollY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const RULER_SIZE = 20;

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollX.value = target.scrollLeft;
  scrollY.value = target.scrollTop;
};

const scrollWidth = ref(0);
const scrollHeight = ref(0);
const viewportWidth = ref(0);
const viewportHeight = ref(0);

const canvasStyle = computed(() => {
  const pagesCount = store.pages.length;
  const pageHeight = store.canvasSize.height;
  const pageWidth = store.canvasSize.width;
  const gap = 32; // gap-8
  // const paddingBottom = 80; // pb-20 - Removed to prevent unnecessary scrollbars
  
  const unscaledHeight = pagesCount > 0
    ? (pagesCount * pageHeight) + ((pagesCount - 1) * gap)
    : 0;

  const unscaledWidth = pageWidth;

  return {
    width: `${unscaledWidth * store.zoom}px`,
    height: `${unscaledHeight * store.zoom}px`,
  };
});

const updateOffset = () => {
  if (scrollContainer.value && canvasWrapper.value) {
    // Calculate expected scroll dimensions based on canvas size to avoid loop with overlay size
    const containerClientWidth = scrollContainer.value.clientWidth;
    const containerClientHeight = scrollContainer.value.clientHeight;
    
    viewportWidth.value = containerClientWidth;
    viewportHeight.value = containerClientHeight;
    
    const wrapperW = parseFloat(canvasStyle.value.width);
    const wrapperH = parseFloat(canvasStyle.value.height);
    
    // p-8 = 32px padding on each side
    const paddingX = 64; 
    const paddingY = 64;

    scrollWidth.value = Math.max(containerClientWidth, wrapperW + paddingX);
    scrollHeight.value = Math.max(containerClientHeight, wrapperH + paddingY);
    
    // Fix: If the wrapper fits within the container, force scroll dimensions to client dimensions
    // This prevents scrollbars from appearing when they shouldn't due to slight pixel differences
    if (wrapperW + paddingX <= containerClientWidth) {
      scrollWidth.value = containerClientWidth;
    }
    if (wrapperH + paddingY <= containerClientHeight) {
      scrollHeight.value = containerClientHeight;
    }

    const containerRect = scrollContainer.value.getBoundingClientRect();
    const wrapperRect = canvasWrapper.value.getBoundingClientRect();

    offsetX.value = wrapperRect.left - containerRect.left + scrollContainer.value.scrollLeft;
    offsetY.value = wrapperRect.top - containerRect.top + scrollContainer.value.scrollTop;
  }
};

onUnmounted(() => {
  window.removeEventListener('resize', updateOffset);
  window.removeEventListener('mousemove', handleGuideMouseMove);
  window.removeEventListener('mouseup', handleGuideMouseUp);
});

// Guides Logic
const isDraggingGuide = ref(false);
const draggingGuideId = ref<string | null>(null);
const draggingGuideType = ref<'horizontal' | 'vertical'>('horizontal');
const draggingGuidePos = ref(0);

const handleGuideDragStart = (e: MouseEvent, type: 'horizontal' | 'vertical', id: string | null = null) => {
  isDraggingGuide.value = true;
  draggingGuideId.value = id;
  draggingGuideType.value = type;
  
  updateGuidePosFromEvent(e);
  
  window.addEventListener('mousemove', handleGuideMouseMove);
  window.addEventListener('mouseup', handleGuideMouseUp);
};

const updateGuidePosFromEvent = (e: MouseEvent) => {
  if (!scrollContainer.value) return;
  
  const rect = scrollContainer.value.getBoundingClientRect();
  const zoom = store.zoom;
  
  if (draggingGuideType.value === 'horizontal') {
    // Relative to scrollContainer top
    const visualY = e.clientY - rect.top + scrollContainer.value.scrollTop;
    draggingGuidePos.value = (visualY - offsetY.value) / zoom;
  } else {
    // Relative to scrollContainer left
    const visualX = e.clientX - rect.left + scrollContainer.value.scrollLeft;
    draggingGuidePos.value = (visualX - offsetX.value) / zoom;
  }
};

const handleGuideMouseMove = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;
  e.preventDefault();
  updateGuidePosFromEvent(e);

  // Real-time update for existing guides
  if (draggingGuideId.value) {
    store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
  }
};

const handleGuideMouseUp = (e: MouseEvent) => {
  if (!isDraggingGuide.value) return;
  
  const rect = scrollContainer.value!.getBoundingClientRect();
  let shouldDelete = false;
  
  // Delete if dragged back to ruler or out of bounds (top/left)
  if (draggingGuideType.value === 'horizontal') {
      if (e.clientY < rect.top) shouldDelete = true;
  } else {
      if (e.clientX < rect.left) shouldDelete = true;
  }

  if (shouldDelete) {
    if (draggingGuideId.value) {
      store.removeGuide(draggingGuideId.value);
    }
  } else {
    if (draggingGuideId.value) {
      store.updateGuide(draggingGuideId.value, draggingGuidePos.value);
    } else {
      store.addGuide({ type: draggingGuideType.value, position: draggingGuidePos.value });
    }
  }

  isDraggingGuide.value = false;
  draggingGuideId.value = null;
  window.removeEventListener('mousemove', handleGuideMouseMove);
  window.removeEventListener('mouseup', handleGuideMouseUp);
};

const handleMinimapScroll = (pos: { left: number, top: number }) => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({
      left: pos.left,
      top: pos.top,
      behavior: 'auto'
    });
  }
};
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
    <Header />
    <div class="flex-1 flex overflow-hidden">
      <Sidebar />
      <main class="flex-1 overflow-hidden relative flex flex-col">
        <Shortcuts />
        <!-- Rulers Area -->
        <div class="relative w-full h-full flex flex-col overflow-hidden">
           <!-- Top Ruler -->
           <div class="flex-none h-5 bg-gray-50 border-b border-gray-300 flex z-20">
              <div class="w-5 flex-none bg-gray-100 border-r border-gray-300"></div> <!-- Corner -->
              <div class="flex-1 relative overflow-hidden">
                 <Ruler 
                    type="horizontal" 
                    :zoom="store.zoom" 
                    :scroll="scrollX" 
                    :offset="offsetX" 
                    :thick="20"
                    @guide-drag-start="(e) => handleGuideDragStart(e, 'horizontal')"
                 />
              </div>
           </div>
           
           <div class="flex-1 flex overflow-hidden relative">
              <!-- Left Ruler -->
              <div class="w-5 flex-none bg-gray-50 border-r border-gray-300 h-full relative z-20 overflow-hidden">
                 <Ruler 
                    type="vertical" 
                    :zoom="store.zoom" 
                    :scroll="scrollY" 
                    :offset="offsetY" 
                    :thick="20"
                    @guide-drag-start="(e) => handleGuideDragStart(e, 'vertical')"
                 />
              </div>
              
              <!-- Canvas Area -->
              <div
                ref="scrollContainer"
                class="flex-1 overflow-auto bg-gray-100 p-8 flex relative"
                @scroll="handleScroll"
                  @click="(e) => { if (e.target === scrollContainer || e.target === e.currentTarget) { store.selectGuide(null); } }"
              >
                 <div ref="canvasWrapper" :style="canvasStyle" class="mx-auto relative">
                    <Canvas ref="canvasContainer" class="absolute top-0 left-0" />
                 </div>

                 <!-- Guides Overlay -->
                 <div class="absolute top-0 left-0 pointer-events-none z-50" :style="{ width: `${scrollWidth}px`, height: `${scrollHeight}px` }">
                    <!-- Existing Guides -->
                    <template v-for="guide in store.guides" :key="guide.id">
                       <div 
                          v-if="guide.type === 'horizontal'"
                          class="absolute left-0 w-full h-3 -mt-1.5 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                          :style="{ top: `${offsetY + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => { store.selectGuide(guide.id); handleGuideDragStart(e, 'horizontal', guide.id); }"
                       >
                          <div :class="['w-full', store.highlightedGuideId === guide.id ? 'border-t-2 border-pink-500' : 'border-t border-cyan-500', 'group-hover:border-cyan-400']"></div>
                          <div class="absolute left-2 -top-4 bg-cyan-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                             {{ Math.round(guide.position) }}
                          </div>
                       </div>
                       <div 
                          v-else
                          class="absolute top-0 h-full w-3 -ml-1.5 cursor-col-resize pointer-events-auto group flex flex-row justify-center"
                          :style="{ left: `${offsetX + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => { store.selectGuide(guide.id); handleGuideDragStart(e, 'vertical', guide.id); }"
                       >
                           <div :class="['h-full', store.highlightedGuideId === guide.id ? 'border-l-2 border-pink-500' : 'border-l border-cyan-500', 'group-hover:border-cyan-400']"></div>
                           <div class="absolute top-2 -left-4 bg-cyan-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                             {{ Math.round(guide.position) }}
                          </div>
                       </div>
                    </template>
                    
                    <!-- Dragging Preview -->
                    <div 
                       v-if="isDraggingGuide && !draggingGuideId"
                       :class="[
                         'absolute border-cyan-500 border-dashed pointer-events-none',
                         draggingGuideType === 'horizontal' ? 'left-0 w-full border-t' : 'top-0 h-full border-l'
                       ]"
                       :style="{ 
                         top: draggingGuideType === 'horizontal' ? `${offsetY + draggingGuidePos * store.zoom}px` : undefined,
                         left: draggingGuideType === 'vertical' ? `${offsetX + draggingGuidePos * store.zoom}px` : undefined
                       }"
                    >
                       <div :class="[
                           'absolute bg-cyan-500 text-white text-[10px] px-1 rounded',
                           draggingGuideType === 'horizontal' ? 'left-2 -top-4' : 'top-2 -left-4'
                       ]">
                          {{ Math.round(draggingGuidePos) }}
                       </div>
                    </div>
                    
                    <!-- Edge Highlight -->
                    <div v-if="store.highlightedEdge" class="absolute pointer-events-none">
                      <div 
                        v-if="store.highlightedEdge === 'top'" 
                        class="absolute left-0 w-full border-t border-pink-500"
                        :style="{ top: `${offsetY}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'bottom'" 
                        class="absolute left-0 w-full border-t border-pink-500"
                        :style="{ top: `${offsetY + store.canvasSize.height * store.zoom}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'left'" 
                        class="absolute top-0 h-full border-l border-pink-500"
                        :style="{ left: `${offsetX}px` }"
                      ></div>
                      <div 
                        v-else-if="store.highlightedEdge === 'right'" 
                        class="absolute top-0 h-full border-l border-pink-500"
                        :style="{ left: `${offsetX + store.canvasSize.width * store.zoom}px` }"
                      ></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
        
        <!-- <footer class="h-6 bg-white border-t border-gray-200 text-xs flex items-center px-4 text-gray-500 z-30">
           Ready
        </footer> -->

        <!-- Minimap -->
        <div class="absolute bottom-4 right-4 z-50">
          <Minimap
            :scroll-width="scrollWidth"
            :scroll-height="scrollHeight"
            :viewport-width="viewportWidth"
            :viewport-height="viewportHeight"
            :scroll-left="scrollX"
            :scroll-top="scrollY"
            :pages="store.pages"
            :page-width="store.canvasSize.width"
            :page-height="store.canvasSize.height"
            :zoom="store.zoom"
            :content-offset-x="offsetX" 
            :content-offset-y="offsetY"
            @update:scroll="handleMinimapScroll"
          />
        </div>
      </main>
      <PropertiesPanel />
    </div>
  </div>
</template>
