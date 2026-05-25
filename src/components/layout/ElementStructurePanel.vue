<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDesignerStore } from "@/stores/designer";
import { ElementType, type PrintElement } from "@/types";
import TextFields from "~icons/material-symbols/text-fields";
import Numbers from "~icons/material-symbols/numbers";
import ImageIcon from "~icons/material-symbols/image";
import TableChart from "~icons/material-symbols/table-chart";
import Barcode from "~icons/material-symbols/barcode";
import QrCode from "~icons/material-symbols/qr-code";
import HorizontalRule from "~icons/material-symbols/horizontal-rule";
import CheckBoxOutlineBlank from "~icons/material-symbols/check-box-outline-blank";
import RadioButtonUnchecked from "~icons/material-symbols/radio-button-unchecked";
import KeyboardArrowRight from "~icons/material-symbols/keyboard-arrow-right";
import KeyboardArrowDown from "~icons/material-symbols/keyboard-arrow-down";
import AlignStartVertical from "~icons/material-symbols/vertical-align-top";
import AlignEndVertical from "~icons/material-symbols/vertical-align-bottom";
import ArrowUpward from "~icons/material-symbols/arrow-upward";
import ArrowDownward from "~icons/material-symbols/arrow-downward";
import Lock from "~icons/material-symbols/lock";
import Unlock from "~icons/material-symbols/lock-open";
import ContentCopy from "~icons/material-symbols/content-copy";
import Delete from "~icons/material-symbols/delete";

type LayoutNode = {
  id: string;
  pageId: string;
  pageIndex: number;
  parentId: string | null;
  depth: number;
  element: PrintElement;
  children: LayoutNode[];
};

type PageStructure = {
  id: string;
  pageIndex: number;
  elementsCount: number;
  allNodes: LayoutNode[];
  visibleNodes: LayoutNode[];
};

const { t } = useI18n();
const store = useDesignerStore();
const designerInstanceId = inject<string | null>("designer-instance-id", null);

const expandedPages = ref<Record<string, boolean>>({});
const expandedNodes = ref<Record<string, boolean>>({});

const getElementZIndex = (element: PrintElement) => {
  return element.style?.zIndex || 1;
};

const sortElementsByLayer = (elements: PrintElement[]) => {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const zDiff = getElementZIndex(b.element) - getElementZIndex(a.element);
      if (zDiff !== 0) return zDiff;
      return b.index - a.index;
    })
    .map((item) => item.element);
};

const isPageExpanded = (pageId: string, pageIndex: number) => {
  const explicit = expandedPages.value[pageId];
  if (explicit !== undefined) return explicit;
  return pageIndex === store.currentPageIndex;
};

const setPageExpanded = (pageId: string, expanded: boolean) => {
  expandedPages.value = {
    ...expandedPages.value,
    [pageId]: expanded,
  };
};

const togglePageExpanded = (pageId: string, pageIndex: number) => {
  setPageExpanded(pageId, !isPageExpanded(pageId, pageIndex));
};

const isNodeExpanded = (nodeId: string) => {
  const explicit = expandedNodes.value[nodeId];
  if (explicit !== undefined) return explicit;
  return true;
};

const setNodeExpanded = (nodeId: string, expanded: boolean) => {
  expandedNodes.value = {
    ...expandedNodes.value,
    [nodeId]: expanded,
  };
};

const toggleNodeExpanded = (nodeId: string) => {
  setNodeExpanded(nodeId, !isNodeExpanded(nodeId));
};

const buildLayoutTreeForPage = (
  pageId: string,
  pageIndex: number,
  elements: PrintElement[],
) => {
  const sorted = sortElementsByLayer(elements);
  const elementById = new Map(sorted.map((element) => [element.id, element]));
  const childrenByParentId = new Map<string, PrintElement[]>();
  const roots: PrintElement[] = [];

  sorted.forEach((element) => {
    const parentId = element.embeddedInTableId;
    if (parentId && elementById.has(parentId)) {
      const list = childrenByParentId.get(parentId) || [];
      list.push(element);
      childrenByParentId.set(parentId, list);
      return;
    }
    roots.push(element);
  });

  const createNode = (
    element: PrintElement,
    depth: number,
    parentId: string | null,
  ): LayoutNode => {
    const childElements = childrenByParentId.get(element.id) || [];
    return {
      id: element.id,
      pageId,
      pageIndex,
      parentId,
      depth,
      element,
      children: childElements.map((child) =>
        createNode(child, depth + 1, element.id),
      ),
    };
  };

  return roots.map((rootElement) => createNode(rootElement, 0, null));
};

