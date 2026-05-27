import type { DesignerStore } from "./types";

// 创建分页处理模块：负责页码更新、页眉页脚复制与内容分页。
export const createPagination = ({ store }: { store: DesignerStore }) => {
  // 更新每页中的页码占位文本（格式：当前页/总页数）。
  const updatePageNumbers = (container: HTMLElement, totalPages: number) => {
    const pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];
    pages.forEach((page, pageIndex) => {
      const pageNumberElements = page.querySelectorAll(
        '[data-print-type="page-number"]',
      );
      pageNumberElements.forEach((el) => {
        const textSpan = el.querySelector(".page-number-text");
        if (textSpan) {
          textSpan.textContent = `${pageIndex + 1}/${totalPages}`;
        }
      });
    });
  };

  // 按规则复制页眉/页脚及“每页重复”元素到新页。
  const copyHeaderFooter = (
    sourcePage: HTMLElement,
    targetPage: HTMLElement,
    headerHeight: number,
    footerHeight: number,
    pageHeight: number,
    copyHeader: boolean,
    copyFooter: boolean,
  ) => {
    const wrappers = sourcePage.querySelectorAll("[data-print-wrapper]");
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;

    wrappers.forEach((w) => {
      const el = w as HTMLElement;
      if (el.hasAttribute("data-flow-id")) return;
      const isRepeatPerPage =
        el.getAttribute("data-repeat-per-page") === "true";

      const top = parseFloat(el.style.top) || 0;
      const height = parseFloat(el.style.height) || el.offsetHeight;
      const bottom = top + height;

      // 判断是否位于页眉或页脚区域。
      // 允许少量重叠，但通常页眉元素应位于顶部。
      const isHeader = copyHeader && top < headerHeight + marginTop;
      const isFooter =
        copyFooter && top >= pageHeight - footerHeight - marginBottom;

      if (isHeader || isFooter || isRepeatPerPage) {
        const clone = el.cloneNode(true) as HTMLElement;
        targetPage.appendChild(clone);
      }
    });

    const cloneLineByRole = (role: "header" | "footer") => {
      const line = sourcePage.querySelector<HTMLElement>(
        `[data-print-line-role="${role}"]`,
      );
      if (!line) return;
      targetPage.appendChild(line.cloneNode(true));
    };

    if (copyHeader) {
      cloneLineByRole("header");
    }
    if (copyFooter) {
      cloneLineByRole("footer");
    }
  };

  // 更新表格页内汇总（执行自定义脚本并回写 tfoot）。
  const updatePageSums = (table: HTMLElement) => {
    const tfoot = table.querySelector("tfoot");
    if (!tfoot) return;

    const customScript = table.getAttribute("data-custom-script");

    if (customScript) {
      try {
        // 1. 提取当前页数据
        const tbody = table.querySelector("tbody");
        const data: any[] = [];
        if (tbody) {
          const rows = Array.from(tbody.querySelectorAll("tr"));
          rows.forEach((row) => {
            const rowData: any = {};
            const cells = Array.from(row.querySelectorAll("td"));
            cells.forEach((cell) => {
              const field = cell.getAttribute("data-field");
              if (field) {
                rowData[field] = cell.textContent || "";
              }
            });
            if (Object.keys(rowData).length > 0) {
              data.push(rowData);
            }
          });
        }

        // 2. 提取页脚数据
        const footerData: any[] = [];
        const rows = Array.from(tfoot.querySelectorAll("tr"));
        rows.forEach((row) => {
          const rowData: any = {};
          const cells = Array.from(row.querySelectorAll("td"));
          cells.forEach((cell) => {
            const field = cell.getAttribute("data-field");
            if (field) {
              rowData[field] = {
                value:
                  cell.getAttribute("data-value") || cell.textContent || "",
              };
            }
          });
          footerData.push(rowData);
        });

        // 3. 执行汇总脚本
        const func = new Function(
          "data",
          "footerData",
          "columns",
          "type",
          customScript,
        );
        func(data, footerData, [], "page");

        // 4. 回写页脚 DOM
        if (footerData.length > 0) {
          const rows = Array.from(tfoot.querySelectorAll("tr"));
          rows.forEach((row, i) => {
            if (footerData[i]) {
              const cells = Array.from(row.querySelectorAll("td"));
              cells.forEach((cell) => {
                const field = cell.getAttribute("data-field");
                if (field && footerData[i][field] !== undefined) {
                  let val = footerData[i][field];
                  if (val && typeof val === "object") {
                    if (val.result !== undefined) val = val.result;
                    else if (val.value !== undefined) val = val.value;
                  }
                  cell.textContent = String(val);
                }
              });
            }
          });
        }
        return;
      } catch (e) {
        console.error("Page sum script error:", e);
      }
    }
  };

  // 处理内容分页，返回最终页数。
  const handleTablePagination = (
    container: HTMLElement,
    pageHeight: number,
    headerHeight: number,
    footerHeight: number,
    copyHeader: boolean,
    copyFooter: boolean,
  ) => {
    // 读取元素属性中的数值，失败时返回兜底值。
    const parseAttrNumber = (el: HTMLElement, attr: string, fallback = 0) => {
      const value = parseFloat(el.getAttribute(attr) || "");
      return Number.isFinite(value) ? value : fallback;
    };

    // 获取流式元素类型（table / auto-height）。
    const getFlowKind = (wrapper: HTMLElement) =>
      wrapper.getAttribute("data-flow-kind") || "";

    // 定位自动高度内容节点，兼容两种标记。
    const resolveAutoHeightContentEl = (wrapper: HTMLElement) => {
      return (wrapper.querySelector('[data-auto-height="true"]') ||
        wrapper.querySelector(
          '[data-text-content="true"]',
        )) as HTMLElement | null;
    };

    // 获取元素初始 top（优先原始元数据）。
    const getWrapperOriginalTop = (wrapper: HTMLElement) => {
      return parseAttrNumber(
        wrapper,
        "data-original-top",
        parseFloat(wrapper.style.top || "") || 0,
      );
    };

    // 按原始纵向顺序比较包装元素。
    const compareWrappersByOriginalTop = (a: HTMLElement, b: HTMLElement) => {
      const topDelta = getWrapperOriginalTop(a) - getWrapperOriginalTop(b);
      if (Math.abs(topDelta) > 0.01) {
        return topDelta;
      }

      const seqA = a.getAttribute("data-wrapper-seq") || "";
      const seqB = b.getAttribute("data-wrapper-seq") || "";
      const seqDelta = seqA.localeCompare(seqB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (seqDelta !== 0) {
        return seqDelta;
      }

      const flowA = a.getAttribute("data-flow-id") || "";
      const flowB = b.getAttribute("data-flow-id") || "";
      return flowA.localeCompare(flowB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    };

    const isProcessableFlowWrapper = (wrapper: HTMLElement) => {
      if (wrapper.getAttribute("data-repeat-per-page") === "true") {
        return false;
      }

      const flowKind = getFlowKind(wrapper);
      const table = wrapper.querySelector("table") as HTMLElement | null;
      const autoHeightEl = resolveAutoHeightContentEl(wrapper);
      const isAutoHeight =
        flowKind === "auto-height" || (!table && !!autoHeightEl);

      if (!table && !autoHeightEl) return false;

      if (table && !isAutoHeight) {
        return table.getAttribute("data-auto-paginate") === "true";
      }

      return true;
    };

    const hasUnresolvedEarlierFlow = (wrapper: HTMLElement) => {
      const currentFlowId = wrapper.getAttribute("data-flow-id") || "";
      const currentOrigin = parseAttrNumber(
        wrapper,
        "data-origin-page-index",
        0,
      );

      const flowWrappers = Array.from(
        container.querySelectorAll("[data-print-wrapper][data-flow-id]"),
      ) as HTMLElement[];

      return flowWrappers.some((candidate) => {
        if (candidate === wrapper) return false;
        if (candidate.getAttribute("data-flow-id") === currentFlowId) {
          return false;
        }
        if (!isProcessableFlowWrapper(candidate)) return false;

        const candidateOrigin = parseAttrNumber(
          candidate,
          "data-origin-page-index",
          currentOrigin,
        );
        if (candidateOrigin !== currentOrigin) return false;
        if (compareWrappersByOriginalTop(candidate, wrapper) >= 0) {
          return false;
        }

        return !candidate.hasAttribute("data-flow-paginated");
      });
    };

    // 同步流式元素扩展后其下方元素的位置。
    // flowOnly=true：中间拆分页仅重排流式元素，固定元素暂不移动，
    // 直到当前拆分页链路结束（flowOnly=false）再统一收敛，保证 Y 轴顺序稳定。
    // freezeFlow=true：本轮固定流式包装元素（用于最终同步），
    // 避免在没有后续分页循环时继续移动流块。
    const syncElementsBelowTables = (flowOnly = false, freezeFlow = false) => {
      let workingPages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];
      if (workingPages.length === 0) return;

      const marginTop = store.pageSpacingY || 0;
      const marginBottom = store.pageSpacingY || 0;
      const tableEntriesByOrigin = new Map<
        number,
        Array<{ originalBottom: number; finalGlobalBottom: number }>
      >();

      workingPages.forEach((page, pageIndex) => {
        const pageRect = page.getBoundingClientRect();
        const wrappers = Array.from(
          page.querySelectorAll("[data-print-wrapper][data-flow-id]"),
        ) as HTMLElement[];

        wrappers.forEach((wrapper) => {
          // 仅已完成分页的流式包装元素可作为锚点来源。
          // 拆分页链路中的中间块（无 data-flow-paginated）底部位置不稳定，
          // 若参与锚定会导致后续元素过早上移。
          if (!wrapper.hasAttribute("data-flow-paginated")) {
            return;
          }

          const flowKind = getFlowKind(wrapper);
          const table = wrapper.querySelector("table");
          const autoHeightEl = resolveAutoHeightContentEl(wrapper);

          if (flowKind === "table") {
            if (!table) return;
            if (table.getAttribute("data-auto-paginate") !== "true") return;
          } else if (flowKind === "auto-height") {
            if (!autoHeightEl) return;
          } else {
            if (!table && !autoHeightEl) return;
            if (table && table.getAttribute("data-auto-paginate") !== "true")
              return;
          }

          const originPage = parseAttrNumber(
            wrapper,
            "data-origin-page-index",
            pageIndex,
          );
          const originalTop = parseAttrNumber(
            wrapper,
            "data-original-top",
            parseFloat(wrapper.style.top || "") || 0,
          );
          const originalHeight = parseAttrNumber(
            wrapper,
            "data-original-height",
            wrapper.getBoundingClientRect().height,
          );
          const originalBottom = originalTop + originalHeight;
          const contentRect = (table || autoHeightEl)!.getBoundingClientRect();
          const finalBottomInPage = contentRect.bottom - pageRect.top;
          const finalGlobalBottom = pageIndex * pageHeight + finalBottomInPage;

          const list = tableEntriesByOrigin.get(originPage) || [];
          const existing = list.find(
            (item) => Math.abs(item.originalBottom - originalBottom) < 0.5,
          );
          if (!existing) {
            list.push({ originalBottom, finalGlobalBottom });
          } else if (finalGlobalBottom > existing.finalGlobalBottom) {
            existing.finalGlobalBottom = finalGlobalBottom;
          }
          tableEntriesByOrigin.set(originPage, list);
        });
      });

      tableEntriesByOrigin.forEach((list) => {
        list.sort((a, b) => a.originalBottom - b.originalBottom);
      });

      const wrappersByOrigin = new Map<number, HTMLElement[]>();
      workingPages.forEach((page, pageIndex) => {
        const wrappers = Array.from(
          page.querySelectorAll("[data-print-wrapper]"),
        ) as HTMLElement[];
        wrappers.forEach((wrapper) => {
          const originPage = parseAttrNumber(
            wrapper,
            "data-origin-page-index",
            pageIndex,
          );
          const list = wrappersByOrigin.get(originPage) || [];
          list.push(wrapper);
          wrappersByOrigin.set(originPage, list);
        });
      });

      wrappersByOrigin.forEach((wrappers, originPage) => {
        wrappers.sort(compareWrappersByOriginalTop);

        let previousOriginalBottom: number | null = null;
        let previousFinalGlobalBottom: number | null = null;

        wrappers.forEach((wrapper) => {
          // 拆分页块共享原始 top 元数据，且需要保持各自块内布局，
          // 因此这里不再平移它们。非拆分页块的流式元素仍可继续平移，
          // 否则下游自动高度元素可能被“冻结”在旧位置。
          if (
            wrapper.hasAttribute("data-flow-id") &&
            wrapper.hasAttribute("data-is-split-chunk")
          ) {
            return;
          }
          if (wrapper.getAttribute("data-repeat-per-page") === "true") return;

          // flowOnly 模式（中间拆分页阶段）下跳过固定元素；
          // 固定元素在拆分页链路结束后的完整同步中再计算最终位置。
          if (flowOnly && !wrapper.hasAttribute("data-flow-id")) {
            return;
          }

          if (freezeFlow && wrapper.hasAttribute("data-flow-id")) {
            return;
          }

          const tableEntries = tableEntriesByOrigin.get(originPage);
          const originalTop = parseAttrNumber(
            wrapper,
            "data-original-top",
            parseFloat(wrapper.style.top || "") || 0,
          );
          const originalHeight = parseAttrNumber(
            wrapper,
            "data-original-height",
            wrapper.getBoundingClientRect().height,
          );
          const originalBottom = originalTop + originalHeight;

          const isHeader = copyHeader && originalTop < headerHeight + marginTop;
          const isFooter =
            copyFooter &&
            originalTop >= pageHeight - footerHeight - marginBottom;
          if (isHeader || isFooter) return;

          const currentTop = parseFloat(wrapper.style.top || "") || 0;
          const currentParent = wrapper.parentElement as HTMLElement | null;
          let currentPageIndex = currentParent
            ? workingPages.indexOf(currentParent)
            : originPage;
          if (currentPageIndex < 0) {
            currentPageIndex = originPage;
          }

          let targetGlobalTop = currentPageIndex * pageHeight + currentTop;

          // 先用已收敛流式元素作为基础锚点。
          if (tableEntries && tableEntries.length > 0) {
            let selectedTable: {
              originalBottom: number;
              finalGlobalBottom: number;
            } | null = null;
            for (let i = 0; i < tableEntries.length; i++) {
              const candidate = tableEntries[i];
              if (candidate.originalBottom <= originalTop + 0.01) {
                selectedTable = candidate;
              } else {
                break;
              }
            }

            if (selectedTable) {
              const gapToTable = originalTop - selectedTable.originalBottom;
              targetGlobalTop = selectedTable.finalGlobalBottom + gapToTable;
            }
          }

          // 严格串行顺序保护：保持与前一元素在原始 Y 顺序中的间距，
          // 防止后续元素（含流式文本）跨越到固定元素（如二维码）上方。
          if (
            previousOriginalBottom !== null &&
            previousFinalGlobalBottom !== null
          ) {
            const serialGap = originalTop - previousOriginalBottom;
            const serialGlobalTop = previousFinalGlobalBottom + serialGap;
            if (serialGlobalTop > targetGlobalTop) {
              targetGlobalTop = serialGlobalTop;
            }
          }

          let targetPageIndex = Math.floor(targetGlobalTop / pageHeight);
          if (targetPageIndex < 0) targetPageIndex = 0;

          let targetTop = targetGlobalTop - targetPageIndex * pageHeight;
          const minContentTop =
            copyHeader && headerHeight > 0
              ? headerHeight + marginTop
              : marginTop;
          const maxContentBottom =
            pageHeight - (copyFooter ? footerHeight : 0) - marginBottom;
          const availableContentHeight = maxContentBottom - minContentTop;
          const isFlowWrapper = wrapper.hasAttribute("data-flow-id");
          const wrapperRectHeight = wrapper.getBoundingClientRect().height;
          const wrapperHeight = isFlowWrapper
            ? wrapperRectHeight
            : parseAttrNumber(
                wrapper,
                "data-original-height",
                wrapperRectHeight,
              );

          if (wrapperHeight > 0) {
            if (targetTop < minContentTop) {
              targetTop = minContentTop;
            }

            if (isFlowWrapper) {
              // 流式包装元素（自动高度文本/表格）允许从当前页开始并跨页续拆。
              // 当起点进入页脚区域时，向后翻页并传递超出量，
              // 以保持与前序流式元素之间的设计间距（而非强制贴到页顶）。
              if (targetTop >= maxContentBottom - 0.5) {
                let overflow = targetTop - maxContentBottom;
                targetPageIndex += 1;
                targetTop = minContentTop + Math.max(overflow, 0);

                while (targetTop >= maxContentBottom - 0.5) {
                  overflow = targetTop - maxContentBottom;
                  targetPageIndex += 1;
                  targetTop = minContentTop + Math.max(overflow, 0);
                }
              }
            } else if (
              wrapperHeight <= availableContentHeight &&
              targetTop + wrapperHeight > maxContentBottom
            ) {
              // 固定元素跨页时保留溢出量，避免多个元素在新页顶端重叠。
              let overflow = targetTop + wrapperHeight - maxContentBottom;
              targetPageIndex += 1;
              targetTop = minContentTop + Math.max(overflow, 0);

              // 极端情况下（例如 targetTop 初值异常偏大），
              // 继续把剩余溢出向后页传递，直到可放入可打印区。
              while (targetTop + wrapperHeight > maxContentBottom + 0.5) {
                overflow = targetTop + wrapperHeight - maxContentBottom;
                targetPageIndex += 1;
                targetTop = minContentTop + Math.max(overflow, 0);
              }
            } else if (wrapperHeight > availableContentHeight) {
              // 超高固定元素无法完整放入可打印区时，
              // 固定到内容顶部边界，优先避免与页脚重叠。
              targetTop = minContentTop;
            }
          }

          while (targetPageIndex >= workingPages.length) {
            const sourcePage = workingPages[workingPages.length - 1];
            const newPage = document.createElement("div");
            newPage.className = sourcePage.className;
            newPage.style.cssText = sourcePage.style.cssText;
            newPage.innerHTML = "";
            copyHeaderFooter(
              sourcePage,
              newPage,
              headerHeight,
              footerHeight,
              pageHeight,
              copyHeader,
              copyFooter,
            );
            container.appendChild(newPage);
            workingPages = Array.from(container.children).filter(
              (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
            ) as HTMLElement[];
          }

          const targetPage = workingPages[targetPageIndex];
          const previousTop = parseFloat(wrapper.style.top || "") || 0;
          const didMovePage = wrapper.parentElement !== targetPage;
          const didMoveTop = Math.abs(previousTop - targetTop) > 0.1;
          if (wrapper.parentElement !== targetPage) {
            targetPage.appendChild(wrapper);
          }
          wrapper.style.removeProperty("top");
          wrapper.style.setProperty("top", `${targetTop}px`, "important");

          // 流式元素若在已标记分页后又被上游增长推移，
          // 需要清除标记以便按新位置重新分页。
          if (
            wrapper.hasAttribute("data-flow-id") &&
            wrapper.hasAttribute("data-flow-paginated") &&
            (didMovePage || didMoveTop)
          ) {
            wrapper.removeAttribute("data-flow-paginated");
          }

          const finalGlobalTop = targetPageIndex * pageHeight + targetTop;
          const flowEntry = isFlowWrapper
            ? tableEntries?.find(
                (item) => Math.abs(item.originalBottom - originalBottom) < 0.5,
              )
            : null;
          const hasReliableSerialBottom = !isFlowWrapper || !!flowEntry;
          if (hasReliableSerialBottom) {
            const finalGlobalBottom = flowEntry
              ? flowEntry.finalGlobalBottom
              : finalGlobalTop + wrapperHeight;
            previousOriginalBottom = originalBottom;
            previousFinalGlobalBottom = finalGlobalBottom;
          }
        });
      });

      // 在平移过程中可能新增页面，需及时刷新外层 pages 引用，
      // 确保后续循环仍会处理已移动的流式元素。
      pages = workingPages;
    };

    let pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];

    // 计算流式块在新页中的起始 Y 坐标。
    const resolveFlowChunkStartY = (wrapper: HTMLElement) => {
      const marginTop = store.pageSpacingY || 0;
      const minTop =
        copyHeader && headerHeight > 0 ? headerHeight + marginTop : marginTop;
      let startY = minTop;
      const originalTopVal = parseAttrNumber(
        wrapper,
        "data-original-top",
        parseFloat(wrapper.style.top || "") || 0,
      );
      if (originalTopVal >= minTop && originalTopVal <= minTop + 100) {
        startY = originalTopVal;
      }
      return startY;
    };

    // 创建用于承接溢出内容的新页，并复制页眉页脚。
    const createFlowOverflowPage = (
      currentPage: HTMLElement,
      currentPageIndex: number,
    ) => {
      const newPage = document.createElement("div");
      newPage.className = currentPage.className;
      newPage.style.cssText = currentPage.style.cssText;
      newPage.innerHTML = "";

      copyHeaderFooter(
        currentPage,
        newPage,
        headerHeight,
        footerHeight,
        pageHeight,
        copyHeader,
        copyFooter,
      );

      if (currentPageIndex === pages.length - 1) {
        container.appendChild(newPage);
      } else {
        container.insertBefore(newPage, pages[currentPageIndex + 1]);
      }

      pages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];
      return newPage;
    };

    const syncTableRightEdgeLines = (
      wrapper: HTMLElement,
      tableEl: HTMLElement | null,
    ) => {
      if (!tableEl) return;

      const tableHeight = Math.max(0, tableEl.getBoundingClientRect().height);
      const rightEdgeLines = wrapper.querySelectorAll<HTMLElement>(
        '[data-print-table-right-edge="true"]',
      );

      rightEdgeLines.forEach((line) => {
        line.style.setProperty("top", "0px");
        line.style.setProperty("bottom", "auto");
        line.style.setProperty("height", `${tableHeight}px`);
        line.style.setProperty("max-height", "none");
        line.style.setProperty("min-height", "0px");
      });
    };

    // 通过二分查找自动高度文本可切分位置。
    const findAutoHeightSplitIndex = (
      textEl: HTMLElement,
      fullText: string,
      limitBottom: number,
    ) => {
      if (!fullText) return 0;

      // 归一化切分点：优先在换行或空白处分割，减少断词。
      const normalizeSplitIndex = (candidate: number) => {
        if (candidate <= 0 || candidate >= fullText.length) return candidate;

        const nearNewLine = fullText.lastIndexOf("\n", candidate - 1);
        if (nearNewLine >= Math.max(0, candidate - 120)) {
          return nearNewLine + 1;
        }

        const nearSpace = Math.max(
          fullText.lastIndexOf(" ", candidate - 1),
          fullText.lastIndexOf("\t", candidate - 1),
        );
        if (nearSpace >= Math.max(0, candidate - 40)) {
          return nearSpace + 1;
        }

        return candidate;
      };

      let low = 1;
      let high = fullText.length;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        textEl.textContent = fullText.slice(0, mid);
        const bottom = textEl.getBoundingClientRect().bottom;
        if (bottom <= limitBottom + 1) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const adjusted = normalizeSplitIndex(best);
      if (adjusted > 0 && adjusted < fullText.length && adjusted !== best) {
        textEl.textContent = fullText.slice(0, adjusted);
        if (textEl.getBoundingClientRect().bottom <= limitBottom + 1) {
          best = adjusted;
        }
      }

      textEl.textContent = fullText;
      return best;
    };

    // 修复已标记分页但仍溢出的流式元素状态。
    const markOverflowedPaginatedFlows = () => {
      let repaired = 0;
      pages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];

      pages.forEach((page) => {
        const pageRect = page.getBoundingClientRect();
        const marginBottom = store.pageSpacingY || 0;
        const effectiveFooterHeight = copyFooter ? footerHeight : 0;
        const limitBottom =
          pageRect.top + pageHeight - effectiveFooterHeight - marginBottom;
        const wrappers = Array.from(
          page.querySelectorAll(
            "[data-print-wrapper][data-flow-id][data-flow-paginated]",
          ),
        ) as HTMLElement[];

        wrappers.forEach((wrapper) => {
          const flowKind = getFlowKind(wrapper);
          const table = wrapper.querySelector("table") as HTMLElement | null;
          const autoHeightEl = resolveAutoHeightContentEl(wrapper);
          const isAutoHeight =
            flowKind === "auto-height" || (!table && !!autoHeightEl);

          if (!table && !autoHeightEl) return;

          if (table && !isAutoHeight) {
            const autoPaginate =
              table.getAttribute("data-auto-paginate") === "true";
            if (!autoPaginate) return;
          }

          const contentRect = (table || autoHeightEl)!.getBoundingClientRect();
          if (contentRect.bottom > limitBottom + 1) {
            wrapper.removeAttribute("data-flow-paginated");
            repaired += 1;
          }
        });
      });

      return repaired;
    };

    // 统计仍待处理的流式包装元素数量。
    const countPendingFlowWrappers = () => {
      let pending = 0;
      pages = Array.from(container.children).filter(
        (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
      ) as HTMLElement[];

      pages.forEach((page) => {
        const wrappers = Array.from(
          page.querySelectorAll(
            "[data-print-wrapper][data-flow-id]:not([data-flow-paginated])",
          ),
        ) as HTMLElement[];

        wrappers.forEach((wrapper) => {
          if (wrapper.getAttribute("data-repeat-per-page") === "true") return;

          const flowKind = getFlowKind(wrapper);
          const table = wrapper.querySelector("table") as HTMLElement | null;
          const autoHeightEl = resolveAutoHeightContentEl(wrapper);
          const isAutoHeight =
            flowKind === "auto-height" || (!table && !!autoHeightEl);

          if (!table && !autoHeightEl) return;

          if (table && !isAutoHeight) {
            const autoPaginate =
              table.getAttribute("data-auto-paginate") === "true";
            if (!autoPaginate) return;
          }

          // 为保证收敛性，跳过旋转/斜切元素：
          // runFlowPaginationPass 中本就不会处理这类变换场景。
          const transform = window.getComputedStyle(wrapper).transform;
          if (transform && transform !== "none") {
            if (!transform.startsWith("matrix")) {
              return;
            }
            const values = transform
              .substring(7, transform.length - 1)
              .split(",");
            if (values.length >= 4) {
              const b = parseFloat(values[1]);
              const c = parseFloat(values[2]);
              if (Math.abs(b) > 0.001 || Math.abs(c) > 0.001) {
                return;
              }
            }
          }

          pending += 1;
        });
      });

      return pending;
    };

    // 执行一轮流式元素分页，处理表格与自动高度文本拆分。
    const runFlowPaginationPass = () => {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        const flowWrappers = (
          Array.from(
            page.querySelectorAll("[data-print-wrapper][data-flow-id]"),
          ) as HTMLElement[]
        ).sort(compareWrappersByOriginalTop);

        flowWrappers.forEach((wrapper) => {
          if (wrapper.parentElement !== page) return; // 若已移动到其它页则跳过
          if (wrapper.hasAttribute("data-flow-paginated")) return; // 已处理完成则跳过

          const flowKind = getFlowKind(wrapper);
          const table = wrapper.querySelector("table") as HTMLElement | null;
          const autoHeightEl = resolveAutoHeightContentEl(wrapper);
          const isAutoHeight =
            flowKind === "auto-height" || (!table && !!autoHeightEl);

          if (!table && !autoHeightEl) return;

          // 表格遵循元素级自动分页开关。
          if (table && flowKind !== "auto-height") {
            const autoPaginate =
              table.getAttribute("data-auto-paginate") === "true";
            if (!autoPaginate) return;
          }

          // 检查旋转/斜切变换；当前分页算法基于 Y 轴，不处理旋转场景。
          const wrapperStyle = window.getComputedStyle(wrapper);
          const transform = wrapperStyle.transform;
          if (transform && transform !== "none") {
            // 简单矩阵判定：matrix(a, b, c, d, tx, ty)，b/c 非 0 视为旋转或斜切。
            if (transform.startsWith("matrix")) {
              const values = transform
                .substring(7, transform.length - 1)
                .split(",");
              if (values.length >= 4) {
                const b = parseFloat(values[1]);
                const c = parseFloat(values[2]);
                if (Math.abs(b) > 0.001 || Math.abs(c) > 0.001) {
                  return;
                }
              }
            }
          }

          // 后续流式元素必须等待前序流式元素完整分页并收敛，
          // 否则会先生成一批过时拆分页块，前序表格扩展后就可能互相重叠。
          if (hasUnresolvedEarlierFlow(wrapper)) return;

          // 解除高度限制：允许包装元素随内容自适应展开。
          wrapper.style.height = "auto";
          if (table) {
            table.style.height = "auto";
            table.style.maxHeight = "none";
            table.style.minHeight = "0";
            const tbodyEl = table.querySelector("tbody");
            if (tbodyEl) {
              (tbodyEl as HTMLElement).style.height = "auto";
              (tbodyEl as HTMLElement).style.maxHeight = "none";
              (tbodyEl as HTMLElement).style.minHeight = "0";
            }

            // 解除溢出限制：移除表格根容器的固定高度与裁剪限制。
            // 表格通常被包裹在带 h-full / overflow-hidden 的容器中。
            const tableRoot = table.parentElement as HTMLElement;
            if (tableRoot) {
              tableRoot.classList.remove("h-full", "overflow-hidden");
              tableRoot.style.height = "auto";
              tableRoot.style.maxHeight = "none";
              tableRoot.style.overflow = "visible";
            }

            // cloneElementWithStyles 会把计算后的 fixed height 直接内联到所有祖先节点。
            // 这里沿着 table -> wrapper 链路统一解除 h-full/overflow-hidden 与 max-height 约束，
            // 避免分页被元素框选高度误导。
            let tableAncestor = table.parentElement as HTMLElement | null;
            while (tableAncestor && tableAncestor !== wrapper) {
              tableAncestor.classList.remove("h-full", "overflow-hidden");
              tableAncestor.style.height = "auto";
              tableAncestor.style.maxHeight = "none";
              tableAncestor.style.overflow = "visible";
              tableAncestor = tableAncestor.parentElement as HTMLElement | null;
            }

            // 导出态右侧补线在 clone 后可能带有固定像素高度，
            // 需要在分页阶段回收为 top/bottom 约束，避免出现“向下延展”的竖线。
            const rightEdgeLines = wrapper.querySelectorAll<HTMLElement>(
              '[data-print-table-right-edge="true"]',
            );
            rightEdgeLines.forEach((line) => {
              line.style.removeProperty("height");
              line.style.removeProperty("max-height");
              line.style.removeProperty("min-height");
              line.style.setProperty("top", "0px");
              line.style.setProperty("bottom", "0px");
            });
          } else if (isAutoHeight && autoHeightEl) {
            // 去除元素自身 h-full/overflow-hidden，允许自动高度扩展。
            const htmlEl = autoHeightEl;
            htmlEl.classList.remove("h-full", "overflow-hidden");
            htmlEl.style.height = "auto";
            htmlEl.style.overflow = "visible";

            // 同时确保外层包装容器也可扩展。
            const textRoot = htmlEl.parentElement as HTMLElement;
            if (textRoot) {
              textRoot.style.height = "auto";
              textRoot.style.overflow = "visible";
            }
          }

          // 使用 getBoundingClientRect 计算位置，提升亚像素场景精度。
          const pageRect = page.getBoundingClientRect();
          const marginBottom = store.pageSpacingY || 0;
          const effectiveFooterHeight = copyFooter ? footerHeight : 0;
          const limitBottom =
            pageRect.top + pageHeight - effectiveFooterHeight - marginBottom;
          const wrapperRect = wrapper.getBoundingClientRect();
          const wrapperTop = wrapperRect.top;

          if (isAutoHeight) {
            if (!autoHeightEl) return;
            // 自动高度文本可直接按容器底部判断是否溢出。
            const contentRect = autoHeightEl.getBoundingClientRect();
            if (contentRect.bottom <= limitBottom + 1) {
              wrapper.setAttribute("data-flow-paginated", "true");
              syncElementsBelowTables();
              return;
            }

            const textEl = autoHeightEl;
            const fullText = textEl.textContent || "";

            if (!fullText) {
              wrapper.setAttribute("data-flow-paginated", "true");
              syncElementsBelowTables();
              return;
            }

            let splitIndex = findAutoHeightSplitIndex(
              textEl,
              fullText,
              limitBottom,
            );

            if (splitIndex <= 0) {
              const startY = resolveFlowChunkStartY(wrapper);
              if (wrapperTop <= startY + 5) {
                splitIndex = 1;
              } else {
                const newPage = createFlowOverflowPage(page, i);
                wrapper.style.removeProperty("top");
                wrapper.style.setProperty("top", `${startY}px`, "important");
                newPage.appendChild(wrapper);
                // 此分支仅将同一包装元素整体移到下一页，
                // 不属于真实文本拆分块，需保留后续重排资格。
                wrapper.removeAttribute("data-is-split-chunk");
                wrapper.removeAttribute("data-flow-paginated");
                syncElementsBelowTables(true);
                return;
              }
            }

            if (splitIndex >= fullText.length) {
              wrapper.setAttribute("data-flow-paginated", "true");
              syncElementsBelowTables();
              return;
            }

            const currentText = fullText.slice(0, splitIndex);
            const overflowText = fullText.slice(splitIndex);
            textEl.textContent = currentText;

            const newPage = createFlowOverflowPage(page, i);
            const newWrapper = wrapper.cloneNode(true) as HTMLElement;
            const newTextEl = newWrapper.querySelector(
              '[data-auto-height="true"]',
            ) as HTMLElement | null;
            if (newTextEl) {
              newTextEl.classList.remove("h-full", "overflow-hidden");
              newTextEl.style.height = "auto";
              newTextEl.style.overflow = "visible";
              newTextEl.textContent = overflowText;

              const newTextRoot = newTextEl.parentElement as HTMLElement | null;
              if (newTextRoot) {
                newTextRoot.style.height = "auto";
                newTextRoot.style.overflow = "visible";
              }
            }

            const startY = resolveFlowChunkStartY(wrapper);
            newWrapper.style.removeProperty("top");
            newWrapper.style.setProperty("top", `${startY}px`, "important");

            newPage.appendChild(newWrapper);
            wrapper.setAttribute("data-flow-paginated", "true");
            newWrapper.setAttribute("data-is-split-chunk", "true");
            syncElementsBelowTables(true);
            return;
          }

          if (!table) {
            wrapper.setAttribute("data-flow-paginated", "true");
            syncElementsBelowTables();
            return;
          }

          // 需要对表格进行拆分。
          let splitIndex = -1;

          const tbody = table.querySelector("tbody");
          if (!tbody) return;
          const rows = Array.from(tbody.querySelectorAll("tr"));

          // 若页脚需要重复，需预留页脚高度。
          const tfoot = table.querySelector("tfoot");
          const isFooterRepeated =
            table.getAttribute("data-tfoot-repeat") === "true";
          let repeatedFooterHeight = 0;
          let totalFooterHeight = 0;
          if (tfoot) {
            totalFooterHeight = tfoot.getBoundingClientRect().height;
            if (isFooterRepeated) {
              repeatedFooterHeight = totalFooterHeight;
            }
          }

          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const rowRect = row.getBoundingClientRect();
            
            let currentFooterHeight = repeatedFooterHeight;
            if (!isFooterRepeated && r === rows.length - 1) {
              currentFooterHeight = totalFooterHeight;
            }

            // 预留 1px 缓冲，避免浮点误差。
            if (rowRect.bottom + currentFooterHeight > limitBottom + 1) {
              splitIndex = r;

              // 防止死循环：若首行已超限且表格已贴近页首，
              // 必须至少保留一行在当前页。
              if (splitIndex === 0) {
                const marginTop = store.pageSpacingY || 0;
                const minTop =
                  copyHeader && headerHeight > 0
                    ? headerHeight + marginTop
                    : marginTop;
                let startY = minTop;
                const originalTopVal = parseAttrNumber(
                  wrapper,
                  "data-original-top",
                  parseFloat(wrapper.style.top || "") || 0,
                );
                if (
                  originalTopVal >= minTop &&
                  originalTopVal <= minTop + 100
                ) {
                  startY = originalTopVal;
                }

                // 若当前位置已接近页首，强制保留一行。
                if (wrapperTop <= startY + 5) {
                  splitIndex = 1; // 强制保留一行
                }
              }
              break;
            }
          }

          if (splitIndex !== -1) {
            // 创建新页承接拆分后的后半段。
            const newPage = createFlowOverflowPage(page, i);

            // 克隆包装元素到新页。
            const newWrapper = wrapper.cloneNode(true) as HTMLElement;
            // 顶部定位到内容可用起点（页眉下方或页面内边距起点）。
            const startY = resolveFlowChunkStartY(wrapper);

            newWrapper.style.removeProperty("top");
            newWrapper.style.setProperty("top", `${startY}px`, "important");
            // 高度保持自动（由克隆节点样式继承）。

            // 清理旧表格：移除 splitIndex 之后的行。
            const oldRows = rows;
            for (let k = splitIndex; k < oldRows.length; k++) {
              oldRows[k].remove();
            }

            // 若 splitIndex 为 0（仅剩表头），删除旧包装避免孤立表头。
            if (splitIndex === 0) {
              wrapper.remove();
            }
            // 处理旧表页脚：未开启重复时移除，开启重复则更新汇总。
            const oldTfoot = table.querySelector("tfoot");
            const shouldRepeatFooter =
              table.getAttribute("data-tfoot-repeat") === "true";

            if (oldTfoot) {
              if (!shouldRepeatFooter) {
                oldTfoot.remove();
              } else {
                updatePageSums(table);
              }
            }

            // 旧页表格在移除后半段行后，需要重算右侧补线高度。
            syncTableRightEdgeLines(wrapper, table);

            // 清理新表格：移除 splitIndex 之前的行。
            const newTable = newWrapper.querySelector("table") as HTMLElement;
            newTable.style.height = "auto";
            const newTbody = newTable.querySelector("tbody") as HTMLElement;
            if (newTbody) {
              newTbody.style.height = "auto";
              const newRowsList = Array.from(newTbody.querySelectorAll("tr"));
              for (let k = 0; k < splitIndex; k++) {
                newRowsList[k]?.remove();
              }
            }

            newPage.appendChild(newWrapper);
            // 新页表格落位后重算右侧补线高度，避免沿用克隆前高度。
            syncTableRightEdgeLines(newWrapper, newTable);
            wrapper.setAttribute("data-flow-paginated", "true");
            // splitIndex=0 表示旧块已被整体替换，新块应作为该流的首块参与后续重排；
            // 否则会被 syncElementsBelowTables 当作中间拆分页块跳过，导致与前序流块重叠。
            if (splitIndex === 0) {
              newWrapper.removeAttribute("data-is-split-chunk");
            } else {
              newWrapper.setAttribute("data-is-split-chunk", "true");
            }

            syncElementsBelowTables(true);
          } else {
            syncTableRightEdgeLines(wrapper, table);
            if (table) updatePageSums(table);
            wrapper.setAttribute("data-flow-paginated", "true");
            syncElementsBelowTables();
          }
        });
      }
    };

    const maxPaginationPasses = 60;
    for (let pass = 0; pass < maxPaginationPasses; pass++) {
      runFlowPaginationPass();
      const repairedCount = markOverflowedPaginatedFlows();
      const pendingCount = countPendingFlowWrappers();
      if (repairedCount === 0 && pendingCount === 0) {
        break;
      }
    }

    // 最终收敛：根据流式结果修正固定元素，不再移动流式元素，
    // 因为此调用之后不会再进入分页循环。
    syncElementsBelowTables(false, true);

    // 清理分页位移过程中可能产生的空页面。
    pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;

    // 倒序遍历，便于安全删除页面；首屏（i=0）永不删除。
    for (let i = pages.length - 1; i > 0; i--) {
      const page = pages[i];
      const wrappers = Array.from(
        page.querySelectorAll("[data-print-wrapper]"),
      ) as HTMLElement[];

      const hasContent = wrappers.some((w) => {
        if (w.hasAttribute("data-flow-id")) return true;

        const isRepeatPerPage =
          w.getAttribute("data-repeat-per-page") === "true";
        if (isRepeatPerPage) return false;

        const top = parseFloat(w.style.top) || 0;
        const isHeader = copyHeader && top < headerHeight + marginTop;
        const isFooter =
          copyFooter && top >= pageHeight - footerHeight - marginBottom;

        if (isHeader || isFooter) return false;

        return true;
      });

      if (!hasContent) {
        page.remove();
      }
    }

    // 重新写回每页 top，保证页面在容器中的纵向连续排列。
    pages = Array.from(container.children).filter(
      (el) => !["STYLE", "LINK", "SCRIPT"].includes(el.tagName),
    ) as HTMLElement[];
    pages.forEach((p, idx) => {
      p.style.top = `${idx * pageHeight}px`;
    });

    return pages.length;
  };

  return { updatePageNumbers, handleTablePagination };
};
