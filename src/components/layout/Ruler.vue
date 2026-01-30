<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { pxToMm, mmToPx, MM_TO_PX } from '@/utils/units';

const props = defineProps<{
  type: 'horizontal' | 'vertical';
  zoom: number;
  scroll: number;
  offset: number; // Start position offset (where 0 is)
  thick?: number;
  indicators?: { position: number; color: string }[];
}>();

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

  // Clear
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#F9FAFB'; // bg-gray-50
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

  ctx.strokeStyle = '#9CA3AF'; // gray-400
  ctx.fillStyle = '#6B7280'; // gray-500
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.beginPath();

  // Determine step size in MM
  // Visual pixels per MM
  const visualPxPerMm = MM_TO_PX * zoom;
  
  const targetVisualGap = 50; // px between major marks
  const targetMmGap = targetVisualGap / visualPxPerMm;
  
  // Find closest nice number (steps in MM)
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let stepMm = steps[steps.length - 1];
  for (const s of steps) {
    if (s >= targetMmGap - 0.001) {
      stepMm = s;
      break;
    }
  }

  // Calculate start and end in logical coordinates (mm)
  const length = type === 'horizontal' ? width : height;
  
  // Logical Start (mm) = (-offset + scroll) / zoom
  // Logical Start (mm) = Logical Start (mm) / MM_TO_PX
  const startMmRaw = (-offset + scroll) / (zoom * MM_TO_PX);
  const endMmRaw = (length - offset + scroll) / (zoom * MM_TO_PX);
  
  // Align start to step
  const firstMarkMm = Math.floor(startMmRaw / stepMm) * stepMm;
  
  // Use a slightly larger end check to ensure we cover the screen
  for (let valMm = firstMarkMm; valMm <= endMmRaw; valMm += stepMm) {
    // Avoid precision issues: round valMm to 1 decimal place for display if needed
    // But keep precise for calculation
    
    // Position in screen pixels
    // valMm * MM_TO_PX = logical pixels
    const pos = offset + (valMm * MM_TO_PX * zoom) - scroll;
    
    // Draw mark
    const label = Number(valMm.toFixed(1)).toString(); // Clean label
    
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
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    
    // Subdivisions
    const subStepMm = stepMm / 5; // 5 subdivisions
    for(let i=1; i<5; i++) {
        const subValMm = valMm + subStepMm * i;
        const subPos = offset + (subValMm * MM_TO_PX * zoom) - scroll;
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

watch(() => [props.zoom, props.scroll, props.offset, props.indicators], draw, { deep: true });

const emit = defineEmits<{
  (e: 'guide-drag-start', event: MouseEvent): void
}>();

const handleMouseDown = (e: MouseEvent) => {
  emit('guide-drag-start', e);
};
</script>

<template>
  <div class="w-full h-full overflow-hidden bg-gray-50 relative" @mousedown="handleMouseDown">
    <canvas ref="canvasRef" class="block"></canvas>
  </div>
</template>
