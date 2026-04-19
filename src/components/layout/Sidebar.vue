<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { uiConfirm } from '@/utils/confirm';
import { toast } from '@/utils/toast';
import { useDesignerStore } from '@/stores/designer';
import Type from '~icons/material-symbols/text-fields';
import Numbers from '~icons/material-symbols/numbers';
import Image from '~icons/material-symbols/image';
import Table from '~icons/material-symbols/table-chart';
import Barcode from '~icons/material-symbols/barcode';
import QrCode from '~icons/material-symbols/qr-code';
import HorizontalRule from '~icons/material-symbols/horizontal-rule';
import CheckBoxOutlineBlank from '~icons/material-symbols/check-box-outline-blank';
import RadioButtonUnchecked from '~icons/material-symbols/radio-button-unchecked';
import Star from '~icons/material-symbols/star';
import Delete from '~icons/material-symbols/delete';
import MoreVert from '~icons/material-symbols/more-vert';
import Edit from '~icons/material-symbols/edit';
import Palette from '~icons/material-symbols/palette';
import Copy from '~icons/material-symbols/content-copy';
import DataObject from '~icons/material-symbols/data-object';
import { ElementType, type CustomElementTemplate, type ListContextMenuItem } from '@/types';
import { canCopyEntity, canDeleteEntity, canEditEntity } from '@/utils/entityConstraints';
import InputModal from '@/components/common/InputModal.vue';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import { buildTestDataFromElement, elementSupportsVariables } from '@/utils/variables';

const { t } = useI18n();
const store = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));
const activeTab = ref<'standard' | 'custom'>('standard');
const customElements = computed(() => store.customElements);

// Menu state
const activeMenuId = ref<string | null>(null);
const menuPosition = ref<Record<string, string>>({});

// Modal state
const showEditModal = ref(false);
const editModalMode = ref<'edit' | 'copy'>('edit');
const editTargetId = ref<string | null>(null);
const editInitialName = ref('');
const editInitialValues = ref<Record<string, any>>({});
const editModalFields = computed(() => {
  return store.customElementModalFormConfig?.[editModalMode.value]?.fields;
});

const showTestDataModal = ref(false);
const testDataContent = ref('');
const testDataTarget = ref<CustomElementTemplate | null>(null);
const testDataAllowedKeys = ref<string[]>([]);

type CustomMenuActionKey = 'editElement' | 'testData' | 'edit' | 'copy' | 'delete';
type CustomMenuItemView = ListContextMenuItem & { iconComponent?: Component };

const resolveIconFromIconField = (icon: string | undefined) => {
  if (!icon) return null;
  // Support iconify-style names like "material-symbols:edit" via CDN svg.
  const isIconifyName = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9-]+$/i.test(icon);
  if (!isIconifyName) return null;
  return `https://api.iconify.design/${encodeURIComponent(icon)}.svg`;
};

const categories = [
  {
    title: 'sidebar.general',
    items: [
      { type: ElementType.TEXT, label: 'sidebar.text', icon: Type },
      { type: ElementType.IMAGE, label: 'sidebar.image', icon: Image },
      { type: ElementType.PAGE_NUMBER, label: 'sidebar.pagination', icon: Numbers },
    ]
  },
  {
    title: 'sidebar.dataCodes',
    items: [
      { type: ElementType.TABLE, label: 'sidebar.table', icon: Table },
      { type: ElementType.BARCODE, label: 'sidebar.barcode', icon: Barcode },
      { type: ElementType.QRCODE, label: 'sidebar.qrcode', icon: QrCode },
    ]
  },
  {
    title: 'sidebar.shapes',
    items: [
      { type: ElementType.LINE, label: 'sidebar.line', icon: HorizontalRule },
      { type: ElementType.RECT, label: 'sidebar.rect', icon: CheckBoxOutlineBlank },
      { type: ElementType.CIRCLE, label: 'sidebar.circle', icon: RadioButtonUnchecked },
    ]
  }
];

const handleDragStart = (event: DragEvent, type: ElementType) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify({ type }));
    event.dataTransfer.effectAllowed = 'copy';
  }
};

