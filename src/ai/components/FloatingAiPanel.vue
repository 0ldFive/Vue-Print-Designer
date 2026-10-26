<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type { CSSProperties } from "vue";
import Close from "~icons/material-symbols/close";
import Settings from "~icons/material-symbols/settings";
import ImageIcon from "~icons/material-symbols/image";
import ArrowUpIcon from "~icons/material-symbols/arrow-upward";
import StopIcon from "~icons/material-symbols/stop";
import ChevronIcon from "~icons/material-symbols/expand-more";
import CheckIcon from "~icons/material-symbols/check";
import SparkleIcon from "~icons/material-symbols/auto-awesome";
import AddCommentIcon from "~icons/material-symbols/add-comment";
import HistoryIcon from "~icons/material-symbols/history";
import DeleteIcon from "~icons/material-symbols/delete";
import ReceiptIcon from "~icons/material-symbols/receipt-long";
import ShippingIcon from "~icons/material-symbols/local-shipping";
import QrCodeIcon from "~icons/material-symbols/qr-code-2";
import BadgeIcon from "~icons/material-symbols/badge";
import PanelResizeIcon from "@/svg/components/PanelResizeIcon.vue";
import { FEATURE_FLAGS_CHANGE_EVENT } from "@/composables/useFeatureFlags";
import { useFloatingTooltip } from "@/composables/useFloatingTooltip";
import { useTemplateStore } from "@/stores/templates";
import { activeAiProfile } from "../config";
import { pickImageFiles } from "../core/image";
import { useAiLocale } from "../locales";
import { useAiTemplate } from "../composables/useAiTemplate";
import type { AiImageAttachment } from "../types";
import AiMessageItem from "./AiMessageItem.vue";
import AiPreviewBar from "./AiPreviewBar.vue";
import ImagePreview from "@/components/common/ImagePreview.vue";

const props = defineProps<{
  show: boolean;
  panelStyle: CSSProperties;
  zIndex: number;
  resizeTitle: string;
}>();

const emit = defineEmits<{
  (e: "panel-mousedown", event: MouseEvent): void;
  (e: "resize-mousedown", event: MouseEvent): void;
  (e: "close"): void;
}>();

const { messages } = useAiLocale();
const templateStore = useTemplateStore();
const {
  store,
  isReady,
  isGenerating,
  isPreviewing,
  canHandleLocally,
  resetForTemplateSwitch,
  send,
  regenerate,
  abort,
  continueWaiting,
  apply,
  discard,
  reset,
} = useAiTemplate();

const draft = ref("");
const messageListRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const images = ref<AiImageAttachment[]>([]);
const imageError = ref("");
const configHintVisible = ref(false);
const previewImages = ref<AiImageAttachment[]>([]);
const previewIndex = ref(0);

const openImagePreview = (
  image: AiImageAttachment,
  list: AiImageAttachment[] = [],
) => {
  const items = list.length > 0 ? list : [image];
  const index = items.findIndex((item) => item.id === image.id);
  previewImages.value = items;
  previewIndex.value = index >= 0 ? index : 0;
};

const previewItems = computed(() =>
  previewImages.value.map((image) => ({ src: image.dataUrl, alt: image.name })),
);

const imagePreviewVisible = computed({
  get: () => previewImages.value.length > 0,
  set: (value: boolean) => {
    if (!value) previewImages.value = [];
  },
});

const exampleIcons = [ReceiptIcon, ShippingIcon, QrCodeIcon, BadgeIcon];

const activeProfile = computed(() =>
  activeAiProfile(store.config, store.builtinModels),
);
const modelLabel = computed(() =>
  activeProfile.value
    ? activeProfile.value.alias || activeProfile.value.model
    : "",
);

/** 内置模型排在前面，与自定义模型按 id 去重。 */
const modelOptions = computed(() => {
  const builtinIds = new Set(store.builtinModels.map((item) => item.id));
  const builtin = store.builtinModels.map((item) => ({
    id: item.id,
    label: item.alias || item.model,
    model: item.model,
    showModel: Boolean(item.alias),
    builtin: true,
  }));
  const custom = store.config.profiles
    .filter((item) => !builtinIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.alias || item.model,
      model: item.model,
      showModel: Boolean(item.alias),
      builtin: false,
    }));
  return [...builtin, ...custom];
});

