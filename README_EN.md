<p align="center">
  <img src="./src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
  <a href="./README.md">中文</a> | English
</p>

Vue Print Designer is a visual print template designer for forms, labels, receipts, and waybills. It supports templating and variables, with silent printing and cloud printing capabilities, plus flexible export/print pipelines.

## What Problems We Solve

- Design and printing are usually split across systems, making templates hard to reuse
- Complex pagination (especially tables) often requires large amounts of custom logic
- Integration cost is high and compatibility across frameworks is weak

## Why It Beats Typical Plugins

Many plugins are either framework-locked or only provide a basic export button. Our strengths:

- **Full Designer**: elements, properties, pagination, preview, and template management
- **Extensible**: templates and custom elements can be persisted locally or via your API
- **Cross-Framework**: Web Components works in Vue/React/Angular/Vanilla
- **Production Ready**: PDF/image/blob export, print parameters, silent print, connection settings
- **Maintainable**: clean structure for deep customization

## Highlights

- Drag-and-drop editing with text, images, barcodes, QR codes, tables, and shapes
- Automatic table pagination with header/footer repeat
- Multi-page layout, grid/ruler, zoom and alignment tools
- Export PDF/images/blob, merged or split
- Print parameters: printer, copies, range, duplex, paper size
- **Silent printing**: local client direct print without user confirmation
- **Cloud printing**: remote clients with cloud-delivered print tasks
- Template and custom element CRUD
- Web Component instance methods and event hooks

## UI Preview

|  |  |
| --- | --- |
| **Designer main view and canvas**<br>![Designer main view](docs/images/1.png) | **Print preview**<br>![Print preview](docs/images/2.png) |
| **Print parameter settings**<br>![Print parameters](docs/images/3.png) | **System settings and preferences**<br>![System settings](docs/images/4.png) |
| **Shortcut reference**<br>![Shortcuts](docs/images/5.png) | **Advanced table editing**<br>![Advanced table](docs/images/6.png) |

## Option A: Build from Source and Integrate Your API

Best for deep customization.

```bash
npm install
npm run dev
```

Recommended integration points:

- Template CRUD: `useTemplateStore`
- Custom elements: `useDesignerStore.customElements`
- Variables/template data: `setVariables` / `loadTemplateData`

Custom element extension guide: [docs/en/guide/custom-element.md](docs/en/guide/custom-element.md)

Build:

```bash
npm run build
```

## Option B: npm Package (Web Components)

Works with any stack.

Note: Web Components **supports Vue 2** as a custom element, no Vue 2 component adapter required.

Parameters, CRUD, and JSON examples: [docs/en/guide/web-components-guide.md](docs/en/guide/web-components-guide.md)

```bash
npm install @your-scope/print-designer
```

### 1) Use the component

```html
<link rel="stylesheet" href="node_modules/@your-scope/print-designer/dist/print-designer.css" />
<script type="module" src="node_modules/@your-scope/print-designer/dist/print-designer.es.js"></script>

<print-designer id="designer"></print-designer>
```

### 2) Call instance methods

```ts
const el = document.querySelector('print-designer');

await el.print({ mode: 'browser' });
const blob = await el.export({ type: 'pdfBlob' });

const templates = el.getTemplates({ includeData: false });
el.upsertTemplate({ name: 'A4 Template', data: { pages: [] } }, { setCurrent: true });

el.setBranding({ title: 'Business Print Designer', showLogo: true });
el.setTheme('light');
el.setVariables({ orderNo: 'A001' }, { merge: true });
```

### 3) Event hooks

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

## Build Web Components Bundle

```bash
npm run build:wc
```

Artifacts:

- `dist/print-designer.es.js`
- `dist/print-designer.umd.js`
- `dist/print-designer.css`
- `dist/web-component.d.ts`

## License

Apache-2.0
