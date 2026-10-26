<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
} from "vue";
import { useI18n } from "@/locales";
import { uiConfirm } from "@/utils/confirm";
import { toast } from "@/utils/toast";
import { useTemplateStore, type Template } from "@/stores/templates";
import { useDesignerStore } from "@/stores/designer";
import type {
  ListContextMenuItem,
  TemplateModalConfigItem,
  TemplateModalField,
  TemplateListTag,
  TemplateModalFormConfig,
  TemplateMenuActionKey,
  VariableTreeItem,
} from "@/types";
import {
  canCopyEntity,
  canDeleteEntity,
  canEditEntity,
} from "@/utils/entityConstraints";
import { ElementType } from "@/types";
import MoreVert from "~icons/material-symbols/more-vert";
import Edit from "~icons/material-symbols/edit";
import Copy from "~icons/material-symbols/content-copy";
import Trash2 from "~icons/material-symbols/delete";
import DataObject from "~icons/material-symbols/data-object";
import Add from "~icons/material-symbols/add";
import KeyboardArrowRight from "~icons/material-symbols/keyboard-arrow-right";
import KeyboardArrowDown from "~icons/material-symbols/keyboard-arrow-down";
import InputModal from "@/components/common/InputModal.vue";
import CodeEditorModal from "@/components/common/CodeEditorModal.vue";
import { buildTestDataFromPages } from "@/utils/variables";

const { t } = useI18n();
const templateStore = useTemplateStore();
const designerStore = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));
const designerInstanceId = inject<string | null>("designer-instance-id", null);

const activeTab = ref<"templates" | "variables">("templates");
const searchQuery = ref("");

const activeMenuId = ref<string | null>(null);
const menuPosition = ref<Record<string, string>>({});

const showModal = ref(false);
const modalMode = ref<"create" | "edit" | "copy">("create");
const modalInitialName = ref("");
const modalInitialValues = ref<Record<string, any>>({});
const targetTemplateId = ref<string | null>(null);
const shouldPreserveCurrentDesignOnCreate = ref(false);

const showTestDataModal = ref(false);
const testDataContent = ref("");
const testDataTarget = ref<Template | null>(null);
const testDataAllowedKeys = ref<string[]>([]);

const showJsonModal = ref(false);
const jsonContent = ref("");
const jsonTarget = ref<Template | null>(null);

type TemplateMenuItemView = ListContextMenuItem & { iconComponent?: Component };
type ModalSavePayload = string | Record<string, any>;
const VARIABLE_DRAG_MIME = "application/x-print-designer-variable";
const DATA_VARIABLE_DRAG_MIME = "application/x-print-designer-data-variable";
const maxVisibleTemplateTags = 2;

const isEventForCurrentDesigner = (e: Event) => {
  const eventId = (e as CustomEvent)?.detail?.__designerInstanceId;
  if (!eventId || !designerInstanceId) return true;
  return eventId === designerInstanceId;
};

const getModalConfigItem = (
  mode: "create" | "edit" | "copy",
): TemplateModalConfigItem | null => {
  const config = designerStore.templateModalFormConfig;
  if (!config) return null;
  const keyMode = mode as keyof TemplateModalFormConfig;
  if (config[keyMode]) return config[keyMode] || null;
  if (mode === "copy") {
    return config.copy || config.edit || config.create || null;
  }
  if (mode === "edit") {
    return config.edit || config.create || null;
  }
  return config.create || null;
};

const getTemplateModalSavedValues = (
  templateId: string | null,
  mode: "create" | "edit" | "copy",
) => {
  if (!templateId) return {};
  const template = templateStore.templates.find(
    (item) => item.id === templateId,
  );

  const ext = template?.ext || {};
  const cacheExt = templateStore.templateDetailCache?.[templateId]?.ext || {};
  const baseExt = { ...ext, ...cacheExt };

  const extForm = ext.templateModalForm || {};
  const cacheForm = cacheExt.templateModalForm || {};

  let modeValues = {};
  if (extForm[mode] && typeof extForm[mode] === "object") {
    modeValues = { ...extForm[mode] };
  } else if (cacheForm[mode] && typeof cacheForm[mode] === "object") {
    modeValues = { ...cacheForm[mode] };
  } else {
    const lastMode = extForm.lastMode || cacheForm.lastMode;
    if (
      lastMode &&
      extForm[lastMode] &&
      typeof extForm[lastMode] === "object"
    ) {
      modeValues = { ...extForm[lastMode] };
    } else if (
      lastMode &&
      cacheForm[lastMode] &&
      typeof cacheForm[lastMode] === "object"
    ) {
      modeValues = { ...cacheForm[lastMode] };
    }
  }

  const finalValues = { ...baseExt, ...modeValues };
  delete finalValues.templateModalForm;
  return finalValues;
};

