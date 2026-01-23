<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps<{
  type: 'horizontal' | 'vertical';
  zoom: number;
  scroll: number;
  offset: number; // Start position offset (where 0 is)
  thick?: number;
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
  const { zoom, scroll, offset, type } = props;

  // Clear
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#F9FAFB'; // bg-gray-50
  ctx.fillRect(0, 0, width, height);
  
  ctx.strokeStyle = '#9CA3AF'; // gray-400
  ctx.fillStyle = '#6B7280'; // gray-500
  ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.beginPath();

  // Determine step size based on zoom
  // We want the visual gap between steps to be around 10-20px
  // logical step options: 1, 2, 5, 10, 20, 50, 100, etc.
  
  // Example:
  // zoom = 1, want 10px visual gap -> logical gap 10
  // zoom = 0.5, want 10px visual gap -> logical gap 20
  // zoom = 2, want 10px visual gap -> logical gap 5
  
  const targetVisualGap = 50; // px between major marks
  const logicalGapRaw = targetVisualGap / zoom;
  
  // Find closest nice number
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (s >= logicalGapRaw) {
      step = s;
      break;
    }
  }

  // Calculate start and end in logical coordinates
  // Visual range: 0 to width (or height)
  // Logic Start = (0 - offset + scroll) / zoom
  // Actually:
  // Visual Position = offset + (Logical Position * zoom) - scroll
  // => Logical Position = (Visual Position - offset + scroll) / zoom
  
  const length = type === 'horizontal' ? width : height;
  const startLogical = (-offset + scroll) / zoom;
  const endLogical = (length - offset + scroll) / zoom;
  
  // Align start to step
  const firstMark = Math.floor(startLogical / step) * step;
  
  for (let val = firstMark; val <= endLogical; val += step) {
    const pos = offset + (val * zoom) - scroll;
    
    // Draw mark
    if (type === 'horizontal') {
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, THICKNESS);
      ctx.fillText(val.toString(), pos + 2, 10);
    } else {
      ctx.moveTo(0, pos);
      ctx.lineTo(THICKNESS, pos);
      
      // Rotate text for vertical ruler
      ctx.save();
      ctx.translate(10, pos + 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(val.toString(), 0, 0);
      ctx.restore();
    }
    
    // Subdivisions (optional, simple for now)
    const subStep = step / 5; // 5 subdivisions
    for(let i=1; i<5; i++) {
        const subVal = val + subStep * i;
        const subPos = offset + (subVal * zoom) - scroll;
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

watch(() => [props.zoom, props.scroll, props.offset], draw);

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
