# Web Components API Guide

## Contents

- [Quick Start](#quick-start)
- [API Index](#api-index)
- [Instance Methods and Parameters](#instance-methods-and-parameters)
  - [Initialization (Recommended)](#initialization-recommended)
  - [Initialization Parameters (Suggested)](#initialization-parameters-suggested)
  - [1. Execute Print (print)](#1-execute-print-print)
  - [2. Export PDF/Images/HTML (export)](#2-export-pdfimageshtml-export)
  - [3. Generate and Get HTML Preview Code (getPreviewHtml)](#3-generate-and-get-html-preview-code-getpreviewhtml)
  - [4. Set Default Print Options (setPrintDefaults)](#4-set-default-print-options-setprintdefaults)
  - [5. Print Quality Settings (getPrintQuality/setPrintQuality)](#5-print-quality-settings-getprintqualitysetprintquality)
  - [6. Get Printers and Clients (fetchPrinters)](#6-get-printers-and-clients-fetchprinters)
  - [7. Set Branding Info (setBranding)](#7-set-branding-info-setbranding)
  - [8. Set Brand Colors (setBrandVars)](#8-set-brand-colors-setbrandvars)
  - [9. Set Theme (setTheme)](#9-set-theme-settheme)
  - [10. Set Designer Font (setDesignerFont)](#10-set-designer-font-setdesignerfont)
  - [11. Set and Get Test Data (setTestData / getTestData)](#11-set-and-get-test-data-settestdata--gettestdata)
  - [12. Set and Get Variables (setVariables / getVariables)](#12-set-and-get-variables-setvariables--getvariables)
  - [13. Extract Template Variables (getTemplateVariables)](#13-extract-template-variables-gettemplatevariables)
  - [14. Get and Load Template Data (getTemplateData / loadTemplateData)](#14-get-and-load-template-data-gettemplatedata--loadtemplatedata)
  - [15. Template CRUD Operations](#15-template-crud-operations)
  - [16. Custom Elements CRUD Operations](#16-custom-elements-crud-operations)
  - [17. Set CRUD Mode (setCrudMode)](#17-set-crud-mode-setcrudmode)
  - [18. Configure Cloud CRUD Endpoints (setCrudEndpoints)](#18-configure-cloud-crud-endpoints-setcrudendpoints)
  - [19. Set Language (setLanguage)](#19-set-language-setlanguage)
  - [20. Configure Client and Cloud Print Links (setLinks)](#20-configure-client-and-cloud-print-links-setlinks)
  - [21. Configure Extension Menu (setContextMenu)](#21-configure-extension-menu-setcontextmenu)
  - [22. Configure Template Modal Custom Form (setTemplateModalForm)](#22-configure-template-modal-custom-form-settemplatemodalform)
  - [23. Configure Custom Element Modal Custom Form (setCustomElementModalForm)](#23-configure-custom-element-modal-custom-form-setcustomelementmodalform)
  - [24. Configure Template List Tag Extension (setTemplateTagResolver)](#24-configure-template-list-tag-extension-settemplatetagresolver)

- [Backend API Specifications](#backend-api-specifications)
  - [Overview](#overview)
  - [Common Fields](#common-fields)
  - [Template CRUD Constraints](#template-crud-constraints)
    - [1) List Templates](#1-list-templates)
    - [2) Get Template Detail](#2-get-template-detail)
    - [3) Save Template (Create/Update)](#3-save-template-createupdate)
    - [4) Delete Template](#4-delete-template)
  - [Custom Element CRUD Constraints](#custom-element-crud-constraints)
    - [5) List Custom Elements](#5-list-custom-elements)
    - [6) Get Custom Element Detail](#6-get-custom-element-detail)
    - [7) Save Custom Element (Create/Update)](#7-save-custom-element-createupdate)
    - [8) Delete Custom Element](#8-delete-custom-element)
  - [Generic ext Constraints](#generic-ext-constraints)
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

| Method | Description |
| --- | --- |
| `print(request)` | Execute print |
| `export(request)` | Export PDF/Images/HTML |
| `getPreviewHtml()` | Generate and get HTML preview code |
| `setPrintDefaults(payload)` | Set default print options |
| `getPrintQuality()` | Get current print quality |
| `setPrintQuality(quality)` | Set print quality |
| `fetchLocalPrinters()` | Get local printer list |
| `fetchLocalPrinterCaps(printer)` | Get local printer capabilities |
| `fetchRemoteClients()` | Get remote print client list |
| `fetchRemotePrinters(clientId)` | Get remote printer list |
| `setBranding(payload)` | Set branding (Title/Logo) |
| `setBrandVars(vars)` | Set brand colors |
| `setTheme(theme)` | Set theme (light/dark) |
| `setDesignerFont(fontFamily)` | Set designer font |
| `setTestData(data)` | Set test data |
| `getTestData()` | Get test data |
| `setVariables(vars)` | Set variable data |
| `getVariables()` | Get variable data |
| `getTemplateVariables()` | Extract used variables and generate default data structure |
| `loadTemplateData(data)` | Load template data |
| `getTemplateData()` | Get current template data |
| `getTemplates()` | Get template list |
| `refreshTemplates()` | Refresh template list |
| `getTemplate(id)` | Get template details |
| `upsertTemplate(template)` | Create/Update template |
| `setTemplates(templates)` | Set template list directly |
| `deleteTemplate(id)` | Delete template |
| `loadTemplate(id)` | Load specific template |
| `getCustomElements()` | Get custom element list |
| `refreshCustomElements()` | Refresh custom element list |
| `getCustomElement(id)` | Get custom element details |
| `upsertCustomElement(element)` | Create/Update custom element |
| `setCustomElements(elements)` | Set custom element list directly |
| `deleteCustomElement(id)` | Delete custom element |
| `setCrudMode(mode)` | Set CRUD mode (local/remote) |
| `setCrudEndpoints(endpoints)` | Set remote API endpoints |
| `setLanguage(lang)` | Set language |
| `setClientLink(url)` | Set client download link |
| `setCloudLink(url)` | Set cloud print link |
| `hideLinks(hide)` | Hide/Show all links |
| `hideClientLink(hide)` | Hide/Show client download link |
| `hideCloudLink(hide)` | Hide/Show cloud print link |
| `setTemplateContextMenu(config)` | Configure template list extension menu |
| `clearTemplateContextMenu()` | Restore default template list extension menu |
| `setCustomElementContextMenu(config)` | Configure custom element list extension menu |
| `clearCustomElementContextMenu()` | Restore default custom element list extension menu |
| `setTemplateModalForm(config)` | Configure custom forms for create/edit/copy template modals |
| `clearTemplateModalForm()` | Clear template modal custom form configuration |
| `setCustomElementModalForm(config)` | Configure custom forms for create/edit custom element modals |
| `clearCustomElementModalForm()` | Clear custom element modal custom form configuration |

## Quick Start

Install:

```bash
npm i vue-print-designer
```

Import in your entry file:

```ts
// main.ts
import 'vue-print-designer'
import 'vue-print-designer/style.css'
```

> **Note for Older Webpack Versions**
> If you are using an older build tool (like Webpack 4 or early vue-cli), it might fail to resolve modules/styles because it doesn't support the `exports` field in `package.json`, or throw errors when compiling dependencies with ES6+ syntax.
> 
> **Solution 1: Use Full Path Imports**
> ```ts
> import 'vue-print-designer/dist/print-designer.es.js'
> import 'vue-print-designer/dist/print-designer.css'
> ```
> 
> **Solution 2: Configure Babel Transpilation**
> If you encounter syntax errors (like optional chaining `?.`), please add the component to `transpileDependencies` in your `vue.config.js` for Babel transpilation:
> ```js
> module.exports = {
>   transpileDependencies: [
>     'vue-print-designer'
>   ]
> }
> ```

Use the custom element:

```html
<print-designer id="designer" lang="en"></print-designer>
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
| `setDesignerFont` | `fontFamily` | `string` | Yes | Designer font family |
| `setDesignerFont` | `options.persist` | `boolean` | No | Persist to local storage |

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

**3.1) Printer and Client Queries (Local/Remote)**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `fetchLocalPrinters` | - | - | No | Get Client Printer list |
| `fetchLocalPrinterCaps` | `printer` | `string` | Yes | Get local printer capabilities |
| `fetchRemoteClients` | - | - | No | Get remote print client list |
| `fetchRemotePrinters` | `clientId` | `string` | No | Get remote printer list |

**4) Remote CRUD (Optional)**

| Method | Param | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `setCrudEndpoints` | `endpoints` | `CrudEndpoints` | Yes | CRUD endpoints |
| `setCrudEndpoints` | `options.baseUrl` | `string` | No | Base URL |
| `setCrudEndpoints` | `options.headers` | `Record<string, string>` | No | Request headers |
| `setCrudMode` | `mode` | `'local' \| 'remote'` | Yes | CRUD mode |

### 1. Execute Print (print)

Description: Execute the print operation. This method returns a Promise, allowing you to `await` the completion of the print task or catch exceptions. If `mode` is omitted, the default print mode configured in the component will be used. Upon successful printing, the Promise resolves and returns the status object (containing fields like `status`) provided by the underlying client or browser.

```ts
try {
  const result = await el.print({
    mode: 'local', // Supports 'browser', 'local', 'remote'
    options: {
      printer: 'HP LaserJet',
      copies: 2,
      pageRange: '1-2',
      orientation: 'portrait'
    }
  });
  console.log('Print task executed successfully! Return status:', result);
} catch (error) {
  console.error('Print failed:', error.message);
}
```

**Parameters:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'browser' \| 'local' \| 'remote'` | No | Print mode. If omitted, the default mode is used. |
| `options` | `PrintOptions` | No | Print options (see "Print Options Detail" below) |

**Promise Behavior across different `mode`s:**
- **`browser`**: Invokes the browser's native print dialog (e.g., `window.print()`). Due to browser security restrictions, the frontend cannot determine whether the user clicked "Print" or "Cancel", so the Promise usually resolves immediately after the dialog is invoked, returning `{ status: 'success', mode: 'browser' }`.
- **`local`**: Sends the print task to the local print client (e.g., `printdot-client`) via WebSocket. The Promise will **keep waiting** until the local client successfully sends the task to the printer (or the system print queue) and returns a confirmation ACK. It will then resolve and return the ACK message object (e.g. `{ status: 'success', ... }`). If no confirmation is received within the default timeout (30 seconds) or an error occurs, the Promise will be rejected.
- **`remote`**: Submits the print task to a remote cloud print service. The Promise resolves once the cloud service successfully receives the task, returning the full response data from the cloud API.

### 2. Export PDF/Images/HTML (export)

Description: export PDF/images/HTML or return Blob/text.

```ts
await el.export({ type: 'pdf', filename: 'order.pdf' })
await el.export({ type: 'images', filenamePrefix: 'order' })
await el.export({ type: 'html', filename: 'order.html' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
const imageBlob = await el.export({ type: 'imageBlob' })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `'pdf' \| 'images' \| 'pdfBlob' \| 'imageBlob' \| 'html'` | Yes | Export type |
| `filename` | `string` | No | PDF/HTML filename |
| `filenamePrefix` | `string` | No | Image filename prefix |
| `merged` | `boolean` | No | Merge images or not |

### 3. Generate and Get HTML Preview Code (getPreviewHtml)

Description: Get the current rendered HTML result string of the designer, which can be used for custom preview or rendering.

```ts
const htmlStr = await el.getPreviewHtml()
console.log('Preview HTML:', htmlStr)
```

Returns: `Promise<string>` containing the complete generated HTML string (including styles and page elements).

### 4. Set Default Print Options (setPrintDefaults)

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

### 5. Print Quality Settings (getPrintQuality/setPrintQuality)

Description: Get or set the print and export rendering quality.
**Note**: You must call `setPrintQuality` **before** calling `print` or `export` methods for the settings to take effect.

```ts
// Get current print quality
const quality = el.getPrintQuality()

// Set print quality ('fast', 'normal', 'high', 'ultra')
el.setPrintQuality('high')

// Call print or export after setting the quality
await el.export({ type: 'pdf' })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `quality` | `string` | Yes | The print quality tier (`'fast'`, `'normal'`, `'high'`, `'ultra'`) |

### 6. Get Printers and Clients (fetchPrinters)

Description: query printers, printer capabilities, and clients for local/remote print modes.

```ts
const localPrinters = await el.fetchLocalPrinters()
const localCaps = await el.fetchLocalPrinterCaps(localPrinters[0]?.name || '')

const clients = await el.fetchRemoteClients()
const remotePrinters = await el.fetchRemotePrinters(clients[0]?.client_id)
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `printer` | `string` | Yes | Local printer name (for `fetchLocalPrinterCaps`) |
| `clientId` | `string` | No | Remote client ID (for `fetchRemotePrinters`) |

### 7. Set Branding Info (setBranding)

Description: set title, logo, and visibility.

```ts
el.setBranding({
  title: 'Business Print Designer',
  logoUrl: 'https://example.com/logo.png',
  showTitle: true,
  showLogo: true
})
```

### 8. Set Brand Colors (setBrandVars)

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

### 9. Set Theme (setTheme)

Description: switch theme.

```ts
el.setTheme('light')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | Yes | Theme mode |

### 10. Set Designer Font (setDesignerFont)

Description: set designer font family. Pass an empty string to reset to default inherited font.

```ts
el.setDesignerFont('"Microsoft YaHei", "PingFang SC", sans-serif', { persist: true })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fontFamily` | `string` | Yes | Font family string |
| `options.persist` | `boolean` | No | Persist to local storage |

### 11. Set and Get Test Data (setTestData / getTestData)

Description: set or get the test data for the current template (mainly used for previewing and testing in the designer).

```ts
el.setTestData({ orderNo: 'A001' }, { merge: true })
const testData = el.getTestData()
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `data` | `Record<string, any>` | Yes | Data object |
| `options.merge` | `boolean` | No | Merge or overwrite |

### 12. Set and Get Variables (setVariables / getVariables)

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

### 13. Extract Template Variables (getTemplateVariables)

Description: Extract variables used in the current template and generate a data structure with default values.

```ts
const templateVars = el.getTemplateVariables()
console.log('Variables structure for current template:', templateVars)
```

### 14. Get and Load Template Data (getTemplateData / loadTemplateData)

Description: read/write current template data. In addition to `data`, template-level variable bindings are supported via `ext.availableVariables`.

```ts
const tpl = el.getTemplateData()
// tpl.ext.availableVariables is the bound variable tree for this template

el.loadTemplateData({
  id: 'tpl_1',
  name: 'A4 Template',
  data: tpl.data,
  ext: {
    availableVariables: [
      { id: 'customer', label: 'Customer', children: [{ id: 'customer.name', label: 'Customer Name' }] }
    ]
  }
})
```

Parameters (`loadTemplateData`):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Template ID |
| `name` | `string` | No | Template name |
| `data` | `TemplateData` | Yes | Template canvas data |
| `ext.availableVariables` | `VariableTreeItem[]` | No | Template-bound variable tree |

### 15. Template CRUD Operations

#### 1) Get Template List (getTemplates)

```ts
const list = el.getTemplates({ includeData: false })
```
Parameter `options.includeData` (`boolean`): Whether to include detailed template data in the list. Default is `false`.

#### 2) Refresh Template List (refreshTemplates)

```ts
const list = await el.refreshTemplates({ includeData: false })
```
Parameter `options.includeData` (`boolean`): Whether to include detailed template data in the list. Default is `false`.

#### 3) Get Template Details (getTemplate)
Description: Get detailed data of a template by ID.
```ts
const detail = el.getTemplate('template-id')
// detail.ext.availableVariables is the template-bound variable tree
```

#### 4) Create or Update Template (upsertTemplate)
Description: Save or update template data. It acts as a create operation if no `id` is provided, otherwise it's an update.
```ts
const id = await el.upsertTemplate({
  name: 'A4 Template',
  data: { pages: [] },
  ext: {
    availableVariables: [
      { id: 'customer', label: 'Customer', children: [{ id: 'customer.name', label: 'Customer Name' }] }
    ]
  }
}, { setCurrent: true })
```
Parameter `options.setCurrent` (`boolean`): Whether to automatically set it as the current canvas template after saving.
Permission behavior (read-only template):
- If target template has `editable=false`, update is blocked and `upsertTemplate` returns `null`.
- If target template is editable, method returns template ID.

#### 5) Delete Template (deleteTemplate)
Description: Delete a specific template by ID.
```ts
await el.deleteTemplate('template-id')
```
Permission behavior (protected template):
- If target template has `deletable=false`, delete is blocked and template remains in list.

#### 6) Overwrite Template List (setTemplates)
Description: Overwrite the locally stored template list directly.
```ts
el.setTemplates([
  {
    id: 't1',
    name: 'T1',
    data: {},
    ext: {
      availableVariables: [{ id: 'customer.name', label: 'Customer Name' }]
    }
  }
])
```
Parameter `options.currentTemplateId` (`string`): Optional, set the currently active template ID after overwriting.

#### 7) Load Template to Canvas (loadTemplate)
Description: Load the corresponding template data into the current designer canvas by ID.
```ts
el.loadTemplate('template-id')
```

#### 8) Template Permissions Configuration (permissions)
Description: You can configure the following fields within the `permissions` object of the template to control operations in the designer.
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

### 16. Custom Elements CRUD Operations

#### 1) Get Custom Element List (getCustomElements)

```ts
const list = el.getCustomElements({ includeElement: false })
```
Parameter `options.includeElement` (`boolean`): Whether to include detailed element configuration data in the list. Default is `false`.

#### 2) Refresh Custom Element List (refreshCustomElements)

```ts
const list = await el.refreshCustomElements({ includeElement: false })
```
Parameter `options.includeElement` (`boolean`): Whether to include detailed element configuration data in the list. Default is `false`.

#### 3) Get Custom Element Details (getCustomElement)
Description: Get detailed data of a custom element by ID.
```ts
const detail = el.getCustomElement('element-id')
```

#### 4) Create or Update Custom Element (upsertCustomElement)
Description: Save or update a custom element.
```ts
const id = await el.upsertCustomElement({ name: 'Barcode', element: { /* element data */ } })
```
Permission behavior (read-only custom element):
- If target element has `editable=false`, update is blocked and `upsertCustomElement` returns `null`.
- If target element is editable, method returns element ID.

#### 5) Delete Custom Element (deleteCustomElement)
Description: Delete a specific custom element by ID.
```ts
el.deleteCustomElement('element-id')
```
Permission behavior (protected custom element):
- If target element has `deletable=false`, delete is blocked and element remains in list.

#### 6) Overwrite Custom Element List (setCustomElements)
Description: Overwrite the locally stored custom element list directly.
```ts
el.setCustomElements([{ id: 'c1', name: 'C1', element: { /* element data */ } }])
```

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

### 17. Set CRUD Mode (setCrudMode)

Description: switch CRUD mode.

```ts
el.setCrudMode('local')
el.setCrudMode('remote')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'local' \| 'remote'` | Yes | CRUD mode |

### 18. Configure Cloud CRUD Endpoints (setCrudEndpoints)

Description: configure CRUD endpoints and headers. Supports passing a simple string URL, or an object to configure `url`, `method`, and additional `data`.

**Highly Customizable URL Note:**
Whichever configuration method you use below, the CRUD `url` is **fully customizable**. The underlying logic is as follows:
1. **Auto Placeholder Replacement**: When executing operations with an ID, the system simply replaces the `{id}` string in your URL with the actual ID. If your backend URL doesn't require `{id}` (e.g., passing via query or body), you can omit it entirely.
2. **Smart Path Resolution**:
   - **Absolute Path**: If your URL contains `http://` or `https://`, the system considers it an absolute path and requests it directly, **completely ignoring the global `baseUrl`** (this is ideal for scenarios where some endpoints need to connect to third-party domains or microservices).
   - **Relative Path**: If your URL starts with `/` or is a plain string, the system considers it a relative path and automatically prepends the globally configured `baseUrl`.

**Method 1: Default configuration (String)**

Pass the endpoint URL directly as a string. The system will use default HTTP request methods (e.g. GET for `list`, POST for `upsert`). The URL can be a relative path (which will automatically append `baseUrl`) or a **full absolute path** (which will automatically ignore `baseUrl`).

```ts
el.setCrudEndpoints({
  baseUrl: 'https://api.example.com', // You can set the global baseUrl here
  templates: {
    list: '/print/templates', // Relative path, actual request: https://api.example.com/print/templates
    get: 'https://other-domain.com/api/print/templates/{id}', // Absolute path, ignores baseUrl
    upsert: '/print/templates',
    delete: '/print/templates/{id}'
  },
  customElements: {
    list: '/print/custom-elements',
    get: 'https://other-domain.com/api/print/custom-elements/{id}',
    upsert: '/print/custom-elements',
    delete: '/print/custom-elements/{id}'
  }
}, { 
  // You can also set baseUrl in options, which has higher priority
  // baseUrl: 'https://your-domain.com', 
  headers: { Authorization: 'Bearer xxx' } 
})
```

**Method 2: Custom configuration (Object)**

If you need to change the HTTP method, you can provide an object containing `url` and `method`. The following example demonstrates how to customize all endpoints as `POST` requests:

*Tip: `url` can be a relative path (which automatically appends `baseUrl`), or a **full absolute URL** (e.g. `https://other-domain.com/...`, which automatically ignores `baseUrl`, convenient for connecting to third-party or microservice APIs).*

```ts
el.setCrudEndpoints({
  templates: {
    list: {
      url: '/api/print/templates/search', // Relative path, automatically appends baseUrl
      method: 'POST' // Change the default GET to POST
    },
    get: {
      url: 'https://other-domain.com/api/print/templates/detail/{id}', // Full absolute URL, ignores baseUrl
      method: 'POST' // Change the default GET to POST
    },
    upsert: {
      url: '/api/print/templates/save',
      method: 'POST' // Explicitly specify POST request
    },
    delete: {
      url: '/api/print/templates/remove/{id}',
      method: 'POST' // Change the default DELETE to POST
    }
  },
  customElements: {
    list: {
      url: 'https://other-domain.com/api/print/custom-elements/search', // Full absolute URL
      method: 'POST'
    },
    get: {
      url: '/api/print/custom-elements/detail/{id}',
      method: 'POST'
    },
    upsert: {
      url: '/api/print/custom-elements/save',
      method: 'POST'
    },
    delete: {
      url: '/api/print/custom-elements/remove/{id}',
      method: 'POST'
    }
  }
}, { 
  baseUrl: 'https://your-domain.com', 
  headers: { 
    Authorization: 'Bearer xxx',
    'X-Tenant-ID': '123'
  } 
})
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `endpoints.baseUrl` | `string` | No | Base URL |
| `endpoints.templates.list` | `EndpointConfig` | No | Template list endpoint |
| `endpoints.templates.get` | `EndpointConfig` | No | Template detail endpoint (`{id}` placeholder) |
| `endpoints.templates.upsert` | `EndpointConfig` | No | Template upsert endpoint |
| `endpoints.templates.delete` | `EndpointConfig` | No | Template delete endpoint (`{id}` placeholder) |
| `endpoints.customElements.list` | `EndpointConfig` | No | Custom element list endpoint |
| `endpoints.customElements.get` | `EndpointConfig` | No | Custom element detail endpoint (`{id}` placeholder) |
| `endpoints.customElements.upsert` | `EndpointConfig` | No | Custom element upsert endpoint |
| `endpoints.customElements.delete` | `EndpointConfig` | No | Custom element delete endpoint (`{id}` placeholder) |
| `options.baseUrl` | `string` | No | Base URL (same as `endpoints.baseUrl`) |
| `options.headers` | `Record<string, string>` | No | Request headers (auth, etc) |

Note: The `EndpointConfig` type is defined as `string | { url: string; method?: string }`. If you need to append extra business data to your requests (such as a tenant ID):
1. **For Query Requests** (e.g., `list`): Please append query parameters directly to the `url`, or handle it via interceptors on the server side.
2. **For Write Requests** (e.g., `upsert`): Please place extra parameters directly into the `ext` field of the entity data object.
3. **For Global Parameters**: It is recommended to pass them uniformly in the request headers by configuring `options.headers` (e.g., `X-Tenant-ID`).

### 19. Set Language (setLanguage)

Description: switch language. You can also use `lang="en"` attribute to set initial language.

```ts
el.setLanguage('en')
el.setLanguage('zh')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `lang` | `'zh' \| 'en'` | Yes | Language code |

### 20. Configure Client and Cloud Print Links (setLinks)

Description: Configure the client download link and cloud print link in the settings modal, or hide them. Can also be set via HTML attributes `client-url`, `cloud-url`, `hide-links`, `hide-client-link`, `hide-cloud-link`.

```ts
el.setClientLink('https://example.com/client.zip')
el.setCloudLink('https://example.com/cloud-print')
el.hideLinks(true) // Hide all links
el.hideClientLink(true) // Hide client download link only
el.hideCloudLink(true) // Hide cloud print link only
```

### 21. Configure Extension Menu (setContextMenu)

Description: Configure the extension menu for the template list and custom element list.
You can choose to append (`append`) to the default menu, or completely replace it (`replace`). When a menu item is clicked, the designer dispatches the custom event `eventName` you configured.

```ts
el.setTemplateContextMenu({
  mode: 'append', // 'append' | 'replace'
  items: [
    {
      key: 'custom-publish',
      label: 'Publish Template',
      icon: 'material-symbols:rocket-launch', // Optional: Iconify name (e.g. material-symbols:edit)
      // icon: '馃殌', // Optional: Text or emoji
      // iconClass: 'fa fa-edit', // Optional: CSS class for icon fonts
      // iconImage: 'https://example.com/icon.png', // Optional: Image URL
      eventName: 'template-custom-publish' // Event to dispatch
    }
  ]
})

el.setCustomElementContextMenu({
  mode: 'replace',
  items: [
    {
      key: 'editElement', // Built-in key to keep the default edit action
      label: 'Edit Element',
      actionKey: 'editElement', // Built-in action
      icon: 'material-symbols:edit'
    },
    {
      key: 'custom-sync',
      label: 'Sync to Cloud',
      eventName: 'custom-element-sync'
    }
  ]
})

// Listen to custom events
el.addEventListener('template-custom-publish', (e) => {
  console.log('Publish template:', e.detail.item)
})
el.addEventListener('custom-element-sync', (e) => {
  console.log('Sync custom element:', e.detail.item)
})
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `config.mode` | `'append' \| 'replace'` | No | Append to or replace the default menu (default: `append`) |
| `config.items` | `Array` | Yes | List of menu items |
| `item.key` | `string` | Yes | Unique key for the menu item |
| `item.label` | `string` | Yes | Display text for the menu item |
| `item.icon` | `string` | No | Text/emoji, or an Iconify name (e.g. `material-symbols:edit`) |
| `item.iconClass` | `string` | No | CSS class for icon fonts (e.g. `fa fa-edit`) |
| `item.iconImage` | `string` | No | URL or Base64 string of an image |
| `item.eventName` | `string` | No | Custom event to dispatch on click |
| `item.actionKey` | `string` | No | Built-in action to trigger |

Note: If `item.icon` uses the `collection:name` format (for example, `material-symbols:content-copy`), it is rendered as an icon. Otherwise it is treated as plain text.
You can browse available `material-symbols` icons here: <https://icon-sets.iconify.design/material-symbols/>.

**Built-in Menu Keys and ActionKeys:**

> **Note on Built-in Icons:** 
> The built-in icons shown below use the `material-symbols` collection from Iconify. 

For `setTemplateContextMenu` (Template List):
- `testData`: Test Data (Icon: `material-symbols:data-object`)
- `edit`: Edit (Icon: `material-symbols:edit`)
- `copy`: Copy (Icon: `material-symbols:content-copy`)
- `delete`: Delete (Icon: `material-symbols:delete`)
- `exportPdf`: Export PDF (Icon: `material-symbols:picture-as-pdf`)
- `exportImage`: Export Image (Icon: `material-symbols:image`)
- `exportHtml`: Export HTML (Icon: `material-symbols:html`)

For `setCustomElementContextMenu` (Custom Element List):
- `editElement`: Edit Element (Icon: `material-symbols:edit`)
- `testData`: Test Data (Icon: `material-symbols:data-object`)
- `edit`: Edit (Icon: `material-symbols:edit`)
- `copy`: Copy (Icon: `material-symbols:content-copy`)
- `delete`: Delete (Icon: `material-symbols:delete`)

### 22. Configure Template Modal Custom Form (setTemplateModalForm)

Description: Configure custom form structure and default values for template `create / edit / copy` modals.

```ts
el.setTemplateModalForm({
  create: {
    fields: [
      { key: 'name', label: 'Name', type: 'input', required: true, placeholder: 'Enter template name' },
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
      { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
      { key: 'publishAt', label: 'Publish Time', type: 'datetime' }
    ],
    initialValues: {
      category: 'standard',
      scope: 'private',
      priority: 1
    }
  },
  edit: {
    fields: [
      { key: 'name', label: 'Name', type: 'input', required: true },
      { key: 'scope', label: 'Visibility', type: 'radio', options: [{ label: 'Private', value: 'private' }, { label: 'Team', value: 'team' }] }
    ]
  },
  copy: {
    fields: [
      { key: 'name', label: 'Name', type: 'input', required: true },
      { key: 'category', label: 'Category', type: 'select', options: [{ label: 'Standard', value: 'standard' }] }
    ]
  }
})

// Clear config and fallback to default single-input modal
el.clearTemplateModalForm()
```

Parameter contract:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `config.create/edit/copy` | `TemplateModalConfigItem` | No | Config for the respective modal |
| `item.fields` | `TemplateModalField[]` | No | Field list; fallback to default input if empty |
| `item.initialValues` | `Record<string, any>` | No | Default initial values (used for create or as fallback for echo) |
| `field.key` | `string` | Yes | Unique field key |
| `field.type` | `'input' \| 'number' \| 'textarea' \| 'select' \| 'radio' \| 'date' \| 'datetime'` | Yes | Field type |
| `field.options` | `Array<{label:string,value:string\|number}>` | Conditionally | Required for `select/radio` |

Behavior notes:

- `name` is still the primary template name field and is used as the name argument for `create/edit/copy`.
- Other fields are sent back as "extended form values" and stored under `ext.templateModalForm` (see Backend API Specifications).
- When opening `edit/copy`, the component prefers `ext.templateModalForm[mode]` from template details for echo, then falls back to `initialValues`.
- `create` uses `initialValues` by default; when not configured, component default behavior applies.

### 23. Configure Custom Element Modal Custom Form (setCustomElementModalForm)

Description: Used to configure the custom form structure and default values for the custom element "Create / Edit" modals.

```ts
el.setCustomElementModalForm({
  create: {
    fields: [
      { key: 'name', label: 'Name', type: 'input', required: true, placeholder: 'Please enter name' },
      { key: 'category', label: 'Category', type: 'select', options: [{ label: 'Barcode', value: 'barcode' }] }
    ]
  },
  edit: {
    fields: [
      { key: 'name', label: 'Name', type: 'input', required: true }
    ]
  }
})

// Clear configuration, restore default single input box modal
el.clearCustomElementModalForm()
```

### 24. Configure Template List Tag Extension (setTemplateTagResolver)

Supports rendering custom tags (such as business status, categories, etc.) for each template in the left-side template list. The tag data is dynamically returned by the callback function you provide, based on the current template data.

```ts
el.setTemplateTagResolver((template) => {
  // Read preset tag array from template extension data (refer to Backend API Specifications)
  const tags = template.ext?.templateTags || []
  
  // You can also dynamically generate tags based on other template fields, for example:
  // if (template.permissions?.copyable) {
  //   tags.push({ key: 'copyable', label: 'Copyable', color: 'green' })
  // }
  
  return tags
})
```

**Returned tag object structure:**

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Unique identifier for the tag |
| `label` | `string` | Display text of the tag |
| `color` | `string` | Tag color. Supports built-in semantic colors (`white`, `red`, `blue`, `green`, `orange`) or valid CSS color values. If not provided, default gray style is used. |

## Backend API Specifications

When integrating with remote CRUD, implement API paths and core fields first, then extend with `ext`. The following structure is concise and implementation-ready.

### Overview

| Resource | Action | Default Method (Customizable) | Path | Description |
| --- | --- | --- | --- | --- |
| Template | List | `GET` | `/api/print/templates` | Template list endpoint. |
| Template | Detail | `GET` | `/api/print/templates/{id}` | Template detail endpoint. |
| Template | Create/Update | `POST` | `/api/print/templates` | Template create/update endpoint. |
| Template | Delete | `DELETE` | `/api/print/templates/{id}` | Template delete endpoint. |
| Custom Element | List | `GET` | `/api/print/custom-elements` | Custom element list endpoint. |
| Custom Element | Detail | `GET` | `/api/print/custom-elements/{id}` | Custom element detail endpoint. |
| Custom Element | Create/Update | `POST` | `/api/print/custom-elements` | Custom element create/update endpoint. |
| Custom Element | Delete | `DELETE` | `/api/print/custom-elements/{id}` | Custom element delete endpoint. |

### Common Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Required for detail/update | Primary key. Can be omitted for create; backend returns the real `id`. |
| `name` | `string` | Required for create/update | Display name. |
| `permissions` | `object` | Optional | Can include `editable/deletable/copyable` to control UI actions. |
| `updatedAt` | `number` | Recommended | Unix timestamp in milliseconds. |
| `ext` | `object` | Recommended | Extension container. See `ext` rules in this section. |
| `success` | `boolean` | Recommended for delete | Delete result flag. |

### Template CRUD Constraints

#### 1) List Templates

`GET /api/print/templates`

Note: request body is empty; response body is a template array. All fields below are list-item fields (item.xxx).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `item.id` | `string` | Recommended | Template unique ID. |
| `item.name` | `string` | Recommended | Template name. |
| `item.updatedAt` | `number` | Recommended | Update timestamp in milliseconds. |
| `item.permissions` | `object` | Optional | Permission control fields. |
| `item.ext` | `object` | Optional | Extension data. |
| `order` | Rule | Yes | Frontend renders in API return order and does not re-sort by `updatedAt` or copy action; backend should return a stable order (e.g. `displayOrder ASC, id ASC`). |

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

#### 2) Get Template Detail

`GET /api/print/templates/{id}`

Note: request body is empty.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path.id` | `string` | Yes | Path parameter, template unique identifier. |
| `id` | `string` | Yes | Template unique ID. |
| `name` | `string` | Yes | Template name. |
| `data` | `object` | Yes | Template design data used to load canvas. |
| `ext.availableVariables` | `VariableTreeItem[]` | Recommended | Template-bound variable tree; used to restore binding on load. |
| `permissions` | `object` | Optional | Permission control fields. |
| `updatedAt` | `number` | Recommended | Update timestamp in milliseconds. |

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

#### 3) Save Template (Create/Update)

`POST /api/print/templates`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` (request) | `string` | Required for update | Template unique ID; omit for create. |
| `name` (request) | `string` | Yes | Template name. |
| `data` (request) | `object` | Yes | Template design data. |
| `ext` (request) | `object` | Optional | Template extension container. |
| `ext.availableVariables` (request) | `VariableTreeItem[]` | Recommended | Template-bound variable tree; backend should persist as-is. |
| `id` (response) | `string` | Yes | Must return real `id` for create flow. |
| `ext` (response) | `object` | Recommended | Backend-appended extension data for frontend merge. |
| `<customRootField>` (request root) | Not supported | No | Root-level flattened custom fields are not supported; put custom fields under `ext`. |

Request example:

```http
POST /api/print/templates HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "A6 Shipping Label",
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

#### 4) Delete Template

`DELETE /api/print/templates/{id}`

Note: request body is empty.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path.id` | `string` | Yes | Template ID to delete. |
| `success` | `boolean` | Recommended | Delete result. `true` indicates success. |

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

#### 5) List Custom Elements

`GET /api/print/custom-elements`

Note: request body is empty; response body is a custom-element array. All fields below are list-item fields (item.xxx).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `item.id` | `string` | Recommended | Element unique ID. |
| `item.name` | `string` | Recommended | Element name. |
| `item.element` | `object` | Yes | Element definition; items without this field are filtered by frontend. |
| `item.updatedAt` | `number` | Recommended | Update timestamp in milliseconds. |
| `item.permissions` | `object` | Optional | Permission control fields. |
| `item.ext` | `object` | Optional | Extension data. |

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

#### 6) Get Custom Element Detail

`GET /api/print/custom-elements/{id}`

Note: request body is empty.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path.id` | `string` | Yes | Custom element unique identifier. |
| `id` | `string` | Yes | Element unique ID. |
| `name` | `string` | Yes | Element name. |
| `element` | `object` | Yes | Element definition used for render/edit. |
| `permissions` | `object` | Optional | Permission control fields. |
| `ext` | `object` | Optional | Extension data. |
| `updatedAt` | `number` | Recommended | Update timestamp in milliseconds. |

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

#### 7) Save Custom Element (Create/Update)

`POST /api/print/custom-elements`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` (request) | `string` | Required for update | Element unique ID; omit for create. |
| `name` (request) | `string` | Yes | Element name. |
| `element` (request) | `object` | Yes | Element definition. |
| `ext` (request) | `object` | Optional | Element extension container. |
| `id` (response) | `string` | Yes | Must return real `id` for create flow. |
| `ext` (response) | `object` | Recommended | Backend-appended extension data for frontend merge. |
| `<customRootField>` (request root) | Not supported | No | Root-level flattened custom fields are not supported; put custom fields under `ext`. |

Request example:

```http
POST /api/print/custom-elements HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "QRCode Element",
  "element": {
    "type": "qrcode",
    "x": 16,
    "y": 16,
    "width": 100,
    "height": 100,
    "content": "https://example.com/order/1001"
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

#### 8) Delete Custom Element

`DELETE /api/print/custom-elements/{id}`

Note: request body is empty.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path.id` | `string` | Yes | Element ID to delete. |
| `success` | `boolean` | Recommended | Delete result. `true` indicates success. |

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

### Generic `ext` Constraints

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ext` | `Record<string, any>` | Recommended | Extension container. Non-object values (`null`, array, string) are treated as empty object on frontend. |
| `ext.templateModalForm` | `Record<string, any>` | Optional | Extended modal-form echo data (shared by template/custom-element flows). |
| `ext.templateTags` | `TemplateListTag[]` | Optional | Template list tag data. |
| `ext.availableVariables` | `VariableTreeItem[]` | Recommended for template | Template-bound variable tree. |
| `ext.<customKey>` | Any JSON value | Optional | Business extension fields (e.g. `ext.customField`, `ext.bizMeta`) are round-tripped and merged by frontend. |
| `<root>.<customKey>` | Not supported | No | Root-level flattened custom extension fields are not supported; place them under `ext`. |
| `ext` merge rule | Rule | Yes | Frontend merges objects by key; arrays use last value wins (no concatenation). Return full arrays for array fields. |

### Quick Checklist

- Both template and custom-element resources expose `list/get/upsert/delete`.
- All create/update APIs return a real `id`.
- Template detail returns both `data` and `ext.availableVariables`.
- Every custom-element list item includes `element`.
- All extension fields are under `ext` (no root-level flattened custom fields).

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
| `timeout` | `number` | No | Print request timeout (ms), defaults to 30000 |
| `pageRange` | `string` | No | Page range (e.g. `1-2,5`) |
| `pageSet` | `'' \| 'odd' \| 'even'` | No | Odd/even pages |
| `scale` | `'' \| 'noscale' \| 'shrink' \| 'fit'` | No | Scale mode |
| `orientation` | `'' \| 'portrait' \| 'landscape'` | No | Orientation |
| `colorMode` | `'' \| 'color' \| 'monochrome'` | No | Color mode |
| `sidesMode` | `'' \| 'simplex' \| 'duplex' \| 'duplexshort' \| 'duplexlong'` | No | Duplex mode |
| `paperSize` | `string` | No | Paper size |
| `trayBin` | `string` | No | Tray/bin |

## Common Scenarios

In actual projects, integration is typically divided into three core scenarios: **Global Initialization**, **Designer Page**, and **Business Print Page**. Below is the standard API calling order and explanation.

### Scenario 1: Global Initialization (Recommended in Entry File)

If you use cloud storage or need uniform styling, it's recommended to configure endpoints and branding during project initialization.

```ts
const el = document.querySelector('print-designer') as any

// 1. Set branding and language
el.setBranding({ title: 'Enterprise Print Center', showTitle: true })
el.setLanguage('en')

// 2. Configure CRUD endpoints for cloud templates and custom elements
el.setCrudMode('remote')
el.setCrudEndpoints({
  baseUrl: 'https://api.your-domain.com',
  templates: {
    list: '/print/templates',
    get: '/print/templates/{id}',
    upsert: '/print/templates',
    delete: '/print/templates/{id}'
  }
}, {
  headers: { Authorization: 'Bearer your-token' }
})

// 3. Set default print options (e.g., default to silent print)
el.setPrintDefaults({
  printMode: 'local',
  silentPrint: true
})
```

### Scenario 2: Designer Page (Creating or Editing Templates)

On pages dedicated to template design, the focus is on loading templates and setting test data for preview.

```ts
const el = document.querySelector('print-designer') as any

// 1. If editing an existing template, load it by ID (relies on CRUD endpoints from Scenario 1)
await el.loadTemplate('tpl_123')

// 2. Set test data so users can preview variable rendering during design
el.setTestData({ 
  orderNo: 'TEST-0001', 
  customerName: 'John Doe',
  items: [{ name: 'Product A', qty: 2 }]
})

// 3. (Optional) Configure custom form to control the modal when users click "Save"
el.setTemplateModalForm({
  edit: {
    fields: [
      { key: 'name', label: 'Template Name', type: 'input', required: true },
      { key: 'remark', label: 'Remark', type: 'textarea' }
    ]
  }
})

// 4. User completes the design in the UI and clicks save (internally calls the upsert API)
```

### Scenario 3: Business Page Print / Export (Actual Business Operation)

On specific business pages (like order details), you usually just silently load the template, fill in real data, and execute printing without showing the designer UI.

```ts
const el = document.querySelector('print-designer') as any

// 1. Load target template (can be pre-fetched JSON or loaded by ID)
await el.loadTemplate('tpl_123')
// Or: el.loadTemplateData(templateJsonData)

// 2. Inject real business variable data (takes priority over test data)
el.setVariables({
  orderNo: 'REAL-20231025-001',
  customerName: 'Acme Corp',
  items: [
    { name: 'Real Product A', qty: 10 },
    { name: 'Real Product B', qty: 5 }
  ]
})

// 3. Set print quality (Optional, affects image clarity)
el.setPrintQuality('high')

// 4. Execute Print or Export PDF
// Execute silent print (using the 'local' mode configured in Scenario 1)
await el.print()

// Or export as PDF Blob and handle it yourself (e.g., upload to server)
const pdfBlob = await el.export({ type: 'pdfBlob' })
console.log('Generated PDF size:', pdfBlob.size)
```

### Scenario 4: Headless Mode Silent Printing

Description: If you do not want to keep any hidden template DOM on the page, or purely call it silently in the background, you can enable headless mode. The designer UI will be completely hidden. This mode is suitable for scenarios where you only need to silently call print or export APIs in business pages without displaying the designer UI. It can also be set via the HTML attribute `headless="true"`.

```html
<!-- Enable headless mode via attribute -->
<print-designer id="designer" lang="en" headless></print-designer>
```

```ts
const el = document.querySelector('print-designer') as any

// Load the template or data to be printed
await el.loadTemplate('tpl_123')
el.setVariables({ orderNo: 'REAL-20231025-002' })

// Call silent print in headless mode
await el.print({
  mode: 'browser',
  options: { silent: true }
})

// Or call PDF export
await el.export({
  type: 'pdf',
  filename: 'export.pdf'
})
```

## Template and Custom Element JSON Examples

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
  "watermark": { "enabled": false, "text": "", "angle": -30, "color": "#000000", "opacity": 0.1, "size": 24, "density": 160 },
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