const modelMenuOpen = ref(false);
const modelMenuRef = ref<HTMLElement | null>(null);
const historyOpen = ref(false);
const historyRef = ref<HTMLElement | null>(null);
const historyButtonRef = ref<HTMLElement | null>(null);

const selectProfile = (id: string) => {
  store.setActiveProfile(id);
  modelMenuOpen.value = false;
};

const formatConversationTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
};

const conversationCount = (count: number) =>
  messages.value.messageCount.replace("{count}", String(count));

const {
  arrowStyle: historyArrowStyle,
  placement: historyPlacement,
  toggleTooltip: toggleHistory,
  tooltipStyle: historyTooltipStyle,
} = useFloatingTooltip(historyOpen, historyButtonRef, historyRef, {
  width: 288,
  gap: 8,
  minHeight: 260,
  preferredPlacement: "bottom",
});

const handleToggleHistory = () => {
  modelMenuOpen.value = false;
  toggleHistory();
};

const handleNewChat = () => {
  if (isGenerating.value) return;
  if (isPreviewing.value) discard();
  store.newConversation();
  draft.value = "";
  images.value = [];
  imageError.value = "";
  configHintVisible.value = false;
  historyOpen.value = false;
  void nextTick(() => textareaRef.value?.focus());
};

const handleOpenConversation = (id: string) => {
  if (isGenerating.value) return;
  if (id === store.activeConversationId) {
    historyOpen.value = false;
    return;
  }
  if (isPreviewing.value) discard();
  store.openConversation(id);
  draft.value = "";
  images.value = [];
  imageError.value = "";
  configHintVisible.value = false;
  historyOpen.value = false;
  void scrollToBottom();
};

const handleDeleteConversation = (event: MouseEvent, id: string) => {
  event.stopPropagation();
  if (isGenerating.value) return;
  if (id === store.activeConversationId && isPreviewing.value) discard();
  store.deleteConversation(id);
};

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as Node;
  if (modelMenuOpen.value) {
    const el = modelMenuRef.value;
    if (el && !el.contains(target)) modelMenuOpen.value = false;
  }
};

watch(
  () => props.show,
  (value) => {
    if (!value) {
      modelMenuOpen.value = false;
      historyOpen.value = false;
      previewImages.value = [];
    }
  },
);

const addFiles = async (files: File[]) => {
  const result = await pickImageFiles(files, images.value);
  images.value = result.images;
  imageError.value = result.error ? messages.value[result.error] : "";
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) void addFiles(Array.from(input.files));
  input.value = "";
};

const handlePaste = (event: ClipboardEvent) => {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length === 0) return;
  event.preventDefault();
  void addFiles(files);
};

const handleDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length === 0) return;
  event.preventDefault();
  void addFiles(files);
};

const removeImage = (id: string) => {
  images.value = images.value.filter((item) => item.id !== id);
};

const scrollToBottom = async () => {
  await nextTick();
  const el = messageListRef.value;
  if (el) el.scrollTop = el.scrollHeight;
};

watch(() => store.messages.length, scrollToBottom);
watch(
  () => store.messages.map((m) => m.raw || m.content).join(""),
  scrollToBottom,
);

const handleSend = async () => {
  const prompt = draft.value.trim();
  if (!prompt || isGenerating.value) return;
  // Locally resolvable actions (e.g. creating a blank template) do not need a
  // configured model, so only block the send when neither path is available.
  if (!isReady.value && !canHandleLocally(prompt)) {
    configHintVisible.value = true;
    return;
  }
  const attachments = images.value;
  draft.value = "";
  images.value = [];
  imageError.value = "";
  await send(prompt, { images: attachments });
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  void handleSend();
};

const openSettings = () => {
  window.dispatchEvent(new CustomEvent("designer:open-ai-settings"));
};

const handleApply = () => {
  apply();
};

const handleRegenerate = () => {
  void regenerate();
};

const handleDiscard = () => {
  discard();
};

const handleResendMessage = (
  id: string,
  content: string,
  images: AiImageAttachment[],
) => {
  if (isGenerating.value) return;
  if (!isReady.value) {
    configHintVisible.value = true;
    return;
  }
  const index = store.messages.findIndex((message) => message.id === id);
  if (index < 0) return;
  const attachments = [...images];
  if (isPreviewing.value) discard();
  store.updateMessage(id, {
    content,
    images: attachments.length > 0 ? attachments : [],
  });
  store.messages = store.messages.slice(0, index + 1);
  void send(content, {
    excludeUserMessageId: id,
    appendUserMessage: false,
    images: attachments,
  });
};

