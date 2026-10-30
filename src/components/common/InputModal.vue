<script setup lang="ts">
import { ref, watch, onUnmounted, computed, inject } from "vue";
import { useI18n } from "@/locales";
import Close from "~icons/material-symbols/close";
import Save from "~icons/material-symbols/save";
import { useDesignerStore } from "@/stores/designer";
import { useTheme } from "@/composables/useTheme";

type InputModalFieldType =
  | "input"
  | "number"
  | "textarea"
  | "select"
  | "radio"
  | "date"
  | "datetime";

interface InputModalOption {
  label: string;
  value: string | number;
}

interface InputModalField {
  key: string;
  label?: string;
  type: InputModalFieldType;
  required?: boolean;
  placeholder?: string;
  options?: InputModalOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  showWhen?: {
    key: string;
    value: string | number | boolean;
  };
}

const props = defineProps<{
  show: boolean;
  initialValue?: string;
  initialValues?: Record<string, any>;
  title?: string;
  placeholder?: string;
  fields?: InputModalField[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", value: any): void;
}>();

const { t } = useI18n();
const { isDark } = useTheme();
const designerStore = useDesignerStore();
const modalContainer = inject("modal-container", ref<HTMLElement | null>(null));

const modalRef = ref<HTMLElement | null>(null);
const formValues = ref<Record<string, any>>({});

const normalizedFields = computed<InputModalField[]>(() => {
  if (props.fields && props.fields.length > 0) return props.fields;
  return [
    {
      key: "value",
      type: "input",
      required: true,
      placeholder: props.placeholder || t("input.placeholder"),
    },
  ];
});

const visibleFields = computed(() =>
  normalizedFields.value.filter((field) => {
    if (!field.showWhen) return true;
    return formValues.value[field.showWhen.key] === field.showWhen.value;
  }),
);

const hasCustomFields = computed(() =>
  Boolean(props.fields && props.fields.length > 0),
);

const getDefaultFieldValue = (field: InputModalField) => {
  if (field.type === "number") return "";
  return "";
};

const buildInitialFormValues = () => {
  const next: Record<string, any> = {};
  normalizedFields.value.forEach((field) => {
    if (
      props.initialValues &&
      Object.prototype.hasOwnProperty.call(props.initialValues, field.key)
    ) {
      next[field.key] = props.initialValues[field.key];
      return;
    }
    if (!hasCustomFields.value && field.key === "value") {
      next[field.key] = props.initialValue || "";
      return;
    }
    next[field.key] = getDefaultFieldValue(field);
  });
  formValues.value = next;
};

const focusFirstField = () => {
  setTimeout(() => {
    const target = modalRef.value?.querySelector(
      "input, textarea, select",
    ) as HTMLElement | null;
    target?.focus();
  }, 100);
};

watch(
  () => props.show,
  (val) => {
    if (val) {
      buildInitialFormValues();
      focusFirstField();
      designerStore.setDisableGlobalShortcuts(true);
      return;
    }
    designerStore.setDisableGlobalShortcuts(false);
  },
);

const normalizedNumberValue = (raw: any) => {
  if (raw === "" || raw === null || raw === undefined) return "";
  const num = Number(raw);
  return Number.isFinite(num) ? num : "";
};

const validateForm = () => {
  for (const field of visibleFields.value) {
    const raw = formValues.value[field.key];
    const isEmpty = raw === "" || raw === null || raw === undefined;
    if (field.required && isEmpty) {
      return false;
    }
    if (field.type === "number" && !isEmpty) {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return false;
      }
      if (typeof field.min === "number" && num < field.min) {
        return false;
      }
      if (typeof field.max === "number" && num > field.max) {
        return false;
      }
    }
  }
  return true;
};

const isFormValid = computed(() => {
  for (const field of visibleFields.value) {
    const raw = formValues.value[field.key];
    const isEmpty = raw === "" || raw === null || raw === undefined;
    if (field.required && isEmpty) return false;
    if (field.type === "number" && !isEmpty && !Number.isFinite(Number(raw)))
      return false;
  }
  return true;
});

