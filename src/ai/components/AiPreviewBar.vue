<script setup lang="ts">
import type { AiChangeSummary } from "../types";
import { useAiLocale } from "../locales";
import SparkleIcon from "~icons/material-symbols/auto-awesome";
import CheckIcon from "~icons/material-symbols/check";
import RefreshIcon from "~icons/material-symbols/refresh";

defineProps<{
  summary: AiChangeSummary | null;
}>();

const emit = defineEmits<{
  (e: "apply"): void;
  (e: "regenerate"): void;
  (e: "discard"): void;
}>();

const { messages } = useAiLocale();

const countTone = (value: number, tone: string) =>
  value > 0 ? tone : "text-gray-400 dark:text-gray-500";
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-auto fixed bottom-8 left-1/2 z-[1000] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-gray-200/80 bg-white/95 px-4 py-2.5 text-xs shadow-xl shadow-gray-900/10 ring-1 ring-black/5 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 dark:ring-white/5"
      @mousedown.stop
    >
      <span
        class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
        >
          <SparkleIcon class="h-3.5 w-3.5" />
        </span>
        {{ messages.previewBar }}
      </span>

      <span
        v-if="summary"
        class="h-3.5 w-px bg-gray-200 dark:bg-gray-700"
      ></span>

      <div
        v-if="summary"
        class="flex flex-wrap items-center gap-2.5 text-[11px] text-gray-500 dark:text-gray-400"
      >
        <span class="tabular-nums">
          {{ summary.pages }} {{ messages.summaryPages }} ·
          {{ summary.elements }} {{ messages.summaryElements }}
        </span>
        <span class="tabular-nums inline-flex items-center gap-2.5">
          <span>
            {{ messages.summaryAdded }}
            <b
              :class="
                countTone(
                  summary.added,
                  'text-emerald-600 dark:text-emerald-400',
                )
              "
            >
              {{ summary.added }}
            </b>
          </span>
          <span>
            {{ messages.summaryModified }}
            <b
              :class="
                countTone(
                  summary.modified,
                  'text-amber-600 dark:text-amber-400',
                )
              "
            >
              {{ summary.modified }}
            </b>
          </span>
          <span>
            {{ messages.summaryRemoved }}
            <b
              :class="
                countTone(summary.removed, 'text-rose-600 dark:text-rose-400')
              "
            >
              {{ summary.removed }}
            </b>
          </span>
        </span>
      </div>

      <div class="ml-1 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 active:scale-[0.98]"
          @click="emit('apply')"
        >
          <CheckIcon class="h-3.5 w-3.5" />
          {{ messages.apply }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.98] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="emit('regenerate')"
        >
          <RefreshIcon class="h-3.5 w-3.5" />
          {{ messages.regenerate }}
        </button>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          @click="emit('discard')"
        >
          {{ messages.discard }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