const handleRemoveMessage = (id: string) => {
  // 若被删除的提问仍在等待回复，先中止生成，避免状态卡在 generating。
  const index = store.messages.findIndex((message) => message.id === id);
  const reply = index >= 0 ? store.messages[index + 1] : undefined;
  if (reply?.role === "assistant" && reply.status === "streaming") {
    abort();
  }
  store.removeMessageWithReply(id);
};

const handleClose = () => {
  previewImages.value = [];
  if (isPreviewing.value) discard();
  emit("close");
};

const handleTemplateReplaced = () => {
  // Switching templates replaces the document, so any pending preview is no
  // longer valid. Keep the panel and the conversation: the user may continue
  // talking about the new template.
  resetForTemplateSwitch();
};

const handleCloseRequest = () => {
  handleClose();
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isPreviewing.value) {
    handleDiscard();
  }
};

const handleFeatureFlagsChange = (event: Event) => {
  const detail = (event as CustomEvent<{ aiEnabled?: boolean }>).detail;
  if (detail?.aiEnabled === false) {
    reset({ restore: false });
    emit("close");
  }
};

onMounted(() => {
  store.syncConfig(templateStore.crudScopeId);
  store.syncConversations(templateStore.crudScopeId);
  window.addEventListener("keydown", handleEscape);
  window.addEventListener(FEATURE_FLAGS_CHANGE_EVENT, handleFeatureFlagsChange);
  window.addEventListener("designer:template-replaced", handleTemplateReplaced);
  window.addEventListener("designer:close-ai-panel", handleCloseRequest);
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEscape);
  window.removeEventListener(
    FEATURE_FLAGS_CHANGE_EVENT,
    handleFeatureFlagsChange,
  );
  window.removeEventListener(
    "designer:template-replaced",
    handleTemplateReplaced,
  );
  window.removeEventListener("designer:close-ai-panel", handleCloseRequest);
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  reset({ restore: false });
});

const canSend = computed(
  () => Boolean(draft.value.trim()) && !isGenerating.value,
);

watch(isReady, (value) => {
  if (value) configHintVisible.value = false;
});
</script>

