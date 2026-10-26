<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import ChevronDown from "~icons/material-symbols/expand-more";
import CopyIcon from "~icons/material-symbols/content-copy";
import EditIcon from "~icons/material-symbols/edit";
import DeleteIcon from "~icons/material-symbols/delete";
import RefreshIcon from "~icons/material-symbols/refresh";
import CodeIcon from "~icons/material-symbols/code";
import CheckIcon from "~icons/material-symbols/check";
import ImageIcon from "~icons/material-symbols/image";
import CloseIcon from "~icons/material-symbols/close";
import WarningIcon from "~icons/material-symbols/warning";
import ErrorIcon from "~icons/material-symbols/error";
import type { AiImageAttachment, AiMessage, AiStepKind } from "../types";
import { pickImageFiles } from "../core/image";
import type { AiErrorCode } from "../core/client";
import { useAiLocale } from "../locales";

const props = defineProps<{
  message: AiMessage;
  isLast?: boolean;
  allowImages?: boolean;
}>();

const emit = defineEmits<{
  (
    e: "preview-image",
    image: AiImageAttachment,
    images: AiImageAttachment[],
  ): void;
  (
    e: "resend-message",
    id: string,
    content: string,
    images: AiImageAttachment[],
  ): void;
  (e: "remove-message", id: string): void;
  (e: "regenerate"): void;
  (e: "continue"): void;
}>();

const { messages } = useAiLocale();
const showWarnings = ref(false);
const showRaw = ref(false);
const copied = ref(false);
const editing = ref(false);
const editDraft = ref("");
const editImages = ref<AiImageAttachment[]>([]);
const editImageError = ref("");
const editRef = ref<HTMLTextAreaElement | null>(null);
const editFileInputRef = ref<HTMLInputElement | null>(null);
const stepsOpen = ref(true);
const agentReasoningOpen = ref<number | null>(null);
const streamingReasoningRef = ref<HTMLElement | null>(null);

/** 最终处理阶段的步骤：请求过程已按轮次展示在时间线里。 */
const visibleSteps = computed(() =>
  (props.message.steps || []).filter(
    (step) => step.kind !== "request" && step.kind !== "preview",
  ),
);

const requestDetail = computed(
  () =>
    (props.message.steps || []).find((step) => step.kind === "request")
      ?.detail || "",
);

