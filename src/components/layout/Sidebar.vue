<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
import { ElementType, type CustomElementTemplate } from '@/types';
import InputModal from '@/components/common/InputModal.vue';

const { t } = useI18n();
const store = useDesignerStore();
const activeTab = ref<'standard' | 'custom'>('standard');
const customElements = computed(() => store.customElements);

// Menu state
const activeMenuId = ref<string | null>(null);
const menuPosition = ref<Record<string, string>>({});

// Modal state
const showRenameModal = ref(false);
const renameTargetId = ref<string | null>(null);
const renameInitialName = ref('');

const categories = [
  {
    title: 'sidebar.general',
    items: [
      { type: ElementType.TEXT, label: 'sidebar.text', icon: Type },
      { type: ElementType.IMAGE, label: 'sidebar.image', icon: Image },
      { type: ElementType.PAGE_NUMBER, label: 'sidebar.pager', icon: Numbers },
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
    const MENU_HEIGHT_ESTIMATE = 130; // Estimate menu height (3 items + padding)
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

const closeMenu = () => {
  activeMenuId.value = null;
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

// Close menu when clicking outside
onMounted(() => {
  document.addEventListener('click', closeMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenu);
});
</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 flex flex-col h-full z-40">
    <div class="p-4 border-b border-gray-200 bg-gray-50">
      <h2 class="font-semibold text-gray-700">{{ t('sidebar.elements') }}</h2>
      <p class="text-xs text-gray-500 mt-1">{{ t('sidebar.dragToCanvas') }}</p>
    </div>
    
    <!-- Tabs -->
    <div class="flex border-b border-gray-200 bg-white">
      <button 
        @click="activeTab = 'standard'"
        :class="['flex-1 py-3 text-sm font-medium transition-colors relative', activeTab === 'standard' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50']"
      >
        {{ t('sidebar.standard') }}
        <div v-if="activeTab === 'standard'" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
      </button>
      <button 
        @click="activeTab = 'custom'"
        :class="['flex-1 py-3 text-sm font-medium transition-colors relative', activeTab === 'custom' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50']"
      >
        {{ t('sidebar.custom') }}
        <div v-if="activeTab === 'custom'" class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Standard Elements Tab -->
      <template v-if="activeTab === 'standard'">
        <div v-for="category in categories" :key="category.title" class="p-4 border-b border-gray-100 last:border-0">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">{{ t(category.title) }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div 
              v-for="item in category.items" 
              :key="item.type"
              class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-move transition-all"
              draggable="true"
              @dragstart="(e) => handleDragStart(e, item.type)"
            >
              <component :is="item.icon" class="w-8 h-8 text-gray-600 mb-2" />
              <span class="text-sm font-medium text-gray-700">{{ t(item.label) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Elements Tab -->
      <template v-if="activeTab === 'custom'">
        <div v-if="customElements.length === 0" class="p-6 text-center">
          <p class="text-sm text-gray-500">{{ t('sidebar.noCustomElements') }}</p>
        </div>
        <div v-else class="p-4 grid grid-cols-2 gap-3">
          <div 
            v-for="item in customElements" 
            :key="item.id"
            class="group relative flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-move transition-all"
            draggable="true"
            @dragstart="(e) => handleDragStartCustom(e, item)"
          >
            <component :is="getIcon(item.element.type)" class="w-8 h-8 text-gray-600 mb-2" />
            <span class="text-sm font-medium text-gray-700 truncate w-full text-center" :title="item.name">{{ item.name }}</span>
            
            <button 
              @click="toggleMenu($event, item.id)"
              class="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
              :class="{'opacity-100 bg-gray-100 text-gray-600': activeMenuId === item.id}"
              :title="t('sidebar.moreOptions')"
            >
              <MoreVert class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Context Menu Portal -->
    <Teleport to="body">
      <div 
        v-if="activeMenuId"
        class="fixed w-32 bg-white rounded shadow-lg border border-gray-100 z-[2001] py-1"
        :style="menuPosition"
        @click.stop
      >
        <template v-for="item in customElements" :key="item.id">
          <template v-if="item.id === activeMenuId">
            <button @click="handleRename(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Edit class="w-3.5 h-3.5" /> {{ t('sidebar.rename') }}
            </button>
            <button @click="handleCopy(item)" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Copy class="w-3.5 h-3.5" /> {{ t('sidebar.copy') }}
            </button>
            <button @click="handleDelete(item)" class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Delete class="w-3.5 h-3.5" /> {{ t('sidebar.delete') }}
            </button>
          </template>
        </template>
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
  </aside>
</template>
