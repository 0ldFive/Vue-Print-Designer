<script setup lang="ts">
import { onMounted, onUnmounted, nextTick } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { useDesignerStore } from '@/stores/designer';
import Canvas from '@/components/canvas/Canvas.vue';

const store = useDesignerStore();
const token = new URLSearchParams(window.location.search).get('printToken') || '';
const origin = window.location.origin;

const postToParent = (type: string) => {
  if (window.parent) {
    window.parent.postMessage({ type, token }, origin);
  }
};

const waitForFonts = async (timeoutMs = 2000) => {
  const fonts = (document as any).fonts as FontFaceSet | undefined;
  if (!fonts || !fonts.ready) return;
  await Promise.race([
    fonts.ready,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
};

const waitForImages = async (timeoutMs = 2000) => {
  const images = Array.from(document.images || []) as HTMLImageElement[];
  const pending = images.filter(img => !img.complete);
  if (pending.length === 0) return;

  await Promise.race([
    Promise.all(pending.map(img => new Promise<void>(resolve => {
      const done = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }))),
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
};

const applyPayload = async (payload: any) => {
  store.$patch({
    pages: cloneDeep(payload.pages || []),
    canvasSize: payload.canvasSize || store.canvasSize,
    canvasBackground: payload.canvasBackground || store.canvasBackground,
    headerHeight: payload.headerHeight ?? store.headerHeight,
    footerHeight: payload.footerHeight ?? store.footerHeight,
    showHeaderLine: payload.showHeaderLine ?? false,
    showFooterLine: payload.showFooterLine ?? false,
    showGrid: false,
    showCornerMarkers: false,
    zoom: 1,
    currentPageIndex: 0,
    selectedElementId: null,
    selectedElementIds: [],
    guides: []
  });

  if (payload.watermark) {
    store.watermark = cloneDeep(payload.watermark);
  }
  if (payload.unit) {
    store.unit = payload.unit;
  }

  store.setIsExporting(true);
  document.body.classList.add('exporting');

  await nextTick();
  await waitForFonts();
  await waitForImages();
  requestAnimationFrame(() => {
    postToParent('print-renderer-rendered');
  });
};

const onMessage = (event: MessageEvent) => {
  if (event.origin !== origin) return;
  const data = event.data as { type?: string; token?: string; payload?: any };
  if (!data || data.type !== 'print-renderer-payload' || data.token !== token) return;
  applyPayload(data.payload || {});
};

onMounted(() => {
  document.body.style.margin = '0';
  document.body.style.background = '#ffffff';
  window.addEventListener('message', onMessage);
  postToParent('print-renderer-ready');
});

onUnmounted(() => {
  window.removeEventListener('message', onMessage);
});
</script>

<template>
  <div class="print-renderer">
    <Canvas />
  </div>
</template>

<style scoped>
.print-renderer {
  padding: 0;
}
</style>
