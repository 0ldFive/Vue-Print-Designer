<p align="center">
    <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/src/assets/logo.png" alt="Vue Print Designer" width="72" height="72" />
</p>

<h1 align="center">Vue Print Designer</h1>

<p align="center">
  <b>Visual Print Designer &nbsp;&middot;&nbsp; Labels / Receipts / Forms — All Covered</b><br/>
  <sub>Templating and variables &nbsp;&middot;&nbsp; Silent print and cloud print in one &nbsp;&middot;&nbsp; Zero-dependency integration for any stack</sub>
</p>

<p align="center">
  <kbd>Labels</kbd> <kbd>Receipts</kbd> <kbd>Forms</kbd> <kbd>Waybills</kbd> <kbd>Silent Print</kbd> <kbd>Cloud Print</kbd> <kbd>RAW Output</kbd>
</p>

<p align="center">
  <a href="https://gitee.com/theGreatOldFive/vue-print-designer/stargazers"><img src="https://gitee.com/theGreatOldFive/vue-print-designer/badge/star.svg?theme=flat" alt="Gitee stars"></a>
  <a href="https://gitee.com/theGreatOldFive/vue-print-designer/members"><img src="https://gitee.com/theGreatOldFive/vue-print-designer/badge/fork.svg?theme=flat" alt="Gitee forks"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/stargazers"><img src="https://img.shields.io/github/stars/0ldFive/Vue-Print-Designer?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/network/members"><img src="https://img.shields.io/github/forks/0ldFive/Vue-Print-Designer?style=flat-square&logo=github" alt="GitHub forks"></a>
  <br/>
  <a href="https://www.npmjs.com/package/vue-print-designer"><img src="https://img.shields.io/npm/dm/vue-print-designer.svg?style=flat-square&logo=npm" alt="NPM Downloads"></a>
  <a href="https://www.npmjs.com/package/vue-print-designer"><img src="https://img.shields.io/npm/v/vue-print-designer.svg?style=flat-square&logo=npm" alt="NPM Version"></a>
  <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/LICENSE"><img src="https://img.shields.io/github/license/0ldFive/Vue-Print-Designer?style=flat-square" alt="License"></a>
  <a target="_blank" href="https://qm.qq.com/cgi-bin/qm/qr?k=n-5GjVjM51eH2XvL71r-R8-72r1A2z0V&jump_from=webapi&authKey=zB6r+Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2/Q2"><img border="0" src="https://img.shields.io/badge/QQ%E7%BE%A4-1038069636-blue.svg?style=flat-square&logo=qq" alt="QQ Group" title="QQ Group"></a>
</p>

<p align="center">
  <a href="https://0ldfive.github.io/Vue-Print-Designer/"><b>Live Demo</b></a>
  &nbsp;&middot;&nbsp;
  <a href="./docs/en/guide/web-components-guide.md"><b>Docs</b></a>
  &nbsp;&middot;&nbsp;
  <a href="https://printdot.cc/client"><b>Client Download</b></a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/0ldFive/vue-designer-sample"><b>Integration Example</b></a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/0ldFive/Vue-Print-Designer/blob/master/README.md">中文</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/1.png" alt="Vue Print Designer main view" width="100%" />
</p>

<p align="center"><sub>Designer main view &nbsp;&middot;&nbsp; canvas / property panel / layer panel</sub></p>

<table width="100%">
  <tr>
    <td align="center" width="20%"><b>−65%</b><br/><sub>First-load bundle size<br/>6 heavy third-party packages removed</sub></td>
    <td align="center" width="20%"><b>300 KB</b><br/><sub>ES bundle size<br/>Web Components build</sub></td>
    <td align="center" width="20%"><b>80 ms</b><br/><sub>Per-page render time<br/>in-house engine, from ~300 ms (−73%)</sub></td>
    <td align="center" width="20%"><b>6</b><br/><sub>Languages built in<br/>auto-detected from the browser</sub></td>
    <td align="center" width="20%"><b>4</b><br/><sub>Label command languages<br/>TSPL / ZPL / ESC-POS / CPCL</sub></td>
  </tr>
</table>