const flattenAllNodes = (nodes: LayoutNode[], target: LayoutNode[]) => {
  nodes.forEach((node) => {
    target.push(node);
    if (node.children.length > 0) {
      flattenAllNodes(node.children, target);
    }
  });
};

const flattenVisibleNodes = (nodes: LayoutNode[], target: LayoutNode[]) => {
  nodes.forEach((node) => {
    target.push(node);
    if (node.children.length > 0 && isNodeExpanded(node.id)) {
      flattenVisibleNodes(node.children, target);
    }
  });
};

const pageStructures = computed<PageStructure[]>(() => {
  return store.pages.map((page, pageIndex) => {
    const roots = buildLayoutTreeForPage(page.id, pageIndex, page.elements);
    const allNodes: LayoutNode[] = [];
    flattenAllNodes(roots, allNodes);

    const visibleNodes: LayoutNode[] = [];
    if (isPageExpanded(page.id, pageIndex)) {
      flattenVisibleNodes(roots, visibleNodes);
    }

    return {
      id: page.id,
      pageIndex,
      elementsCount: page.elements.length,
      allNodes,
      visibleNodes,
    };
  });
});

const nodeById = computed(() => {
  const map = new Map<string, LayoutNode>();
  pageStructures.value.forEach((page) => {
    page.allNodes.forEach((node) => {
      map.set(node.id, node);
    });
  });
  return map;
});

const selectedNode = computed(() => {
  if (!store.selectedElementId) return null;
  return nodeById.value.get(store.selectedElementId) || null;
});

const selectedNodes = computed(() => {
  const nodes: LayoutNode[] = [];
  const selectedIdSet = new Set(
    store.selectedElementIds.filter((id): id is string => typeof id === "string"),
  );

  selectedIdSet.forEach((id: string) => {
    const node = nodeById.value.get(id);
    if (node) {
      nodes.push(node);
    }
  });

  return nodes;
});

const selectedNodeIds = computed(() => {
  return selectedNodes.value.map((node) => node.id);
});

const totalElementCount = computed(() => {
  return store.pages.reduce((count, page) => count + page.elements.length, 0);
});

watch(
  () => store.currentPageIndex,
  (pageIndex) => {
    const page = store.pages[pageIndex];
    if (!page) return;
    if (!isPageExpanded(page.id, pageIndex)) {
      setPageExpanded(page.id, true);
    }
  },
  { immediate: true },
);

watch(
  () => store.selectedElementId,
  (selectedId) => {
    if (!selectedId) return;
    const node = nodeById.value.get(selectedId);
    if (!node) return;

    if (!isPageExpanded(node.pageId, node.pageIndex)) {
      setPageExpanded(node.pageId, true);
    }

    let cursor: LayoutNode | null = node;
    while (cursor?.parentId) {
      setNodeExpanded(cursor.parentId, true);
      cursor = nodeById.value.get(cursor.parentId) || null;
    }
  },
);

const elementTypeLabelMap = computed<Record<string, string>>(() => ({
  [ElementType.TEXT]: t("elementsPanel.text"),
  [ElementType.IMAGE]: t("elementsPanel.image"),
  [ElementType.TABLE]: t("elementsPanel.table"),
  [ElementType.PAGE_NUMBER]: t("elementsPanel.pagination"),
  [ElementType.BARCODE]: t("elementsPanel.barcode"),
  [ElementType.QRCODE]: t("elementsPanel.qrcode"),
  [ElementType.LINE]: t("elementsPanel.line"),
  [ElementType.RECT]: t("elementsPanel.rect"),
  [ElementType.CIRCLE]: t("elementsPanel.circle"),
}));

const getElementTypeLabel = (element: PrintElement) => {
  return elementTypeLabelMap.value[element.type] || element.type;
};

const getElementIcon = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT:
      return TextFields;
    case ElementType.IMAGE:
      return ImageIcon;
    case ElementType.TABLE:
      return TableChart;
    case ElementType.PAGE_NUMBER:
      return Numbers;
    case ElementType.BARCODE:
      return Barcode;
    case ElementType.QRCODE:
      return QrCode;
    case ElementType.LINE:
      return HorizontalRule;
    case ElementType.RECT:
      return CheckBoxOutlineBlank;
    case ElementType.CIRCLE:
      return RadioButtonUnchecked;
    default:
      return TextFields;
  }
};

const toSingleLine = (value: unknown) => {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
};

const truncateText = (value: string, max = 20) => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

