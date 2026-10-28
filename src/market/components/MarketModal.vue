<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import CloseIcon from "~icons/material-symbols/close";
import RefreshIcon from "~icons/material-symbols/refresh";
import SearchIcon from "~icons/material-symbols/search";
import AppsIcon from "~icons/material-symbols/apps";
import FolderIcon from "~icons/material-symbols/folder";
import ShippingIcon from "~icons/material-symbols/local-shipping";
import StorefrontIcon from "~icons/material-symbols/storefront";
import SurveyIcon from "~icons/material-symbols/assignment";
import FinanceIcon from "~icons/material-symbols/receipt-long";
import OfficeIcon from "~icons/material-symbols/badge";
import MedicalIcon from "~icons/material-symbols/medical-services";
import EducationIcon from "~icons/material-symbols/school";
import { useDesignerStore } from "@/stores/designer";
import { useMarketLocale } from "../locales";
import { useMarketStore } from "../store";
import MarketCard from "./MarketCard.vue";
import MarketDetail from "./MarketDetail.vue";
import MarketImagePreview from "./MarketImagePreview.vue";
import MarketStates from "./MarketStates.vue";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const store = useMarketStore();
const designerStore = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));
const designerInstanceId = inject<string | null>("designer-instance-id", null);
const { t, locale } = useMarketLocale();

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SEARCH_DEBOUNCE_MS = 300;

const rootRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchText = ref(store.keyword);
let searchTimer: number | null = null;
let previousBodyOverflow = "";

// 图标名由后端下发（categories[].icon），这里只做名称到组件的解析。
const CATEGORY_ICONS: Record<string, any> = {
  "local-shipping": ShippingIcon,
  storefront: StorefrontIcon,
  assignment: SurveyIcon,
  "receipt-long": FinanceIcon,
  badge: OfficeIcon,
  "medical-services": MedicalIcon,
  school: EducationIcon,
  folder: FolderIcon,
};

const resolveCategoryIcon = (name?: string) =>
  (name && CATEGORY_ICONS[name]) || FolderIcon;

const categoryOptions = computed(() => {
  const options: {
    id: string | null;
    name: string;
    count: number;
    icon: any;
  }[] = [
    {
      id: null,
      name: t("allCategories"),
      count: store.categories.reduce((sum, item) => sum + item.count, 0),
      icon: AppsIcon,
    },
  ];
  store.categories.forEach((category) => {
    if (category.count === 0) return;
    options.push({
      id: category.id,
      name: category.name,
      count: category.count,
      icon: resolveCategoryIcon(category.icon),
    });
  });
  return options;
});

const isEmpty = computed(
  () => store.listStatus === "ready" && store.items.length === 0,
);

const clearFilters = () => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
    searchTimer = null;
  }
  searchText.value = "";
  store.setKeyword("");
  store.setCategory(null);
};

const truncateKeyword = () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    store.setKeyword(searchText.value);
    searchTimer = null;
  }, SEARCH_DEBOUNCE_MS);
};

watch(searchText, truncateKeyword);

// 界面语言变化时按新语言重拉第 1 页，模板内容本身不参与翻译。
watch(locale, () => {
  store.reload();
});

watch(
  () => store.isOpen,
  (open) => {
    if (!open) emit("close");
  },
);

const trapFocus = (event: KeyboardEvent) => {
  const root = rootRef.value;
  if (!root) return;
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((node) => node.offsetParent !== null);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (event.shiftKey) {
    if (!active || active === first || !root.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last) {
    event.preventDefault();
    first.focus();
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    if (store.previewImage) {
      store.closePreview();
      return;
    }
    if (store.detailId) {
      store.closeDetail();
      return;
    }
    store.close();
    return;
  }
  if (event.key === "Tab") trapFocus(event);
};

onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  designerStore.setDisableGlobalShortcuts(true);
  store.setInstanceId(designerInstanceId);
  window.addEventListener("keydown", handleKeydown, true);
  await store.open();
  await nextTick();
  searchInputRef.value?.focus();
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  designerStore.setDisableGlobalShortcuts(false);
  window.removeEventListener("keydown", handleKeydown, true);
  if (searchTimer) window.clearTimeout(searchTimer);
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      ref="rootRef"
      class="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center bg-black/50"
      @click.self="store.close()"
    >
      <div
        class="flex h-[min(820px,90vh)] w-[min(1280px,92vw)] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <aside
          class="flex w-48 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
        >
          <div
            class="flex h-12 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700"
          >
            <h2
              class="text-base font-semibold text-gray-800 dark:text-gray-100"
            >
              {{ t("title") }}
            </h2>
          </div>
          <div class="flex-1 overflow-y-auto py-2">
            <button
              v-for="category in categoryOptions"
              :key="category.id || '__all__'"
              type="button"
              class="flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left text-sm transition-colors"
              :class="
                store.activeCategoryId === category.id
                  ? 'border-blue-600 bg-white font-medium text-blue-600 dark:border-blue-500 dark:bg-gray-800 dark:text-blue-300'
                  : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              "
              @click="store.setCategory(category.id)"
            >
              <component :is="category.icon" class="h-5 w-5 shrink-0" />
              <span class="min-w-0 flex-1 truncate">{{ category.name }}</span>
              <span class="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {{ category.count }}
              </span>
            </button>
          </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col">
          <div
            class="relative flex h-12 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700"
          >
            <div
              class="absolute left-1/2 top-1/2 w-[320px] max-w-[calc(100%-12rem)] -translate-x-1/2 -translate-y-1/2"
            >
              <SearchIcon
                class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                ref="searchInputRef"
                v-model="searchText"
                type="text"
                :placeholder="t('searchPlaceholder')"
                class="h-8 w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            <div class="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                :disabled="store.listStatus === 'loading'"
                @click="store.reload()"
              >
                <RefreshIcon class="h-4 w-4" />
                {{ t("refresh") }}
              </button>
              <button
                type="button"
                class="p-1 rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="store.close()"
              >
                <CloseIcon class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-6">
            <MarketStates
              v-if="store.listStatus === 'loading'"
              state="loading"
            />
            <MarketStates
              v-else-if="store.listStatus === 'error'"
              state="error"
              :error-code="store.listError"
              @retry="store.reload()"
            />
            <MarketStates
              v-else-if="isEmpty"
              state="empty"
              @clear="clearFilters"
            />
            <template v-else>
              <div
                class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                <MarketCard
                  v-for="item in store.items"
                  :key="item.id"
                  :item="item"
                  @open="store.openDetail(item.id)"
                />
              </div>

              <div v-if="store.hasMore" class="mt-5 flex justify-center">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  :disabled="store.loadingMore"
                  @click="store.loadMore()"
                >
                  {{ t("loadMore") }} ({{ store.loadedCount }} /
                  {{ store.total }})
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <MarketDetail
        v-if="store.detailId"
        @close="store.closeDetail()"
      />

      <MarketImagePreview />
    </div>
  </Teleport>
</template>
