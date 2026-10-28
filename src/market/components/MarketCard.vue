<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FileIcon from "~icons/material-symbols/description-outline";
import ZoomIcon from "~icons/material-symbols/zoom-in";
import { buildMarketCoverUrl } from "../api";
import { useMarketLocale } from "../locales";
import { useMarketStore } from "../store";
import type { MarketTemplateSummary } from "../types";

const props = defineProps<{
  item: MarketTemplateSummary;
}>();

const emit = defineEmits<{
  (e: "open"): void;
}>();

const { t } = useMarketLocale();
const store = useMarketStore();

const imageFailed = ref(false);
const imageLoaded = ref(false);
watch(
  () => props.item.id,
  () => {
    imageFailed.value = false;
    imageLoaded.value = false;
  },
);

const coverUrl = computed(() => buildMarketCoverUrl(props.item));
const name = computed(() => props.item.name);
const meta = computed(() => {
  const parts: string[] = [];
  if (props.item.paper) parts.push(props.item.paper);
  if (props.item.pages) parts.push(`${props.item.pages} ${t("pageUnit")}`);
  return parts.join(" · ");
});
const tags = computed(() => props.item.tags.slice(0, 2));
const openCover = () => {
  if (!coverUrl.value) return;
  store.openPreview(coverUrl.value, name.value);
};
</script>

<template>
  <div
    class="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
    @click="emit('open')"
  >
    <div class="relative aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-gray-900">
      <img
        v-if="coverUrl && !imageFailed"
        :src="coverUrl"
        :alt="name"
        loading="lazy"
        class="h-full w-full object-contain transition-[transform,opacity] duration-300 group-hover:scale-105"
        :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
        @load="imageLoaded = true"
        @error="imageFailed = true"
      />
      <div
        v-else-if="imageFailed"
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700"
      >
        <FileIcon class="h-9 w-9 text-gray-300 dark:text-gray-600" />
      </div>
      <div
        v-else
        class="h-full w-full animate-pulse bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800"
      ></div>

      <button
        v-if="coverUrl && !imageFailed"
        type="button"
        class="pointer-events-none absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100"
        :title="t('previewImage')"
        :aria-label="t('previewImage')"
        @click.stop="openCover"
      >
        <ZoomIcon class="h-4 w-4" />
      </button>
    </div>

    <div
      class="space-y-1 border-t border-gray-200 p-3 dark:border-gray-700"
    >
      <p
        class="truncate text-sm font-medium text-gray-800 dark:text-gray-100"
        :title="name"
      >
        {{ name }}
      </p>
      <p
        v-if="meta"
        class="truncate text-xs text-gray-500 dark:text-gray-400"
      >
        {{ meta }}
      </p>
      <div v-if="tags.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in tags"
          :key="tag"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] leading-4 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>
