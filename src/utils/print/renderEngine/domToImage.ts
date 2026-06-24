import { usePrintSettings } from "@/composables/usePrintSettings";
import { deduplicateInlineStyles } from "../dom";
import { buildForeignObjectSvg } from "@/svg/templates";

export interface DomToImageOptions {
  /** 画布背景色，用于 Canvas fillStyle 兜底 */
  canvasBackground: string;
  /** 是否输出渲染调试日志 */
  showRenderDebugLogs?: boolean;
  /** 每页渲染完成回调，用于上报进度 */
  onPageRendered?: (current: number, total: number) => void;
}

/**
 * 将已分好页的 DOM 容器渲染为 JPEG DataURL 数组。
 *
 * 实现路径：DOM 预处理（外部资源内联、canvas→img、inline style 去重）
 * → 序列化为 SVG foreignObject data URI
 * → 绘入 Canvas → toDataURL("image/jpeg")
 * → 按 batchSize 并发执行，减少主线程卡顿。
 */
// 判断（内联）transform 字符串是否包含旋转（rotate()/matrix/matrix3d 非对角分量）。
const transformHasRotation = (transform?: string | null) => {
  if (!transform || transform === "none") return false;
  if (/\brotate/i.test(transform)) return true;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (matrix) {
    const p = matrix[1].split(",").map((v) => Number.parseFloat(v));
    if (p.length >= 4) return Math.abs(p[1]) > 1e-4 || Math.abs(p[2]) > 1e-4;
  }
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3d) {
    const p = matrix3d[1].split(",").map((v) => Number.parseFloat(v));
    if (p.length >= 6) return Math.abs(p[1]) > 1e-4 || Math.abs(p[4]) > 1e-4;
  }
  return false;
};

// 处于旋转上下文中的表格，其外层 overflow:hidden 容器会在 foreignObject→canvas
// 光栅化时把表格右/下外边框裁掉。导出态行列尺寸已固化、内容不会真正溢出，
// 故解除 table 到 page 之间祖先的 overflow 裁剪。仅对旋转表格生效，未旋转零回归。
const unclipRotatedTableAncestors = (page: HTMLElement) => {
  for (const table of Array.from(page.querySelectorAll<HTMLElement>("table"))) {
    const ancestors: HTMLElement[] = [];
    let rotated = false;
    let node: HTMLElement | null = table;
    while (node && node !== page) {
      if (transformHasRotation(node.style.transform)) rotated = true;
      ancestors.push(node);
      node = node.parentElement;
    }
    if (!rotated) continue;
    for (const el of ancestors) {
      el.style.setProperty("overflow", "visible");
    }
  }
};

