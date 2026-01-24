<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import cloneDeep from 'lodash/cloneDeep';
import type { PrintElement } from '@/types';

const store = useDesignerStore();
const clipboard = ref<PrintElement | null>(null);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const canPasteHere = ref(false);

const handleKeydown = (e: KeyboardEvent) => {
  // ignore when typing in inputs
  const target = e.target as Element | null;
  if (target && (target.closest('input, textarea, select, [contenteditable="true"]'))) return;
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
      const el = store.selectedElement;
      if (el) clipboard.value = cloneDeep(el);
    }
    return;
  }

  // Paste (Ctrl/Cmd + V)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (clipboard.value) {
      e.preventDefault();
      const pasted = cloneDeep(clipboard.value);
      // Slight offset
      pasted.x += 10;
      pasted.y += 10;
      // Remove id, will be recreated by store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pasted as any).id = undefined;
      store.addElement(pasted as Omit<PrintElement, 'id'>);
    }
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
};

const handleContextMenu = (e: MouseEvent) => {
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
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('contextmenu', handleContextMenu);
  window.removeEventListener('click', closeMenuOnce);
});
</script>

<template>
  <div v-if="showMenu" class="fixed z-[9999]" :style="{ left: `${menuX}px`, top: `${menuY}px` }">
    <div class="bg-white border border-gray-200 shadow-xl rounded-md min-w-[160px] py-1">
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        :disabled="(store.selectedElementIds.length === 0 && !store.selectedGuideId)"
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
        Delete{{ store.selectedElementIds.length > 1 ? ` (${store.selectedElementIds.length})` : '' }}
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        :disabled="!store.selectedElementId || !canPasteHere"
        @click="() => { if (store.selectedElementId && canPasteHere) { clipboard = store.selectedElement ? cloneDeep(store.selectedElement) : null; } showMenu=false; }"
      >
        Copy
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        :disabled="!clipboard || !canPasteHere"
        @click="() => { if (clipboard && canPasteHere) { const p = cloneDeep(clipboard); (p as any).id = undefined; p.x += 10; p.y += 10; store.addElement(p as Omit<PrintElement,'id'>); } showMenu=false; }"
      >
        Paste
      </button>
      <div class="border-t border-gray-200 my-1"></div>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
        @click="store.undo(); showMenu=false;"
      >
        Undo
      </button>
      <button
        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
        @click="store.redo(); showMenu=false;"
      >
        Redo
      </button>
    </div>
  </div>
</template>