<p align="center"><sub>Drag &amp; drop &nbsp;→&nbsp; bind variables &nbsp;→&nbsp; preview &nbsp;→&nbsp; browser / client / label printer output</sub></p>

---

## At a Glance

<table width="100%">
  <tr>
    <td align="center" width="33%"><b>Design</b><br/><sub>Full-featured drag-and-drop designer with text / images / tables / barcodes / QR codes / shapes, plus rulers, grids and alignment tools.</sub></td>
    <td align="center" width="34%"><b>Print</b><br/><sub>Browser print, PDF and image export, client silent / cloud print, and native RAW label commands.</sub></td>
    <td align="center" width="33%"><b>Integrate</b><br/><sub>Built on Web Components — zero-dependency with Vue / React / Angular / native HTML, Vue 2 included.</sub></td>
  </tr>
</table>

---

## Community

Join our QQ group for usage discussions, integration tips, and troubleshooting. QQ Group: **1038069636**

<p align="center">
  <img src="./docs/images/qq_group.jpg" alt="Vue Print Designer QQ Group QR Code (1038069636)" width="120" />
</p>

---

## Core Features

<table width="100%">
  <tr>
    <td colspan="3" align="center"><b>AI Assistant · generate and edit templates in natural language</b><br/><sub>A built-in natural-language chat panel that generates invoice, delivery note, and waybill templates from a description, with multi-turn edits and image reference input; results appear as a change preview before you apply them to the canvas in one click. Works with OpenAI-compatible endpoints, including self-hosted or third-party model services, with multi-model profiles and advanced sampling parameters.</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><b>Visual Design</b><br/><sub>Drag-and-drop layout with rulers, grids and alignment tools — no more eyeballing element positions.</sub></td>
    <td align="center" width="34%"><b>Smart Pagination</b><br/><sub>Handles long table pagination automatically with header/footer repetition — no complex manual logic, WYSIWYG.</sub></td>
    <td align="center" width="33%"><b>Cross-Framework</b><br/><sub>Packaged as Web Components — drop it into Vue / React / Angular / native HTML as-is.</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><b>Enterprise Ready</b><br/><sub>Custom paper sizes, API data integration, template import/export, and print parameter control (printer / copies / duplex / DPI).</sub></td>
    <td align="center" width="34%"><b>Label Printing</b><br/><sub>Templates become native label commands and go out as RAW data through the system print queue, keeping barcodes and QR codes vector-sharp.</sub></td>
    <td align="center" width="33%"><b>i18n</b><br/><sub>Simplified / Traditional Chinese, English, Japanese, Korean and German — auto-detected from the browser or set via API.</sub></td>
  </tr>
</table>

## UI Preview

<table width="100%">
  <tr>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/3.png?v=2" alt="AI assistant panel" width="100%" /></td>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/6.png?v=2" alt="Template market" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>AI assistant &#183; template generation in natural language</b></td>
    <td align="center"><b>Template market</b></td>
  </tr>
</table>

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/4.png" alt="AI model configuration" width="100%" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/5.png" alt="Shortcut reference" width="100%" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2.png" alt="Print preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>AI assistant &#183; model endpoint setup</b></td>
    <td align="center"><b>Shortcut reference</b></td>
    <td align="center"><b>Print preview</b></td>
  </tr>
</table>

## Print &amp; Export

<table width="100%">
  <tr>
    <td align="center" width="25%"><b>Browser Print</b><br/><sub>Native preview and print</sub></td>
    <td align="center" width="25%"><b>Export</b><br/><sub>PDF and images (merge / split)<br/>plus HTML / Blob</sub></td>
    <td align="center" width="25%"><b>Silent / Cloud Print</b><br/><sub>Direct print without dialogs<br/>remote task dispatch</sub></td>
    <td align="center" width="25%"><b>Label RAW Output</b><br/><sub>Native commands to the system queue<br/>batch and continuous paper</sub></td>
  </tr>
</table>

## Companion Print Client (PrintDot Client)

PrintDot Client is the companion desktop app for this project. It connects to your local printers and handles silent print jobs, so you can print straight from the browser without any pop-up dialogs. It provides service control, connection settings, print history, update notifications, and print preview to help you complete the local print workflow.

