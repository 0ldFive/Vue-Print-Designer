<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTemplateStore, type Template } from '@/stores/templates';
import { useDesignerStore } from '@/stores/designer';

import ChevronDown from '~icons/material-symbols/expand-more';
import MoreVert from '~icons/material-symbols/more-vert';
import Edit from '~icons/material-symbols/edit';
import Copy from '~icons/material-symbols/content-copy';
import Trash2 from '~icons/material-symbols/delete';
import Add from '~icons/material-symbols/add';
import Check from '~icons/material-symbols/check'; // For selection indicator maybe?
import Description from '~icons/material-symbols/description';
import DataObject from '~icons/material-symbols/data-object';

import InputModal from '@/components/common/InputModal.vue';
import CodeEditorModal from '@/components/common/CodeEditorModal.vue';
import { buildTestDataFromPages } from '@/utils/variables';

const { t } = useI18n();
const store = useTemplateStore();
const designerStore = useDesignerStore();
const modalContainer = inject('modal-container', ref<HTMLElement | null>(null));
const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

// Row Menu State
const activeMenuId = ref<string | null>(null);
const menuPosition = ref<Record<string, string>>({});

// Modal State
const showModal = ref(false);
const modalMode = ref<'create' | 'rename'>('create');
const modalInitialName = ref('');
const targetTemplateId = ref<string | null>(null);

const showTestDataModal = ref(false);
const testDataContent = ref('');
const testDataTarget = ref<Template | null>(null);
const testDataAllowedKeys = ref<string[]>([]);

onMounted(() => {
  store.loadTemplates();
  // Auto-select first template if available and none selected
  if (!store.currentTemplateId && store.templates.length > 0) {
    store.loadTemplate(store.templates[0].id);
  }
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('designer:new-template', handleCreate);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('designer:new-template', handleCreate);
});

const handleClickOutside = (e: MouseEvent) => {
  const path = e.composedPath();
  const isInsideContainer = containerRef.value && path.includes(containerRef.value);
  
  // Find menu content within the same shadow root or document
  const root = (containerRef.value?.getRootNode() as Document | ShadowRoot) || document;
  const menuContent = root.querySelector('.row-menu-content');
  const isInsideMenuContent = menuContent && path.includes(menuContent);

  if (!isInsideContainer && !isInsideMenuContent) {
    isOpen.value = false;
    activeMenuId.value = null;
  }
};

const currentTemplateName = computed(() => {
  const tpl = store.templates.find(t => t.id === store.currentTemplateId);
  return tpl ? tpl.name : t('template.select');
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) activeMenuId.value = null;
};

const selectTemplate = (template: Template) => {
  // Auto-save current template if it exists
  if (store.currentTemplateId) {
    const currentTemplate = store.templates.find(tpl => tpl.id === store.currentTemplateId);
    if (currentTemplate) {
      store.saveCurrentTemplate(currentTemplate.name);
    }
  }
  
  store.loadTemplate(template.id);
  isOpen.value = false;
};

const toggleRowMenu = (e: MouseEvent, id: string) => {
  e.stopPropagation(); // Prevent row selection
  if (activeMenuId.value === id) {
    activeMenuId.value = null;
  } else {
    // Calculate position
    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // Position menu to the right of the button, but slightly overlapping
    // or below it? Let's try below-right aligned or right-aligned.
    // The previous implementation was top-8 right-0 (absolute).
    // Let's do fixed positioning.
    
    // Check if we have enough space on the right
    const menuWidth = 128; // w-32 = 8rem = 128px
    
    // Horizontal edge detection
    let left = rect.right - menuWidth;
    if (left < 5) {
      left = rect.left;
    }

    // Vertical edge detection
    const MENU_HEIGHT_ESTIMATE = 150; // 4 items (Test Data, Rename, Copy, Delete)
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow < MENU_HEIGHT_ESTIMATE) {
      // Position above
      menuPosition.value = {
        bottom: `${window.innerHeight - rect.top + 5}px`,
        left: `${left}px`
      };
    } else {
      // Position below
      menuPosition.value = {
        top: `${rect.bottom + 5}px`,
        left: `${left}px`
      };
    }

    activeMenuId.value = id;
  }
};

const getActiveTemplate = () => {
  return store.templates.find(t => t.id === activeMenuId.value);
};

const handleCreate = () => {
  activeMenuId.value = null;
  modalMode.value = 'create';
  modalInitialName.value = '';
  showModal.value = true;
  isOpen.value = false;
};

const handleEdit = (template: Template) => {
  activeMenuId.value = null;
  modalMode.value = 'rename';
  targetTemplateId.value = template.id;
  modalInitialName.value = template.name;
  showModal.value = true;
  isOpen.value = false; // Close dropdown? Or keep open? Close is better.
};

const handleCopy = (template: Template) => {
  store.copyTemplate(template.id);
  activeMenuId.value = null;
};

