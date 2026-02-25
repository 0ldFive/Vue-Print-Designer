

<p align="center">
    <img src="./src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
    中文 | <a href="./README_EN.md">English</a>
</p>

Vue Print Designer 是一款可视化打印设计器，面向业务表单、标签、票据、快递单等场景，支持模板化、变量化，并提供静默打印与云打印能力，同时兼容多种导出/打印方式。

## 界面预览

|  |  |
| --- | --- |
| **设计器主界面与画布视图**<br>![设计器主界面](docs/images/1.png) | **打印预览**<br>![打印预览](docs/images/2.png) |
| **打印参数配置**<br>![打印参数](docs/images/3.png) | **系统设置与偏好**<br>![系统设置](docs/images/4.png) |
| **快捷键说明**<br>![快捷键](docs/images/5.png) | **高级表格编辑**<br>![高级表格](docs/images/6.png) |

## 我们解决了什么问题

- 设计与打印链路割裂，模板无法复用，改一个字段要改一堆代码
- 复杂分页（尤其是表格）需要大量手写逻辑
- 业务系统与打印插件的集成成本高、接口不统一、跨框架兼容性差

## 为什么比同类更好用

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
- **静默打印**：支持本地客户端直打，无需人工确认
- **云打印**：支持远程客户端接入与云端下发打印任务

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0 或 yarn / pnpm

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后访问本地服务即可使用设计器。

### 生产构建

```bash
npm run build
```

### 构建 Web Components 包

```bash
npm run build:wc
```

产物说明：

- `dist/print-designer.es.js` - ES 模块版本
- `dist/print-designer.umd.js` - UMD 版本
- `dist/print-designer.css` - 样式文件
- `dist/web-component.d.ts` - TypeScript 类型声明

## 引入方式

### 方式一：下载源码自行改造与集成 API

适合有深度定制需求的团队。

建议接入点：

- 模板 CRUD：`useTemplateStore`（可替换为接口读写）
- 自定义元素 CRUD：`useDesignerStore` 中的 `customElements`
- 变量与模板数据：组件实例方法 `setVariables` / `loadTemplateData`

自定义元素扩展请查看：[自定义元素扩展指南](docs/zh/guide/custom-element.md)

### 方式二：npm 组件（Web Components）

适合任何技术栈（Vue/React/Angular/原生）。Web Components 方式**支持 Vue 2**（作为自定义元素使用），无需 Vue 2 组件适配。

详细参数、CRUD 与 JSON 示例请查看：[Web Components API 用户手册](docs/zh/guide/web-components-guide.md)

```bash
npm i vue-print-designer
```

#### 1) 使用组件（Vue 3 / Vite）

在入口文件中引入：

```ts
// main.ts
import '@your-scope/print-designer';
import '@your-scope/print-designer/style.css';
```

然后在页面里直接使用自定义元素：

```vue
<template>
    <print-designer id="designer"></print-designer>
</template>
```

#### 2) Vue 3 选项式 API：初始化与调用分离

**设计器页（初始化与编辑）**

```vue
<script lang="ts">
export default {
    mounted() {
        const el = this.$refs.designerRef as any;
        // 初始化品牌与主题
        el.setBranding({ title: '业务打印设计器', showLogo: true });
        el.setTheme('light');
        // 初始化模板或变量
        el.loadTemplateData(/* 从你的 API 获取的数据 */);
        el.setVariables({ orderNo: 'A001' }, { merge: true });
    }
};
</script>

<template>
    <print-designer ref="designerRef"></print-designer>
</template>
```

**业务页面（随处调用打印/导出）**

```ts
// 任何页面中只要能拿到元素实例即可
const el = document.querySelector('print-designer') as any;

// 打印
await el.print({ mode: 'browser' });

// 导出 PDF / 图片 / Blob
await el.export({ type: 'pdf', filename: 'order-20240223.pdf' });
const pdfBlob = await el.export({ type: 'pdfBlob' });
```

#### 3) 事件回调

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

## 项目结构

```
src/
├── assets/               # 静态资源（Logo、图标）
├── components/           # Vue 组件
│   ├── canvas/           # 画布组件
│   ├── common/           # 通用组件（颜色选择器、弹窗等）
│   ├── elements/         # 打印元素组件（文本、图片、表格、条码等）
│   ├── layout/           # 布局组件（头部、侧边栏、属性面板等）
│   ├── print/            # 打印渲染组件
│   └── properties/       # 属性配置组件
├── composables/          # Vue 组合式函数
│   ├── useAutoSave.ts    # 自动保存
│   ├── usePrintSettings.ts # 打印设置
│   └── useTheme.ts       # 主题管理
├── constants/            # 常量定义
├── locales/              # 国际化语言包
├── stores/               # Pinia 状态管理
├── types/                # TypeScript 类型声明
├── utils/                # 工具函数
├── web-component.ts      # Web Components 入口
└── main.ts               # 应用入口
```

## 国际化

项目内置中文（zh）和英文（en）语言支持，默认根据浏览器语言自动切换，也可通过 API 手动设置。

## License

Apache-2.0

品牌与 Logo 使用请遵循 [TRADEMARKS.md](TRADEMARKS.md)。如需移除或替换品牌标识，请参考 [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)。