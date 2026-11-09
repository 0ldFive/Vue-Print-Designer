import { ref, watch } from "vue";
import {
  STORAGE_KEYS,
  readStoredBoolean,
  writeStoredBoolean,
} from "@/utils/storage";

const autoSave = ref(readStoredBoolean(STORAGE_KEYS.autosave, true));

watch(autoSave, (val) => {
  writeStoredBoolean(STORAGE_KEYS.autosave, val);
});

export function useAutoSave() {
  return {
    autoSave,
  };
}
