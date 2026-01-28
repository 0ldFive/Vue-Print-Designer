<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PrintElement } from '@/types';
import { ElementType } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import Lock from '~icons/material-symbols/lock';
import RotateRight from '~icons/material-symbols/rotate-right';
 
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
  const baseStyle: Record<string, any> = {
    left: `${props.element.x}px`,
    top: `${props.element.y}px`,
    width: `${props.element.width}px`,
    height: `${props.element.height}px`,
    zIndex: props.element.style.zIndex || 1,
    transform: `rotate(${props.element.style.rotate || 0}deg)`,
    ...props.element.style,
  };

  if (actualIsSelected) {
    baseStyle.border = props.element.locked ? '2px solid #ef4444' : '2px solid #3b82f6';
  } else {
    // Handle structured border properties
    // Skip border for Table element as it handles its own borders internally
    if (props.element.type !== ElementType.TABLE && props.element.style.borderStyle && props.element.style.borderStyle !== 'none') {
      baseStyle.borderStyle = props.element.style.borderStyle;
      baseStyle.borderWidth = `${props.element.style.borderWidth || 1}px`;
      baseStyle.borderColor = props.element.style.borderColor || '#000';
      // Remove shorthand border to avoid override
      delete baseStyle.border;
    } 
    // Handle legacy string border
    else if (props.element.type !== ElementType.TABLE && props.element.style.border) {
      baseStyle.border = props.element.style.border;
    } 
    // Default invisible border
    else {
      baseStyle.border = '1px dashed transparent';
    }
  }

  return baseStyle;
});

// Dragging Logic
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let isDragging = false;
let hasSnapshot = false;

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // Only left click
  // Don't start drag if clicking on resize/rotate handles
  if ((e.target as HTMLElement).closest('.resize-handle') || (e.target as HTMLElement).closest('.rotate-handle')) return;
  
  e.stopPropagation();

  // Check for multi-select (Ctrl/Cmd key)
  const isMultiSelect = e.ctrlKey || e.metaKey;
  
  // Refined Selection Logic:
  // 1. If multi-selecting (Ctrl/Cmd), always toggle/add.
  // 2. If single-selecting (No modifier):
  //    a. If element is ALREADY selected, do NOT deselect others immediately (wait for mouse up).
  //       This allows dragging a group by clicking any member.
  //    b. If element is NOT selected, select it exclusively.
  
  if (isMultiSelect) {
    store.selectElement(props.element.id, true);
  } else {
    if (!store.selectedElementIds.includes(props.element.id)) {
      store.selectElement(props.element.id, false);
    }
    // If already selected, do nothing on mouse down to preserve group selection for dragging
  }

  if (props.element.locked) return; // Prevent drag if locked

  isDragging = true;
  hasSnapshot = false;
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
  
  // If we moved significantly, it's a drag operation
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    if (!hasSnapshot) {
      store.snapshot();
      hasSnapshot = true;
    }

    if (store.selectedElementIds.length > 1 && store.selectedElementIds.includes(props.element.id)) {
      store.moveSelectedElements(props.element.id, initialLeft + dx, initialTop + dy, false);
    } else {
      store.moveElementWithSnap(props.element.id, initialLeft + dx, initialTop + dy, false);
    }
  }
};

const handleMouseUp = (e: MouseEvent) => {
  // If we didn't drag (was a click), and it wasn't a multi-select action,
  // we should now ensure this element is exclusively selected.
  // This handles the "Click to select single item from group" case.
  if (isDragging && !hasSnapshot) {
    // Check if it was a simple click (no significant movement)
    // We can infer this from !hasSnapshot because hasSnapshot is set only on move
    // But we also need to check modifiers
    const isMultiSelect = e.ctrlKey || e.metaKey;
    if (!isMultiSelect) {
       store.selectElement(props.element.id, false);
    }
  }

  isDragging = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
};

// Resizing Logic (Simple bottom-right handle for now)
const isRotating = ref(false);
const isSnapped = ref(false);
const currentRotationDisplay = ref(0);

