export const MM_TO_PX = 96 / 25.4;
export const PX_TO_MM = 25.4 / 96;
export const PT_TO_PX = 96 / 72;
export const PX_TO_PT = 72 / 96;
export const IN_TO_PX = 96;
export const PX_TO_IN = 1 / 96;
export const CM_TO_PX = 96 / 2.54;
export const PX_TO_CM = 2.54 / 96;

export type Unit = 'mm' | 'px' | 'pt' | 'in' | 'cm';

export function pxToMm(px: number): number {
  return Number((px * PX_TO_MM).toFixed(2));
}

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function pxToPt(px: number): number {
  return Number((px * PX_TO_PT).toFixed(2));
}

export function ptToPx(pt: number): number {
  return pt * PT_TO_PX;
}

export function pxToIn(px: number): number {
  return Number((px * PX_TO_IN).toFixed(2));
}

export function inToPx(inch: number): number {
  return inch * IN_TO_PX;
}

export function pxToCm(px: number): number {
  return Number((px * PX_TO_CM).toFixed(2));
}

export function cmToPx(cm: number): number {
  return cm * CM_TO_PX;
}

export function pxToUnit(px: number, unit: Unit): number {
  if (unit === 'mm') return pxToMm(px);
  if (unit === 'pt') return pxToPt(px);
  if (unit === 'in') return pxToIn(px);
  if (unit === 'cm') return pxToCm(px);
  return Math.round(px);
}

export function unitToPx(value: number, unit: Unit): number {
  if (unit === 'mm') return mmToPx(value);
  if (unit === 'pt') return ptToPx(value);
  if (unit === 'in') return inToPx(value);
  if (unit === 'cm') return cmToPx(value);
  return Math.round(value);
}
