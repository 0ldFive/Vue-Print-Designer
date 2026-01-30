<script setup lang="ts">
import Type from '~icons/material-symbols/text-fields';
import Image from '~icons/material-symbols/image';
import Table from '~icons/material-symbols/table-chart';
import Barcode from '~icons/material-symbols/barcode';
import QrCode from '~icons/material-symbols/qr-code';
import HorizontalRule from '~icons/material-symbols/horizontal-rule';
import CheckBoxOutlineBlank from '~icons/material-symbols/check-box-outline-blank';
import RadioButtonUnchecked from '~icons/material-symbols/radio-button-unchecked';
import { ElementType } from '@/types';

const categories = [
  {
    title: 'General',
    items: [
      { type: ElementType.TEXT, label: 'Text', icon: Type },
      { type: ElementType.IMAGE, label: 'Image', icon: Image },
      { type: ElementType.PAGE_NUMBER, label: 'Pager', icon: Type },
    ]
  },
  {
    title: 'Data & Codes',
    items: [
      { type: ElementType.TABLE, label: 'Table', icon: Table },
      { type: ElementType.BARCODE, label: 'Barcode', icon: Barcode },
      { type: ElementType.QRCODE, label: 'QR Code', icon: QrCode },
    ]
  },
  {
    title: 'Shapes',
    items: [
      { type: ElementType.LINE, label: 'Line', icon: HorizontalRule },
      { type: ElementType.RECT, label: 'Rect', icon: CheckBoxOutlineBlank },
      { type: ElementType.CIRCLE, label: 'Circle', icon: RadioButtonUnchecked },
    ]
  }
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
    
    <div class="flex-1 overflow-y-auto">
      <div v-for="category in categories" :key="category.title" class="p-4 border-b border-gray-100 last:border-0">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">{{ category.title }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div 
            v-for="item in category.items" 
            :key="item.type"
            class="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-move transition-all"
            draggable="true"
            @dragstart="(e) => handleDragStart(e, item.type)"
          >
            <component :is="item.icon" class="w-8 h-8 text-gray-600 mb-2" />
            <span class="text-sm font-medium text-gray-700">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