<table width="100%">
  <tr>
    <td width="20%"><b>Platforms</b></td>
    <td>Windows / macOS / Linux</td>
  </tr>
  <tr>
    <td><b>Key capabilities</b></td>
    <td>Automatic device discovery, stable connection &amp; forwarding queue, lightweight background mode, print job history and update notifications</td>
  </tr>
  <tr>
    <td><b>Download</b></td>
    <td><a href="https://printdot.cc/client">https://printdot.cc/client</a></td>
  </tr>
</table>

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-1.png" alt="PrintDot main view" width="100%" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-2.png" alt="PrintDot settings" width="100%" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-4.png" alt="PrintDot update notification" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Main view &#183; service control and available printers</b></td>
    <td align="center"><b>Settings &#183; cloud relay and connection config</b></td>
    <td align="center"><b>Update notification &#183; check for latest client</b></td>
  </tr>
</table>

<table width="100%">
  <tr>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-3.png" alt="PrintDot job history" width="100%" /></td>
    <td align="center" width="50%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/2-5.png" alt="PrintDot print preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Job history &#183; task status and retry</b></td>
    <td align="center"><b>Print preview &#183; real-time preview in local client</b></td>
  </tr>
</table>

### Label Printing (Native RAW Commands)

Thermal and thermal-transfer label printers (TSC, Gprinter, Zebra, HPRT, Deli, Xprinter and others) are command-driven devices. Handing them a PDF means rasterizing whole pages: slower output, lower barcode scan rates, and misalignment on custom paper. The client therefore provides a dedicated label path — it parses the designer's template JSON, generates native printer commands, and writes them as RAW data to the system print queue, which the driver passes through untouched.

<table width="100%">
  <tr>
    <td align="center" width="20%"><b>Four command languages</b><br/><sub>TSPL / ZPL / ESC-POS / CPCL, inferred from printer and driver names by default, or set explicitly when detection fails.</sub></td>
    <td align="center" width="20%"><b>Faithful element rendering</b><br/><sub>Text (wrapping, alignment, weight), barcodes, QR codes, tables (merged cells, repeated headers / footers, SUM / AVG / COUNT aggregation), images (dithered to black and white), rectangles / lines / circles, multi-label grids, and free-angle element rotation.</sub></td>
    <td align="center" width="20%"><b>Controllable print options</b><br/><sub>Label width and height in millimetres (height 0 means continuous paper sized to content), DPI, speed, density, gap / black mark / vertical offset; text can be rendered as bitmaps (layout-faithful) or with the printer's built-in fonts (smaller command payloads).</sub></td>
    <td align="center" width="20%"><b>Batch and multi-page</b><br/><sub>One template page equals one label; <code>labels[]</code> submits a whole batch at once, each record with its own copy count and an optional interval between consecutive labels.</sub></td>
    <td align="center" width="20%"><b>Print history</b><br/><sub>Every label job is recorded in the client's print history with printer, copies, status and time, and failed jobs can be retried.</sub></td>
  </tr>
</table>

#### Two entry points

- Send a `print_label` message and forward the template JSON exported by the designer as-is, with no extra processing;
- Tick "Label printing" in the client's print preview window to print locally (the designer's preview mode must be JSON). When a label printer is selected, the command language is detected and enabled automatically, and the result can always be overridden.

#### Rendering Consistency Comparison

The images below show the same 60 × 40 mm warehouse label in three forms: the original output exported from the designer, the firmware simulation produced by Zebra's official Labelary service from the ZPL commands, and the client's local redraw of the same commands. The bottom-right pane overlays all three in red, yellow and blue, so overlapping areas appear deep purple-grey and positions, font sizes and barcode modules can be checked for alignment.

<p align="center">
  <img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/label-compare-comparison.png" alt="Label printing three-way comparison" width="72%" />
</p>

<p align="center"><b>Four panes: designer output / vendor API simulation / client command rendering / three-way overlay</b></p>

<table width="100%">
  <tr>
    <td align="center" width="25%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/label-compare-designer.png" alt="Designer output" width="100%" /></td>
    <td align="center" width="25%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/label-compare-api.png" alt="Vendor API simulation" width="100%" /></td>
    <td align="center" width="25%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/label-compare-local.png" alt="Client command rendering" width="100%" /></td>
    <td align="center" width="25%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/label-compare-overlay.png" alt="Three-way overlay" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Designer output</b></td>
    <td align="center"><b>Vendor API simulation</b></td>
    <td align="center"><b>Client command rendering</b></td>
    <td align="center"><b>Three-way overlay (diff)</b></td>
  </tr>
