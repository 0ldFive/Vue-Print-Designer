<p align="center">
    <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">可视化打印设计器 &nbsp;&middot;&nbsp; 标签 / 票据 / 表单全场景覆盖 &nbsp;&middot;&nbsp; 静默打印与云打印一体化</p>

> **最新优化：** 移除 6 个第三方大包，首次加载体积减少约 **65%**；渲染引擎全链路自研，单页渲染耗时由约 **300 ms 降至 80 ms**（约 −73%）；多语言 2 → **6 种**，浏览器自动适配。

<p align="center">
  <a href="https://gitee.com/theGreatOldFive/vue-print-designer/stargazers"><img src="https://gitee.com/theGreatOldFive/vue-print-designer/badge/star.svg?theme=flat" alt="Gitee stars"></a>
  <a href="https://gitee.com/theGreatOldFive/vue-print-designer/members"><img src="https://gitee.com/theGreatOldFive/vue-print-designer/badge/fork.svg?theme=flat" alt="Gitee forks"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/stargazers"><img src="https://img.shields.io/github/stars/0ldFive/Vue-Print-Designer?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/network/members"><img src="https://img.shields.io/github/forks/0ldFive/Vue-Print-Designer?style=flat-square&logo=github" alt="GitHub forks"></a>
  <a href="https://www.npmjs.com/package/vue-print-designer"><img src="https://img.shields.io/npm/dm/vue-print-designer.svg?style=flat-square&logo=npm" alt="NPM Downloads"></a>
  <a href="https://www.npmjs.com/package/vue-print-designer"><img src="https://img.shields.io/npm/v/vue-print-designer.svg?style=flat-square&logo=npm" alt="NPM Version"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/LICENSE"><img src="https://img.shields.io/github/license/0ldFive/Vue-Print-Designer?style=flat-square" alt="License"></a>
  <a target="_blank" href="https://qm.qq.com/cgi-bin/qm/qr?k=n-5GjVjM51eH2XvL71r-R8-72r1A2z0V&jump_from=webapi&authKey=zB6r+Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2"><img border="0" src="https://img.shields.io/badge/QQ%E7%BE%A4-1038069636-blue.svg?style=flat-square&logo=qq" alt="QQ Group" title="QQ Group"></a>
</p>

<p align="center">
    中文 | <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/README_EN.md">English</a>
</p>

---

Vue Print Designer 是一款可视化打印设计器，面向业务表单、标签、票据、快递单等场景，支持模板化、变量化，并提供静默打印与云打印能力，同时兼容多种导出与打印方式。

