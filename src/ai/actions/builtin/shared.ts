import type { useTemplateStore, Template } from "@/stores/templates";

type TemplateStore = ReturnType<typeof useTemplateStore>;

export const readString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const readNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

/**
 * Resolves the template an action points at. An explicit id / name that does
 * not match returns null, so a typo never silently falls back to the current
 * template and mutates the wrong document.
 */
export const findTemplate = (
  templateStore: TemplateStore,
  args: Record<string, unknown>,
): Template | null => {
  const id = readString(args.id);
  if (id) {
    return templateStore.templates.find((item) => item.id === id) || null;
  }

  const name = readString(args.name);
  if (name) {
    const exact = templateStore.templates.find((item) => item.name === name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    return (
      templateStore.templates.find((item) =>
        item.name.toLowerCase().includes(lower),
      ) || null
    );
  }

  if (!templateStore.currentTemplateId) return null;
  return (
    templateStore.templates.find(
      (item) => item.id === templateStore.currentTemplateId,
    ) || null
  );
};

/** Reads a 1-based page number from the model, defaulting to the active page. */
export const readPageIndex = (
  args: Record<string, unknown>,
  currentPageIndex: number,
  pageCount: number,
): number | null => {
  const raw = readNumber(args.page);
  if (raw === null) return currentPageIndex;
  const index = Math.round(raw) - 1;
  if (index < 0 || index >= pageCount) return null;
  return index;
};