// Rotation Logic
const handleRotateStart = (e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();

  if (!elementRef.value) return;
  
  isRotating.value = true;
  isSnapped.value = false;
  hasSnapshot = false;
  currentRotationDisplay.value = props.element.style.rotate || 0;

  const rect = elementRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  const initialRotation = props.element.style.rotate || 0;

  const handleRotateMove = (moveEvent: MouseEvent) => {
    const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
    const degrees = (currentAngle - startAngle) * (180 / Math.PI);
    let newRotation = initialRotation + degrees;
    
    // Normalize to 0-360
    newRotation = newRotation % 360;
    if (newRotation < 0) newRotation += 360;

    isSnapped.value = false;

    // Snap to 45 degrees
    if (moveEvent.shiftKey) {
      newRotation = Math.round(newRotation / 45) * 45;
      isSnapped.value = true;
    } else if (!moveEvent.ctrlKey) {
      // Magnetic snap to 0, 90, 180, 270
      // User can hold Ctrl to disable snapping for fine adjustments
      const snapThreshold = 5;
      const targets = [0, 90, 180, 270, 360];
      
      for (const target of targets) {
        if (Math.abs(newRotation - target) <= snapThreshold) {
          newRotation = target === 360 ? 0 : target;
          isSnapped.value = true;
          break;
        }
      }
    }

    // Round to integer (Step 1)
    newRotation = Math.round(newRotation);
    if (newRotation === 360) newRotation = 0;
    
    currentRotationDisplay.value = newRotation;

    if (!hasSnapshot) {
      store.snapshot();
      hasSnapshot = true;
    }

    store.updateElement(props.element.id, {
      style: {
        ...props.element.style,
        rotate: newRotation
      }
    }, false);
  };

  const handleRotateUp = () => {
    isRotating.value = false;
    window.removeEventListener('mousemove', handleRotateMove);
    window.removeEventListener('mouseup', handleRotateUp);
  };

  window.addEventListener('mousemove', handleRotateMove);
  window.addEventListener('mouseup', handleRotateUp);
};

const handleResizeStart = (e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  
  const startX = e.clientX;
  const startY = e.clientY;
  const initialWidth = props.element.width;
  const initialHeight = props.element.height;
  hasSnapshot = false;
  
  const handleResizeMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;
    
    if (!hasSnapshot) {
      store.snapshot();
      hasSnapshot = true;
    }

    store.updateElement(props.element.id, {
      width: Math.max(10, initialWidth + dx),
      height: Math.max(10, initialHeight + dy)
    }, false);
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
    class="element-wrapper absolute select-none group hover:outline hover:outline-1 hover:outline-blue-300"
    :class="element.locked ? 'cursor-not-allowed' : 'cursor-move'"
    :style="style"
    @mousedown="handleMouseDown"
  >
    <!-- Slot for specific element content -->
    <slot></slot>

    <!-- Locked Indicator -->
    <div v-if="element.locked && isSelected" class="absolute -top-3 -right-3 bg-red-500 rounded-full p-1 shadow-md z-50">
      <Lock class="w-3 h-3 text-white" />
    </div>

    <!-- Resize Handles (only visible when selected and not multi-selected) -->
    <template v-if="isSelected && store.selectedElementIds.length <= 1 && !element.locked">
       <!-- Resize Handle -->
       <div
         class="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-se-resize z-50"
         @mousedown="handleResizeStart"
       ></div>
       
       <!-- Rotation Handle (top right, no background) -->
       <div
         class="rotate-handle absolute -top-4 -right-5 w-5 h-5 flex items-center justify-center cursor-grab z-50 text-blue-500 hover:text-blue-700"
         title="Rotate"
         @mousedown="handleRotateStart"
       >
         <!-- Material Symbol Icon -->
         <RotateRight class="w-3 h-3" />
         
         <!-- Angle Tooltip -->
         <div v-if="isRotating" :class="['absolute top-6 left-1/2 transform -translate-x-1/2 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none font-sans font-normal not-italic leading-none tracking-normal normal-case', isSnapped ? 'bg-green-600' : 'bg-black']">
            {{ currentRotationDisplay }}°
         </div>
       </div>
    </template>
  </div>
</template>