**在线演示：** [https://0ldfive.github.io/Vue-Print-Designer/](https://0ldfive.github.io/Vue-Print-Designer/)

---

## 社区交流

欢迎加入 QQ 群，交流功能使用、二次开发与问题排查。QQ 群号：**1038069636**

<img src="./docs/images/qq_group.jpg" alt="Vue Print Designer QQ 群二维码（1038069636）" width="120" />

---

## 界面预览

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/1.png" alt="设计器主界面" height="180" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2.png" alt="打印预览" height="180" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/3.png" alt="打印参数配置" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>设计器主界面与画布视图</b></td>
    <td align="center"><b>打印预览</b></td>
    <td align="center"><b>打印参数配置</b></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/4.png" alt="系统设置" height="180" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/5.png" alt="快捷键说明" height="180" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/6.png" alt="高级表格编辑" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>系统设置与偏好</b></td>
    <td align="center"><b>快捷键说明</b></td>
    <td align="center"><b>高级表格编辑</b></td>
  </tr>
</table>

---

## 核心特性

- **可视化设计**：全功能拖拽设计器，支持文本 / 图片 / 表格 / 条码 / 二维码 / 形状等组件，内置标尺、网格与辅助对齐。
- **智能分页**：自动处理长表格分页，支持表头 / 表尾重复，无需手写复杂逻辑，所见即所得。
- **跨框架支持**：基于 Web Components，零依赖适配 Vue / React / Angular / 原生 HTML 等所有技术栈。
- **全场景打印**：
  - **浏览器打印**：原生预览与打印。
  - **导出**：支持生成 PDF、图片（拼接 / 分片）。
  - **客户端打印**：支持**静默打印**（无弹窗直打）与**云打印**（远程任务下发）。
- **企业级功能**：支持自定义纸张、API 数据对接、模板导入导出及精细的打印参数控制（打印机 / 份数 / 单双面 / DPI）。

---

## 配套打印客户端（PrintDot Client）

PrintDot Client 是本项目的配套桌面客户端，用于连接本地打印机并执行静默打印任务。安装后，即可在浏览器中直接发起打印而无需弹窗确认。它提供服务控制、连接配置、打印记录、版本更新与打印预览等功能，帮助你在本地快速完成打印闭环。

- **支持平台**：Windows / macOS / Linux
- **关键能力**：自动发现并识别设备、稳定连接维护与转发队列、轻量后台运行、打印任务记录与版本更新提示
- **下载地址**：[https://printdot.cc/client](https://printdot.cc/client)

<table width="100%">
  <tr>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-1.png" alt="PrintDot 主界面" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-2.png" alt="PrintDot 设置页面" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-3.png" alt="PrintDot 打印记录" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-4.png" alt="PrintDot 版本更新" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-5.png" alt="PrintDot 打印预览" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>主界面 - 服务控制与可用打印机</b></td>
    <td align="center"><b>设置页面 - 云打印中转与连接配置</b></td>
    <td align="center"><b>打印记录 - 任务状态与重试</b></td>
    <td align="center"><b>版本更新 - 一键检测最新客户端</b></td>
    <td align="center"><b>打印预览 - 本地客户端实时预览</b></td>
  </tr>
</table>

---

## 集成示例

基于 **Vue 3 + Element Plus** 的完整集成示例，演示如何在实际业务系统中嵌入打印设计器。

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/11.png" alt="参数调试" height="180" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/12.png" alt="设计器" height="180" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/13.png" alt="暗色模式" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>参数调试</b></td>
    <td align="center"><b>设计器</b></td>
    <td align="center"><b>暗色模式</b></td>
  </tr>
</table>

- **项目地址**：[https://github.com/0ldFive/vue-designer-sample](https://github.com/0ldFive/vue-designer-sample)
- **在线演示**：[https://0ldfive.github.io/vue-designer-sample/#/designer](https://0ldfive.github.io/vue-designer-sample/#/designer)
- **技术栈**：Vue 3, TypeScript, Element Plus, Vite

---

## 快速开始

### 方式一：下载源码自行改造与集成 API

适合有深度定制需求的团队。

#### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0 或 yarn / pnpm

#### 建议接入点

- 模板 CRUD：`useTemplateStore`（可替换为接口读写）
- 自定义元素 CRUD：`useDesignerStore` 中的 `customElements`
- 变量与模板数据：组件实例方法 `setVariables` / `loadTemplateData`

自定义元素扩展请查看：[自定义元素扩展指南](https://printdot.cc/docs)

### 方式二：npm 组件（Web Components）[了解 Web Components](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_components)

适合任何技术栈（Vue / React / Angular / 原生）。Web Components 方式**支持 Vue 2**（作为自定义元素使用），无需 Vue 2 组件适配。

详细参数、CRUD 与 JSON 示例请查看：[Web Components API 用户手册](https://printdot.cc/docs)

#### 安装

```bash
npm i vue-print-designer
# 或
pnpm add vue-print-designer
# 或
yarn add vue-print-designer
```

#### 1) 在 Vue 3 / Vite 中使用

```ts
// main.ts
import "vue-print-designer";
import "vue-print-designer/style.css";
```

```vue
<template>
  <print-designer id="designer"></print-designer>
</template>
```

#### 2) 初始化与调用分离（Vue 3 选项式 API）

**设计器页面（初始化与编辑）**

```vue
<script lang="ts">
export default {
  mounted() {
    const el = this.$refs.designerRef as any;
    el.setBranding({ title: "业务打印设计器", showLogo: true });
    el.setTheme("light");
    el.loadTemplateData(/* 从你的 API 获取的数据 */);
    el.setVariables({ orderNo: "A001" }, { merge: true });
  },
};
</script>

<template>
  <print-designer ref="designerRef"></print-designer>
</template>
```

**业务页面（打印 / 导出调用）**

```ts
const el = document.querySelector("print-designer") as any;

// 打印
await el.print({ mode: "browser" });

// 导出 PDF / 图片 / HTML / Blob
await el.export({ type: "pdf", filename: "order-20240223.pdf" });
await el.export({ type: "html", filename: "order-20240223.html" });
const pdfBlob = await el.export({ type: "pdfBlob" });
```

#### 3) 事件监听

```ts
el.addEventListener("ready", () => {});
el.addEventListener("printed", (e) => {});
el.addEventListener("exported", (e) => {
  const blob = e.detail?.blob;
});
el.addEventListener("error", (e) => {
  console.error(e.detail?.scope, e.detail?.error);
});
```

---

## 项目结构

```
src/                      # 项目源码目录
├── App.vue               # 应用根组件
├── main.ts               # 应用启动入口
├── style.css             # 全局样式
├── web-component.ts      # Web Components 注册入口
├── web-component.d.ts    # Web Components 类型声明
├── vite-env.d.ts         # Vite 环境类型声明
├── assets/               # 静态资源
├── components/           # 页面与编辑器组件
│   ├── PrintDesigner.vue # 设计器主容器组件
│   ├── canvas/           # 画布区域组件
│   ├── common/           # 通用组件（弹窗、选择器等）
│   ├── elements/         # 打印元素组件（文本、图片、表格等）
│   ├── layout/           # 布局组件（头部、侧栏、面板等）
│   ├── print/            # 打印渲染组件
│   └── properties/       # 属性配置组件
├── composables/          # 组合式状态与行为封装
├── constants/            # 常量定义
├── locales/              # 国际化语言包
├── stores/               # Pinia 状态管理
├── types/                # 类型声明
└── utils/                # 通用工具函数
    ├── print.ts          # 兼容导出入口
    ├── print/            # 打印能力主目录
    │   ├── index.ts      # 打印模块统一导出
    │   ├── usePrint.ts   # 打印/导出流程编排入口
    │   ├── dom.ts        # 打印相关 DOM 处理工具
    │   ├── printChannel.ts # 本地/远程打印通道
    │   ├── renderEngine.ts # 渲染引擎兼容导出入口
    │   └── renderEngine/ # 渲染引擎子模块目录
    │       ├── index.ts  # 渲染引擎装配入口
    │       ├── types.ts  # 渲染模块共享类型
    │       ├── pagination.ts # 分页算法与布局修正
    │       ├── iframeRenderer.ts # iframe 渲染实现
    │       └── imageRenderer.ts # 图片/PDF 渲染实现
    └── ...               # 其他通用工具函数
```

---

## 国际化

项目内置 6 种语言：中文简体（zh）、中文繁体（zh-Hant）、英文（en）、日文（ja）、韩文（ko）、德文（de），默认根据浏览器语言自动检测，也可通过 API 手动设置。

---

## License

AGPL-3.0-only

品牌与 Logo 使用请遵循 [TRADEMARKS.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/TRADEMARKS.md)。如需移除或替换品牌标识，请参考 [COMMERCIAL_LICENSE.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/COMMERCIAL_LICENSE.md)。
