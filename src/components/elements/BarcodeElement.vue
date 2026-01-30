<script setup lang="ts">
import { defineProps, onMounted, watch, ref, nextTick } from 'vue';
import type { PrintElement } from '@/types';
import JsBarcode from 'jsbarcode';

const props = defineProps<{
  element: PrintElement;
}>();

const barcodeRef = ref<SVGSVGElement | null>(null);

const renderBarcode = () => {
  if (!barcodeRef.value) return;
  try {
    const content = props.element.variable || props.element.content || '12345678';
    
    // Clear previous
    while (barcodeRef.value.lastChild) {
      barcodeRef.value.removeChild(barcodeRef.value.lastChild);
    }

    JsBarcode(barcodeRef.value, content, {
      format: (props.element.style as any).barcodeFormat || 'CODE128',
      lineColor: props.element.style.color || '#000000',
      width: 2,
      height: 40,
      displayValue: (props.element.style as any).showText !== false,
      background: 'transparent',
      margin: 0
    });
    
    // Make it responsive: use the generated dimensions as viewBox
    const wStr = barcodeRef.value.getAttribute('width');
    const hStr = barcodeRef.value.getAttribute('height');
    if (wStr && hStr) {
        const w = parseFloat(wStr);
        const h = parseFloat(hStr);
        barcodeRef.value.setAttribute('viewBox', `0 0 ${w} ${h}`);
        barcodeRef.value.removeAttribute('width');
        barcodeRef.value.removeAttribute('height');
    }
  } catch (e) {
    console.error('Barcode render error', e);
  }
};

onMounted(() => {
    nextTick(renderBarcode);
});

watch(() => [props.element.content, props.element.variable, props.element.style], () => {
    nextTick(renderBarcode);
}, { deep: true });
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'Content',
      tab: 'properties',
      fields: [
        { label: 'Value', type: 'text', target: 'element', key: 'content', placeholder: 'Barcode value' },
        { label: 'Variable (@foo)', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'Barcode Settings',
      tab: 'style',
      fields: [
        { 
          label: 'Format', 
          type: 'select', 
          target: 'style', 
          key: 'barcodeFormat', 
          options: [
            { label: 'CODE128', value: 'CODE128' },
            { label: 'EAN-13', value: 'EAN13' },
            { label: 'UPC', value: 'UPC' },
            { label: 'CODE39', value: 'CODE39' },
            { label: 'ITF-14', value: 'ITF14' },
            { label: 'MSI', value: 'MSI' },
            { label: 'Pharmacode', value: 'pharmacode' }
          ] 
        },
        { label: 'Show Text', type: 'select', target: 'style', key: 'showText', options: [{label: 'Yes', value: true}, {label: 'No', value: false}] },
        { label: 'Color', type: 'color', target: 'style', key: 'color' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full flex items-center justify-center overflow-hidden">
    <img ref="barcodeRef" class="w-full h-full object-contain pointer-events-none" />
  </div>
</template>
