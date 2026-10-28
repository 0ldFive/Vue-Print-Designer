const sanitizeElement = (element: any) => {
  if (!element || typeof element !== "object") return null;
  if (typeof element.id !== "string" || !element.id) return null;
  if (typeof element.type !== "string" || !element.type) return null;
  return {
    ...element,
    style:
      element.style && typeof element.style === "object" ? element.style : {},
  };
};

export const sanitizePages = (pages: any) => {
  if (!Array.isArray(pages)) return [];
  return pages
    .filter((page) => page && typeof page === "object")
    .map((page, index) => ({
      ...page,
      id:
        typeof page.id === "string" && page.id ? page.id : `page-${index + 1}`,
      elements: Array.isArray(page.elements)
        ? page.elements.map(sanitizeElement).filter(Boolean)
        : [],
    }));
};

export const sanitizeTemplateData = (data: any) => {
  const base = data && typeof data === "object" ? data : {};
  return {
    ...base,
    pages: sanitizePages(base.pages),
  };
};

export const hasMeaningfulTemplateData = (data: any): boolean => {
  if (!data || typeof data !== "object") return false;
  // A template data is meaningful if it has pages with elements,
  // or it has a defined canvasSize which is a core property of a template.
  // Just having 'testData' or other minor keys doesn't mean we have the full template data.
  if (Array.isArray(data.pages) && data.pages.length > 0) return true;
  if (data.canvasSize && typeof data.canvasSize === "object") return true;
  return false;
};
