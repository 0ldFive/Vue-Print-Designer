<p align="center">
    <img src="./src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
    中文 | <a href="./docs/en/README.md">English</a>
</p>

Vue Print Designer 是一款可视化打印设计器，面向业务表单、标签、票据、快递单等场景，支持模板化、变量化与多种导出/打印方式。

## 我们解决了什么问题

- 设计与打印链路割裂，模板无法复用，改一个字段要改一堆代码
- 复杂分页（尤其是表格）需要大量手写逻辑
- 业务系统与打印插件的集成成本高、接口不统一、跨框架兼容性差

## 为什么比市面上更好用

很多同类插件要么强耦合框架、要么只提供“导出图片/打印”而缺少工程化能力。我们的优势是：

- **完整设计器**：元素、属性、分页、预览、模板管理一体化
- **可扩展**：模板与自定义元素可以走本地存储，也能接入你的 API
- **跨框架**：Web Components 方式适配 Vue/React/Angular/纯 HTML
- **工程化**：导出 PDF/图片/Blob、打印参数、静默打印、连接配置都可控
- **可维护**：代码结构清晰，便于二次开发与业务定制

## 功能亮点

- 拖拽式页面编辑，支持文本、图片、条码、二维码、表格、形状
- 表格自动分页（支持表头/表尾重复）
- 多页面布局、网格/标尺、缩放与对齐工具
- 导出 PDF/图片/Blob，支持拼接/分片
- 打印参数配置：打印机、份数、页范围、单双面、纸张等
- 模板与自定义元素 CRUD
- Web Components 实例方法与事件回调

## 引入方式一：下载源码自行改造与集成 API

适合有深度定制需求的团队。

```bash
npm install
npm run dev
```

建议接入点：

- 模板 CRUD：`useTemplateStore`（可替换为接口读写）
- 自定义元素 CRUD：`useDesignerStore` 中的 `customElements`
- 变量与模板数据：组件实例方法 `setVariables` / `loadTemplateData`

构建：

```bash
npm run build
```

## 引入方式二：npm 组件（Web Components）

适合任何技术栈（Vue/React/Angular/原生）。

```bash
npm install @your-scope/print-designer
```

### 1) 使用组件

```html
<link rel="stylesheet" href="node_modules/@your-scope/print-designer/dist/print-designer.css" />
<script type="module" src="node_modules/@your-scope/print-designer/dist/print-designer.es.js"></script>

<print-designer id="designer"></print-designer>
```

### 2) 调用实例方法

```ts
const el = document.querySelector('print-designer');

// 打印
await el.print({ mode: 'browser' });

// 导出
const blob = await el.export({ type: 'pdfBlob' });

// 模板与自定义元素
const templates = el.getTemplates({ includeData: false });
el.upsertTemplate({ name: 'A4 模板', data: { pages: [] } }, { setCurrent: true });

// 主题/品牌/变量
el.setBranding({ title: '业务打印设计器', showLogo: true });
el.setTheme('light');
el.setVariables({ orderNo: 'A001' }, { merge: true });
```

### 3) 事件回调

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

## 构建 Web Components 包

```bash
npm run build:wc
```

产物：

- `dist/print-designer.es.js`
- `dist/print-designer.umd.js`
- `dist/print-designer.css`
- `dist/web-component.d.ts`

## License

MIT
