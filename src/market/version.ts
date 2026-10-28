const parseSegments = (version: string): number[] => {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((segment) => {
      const matched = segment.match(/^\d+/);
      return matched ? Number(matched[0]) : 0;
    });
};

/** 比较语义化版本：a > b 返回正数，a < b 返回负数，相等返回 0。 */
export const compareVersion = (a: string, b: string): number => {
  const left = parseSegments(a);
  const right = parseSegments(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
};

export const getDesignerVersion = (): string => {
  return typeof __PRINT_DESIGNER_VERSION__ === "string" &&
    __PRINT_DESIGNER_VERSION__.trim()
    ? __PRINT_DESIGNER_VERSION__.trim()
    : "0.0.0";
};

/** 当前设计器是否满足模板的最低版本要求。 */
export const isVersionCompatible = (minVersion?: string): boolean => {
  if (!minVersion || !minVersion.trim()) return true;
  return compareVersion(getDesignerVersion(), minVersion) >= 0;
};
