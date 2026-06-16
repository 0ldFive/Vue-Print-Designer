export const isShadowDomContent = (
  content?: HTMLElement | string | HTMLElement[],
) => {
  if (!content || typeof content === "string") return false;
  const first = Array.isArray(content) ? content[0] : content;
  if (!(first instanceof HTMLElement)) return false;
  return first.getRootNode() instanceof ShadowRoot;
};

export const lockViewportScroll = (reserveScrollbarGutter = true) => {
  const previousHtmlOverflowX = document.documentElement.style.overflowX;
  const previousHtmlOverflowY = document.documentElement.style.overflowY;
  const previousHtmlScrollbarGutter =
    document.documentElement.style.scrollbarGutter;
  const previousBodyOverflowX = document.body.style.overflowX;
  const previousBodyOverflowY = document.body.style.overflowY;
  const previousBodyScrollbarGutter = document.body.style.scrollbarGutter;

  // Reserve scrollbar gutter only when a viewport scrollbar currently exists.
  // Otherwise it introduces a visible blank strip on the right edge.
  const hasViewportScrollbar =
    window.innerWidth > document.documentElement.clientWidth;
  const shouldReserveScrollbarGutter =
    reserveScrollbarGutter && hasViewportScrollbar;

  document.documentElement.style.overflowX = "hidden";
  document.documentElement.style.overflowY = "hidden";
  document.documentElement.style.scrollbarGutter = shouldReserveScrollbarGutter
    ? "stable"
    : "";
  document.body.style.overflowX = "hidden";
  document.body.style.overflowY = "hidden";
  document.body.style.scrollbarGutter = shouldReserveScrollbarGutter
    ? "stable"
    : "";

  return () => {
    document.documentElement.style.overflowX = previousHtmlOverflowX;
    document.documentElement.style.overflowY = previousHtmlOverflowY;
    document.documentElement.style.scrollbarGutter =
      previousHtmlScrollbarGutter;
    document.body.style.overflowX = previousBodyOverflowX;
    document.body.style.overflowY = previousBodyOverflowY;
    document.body.style.scrollbarGutter = previousBodyScrollbarGutter;
  };
};

export const cleanElement = (element: HTMLElement) => {
  // Remove interactive classes.
  element.classList.remove(
    "group",
    "cursor-move",
    "select-none",
    "ring-2",
    "ring-blue-500",
    "ring-red-500",
    "hover:outline",
    "hover:outline-1",
    "hover:outline-blue-300",
  );

  const classesToRemove: string[] = [];
  element.classList.forEach((cls) => {
    if (
      cls.startsWith("hover:") ||
      cls.startsWith("focus:") ||
      cls.startsWith("active:")
    ) {
      classesToRemove.push(cls);
    }
  });
  classesToRemove.forEach((cls) => element.classList.remove(cls));

  const isTransparentBorder =
    element.style.borderColor === "transparent" ||
    element.style.border.includes("transparent") ||
    (element.style.borderStyle === "dashed" &&
      (element.style.borderColor === "transparent" ||
        (!element.style.borderColor &&
          element.style.border.includes("transparent"))));

  if (isTransparentBorder) {
    element.style.border = "none";
    element.style.outline = "none";
    element.style.boxShadow = "none";
  }

  Array.from(element.children).forEach((child) =>
    cleanElement(child as HTMLElement),
  );
};

const PRINT_CSS_PROPS = [
  "display", "position", "top", "right", "bottom", "left", "z-index", "float", "clear",
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "box-sizing", "margin-top", "margin-right", "margin-bottom", "margin-left", 
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "flex-direction", "justify-content", "align-items", "align-content", "align-self", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "order", "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "gap",
  "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "font-size", "font-family", "font-weight", "font-style", "text-align", "text-decoration", "text-transform", "line-height",
  "direction", "letter-spacing", "word-spacing", "white-space", "word-break", "word-wrap", "text-overflow",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "box-shadow", "opacity", "transform", "transform-origin", "visibility", "overflow", "clip-path",
  "table-layout", "border-collapse", "border-spacing", "empty-cells", "vertical-align",
  "object-fit", "object-position",
  "fill", "stroke", "stroke-width",
  "text-shadow", "outline", "outline-color", "outline-width", "outline-style", "outline-offset",
  "filter", "backdrop-filter", "mix-blend-mode",
  "aspect-ratio",
  "list-style", "list-style-type", "list-style-position", "list-style-image",
  "content", "quotes", "counter-increment", "counter-reset",
  "page-break-before", "page-break-after", "page-break-inside", "break-before", "break-after", "break-inside"
];

