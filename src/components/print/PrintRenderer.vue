<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { useDesignerStore } from '@/stores/designer';
import Canvas from '@/components/canvas/Canvas.vue';

const props = defineProps<{
  payload?: any;
  token?: string;
}>();

const root = ref<HTMLElement | null>(null);
const store = useDesignerStore();
const token = props.token || new URLSearchParams(window.location.search).get('printToken') || '';
const origin = window.location.origin;

const getDoc = () => root.value?.ownerDocument || document;
const getWin = () => getDoc().defaultView || window;

const postToParent = (type: string) => {
  const win = getWin();
  if (win.parent && win.parent !== win) {
    win.parent.postMessage({ type, token }, origin);
  }
  // Also dispatch a custom event for local usage
  window.dispatchEvent(new CustomEvent(`print-renderer:${type}`, { detail: { token } }));
};

const waitForFonts = async (timeoutMs = 2000) => {
  const doc = getDoc();
  const fonts = (doc as any).fonts as FontFaceSet | undefined;
  if (!fonts || !fonts.ready) return;
  await Promise.race([
    fonts.ready,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
};

const waitForImages = async (timeoutMs = 2000) => {
  const doc = getDoc();
  const images = Array.from(doc.images || []) as HTMLImageElement[];
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
    pageSpacingX: payload.pageSpacingX ?? store.pageSpacingX,
    pageSpacingY: payload.pageSpacingY ?? store.pageSpacingY,
    showHeaderLine: payload.showHeaderLine ?? false,
    showFooterLine: payload.showFooterLine ?? false,
    showGrid: false,
    showCornerMarkers: false,
    zoom: 1,
    currentPageIndex: 0,
    selectedElementId: null,
    selectedElementIds: [],
    guides: [],
    testData: payload.testData || {}
  });

  if (payload.watermark) {
    store.watermark = cloneDeep(payload.watermark);
  }
  if (payload.unit) {
    store.unit = payload.unit;
  }

  store.setIsExporting(true);
  const doc = getDoc();
  doc.body.classList.add('exporting');

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
  const doc = getDoc();
  const win = getWin();
  
  doc.body.style.margin = '0';
  doc.body.style.background = '#ffffff';
  win.addEventListener('message', onMessage);
  
  if (props.payload) {
    applyPayload(props.payload);
  } else {
    postToParent('print-renderer-ready');
  }
});

onUnmounted(() => {
  const win = getWin();
  win.removeEventListener('message', onMessage);
});
</script>

<template>
  <div class="print-renderer" ref="root">
    <Canvas />
  </div>
</template>

<style scoped>
.print-renderer {
  padding: 0;
}
</style>
