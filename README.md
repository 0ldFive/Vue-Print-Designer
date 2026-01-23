# Vue Print Designer

A powerful drag-and-drop print designer built with Vue 3, Tailwind CSS, and TypeScript.

## Features

- **Drag and Drop Interface**: Easily add Text, Images, and Tables to the canvas.
- **Smart Table Pagination**: Automatically splits long tables across multiple pages while repeating headers.
- **Multi-page Support**: Create multi-page print layouts.
- **PDF Export**: Export your design to PDF or print directly.
- **Zoom & Grid**: Precision editing with zoom controls and background grid.
- **Customizable Properties**: Edit element styles, positions, and content.

## Project Setup

```bash
npm install
npm run dev
```

## How to Use

1.  **Add Elements**: Drag elements from the left sidebar to the canvas.
2.  **Edit Properties**: Click on an element to select it. Use the right panel to edit properties.
3.  **Table Pagination**:
    - Add a Table element.
    - Select the table.
    - In the Properties panel, you can edit the data (JSON format).
    - Click "Auto Paginate" to automatically split the table across pages if it exceeds the page height.
    - Ensure you set appropriate "Row Height" and "Header Height" for accurate calculation.
4.  **Export**: Click "Export PDF" in the header to save your design.

## Architecture

- **Store**: `useDesignerStore` (Pinia) manages the state of pages and elements.
- **Components**:
    - `PrintDesigner.vue`: Main container.
    - `Canvas.vue`: The drawing area.
    - `ElementWrapper.vue`: Handles selection, dragging, and resizing.
    - `PropertiesPanel.vue`: Edit element attributes.
    - `Sidebar.vue`: Draggable tool palette.

## Dependencies

- Vue 3
- Pinia
- Tailwind CSS
- html2canvas
- jspdf
- lucide-vue-next
- uuid
- lodash

## License

MIT
