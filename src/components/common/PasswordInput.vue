<script setup lang="ts">
import { ref } from "vue";
import Visibility from "~icons/material-symbols/visibility";
import VisibilityOff from "~icons/material-symbols/visibility-off";
import { useI18n } from "@/locales";

defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  autocomplete?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { t } = useI18n();
const visible = ref(false);

const handleInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>

<template>
  <div class="relative">
    <input
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocomplete="autocomplete || 'off'"
      class="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      @input="handleInput"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed"
      :disabled="disabled"
      :title="visible ? t('common.hidePassword') : t('common.showPassword')"
      :aria-label="
        visible ? t('common.hidePassword') : t('common.showPassword')
      "
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <VisibilityOff v-if="visible" class="w-4 h-4" />
      <Visibility v-else class="w-4 h-4" />
    </button>
  </div>
</template>