const handleDragStartCustom = (event: DragEvent, template: CustomElementTemplate) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify({ 
      type: template.element.type,
      payload: template.element
    }));
    event.dataTransfer.effectAllowed = 'copy';
  }
};

const getIcon = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT: return Type;
    case ElementType.IMAGE: return Image;
    case ElementType.TABLE: return Table;
    case ElementType.PAGE_NUMBER: return Numbers;
    case ElementType.BARCODE: return Barcode;
    case ElementType.QRCODE: return QrCode;
    case ElementType.LINE: return HorizontalRule;
    case ElementType.RECT: return CheckBoxOutlineBlank;
    case ElementType.CIRCLE: return RadioButtonUnchecked;
    default: return Star;
  }
};

const activeCustomElement = computed(() => {
  if (!activeMenuId.value) return null;
  return customElements.value.find(item => item.id === activeMenuId.value) || null;
});

const positionMenuAt = (x: number, y: number, id: string) => {
  const target = customElements.value.find(item => item.id === id);
  if (!target) return;

  const menuWidth = 160;
  const itemCount = Math.max(1, getResolvedCustomMenuItems(target).length);
  const menuHeightEstimate = itemCount * 30 + 10;

  const left = Math.max(5, Math.min(x, window.innerWidth - menuWidth - 5));
  let top = y;
  if (top + menuHeightEstimate > window.innerHeight - 5) {
    top = Math.max(5, y - menuHeightEstimate);
  }

  menuPosition.value = {
    top: `${top}px`,
    left: `${left}px`
  };
  activeMenuId.value = id;
};

const toggleMenu = (event: MouseEvent, id: string) => {
  event.stopPropagation();
  if (activeMenuId.value === id) {
    activeMenuId.value = null;
    return;
  }
  const button = event.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  positionMenuAt(rect.right - 160, rect.bottom + 5, id);
};

const openMenuByContext = (event: MouseEvent, id: string) => {
  event.stopPropagation();
  event.preventDefault(); // 阻止默认右键菜单
  positionMenuAt(event.clientX, event.clientY, id);
};

const handleGlobalClick = (e: MouseEvent) => {
  if (!activeMenuId.value) return;
  
  const path = e.composedPath();
  const isInsideMenu = path.some(el => {
    if (el instanceof Element) {
      return el.classList.contains('sidebar-context-menu');
    }
    return false;
  });
  
  if (!isInsideMenu) {
    activeMenuId.value = null;
  }
};

const getCustomElementModalSavedValues = (templateId: string, mode: 'edit' | 'copy') => {
  if (!templateId) return {};
  const cacheExt = store.customElementDetailCache[templateId]?.ext || {};
  const listExt = store.customElements.find(t => t.id === templateId)?.ext || {};
  const ext = { ...listExt, ...cacheExt };
  const extForm = ext.templateModalForm || {};
  const cacheForm = cacheExt.templateModalForm || {};
  
  const savedValues = { ...extForm[mode], ...cacheForm[mode] };
  
  if (Object.keys(savedValues).length === 0) {
    const lastMode = cacheForm.lastMode || extForm.lastMode;
    if (lastMode && (extForm[lastMode] || cacheForm[lastMode])) {
      return { ...extForm[lastMode], ...cacheForm[lastMode] };
    }
  }
  return savedValues;
};

const buildCustomElementModalInitialValues = (template: CustomElementTemplate, mode: 'edit' | 'copy') => {
  const configItem = store.customElementModalFormConfig?.[mode];
  if (!configItem) return {};
  
  const defaultValues = configItem.initialValues || {};
  const savedValues = getCustomElementModalSavedValues(template.id, mode);
  
  const finalValues = {
    ...defaultValues,
    ...savedValues,
    ...template.ext
  };
  
  delete finalValues.templateModalForm;
  return finalValues;
};

const handleEdit = (item: CustomElementTemplate) => {
  if (!canEditEntity(item)) {
    toast.warning(t('toast.customElementReadOnly'));
    return;
  }
  activeMenuId.value = null;
  editModalMode.value = 'edit';
  editTargetId.value = item.id;
  editInitialName.value = item.name;
  editInitialValues.value = buildCustomElementModalInitialValues(item, 'edit');
  showEditModal.value = true;
};

