# Web Components API Guide

## Contents

- [Quick Start](#quick-start)
- [API Index](#api-index)
- [Instance Methods and Parameters](#instance-methods-and-parameters)
  - [Initialization (Recommended)](#initialization-recommended)
  - [1. Execute Print (print)](#1-execute-print-print)
  - [2. Export PDF/Images (export)](#2-export-pdfimages-export)
  - [3. Set Default Print Options (setPrintDefaults)](#3-set-default-print-options-setprintdefaults)
  - [4. Get Printers and Clients (fetchPrinters)](#4-get-printers-and-clients-fetchprinters)
  - [5. Set Branding Info (setBranding)](#5-set-branding-info-setbranding)
  - [6. Set Brand Colors (setBrandVars)](#6-set-brand-colors-setbrandvars)
  - [7. Set Theme (setTheme)](#7-set-theme-settheme)
  - [8. Set Designer Font (setDesignerFont)](#8-set-designer-font-setdesignerfont)
  - [9. Set and Get Variables (setVariables / getVariables)](#9-set-and-get-variables-setvariables--getvariables)
  - [10. Get and Load Template Data (getTemplateData / loadTemplateData)](#10-get-and-load-template-data-gettemplatedata--loadtemplatedatadata)
  - [11. Template CRUD Operations (getTemplates / getTemplate / upsertTemplate / deleteTemplate)](#11-template-crud-operations-gettemplates--gettemplate--upserttemplate--deletetemplate)
  - [12. Custom Element CRUD Operations (getCustomElements / getCustomElement / upsertCustomElement / deleteCustomElement)](#12-custom-element-crud-operations-getcustomelements--getcustomelement--upsertcustomelement--deletecustomelement)
  - [13. Set CRUD Mode (setCrudMode)](#13-set-crud-mode-setcrudmode)
  - [14. Configure Cloud CRUD Endpoints (setCrudEndpoints)](#14-configure-cloud-crud-endpoints-setcrudendpoints)
  - [15. Set Language (setLanguage)](#15-set-language-setlanguage)
  - [16. Configure Client and Cloud Print Links (setLinks)](#16-configure-client-and-cloud-print-links-setlinks)
  - [17. Configure Extension Menu (setContextMenu)](#17-configure-extension-menu-setcontextmenu)
  - [18. Configure Template Modal Custom Form (setTemplateModalForm)](#18-configure-template-modal-custom-form-settemplatemodalform)
  - [19. Configure Template List Tag Extension (setTemplateTagResolver)](#19-configure-template-list-tag-extension-settemplatetagresolver)
- [Events](#events)
- [PrintOptions](#printoptions)
- [Common Scenarios](#common-scenarios)
- [Backend API Specifications](#backend-api-specifications)
- [Notes](#notes)

## API Index

| Method | Description |
| --- | --- |
| `print(request)` | Execute print |
| `export(request)` | Export PDF/Images |
| `setPrintDefaults(payload)` | Set default print options |
| `fetchLocalPrinters()` | Get local printer list |
| `fetchLocalPrinterCaps(printer)` | Get local printer capabilities |
| `fetchRemoteClients()` | Get remote print client list |
| `fetchRemotePrinters(clientId)` | Get remote printer list |
| `setBranding(payload)` | Set branding (Title/Logo) |
| `setBrandVars(vars)` | Set brand colors |
| `setTheme(theme)` | Set theme (light/dark) |
| `setDesignerFont(fontFamily)` | Set designer font |
| `setVariables(vars)` | Set variable data |
| `getVariables()` | Get variable data |
| `loadTemplateData(data)` | Load template data |
| `getTemplateData()` | Get current template data |
| `getTemplates()` | Get template list |
| `refreshTemplates()` | Refresh template list |
| `getTemplate(id)` | Get template details |
| `upsertTemplate(template)` | Create/Update template |
| `deleteTemplate(id)` | Delete template |
| `getCustomElements()` | Get custom element list |
| `refreshCustomElements()` | Refresh custom element list |
| `getCustomElement(id)` | Get custom element details |
| `upsertCustomElement(element)` | Create/Update custom element |
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

### 2. Export PDF/Images (export)

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

### 3. Set Default Print Options (setPrintDefaults)

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

### 4. Get Printers and Clients (fetchPrinters)

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

### 5. Set Branding Info (setBranding)

Description: set title, logo, and visibility.

```ts
el.setBranding({
  title: 'Business Print Designer',
  logoUrl: 'https://example.com/logo.png',
  showTitle: true,
  showLogo: true
})
```

### 6. Set Brand Colors (setBrandVars)

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

### 7. Set Theme (setTheme)

Description: switch theme.

```ts
el.setTheme('light')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `theme` | `'light' \| 'dark' \| 'system'` | Yes | Theme mode |

### 8. Set Designer Font (setDesignerFont)

Description: set designer font family. Pass an empty string to reset to default inherited font.

```ts
el.setDesignerFont('"Microsoft YaHei", "PingFang SC", sans-serif', { persist: true })
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fontFamily` | `string` | Yes | Font family string |
| `options.persist` | `boolean` | No | Persist to local storage |

### 9. Set and Get Variables (setVariables / getVariables)

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

### 10. Get and Load Template Data (getTemplateData / loadTemplateData)

Description: read/write current template data.

```ts
const data = el.getTemplateData()
el.loadTemplateData({ id: 'tpl_1', name: 'A4 Template', data })
```

### 11. Templates CRUD Operations

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
```

#### 4) Create or Update Template (upsertTemplate)
Description: Save or update template data. It acts as a create operation if no `id` is provided, otherwise it's an update.
```ts
const id = await el.upsertTemplate({ name: 'A4 Template', data: { pages: [] } }, { setCurrent: true })
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
el.setTemplates([{ id: 't1', name: 'T1', data: {} }])
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

### 12. Custom Elements CRUD Operations

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

### 13. Set CRUD Mode (setCrudMode)

Description: switch CRUD mode.

```ts
el.setCrudMode('local')
el.setCrudMode('remote')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `'local' \| 'remote'` | Yes | CRUD mode |

### 14. Configure Cloud CRUD Endpoints (setCrudEndpoints)

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

### 15. Set Language (setLanguage)

Description: switch language. You can also use `lang="en"` attribute to set initial language.

```ts
el.setLanguage('en')
el.setLanguage('zh')
```

Parameters:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `lang` | `'zh' \| 'en'` | Yes | Language code |

### 16. Configure Client and Cloud Print Links (setLinks)

Description: Configure the client download link and cloud print link in the settings modal, or hide them. Can also be set via HTML attributes `client-url`, `cloud-url`, `hide-links`, `hide-client-link`, `hide-cloud-link`.

```ts
el.setClientLink('https://example.com/client.zip')
el.setCloudLink('https://example.com/cloud-print')
el.hideLinks(true) // Hide all links
el.hideClientLink(true) // Hide client download link only
el.hideCloudLink(true) // Hide cloud print link only
```

### 17. Configure Extension Menu (setContextMenu)

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
      // icon: '🚀', // Optional: Text or emoji
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

For `setCustomElementContextMenu` (Custom Element List):
- `editElement`: Edit Element (Icon: `material-symbols:edit`)
- `testData`: Test Data (Icon: `material-symbols:data-object`)
- `edit`: Edit (Icon: `material-symbols:edit`)
- `copy`: Copy (Icon: `material-symbols:content-copy`)
- `delete`: Delete (Icon: `material-symbols:delete`)

### 18. Configure Template Modal Custom Form (setTemplateModalForm)

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
| `config.create/edit/copy` | `TemplateModalConfigItem` | No | Config for create/edit/copy modal |
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
el.loadTemplateData({ id: 'tpl_1', name: 'A4 Template', data: /* API data */ })
el.setVariables({ orderNo: 'A001' }, { merge: true })
```

**Business page print/export**

```ts
const el = document.querySelector('print-designer') as any
await el.print({ mode: 'browser' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
```

## Backend API Specifications

When integrating with the designer's cloud CRUD capabilities, your backend services **MUST strictly adhere** to the following data structure specifications:

**1) List templates**

`GET /api/print/templates`

Ordering rule (Remote CRUD): the frontend renders the template list strictly in the order returned by this API, and no longer reorders by `updatedAt` or copy actions on the client side.  
So the backend must return a **stable, business-expected** order (e.g. `displayOrder ASC, id ASC`), otherwise the visible order will change with API responses.

Response:

```json
[
  {
    "id": "tpl_1",
    "name": "A4 Template",
    "ext": {
      "templateTags": [
        { "key": "system", "label": "System", "color": "blue" }
      ]
    },
    "updatedAt": 1700000000000
  }
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

**3) Save template (create/update)**

`POST /api/print/templates`

Request:

```json
{
  "id": "tpl_1",
  "name": "A4 Template",
  "data": { "pages": [], "canvasSize": { "width": 794, "height": 1123 } },
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

**3.1) Template ext Round-Trip and Load Contract (Custom Form)**

- To ensure custom form values can be echoed after save, backend should persist and return the `ext` field in template objects as-is.
- Recommended path: `ext.templateModalForm.{create|edit|copy}` where each value stores the latest submitted extended form values for that mode (excluding `name`).
- `GET /templates/{id}` should return the latest `ext.templateModalForm`; frontend uses it for `edit/copy` modal echo.
- Returning `ext` in `GET /templates` list response is optional but recommended to reduce first-open differences.
- If backend does not return `ext`, frontend still works and falls back to `setTemplateModalForm(...).initialValues`.
- Convention: All template extension parameters must be placed inside the `ext` object. Appending custom parameters to the root level of the template is no longer supported.

**3.2) Template Tag Data Return Guidelines (Template List Tags)**

- The template list tags directly read `template.ext.templateTags`.
- If you want to display business tags in the template list, please provide the following structure in the `ext` field returned by the backend:
  ```json
  "templateTags": [
    { "key": "system", "label": "System", "color": "blue" }
  ]
  ```
- Color Rules: Supports built-in semantic colors (`white/red/blue/green/orange`) or CSS color values. When no color is passed, the default gray style will be used.

**4) Delete template**

`DELETE /api/print/templates/{id}`

Response:

```json
{ "success": true }
```

**5) List custom elements**

`GET /api/print/custom-elements`

Note: To ensure custom elements are visible in the left list and can be edited directly, each item in this list response must include the `element` field. Returning only `id/name` will be filtered out by the frontend.

Response:

```json
[
  {
    "id": "ce_1",
    "name": "Barcode Element",
    "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } },
    "ext": {
      "customField": "value"
    },
    "updatedAt": 1700000000000
  }
]
```

**6) Get custom element**

`GET /api/print/custom-elements/{id}`

Response:

```json
{
  "id": "ce_1",
  "name": "Barcode Element",
  "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } },
  "ext": {
    "customField": "value"
  },
  "updatedAt": 1700000000000
}
```

**7) Save custom element (create/update)**

`POST /api/print/custom-elements`

Request:

```json
{
  "id": "ce_1",
  "name": "Barcode Element",
  "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } },
  "ext": {
    "customField": "value"
  }
}
```

- Convention: All custom element extension parameters must be placed inside the `ext` object. Appending custom parameters to the root level is no longer supported.

**8) Delete custom element**

`DELETE /api/print/custom-elements/{id}`

Response:

```json
{ "success": true }
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