export const generatePageImages = async (
  container: HTMLElement,
  width: number,
  height: number,
  options: DomToImageOptions,
): Promise<string[]> => {
  const { canvasBackground, showRenderDebugLogs = false, onPageRendered } = options;

  const startTime = performance.now();
  if (showRenderDebugLogs) {
    console.log(
      `[Render Debug] Starting generatePageImages for ${container.children.length} pages`,
    );
  }

  const pages = Array.from(container.children).filter(
    (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
  ) as HTMLElement[];

  pages.forEach((page) => {
    page.style.top = "0px";
  });

  // ─── 关键优化：将 tempHost 从活跃文档中摘除 ───────────────────────────────────
  // processContentForImage 完成后，所有布局测量（getBoundingClientRect、分页计算）
  // 均已结束，容器不再需要挂载到 document.body。
  // 在此处摘除后，后续所有 DOM 变更（deduplicateInlineStyles 改写 2000+ 个元素的
  // className/removeAttribute、canvas→img 替换、link 移除）均在离线子树上执行，
  // 浏览器无需触发任何 Recalculate Style，消除每次调用 ~30-60ms 的隐性开销。
  // 调用方 finally 块里的 tempWrapper.parentNode 检查会因 parentNode===null 而安全跳过。
  const _tempHost = container.parentElement;
  if (_tempHost?.parentElement) {
    _tempHost.parentElement.removeChild(_tempHost);
  }

  const printSettings = usePrintSettings();
  const printQualityStr = printSettings?.printQuality?.value ?? "normal";

  let printQualityScale = 1;
  let jpegQuality = 0.8;
  if (printQualityStr === "fast") {
    printQualityScale = 0.5;
    jpegQuality = 0.6;
  } else if (printQualityStr === "normal") {
    printQualityScale = 1;
    jpegQuality = 0.8;
  } else if (printQualityStr === "high") {
    printQualityScale = 1.5;
    jpegQuality = 0.9;
  } else if (printQualityStr === "ultra") {
    printQualityScale = 2;
    jpegQuality = 1.0;
  }

  // 所有页共享同一个 XMLSerializer，避免每页重复构造。
  const serializer = new XMLSerializer();

  // 修复：使用 Promise 作为缓存，解决同批次(batch)并发执行时引发的缓存击穿（Cache Stampede）和网络请求重复问题
  const externalImageCache = new Map<string, Promise<string>>();

  try {
    // 渲染单页为图片数据。
    const generatePageImage = async (page: HTMLElement): Promise<string> => {
      // 旋转表格光栅化前解除外层 overflow 裁剪，避免右/下外边框被 foreignObject 裁掉。
      unclipRotatedTableAncestors(page);

      // 0+1. 单次遍历完成两件事：移除 link/style + 将 <canvas> 转为 base64 img。
      // 两次独立的 querySelectorAll 合并为一次，减少 DOM 树遍历。
      for (const el of Array.from(
        page.querySelectorAll("link, style, canvas"),
      )) {
        if (el.tagName === "CANVAS") {
          const c = el as HTMLCanvasElement;
          const img = document.createElement("img");
          img.src = c.toDataURL("image/png");
          img.style.cssText = c.style.cssText;
          img.className = c.className;
          c.replaceWith(img);
        } else {
          el.remove();
        }
      }

      // 2a. 移除外部 background-image，防止 Canvas Tainted。
      // 用属性子串选择器仅取含 url() 的元素，避免把整棵树（大表格 2000+ 个 <td>）
      // 全部拉入 JS 数组——绝大多数元素没有 background-image，按需取可节省 ~10ms。
      for (const el of page.querySelectorAll<HTMLElement>("[style*='url(']")) {
        const bg = el.style.backgroundImage;
        if (bg && bg.includes("url(") && !bg.includes("data:")) {
          el.style.backgroundImage = "none";
        }
      }

      // 2b. 并行内联外部 <img>，避免 Canvas Tainted。
      // 直接用 "img" 选择器替代先 querySelectorAll("*") 再 JS 过滤的做法。
      const externalImgs = Array.from(
        page.querySelectorAll<HTMLImageElement>("img"),
      ).filter((img) => img.src && !img.src.startsWith("data:"));

      if (externalImgs.length > 0) {
        await Promise.all(
          externalImgs.map(async (img) => {
            const src = img.src;
            try {
              if (!externalImageCache.has(src)) {
                // 存入 Promise 占位，同批次其他页直接 await 这个共享 Promise
                const fetchPromise = (async () => {
                  const res = await fetch(src);
                  const blob = await res.blob();
                  return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                  });
                })();
                externalImageCache.set(src, fetchPromise);
              }
              img.src = await externalImageCache.get(src)!;
            } catch (e) {
              console.warn("[Render Debug] Inline image failed", src, e);
              // 失败必须替换为空白 base64，否则 SVG 使用跨域 HTTP url 绘制进 Canvas 必报 Tainted SecurityError
              img.src =
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            }
          }),
        );
      }

      // 3. 将重复的 inline style 提取为 <style> 块，减少序列化字符串体积。
      // DOM 已离线，此处 2000+ 元素的 className/removeAttribute 变更无任何重排开销。
      deduplicateInlineStyles(page);

      const scale = printQualityScale;
      page.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

      // 清洗不可见控制字符，防止 XML 解析异常导致图片黑屏。
      // 先用 .test() 快速判断，无控制字符时跳过全字符串扫描。
      let htmlStr = serializer.serializeToString(page);
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(htmlStr)) {
        htmlStr = htmlStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
      }

      const svgString = buildForeignObjectSvg({
        width,
        height,
        scale,
        html: htmlStr,
        backgroundColor: canvasBackground,
      });

      // Chrome 对 Blob URL 中含 <foreignObject> 的 SVG 加载到 Canvas 后强制标记 Tainted，
      // 必须使用 data URI。encodeURIComponent 对 SVG 内容（主要是 ASCII：CSS 属性名、数值、
      // 标签名等）的处理速度极快——ASCII 字符直接原样输出，只有中文内容字段才需要编码。
      // 实测比 TextEncoder+btoa 快约 70ms（后者对所有字符都需完整 UTF-8 + base64 编码）。
      const url =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
          // 切分微任务/宏任务：防止并发 batch 引发多个 toDataURL 在同一事件循环触发导致连续卡顿
          await new Promise((r) => setTimeout(r, 0));

          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            (ctx as any).mozImageSmoothingEnabled = true;
            (ctx as any).webkitImageSmoothingEnabled = true;
            (ctx as any).msImageSmoothingEnabled = true;
            ctx.imageSmoothingEnabled = true;

            ctx.fillStyle = canvasBackground;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
          // 改进：使用 toDataURL 替代 toBlob + FileReader。
          // toBlob 虽然在后台线程编码不阻塞主线程，但带来了极其昂贵的 IPC 和多次事件循环列队延迟。
          // 对于批量打印，由于 V8 引擎在 C++ 层的同步 toDataURL 编码非常快（<10ms），
          // 直接由主线程同步提取 base64 可以极大降低整体等待时间，两页耗时能减少约 40-80ms。
          const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
          resolve(dataUrl);
        };
        img.onerror = (e) => {
          console.error("[Render Debug] SVG render failed:", e);
          reject(new Error("SVG to Image conversion failed."));
        };
        img.src = url;
      });
    };

    const batchSize = 3; // 恢复批次并行
    const pageImages: string[] = [];

    for (let i = 0; i < pages.length; i += batchSize) {
      // 主动出让主线程给上一批次可能的剩余副作用或 UI 渲染
      await new Promise((resolve) => setTimeout(resolve, 0));

      const batchStart = performance.now();
      const batch = pages.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(generatePageImage));
      pageImages.push(...results);
      if (onPageRendered) {
        onPageRendered(Math.min(i + batchSize, pages.length), pages.length);
      }
      if (showRenderDebugLogs) {
        console.log(
          `[Render Debug] generatePageImages batch ${Math.floor(i / batchSize) + 1} took ${(performance.now() - batchStart).toFixed(2)}ms`,
        );
      }
    }

    if (showRenderDebugLogs) {
      console.log(
        `[Render Debug] generatePageImages finished in ${(performance.now() - startTime).toFixed(2)}ms`,
      );
    }

    return pageImages;
  } catch (err) {
    console.error("[Render Debug] generatePageImages error:", err);
    throw err;
  }
};
