<script setup lang="ts">
import { computed } from "vue";
import SearchOffIcon from "~icons/material-symbols/search-off";
import ErrorIcon from "~icons/material-symbols/error-outline";
import { getMarketErrorKey, useMarketLocale } from "../locales";
import type { MarketErrorCode } from "../types";

const props = defineProps<{
  state: "loading" | "empty" | "error";
  errorCode?: MarketErrorCode | null;
}>();

const emit = defineEmits<{
  (e: "clear"): void;
  (e: "retry"): void;
}>();

const { t } = useMarketLocale();

const errorText = computed(() => t(getMarketErrorKey(props.errorCode)));
</script>

<template>
  <div
    v-if="state === 'loading'"
    class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
  >
    <div
      v-for="index in 20"
      :key="index"
      class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div
        class="aspect-[4/3] animate-pulse bg-gray-100 dark:bg-gray-700"
      ></div>
      <div
        class="space-y-1 border-t border-gray-200 p-3 dark:border-gray-700"
      >
        <div
          class="h-5 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
        ></div>
        <div
          class="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
        ></div>
        <div class="flex gap-1">
          <div
            class="h-5 w-10 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
          ></div>
          <div
            class="h-5 w-12 animate-pulse rounded bg-gray-100 dark:bg-gray-700"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else-if="state === 'empty'"
    class="flex h-full flex-col items-center justify-center gap-2 py-16 text-center"
  >
    <SearchOffIcon class="h-10 w-10 text-gray-300 dark:text-gray-600" />
    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
      {{ t("empty") }}
    </p>
    <p class="text-xs text-gray-400 dark:text-gray-500">{{ t("emptyHint") }}</p>
    <button
      type="button"
      class="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      @click="emit('clear')"
    >
      {{ t("clearFilters") }}
    </button>
  </div>

  <div
    v-else
    class="flex h-full flex-col items-center justify-center gap-2 py-16 text-center"
  >
    <ErrorIcon class="h-10 w-10 text-red-400" />
    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
      {{ t("error") }}
    </p>
    <p class="text-xs text-gray-400 dark:text-gray-500">{{ errorText }}</p>
    <button
      type="button"
      class="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
      @click="emit('retry')"
    >
      {{ t("retry") }}
    </button>
  </div>
</template>
