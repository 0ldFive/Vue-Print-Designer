# Web Components API Guide

## Contents

- [API Index](#api-index)
- [Quick Start](#quick-start)
  - [Vue Integration](#vue-integration)
  - [React Integration](#react-integration)
  - [Native HTML Integration](#native-html-integration)
- [Instance Methods and Parameters](#instance-methods-and-parameters)
  - [Initialization (Recommended)](#initialization-recommended)
  - [Initialization Parameters (Suggested)](#initialization-parameters-suggested)
  - [1. Execute Print (print)](#1-execute-print-print)
  - [2. Export PDF/Images/HTML (export)](#2-export-pdfimageshtml-export)
  - [2.1. Batch Variable Printing (printBatch / exportBatchPdf / getBatchPdfBlob)](#21-batch-variable-printing-printbatch--exportbatchpdf--getbatchpdfblob)
  - [3. Generate and Get HTML Preview Code (getPreviewHtml)](#3-generate-and-get-html-preview-code-getpreviewhtml)
  - [3.1. Send to Local Client Preview (preview)](#31-send-to-local-client-preview-preview)
  - [4. Set Default Print Options (setPrintDefaults)](#4-set-default-print-options-setprintdefaults)
  - [5. Print Quality Settings (getPrintQuality/setPrintQuality)](#5-print-quality-settings-getprintqualitysetprintquality)
  - [6. Get Printers and Clients (fetchLocalPrinters / fetchRemoteClients)](#6-get-printers-and-clients-fetchlocalprinters--fetchremoteclients)
  - [7. Set Branding Info (setBranding)](#7-set-branding-info-setbranding)
  - [8. Set Brand Colors (setBrandVars)](#8-set-brand-colors-setbrandvars)
  - [9. Set Theme (setTheme)](#9-set-theme-settheme)
  - [10. Set Designer Font (setDesignerFont)](#10-set-designer-font-setdesignerfont)
  - [11. Set Font Options (setFontOptions)](#11-set-font-options-setfontoptions)
  - [12. Set and Get Test Data (setTestData / getTestData)](#12-set-and-get-test-data-settestdata--gettestdata)
  - [13. Set and Get Variables (setVariables / getVariables)](#13-set-and-get-variables-setvariables--getvariables)
  - [14. Extract Template Variables (getTemplateVariables)](#14-extract-template-variables-gettemplatevariables)
  - [15. Get and Load Template Data (getTemplateData / loadTemplateData)](#15-get-and-load-template-data-gettemplatedata--loadtemplatedata)
  - [16. Template CRUD Operations](#16-template-crud-operations)
  - [17. Custom Elements CRUD Operations](#17-custom-elements-crud-operations)
  - [18. Set CRUD Mode (setCrudMode)](#18-set-crud-mode-setcrudmode)
  - [19. Configure Cloud CRUD Endpoints (setCrudEndpoints)](#19-configure-cloud-crud-endpoints-setcrudendpoints)
  - [20. Set Language (setLanguage)](#20-set-language-setlanguage)
  - [21. Configure Client and Cloud Print Links (setLinks)](#21-configure-client-and-cloud-print-links-setlinks)
  - [22. Configure Extension Menu (setContextMenu)](#22-configure-extension-menu-setcontextmenu)
  - [23. Configure Template Modal Custom Form (setTemplateModalForm)](#23-configure-template-modal-custom-form-settemplatemodalform)
  - [24. Configure Custom Element Modal Custom Form (setCustomElementModalForm)](#24-configure-custom-element-modal-custom-form-setcustomelementmodalform)
  - [25. Configure Template List Tag Extension (setTemplateTagResolver)](#25-configure-template-list-tag-extension-settemplatetagresolver)
  - [26. Configure AI Built-in Models (setAiModels)](#26-configure-ai-built-in-models-setaimodels)
- [Backend API Specifications](#backend-api-specifications)
  - [Overview](#overview)
  - [Common Fields](#common-fields)
  - [Generic ext Constraints](#generic-ext-constraints)
    - [ext.availableVariables (Template Available Variables)](#extavailablevariables-template-available-variables)
    - [ext.templateModalForm (Modal Form Values)](#exttemplatemodalform-modal-form-values)
    - [ext.templateTags (Template List Tags)](#exttemplatetags-template-list-tags)
    - [ext.<customKey> (Custom Business Fields)](#extcustomkey-custom-business-fields)
    - [ext Merge Rules](#ext-merge-rules)
  - [Template CRUD Constraints](#template-crud-constraints)
    - [1) Endpoint Responsibilities and Call Timing](#1-endpoint-responsibilities-and-call-timing)
    - [2) List Templates](#2-list-templates)
    - [3) Get Template Detail](#3-get-template-detail)
    - [4) Save Template (Create/Update)](#4-save-template-createupdate)
    - [5) Delete Template](#5-delete-template)
  - [Custom Element CRUD Constraints](#custom-element-crud-constraints)
    - [6) List Custom Elements](#6-list-custom-elements)
    - [7) Get Custom Element Detail](#7-get-custom-element-detail)
    - [8) Save Custom Element (Create/Update)](#8-save-custom-element-createupdate)
    - [9) Delete Custom Element](#9-delete-custom-element)
  - [Quick Checklist](#quick-checklist)
- [Events](#events)
- [PrintOptions](#printoptions)
- [Common Scenarios](#common-scenarios)
  - [Scenario 1: Global Initialization (Recommended in Entry File)](#scenario-1-global-initialization-recommended-in-entry-file)
  - [Scenario 2: Designer Page (Creating or Editing Templates)](#scenario-2-designer-page-creating-or-editing-templates)
  - [Scenario 3: Business Page Print / Export (Actual Business Operation)](#scenario-3-business-page-print--export-actual-business-operation)
  - [Scenario 4: Headless Mode Silent Printing](#scenario-4-headless-mode-silent-printing)
- [Template and Custom Element JSON Examples](#template-and-custom-element-json-examples)
- [Notes](#notes)

## API Index

| Method                                | Description                                                  |
| ------------------------------------- | ------------------------------------------------------------ |
| `print(request)`                      | Execute print                                                |
| `export(request)`                     | Export PDF/Images/HTML                                       |
| `getBatchPdfBlob(items, request?)`    | Batch variable printing into one multi-page PDF (returns Blob) |
| `exportBatchPdf(items, request?)`     | Batch variable printing into one multi-page PDF and download |
| `printBatch(items, request?)`         | Batch variable printing into one PDF, printed as a single job |
| `getPreviewHtml(options?)`            | Generate and get HTML preview code                           |
| `preview(request?)`                   | Send content to the local client preview window              |
| `setPrintDefaults(payload)`           | Set default print options                                    |
| `getPrintQuality()`                   | Get current print quality                                    |
| `setPrintQuality(quality)`            | Set print quality                                            |
| `fetchLocalPrinters()`                | Get local printer list                                       |
| `fetchLocalPrinterCaps(printer)`      | Get local printer capabilities                               |
| `fetchRemoteClients()`                | Get remote print client list                                 |
| `fetchRemotePrinters(clientId)`       | Get remote printer list                                      |
| `setBranding(payload)`                | Set branding (Title/Logo)                                    |
| `setBrandVars(vars)`                  | Set brand colors                                             |
| `setTheme(theme)`                     | Set theme (light/dark)                                       |
| `setDesignerFont(fontFamily)`         | Set designer font                                            |
| `setFontOptions(options)`             | Set available font dropdown options                          |
| `setTestData(data)`                   | Set test data                                                |
| `getTestData()`                       | Get test data                                                |
| `setVariables(data)`                  | Set variable data                                            |
| `getVariables()`                      | Get variable data                                            |
| `getTemplateVariables()`              | Extract used variables and generate default data structure   |
| `loadTemplateData(data)`              | Load template data                                           |
| `getTemplateData()`                   | Get current template data                                    |
| `getTemplates()`                      | Get template list                                            |
| `refreshTemplates()`                  | Refresh template list                                        |
| `getTemplate(id)`                     | Get template details                                         |
| `upsertTemplate(template)`            | Create/Update template                                       |
| `setTemplates(templates)`             | Set template list directly                                   |
| `deleteTemplate(id)`                  | Delete template                                              |
| `loadTemplate(id)`                    | Load specific template                                       |
| `getCustomElements()`                 | Get custom element list                                      |
| `refreshCustomElements()`             | Refresh custom element list                                  |
| `getCustomElement(id)`                | Get custom element details                                   |
| `upsertCustomElement(element)`        | Create/Update custom element                                 |
| `setCustomElements(elements)`         | Set custom element list directly                             |
| `deleteCustomElement(id)`             | Delete custom element                                        |
| `setCrudMode(mode)`                   | Set CRUD mode (local/remote)                                 |
| `setCrudEndpoints(endpoints)`         | Set remote API endpoints                                     |
| `setLanguage(lang)`                   | Set language                                                 |
| `setClientLink(url)`                  | Set client download link                                     |
| `setCloudLink(url)`                   | Set cloud print link                                         |
| `hideLinks(hide)`                     | Hide/Show all links                                          |
| `hideClientLink(hide)`                | Hide/Show client download link                               |
| `hideCloudLink(hide)`                 | Hide/Show cloud print link                                   |
| `setTemplateContextMenu(config)`      | Configure template list extension menu                       |
| `clearTemplateContextMenu()`          | Restore default template list extension menu                 |
| `setCustomElementContextMenu(config)` | Configure custom element list extension menu                 |
| `clearCustomElementContextMenu()`     | Restore default custom element list extension menu           |
| `setTemplateModalForm(config)`        | Configure custom forms for create/edit/copy template modals  |
| `clearTemplateModalForm()`            | Clear template modal custom form configuration               |
| `setCustomElementModalForm(config)`   | Configure custom forms for create/edit/copy custom element modals |
| `clearCustomElementModalForm()`       | Clear custom element modal custom form configuration         |
| `setTemplateTagResolver(resolver)`    | Set the template list tag callback (takes priority over `ext.templateTags`) |
| `clearTemplateTagResolver()`          | Clear the tag callback and fall back to `ext.templateTags`   |
| `setAiModels(models, options?)`       | Inject built-in model list (no secrets)                      |
| `setAiEnabled(enabled)`               | Enable/disable the AI assistant                              |
| `isAiEnabled()`                       | Check whether the AI assistant is enabled                    |
| `openAiPanel()`                       | Open the AI assistant panel                                  |
| `getAiConfig(scopeId?)`               | Get AI config (user-defined models only)                     |
| `setAiConfig(config, scopeId?)`       | Update AI config                                             |

## Quick Start

Install:

```bash
npm i vue-print-designer
```

### Vue Integration

Import in your entry file:

```ts
// main.ts
import "vue-print-designer";
import "vue-print-designer/style.css";
```

> **Note for Older Webpack Versions**
> If you are using an older build tool (like Webpack 4 or early vue-cli), it might fail to resolve modules/styles because it doesn't support the `exports` field in `package.json`, or throw errors when compiling dependencies with ES6+ syntax.
>
> **Solution 1: Use Full Path Imports**
>
> ```ts
> import "vue-print-designer/dist/print-designer.es.js";
> import "vue-print-designer/dist/print-designer.css";
> ```
>
> **Solution 2: Configure Babel Transpilation**
> If you encounter syntax errors (like optional chaining `?.`), please add the component to `transpileDependencies` in your `vue.config.js` for Babel transpilation:
>
> ```js
> module.exports = {
>   transpileDependencies: ["vue-print-designer"],
> };
> ```

Use the custom element:

```html
<print-designer id="designer" lang="en"></print-designer>
```

### React Integration

Example (Vite + React):

```tsx
// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "vue-print-designer";
import "vue-print-designer/style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
// App.tsx
import { useEffect, useRef } from "react";

export default function App() {
  const designerRef = useRef<any>(null);

  useEffect(() => {
    designerRef.current?.setLanguage("en");
  }, []);

  return <print-designer ref={designerRef} lang="en"></print-designer>;
}
```

For TypeScript React projects, if you see `Property 'print-designer' does not exist on type 'JSX.IntrinsicElements'`, add a declaration file:

```ts
// src/custom-elements.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    "print-designer": any;
  }
}
```

### Native HTML Integration

Example (no framework):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Print Designer</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/vue-print-designer@latest/dist/print-designer.css"
    />
  </head>
  <body>
    <print-designer id="designer" lang="en"></print-designer>

    <script type="module">
      import "https://unpkg.com/vue-print-designer@latest/dist/print-designer.es.js";

      const designer = document.getElementById("designer");
      designer?.setLanguage("en");
    </script>
  </body>
</html>
```

## Instance Methods and Parameters

All methods are exposed on the `print-designer` element instance.

### Initialization (Recommended)

If you want UI save actions to go to your cloud API, **you must configure endpoints and switch mode on initialization**:

```ts
const el = document.querySelector("print-designer") as any;

// 1) Configure endpoints
el.setCrudEndpoints(
  {
    templates: {
      list: "/api/print/templates",
      get: "/api/print/templates/{id}",
      upsert: "/api/print/templates",
      delete: "/api/print/templates/{id}",
    },
    customElements: {
      list: "/api/print/custom-elements",
      get: "/api/print/custom-elements/{id}",
      upsert: "/api/print/custom-elements",
      delete: "/api/print/custom-elements/{id}",
    },
  },
  {
    baseUrl: "https://your-domain.com",
    headers: { Authorization: "Bearer xxx" },
  },
);

// 2) Switch to remote mode
el.setCrudMode("remote");
```

Notes:

- `setCrudEndpoints` configures API URLs and headers
- `setCrudMode('remote')` makes UI save/delete/load call remote APIs
- Without these steps, local storage is used
- These configuration methods must be called after the component is initialized (the `ready` event has fired); before the DOM element is upgraded to the custom element, the methods do not exist.

### Initialization Parameters (Suggested)

The component does not require a dedicated `init` method. Configure the following as needed:

**1) Branding and Theme**

| Method            | Param             | Type                                 | Required | Description              |
| ----------------- | ----------------- | ------------------------------------ | -------- | ------------------------ |
| `setBranding`     | `title`           | `string`                             | No       | Title text               |
| `setBranding`     | `logoUrl`         | `string`                             | No       | Logo URL                 |
| `setBranding`     | `showTitle`       | `boolean`                            | No       | Show title               |
| `setBranding`     | `showLogo`        | `boolean`                            | No       | Show logo                |
| `setBrandVars`    | `vars`            | `Record<string, string>`             | Yes      | Theme CSS variables      |
| `setBrandVars`    | `options.persist` | `boolean`                            | No       | Persist to local storage |
| `setTheme`        | `theme`           | `string`                             | Yes      | Theme mode. `light` / `dark` take effect; other values follow system |
| `setDesignerFont` | `fontFamily`      | `string`                             | Yes      | Designer font family     |
| `setDesignerFont` | `options.persist` | `boolean`                            | No       | Persist to local storage |
| `setFontOptions`  | `options`         | `{ label: string; value: string }[]` | No       | Flat font option list; omit or pass `[]` to restore the built-in list |
| `setFontOptions`  | `options[].label` | `string`                             | Yes      | Dropdown display label   |
| `setFontOptions`  | `options[].value` | `string`                             | Yes      | CSS font-family value    |

**2) Templates and Variables**

| Method             | Param           | Type                  | Required | Description                       |
| ------------------ | --------------- | --------------------- | -------- | --------------------------------- |
| `loadTemplateData` | `data`          | `TemplateData`        | Yes      | Template data (see JSON examples) |
| `setVariables`     | `vars`          | `Record<string, any>` | Yes      | Variable map                      |
| `setVariables`     | `options.merge` | `boolean`             | No       | Merge or overwrite                |

**3) Print and Export Defaults**

| Method             | Param                       | Type                               | Required | Description          |
| ------------------ | --------------------------- | ---------------------------------- | -------- | -------------------- |
| `setPrintDefaults` | `printMode`                 | `'browser' \| 'local' \| 'remote'` | No       | Default print mode   |
| `setPrintDefaults` | `silentPrint`               | `boolean`                          | No       | Silent printing      |
| `setPrintDefaults` | `exportImageMerged`         | `boolean`                          | No       | Merge images         |
| `setPrintDefaults` | `localSettings.wsAddress`   | `string`                           | No       | Local WS address     |
| `setPrintDefaults` | `localSettings.secretKey`   | `string`                           | No       | Local secret key     |
| `setPrintDefaults` | `remoteSettings.wsAddress`  | `string`                           | No       | Remote WS address    |
| `setPrintDefaults` | `remoteSettings.apiBaseUrl` | `string`                           | No       | Remote login API     |
| `setPrintDefaults` | `remoteSettings.username`   | `string`                           | No       | Remote username      |
| `setPrintDefaults` | `remoteSettings.password`   | `string`                           | No       | Remote password      |
| `setPrintDefaults` | `localPrintOptions`         | `PrintOptions`                     | No       | Local print options  |
| `setPrintDefaults` | `remotePrintOptions`        | `PrintOptions`                     | No       | Remote print options |

**3.1) Printer and Client Queries (Local/Remote)**

| Method                  | Param      | Type     | Required | Description                    |
| ----------------------- | ---------- | -------- | -------- | ------------------------------ |
| `fetchLocalPrinters`    | -          | -        | No       | Get Client Printer list        |
| `fetchLocalPrinterCaps` | `printer`  | `string` | Yes      | Get local printer capabilities |
| `fetchRemoteClients`    | -          | -        | No       | Get remote print client list   |
| `fetchRemotePrinters`   | `clientId` | `string` | No       | Get remote printer list        |

**4) Remote CRUD (Optional)**

| Method             | Param             | Type                     | Required | Description     |
| ------------------ | ----------------- | ------------------------ | -------- | --------------- |
| `setCrudEndpoints` | `endpoints`       | `CrudEndpoints`          | Yes      | CRUD endpoints  |
| `setCrudEndpoints` | `options.baseUrl` | `string`                 | No       | Base URL        |
| `setCrudEndpoints` | `options.headers` | `Record<string, string>` | No       | Request headers |
| `setCrudMode`      | `mode`            | `'local' \| 'remote'`    | Yes      | CRUD mode       |

### 1. Execute Print (print)

Description: Execute the print operation. This method returns a Promise, allowing you to `await` the completion of the print task or catch exceptions. If `mode` is omitted, the default print mode configured in the component will be used. Upon successful printing, the Promise resolves and returns the status object (containing fields like `status`) provided by the underlying client or browser.

```ts
try {
  const result = await el.print({
    mode: "local", // Supports 'browser', 'local', 'remote'
    options: {
      printer: "HP LaserJet",
      copies: 2,
      pageRange: "1-2",
      orientation: "portrait",
    },
    onProgress: (progress) => {
      console.log("Print progress", progress.percent, progress.message);
    },
  });
  console.log("Print task executed successfully! Return status:", result);
} catch (error) {
  console.error("Print failed:", error.message);
}
```

**Parameters:**

| Field     | Type                               | Required | Description                                       |
| --------- | ---------------------------------- | -------- | ------------------------------------------------- |
| `mode`    | `'browser' \| 'local' \| 'remote'` | No       | Print mode. If omitted, the default mode is used. |
| `options` | `PrintOptions`                     | No       | Print options (see "Print Options Detail" below)  |
| `onProgress` | `(progress: DesignerProgressPayload) => void` | No | Progress callback fired when progress changes. |

**Promise Behavior across different `mode`s:**

- **`browser`**: Invokes the browser's native print dialog (e.g., `window.print()`). Due to browser security restrictions, the frontend cannot determine whether the user clicked "Print" or "Cancel", so the Promise usually resolves immediately after the dialog is invoked, returning `{ status: 'success', mode: 'browser' }`.
- **`local`**: Sends the print task to the local print client (e.g., `printdot-client`) via WebSocket. The Promise will **keep waiting** until the local client successfully sends the task to the printer (or the system print queue) and returns a confirmation ACK. It will then resolve and return the ACK message object (e.g. `{ status: 'success', ... }`). If no confirmation is received within the default timeout (30 seconds) or an error occurs, the Promise will be rejected.
- **`remote`**: Submits the print task to a remote cloud print service. The Promise resolves when the `task_result` message arrives from the cloud service, returning that message (including `status`); a cloud-side `status: 'error'` still resolves rather than rejects, and only a WebSocket timeout or connection error rejects.
- **Automatic fallback**: `local` / `remote` are only used when the corresponding connection state is `connected`; when not connected they neither throw nor reject, but fall back to `browser` mode and resolve `{ status: 'success', mode: 'browser' }`.

### 2. Export PDF/Images/HTML (export)

Description: export PDF/images/HTML files, or return a Blob. `pdf` / `images` / `html` trigger a browser download and return `undefined`; `pdfBlob` / `imageBlob` do not download and return a `Blob`.

```ts
await el.export({
  type: "pdf",
  filename: "order.pdf",
  onProgress: (progress) => {
    console.log("Export progress", progress.percent, progress.message);
  },
});
await el.export({ type: "images", filenamePrefix: "order" });
await el.export({ type: "html", filename: "order.html" });
const pdfBlob = await el.export({ type: "pdfBlob" });
const imageBlob = await el.export({ type: "imageBlob" });
```

Parameters:

| Field            | Type                                                      | Required | Description           |
| ---------------- | --------------------------------------------------------- | -------- | --------------------- |
| `type`           | `'pdf' \| 'images' \| 'pdfBlob' \| 'imageBlob' \| 'html'` | Yes      | Export type           |
| `filename`       | `string`                                                  | No       | PDF/HTML filename     |
| `filenamePrefix` | `string`                                                  | No       | Image filename prefix |
| `merged`         | `boolean`                                                 | No       | Merge images or not   |
| `onProgress`     | `(progress: DesignerProgressPayload) => void`            | No       | Progress callback fired when progress changes. |

### 2.1. Batch Variable Printing (printBatch / exportBatchPdf / getBatchPdfBlob)

Description: For "one template + a set of data" batch variable-printing scenarios. Pass an array of data records; the component reuses a single hidden render environment, applies the template to each record in order, and finally **produces one multi-page PDF** (each record maps to its own page(s); no image stitching).

The three methods:

| Method                             | Purpose                                                                                          | Returns                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| `getBatchPdfBlob(items, request?)` | Build the multi-page PDF and return a `Blob` for you to upload/preview/save.                      | `Promise<Blob \| null>` |
| `exportBatchPdf(items, request?)`  | Build the multi-page PDF and trigger a browser download.                                          | `Promise<void>`         |
| `printBatch(items, request?)`      | Build the multi-page PDF, then print it as a **single print job** (browser/local/remote client). | `Promise<any>`          |

```ts
// Each record carries its own variables / testData (example: three product labels)
const items = [
  { variables: { code: 'A001', name: 'Apple', qty: 10 } },
  { variables: { code: 'A002', name: 'Banana', qty: 20 } },
  { variables: { code: 'A003', name: 'Orange', qty: 30 } },
]

// 1) Get the combined single multi-page PDF Blob (upload/preview/save yourself)
const blob = await el.getBatchPdfBlob(items)

// 2) Build and download directly
await el.exportBatchPdf(items, {
  filename: 'labels.pdf',
  onProgress: (p) => console.log('Batch export', p.percent, p.message),
})

// 3) Build, then print as a single job (local client example)
await el.printBatch(items, {
  mode: 'local',
  options: { printer: 'HP LaserJet', copies: 1 },
  onProgress: (p) => console.log('Batch print', p.percent, p.message),
})
```

`items` array item (`DesignerBatchItem`):

| Field       | Type                  | Required | Description                                                                                     |
| ----------- | --------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `variables` | `Record<string, any>` | No       | Variable values for this record (for `@variable` binding), matching export-mode variable data.  |
| `testData`  | `Record<string, any>` | No       | Test data for this record, used as the variable fallback.                                       |

`request` for `getBatchPdfBlob` / `exportBatchPdf` (`DesignerBatchExportRequest`):

| Field        | Type                                          | Required | Description                                                                      |
| ------------ | --------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `filename`   | `string`                                      | No       | Download filename, used by `exportBatchPdf` only; defaults to `print-batch.pdf`. |
| `onProgress` | `(progress: DesignerProgressPayload) => void` | No       | Progress callback fired after each record is rendered.                           |

`request` for `printBatch` (`DesignerBatchPrintRequest`):

| Field        | Type                                          | Required | Description                                       |
| ------------ | --------------------------------------------- | -------- | ------------------------------------------------- |
| `mode`       | `'browser' \| 'local' \| 'remote'`            | No       | Print mode. If omitted, the default mode is used. |
| `options`    | `PrintOptions`                                | No       | Print options (see "Print Options Detail" below). |
| `onProgress` | `(progress: DesignerProgressPayload) => void` | No       | Progress callback fired after each record is rendered. |

Returns: `getBatchPdfBlob` returns `Promise<Blob | null>` (`null` only when the component is not ready; rendering errors reject); `exportBatchPdf` returns `Promise<void>` (triggers a download); `printBatch` returns `Promise<any>` (the underlying print-channel status object; per-`mode` behavior matches `print`).

> Tip: for variables to take effect, the text element in the template must bind a variable (e.g. bind `@code`), not merely contain `@code` in its content.
>
> Events: batch export reuses the `export` / `exported` events, batch print reuses the `print` / `printed` events; errors are emitted via the `error` event with `detail.scope` of `getBatchPdfBlob` / `exportBatchPdf` / `printBatch`.

### 3. Generate and Get HTML Preview Code (getPreviewHtml)

Description: Get the current rendered HTML result string of the designer, which can be used for custom preview or rendering.

```ts
const htmlStr = await el.getPreviewHtml({
  onProgress: (progress) => {
    console.log("Preview progress", progress.percent, progress.message);
  },
});
console.log("Preview HTML:", htmlStr);
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `onProgress` | `(progress: DesignerProgressPayload) => void` | No | Progress callback fired when progress changes. |

Returns: `Promise<string>` containing the styled container `div` with its paginated page nodes (`outerHTML`); it does **not** include an `<html>` / `<head>` wrapper.

Progress payload:

| Field | Type | Description |
| --- | --- | --- |
| `scope` | `'print' \| 'export' \| 'preview'` | API scope for the current operation. |
| `phase` | `string` | Current phase key (e.g. `preview`/`pdf`/`images`/`print`). |
| `current` | `number` | Current progress value. |
| `total` | `number` | Total progress value. |
| `percent` | `number` | Percentage value from 0 to 100. |
| `message` | `string` | Human-readable phase message. |

### 3.1. Send to Local Client Preview (preview)

Description: send preview content to the configured local client through WebSocket and let the client open the system preview window. Use this API when the host application wants to reuse the client-side PDF preview capability instead of hosting the preview window in the browser.

Prerequisite: the local client connection must already be established (`localSettings.wsAddress` / `localSettings.secretKey` configured through `setPrintDefaults`, or configured in the designer settings UI).

```ts
const result = await el.preview({
  mode: "html",
  title: "Order Preview",
  printQuality: "high",
  onProgress: (progress) => {
    console.log("Client preview progress", progress.percent, progress.message);
  },
});

console.log(result.status);
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'pdf' \| 'html' \| 'json'` | No | Preview mode. Defaults to `'pdf'`. |
| `title` | `string` | No | Client preview window title. |
| `key` | `string` | No | Local client secret key for this request. Defaults to `localSettings.secretKey`. |
| `timeoutMs` | `number` | No | Timeout for waiting for the client preview acknowledgment. Defaults to `15000`. |
| `html` | `string` | No | Raw HTML to send when `mode: 'html'`; if omitted, the current designer preview HTML is generated and sent. |
| `json` | `string \| object` | No | Template JSON to send when `mode: 'json'`; if omitted, the current designer template data is sent. |
| `printQuality` | `'fast' \| 'normal' \| 'high' \| 'ultra'` | No | Quality used by the client when rendering HTML/JSON into PDF. If omitted, the current `getPrintQuality()` value is used. |
| `canvasSize` | `{ width: number; height: number }` | No | Page size in px used by the client when rendering HTML/JSON into PDF. If omitted, the current designer `canvasSize` is used. |
| `onProgress` | `(progress: DesignerProgressPayload) => void` | No | Progress callback fired when progress changes. |

Returns: `Promise<{ type: 'preview_result'; status: 'success'; message?: string }>`. It resolves only with `status: 'success'`, meaning the client has accepted the preview request and opened the preview window; a client-side `status: 'error'`, timeout, or connection error rejects the Promise with an error. The actual PDF rendering happens inside the client preview window.

Content flow by `mode`:

| mode | Content sent to the client | Client preview result |
| --- | --- | --- |
| `pdf` | The designer generates a PDF first, then sends a PDF data URL/base64. | Display the PDF directly. |
| `html` | Send pre-paginated HTML, or the HTML passed in `request.html`. | The client renders the HTML into PDF using `printQuality`, then displays the PDF. |
| `json` | Send the current template JSON, or the JSON passed in `request.json`. | The client loads the template JSON and renders it into PDF using `printQuality`, then displays the PDF. |

The preview message sent to the client has the following shape. Client implementations should preserve and use `printQuality` and `canvasSize` in the `preview` pipeline:

```json
{
  "type": "preview",
  "mode": "html",
  "content": "<div>...</div>",
  "title": "Order Preview",
  "printQuality": "high",
  "canvasSize": { "width": 794, "height": 1123 }
}
```

### 4. Set Default Print Options (setPrintDefaults)

Description: set default print mode, connection settings, and print options.

```ts
el.setPrintDefaults({
  printMode: "local",
  silentPrint: true,
  exportImageMerged: true,
  localSettings: { wsAddress: "wss://localhost:1122/ws", secretKey: "xxx" },
  remoteSettings: {
    wsAddress: "wss://localhost:8080/ws/request",
    apiBaseUrl: "http://localhost:8080/api/login",
    username: "u",
    password: "p",
  },
  localPrintOptions: { printer: "HP LaserJet" },
  remotePrintOptions: { printer: "Cloud Printer" },
});
```

Parameters:

| Field                       | Type                               | Required | Description            |
| --------------------------- | ---------------------------------- | -------- | ---------------------- |
| `printMode`                 | `'browser' \| 'local' \| 'remote'` | No       | Default print mode     |
| `silentPrint`               | `boolean`                          | No       | Silent print           |
| `exportImageMerged`         | `boolean`                          | No       | Merge images on export |
| `localSettings.wsAddress`   | `string`                           | No       | Local WS address       |
| `localSettings.secretKey`   | `string`                           | No       | Local secret key       |
| `remoteSettings.wsAddress`  | `string`                           | No       | Remote WS address      |
| `remoteSettings.apiBaseUrl` | `string`                           | No       | Remote login API       |
| `remoteSettings.username`   | `string`                           | No       | Remote username        |
| `remoteSettings.password`   | `string`                           | No       | Remote password        |
| `localPrintOptions`         | `PrintOptions`                     | No       | Local print options    |
| `remotePrintOptions`        | `PrintOptions`                     | No       | Remote print options   |

`silentPrint` only affects `local` / `remote`: when `true`, clicking print sends the task directly; when `false`, a print-options confirmation dialog appears first. `browser` mode is always controlled by the browser's own print dialog and ignores this field.

### 5. Print Quality Settings (getPrintQuality/setPrintQuality)

Description: Get or set the print and export rendering quality.
**Note**: You must call `setPrintQuality` **before** calling `print` or `export` methods for the settings to take effect.

```ts
// Get current print quality
const quality = el.getPrintQuality();

// Set print quality ('fast', 'normal', 'high', 'ultra')
el.setPrintQuality("high");

// Call print or export after setting the quality
await el.export({ type: "pdf" });
```

Parameters:

| Field     | Type                                          | Required | Description                        |
| --------- | --------------------------------------------- | -------- | ---------------------------------- |
| `quality` | `'fast' \| 'normal' \| 'high' \| 'ultra'`     | Yes      | The print quality tier             |

### 6. Get Printers and Clients (fetchLocalPrinters / fetchRemoteClients)

Description: query printers, printer capabilities, and clients for local/remote print modes.

```ts
const localPrinters = await el.fetchLocalPrinters();
const localCaps = await el.fetchLocalPrinterCaps(localPrinters[0]?.name || "");

const clients = await el.fetchRemoteClients();
const remotePrinters = await el.fetchRemotePrinters(clients[0]?.client_id);
```

Parameters:

| Field      | Type     | Required | Description                                      |
| ---------- | -------- | -------- | ------------------------------------------------ |
| `printer`  | `string` | Yes      | Local printer name (for `fetchLocalPrinterCaps`) |
| `clientId` | `string` | No       | Remote client ID (for `fetchRemotePrinters`)     |

### 7. Set Branding Info (setBranding)

Description: set title, logo, and visibility.

```ts
el.setBranding({
  title: "Business Print Designer",
  logoUrl: "https://example.com/logo.png",
  showTitle: true,
  showLogo: true,
});
```

### 8. Set Brand Colors (setBrandVars)

Description: set brand CSS variables.

```ts
el.setBrandVars(
  {
    "--brand-600": "#1d4ed8",
    "--brand-500": "#3b82f6",
  },
  { persist: true },
);
```

Parameters:

| Field             | Type                     | Required | Description              |
| ----------------- | ------------------------ | -------- | ------------------------ |
| `vars`            | `Record<string, string>` | Yes      | CSS variables            |
| `options.persist` | `boolean`                | No       | Persist to local storage |

### 9. Set Theme (setTheme)

Description: switch theme.

```ts
el.setTheme("light");
```

Parameters:

| Field   | Type     | Required | Description |
| ------- | -------- | -------- | ----------- |
| `theme` | `string` | Yes      | Theme mode. `light` / `dark` take effect; any other value is treated as "follow system" and written to local storage |

### 10. Set Designer Font (setDesignerFont)

Description: set designer font family. Pass an empty string to reset to default inherited font.

```ts
el.setDesignerFont('"Microsoft YaHei", "PingFang SC", sans-serif', {
  persist: true,
});
```

Parameters:

| Field             | Type      | Required | Description              |
| ----------------- | --------- | -------- | ------------------------ |
| `fontFamily`      | `string`  | Yes      | Font family string       |
| `options.persist` | `boolean` | No       | Persist to local storage |

### 11. Set Font Options (setFontOptions)

Description: set available font options for the font dropdowns. It applies to the top toolbar, text quick toolbar, and properties panel.

The top toolbar groups built-in default fonts as Common, Chinese Fonts, Western Fonts, and Monospace Fonts. The `setFontOptions` API still accepts a flat `{ label, value }` array; you do not need to pass grouped data. Custom fonts passed through this API are shown under the Custom Fonts group.

If the array contains an entry with `value: ''`, only the "Custom Fonts" group is shown and the built-in groups are hidden; if it does not, the "Custom Fonts" group is appended after the built-in groups.

```ts
el.setFontOptions([
  { label: "Default", value: "" },
  {
    label: "Microsoft YaHei",
    value: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
  { label: "Monospace", value: '"Courier New", Consolas, monospace' },
]);

// Reset to built-in default font options
el.setFontOptions([]);
```

Parameters:

| Field             | Type                                 | Required | Description             |
| ----------------- | ------------------------------------ | -------- | ----------------------- |
| `options`         | `{ label: string; value: string }[]` | No       | Flat font option list; omit or pass `[]` to restore the built-in list |
| `options[].label` | `string`                             | Yes      | Label shown in dropdown |
| `options[].value` | `string`                             | Yes      | CSS `font-family` value |

### 12. Set and Get Test Data (setTestData / getTestData)

Description: set or get the test data for the current template (mainly used for previewing and testing in the designer).

```ts
await el.setTestData({ orderNo: "A001" }, { merge: true });
const testData = el.getTestData();
```

Returns: `setTestData` is `Promise<void>` and resolves after the canvas refresh completes; `getTestData` synchronously returns a copy of the test data.

Parameters:

| Field           | Type                  | Required | Description        |
| --------------- | --------------------- | -------- | ------------------ |
| `data`          | `Record<string, any>` | Yes      | Data object        |
| `options.merge` | `boolean`             | No       | Merge or overwrite |

### 13. Set and Get Variables (setVariables / getVariables)

Description: the designer has three kinds of "data" with different purposes; do not mix them up.

| Object                        | Accessors                        | Purpose                                                    | Saved with the template                 |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| Test data `testData`          | `setTestData` / `getTestData`    | Sample data for design-time preview                        | Yes, stored in template `data.testData` |
| Variable data `variables`     | `setVariables` / `getVariables`  | Runtime data; takes priority over test data                | No, current session only                |
| Variable tree `availableVariables` | `setAvailableVariables`     | Hierarchy of selectable variables in the variables panel   | Yes, stored in template `ext.availableVariables` |

Resolution priority: `variables` > `testData`. When the same variable has values in both, printing and exporting use `variables`.

```ts
// Design time: prepare sample data for canvas preview
await el.setTestData({ orderNo: "A001" }, { merge: true });

// Runtime: inject real business data before printing
await el.setVariables({ orderNo: "REAL-001" }, { merge: true });
const vars = el.getVariables();
```

Returns: `setTestData` / `setVariables` are both `Promise<void>` (waiting for the canvas refresh); `getTestData` / `getVariables` synchronously return data copies.

Parameters:

| Field           | Type                  | Required | Description                                     |
| --------------- | --------------------- | -------- | ----------------------------------------------- |
| `data`          | `Record<string, any>` | Yes      | Data object                                     |
| `options.merge` | `boolean`             | No       | `true` merges into existing data; default `false` overwrites |

Related methods:

- `setTemplateVariables(data, { merge })`: same as `setVariables`, but first strips the **first leading `@`** from each variable name (`@orderNo` → `orderNo`, `@{orderNo}` → `{orderNo}`). It does not strip `{}` braces and does not handle forms like `{#orderNo}`.
- `setAvailableVariables(tree)`: sets the variable tree; usually restored automatically by `loadTemplateData` from the template `ext.availableVariables`, so manual calls are rarely needed.

### 14. Extract Template Variables (getTemplateVariables)

Description: scan the variables referenced by the current canvas and generate an "empty value" structure by type, usable as the initial value for `setVariables`.

```ts
const schema = el.getTemplateVariables();
// e.g. { orderNo: '', items: [] }

el.setVariables(schema); // seed the structure first, then replace items with real data
```

Default value rules (sample values only come from text/barcode/QR code and tables, so in practice you only get `""` and `[]`; the remaining branches exist for compatibility):

| Variable type       | Generated value |
| ------------------- | --------------- |
| Array               | `[]`            |
| Object              | `{}`            |
| Number              | `0`             |
| Boolean             | `false`         |
| Other (string etc.) | `""`            |

Note: this method returns "which variables the current canvas uses", without hierarchy; for the full variable tree read `getTemplateData().ext.availableVariables`.

### 15. Get and Load Template Data (getTemplateData / loadTemplateData)

Description: read/write the "canvas content" itself (pages, canvas size, guides, header/footer settings, test data, and the variable tree); it does not touch the template list.

```ts
const tpl = el.getTemplateData();
// tpl.pages / tpl.canvasSize / tpl.testData
// tpl.ext.availableVariables is the variable tree bound to this template

// The argument is TemplateData itself; do not wrap it in another `data` layer
el.loadTemplateData({
  ...tpl,
  ext: {
    ...(tpl.ext || {}),
    availableVariables: [
      { id: "customer", label: "Customer", children: [{ id: "customer.name", label: "Customer Name" }] },
    ],
  },
});
```

Parameters: the argument is a `TemplateData`; there is no `id` / `name` wrapper (those two fields are not read). Common fields:

| Field                    | Type                  | Required | Description                                        |
| ------------------------ | --------------------- | -------- | -------------------------------------------------- |
| `pages`                  | `Page[]`              | No       | Pages and elements; an empty array does not override the default page |
| `canvasSize`             | `{ width; height }`   | No       | Canvas size                                        |
| `testData`               | `Record<string, any>` | No       | Test data; cleared when omitted                    |
| `ext.availableVariables` | `VariableTreeItem[]`  | No       | Template-bound variable tree; cleared when omitted |

`loadTemplateData` behavior (in order):

1. Reset the canvas: this also clears `variables` and `testData`, and writes the default watermark back to localStorage; then each field present in the argument overrides the corresponding value.
2. `pages` only overrides when it is a **non-empty array**; omitted or empty keeps the default single page after reset.
3. Replaces test data with `testData`; cleared when omitted.
4. Replaces the variable tree with `ext.availableVariables`; cleared when omitted.
5. Clears the element selection, guide selection, and undo/redo history.
6. Returns `boolean`: `true` on success; `false` when the component is not ready, the argument is empty, or a custom element is being edited.

### 16. Template CRUD Operations

#### 1) Get Template List (getTemplates)

```ts
const list = el.getTemplates({ includeData: false });
```

Parameter `options.includeData` (`boolean`): Whether to include detailed template data in the list. Default is `false`.

#### 2) Refresh Template List (refreshTemplates)

```ts
const list = await el.refreshTemplates({ includeData: false });
```

Parameter `options.includeData` (`boolean`): Whether to include detailed template data in the list. Default is `false`.

#### 3) Get Template Details (getTemplate)

Description: look up a template in the in-memory list by ID; no extra request is made.

```ts
const detail = el.getTemplate("template-id");
// detail.ext.availableVariables is the template-bound variable tree
```

- Returns `null` when not found.
- In remote mode, call `loadTemplate(id)` if you need the latest detail (it requests the detail endpoint and writes the result back to the list).

#### 4) Create or Update Template (upsertTemplate)

Description: decides create vs. update by `id`; local mode writes memory plus localStorage, remote mode calls the upsert endpoint.

```ts
const id = await el.upsertTemplate({
  name: "A4 Template",
  data: { pages: [] },
  ext: {
    availableVariables: [
      { id: "customer", label: "Customer", children: [{ id: "customer.name", label: "Customer Name" }] },
    ],
  },
}, { setCurrent: true });
```

Parameters:

| Field                | Type      | Required | Description |
| -------------------- | --------- | -------- | ----------- |
| `template.id`        | `string`  | No       | Update that ID when provided; otherwise a new ID is generated |
| `template.name`      | `string`  | Yes      | Template name |
| `template.data`      | `object`  | No       | Canvas data; may be omitted on update to keep the existing data |
| `template.updatedAt` | `number`  | No       | Timestamp in milliseconds; defaults to the current time when omitted |
| `template.permissions` | `object` | No      | Permission config; existing permissions are kept when omitted |
| `template.ext`       | `object`  | No       | Extension data; `ext.availableVariables` is saved with the template |
| `options.setCurrent` | `boolean` | No       | Mark it as the current template (only updates the identifier, does not load the canvas) |

Returns:

- Success: the final template ID (in remote mode a response `id` wins, falling back to the request `id` when omitted).
- Target template has `permissions.editable === false`: returns `null` and reports that the template is read-only.
- Remote request fails: the local memory entry is already written, the local `id` is returned, and a save-failure toast is shown.

Note: `upsertTemplate` does not load the data into the canvas; call `loadTemplate(id)` afterwards if you want to edit it immediately. In remote mode, a successful save re-requests the list endpoint and uses the server list as the source of truth.

#### 5) Delete Template (deleteTemplate)

Description: delete a template by ID; local mode removes it from memory and localStorage, remote mode calls the delete endpoint.

```ts
// A confirmation dialog is shown by default
await el.deleteTemplate("template-id");

// Skip the confirmation dialog
await el.deleteTemplate("template-id", { confirm: false });
```

- `options.confirm` (`boolean`): defaults to `true`, showing a second confirmation.
- When the target template has `permissions.deletable === false`, the delete is blocked and the template remains.
- Deleting the current template clears the current template identifier and resets the canvas.

#### 6) Overwrite Template List (setTemplates)

Description: replace the in-memory template list with the given array (it does not call the delete endpoint).

```ts
el.setTemplates([
  {
    id: "t1",
    name: "T1",
    data: {},
    ext: {
      availableVariables: [{ id: "customer.name", label: "Customer Name" }],
    },
  },
], { currentTemplateId: "t1" });
```

- `options.currentTemplateId` (`string`): optional, sets the active template after overwriting.
- Items without string `id` / `name` are filtered out.
- If the current ID is not in the new list, it falls back to the first item.
- When an item is selected, `loadTemplate` is called to load its data into the canvas; this is skipped while editing a custom element.
- Local mode writes back to localStorage; remote mode does not.

#### 7) Load Template to Canvas (loadTemplate)

Description: load the specified template data into the canvas.

```ts
const ok = el.loadTemplate("template-id");
```

- Returns `boolean`: `false` while editing a custom element, otherwise `true`.
- Local mode: loads synchronously from the in-memory list.
- Remote mode: requests the template detail asynchronously; the canvas updates after the response arrives. The method itself returns immediately.
- Loading resets the canvas, replaces the variable tree (`ext.availableVariables`), and clears the undo/redo history.

#### 8) Template Permissions Configuration (permissions)

Description: configure the following fields in the template's `permissions` object to control designer operations.

```ts
{
  id: 'tpl_system',
  name: 'System Template',
  permissions: {
    editable: false,   // read-only in designer
    deletable: false,  // protected from delete
    copyable: true,    // whether copy is allowed
  },
  data: { pages: [] }
}
```

| Field       | Default   | Effect |
| ----------- | --------- | ------ |
| `system`    | `false`   | When `true`, forces read-only and blocks delete (overrides `editable` / `deletable`) |
| `editable`  | `!system` | When off, the designer becomes read-only and `upsertTemplate` returns `null` |
| `deletable` | `!system` | When off, `deleteTemplate` is blocked and the template remains |
| `copyable`  | `true`    | When off, the copy entry is hidden |

Permissions may also be written at the root level (`system`, `isSystem`, `editable`, `deletable`, `copyable`); root-level values take precedence over `permissions.*`. `system: true` forces `editable` / `deletable` to `false`.

### 17. Custom Elements CRUD Operations

#### 1) Get Custom Element List (getCustomElements)

```ts
const list = el.getCustomElements({ includeElement: false });
```

Parameter `options.includeElement` (`boolean`): Whether to include detailed element configuration data in the list. Default is `false`.

#### 2) Refresh Custom Element List (refreshCustomElements)

```ts
const list = await el.refreshCustomElements({ includeElement: false });
```

Parameter `options.includeElement` (`boolean`): Whether to include detailed element configuration data in the list. Default is `false`.

#### 3) Get Custom Element Details (getCustomElement)

Description: look up a custom element in the in-memory list by ID. It never calls `customElements.get`; the detail comes from the list or the detail cache.

```ts
const detail = el.getCustomElement("element-id");
// returns null when not found
```

#### 4) Create or Update Custom Element (upsertCustomElement)

Description: save or update a custom element. The request always carries an `id` (a client-generated uuid for new items); local mode writes memory plus localStorage, remote mode calls the upsert endpoint.

```ts
const id = await el.upsertCustomElement({
  name: "Barcode",
  element: {
    /* element data */
  },
  testData: {},
});
```

Parameters: `id` (optional; a uuid is generated when omitted), `name` (required string), `element` (required), `testData` (optional), `permissions` (optional), `ext` (optional).

Permission behavior (read-only custom element):

- If target element has `editable=false`, update is blocked and `upsertCustomElement` returns `null`.
- Otherwise the method returns the element ID; a remote response `id` wins, and a missing response `id` falls back to the request `id`.
- In remote mode, a successful save re-requests the custom element list endpoint and uses the server list as the source of truth.

#### 5) Delete Custom Element (deleteCustomElement)

Description: delete a specific custom element by ID.

```ts
// A confirmation dialog is shown by default
await el.deleteCustomElement("element-id");

// Skip the confirmation dialog
await el.deleteCustomElement("element-id", { confirm: false });
```

- `options.confirm` (`boolean`): defaults to `true`.
- If target element has `deletable=false`, delete is blocked and element remains in list.

#### 6) Overwrite Custom Element List (setCustomElements)

Description: replace the in-memory custom element list. Local mode also writes localStorage; remote mode does not persist the list locally.

```ts
el.setCustomElements([
  {
    id: "c1",
    name: "C1",
    element: {
      /* element data */
    },
  },
]);
```

Items without string `id` / `name` or without `element` are ignored.

#### 7) Custom Element Permissions Configuration (permissions)

Description: You can configure the following fields within the `permissions` object of the custom element to control operations in the designer.

```ts
{
  id: 'el_system',
  name: 'System Element',
  permissions: {
    editable: false,   // read-only
    deletable: false,  // protected from delete
    copyable: true,    // whether copy is allowed
  },
  element: { /* element data */ }
}
```

Field meanings, defaults, and the root-level / `permissions` forms are the same as "Template Permissions Configuration": `system` defaults to `false` and forces read-only plus no delete when `true`; `editable` / `deletable` default to `!system`; `copyable` defaults to `true`.

### 18. Set CRUD Mode (setCrudMode)

Description: switch CRUD mode. `remote` immediately fetches the template list asynchronously; if no template is currently selected and the list is not empty, it automatically loads the first template into the canvas, and it also fetches the custom element list. `local` only switches the data source and makes no request.

```ts
// Configure endpoints before switching mode to avoid requests to default URLs
el.setCrudEndpoints({ /* ... */ });
el.setCrudMode("local");
el.setCrudMode("remote");
```

Parameters:

| Field  | Type                  | Required | Description |
| ------ | --------------------- | -------- | ----------- |
| `mode` | `'local' \| 'remote'` | Yes      | CRUD mode   |

### 19. Configure Cloud CRUD Endpoints (setCrudEndpoints)

Description: configure CRUD endpoints, headers, and a custom request function. Supports passing a simple string URL, or an object to configure `url` and `method`.

**Highly Customizable URL Note:**
Whichever configuration method you use below, the CRUD `url` is **fully customizable**. The underlying logic is as follows:

1. **Auto Placeholder Replacement**: When executing operations with an ID, the system simply replaces the `{id}` string in your URL with the actual ID. If your backend URL doesn't require `{id}` (e.g., passing via query or body), you can omit it entirely.
2. **Smart Path Resolution**:
   - **Absolute Path**: If your URL contains `http://` or `https://`, the system considers it an absolute path and requests it directly, **completely ignoring the global `baseUrl`** (this is ideal for scenarios where some endpoints need to connect to third-party domains or microservices).
   - **Relative Path**: If your URL starts with `/` or is a plain string, the system considers it a relative path and automatically prepends the globally configured `baseUrl`.

**Method 1: Default configuration (String)**

Pass the endpoint URL directly as a string. The system will use default HTTP request methods (e.g. GET for `list`, POST for `upsert`). The URL can be a relative path (which will automatically append `baseUrl`) or a **full absolute path** (which will automatically ignore `baseUrl`).

```ts
el.setCrudEndpoints(
  {
    baseUrl: "https://api.example.com", // You can set the global baseUrl here
    templates: {
      list: "/print/templates", // Relative path, actual request: https://api.example.com/print/templates
      get: "https://other-domain.com/api/print/templates/{id}", // Absolute path, ignores baseUrl
      upsert: "/print/templates",
      delete: "/print/templates/{id}",
    },
    customElements: {
      list: "/print/custom-elements",
      get: "https://other-domain.com/api/print/custom-elements/{id}",
      upsert: "/print/custom-elements",
      delete: "/print/custom-elements/{id}",
    },
  },
  {
    // You can also set baseUrl in options, which has higher priority
    // baseUrl: 'https://your-domain.com',
    headers: { Authorization: "Bearer xxx" },
  },
);
```

**Method 2: Custom configuration (Object)**

If you need to change the HTTP method, you can provide an object containing `url` and `method`. The following example demonstrates how to customize all endpoints as `POST` requests:

_Tip: `url` can be a relative path (which automatically appends `baseUrl`), or a **full absolute URL** (e.g. `https://other-domain.com/...`, which automatically ignores `baseUrl`, convenient for connecting to third-party or microservice APIs)._

```ts
el.setCrudEndpoints(
  {
    templates: {
      list: {
        url: "/api/print/templates/search", // Relative path, automatically appends baseUrl
        method: "POST", // Change the default GET to POST
      },
      get: {
        url: "https://other-domain.com/api/print/templates/detail/{id}", // Full absolute URL, ignores baseUrl
        method: "POST", // Change the default GET to POST
      },
      upsert: {
        url: "/api/print/templates/save",
        method: "POST", // Explicitly specify POST request
      },
      delete: {
        url: "/api/print/templates/remove/{id}",
        method: "POST", // Change the default DELETE to POST
      },
    },
    customElements: {
      list: {
        url: "https://other-domain.com/api/print/custom-elements/search", // Full absolute URL
        method: "POST",
      },
      get: {
        url: "/api/print/custom-elements/detail/{id}",
        method: "POST",
      },
      upsert: {
        url: "/api/print/custom-elements/save",
        method: "POST",
      },
      delete: {
        url: "/api/print/custom-elements/remove/{id}",
        method: "POST",
      },
    },
  },
  {
    baseUrl: "https://your-domain.com",
    headers: {
      Authorization: "Bearer xxx",
      "X-Tenant-ID": "123",
    },
  },
);
```

Parameters:

| Field                             | Type                     | Required | Description                                         |
| --------------------------------- | ------------------------ | -------- | --------------------------------------------------- |
| `endpoints.baseUrl`               | `string`                 | No       | Base URL                                            |
| `endpoints.templates.list`        | `EndpointConfig`         | No       | Template list endpoint                              |
| `endpoints.templates.get`         | `EndpointConfig`         | No       | Template detail endpoint (`{id}` placeholder)       |
| `endpoints.templates.upsert`      | `EndpointConfig`         | No       | Template upsert endpoint                            |
| `endpoints.templates.delete`      | `EndpointConfig`         | No       | Template delete endpoint (`{id}` placeholder)       |
| `endpoints.customElements.list`   | `EndpointConfig`         | No       | Custom element list endpoint                        |
| `endpoints.customElements.get`    | `EndpointConfig`         | No       | Custom element detail endpoint (reserved: the frontend currently never calls it; details come from the list cache) |
| `endpoints.customElements.upsert` | `EndpointConfig`         | No       | Custom element upsert endpoint                      |
| `endpoints.customElements.delete` | `EndpointConfig`         | No       | Custom element delete endpoint (`{id}` placeholder) |
| `options.baseUrl`                 | `string`                 | No       | Base URL (same as `endpoints.baseUrl`)              |
| `options.headers`                 | `Record<string, string>` | No       | Request headers (auth, etc)                         |
| `options.fetcher`                 | `(input, init?) => Promise<Response>` | No | Custom request function for interceptors or replacing `fetch` |

Note: The `EndpointConfig` type is defined as `string | { url: string; method?: string }`; there is no `data` field for attaching a request body. If you need to append extra business data to your requests (such as a tenant ID):

1. **For Query Requests** (e.g., `list`): Please append query parameters directly to the `url`, or handle it via interceptors on the server side.
2. **For Write Requests** (e.g., `upsert`): Please place extra parameters directly into the `ext` field of the entity data object.
3. **For Global Parameters**: It is recommended to pass them uniformly in the request headers by configuring `options.headers` (e.g., `X-Tenant-ID`), or rewrite requests before sending via `options.fetcher`.

### 20. Set Language (setLanguage)

Description: switch language. You can also use the `lang` attribute to set the initial language.

```ts
el.setLanguage("en");
el.setLanguage("zh");
el.setLanguage("zh-Hant");
```

Parameters:

| Field  | Type                                                 | Required | Description |
| ------ | ---------------------------------------------------- | -------- | ----------- |
| `lang` | `'zh' \| 'zh-Hant' \| 'en' \| 'ja' \| 'ko' \| 'de'`  | Yes      | Language code; invalid values are silently ignored |

### 21. Configure Client and Cloud Print Links (setLinks)

Description: Configure the client download link and cloud print link in the settings modal, or hide them. Can also be set via HTML attributes `client-url`, `cloud-url`, `hide-links`, `hide-client-link`, `hide-cloud-link`.

```ts
el.setClientLink("https://example.com/client.zip");
el.setCloudLink("https://example.com/cloud-print");
el.hideLinks(true); // Hide all links
el.hideClientLink(true); // Hide client download link only
el.hideCloudLink(true); // Hide cloud print link only
```

### 22. Configure Extension Menu (setContextMenu)

Description: Configure the extension menu for the template list and custom element list.
You can choose to append (`append`) to the default menu, or completely replace it (`replace`). When a menu item is clicked, the designer dispatches the custom event `eventName` you configured.

```ts
el.setTemplateContextMenu({
  mode: "append", // 'append' | 'replace'
  items: [
    {
      key: "custom-publish",
      label: "Publish Template",
      icon: "material-symbols:rocket-launch", // Optional: Iconify name (e.g. material-symbols:edit)
      // icon: '🚀', // Optional: Text or emoji
      // iconClass: 'fa fa-edit', // Optional: CSS class for icon fonts
      // iconImage: 'https://example.com/icon.png', // Optional: Image URL
      eventName: "template-custom-publish", // Event to dispatch
    },
  ],
});

el.setCustomElementContextMenu({
  mode: "replace",
  items: [
    {
      key: "editElement", // Built-in key to keep the default edit action
      label: "Edit Element",
      actionKey: "editElement", // Built-in action
      icon: "material-symbols:edit",
    },
    {
      key: "custom-sync",
      label: "Sync to Cloud",
      eventName: "custom-element-sync",
    },
  ],
});

// Listen to custom events
el.addEventListener("template-custom-publish", (e) => {
  console.log("Publish template:", e.detail.item);
});
el.addEventListener("custom-element-sync", (e) => {
  console.log("Sync custom element:", e.detail.item);
});
```

Parameters:

| Field            | Type                    | Required | Description                                                   |
| ---------------- | ----------------------- | -------- | ------------------------------------------------------------- |
| `config.mode`    | `'append' \| 'replace'` | No       | Append to or replace the default menu (default: `append`)     |
| `config.items`   | `Array`                 | Yes      | List of menu items                                            |
| `item.key`       | `string`                | Yes      | Unique key for the menu item                                  |
| `item.label`     | `string`                | Yes      | Display text for the menu item                                |
| `item.icon`      | `string`                | No       | Text/emoji, or an Iconify name (e.g. `material-symbols:edit`) |
| `item.iconClass` | `string`                | No       | CSS class for icon fonts (e.g. `fa fa-edit`)                  |
| `item.iconImage` | `string`                | No       | URL or Base64 string of an image                              |
| `item.eventName` | `string`                | No       | Custom event to dispatch on click                             |
| `item.actionKey` | `string`                | No       | Built-in action to trigger                                    |

Note: If `item.icon` uses the `collection:name` format (for example, `material-symbols:content-copy`), it is rendered as an icon. Otherwise it is treated as plain text.
You can browse available `material-symbols` icons here: <https://icon-sets.iconify.design/material-symbols/>.

**Built-in Menu Keys and ActionKeys:**

> **Note on Built-in Icons:**
> The built-in icons shown below use the `material-symbols` collection from Iconify.

For `setTemplateContextMenu` (Template List):

- `viewJson`: View JSON (Icon: `material-symbols:data-object`), available in the left template list only; the top dropdown has no such item
- `testData`: Test Data (Icon: `material-symbols:data-object`)
- `edit`: Edit (Icon: `material-symbols:edit`)
- `copy`: Copy (Icon: `material-symbols:content-copy`)
- `delete`: Delete (Icon: `material-symbols:delete`)

The top template dropdown only has four built-ins: `testData` / `edit` / `copy` / `delete`.

For `setCustomElementContextMenu` (Custom Element List):

- `editElement`: Edit Element (Icon: `material-symbols:edit`)
- `testData`: Test Data (Icon: `material-symbols:data-object`)
- `edit`: Edit (Icon: `material-symbols:edit`)
- `copy`: Copy (Icon: `material-symbols:content-copy`)
- `delete`: Delete (Icon: `material-symbols:delete`)

### 23. Configure Template Modal Custom Form (setTemplateModalForm)

Description: configures the form used by the template "Create / Edit / Copy" modals. Besides the template name, you decide the fields; the extra values a user enters are stored in the template's `ext.templateModalForm`.

```ts
el.setTemplateModalForm({
  create: {
    fields: [
      { key: 'name', label: 'Template name', type: 'input', required: true, placeholder: 'Enter a name' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Shipment', value: 'shipment' }
        ]
      },
      {
        key: 'scope',
        label: 'Visibility',
        type: 'radio',
        options: [
          { label: 'Private', value: 'private' },
          { label: 'Team', value: 'team' }
        ]
      },
      { key: 'priority', label: 'Priority', type: 'number', min: 1, max: 99, step: 1 },
      { key: 'remark', label: 'Remark', type: 'textarea', rows: 3 },
      { key: 'effectiveDate', label: 'Effective date', type: 'date' },
      { key: 'publishAt', label: 'Publish at', type: 'datetime' }
    ],
    initialValues: {
      category: 'standard',
      scope: 'private',
      priority: 1
    }
  },
  edit: {
    fields: [
      { key: 'name', label: 'Template name', type: 'input', required: true },
      { key: 'scope', label: 'Visibility', type: 'radio', options: [{ label: 'Private', value: 'private' }, { label: 'Team', value: 'team' }] }
    ]
  },
  copy: {
    fields: [
      { key: 'name', label: 'Template name', type: 'input', required: true },
      { key: 'category', label: 'Category', type: 'select', options: [{ label: 'Standard', value: 'standard' }] }
    ]
  }
})

// Clear the configuration and restore the default single-line input
el.clearTemplateModalForm()
```

Top-level parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `config.create / edit / copy` | `TemplateModalConfigItem` | No | Configuration per modal. When `copy` is missing, `edit` then `create` is used; when `edit` is missing, `create` is used |
| `item.fields` | `TemplateModalField[]` | No | Field list. When omitted or empty, the modal falls back to a single untitled input whose value becomes the template name |
| `item.initialValues` | `Record<string, any>` | No | Default values, matched by `field.key` |

Fields (`item.fields[]`):

| Field | Type | Required | Applies to | Description |
| --- | --- | --- | --- | --- |
| `key` | `string` | Yes | All | Field identifier; also the submitted key and the key inside `ext.templateModalForm` |
| `type` | `'input' \| 'number' \| 'textarea' \| 'select' \| 'radio' \| 'date' \| 'datetime'` | Yes | All | Control type; see the table below |
| `label` | `string` | No | All | Field title; no title is rendered when omitted |
| `placeholder` | `string` | No | input / number / textarea / select | Placeholder text; for a non-required `select` it is used as the empty option label |
| `required` | `boolean` | No | All | Required. The confirm button is disabled while empty; a non-required `select` gets an extra empty option |
| `options` | `{ label: string; value: string \| number }[]` | Required for `select` / `radio` | select / radio | Option list; entries whose `label` is not a string are dropped |
| `min` / `max` | `number` | No | number | Allowed range; values outside it are not saved when confirming |
| `step` | `number` | No | number | Step size, defaults to 1 |
| `rows` | `number` | No | textarea | Visible rows, defaults to 4 |

Control types:

| `type` | UI | Submitted value |
| --- | --- | --- |
| `input` | Single-line text box | String |
| `number` | Numeric input | Number; empty submits `null` |
| `textarea` | Multi-line text box | String (empty string when left blank) |
| `select` | Dropdown | The option `value` |
| `radio` | Radio group | The option `value` |
| `date` | Native date picker | `YYYY-MM-DD` |
| `datetime` | Native date-time picker | `YYYY-MM-DDTHH:mm` |

Notes:

- When `fields` is configured, it must contain a field with `key: 'name'`: it supplies the template name on save. Without it, confirming does nothing.
- `name` is only used as the template name and is not written to `ext.templateModalForm`; all other field values are written to `ext.templateModalForm[mode]`.
- When `fields` is not configured (or is empty), the modal falls back to a single untitled input whose value becomes the template name; there are no extra fields to fill in.

Prefill order when the modal opens (highest priority first):

1. `ext.templateModalForm[mode]` — history for the current action;
2. `ext.templateModalForm[lastMode]` — history from the last submission;
3. business fields in the template's `ext` whose key matches a field `key`;
4. `initialValues` from the configuration;
5. the current template name (for the `name` field only).

History wins for keys that exist in both places, so `initialValues` only affects the very first fill.

### 24. Configure Custom Element Modal Custom Form (setCustomElementModalForm)

Description: Used to configure the custom form structure and default values for the custom element "Create / Edit / Copy" modals. Field usage is identical to "23. Configure Template Modal Custom Form"; only examples are shown here.

Difference from template modals: the custom element's `create` / `edit` / `copy` configurations are **independent** and do not fall back to each other; when a mode is not configured, its modal uses the default single name input. `copy` is honored, and the copy modal reads `copy.fields`.

```ts
el.setCustomElementModalForm({
  create: {
    fields: [
      {
        key: "name",
        label: "Name",
        type: "input",
        required: true,
        placeholder: "Please enter name",
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        options: [{ label: "Barcode", value: "barcode" }],
      },
    ],
  },
  edit: {
    fields: [{ key: "name", label: "Name", type: "input", required: true }],
  },
});

// Clear configuration, restore default single input box modal
el.clearCustomElementModalForm();
```

### 25. Configure Template List Tag Extension (setTemplateTagResolver)

Supports rendering custom tags (such as business status, categories, etc.) for each template in the left-side template list. The tag data is dynamically returned by the callback function you provide, based on the current template data.

```ts
el.setTemplateTagResolver((template) => {
  // Read preset tag array from template extension data (refer to Backend API Specifications)
  const tags = template.ext?.templateTags || [];

  // You can also dynamically generate tags based on other template fields, for example:
  // if (template.permissions?.copyable) {
  //   tags.push({ key: 'copyable', label: 'Copyable', color: 'green' })
  // }

  return tags;
});
```

**Returned tag object structure:**

| Field   | Type     | Description                                                                                                                                                      |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key` | `string` | Tag identifier; not used for rendering yet, may be omitted |
| `label` | `string` | Display text of the tag                                                                                                                                          |
| `color` | `string` | Tag color. Supports built-in semantic colors (`white`, `red`, `blue`, `green`, `orange`) or valid CSS color values. If not provided, default gray style is used. |

**Color Values:**

| Value | Result |
| --- | --- |
| `red` / `红色` / `红` / `#ff4d4f` | Light red background, dark red text |
| `blue` / `蓝色` / `蓝` / `#3b82f6` | Light blue background, dark blue text |
| `green` / `绿色` / `绿` / `#22c55e` | Light green background, dark green text |
| `orange` / `橙色` / `橙` / `#f97316` | Light orange background, dark orange text |
| `white` / `白色` / `白` / `#ffffff` | White background, dark gray text |
| Any other CSS color (e.g. `#a855f7`, `rgb(168,85,247)`) | Used directly as the background, with white text |
| Omitted or empty string | Gray background, gray text |

Color values are case-insensitive and surrounding spaces are ignored.

**Display Rules:**

- The list and the toolbar dropdown behave the same: the first 2 tags are shown in array order, and the rest collapse into `+N` (for example `+1`).
- `+N` is only a count hint; it cannot be clicked to reveal the rest.
- When the resolver does not return an array, it is treated as no tags; entries that are not objects are ignored.
- Entries whose `label` is empty or whitespace-only are dropped, so no blank tag is rendered.
- The callback runs once per template in the list and receives the template list item (`id`, `name`, `ext`, `permissions`, and so on).
- It runs again whenever the list data changes, and the result is cached while the list stays the same; keep it a pure mapping function without expensive work or side effects.
- Once a resolver is set, `ext.templateTags` is ignored; call `clearTemplateTagResolver()` to fall back to reading `ext.templateTags`.
- When `setTemplateTagResolver` is not configured, the frontend reads `ext.templateTags` from the template (see "Backend API Specifications → ext.templateTags").

### 26. Configure AI Built-in Models (setAiModels)

Description: The host (your backend) injects a set of "built-in models" into the designer. Built-in models only appear in the AI assistant's model dropdown, grouped as "Built-in Models"; they are not written into user configuration and require no `apiKey` in the frontend.

```ts
// 1) Enable the AI feature (off by default; the state is remembered in localStorage)
await el.setAiEnabled(true);

// 2) Inject the host-provided model list (no apiKey)
await el.setAiModels([
  {
    id: "builtin-fast",
    alias: "Fast Model",
    model: "deepseek-flash",
    baseUrl: "/api/ai/v1",
  },
  {
    id: "builtin-vision",
    alias: "Vision Model",
    model: "deepseek-vl",
    baseUrl: "https://api.example.com/v1",
    supportsVision: true,
  },
]);

// 3) Open the panel; the "Built-in Models" group appears in the dropdown
await el.openAiPanel();
```

**Model fields:**

| Field            | Type                      | Required | Description                                                                                              |
| ---------------- | ------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                  | Yes      | Unique identifier; when `activeId` matches both a built-in and a custom model, the built-in model wins. |
| `alias`          | `string`                  | No       | Name shown in the dropdown; defaults to `model`.                                                         |
| `model`          | `string`                  | Yes      | Model name in the request body.                                                                          |
| `baseUrl`        | `string`                  | Yes      | API base URL. Relative paths go directly to the same origin; `http(s)://` is proxied via `/ai-proxy` in development and called directly in production. |
| `temperature`    | `number`                  | No       | Defaults to `0.2`.                                                                                       |
| `maxTokens`      | `number`                  | No       | Defaults to `16384`.                                                                                     |
| `maxInputTokens` | `number`                  | No       | Defaults to `128000`.                                                                                    |
| `supportsVision` | `boolean`                 | No       | Whether images can be uploaded; defaults to `false`.                                                     |
| `headers`        | `Record<string, string>`  | No       | Extra request headers.                                                                                   |
| `extraBody`      | `Record<string, unknown>` | No       | Extra fields merged into the request body.                                                               |

**Behavior:**

- Replacement semantics: each call replaces the whole built-in list; passing an empty array clears it and the dropdown falls back to user-defined models.
- Built-in models are not written into `getAiConfig().profiles` and are not saved to localStorage; they must be re-injected after a page refresh.
- The settings page only lists user-defined models; when only built-in models exist, the empty state reads "Models are provided by your administrator; you can also add your own."
- The second argument `setAiModels(models, { scopeId })` isolates by tenant/instance and defaults to the designer's CRUD scope.
- Never inject secrets in the frontend: point `baseUrl` at your own server endpoint, keep the key on the server, and send only the model name and messages from the frontend.

**Read the current configuration:**

```ts
// Contains only user-defined models; built-in models are maintained via setAiModels
const config = await el.getAiConfig();
```

## Backend API Specifications

When integrating with remote CRUD, implement API paths and core fields first, then extend with `ext`. The following structure is concise and implementation-ready.

### Overview

| Resource       | Action        | Default Method (Customizable) | Path                              | Description                            |
| -------------- | ------------- | ----------------------------- | --------------------------------- | -------------------------------------- |
| Template       | List          | `GET`                         | `/api/print/templates`            | Template list endpoint.                |
| Template       | Detail        | `GET`                         | `/api/print/templates/{id}`       | Template detail endpoint.              |
| Template       | Create/Update | `POST`                        | `/api/print/templates`            | Template create/update endpoint.       |
| Template       | Delete        | `DELETE`                      | `/api/print/templates/{id}`       | Template delete endpoint.              |
| Custom Element | List          | `GET`                         | `/api/print/custom-elements`      | Custom element list endpoint.          |
| Custom Element | Detail        | `GET`                         | `/api/print/custom-elements/{id}` | Custom element detail endpoint.        |
| Custom Element | Create/Update | `POST`                        | `/api/print/custom-elements`      | Custom element create/update endpoint. |
| Custom Element | Delete        | `DELETE`                      | `/api/print/custom-elements/{id}` | Custom element delete endpoint.        |

### Common Fields

| Field         | Type      | Required                   | Description                                                            |
| ------------- | --------- | -------------------------- | ---------------------------------------------------------------------- |
| `id`          | `string`  | Required for create/update | Primary key. Every save entry point sends an `id` (a client-generated uuid for new items); the backend may override it via the response `id`. |
| `name`        | `string`  | Required for create/update | Display name; list items whose `name` is not a string are filtered out. |
| `permissions` | `object`  | Optional                   | Can include `editable/deletable/copyable/system`; may be placed at the root or under `permissions`, root-level wins. Defaults: `editable/deletable = !system`, `copyable = true`; `system: true` forces read-only and non-deletable. |
| `updatedAt`   | `number`  | Recommended                | Unix timestamp in milliseconds; falls back to the current time when missing. |
| `ext`         | `object`  | Recommended                | Extension container. See "Generic `ext` Constraints" below.                  |
| `success`     | `boolean` | Optional for delete        | The frontend does not read this field; a successful request is enough.  |

### Generic `ext` Constraints

`ext` is the shared "extra information" container for templates and custom elements. The keys below are understood by the designer; any other key is kept and saved as-is.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ext` | `Record<string, any>` | Recommended | Extension container. When `null`, an array, or a string is passed, it is treated as "no extra information". |
| `ext.availableVariables` | `VariableTreeItem[]` | Recommended for template | The template's own variable catalog; decides which variables can be dragged from the variable panel. See below. |
| `ext.templateModalForm` | `Record<string, any>` | Optional | Values entered in custom fields of the save modal. See below. |
| `ext.templateTags` | `TemplateListTag[]` | Optional | Tags shown in the template list. See below. |
| `ext.<customKey>` | Any JSON value | Optional | Your own business fields; the designer does not interpret them but keeps them. See below. |
| `<root>.<customKey>` | Not supported | No | Business fields must live inside `ext`, not directly on the template root. |
| `ext` merge rules | Rule | Yes | How `ext` from multiple sources is combined. See below. |

#### ext.availableVariables (Template Available Variables)

Description: a template can carry its own "variable catalog" in `ext.availableVariables`. It decides which variables appear in the variable panel for drag-and-drop binding, and is saved with the template together with element bindings.

- `data.testData` holds preview **values**; this field holds the variable **structure**. They cannot replace each other.
- The variable panel only reads this field; element bindings store just the variable path string (`@order.no`), not the whole tree.

##### Structure

```ts
interface VariableTreeItem {
  id: string                    // Variable path; also the key used by element bindings
  label: string                 // Display name in the variable panel
  children?: VariableTreeItem[] // Child variables
  isArray?: boolean             // Reserved flag for array-type variables
}
```

Example:

```json
{
  "ext": {
    "availableVariables": [
      {
        "id": "order",
        "label": "Order",
        "children": [
          { "id": "order.no", "label": "Order No." },
          { "id": "order.amount", "label": "Amount" }
        ]
      },
      { "id": "items", "label": "Line Items", "isArray": true }
    ]
  }
}
```

##### Field Constraints

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Variable path, globally unique; element bindings use this value. |
| `label` | `string` | Yes | Display name in the variable panel. |
| `children` | `VariableTreeItem[]` | No | Child variables; one nesting level is recommended, since the panel expands only one level by default. |
| `isArray` | `boolean` | No | Reserved flag for array-type variables; not rendered specially for now. |

##### When It Is Sent and Returned

| Scenario | Frontend Behavior |
| --- | --- |
| Open template in remote mode (`loadTemplate`) | Requests the detail endpoint and replaces the variable tree with `ext.availableVariables`. |
| Open template in local mode | Reads the template from localStorage and replaces the variable tree the same way. |
| `loadTemplateData(...)` | Replaces the variable tree with the passed `ext.availableVariables`; clears it when omitted. |
| Remote save (`upsertTemplate`) | Uses `ext.availableVariables` from the argument when present, otherwise keeps the template's previous value. |
| Remote save response | When the response contains `ext`, it is merged field by field. |
| `setTemplates(list)` | Keeps `ext.availableVariables` on each item as-is. |
| `getTemplateData()` | Returns the current variable tree under `ext.availableVariables`. |

##### How Elements Bind Variables

Elements store the variable path string; both forms are recognized:

```ts
element.variable = '@order.no'
element.variable = '{#order.no}'
```

Value resolution order: `variables` (runtime) → `testData` (design time).

##### What the Backend Needs to Do

1. The detail endpoint must return `ext.availableVariables`; without it the variable panel is empty.
2. The save endpoint must store it unchanged: do not trim `children`, rewrite `id`, or merge duplicates.
3. The list endpoint may omit this field; lists are for display only and do not restore variables.
4. On create, when the frontend omits it, you may supply a default catalog or return an empty array.

#### ext.templateModalForm (Modal Form Values)

Used by the "Save template" modal: whatever the user enters in your extra fields (category, owner, and so on) is recorded here. Control types, supported attributes, and the prefill order are described in "23. Configure Template Modal Custom Form".

Structure:

```ts
interface TemplateModalFormExt {
  create?: Record<string, any> // Values entered in the create modal
  edit?: Record<string, any>   // Values entered in the edit modal
  copy?: Record<string, any>   // Values entered in the copy modal
  lastMode?: "create" | "edit" | "copy" // Which modal submitted last
  updatedAt?: number           // Timestamp of the last write in milliseconds
}
```

Full example:

```json
{
  "ext": {
    "templateModalForm": {
      "create": { "category": "invoice", "owner": "sales" },
      "edit": { "category": "invoice", "owner": "finance" },
      "lastMode": "edit",
      "updatedAt": 1730000000000
    }
  }
}
```

When it is written:

| Action | What is written |
| --- | --- |
| Create a template and submit the modal | The extra field values go to `create`; `lastMode` becomes `create` |
| Edit a template and submit the modal | The extra field values go to `edit`; `lastMode` becomes `edit` |
| Copy a template and submit the modal | The extra field values go to `copy`; `lastMode` becomes `copy` |
| Plain save (no modal) | No field values are added; only `lastMode` becomes the mode that matches the save |
| Every write | `updatedAt` is refreshed to the current time |

A plain save means clicking the save button, saving a custom element, or calling `upsertTemplate` without going through the modal form; these writes never change the stored values of `create` / `edit` / `copy`.

What the backend needs to do:

- Store `ext.templateModalForm` as received: do not clear it or trim `create/edit/copy`.
- Return it unchanged from the detail endpoint; the list endpoint may omit it.
- `updatedAt` only records the write time for the frontend; the backend does not need to act on it.

#### ext.templateTags (Template List Tags)

The small tags shown before each template in the list and in the toolbar template dropdown (such as "Published" or "Finance only") come from this field by default. Color values and display rules are described in "25. Configure Template List Tag Extension".

##### Structure

```ts
interface TemplateListTag {
  key?: string   // Tag identifier, kept as-is; not used for rendering
  label: string  // Tag text, required
  color?: string // Tag color
}
```

##### Field Constraints

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | `string` | No | Tag identifier. The frontend keeps it as-is; it is not used for de-duplication, sorting, or as a list key. May be omitted |
| `label` | `string` | Yes | Tag text. Converted to a string and trimmed; entries that are empty or whitespace-only are dropped, so no blank tag is rendered |
| `color` | `string` | No | Tag color, see the table below; gray default when omitted |

Full example:

```json
{
  "ext": {
    "templateTags": [
      { "key": "published", "label": "Published", "color": "green" },
      { "key": "finance", "label": "Finance only", "color": "blue" },
      { "key": "archived", "label": "Archived" }
    ]
  }
}
```

The example above renders "Published" and "Finance only", followed by `+1`.

##### What the Backend Needs to Do

1. Include `ext.templateTags` unchanged in the list endpoint; without it no tags are rendered.
2. The detail endpoint may omit this field.
3. Store it unchanged on save: the frontend never clears this field when saving a template, so persist what you receive instead of dropping unknown keys.

#### `ext.<customKey>` (Custom Business Fields)

Business fields the designer does not understand go here, such as order type, owning department, or an external system ID.

```json
{
  "ext": {
    "bizMeta": { "source": "erp", "region": "east" },
    "orderType": "invoice",
    "flags": ["rush", "gift"],
    "retryCount": 3
  }
}
```

##### Read and Write Rules

| Stage | Behavior |
| --- | --- |
| Read | Whatever the API returns is kept; no type conversion and no key renaming |
| Save | `ext` is included in the request body; except for `availableVariables`, caller-provided values win |
| Keys not passed | Previous values are kept and never cleared (see the merge rules below) |
| Root-level fields | Not supported. Before saving, the frontend keeps only `id`, `name`, `ext`, `permissions`, `data`, `updatedAt`, `element`, and `testData`; any other root field is dropped |
| Value types | Any JSON value: object, array, string, number, boolean, `null` |

##### Relationship with the Modal Form

When a template modal opens, values in `ext` whose keys match a field `key` are prefilled into the form (step 3 of the prefill order in "23. Configure Template Modal Custom Form").

For this reason, do not name business fields `templateModalForm`, `availableVariables`, or `templateTags`; those three keys are reserved by the designer.

##### What the Backend Needs to Do

1. Store and return `ext` as a plain JSON object; do not filter out unknown keys.
2. Do not rename keys or change their nesting; the frontend relies on the original keys for prefill and display.
3. When a template has no extra information, return `{}` or omit `ext` entirely.

#### ext Merge Rules

The `ext` of one template can come from several places (local cache, detail endpoint, save response, caller arguments). The frontend combines them as follows:

| Data type | How it merges | Example |
| --- | --- | --- |
| Object | Merged deeply by key; later values win | `{ a: 1, b: 2 }` + `{ b: 3 }` → `{ a: 1, b: 3 }` |
| Array | Replaced as a whole, never concatenated | `["a","b"]` + `["c"]` → `["c"]` |
| Non-object | Treated as an empty object, no error | `ext: null` behaves like `ext: {}` |

When merging happens:

- After an `upsertTemplate` remote save succeeds, the response `ext` is written back by **top-level shallow merge** (`{ ...requestExt, ...responseExt }`); nested objects are not merged deeply;
- After a designer UI save (toolbar / template list) succeeds, request `ext` and response `ext` are merged deeply (objects merge by key, arrays replace as a whole);
- When `setTemplates(list)` replaces the list, each item's own `ext` is kept;
- When a template comes back from the detail endpoint, it is written into the list cache;
- When assembling a remote save request, the caller's `ext` wins and keys not passed fall back to the previous values.

Because arrays are replaced as a whole, return complete arrays from the backend rather than only the changed entries.

Deep merge applies everywhere except the `upsertTemplate` save **response**: there, `ext` overwrites by top-level key. For example, if the request contains `templateModalForm: { create: {...}, edit: {...} }` and the response returns only `templateModalForm: { edit: {...} }`, the local record keeps only `edit` and `create` is lost. So either omit `ext` from that response or echo the complete `ext` back.

### Template CRUD Constraints

#### 1) Endpoint Responsibilities and Call Timing

| Endpoint | When it is called | Must return |
| -------- | ----------------- | ----------- |
| List | Designer init, list refresh, after a successful save | Summary array (`id/name/updatedAt/permissions/ext`); array order is display order |
| Detail | User opens a template (remote `loadTemplate`) | `data` and `ext.availableVariables`, used to restore the canvas and variable tree |
| Save | Save / Save As | Response `id` may be omitted (fall back to the request `id`); response `ext` shallow-overrides the request `ext` at the top level |
| Delete | Deleting a template | Any successful response; `success` is not read by the frontend |

The save endpoint is upsert-style: the frontend **always** sends `id` in the request body (a client-generated uuid for new items) and never splits it into two paths. The backend may treat that `id` as an idempotency key, or return its own `id` in the response to override it.

#### 2) List Templates

`GET /api/print/templates`

Note: request body is empty; response body is a template array. All fields below are list-item fields (item.xxx).

| Field              | Type     | Required    | Description                                                                                                                                                      |
| ------------------ | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item.id`          | `string` | Required    | Template unique ID; items with a non-string value are filtered out.                                                                                              |
| `item.name`        | `string` | Required    | Template name; items with a non-string value are filtered out.                                                                                                    |
| `item.updatedAt`   | `number` | Recommended | Update timestamp in milliseconds.                                                                                                                                |
| `item.permissions` | `object` | Optional    | Permission control fields.                                                                                                                                       |
| `item.ext`         | `object` | Optional    | Extension data.                                                                                                                                                  |
| `order`            | Rule     | Yes         | Frontend renders in API return order and does not re-sort by `updatedAt` or copy action; backend should return a stable order (e.g. `displayOrder ASC, id ASC`). |

Request example:

```http
GET /api/print/templates HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
[
  {
    "id": "tpl_1001",
    "name": "A4 Delivery Note",
    "updatedAt": 1715251200000,
    "permissions": {
      "editable": true,
      "deletable": true,
      "copyable": true
    },
    "ext": {
      "category": "delivery"
    }
  },
  {
    "id": "tpl_1002",
    "name": "A5 QC Label",
    "updatedAt": 1715337600000,
    "permissions": {
      "editable": false,
      "deletable": false,
      "copyable": true
    },
    "ext": {
      "category": "qc"
    }
  }
]
```

#### 3) Get Template Detail

`GET /api/print/templates/{id}`

Note: request body is empty.

| Field                    | Type                 | Required    | Description                                                    |
| ------------------------ | -------------------- | ----------- | -------------------------------------------------------------- |
| `path.id`                | `string`             | Yes         | Path parameter, template unique identifier.                    |
| `id`                     | `string`             | Yes         | Template unique ID.                                            |
| `name`                   | `string`             | Yes         | Template name.                                                 |
| `data`                   | `object`             | Yes         | Template design data used to load canvas.                      |
| `ext.availableVariables` | `VariableTreeItem[]` | Recommended | Template-bound variable tree; used to restore binding on load. |
| `permissions`            | `object`             | Optional    | Permission control fields.                                     |
| `updatedAt`              | `number`             | Recommended | Update timestamp in milliseconds.                              |

Request example:

```http
GET /api/print/templates/tpl_1001 HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
{
  "id": "tpl_1001",
  "name": "A4 Delivery Note",
  "data": {
    "pages": [
      {
        "id": "page_1",
        "elements": []
      }
    ]
  },
  "ext": {
    "availableVariables": [
      {
        "id": "order",
        "label": "Order",
        "children": [
          {
            "id": "order.no",
            "label": "Order No"
          }
        ]
      }
    ]
  },
  "permissions": {
    "editable": true,
    "deletable": true,
    "copyable": true
  },
  "updatedAt": 1715251200000
}
```

#### 4) Save Template (Create/Update)

`POST /api/print/templates`

| Field                              | Type                 | Required            | Description                                                                          |
| ---------------------------------- | -------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `id` (request)                     | `string`             | Yes                 | Always sent; a client-generated uuid for new items.                                  |
| `name` (request)                   | `string`             | Yes                 | Template name.                                                                       |
| `data` (request)                   | `object`             | Yes                 | Template design data.                                                                |
| `updatedAt` (request)              | `number`             | Yes                 | Millisecond timestamp.                                                               |
| `permissions` (request)            | `object`             | Optional            | Reuses the template's existing permissions.                                          |
| `ext` (request)                    | `object`             | Optional            | Template extension container.                                                        |
| `ext.availableVariables` (request) | `VariableTreeItem[]` | Recommended         | Template-bound variable tree; backend should persist as-is.                          |
| `id` (response)                    | `string`             | No                  | May be omitted; the request `id` is used as fallback.                                |
| `ext` (response)                   | `object`             | Recommended         | **Top-level shallow merge**: same keys win from the response; nested objects are not merged deeply. |
| `permissions` (response)           | `object`             | Optional            | Overrides the request permissions.                                                   |
| `<customRootField>` (request root) | Not supported        | No                  | Root-level flattened custom fields are not supported; put custom fields under `ext`. |

Request example:

```http
POST /api/print/templates HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "id": "3f1c2a6e-8b4d-4c9a-9f2e-5d7b1a0c6e33",
  "name": "A6 Shipping Label",
  "updatedAt": 1715337600000,
  "permissions": {
    "editable": true,
    "deletable": true,
    "copyable": true
  },
  "data": {
    "pages": [
      {
        "id": "page_1",
        "elements": []
      }
    ]
  },
  "ext": {
    "availableVariables": [
      {
        "id": "customer.name",
        "label": "Customer Name"
      }
    ],
    "category": "express"
  }
}
```

Response example:

```json
{
  "id": "tpl_2001",
  "ext": {
    "category": "express",
    "lastOperator": "admin"
  }
}
```

#### 5) Delete Template

`DELETE /api/print/templates/{id}`

Note: request body is empty.

| Field     | Type      | Required | Description                              |
| --------- | --------- | -------- | ---------------------------------------- |
| `path.id` | `string`  | Yes      | Template ID to delete.                   |
| `success` | `boolean` | Optional | The frontend does not read it; any 2xx response is treated as success. |

Request example:

```http
DELETE /api/print/templates/tpl_1001 HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
{
  "success": true
}
```

### Custom Element CRUD Constraints

#### 6) List Custom Elements

`GET /api/print/custom-elements`

Note: request body is empty; response body is a custom-element array. All fields below are list-item fields (item.xxx).

| Field              | Type     | Required | Description                                                            |
| ------------------ | -------- | -------- | ---------------------------------------------------------------------- |
| `item.id`          | `string` | Required | Element unique ID; items with a non-string value are filtered out.      |
| `item.name`        | `string` | Required | Element name; items with a non-string value are filtered out.           |
| `item.element`     | `object` | Required | Element definition. On first load with no cache, items without it are filtered out; when a cache exists it falls back to the cached value. |
| `item.testData`    | `object` | Optional | Element test data; returned with the list and kept.                     |
| `item.updatedAt`   | `number` | Optional | Timestamp in milliseconds. The frontend currently does not keep it.      |
| `item.permissions` | `object` | Optional | Permission control fields.                                             |
| `item.ext`         | `object` | Optional | Extension data.                                                        |

Request example:

```http
GET /api/print/custom-elements HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
[
  {
    "id": "ce_1001",
    "name": "Standard Barcode",
    "element": {
      "type": "barcode",
      "width": 220,
      "height": 80
    },
    "updatedAt": 1715251200000,
    "permissions": {
      "editable": true,
      "deletable": true,
      "copyable": true
    },
    "ext": {
      "category": "barcode"
    }
  }
]
```

#### 7) Get Custom Element Detail

`GET /api/print/custom-elements/{id}`

Note: request body is empty. **The frontend currently never calls this endpoint** (`getCustomElement` reads from memory / the list cache), so it can be implemented as a reserved endpoint.

| Field         | Type     | Required    | Description                              |
| ------------- | -------- | ----------- | ---------------------------------------- |
| `path.id`     | `string` | Yes         | Custom element unique identifier.        |
| `id`          | `string` | Yes         | Element unique ID.                       |
| `name`        | `string` | Yes         | Element name.                            |
| `element`     | `object` | Yes         | Element definition used for render/edit. |
| `permissions` | `object` | Optional    | Permission control fields.               |
| `ext`         | `object` | Optional    | Extension data.                          |
| `updatedAt`   | `number` | Recommended | Update timestamp in milliseconds.        |

Request example:

```http
GET /api/print/custom-elements/ce_1001 HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
{
  "id": "ce_1001",
  "name": "Standard Barcode",
  "element": {
    "id": "el_barcode_1",
    "type": "barcode",
    "x": 20,
    "y": 20,
    "width": 220,
    "height": 80,
    "content": "A001"
  },
  "permissions": {
    "editable": true,
    "deletable": true,
    "copyable": true
  },
  "ext": {
    "category": "barcode"
  },
  "updatedAt": 1715251200000
}
```

#### 8) Save Custom Element (Create/Update)

`POST /api/print/custom-elements`

| Field                              | Type          | Required | Description                                                                          |
| ---------------------------------- | ------------- | -------- | ------------------------------------------------------------------------------------ |
| `id` (request)                     | `string`      | Yes      | Always sent; a client-generated uuid for new items.                                  |
| `name` (request)                   | `string`      | Yes      | Element name.                                                                        |
| `element` (request)                | `object`      | Yes      | Element definition.                                                                  |
| `testData` (request)              | `object`      | Optional | Element test data.                                                                   |
| `permissions` (request)           | `object`      | Optional | Reuses the element's existing permissions.                                           |
| `ext` (request)                    | `object`      | Optional | Element extension container.                                                         |
| `id` (response)                    | `string`      | No       | May be omitted; the request `id` is used as fallback.                                |
| `ext` (response)                   | `object`      | Recommended | **Top-level shallow merge**: same keys win from the response.                       |
| `permissions` (response)          | `object`      | Optional | Overrides the request permissions.                                                   |
| `<customRootField>` (request root) | Not supported | No       | Root-level flattened custom fields are not supported; put custom fields under `ext`. |

Request example:

```http
POST /api/print/custom-elements HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "id": "9a7d4c2b-1e6f-4a0d-8c3b-2f5e9d1a7b64",
  "name": "QRCode Element",
  "element": {
    "type": "qrcode",
    "x": 16,
    "y": 16,
    "width": 100,
    "height": 100,
    "content": "https://example.com/order/1001"
  },
  "testData": {},
  "permissions": {
    "editable": true,
    "deletable": true,
    "copyable": true
  },
  "ext": {
    "category": "qrcode"
  }
}
```

Response example:

```json
{
  "id": "ce_2001",
  "ext": {
    "category": "qrcode",
    "lastOperator": "admin"
  }
}
```

#### 9) Delete Custom Element

`DELETE /api/print/custom-elements/{id}`

Note: request body is empty.

| Field     | Type      | Required | Description                              |
| --------- | --------- | -------- | ---------------------------------------- |
| `path.id` | `string`  | Yes      | Element ID to delete.                    |
| `success` | `boolean` | Optional | The frontend does not read it; any 2xx response is treated as success. |

Request example:

```http
DELETE /api/print/custom-elements/ce_1001 HTTP/1.1
Authorization: Bearer <token>
```

Response example:

```json
{
  "success": true
}
```

### Quick Checklist

- Templates need `list` / `get` / `upsert` / `delete`.
- Custom elements need `list` / `upsert` / `delete`; `customElements.get` may be reserved, but the frontend never calls it.
- List items must contain string `id` and `name`; otherwise they are filtered out.
- Template detail must return `data` and `ext.availableVariables`.
- Every custom-element list item must include `element` (on the first load with no cache, items missing it are filtered out).
- Create/update APIs are recommended to return the real `id`; when omitted, the frontend keeps the `id` sent in the request.
- All extension fields are under `ext` (no root-level flattened custom fields).

## Events

```ts
el.addEventListener("ready", () => {});
el.addEventListener("print", (e) => {});
el.addEventListener("printed", (e) => {
  const { request, result } = e.detail || {};
});
el.addEventListener("export", (e) => {});
el.addEventListener("exported", (e) => {
  const blob = e.detail?.blob;
});
el.addEventListener("preview", (e) => {});
el.addEventListener("previewed", (e) => {
  const { request, result } = e.detail || {};
});
el.addEventListener("progress", (e) => {
  console.log(e.detail?.percent, e.detail?.message);
});
el.addEventListener("error", (e) => {
  console.error(e.detail?.scope, e.detail?.error);
});
```

Event details:

| Event      | Description         | detail               |
| ---------- | ------------------- | -------------------- |
| `ready`    | Component ready     | None                 |
| `print`    | Printing started    | `{ request }`        |
| `printed`  | Printing finished   | `{ request, result }` |
| `preview`  | Client preview started | `{ request }`     |
| `previewed`| Client preview sent | `{ request, result }` |
| `export`   | Export started      | `{ request }`        |
| `exported` | Export finished     | `{ request, blob? }` (`blob` only for `pdfBlob` / `imageBlob`) |
| `progress` | Progress updated    | `DesignerProgressPayload` |
| `error`    | Print/export/preview/batch failed | `{ scope, error }`; see below |

`error.detail.scope` can be: `print`, `export`, `preview`, `getPreviewHtml`, `getBatchPdfBlob`, `exportBatchPdf`, `printBatch`.

## PrintOptions

| Field         | Type                                                           | Required | Description                                   |
| ------------- | -------------------------------------------------------------- | -------- | --------------------------------------------- |
| `printer`     | `string`                                                       | Yes      | Printer name                                  |
| `jobName`     | `string`                                                       | No       | Job name                                      |
| `copies`      | `number`                                                       | No       | Copies                                        |
| `intervalMs`  | `number`                                                       | No       | Interval (ms)                                 |
| `timeout`     | `number`                                                       | No       | Print request timeout (ms), defaults to 30000 |
| `pageRange`   | `string`                                                       | No       | Page range (e.g. `1-2,5`)                     |
| `pageSet`     | `'' \| 'odd' \| 'even'`                                        | No       | Odd/even pages                                |
| `scale`       | `'' \| 'noscale' \| 'shrink' \| 'fit'`                         | No       | Scale mode                                    |
| `orientation` | `'' \| 'portrait' \| 'landscape'`                              | No       | Orientation                                   |
| `colorMode`   | `'' \| 'color' \| 'monochrome'`                                | No       | Color mode                                    |
| `sidesMode`   | `'' \| 'simplex' \| 'duplex' \| 'duplexshort' \| 'duplexlong'` | No       | Duplex mode                                   |
| `paperSize`   | `string`                                                       | No       | Paper size                                    |
| `trayBin`     | `string`                                                       | No       | Tray/bin                                      |

> "Required" above refers to the TypeScript type: except for `timeout`, all fields are required at the type level (empty strings are allowed). At runtime only `local` / `remote` require `printer`; `browser` mode does not read `options` at all.

## Common Scenarios

In actual projects, integration is typically divided into three core scenarios: **Global Initialization**, **Designer Page**, and **Business Print Page**. Below is the standard API calling order and explanation.

### Scenario 1: Global Initialization (Recommended in Entry File)

If you use cloud storage or need uniform styling, it's recommended to configure endpoints and branding during project initialization.

```ts
const el = document.querySelector("print-designer") as any;

// 1. Set branding and language
el.setBranding({ title: "Enterprise Print Center", showTitle: true });
el.setLanguage("en");

// 2. Configure cloud CRUD endpoints first, then switch to remote mode
el.setCrudEndpoints(
  {
    baseUrl: "https://api.your-domain.com",
    templates: {
      list: "/print/templates",
      get: "/print/templates/{id}",
      upsert: "/print/templates",
      delete: "/print/templates/{id}",
    },
    customElements: {
      list: "/print/custom-elements",
      get: "/print/custom-elements/{id}",
      upsert: "/print/custom-elements",
      delete: "/print/custom-elements/{id}",
    },
  },
  {
    headers: { Authorization: "Bearer your-token" },
  },
);
el.setCrudMode("remote");

// 3. Set default print options (e.g., default to silent print)
el.setPrintDefaults({
  printMode: "local",
  silentPrint: true,
});
```

### Scenario 2: Designer Page (Creating or Editing Templates)

On pages dedicated to template design, the focus is on loading templates and setting test data for preview.

```ts
const el = document.querySelector("print-designer") as any;

// 1. If editing an existing template, load it by ID (relies on CRUD endpoints from Scenario 1)
// loadTemplate is synchronous and only reports whether loading started; in remote mode the canvas updates after the detail response arrives
el.loadTemplate("tpl_123");

// 2. Set test data so users can preview variable rendering during design
await el.setTestData({
  orderNo: "TEST-0001",
  customerName: "John Doe",
  items: [{ name: "Product A", qty: 2 }],
});

// 3. (Optional) Configure custom form to control the modal when users click "Save"
el.setTemplateModalForm({
  edit: {
    fields: [
      { key: "name", label: "Template Name", type: "input", required: true },
      { key: "remark", label: "Remark", type: "textarea" },
    ],
  },
});

// 4. User completes the design in the UI and clicks save (internally calls the upsert API)
```

### Scenario 3: Business Page Print / Export (Actual Business Operation)

On specific business pages (like order details), you usually just silently load the template, fill in real data, and execute printing without showing the designer UI.

```ts
const el = document.querySelector("print-designer") as any;

// 1. Load target template (can be pre-fetched JSON or loaded by ID)
el.loadTemplate("tpl_123"); // synchronous boolean; the canvas updates after the remote detail response
// Or: el.loadTemplateData(templateJsonData)

// 2. Inject real business variable data (takes priority over test data)
await el.setVariables({
  orderNo: "REAL-20231025-001",
  customerName: "Acme Corp",
  items: [
    { name: "Real Product A", qty: 10 },
    { name: "Real Product B", qty: 5 },
  ],
});

// 3. Set print quality (Optional, affects image clarity)
el.setPrintQuality("high");

// 4. Execute Print or Export PDF
// Silent print requires silentPrint from setPrintDefaults and a local / remote mode
await el.print({ mode: "local" });

// Or export as PDF Blob and handle it yourself (e.g., upload to server)
const pdfBlob = await el.export({ type: "pdfBlob" });
console.log("Generated PDF size:", pdfBlob.size);
```

### Scenario 4: Headless Mode Silent Printing

Description: If you do not want to keep any hidden template DOM on the page, or purely call it silently in the background, you can enable headless mode. The designer UI will be completely hidden. This mode is suitable for scenarios where you only need to silently call print or export APIs in business pages without displaying the designer UI. It can also be set via the HTML attribute `headless="true"`.

```html
<!-- Enable headless mode via attribute -->
<print-designer id="designer" lang="en" headless></print-designer>
```

```ts
const el = document.querySelector("print-designer") as any;

// Load the template or data to be printed
el.loadTemplate("tpl_123"); // synchronous boolean; the canvas updates after the remote detail response
await el.setVariables({ orderNo: "REAL-20231025-002" });

// Silent print in headless mode: silentPrint comes from setPrintDefaults, not PrintOptions
await el.print({ mode: "local" }); // requires setPrintDefaults({ printMode: 'local', silentPrint: true })
// browser mode does not read options and cannot print silently; it only opens the system print dialog

// Or call PDF export
await el.export({
  type: "pdf",
  filename: "export.pdf",
});
```

## Template and Custom Element JSON Examples

> Note: the template example below is the complete "template record" structure (including `id` / `name`). `getTemplateData()` only returns the canvas part (`pages`, `canvasSize`, `testData`, `ext.availableVariables`, etc.) without `id` / `name`; `loadTemplateData()` likewise only needs the canvas part.

**Template Data**

```json
{
  "id": "tpl_1",
  "name": "A4 Template",
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
  "watermark": {
    "enabled": false,
    "text": "",
    "angle": -30,
    "color": "#000000",
    "opacity": 0.1,
    "size": 24,
    "density": 160
  },
  "testData": { "orderNo": "A001" },
  "ext": {
    "templateModalForm": {
      "create": { "category": "standard", "scope": "private", "priority": 1 },
      "edit": { "scope": "team" },
      "copy": { "category": "shipment", "priority": 2 },
      "lastMode": "copy",
      "updatedAt": 1700000000000
    }
  }
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
- When current template has `editable=false`, designer enters template-level read-only mode (drag/resize/property edit/page operations are disabled).
- Permission checks run in both UI and Store/API layers to prevent bypass via external method calls.