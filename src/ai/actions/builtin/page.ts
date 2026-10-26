import type { AiActionDefinition, AiActionOutcome } from "../types";
import { readNumber, readPageIndex } from "./shared";

const MIN_CANVAS_SIZE = 100;
const MAX_CANVAS_SIZE = 5000;

const addPage: AiActionDefinition = {
  id: "add_page",
  description: "Append a new blank page to the current template.",
  params: "none",
  run: async (_args, ctx): Promise<AiActionOutcome> => {
    if (!ctx.designerStore.isTemplateEditable) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("pageEditBlocked"),
      };
    }
    ctx.designerStore.addPage();
    return {
      kind: "message",
      ok: true,
      message: ctx.text("addPageDone", {
        index: ctx.designerStore.pages.length,
      }),
    };
  },
};

const deletePage: AiActionDefinition = {
  id: "delete_page",
  description: "Delete a page. Always confirm with the user first.",
  params: '{ "page"?: number } (1-based, defaults to the active page)',
  destructive: true,
  run: async (args, ctx): Promise<AiActionOutcome> => {
    if (!ctx.designerStore.isTemplateEditable) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("pageEditBlocked"),
      };
    }
    const pages = ctx.designerStore.pages;
    if (pages.length <= 1) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("singlePageOnly"),
      };
    }

    const index = readPageIndex(
      args,
      ctx.designerStore.currentPageIndex,
      pages.length,
    );
    if (index === null) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("pageNotFound"),
      };
    }

    const confirmed = await ctx.confirm(
      ctx.text("deletePageConfirm", { index: index + 1 }),
    );
    if (!confirmed) {
      return { kind: "message", ok: true, message: ctx.text("cancelled") };
    }

    ctx.designerStore.deletePage(index);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("deletePageDone", { index: index + 1 }),
    };
  },
};

const duplicatePage: AiActionDefinition = {
  id: "duplicate_page",
  description: "Duplicate a page and insert the copy right after it.",
  params: '{ "page"?: number } (1-based, defaults to the active page)',
  run: async (args, ctx): Promise<AiActionOutcome> => {
    if (!ctx.designerStore.isTemplateEditable) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("pageEditBlocked"),
      };
    }
    const pages = ctx.designerStore.pages;
    const index = readPageIndex(
      args,
      ctx.designerStore.currentPageIndex,
      pages.length,
    );
    if (index === null) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("pageNotFound"),
      };
    }

    ctx.designerStore.copyPage(index);
    ctx.designerStore.pastePage(index);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("duplicatePageDone", { index: index + 1 }),
    };
  },
};

const setCanvasSize: AiActionDefinition = {
  id: "set_canvas_size",
  description: "Resize the canvas in pixels.",
  params: '{ "width": number, "height": number }',
  run: async (args, ctx): Promise<AiActionOutcome> => {
    const width = readNumber(args.width);
    const height = readNumber(args.height);
    const w = width === null ? 0 : Math.round(width);
    const h = height === null ? 0 : Math.round(height);
    if (
      w < MIN_CANVAS_SIZE ||
      h < MIN_CANVAS_SIZE ||
      w > MAX_CANVAS_SIZE ||
      h > MAX_CANVAS_SIZE
    ) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("setCanvasSizeFailed"),
      };
    }

    ctx.designerStore.setCanvasSize(w, h);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("setCanvasSizeDone", { width: w, height: h }),
    };
  },
};

export const pageActions: AiActionDefinition[] = [
  addPage,
  deletePage,
  duplicatePage,
  setCanvasSize,
];