const getElementTitle = (element: PrintElement) => {
  const typeLabel = getElementTypeLabel(element);

  if (element.type === ElementType.TEXT) {
    const text = toSingleLine(element.content || element.variable || "");
    return text ? `${typeLabel}: ${truncateText(text)}` : typeLabel;
  }

  if (element.type === ElementType.IMAGE) {
    const source = toSingleLine(element.variable || element.content || "");
    return source ? `${typeLabel}: ${truncateText(source)}` : typeLabel;
  }

  if (element.type === ElementType.TABLE) {
    const rows = Array.isArray(element.data) ? element.data.length : 0;
    const columns = Array.isArray(element.columns) ? element.columns.length : 0;
    return `${typeLabel} (${columns}x${rows})`;
  }

  if (element.type === ElementType.PAGE_NUMBER) {
    const format = toSingleLine(element.format || "");
    return format ? `${typeLabel}: ${truncateText(format)}` : typeLabel;
  }

  return typeLabel;
};

const getElementMeta = (element: PrintElement) => {
  return `X:${Math.round(element.x)} Y:${Math.round(element.y)} W:${Math.round(
    element.width,
  )} H:${Math.round(element.height)} Z:${getElementZIndex(element)}`;
};

const isElementSelected = (id: string) => {
  return store.selectedElementIds.includes(id);
};

const selectNode = (node: LayoutNode, event: MouseEvent) => {
  const isMultiSelect = event.ctrlKey || event.metaKey;
  store.selectElement(node.id, isMultiSelect, false);
};

const emitStructurePanelHoverEvent = (
  node: LayoutNode | null,
  hovering: boolean,
) => {
  const detail: Record<string, unknown> = {
    hovering,
    elementId: node?.id || null,
    pageIndex: node?.pageIndex ?? null,
  };

  if (designerInstanceId) {
    detail.__designerInstanceId = designerInstanceId;
  }

  window.dispatchEvent(
    new CustomEvent("designer:structure-panel-hover-element", { detail }),
  );
};

const handleNodeMouseEnter = (node: LayoutNode) => {
  emitStructurePanelHoverEvent(node, true);
};

const handleNodeMouseLeave = (node: LayoutNode) => {
  emitStructurePanelHoverEvent(node, false);
};

const focusPage = (pageIndex: number) => {
  store.currentPageIndex = pageIndex;
};

const duplicateSelection = () => {
  if (!store.isTemplateEditable || selectedNodes.value.length === 0) return;

  store.copy();
  store.paste();
};

const toggleSelectionLock = () => {
  if (!store.isTemplateEditable || selectedNodes.value.length === 0) return;
  store.toggleLock();
};

const removeSelection = () => {
  if (!store.isTemplateEditable || selectedNodes.value.length === 0) return;
  store.removeSelectedElements();
};

const canMoveSelectionLayer = (
  mode: "front" | "back" | "forward" | "backward",
) => {
  if (selectedNodeIds.value.length === 0) return false;
  return store.canMoveElementsLayer(selectedNodeIds.value, mode);
};

const moveSelectionLayer = (mode: "front" | "back" | "forward" | "backward") => {
  const ids = selectedNodeIds.value;
  if (ids.length === 0) return;

  if (mode === "front") {
    store.moveElementsLayer(ids, "front");
    return;
  }
  if (mode === "back") {
    store.sendElementsToBack(ids);
    return;
  }
  if (mode === "forward") {
    store.moveElementsForward(ids);
    return;
  }
  store.moveElementsBackward(ids);
};

const canDeleteSelected = computed(() => {
  if (!store.isTemplateEditable || selectedNodes.value.length === 0) {
    return false;
  }
  return selectedNodes.value.some((node) => !node.element.locked);
});

const canDuplicateSelected = computed(() => {
  if (!store.isTemplateEditable || selectedNodes.value.length === 0) {
    return false;
  }
  return selectedNodes.value.some((node) => !node.element.locked);
});

const allSelectedLocked = computed(() => {
  if (selectedNodes.value.length === 0) return false;
  return selectedNodes.value.every((node) => Boolean(node.element.locked));
});

const actionButtonClass =
  "inline-flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 p-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed";

