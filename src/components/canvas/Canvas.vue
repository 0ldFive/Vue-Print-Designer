<script setup lang="ts">
import { computed } from 'vue';
import { useDesignerStore } from '@/stores/designer';
import { ElementType } from '@/types';
import ElementWrapper from '../elements/ElementWrapper.vue';
import TextElement from '../elements/TextElement.vue';
import ImageElement from '../elements/ImageElement.vue';
import TableElement from '../elements/TableElement.vue';

const store = useDesignerStore();

const pages = computed(() => store.pages);
const zoom = computed(() => store.zoom);
const canvasSize = computed(() => store.canvasSize);

const getComponent = (type: ElementType) => {
  switch (type) {
    case ElementType.TEXT: return TextElement;
    case ElementType.IMAGE: return ImageElement;
    case ElementType.TABLE: return TableElement;
    default: return TextElement;
  }
};

const handleDrop = (event: DragEvent, pageIndex: number) => {
  event.preventDefault();
  const data = event.dataTransfer?.getData('application/json');
  if (!data) return;

  const { type } = JSON.parse(data);
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - rect.left) / store.zoom;
  const y = (event.clientY - rect.top) / store.zoom;

  const newElement = {
    type,
    x,
    y,
    width: 200,
    height: 100,
    style: {
      fontSize: 14,
      color: '#000000',
    },
    content: type === ElementType.TEXT ? 'New Text' : '',
    // Dummy data for table
    columns: type === ElementType.TABLE ? [
      { field: 'id', header: 'ID', width: 50 },
      { field: 'name', header: 'Name', width: 100 },
    ] : undefined,
    data: type === ElementType.TABLE ? [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ] : undefined
  };

  // If table, give it more height
  if (type === ElementType.TABLE) {
    newElement.height = 150;
  }

  store.addElement(newElement);
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const handleBackgroundClick = () => {
  store.selectElement(null);
};

</script>

<template>
  <div class="flex flex-col gap-8 pb-20" :style="{ transform: `scale(${zoom})`, transformOrigin: 'top center' }">
    <div 
      v-for="(page, index) in pages" 
      :key="page.id"
      :id="`page-${index}`"
      class="print-page bg-white shadow-lg relative overflow-hidden transition-all"
      :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
      @drop="(e) => handleDrop(e, index)"
      @dragover="handleDragOver"
      @click.self="handleBackgroundClick"
    >
      <!-- Grid Background -->
      <div v-if="store.showGrid" class="absolute inset-0 pointer-events-none opacity-50" 
           style="background-image: linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px); background-size: 20px 20px;">
      </div>

      <!-- Elements -->
      <ElementWrapper
        v-for="element in page.elements"
        :key="element.id"
        :element="element"
        :is-selected="store.selectedElementId === element.id"
        :zoom="zoom"
      >
        <component :is="getComponent(element.type)" :element="element" />
      </ElementWrapper>

      <!-- Page Number -->
      <div class="absolute bottom-2 right-4 text-xs text-gray-400 select-none">
        Page {{ index + 1 }}
      </div>
    </div>
  </div>
</template>
