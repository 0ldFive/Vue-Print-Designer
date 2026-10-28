<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import CloseIcon from "~icons/material-symbols/close";
import FileIcon from "~icons/material-symbols/description-outline";
import { buildMarketCoverUrl } from "../api";
import { getMarketErrorKey, useMarketLocale } from "../locales";
import { useMarketStore } from "../store";
import { isVersionCompatible } from "../version";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const store = useMarketStore();
const { t } = useMarketLocale();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const imageFailed = ref(false);
watch(
  () => store.detailId,
  () => {
    imageFailed.value = false;
  },
);

const item = computed(() => store.detailItem);
const detail = computed(() => store.detail);
const displayName = computed(() => item.value?.name || "");
const displayTags = computed(() => item.value?.tags || []);
const displayDescription = computed(() => item.value?.description);
const compatible = computed(() =>
  isVersionCompatible(item.value?.minDesignerVersion),
);
const using = computed(
  () => Boolean(item.value) && store.usingId === item.value?.id,
);
const coverUrl = computed(() =>
  item.value ? buildMarketCoverUrl(item.value) : "",
);

const metaRows = computed(() => {
  const value = item.value;
  if (!value) return [] as { label: string; value: string }[];
  const rows: { label: string; value: string }[] = [];
  if (value.category) {
    const category = store.categories.find(
      (entry) => entry.id === value.category,
    );
    rows.push({
      label: t("detailCategory"),
      value: category ? category.name : value.category,
    });
  }
  const paper = [
    value.paper || "",
    value.pages ? `${value.pages} ${t("pageUnit")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (paper) rows.push({ label: t("detailPaper"), value: paper });
  if (value.version) {
    rows.push({ label: t("detailVersion"), value: value.version });
  }
  rows.push({ label: t("detailAuthor"), value: value.author || "—" });
  return rows;
});

const variables = computed(() => detail.value?.variables || []);

const buttonLabel = computed(() => {
  if (!compatible.value) {
    return t("detailIncompatible", {
      version: item.value?.minDesignerVersion || "",
    });
  }
  return using.value ? t("detailUsing") : t("detailUse");
});

const handleUse = async () => {
  if (!item.value || !compatible.value || using.value) return;
  await store.useTemplate(item.value.id);
};

const retryDetail = () => {
  if (store.detailId) void store.openDetail(store.detailId);
};

const openCover = () => {
  if (!coverUrl.value || imageFailed.value) return;
  store.openPreview(coverUrl.value, displayName.value);
};
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      class="pointer-events-auto fixed inset-0 z-[100010] flex items-center justify-center bg-black/50"
      @click.self="emit('close')"
    >
      <div
        class="flex h-[min(640px,88vh)] w-[min(960px,92vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <h3
            class="truncate text-base font-semibold text-gray-800 dark:text-gray-100"
          >
            {{ displayName || t("title") }}
          </h3>
          <button
            type="button"
            class="shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            @click="emit('close')"
          >
            <CloseIcon class="w-4 h-4" />
          </button>
        </header>

        <div class="flex min-h-0 flex-1 flex-col md:flex-row">
          <div
            class="flex min-h-0 flex-1 items-center justify-center bg-white p-4 dark:bg-gray-900 md:w-3/5 md:flex-none"
          >
            <img
              v-if="coverUrl && !imageFailed"
              :src="coverUrl"
              :alt="displayName"
              class="max-h-full max-w-full cursor-zoom-in object-contain"
              @click="openCover"
              @error="imageFailed = true"
            />
            <div
              v-else
              class="flex h-full min-h-[160px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700"
            >
              <FileIcon class="h-12 w-12 text-gray-300 dark:text-gray-600" />
            </div>
          </div>

          <div class="flex min-h-0 flex-col md:w-2/5 md:border-l md:border-gray-200 md:dark:border-gray-700">
            <div class="min-h-0 flex-1 overflow-y-auto p-5">
              <div
                v-if="store.detailStatus === 'loading'"
                class="space-y-3"
              >
                <div
                  class="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
                ></div>
                <div
                  class="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
                ></div>
                <div
                  class="h-3 w-3/5 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
                ></div>
                <div
                  class="h-20 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
                ></div>
              </div>

              <div
                v-else-if="store.detailStatus === 'error'"
                class="flex h-full flex-col items-center justify-center gap-2 text-center"
              >
                <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ t("error") }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  {{ t(getMarketErrorKey(store.detailError)) }}
                </p>
                <button
                  type="button"
                  class="mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                  @click="retryDetail"
                >
                  {{ t("retry") }}
                </button>
              </div>

              <template v-else>
                <dl class="space-y-2 text-xs">
                  <div
                    v-for="row in metaRows"
                    :key="row.label"
                    class="flex gap-3"
                  >
                    <dt class="w-14 shrink-0 text-gray-400 dark:text-gray-500">
                      {{ row.label }}
                    </dt>
                    <dd class="min-w-0 flex-1 break-words text-gray-700 dark:text-gray-200">
                      {{ row.value }}
                    </dd>
                  </div>
                </dl>

                <div v-if="displayTags.length" class="mt-3 flex flex-wrap gap-1">
                  <span
                    v-for="tag in displayTags"
                    :key="tag"
                    class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] leading-4 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {{ tag }}
                  </span>
                </div>

                <div v-if="displayDescription" class="mt-4">
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ t("detailDescription") }}
                  </p>
                  <p class="mt-1 text-xs leading-5 text-gray-700 dark:text-gray-200">
                    {{ displayDescription }}
                  </p>
                </div>

                <div
                  class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700"
                >
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ t("detailVariables") }}
                  </p>
                  <div
                    v-if="variables.length"
                    class="mt-1.5 flex flex-wrap gap-1"
                  >
                    <span
                      v-for="variable in variables"
                      :key="variable.id"
                      class="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] leading-4 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {{ variable.label || variable.id }}
                    </span>
                  </div>
                  <p v-else class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {{ t("detailNoVariables") }}
                  </p>
                </div>
              </template>
            </div>

            <div
              class="shrink-0 border-t border-gray-200 p-4 dark:border-gray-700"
            >
              <button
                type="button"
                class="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-colors"
                :class="
                  compatible
                    ? 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60'
                    : 'cursor-not-allowed bg-gray-400'
                "
                :disabled="!compatible || using || store.detailStatus !== 'ready'"
                @click="handleUse"
              >
                <span
                  v-if="using"
                  class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                ></span>
                {{ buttonLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
