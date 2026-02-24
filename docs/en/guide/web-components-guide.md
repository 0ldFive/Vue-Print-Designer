# Web Components API Guide

## Contents

- Quick Start
- Instance Methods and Parameters
- Events
- Print and Export Parameters
- Common Scenarios
- Notes

## Quick Start

Install:

```bash
npm install @your-scope/print-designer
```

Import in your entry file:

```ts
// main.ts
import '@your-scope/print-designer'
import '@your-scope/print-designer/style.css'
```

Use the custom element:

```html
<print-designer id="designer"></print-designer>
```

## Instance Methods and Parameters

All methods are exposed on the `print-designer` element instance.

### Initialization (Recommended)

If you want UI save actions to go to your cloud API, **you must configure endpoints and switch mode on initialization**:

```ts
const el = document.querySelector('print-designer') as any

// 1) Configure endpoints
el.setCrudEndpoints({
  templates: {
    list: '/api/print/templates',
    get: '/api/print/templates/{id}',
    upsert: '/api/print/templates',
    delete: '/api/print/templates/{id}'
  },
  customElements: {
    list: '/api/print/custom-elements',
    get: '/api/print/custom-elements/{id}',
    upsert: '/api/print/custom-elements',
    delete: '/api/print/custom-elements/{id}'
  }
}, { baseUrl: 'https://your-domain.com', headers: { Authorization: 'Bearer xxx' } })

// 2) Switch to remote mode
el.setCrudMode('remote')
```

Notes:

- `setCrudEndpoints` configures API URLs and headers
- `setCrudMode('remote')` makes UI save/delete/load call remote APIs
- Without these steps, local storage is used

### Initialization Parameters (Suggested)

The component does not require a dedicated `init` method. Configure the following as needed:

**1) Branding and Theme**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `setBranding` | `title` | `string` | No | Title text |
| `setBranding` | `logoUrl` | `string` | No | Logo URL |
| `setBranding` | `showTitle` | `boolean` | No | Show title |
| `setBranding` | `showLogo` | `boolean` | No | Show logo |
| `setBrandVars` | `vars` | `Record<string, string>` | Yes | Theme CSS variables |
| `setBrandVars` | `options.persist` | `boolean` | No | Persist to local storage |
| `setTheme` | `theme` | `'light' \| 'dark' \| 'system'` | Yes | Theme mode |

**2) Templates and Variables**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `loadTemplateData` | `data` | `TemplateData` | Yes | Template data (see JSON examples) |
| `setVariables` | `vars` | `Record<string, any>` | Yes | Variable map |
| `setVariables` | `options.merge` | `boolean` | No | Merge or overwrite |

**3) Print and Export Defaults**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `setPrintDefaults` | `printMode` | `'browser' \| 'local' \| 'remote'` | No | Default print mode |
| `setPrintDefaults` | `silentPrint` | `boolean` | No | Silent printing |
| `setPrintDefaults` | `exportImageMerged` | `boolean` | No | Merge images |
| `setPrintDefaults` | `localSettings.wsAddress` | `string` | No | Local WS address |
| `setPrintDefaults` | `localSettings.secretKey` | `string` | No | Local secret key |
| `setPrintDefaults` | `remoteSettings.wsAddress` | `string` | No | Remote WS address |
| `setPrintDefaults` | `remoteSettings.apiBaseUrl` | `string` | No | Remote login API |
| `setPrintDefaults` | `remoteSettings.username` | `string` | No | Remote username |
| `setPrintDefaults` | `remoteSettings.password` | `string` | No | Remote password |
| `setPrintDefaults` | `localPrintOptions` | `PrintOptions` | No | Local print options |
| `setPrintDefaults` | `remotePrintOptions` | `PrintOptions` | No | Remote print options |

**4) Remote CRUD (Optional)**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `setCrudEndpoints` | `endpoints` | `CrudEndpoints` | Yes | CRUD endpoints |
| `setCrudEndpoints` | `options.baseUrl` | `string` | No | Base URL |
| `setCrudEndpoints` | `options.headers` | `Record<string, string>` | No | Request headers |
| `setCrudMode` | `mode` | `'local' \| 'remote'` | Yes | CRUD mode |

### 1) print(request?)

Description: trigger printing. If `mode` is omitted, default mode is used.

```ts
await el.print({
  mode: 'browser',
  options: {
    printer: 'HP LaserJet',
    copies: 2,
    pageRange: '1-2',
    orientation: 'portrait'
  }
})
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'browser' \| 'local' \| 'remote'` | No | Print mode |
| `options` | `PrintOptions` | No | Print options (see PrintOptions) |

### 2) export(request)

Description: export PDF/images or return Blob.

```ts
await el.export({ type: 'pdf', filename: 'order.pdf' })
await el.export({ type: 'images', filenamePrefix: 'order' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
const imageBlob = await el.export({ type: 'imageBlob' })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'pdf' \| 'images' \| 'pdfBlob' \| 'imageBlob'` | Yes | Export type |
| `filename` | `string` | No | PDF filename |
| `filenamePrefix` | `string` | No | Image filename prefix |
| `merged` | `boolean` | No | Merge images or not |