const buildModalInitialValues = (
  name: string,
  mode: "create" | "edit" | "copy",
  templateId: string | null = null,
) => {
  const configItem = getModalConfigItem(mode);
  const configInitialValues =
    configItem?.initialValues && typeof configItem.initialValues === "object"
      ? { ...configItem.initialValues }
      : {};
  const savedValues = getTemplateModalSavedValues(templateId, mode);
  const initialValues = {
    ...configInitialValues,
    ...savedValues,
  };
  if (!Object.prototype.hasOwnProperty.call(initialValues, "name")) {
    initialValues.name = name;
  }
  return initialValues;
};

const modalFields = computed<TemplateModalField[] | undefined>(() => {
  return getModalConfigItem(modalMode.value)?.fields;
});

const resolveModalName = (payload: ModalSavePayload) => {
  if (typeof payload === "string") return payload.trim();
  return String(payload?.name ?? "").trim();
};

const resolveModalExtraValues = (
  payload: ModalSavePayload,
): Record<string, any> | undefined => {
  if (!payload || typeof payload === "string") return undefined;
  const values = { ...payload };
  delete values.name;
  return Object.keys(values).length > 0 ? values : undefined;
};

const resolveIconFromIconField = (icon: string | undefined) => {
  if (!icon) return null;
  const isIconifyName = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9-]+$/i.test(icon);
  if (!isIconifyName) return null;
  return `https://api.iconify.design/${encodeURIComponent(icon)}.svg`;
};

