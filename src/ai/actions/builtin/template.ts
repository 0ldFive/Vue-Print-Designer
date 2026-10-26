import cloneDeep from "lodash/cloneDeep";
import { uuidv4 } from "@/utils/uuid";
import type { AiActionDefinition, AiActionOutcome } from "../types";
import { findTemplate, readNumber, readString } from "./shared";

const createTemplate: AiActionDefinition = {
  id: "create_template",
  description:
    "Create a new blank template and switch to it. The current template is kept in the list, never overwritten. Use it first when the user asks for a new template, then return the template JSON in the next round to fill it.",
  params: '{ "name"?: string, "width"?: number, "height"?: number }',
  localPatterns: [
    /(?:新建|创建|建|来)\s*(?:一)?\s*(?:张|个|份)?\s*(?:空白|空)\s*(?:的)?\s*模[板版]/i,
    /\b(?:create|new|make|add)\s+(?:a\s+)?blank\s+template\b/i,
  ],
  parseLocal: (text) => {
    const match = text.match(/[「『"“']([^」』"”']{1,40})[」』"”']/);
    return match ? { name: match[1].trim() } : {};
  },
  run: async (args, ctx): Promise<AiActionOutcome> => {
    const name = readString(args.name) || ctx.text("blankTemplateName");
    const width = readNumber(args.width);
    const height = readNumber(args.height);

    const designer = ctx.designerStore;
    const savedPages = cloneDeep(designer.pages);
    const savedPageIndex = designer.currentPageIndex;
    const savedCanvasSize = cloneDeep(designer.canvasSize);

    // createTemplate snapshots the live designer state, so feed it one blank
    // page and restore the current document afterwards.
    designer.pages = [{ id: uuidv4(), elements: [] }];
    designer.currentPageIndex = 0;
    if (width && height) designer.canvasSize = { width, height };

    let createdId: string | null = null;
    try {
      createdId = await ctx.templateStore.createTemplate(name);
    } finally {
      designer.pages = savedPages;
      designer.currentPageIndex = savedPageIndex;
      designer.canvasSize = savedCanvasSize;
    }

    if (!createdId) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("createTemplateFailed"),
      };
    }

    await ctx.templateStore.loadTemplate(createdId);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("createTemplateDone", { name }),
    };
  },
};

const duplicateTemplate: AiActionDefinition = {
  id: "duplicate_template",
  description: "Duplicate an existing template and switch to the copy.",
  params: '{ "id"?: string, "name"?: string, "newName"?: string }',
  run: async (args, ctx) => {
    const source = findTemplate(ctx.templateStore, args);
    if (!source) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("templateNotFound"),
      };
    }
    const name = readString(args.newName) || `${source.name} Copy`;
    await ctx.templateStore.copyTemplate(source.id, name);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("duplicateTemplateDone", { name }),
    };
  },
};

const renameTemplate: AiActionDefinition = {
  id: "rename_template",
  description: "Rename an existing template.",
  params: '{ "id"?: string, "name": string, "newName": string }',
  run: async (args, ctx) => {
    const source = findTemplate(ctx.templateStore, args);
    if (!source) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("templateNotFound"),
      };
    }
    const nextName = readString(args.newName);
    if (!nextName) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("failed", { reason: ctx.text("templateNotFound") }),
      };
    }
    await ctx.templateStore.editTemplate(source.id, nextName);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("renameTemplateDone", { name: nextName }),
    };
  },
};

const deleteTemplate: AiActionDefinition = {
  id: "delete_template",
  description: "Delete a template. Always confirm with the user first.",
  params: '{ "id"?: string, "name"?: string }',
  destructive: true,
  run: async (args, ctx) => {
    const target = findTemplate(ctx.templateStore, args);
    if (!target) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("templateNotFound"),
      };
    }
    const confirmed = await ctx.confirm(
      ctx.text("deleteTemplateConfirm", { name: target.name }),
    );
    if (!confirmed) {
      return { kind: "message", ok: true, message: ctx.text("cancelled") };
    }
    await ctx.templateStore.deleteTemplate(target.id);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("deleteTemplateDone", { name: target.name }),
    };
  },
};

const switchTemplate: AiActionDefinition = {
  id: "switch_template",
  description: "Switch the designer to another existing template.",
  params: '{ "id"?: string, "name"?: string }',
  run: async (args, ctx) => {
    const target = findTemplate(ctx.templateStore, args);
    if (!target) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("templateNotFound"),
      };
    }
    await ctx.templateStore.loadTemplate(target.id);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("switchTemplateDone", { name: target.name }),
    };
  },
};

const saveTemplate: AiActionDefinition = {
  id: "save_template",
  description:
    "Save the current document, optionally under a new name (acts as save-as).",
  params: '{ "name"?: string }',
  run: async (args, ctx) => {
    const name =
      readString(args.name) ||
      ctx.templateStore.templates.find(
        (item) => item.id === ctx.templateStore.currentTemplateId,
      )?.name ||
      ctx.text("blankTemplateName");

    await ctx.templateStore.saveCurrentTemplate(name);
    return {
      kind: "message",
      ok: true,
      message: readString(args.name)
        ? ctx.text("saveTemplateAsDone", { name })
        : ctx.text("saveTemplateDone"),
    };
  },
};

const saveTemplateAs: AiActionDefinition = {
  id: "save_template_as",
  description: "Save the current document as a new template with a new name.",
  params: '{ "name": string }',
  run: async (args, ctx) => {
    const name = readString(args.name);
    if (!name) {
      return {
        kind: "message",
        ok: false,
        message: ctx.text("failed", { reason: ctx.text("saveTemplateDone") }),
      };
    }
    await ctx.templateStore.saveCurrentTemplate(name);
    return {
      kind: "message",
      ok: true,
      message: ctx.text("saveTemplateAsDone", { name }),
    };
  },
};

export const templateActions: AiActionDefinition[] = [
  createTemplate,
  duplicateTemplate,
  renameTemplate,
  deleteTemplate,
  switchTemplate,
  saveTemplate,
  saveTemplateAs,
];
