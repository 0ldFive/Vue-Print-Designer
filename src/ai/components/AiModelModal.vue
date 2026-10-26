<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CloseIcon from "~icons/material-symbols/close";
import ExpandIcon from "~icons/material-symbols/expand-more";
import { useAiLocale } from "../locales";
import type { AiModelProfile } from "../types";
import { AiRequestError, requestAiTemplate } from "../core/client";
import PasswordInput from "@/components/common/PasswordInput.vue";

const props = defineProps<{
  mode?: "add" | "edit";
  initial?: Partial<AiModelProfile>;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", value: Partial<AiModelProfile>): void;
}>();

const { messages } = useAiLocale();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const isEdit = computed(() => props.mode === "edit");

const parseJsonObject = (
  text: string,
): { ok: boolean; value: Record<string, unknown> } => {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, value: {} };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, value: {} };
  }
};

const initialHeaders = props.initial?.headers ?? {};
const initialBody = props.initial?.extraBody ?? {};

const draft = ref({
  alias: isEdit.value ? props.initial?.alias || "" : "",
  model: isEdit.value ? props.initial?.model || "" : "",
  baseUrl: props.initial?.baseUrl || "",
  apiKey: props.initial?.apiKey || "",
  temperature: props.initial?.temperature ?? 0.2,
  maxTokens: props.initial?.maxTokens ?? 16384,
  maxInputTokens: props.initial?.maxInputTokens ?? 128000,
  supportsVision: props.initial?.supportsVision ?? false,
  topP: props.initial?.topP ?? 1,
  seedText: props.initial?.seed != null ? String(props.initial.seed) : "",
  presencePenalty: props.initial?.presencePenalty ?? 0,
  frequencyPenalty: props.initial?.frequencyPenalty ?? 0,
  forceJson: props.initial?.forceJson ?? true,
  headersText: JSON.stringify(initialHeaders, null, 2),
  extraBodyText: JSON.stringify(initialBody, null, 2),
});

const advancedOpen = ref(
  Boolean(props.initial?.alias) ||
    props.initial?.supportsVision === true ||
    props.initial?.forceJson === false ||
    Object.keys(initialHeaders).length > 0 ||
    Object.keys(initialBody).length > 0,
);

const inputRef = ref<HTMLInputElement | null>(null);

const headersParsed = computed(() => parseJsonObject(draft.value.headersText));
const extraParsed = computed(() => parseJsonObject(draft.value.extraBodyText));
const headersValid = computed(
  () =>
    headersParsed.value.ok &&
    Object.values(headersParsed.value.value).every(
      (item) => typeof item === "string",
    ),
);
const canSubmit = computed(
  () =>
    Boolean(draft.value.model.trim()) &&
    headersValid.value &&
    extraParsed.value.ok,
);

const toNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

/** 把当前表单整理成一份模型配置，供提交与连通性测试复用。 */
const buildProfile = (): AiModelProfile => {
  const seedText = draft.value.seedText.trim();
  const seed = seedText === "" ? null : Math.round(Number(seedText));
  return {
    id: props.initial?.id || "",
    alias: draft.value.alias.trim(),
    model: draft.value.model.trim(),
    baseUrl: draft.value.baseUrl.trim(),
    apiKey: draft.value.apiKey.trim(),
    temperature: toNumber(draft.value.temperature, 0.2),
    maxTokens: toNumber(draft.value.maxTokens, 16384),
    maxInputTokens: toNumber(draft.value.maxInputTokens, 128000),
    supportsVision: draft.value.supportsVision,
    topP: toNumber(draft.value.topP, 1),
    presencePenalty: toNumber(draft.value.presencePenalty, 0),
    frequencyPenalty: toNumber(draft.value.frequencyPenalty, 0),
    seed: seed !== null && Number.isFinite(seed) ? seed : null,
    forceJson: draft.value.forceJson,
    headers: headersParsed.value.value as Record<string, string>,
    extraBody: extraParsed.value.value,
  };
};

