<p align="center">
    <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/src/assets/logo.png" alt="Vue Print Designer" width="96" height="96" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">Visual Print Designer &nbsp;&middot;&nbsp; Labels / Receipts / Forms — All Covered &nbsp;&middot;&nbsp; Silent Print &amp; Cloud Print in One</p>

> **Recent Update:** Removed 6 heavy third-party packages, first-load bundle size reduced by ~**65%**; render engine fully rewritten in-house, single-page render time reduced from ~**300 ms to 80 ms** (−73%); language support expanded 2 → **6**, auto-detected from the browser.

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
    <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/README.md">中文</a> | English
</p>

---

Vue Print Designer is a visual print designer for business forms, labels, receipts, and waybills. It supports templating and variables, provides silent printing and cloud printing, and works with multiple export/print pipelines.

**Live Demo:** [https://0ldfive.github.io/Vue-Print-Designer/](https://0ldfive.github.io/Vue-Print-Designer/)

---

## Community

Join our QQ group for usage discussions, integration tips, and troubleshooting. QQ Group: **1038069636**

<img src="./docs/images/qq_group.jpg" alt="Vue Print Designer QQ Group QR Code (1038069636)" width="120" />

---

## UI Preview

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/1.png" alt="Designer main view" height="180" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2.png" alt="Print preview" height="180" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/3.png" alt="Print parameter settings" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>Designer main view and canvas</b></td>
    <td align="center"><b>Print preview</b></td>
    <td align="center"><b>Print parameter settings</b></td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/4.png" alt="System settings" height="180" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/5.png" alt="Shortcut reference" height="180" /></td>
    <td align="center"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/6.png" alt="Advanced table editing" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>System settings and preferences</b></td>
    <td align="center"><b>Shortcut reference</b></td>
    <td align="center"><b>Advanced table editing</b></td>
  </tr>
</table>

---

## Core Features

- **Visual Design**: Full-featured drag-and-drop designer supporting text / images / tables / barcodes / QR codes / shapes. Includes rulers, grids, and alignment tools.
- **Smart Pagination**: Automatically handles long table pagination with header/footer repetition. No complex manual logic required — what you see is what you get.
- **Cross-Framework**: Built on Web Components, zero-dependency compatibility with Vue / React / Angular / native HTML.
- **Comprehensive Printing**:
  - **Browser Print**: Native preview and print.
  - **Export**: Generate PDF and images (merge / split supported).
  - **Client Print**: Supports **Silent Printing** (direct print without dialogs) and **Cloud Printing** (remote task dispatch).
- **Enterprise Ready**: Supports custom paper sizes, API data integration, template import/export, and fine-grained print parameter control (printer / copies / duplex / DPI).

---

## Companion Print Client (PrintDot Client)

PrintDot Client is the companion desktop app for this project. It connects to your local printers and handles silent print jobs, so you can print straight from the browser without any pop-up dialogs. It provides service control, connection settings, print history, update notifications, and print preview to help you complete the local print workflow.

- **Platforms**: Windows / macOS / Linux
- **Key capabilities**: Automatic device discovery, stable connection & forwarding queue, lightweight background mode, print job history and update notifications
- **Download**: [https://printdot.cc/client](https://printdot.cc/client)

<table width="100%">
  <tr>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-1.png" alt="PrintDot main view" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-2.png" alt="PrintDot settings" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-3.png" alt="PrintDot job history" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-4.png" alt="PrintDot update notification" width="100%" /></td>
    <td align="center" width="20%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-5.png" alt="PrintDot print preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Main view - service control and available printers</b></td>
    <td align="center"><b>Settings - cloud relay and connection config</b></td>
    <td align="center"><b>Job history - task status and retry</b></td>
    <td align="center"><b>Update notification - check for latest client</b></td>
    <td align="center"><b>Print preview - real-time preview in local client</b></td>
  </tr>
</table>

---

## Integration Example

A complete integration example based on **Vue 3 + Element Plus**, demonstrating how to embed the print designer into a real-world business application.

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/11.png" alt="Parameter debugging" height="180" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/12.png" alt="Designer" height="180" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/13.png" alt="Dark mode" height="180" /></td>
  </tr>
  <tr>
    <td align="center"><b>Parameter Debugging</b></td>
    <td align="center"><b>Designer</b></td>
    <td align="center"><b>Dark Mode</b></td>
  </tr>
</table>

- **Repository**: [https://github.com/0ldFive/vue-designer-sample](https://github.com/0ldFive/vue-designer-sample)
- **Live Demo**: [https://0ldfive.github.io/vue-designer-sample/#/designer](https://0ldfive.github.io/vue-designer-sample/#/designer)
- **Tech Stack**: Vue 3, TypeScript, Element Plus, Vite

---

## Quick Start

### Option A: Build from Source and Integrate Your API

Best for teams with deep customization requirements.

#### Requirements

- Node.js >= 16.0.0
- npm >= 7.0.0 or yarn / pnpm

#### Recommended integration points

- Template CRUD: `useTemplateStore` (replace with your API)
- Custom elements CRUD: `customElements` in `useDesignerStore`
- Variables and template data: instance methods `setVariables` / `loadTemplateData`

Custom element extension guide: [custom-element.md](https://printdot.cc/docs)

### Option B: npm Package (Web Components) [Learn Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)

Works with any stack (Vue / React / Angular / Vanilla). Web Components **supports Vue 2** as a custom element — no Vue 2 component adapter required.

Parameters, CRUD, and JSON examples: [Web Components API Guide](https://printdot.cc/docs)

#### Install

```bash
npm i vue-print-designer
# or
pnpm add vue-print-designer
# or
yarn add vue-print-designer
```

#### 1) Use in Vue 3 / Vite

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

#### 2) Separate init from usage (Vue 3 Options API)

**Designer page (init and editing)**

```vue
<script lang="ts">
export default {
  mounted() {
    const el = this.$refs.designerRef as any;
    el.setBranding({ title: "Business Print Designer", showLogo: true });
    el.setTheme("light");
    el.loadTemplateData(/* data from your API */);
    el.setVariables({ orderNo: "A001" }, { merge: true });
  },
};
</script>

<template>
  <print-designer ref="designerRef"></print-designer>
</template>
```

**Business pages (print / export anywhere)**

```ts
const el = document.querySelector("print-designer") as any;

// Print
await el.print({ mode: "browser" });

// Export PDF / image / HTML / Blob
await el.export({ type: "pdf", filename: "order-20240223.pdf" });
await el.export({ type: "html", filename: "order-20240223.html" });
const pdfBlob = await el.export({ type: "pdfBlob" });
```

#### 3) Event listeners

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

## Project Structure

```
src/                      # Project source root
├── App.vue               # Root application component
├── main.ts               # App bootstrap entry
├── style.css             # Global styles
├── web-component.ts      # Web Components registration entry
├── web-component.d.ts    # Web Components type declarations
├── vite-env.d.ts         # Vite environment type declarations
├── assets/               # Static assets
├── components/           # UI and editor components
│   ├── PrintDesigner.vue # Main designer container component
│   ├── canvas/           # Canvas area components
│   ├── common/           # Shared UI components (modals, pickers)
│   ├── elements/         # Print element components (text/image/table)
│   ├── layout/           # Layout components (header/sidebar/panels)
│   ├── print/            # Print rendering components
│   └── properties/       # Property editor components
├── composables/          # Reusable Vue composables
├── constants/            # Constants
├── locales/              # i18n resources
├── stores/               # Pinia stores
├── types/                # Type declarations
└── utils/                # Shared utility functions
    ├── print.ts          # Compatibility export entry
    ├── print/            # Print capability main modules
    │   ├── index.ts      # Print module unified exports
    │   ├── usePrint.ts   # Print/export orchestration entry
    │   ├── dom.ts        # Print-related DOM helpers
    │   ├── printChannel.ts # Local/remote print channels
    │   ├── renderEngine.ts # Render engine compatibility export entry
    │   └── renderEngine/ # Render engine submodules
    │       ├── index.ts  # Render engine composition entry
    │       ├── types.ts  # Shared render types
    │       ├── pagination.ts # Pagination and layout correction logic
    │       ├── iframeRenderer.ts # iframe rendering implementation
    │       └── imageRenderer.ts # Image/PDF rendering implementation
    └── ...               # Other shared utility helpers
```

---

## i18n

Built-in support for 6 languages: Simplified Chinese (zh), Traditional Chinese (zh-Hant), English (en), Japanese (ja), Korean (ko), and German (de). Automatically detected from browser language by default; can also be set via API.

---

## License

AGPL-3.0-only

Please follow [TRADEMARKS.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/TRADEMARKS.md) for brand and logo usage. For removing or replacing branding, see [COMMERCIAL_LICENSE.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/COMMERCIAL_LICENSE.md).
