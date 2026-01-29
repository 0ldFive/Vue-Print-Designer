<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import CheckIcon from '~icons/material-symbols/check';
import CloseIcon from '~icons/material-symbols/close';
import FormatColorReset from '~icons/material-symbols/format-color-reset';
import GridOff from '~icons/material-symbols/grid-off';
import { type HSVA, hsvToRgb, rgbToHsv, parseColor, toHex, toRgbaString } from '@/utils/color';

const props = defineProps<{
  modelValue?: string;
  disabled?: boolean;
  defaultColor?: string;
  allowTransparent?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

// HSV State
const hsv = ref<HSVA>({ h: 0, s: 0, v: 0, a: 1 });

// Refs for drag elements
const svPanelRef = ref<HTMLElement | null>(null);
const hueSliderRef = ref<HTMLElement | null>(null);
const alphaSliderRef = ref<HTMLElement | null>(null);

// Display values
const displayColor = computed(() => {
  if (!props.modelValue) return props.defaultColor || '#000000';
  if (props.modelValue === 'transparent') return 'transparent';
  return props.modelValue;
});

const isTransparent = computed(() => props.modelValue === 'transparent');

const hexValue = computed({
  get: () => toHex(hsv.value.h, hsv.value.s, hsv.value.v, hsv.value.a),
  set: (val) => {
    const parsed = parseColor(val);
    if (parsed) {
      hsv.value = parsed;
      emitUpdate();
    }
  }
});

const rgbaValue = computed(() => {
  const { r, g, b } = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  return `rgba(${r}, ${g}, ${b}, ${parseFloat(hsv.value.a.toFixed(2))})`;
});

// Styles
const svPanelStyle = computed(() => ({
  backgroundColor: `hsl(${hsv.value.h}, 100%, 50%)`
}));

const cursorStyle = computed(() => ({
  top: `${(1 - hsv.value.v) * 100}%`,
  left: `${hsv.value.s * 100}%`
}));

const hueCursorStyle = computed(() => ({
  left: `${(hsv.value.h / 360) * 100}%`
}));

const alphaCursorStyle = computed(() => ({
  left: `${hsv.value.a * 100}%`
}));

const alphaBackgroundStyle = computed(() => {
  const { r, g, b } = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
  return {
    background: `linear-gradient(to right, rgba(${r},${g},${b},0) 0%, rgba(${r},${g},${b},1) 100%)`
  };
});

// Initialization
watch(() => props.modelValue, (val) => {
  if (val) {
    const parsed = parseColor(val);
    if (parsed) {
      hsv.value = parsed;
    }
  }
}, { immediate: true });

// Drag Logic
const handleDrag = (e: MouseEvent, type: 'sv' | 'hue' | 'alpha') => {
  e.preventDefault();
  const el = type === 'sv' ? svPanelRef.value : type === 'hue' ? hueSliderRef.value : alphaSliderRef.value;
  if (!el) return;

  const update = (clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    if (type === 'sv') {
      hsv.value.s = x;
      hsv.value.v = 1 - y;
    } else if (type === 'hue') {
      hsv.value.h = x * 360;
    } else if (type === 'alpha') {
      hsv.value.a = x;
    }
    emitUpdate();
  };

  update(e.clientX, e.clientY);

  const onMouseMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const emitUpdate = () => {
  if (hsv.value.a === 0 && props.allowTransparent) {
    emit('update:modelValue', 'transparent');
  } else {
    emit('update:modelValue', toHex(hsv.value.h, hsv.value.s, hsv.value.v, hsv.value.a));
  }
};

const dropdownStyle = ref<Record<string, string>>({
  top: '100%',
  left: '0',
  marginTop: '8px'
});

const updatePosition = () => {
  if (!containerRef.value) return;
  
  const rect = containerRef.value.getBoundingClientRect();
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const dropdownW = 240; // Fixed width defined in class
  const dropdownH = 350; // Approximate height with safety margin

  const style: Record<string, string> = {};

  // Horizontal Position
  // Check if there is enough space on the right
  if (rect.left + dropdownW > screenW - 20) {
    style.left = 'auto';
    style.right = '0';
  } else {
    style.left = '0';
    style.right = 'auto';
  }

  // Vertical Position
  // Check if there is enough space on the bottom
  if (rect.bottom + dropdownH > screenH - 10) {
    style.top = 'auto';
    style.bottom = '100%';
    style.marginTop = '0';
    style.marginBottom = '8px';
  } else {
    style.top = '100%';
    style.bottom = 'auto';
    style.marginTop = '8px';
    style.marginBottom = '0';
  }

  dropdownStyle.value = style;
};

const toggleOpen = async () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    updatePosition();
  }
};

const close = () => {
  isOpen.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    close();
  }
};