const handleSave = () => {
  if (!validateForm()) return;

  if (!hasCustomFields.value) {
    const text = String(formValues.value.value ?? "").trim();
    if (!text) return;
    emit("save", text);
    emit("close");
    return;
  }

  const payload: Record<string, any> = {};
  visibleFields.value.forEach((field) => {
    const raw = formValues.value[field.key];
    if (field.type === "number") {
      payload[field.key] =
        raw === "" || raw === null || raw === undefined ? null : Number(raw);
      return;
    }
    payload[field.key] = raw;
  });

  emit("save", payload);
  emit("close");
};

onUnmounted(() => {
  if (props.show) {
    designerStore.setDisableGlobalShortcuts(false);
  }
});
</script>

<template>
  <Teleport :to="modalContainer || 'body'">
    <div
      v-if="show"
      :class="{ dark: isDark }"
      class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 pointer-events-auto"
    >
      <div
        ref="modalRef"
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-96 max-h-[90vh] animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden"
      >
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0"
        >
          <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">
            {{ title || t("input.title") }}
          </h3>
          <button
            @click="emit('close')"
            class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <Close class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-3">
            <div
              v-for="field in visibleFields"
              :key="field.key"
              class="space-y-1"
            >
              <label
                v-if="field.label"
                class="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >{{ field.label }}</label
              >

              <input
                v-if="field.type === 'input'"
                v-model="formValues[field.key]"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="
                  field.placeholder || placeholder || t('input.placeholder')
                "
                @keydown.enter="handleSave"
                @keydown.esc="emit('close')"
              />

              <input
                v-else-if="field.type === 'number'"
                :value="formValues[field.key]"
                type="number"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="
                  field.placeholder || placeholder || t('input.placeholder')
                "
                :min="field.min"
                :max="field.max"
                :step="field.step ?? 1"
                @input="
                  formValues[field.key] = normalizedNumberValue(
                    ($event.target as HTMLInputElement).value,
                  )
                "
                @keydown.enter="handleSave"
                @keydown.esc="emit('close')"
              />

              <textarea
                v-else-if="field.type === 'textarea'"
                v-model="formValues[field.key]"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :rows="field.rows ?? 4"
                :placeholder="
                  field.placeholder || placeholder || t('input.placeholder')
                "
                @keydown.esc="emit('close')"
              />

              <select
                v-else-if="field.type === 'select'"
                v-model="formValues[field.key]"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @keydown.esc="emit('close')"
              >
                <option v-if="!field.required" value="">
                  {{ field.placeholder || t("input.placeholder") }}
                </option>
                <option
                  v-for="opt in field.options || []"
                  :key="String(opt.value)"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>

              <div v-else-if="field.type === 'radio'" class="space-y-2">
                <label
                  v-for="opt in field.options || []"
                  :key="String(opt.value)"
                  class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                >
                  <input
                    v-model="formValues[field.key]"
                    type="radio"
                    :value="opt.value"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              </div>

              <input
                v-else-if="field.type === 'date'"
                v-model="formValues[field.key]"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @keydown.esc="emit('close')"
              />

              <input
                v-else-if="field.type === 'datetime'"
                v-model="formValues[field.key]"
                type="datetime-local"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @keydown.esc="emit('close')"
              />
            </div>
          </div>
        </div>

        <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end gap-2.5 shrink-0 rounded-b-lg">
          <button
            @click="emit('close')"
            class="whitespace-nowrap px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <Close class="w-4 h-4 shrink-0" />
            {{ t("common.cancel") }}
          </button>
          <button
            @click="handleSave"
            :disabled="!isFormValid"
            class="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 theme-bg-strong text-white rounded hover:opacity-90 transition-opacity text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-90"
          >
            <Save class="w-4 h-4 shrink-0" />
            {{ t("common.save") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
