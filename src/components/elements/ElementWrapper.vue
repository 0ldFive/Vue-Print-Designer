<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PrintElement } from '@/types';
import { ElementType } from '@/types';
import { useDesignerStore } from '@/stores/designer';
import Lock from '~icons/material-symbols/lock';
import RotateRight from '~icons/material-symbols/rotate-right';

const props = defineProps<{
  element: PrintElement;
  isSelected: boolean;
  zoom: number;
  pageIndex: number;
  readOnly?: boolean;
}>();

const { t } = useI18n();
const store = useDesignerStore();
const elementRef = ref<HTMLElement | null>(null);

const designerRoot = inject<Ref<HTMLElement | null>>('designer-root', ref(null));
const getQueryRoot = () => {
  return (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document;
};

const actualIsSelected = computed(() => {
  const isMultiSelected = !props.isSelected && store.selectedElementIds.includes(props.element.id);
  return !props.readOnly && (props.isSelected || isMultiSelected);
});

const style = computed(() => {
  let hoverAlignedBorderWidth = 1;
  const baseStyle: Record<string, any> = {
    left: `${props.element.x}px`,
    top: `${props.element.y}px`,
    width: `${props.element.width}px`,
    height: `${props.element.height}px`,
    zIndex: props.element.style.zIndex || 1,
    transform: `rotate(${props.element.style.rotate || 0}deg)`,
    ...props.element.style,
  };

  // Handle structured border properties
  // Skip border/background for self-bordered elements (Table, Line, Rect, Circle)
  const selfBorderedTypes = [ElementType.TABLE, ElementType.LINE, ElementType.RECT, ElementType.CIRCLE];
  
  if (selfBorderedTypes.includes(props.element.type)) {
    // For these elements, background and borders are handled internally
    // We must remove them from the wrapper to avoid double rendering or artifacts (e.g. square background behind circle)
    delete baseStyle.backgroundColor;
    
    // Borders are already handled by not adding them below, but we also need to ensure
    // any border props in element.style don't leak through via the spread above if they match standard CSS names
    // (though usually they are structured properties like borderWidth, which don't affect CSS directly unless mapped)
    // However, 'border' shorthand might be there.
    delete baseStyle.border;
    delete baseStyle.borderWidth;
    delete baseStyle.borderStyle;
    delete baseStyle.borderColor;
    delete baseStyle.borderRadius; // Rect handles its own radius
  }

  if (!selfBorderedTypes.includes(props.element.type) && props.element.style.borderStyle && props.element.style.borderStyle !== 'none') {
    baseStyle.borderStyle = props.element.style.borderStyle;
    baseStyle.borderWidth = `${props.element.style.borderWidth || 1}px`;
    baseStyle.borderColor = props.element.style.borderColor || '#000';
    hoverAlignedBorderWidth = Number(props.element.style.borderWidth || 1);
    // Remove shorthand border to avoid override
    delete baseStyle.border;
  }
  // Handle legacy string border
  else if (!selfBorderedTypes.includes(props.element.type) && props.element.style.border) {
    baseStyle.border = props.element.style.border;
    const legacyBorderWidthMatch = String(props.element.style.border).match(/^(\d+(?:\.\d+)?)px/i);
    hoverAlignedBorderWidth = legacyBorderWidthMatch ? Number(legacyBorderWidthMatch[1]) : 1;
  }
  // Default invisible border
  else {
    baseStyle.border = '1px dashed transparent';
    hoverAlignedBorderWidth = 1;
  }

  // Keep outer width/height equal to the element size regardless of border width.
  baseStyle.boxSizing = 'border-box';

  // Keep hover outline on the exact same edge as the current wrapper border.
  baseStyle['--hover-outline-offset'] = `${-hoverAlignedBorderWidth}px`;
  baseStyle['--hover-outline-color'] = actualIsSelected.value ? 'transparent' : 'var(--brand-300)';

  return baseStyle;
});

const isAlignmentTarget = computed(() => {
  if (props.readOnly) return false;
  if (actualIsSelected.value) return false;
  return store.highlightedAlignedElementIds.includes(props.element.id);
});

// Dragging Logic
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let isDragging = false;
let hasSnapshot = false;

const handleMouseDown = (e: MouseEvent) => {
  if (props.readOnly) return;
  if (e.button !== 0) return; // Only left click
  // Don't start drag if clicking on resize/rotate handles
  if ((e.target as HTMLElement).closest('.resize-handle') || (e.target as HTMLElement).closest('.rotate-handle')) return;
  
  // e.stopPropagation();

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

  if (store.selectedElementIds.includes(props.element.id)) {
    store.bringElementsToFront(store.selectedElementIds);
  }

  if (props.element.locked) return; // Prevent drag if locked

  isDragging = true;
  store.setDragging(true);
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
      store.moveSelectedElements(props.element.id, initialLeft + dx, initialTop + dy, false, false);
    } else {
      store.moveElementWithSnap(props.element.id, initialLeft + dx, initialTop + dy, false, false);
    }
  }
};

