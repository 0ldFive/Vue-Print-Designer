<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
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
import Copy from '~icons/material-symbols/content-copy';
import DataObject from '~icons/material-symbols/data-object';
import { ElementType, type CustomElementTemplate } from '@/types';
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
const showRenameModal = ref(false);
const renameTargetId = ref<string | null>(null);
const renameInitialName = ref('');

const showTestDataModal = ref(false);
const testDataContent = ref('');
const testDataTarget = ref<CustomElementTemplate | null>(null);
const testDataAllowedKeys = ref<string[]>([]);

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

const toggleMenu = (event: MouseEvent, id: string) => {
  event.stopPropagation();
  if (activeMenuId.value === id) {
    activeMenuId.value = null;
  } else {
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // Horizontal edge detection
    // Default: Align right edge of menu with right edge of button (menu width ~128px)
    let left = rect.right - 128;
    // If aligning right causes overflow to left (e.g. left column), align to left edge instead
    if (left < 5) {
      left = rect.left;
    }

    // Vertical edge detection
    const MENU_HEIGHT_ESTIMATE = 210; // Estimate menu height (5 items + padding)
    const spaceBelow = window.innerHeight - rect.bottom;
    
    if (spaceBelow < MENU_HEIGHT_ESTIMATE) {
      // Position above the button
      menuPosition.value = {
        bottom: `${window.innerHeight - rect.top + 5}px`,
        left: `${left}px`
      };
    } else {
      // Position below the button
      menuPosition.value = {
        top: `${rect.bottom + 5}px`,
        left: `${left}px`
      };
    }
    
    activeMenuId.value = id;
  }
};

const handleGlobalClick = (e: MouseEvent) => {
  const path = e.composedPath();
  
  // Find menu within the same shadow root or document
  const root = (e.currentTarget as HTMLElement)?.getRootNode() as Document | ShadowRoot;
  const menu = root?.querySelector?.('.sidebar-context-menu');
  const isInsideMenu = menu && path.includes(menu);
  
  if (!isInsideMenu) {
    activeMenuId.value = null;
  }
};

const handleRename = (item: CustomElementTemplate) => {
  activeMenuId.value = null;
  renameTargetId.value = item.id;
  renameInitialName.value = item.name;
  showRenameModal.value = true;
};

const onRenameSave = (newName: string) => {
  if (renameTargetId.value && newName) {
    store.renameCustomElement(renameTargetId.value, newName);
  }
};

const handleCopy = (item: CustomElementTemplate) => {
  activeMenuId.value = null;
  // Create a copy with a new ID and appended name
  store.addCustomElement(`${item.name} Copy`, item.element);
};

const handleDelete = (item: CustomElementTemplate) => {
  activeMenuId.value = null;
  if (confirm(t('sidebar.confirmDelete', { name: item.name }))) {
    store.removeCustomElement(item.id);
  }
};

const handleEditElement = (item: CustomElementTemplate) => {
  activeMenuId.value = null;

  if (store.editingCustomElementId === item.id) return;

  if (store.editingCustomElementId && store.editingCustomElementId !== item.id) {
    const current = store.customElements.find(el => el.id === store.editingCustomElementId);
    const currentName = current ? current.name : '';
    if (!confirm(t('sidebar.confirmSwitchEdit', { name: currentName }))) {
      return;
    }
    store.cancelCustomElementEdit();
  }

  store.startCustomElementEdit(item.id);
};

const supportsTestData = (item: CustomElementTemplate) => {
  return elementSupportsVariables(item.element);
};

const handleTestData = (item: CustomElementTemplate) => {
  activeMenuId.value = null;
  testDataTarget.value = item;
  const existing = item.testData || {};
  const data = buildTestDataFromElement(item.element, existing);
  testDataAllowedKeys.value = Object.keys(data);
  testDataContent.value = JSON.stringify(data, null, 2);
  showTestDataModal.value = true;
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
    alert(t('common.invalidJson'));
    return;
  }

  if (allowedKeys.size > 0) {
    const inputKeys = Object.keys(parsed);
    const hasKeyDiff = inputKeys.length !== allowedKeys.size
      || inputKeys.some(key => !allowedKeys.has(key));
    if (hasKeyDiff) {
      alert(t('common.testDataKeyChanged'));
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
          >
            <component :is="getIcon(item.element.type)" class="w-8 h-8 text-gray-600 dark:text-gray-300 mb-2" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate w-full text-center" :title="item.name">{{ item.name }}</span>
            
            <button 
              @click="toggleMenu($event, item.id)"
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
          class="sidebar-context-menu absolute w-32 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-100 dark:border-gray-700 z-[2001] py-1 pointer-events-auto"
          :style="menuPosition"
          @click.stop
        >
          <template v-for="item in customElements" :key="item.id">
            <template v-if="item.id === activeMenuId">
              <button @click="handleEditElement(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Edit class="w-3.5 h-3.5" /> {{ t('sidebar.editElement') }}
              </button>
              <button v-if="supportsTestData(item)" @click="handleTestData(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <DataObject class="w-3.5 h-3.5" /> {{ t('common.testData') }}
              </button>
              <button @click="handleRename(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Edit class="w-3.5 h-3.5" /> {{ t('sidebar.rename') }}
              </button>
              <button @click="handleCopy(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Copy class="w-3.5 h-3.5" /> {{ t('sidebar.copy') }}
              </button>
              <button @click="handleDelete(item)" class="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2">
                <Delete class="w-3.5 h-3.5" /> {{ t('sidebar.delete') }}
              </button>
            </template>
          </template>
        </div>
      </div>
    </Teleport>

    <InputModal
      :show="showRenameModal"
      :initial-value="renameInitialName"
      :title="t('sidebar.renameModalTitle')"
      :placeholder="t('sidebar.enterNamePlaceholder')"
      @close="showRenameModal = false"
      @save="onRenameSave"
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