const DEFAULT_PRINT_CSS_VALUES: Record<string, string> = {
  "position": "static",
  "top": "auto",
  "right": "auto",
  "bottom": "auto",
  "left": "auto",
  "z-index": "auto",
  "float": "none",
  "clear": "none",
  "max-width": "none",
  "max-height": "none",
  "min-width": "0px",
  "min-height": "0px",
  "box-sizing": "content-box",
  "margin-top": "0px",
  "margin-right": "0px",
  "margin-bottom": "0px",
  "margin-left": "0px",
  "padding-top": "0px",
  "padding-right": "0px",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "flex-direction": "row",
  "justify-content": "normal",
  "align-items": "normal",
  "align-content": "normal",
  "align-self": "auto",
  "flex-wrap": "nowrap",
  "flex-grow": "0",
  "flex-shrink": "1",
  "flex-basis": "auto",
  "grid-template-columns": "none",
  "grid-template-rows": "none",
  "grid-column": "auto",
  "grid-row": "auto",
  "gap": "normal",
  "background-color": "rgba(0, 0, 0, 0)",
  "background-image": "none",
  "background-size": "auto",
  "background-position": "0% 0%",
  "background-repeat": "repeat",
  "font-weight": "400",
  "font-style": "normal",
  "text-align": "start",
  "text-decoration": "none",
  "text-transform": "none",
  "direction": "ltr",
  "letter-spacing": "normal",
  "word-spacing": "0px",
  "white-space": "normal",
  "word-break": "normal",
  "word-wrap": "normal",
  "text-overflow": "clip",
  "border-top-style": "none",
  "border-right-style": "none",
  "border-bottom-style": "none",
  "border-left-style": "none",
  "border-top-left-radius": "0px",
  "border-top-right-radius": "0px",
  "border-bottom-left-radius": "0px",
  "border-bottom-right-radius": "0px",
  "box-shadow": "none",
  "opacity": "1",
  "transform": "none",
  "visibility": "visible",
  "overflow": "visible",
  "clip-path": "none",
  "table-layout": "auto",
  "border-collapse": "separate",
  "border-spacing": "0px",
  "empty-cells": "show",
  "vertical-align": "baseline",
  "object-fit": "fill",
  "object-position": "50% 50%",
  "stroke": "none",
  "stroke-width": "1px",
};

const isDefaultPrintCssValue = (prop: string, value: string) => {
  return DEFAULT_PRINT_CSS_VALUES[prop] === value;
};

const serializeComputedPrintStyle = (computed: CSSStyleDeclaration) => {
  const rules: string[] = [];

  for (const prop of PRINT_CSS_PROPS) {
    const val = computed.getPropertyValue(prop);
    if (!val) continue;
    if (isDefaultPrintCssValue(prop, val)) continue;

    const priority = computed.getPropertyPriority(prop);
    rules.push(`${prop}: ${val}${priority ? " !important" : ""}`);
  }

  return rules.join("; ");
};

/**
 * 跨页共享的路径感知样式缓存。
 * 多页同模板文档中，第 2+ 页与第 1 页结构相同，绝大多数元素可直接命中缓存，
 * 避免重复调用 getComputedStyle，将后续页的克隆耗时从 ~25ms 降至 <5ms。
 */
export interface CloneStyleCache {
  pathKeys: Map<string, number>;
  styleValues: Map<number, string>;
  nextId: number;
}

export const createCloneStyleCache = (): CloneStyleCache => ({
  pathKeys: new Map(),
  styleValues: new Map(),
  nextId: 1, // 0 保留给"虚拟根"的 parentPathId
});