const normalizeSearchValue = (value: string | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeTagColor = (rawColor: string | undefined) => {
  const color = (rawColor || "").trim().toLowerCase();
  if (
    color === "red" ||
    color === "#ff4d4f" ||
    color === "红色" ||
    color === "红"
  ) {
    return {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      borderColor: "#fecaca",
    };
  }
  if (
    color === "white" ||
    color === "#ffffff" ||
    color === "白色" ||
    color === "白"
  ) {
    return {
      backgroundColor: "#ffffff",
      color: "#374151",
      borderColor: "#d1d5db",
    };
  }
  if (
    color === "blue" ||
    color === "#3b82f6" ||
    color === "蓝色" ||
    color === "蓝"
  ) {
    return {
      backgroundColor: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }
  if (
    color === "green" ||
    color === "#22c55e" ||
    color === "绿色" ||
    color === "绿"
  ) {
    return {
      backgroundColor: "#f0fdf4",
      color: "#15803d",
      borderColor: "#bbf7d0",
    };
  }
  if (
    color === "orange" ||
    color === "#f97316" ||
    color === "橙色" ||
    color === "橙"
  ) {
    return {
      backgroundColor: "#fff7ed",
      color: "#c2410c",
      borderColor: "#fed7aa",
    };
  }
  if (color) {
    return { backgroundColor: color, color: "#ffffff", borderColor: color };
  }
  return {
    backgroundColor: "#f3f4f6",
    color: "#4b5563",
    borderColor: "#e5e7eb",
  };
};

const getTemplateTags = (template: Template): TemplateListTag[] => {
  const resolver = designerStore.templateTagResolver;
  const source =
    typeof resolver === "function"
      ? resolver(template)
      : template.ext?.templateTags;
  const tags = Array.isArray(source) ? source : [];

  return tags
    .map((tag): TemplateListTag | null => {
      if (!tag || typeof tag !== "object") return null;
      const label = String(tag.label ?? "").trim();
      if (!label) return null;

      return {
        key: tag.key ? String(tag.key) : undefined,
        label,
        color: tag.color ? String(tag.color) : undefined,
      };
    })
    .filter((tag): tag is TemplateListTag => tag !== null);
};

const templateTagDisplayMap = computed(() => {
  const map: Record<string, { visible: TemplateListTag[]; overflow: number }> =
    {};
  templateStore.templates.forEach((template) => {
    const tags = getTemplateTags(template);
    map[template.id] = {
      visible: tags.slice(0, maxVisibleTemplateTags),
      overflow:
        tags.length > maxVisibleTemplateTags
          ? tags.length - maxVisibleTemplateTags
          : 0,
    };
  });
  return map;
});

const getVisibleTemplateTags = (template: Template) => {
  return templateTagDisplayMap.value[template.id]?.visible || [];
};

const getTemplateTagOverflow = (template: Template) => {
  return templateTagDisplayMap.value[template.id]?.overflow || 0;
};

const normalizedSearchQuery = computed(() =>
  normalizeSearchValue(searchQuery.value),
);

const variables = computed(() => designerStore.availableVariables || []);

const filterVariableTree = (
  items: VariableTreeItem[],
  query: string,
): VariableTreeItem[] => {
  return items
    .map((item) => {
      const children = Array.isArray(item.children)
        ? filterVariableTree(item.children, query)
        : [];
      const matchesSelf =
        normalizeSearchValue(item.label).includes(query) ||
        normalizeSearchValue(item.id).includes(query);

      if (matchesSelf) return item;
      if (children.length > 0) {
        return {
          ...item,
          children,
        };
      }
      return null;
    })
    .filter((item): item is VariableTreeItem => item !== null);
};

const filteredVariables = computed(() => {
  const query = normalizedSearchQuery.value;
  if (!query) return variables.value;
  return filterVariableTree(variables.value, query);
});

const hasActiveSearch = computed(() => normalizedSearchQuery.value.length > 0);

const expandedNodes = ref<Set<string>>(new Set());

const isNodeExpanded = (id: string) => {
  return hasActiveSearch.value || expandedNodes.value.has(id);
};

const toggleExpand = (id: string) => {
  const nextSet = new Set(expandedNodes.value);
  if (nextSet.has(id)) {
    nextSet.delete(id);
  } else {
    nextSet.add(id);
  }
  expandedNodes.value = nextSet;
};

const filteredTemplates = computed(() => {
  if (!normalizedSearchQuery.value) return templateStore.templates;
  const keyword = normalizedSearchQuery.value;
  return templateStore.templates.filter((item) =>
    item.name.toLowerCase().includes(keyword),
  );
});

const selectTemplate = async (template: Template) => {
  if (templateStore.isLoading) return;
  if (templateStore.currentTemplateId === template.id) return;

  if (templateStore.currentTemplateId) {
    const currentTemplate = templateStore.templates.find(
      (item) => item.id === templateStore.currentTemplateId,
    );
    if (currentTemplate && canEditEntity(currentTemplate)) {
      await templateStore.saveCurrentTemplate(currentTemplate.name);
    }
  }

  await templateStore.loadTemplate(template.id);
};

const handleCreate = (e?: Event) => {
  if (e && !isEventForCurrentDesigner(e)) return;
  if (e) e.stopImmediatePropagation();

  activeMenuId.value = null;
  modalMode.value = "create";
  targetTemplateId.value = null;
  shouldPreserveCurrentDesignOnCreate.value = Boolean(
    (e as CustomEvent | undefined)?.detail?.preserveCurrentDesign,
  );
  modalInitialName.value = "";
  modalInitialValues.value = buildModalInitialValues("", "create");
  showModal.value = true;
};

const handleSaveAsEvent = async (e: Event) => {
  if (!isEventForCurrentDesigner(e)) return;
  e.stopImmediatePropagation();

  const customEvent = e as CustomEvent;
  const currentId = customEvent.detail?.id || templateStore.currentTemplateId;
  if (!currentId) return;

  await templateStore.fetchTemplateDetail(currentId);
  const current = templateStore.templates.find((item) => item.id === currentId);
  const copyName = current ? `${current.name} Copy` : "";

  modalMode.value = "create";
  targetTemplateId.value = currentId;
  shouldPreserveCurrentDesignOnCreate.value = true;
  modalInitialName.value = copyName;
  modalInitialValues.value = buildModalInitialValues(
    copyName,
    "create",
    currentId,
  );
  showModal.value = true;
  activeMenuId.value = null;
};

const handleVarDragStart = (event: DragEvent, item: VariableTreeItem) => {
  if (!event.dataTransfer) return;

  const variableId = String(item?.id || "");
  if (!variableId) return;

  if (item.isArray) {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: ElementType.TABLE,
        dataVariable: variableId,
      }),
    );
    event.dataTransfer.setData(DATA_VARIABLE_DRAG_MIME, variableId);
  } else {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: ElementType.TEXT,
        variable: variableId,
      }),
    );
    event.dataTransfer.setData(VARIABLE_DRAG_MIME, variableId);
  }

  event.dataTransfer.setData("text/plain", variableId);
  event.dataTransfer.effectAllowed = "copy";
};

