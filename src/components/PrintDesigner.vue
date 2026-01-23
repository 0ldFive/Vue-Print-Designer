<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import Header from './layout/Header.vue';
import Sidebar from './layout/Sidebar.vue';
import PropertiesPanel from './layout/PropertiesPanel.vue';
import Canvas from './canvas/Canvas.vue';
import Ruler from './layout/Ruler.vue';
import Shortcuts from './layout/Shortcuts.vue';

const store = useDesignerStore();
const scrollContainer = ref<HTMLElement | null>(null);
const canvasContainer = ref<HTMLElement | null>(null);

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

const updateOffset = () => {
  if (scrollContainer.value && canvasContainer.value) {
    // Update scroll dimensions
    scrollWidth.value = scrollContainer.value.scrollWidth;
    scrollHeight.value = scrollContainer.value.scrollHeight;

    // We need to find the position of the first page relative to the scroll container content
    // But since Canvas component renders pages with transform scale, getting exact visual position is tricky.
    // However, the flex container centers the Canvas wrapper.
    // The Canvas wrapper has `flex flex-col gap-8 pb-20`.
    // The visual left of the content is (scrollContainerWidth - (canvasWidth * zoom)) / 2 if centered.
    // But we are using `justify-center`.
    
    const containerWidth = scrollContainer.value.clientWidth;
    // We assume Canvas component renders pages of width `store.canvasSize.width`
    const contentWidth = store.canvasSize.width * store.zoom;
    
    if (contentWidth < containerWidth) {
       // Centered
       offsetX.value = (containerWidth - contentWidth) / 2;
    } else {
       // Left aligned (due to overflow)
       // Note: when overflow-auto + justify-center, if content overflows, it usually starts at left 0.
       // However, there is padding p-8 (32px).
       offsetX.value = 32; 
    }
    
    // Top offset is padding top (32px)
    offsetY.value = 32;
  }
};

onMounted(() => {
  updateOffset();
  window.addEventListener('resize', updateOffset);
  // Also watch for store changes that might affect layout
  store.$subscribe(() => {
    nextTick(updateOffset);
  });
});

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
                class="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center items-start relative"
                @scroll="handleScroll"
              >
                 <Canvas ref="canvasContainer" />

                 <!-- Guides Overlay -->
                 <div class="absolute top-0 left-0 pointer-events-none z-50" :style="{ width: `${scrollWidth}px`, height: `${scrollHeight}px` }">
                    <!-- Existing Guides -->
                    <template v-for="guide in store.guides" :key="guide.id">
                       <div 
                          v-if="guide.type === 'horizontal'"
                          class="absolute left-0 w-full h-3 -mt-1.5 cursor-row-resize pointer-events-auto group flex flex-col justify-center"
                          :style="{ top: `${offsetY + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => handleGuideDragStart(e, 'horizontal', guide.id)"
                       >
                          <div class="w-full border-t border-cyan-500 group-hover:border-cyan-400"></div>
                          <div class="absolute left-2 -top-4 bg-cyan-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                             {{ Math.round(guide.position) }}
                          </div>
                       </div>
                       <div 
                          v-else
                          class="absolute top-0 h-full w-3 -ml-1.5 cursor-col-resize pointer-events-auto group flex flex-row justify-center"
                          :style="{ left: `${offsetX + guide.position * store.zoom}px` }"
                          @mousedown.stop="(e) => handleGuideDragStart(e, 'vertical', guide.id)"
                       >
                           <div class="h-full border-l border-cyan-500 group-hover:border-cyan-400"></div>
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
                 </div>
              </div>
           </div>
        </div>
        
        <footer class="h-6 bg-white border-t border-gray-200 text-xs flex items-center px-4 text-gray-500 z-30">
           Ready
        </footer>
      </main>
      <PropertiesPanel />
    </div>
  </div>
</template>