const submit = () => {
  if (!canSubmit.value) return;
  const { id: _id, ...profile } = buildProfile();
  emit("submit", profile);
  emit("close");
};

const canTest = computed(
  () =>
    Boolean(draft.value.model.trim()) &&
    Boolean(draft.value.baseUrl.trim()) &&
    headersValid.value &&
    extraParsed.value.ok,
);

const testState = ref<"idle" | "running" | "ok" | "error">("idle");
const testText = ref("");
let testController: AbortController | null = null;

/** 用当前表单发一次最小请求，验证地址、密钥与模型是否可用。 */
const testConnection = async () => {
  if (!canTest.value || testState.value === "running") return;
  testState.value = "running";
  testText.value = "";
  const startedAt = Date.now();
  const controller = new AbortController();
  testController = controller;
  try {
    await requestAiTemplate(
      {
        ...buildProfile(),
        temperature: 0,
        maxTokens: 256,
        forceJson: false,
      },
      [{ role: "user", content: "Reply with OK." }],
      { signal: controller.signal, timeoutMs: 20000 },
    );
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    testState.value = "ok";
    testText.value = `${messages.value.testSuccess} · ${elapsed}s`;
  } catch (error) {
    if (controller.signal.aborted) return;
    const code = error instanceof AiRequestError ? error.code : "network";
    testState.value = "error";
    testText.value = `${messages.value.testFailed} · ${messages.value.errors[code]}`;
  } finally {
    if (testController === controller) testController = null;
  }
};

// 表单一变就清空上次结果，避免旧结论误导。
watch(
  () => [
    draft.value.model,
    draft.value.baseUrl,
    draft.value.apiKey,
    draft.value.headersText,
    draft.value.extraBodyText,
  ],
  () => {
    if (testState.value === "running") return;
    testState.value = "idle";
    testText.value = "";
  },
);

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  emit("close");
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown, true);
  inputRef.value?.focus();
});

