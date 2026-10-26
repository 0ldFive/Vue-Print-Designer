import type { Page } from "@/types";
import type { AiChangeSummary, AiTemplateData } from "../types";

const indexElements = (pages: Page[]) => {
  const map = new Map<string, string>();
  pages.forEach((page) => {
    (page.elements || []).forEach((element) => {
      if (!element?.id) return;
      map.set(element.id, JSON.stringify(element));
    });
  });
  return map;
};

export const diffTemplates = (
  currentPages: Page[],
  candidate: AiTemplateData,
): AiChangeSummary => {
  const currentMap = indexElements(currentPages || []);
  const nextMap = indexElements(candidate.pages || []);

  let added = 0;
  let modified = 0;

  nextMap.forEach((json, id) => {
    const currentJson = currentMap.get(id);
    if (currentJson === undefined) {
      added += 1;
    } else if (currentJson !== json) {
      modified += 1;
    }
  });

  let removed = 0;
  currentMap.forEach((_, id) => {
    if (!nextMap.has(id)) removed += 1;
  });

  return {
    pages: (candidate.pages || []).length,
    elements: nextMap.size,
    added,
    modified,
    removed,
  };
};
