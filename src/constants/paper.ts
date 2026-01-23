export const PAPER_SIZES = {
  A3: { width: 1123, height: 1587 }, // 297mm x 420mm
  A4: { width: 794, height: 1123 },  // 210mm x 297mm
  A5: { width: 559, height: 794 },   // 148mm x 210mm
  LETTER: { width: 816, height: 1056 }, // 8.5in x 11in
  LEGAL: { width: 816, height: 1344 },  // 8.5in x 14in
  
  // Receipt / Thermal Printer Sizes
  'Receipt 58mm': { width: 219, height: 794 }, // 58mm width, default height A5 length
  'Receipt 80mm': { width: 302, height: 794 }, // 80mm width, default height A5 length
  
  // Dot Matrix / Continuous Paper Sizes (241mm / 9.5inch width)
  '241-1 (Full)': { width: 911, height: 1058 }, // 241mm x 280mm
  '241-2 (Half)': { width: 911, height: 529 },  // 241mm x 140mm
  '241-3 (Third)': { width: 911, height: 352 }, // 241mm x 93.1mm
};

export type PaperSizeKey = keyof typeof PAPER_SIZES | 'CUSTOM';
