<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
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

import InputModal from '@/components/common/InputModal.vue';

const { t } = useI18n();
const store = useTemplateStore();
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
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
    activeMenuId.value = null;
  }
  // Close row menu if clicking elsewhere
  const target = e.target as HTMLElement;
  if (activeMenuId.value && !target.closest('.row-menu-trigger') && !target.closest('.row-menu-content')) {
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
    const MENU_HEIGHT_ESTIMATE = 110; // 3 items (Rename, Copy, Delete)
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
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-40"
      title="Templates"
    >
      <Description class="w-4 h-4 text-gray-500 flex-shrink-0" />
      <span class="flex-1 truncate text-left">{{ currentTemplateName }}</span>
      <ChevronDown class="w-4 h-4 text-gray-500 flex-shrink-0" />
    </button>

    <div v-if="isOpen" class="absolute top-full left-0 mt-2 w-[220px] bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col max-h-[500px]">
      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="store.templates.length === 0" class="px-4 py-3 text-sm text-gray-500 text-center">
          {{ t('template.noTemplates') }}
        </div>
        
        <div 
          v-for="t in store.templates" 
          :key="t.id"
          class="relative group border-b border-gray-100 last:border-b-0 flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
          @click="selectTemplate(t)"
        >
          <div class="flex items-center gap-2 overflow-hidden flex-1">
             <div class="w-2 h-2 flex items-center justify-center flex-shrink-0">
               <div class="w-1.5 h-1.5 rounded-full bg-blue-500" v-if="store.currentTemplateId === t.id"></div>
             </div>
             <span class="text-sm text-gray-700 truncate" :class="{'font-medium text-blue-600': store.currentTemplateId === t.id}">{{ t.name }}</span>
          </div>
          
          <button 
            @click="toggleRowMenu($event, t.id)"
            class="row-menu-trigger p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            :class="{'opacity-100 bg-gray-200': activeMenuId === t.id}"
          >
            <MoreVert class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="border-t border-gray-100 p-1">
        <button 
          @click="handleCreate"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Add class="w-4 h-4" />
          {{ t('template.new') }}
        </button>
      </div>
    </div>

    <!-- Row Menu Portal -->
    <Teleport to="body">
      <div 
        v-if="activeMenuId"
        class="row-menu-content fixed w-32 bg-white rounded shadow-lg border border-gray-100 z-[2001] py-1"
        :style="menuPosition"
        @click.stop
      >
        <template v-if="getActiveTemplate()">
          <button @click="handleEdit(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Edit class="w-3.5 h-3.5" /> {{ t('common.rename') }}
          </button>
          <button @click="handleCopy(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Copy class="w-3.5 h-3.5" /> {{ t('common.copy') }}
          </button>
          <button @click="handleDelete(getActiveTemplate()!)" class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 class="w-3.5 h-3.5" /> {{ t('common.delete') }}
          </button>
        </template>
      </div>
    </Teleport>

    <InputModal 
      :show="showModal"
      :initial-value="modalInitialName"
      :title="modalMode === 'create' ? t('template.new') : t('template.rename')"
      @close="showModal = false"
      @save="handleModalSave"
    />
  </div>
</template>