onUnmounted(() => {
  emitStructurePanelHoverEvent(null, false);
});
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-white dark:bg-gray-900">
    <div class="border-b border-gray-100 dark:border-gray-700 p-3 space-y-2">
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t("elementsPanel.layout") }} · {{ totalElementCount }}
      </div>
      <div class="grid grid-cols-4 gap-1">
        <button
          :title="t('properties.action.bringToFront')"
          :class="actionButtonClass"
          :disabled="!canMoveSelectionLayer('front')"
          @click="moveSelectionLayer('front')"
        >
          <AlignStartVertical class="w-3.5 h-3.5" />
        </button>
        <button
          :title="t('properties.action.sendToBack')"
          :class="actionButtonClass"
          :disabled="!canMoveSelectionLayer('back')"
          @click="moveSelectionLayer('back')"
        >
          <AlignEndVertical class="w-3.5 h-3.5" />
        </button>
        <button
          :title="t('properties.action.moveUp')"
          :class="actionButtonClass"
          :disabled="!canMoveSelectionLayer('forward')"
          @click="moveSelectionLayer('forward')"
        >
          <ArrowUpward class="w-3.5 h-3.5" />
        </button>
        <button
          :title="t('properties.action.moveDown')"
          :class="actionButtonClass"
          :disabled="!canMoveSelectionLayer('backward')"
          @click="moveSelectionLayer('backward')"
        >
          <ArrowDownward class="w-3.5 h-3.5" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        <button
          :title="t('common.copy')"
          :class="actionButtonClass"
          :disabled="!canDuplicateSelected"
          @click="duplicateSelection"
        >
          <ContentCopy class="w-3.5 h-3.5" />
        </button>
        <button
          :title="allSelectedLocked ? t('common.unlock') : t('common.lock')"
          :class="actionButtonClass"
          :disabled="selectedNodes.length === 0 || !store.isTemplateEditable"
          @click="toggleSelectionLock"
        >
          <Unlock v-if="allSelectedLocked" class="w-3.5 h-3.5" />
          <Lock v-else class="w-3.5 h-3.5" />
        </button>
        <button
          :title="t('common.delete')"
          :class="actionButtonClass"
          :disabled="!canDeleteSelected"
          @click="removeSelection"
        >
          <Delete class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto py-1">
      <div
        v-for="page in pageStructures"
        :key="page.id"
        class="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
      >
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @click="togglePageExpanded(page.id, page.pageIndex)"
        >
          <KeyboardArrowDown
            v-if="isPageExpanded(page.id, page.pageIndex)"
            class="w-4 h-4 text-gray-500 shrink-0"
          />
          <KeyboardArrowRight v-else class="w-4 h-4 text-gray-500 shrink-0" />
          <span
            class="text-sm truncate flex-1"
            @click.stop="focusPage(page.pageIndex)"
            :class="
              page.pageIndex === store.currentPageIndex
                ? 'font-medium text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-200'
            "
          >
            #{{ page.pageIndex + 1 }}
          </span>
          <span
            class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded"
          >
            {{ page.elementsCount }}
          </span>
        </button>

        <div v-if="isPageExpanded(page.id, page.pageIndex)">
          <div
            v-if="page.elementsCount === 0"
            class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            {{ t("common.noData") }}
          </div>

          <div
            v-for="node in page.visibleNodes"
            :key="node.id"
            class="border-t border-gray-100 dark:border-gray-700"
          >
            <div
              class="group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
              :class="
                isElementSelected(node.id)
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              "
              @mouseenter="handleNodeMouseEnter(node)"
              @mouseleave="handleNodeMouseLeave(node)"
              @click="(event) => selectNode(node, event)"
            >
              <span
                class="shrink-0"
                :style="{ width: `${node.depth * 10}px` }"
              ></span>
              <button
                v-if="node.children.length > 0"
                class="h-4 w-4 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                @click.stop="toggleNodeExpanded(node.id)"
              >
                <KeyboardArrowDown
                  v-if="isNodeExpanded(node.id)"
                  class="w-4 h-4"
                />
                <KeyboardArrowRight v-else class="w-4 h-4" />
              </button>
              <span v-else class="w-4 h-4 shrink-0"></span>

              <component
                :is="getElementIcon(node.element.type)"
                class="w-4 h-4 shrink-0 mx-1"
                :class="
                  isElementSelected(node.id)
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-300'
                "
              />

              <div class="min-w-0 flex-1">
                <div
                  class="truncate text-sm"
                  :class="
                    isElementSelected(node.id)
                      ? 'font-medium text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-200'
                  "
                >
                  {{ getElementTitle(node.element) }}
                </div>
                <div class="truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ getElementMeta(node.element) }}
                </div>
              </div>

              <span
                v-if="node.element.locked"
                class="shrink-0 inline-flex items-center gap-1 text-red-500 dark:text-red-400 text-[10px] font-medium bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800"
              >
                <Lock class="w-3 h-3" />
                <span>{{ t("properties.locked") }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
