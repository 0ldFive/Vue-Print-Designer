import { ref, watch } from 'vue';

const autoSave = ref(localStorage.getItem('print-designer-autosave') === 'true');

watch(autoSave, (val) => {
  localStorage.setItem('print-designer-autosave', String(val));
});

export function useAutoSave() {
  return {
    autoSave
  };
}
