<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import type { PrintElement } from '@/types';
import DeleteIcon from '~icons/material-symbols/delete';
import CutIcon from '~icons/material-symbols/content-cut';
import CopyIcon from '~icons/material-symbols/content-copy';
import PasteIcon from '~icons/material-symbols/content-paste';
import LockIcon from '~icons/material-symbols/lock';
import UnlockIcon from '~icons/material-symbols/lock-open';
import UndoIcon from '~icons/material-symbols/undo';
import RedoIcon from '~icons/material-symbols/redo';

const store = useDesignerStore();
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const clickX = ref(0);
const clickY = ref(0);
const menuRef = ref<HTMLElement | null>(null);
const canPasteHere = ref(false);
const currentMouseX = ref(0);
const currentMouseY = ref(0);

const handleMouseMove = (e: MouseEvent) => {
  currentMouseX.value = e.clientX;
  currentMouseY.value = e.clientY;
};

const getPasteTarget = (clientX: number, clientY: number) => {
  const pages = document.querySelectorAll('.print-page');
  if (pages.length === 0) return undefined;

  let closestPage: HTMLElement | null = null;
  let minDistance = Infinity;
  let targetPageIndex = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as HTMLElement;
    const rect = page.getBoundingClientRect();
    
    // Check if inside
    if (clientX >= rect.left && clientX <= rect.right && 
        clientY >= rect.top && clientY <= rect.bottom) {
        return {
            pageIndex: i,
            x: (clientX - rect.left) / store.zoom,
            y: (clientY - rect.top) / store.zoom
        };
    }

    // Calculate distance to rectangle
    const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
    const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist < minDistance) {
        minDistance = dist;
        closestPage = page;
        targetPageIndex = i;
    }
  }

  // Project onto closest page
  if (closestPage) {
      const rect = closestPage.getBoundingClientRect();
      let x = (clientX - rect.left) / store.zoom;
      let y = (clientY - rect.top) / store.zoom;
      
      // Clamp to page bounds
      x = Math.max(0, Math.min(store.canvasSize.width, x));
      y = Math.max(0, Math.min(store.canvasSize.height, y));
      
      return { pageIndex: targetPageIndex, x, y };
  }

  return undefined;
};

const handleKeydown = (e: KeyboardEvent) => {
  // If global shortcuts are disabled (e.g. code editor is open), ignore
  if (store.disableGlobalShortcuts) return;

  // ignore when typing in inputs
  const target = e.target as Element | null;
  if (target && (target.closest('input, textarea, select, [contenteditable="true"]'))) return;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    const step = e.shiftKey ? 10 : 1;

    if (store.selectedGuideId) {
      const guide = store.guides.find(g => g.id === store.selectedGuideId);
      if (guide) {
        e.preventDefault();
        const prev = guide.position;
        let pos = prev;
        if (guide.type === 'vertical') {
          if (e.key === 'ArrowLeft') pos -= step;
          else if (e.key === 'ArrowRight') pos += step;
          else return;
        } else {
          if (e.key === 'ArrowUp') pos -= step;
          else if (e.key === 'ArrowDown') pos += step;
          else return;
        }
        if ((prev > 0 && pos < 0) || (prev < 0 && pos > 0) || pos === 0) {
          pos = 0;
        }
        store.updateGuide(guide.id, pos);
        store.setHighlightedGuide(guide.id);
      }
    } else if (store.selectedElementIds.length > 0) {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
      const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
      store.nudgeSelectedElements(dx, dy);
    }
    return;
  }
  // Select All (Ctrl/Cmd + A)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if (store.pages[store.currentPageIndex]) {
      const allIds = store.pages[store.currentPageIndex].elements.map(el => el.id);
      store.setSelection(allIds);
    }
    return;
  }

  // Delete
  if (e.key === 'Delete') {
    if (store.selectedElementIds.length > 1) {
      e.preventDefault();
      store.removeSelectedElements();
    } else if (store.selectedElementId) {
      e.preventDefault();
      store.removeElement(store.selectedElementId);
    } else if (store.selectedGuideId) {
      e.preventDefault();
      store.removeGuide(store.selectedGuideId);
    }
    return;
  }

  // Copy (Ctrl/Cmd + C)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    if (store.selectedElementId) {
      e.preventDefault();
      store.copy();
    }
    return;
  }

  // Cut (Ctrl/Cmd + X)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
    if (store.selectedElementId) {
      e.preventDefault();
      store.cut();
    }
    return;
  }

  // Paste (Ctrl/Cmd + V)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (store.clipboard.length > 0) {
      e.preventDefault();
      store.paste(getPasteTarget(currentMouseX.value, currentMouseY.value));
    }
    return;
  }

  // Help (Ctrl/Cmd + H)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    store.setShowHelp(true);
    return;
  }
  
  // Close Help (Escape)
  if (store.showHelp && e.key === 'Escape') {
    e.preventDefault();
    store.setShowHelp(false);
    return;
  }

  // Undo (Ctrl/Cmd + Z)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.undo();
    return;
  }

  // Redo (Ctrl/Cmd + Y) or (Ctrl+Shift+Z)
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    store.redo();
    return;
  }

  // Lock/Unlock (Ctrl/Cmd + L)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    store.toggleLock();
    return;
  }

  // Preview (Ctrl + Shift + P)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('designer:preview'));
    return;
  }

  // Save (Ctrl + S)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('designer:save'));
    return;
  }

  // Print (Ctrl + P)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('designer:print'));
    return;
  }

  // Export PDF (Ctrl + Shift + E)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('designer:export-pdf'));
    return;
  }

  // View JSON (Ctrl + Shift + J)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('designer:view-json'));
    return;
  }
};

