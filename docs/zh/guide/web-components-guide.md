# Web Components API 用户手册

## 目录

- [快速开始](#快速开始)
- [API 索引](#api-索引)
- [实例方法与参数说明](#实例方法与参数说明)
  - [初始化建议（必读）](#初始化建议必读)
  - [1) print(request)](#1-printrequest)
  - [2) export(request)](#2-exportrequest)
  - [3) setPrintDefaults(payload)](#3-setprintdefaultspayload)
  - [4) fetchLocalPrinters() / fetchLocalPrinterCaps(printer) / fetchRemoteClients() / fetchRemotePrinters(clientId?)](#4-fetchlocalprinters--fetchlocalprintercapsprinter--fetchremoteclients--fetchremoteprintersclientid)
  - [5) setBranding(payload?)](#5-setbrandingpayload)
  - [6) setBrandVars(vars)](#6-setbrandvarsvars)
  - [7) setTheme(theme)](#7-setthemetheme)
  - [8) setDesignerFont(fontFamily)](#8-setdesignerfontfontfamily)
  - [9) setVariables(vars, options?) / getVariables()](#9-setvariablesvars-options--getvariables)
  - [10) getTemplateData() / loadTemplateData(data)](#10-gettemplatedata--loadtemplatedatadata)
  - [11) 模板 CRUD](#11-模板-crud)
  - [12) 自定义元素 CRUD](#12-自定义元素-crud)
  - [13) setCrudMode(mode)](#13-setcrudmodemode)
  - [14) setCrudEndpoints(endpoints, options?)](#14-setcrudendpointsendpoints-options)
  - [15) setLanguage(lang)](#15-setlanguagelang)
  - [16) setClientLink(url) / setCloudLink(url) / hideLinks(hide) / hideClientLink(hide) / hideCloudLink(hide)](#16-setclientlinkurl--setcloudlinkurl--hidelinkshide--hideclientlinkhide--hidecloudlinkhide)
  - [17) setTemplateContextMenu(config) / setCustomElementContextMenu(config)](#17-settemplatecontextmenuconfig--setcustomelementcontextmenuconfig)
- [事件与回调](#事件与回调)
- [PrintOptions](#printoptions)
- [常见场景示例](#常见场景示例)
- [后端接口对接示例](#后端接口对接示例)
- [注意事项](#注意事项)

## API 索引

| 方法名                                   | 说明                |
| ------------------------------------- | ----------------- |
| `print(request)`                      | 执行打印              |
| `export(request)`                     | 导出 PDF/图片         |
| `setPrintDefaults(payload)`           | 设置默认打印参数          |
| `fetchLocalPrinters()`                | 获取本地打印机列表         |
| `fetchLocalPrinterCaps(printer)`      | 获取本地打印机能力         |
| `fetchRemoteClients()`                | 获取云打印客户端列表        |
| `fetchRemotePrinters(clientId)`       | 获取云打印机列表          |
| `setBranding(payload)`                | 设置品牌信息（标题/Logo）   |
| `setBrandVars(vars)`                  | 设置品牌色             |
| `setTheme(theme)`                     | 设置主题（亮/暗）         |
| `setDesignerFont(fontFamily)`         | 设置设计器字体           |
| `setVariables(vars)`                  | 设置变量数据            |
| `getVariables()`                      | 获取变量数据            |
| `loadTemplateData(data)`              | 加载模板数据            |
| `getTemplateData()`                   | 获取当前模板数据          |
| `getTemplates()`                      | 获取模板列表            |
| `getTemplate(id)`                     | 获取模板详情            |
| `upsertTemplate(template)`            | 新增/保存模板           |
| `deleteTemplate(id)`                  | 删除模板              |
| `getCustomElements()`                 | 获取自定义元素列表         |
| `getCustomElement(id)`                | 获取自定义元素详情         |
| `upsertCustomElement(element)`        | 新增/保存自定义元素        |
| `deleteCustomElement(id)`             | 删除自定义元素           |
| `setCrudMode(mode)`                   | 设置 CRUD 模式（本地/远程） |
| `setCrudEndpoints(endpoints)`         | 设置远程接口地址          |
| `setLanguage(lang)`                   | 设置语言              |
| `setClientLink(url)`                  | 设置客户端下载链接         |
| `setCloudLink(url)`                   | 设置云打印链接           |
| `hideLinks(hide)`                     | 隐藏/显示所有链接         |
| `hideClientLink(hide)`                | 隐藏/显示客户端下载链接      |
| `hideCloudLink(hide)`                 | 隐藏/显示云打印链接        |
| `setTemplateContextMenu(config)`      | 配置模版列表右键菜单        |
| `clearTemplateContextMenu()`          | 恢复模版列表默认右键菜单      |
| `setCustomElementContextMenu(config)` | 配置自定义元素列表右键菜单     |
| `clearCustomElementContextMenu()`     | 恢复自定义元素列表默认右键菜单   |

## 快速开始

安装：

```bash
npm i vue-print-designer
```

在入口文件中引入：

```ts
// main.ts
import 'vue-print-designer'
import 'vue-print-designer/style.css'
```

使用自定义元素：

```html
<print-designer id="designer" lang="zh"></print-designer>
```

## 实例方法与参数说明

下面所有方法都挂载在 `print-designer` 元素实例上。

### 初始化建议（必读）

如果你希望“设计器 UI 上的保存/模板/自定义元素”直接走云端，**必须在初始化阶段设置接口与模式**：

```ts
const el = document.querySelector('print-designer') as any

// 1) 配置接口
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

// 2) 切换为云端模式
el.setCrudMode('remote')
```

说明：

- `setCrudEndpoints` 负责配置 API 地址与请求头
- `setCrudMode('remote')` 会让 UI 的保存/删除/加载直接走云端接口
- 若不调用以上两步，默认使用本地存储

### 初始化参数说明（推荐按需配置）

设计器没有强制的“init”方法，但建议在初始化阶段按需调用以下参数：

**1) 品牌与主题**

| 方法                | 参数                | 类型                              | 必填 | 说明        |
| ----------------- | ----------------- | ------------------------------- | -- | --------- |
| `setBranding`     | `title`           | `string`                        | 否  | 标题文本      |
| `setBranding`     | `logoUrl`         | `string`                        | 否  | Logo 地址   |
| `setBranding`     | `showTitle`       | `boolean`                       | 否  | 是否显示标题    |
| `setBranding`     | `showLogo`        | `boolean`                       | 否  | 是否显示 Logo |
| `setBrandVars`    | `vars`            | `Record<string, string>`        | 是  | 主题色变量集合   |
| `setBrandVars`    | `options.persist` | `boolean`                       | 否  | 是否持久化     |
| `setTheme`        | `theme`           | `'light' \| 'dark' \| 'system'` | 是  | 主题模式      |
| `setDesignerFont` | `fontFamily`      | `string`                        | 是  | 设计器字体     |
| `setDesignerFont` | `options.persist` | `boolean`                       | 否  | 是否持久化     |

**2) 模板与变量**

| 方法                 | 参数              | 类型                    | 必填 | 说明                  |
| ------------------ | --------------- | --------------------- | -- | ------------------- |
| `loadTemplateData` | `data`          | `TemplateData`        | 是  | 模板数据（见“模板 JSON 示例”） |
| `setVariables`     | `vars`          | `Record<string, any>` | 是  | 变量对象                |
| `setVariables`     | `options.merge` | `boolean`             | 否  | 合并或覆盖               |

**3) 打印与导出默认值**

| 方法                 | 参数                          | 类型                                 | 必填 | 说明          |
| ------------------ | --------------------------- | ---------------------------------- | -- | ----------- |
| `setPrintDefaults` | `printMode`                 | `'browser' \| 'local' \| 'remote'` | 否  | 默认打印模式      |
| `setPrintDefaults` | `silentPrint`               | `boolean`                          | 否  | 是否静默打印      |
| `setPrintDefaults` | `exportImageMerged`         | `boolean`                          | 否  | 图片是否拼接      |
| `setPrintDefaults` | `localSettings.wsAddress`   | `string`                           | 否  | 本地客户端 WS 地址 |
| `setPrintDefaults` | `localSettings.secretKey`   | `string`                           | 否  | 本地客户端密钥     |
| `setPrintDefaults` | `remoteSettings.wsAddress`  | `string`                           | 否  | 远程 WS 地址    |
| `setPrintDefaults` | `remoteSettings.apiBaseUrl` | `string`                           | 否  | 远程登录 API    |
| `setPrintDefaults` | `remoteSettings.username`   | `string`                           | 否  | 远程账号        |
| `setPrintDefaults` | `remoteSettings.password`   | `string`                           | 否  | 远程密码        |
| `setPrintDefaults` | `localPrintOptions`         | `PrintOptions`                     | 否  | 本地打印参数      |
| `setPrintDefaults` | `remotePrintOptions`        | `PrintOptions`                     | 否  | 远程打印参数      |

**3.1) 打印机与客户端查询（本地/云）**

| 方法                      | 参数         | 类型       | 必填 | 说明           |
| ----------------------- | ---------- | -------- | -- | ------------ |
| `fetchLocalPrinters`    | -          | -        | 否  | 获取本地客户端打印机列表 |
| `fetchLocalPrinterCaps` | `printer`  | `string` | 是  | 获取本地打印机能力    |
| `fetchRemoteClients`    | -          | -        | 否  | 获取云打印客户端列表   |
| `fetchRemotePrinters`   | `clientId` | `string` | 否  | 获取云打印机列表     |

**4) 远程 CRUD（可选）**

| 方法                 | 参数                | 类型                       | 必填 | 说明        |
| ------------------ | ----------------- | ------------------------ | -- | --------- |
| `setCrudEndpoints` | `endpoints`       | `CrudEndpoints`          | 是  | CRUD 接口配置 |
| `setCrudEndpoints` | `options.baseUrl` | `string`                 | 否  | 接口域名      |
| `setCrudEndpoints` | `options.headers` | `Record<string, string>` | 否  | 请求头       |
| `setCrudMode`      | `mode`            | `'local' \| 'remote'`    | 是  | CRUD 模式   |

### 1) print(request?)

说明：执行打印。`mode` 为空时使用默认打印模式。

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

参数：

| 字段        | 类型                                 | 必填 | 说明             |
| --------- | ---------------------------------- | -- | -------------- |
| `mode`    | `'browser' \| 'local' \| 'remote'` | 否  | 打印模式，空则使用默认模式  |
| `options` | `PrintOptions`                     | 否  | 打印参数，见“打印参数明细” |

### 2) export(request)

说明：导出 PDF/图片或返回 Blob。

```ts
await el.export({ type: 'pdf', filename: 'order.pdf' })
await el.export({ type: 'images', filenamePrefix: 'order' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
const imageBlob = await el.export({ type: 'imageBlob' })
```

参数：

| 字段               | 类型                                              | 必填 | 说明      |
| ---------------- | ----------------------------------------------- | -- | ------- |
| `type`           | `'pdf' \| 'images' \| 'pdfBlob' \| 'imageBlob'` | 是  | 导出类型    |
| `filename`       | `string`                                        | 否  | PDF 文件名 |
| `filenamePrefix` | `string`                                        | 否  | 图片前缀    |
| `merged`         | `boolean`                                       | 否  | 图片是否拼接  |

### 3) setPrintDefaults(payload?)

说明：设置默认打印模式、连接参数与打印参数。

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

参数：

| 字段                          | 类型                                 | 必填 | 说明          |
| --------------------------- | ---------------------------------- | -- | ----------- |
| `printMode`                 | `'browser' \| 'local' \| 'remote'` | 否  | 默认打印模式      |
| `silentPrint`               | `boolean`                          | 否  | 是否静默打印      |
| `exportImageMerged`         | `boolean`                          | 否  | 图片是否拼接导出    |
| `localSettings.wsAddress`   | `string`                           | 否  | 本地客户端 WS 地址 |
| `localSettings.secretKey`   | `string`                           | 否  | 本地客户端密钥     |
| `remoteSettings.wsAddress`  | `string`                           | 否  | 远程 WS 地址    |
| `remoteSettings.apiBaseUrl` | `string`                           | 否  | 远程登录 API    |
| `remoteSettings.username`   | `string`                           | 否  | 远程账号        |
| `remoteSettings.password`   | `string`                           | 否  | 远程密码        |
| `localPrintOptions`         | `PrintOptions`                     | 否  | 本地打印参数      |
| `remotePrintOptions`        | `PrintOptions`                     | 否  | 远程打印参数      |

### 4) fetchLocalPrinters() / fetchLocalPrinterCaps(printer) / fetchRemoteClients() / fetchRemotePrinters(clientId?)

说明：用于本地与云打印场景下获取打印机、打印机能力、客户端列表。

```ts
const localPrinters = await el.fetchLocalPrinters()
const localCaps = await el.fetchLocalPrinterCaps(localPrinters[0]?.name || '')

const clients = await el.fetchRemoteClients()
const remotePrinters = await el.fetchRemotePrinters(clients[0]?.client_id)
```

参数：

| 字段         | 类型       | 必填 | 说明                                  |
| ---------- | -------- | -- | ----------------------------------- |
| `printer`  | `string` | 是  | 本地打印机名称（用于 `fetchLocalPrinterCaps`） |
| `clientId` | `string` | 否  | 云客户端 ID（用于 `fetchRemotePrinters`）   |

### 5) setBranding(payload?)

说明：设置标题、logo 以及显示开关。

```ts
el.setBranding({
  title: '业务打印设计器',
  logoUrl: 'https://example.com/logo.png',
  showTitle: true,
  showLogo: true
})
```

### 6) setBrandVars(vars, options?)

说明：设置品牌色 CSS 变量。

```ts
el.setBrandVars({
  '--brand-600': '#1d4ed8',
  '--brand-500': '#3b82f6'
}, { persist: true })
```

参数：

| 字段                | 类型                       | 必填 | 说明         |
| ----------------- | ------------------------ | -- | ---------- |
| `vars`            | `Record<string, string>` | 是  | CSS 变量集合   |
| `options.persist` | `boolean`                | 否  | 是否持久化到本地存储 |

### 7) setTheme(theme)

说明：切换主题。

```ts
el.setTheme('light')
```

参数：

| 字段      | 类型                              | 必填 | 说明   |
| ------- | ------------------------------- | -- | ---- |
| `theme` | `'light' \| 'dark' \| 'system'` | 是  | 主题模式 |

### 8) setDesignerFont(fontFamily, options?)

说明：设置设计器字体。传入空字符串可恢复默认字体继承。

```ts
el.setDesignerFont('"Microsoft YaHei", "PingFang SC", sans-serif', { persist: true })
```

参数：

| 字段                | 类型        | 必填 | 说明         |
| ----------------- | --------- | -- | ---------- |
| `fontFamily`      | `string`  | 是  | 字体族字符串     |
| `options.persist` | `boolean` | 否  | 是否持久化到本地存储 |

### 9) setVariables(vars, options?) / getVariables()

说明：设置或获取变量数据。

```ts
el.setVariables({ orderNo: 'A001' }, { merge: true })
const vars = el.getVariables()
```

参数：

| 字段              | 类型                    | 必填 | 说明    |
| --------------- | --------------------- | -- | ----- |
| `vars`          | `Record<string, any>` | 是  | 变量对象  |
| `options.merge` | `boolean`             | 否  | 合并或覆盖 |

### 10) getTemplateData() / loadTemplateData(data)

说明：读写当前画布模板数据。

```ts
const data = el.getTemplateData()
el.loadTemplateData({ id: 'tpl_1', name: 'A4 模板', data })
```

### 11) 模板 CRUD

```ts
const list = el.getTemplates({ includeData: false })
const detail = el.getTemplate('template-id')

const id = await el.upsertTemplate({ name: 'A4 模板', data: { pages: [] } }, { setCurrent: true })
el.setTemplates([{ id: 't1', name: 'T1', data: {} }])
el.deleteTemplate(id)
el.loadTemplate(id)
```

参数：

| 字段                               | 类型        | 必填 | 说明       |
| -------------------------------- | --------- | -- | -------- |
| `getTemplates.includeData`       | `boolean` | 否  | 是否包含模板数据 |
| `upsertTemplate.setCurrent`      | `boolean` | 否  | 是否设为当前模板 |
| `setTemplates.currentTemplateId` | `string`  | 否  | 当前模板 ID  |

### 12) 自定义元素 CRUD

```ts
const list = el.getCustomElements({ includeElement: false })
const detail = el.getCustomElement('element-id')
const id = await el.upsertCustomElement({ name: 'Barcode', element: { /* element data */ } })

el.setCustomElements([{ id: 'c1', name: 'C1', element: { /* element data */ } }])
el.deleteCustomElement(id)
```

参数：

| 字段                                 | 类型        | 必填 | 说明       |
| ---------------------------------- | --------- | -- | -------- |
| `getCustomElements.includeElement` | `boolean` | 否  | 是否包含元素详情 |

### 13) setCrudMode(mode)

说明：切换 CRUD 模式。

```ts
el.setCrudMode('local')
el.setCrudMode('remote')
```

参数：

| 字段     | 类型                    | 必填 | 说明      |
| ------ | --------------------- | -- | ------- |
| `mode` | `'local' \| 'remote'` | 是  | CRUD 模式 |

### 14) setCrudEndpoints(endpoints, options?)

说明：配置云端 CRUD 接口地址与请求头。

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

参数：

| 字段                                | 类型                       | 必填 | 说明                   |
| --------------------------------- | ------------------------ | -- | -------------------- |
| `endpoints.baseUrl`               | `string`                 | 否  | 接口域名                 |
| `endpoints.templates.list`        | `string`                 | 否  | 模板列表接口               |
| `endpoints.templates.get`         | `string`                 | 否  | 模板详情接口（`{id}` 占位）    |
| `endpoints.templates.upsert`      | `string`                 | 否  | 模板新增/保存接口            |
| `endpoints.templates.delete`      | `string`                 | 否  | 模板删除接口（`{id}` 占位）    |
| `endpoints.customElements.list`   | `string`                 | 否  | 自定义元素列表接口            |
| `endpoints.customElements.get`    | `string`                 | 否  | 自定义元素详情接口（`{id}` 占位） |
| `endpoints.customElements.upsert` | `string`                 | 否  | 自定义元素新增/保存接口         |
| `endpoints.customElements.delete` | `string`                 | 否  | 自定义元素删除接口（`{id}` 占位） |
| `options.baseUrl`                 | `string`                 | 否  | 接口域名（同 baseUrl）      |
| `options.headers`                 | `Record<string, string>` | 否  | 请求头（如鉴权）             |

### 15) setLanguage(lang)

说明：切换语言。也可以通过 HTML 属性 `lang="zh"` 设置初始语言。

```ts
el.setLanguage('zh')
el.setLanguage('en')
```

参数：

| 字段     | 类型             | 必填 | 说明   |
| ------ | -------------- | -- | ---- |
| `lang` | `'zh' \| 'en'` | 是  | 语言代码 |

### 16) setClientLink(url) / setCloudLink(url) / hideLinks(hide) / hideClientLink(hide) / hideCloudLink(hide)

说明：配置设置弹窗中的客户端下载链接与云打印链接，或隐藏它们。也可以通过 HTML 属性 `client-url`, `cloud-url`, `hide-links`, `hide-client-link`, `hide-cloud-link` 设置。

```ts
el.setClientLink('https://example.com/client.zip')
el.setCloudLink('https://example.com/cloud-print')
el.hideLinks(true) // 隐藏所有链接
el.hideClientLink(true) // 仅隐藏客户端下载链接
el.hideCloudLink(true) // 仅隐藏云打印链接
```

参数：

| 字段     | 类型        | 必填 | 说明     |
| ------ | --------- | -- | ------ |
| `url`  | `string`  | 是  | 链接地址   |
| `hide` | `boolean` | 是  | 是否隐藏链接 |

### 17) setTemplateContextMenu(config) / setCustomElementContextMenu(config)

说明：配置模版列表和自定义元素列表的右键菜单。
你可以选择追加（`append`）到默认菜单，或者完全替换（`replace`）。当点击菜单项时，设计器会派发你配置的自定义事件 `eventName`。

```ts
el.setTemplateContextMenu({
  mode: 'append', // 'append' | 'replace'
  items: [
    {
      key: 'custom-publish',
      label: '发布模版',
      icon: '🚀', // 可选：emoji 或 Iconify 字符串
      eventName: 'template-custom-publish' // 点击时派发的事件
    }
  ]
})

el.setCustomElementContextMenu({
  mode: 'replace',
  items: [
    {
      key: 'editElement', // 使用内置 key 可以保留内置动作
      label: '编辑元素',
      actionKey: 'editElement', // 触发内置动作
      icon: '✏️'
    },
    {
      key: 'custom-sync',
      label: '同步到云端',
      eventName: 'custom-element-sync'
    }
  ]
})

// 监听你配置的自定义事件
el.addEventListener('template-custom-publish', (e) => {
  console.log('发布模版:', e.detail.item)
})
el.addEventListener('custom-element-sync', (e) => {
  console.log('同步自定义元素:', e.detail.item)
})
```

参数：

| 字段               | 类型                      | 必填 | 说明                                           |
| ---------------- | ----------------------- | -- | -------------------------------------------- |
| `config.mode`    | `'append' \| 'replace'` | 否  | 追加或替换默认菜单（默认：`append`）                       |
| `config.items`   | `Array`                 | 是  | 菜单项列表                                        |
| `item.key`       | `string`                | 是  | 菜单项唯一标识                                      |
| `item.label`     | `string`                | 是  | 菜单项显示文本                                      |
| `item.icon`      | `string`                | 否  | Emoji 或 Iconify 字符串（如 `lucide:check`）        |
| `item.eventName` | `string`                | 否  | 点击时派发的自定义事件名称                                |
| `item.actionKey` | `string`                | 否  | 触发的内置动作 |

**内置菜单 Key 和 ActionKey 列表：**

对于 `setTemplateContextMenu`（模版列表）：
- `testData`: 测试数据
- `rename`: 重命名
- `copy`: 复制
- `delete`: 删除

对于 `setCustomElementContextMenu`（自定义元素列表）：
- `editElement`: 编辑
- `testData`: 测试数据
- `rename`: 重命名
- `copy`: 复制
- `delete`: 删除

## 事件与回调

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

事件说明：

| 事件         | 说明      | detail               |
| ---------- | ------- | -------------------- |
| `ready`    | 组件初始化完成 | 无                    |
| `print`    | 开始打印    | `{ request }`        |
| `printed`  | 打印完成    | `{ request }`        |
| `export`   | 开始导出    | `{ request }`        |
| `exported` | 导出完成    | `{ request, blob? }` |
| `error`    | 打印/导出失败 | `{ scope, error }`   |

## 打印参数明细

`PrintOptions` 支持字段：

| 字段            | 类型                                                             | 必填 | 说明             |
| ------------- | -------------------------------------------------------------- | -- | -------------- |
| `printer`     | `string`                                                       | 是  | 打印机名称          |
| `jobName`     | `string`                                                       | 否  | 任务名称           |
| `copies`      | `number`                                                       | 否  | 份数             |
| `intervalMs`  | `number`                                                       | 否  | 打印间隔（毫秒）       |
| `pageRange`   | `string`                                                       | 否  | 页码范围，如 `1-2,5` |
| `pageSet`     | `'' \| 'odd' \| 'even'`                                        | 否  | 奇偶页            |
| `scale`       | `'' \| 'noscale' \| 'shrink' \| 'fit'`                         | 否  | 缩放模式           |
| `orientation` | `'' \| 'portrait' \| 'landscape'`                              | 否  | 方向             |
| `colorMode`   | `'' \| 'color' \| 'monochrome'`                                | 否  | 彩色/黑白          |
| `sidesMode`   | `'' \| 'simplex' \| 'duplex' \| 'duplexshort' \| 'duplexlong'` | 否  | 单双面            |
| `paperSize`   | `string`                                                       | 否  | 纸张规格           |
| `trayBin`     | `string`                                                       | 否  | 纸盒             |

## 常见场景示例

**设计器页初始化**

```ts
const el = document.querySelector('print-designer') as any
el.loadTemplateData({ id: 'tpl_1', name: 'A4 模板', data: /* API 返回 */ })
el.setVariables({ orderNo: 'A001' }, { merge: true })
```

**业务页打印/导出**

```ts
const el = document.querySelector('print-designer') as any
await el.print({ mode: 'browser' })
const pdfBlob = await el.export({ type: 'pdfBlob' })
```

## 后端接口对接示例

以下为常见接口约定示例，可按你的系统调整：

**1) 获取模板列表**

`GET /api/print/templates`

返回示例：

```json
[
  { "id": "tpl_1", "name": "A4 模板", "updatedAt": 1700000000000 }
]
```

**2) 获取模板详情**

`GET /api/print/templates/{id}`

返回示例：

```json
{
  "id": "tpl_1",
  "name": "A4 模板",
  "data": { "pages": [], "canvasSize": { "width": 794, "height": 1123 } },
  "updatedAt": 1700000000000
}
```

**3) 保存模板（新增/编辑）**

`POST /api/print/templates`

请求体示例：

```json
{
  "id": "tpl_1",
  "name": "A4 模板",
  "data": { "pages": [], "canvasSize": { "width": 794, "height": 1123 } }
}
```

**4) 删除模板**