const onEditSave = (payload: string | Record<string, any>) => {
  if (editTargetId.value) {
    let newName = '';
    let extraValues: Record<string, any> | undefined = undefined;

    if (typeof payload === 'string') {
      newName = payload;
    } else {
      newName = payload.name;
      const { name, ...rest } = payload;
      if (Object.keys(rest).length > 0) {
        extraValues = rest;
      }
    }
    
    if (newName) {
      if (editModalMode.value === 'edit') {
        store.editCustomElement(editTargetId.value, newName, extraValues);
      } else if (editModalMode.value === 'copy') {
        store.copyCustomElement(editTargetId.value, { ...extraValues, name: newName });
      }
    }
  }
};

const handleCopy = (item: CustomElementTemplate) => {
  if (!canCopyEntity(item)) {
    toast.warning(t('toast.customElementCopyNotAllowed'));
    return;
  }
  activeMenuId.value = null;
  editModalMode.value = 'copy';
  editTargetId.value = item.id;
  editInitialName.value = `${item.name} Copy`;
  editInitialValues.value = buildCustomElementModalInitialValues(item, 'copy');
  showEditModal.value = true;
};

const handleDelete = async (item: CustomElementTemplate) => {
  if (!canDeleteEntity(item)) {
    toast.warning(t('toast.customElementDeleteNotAllowed'));
    return;
  }
  activeMenuId.value = null;
  const confirmed = await uiConfirm.show(t('sidebar.confirmDelete', { name: item.name }));
  if (confirmed) {
    await store.removeCustomElement(item.id);
  }
};

const handleEditElement = async (item: CustomElementTemplate) => {
  if (!canEditEntity(item)) {
    toast.warning(t('toast.customElementReadOnly'));
    return;
  }
  activeMenuId.value = null;

  if (store.editingCustomElementId === item.id) return;

  if (store.editingCustomElementId && store.editingCustomElementId !== item.id) {
    const current = store.customElements.find(el => el.id === store.editingCustomElementId);
    const currentName = current ? current.name : '';
    if (!await uiConfirm.show(t('sidebar.confirmSwitchEdit', { name: currentName }))) {
      return;
    }
    store.cancelCustomElementEdit();
  }

  store.startCustomElementEdit(item.id);
};

const supportsTestData = (item: CustomElementTemplate) => {
  return elementSupportsVariables(item.element);
};

const handleTestData = async (item: CustomElementTemplate) => {
  activeMenuId.value = null;
  // Custom elements don't have a fetch detail yet
  testDataTarget.value = item;
  const existing = item.testData || {};
  const data = buildTestDataFromElement(item.element, existing);
  testDataAllowedKeys.value = Object.keys(data);
  testDataContent.value = JSON.stringify(data, null, 2);
  showTestDataModal.value = true;
};

const defaultCustomMenuItems = computed<CustomMenuItemView[]>(() => ([
  { key: 'editElement', actionKey: 'editElement', label: t('sidebar.editElement'), iconComponent: Palette, disabled: ({ item }) => !canEditEntity(item) },
  { key: 'testData', actionKey: 'testData', label: t('common.testData'), iconComponent: DataObject, hidden: ({ item }) => !supportsTestData(item as CustomElementTemplate) },
  { key: 'edit', actionKey: 'edit', label: t('sidebar.edit'), iconComponent: Edit, disabled: ({ item }) => !canEditEntity(item) },
  { key: 'copy', actionKey: 'copy', label: t('sidebar.copy'), iconComponent: Copy, disabled: ({ item }) => !canCopyEntity(item) },
  { key: 'delete', actionKey: 'delete', label: t('sidebar.delete'), iconComponent: Delete, danger: true, disabled: ({ item }) => !canDeleteEntity(item) }
]));

