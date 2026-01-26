<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElementType } from '@/types';

const props = defineProps<{
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
}>();

const emit = defineEmits<{
  (e: 'update:scroll', pos: { left: number; top: number }): void;
}>();

const WIDTH = 180;
const GAP = 32; // match the gap in PrintDesigner (gap-8)

const ratio = computed(() => {
  if (props.scrollWidth <= 0) return 0.1;
  return WIDTH / props.scrollWidth;
});

const height = computed(() => {
  return props.scrollHeight * ratio.value;
});

const viewportStyle = computed(() => ({
  left: `${props.scrollLeft * ratio.value}px`,
  top: `${props.scrollTop * ratio.value}px`,
  width: `${props.viewportWidth * ratio.value}px`,
  height: `${props.viewportHeight * ratio.value}px`,
}));

const isDragging = ref(false);

const handleMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const viewportX = props.scrollLeft * ratio.value;
  const viewportY = props.scrollTop * ratio.value;
  const viewportW = props.viewportWidth * ratio.value;
  const viewportH = props.viewportHeight * ratio.value;
  
  let startOffsetX = 0;
  let startOffsetY = 0;

  if (
    x >= viewportX && x <= viewportX + viewportW &&
    y >= viewportY && y <= viewportY + viewportH
  ) {
    // Clicked inside viewport
    startOffsetX = x - viewportX;
    startOffsetY = y - viewportY;
  } else {
    // Clicked outside - jump center to click
    const newLeft = (x / ratio.value) - (props.viewportWidth / 2);
    const newTop = (y / ratio.value) - (props.viewportHeight / 2);
    emit('update:scroll', { left: newLeft, top: newTop });
    
    startOffsetX = viewportW / 2;
    startOffsetY = viewportH / 2;
  }

  isDragging.value = true;

  const onMouseMove = (ev: MouseEvent) => {
    const currentRect = container.getBoundingClientRect();
    const currentX = ev.clientX - currentRect.left;
    const currentY = ev.clientY - currentRect.top;
    
    const newViewportX = currentX - startOffsetX;
    const newViewportY = currentY - startOffsetY;
    
    emit('update:scroll', {
      left: newViewportX / ratio.value,
      top: newViewportY / ratio.value
    });
  };

  const onMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};
</script>

<template>
  <div 
    class="bg-white border border-gray-200 shadow-lg rounded overflow-hidden relative select-none"
    :style="{ width: `${WIDTH}px`, height: `${height}px` }"
    @mousedown="handleMouseDown"
  >
    <!-- Background -->
    <div class="absolute inset-0 bg-gray-100"></div>

    <!-- Pages -->
    <div 
      v-for="(page, index) in pages" 
      :key="index"
      class="absolute bg-white shadow-sm border border-gray-300 overflow-hidden"
      :style="{
        left: `${(contentOffsetX) * ratio}px`,
        top: `${(contentOffsetY + index * (pageHeight + GAP) * zoom) * ratio}px`,
        width: `${pageWidth * zoom * ratio}px`,
        height: `${pageHeight * zoom * ratio}px`
      }"
    >
      <!-- Elements -->
      <div 
        v-for="element in page.elements" 
        :key="element.id"
        class="absolute"
        :style="{
          left: `${element.x * zoom * ratio}px`,
          top: `${element.y * zoom * ratio}px`,
          width: `${element.width * zoom * ratio}px`,
          height: `${element.height * zoom * ratio}px`,
          fontSize: `${(element.style.fontSize || 12) * zoom * ratio}px`,
          zIndex: element.style.zIndex || 1,
          transform: `rotate(${element.style.rotate || 0}deg)`,
          backgroundColor: element.type === ElementType.IMAGE ? '#e5e7eb' : undefined
        }"
      >
        <!-- Text -->
        <div 
          v-if="element.type === ElementType.TEXT" 
          class="w-full h-full overflow-hidden whitespace-nowrap"
          :style="{
             color: element.style.color || '#000000',
             fontFamily: element.style.fontFamily,
             fontWeight: element.style.fontWeight,
             fontStyle: element.style.fontStyle,
             textAlign: element.style.textAlign,
             lineHeight: 1
          }"
        >
          {{ element.content }}
        </div>
        
        <!-- Image Placeholder -->
        <div 
          v-else-if="element.type === ElementType.IMAGE" 
          class="w-full h-full bg-gray-200 flex items-center justify-center overflow-hidden"
        >
          <img v-if="element.content" :src="element.content" class="w-full h-full object-cover" />
        </div>

        <!-- Table Placeholder -->
        <div 
           v-else-if="element.type === ElementType.TABLE"
           class="w-full h-full border border-gray-300 bg-white grid"
           :style="{
             gridTemplateColumns: `repeat(${element.columns?.length || 2}, 1fr)`
           }"
        >
           <div v-for="i in Math.min(6, (element.columns?.length || 2) * 2)" :key="i" class="border-[0.5px] border-gray-100"></div>
        </div>
      </div>
    </div>

    <!-- Viewport -->
    <div 
      class="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move z-[1000]"
      :style="viewportStyle"
    ></div>
  </div>
</template>
