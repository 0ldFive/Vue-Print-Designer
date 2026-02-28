<p align="center">
    <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
    <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/README.md">中文</a> | English
</p>

Vue Print Designer is a visual print designer for business forms, labels, receipts, and waybills. It supports templating and variables, provides silent printing and cloud printing, and works with multiple export/print pipelines.

<h2>LIVE DEMO: <a href="https://0ldfive.github.io/Vue-Print-Designer/" target="_blank" rel="noopener noreferrer">https://0ldfive.github.io/Vue-Print-Designer/</a></h2>

## UI Preview

| Interface View | Interface View |
| --- | --- |
| **Designer main view and canvas**<br>![Designer main view](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/1.png) | **Print preview**<br>![Print preview](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2.png) |
| **Print parameter settings**<br>![Print parameters](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/3.png) | **System settings and preferences**<br>![System settings](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/4.png) |
| **Shortcut reference**<br>![Shortcuts](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/5.png) | **Advanced table editing**<br>![Advanced table](https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/6.png) |

## Core Features & Advantages

Most printing plugins are either **framework-locked** or **limited to basic printing**. We focus on solving **complex pagination** and **high integration costs**, providing an enterprise-grade solution:

- **Out of the Box**: Unlike manual pagination logic, includes a complete drag-and-drop designer and preview engine, automatically handling table pagination and headers.
- **Cross-Framework**: No framework lock-in. Built on Web Components, compatible with Vue/React/Angular/Pure HTML and any other stack.
- **Production Ready**: More than just printing. Full support for silent printing, cloud printing, PDF/Image export, and detailed parameter control.
- **Flexible Extension**: Supports custom elements and API integration for deep business customization.

## Highlights

- Drag-and-drop editing with text, images, barcodes, QR codes, tables, and shapes
- Automatic table pagination with header/footer repeat
- Multi-page layout, grid/ruler, zoom, and alignment tools
- Export PDF/image/blob, including merge/split
- Print parameters: printer, copies, page range, duplex, paper size
- **Silent printing**: local client direct print without user confirmation
- **Cloud printing**: remote clients and cloud-delivered print tasks

## Companion Print Client (PrintDot Client)

PrintDot Client is the companion desktop print helper (Wails + Vue) for device discovery, connection management, and job forwarding. It is designed to keep the local print pipeline stable and easy to operate when used with this project.

- Platforms: Windows / macOS / Linux
- Key capabilities: device discovery, stable connection & forwarding queue, lightweight background mode
- Project: https://github.com/0ldFive/PrintDot-Client

| Main Interface | Preferences |
| --- | --- |
| **Main view - device status & connection**<br><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/7.png" alt="PrintDot main view" width="280" /> | **Settings - preferences & options**<br><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/8.png" alt="PrintDot settings" width="280" /> |

<p>
    <a href="https://github.com/0ldFive/PrintDot-Client/releases" target="_blank" rel="noopener noreferrer">⬇ Download PrintDot Client</a>
</p>

## Quick Start

### Requirements

- Node.js >= 16.0.0
- npm >= 7.0.0 or yarn / pnpm

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

Open the local dev server to use the designer.

### Production Build

```bash
npm run build
```

### Build Web Components Bundle

```bash
npm run build:wc
```

Artifacts:

- `dist/print-designer.es.js`
- `dist/print-designer.umd.js`
- `dist/print-designer.css`
- `dist/web-component.d.ts`

## Integration

### Option A: Build from Source and Integrate Your API

Best for deep customization.

Recommended integration points:

- Template CRUD: `useTemplateStore` (replace with your API)
- Custom elements CRUD: `customElements` in `useDesignerStore`
- Variables and template data: instance methods `setVariables` / `loadTemplateData`

Custom element extension guide: [docs/en/guide/custom-element.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/docs/en/guide/custom-element.md)

### Option B: npm Package (Web Components)

Works with any stack (Vue/React/Angular/Vanilla). Web Components **supports Vue 2** as a custom element, no Vue 2 component adapter required.

Parameters, CRUD, and JSON examples: [docs/en/guide/web-components-guide.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/docs/en/guide/web-components-guide.md)

```bash
npm i vue-print-designer
```

#### 1) Use the component (Vue 3 / Vite)

Import in the entry file:

```ts
// main.ts
import 'vue-print-designer';
import 'vue-print-designer/style.css';
```

Use the custom element in your template:

```vue
<template>
    <print-designer id="designer"></print-designer>
</template>
```

#### 2) Vue 3 Options API: Separate init from usage

**Designer page (init and editing)**

```vue
<script lang="ts">
export default {
    mounted() {
        const el = this.$refs.designerRef as any;
        // Initialize branding and theme
        el.setBranding({ title: 'Business Print Designer', showLogo: true });
        el.setTheme('light');
        // Initialize templates or variables
        el.loadTemplateData(/* data from your API */);
        el.setVariables({ orderNo: 'A001' }, { merge: true });
    }
};
</script>

<template>
    <print-designer ref="designerRef"></print-designer>
</template>
```

**Business pages (print/export anywhere)**

```ts
const el = document.querySelector('print-designer') as any;

// Print
await el.print({ mode: 'browser' });

// Export PDF / image / blob
await el.export({ type: 'pdf', filename: 'order-20240223.pdf' });
const pdfBlob = await el.export({ type: 'pdfBlob' });
```

#### 3) Event hooks

```ts
el.addEventListener('ready', () => {});
el.addEventListener('printed', (e) => {});
el.addEventListener('exported', (e) => {
    const blob = e.detail?.blob;
});
el.addEventListener('error', (e) => {
    console.error(e.detail?.scope, e.detail?.error);
});
```

## Project Structure

```
src/
├── assets/               # Static assets (logo, icons)
├── components/           # Vue components
│   ├── canvas/           # Canvas components
│   ├── common/           # Common components (color picker, modals)
│   ├── elements/         # Print elements (text, image, table, barcode)
│   ├── layout/           # Layout (header, sidebar, properties)
│   ├── print/            # Print renderer
│   └── properties/       # Property panels
├── composables/          # Vue composables
│   ├── useAutoSave.ts    # Auto save
│   ├── usePrintSettings.ts # Print settings
│   └── useTheme.ts       # Theme management
├── constants/            # Constants
├── locales/              # i18n
├── stores/               # Pinia stores
├── types/                # TypeScript types
├── utils/                # Utilities
├── web-component.ts      # Web Components entry
└── main.ts               # App entry
```

## i18n

Built-in Chinese (zh) and English (en). The default follows browser language and can be switched by API.

## License

AGPL-3.0-only

Please follow [TRADEMARKS.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/TRADEMARKS.md) for brand and logo usage. For removing or replacing branding, see [COMMERCIAL_LICENSE.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/COMMERCIAL_LICENSE.md).
