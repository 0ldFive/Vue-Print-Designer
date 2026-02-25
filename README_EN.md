<p align="center">
    <img src="./src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
    <a href="./README.md">中文</a> | English
</p>

Vue Print Designer is a visual print designer for business forms, labels, receipts, and waybills. It supports templating and variables, provides silent printing and cloud printing, and works with multiple export/print pipelines.

## What Problems We Solve

- The design and print pipeline is fragmented, templates are hard to reuse, and a field change can require a lot of code updates
- Complex pagination (especially tables) needs a lot of handwritten logic
- Integration with printing plugins is costly, APIs are inconsistent, and cross-framework compatibility is weak

## Why It Is Better Than Typical Plugins

Many plugins are either framework-locked or only provide basic export/print. Our strengths:

- **Complete Designer**: elements, properties, pagination, preview, and template management
- **Extensible**: templates and custom elements can be stored locally or via your API
- **Cross-Framework**: Web Components works with Vue/React/Angular/Vanilla
- **Production Ready**: PDF/image/blob export, print parameters, silent printing, connection settings
- **Maintainable**: clean structure for customization and business-specific extensions

## Highlights

- Drag-and-drop editing with text, images, barcodes, QR codes, tables, and shapes
- Automatic table pagination with header/footer repeat
- Multi-page layout, grid/ruler, zoom, and alignment tools
- Export PDF/image/blob, including merge/split
- Print parameters: printer, copies, page range, duplex, paper size
- **Silent printing**: local client direct print without user confirmation
- **Cloud printing**: remote clients and cloud-delivered print tasks

## UI Preview

|  |  |
| --- | --- |
| **Designer main view and canvas**<br>![Designer main view](docs/images/1.png) | **Print preview**<br>![Print preview](docs/images/2.png) |
| **Print parameter settings**<br>![Print parameters](docs/images/3.png) | **System settings and preferences**<br>![System settings](docs/images/4.png) |
| **Shortcut reference**<br>![Shortcuts](docs/images/5.png) | **Advanced table editing**<br>![Advanced table](docs/images/6.png) |

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

Custom element extension guide: [docs/en/guide/custom-element.md](docs/en/guide/custom-element.md)

### Option B: npm Package (Web Components)

Works with any stack (Vue/React/Angular/Vanilla). Web Components **supports Vue 2** as a custom element, no Vue 2 component adapter required.

Parameters, CRUD, and JSON examples: [docs/en/guide/web-components-guide.md](docs/en/guide/web-components-guide.md)

```bash
npm i vue-print-designer
```

#### 1) Use the component (Vue 3 / Vite)

Import in the entry file:

```ts
// main.ts
import '@your-scope/print-designer';
import '@your-scope/print-designer/style.css';
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

Apache-2.0

Please follow [TRADEMARKS.md](TRADEMARKS.md) for brand and logo usage. For removing or replacing branding, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).