<template>
  <div
    v-show="show"
    data-floating-panel-surface="true"
    data-floating-panel-key="ai"
    class="absolute pointer-events-none"
    :style="[panelStyle, { zIndex }]"
  >
    <div
      class="relative flex h-full w-full flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-xl pointer-events-auto dark:border-gray-700 dark:bg-gray-800"
      @mousedown="emit('panel-mousedown', $event)"
    >
      <div
        class="relative min-h-[64px] cursor-move select-none rounded-t border-b border-gray-200 bg-gray-50 p-4 pr-28 dark:border-gray-700 dark:bg-gray-800"
        data-floating-panel-drag-handle="true"
      >
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ messages.title }}
        </h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ messages.subtitle }}
        </p>

        <div class="absolute right-0 top-0 z-20 flex items-center">
          <button
            type="button"
            :title="messages.newChat"
            :disabled="isGenerating"
            class="h-8 w-8 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @mousedown.stop
            @click.stop="handleNewChat"
          >
            <AddCommentIcon class="h-4 w-4" />
          </button>
          <button
            ref="historyButtonRef"
            type="button"
            :title="messages.historyTitle"
            :disabled="isGenerating"
            class="h-8 w-8 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            :class="{
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200':
                historyOpen,
            }"
            @mousedown.stop
            @click.stop="handleToggleHistory"
          >
            <HistoryIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="h-8 w-8 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @mousedown.stop
            @click.stop="openSettings"
          >
            <Settings class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="h-8 w-8 inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @mousedown.stop
            @click.stop="handleClose"
          >
            <Close class="h-4 w-4" />
          </button>
        </div>

        <div
          v-if="historyOpen"
          ref="historyRef"
          role="tooltip"
          class="pointer-events-auto select-text rounded border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
          :style="historyTooltipStyle"
          @click.stop
        >
          <div
            v-if="historyPlacement === 'bottom'"
            class="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            :style="historyArrowStyle"
          ></div>
          <div
            v-else
            class="absolute -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            :style="historyArrowStyle"
          ></div>

          <div
            class="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100"
          >
            {{ messages.historyTitle }}
          </div>

          <p
            v-if="store.conversations.length === 0"
            class="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500"
          >
            {{ messages.noHistory }}
          </p>

          <div v-else class="max-h-64 overflow-y-auto rounded-b py-1">
            <div
              v-for="item in store.conversations"
              :key="item.id"
              class="group relative"
            >
              <button
                type="button"
                class="flex w-full flex-col gap-0.5 px-3 py-1.5 pr-8 text-left transition"
                :class="
                  item.id === store.activeConversationId
                    ? 'bg-blue-50 dark:bg-blue-500/10'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                "
                @click.stop="handleOpenConversation(item.id)"
              >
                <span
                  class="block w-full truncate text-xs"
                  :class="
                    item.id === store.activeConversationId
                      ? 'font-medium text-blue-600 dark:text-blue-400'
                      : 'text-gray-800 dark:text-gray-100'
                  "
                >
                  {{ item.title || messages.untitledChat }}
                </span>
                <span
                  class="block text-[11px] text-gray-400 dark:text-gray-500"
                >
                  {{ formatConversationTime(item.updatedAt) }} ·
                  {{ conversationCount(item.messages.length) }}
                </span>
              </button>
              <button
                type="button"
                :title="messages.deleteChat"
                class="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-red-400"
                @mousedown.stop
                @click.stop="handleDeleteConversation($event, item.id)"
              >
                <DeleteIcon class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref="messageListRef"
        class="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-gray-50/70 to-white p-3 dark:from-gray-900/40 dark:to-gray-800"
      >
        <div
          v-if="store.messages.length === 0"
          class="flex h-full min-h-[260px] flex-col justify-center"
        >
          <div class="flex flex-col items-center px-2 text-center">
            <span
              class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
            >
              <SparkleIcon class="h-5 w-5" />
            </span>
            <h3
              class="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {{ messages.welcomeTitle }}
            </h3>
            <p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {{ messages.empty }}
            </p>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="(example, index) in messages.exampleList"
              :key="example"
              type="button"
              class="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
              @click="draft = example"
            >
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-gray-700 dark:text-gray-300 dark:group-hover:bg-blue-500/15 dark:group-hover:text-blue-400"
              >
                <component
                  :is="exampleIcons[index % exampleIcons.length]"
                  class="h-3.5 w-3.5"
                />
              </span>
              <span
                class="line-clamp-2 text-[11px] leading-4 text-gray-600 dark:text-gray-300"
              >
                {{ example }}
              </span>
            </button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <AiMessageItem
            v-for="(message, index) in store.messages"
            :key="message.id"
            :message="message"
            :is-last="index === store.messages.length - 1"
            :allow-images="Boolean(activeProfile?.supportsVision)"
            @preview-image="openImagePreview"
            @resend-message="handleResendMessage"
            @remove-message="handleRemoveMessage"
            @regenerate="handleRegenerate"
            @continue="continueWaiting"
          />
        </div>
      </div>

      <div
        v-if="configHintVisible && !isReady"
        class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30"
      >
        <p
          class="min-w-0 flex-1 text-[11px] leading-4 text-amber-700 dark:text-amber-300"
        >
          {{ messages.notConfigured }}
        </p>
        <button
          type="button"
          class="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[11px] text-white transition hover:bg-blue-700"
          @click="openSettings"
        >
          {{ messages.openSettings }}
        </button>
      </div>

      <div
        class="relative border-t border-gray-200 p-2 dark:border-gray-700"
        @dragover.prevent
        @drop="handleDrop"
      >
        <div
          class="rounded-xl border border-gray-300 bg-white transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-gray-600 dark:bg-gray-900 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-500/20"
        >
          <div v-if="images.length > 0" class="flex flex-wrap gap-1.5 p-2 pb-0">
            <div
              v-for="image in images"
              :key="image.id"
              class="relative h-14 w-14 overflow-hidden rounded-md border border-gray-200 dark:border-gray-600"
            >
              <img
                :src="image.dataUrl"
                :alt="image.name"
                class="h-full w-full cursor-zoom-in object-cover"
                @click="openImagePreview(image, images)"
              />
              <button
                type="button"
                class="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-white"
                :title="messages.removeImage"
                @click="removeImage(image.id)"
              >
                <Close class="h-3 w-3" />
              </button>
            </div>
          </div>

          <textarea
            ref="textareaRef"
            v-model="draft"
            rows="2"
            :placeholder="messages.inputPlaceholder"
            class="block w-full resize-none border-0 bg-transparent px-3 pt-2.5 text-xs leading-5 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            @keydown="handleKeydown"
            @paste="handlePaste"
          />

          <div class="flex items-center justify-between gap-2 px-1.5 pb-1.5">
            <button
              v-if="activeProfile?.supportsVision"
              type="button"
              :title="messages.addImage"
              :disabled="isGenerating"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="fileInputRef?.click()"
            >
              <ImageIcon class="h-4 w-4" />
            </button>
            <span v-else />

            <div class="flex min-w-0 items-center gap-1.5">
              <div
                v-if="modelLabel"
                ref="modelMenuRef"
                class="relative min-w-0"
              >
                <button
                  type="button"
                  :title="modelLabel"
                  class="flex min-w-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  @mousedown.stop
                  @click="modelMenuOpen = !modelMenuOpen"
                >
                  <span class="max-w-[8rem] truncate">{{ modelLabel }}</span>
                  <ChevronIcon
                    class="h-3 w-3 shrink-0 transition-transform"
                    :class="{ 'rotate-180': modelMenuOpen }"
                  />
                </button>

                <div
                  v-if="modelMenuOpen"
                  class="absolute bottom-full right-0 z-30 mb-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  @mousedown.stop
                >
                  <div class="max-h-56 overflow-y-auto">
                    <template
                      v-for="(item, index) in modelOptions"
                      :key="item.id"
                    >
                      <div
                        v-if="
                          index === 0 ||
                          item.builtin !== modelOptions[index - 1].builtin
                        "
                        class="px-2.5 pb-0.5 pt-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500"
                      >
                        {{
                          item.builtin
                            ? messages.builtinModels
                            : messages.customModels
                        }}
                      </div>
                      <button
                        type="button"
                        class="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                        @click="selectProfile(item.id)"
                      >
                        <CheckIcon
                          v-if="item.id === store.config.activeId"
                          class="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400"
                        />
                        <span v-else class="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span class="min-w-0 flex-1">
                          <span
                            class="block truncate text-[11px] text-gray-800 dark:text-gray-100"
                          >
                            {{ item.label }}
                          </span>
                          <span
                            v-if="item.showModel"
                            class="block truncate font-mono text-[10px] text-gray-400 dark:text-gray-500"
                          >
                            {{ item.model }}
                          </span>
                        </span>
                      </button>
                    </template>
                  </div>

                  <div class="my-1 h-px bg-gray-100 dark:bg-gray-700" />

                  <button
                    type="button"
                    class="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                    @click="
                      modelMenuOpen = false;
                      openSettings();
                    "
                  >
                    <Settings class="h-3.5 w-3.5" />
                    {{ messages.settingsTitle }}
                  </button>
                </div>
              </div>
              <button
                v-if="isGenerating"
                type="button"
                :title="messages.stop"
                class="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 transition hover:bg-blue-50 dark:bg-gray-900 dark:text-blue-400 dark:hover:bg-blue-500/10"
                @click="abort"
              >
                <span
                  class="pointer-events-none absolute inset-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500 dark:border-blue-500/25 dark:border-t-blue-400"
                />
                <StopIcon class="relative h-3 w-3" />
              </button>
              <button
                v-else
                type="button"
                :disabled="!canSend"
                :title="messages.send"
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
                @click="handleSend"
              >
                <ArrowUpIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          class="hidden"
          @change="handleFileChange"
        />
        <p v-if="imageError" class="mt-1 px-1 text-[11px] text-red-500">
          {{ imageError }}
        </p>
      </div>
    </div>

    <button
      type="button"
      :title="resizeTitle"
      class="absolute bottom-0.5 right-0.5 z-20 h-4 w-4 cursor-se-resize bg-transparent p-0 text-gray-400 pointer-events-auto hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
      @mousedown.stop.prevent="emit('resize-mousedown', $event)"
    >
      <PanelResizeIcon class="h-4 w-4" />
    </button>

    <AiPreviewBar
      v-if="isPreviewing"
      :summary="store.summary"
      @apply="handleApply"
      @regenerate="handleRegenerate"
      @discard="handleDiscard"
    />

    <ImagePreview
      v-model:visible="imagePreviewVisible"
      :items="previewItems"
      :index="previewIndex"
    />
  </div>
</template>
