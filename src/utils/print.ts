import { nextTick, createApp, h } from 'vue';
import { createPinia } from 'pinia';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type Page, type WatermarkSettings } from '@/types';
import { usePrintSettings, type PrintMode, type PrintOptions } from '@/composables/usePrintSettings';
import { toast } from '@/utils/toast';
import i18n from '@/locales';
import PrintRenderer from '@/components/print/PrintRenderer.vue';
import baseStyles from '@/style.css?inline';
import { pxToMm } from '@/utils/units';

export const usePrint = () => {
  const store = useDesignerStore();
  const {
    printMode,
    silentPrint,
    localSettings,
    remoteSettings,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localWsUrl,
    remoteSelectedClientId,
    fetchRemoteClients,
    fetchRemotePrinters,
    submitRemoteTask,
    exportImageMerged
  } = usePrintSettings();

  const createRepeatedPages = (originalPages: Page[]): Page[] => {
    const original = cloneDeep(originalPages);
    if (original.length === 0) return original;

    const hasHeader = store.headerHeight > 0 && store.showHeaderLine;
    const hasFooter = store.footerHeight > 0 && store.showFooterLine;

    const basePage = original[0];
    const canvasHeight = store.canvasSize.height;
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;
    const headerBoundary = store.headerHeight + marginTop;
    const footerBoundary = canvasHeight - (store.footerHeight + marginBottom);

    const repeatHeaders = hasHeader ? basePage.elements.filter(e => {
      const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
      return bounds.maxY <= headerBoundary;
    }) : [];

    const repeatFooters = hasFooter ? basePage.elements.filter(e => {
      const bounds = store.getElementBoundsAtPosition(e, e.x, e.y);
      return bounds.minY >= footerBoundary;
    }) : [];

    const repeatPerPageElements = basePage.elements.filter(e => e.type !== ElementType.TABLE && e.repeatPerPage === true);
    const repeatMap = new Map<string, typeof basePage.elements[number]>();
    [...repeatHeaders, ...repeatFooters, ...repeatPerPageElements].forEach(el => {
      repeatMap.set(el.id, el);
    });
    const repeatedElements = Array.from(repeatMap.values());
    if (repeatedElements.length === 0) return original;

    const withRepeats = cloneDeep(original);
    for (let i = 0; i < withRepeats.length; i++) {
      if (i === 0) continue;
      const page = withRepeats[i];

      for (const el of repeatedElements) {
        page.elements.push({ ...cloneDeep(el), id: uuidv4() });
      }
    }
    return withRepeats;
  };

  const prepareEnvironment = async (options: { mutateStore?: boolean; setExporting?: boolean } = {}) => {
    // We want to be very explicit about these defaults.
    // By default, we should NOT mutate the main store unless explicitly requested.
    const mutateStore = options.mutateStore === true;
    const setExporting = options.setExporting === true;
    
    const previousSelection = store.selectedElementId;
    const previousShowGrid = store.showGrid;
    const previousZoom = store.zoom;
    const previousPages = cloneDeep(store.pages);
    const previousShowHeaderLine = store.showHeaderLine;
    const previousShowFooterLine = store.showFooterLine;
    const previousShowCornerMarkers = store.showCornerMarkers;
    const previousIsExporting = Boolean(store.isExporting);
    const previousBodyHasExporting = document.body.classList.contains('exporting');
    
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverflowY = document.body.style.overflowY;

    if (mutateStore) {
      store.selectElement(null);
      store.setShowGrid(false);
      store.setZoom(1); // Ensure 100% zoom for correct rendering

      // Apply repeats
      store.pages = createRepeatedPages(store.pages);

      // Hide UI overlays
      store.setShowHeaderLine(false);
      store.setShowFooterLine(false);
      store.showCornerMarkers = false;
    }

    if (setExporting) {
      store.setIsExporting(true);
      document.body.classList.add('exporting');
    }

    if (mutateStore || setExporting) {
      document.documentElement.style.overflowX = 'hidden';
      document.documentElement.style.overflowY = 'hidden';
      document.body.style.overflowX = 'hidden';
      document.body.style.overflowY = 'hidden';
      
      await nextTick();
      // Wait for async rendering (like QR Codes)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return () => {
      // Always restore these critical UI states to ensure the canvas returns to normal
      // even if something went wrong or mutateStore/setExporting were false
      if (document.body.classList.contains('exporting') && !previousBodyHasExporting) {
        document.body.classList.remove('exporting');
      }
      
      if (store.isExporting !== previousIsExporting) {
        store.setIsExporting(previousIsExporting);
      }

      if (store.showCornerMarkers !== previousShowCornerMarkers) {
        store.showCornerMarkers = previousShowCornerMarkers;
      }

      // Restore overflow styles if they were changed
      if (mutateStore || setExporting) {
        document.documentElement.style.overflowX = previousHtmlOverflowX;
        document.documentElement.style.overflowY = previousHtmlOverflowY;
        document.body.style.overflowX = previousBodyOverflowX;
        document.body.style.overflowY = previousBodyOverflowY;
      }
      
      if (mutateStore) {
        store.setShowGrid(previousShowGrid);
        store.selectElement(previousSelection);
        store.setZoom(previousZoom);
        store.pages = previousPages;
        store.setShowHeaderLine(previousShowHeaderLine);
        store.setShowFooterLine(previousShowFooterLine);
      }
    };
  };

  const isShadowDomContent = (content?: HTMLElement | string | HTMLElement[]) => {
    if (!content || typeof content === 'string') return false;
    const first = Array.isArray(content) ? content[0] : content;
    if (!(first instanceof HTMLElement)) return false;
    return first.getRootNode() instanceof ShadowRoot;
  };

  const lockViewportScroll = (reserveScrollbarGutter = true) => {
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousHtmlScrollbarGutter = document.documentElement.style.scrollbarGutter;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyOverflowY = document.body.style.overflowY;
    const previousBodyScrollbarGutter = document.body.style.scrollbarGutter;

    document.documentElement.style.overflowX = 'hidden';
    document.documentElement.style.overflowY = 'hidden';
    document.documentElement.style.scrollbarGutter = reserveScrollbarGutter ? 'stable' : '';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden';
    document.body.style.scrollbarGutter = reserveScrollbarGutter ? 'stable' : '';

    return () => {
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
      document.documentElement.style.scrollbarGutter = previousHtmlScrollbarGutter;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.overflowY = previousBodyOverflowY;
      document.body.style.scrollbarGutter = previousBodyScrollbarGutter;
    };
  };

  const cleanElement = (element: HTMLElement) => {
    // Remove interactive classes
    element.classList.remove(
      'group', 
      'cursor-move', 
      'select-none', 
      'ring-2', 
      'ring-blue-500', 
      'ring-red-500',
      'hover:outline',
      'hover:outline-1',
      'hover:outline-blue-300'
    );
    
    // Remove any other hover/focus/active classes
    const classesToRemove: string[] = [];
    element.classList.forEach(cls => {
      if (cls.startsWith('hover:') || cls.startsWith('focus:') || cls.startsWith('active:')) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach(cls => element.classList.remove(cls));

    // Force cleanup of border/outline/box-shadow if it looks like a helper style
    // Only remove if the border is transparent (helper border)
    // Do NOT remove dashed borders if they have a visible color
    const isTransparentBorder = 
      element.style.borderColor === 'transparent' || 
      element.style.border.includes('transparent') ||
      (element.style.borderStyle === 'dashed' && (element.style.borderColor === 'transparent' || !element.style.borderColor && element.style.border.includes('transparent')));

    if (isTransparentBorder) {
       element.style.border = 'none';
       element.style.outline = 'none';
       element.style.boxShadow = 'none';
    }

    // Recursively clean children
    Array.from(element.children).forEach(child => cleanElement(child as HTMLElement));
  };

  type PrintRenderPayload = {
    pages: Page[];
    canvasSize: { width: number; height: number };
    canvasBackground: string;
    headerHeight: number;
    footerHeight: number;
    pageSpacingX: number;
    pageSpacingY: number;
    showHeaderLine: boolean;
    showFooterLine: boolean;
    watermark: WatermarkSettings;
    unit: 'mm' | 'px' | 'pt' | 'in' | 'cm';
    testData: Record<string, any>;
    variables: Record<string, any>;
  };

  const fallbackWatermark: WatermarkSettings = {
    enabled: false,
    text: '',
    angle: -30,
    color: '#000000',
    opacity: 0.1,
    size: 24,
    density: 160
  };

  const buildPrintRenderPayload = (): PrintRenderPayload => ({
    pages: createRepeatedPages(store.pages),
    canvasSize: { ...store.canvasSize },
    canvasBackground: store.canvasBackground,
    headerHeight: store.headerHeight,
    footerHeight: store.footerHeight,
    pageSpacingX: store.pageSpacingX || 0,
    pageSpacingY: store.pageSpacingY || 0,
    showHeaderLine: store.showHeaderLine,
    showFooterLine: store.showFooterLine,
    watermark: cloneDeep(store.watermark || fallbackWatermark),
    unit: store.unit || 'mm',
    testData: cloneDeep(store.testData || {}),
    variables: cloneDeep(store.variables || {})
  });

  const waitForMessage = (token: string, type: string, timeoutMs = 15000) => new Promise<any>((resolve, reject) => {
    const origin = window.location.origin;
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', handler);
      window.removeEventListener(`print-renderer:${type}`, customHandler as any);
      reject(new Error(`Print renderer timeout: ${type}`));
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as { type?: string; token?: string };
      if (!data || data.type !== type || data.token !== token) return;
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handler);
      window.removeEventListener(`print-renderer:${type}`, customHandler as any);
      resolve(data);
    };

    const customHandler = (event: CustomEvent) => {
      if (event.detail && event.detail.token === token) {
        window.clearTimeout(timeoutId);
        window.removeEventListener('message', handler);
        window.removeEventListener(`print-renderer:${type}`, customHandler as any);
        resolve({ type, token });
      }
    };

    window.addEventListener('message', handler);
    window.addEventListener(`print-renderer:${type}`, customHandler as any);
  });

  const renderPagesViaIframe = async () => {
    const token = uuidv4();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-print-renderer', 'true');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) throw new Error('Print renderer not available');

    // Inject styles
    const style = frameDoc.createElement('style');
    style.textContent = baseStyles;
    frameDoc.head.appendChild(style);

    const mountEl = frameDoc.createElement('div');
    mountEl.id = 'app';
    frameDoc.body.appendChild(mountEl);

    const payload = buildPrintRenderPayload();
    const app = createApp({
      render: () => h(PrintRenderer, { payload, token })
    });

    // Use a fresh Pinia instance for isolation to avoid polluting the main app's state
    app.use(createPinia());
    app.use(i18n);

    app.mount(mountEl);

    const cleanup = () => {
      app.unmount();
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    try {
      // Wait for rendering to complete
      await waitForMessage(token, 'print-renderer-rendered');

      const pages = Array.from(frameDoc.querySelectorAll('.print-page')) as HTMLElement[];
      return {
        pages,
        cleanup,
        getComputedStyleFn: frameWin.getComputedStyle.bind(frameWin)
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  };

  const resolveRenderSource = async (content: HTMLElement | string | HTMLElement[]) => {
    if (typeof content === 'string') {
      return { content, cleanup: null as null | (() => void), getComputedStyleFn: window.getComputedStyle };
    }

    const iframeResult = await renderPagesViaIframe();
    return { content: iframeResult.pages, cleanup: iframeResult.cleanup, getComputedStyleFn: iframeResult.getComputedStyleFn };
  };

  const getPrintHtml = async (content?: HTMLElement[]): Promise<string> => {
    const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
    const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;

    let resultContainer: HTMLElement | null = null;
    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
        const source = await resolveRenderSource(targetContent);
        cleanup = source.cleanup;

        // Use the shared processing logic (handles pagination, SVG, etc.)
        const result = await processContentForImage(source.content, width, height, true, source.getComputedStyleFn);
        resultContainer = result.container;
        tempWrapper = result.tempWrapper;

        // Transform the absolute positioned pages into a vertical layout for preview
        const previewContainer = document.createElement('div');
        previewContainer.style.width = '100%';
        previewContainer.style.display = 'flex';
        previewContainer.style.flexDirection = 'column';
        previewContainer.style.alignItems = 'center';
        // previewContainer.style.padding = '20px';
        // previewContainer.style.backgroundColor = '#f3f4f6';

        const paginatedPages = Array.from(resultContainer.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
        
        paginatedPages.forEach((page, index) => {
            const clone = page.cloneNode(true) as HTMLElement;
            const isLastPage = index === paginatedPages.length - 1;
            
            // Adjust styles for preview display
            clone.style.position = 'relative';
            clone.style.left = 'auto';
            clone.style.top = 'auto';
            clone.style.width = `${width}px`;
            clone.style.height = `${height}px`;
            clone.style.margin = isLastPage ? '0' : '0 0 20px 0';
            // clone.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            clone.style.backgroundColor = store.canvasBackground;
            clone.style.transform = 'none';
            // clone.style.border = '1px solid #eee';
            
            previewContainer.appendChild(clone);
        });
        
        return previewContainer.outerHTML;
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      if (cleanup) {
        cleanup();
      }
      restore();
    }
  };

  const svgToCanvas = async (root: HTMLElement) => {
    const svgs = root.querySelectorAll('svg');
    if (svgs.length === 0) return;
    // @ts-ignore - Ignore TS7016: canvg package.json exports issue
    const { Canvg } = await import('canvg');
    
    svgs.forEach((svg) => {
      const parent = svg.parentElement as HTMLElement | null;
      if (!parent) return;
      const style = getComputedStyle(parent);
      const w = parseFloat(style.width);
      const h = parseFloat(style.height);
      const canvas = document.createElement('canvas');
      canvas.width = Number.isFinite(w) ? Math.max(1, Math.round(w)) : 10;
      canvas.height = Number.isFinite(h) ? Math.max(1, Math.round(h)) : 10;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const serializer = new XMLSerializer();
      // Explicitly set width/height on SVG before serialization to ensure Canvg renders it at full size
      svg.setAttribute('width', `${w}px`);
      svg.setAttribute('height', `${h}px`);
      
      const str = serializer.serializeToString(svg);
      const instance = Canvg.fromString(ctx, str);
      instance.render();

      // Convert canvas to image so it persists in outerHTML (for preview)
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      // Copy classes/styles if needed, or at least display block
      img.style.display = 'block';
      
      svg.before(img);
      parent.removeChild(svg);
    });
  };

  const createTempContainer = (width: number, height: number, pagesCount: number): HTMLElement => {
    const temp = document.createElement('div');
    temp.className = 'print_temp_container';
    // Hidden but rendered
    temp.style.cssText = 'position:fixed;left:0;top:0;z-index:-9999;overflow:hidden;height:0;box-sizing:border-box;';
    
    const container = document.createElement('div');
    container.style.position = 'relative'; // Relative to the fixed temp container? No, inside it.
    // Actually we want the container to be renderable.
    container.style.width = `${width}px`;
    container.style.height = `${height * pagesCount}px`;
    container.style.backgroundColor = '#ffffff';
    
    temp.appendChild(container);
    document.body.appendChild(temp);
    
    return container;
  };

  const updatePageNumbers = (container: HTMLElement, totalPages: number) => {
    const pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    pages.forEach((page, pageIndex) => {
      const pageNumberElements = page.querySelectorAll('[data-print-type="page-number"]');
      pageNumberElements.forEach(el => {
        const textSpan = el.querySelector('.page-number-text');
        if (textSpan) {
          textSpan.textContent = `${pageIndex + 1}/${totalPages}`;
        }
      });
    });
  };

  const copyHeaderFooter = (
    sourcePage: HTMLElement,
    targetPage: HTMLElement,
    headerHeight: number,
    footerHeight: number,
    pageHeight: number,
    copyHeader: boolean,
    copyFooter: boolean
  ) => {
    const wrappers = sourcePage.querySelectorAll('[data-print-wrapper]');
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;

    wrappers.forEach(w => {
      const el = w as HTMLElement;
      if (el.hasAttribute('data-flow-id')) return;
      const isRepeatPerPage = el.getAttribute('data-repeat-per-page') === 'true';
      
      const top = parseFloat(el.style.top) || 0;
      const height = parseFloat(el.style.height) || el.offsetHeight;
      const bottom = top + height;

      // Check if strictly in header or footer region
      // We allow some overlap, but generally header elements are at the top
      const isHeader = copyHeader && top < (headerHeight + marginTop);
      const isFooter = copyFooter && top >= (pageHeight - footerHeight - marginBottom);
      
      if (isHeader || isFooter || isRepeatPerPage) {
        const clone = el.cloneNode(true) as HTMLElement;
        targetPage.appendChild(clone);
      }
    });
  };

  const updatePageSums = (table: HTMLElement) => {
    const tfoot = table.querySelector('tfoot');
    if (!tfoot) return;

    const customScript = table.getAttribute('data-custom-script');
    
    if (customScript) {
      try {
        // 1. Extract Page Data
        const tbody = table.querySelector('tbody');
        const data: any[] = [];
        if (tbody) {
          const rows = Array.from(tbody.querySelectorAll('tr'));
          rows.forEach(row => {
            const rowData: any = {};
            const cells = Array.from(row.querySelectorAll('td'));
            cells.forEach(cell => {
              const field = cell.getAttribute('data-field');
              if (field) {
                rowData[field] = cell.textContent || '';
              }
            });
            if (Object.keys(rowData).length > 0) {
              data.push(rowData);
            }
          });
        }

        // 2. Extract Footer Data
        const footerData: any[] = [];
        const rows = Array.from(tfoot.querySelectorAll('tr'));
        rows.forEach(row => {
          const rowData: any = {};
          const cells = Array.from(row.querySelectorAll('td'));
          cells.forEach(cell => {
            const field = cell.getAttribute('data-field');
            if (field) {
              rowData[field] = { value: cell.getAttribute('data-value') || cell.textContent || '' };
            }
          });
          footerData.push(rowData);
        });

        // 3. Execute Script
        const func = new Function('data', 'footerData', 'columns', 'type', customScript);
        func(data, footerData, [], 'page');

        // 4. Update Footer DOM
        if (footerData.length > 0) {
          const rows = Array.from(tfoot.querySelectorAll('tr'));
          rows.forEach((row, i) => {
            if (footerData[i]) {
              const cells = Array.from(row.querySelectorAll('td'));
              cells.forEach(cell => {
                const field = cell.getAttribute('data-field');
                if (field && footerData[i][field] !== undefined) {
                  let val = footerData[i][field];
                  if (val && typeof val === 'object') {
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
        console.error('Page sum script error:', e);
      }
    }
  };

  const handleTablePagination = (
    container: HTMLElement,
    pageHeight: number,
    headerHeight: number,
    footerHeight: number,
    copyHeader: boolean,
    copyFooter: boolean
  ) => {
    const parseAttrNumber = (el: HTMLElement, attr: string, fallback = 0) => {
      const value = parseFloat(el.getAttribute(attr) || '');
      return Number.isFinite(value) ? value : fallback;
    };

    const syncElementsBelowTables = () => {
      let workingPages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
      if (workingPages.length === 0) return;

      const marginTop = store.pageSpacingY || 0;
      const marginBottom = store.pageSpacingY || 0;
      const tableEntriesByOrigin = new Map<number, Array<{ originalBottom: number; finalGlobalBottom: number }>>();

      workingPages.forEach((page, pageIndex) => {
        const pageRect = page.getBoundingClientRect();
        const wrappers = Array.from(page.querySelectorAll('[data-print-wrapper][data-flow-id]')) as HTMLElement[];

        wrappers.forEach(wrapper => {
          const table = wrapper.querySelector('table');
          const autoHeightEl = wrapper.querySelector('[data-auto-height="true"]');
          
          if (!table && !autoHeightEl) return;
          if (table && table.getAttribute('data-auto-paginate') !== 'true') return;

          const originPage = parseAttrNumber(wrapper, 'data-origin-page-index', pageIndex);
          const originalTop = parseAttrNumber(wrapper, 'data-original-top', parseFloat(wrapper.style.top || '') || 0);
          const originalHeight = parseAttrNumber(wrapper, 'data-original-height', wrapper.getBoundingClientRect().height);
          const originalBottom = originalTop + originalHeight;
          const contentRect = (table || autoHeightEl)!.getBoundingClientRect();
          const finalBottomInPage = contentRect.bottom - pageRect.top;
          const finalGlobalBottom = pageIndex * pageHeight + finalBottomInPage;

          const list = tableEntriesByOrigin.get(originPage) || [];
          const existing = list.find(item => Math.abs(item.originalBottom - originalBottom) < 0.5);
          if (!existing) {
            list.push({ originalBottom, finalGlobalBottom });
          } else if (finalGlobalBottom > existing.finalGlobalBottom) {
            existing.finalGlobalBottom = finalGlobalBottom;
          }
          tableEntriesByOrigin.set(originPage, list);
        });
      });

      tableEntriesByOrigin.forEach(list => {
        list.sort((a, b) => a.originalBottom - b.originalBottom);
      });

      for (let pageIndex = 0; pageIndex < workingPages.length; pageIndex++) {
        const page = workingPages[pageIndex];
        const wrappers = Array.from(page.querySelectorAll('[data-print-wrapper]')) as HTMLElement[];

        wrappers.forEach(wrapper => {
          // Skip flow elements that have already been paginated or are split chunks to avoid messing up their positions
          if (wrapper.hasAttribute('data-flow-id')) {
             if (wrapper.hasAttribute('data-flow-paginated') || wrapper.hasAttribute('data-is-split-chunk')) {
                 return;
             }
          }
          if (wrapper.getAttribute('data-repeat-per-page') === 'true') return;

          const originPage = parseAttrNumber(wrapper, 'data-origin-page-index', pageIndex);
          const tableEntries = tableEntriesByOrigin.get(originPage);
          if (!tableEntries || tableEntries.length === 0) return;

          const originalTop = parseAttrNumber(wrapper, 'data-original-top', parseFloat(wrapper.style.top || '') || 0);
          const isHeader = copyHeader && originalTop < (headerHeight + marginTop);
          const isFooter = copyFooter && originalTop >= (pageHeight - footerHeight - marginBottom);
          if (isHeader || isFooter) return;

          let selectedTable: { originalBottom: number; finalGlobalBottom: number } | null = null;
          for (let i = 0; i < tableEntries.length; i++) {
            const candidate = tableEntries[i];
            if (candidate.originalBottom <= originalTop + 0.01) {
              selectedTable = candidate;
            } else {
              break;
            }
          }
          if (!selectedTable) return;

          const gapToTable = originalTop - selectedTable.originalBottom;
          const targetGlobalTop = selectedTable.finalGlobalBottom + gapToTable;
          let targetPageIndex = Math.floor(targetGlobalTop / pageHeight);
          if (targetPageIndex < 0) targetPageIndex = 0;

          let targetTop = targetGlobalTop - targetPageIndex * pageHeight;
          const minContentTop = copyHeader && headerHeight > 0 ? (headerHeight + marginTop) : marginTop;
          const maxContentBottom = pageHeight - (copyFooter ? footerHeight : 0) - marginBottom;
          const availableContentHeight = maxContentBottom - minContentTop;
          const wrapperHeight = parseAttrNumber(wrapper, 'data-original-height', wrapper.getBoundingClientRect().height);

          if (wrapperHeight > 0) {
            if (targetTop < minContentTop) {
              targetTop = minContentTop;
            }

            if (wrapperHeight <= availableContentHeight && targetTop + wrapperHeight > maxContentBottom) {
              targetPageIndex += 1;
              targetTop = minContentTop;
            } else if (wrapperHeight > availableContentHeight) {
              // Oversized fixed elements cannot fully fit inside printable content area;
              // anchor to the top content boundary to avoid overlapping footer first.
              targetTop = minContentTop;
            }
          }

          while (targetPageIndex >= workingPages.length) {
            const sourcePage = workingPages[workingPages.length - 1];
            const newPage = document.createElement('div');
            newPage.className = sourcePage.className;
            newPage.style.cssText = sourcePage.style.cssText;
            newPage.innerHTML = '';
            copyHeaderFooter(sourcePage, newPage, headerHeight, footerHeight, pageHeight, copyHeader, copyFooter);
            container.appendChild(newPage);
            workingPages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
          }

          const targetPage = workingPages[targetPageIndex];
          if (wrapper.parentElement !== targetPage) {
            targetPage.appendChild(wrapper);
          }
          wrapper.style.removeProperty('top');
          wrapper.style.setProperty('top', `${targetTop}px`, 'important');
        });
      }

      // syncElementsBelowTables may append pages while shifting wrappers.
      // Keep the outer loop's pages reference up to date so moved flow elements
      // (e.g. tables below auto-height text) still get processed for pagination.
      pages = workingPages;
    };

    let pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];

    const resolveFlowChunkStartY = (wrapper: HTMLElement) => {
      const marginTop = store.pageSpacingY || 0;
      const minTop = copyHeader && headerHeight > 0 ? (headerHeight + marginTop) : marginTop;
      let startY = minTop;
      const originalTopVal = parseAttrNumber(wrapper, 'data-original-top', parseFloat(wrapper.style.top || '') || 0);
      if (originalTopVal >= minTop && originalTopVal <= minTop + 100) {
        startY = originalTopVal;
      }
      return startY;
    };

    const createFlowOverflowPage = (currentPage: HTMLElement, currentPageIndex: number) => {
      const newPage = document.createElement('div');
      newPage.className = currentPage.className;
      newPage.style.cssText = currentPage.style.cssText;
      newPage.innerHTML = '';

      copyHeaderFooter(currentPage, newPage, headerHeight, footerHeight, pageHeight, copyHeader, copyFooter);

      if (currentPageIndex === pages.length - 1) {
        container.appendChild(newPage);
      } else {
        container.insertBefore(newPage, pages[currentPageIndex + 1]);
      }

      pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
      return newPage;
    };

    const findAutoHeightSplitIndex = (textEl: HTMLElement, fullText: string, limitBottom: number) => {
      if (!fullText) return 0;

      const normalizeSplitIndex = (candidate: number) => {
        if (candidate <= 0 || candidate >= fullText.length) return candidate;

        const nearNewLine = fullText.lastIndexOf('\n', candidate - 1);
        if (nearNewLine >= Math.max(0, candidate - 120)) {
          return nearNewLine + 1;
        }

        const nearSpace = Math.max(fullText.lastIndexOf(' ', candidate - 1), fullText.lastIndexOf('\t', candidate - 1));
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
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Find all tables and auto-height elements in the page
        const flowElements = page.querySelectorAll('table, [data-auto-height="true"]');
        flowElements.forEach(el => {
             const table = el.tagName === 'TABLE' ? el as HTMLElement : null;
             const isAutoHeight = el.getAttribute('data-auto-height') === 'true';
             
             // Find the wrapper using the data attribute we added
             const wrapper = el.closest('[data-print-wrapper]') as HTMLElement;
             if (!wrapper) return;
             if (wrapper.parentElement !== page) return; // skip if moved to another page
             if (wrapper.hasAttribute('data-flow-paginated')) return; // already processed
             
             // For tables, respect element-level auto paginate flag
             if (table) {
                 const autoPaginate = table.getAttribute('data-auto-paginate') === 'true';
                 if (!autoPaginate) return;
             }

             // Check for rotation (transform) on wrapper or table
             // If rotated, pagination logic (based on Y-axis) will be incorrect, so we skip it.
             const wrapperStyle = window.getComputedStyle(wrapper);
             const transform = wrapperStyle.transform;
             if (transform && transform !== 'none') {
                // simple check for rotation matrix
                // matrix(a, b, c, d, tx, ty). if b or c is not 0, there is rotation/skew
                if (transform.startsWith('matrix')) {
                    const values = transform.substring(7, transform.length - 1).split(',');
                    if (values.length >= 4) {
                        const b = parseFloat(values[1]);
                        const c = parseFloat(values[2]);
                        if (Math.abs(b) > 0.001 || Math.abs(c) > 0.001) {
                            return;
                        }
                    }
                }
             }

             // UNLOCK HEIGHT: Allow the wrapper to expand to fit the content
            wrapper.style.height = 'auto';
            if (table) {
                table.style.height = 'auto';
                const tbodyEl = table.querySelector('tbody');
                if (tbodyEl) (tbodyEl as HTMLElement).style.height = 'auto';
                
                // UNLOCK OVERFLOW: Remove constraints from TableElement root div
                 // The table is usually inside a div with h-full overflow-hidden
                 const tableRoot = table.parentElement as HTMLElement;
                 if (tableRoot) {
                     tableRoot.classList.remove('h-full', 'overflow-hidden');
                     tableRoot.style.height = 'auto';
                     tableRoot.style.overflow = 'visible';
                 }
            } else if (isAutoHeight) {
                // Remove h-full from the element itself so it can expand
                const htmlEl = el as HTMLElement;
                htmlEl.classList.remove('h-full', 'overflow-hidden');
                htmlEl.style.height = 'auto';
                htmlEl.style.overflow = 'visible';
                
                // Also ensure the wrapper can expand
                const textRoot = htmlEl.parentElement as HTMLElement;
                if (textRoot) {
                    textRoot.style.height = 'auto';
                    textRoot.style.overflow = 'visible';
                }
            }

             // Calculate positions using getBoundingClientRect for better precision
             // This handles sub-pixel rendering and spacing correctly
             const pageRect = page.getBoundingClientRect();
             const marginBottom = store.pageSpacingY || 0;
             const effectiveFooterHeight = copyFooter ? footerHeight : 0;
             const limitBottom = pageRect.top + pageHeight - effectiveFooterHeight - marginBottom;
             const wrapperRect = wrapper.getBoundingClientRect();
             const wrapperTop = wrapperRect.top;
             
             // Check if element extends beyond limit
             const contentRect = (table || el).getBoundingClientRect();
             // Add 1px tolerance for sub-pixel rendering issues
             if (contentRect.bottom <= limitBottom + 1) {
                 if (table) updatePageSums(table);
                 wrapper.setAttribute('data-flow-paginated', 'true');
                 syncElementsBelowTables(); 
                 return;
             }

             if (isAutoHeight) {
                const textEl = el as HTMLElement;
                const fullText = textEl.textContent || '';

                if (!fullText) {
                  wrapper.setAttribute('data-flow-paginated', 'true');
                  syncElementsBelowTables();
                  return;
                }

                let splitIndex = findAutoHeightSplitIndex(textEl, fullText, limitBottom);

                if (splitIndex <= 0) {
                  const startY = resolveFlowChunkStartY(wrapper);
                  if (wrapperTop <= startY + 5) {
                   splitIndex = 1;
                  } else {
                   const newPage = createFlowOverflowPage(page, i);
                   wrapper.style.removeProperty('top');
                   wrapper.style.setProperty('top', `${startY}px`, 'important');
                   newPage.appendChild(wrapper);
                   wrapper.setAttribute('data-is-split-chunk', 'true');
                   syncElementsBelowTables();
                   return;
                  }
                }

                if (splitIndex >= fullText.length) {
                  wrapper.setAttribute('data-flow-paginated', 'true');
                  syncElementsBelowTables();
                  return;
                }

                const currentText = fullText.slice(0, splitIndex);
                const overflowText = fullText.slice(splitIndex);
                textEl.textContent = currentText;

                const newPage = createFlowOverflowPage(page, i);
                const newWrapper = wrapper.cloneNode(true) as HTMLElement;
                const newTextEl = newWrapper.querySelector('[data-auto-height="true"]') as HTMLElement | null;
                if (newTextEl) {
                  newTextEl.classList.remove('h-full', 'overflow-hidden');
                  newTextEl.style.height = 'auto';
                  newTextEl.style.overflow = 'visible';
                  newTextEl.textContent = overflowText;

                  const newTextRoot = newTextEl.parentElement as HTMLElement | null;
                  if (newTextRoot) {
                   newTextRoot.style.height = 'auto';
                   newTextRoot.style.overflow = 'visible';
                  }
                }

                const startY = resolveFlowChunkStartY(wrapper);
                newWrapper.style.removeProperty('top');
                newWrapper.style.setProperty('top', `${startY}px`, 'important');

                newPage.appendChild(newWrapper);
                wrapper.setAttribute('data-flow-paginated', 'true');
                newWrapper.setAttribute('data-is-split-chunk', 'true');
                syncElementsBelowTables();
                return;
             }

               if (!table) {
                 wrapper.setAttribute('data-flow-paginated', 'true');
                 syncElementsBelowTables();
                 return;
               }
             
             // Split needed
             let splitIndex = -1;
             
             const tbody = table.querySelector('tbody');
             if (!tbody) return;
             const rows = Array.from(tbody.querySelectorAll('tr'));
             
             // Check for footer height requirement
             const tfoot = table.querySelector('tfoot');
             const isFooterRepeated = table.getAttribute('data-tfoot-repeat') === 'true';
             let requiredFooterHeight = 0;
             if (tfoot && isFooterRepeated) {
                 requiredFooterHeight = tfoot.getBoundingClientRect().height;
             }
             
             for (let r = 0; r < rows.length; r++) {
                 const row = rows[r];
                 const rowRect = row.getBoundingClientRect();
                 // Use a small buffer (1px) for float precision
                 if (rowRect.bottom + requiredFooterHeight > limitBottom + 1) { 
                     splitIndex = r;
                     
                     // Prevent infinite loop: if we are at the first row (r=0) 
                     // AND the table is already at the top of the page, we MUST accept at least one row.
                     if (splitIndex === 0) {
                         const marginTop = store.pageSpacingY || 0;
                         const minTop = copyHeader && headerHeight > 0 ? (headerHeight + marginTop) : marginTop;
                         let startY = minTop;
                         const originalTopVal = parseAttrNumber(wrapper, 'data-original-top', parseFloat(wrapper.style.top || '') || 0);
                         if (originalTopVal >= minTop && originalTopVal <= minTop + 100) {
                             startY = originalTopVal;
                         }

                         // If we are essentially at the top already
                         if (wrapperTop <= startY + 5) {
                             splitIndex = 1; // Force one row to stay
                         }
                     }
                     break;
                 }
             }
             
             if (splitIndex !== -1) {
                 // Create new page
                 const newPage = createFlowOverflowPage(page, i);
                 
                 // Clone wrapper for new page
                 const newWrapper = wrapper.cloneNode(true) as HTMLElement;
                 // Set top to headerHeight + padding or just below header
                 // If headerHeight is 0, use 20px padding.
                 const startY = resolveFlowChunkStartY(wrapper);
                 
                 newWrapper.style.removeProperty('top');
                 newWrapper.style.setProperty('top', `${startY}px`, 'important');
                 // Height is already auto from the cloned wrapper
                 
                 // Clean up OLD table (remove rows from splitIndex onwards)
                 const oldRows = rows;
                 for (let k = splitIndex; k < oldRows.length; k++) {
                     oldRows[k].remove();
                 }
                 
                 // If split at 0 (header only left), remove the wrapper to avoid orphaned header
                 if (splitIndex === 0) {
                     wrapper.remove();
                 }
                 // Remove tfoot from old table (only show at very end unless repeat is requested)
                const oldTfoot = table.querySelector('tfoot');
                const shouldRepeatFooter = table.getAttribute('data-tfoot-repeat') === 'true';
                
                if (oldTfoot) {
                    if (!shouldRepeatFooter) {
                        oldTfoot.remove();
                    } else {
                        updatePageSums(table);
                    }
                }
                
                // Clean up NEW table (remove rows before splitIndex)
                const newTable = newWrapper.querySelector('table') as HTMLElement;
                newTable.style.height = 'auto';
                const newTbody = newTable.querySelector('tbody') as HTMLElement;
                if (newTbody) {
                    newTbody.style.height = 'auto';
                    const newRowsList = Array.from(newTbody.querySelectorAll('tr'));
                    for (let k = 0; k < splitIndex; k++) {
                        newRowsList[k]?.remove();
                    }
                }
                 
                 newPage.appendChild(newWrapper);
                 wrapper.setAttribute('data-flow-paginated', 'true');
                 newWrapper.setAttribute('data-is-split-chunk', 'true');
                 
                 syncElementsBelowTables();
             } else {
                 if (table) updatePageSums(table);
                 wrapper.setAttribute('data-flow-paginated', 'true');
                 syncElementsBelowTables();
             }
        });
    }

    syncElementsBelowTables();
    
    // Clean up any empty pages that might have been created during pagination shifts
    pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;
    
    // Iterate backwards so we can safely remove elements
    // We never remove the very first page (i > 0)
    for (let i = pages.length - 1; i > 0; i--) {
        const page = pages[i];
        const wrappers = Array.from(page.querySelectorAll('[data-print-wrapper]')) as HTMLElement[];
        
        const hasContent = wrappers.some(w => {
            if (w.hasAttribute('data-flow-id')) return true;
            
            const isRepeatPerPage = w.getAttribute('data-repeat-per-page') === 'true';
            if (isRepeatPerPage) return false;
            
            const top = parseFloat(w.style.top) || 0;
            const isHeader = copyHeader && top < (headerHeight + marginTop);
            const isFooter = copyFooter && top >= (pageHeight - footerHeight - marginBottom);
            
            if (isHeader || isFooter) return false;
            
            return true;
        });
        
        if (!hasContent) {
            page.remove();
        }
    }
    
    // Update all page positions
    pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    pages.forEach((p, idx) => {
        p.style.top = `${idx * pageHeight}px`;
    });
    
    return pages.length;
  };

  const cloneElementWithStyles = (
    element: HTMLElement,
    getComputedStyleFn: (elt: Element) => CSSStyleDeclaration = window.getComputedStyle
  ): HTMLElement => {
    const clone = element.cloneNode(true) as HTMLElement;
    const queue: [HTMLElement, HTMLElement][] = [[element, clone]];
    
    while (queue.length > 0) {
        const [source, target] = queue.shift()!;
        
        if (source.nodeType === 1) {
          const computed = getComputedStyleFn(source);
            const style = target.style;
            
            // Copy all styles
            for (let i = 0; i < computed.length; i++) {
                const prop = computed[i];
                style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
            }
        }
        
        for (let i = 0; i < source.children.length; i++) {
             // Ensure we have matching children (cloneNode(true) ensures this)
             if (target.children[i]) {
                queue.push([source.children[i] as HTMLElement, target.children[i] as HTMLElement]);
             }
        }
    }
    return clone;
  };

  const processContentForImage = async (
    content: HTMLElement | string | HTMLElement[],
    width: number,
    height: number,
    convertSvg = true,
    getComputedStyleFn: (elt: Element) => CSSStyleDeclaration = window.getComputedStyle
  ) => {
    const tempHost = document.createElement('div');
    tempHost.style.position = 'fixed';
    tempHost.style.left = '0';
    tempHost.style.top = '0';
    tempHost.style.width = '0';
    tempHost.style.height = '0';
    tempHost.style.overflow = 'hidden';
    tempHost.style.zIndex = '-9999';
    tempHost.style.visibility = 'hidden';
    tempHost.style.pointerEvents = 'none';
    tempHost.className = 'print_temp_container';
    document.body.appendChild(tempHost);

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`; // Start with 1 page height
    tempHost.appendChild(container);

    // Removed the copying of all styles from head to the container.
    // It was causing global theme flashes in host applications (e.g. Ant Design Vue dynamic themes),
    // and is unnecessary because cloneElementWithStyles already inlines all computed styles.

    let pages: HTMLElement[] = [];
    if (typeof content === 'string') {
        container.innerHTML = content;
        pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    } else if (Array.isArray(content)) {
        pages = content;
    } else {
        if (content.classList.contains('design-workspace')) {
             pages = Array.from(content.children) as HTMLElement[];
        } else {
             pages = [content];
        }
    }
        
    pages.forEach((page, idx) => {
        const clone = cloneElementWithStyles(page, getComputedStyleFn);
            clone.style.position = 'absolute';
            clone.style.left = '0';
            clone.style.top = `${idx * height}px`;
            clone.style.width = `${width}px`;
            clone.style.height = `${height}px`;
            clone.style.transform = 'none'; // Reset zoom
            clone.style.backgroundColor = store.canvasBackground;

            // Remove elements that should never appear in print/preview
            clone.querySelectorAll('[data-print-exclude="true"]').forEach(el => el.remove());

            // MARK WRAPPERS for pagination logic BEFORE cleaning
            const wrappers = clone.querySelectorAll('.element-wrapper');
            wrappers.forEach((w, wrapperIndex) => {
                const el = w as HTMLElement;
                el.setAttribute('data-print-wrapper', 'true');
                const top = parseFloat(el.style.top || '');
                const height = parseFloat(el.style.height || '');
                const resolvedTop = Number.isFinite(top) ? top : 0;
                const resolvedHeight = Number.isFinite(height) ? height : el.getBoundingClientRect().height;
                el.setAttribute('data-original-top', `${resolvedTop}`);
                el.setAttribute('data-original-height', `${resolvedHeight}`);
                el.setAttribute('data-origin-page-index', `${idx}`);
                const wrapperSeq = `${idx}-${wrapperIndex}`;
                el.setAttribute('data-wrapper-seq', wrapperSeq);
                
                const table = el.querySelector('table');
                const autoHeightEl = el.querySelector('[data-auto-height="true"]');
                
                if (table || autoHeightEl) {
                  el.setAttribute('data-flow-id', wrapperSeq);
                } else {
                  el.removeAttribute('data-flow-id');
                }
            });
            
            // Clean up the clone
            cleanElement(clone);
            
            // Fix SVG size if any
            const svgs = clone.querySelectorAll('svg');
            svgs.forEach(svg => {
                const rect = svg.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                     // Try to get from attributes
                     const w = svg.getAttribute('width');
                     const h = svg.getAttribute('height');
                     if (w) svg.style.width = w.includes('px') ? w : `${w}px`;
                     if (h) svg.style.height = h.includes('px') ? h : `${h}px`;
                }
            });

            container.appendChild(clone);
        });

    // Wait for DOM updates (images, fonts, etc)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Handle SVGs
    if (convertSvg) {
        await svgToCanvas(container);
    }

    // Handle Table Pagination
    const pagesCount = handleTablePagination(
      container,
      height,
      store.headerHeight,
      store.footerHeight,
      store.showHeaderLine,
      store.showFooterLine
    );
    
    // Update Page Numbers
    updatePageNumbers(container, pagesCount);
    
    // Update container height based on new page count
    container.style.height = `${height * pagesCount}px`;

    return { container, tempWrapper: tempHost, pagesCount };
  };

  const generatePageImages = async (container: HTMLElement, width: number, height: number): Promise<string[]> => {
    const pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    
    // Optimize: Set all pages to top 0 at once to avoid layout thrashing during capture
    pages.forEach(page => {
        page.style.top = '0px';
    });

    // Temporarily remove cross-origin monaco-editor stylesheets to prevent dom-to-image SecurityError
    const monacoLinks = Array.from(document.querySelectorAll('link[href*="monaco-editor"]'));
    const linkParents = monacoLinks.map(link => link.parentNode);
    monacoLinks.forEach(link => link.parentNode?.removeChild(link));

    const printSettings = usePrintSettings();
    const printQualityStr = printSettings?.printQuality?.value ?? 'normal';
    
    let printQualityScale = 1;
    let jpegQuality = 0.8;
    if (printQualityStr === 'fast') { printQualityScale = 0.5; jpegQuality = 0.6; }
    else if (printQualityStr === 'normal') { printQualityScale = 1; jpegQuality = 0.8; }
    else if (printQualityStr === 'high') { printQualityScale = 1.5; jpegQuality = 0.9; }
    else if (printQualityStr === 'ultra') { printQualityScale = 2; jpegQuality = 1.0; }

    try {
        const generatePageImage = async (page: HTMLElement) => {
            const domToImageModule = await import('dom-to-image-more');
            const domtoimage = (domToImageModule as any)?.default || domToImageModule;
            const canvas = await domtoimage.toCanvas(page, {
                filter: (node: Node) => {
                    if (node.nodeType === 1 && (node as Element).tagName === 'LINK') {
                        const href = (node as HTMLLinkElement).href;
                        if (href && href.includes('monaco-editor')) {
                            return false;
                        }
                    }
                    return true;
                },
                scale: printQualityScale,
                width: width,
                height: height,
                useCORS: true,
                bgcolor: store.canvasBackground,
            });

            const ctx = canvas.getContext('2d');
            if (ctx) {
                (ctx as any).mozImageSmoothingEnabled = true;
                (ctx as any).webkitImageSmoothingEnabled = true;
                (ctx as any).msImageSmoothingEnabled = true;
                ctx.imageSmoothingEnabled = true;
            }

            return canvas.toDataURL('image/jpeg', jpegQuality);
        };

        // Process pages in batches to avoid freezing the browser
        const batchSize = 3;
        const pageImages: string[] = [];
        
        for (let i = 0; i < pages.length; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(page => generatePageImage(page)));
            pageImages.push(...results);
        }
        
        return pageImages;
    } finally {
        // Restore the stylesheets
        monacoLinks.forEach((link, index) => {
            if (linkParents[index]) {
                linkParents[index]?.appendChild(link);
            }
        });
    }
  };

    const createPdfDocument = async (content: HTMLElement | string | HTMLElement[]) => {
    const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });
    const restoreViewport = lockViewportScroll(!isShadowDomContent(content));

    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    const widthMm = pxToMm(width);
    const heightMm = pxToMm(height);

    let tempWrapper: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    try {
      const source = await resolveRenderSource(content);
      cleanup = source.cleanup;

      const { container, tempWrapper: wrapper } = await processContentForImage(source.content, width, height, true, source.getComputedStyleFn);
      tempWrapper = wrapper;

      const jsPdfModule = await import('jspdf');
      const jsPDF = (jsPdfModule as any)?.default || (jsPdfModule as any)?.jsPDF || jsPdfModule;
      const pdf = new jsPDF({
        orientation: width > height ? 'l' : 'p',
        unit: 'mm',
        format: [widthMm, heightMm],
        hotfixes: ['px_scaling']
      });

      const pageImages = await generatePageImages(container, width, height);
        
      pageImages.forEach((imgData, i) => {
        if (i > 0) pdf.addPage([widthMm, heightMm]);
        pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);
      });
        
      return pdf;
    } finally {
      if (tempWrapper && tempWrapper.parentNode) {
        tempWrapper.parentNode.removeChild(tempWrapper);
      }
      if (cleanup) {
        cleanup();
      }
      restoreViewport();
      restore();
    }
    };

  const exportPdf = async (content?: HTMLElement | string | HTMLElement[], filename = 'print-design.pdf') => {
    try {
        const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const pdf = await createPdfDocument(targetContent);
        pdf.save(filename);
    } catch (error) {
        console.error('Export PDF failed', error);
        toast.error(i18n.global.t('toast.exportPdfFailed'));
    }
  };

  const exportHtml = async (content?: HTMLElement | string | HTMLElement[], filename = 'print-design.html') => {
    try {
        const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const html = await getPrintHtml(targetContent as HTMLElement[]);
        
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <style>
    ${baseStyles}
    body {
      background-color: #f3f4f6;
      padding: 20px;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export HTML failed', error);
        toast.error('Export HTML failed');
    }
  };

      const browserPrint = async (content: HTMLElement | string | HTMLElement[]) => {
      const restoreViewport = lockViewportScroll(!isShadowDomContent(content));
      try {
      const pdf = await createPdfDocument(content);
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);

        const isEdge = /Edg\//.test(navigator.userAgent);
        if (isEdge) {
          const popup = window.open(blobUrl, '_blank', 'noopener,noreferrer');
          if (!popup) {
            URL.revokeObjectURL(blobUrl);
            return;
          }

          popup.addEventListener('beforeunload', () => {
            URL.revokeObjectURL(blobUrl);
          });

          popup.onload = () => {
            try {
              popup.focus();
              popup.print();
            } finally {
              setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            }
          };
          return { status: 'success', mode: 'browser' };
        }
        
        await new Promise<void>((resolve) => {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.left = '0';
          iframe.style.top = '0';
          iframe.style.width = '0px';
          iframe.style.height = '0px';
          iframe.style.border = '0';
          iframe.style.visibility = 'hidden';
          iframe.src = blobUrl;
          document.body.appendChild(iframe);

          iframe.onload = () => {
            const win = iframe.contentWindow;
            if (win) {
              win.focus();
              setTimeout(() => {
                win.print();
              }, 100);
            }
            setTimeout(() => {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
              URL.revokeObjectURL(blobUrl);
              resolve();
            }, 1000);
          };
        });
        return { status: 'success', mode: 'browser' };
    } catch (error) {
        console.error('Print failed', error);
        toast.error('Print failed');
        throw error;
    } finally {
        restoreViewport();
    }
  };

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read PDF blob'));
    reader.readAsDataURL(blob);
  });

  const buildPrintPayload = (options: PrintOptions, content: string, key?: string) => {
    const payload: Record<string, any> = {
      printer: options.printer,
      content
    };

    if (key) payload.key = key;
    if (options.jobName || options.copies || options.intervalMs) {
      payload.job = {
        ...(options.jobName ? { name: options.jobName } : {}),
        ...(options.copies ? { copies: options.copies } : {}),
        ...(options.intervalMs ? { intervalMs: options.intervalMs } : {})
      };
    }
    if (options.pageRange || options.pageSet) {
      payload.pages = {
        ...(options.pageRange ? { range: options.pageRange } : {}),
        ...(options.pageSet ? { set: options.pageSet } : {})
      };
    }
    if (options.scale || options.orientation) {
      payload.layout = {
        ...(options.scale ? { scale: options.scale } : {}),
        ...(options.orientation ? { orientation: options.orientation } : {})
      };
    }
    if (options.colorMode) {
      payload.color = { mode: options.colorMode };
    }
    if (options.sidesMode) {
      payload.sides = { mode: options.sidesMode };
    }
    if (options.paperSize) {
      payload.paper = { size: options.paperSize };
    }
    if (options.trayBin) {
      payload.tray = { bin: options.trayBin };
    }
    return payload;
  };

  let localSocket: WebSocket | null = null;
  let localSocketUrl = '';
  let localSocketPromise: Promise<WebSocket> | null = null;
  let localQueue: Promise<any> = Promise.resolve();

  const resetLocalSocket = () => {
    if (localSocket && localSocket.readyState === WebSocket.OPEN) {
      localSocket.close();
    }
    localSocket = null;
    localSocketUrl = '';
    localSocketPromise = null;
  };

  const getLocalSocket = (url: string) => {
    if (localSocket && localSocket.readyState === WebSocket.OPEN && localSocketUrl === url) {
      return Promise.resolve(localSocket);
    }
    if (localSocketPromise) return localSocketPromise;

    localSocketUrl = url;
    localSocketPromise = new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(url);
      const handleOpen = () => {
        socket.removeEventListener('open', handleOpen);
        socket.removeEventListener('error', handleError);
        localSocket = socket;
        localSocketPromise = null;
        resolve(socket);
      };
      const handleError = () => {
        socket.removeEventListener('open', handleOpen);
        socket.removeEventListener('error', handleError);
        resetLocalSocket();
        reject(new Error('Print connection failed'));
      };
      socket.addEventListener('open', handleOpen);
      socket.addEventListener('error', handleError);
    });

    return localSocketPromise;
  };

  const sendLocalWsPrint = (url: string, payload: Record<string, any>, waitFor: 'status', timeoutMs: number = 30000) => {
    localQueue = localQueue.catch(() => undefined).then(() => new Promise<any>(async (resolve, reject) => {
      let resolved = false;
      let socket: WebSocket | null = null;
      const timeoutId = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resetLocalSocket();
        reject(new Error('Print request timeout'));
      }, timeoutMs);

      const cleanup = () => {
        if (!socket) return;
        socket.removeEventListener('message', handleMessage);
        socket.removeEventListener('error', handleError);
        socket.removeEventListener('close', handleClose);
      };

      const handleMessage = (event: MessageEvent) => {
        if (resolved) return;
        try {
          const msg = JSON.parse(event.data);
          // Check for 'success' status, but also allow 'ok' or missing status if there's no error
          if (msg.status === 'success' || msg.status === 'error' || msg.status === 'ok' || msg.type === 'print_result') {
            resolved = true;
            window.clearTimeout(timeoutId);
            cleanup();
            if (msg.status === 'success' || msg.status === 'ok' || (msg.type === 'print_result' && msg.status !== 'error')) {
              resolve(msg);
            } else {
              reject(new Error(msg.message || 'Print failed'));
            }
          }
        } catch (error) {
          // If it's not JSON, it might just be a simple text ACK
          if (event.data === 'success' || event.data === 'ok') {
            resolved = true;
            window.clearTimeout(timeoutId);
            cleanup();
            resolve({ status: 'success', message: event.data });
          } else {
            resolved = true;
            window.clearTimeout(timeoutId);
            cleanup();
            reject(error instanceof Error ? error : new Error('Print failed'));
          }
        }
      };

      const handleError = () => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timeoutId);
        cleanup();
        resetLocalSocket();
        reject(new Error('Print connection failed'));
      };

      const handleClose = () => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timeoutId);
        cleanup();
        resetLocalSocket();
        reject(new Error('Print connection closed'));
      };

      try {
        socket = await getLocalSocket(url);
        socket.addEventListener('message', handleMessage);
        socket.addEventListener('error', handleError);
        socket.addEventListener('close', handleClose);
        socket.send(JSON.stringify(payload));
      } catch (error) {
        resolved = true;
        window.clearTimeout(timeoutId);
        cleanup();
        reject(error instanceof Error ? error : new Error('Print connection failed'));
      }
    }));

    return localQueue;
  };

  const print = async (content: HTMLElement | string | HTMLElement[], request?: { mode?: PrintMode; options?: PrintOptions }) => {
    const mode = request?.mode || printMode.value;

    if (mode === 'browser') {
      return await browserPrint(content);
    }

    const connectionOk = mode === 'local' ? localStatus.value === 'connected' : remoteStatus.value === 'connected';
    if (!connectionOk) {
      return await browserPrint(content);
    }

    const options = request?.options || (mode === 'local' ? localPrintOptions : remotePrintOptions);
    
    // Copy options to avoid mutating the original options object if it's passed from request
    const currentOptions = { ...options };

    if (mode === 'remote' && silentPrint.value) {
      if (!remoteSelectedClientId.value) {
        await fetchRemoteClients();
      }
      if (!currentOptions.printer && remoteSelectedClientId.value) {
        const printers = await fetchRemotePrinters(remoteSelectedClientId.value);
        const fallbackPrinter = printers[0]?.printer_name || '';
        if (fallbackPrinter) {
          currentOptions.printer = fallbackPrinter;
          remotePrintOptions.printer = fallbackPrinter;
        }
      }
    }
    // Also try to fallback to default printer for local mode if not specified
    if (mode === 'local' && silentPrint.value && !currentOptions.printer) {
      const { fetchLocalPrinters } = usePrintSettings();
      const localPrinters = await fetchLocalPrinters();
      const fallbackPrinter = localPrinters.find(p => p.isDefault)?.name || localPrinters[0]?.name || '';
      if (fallbackPrinter) {
        currentOptions.printer = fallbackPrinter;
        localPrintOptions.printer = fallbackPrinter;
      }
    }

    if (!currentOptions.printer) {
      toast.error(i18n.global.t('toast.printerRequired'));
      throw new Error('Printer is required');
    }

    try {
      const pdfBlob = await getPdfBlob(content);
      const dataUrl = await blobToDataUrl(pdfBlob);

      if (mode === 'local') {
        const payload = buildPrintPayload(currentOptions, dataUrl, localSettings.secretKey.trim());
        const result = await sendLocalWsPrint(localWsUrl.value, payload, 'status', currentOptions.timeout || 30000);
        return result;
      }

      if (!remoteSelectedClientId.value) {
        toast.error(i18n.global.t('toast.clientRequired'));
        throw new Error('Client is required');
      }
      const payload = buildPrintPayload(currentOptions, dataUrl);
      payload.cmd = 'submit_task';
      payload.client_id = remoteSelectedClientId.value;
      const result = await submitRemoteTask(payload, currentOptions.timeout || 30000);
      return result;
    } catch (error) {
      console.error('Print failed', error);
      toast.error(i18n.global.t('toast.printFailed'));
      throw error;
    }
  };

  const stitchImages = async (images: string[]): Promise<string> => {
    if (images.length === 0) return '';
    
    // Load first image to get dimensions
    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = images[0];
    });
    
    const imgWidth = firstImg.width;
    const imgHeight = firstImg.height;
    const totalHeight = imgHeight * images.length;
    
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Draw first image
    ctx.drawImage(firstImg, 0, 0);
    
    // Draw remaining images
    for (let i = 1; i < images.length; i++) {
        await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, i * imgHeight);
                resolve();
            };
            img.onerror = reject;
            img.src = images[i];
        });
    }
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const exportImages = async (content?: HTMLElement | string | HTMLElement[], filenamePrefix = 'print-design') => {
    try {
        const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });
        const restoreViewport = lockViewportScroll(!isShadowDomContent(targetContent));
        
        const width = store.canvasSize.width;
        const height = store.canvasSize.height;

        let cleanup: (() => void) | null = null;
        const source = await resolveRenderSource(targetContent);
        cleanup = source.cleanup;

        const { container, tempWrapper } = await processContentForImage(source.content, width, height, true, source.getComputedStyleFn);

        try {
            const pageImages = await generatePageImages(container, width, height);
            
            if (pageImages.length === 0) return;

            if (exportImageMerged.value) {
              const finalImage = await stitchImages(pageImages);

              // Download single stitched image
              const link = document.createElement('a');
              link.href = finalImage;
              link.download = `${filenamePrefix}.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              const jsZipModule = await import('jszip');
              const JSZip = (jsZipModule as any)?.default || jsZipModule;
              const zip = new JSZip();
              await Promise.all(pageImages.map(async (dataUrl, index) => {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                zip.file(`${filenamePrefix}-${index + 1}.jpg`, blob);
              }));

              const zipBlob = await zip.generateAsync({ type: 'blob' });
              const zipUrl = URL.createObjectURL(zipBlob);
              const link = document.createElement('a');
              link.href = zipUrl;
              link.download = `${filenamePrefix}.zip`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(zipUrl);
            }
            
        } finally {
            if (tempWrapper && tempWrapper.parentNode) {
                tempWrapper.parentNode.removeChild(tempWrapper);
            }
          if (cleanup) {
            cleanup();
          }
            restoreViewport();
            restore();
        }
    } catch (error) {
        console.error('Export Images failed', error);
        toast.error('Export Images failed');
    }
  };

  const getImageBlob = async (content: HTMLElement | string | HTMLElement[]) => {
    try {
        const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });
        const restoreViewport = lockViewportScroll(!isShadowDomContent(targetContent));
        
        const width = store.canvasSize.width;
        const height = store.canvasSize.height;

        let cleanup: (() => void) | null = null;
        const source = await resolveRenderSource(targetContent);
        cleanup = source.cleanup;

        const { container, tempWrapper } = await processContentForImage(source.content, width, height, true, source.getComputedStyleFn);

        try {
            const pageImages = await generatePageImages(container, width, height);
            
            if (pageImages.length === 0) throw new Error('No images generated');

            const finalImage = await stitchImages(pageImages);
            
            // Convert Data URL to Blob
            const response = await fetch(finalImage);
            return await response.blob();
            
        } finally {
            if (tempWrapper && tempWrapper.parentNode) {
                tempWrapper.parentNode.removeChild(tempWrapper);
            }
          if (cleanup) {
            cleanup();
          }
            restoreViewport();
            restore();
        }
    } catch (error) {
        console.error('Get Image Blob failed', error);
        throw error;
    }
  };

  const getPdfBlob = async (content: HTMLElement | string | HTMLElement[]) => {
    try {
        const pdf = await createPdfDocument(content);
        return pdf.output('blob');
    } catch (error) {
        console.error('Get PDF Blob failed', error);
        throw error;
    }
  };

  return {
    getPrintHtml,
    print,
    exportPdf,
    exportHtml,
    exportImages,
    getPdfBlob,
    getImageBlob
  };
};
