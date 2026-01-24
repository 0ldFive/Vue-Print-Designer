export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum ElementType {
  TEXT = 'text',
  IMAGE = 'image',
  TABLE = 'table'
}

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  border?: string;
  borderStyle?: string;
  padding?: number;
  zIndex?: number;
  // Table specific
  borderColor?: string;
  borderWidth?: number;
  rowHeight?: number; // Table row height
  headerHeight?: number; // Table header height
}

export interface TableColumn {
  field: string;
  header: string;
  width: number;
}

export interface PrintElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string; // For text/image url
  data?: any[]; // For table
  columns?: TableColumn[]; // For table
  style: ElementStyle;
}

export interface Page {
  id: string;
  elements: PrintElement[];
}

export interface DesignerState {
  pages: Page[];
  currentPageIndex: number;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedGuideId: string | null;
  canvasSize: Size; // A4 usually
  zoom: number;
  isDragging: boolean;
  showGrid: boolean;
  guides: Guide[];
  historyPast: Page[][];
  historyFuture: Page[][];
}

export interface Guide {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number; // pixel position
}

// Dynamic properties schema for element-specific fields
export interface PropertyField {
  label: string;
  type: 'number' | 'text' | 'textarea' | 'color' | 'action';
  target: 'element' | 'style' | 'data';
  key?: string; // required for non-action fields
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  actionName?: string; // required for action fields
}

export interface PropertySection {
  title: string;
  fields: PropertyField[];
}

export interface ElementPropertiesSchema {
  sections: PropertySection[];
}