watch(
  () => props.message.reasoning,
  () => {
    const el = streamingReasoningRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
  { flush: "post" },
);

watch(
  () => props.message.status,
  () => {
    agentReasoningOpen.value = null;
  },
);

const isUser = computed(() => props.message.role === "user");
const isStreaming = computed(() => props.message.status === "streaming");
const isError = computed(() => props.message.status === "error");

const actionName = (id: string) => messages.value.actionNames[id] || id;

/** 详情形如「模型名 · 12 KB」：主体可省略，尾部计数始终完整显示。 */
const detailHead = (detail: string) => {
  const index = detail.lastIndexOf(" · ");
  return index < 0 ? detail : detail.slice(0, index);
};

const detailTail = (detail: string) => {
  const index = detail.lastIndexOf(" · ");
  return index < 0 ? "" : detail.slice(index + 3);
};

const errorText = computed(() => {
  if (!props.message.error) return "";
  return (
    messages.value.errors[props.message.error as AiErrorCode] ||
    messages.value.errors.http
  );
});

const warningItems = computed(() =>
  (props.message.warnings || []).map((warning) => ({
    code: warning.code,
    text: messages.value.warningsText[warning.code] || warning.code,
    detail: warning.detail || "",
  })),
);

const summary = computed(() => props.message.summary);

const formatDuration = (ms?: number) => {
  if (!ms || ms <= 0) return "";
  const unit = messages.value;
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}${unit.hours}${minutes}${unit.minutes}${seconds}${unit.seconds}`;
  }
  if (minutes > 0) {
    return `${minutes}${unit.minutes}${seconds}${unit.seconds}`;
  }
  return `${seconds}${unit.seconds}`;
};

const copySource = computed(() =>
  isUser.value
    ? props.message.content
    : props.message.raw || props.message.content,
);

const stepLabel = (kind: AiStepKind) =>
  ({
    request: messages.value.stepRequest,
    parse: messages.value.stepParse,
    validate: messages.value.stepValidate,
    diff: messages.value.stepDiff,
    preview: messages.value.stepPreview,
  })[kind];

const copyText = async () => {
  const text = copySource.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // Clipboard access may be denied; keep the UI unchanged.
  }
};

const startEdit = () => {
  editDraft.value = props.message.content;
  editImages.value = props.message.images
    ? props.message.images.map((image) => ({ ...image }))
    : [];
  editImageError.value = "";
  editing.value = true;
  void nextTick(() => {
    const el = editRef.value;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
};

const cancelEdit = () => {
  editing.value = false;
  editDraft.value = "";
  editImages.value = [];
  editImageError.value = "";
};

const submitEdit = () => {
  const text = editDraft.value.trim();
  if (!text) return;
  emit("resend-message", props.message.id, text, editImages.value);
  editing.value = false;
  editDraft.value = "";
  editImages.value = [];
  editImageError.value = "";
};

const addEditFiles = async (files: File[]) => {
  const result = await pickImageFiles(files, editImages.value);
  editImages.value = result.images;
  editImageError.value = result.error ? messages.value[result.error] : "";
};

const handleEditFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) void addEditFiles(Array.from(input.files));
  input.value = "";
};

const handleEditPaste = (event: ClipboardEvent) => {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length === 0) return;
  event.preventDefault();
  void addEditFiles(files);
};

const handleEditDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length === 0) return;
  event.preventDefault();
  void addEditFiles(files);
};

const removeEditImage = (id: string) => {
  editImages.value = editImages.value.filter((image) => image.id !== id);
  editImageError.value = "";
};
</script>

<template>
  <div
    class="group flex w-full flex-col"
    :class="isUser ? 'items-end' : 'items-start'"
  >
    <div
      v-if="isUser && editing"
      class="w-full max-w-[92%] rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-gray-600 dark:bg-gray-900 dark:focus-within:ring-blue-500/20"
      @dragover.prevent
      @drop="handleEditDrop"
    >
      <div v-if="editImages.length" class="mb-1.5 flex flex-wrap gap-1">
        <div
          v-for="image in editImages"
          :key="image.id"
          class="relative h-14 w-14 overflow-hidden rounded border border-gray-200 dark:border-gray-600"
        >
          <img
            :src="image.dataUrl"
            :alt="image.name"
            class="h-full w-full cursor-zoom-in object-cover"
            @click="emit('preview-image', image, editImages)"
          />
          <button
            type="button"
            class="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-white"
            :title="messages.removeImage"
            @click="removeEditImage(image.id)"
          >
            <CloseIcon class="h-3 w-3" />
          </button>
        </div>
      </div>

      <textarea
        ref="editRef"
        v-model="editDraft"
        rows="3"
        class="block w-full resize-none border-0 bg-transparent px-1 py-0.5 text-xs leading-5 text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
        @keydown.enter.exact.prevent="submitEdit"
        @keydown.esc.prevent="cancelEdit"
        @paste="handleEditPaste"
      />

      <p v-if="editImageError" class="mt-1 px-1 text-[11px] text-red-500">
        {{ editImageError }}
      </p>

      <div class="mt-1 flex items-center justify-between gap-1">
        <button
          v-if="allowImages"
          type="button"
          :title="messages.addImage"
          class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          @click="editFileInputRef?.click()"
        >
          <ImageIcon class="h-3.5 w-3.5" />
        </button>
        <span v-else />

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @click="cancelEdit"
          >
            {{ messages.cancel }}
          </button>
          <button
            type="button"
            :disabled="!editDraft.trim()"
            class="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            @click="submitEdit"
          >
            {{ messages.send }}
          </button>
        </div>
      </div>

      <input
        ref="editFileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        class="hidden"
        @change="handleEditFileChange"
      />
    </div>

    <div
      v-else
      :class="[
        'max-w-[92%] rounded-lg px-3 py-2 text-xs leading-5 break-words',
        isUser
          ? 'bg-blue-600 text-white'
          : isError
            ? 'w-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
            : 'w-full bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-100',
      ]"
    >
      <template v-if="isUser">
        <div v-if="message.images?.length" class="mb-1 flex flex-wrap gap-1">
          <button
            v-for="image in message.images"
            :key="image.id"
            type="button"
            :title="image.name"
            class="block h-16 w-16 overflow-hidden rounded border border-white/30"
            @click="emit('preview-image', image, message.images || [])"
          >
            <img
              :src="image.dataUrl"
              :alt="image.name"
              class="h-full w-full cursor-zoom-in object-cover"
            />
          </button>
        </div>
        {{ message.content }}
      </template>

      <template v-else>
        <div
          v-if="isStreaming && !message.reasoning"
          class="flex items-center gap-1.5 py-0.5"
        >
          <span>{{ messages.thinking }}</span>
          <span class="flex items-center gap-0.5">
            <span
              class="h-1 w-1 animate-bounce rounded-full bg-gray-400 dark:bg-gray-300"
            />
            <span
              class="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms] dark:bg-gray-300"
            />
            <span
              class="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms] dark:bg-gray-300"
            />
          </span>
        </div>

        <div
          v-else-if="message.content && !summary && !isError"
          class="whitespace-pre-wrap"
        >
          {{ message.content }}
        </div>

        <div
          v-if="
            message.steps?.length ||
            message.reasoning ||
            message.agentSteps?.length
          "
          class="mt-1.5 overflow-hidden rounded-md border border-black/5 bg-white/70 dark:border-white/10 dark:bg-gray-800/60"
        >
          <button
            type="button"
            class="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] text-gray-500 transition hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5"
            @click="stepsOpen = !stepsOpen"
          >
            <span class="flex-1 truncate">{{ messages.stepsTitle }}</span>
            <ChevronDown
              :class="[
                'h-3 w-3 shrink-0 transition-transform',
                stepsOpen ? 'rotate-180' : '',
              ]"
            />
          </button>
          <div
            v-if="
              stepsOpen &&
              (message.agentSteps?.length || isStreaming || message.reasoning)
            "
            class="border-t border-black/5 px-2 py-1.5 dark:border-white/10"
          >
            <ol>
              <li
                v-for="(step, index) in message.agentSteps"
                :key="`${step.action}-${index}`"
                class="relative flex gap-2"
                :class="
                  index === (message.agentSteps?.length ?? 0) - 1
                    ? ''
                    : 'pb-2.5'
                "
              >
                <span
                  v-if="
                    index < (message.agentSteps?.length ?? 0) - 1 || isStreaming
                  "
                  class="absolute bottom-0 left-[6px] top-[17px] w-[2px] rounded-full bg-gray-200 dark:bg-gray-700"
                  aria-hidden="true"
                />
                <span
                  :class="[
                    'relative z-[1] mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-white dark:bg-gray-800',
                    step.ok
                      ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                      : 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400',
                  ]"
                >
                  <CheckIcon v-if="step.ok" class="h-2 w-2" />
                  <ErrorIcon v-else class="h-2 w-2" />
                </span>
                <div class="min-w-0 flex-1">
                  <p
                    :class="[
                      'flex items-center gap-1 text-[11px] font-medium leading-4',
                      step.ok
                        ? 'text-gray-700 dark:text-gray-200'
                        : 'text-red-600 dark:text-red-400',
                    ]"
                  >
                    <span class="shrink-0 whitespace-nowrap">
                      {{ actionName(step.action) }}
                    </span>
                    <span
                      v-if="step.detail"
                      class="flex min-w-0 flex-1 items-center justify-end gap-1 font-mono text-[10px] font-normal text-gray-400 dark:text-gray-500"
                    >
                      <span class="min-w-0 truncate">{{
                        detailHead(step.detail)
                      }}</span>
                      <span v-if="detailTail(step.detail)" class="shrink-0">{{
                        detailTail(step.detail)
                      }}</span>
                    </span>
                  </p>
                  <p
                    class="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400"
                  >
                    {{ step.message }}
                  </p>
                  <div v-if="step.reasoning">
                    <button
                      type="button"
                      class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                      @click="
                        agentReasoningOpen =
                          agentReasoningOpen === index ? null : index
                      "
                    >
                      {{ messages.thought }}
                      <span v-if="step.reasoningMs" class="opacity-70"
                        >· {{ formatDuration(step.reasoningMs) }}</span
                      >
                      <ChevronDown
                        :class="[
                          'h-3 w-3 transition-transform',
                          agentReasoningOpen === index ? 'rotate-180' : '',
                        ]"
                      />
                    </button>
                    <div
                      v-if="agentReasoningOpen === index"
                      class="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-black/[0.03] px-2 py-1.5 text-[10px] leading-4 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400"
                    >
                      {{ step.reasoning }}
                    </div>
                  </div>
                </div>
              </li>
              <li v-if="isStreaming" class="relative flex gap-2">
                <span
                  class="relative z-[1] mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                >
                  <span
                    class="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent dark:border-blue-400 dark:border-t-transparent"
                  />
                </span>
                <div class="min-w-0 flex-1">
                  <p
                    class="flex items-center gap-1 text-[11px] font-medium leading-4 text-gray-700 dark:text-gray-200"
                  >
                    <span class="shrink-0 whitespace-nowrap">
                      {{ stepLabel("request") }}
                    </span>
                    <span
                      v-if="requestDetail"
                      class="flex min-w-0 flex-1 items-center justify-end gap-1 font-normal text-gray-400 dark:text-gray-500"
                    >
                      <span class="min-w-0 truncate">{{
                        detailHead(requestDetail)
                      }}</span>
                      <span v-if="detailTail(requestDetail)" class="shrink-0">{{
                        detailTail(requestDetail)
                      }}</span>
                    </span>
                  </p>
                  <div
                    v-if="message.reasoning"
                    ref="streamingReasoningRef"
                    class="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-black/[0.03] px-2 py-1.5 text-[11px] leading-5 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400"
                  >
                    {{ message.reasoning }}
                  </div>
                  <p
                    v-else
                    class="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400"
                  >
                    {{ messages.thinking }}
                  </p>
                </div>
              </li>
              <li
                v-else-if="message.reasoning && !message.agentSteps?.length"
                class="relative flex gap-2"
              >
                <span
                  class="relative z-[1] mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                >
                  <CheckIcon class="h-2 w-2" />
                </span>
                <div class="min-w-0 flex-1">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-[11px] font-medium leading-4 text-gray-700 dark:text-gray-200"
                    @click="
                      agentReasoningOpen = agentReasoningOpen === -1 ? null : -1
                    "
                  >
                    {{ messages.thought }}
                    <span
                      v-if="message.reasoningMs"
                      class="font-normal text-gray-400 dark:text-gray-500"
                    >
                      · {{ formatDuration(message.reasoningMs) }}
                    </span>
                    <ChevronDown
                      :class="[
                        'h-3 w-3 transition-transform',
                        agentReasoningOpen === -1 ? 'rotate-180' : '',
                      ]"
                    />
                  </button>
                  <div
                    v-if="agentReasoningOpen === -1"
                    class="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-black/[0.03] px-2 py-1.5 text-[11px] leading-5 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400"
                  >
                    {{ message.reasoning }}
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <ul
            v-if="stepsOpen && visibleSteps.length"
            class="space-y-1 border-t border-black/5 px-2 py-1.5 dark:border-white/10"
          >
            <li
              v-for="step in visibleSteps"
              :key="step.kind"
              class="flex items-center gap-1.5 text-[11px]"
            >
              <span
                class="inline-flex h-3 w-3 shrink-0 items-center justify-center"
              >
                <span
                  v-if="step.status === 'running'"
                  class="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent dark:border-blue-400 dark:border-t-transparent"
                />
                <span
                  v-else-if="step.status === 'pending'"
                  class="h-2.5 w-2.5 rounded-full border border-gray-300 dark:border-gray-600"
                />
                <CheckIcon
                  v-else-if="step.status === 'done'"
                  class="h-3 w-3 text-green-600 dark:text-green-500"
                />
                <WarningIcon
                  v-else-if="step.status === 'warn'"
                  class="h-3 w-3 text-amber-500"
                />
                <ErrorIcon v-else class="h-3 w-3 text-red-500" />
              </span>
              <span
                :class="[
                  'min-w-0 flex-1 truncate',
                  step.status === 'pending'
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-gray-600 dark:text-gray-300',
                ]"
              >
                {{ stepLabel(step.kind) }}
              </span>
              <span
                v-if="step.count !== undefined"
                class="shrink-0 text-gray-400 dark:text-gray-500"
              >
                {{ step.count }}
                {{
                  step.kind === "parse"
                    ? messages.stepElements
                    : messages.stepWarnings
                }}
              </span>
              <span
                v-else-if="step.detail"
                class="shrink-0 truncate font-mono text-[10px] text-gray-400 dark:text-gray-500"
              >
                {{ step.detail }}
              </span>
            </li>
          </ul>

          <button
            v-if="message.raw"
            type="button"
            class="flex w-full items-center gap-1.5 border-t border-black/5 px-2 py-1.5 text-left text-[11px] text-gray-400 transition hover:bg-black/5 dark:border-white/10 dark:text-gray-500 dark:hover:bg-white/5"
            @click="showRaw = !showRaw"
          >
            <CodeIcon class="h-3 w-3 shrink-0" />
            <span class="flex-1 truncate">
              {{ showRaw ? messages.hideRaw : messages.viewRaw }}
            </span>
            <ChevronDown
              :class="[
                'h-3 w-3 shrink-0 transition-transform',
                showRaw ? 'rotate-180' : '',
              ]"
            />
          </button>
          <pre
            v-if="showRaw && message.raw"
            class="max-h-48 overflow-auto whitespace-pre-wrap border-t border-black/5 bg-black/5 px-2 py-1.5 text-[10px] leading-4 text-gray-500 dark:border-white/10 dark:bg-black/30 dark:text-gray-400"
            >{{ message.raw }}</pre>
        </div>

        <div v-if="summary" class="mt-1.5 space-y-1.5">
          <div
            class="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center divide-x divide-black/5 overflow-hidden rounded-md bg-black/[0.03] py-1 text-[10px] leading-4 dark:divide-white/10 dark:bg-white/[0.05]"
          >
            <span
              class="flex items-center justify-center gap-1 whitespace-nowrap text-gray-500 dark:text-gray-400"
            >
              <span class="font-medium text-gray-700 dark:text-gray-200">{{
                summary.pages
              }}</span>
              {{ messages.summaryPages }}
              <span class="text-gray-300 dark:text-gray-600">·</span>
              <span class="font-medium text-gray-700 dark:text-gray-200">{{
                summary.elements
              }}</span>
              {{ messages.summaryElements }}
            </span>
            <span
              class="flex items-center justify-center gap-0.5 whitespace-nowrap font-medium"
              :class="
                summary.added
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-gray-500'
              "
            >
              +{{ summary.added }}
              <span class="font-normal">{{ messages.summaryAdded }}</span>
            </span>
            <span
              class="flex items-center justify-center gap-0.5 whitespace-nowrap font-medium"
              :class="
                summary.modified
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-400 dark:text-gray-500'
              "
            >
              ~{{ summary.modified }}
              <span class="font-normal">{{ messages.summaryModified }}</span>
            </span>
            <span
              class="flex items-center justify-center gap-0.5 whitespace-nowrap font-medium"
              :class="
                summary.removed
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
              "
            >
              -{{ summary.removed }}
              <span class="font-normal">{{ messages.summaryRemoved }}</span>
            </span>
          </div>

          <div v-if="warningItems.length > 0">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
              @click="showWarnings = !showWarnings"
            >
              {{ messages.warnings }} ({{ warningItems.length }})
              <ChevronDown
                :class="[
                  'h-3 w-3 transition-transform',
                  showWarnings ? 'rotate-180' : '',
                ]"
              />
            </button>
            <ul
              v-if="showWarnings"
              class="mt-1 space-y-1 pl-3 list-disc opacity-80"
            >
              <li v-for="(item, index) in warningItems" :key="index">
                {{ item.text }}
                <span v-if="item.detail" class="opacity-60"
                  >({{ item.detail }})</span
                >
              </li>
            </ul>
          </div>
        </div>

        <div
          v-if="message.awaitingContinue"
          class="mt-1.5 flex items-center gap-2 text-[11px] leading-4"
        >
          <span class="min-w-0 flex-1 text-gray-500 dark:text-gray-400">
            {{ messages.slowResponseHint }}
          </span>
          <button
            type="button"
            class="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
            @click="emit('continue')"
          >
            {{ messages.continueWaiting }}
          </button>
        </div>

        <p
          v-if="message.stopped"
          class="mt-1.5 flex items-center justify-end text-[11px] leading-4 text-gray-400 dark:text-gray-500"
        >
          {{ messages.stopped }}
        </p>

        <div v-if="isError" class="mt-1.5">
          <p class="text-[11px] leading-4 font-medium">{{ errorText }}</p>
          <p
            v-if="message.errorDetail"
            class="mt-1 text-[10px] leading-4 opacity-70 break-all"
          >
            {{ message.errorDetail }}
          </p>
        </div>
      </template>
    </div>

    <div
      v-if="!editing"
      class="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    >
      <button
        type="button"
        :title="copied ? messages.copied : messages.copy"
        class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        @click="copyText"
      >
        <CheckIcon v-if="copied" class="h-3.5 w-3.5 text-green-600" />
        <CopyIcon v-else class="h-3.5 w-3.5" />
      </button>

      <template v-if="isUser">
        <button
          type="button"
          :title="messages.edit"
          class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          @click="startEdit"
        >
          <EditIcon class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          :title="messages.deleteMessage"
          class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          @click="emit('remove-message', message.id)"
        >
          <DeleteIcon class="h-3.5 w-3.5" />
        </button>
      </template>

      <template v-else>
        <button
          v-if="isLast"
          type="button"
          :title="messages.regenerate"
          class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          @click="emit('regenerate')"
        >
          <RefreshIcon class="h-3.5 w-3.5" />
        </button>
      </template>
    </div>
  </div>
</template>