const mergeCustomMenuItems = (defaults: CustomMenuItemView[], custom: CustomMenuItemView[], mode: 'replace' | 'append') => {
  if (mode === 'replace') return custom;
  const merged = [...defaults];
  custom.forEach((item) => {
    const idx = merged.findIndex(entry => entry.key === item.key);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...item };
      return;
    }
    merged.push(item);
  });
  return merged;
};

function getResolvedCustomMenuItems(item: CustomElementTemplate): CustomMenuItemView[] {
  const config = store.customElementContextMenuConfig;
  const customItems = (config?.items || []).map(menuItem => ({ ...menuItem }));
  const merged = mergeCustomMenuItems(
    defaultCustomMenuItems.value,
    customItems,
    config?.mode === 'replace' ? 'replace' : 'append'
  );

  return merged.filter((menuItem) => {
    if (typeof menuItem.hidden === 'function') {
      return !menuItem.hidden({ source: 'customElement', item });
    }
    return !menuItem.hidden;
  });
}

const isCustomMenuItemDisabled = (menuItem: CustomMenuItemView, item: CustomElementTemplate) => {
  if (typeof menuItem.disabled === 'function') {
    return menuItem.disabled({ source: 'customElement', item });
  }
  return Boolean(menuItem.disabled);
};

const runBuiltInCustomMenuAction = (actionKey: string | undefined, item: CustomElementTemplate) => {
  const key = (actionKey || '') as CustomMenuActionKey;
  if (key === 'editElement') {
    handleEditElement(item);
    return;
  }
  if (key === 'testData') {
    handleTestData(item);
    return;
  }
  if (key === 'edit') {
    handleEdit(item);
    return;
  }
  if (key === 'copy') {
    handleCopy(item);
    return;
  }
  if (key === 'delete') {
    handleDelete(item);
  }
};

const handleCustomMenuClick = async (menuItem: CustomMenuItemView, item: CustomElementTemplate) => {
  if (isCustomMenuItemDisabled(menuItem, item)) return;

  activeMenuId.value = null;

  runBuiltInCustomMenuAction(menuItem.actionKey, item);

  try {
    if (typeof menuItem.onClick === 'function') {
      await menuItem.onClick({ source: 'customElement', item });
    }
    if (menuItem.eventName) {
      store.emitContextMenuEvent(menuItem.eventName, {
        source: 'customElement',
        actionKey: menuItem.actionKey || null,
        key: menuItem.key,
        item
      });
    }
  } catch (error) {
    console.error('Custom element context menu action failed', error);
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
    const value = testDataContent.value?.trim() || '{}';
    const json = JSON.parse(value);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      parsed = json;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    toast.error(t('common.invalidJson'));
    return;
  }

  if (allowedKeys.size > 0) {
    const inputKeys = Object.keys(parsed);
    const hasKeyDiff = inputKeys.length !== allowedKeys.size
      || inputKeys.some(key => !allowedKeys.has(key));
    if (hasKeyDiff) {
      toast.error(t('common.testDataKeyChanged'));
      return;
    }
  }

  const base = buildTestDataFromElement(target.element, target.testData || {});
  const next: Record<string, any> = {};
  Object.keys(base).forEach((key) => {
    if (allowedKeys.size === 0 || allowedKeys.has(key)) {
      next[key] = Object.prototype.hasOwnProperty.call(parsed, key) ? parsed[key] : base[key];
    }
  });
  target.testData = next;
  store.saveCustomElements();
};