onBeforeUnmount(() => {
  testController?.abort();
  window.removeEventListener("keydown", handleKeydown, true);
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      class="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 pointer-events-auto"
      @click.self="emit('close')"
    >
      <div
        class="flex h-[34rem] max-h-[85vh] w-[32rem] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3"
        >
          <h3 class="text-sm font-semibold text-gray-800">
            {{ isEdit ? messages.editModelTitle : messages.addModelTitle }}
          </h3>
          <button
            type="button"
            class="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            @click="emit('close')"
          >
            <CloseIcon class="w-4 h-4" />
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section class="space-y-3">
            <h4 class="text-sm font-semibold text-gray-800">
              {{ messages.sectionConnection }}
            </h4>

            <label class="block space-y-1">
              <span class="text-xs font-medium text-gray-600">
                {{ messages.modelId }}
              </span>
              <input
                ref="inputRef"
                v-model="draft.model"
                type="text"
                :placeholder="messages.modelPlaceholder"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                @keydown.enter.prevent="submit"
              />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-medium text-gray-600">
                {{ messages.baseUrl }}
              </span>
              <input
                v-model="draft.baseUrl"
                type="text"
                placeholder="https://api.openai.com/v1"
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                @keydown.enter.prevent="submit"
              />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-medium text-gray-600">
                {{ messages.apiKey }}
              </span>
              <PasswordInput v-model="draft.apiKey" />
            </label>
          </section>

          <section class="space-y-3">
            <button
              type="button"
              class="group flex w-full items-center justify-between py-0.5 text-sm font-semibold text-gray-800 transition-colors hover:text-blue-600"
              @click="advancedOpen = !advancedOpen"
            >
              <span>{{ messages.sectionAdvanced }}</span>
              <ExpandIcon
                class="h-4 w-4 text-gray-400 transition-transform group-hover:text-blue-600"
                :class="advancedOpen ? 'rotate-180' : ''"
              />
            </button>

            <template v-if="advancedOpen">
              <label class="block space-y-1">
                <span class="text-xs font-medium text-gray-600">
                  {{ messages.modelAlias }}
                </span>
                <input
                  v-model="draft.alias"
                  type="text"
                  :placeholder="messages.modelAliasPlaceholder"
                  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  @keydown.enter.prevent="submit"
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    v-model="draft.supportsVision"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {{ messages.supportsVision }}
                </label>

                <label class="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    v-model="draft.forceJson"
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {{ messages.forceJson }}
                </label>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.temperature }}
                  </span>
                  <input
                    v-model.number="draft.temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.topP }}
                  </span>
                  <input
                    v-model.number="draft.topP"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.maxInputTokens }}
                  </span>
                  <div class="relative">
                    <input
                      v-model.number="draft.maxInputTokens"
                      type="number"
                      min="1024"
                      max="1000000"
                      step="1024"
                      class="w-full rounded-md border border-gray-300 px-3 py-2 pr-14 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span
                      class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"
                      >tokens</span
                    >
                  </div>
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.maxTokens }}
                  </span>
                  <div class="relative">
                    <input
                      v-model.number="draft.maxTokens"
                      type="number"
                      min="256"
                      max="128000"
                      step="256"
                      class="w-full rounded-md border border-gray-300 px-3 py-2 pr-14 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span
                      class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"
                      >tokens</span
                    >
                  </div>
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.seed }}
                  </span>
                  <input
                    v-model="draft.seedText"
                    type="number"
                    min="0"
                    step="1"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.presencePenalty }}
                  </span>
                  <input
                    v-model.number="draft.presencePenalty"
                    type="number"
                    min="-2"
                    max="2"
                    step="0.1"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label class="block space-y-1">
                  <span class="text-xs font-medium text-gray-600">
                    {{ messages.frequencyPenalty }}
                  </span>
                  <input
                    v-model.number="draft.frequencyPenalty"
                    type="number"
                    min="-2"
                    max="2"
                    step="0.1"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              </div>

              <label class="block space-y-1">
                <span class="text-xs font-medium text-gray-600">
                  {{ messages.customHeaders }}
                </span>
                <textarea
                  v-model="draft.headersText"
                  rows="3"
                  spellcheck="false"
                  class="w-full resize-y rounded-md border px-3 py-2 font-mono text-[11px] text-gray-900 focus:outline-none focus:ring-1"
                  :class="
                    headersValid
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      : 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  "
                />
                <span v-if="!headersValid" class="text-[11px] text-red-500">
                  {{ messages.invalidJson }}
                </span>
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-medium text-gray-600">
                  {{ messages.extraBody }}
                </span>
                <textarea
                  v-model="draft.extraBodyText"
                  rows="3"
                  spellcheck="false"
                  class="w-full resize-y rounded-md border px-3 py-2 font-mono text-[11px] text-gray-900 focus:outline-none focus:ring-1"
                  :class="
                    extraParsed.ok
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      : 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  "
                />
                <span v-if="!extraParsed.ok" class="text-[11px] text-red-500">
                  {{ messages.invalidJson }}
                </span>
              </label>
            </template>
          </section>
        </div>

        <div
          class="flex shrink-0 items-center gap-2 border-t border-gray-200 px-4 py-3"
        >
          <button
            type="button"
            :disabled="!canTest || testState === 'running'"
            class="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            @click="testConnection"
          >
            {{
              testState === "running"
                ? messages.testing
                : messages.testConnection
            }}
          </button>
          <span
            v-if="testText"
            :title="testText"
            :class="[
              'min-w-0 flex-1 truncate text-[11px]',
              testState === 'ok' ? 'text-emerald-600' : 'text-red-600',
            ]"
          >
            {{ testText }}
          </span>
          <div class="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              @click="emit('close')"
            >
              {{ messages.cancel }}
            </button>
            <button
              type="button"
              :disabled="!canSubmit"
              class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="submit"
            >
              {{ isEdit ? messages.save : messages.addModel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