const handleMouseUp = (e: MouseEvent) => {
  if (isDragging && hasSnapshot) {
     const root = getQueryRoot();
     const elementsFromPoint = root.elementsFromPoint(e.clientX, e.clientY);
     const pageElement = elementsFromPoint.find(el => el.classList.contains('print-page')) as HTMLElement;
     
     if (pageElement) {
        const pageId = pageElement.id; 
        const pageIndex = parseInt(pageId.replace('page-', ''), 10);
        
        if (!isNaN(pageIndex) && pageIndex !== props.pageIndex) {
           // Dropped on different page
           const oldPageElement = root.getElementById(`page-${props.pageIndex}`);
           if (oldPageElement) {
              const oldRect = oldPageElement.getBoundingClientRect();
              const newRect = pageElement.getBoundingClientRect();
              
              const dxPage = (oldRect.left - newRect.left) / props.zoom;
              const dyPage = (oldRect.top - newRect.top) / props.zoom;

              const idsToMove = (store.selectedElementIds.length > 1 && store.selectedElementIds.includes(props.element.id))
                  ? [...store.selectedElementIds]
                  : [props.element.id];

              idsToMove.forEach(id => {
                  const page = store.pages[props.pageIndex];
                  const el = page.elements.find(e => e.id === id);
                  if (el) {
                      store.moveElementToPage(id, pageIndex, el.x + dxPage, el.y + dyPage);
                  }
              });
           }
        } else {
            // Same page or global element (prevent moving to other page), enforce constraint
            if (store.selectedElementIds.length > 1 && store.selectedElementIds.includes(props.element.id)) {
                 store.moveSelectedElements(props.element.id, props.element.x, props.element.y, false, true);
            } else {
                 store.moveElementWithSnap(props.element.id, props.element.x, props.element.y, false, true);
            }
        }
     }
  }

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
  store.setDragging(false);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
  store.setHighlightedAlignedElements([]);
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

  type ResizeSnapCandidate = {
    point: number;
    type: 'edge' | 'guide' | 'element';
    edge?: 'right' | 'bottom';
    guideId?: string;
  };

  const SNAP_THRESHOLD = 6;
  const MIN_SIZE = 10;
  const ALIGN_EPSILON = 0.5;

  const findBestSnap = (target: number, candidates: ResizeSnapCandidate[]) => {
    let best: ResizeSnapCandidate | null = null;
    let bestDist = Infinity;

    for (const candidate of candidates) {
      const dist = Math.abs(target - candidate.point);
      if (dist > SNAP_THRESHOLD) continue;
      if (dist < bestDist - 1e-6) {
        best = candidate;
        bestDist = dist;
      }
    }

    return best;
  };

  const getResizeSnapResult = (targetWidth: number, targetHeight: number) => {
    const x = props.element.x;
    const y = props.element.y;

    let width = Math.max(MIN_SIZE, targetWidth);
    let height = Math.max(MIN_SIZE, targetHeight);

    const marginX = store.pageSpacingX || 0;
    const marginY = store.pageSpacingY || 0;
    const maxRightBoundary = store.canvasSize.width - marginX;
    const maxBottomBoundary = store.canvasSize.height - marginY;

    const page = store.pages[props.pageIndex];
    const selectedSet = new Set(store.selectedElementIds);
    selectedSet.add(props.element.id);
    const referenceElements = page
      ? page.elements.filter(item => !selectedSet.has(item.id))
      : [];

    const xCandidates: ResizeSnapCandidate[] = [];
    const yCandidates: ResizeSnapCandidate[] = [];

    if (maxRightBoundary - x >= MIN_SIZE) {
      xCandidates.push({ point: maxRightBoundary, type: 'edge', edge: 'right' });
    }
    if (maxBottomBoundary - y >= MIN_SIZE) {
      yCandidates.push({ point: maxBottomBoundary, type: 'edge', edge: 'bottom' });
    }

    for (const guide of store.guides) {
      if (guide.type === 'vertical' && guide.position - x >= MIN_SIZE) {
        xCandidates.push({ point: guide.position, type: 'guide', guideId: guide.id });
      }
      if (guide.type === 'horizontal' && guide.position - y >= MIN_SIZE) {
        yCandidates.push({ point: guide.position, type: 'guide', guideId: guide.id });
      }
    }

    for (const item of referenceElements) {
      const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
      const xPoints = [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX];
      const yPoints = [bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY];

      for (const point of xPoints) {
        if (point - x >= MIN_SIZE) {
          xCandidates.push({ point, type: 'element' });
        }
      }
      for (const point of yPoints) {
        if (point - y >= MIN_SIZE) {
          yCandidates.push({ point, type: 'element' });
        }
      }
    }

    const targetRight = x + width;
    const targetBottom = y + height;
    const bestX = findBestSnap(targetRight, xCandidates);
    const bestY = findBestSnap(targetBottom, yCandidates);

    if (bestX) {
      width = Math.max(MIN_SIZE, bestX.point - x);
    }
    if (bestY) {
      height = Math.max(MIN_SIZE, bestY.point - y);
    }

    const highlightedAlignedElementIds = new Set<string>();
    const snappedRight = x + width;
    const snappedBottom = y + height;

    if (bestX?.type === 'element' || bestY?.type === 'element') {
      for (const item of referenceElements) {
        const bounds = store.getElementBoundsAtPosition(item, item.x, item.y);
        if (bestX?.type === 'element') {
          const xPoints = [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX];
          if (xPoints.some(point => Math.abs(point - snappedRight) <= ALIGN_EPSILON)) {
            highlightedAlignedElementIds.add(item.id);
          }
        }
        if (bestY?.type === 'element') {
          const yPoints = [bounds.minY, (bounds.minY + bounds.maxY) / 2, bounds.maxY];
          if (yPoints.some(point => Math.abs(point - snappedBottom) <= ALIGN_EPSILON)) {
            highlightedAlignedElementIds.add(item.id);
          }
        }
      }
    }

    let highlightedEdge: 'left' | 'top' | 'right' | 'bottom' | null = null;
    if (bestX?.type === 'edge') {
      highlightedEdge = 'right';
    }
    if (bestY?.type === 'edge') {
      highlightedEdge = highlightedEdge || 'bottom';
    }

    let highlightedGuideId: string | null = null;
    if (bestX?.type === 'guide') {
      highlightedGuideId = bestX.guideId || null;
    }
    if (!highlightedGuideId && bestY?.type === 'guide') {
      highlightedGuideId = bestY.guideId || null;
    }

    return {
      width,
      height,
      highlightedEdge,
      highlightedGuideId,
      highlightedAlignedElementIds: Array.from(highlightedAlignedElementIds)
    };
  };
  
  const startX = e.clientX;
  const startY = e.clientY;
  const initialWidth = props.element.width;
  const initialHeight = props.element.height;
  hasSnapshot = false;
  store.setDragging(true);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
  store.setHighlightedAlignedElements([]);
  
  const handleResizeMove = (moveEvent: MouseEvent) => {
    const dx = (moveEvent.clientX - startX) / props.zoom;
    const dy = (moveEvent.clientY - startY) / props.zoom;
    
    if (!hasSnapshot) {
      store.snapshot();
      hasSnapshot = true;
    }

    let newWidth = initialWidth + dx;
    let newHeight = initialHeight + dy;

    if (moveEvent.shiftKey) {
      const ratio = initialWidth / initialHeight;
      // Use the larger relative change to drive the size
      if (Math.abs(newWidth / initialWidth - 1) > Math.abs(newHeight / initialHeight - 1)) {
        newHeight = newWidth / ratio;
      } else {
        newWidth = newHeight * ratio;
      }
    }

    const snapped = getResizeSnapResult(newWidth, newHeight);
    store.setHighlightedGuide(snapped.highlightedGuideId || null);
    store.setHighlightedEdge(snapped.highlightedEdge || null);
    store.setHighlightedAlignedElements(snapped.highlightedAlignedElementIds || []);

    store.updateElement(props.element.id, {
      width: snapped.width,
      height: snapped.height
    }, false);
  };
  
  const handleResizeUp = () => {
    store.setDragging(false);
    store.setHighlightedGuide(null);
    store.setHighlightedEdge(null);
    store.setHighlightedAlignedElements([]);
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
    class="element-wrapper absolute select-none"
    :data-element-id="element.id"
    :data-read-only="readOnly ? 'true' : 'false'"
    :data-repeat-per-page="element.repeatPerPage === true ? 'true' : null"
    :data-alignment-target="isAlignmentTarget ? 'true' : null"
    :class="[
      readOnly ? 'cursor-not-allowed' : 'group theme-outline-hover',
      !readOnly && element.locked ? 'cursor-not-allowed' : '',
      !readOnly && !element.locked ? 'cursor-move' : ''
    ]"
    :style="style"
    @mousedown="handleMouseDown"
  >
    <!-- Slot for specific element content -->
    <slot></slot>

    <div
      v-if="actualIsSelected"
      data-print-exclude="true"
      :class="[
        'absolute inset-0 box-border border-2 pointer-events-none z-40',
        element.locked ? 'border-red-500' : 'theme-border-strong'
      ]"
    ></div>

    <template v-if="isAlignmentTarget">
      <div data-print-exclude="true" class="absolute inset-0 pointer-events-none z-30">
        <div class="absolute inset-0 border-2 theme-border"></div>
        <div class="absolute inset-0" style="background-color: var(--brand-500-alpha-10);"></div>
        <div class="absolute w-px theme-bg-strong" style="left: 50%; top: 50%; height: min(45%, 20px); transform: translate(-0.5px, -50%);"></div>
        <div class="absolute h-px theme-bg-strong" style="left: 50%; top: 50%; width: min(45%, 20px); transform: translate(-50%, -0.5px);"></div>
      </div>
    </template>

    <!-- Locked Indicator -->
    <div v-if="!readOnly && element.locked && isSelected" data-print-exclude="true" class="absolute -top-3 -right-3 bg-red-500 rounded-full p-1 shadow-md z-50">
      <Lock class="w-3 h-3 text-white" />
    </div>

    <!-- Resize Handles (only visible when selected and not multi-selected) -->
    <template v-if="!readOnly && isSelected && store.selectedElementIds.length <= 1 && !element.locked">
       <!-- Resize Handle -->
       <div
         data-print-exclude="true"
         class="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-se-resize z-50"
         @mousedown="handleResizeStart"
       ></div>
       
       <!-- Rotation Handle (top right, no background) -->
       <div
         data-print-exclude="true"
         class="rotate-handle absolute -top-4 -right-5 w-5 h-5 flex items-center justify-center cursor-grab z-50 theme-text theme-text-hover"
         :title="t('common.rotate')"
         @mousedown="handleRotateStart"
       >
         <!-- Material Symbol Icon -->
         <RotateRight class="w-3 h-3" />
         
         <!-- Angle Tooltip -->
        <div v-if="isRotating" :class="['absolute top-6 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none font-sans font-normal not-italic leading-none tracking-normal normal-case', isSnapped ? 'theme-bg-strong text-white' : 'theme-bg-soft text-white']">
            {{ currentRotationDisplay }}°
         </div>
       </div>
    </template>
  </div>
</template>