onMounted(() => {
  window.addEventListener('mousedown', handleGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', handleGlobalClick);
});
</script>

<template>
  <aside class="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full z-40">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <h2 class="font-semibold text-gray-700 dark:text-gray-200">{{ t('sidebar.elements') }}</h2>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('sidebar.dragToCanvas') }}</p>
    </div>
    
    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <button 
        @click="activeTab = 'standard'"
        :class="['flex-1 py-3 text-sm font-medium transition-colors relative', activeTab === 'standard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800']"
      >
        {{ t('sidebar.standard') }}
        <div v-if="activeTab === 'standard'" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>
      </button>
      <button 
        @click="activeTab = 'custom'"
        :class="['flex-1 py-3 text-sm font-medium transition-colors relative', activeTab === 'custom' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800']"
      >
        {{ t('sidebar.custom') }}
        <div v-if="activeTab === 'custom'" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400"></div>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Standard Elements Tab -->
      <template v-if="activeTab === 'standard'">
        <div v-for="category in categories" :key="category.title" class="p-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">{{ t(category.title) }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div 
              v-for="item in category.items" 
              :key="item.type"
              class="flex flex-col items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg theme-hover-border theme-hover-bg cursor-move transition-all dark:bg-gray-800 dark:hover:bg-gray-700"
              draggable="true"
              @dragstart="(e) => handleDragStart(e, item.type)"
            >
              <component :is="item.icon" class="w-8 h-8 text-gray-600 dark:text-gray-300 mb-2" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t(item.label) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Elements Tab -->
      <template v-if="activeTab === 'custom'">
        <div v-if="customElements.length === 0" class="p-6 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('sidebar.noCustomElements') }}</p>
        </div>
        <div v-else class="p-4 grid grid-cols-2 gap-3">
          <div 
            v-for="item in customElements" 
            :key="item.id"
            class="group relative flex flex-col items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg theme-hover-border theme-hover-bg cursor-move transition-all dark:bg-gray-800 dark:hover:bg-gray-700"
            draggable="true"
            @dragstart="(e) => handleDragStartCustom(e, item)"
            @contextmenu.prevent="openMenuByContext($event, item.id)"
          >
            <component :is="getIcon(item.element.type)" class="w-8 h-8 text-gray-600 dark:text-gray-300 mb-2" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate w-full text-center" :title="item.name">{{ item.name }}</span>
            
            <button 
              @click.stop="toggleMenu($event, item.id)"
              class="absolute top-1 right-1 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
              :class="{'opacity-100 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300': activeMenuId === item.id}"
              :title="t('sidebar.moreOptions')"
            >
              <MoreVert class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Context Menu Portal -->
    <Teleport :to="modalContainer || 'body'">
      <div v-if="activeMenuId" class="fixed inset-0 z-[2000] pointer-events-auto" @click="activeMenuId = null">
        <div 
          class="sidebar-context-menu absolute w-40 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-100 dark:border-gray-700 z-[2001] py-1 pointer-events-auto"
          :style="menuPosition"
          @click.stop
        >
          <template v-if="activeCustomElement">
            <button
              v-for="menuItem in getResolvedCustomMenuItems(activeCustomElement)"
              :key="menuItem.key"
              @click="handleCustomMenuClick(menuItem, activeCustomElement)"
              :disabled="isCustomMenuItemDisabled(menuItem, activeCustomElement)"
              class="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="menuItem.danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
            >
              <component v-if="menuItem.iconComponent" :is="menuItem.iconComponent" class="w-3.5 h-3.5" />
              <img v-else-if="menuItem.iconImage" :src="menuItem.iconImage" class="w-3.5 h-3.5 object-contain" />
              <i v-else-if="menuItem.iconClass" :class="menuItem.iconClass"></i>
              <img v-else-if="resolveIconFromIconField(menuItem.icon)" :src="resolveIconFromIconField(menuItem.icon)!" class="w-3.5 h-3.5 object-contain" />
              <span v-else-if="menuItem.icon" class="w-3.5 h-3.5 inline-flex items-center justify-center">{{ menuItem.icon }}</span>
              <span>{{ menuItem.label }}</span>
              </button>
          </template>
        </div>
      </div>
    </Teleport>

    <InputModal
      :show="showEditModal"
      :initial-value="editInitialName"
      :initial-values="editInitialValues"
      :fields="editModalFields"
      :title="editModalMode === 'edit' ? t('sidebar.editModalTitle') : t('common.copy')"
      :placeholder="t('sidebar.enterNamePlaceholder')"
      @close="showEditModal = false"
      @save="onEditSave"
    />

    <CodeEditorModal
      v-model:visible="showTestDataModal"
      :title="t('common.testData')"
      :value="testDataContent"
      language="json"
      @update:value="testDataContent = $event"
      @close="handleTestDataClose"
    />
  </aside>
</template>
