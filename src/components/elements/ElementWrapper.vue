<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PrintElement } from '@/types';
import { useDesignerStore } from '@/stores/designer';

const props = defineProps<{
  element: PrintElement;
  isSelected: boolean;
  zoom: number;
}>();

const store = useDesignerStore();
const elementRef = ref<HTMLElement | null>(null);

const style = computed(() => {
  const isMultiSelected = !props.isSelected && store.selectedElementIds.includes(props.element.id);
  const actualIsSelected = props.isSelected || isMultiSelected;
  return {
    left: `${props.element.x}px`,
    top: `${props.element.y}px`,
    width: `${props.element.width}px`,
    height: `${props.element.height}px`,
    zIndex: props.element.style.zIndex || 1,
    ...props.element.style,
    border: actualIsSelected ? '2px solid #3b82f6' : props.element.style.border || '1px dashed transparent',
  };
});

// Dragging Logic
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let isDragging = false;

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // Only left click
  e.stopPropagation();

  // Check for multi-select (Ctrl/Cmd key)
  const isMultiSelect = e.ctrlKey || e.metaKey;
  store.selectElement(props.element.id, isMultiSelect);

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialLeft = props.element.x;
  initialTop = props.element.y;

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  
  const dx = (e.clientX - startX) / props.zoom;
  const dy = (e.clientY - startY) / props.zoom;
  
  store.updateElement(props.element.id, {
    x: initialLeft + dx,
    y: initialTop + dy
  });
};

const handleMouseUp = () => {
  isDragging = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
};

// Resizing Logic (Simple bottom-right handle for now)
const handleResizeStart = (e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  
  const startX = e.clientX;
  const startY = e.clientY;
  const initialWidth = props.element.width;
  const initialHeight = props.element.height;
  
  const handleResizeMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;
    
    store.updateElement(props.element.id, {
      width: Math.max(10, initialWidth + dx),
      height: Math.max(10, initialHeight + dy)
    });
  };
  
  const handleResizeUp = () => {
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeUp);
  };
  
  window.addEventListener('mousemove', handleResizeMove);
  window.addEventListener('mouseup', handleResizeUp);
};

</script>

<template>
  <div
    ref="elementRef"
    class="element-wrapper absolute cursor-move select-none group hover:outline hover:outline-1 hover:outline-blue-300"
    :style="style"
    @mousedown="handleMouseDown"
  >
    <!-- Slot for specific element content -->
    <slot></slot>

    <!-- Resize Handles (only visible when selected and not multi-selected) -->
    <div
      v-if="isSelected && store.selectedElementIds.length <= 1"
      class="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-se-resize z-50"
      @mousedown="handleResizeStart"
    ></div>
  </div>
</template>