const positionMenuAt = (x: number, y: number, id: string) => {
  const target = templateStore.templates.find((tpl) => tpl.id === id);
  if (!target) return;

  const menuWidth = 160;
  const itemCount = Math.max(1, getResolvedMenuItems(target).length);
  const menuHeightEstimate = itemCount * 30 + 10;

  let left = Math.max(5, Math.min(x, window.innerWidth - menuWidth - 5));
  let top = y;
  if (top + menuHeightEstimate > window.innerHeight - 5) {
    top = Math.max(5, y - menuHeightEstimate);
  }

  menuPosition.value = {
    top: `${top}px`,
    left: `${left}px`,
  };
  activeMenuId.value = id;
};

const toggleRowMenu = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  if (activeMenuId.value === id) {
    activeMenuId.value = null;
    return;
  }

  const button = e.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  positionMenuAt(rect.right - 160, rect.bottom + 5, id);
};

const openRowMenuByContext = (e: MouseEvent, id: string) => {
  e.stopPropagation();
  e.preventDefault();
  positionMenuAt(e.clientX, e.clientY, id);
};

const activeTemplate = computed(() => {
  return (
    templateStore.templates.find((item) => item.id === activeMenuId.value) ||
    null
  );
});

const handleEdit = async (template: Template) => {
  if (!canEditEntity(template)) {
    toast.warning(t("toast.templateReadOnly"));
    return;
  }

  await templateStore.fetchTemplateDetail(template.id);

  activeMenuId.value = null;
  modalMode.value = "edit";
  targetTemplateId.value = template.id;
  modalInitialName.value = template.name;
  modalInitialValues.value = buildModalInitialValues(
    template.name,
    "edit",
    template.id,
  );
  showModal.value = true;
};

const handleCopy = async (template: Template) => {
  if (!canCopyEntity(template)) {
    toast.warning(t("toast.templateCopyNotAllowed"));
    return;
  }

  await templateStore.fetchTemplateDetail(template.id);

  modalMode.value = "copy";
  targetTemplateId.value = template.id;
  modalInitialName.value = `${template.name} Copy`;
  modalInitialValues.value = buildModalInitialValues(
    `${template.name} Copy`,
    "copy",
    template.id,
  );
  showModal.value = true;
  activeMenuId.value = null;
};

const handleDelete = async (template: Template) => {
  if (!canDeleteEntity(template)) {
    toast.warning(t("toast.templateDeleteNotAllowed"));
    return;
  }

  const confirmed = await uiConfirm.show(
    t("template.confirmDelete", { name: template.name }),
  );
  if (confirmed) {
    await templateStore.deleteTemplate(template.id);
    if (
      !templateStore.currentTemplateId &&
      templateStore.templates.length > 0
    ) {
      await templateStore.loadTemplate(templateStore.templates[0].id);
    }
  }
  activeMenuId.value = null;
};

const buildTemplateTestData = (template: Template) => {
  const isCurrent = templateStore.currentTemplateId === template.id;
  const existing = isCurrent
    ? designerStore.testData || {}
    : template.data?.testData || {};
  const pages = isCurrent ? designerStore.pages : template.data?.pages || [];
  return buildTestDataFromPages(pages, existing);
};

