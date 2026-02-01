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
      title: 'properties.section.content',
      tab: 'properties',
      fields: [
        { label: 'properties.label.content', type: 'text', target: 'element', key: 'content', placeholder: 'properties.label.barcodeContentPlaceholder' },
        { label: 'properties.label.variable', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'properties.section.barcodeSettings',
      tab: 'style',
      fields: [
        { 
          label: 'properties.label.format', 
          type: 'select', 
          target: 'style', 
          key: 'barcodeFormat', 
          options: [
            { label: 'properties.option.code128', value: 'CODE128' },
            { label: 'properties.option.ean13', value: 'EAN13' },
            { label: 'properties.option.upc', value: 'UPC' },
            { label: 'properties.option.code39', value: 'CODE39' },
            { label: 'properties.option.itf14', value: 'ITF14' },
            { label: 'properties.option.msi', value: 'MSI' },
            { label: 'properties.option.pharmacode', value: 'pharmacode' }
          ] 
        },
        { label: 'properties.label.showText', type: 'select', target: 'style', key: 'showText', options: [{label: 'properties.option.yes', value: true}, {label: 'properties.option.no', value: false}] },
        { label: 'properties.label.color', type: 'color', target: 'style', key: 'color' },
        { label: 'properties.label.lineWidth', type: 'number', target: 'style', key: 'barcodeWidth', placeholder: '2' },
        { label: 'properties.label.barcodeHeight', type: 'number', target: 'style', key: 'barcodeHeight', placeholder: '40' },
        { label: 'properties.label.margin', type: 'number', target: 'style', key: 'margin', placeholder: '0' },
        { label: 'properties.label.fontSize', type: 'number', target: 'style', key: 'fontSize', placeholder: '20' },
        { 
          label: 'properties.label.textPosition', 
          type: 'select', 
          target: 'style', 
          key: 'textPosition', 
          options: [
            { label: 'properties.option.bottom', value: 'bottom' },
            { label: 'properties.option.top', value: 'top' }
          ] 
        },
        { 
          label: 'properties.label.textAlign', 
          type: 'select', 
          target: 'style', 
          key: 'textAlign', 
          options: [
            { label: 'properties.option.left', value: 'left' },
            { label: 'properties.option.center', value: 'center' },
            { label: 'properties.option.right', value: 'right' }
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
