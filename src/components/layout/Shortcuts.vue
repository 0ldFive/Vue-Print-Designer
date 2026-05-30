<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  ref,
  nextTick,
  inject,
  computed,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import { useTemplateStore } from "@/stores/templates";
import { formatShortcut } from "@/utils/os";
import { createNewElement } from "@/utils/elementFactory";
import DeleteIcon from "~icons/material-symbols/delete";
import CutIcon from "~icons/material-symbols/content-cut";
import CopyIcon from "~icons/material-symbols/content-copy"; // Reverted icon name
import PasteIcon from "~icons/material-symbols/content-paste";
import LockIcon from "~icons/material-symbols/lock";
import UnlockIcon from "~icons/material-symbols/lock-open";
import UndoIcon from "~icons/material-symbols/undo";
import RedoIcon from "~icons/material-symbols/redo";
import BringToFrontIcon from "~icons/material-symbols/vertical-align-top";
import SendToBackIcon from "~icons/material-symbols/vertical-align-bottom";
import MoveUpIcon from "~icons/material-symbols/arrow-upward";
import MoveDownIcon from "~icons/material-symbols/arrow-downward";
import CellMerge from "~icons/material-symbols/cell-merge";
import GridViewOutline from "~icons/material-symbols/grid-view-outline";
import ChevronRightIcon from "~icons/material-symbols/chevron-right";
import ImageIcon from "~icons/material-symbols/image";
import QrCodeIcon from "~icons/material-symbols/qr-code";
import BarcodeIcon from "~icons/material-symbols/barcode";
import { ElementType } from "@/types";

const { t } = useI18n();
const store = useDesignerStore();
const templateStore = useTemplateStore();
const designerRoot = inject<Ref<HTMLElement | null>>("designer-root");
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const clickX = ref(0);
const clickY = ref(0);
const menuRef = ref<HTMLElement | null>(null);
const canPasteHere = ref(false);
const currentMouseX = ref(0);
const currentMouseY = ref(0);

const canBringToFront = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "front");
});

const canSendToBack = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "back");
});

const canMoveLayerUp = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "forward");
});

const canMoveLayerDown = computed(() => {
  return store.canMoveElementsLayer(store.selectedElementIds, "backward");
});

const selectedTableSelectionElement = computed(() => {
  const selection = store.tableSelection;
  if (!selection) return null;

  for (const page of store.pages) {
    const element = page.elements.find(
      (item) => item.id === selection.elementId,
    );
    if (element?.type === ElementType.TABLE) return element;
  }

  return null;
});

const canMergeSelectedTableCells = computed(() => {
  const selection = store.tableSelection;
  const element = selectedTableSelectionElement.value;
  if (!store.isTemplateEditable || !selection || !element || element.locked) {
    return false;
  }
  if (selection.cells.length < 2) return false;
  const section = selection.cells[0].section || "body";
  return selection.cells.every((cell) => (cell.section || "body") === section);
});

const canSplitSelectedTableCell = computed(() => {
  const selection = store.tableSelection;
  const element = selectedTableSelectionElement.value;
  if (!store.isTemplateEditable || !selection || !element || element.locked) {
    return false;
  }
  if (selection.cells.length !== 1) return false;

  const cell = selection.cells[0];
  const targetData =
    (cell.section || "body") === "footer" ? element.footerData : element.data;
  const row = targetData?.[cell.rowIndex];
  const value = row?.[cell.colField];
  if (!value || typeof value !== "object") return false;

  return (value.rowSpan || 1) > 1 || (value.colSpan || 1) > 1;
});

const showTableCellActions = computed(() => {
  return !!store.tableSelection && !!selectedTableSelectionElement.value;
});

type InsertableElementType =
  | ElementType.IMAGE
  | ElementType.QRCODE
  | ElementType.BARCODE;

const canInsertIntoSelectedTableCell = computed(() => {
  const selection = store.tableSelection;
  const element = selectedTableSelectionElement.value;
  if (!store.isTemplateEditable || !selection || !element || element.locked) {
    return false;
  }

  return selection.cells.length === 1;
});

type SelectedTableCellGeometry = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  tableZIndex: number;
};