export const cloneElementWithStyles = (
  element: HTMLElement,
  getComputedStyleFn: (
    elt: Element,
  ) => CSSStyleDeclaration = window.getComputedStyle,
  sharedCache?: CloneStyleCache,
): HTMLElement => {
  const clone = element.cloneNode(true) as HTMLElement;
  // 使用索引遍历避免 Array.shift() 的 O(n²) 开销；
  // 第三个字段是父节点的路径 ID，第四个字段是当前元素在父节点中的子元素索引。
  const pairs: [HTMLElement, HTMLElement, number, number][] = [[element, clone, 0, 0]];

  // 路径感知样式缓存：
  //   pathKeys  保存 "parentPathId:childIndex:tagName|id|class|inline" → 唯一整数 pathId
  //   styleValues 保存 pathId → inlined cssText
  // 同一路径上的元素（祖先链 + 同位置）共享同一 pathId，
  // 因此 CSS 继承关系被完整编码进缓存键，不会出现不同父容器下同名元素互相污染的问题。
  // childIndex 的加入确保同级元素（如表行 tr、表单元格 td）不会因结构相同而错误碰撞。
  // 当 sharedCache 传入时，多页克隆共享同一张表——第 2 页几乎全部命中缓存。
  const pathKeys = sharedCache?.pathKeys ?? new Map<string, number>();
  const styleValues = sharedCache?.styleValues ?? new Map<number, string>();
  let nextId = sharedCache?.nextId ?? 1;

  let qi = 0;
  while (qi < pairs.length) {
    const [source, target, parentPathId, childIndex] = pairs[qi++];

    if (source.nodeType === 1) {
      // 构造当前节点的路径键（含父路径 ID + 子元素索引，安全捕获继承上下文与同级位置）
      const pathKey = `${parentPathId}:${childIndex}:${source.tagName}|${source.id}|${source.className}|${source.style.cssText}`;
      let pathId = pathKeys.get(pathKey);
      if (pathId === undefined) {
        pathId = nextId++;
        pathKeys.set(pathKey, pathId);
      }

      let cssText = styleValues.get(pathId);
      if (cssText === undefined) {
        const computed = getComputedStyleFn(source);
        cssText = serializeComputedPrintStyle(computed);
        styleValues.set(pathId, cssText);
      }

      target.style.cssText = cssText;

      for (let i = 0; i < source.children.length; i++) {
        if (target.children[i]) {
          pairs.push([
            source.children[i] as HTMLElement,
            target.children[i] as HTMLElement,
            pathId,
            i,
          ]);
        }
      }
    }
  }

  // 将更新后的 nextId 写回共享缓存，保证跨调用的 pathId 唯一性
  if (sharedCache) {
    sharedCache.nextId = nextId;
  }

  return clone;
};

/**
 * 将页面克隆体上所有重复的 inline style 提取为 <style> 块中的 CSS 类。
 * 对表格等重复结构（200 个 <td> 相同样式）可将序列化字符串体积缩小 5-10x，
 * 显著降低 XMLSerializer + encodeURIComponent 的耗时。
 *
 * 注意：只在序列化前调用，不要对仍挂载在文档中的元素调用。
 */
export const deduplicateInlineStyles = (root: HTMLElement): void => {
  const styleMap = new Map<string, string>(); // cssText → 类名
  const rules: string[] = [];
  let counter = 0;

  const existingClasses = new Set<string>();
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
    el.classList.forEach((cls) => existingClasses.add(cls));
  }

  let prefixCounter = 0;
  let classPrefix = "_pd";
  while (
    Array.from(existingClasses).some((cls) => cls.startsWith(classPrefix))
  ) {
    prefixCounter += 1;
    classPrefix = `_pd${prefixCounter}_`;
  }

  for (const el of root.querySelectorAll<HTMLElement>("[style]")) {
    const cssText = el.style.cssText;
    if (!cssText) continue;

    let cls = styleMap.get(cssText);
    if (cls === undefined) {
      cls = `${classPrefix}${counter++}`;
      styleMap.set(cssText, cls);
      // cssText 末尾通常已带分号，直接放入规则块合法
      rules.push(`.${cls}{${cssText}}`);
    }

    el.removeAttribute("style");
    el.classList.add(cls);
  }

  if (rules.length === 0) return;

  const styleTag = document.createElement("style");
  styleTag.textContent = rules.join("");
  root.insertBefore(styleTag, root.firstChild);
};

// 拖拽/手柄相关需要从内联样式中剔除的属性。
const EXPORT_STRIP_PROPS = [
  "user-select",
  "-webkit-user-select",
  "-moz-user-select",
  "-ms-user-select",
];

const BORDER_SIDES: Array<"" | "top" | "right" | "bottom" | "left"> = [
  "",
  "top",
  "right",
  "bottom",
  "left",
];

type CssDeclaration = [string, string];

const parseCssDeclarations = (cssText: string): CssDeclaration[] => {
  const declarations: CssDeclaration[] = [];
  const re = /([a-zA-Z-][a-zA-Z0-9-]*)\s*:\s*([^;]+);?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null) {
    const prop = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (prop) {
      declarations.push([prop, value]);
    }
  }
  return declarations;
};

const serializeCssDeclarations = (declarations: CssDeclaration[]): string => {
  if (declarations.length === 0) return "";
  return `${declarations.map(([p, v]) => `${p}: ${v}`).join("; ")};`;
};

