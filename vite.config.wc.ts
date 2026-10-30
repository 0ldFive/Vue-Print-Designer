import { defineConfig } from "vite";
import type { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { minify } from "terser";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };
const printDesignerVersion = packageJson.version || "0.0.0";

/**
 * ES 构建专用：Vite 的 `build.minify` 不压缩动态 import 生成的 chunk，
 * 这里在 output 层统一用 terser 压缩（比 Vite 内置流程的压缩率更高）。
 */
const terserEsChunks = (): Plugin => ({
  name: "print-designer:terser-es-chunks",
  async renderChunk(code) {
    const result = await minify(code, {
      ecma: 2020,
      module: true,
      compress: {
        passes: 2,
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
      format: { comments: false },
    });
    return result.code ? { code: result.code, map: null } : null;
  },
});

/**
 * ES 与 UMD 分两次构建：
 * - ES：关闭 Vite 压缩，由 output 插件统一压缩，主 chunk 约 382 KB（gzip）
 * - UMD：保留 Vite 自身的 esbuild 预转换 + terser，单文件体积最小，约 464 KB（gzip）
 * 两次产物输出到同一 dist，UMD 构建时 `emptyOutDir: false` 以保留 ES 产物。
 */
export default defineConfig(({ mode }) => {
  const isUmd = mode === "umd";

  return {
    plugins: [vue(), Icons({ compiler: "vue3" })],
    define: {
      __PRINT_DESIGNER_VERSION__: JSON.stringify(printDesignerVersion),
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      emptyOutDir: !isUmd,
      minify: isUmd ? "terser" : false,
      ...(isUmd
        ? {
            terserOptions: {
              compress: {
                drop_console: true,
                drop_debugger: true,
              },
            },
          }
        : {}),
      lib: {
        entry: fileURLToPath(new URL("./src/web-component.ts", import.meta.url)),
        name: "PrintDesigner",
        formats: [isUmd ? "umd" : "es"],
        fileName: (format) => `print-designer.${format}.js`,
      },
      rollupOptions: {
        output: {
          minifyInternalExports: true,
          manualChunks: undefined,
          ...(isUmd ? {} : { plugins: [terserEsChunks()] }),
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || "";
            if (name.endsWith(".css")) return "print-designer.css";
            return "assets/[name][extname]";
          },
        },
      },
    },
  };
});
