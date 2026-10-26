import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };
const printDesignerVersion = packageJson.version || "0.0.0";

const PROXY_PASS_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);
const PROXY_SKIP_REQUEST_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  // 浏览器会协商 zstd，Node 侧无法解压，转发后客户端只能拿到乱码字节。
  "accept-encoding",
]);

/** 转发任意 AI 服务地址，避开浏览器跨域限制（仅开发服务器可用）。 */
const aiCorsProxy = (): Plugin => ({
  name: "ai-cors-proxy",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/ai-proxy")) {
        next();
        return;
      }
      const target = new URL(req.url, "http://localhost").searchParams.get(
        "url",
      );
      if (!target) {
        res.statusCode = 400;
        res.end("missing url");
        return;
      }
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        Object.entries(req.headers).forEach(([key, value]) => {
          if (!value || PROXY_SKIP_REQUEST_HEADERS.has(key)) return;
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
        });
        // 要求上游返回未压缩的明文，避免 Node 无法解压 zstd 造成乱码。
        headers.set("accept-encoding", "identity");

        // 浏览器中断（例如手动停止生成）时同步中断上游请求，
        // 否则代理与本地模型之间的连接仍在，模型会继续推理到结束。
        const upstreamController = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) upstreamController.abort();
        });

        const upstream = await fetch(target, {
          method: req.method,
          headers,
          body:
            req.method === "GET" || req.method === "HEAD"
              ? undefined
              : Buffer.concat(chunks),
          signal: upstreamController.signal,
        });
        res.statusCode = upstream.status;
        upstream.headers.forEach((value, key) => {
          if (!PROXY_PASS_HEADERS.has(key)) res.setHeader(key, value);
        });
        if (!upstream.body) {
          res.end();
          return;
        }
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (error) {
        // 客户端已断开时不要再写响应，否则会触发 headers already sent。
        if (res.writableEnded || res.destroyed) return;
        res.statusCode = 502;
        res.end(error instanceof Error ? error.message : String(error));
      }
    });
  },
});

/**
 * 本地 mock 的 OpenAI 兼容端点，仅供 /test/ai-builtin-test.html 联调内置模型。
 * - `/mock-ai/v1/chat/completions`：纯 mock，SSE 返回固定模板。
 * - `/mock-ai/host/chat/completions`：模拟宿主后端，服务端持有密钥并转发到真实模型。
 * 只处理 /mock-ai/ 前缀，不参与生产构建。
 */