const getSelectedTableCellGeometry = (): SelectedTableCellGeometry | null => {
  const selection = store.tableSelection;
  const tableElement = selectedTableSelectionElement.value;
  if (!selection || !tableElement || selection.cells.length !== 1) {
    return null;
  }

  const targetCell = selection.cells[0];
  const targetSection = targetCell.section || "body";

  const tableWrapper = getQueryRoot().querySelector(
    `.element-wrapper[data-element-id="${tableElement.id}"]`,
  ) as HTMLElement | null;
  if (!tableWrapper) return null;

  const candidateCells = tableWrapper.querySelectorAll<HTMLElement>(
    "td[data-field][data-row-index][data-section]",
  );

  let matchedCell: HTMLElement | null = null;
  for (const cellEl of candidateCells) {
    if (
      cellEl.dataset.field === targetCell.colField &&
      cellEl.dataset.rowIndex === String(targetCell.rowIndex) &&
      (cellEl.dataset.section || "body") === targetSection
    ) {
      matchedCell = cellEl;
      break;
    }
  }

  if (!matchedCell) return null;

  const wrapperRect = tableWrapper.getBoundingClientRect();
  const cellRect = matchedCell.getBoundingClientRect();
  const zoom = store.zoom || 1;
  const localX = (cellRect.left - wrapperRect.left) / zoom;
  const localY = (cellRect.top - wrapperRect.top) / zoom;
  const cellWidth = cellRect.width / zoom;
  const cellHeight = cellRect.height / zoom;

  let pageIndex = store.pages.findIndex((page) =>
    page.elements.some((item) => item.id === tableElement.id),
  );
  if (pageIndex < 0) pageIndex = store.currentPageIndex;

  const tableZ = Number(tableElement.style?.zIndex ?? 1);
  const tableZIndex = Number.isFinite(tableZ) ? tableZ : 1;

  return {
    pageIndex,
    x: tableElement.x + localX,
    y: tableElement.y + localY,
    width: Math.max(1, cellWidth),
    height: Math.max(1, cellHeight),
    tableZIndex,
  };
};

const insertStandardElementIntoSelectedTableCell = (
  type: InsertableElementType,
) => {
  if (!canInsertIntoSelectedTableCell.value) return;

  const selection = store.tableSelection;
  const tableElement = selectedTableSelectionElement.value;
  if (!selection || !tableElement || selection.cells.length !== 1) return;
  const selectedCell = selection.cells[0];

  const geometry = getSelectedTableCellGeometry();
  if (!geometry) return;

  const cellPadding = 4;
  const availableWidth = Math.max(24, geometry.width - cellPadding * 2);
  const availableHeight = Math.max(24, geometry.height - cellPadding * 2);

  const newElement = createNewElement(
    type,
    geometry.x + cellPadding,
    geometry.y + cellPadding,
    t,
  );

  if (type === ElementType.QRCODE) {
    const side = Math.max(24, Math.min(availableWidth, availableHeight));
    newElement.width = side;
    newElement.height = side;
    newElement.x = geometry.x + (geometry.width - side) / 2;
    newElement.y = geometry.y + (geometry.height - side) / 2;
  } else if (type === ElementType.BARCODE) {
    const barcodeHeight = Math.max(24, Math.min(availableHeight, 80));
    newElement.width = availableWidth;
    newElement.height = barcodeHeight;
    newElement.x = geometry.x + (geometry.width - availableWidth) / 2;
    newElement.y = geometry.y + (geometry.height - barcodeHeight) / 2;
  } else {
    newElement.width = availableWidth;
    newElement.height = availableHeight;
    newElement.x = geometry.x + (geometry.width - availableWidth) / 2;
    newElement.y = geometry.y + (geometry.height - availableHeight) / 2;
  }

  newElement.style = {
    ...newElement.style,
    zIndex: Math.max(1, geometry.tableZIndex + 1),
  };
  newElement.embeddedInTableId = tableElement.id;
  newElement.embeddedInTableCell = {
    rowIndex: selectedCell.rowIndex,
    colField: selectedCell.colField,
    section: selectedCell.section || "body",
  };

  store.addElement(newElement, geometry.pageIndex);
  showMenu.value = false;
};

const handleLayerMove = (mode: "front" | "back" | "forward" | "backward") => {
  const ids = [...store.selectedElementIds];
  if (ids.length === 0) return;

  if (mode === "front") {
    store.moveElementsLayer(ids, "front");
  } else if (mode === "back") {
    store.sendElementsToBack(ids);
  } else if (mode === "forward") {
    store.moveElementsForward(ids);
  } else {
    store.moveElementsBackward(ids);
  }

  showMenu.value = false;
};