const handleDelete = (template: Template) => {
  if (confirm(t('template.confirmDelete', { name: template.name }))) {
    store.deleteTemplate(template.id);
    // Auto-select first template if current one was deleted
    if (!store.currentTemplateId && store.templates.length > 0) {
      store.loadTemplate(store.templates[0].id);
    }
  }
  activeMenuId.value = null;
};

const buildTemplateTestData = (template: Template) => {
  const isCurrent = store.currentTemplateId === template.id;
  const existing = isCurrent ? (designerStore.testData || {}) : (template.data?.testData || {});
  const pages = isCurrent ? designerStore.pages : (template.data?.pages || []);
  return buildTestDataFromPages(pages, existing);
};

const handleTestData = (template: Template) => {
  activeMenuId.value = null;
  testDataTarget.value = template;
  const data = buildTemplateTestData(template);
  testDataAllowedKeys.value = Object.keys(data);
  testDataContent.value = JSON.stringify(data, null, 2);
  showTestDataModal.value = true;
  isOpen.value = false;
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

  target.data = { ...(target.data || {}), testData: parsed };
  target.updatedAt = Date.now();
  store.saveToLocalStorage();

  if (store.currentTemplateId === target.id) {
    designerStore.testData = parsed;
  }
};

const handleModalSave = (name: string) => {
  if (modalMode.value === 'create') {
    // Auto-save current template before creating new one
    if (store.currentTemplateId) {
      const currentTemplate = store.templates.find(tpl => tpl.id === store.currentTemplateId);
      if (currentTemplate) {
        store.saveCurrentTemplate(currentTemplate.name);
      }
    }

    // Reset canvas before creating new template
    const designerStore = useDesignerStore(); // Ensure we have access to designer store
    designerStore.resetCanvas();
    store.createTemplate(name);
  } else if (modalMode.value === 'rename' && targetTemplateId.value) {
    store.renameTemplate(targetTemplateId.value, name);
  }
};
</script>

<template>
  <div class="relative" ref="containerRef">
    <button 
      @click.stop="toggleDropdown"
      class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors w-40"
      title="Templates"
    >
      <Description class="w-4 h-4 flex-shrink-0" />
      <span class="flex-1 truncate text-left">{{ currentTemplateName }}</span>
      <ChevronDown class="w-4 h-4 flex-shrink-0" />
    </button>

    <div v-if="isOpen" class="absolute top-full left-0 mt-2 w-[220px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100] flex flex-col max-h-[500px]">
      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="store.templates.length === 0" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          {{ t('template.noTemplates') }}
        </div>
        
        <div 
          v-for="t in store.templates" 
          :key="t.id"
          class="relative group border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          @click="selectTemplate(t)"
        >
          <div class="flex items-center gap-2 overflow-hidden flex-1">
             <div class="w-2 h-2 flex items-center justify-center flex-shrink-0">
               <div class="w-1.5 h-1.5 rounded-full bg-blue-500" v-if="store.currentTemplateId === t.id"></div>
             </div>
             <span class="text-sm text-gray-700 dark:text-gray-200 truncate" :class="{'font-medium text-blue-600 dark:text-blue-400': store.currentTemplateId === t.id}">{{ t.name }}</span>
          </div>
          
          <button 
            @click="toggleRowMenu($event, t.id)"
            class="row-menu-trigger p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
            :class="{'opacity-100 bg-gray-200 dark:bg-gray-600': activeMenuId === t.id}"
          >
            <MoreVert class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="border-t border-gray-100 dark:border-gray-700 p-1">
        <button 
          @click="handleCreate"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
        >
          <Add class="w-4 h-4" />
          {{ t('template.new') }}
        </button>
      </div>
    </div>

    <!-- Row Menu Portal -->
    <Teleport :to="modalContainer || 'body'">
      <div v-if="activeMenuId" class="fixed inset-0 z-[2000] pointer-events-auto" @click="activeMenuId = null">
        <div 
          class="row-menu-content absolute w-32 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-100 dark:border-gray-700 z-[2001] py-1 pointer-events-auto"
          :style="menuPosition"
          @click.stop
        >
          <template v-if="getActiveTemplate()">
            <button @click="handleTestData(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
              <DataObject class="w-3.5 h-3.5" /> {{ t('common.testData') }}
            </button>
            <button @click="handleEdit(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
              <Edit class="w-3.5 h-3.5" /> {{ t('common.rename') }}
            </button>
            <button @click="handleCopy(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
              <Copy class="w-3.5 h-3.5" /> {{ t('common.copy') }}
            </button>
            <button @click="handleDelete(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2">
              <Trash2 class="w-3.5 h-3.5" /> {{ t('common.delete') }}
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <InputModal 
      :show="showModal"
      :initial-value="modalInitialName"
      :title="modalMode === 'create' ? t('template.new') : t('template.rename')"
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
  </div>
</template>