### 3) setPrintDefaults(payload?)

Description: set default print mode, connection settings, and print options.

```ts
el.setPrintDefaults({
  printMode: 'local',
  silentPrint: true,
  exportImageMerged: true,
  localSettings: { wsAddress: 'ws://localhost:1122/ws', secretKey: 'xxx' },
  remoteSettings: { wsAddress: 'ws://localhost:8080/ws/request', apiBaseUrl: 'http://localhost:8080/api/login', username: 'u', password: 'p' },
  localPrintOptions: { printer: 'HP LaserJet' },
  remotePrintOptions: { printer: 'Cloud Printer' }
})
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `printMode` | `'browser' \| 'local' \| 'remote'` | No | Default print mode |
| `silentPrint` | `boolean` | No | Silent print |
| `exportImageMerged` | `boolean` | No | Merge images on export |
| `localSettings.wsAddress` | `string` | No | Local WS address |
| `localSettings.secretKey` | `string` | No | Local secret key |
| `remoteSettings.wsAddress` | `string` | No | Remote WS address |
| `remoteSettings.apiBaseUrl` | `string` | No | Remote login API |
| `remoteSettings.username` | `string` | No | Remote username |
| `remoteSettings.password` | `string` | No | Remote password |
| `localPrintOptions` | `PrintOptions` | No | Local print options |
| `remotePrintOptions` | `PrintOptions` | No | Remote print options |

### 4) setBranding(payload?)

Description: set title, logo, and visibility.

```ts
el.setBranding({
  title: 'Business Print Designer',
  logoUrl: 'https://example.com/logo.png',
  showTitle: true,
  showLogo: true
})
```

### 5) setBrandVars(vars, options?)

Description: set brand CSS variables.

```ts
el.setBrandVars({
  '--brand-600': '#1d4ed8',
  '--brand-500': '#3b82f6'
}, { persist: true })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `vars` | `Record<string, string>` | Yes | CSS variables |
| `options.persist` | `boolean` | No | Persist to local storage |

### 6) setTheme(theme)

Description: switch theme.

```ts
el.setTheme('light')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | Yes | Theme mode |

### 7) setVariables(vars, options?) / getVariables()

Description: set or get variable data.

```ts
el.setVariables({ orderNo: 'A001' }, { merge: true })
const vars = el.getVariables()
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `vars` | `Record<string, any>` | Yes | Variables map |
| `options.merge` | `boolean` | No | Merge or overwrite |

### 8) getTemplateData() / loadTemplateData(data)

Description: read/write current template data.

```ts
const data = el.getTemplateData()
el.loadTemplateData(data)
```

### 9) Templates CRUD

```ts
const list = el.getTemplates({ includeData: false })
const detail = el.getTemplate('template-id')

const id = el.upsertTemplate({ name: 'A4 Template', data: { pages: [] } }, { setCurrent: true })
el.setTemplates([{ id: 't1', name: 'T1', data: {} }])
el.deleteTemplate(id)
el.loadTemplate(id)
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `getTemplates.includeData` | `boolean` | No | Include full template data |
| `upsertTemplate.setCurrent` | `boolean` | No | Set as current template |
| `setTemplates.currentTemplateId` | `string` | No | Current template ID |

### 10) Custom Elements CRUD

```ts
const list = el.getCustomElements({ includeElement: false })
const id = el.upsertCustomElement({ name: 'Barcode', element: { /* element data */ } })

el.setCustomElements([{ id: 'c1', name: 'C1', element: { /* element data */ } }])
el.deleteCustomElement(id)
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `getCustomElements.includeElement` | `boolean` | No | Include element details |

### 11) setCrudMode(mode)

Description: switch CRUD mode.

```ts
el.setCrudMode('local')
el.setCrudMode('remote')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'local' \| 'remote'` | Yes | CRUD mode |

### 12) setCrudEndpoints(endpoints, options?)

Description: configure CRUD endpoints and headers.