</table>

> Note: Label paper prints in black and white only, so colour images are converted automatically. Page numbers, watermarks, gradients and shadows are not printed on labels. ESC/POS printers need to support page mode. Text layout stays consistent across computers, with a position error of no more than 0.06 mm at 203 dpi.

---

## Integration Example

A complete integration example based on **Vue 3 + Element Plus**, demonstrating how to embed the print designer into a real-world business application.

<table width="100%">
  <tr>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/11.png" alt="Parameter debugging" width="100%" /></td>
    <td align="center" width="34%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/12.png" alt="Designer" width="100%" /></td>
    <td align="center" width="33%"><img src="https://raw.githubusercontent.com/0ldFive/Vue-Print-Designer/master/docs/images/13.png" alt="Dark mode" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Parameter Debugging</b></td>
    <td align="center"><b>Designer</b></td>
    <td align="center"><b>Dark Mode</b></td>
  </tr>
</table>

<table width="100%">
  <tr>
    <td width="18%"><b>Repository</b></td>
    <td><a href="https://github.com/0ldFive/vue-designer-sample">https://github.com/0ldFive/vue-designer-sample</a></td>
  </tr>
  <tr>
    <td><b>Live Demo</b></td>
    <td><a href="https://0ldfive.github.io/vue-designer-sample/#/designer">https://0ldfive.github.io/vue-designer-sample/#/designer</a></td>
  </tr>
  <tr>
    <td><b>Tech Stack</b></td>
    <td>Vue 3, TypeScript, Element Plus, Vite</td>
  </tr>
</table>

## Quick Start

### Option A: npm Package (Web Components) [Learn Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)

Works with any stack (Vue / React / Angular / Vanilla). Web Components **supports Vue 2** as a custom element — no Vue 2 component adapter required. Parameters, CRUD, and JSON examples: [Web Components API Guide](./docs/en/guide/web-components-guide.md).

```bash
npm i vue-print-designer
# or
pnpm add vue-print-designer
# or
yarn add vue-print-designer
```

<details>
<summary><b>Expand: Vue 3 / Vite integration example</b> (import · init · print / export · events)</summary>

**1) Use in Vue 3 / Vite**

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

**2) Separate init from usage (Vue 3 Options API)**

Designer page (init and editing):

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

Business pages (print / export anywhere):

```ts
const el = document.querySelector("print-designer") as any;

// Print
await el.print({ mode: "browser" });

// Export PDF / image / HTML / Blob
await el.export({ type: "pdf", filename: "order-20240223.pdf" });
await el.export({ type: "html", filename: "order-20240223.html" });
const pdfBlob = await el.export({ type: "pdfBlob" });
```

**3) Event listeners**

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

</details>

### Option B: Build from Source and Integrate Your API

Best for teams with deep customization requirements. Requirements:

- Node.js >= 16.0.0
- npm >= 7.0.0 or yarn / pnpm

Recommended integration points:

- Template CRUD: `useTemplateStore` (replace with your API)
- Custom elements CRUD: `customElements` in `useDesignerStore`
- Variables and template data: instance methods `setVariables` / `loadTemplateData`

Custom element extension guide: [custom-element.md](./docs/en/guide/custom-element.md).

## i18n

Built-in support for 6 languages, automatically detected from the browser language by default and also configurable via API:

<p align="center">
  <kbd>Simplified Chinese zh</kbd> <kbd>Traditional Chinese zh-Hant</kbd> <kbd>English en</kbd> <kbd>Japanese ja</kbd> <kbd>Korean ko</kbd> <kbd>German de</kbd>
</p>

---

## License

AGPL-3.0-only

Please follow [TRADEMARKS.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/TRADEMARKS.md) for brand and logo usage. For removing or replacing branding, see [COMMERCIAL_LICENSE.md](https://github.com/0ldFive/Vue-Print-Designer/blob/master/COMMERCIAL_LICENSE.md).