const handleTestData = async (template: Template) => {
  activeMenuId.value = null;
  const detail = await templateStore.fetchTemplateDetail(template.id);
  testDataTarget.value = detail || template;
  const data = buildTemplateTestData(testDataTarget.value);
  testDataAllowedKeys.value = Object.keys(data);
  testDataContent.value = JSON.stringify(data, null, 2);
  showTestDataModal.value = true;
};

const handleViewJson = async (template: Template) => {
  activeMenuId.value = null;
  const detail = await templateStore.fetchTemplateDetail(template.id);
  jsonTarget.value = detail || template;
  let targetData = jsonTarget.value.data;
  if (templateStore.currentTemplateId === jsonTarget.value.id) {
    targetData = {
      pages: JSON.parse(JSON.stringify(designerStore.pages)),
      canvasSize: JSON.parse(JSON.stringify(designerStore.canvasSize)),
      guides: JSON.parse(JSON.stringify(designerStore.guides)),
      zoom: designerStore.zoom,
      showGrid: designerStore.showGrid,
      allowDragOutsideCanvas: designerStore.allowDragOutsideCanvas,
      headerHeight: designerStore.headerHeight,
      footerHeight: designerStore.footerHeight,
      showHeaderLine: designerStore.showHeaderLine,
      showFooterLine: designerStore.showFooterLine,
      enableHeaderFooterLineRendering: designerStore.enableHeaderFooterLineRendering,
      headerLineStyle: designerStore.headerLineStyle,
      footerLineStyle: designerStore.footerLineStyle,
    };
  }
  jsonContent.value = JSON.stringify(targetData, null, 2);
  showJsonModal.value = true;
};

const defaultTemplateMenuItems = computed<TemplateMenuItemView[]>(() => [
  {
    key: "viewJson",
    actionKey: "viewJson",
    label: t("editor.viewJson"),
    iconComponent: DataObject,
  },
  {
    key: "testData",
    actionKey: "testData",
    label: t("common.testData"),
    iconComponent: DataObject,
  },
  {
    key: "edit",
    actionKey: "edit",
    label: t("common.edit"),
    iconComponent: Edit,
    disabled: ({ item }) => !canEditEntity(item),
  },
  {
    key: "copy",
    actionKey: "copy",
    label: t("common.copy"),
    iconComponent: Copy,
    disabled: ({ item }) => !canCopyEntity(item),
  },
  {
    key: "delete",
    actionKey: "delete",
    label: t("common.delete"),
    iconComponent: Trash2,
    danger: true,
    disabled: ({ item }) => !canDeleteEntity(item),
  },
]);

const mergeTemplateMenuItems = (
  defaults: TemplateMenuItemView[],
  custom: TemplateMenuItemView[],
  mode: "replace" | "append",
) => {
  if (mode === "replace") return custom;
  const merged = [...defaults];
  custom.forEach((item) => {
    const idx = merged.findIndex((entry) => entry.key === item.key);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...item };
      return;
    }
    merged.push(item);
  });
  return merged;
};

function getResolvedMenuItems(template: Template): TemplateMenuItemView[] {
  const config = designerStore.templateContextMenuConfig;
  const customItems = (config?.items || []).map((item) => ({ ...item }));
  const merged = mergeTemplateMenuItems(
    defaultTemplateMenuItems.value,
    customItems,
    config?.mode === "replace" ? "replace" : "append",
  );

  return merged.filter((menuItem) => {
    if (typeof menuItem.hidden === "function") {
      return !menuItem.hidden({ source: "template", item: template });
    }
    return !menuItem.hidden;
  });
}

const isMenuItemDisabled = (
  menuItem: TemplateMenuItemView,
  template: Template,
) => {
  if (typeof menuItem.disabled === "function") {
    return menuItem.disabled({ source: "template", item: template });
  }
  return Boolean(menuItem.disabled);
};

