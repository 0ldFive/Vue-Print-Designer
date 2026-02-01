<script setup lang="ts">
import { onMounted, watch, ref, nextTick } from 'vue';
import type { PrintElement } from '@/types';
import QRCode from 'qrcode';

const props = defineProps<{
  element: PrintElement;
}>();

const qrSrc = ref('');

const renderQR = async () => {
  try {
    const content = props.element.variable || props.element.content || 'https://example.com';
    
    qrSrc.value = await QRCode.toDataURL(content, {
      margin: 0,
      color: {
        dark: props.element.style.color || '#000000',
        light: '#00000000'
      },
      errorCorrectionLevel: (props.element.style as any).qrErrorCorrection || 'M'
    });
  } catch (e) {
    console.error('QR render error', e);
  }
};

onMounted(() => nextTick(renderQR));
watch(() => [props.element.content, props.element.variable, props.element.style], () => nextTick(renderQR), { deep: true });
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'properties.section.content',
      tab: 'properties',
      fields: [
        { label: 'properties.label.content', type: 'text', target: 'element', key: 'content', placeholder: 'QR value' },
        { label: 'properties.label.variable', type: 'text', target: 'element', key: 'variable', placeholder: '@variable' }
      ]
    },
    {
      title: 'properties.section.qrSettings',
      tab: 'style',
      fields: [
        { 
          label: 'properties.label.errorCorrection', 
          type: 'select', 
          target: 'style', 
          key: 'qrErrorCorrection', 
          options: [
            { label: 'properties.option.eccLow', value: 'L' },
            { label: 'properties.option.eccMedium', value: 'M' },
            { label: 'properties.option.eccQuartile', value: 'Q' },
            { label: 'properties.option.eccHigh', value: 'H' }
          ] 
        },
        { label: 'properties.label.color', type: 'color', target: 'style', key: 'color' }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full flex items-center justify-center overflow-hidden">
    <img v-if="qrSrc" :src="qrSrc" class="w-full h-full object-contain pointer-events-none" draggable="false" />
  </div>
</template>
