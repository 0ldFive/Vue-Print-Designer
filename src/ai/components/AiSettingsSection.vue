<script setup lang="ts">
import { computed, ref } from "vue";
import AddIcon from "~icons/material-symbols/add";
import DeleteIcon from "~icons/material-symbols/delete";
import EditIcon from "~icons/material-symbols/edit";
import { useI18n } from "@/locales";
import { activeAiProfile } from "../config";
import { useAiStore } from "../state/store";
import { useAiLocale } from "../locales";
import { useTemplateStore } from "@/stores/templates";
import AiModelModal from "./AiModelModal.vue";
import type { AiModelProfile } from "../types";

const { t } = useI18n();
const store = useAiStore();
const { messages } = useAiLocale();
const templateStore = useTemplateStore();

store.syncConfig(templateStore.crudScopeId);

const keyword = ref("");
const showAddModel = ref(false);
const editingProfile = ref<AiModelProfile | null>(null);

const activeProfile = computed(() => activeAiProfile(store.config));
const modalVisible = computed(
  () => showAddModel.value || Boolean(editingProfile.value),
);

const filteredProfiles = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  if (!key) return store.config.profiles;
  return store.config.profiles.filter(
    (item) =>
      item.alias.toLowerCase().includes(key) ||
      item.model.toLowerCase().includes(key) ||
      item.baseUrl.toLowerCase().includes(key),
  );
});

const selectProfile = (id: string) => {
  store.setActiveProfile(id);
};

/** 只有内置模型时提示来源，避免看起来像配置缺失。 */
const emptyHint = computed(() =>
  store.config.profiles.length === 0 && store.builtinModels.length > 0
    ? messages.value.builtinOnlyHint
    : messages.value.noModelMatched,
);

const openAdd = () => {
  editingProfile.value = null;
  showAddModel.value = true;
};

const openEdit = (profile: AiModelProfile) => {
  showAddModel.value = false;
  editingProfile.value = profile;
};

const closeModal = () => {
  showAddModel.value = false;
  editingProfile.value = null;
};

const handleSubmitModel = (profile: Partial<AiModelProfile>) => {
  if (editingProfile.value) {
    store.updateProfile(editingProfile.value.id, profile);
  } else {
    store.addProfile(profile);
    keyword.value = "";
  }
  closeModal();
};
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <input
        v-model="keyword"
        type="text"
        :placeholder="messages.modelFilterPlaceholder"
        class="h-8 flex-1 rounded-md border border-gray-300 px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-blue-600 px-2.5 text-xs text-blue-600 transition-colors hover:bg-blue-50"
        @click="openAdd"
      >
        <AddIcon class="w-3.5 h-3.5" />
        {{ messages.addModel }}
      </button>
    </div>

    <div class="overflow-hidden rounded-md border border-gray-200">
      <div class="max-h-72 overflow-auto">
        <table class="min-w-full table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col class="w-[38%]" />
            <col class="w-[42%]" />
            <col class="w-[20%]" />
          </colgroup>
          <thead class="bg-gray-100 font-medium text-gray-700">
            <tr>
              <th class="border border-gray-200 px-3 py-2">
                {{ messages.model }}
              </th>
              <th class="border border-gray-200 px-3 py-2">
                {{ messages.baseUrl }}
              </th>
              <th class="border border-gray-200 px-3 py-2">
                {{ messages.actions }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="item in filteredProfiles"
              :key="item.id"
              class="cursor-pointer hover:bg-gray-50"
              :class="
                store.config.activeId === item.id ? 'bg-blue-50' : 'bg-white'
              "
              @click="selectProfile(item.id)"
            >
              <td class="border border-gray-200 px-3 py-1.5">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="truncate text-[11px] text-gray-700"
                      :title="item.alias || item.model"
                      >{{ item.alias || item.model }}</span
                    >
                    <span
                      v-if="store.config.activeId === item.id"
                      class="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 whitespace-nowrap"
                    >
                      {{ messages.inUse }}
                    </span>
                  </div>
                  <span
                    v-if="item.alias"
                    class="block truncate font-mono text-[10px] text-gray-400"
                    :title="item.model"
                    >{{ item.model }}</span
                  >
                </div>
              </td>
              <td
                class="border border-gray-200 px-3 py-1.5 text-[11px] text-gray-500"
              >
                <span class="block truncate" :title="item.baseUrl">{{
                  item.baseUrl || "—"
                }}</span>
              </td>
              <td class="border border-gray-200 px-3 py-1.5">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-gray-400 transition-colors hover:text-blue-600"
                    :title="t('common.edit')"
                    :aria-label="t('common.edit')"
                    @click.stop="openEdit(item)"
                  >
                    <EditIcon class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="store.config.profiles.length <= 1"
                    :title="messages.removeModel"
                    :aria-label="messages.removeModel"
                    @click.stop="store.removeProfile(item.id)"
                  >
                    <DeleteIcon class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredProfiles.length === 0">
              <td
                colspan="3"
                class="border border-gray-200 px-3 py-3 text-center text-xs text-gray-400"
              >
                {{ emptyHint }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AiModelModal
      v-if="modalVisible"
      :mode="editingProfile ? 'edit' : 'add'"
      :initial="editingProfile || activeProfile"
      @submit="handleSubmitModel"
      @close="closeModal"
    />
  </div>
</template>
