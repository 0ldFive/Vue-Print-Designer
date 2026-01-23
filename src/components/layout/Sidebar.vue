<script setup lang="ts">
import { Type, Image, Table } from 'lucide-vue-next';
import { ElementType } from '@/types';

const draggableItems = [
  { type: ElementType.TEXT, label: 'Text', icon: Type },
  { type: ElementType.IMAGE, label: 'Image', icon: Image },
  { type: ElementType.TABLE, label: 'Table', icon: Table },
];

const handleDragStart = (event: DragEvent, type: ElementType) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify({ type }));
    event.dataTransfer.effectAllowed = 'copy';
  }
};
</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 flex flex-col h-full z-40">
    <div class="p-4 border-b border-gray-200">
      <h2 class="font-semibold text-gray-700">Elements</h2>
      <p class="text-xs text-gray-500 mt-1">Drag elements to the canvas</p>
    </div>
    
    <div class="p-4 grid grid-cols-2 gap-3">
      <div 
        v-for="item in draggableItems" 
        :key="item.type"
        class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-move transition-all"
        draggable="true"
        @dragstart="(e) => handleDragStart(e, item.type)"
      >
        <component :is="item.icon" class="w-8 h-8 text-gray-600 mb-2" />
        <span class="text-sm font-medium text-gray-700">{{ item.label }}</span>
      </div>
    </div>
  </aside>
</template>