`DELETE /api/print/templates/{id}`

返回示例：

```json
{ "success": true }
```

**5) 获取自定义元素列表**

`GET /api/print/custom-elements`

返回示例：

```json
[
  { "id": "ce_1", "name": "条码元素" }
]
```

**6) 获取自定义元素详情**

`GET /api/print/custom-elements/{id}`

返回示例：

```json
{
  "id": "ce_1",
  "name": "条码元素",
  "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } },
  "updatedAt": 1700000000000
}
```

**7) 保存自定义元素（新增/编辑）**

`POST /api/print/custom-elements`

请求体示例：

```json
{
  "id": "ce_1",
  "name": "条码元素",
  "element": { "type": "barcode", "x": 20, "y": 20, "width": 200, "height": 60, "style": { "fontSize": 12 } }
}
```

**8) 删除自定义元素**

`DELETE /api/print/custom-elements/{id}`

返回示例：

```json
{ "success": true }
```

## 模板与自定义元素 JSON 示例

**模板数据（Template Data）**

```json
{
  "id": "tpl_1",
  "name": "A4 模板",
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
          "content": "订单号：{#orderNo}",
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

**自定义元素（Custom Element）**

```json
{
  "id": "ce_1",
  "name": "条码元素",
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

## 注意事项

- Web Components 支持 Vue 2、Vue 3、React、Angular 与原生。
- 本地/云打印需要先配置连接参数。
- 使用 Shadow DOM 时需确保 `print-designer.css` 已加载。

