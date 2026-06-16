import { nextTick } from "vue";
import cloneDeep from "lodash/cloneDeep";
import { uuidv4 } from "@/utils/uuid";
import { useDesignerStore } from "@/stores/designer";
import { ElementType, type Page } from "@/types";
import { usePrintSettings } from "@/composables/usePrintSettings";
import { toast } from "@/utils/toast";
import i18n from "@/locales";
import { isShadowDomContent, lockViewportScroll } from "./dom";
import { createPrintExecutor } from "./printChannel";
import { createRenderEngine } from "./renderEngine";
import { createZipBlob } from "./zipBuilder";

export const usePrint = () => {
  const store = useDesignerStore();
  const {
    printMode,
    silentPrint,
    localSettings,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localWsUrl,
    remoteSelectedClientId,
    fetchRemoteClients,
    fetchRemotePrinters,
    submitRemoteTask,
    sendLocalPreview,
    exportImageMerged,
  } = usePrintSettings();

  const createRepeatedPages = (originalPages: Page[]): Page[] => {
    const original = cloneDeep(originalPages);
    if (original.length === 0) return original;

    const hasHeader = store.headerHeight > 0 && store.showHeaderLine;
    const hasFooter = store.footerHeight > 0 && store.showFooterLine;

    const basePage = original[0];
    const canvasHeight = store.canvasSize.height;
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;
    const headerBoundary = store.headerHeight + marginTop;
    const footerBoundary = canvasHeight - (store.footerHeight + marginBottom);

    const repeatHeaders = hasHeader
      ? basePage.elements.filter((e) => {
          const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
          return bounds.maxY <= headerBoundary;
        })
      : [];

    const repeatFooters = hasFooter
      ? basePage.elements.filter((e) => {
          const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
          return bounds.minY >= footerBoundary;
        })
      : [];

    const repeatPerPageElements = basePage.elements.filter(
      (e) => e.type !== ElementType.TABLE && e.repeatPerPage === true,
    );
    const repeatMap = new Map<string, (typeof basePage.elements)[number]>();
    [...repeatHeaders, ...repeatFooters, ...repeatPerPageElements].forEach(
      (el) => {
        repeatMap.set(el.id, el);
      },
    );
    const repeatedElements = Array.from(repeatMap.values());
    if (repeatedElements.length === 0) return original;

    const withRepeats = cloneDeep(original);
    for (let i = 0; i < withRepeats.length; i++) {
      if (i === 0) continue;
      const page = withRepeats[i];

      const clonedIdByOriginalId = new Map<string, string>();
      repeatedElements.forEach((el) => {
        clonedIdByOriginalId.set(el.id, uuidv4());
      });

      for (const el of repeatedElements) {
        const cloned = cloneDeep(el);
        cloned.id = clonedIdByOriginalId.get(el.id) || uuidv4();
        if (
          cloned.embeddedInTableId &&
          clonedIdByOriginalId.has(cloned.embeddedInTableId)
        ) {
          cloned.embeddedInTableId = clonedIdByOriginalId.get(
            cloned.embeddedInTableId,
          );
        }
        page.elements.push(cloned);
      }
    }
    return withRepeats;
  };

  const prepareEnvironment = async (
    options: { mutateStore?: boolean; setExporting?: boolean } = {},
  ) => {
    const mutateStore = options.mutateStore === true;
    const setExporting = options.setExporting === true;

    const previousSelection = store.selectedElementId;
    const previousShowGrid = store.showGrid;
    const previousZoom = store.zoom;
    const previousPages = cloneDeep(store.pages);
    const previousShowHeaderLine = store.showHeaderLine;
    const previousShowFooterLine = store.showFooterLine;
    const previousShowCornerMarkers = store.showCornerMarkers;
    const previousIsExporting = Boolean(store.isExporting);
    const previousBodyHasExporting =
      document.body.classList.contains("exporting");

    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverflowY = document.body.style.overflowY;

    if (mutateStore) {
      store.selectElement(null);
      store.setShowGrid(false);
      store.setZoom(1);
      store.pages = createRepeatedPages(store.pages);
      store.setShowHeaderLine(false);
      store.setShowFooterLine(false);
      store.showCornerMarkers = false;
    }

    if (setExporting) {
      store.setIsExporting(true);
      document.body.classList.add("exporting");
    }

    if (mutateStore || setExporting) {
      document.documentElement.style.overflowX = "hidden";
      document.documentElement.style.overflowY = "hidden";
      document.body.style.overflowX = "hidden";
      document.body.style.overflowY = "hidden";

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return () => {
      if (
        document.body.classList.contains("exporting") &&
        !previousBodyHasExporting
      ) {
        document.body.classList.remove("exporting");
      }

      if (store.isExporting !== previousIsExporting) {
        store.setIsExporting(previousIsExporting);
      }

      if (store.showCornerMarkers !== previousShowCornerMarkers) {
        store.showCornerMarkers = previousShowCornerMarkers;
      }

      if (mutateStore || setExporting) {
        document.documentElement.style.overflowX = previousHtmlOverflowX;
        document.documentElement.style.overflowY = previousHtmlOverflowY;
        document.body.style.overflowX = previousBodyOverflowX;
        document.body.style.overflowY = previousBodyOverflowY;
      }

      if (mutateStore) {
        store.setShowGrid(previousShowGrid);
        store.selectElement(previousSelection);
        store.setZoom(previousZoom);
        store.pages = previousPages;
        store.setShowHeaderLine(previousShowHeaderLine);
        store.setShowFooterLine(previousShowFooterLine);
      }
    };
  };

  const {
    getPrintHtml,
    resolveRenderSource,
    processContentForImage,
    generatePageImages,
    createPdfDocument,
  } = createRenderEngine({
    store,
    createRepeatedPages,
    prepareEnvironment,
  });

  const createProgressTicker = (params: {
    phase: string;
    message: string;
    start?: number;
    max?: number;
    step?: number;
    interval?: number;
  }) => {
    const {
      phase,
      message,
      start = 0,
      max = 90,
      step = 3,
      interval = 120,
    } = params;

    let value = Math.max(0, Math.min(start, max));
    store.setPrintProgress({ phase, current: value, total: 100, message });

    const timer = window.setInterval(() => {
      value = Math.min(max, value + step);
      store.setPrintProgress({ phase, current: value, total: 100, message });
      if (value >= max) {
        window.clearInterval(timer);
      }
    }, interval);

    return {
      stop: (next?: { current: number; total?: number; message?: string }) => {
        window.clearInterval(timer);
        if (next) {
          store.setPrintProgress({
            phase,
            current: next.current,
            total: next.total ?? 100,
            message: next.message ?? message,
          });
        }
      },
    };
  };

  const exportPdf = async (
    content?: HTMLElement | string | HTMLElement[],
    filename = "print-design.pdf",
  ) => {
    let reachedComplete = false;
    const ticker = createProgressTicker({
      phase: "pdf",
      message: i18n.global.t("statusBar.progress.rendering"),
      start: 5,
      max: 92,
      step: 2,
      interval: 100,
    });
    try {
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const pdf = await createPdfDocument(targetContent);
      ticker.stop({
        current: 97,
        message: i18n.global.t("statusBar.progress.saving"),
      });
      pdf.save(filename);
      store.setPrintProgress({
        phase: "pdf",
        current: 100,
        total: 100,
        message: i18n.global.t("statusBar.progress.saving"),
      });
      reachedComplete = true;
    } catch (error) {
      ticker.stop();
      console.error("Export PDF failed", error);
      toast.error(i18n.global.t("toast.exportPdfFailed"));
    } finally {
      ticker.stop();
      if (reachedComplete) {
        // Keep 100% visible briefly so the user can perceive completion.
        await new Promise((resolve) => setTimeout(resolve, 240));
      }
      store.setPrintProgress(null);
    }
  };

  const exportHtml = async (
    content?: HTMLElement | string | HTMLElement[],
    filename = "print-design.html",
  ) => {
    try {
      store.setPrintProgress({
        phase: "html",
        current: 0,
        total: 1,
        message: i18n.global.t("statusBar.progress.preparing"),
      });
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      store.setPrintProgress({
        phase: "html",
        current: 1,
        total: 1,
        message: i18n.global.t("statusBar.progress.rendering"),
      });
      const html = await getPrintHtml(targetContent as HTMLElement[], {
        mode: "export",
      });

      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
</head>
<body style="background-color: #f3f4f6; padding: 20px; margin: 0; display: flex; flex-direction: column; align-items: center;">
  ${html}
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export HTML failed", error);
      toast.error("Export HTML failed");
    } finally {
      store.setPrintProgress(null);
    }
  };

  const browserPrint = async (
    content: HTMLElement | string | HTMLElement[],
  ) => {
    const restoreViewport = lockViewportScroll(!isShadowDomContent(content));
    try {
      store.setPrintProgress({ phase: "print", current: 0, total: 1, message: i18n.global.t("statusBar.progress.rendering") });
      const pdf = await createPdfDocument(content);
      store.setPrintProgress({ phase: "print", current: 1, total: 1, message: i18n.global.t("statusBar.progress.printing") });
      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);

      const isEdge = /Edg\//.test(navigator.userAgent);
      if (isEdge) {
        const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        let blobRevoked = false;
        const revokeBlob = () => {
          if (blobRevoked) return;
          blobRevoked = true;
          URL.revokeObjectURL(blobUrl);
        };

        popup.addEventListener("afterprint", revokeBlob);
        popup.addEventListener("beforeunload", revokeBlob);

        popup.onload = () => {
          try {
            popup.focus();
            popup.print();
          } finally {
            // Fallback: in case neither afterprint nor beforeunload fires.
            setTimeout(revokeBlob, 60_000);
          }
        };
        return { status: "success", mode: "browser" };
      }

      await new Promise<void>((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "0";
        iframe.style.top = "0";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        iframe.style.opacity = "0";
        iframe.style.pointerEvents = "none";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);

        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        };

        iframe.onload = () => {
          const win = iframe.contentWindow;
          if (win) {
            // Clean up iframe after the user finishes or cancels printing.
            win.addEventListener("afterprint", cleanup);
            win.focus();
            setTimeout(() => {
              win.print();
            }, 200);
          }
          // Fallback: in case afterprint never fires (some browsers).
          setTimeout(cleanup, 60_000);

          // Resolve immediately so the progress indicator is dismissed
          // without waiting for the print dialog to close.
          resolve();
        };
      });
      return { status: "success", mode: "browser" };
    } catch (error) {
      console.error("Print failed", error);
      toast.error("Print failed");
      throw error;
    } finally {
      store.setPrintProgress(null);
      restoreViewport();
    }
  };

  const stitchImages = async (images: string[]): Promise<string> => {
    if (images.length === 0) return "";

    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = images[0];
    });

    const imgWidth = firstImg.width;
    const imgHeight = firstImg.height;
    const totalHeight = imgHeight * images.length;

    const canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(firstImg, 0, 0);

    for (let i = 1; i < images.length; i++) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, i * imgHeight);
          resolve();
        };
        img.onerror = reject;
        img.src = images[i];
      });
    }

    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const exportImages = async (
    content?: HTMLElement | string | HTMLElement[],
    filenamePrefix = "print-design",
  ) => {
    try {
      store.setPrintProgress({ phase: "images", current: 0, total: 1, message: i18n.global.t("statusBar.progress.preparing") });
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const restore = await prepareEnvironment({
        mutateStore: false,
        setExporting: false,
      });
      const restoreViewport = lockViewportScroll(
        !isShadowDomContent(targetContent),
      );

      const width = store.canvasSize.width;
      const height = store.canvasSize.height;

      let cleanup: (() => void) | null = null;
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      store.setPrintProgress({ phase: "images", current: 0, total: 1, message: i18n.global.t("statusBar.progress.rendering") });
      const { container, tempWrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );

      try {
        const pageImages = await generatePageImages(container, width, height, {
          onPageRendered: (current, total) => {
            store.setPrintProgress({ phase: "images", current, total, message: i18n.global.t("statusBar.progress.renderingPage", { current, total }) });
          },
        });

        if (pageImages.length === 0) return;

        store.setPrintProgress({ phase: "images", current: pageImages.length, total: pageImages.length, message: i18n.global.t("statusBar.progress.saving") });

        if (exportImageMerged.value) {
          const finalImage = await stitchImages(pageImages);

          const link = document.createElement("a");
          link.href = finalImage;
          link.download = `${filenamePrefix}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          const zipEntries = await Promise.all(
            pageImages.map(async (dataUrl: string, index: number) => {
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              return {
                filename: `${filenamePrefix}-${index + 1}.jpg`,
                data: blob,
              };
            }),
          );

          const zipBlob = await createZipBlob(zipEntries);
          const zipUrl = URL.createObjectURL(zipBlob);
          const link = document.createElement("a");
          link.href = zipUrl;
          link.download = `${filenamePrefix}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(zipUrl);
        }
      } finally {
        if (tempWrapper && tempWrapper.parentNode) {
          tempWrapper.parentNode.removeChild(tempWrapper);
        }
        if (cleanup) {
          cleanup();
        }
        restoreViewport();
        restore();
      }
    } catch (error) {
      console.error("Export Images failed", error);
      toast.error("Export Images failed");
    } finally {
      store.setPrintProgress(null);
    }
  };

  const getImageBlob = async (
    content: HTMLElement | string | HTMLElement[],
  ) => {
    try {
      store.setPrintProgress({
        phase: "preview",
        current: 0,
        total: 1,
        message: i18n.global.t("statusBar.progress.preparing"),
      });
      const targetContent =
        content ||
        (Array.from(document.querySelectorAll(".print-page")) as HTMLElement[]);
      const restore = await prepareEnvironment({
        mutateStore: false,
        setExporting: false,
      });
      const restoreViewport = lockViewportScroll(
        !isShadowDomContent(targetContent),
      );

      const width = store.canvasSize.width;
      const height = store.canvasSize.height;

      let cleanup: (() => void) | null = null;
      const source = await resolveRenderSource(targetContent);
      cleanup = source.cleanup;

      store.setPrintProgress({
        phase: "preview",
        current: 0,
        total: 1,
        message: i18n.global.t("statusBar.progress.rendering"),
      });
      const { container, tempWrapper } = await processContentForImage(
        source.content,
        width,
        height,
        true,
        source.getComputedStyleFn,
      );

      try {
        const pageImages = await generatePageImages(container, width, height, {
          onPageRendered: (current, total) => {
            store.setPrintProgress({ phase: "preview", current, total, message: i18n.global.t("statusBar.progress.renderingPage", { current, total }) });
          },
        });

        if (pageImages.length === 0) throw new Error("No images generated");

        const finalImage = await stitchImages(pageImages);
        const response = await fetch(finalImage);
        return await response.blob();
      } finally {
        if (tempWrapper && tempWrapper.parentNode) {
          tempWrapper.parentNode.removeChild(tempWrapper);
        }
        if (cleanup) {
          cleanup();
        }
        restoreViewport();
        restore();
      }
    } catch (error) {
      console.error("Get Image Blob failed", error);
      throw error;
    } finally {
      store.setPrintProgress(null);
    }
  };

  const getPdfBlob = async (
    content: HTMLElement | string | HTMLElement[],
    options: {
      showProgress?: boolean;
      phase?: string;
      message?: string;
    } = {},
  ) => {
    const showProgress = options.showProgress !== false;
    const phase = options.phase || "preview";
    const baseMessage =
      options.message || i18n.global.t("statusBar.progress.rendering");
    let reachedComplete = false;
    let ticker: number | ReturnType<typeof setInterval> | null = null;

    try {
      if (showProgress) {
        let value = 6;
        store.setPrintProgress({
          phase,
          current: value,
          total: 100,
          message: baseMessage,
        });
        ticker = window.setInterval(() => {
          value = Math.min(90, value + 3);
          store.setPrintProgress({
            phase,
            current: value,
            total: 100,
            message: baseMessage,
          });
          if (value >= 90 && ticker !== null) {
            window.clearInterval(ticker);
            ticker = null;
          }
        }, 120);
      }

      const pdf = await createPdfDocument(content);
      if (showProgress) {
        if (ticker !== null) {
          window.clearInterval(ticker);
          ticker = null;
        }
        store.setPrintProgress({
          phase,
          current: 100,
          total: 100,
          message: i18n.global.t("statusBar.progress.saving"),
        });
        reachedComplete = true;
      }
      return pdf.output("blob");
    } catch (error) {
      if (ticker !== null) {
        window.clearInterval(ticker);
      }
      console.error("Get PDF Blob failed", error);
      throw error;
    } finally {
      if (showProgress) {
        if (ticker !== null) {
          window.clearInterval(ticker);
        }
        if (reachedComplete) {
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        store.setPrintProgress(null);
      }
    }
  };

  const { print } = createPrintExecutor({
    printMode,
    silentPrint,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localSettings,
    localWsUrl,
    remoteSelectedClientId,
    fetchRemoteClients,
    fetchRemotePrinters,
    submitRemoteTask,
    getPdfBlob: (content) => getPdfBlob(content, { showProgress: false }),
    browserPrint,
    reportProgress: (progress) => {
      store.setPrintProgress(progress);
    },
  });

  type PreviewMode = "pdf" | "html" | "json";

  type PreviewOptions = {
    mode?: PreviewMode;
    title?: string;
    key?: string;
    timeoutMs?: number;
    rawHtml?: string;
    rawJson?: string | object;
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read PDF blob"));
      reader.readAsDataURL(blob);
    });

  const preview = async (
    content: HTMLElement | string | HTMLElement[] | undefined,
    request: PreviewOptions = {},
  ) => {
    if (localStatus.value !== "connected") {
      throw new Error("Local client is not connected");
    }

    const mode: PreviewMode = request.mode || "pdf";
    const title = request.title || "";
    const key = request.key || localSettings.secretKey.trim();

    let previewContent = "";
    let renderTicker: number | ReturnType<typeof setInterval> | null = null;
    let reachedComplete = false;
    let renderValue = 8;

    try {
      store.setPrintProgress({
        phase: "preview",
        current: renderValue,
        total: 100,
        message: i18n.global.t("statusBar.progress.preparing"),
      });
      renderTicker = window.setInterval(() => {
        renderValue = Math.min(70, renderValue + 4);
        store.setPrintProgress({
          phase: "preview",
          current: renderValue,
          total: 100,
          message: i18n.global.t("statusBar.progress.rendering"),
        });
        if (renderValue >= 70 && renderTicker !== null) {
          window.clearInterval(renderTicker);
          renderTicker = null;
        }
      }, 120);

      if (mode === "pdf") {
        const targetContent =
          content ||
          (Array.from(
            document.querySelectorAll(".print-page"),
          ) as HTMLElement[]);
        const pdfBlob = await getPdfBlob(targetContent, { showProgress: false });
        if (renderTicker !== null) {
          window.clearInterval(renderTicker);
          renderTicker = null;
        }
        const dataUrl = await blobToDataUrl(pdfBlob);
        previewContent = dataUrl;
        store.setPrintProgress({
          phase: "preview",
          current: 80,
          total: 100,
          message: i18n.global.t("statusBar.progress.rendering"),
        });
      } else if (mode === "html") {
        if (renderTicker !== null) {
          window.clearInterval(renderTicker);
          renderTicker = null;
        }
        if (typeof request.rawHtml === "string" && request.rawHtml) {
          previewContent = request.rawHtml;
        } else if (typeof content === "string" && content) {
          previewContent = content;
        } else {
          const targetContent =
            content ||
            (Array.from(
              document.querySelectorAll(".print-page"),
            ) as HTMLElement[]);
          previewContent = await getPrintHtml(targetContent as HTMLElement[]);
        }
        store.setPrintProgress({
          phase: "preview",
          current: 80,
          total: 100,
          message: i18n.global.t("statusBar.progress.rendering"),
        });
      } else if (mode === "json") {
        if (renderTicker !== null) {
          window.clearInterval(renderTicker);
          renderTicker = null;
        }
        if (request.rawJson !== undefined) {
          previewContent =
            typeof request.rawJson === "string"
              ? request.rawJson
              : JSON.stringify(request.rawJson);
        } else {
          previewContent = JSON.stringify({
            pages: cloneDeep(store.pages),
            canvasSize: cloneDeep(store.canvasSize),
            testData: cloneDeep(store.testData || {}),
            variables: cloneDeep(store.variables || {}),
            headerHeight: store.headerHeight,
            footerHeight: store.footerHeight,
            showHeaderLine: store.showHeaderLine,
            showFooterLine: store.showFooterLine,
            enableHeaderFooterLineRendering:
              store.enableHeaderFooterLineRendering,
            headerLineStyle: store.headerLineStyle,
            footerLineStyle: store.footerLineStyle,
            headerLineColor: store.headerLineColor,
            footerLineColor: store.footerLineColor,
            headerLineWidth: store.headerLineWidth,
            footerLineWidth: store.footerLineWidth,
            headerLineSpanMode: store.headerLineSpanMode,
            footerLineSpanMode: store.footerLineSpanMode,
            headerLineSpan: store.headerLineSpan,
            footerLineSpan: store.footerLineSpan,
            pageSpacingX: store.pageSpacingX,
            pageSpacingY: store.pageSpacingY,
            canvasBackground: store.canvasBackground,
            watermark: cloneDeep(store.watermark),
            unit: store.unit,
          });
        }
        store.setPrintProgress({
          phase: "preview",
          current: 80,
          total: 100,
          message: i18n.global.t("statusBar.progress.rendering"),
        });
      } else {
        throw new Error(`Unsupported preview mode: ${mode}`);
      }

      const payload: Record<string, any> = {
        type: "preview",
        mode,
        content: previewContent,
      };
      if (title) payload.title = title;
      if (key) payload.key = key;

      store.setPrintProgress({
        phase: "preview",
        current: 92,
        total: 100,
        message: i18n.global.t("statusBar.progress.saving"),
      });

      const result = await sendLocalPreview(
        payload,
        request.timeoutMs || 15000,
      );

      if (result?.status === "error") {
        throw new Error(result?.message || "Preview failed");
      }

      reachedComplete = true;
      store.setPrintProgress({
        phase: "preview",
        current: 100,
        total: 100,
        message: i18n.global.t("statusBar.progress.saving"),
      });
      return result;
    } catch (error) {
      console.error("Preview failed", error);
      throw error;
    } finally {
      if (renderTicker !== null) {
        window.clearInterval(renderTicker);
      }
      if (reachedComplete) {
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
      store.setPrintProgress(null);
    }
  };

  return {
    getPrintHtml,
    print,
    preview,
    exportPdf,
    exportHtml,
    exportImages,
    getPdfBlob,
    getImageBlob,
  };
};