const runBuiltInMenuAction = (
  actionKey: string | undefined,
  template: Template,
) => {
  const key = (actionKey || "") as TemplateMenuActionKey;
  if (key === "viewJson") {
    handleViewJson(template);
    return;
  }
  if (key === "testData") {
    handleTestData(template);
    return;
  }
  if (key === "edit") {
    handleEdit(template);
    return;
  }
  if (key === "copy") {
    handleCopy(template);
    return;
  }
  if (key === "delete") {
    handleDelete(template);
    return;
  }
};

const handleMenuItemClick = async (
  menuItem: TemplateMenuItemView,
  template: Template,
) => {
  if (isMenuItemDisabled(menuItem, template)) return;

  activeMenuId.value = null;
  runBuiltInMenuAction(menuItem.actionKey, template);

  try {
    if (typeof menuItem.onClick === "function") {
      await menuItem.onClick({ source: "template", item: template });
    }
    if (menuItem.eventName) {
      designerStore.emitContextMenuEvent(menuItem.eventName, {
        source: "template",
        actionKey: menuItem.actionKey || null,
        key: menuItem.key,
        item: template,
      });
    }
  } catch (error) {
    console.error("Template context menu action failed", error);
  }
};

const handleTestDataClose = () => {
  const target = testDataTarget.value;
  const allowedKeys = new Set(testDataAllowedKeys.value || []);
  testDataTarget.value = null;
  testDataAllowedKeys.value = [];

  if (!target) return;

  let parsed: Record<string, any> | null = null;
  try {
    const value = testDataContent.value?.trim() || "{}";
    const json = JSON.parse(value);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      parsed = json;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    toast.error(t("common.invalidJson"));
    return;
  }

  if (allowedKeys.size > 0) {
    const inputKeys = Object.keys(parsed);
    const hasKeyDiff =
      inputKeys.length !== allowedKeys.size ||
      inputKeys.some((key) => !allowedKeys.has(key));
    if (hasKeyDiff) {
      toast.error(t("common.testDataKeyChanged"));
      return;
    }
  }

  target.data = { ...(target.data || {}), testData: parsed };
  target.updatedAt = Date.now();

  if (templateStore.currentTemplateId === target.id) {
    designerStore.testData = parsed;
    templateStore.saveCurrentTemplate(target.name);
  } else {
    templateStore.updateTemplate(target.id, { data: target.data });
  }
};

const handleJsonSave = () => {
  const target = jsonTarget.value;
  if (!target) return;

  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonContent.value?.trim() || "{}");
  } catch {
    parsed = null;
  }

  if (!parsed) {
    toast.error(t("common.invalidJson"));
    return;
  }

  if (templateStore.currentTemplateId === target.id) {
    designerStore.applyTemplateJsonToDesigner(parsed);
  } else {
    target.data = { ...target.data, ...parsed };
    templateStore.updateTemplate(target.id, { data: target.data });
  }
  showJsonModal.value = false;
};

const handleModalSave = (payload: ModalSavePayload) => {
  const name = resolveModalName(payload);
  const extraValues = resolveModalExtraValues(payload);
  if (!name) return;

  if (modalMode.value === "create") {
    if (templateStore.currentTemplateId) {
      const currentTemplate = templateStore.templates.find(
        (item) => item.id === templateStore.currentTemplateId,
      );
      if (currentTemplate && canEditEntity(currentTemplate)) {
        templateStore.saveCurrentTemplate(currentTemplate.name);
      }
    }

    if (!targetTemplateId.value && !shouldPreserveCurrentDesignOnCreate.value) {
      designerStore.resetCanvas();
    }
    templateStore.createTemplate(name, undefined, extraValues);
    shouldPreserveCurrentDesignOnCreate.value = false;
    return;
  }

  if (!targetTemplateId.value) return;

  if (modalMode.value === "edit") {
    templateStore.editTemplate(targetTemplateId.value, name, extraValues);
    return;
  }

  templateStore.copyTemplate(targetTemplateId.value, name, extraValues);
};

const modalTitle = computed(() => {
  if (modalMode.value === "edit") return t("template.edit");
  if (modalMode.value === "copy") return t("common.copy");
  if (modalMode.value === "create" && targetTemplateId.value) {
    return t("editor.saveAsTemplate");
  }
  return t("template.new");
});

watch(activeTab, () => {
  searchQuery.value = "";
  activeMenuId.value = null;
});