const handleKeyup = (e: KeyboardEvent) => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    // Clear highlight after arrow movement stops
    store.setHighlightedGuide(null);
    store.setHighlightedEdge(null);
  }
};

const handleContextMenu = async (e: MouseEvent) => {
  // Check if the click is inside the designer area
  const target = e.target as Element;
  const designerArea = document.querySelector('.overflow-auto'); // The scroll container (canvas area)

  if (!designerArea || !designerArea.contains(target)) {
    // Not in designer area, show native context menu
    return;
  }

  // Inside designer area, show custom context menu
  e.preventDefault();
  showMenu.value = true;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  clickX.value = e.clientX;
  clickY.value = e.clientY;
  
  // Adjust menu position if it overflows the screen
  await nextTick();
  if (menuRef.value) {
    const rect = menuRef.value.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (e.clientX + rect.width > winWidth) {
      menuX.value = winWidth - rect.width - 5;
    }
    if (e.clientY + rect.height > winHeight) {
      menuY.value = winHeight - rect.height - 5;
    }
  }

  // Only allow paste when right-click occurs within any print page (canvas)
  const pages = document.querySelectorAll('.print-page');
  let inside = false;
  pages.forEach((p) => {
    const rect = (p as HTMLElement).getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      inside = true;
    }
  });
  canPasteHere.value = inside;
  window.addEventListener('click', closeMenuOnce);
};

const closeMenuOnce = () => {
  showMenu.value = false;
  window.removeEventListener('click', closeMenuOnce);
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('mousemove', handleMouseMove);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('contextmenu', handleContextMenu);
  window.removeEventListener('click', closeMenuOnce);
  window.removeEventListener('keyup', handleKeyup);
  window.removeEventListener('mousemove', handleMouseMove);
});
</script>

<template>
  <div v-if="showMenu" ref="menuRef" class="fixed z-[9999]" :style="{ left: `${menuX}px`, top: `${menuY}px` }">
    <div class="bg-white border border-gray-200 shadow-xl rounded-md min-w-[160px] py-1">
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        :disabled="(store.selectedElementIds.length === 0 && !store.selectedGuideId) || (store.selectedElement?.locked)"
        @click="() => {
          if (store.selectedElementIds.length > 1) {
            store.removeSelectedElements();
          } else if (store.selectedElementId) {
            store.removeElement(store.selectedElementId);
          } else if (store.selectedGuideId) {
            store.removeGuide(store.selectedGuideId);
          }
          showMenu=false;
        }"
      >
        <DeleteIcon class="w-4 h-4" />
        <span>Delete{{ store.selectedElementIds.length > 1 ? ` (${store.selectedElementIds.length})` : '' }}</span>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        :disabled="!store.selectedElementId || store.selectedElement?.locked"
        @click="() => { store.cut(); showMenu=false; }"
      >
        <CutIcon class="w-4 h-4" />
        <span>Cut</span>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        :disabled="!store.selectedElementId || store.selectedElement?.locked"
        @click="() => { store.copy(); showMenu=false; }"
      >
        <CopyIcon class="w-4 h-4" />
        <span>Copy</span>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        :disabled="store.clipboard.length === 0"
        @click="() => { store.paste(getPasteTarget(clickX, clickY)); showMenu=false; }"
      >
        <PasteIcon class="w-4 h-4" />
        <span>Paste</span>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
        :disabled="store.selectedElementIds.length === 0"
        @click="() => { store.toggleLock(); showMenu=false; }"
      >
        <component :is="store.selectedElement?.locked ? UnlockIcon : LockIcon" class="w-4 h-4" />
        <span>{{ store.selectedElement?.locked ? 'Unlock' : 'Lock' }}</span>
      </button>
      <div class="border-t border-gray-200 my-1"></div>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
        @click="store.undo(); showMenu=false;"
      >
        <UndoIcon class="w-4 h-4" />
        <span>Undo</span>
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
        @click="store.redo(); showMenu=false;"
      >
        <RedoIcon class="w-4 h-4" />
        <span>Redo</span>
      </button>
    </div>
  </div>
</template>