const handleMouseMove = (e: MouseEvent) => {
  currentMouseX.value = e.clientX;
  currentMouseY.value = e.clientY;
};

const getQueryRoot = () => {
  return (
    (designerRoot?.value?.getRootNode() as Document | ShadowRoot) || document
  );
};

const isShortcutEventForCurrentDesigner = (e: KeyboardEvent) => {
  const root = designerRoot?.value;
  if (!root) return true;

  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  if (path.length > 0) {
    return path.includes(root);
  }

  const target = e.target as Node | null;
  return !!target && root.contains(target);
};

const dispatchDesignerEvent = (
  name: string,
  detail: Record<string, any> = {},
) => {
  const payload = { ...detail };
  if (designerInstanceId) {
    payload.__designerInstanceId = designerInstanceId;
  }
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
};

const getPasteTarget = (clientX: number, clientY: number) => {
  const pages = getQueryRoot().querySelectorAll(".print-page");
  if (pages.length === 0) return undefined;

  let closestPage: HTMLElement | null = null;
  let minDistance = Infinity;
  let targetPageIndex = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as HTMLElement;
    const rect = page.getBoundingClientRect();

    // Check if inside
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return {
        pageIndex: i,
        x: (clientX - rect.left) / store.zoom,
        y: (clientY - rect.top) / store.zoom,
      };
    }

    // Calculate distance to rectangle
    const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
    const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
    const dist = Math.sqrt(dx * dx + dy * dy);

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
  // If global shortcuts are disabled (e.g. modal open), ignore
  if (store.disableGlobalShortcuts) return;
  const isDeleteKey = e.key === "Delete" || e.key === "Del";
  const isCurrentDesignerEvent = isShortcutEventForCurrentDesigner(e);
  if (!isCurrentDesignerEvent) {
    // Fallback: when a guide is already selected, allow Delete even if
    // composedPath/target cannot be resolved back to the designer root.
    if (!(isDeleteKey && !!store.selectedGuideId)) {
      return;
    }
  }

  // New Template (Ctrl + Alt + N) - Trigger UI flow via event
  if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    e.stopPropagation();
    dispatchDesignerEvent("designer:new-template");
    return;
  }

  // Settings (Ctrl/Cmd + ,)
  if ((e.ctrlKey || e.metaKey) && e.key === ",") {
    e.preventDefault();
    e.stopPropagation();
    store.setShowSettings(true);
    return;
  }

  // ignore when typing in inputs
  const target = (typeof e.composedPath === "function" && e.composedPath().length > 0 ? e.composedPath()[0] : e.target) as Element | null;
  if (
    target &&
    target.closest &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  )
    return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    const step = e.shiftKey ? 10 : 1;

    if (store.selectedGuideId) {
      const guide = store.guides.find((g) => g.id === store.selectedGuideId);
      if (guide) {
        e.preventDefault();
        const prev = guide.position;
        let pos = prev;
        if (guide.type === "vertical") {
          if (e.key === "ArrowLeft") pos -= step;
          else if (e.key === "ArrowRight") pos += step;
          else return;
        } else {
          if (e.key === "ArrowUp") pos -= step;
          else if (e.key === "ArrowDown") pos += step;
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
      const dx =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      store.setDragging(true);
      store.nudgeSelectedElements(dx, dy);
    }
    return;
  }
  // Select All (Ctrl/Cmd + A)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
    e.preventDefault();
    store.selectAllElements();
    return;
  }

  // Delete
  if (isDeleteKey) {
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    if (store.selectedElementId) {
      e.preventDefault();
      store.copy();
    }
    return;
  }

  // Cut (Ctrl/Cmd + X)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
    if (store.selectedElementId) {
      e.preventDefault();
      store.cut();
    }
    return;
  }

  // Paste (Ctrl/Cmd + V)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
    if (store.clipboard.length > 0) {
      e.preventDefault();
      store.paste(getPasteTarget(currentMouseX.value, currentMouseY.value));
    }
    return;
  }

  // Help (Ctrl/Cmd + H)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
    e.preventDefault();
    store.setShowHelp(true);
    return;
  }

  // Close Help (Escape)
  if (store.showHelp && e.key === "Escape") {
    e.preventDefault();
    store.setShowHelp(false);
    return;
  }

  // Undo (Ctrl/Cmd + Z)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    store.undo();
    return;
  }

  // Redo (Ctrl/Cmd + Y) or (Ctrl+Shift+Z)
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
  ) {
    e.preventDefault();
    store.redo();
    return;
  }

  // Lock/Unlock (Ctrl/Cmd + L)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
    e.preventDefault();
    store.toggleLock();
    return;
  }

  // Preview (Ctrl + Shift + P)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
    e.preventDefault();
    dispatchDesignerEvent("designer:preview");
    return;
  }

  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (store.editingCustomElementId && mod && (key === "s" || key === "q")) {
    return;
  }

  // Save As (Ctrl + Shift + S)
  if (mod && e.shiftKey && key === "s") {
    e.preventDefault();
    dispatchDesignerEvent("designer:save-as", {
      id: templateStore.currentTemplateId,
    });
    return;
  }

  // Save (Ctrl + S)
  if (mod && key === "s") {
    e.preventDefault();
    dispatchDesignerEvent("designer:save");
    return;
  }

  // Print (Ctrl + P)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && !e.shiftKey) {
    e.preventDefault();
    dispatchDesignerEvent("designer:print");
    return;
  }

  // Export PDF (Ctrl + Shift + E)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault();
    dispatchDesignerEvent("designer:export-pdf");
    return;
  }

  // View JSON (Ctrl + Shift + J)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "j") {
    e.preventDefault();
    dispatchDesignerEvent("designer:view-json");
    return;
  }
};

