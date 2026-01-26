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
  TABLE = 'table',
  PAGE_NUMBER = 'pageNumber'
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
  rotate?: number; // Rotation in degrees
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
  variable?: string;
  data?: any[]; // For table
  columns?: TableColumn[]; // For table
  style: ElementStyle;
  // Pager-specific (optional)
  labelText?: string;
  labelPosition?: 'before' | 'after';
  labelFontSize?: number;
  labelColor?: string;
  labelFontFamily?: string;
  labelFontWeight?: string;
  labelBackgroundColor?: string;
  labelBorder?: string;
  // Pager frame border composed controls
  frameBorderStyle?: 'solid' | 'dashed' | 'dotted';
  frameBorderWidth?: number;
  frameBorderColor?: string;
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
  highlightedGuideId: string | null;
  highlightedEdge: 'left' | 'top' | 'right' | 'bottom' | null;
  canvasSize: Size; // A4 usually
  zoom: number;
  isDragging: boolean;
  showGrid: boolean;
  showCornerMarkers: boolean;
  headerHeight: number;
  footerHeight: number;
  showHeaderLine: boolean;
  showFooterLine: boolean;
  showMinimap: boolean;
  canvasBackground: string;
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
export interface PropertyFieldOption {
  label: string;
  value: string | number;
}

export interface PropertyField {
  label: string;
  type: 'number' | 'text' | 'textarea' | 'color' | 'action' | 'select';
  target: 'element' | 'style' | 'data';
  key?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  actionName?: string;
  options?: PropertyFieldOption[];
}

export interface PropertySection {
  title: string;
  fields: PropertyField[];
}

export interface ElementPropertiesSchema {
  sections: PropertySection[];
}
