import type { AiTemplateData } from "../../types";
import type { AiActionDefinition, AiActionOutcome } from "../types";

const dispatch = (name: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
};

const printTemplate: AiActionDefinition = {
  id: "print",
  description: "Open the print dialog for the current template.",
  params: "none",
  run: async (_args, ctx): Promise<AiActionOutcome> => {
    dispatch("designer:print");
    return {
      kind: "message",
      ok: true,
      message: ctx.text("printStarted"),
    };
  },
};

const exportPdf: AiActionDefinition = {
  id: "export_pdf",
  description: "Export the current template as a PDF file.",
  params: "none",
  run: async (_args, ctx) => {
    dispatch("designer:export-pdf");
    return {
      kind: "message",
      ok: true,
      message: ctx.text("exportStarted", { format: "PDF" }),
    };
  },
};

const exportHtml: AiActionDefinition = {
  id: "export_html",
  description: "Export the current template as an HTML file.",
  params: "none",
  run: async (_args, ctx) => {
    dispatch("designer:export-html");
    return {
      kind: "message",
      ok: true,
      message: ctx.text("exportStarted", { format: "HTML" }),
    };
  },
};

const exportImages: AiActionDefinition = {
  id: "export_images",
  description: "Export the current template pages as image files.",
  params: "none",
  run: async (_args, ctx) => {
    dispatch("designer:export-images");
    return {
      kind: "message",
      ok: true,
      message: ctx.text("exportStarted", { format: "PNG" }),
    };
  },
};

const viewJson: AiActionDefinition = {
  id: "view_json",
  description: "Show the JSON data of the current template.",
  params: "none",
  run: async (_args, ctx) => {
    dispatch("designer:view-json");
    return {
      kind: "message",
      ok: true,
      message: ctx.text("viewJsonDone"),
    };
  },
};

const importTemplate: AiActionDefinition = {
  id: "import_template",
  description:
    'Load a template from JSON the user provided. Put the full template object (canvasSize, pages, variables) in "template".',
  params: '{ "template": { "canvasSize": {...}, "pages": [...] } }',
  run: async (args, ctx): Promise<AiActionOutcome> => {
    const template = args.template;
    if (!template || typeof template !== "object" || Array.isArray(template)) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("importTemplateEmpty"),
      };
    }
    return {
      kind: "preview",
      template: template as AiTemplateData,
    };
  },
};

export const outputActions: AiActionDefinition[] = [
  printTemplate,
  exportPdf,
  exportHtml,
  exportImages,
  viewJson,
  importTemplate,
];