const handleKeyup = (e: KeyboardEvent) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    // Clear highlight after arrow movement stops
    store.setDragging(false);
    store.setHighlightedGuide(null);
    store.setHighlightedEdge(null);
    store.setHighlightedAlignedElements([]);
  }
};

const handleWindowBlur = () => {
  store.setDragging(false);
  store.setHighlightedGuide(null);
  store.setHighlightedEdge(null);
  store.setHighlightedAlignedElements([]);
};

const handleContextMenu = async (e: MouseEvent) => {
  const designerArea = getQueryRoot().querySelector(".overflow-auto"); // The scroll container (canvas area)
  const path = e.composedPath();
  const isInsideDesigner =
    !!designerArea &&
    path.some((node) => {
      if (node === designerArea) return true;
      return node instanceof Element && designerArea.contains(node);
    });

  if (!isInsideDesigner) {
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
  const pages = getQueryRoot().querySelectorAll(".print-page");
  let inside = false;
  pages.forEach((p) => {
    const rect = (p as HTMLElement).getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      inside = true;
    }
  });
  canPasteHere.value = inside;
  window.addEventListener("click", closeMenuOnce);
};

const closeMenuOnce = () => {
  showMenu.value = false;
  window.removeEventListener("click", closeMenuOnce);
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown, { capture: true });
  window.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("keyup", handleKeyup);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("blur", handleWindowBlur);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown, { capture: true });
  window.removeEventListener("contextmenu", handleContextMenu);
  window.removeEventListener("click", closeMenuOnce);
  window.removeEventListener("keyup", handleKeyup);
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("blur", handleWindowBlur);
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-100 ease-out"
    enter-from-class="transform scale-95 opacity-0"
    enter-to-class="transform scale-100 opacity-100"
    leave-active-class="transition duration-75 ease-in"
    leave-from-class="transform scale-100 opacity-100"
    leave-to-class="transform scale-95 opacity-0"
  >
    <div
      v-if="showMenu"
      ref="menuRef"
      class="fixed z-[9999]"
      :style="{ left: `${menuX}px`, top: `${menuY}px` }"
    >
      <div
        class="bg-white border border-gray-200 shadow-xl rounded-md min-w-[160px] py-1"
      >
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          :disabled="
            (store.selectedElementIds.length === 0 && !store.selectedGuideId) ||
            store.selectedElement?.locked
          "
          @click="
            () => {
              if (store.selectedElementIds.length > 1) {
                store.removeSelectedElements();
              } else if (store.selectedElementId) {
                store.removeElement(store.selectedElementId);
              } else if (store.selectedGuideId) {
                store.removeGuide(store.selectedGuideId);
              }
              showMenu = false;
            }
          "
        >
          <DeleteIcon class="w-4 h-4" />
          <span class="flex-1"
            >{{ t("common.delete")
            }}{{
              store.selectedElementIds.length > 1
                ? ` (${store.selectedElementIds.length})`
                : ""
            }}</span
          >
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Del"])
          }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          :disabled="!store.selectedElementId || store.selectedElement?.locked"
          @click="
            () => {
              store.cut();
              showMenu = false;
            }
          "
        >
          <CutIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("common.cut") }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "X"])
          }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          :disabled="!store.selectedElementId || store.selectedElement?.locked"
          @click="
            () => {
              store.copy();
              showMenu = false;
            }
          "
        >
          <CopyIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("common.copy") }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "C"])
          }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          :disabled="store.clipboard.length === 0"
          @click="
            () => {
              store.paste(getPasteTarget(clickX, clickY));
              showMenu = false;
            }
          "
        >
          <PasteIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("common.paste") }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "V"])
          }}</span>
        </button>
        <template v-if="showTableCellActions">
          <div class="relative group">
            <button
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
              :disabled="!canInsertIntoSelectedTableCell"
            >
              <ImageIcon class="w-4 h-4" />
              <span class="flex-1">{{ t("editor.insertMenu") }}</span>
              <ChevronRightIcon class="w-4 h-4 text-gray-400" />
            </button>
            <div
              v-if="canInsertIntoSelectedTableCell"
              class="absolute left-full top-0 z-10 ml-1 hidden min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-xl group-hover:block"
            >
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                @click="
                  () =>
                    insertStandardElementIntoSelectedTableCell(
                      ElementType.IMAGE,
                    )
                "
              >
                <ImageIcon class="w-4 h-4" />
                <span class="flex-1">{{ t("elementsPanel.image") }}</span>
              </button>
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                @click="
                  () =>
                    insertStandardElementIntoSelectedTableCell(
                      ElementType.QRCODE,
                    )
                "
              >
                <QrCodeIcon class="w-4 h-4" />
                <span class="flex-1">{{ t("elementsPanel.qrcode") }}</span>
              </button>
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                @click="
                  () =>
                    insertStandardElementIntoSelectedTableCell(
                      ElementType.BARCODE,
                    )
                "
              >
                <BarcodeIcon class="w-4 h-4" />
                <span class="flex-1">{{ t("elementsPanel.barcode") }}</span>
              </button>
            </div>
          </div>
          <button
            class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
            :disabled="!canMergeSelectedTableCells"
            @click="
              () => {
                store.mergeSelectedCells();
                showMenu = false;
              }
            "
          >
            <CellMerge class="w-4 h-4" />
            <span class="flex-1">{{ t("editor.mergeCells") }}</span>
          </button>
          <button
            class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
            :disabled="!canSplitSelectedTableCell"
            @click="
              () => {
                store.splitSelectedCells();
                showMenu = false;
              }
            "
          >
            <GridViewOutline class="w-4 h-4" />
            <span class="flex-1">{{ t("editor.splitCells") }}</span>
          </button>
        </template>
        <div class="border-t border-gray-200 my-1"></div>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
          :disabled="!canBringToFront"
          @click="() => handleLayerMove('front')"
        >
          <BringToFrontIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("properties.action.bringToFront") }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
          :disabled="!canSendToBack"
          @click="() => handleLayerMove('back')"
        >
          <SendToBackIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("properties.action.sendToBack") }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
          :disabled="!canMoveLayerUp"
          @click="() => handleLayerMove('forward')"
        >
          <MoveUpIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("properties.action.moveUp") }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-400 flex items-center gap-2"
          :disabled="!canMoveLayerDown"
          @click="() => handleLayerMove('backward')"
        >
          <MoveDownIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("properties.action.moveDown") }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          :disabled="store.selectedElementIds.length === 0"
          @click="
            () => {
              store.toggleLock();
              showMenu = false;
            }
          "
        >
          <component
            :is="store.selectedElement?.locked ? UnlockIcon : LockIcon"
            class="w-4 h-4"
          />
          <span class="flex-1">{{
            store.selectedElement?.locked
              ? t("common.unlock")
              : t("common.lock")
          }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "L"])
          }}</span>
        </button>
        <div class="border-t border-gray-200 my-1"></div>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
          @click="
            store.undo();
            showMenu = false;
          "
        >
          <UndoIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("common.undo") }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "Z"])
          }}</span>
        </button>
        <button
          class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
          @click="
            store.redo();
            showMenu = false;
          "
        >
          <RedoIcon class="w-4 h-4" />
          <span class="flex-1">{{ t("common.redo") }}</span>
          <span class="text-xs text-gray-400">{{
            formatShortcut(["Ctrl", "Y"])
          }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>
