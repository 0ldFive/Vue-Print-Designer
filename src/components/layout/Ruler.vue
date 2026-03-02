<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { MM_TO_PX, PT_TO_PX, IN_TO_PX, CM_TO_PX, type Unit } from '@/utils/units';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{
  type: 'horizontal' | 'vertical';
  zoom: number;
  scroll: number;
  offset: number; // Start position offset (where 0 is)
  thick?: number;
  indicators?: { position: number; color: string }[];
  unit: Unit;
}>();

const { isDark } = useTheme();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const THICKNESS = props.thick || 20;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const { zoom, scroll, offset, type, indicators } = props;
  const _isDark = isDark.value;

  // Clear
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = _isDark ? '#1f2937' : '#F9FAFB'; // dark: gray-800, light: gray-50
  ctx.fillRect(0, 0, width, height);
  
  // Draw Indicators
  if (indicators && indicators.length > 0) {
    for (const indicator of indicators) {
      const pos = offset + (indicator.position * zoom) - scroll;
      ctx.fillStyle = indicator.color;
      if (type === 'horizontal') {
        ctx.fillRect(pos - 2, 0, 4, THICKNESS);
      } else {
        ctx.fillRect(0, pos - 2, THICKNESS, 4);
      }
    }
  }

  ctx.strokeStyle = _isDark ? '#6b7280' : '#9CA3AF'; // dark: gray-500, light: gray-400
  ctx.fillStyle = _isDark ? '#9ca3af' : '#6B7280'; // dark: gray-400, light: gray-500
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.beginPath();

  const pxPerUnit = props.unit === 'mm' ? MM_TO_PX : props.unit === 'pt' ? PT_TO_PX : props.unit === 'in' ? IN_TO_PX : props.unit === 'cm' ? CM_TO_PX : 1;
  const visualPxPerUnit = pxPerUnit * zoom;
  
  const targetVisualGap = 50; // px between major marks
  const targetUnitGap = targetVisualGap / visualPxPerUnit;
  
  // Find closest nice number (steps in MM)
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let stepUnit = steps[steps.length - 1];
  for (const s of steps) {
    if (s >= targetUnitGap - 0.001) {
      stepUnit = s;
      break;
    }
  }

  // Calculate start and end in logical coordinates (mm)
  const length = type === 'horizontal' ? width : height;
  
  // Logical Start (mm) = (-offset + scroll) / zoom
  // Logical Start (mm) = Logical Start (mm) / MM_TO_PX
  const startUnitRaw = (-offset + scroll) / (zoom * pxPerUnit);
  const endUnitRaw = (length - offset + scroll) / (zoom * pxPerUnit);
  
  // Align start to step
  const firstMarkUnit = Math.floor(startUnitRaw / stepUnit) * stepUnit;
  
  // Use a slightly larger end check to ensure we cover the screen
  for (let valUnit = firstMarkUnit; valUnit <= endUnitRaw; valUnit += stepUnit) {
    // Avoid precision issues: round valMm to 1 decimal place for display if needed
    // But keep precise for calculation
    
    // Position in screen pixels
    // valMm * MM_TO_PX = logical pixels
    const pos = offset + (valUnit * pxPerUnit * zoom) - scroll;
    
    // Draw mark
    const label = Number(valUnit.toFixed(1)).toString(); // Clean label
    
    if (type === 'horizontal') {
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, THICKNESS);
      ctx.fillText(label, pos + 2, 10);
    } else {
      ctx.moveTo(0, pos);
      ctx.lineTo(THICKNESS, pos);
      
      // Rotate text for vertical ruler
      ctx.save();
      ctx.translate(10, pos + 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 4, 0); // Move text away from canvas edge to match horizontal ruler
      ctx.restore();
    }
    
    // Subdivisions
    const subStepUnit = stepUnit / 5; // 5 subdivisions
    for(let i=1; i<5; i++) {
      const subValUnit = valUnit + subStepUnit * i;
      const subPos = offset + (subValUnit * pxPerUnit * zoom) - scroll;
        if (type === 'horizontal') {
            ctx.moveTo(subPos, THICKNESS - 5);
            ctx.lineTo(subPos, THICKNESS);
        } else {
            ctx.moveTo(THICKNESS - 5, subPos);
            ctx.lineTo(THICKNESS, subPos);
        }
    }
  }

  ctx.stroke();
};

// Handle Resize
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const canvas = canvasRef.value;
    if (canvas) {
      const { width, height } = entry.contentRect;
      canvas.width = width;
      canvas.height = height;
      draw();
    }
  }
});

onMounted(() => {
  if (canvasRef.value) {
    resizeObserver.observe(canvasRef.value.parentElement!);
    draw();
  }
});

onUnmounted(() => {
  resizeObserver.disconnect();
});

watch(() => [props.zoom, props.scroll, props.offset, props.indicators, props.unit, isDark.value], draw, { deep: true });

const emit = defineEmits<{
  (e: 'guide-drag-start', event: MouseEvent): void
}>();

const handleMouseDown = (e: MouseEvent) => {
  emit('guide-drag-start', e);
};
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-800 relative" @mousedown="handleMouseDown">
    <canvas ref="canvasRef" class="block"></canvas>
  </div>
</template>