// Presets
const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff',
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  '#795548', '#9e9e9e', '#607d8b'
];

const selectPreset = (color: string) => {
  const parsed = parseColor(color);
  if (parsed) {
    hsv.value = parsed;
    emitUpdate();
  }
};

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside); // changed to mousedown for better outside click handling
});

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div class="relative inline-block" ref="containerRef">
    <!-- Trigger -->
    <div @click="toggleOpen" class="inline-flex">
      <slot name="trigger" :open="isOpen" :color="displayColor" :disabled="disabled">
        <div 
          class="w-6 h-6 rounded border border-gray-300 cursor-pointer flex items-center justify-center overflow-hidden transition-all hover:border-blue-500"
          :class="{ 'opacity-50 cursor-not-allowed': disabled, 'ring-2 ring-blue-500 ring-offset-1': isOpen }"
          :style="{ backgroundColor: isTransparent ? 'transparent' : displayColor }"
        >
          <div v-if="!modelValue" class="w-full h-[1px] bg-red-500 rotate-45 absolute"></div>
          <div v-if="isTransparent" class="w-full h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50"></div>
        </div>
      </slot>
    </div>

    <!-- Dropdown -->
    <div 
      v-if="isOpen" 
      class="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-[240px]"
      :style="dropdownStyle"
      @click.stop
    >
      <!-- Saturation/Value Panel -->
      <div 
        ref="svPanelRef"
        class="w-full h-32 rounded relative cursor-crosshair mb-3"
        :style="svPanelStyle"
        @mousedown="(e) => handleDrag(e, 'sv')"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent rounded"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent rounded"></div>
        <div 
          class="absolute w-3 h-3 border-2 border-white rounded-full shadow-sm -ml-1.5 -mt-1.5 pointer-events-none"
          :style="cursorStyle"
        ></div>
      </div>

      <!-- Sliders -->
      <div class="flex gap-2 mb-3">
        <div class="flex-1 flex flex-col gap-2">
          <!-- Hue Slider -->
          <div 
            ref="hueSliderRef"
            class="h-3 rounded relative cursor-pointer"
            style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
            @mousedown="(e) => handleDrag(e, 'hue')"
          >
            <div 
              class="absolute top-0 bottom-0 w-3 bg-white border border-gray-300 rounded-full shadow-sm -ml-1.5 pointer-events-none"
              :style="hueCursorStyle"
            ></div>
          </div>

          <!-- Alpha Slider -->
          <div class="relative h-3 rounded bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')]">
            <div 
              ref="alphaSliderRef"
              class="absolute inset-0 cursor-pointer rounded"
              :style="alphaBackgroundStyle"
              @mousedown="(e) => handleDrag(e, 'alpha')"
            >
              <div 
                class="absolute top-0 bottom-0 w-3 bg-white border border-gray-300 rounded-full shadow-sm -ml-1.5 pointer-events-none"
                :style="alphaCursorStyle"
              ></div>
            </div>
          </div>
        </div>
        
        <!-- Current Color Preview -->
        <div class="w-8 h-8 rounded border border-gray-200 overflow-hidden relative">
             <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwZ+5wNisxL//8n04mEeRAAAhNwX869V4DYAAAAASUVORK5CYII=')] opacity-50"></div>
             <div class="absolute inset-0" :style="{ backgroundColor: rgbaValue }"></div>
        </div>
      </div>

      <!-- Inputs -->
      <div class="flex gap-2 mb-3">
        <div class="flex-1">
          <input 
            type="text" 
            v-model="hexValue" 
            class="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:border-blue-500 outline-none font-mono uppercase"
            placeholder="#000000"
          />
        </div>
        <div class="w-16 text-right text-xs text-gray-500 flex items-center justify-end">
          {{ Math.round(hsv.a * 100) }}%
        </div>
      </div>

      <!-- Presets -->
      <div class="grid grid-cols-9 gap-1.5 mb-3">
        <div 
          v-for="color in PRESET_COLORS" 
          :key="color"
          class="w-4 h-4 rounded-sm cursor-pointer border border-transparent hover:scale-110 hover:border-gray-400 hover:z-10 transition-all relative"
          :class="{ 'ring-2 ring-blue-500 ring-offset-1 z-10': hexValue === color }"
          :style="{ backgroundColor: color }"
          @click="selectPreset(color)"
          :title="color"
        ></div>
      </div>
      
      <!-- Footer Actions -->
      <div class="flex justify-between border-t pt-2">
         <button 
           @click="$emit('update:modelValue', undefined); close()"
           class="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
         >
           Clear
         </button>
         <div v-if="allowTransparent">
           <button 
             @click="$emit('update:modelValue', 'transparent'); close()"
             class="text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
           >
             Transparent
           </button>
         </div>
      </div>

    </div>
  </div>
</template>
