import cloneDeep from "lodash/cloneDeep";
import { useDesignerStore } from "@/stores/designer";
import { HISTORY_ACTION } from "@/stores/designer/helpers";
import type { Page, Size, VariableTreeItem } from "@/types";
import type { AiTemplateData } from "../types";

const MAX_HISTORY_ENTRIES = 20;

let snapshot: Page[] | null = null;
let snapshotCanvasSize: Size | null = null;
let snapshotVariables: VariableTreeItem[] | null = null;

export const hasPreviewSnapshot = () => snapshot !== null;

/** Appends the variables the model declared, keeping the host ones first. */
const mergeVariables = (
  existing: VariableTreeItem[],
  incoming: VariableTreeItem[],
) => {
  const known = new Set((existing || []).map((item) => item.id));
  const added = (incoming || []).filter((item) => !known.has(item.id));
  return [...(existing || []), ...cloneDeep(added)];
};

export const beginPreview = (template: AiTemplateData) => {
  const store = useDesignerStore();

  if (!snapshot) {
    snapshot = cloneDeep(store.pages);
    snapshotCanvasSize = cloneDeep(store.canvasSize);
    snapshotVariables = cloneDeep(store.availableVariables || []);
  }

  store.pages = cloneDeep(template.pages);
  store.canvasSize = cloneDeep(template.canvasSize);
  if (template.variables && template.variables.length > 0) {
    store.setAvailableVariables(
      mergeVariables(store.availableVariables || [], template.variables),
    );
  }
  store.previewLocked = true;
  store.selectedElementId = null;
  store.selectedElementIds = [];
  store.currentPageIndex = 0;
};

export const commitPreview = () => {
  const store = useDesignerStore();

  if (!snapshot) {
    store.previewLocked = false;
    return false;
  }

  if (store.historyPast.length >= MAX_HISTORY_ENTRIES) {
    store.historyPast.shift();
    store.historyPastActionKeys.shift();
  }
  store.historyPast.push(cloneDeep(snapshot));
  store.historyPastActionKeys.push(HISTORY_ACTION.AI_GENERATE);
  store.historyFuture = [];
  store.historyFutureActionKeys = [];
  snapshot = null;
  snapshotCanvasSize = null;
  snapshotVariables = null;
  store.previewLocked = false;
  store.currentPageIndex = Math.max(
    0,
    Math.min(store.currentPageIndex, store.pages.length - 1),
  );

  return true;
};

export const cancelPreview = () => {
  const store = useDesignerStore();

  if (snapshot) {
    store.pages = cloneDeep(snapshot);
    snapshot = null;
  }
  if (snapshotCanvasSize) {
    store.canvasSize = cloneDeep(snapshotCanvasSize);
    snapshotCanvasSize = null;
  }
  if (snapshotVariables) {
    store.setAvailableVariables(cloneDeep(snapshotVariables));
    snapshotVariables = null;
  }

  store.previewLocked = false;
  store.selectedElementId = null;
  store.selectedElementIds = [];
};

/** Discards the snapshot without restoring pages (the document was replaced). */
export const dropPreview = () => {
  snapshot = null;
  snapshotCanvasSize = null;
  snapshotVariables = null;
  const store = useDesignerStore();
  store.previewLocked = false;
};

if (typeof window !== "undefined") {
  window.addEventListener("designer:template-replaced", () => {
    if (snapshot) dropPreview();
  });
}