const mergeBorderShorthand = (declarations: CssDeclaration[]): void => {
  for (const side of BORDER_SIDES) {
    const prefix = side ? `border-${side}` : "border";
    const widthProp = `${prefix}-width`;
    const styleProp = `${prefix}-style`;
    const colorProp = `${prefix}-color`;

    const widthIdx = declarations.findIndex(([p]) => p === widthProp);
    if (widthIdx === -1) continue;
    const styleIdx = declarations.findIndex(([p]) => p === styleProp);
    if (styleIdx === -1) continue;
    const colorIdx = declarations.findIndex(([p]) => p === colorProp);
    if (colorIdx === -1) continue;

    const firstIdx = Math.min(widthIdx, styleIdx, colorIdx);
    const value = `${declarations[widthIdx][1]} ${declarations[styleIdx][1]} ${declarations[colorIdx][1]}`;

    declarations.splice(firstIdx, 3, [prefix, value]);
  }
};

const FONT_LONGHAND_PROPS = [
  "font-style",
  "font-variant",
  "font-weight",
  "font-size",
  "line-height",
  "font-family",
];

const mergeFontShorthand = (declarations: CssDeclaration[]): void => {
  const indicesToRemove = FONT_LONGHAND_PROPS.map((p) =>
    declarations.findIndex(([d]) => d === p),
  ).filter((i) => i !== -1);

  // font shorthand requires both font-size and font-family
  const hasSize = indicesToRemove.some(
    (i) => declarations[i]?.[0] === "font-size",
  );
  const hasFamily = indicesToRemove.some(
    (i) => declarations[i]?.[0] === "font-family",
  );
  if (!hasSize || !hasFamily) return;

  const firstIdx = Math.min(...indicesToRemove);
  const parts: string[] = [];

  const styleVal = declarations.find(([p]) => p === "font-style")?.[1];
  if (styleVal && styleVal !== "normal") parts.push(styleVal);
  const variantVal = declarations.find(([p]) => p === "font-variant")?.[1];
  if (variantVal && variantVal !== "normal") parts.push(variantVal);
  const weightVal = declarations.find(([p]) => p === "font-weight")?.[1];
  if (weightVal && weightVal !== "normal") parts.push(weightVal);

  const sizeVal = declarations.find(([p]) => p === "font-size")?.[1] || "";
  const lineHeightVal = declarations.find(([p]) => p === "line-height")?.[1];
  let sizePart = sizeVal;
  if (lineHeightVal) {
    sizePart += `/${lineHeightVal}`;
  }
  parts.push(sizePart);
  parts.push(declarations.find(([p]) => p === "font-family")?.[1] || "");

  // Remove longhands in descending order so splice indices stay valid.
  for (const idx of [...indicesToRemove].sort((a, b) => b - a)) {
    declarations.splice(idx, 1);
  }

  declarations.splice(firstIdx, 0, ["font", parts.join(" ")]);
};

/**
 * 把单边 border-* / font-* 等拆解后的属性重新合并为 `border` / `font` 简写，
 * 让最终 HTML 体积更小、可读性更高。Chrome/Edge 的 cssText getter 不会自动
 * 合并 longhand，因此这里手动实现合并逻辑。
 */
const optimizeCssText = (cssText: string): string => {
  if (!cssText) return "";

  const declarations = parseCssDeclarations(cssText);
  mergeBorderShorthand(declarations);
  mergeFontShorthand(declarations);
  return serializeCssDeclarations(declarations);
};

/**
 * 导出 HTML 前的最终清理：移除编辑器相关的 class / data-* / draggable 属性、
 * 删除装饰性元素（拖拽手柄等），合并 font/border 简写，去掉注释和 user-select。
 * 保证导出的 HTML 完全靠内联样式呈现，无任何 <style> / class 残留。
 */
export const cleanupForExport = (root: HTMLElement): void => {
  // 1. 移除拖拽手柄、调整尺寸手柄等装饰性元素。
  root
    .querySelectorAll('[data-print-exclude="true"]')
    .forEach((el) => el.remove());

  // 2. 清理元素上的 class / data-* / draggable 属性，并优化内联样式。
  const all: Element[] = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const node of all) {
    if (!(node instanceof HTMLElement)) continue;
    const el = node;

    el.removeAttribute("class");
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-") || attr.name === "draggable") {
        el.removeAttribute(attr.name);
      }
    }

    if (el.style.cssText) {
      for (const prop of EXPORT_STRIP_PROPS) {
        el.style.removeProperty(prop);
      }
      el.style.cssText = optimizeCssText(el.style.cssText);
    }
  }

  // 3. 移除所有 HTML 注释节点。
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    comments.push(current);
    current = walker.nextNode();
  }
  for (const c of comments) {
    c.parentNode?.removeChild(c);
  }
};
