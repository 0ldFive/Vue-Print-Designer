<script setup lang="ts">
import X from '~icons/material-symbols/close';

defineProps<{
  show: boolean
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>();

const close = () => {
  emit('update:show', false);
};
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" @click.self="close">
      <div class="bg-white rounded-lg shadow-xl w-[600px] max-w-full max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">Keyboard Shortcuts & Help</h3>
          <button @click="close" class="text-gray-500 hover:text-gray-700">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 overflow-y-auto">
          <div class="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
            <!-- General Section -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">General</h4>
              <ul class="space-y-2 text-gray-600">
                <li class="flex justify-between items-center"><span>Save</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + S</kbd></li>
                <li class="flex justify-between items-center"><span>Print</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + P</kbd></li>
                <li class="flex justify-between items-center"><span>Preview</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Shift + P</kbd></li>
                <li class="flex justify-between items-center"><span>Undo</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Z</kbd></li>
                <li class="flex justify-between items-center"><span>Redo</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Y</kbd></li>
                <li class="flex justify-between items-center"><span>Open Help</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + H</kbd></li>
                <li class="flex justify-between items-center"><span>Close Help</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Esc</kbd></li>
              </ul>
            </div>
            
            <!-- Editing Section -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">Editing</h4>
              <ul class="space-y-2 text-gray-600">
                <li class="flex justify-between items-center"><span>Copy</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + C</kbd></li>
                <li class="flex justify-between items-center"><span>Paste</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + V</kbd></li>
                <li class="flex justify-between items-center"><span>Delete</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Delete</kbd></li>
                <li class="flex justify-between items-center"><span>Select All</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + A</kbd></li>
                <li class="flex justify-between items-center"><span>Multi-select</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + Click</kbd></li>
                <li class="flex justify-between items-center"><span>Lock/Unlock</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Ctrl + L</kbd></li>
              </ul>
            </div>

            <!-- Manipulation Section -->
            <div class="col-span-2">
              <h4 class="font-medium text-gray-900 mb-3 border-b pb-1">Manipulation</h4>
              <div class="grid grid-cols-2 gap-x-8">
                <ul class="space-y-2 text-gray-600">
                  <li class="flex justify-between items-center"><span>Move</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Arrow Keys</kbd></li>
                  <li class="flex justify-between items-center"><span>Fast Move</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + Arrow</kbd></li>
                </ul>
                <ul class="space-y-2 text-gray-600">
                  <li class="flex justify-between items-center"><span>Snap Rotate</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + Drag</kbd></li>
                  <li class="flex justify-between items-center"><span>Proportional Resize</span> <kbd class="bg-gray-100 px-2 py-0.5 rounded border text-xs">Shift + Resize</kbd></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end rounded-b-lg">
          <button @click="close" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
