<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { pxToMm } from '@/utils/units';
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
  nextTick(() => {
    updateOffset();
  });
  window.addEventListener('resize', updateOffset);
  window.addEventListener('keydown', handleCtrlKey);
  window.addEventListener('keyup', handleCtrlKey);
  window.addEventListener('blur', handleBlur);
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

    scrollX.value = scrollContainer.value.scrollLeft;
    scrollY.value = scrollContainer.value.scrollTop;

    offsetX.value = wrapperRect.left - containerRect.left + scrollContainer.value.scrollLeft;
    offsetY.value = wrapperRect.top - containerRect.top + scrollContainer.value.scrollTop;
  }
};

onUnmounted(() => {
  window.removeEventListener('resize', updateOffset);
  window.removeEventListener('mousemove', handleGuideMouseMove);
  window.removeEventListener('mouseup', handleGuideMouseUp);
  window.removeEventListener('keydown', handleCtrlKey);
  window.removeEventListener('keyup', handleCtrlKey);
  window.removeEventListener('blur', handleBlur);
  scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
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

const handleZoomWheel = (e: WheelEvent) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom In
      store.setZoom(Math.min(5, store.zoom + 0.1));
    } else {
      // Zoom Out
      store.setZoom(Math.max(0.2, store.zoom - 0.1));
    }
  }
};

const handleCtrlKey = (e: KeyboardEvent) => {
  if (e.key === 'Control' || e.key === 'Meta') {
    if (e.type === 'keydown' && !e.repeat) {
      scrollContainer.value?.addEventListener('wheel', handleZoomWheel, { passive: false });
    } else if (e.type === 'keyup') {
      scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
    }
  }
};

const handleBlur = () => {
  scrollContainer.value?.removeEventListener('wheel', handleZoomWheel);
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

const getRotatedBounds = (el: any) => {
  const rotation = el.style?.rotate || 0;
  if (rotation === 0) {
    return {
      minX: el.x,
      maxX: el.x + el.width,
      minY: el.y,
      maxY: el.y + el.height
    };
  }

  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x, y: el.y + el.height },
    { x: el.x + el.width, y: el.y + el.height }
  ];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const p of corners) {
    const nx = cx + (p.x - cx) * cos - (p.y - cy) * sin;
    const ny = cy + (p.x - cx) * sin + (p.y - cy) * cos;
    
    if (nx < minX) minX = nx;
    if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny;
    if (ny > maxY) maxY = ny;
  }

  return { minX, maxX, minY, maxY };
};

const dragProjection = computed(() => {
  if (!store.isDragging || store.selectedElementIds.length === 0) return null;

  const elements: any[] = [];
  for (const id of store.selectedElementIds) {
    for (const page of store.pages) {
      const el = page.elements.find(e => e.id === id);
      if (el) elements.push(el);
    }
  }

  if (elements.length === 0) return null;

  let globalMinX = Infinity;
  let globalMaxX = -Infinity;
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  for (const el of elements) {
    const bounds = getRotatedBounds(el);
    if (bounds.minX < globalMinX) globalMinX = bounds.minX;
    if (bounds.maxX > globalMaxX) globalMaxX = bounds.maxX;
    if (bounds.minY < globalMinY) globalMinY = bounds.minY;
    if (bounds.maxY > globalMaxY) globalMaxY = bounds.maxY;
  }

  const centerX = (globalMinX + globalMaxX) / 2;
  const centerY = (globalMinY + globalMaxY) / 2;

  return { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY, centerX, centerY };
});

const rulerIndicators = computed(() => {
  if (!dragProjection.value) return { h: [], v: [] };
  
  const { minX, maxX, minY, maxY } = dragProjection.value;
  
  return {
    h: [
      { position: minX, color: 'rgba(6, 182, 212, 0.5)' },
      { position: maxX, color: 'rgba(6, 182, 212, 0.5)' }
    ],
    v: [
      { position: minY, color: 'rgba(6, 182, 212, 0.5)' },
      { position: maxY, color: 'rgba(6, 182, 212, 0.5)' }
    ]
  };
});
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
                    :indicators="rulerIndicators.h"
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
                    :indicators="rulerIndicators.v"
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
                    
                    <!-- Dragging Distance Guides -->
                     <template v-if="dragProjection">
                       <!-- Top Line -->
                       <div class="absolute w-full border-t border-cyan-500 border-dashed"
                            :style="{ top: `${offsetY + dragProjection.minY * store.zoom}px`, left: 0 }">
                          <div class="absolute -top-6 bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                               :style="{ left: `${scrollX + 10}px` }">
                             {{ pxToMm(dragProjection.minY).toFixed(1) }} mm
                          </div>
                       </div>
                       <!-- Bottom Line -->
                       <div class="absolute w-full border-t border-cyan-500 border-dashed"
                            :style="{ top: `${offsetY + dragProjection.maxY * store.zoom}px`, left: 0 }">
                          <div class="absolute -top-6 bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm"
                               :style="{ left: `${scrollX + 10}px` }">
                             {{ pxToMm(dragProjection.maxY).toFixed(1) }} mm
                          </div>
                       </div>
                       <!-- Left Line -->
                       <div class="absolute h-full border-l border-cyan-500 border-dashed"
                            :style="{ left: `${offsetX + dragProjection.minX * store.zoom}px`, top: 0 }">
                          <div class="absolute -left-2 transform -translate-x-full bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                               :style="{ top: `${scrollY + 10}px` }">
                             {{ pxToMm(dragProjection.minX).toFixed(1) }} mm
                          </div>
                       </div>
                       <!-- Right Line -->
                       <div class="absolute h-full border-l border-cyan-500 border-dashed"
                            :style="{ left: `${offsetX + dragProjection.maxX * store.zoom}px`, top: 0 }">
                          <div class="absolute -left-2 transform -translate-x-full bg-cyan-500 text-white text-xs px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
                               :style="{ top: `${scrollY + 10}px` }">
                             {{ pxToMm(dragProjection.maxX).toFixed(1) }} mm
                          </div>
                       </div>
                     </template>

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
                             {{ pxToMm(guide.position) }}mm
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
                             {{ pxToMm(guide.position) }}mm
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
                          {{ pxToMm(draggingGuidePos) }}mm
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
        <div v-if="store.showMinimap" class="absolute bottom-4 right-4 z-50">
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
