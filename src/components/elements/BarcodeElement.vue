<script setup lang="ts">
import { onMounted, watch, ref, nextTick } from 'vue';
import type { PrintElement } from '@/types';
import JsBarcode from 'jsbarcode';

const props = defineProps<{
  element: PrintElement;
}>();

const barcodeRef = ref<HTMLImageElement | null>(null);

const renderBarcode = () => {
  if (!barcodeRef.value) return;
  try {
    const content = props.element.variable || props.element.content || '12345678';
    const style = props.element.style as any;

    JsBarcode(barcodeRef.value, content, {
      format: style.barcodeFormat || 'CODE128',
      lineColor: style.color || '#000000',
      width: Number(style.barcodeWidth) || 2,
      height: Number(style.barcodeHeight) || 40,
      displayValue: style.showText !== false && style.showText !== 'false',
      fontOptions: style.fontOptions || '',
      font: style.font || 'monospace',
      textAlign: style.textAlign || 'center',
      textPosition: style.textPosition || 'bottom',
      textMargin: Number(style.textMargin) || 2,
      fontSize: Number(style.fontSize) || 20,
      background: 'transparent',
      margin: Number(style.margin) || 0
    });
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
        { label: 'Variable (@foobar)', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
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
        { label: 'Color', type: 'color', target: 'style', key: 'color' },
        { label: 'Line Width (px)', type: 'number', target: 'style', key: 'barcodeWidth', placeholder: '2' },
        { label: 'Height (px)', type: 'number', target: 'style', key: 'barcodeHeight', placeholder: '40' },
        { label: 'Margin (px)', type: 'number', target: 'style', key: 'margin', placeholder: '0' },
        { label: 'Font Size (px)', type: 'number', target: 'style', key: 'fontSize', placeholder: '20' },
        { 
          label: 'Text Position', 
          type: 'select', 
          target: 'style', 
          key: 'textPosition', 
          options: [
            { label: 'Bottom', value: 'bottom' },
            { label: 'Top', value: 'top' }
          ] 
        },
        { 
          label: 'Text Align', 
          type: 'select', 
          target: 'style', 
          key: 'textAlign', 
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' }
          ] 
        }
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