```ts
el.setCrudEndpoints({
  templates: {
    list: '/api/print/templates',
    get: '/api/print/templates/{id}',
    upsert: '/api/print/templates',
    delete: '/api/print/templates/{id}'
  },
  customElements: {
    list: '/api/print/custom-elements',
    get: '/api/print/custom-elements/{id}',
    upsert: '/api/print/custom-elements',
    delete: '/api/print/custom-elements/{id}'
  }
}, { baseUrl: 'https://your-domain.com', headers: { Authorization: 'Bearer xxx' } })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `endpoints.baseUrl` | `string` | No | Base URL |
| `endpoints.templates.list` | `string` | No | Template list endpoint |
| `endpoints.templates.get` | `string` | No | Template detail endpoint (`{id}` placeholder) |
| `endpoints.templates.upsert` | `string` | No | Template upsert endpoint |
| `endpoints.templates.delete` | `string` | No | Template delete endpoint (`{id}` placeholder) |
| `endpoints.customElements.list` | `string` | No | Custom element list endpoint |
| `endpoints.customElements.get` | `string` | No | Custom element detail endpoint (`{id}` placeholder) |
| `endpoints.customElements.upsert` | `string` | No | Custom element upsert endpoint |
| `endpoints.customElements.delete` | `string` | No | Custom element delete endpoint (`{id}` placeholder) |
| `options.baseUrl` | `string` | No | Base URL (same as `endpoints.baseUrl`) |
| `options.headers` | `Record<string, string>` | No | Request headers (auth, etc) |

## Events

```ts
el.addEventListener('ready', () => {})
el.addEventListener('print', (e) => {})
el.addEventListener('printed', (e) => {})
el.addEventListener('export', (e) => {})
el.addEventListener('exported', (e) => {
  const blob = e.detail?.blob
})
el.addEventListener('error', (e) => {
  console.error(e.detail?.scope, e.detail?.error)
})
```

Event details:

| Event | Description | detail |
| --- | --- | --- |
| `ready` | Component ready | None |
| `print` | Printing started | `{ request }` |
| `printed` | Printing finished | `{ request }` |
| `export` | Export started | `{ request }` |
| `exported` | Export finished | `{ request, blob? }` |
| `error` | Print/export failed | `{ scope, error }` |

## PrintOptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `printer` | `string` | Yes | Printer name |
| `jobName` | `string` | No | Job name |
| `copies` | `number` | No | Copies |
| `intervalMs` | `number` | No | Interval (ms) |
| `pageRange` | `string` | No | Page range (e.g. `1-2,5`) |
| `pageSet` | `'' \| 'odd' \| 'even'` | No | Odd/even pages |
| `scale` | `'' \| 'noscale' \| 'shrink' \| 'fit'` | No | Scale mode |
| `orientation` | `'' \| 'portrait' \| 'landscape'` | No | Orientation |
| `colorMode` | `'' \| 'color' \| 'monochrome'` | No | Color mode |
| `sidesMode` | `'' \| 'simplex' \| 'duplex' \| 'duplexshort' \| 'duplexlong'` | No | Duplex mode |
| `paperSize` | `string` | No | Paper size |
| `trayBin` | `string` | No | Tray/bin |

## Common Scenarios

**Designer initialization**

```ts
const el = document.querySelector('print-designer') as any
el.loadTemplateData(/* API data */)
el.setVariables({ orderNo: 'A001' }, { merge: true })
```

**Business page print/export**

```ts
const el = document.querySelector('print-designer') as any
await el.print({ mode: 'browser' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
```

## Backend API Examples

**1) List templates**

`GET /api/print/templates`

Response:

```json
[
  { "id": "tpl_1", "name": "A4 Template", "updatedAt": 1700000000000 }
]
```

**2) Get template**

`GET /api/print/templates/{id}`

Response:

```json
{
  "id": "tpl_1",
  "name": "A4 Template",
  "data": { "pages": [], "canvasSize": { "width": 794, "height": 1123 } },
  "updatedAt": 1700000000000
}
```

**3) Save template**

`POST /api/print/templates`

Request:

```json
{
  "id": "tpl_1",
  "name": "A4 Template",
  "data": { "pages": [], "canvasSize": { "width": 794, "height": 1123 } }
}
```

**4) List custom elements**

`GET /api/print/custom-elements`

Response:

```json
[
  { "id": "ce_1", "name": "Barcode Element" }
]
```

**5) Save custom element**

`POST /api/print/custom-elements`

Request:

```json
{
  "id": "ce_1",
  "name": "Barcode Element",
  "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } }
}
```

## Template and Custom Element JSON Examples

**Template Data**

```json
{
  "pages": [
    {
      "id": "page_1",
      "elements": [
        {
          "id": "el_1",
          "type": "text",
          "x": 40,
          "y": 40,
          "width": 200,
          "height": 24,
          "content": "Order No: {#orderNo}",
          "style": { "fontSize": 12, "color": "#111827" }
        }
      ]
    }
  ],
  "canvasSize": { "width": 794, "height": 1123 },
  "pageSpacingX": 32,
  "pageSpacingY": 32,
  "unit": "mm",
  "watermark": { "enabled": false, "text": "", "angle": -30, "color": "#000000", "opacity": 0.1, "size": 24, "density": 160 },
  "testData": { "orderNo": "A001" }
}
```

**Custom Element**

```json
{
  "id": "ce_1",
  "name": "Barcode Element",
  "element": {
    "id": "el_barcode",
    "type": "barcode",
    "x": 20,
    "y": 20,
    "width": 220,
    "height": 80,
    "content": "A001",
    "style": { "fontSize": 12, "barcodeFormat": "CODE128", "showText": true }
  }
}
```

## Notes

- Web Components works with Vue 2, Vue 3, React, Angular, and vanilla.
- Local/cloud printing requires connection configuration.
- If you use Shadow DOM, ensure `print-designer.css` is loaded.