onMounted(async () => {
  await templateStore.loadTemplates();
  window.addEventListener(
    "designer:new-template",
    handleCreate as EventListener,
    true,
  );
  window.addEventListener(
    "designer:save-as",
    handleSaveAsEvent as EventListener,
    true,
  );

  if (!templateStore.currentTemplateId && templateStore.templates.length > 0) {
    await templateStore.loadTemplate(templateStore.templates[0].id);
  }
});

onUnmounted(() => {
  window.removeEventListener(
    "designer:new-template",
    handleCreate as EventListener,
    true,
  );
  window.removeEventListener(
    "designer:save-as",
    handleSaveAsEvent as EventListener,
    true,
  );
});
</script>

<template>
  <div class="h-full min-h-0 bg-white dark:bg-gray-900 flex flex-col">
    <div
      class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    >
      <button
        type="button"
        :class="[
          'flex-1 py-3 text-sm font-medium transition-colors relative',
          activeTab === 'templates'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
        ]"
        @click="activeTab = 'templates'"
      >
        {{ t("editor.templates") }}
        <div
          v-if="activeTab === 'templates'"
          class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"
        ></div>
      </button>
      <button
        type="button"
        :class="[
          'flex-1 py-3 text-sm font-medium transition-colors relative',
          activeTab === 'variables'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
        ]"
        @click="activeTab = 'variables'"
      >
        {{ t("common.variables") }}
        <div
          v-if="activeTab === 'variables'"
          class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"
        ></div>
      </button>
    </div>

    <div class="p-3 border-b border-gray-100 dark:border-gray-700">
      <div class="py-0">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('common.search')"
          class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto py-1">
      <template v-if="activeTab === 'templates'">
        <div
          v-if="filteredTemplates.length === 0"
          class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
        >
          {{
            templateStore.isLoading
              ? t("common.loading")
              : templateStore.templates.length === 0
                ? t("template.noTemplates")
                : t("common.noData")
          }}
        </div>

        <div
          v-for="item in filteredTemplates"
          :key="item.id"
          class="relative group border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          :title="item.name"
          @click="selectTemplate(item)"
          @contextmenu.prevent="openRowMenuByContext($event, item.id)"
        >
          <div class="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            <span class="w-2 h-2 flex items-center justify-center flex-shrink-0">
              <span
                v-if="templateStore.currentTemplateId === item.id"
                class="w-1.5 h-1.5 rounded-full bg-blue-500"
              ></span>
            </span>
            <span
              v-for="tag in getVisibleTemplateTags(item)"
              :key="`${item.id}-${tag.label}-${tag.color || ''}`"
              class="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] leading-none flex-shrink-0"
              :style="normalizeTagColor(tag.color)"
            >
              {{ tag.label }}
            </span>
            <span
              v-if="getTemplateTagOverflow(item) > 0"
              class="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] leading-none flex-shrink-0 bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
            >
              +{{ getTemplateTagOverflow(item) }}
            </span>
            <span
              class="text-sm truncate flex-1 min-w-0"
              :class="
                templateStore.currentTemplateId === item.id
                  ? 'font-medium text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-200'
              "
            >
              {{ item.name }}
            </span>
          </div>
          <button
            type="button"
            class="row-menu-trigger p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
            :class="{
              'opacity-100 bg-gray-200 dark:bg-gray-600':
                activeMenuId === item.id,
            }"
            @click.stop="toggleRowMenu($event, item.id)"
          >
            <MoreVert class="w-4 h-4" />
          </button>
        </div>
      </template>

      <template v-else>
        <div
          v-if="variables.length === 0"
          class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
        >
          {{ t("common.noData") }}
        </div>

        <div v-else-if="filteredVariables.length > 0" class="space-y-1 p-2">
          <template v-for="item in filteredVariables" :key="item.id">
            <div class="flex flex-col">
              <div
                class="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing"
                :draggable="true"
                @dragstart="handleVarDragStart($event, item)"
              >
                <button
                  v-if="item.children && item.children.length > 0"
                  type="button"
                  class="w-4 h-4 flex items-center justify-center mr-1 text-gray-400 hover:text-gray-600"
                  @click.stop="toggleExpand(item.id)"
                >
                  <KeyboardArrowDown
                    v-if="isNodeExpanded(item.id)"
                    class="w-4 h-4"
                  />
                  <KeyboardArrowRight v-else class="w-4 h-4" />
                </button>
                <div v-else class="w-4 h-4 mr-1"></div>

                <span
                  class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1"
                  :title="item.label"
                  >{{ item.label }}</span
                >
                <span
                  class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]"
                  :title="`@${item.id}`"
                  >@{{ item.id }}</span
                >
              </div>

              <div
                v-if="
                  item.children &&
                  item.children.length > 0 &&
                  isNodeExpanded(item.id)
                "
                class="ml-6 border-l border-gray-200 dark:border-gray-600 pl-1 mt-1 space-y-1"
              >
                <div
                  v-for="child in item.children"
                  :key="child.id"
                  class="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing"
                  :draggable="true"
                  @dragstart="handleVarDragStart($event, child)"
                >
                  <span
                    class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1"
                    :title="child.label"
                    >{{ child.label }}</span
                  >
                  <span
                    class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[100px]"
                    :title="`@${child.id}`"
                    >@{{ child.id }}</span
                  >
                </div>
              </div>
            </div>
          </template>
        </div>

        <div
          v-else
          class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center"
        >
          {{ t("common.noData") }}
        </div>
      </template>
    </div>

    <div
      v-if="activeTab === 'templates'"
      class="border-t border-gray-100 dark:border-gray-700 p-1"
    >
      <button
        @click="handleCreate"
        class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
      >
        <Add class="w-4 h-4" />
        {{ t("template.new") }}
      </button>
    </div>

    <Teleport :to="modalContainer || 'body'">
      <div
        v-if="activeTab === 'templates' && activeMenuId"
        class="fixed inset-0 z-[2000] pointer-events-auto"
        @click="activeMenuId = null"
      >
        <div
          class="row-menu-content absolute w-40 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-100 dark:border-gray-700 z-[2001] py-1 pointer-events-auto"
          :style="menuPosition"
          @click.stop
        >
          <template v-if="activeTemplate">
            <button
              v-for="menuItem in getResolvedMenuItems(activeTemplate)"
              :key="menuItem.key"
              @click="handleMenuItemClick(menuItem, activeTemplate)"
              :disabled="isMenuItemDisabled(menuItem, activeTemplate)"
              class="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="
                menuItem.danger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              "
            >
              <component
                v-if="menuItem.iconComponent"
                :is="menuItem.iconComponent"
                class="w-3.5 h-3.5"
              />
              <img
                v-else-if="menuItem.iconImage"
                :src="menuItem.iconImage"
                class="w-3.5 h-3.5 object-contain"
              />
              <i v-else-if="menuItem.iconClass" :class="menuItem.iconClass"></i>
              <img
                v-else-if="resolveIconFromIconField(menuItem.icon)"
                :src="resolveIconFromIconField(menuItem.icon) || ''"
                class="w-3.5 h-3.5 object-contain"
              />
              <span
                v-else-if="menuItem.icon"
                class="w-3.5 h-3.5 inline-flex items-center justify-center"
                >{{ menuItem.icon }}</span
              >
              <span>{{ menuItem.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <InputModal
      :show="showModal"
      :initial-value="modalInitialName"
      :initial-values="modalInitialValues"
      :fields="modalFields"
      :title="modalTitle"
      @close="showModal = false"
      @save="handleModalSave"
    />

    <CodeEditorModal
      v-model:visible="showTestDataModal"
      :title="t('common.testData')"
      :value="testDataContent"
      language="json"
      @update:value="testDataContent = $event"
      @close="handleTestDataClose"
    />

    <CodeEditorModal
      v-model:visible="showJsonModal"
      :title="t('preview.templateJson')"
      :value="jsonContent"
      language="json"
      :read-only="jsonTarget ? !canEditEntity(jsonTarget) : false"
      :show-save-button="jsonTarget ? canEditEntity(jsonTarget) : false"
      @update:value="jsonContent = $event"
      @save="handleJsonSave"
    />
  </div>
</template>