const aiMockServer = (
  host: { apiKey?: string; baseUrl?: string; models?: string } = {},
): Plugin => {
  let calls = 0;
  const models: string[] = [];
  const hostBaseUrl = String(
    host.baseUrl || "https://api.deepseek.com",
  ).replace(/\/+$/, "");
  const hostApiKey = String(host.apiKey || "").trim();

  /**
   * 宿主维护的模型清单：`DEEPSEEK_MODELS` 用逗号分隔初始化，
   * 运行时可通过 `POST /mock-ai/host/models` 继续追加。
   */
  const hostModels: Array<{
    id: string;
    alias: string;
    model: string;
    baseUrl: string;
  }> = [];
  const addHostModel = (model: string, alias?: string) => {
    const name = String(model || "").trim();
    if (!name) return;
    if (hostModels.some((item) => item.model === name)) return;
    hostModels.push({
      id: `builtin-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      alias: String(alias || "").trim() || name,
      model: name,
      baseUrl: "/mock-ai/host",
    });
  };
  String(host.models || "deepseek-flash")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => addHostModel(item));

  const readBody = async (req: any) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  };

  /** 宿主侧转发：密钥只保留在服务端，浏览器既拿不到也不会上传。 */
  const forwardToHost = async (req: any, res: any) => {
    if (!hostApiKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: { message: "DEEPSEEK_API_KEY is not configured" },
        }),
      );
      return;
    }

    const raw = await readBody(req);
    let model = "";
    try {
      model = String(JSON.parse(raw)?.model || "");
    } catch {
      model = "";
    }
    calls += 1;
    models.push(model);

    // 浏览器中断（停止生成）时同步中断上游请求。
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const upstream = await fetch(`${hostBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hostApiKey}`,
          Accept: "text/event-stream",
          "Accept-Encoding": "identity",
        },
        body: raw,
        signal: controller.signal,
      });
      res.statusCode = upstream.status;
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") || "application/json",
      );
      res.setHeader("Cache-Control", "no-cache");
      if (!upstream.body) {
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  };

  const buildTemplate = (model: string) => ({
    name: "内置模型测试",
    canvasSize: { width: 794, height: 1123 },
    pages: [
      {
        id: "page-ai-mock",
        elements: [
          {
            id: "el-ai-mock-title",
            type: "text",
            x: 60,
            y: 60,
            width: 600,
            height: 48,
            content: `内置模型测试成功：${model}`,
            style: { fontSize: 24, color: "#111827", fontWeight: "600" },
          },
        ],
      },
    ],
  });

  return {
    name: "ai-mock-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/mock-ai/")) {
          next();
          return;
        }

        const pathname = new URL(req.url, "http://localhost").pathname;

        if (pathname === "/mock-ai/stats") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ calls, models }));
          return;
        }

        if (pathname === "/mock-ai/reset") {
          calls = 0;
          models.length = 0;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        // 宿主模型清单：GET 拉取，POST 追加（body: { model, alias? }）。
        if (pathname === "/mock-ai/host/models") {
          if (req.method === "POST") {
            let payload: any = {};
            try {
              payload = JSON.parse(await readBody(req));
            } catch {
              payload = {};
            }
            addHostModel(payload?.model, payload?.alias);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ models: hostModels }));
          return;
        }

        if (pathname === "/mock-ai/host/chat/completions") {
          await forwardToHost(req, res);
          return;
        }

        if (pathname !== "/mock-ai/v1/chat/completions") {
          res.statusCode = 404;
          res.end("not found");
          return;
        }

        let body: any = {};
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          body = {};
        }

        const model = String(body?.model || "");
        calls += 1;
        models.push(model);

        // 模型名带 fail 时返回 401，用于验证错误提示。
        if (/fail/i.test(model)) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: { message: "mock unauthorized" } }));
          return;
        }

        const messages: any[] = Array.isArray(body?.messages)
          ? body.messages
          : [];
        const userText = messages
          .filter((item) => item?.role === "user")
          .map((item) => String(item?.content || ""))
          .join("\n");
        const hasToolResult = messages.some((item) =>
          String(item?.content || "").startsWith("TOOL RESULT"),
        );

        // prompt 含 MULTI 时先回一个动作，等工具结果回灌后再出模板。
        const content =
          /MULTI/i.test(userText) && !hasToolResult
            ? JSON.stringify({
                action: "create_template",
                args: { name: "多轮测试模板" },
              })
            : JSON.stringify(buildTemplate(model));

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const chars = Array.from(content);
        for (let index = 0; index < chars.length; index += 48) {
          const piece = chars.slice(index, index + 48).join("");
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
          );
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        res.write("data: [DONE]\n\n");
        res.end();
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 第三个参数传空串，允许读取不带 VITE_ 前缀的服务端变量（如 DEEPSEEK_API_KEY）。
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: process.env.VITE_BASE ?? "/",
    plugins: [
      vue(),
      Icons({ compiler: "vue3" }),
      aiCorsProxy(),
      aiMockServer({
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: env.DEEPSEEK_BASE_URL,
        models: env.DEEPSEEK_MODELS,
      }),
    ],
    define: {
      __PRINT_DESIGNER_VERSION__: JSON.stringify(printDesignerVersion),
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["vue", "pinia"],
            monaco: ["@guolao/vue-monaco-editor"],
            utils: ["lodash"],
            barcode: ["jsbarcode", "qrcode"],
          },
        },
      },
    },
  };
});
