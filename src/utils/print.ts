import { nextTick, createApp, h } from 'vue';
import { createPinia } from 'pinia';
import jsPDF from 'jspdf';
import domtoimage from 'dom-to-image-more';
import JSZip from 'jszip';
import { Canvg } from 'canvg';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type Page, type WatermarkSettings } from '@/types';
import { usePrintSettings, type PrintMode, type PrintOptions } from '@/composables/usePrintSettings';
import i18n from '@/locales';
import PrintRenderer from '@/components/print/PrintRenderer.vue';
import baseStyles from '@/style.css?inline';

import { pxToMm } from '@/utils/units';

export const usePrint = () => {
  const store = useDesignerStore();
  const {
    printMode,
    localSettings,
    remoteSettings,
    localStatus,
    remoteStatus,
    localPrintOptions,
    remotePrintOptions,
    localWsUrl,
    remoteWsUrl,
    remoteSelectedClientId,
    exportImageMerged
  } = usePrintSettings();

  const createRepeatedPages = (originalPages: Page[]): Page[] => {
    const original = cloneDeep(originalPages);
    
    // Check if header/footer regions are defined
    const hasHeader = store.headerHeight > 0 && store.showHeaderLine;
    const hasFooter = store.footerHeight > 0 && store.showFooterLine;

    if (!hasHeader && !hasFooter) return original;

    const basePage = original[0];
    const canvasHeight = store.canvasSize.height;
    const marginTop = store.pageSpacingY || 0;
    const marginBottom = store.pageSpacingY || 0;
    
    // Filter elements that should be repeated (elements outside range)
    const repeatHeaders = hasHeader ? basePage.elements.filter(e => 
      (e.y + e.height) <= (store.headerHeight + marginTop)
    ) : [];
    
    const repeatFooters = hasFooter ? basePage.elements.filter(e => 
      e.y >= (canvasHeight - (store.footerHeight + marginBottom))
    ) : [];

    const withRepeats = cloneDeep(original);
    for (let i = 0; i < withRepeats.length; i++) {
      if (i === 0) continue;
      const page = withRepeats[i];
      
      // Add repeated headers with new IDs
      for (const el of repeatHeaders) {
        page.elements.push({ ...cloneDeep(el), id: uuidv4() });
      }
      
      // Add repeated footers with new IDs
      for (const el of repeatFooters) {
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
    testData: cloneDeep(store.testData || {})
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
            
            // Adjust styles for preview display
            clone.style.position = 'relative';
            clone.style.left = 'auto';
            clone.style.top = 'auto';
            clone.style.width = `${width}px`;
            clone.style.height = `${height}px`;
            clone.style.margin = '0 0 20px 0';
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

  const svgToCanvas = (root: HTMLElement) => {
    const svgs = root.querySelectorAll('svg');
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
      // Skip if it's the table wrapper being split? 
      // The split logic moves the table wrapper manually.
      // We only want to copy OTHER elements that are in header/footer.
      
      const top = parseFloat(el.style.top) || 0;
      const height = parseFloat(el.style.height) || el.offsetHeight;
      const bottom = top + height;

      // Check if strictly in header or footer region
      // We allow some overlap, but generally header elements are at the top
      const isHeader = copyHeader && top < (headerHeight + marginTop);
      const isFooter = copyFooter && top >= (pageHeight - footerHeight - marginBottom);
      
      if (isHeader || isFooter) {
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
    let pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Find all tables in the page
        const tables = page.querySelectorAll('table');
        tables.forEach(table => {
             // Find the wrapper using the data attribute we added
             const wrapper = table.closest('[data-print-wrapper]') as HTMLElement;
             if (!wrapper) return;
             
             // Respect element-level auto paginate flag
             const autoPaginate = table.getAttribute('data-auto-paginate') === 'true';
             if (!autoPaginate) return;

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

             // UNLOCK HEIGHT: Allow the wrapper to expand to fit the table
            wrapper.style.height = 'auto';
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

             // Calculate positions using getBoundingClientRect for better precision
             // This handles sub-pixel rendering and spacing correctly
             const pageRect = page.getBoundingClientRect();
             const marginBottom = store.pageSpacingY || 0;
             const effectiveFooterHeight = copyFooter ? footerHeight : 0;
             const limitBottom = pageRect.top + pageHeight - effectiveFooterHeight - marginBottom;
             const wrapperRect = wrapper.getBoundingClientRect();
             const wrapperTop = wrapperRect.top;
             
             // Check if table extends beyond limit
             const tableRect = table.getBoundingClientRect();
             // Add 1px tolerance for sub-pixel rendering issues
             if (tableRect.bottom <= limitBottom + 1) {
                 updatePageSums(table);
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
                         const startY = copyHeader && headerHeight > 0 ? (headerHeight + marginTop + 10) : marginTop;
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
                 const newPage = document.createElement('div');
                 newPage.className = page.className;
                 newPage.style.cssText = page.style.cssText;
                 newPage.innerHTML = ''; // Empty
                 
                 // Copy header and footer to new page
                 copyHeaderFooter(page, newPage, headerHeight, footerHeight, pageHeight, copyHeader, copyFooter);

                 // Insert new page
                 if (i === pages.length - 1) {
                     container.appendChild(newPage);
                 } else {
                     container.insertBefore(newPage, pages[i+1]);
                 }
                 
                 // Re-fetch pages to update array reference for next loop
                 pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
                 
                 // Clone wrapper for new page
                 const newWrapper = wrapper.cloneNode(true) as HTMLElement;
                 // Set top to headerHeight + padding or just below header
                 // If headerHeight is 0, use 20px padding.
                 const marginTop = store.pageSpacingY || 0;
                 const startY = copyHeader && headerHeight > 0 ? (headerHeight + marginTop + 10) : marginTop;
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
                if (newTbody) newTbody.style.height = 'auto';
                const newRowsList = Array.from(newTbody.querySelectorAll('tr'));
                 
                 for (let k = 0; k < splitIndex; k++) {
                     newRowsList[k].remove();
                 }
                 
                 newPage.appendChild(newWrapper);
             } else {
                 updatePageSums(table);
             }
        });
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
    // Create hidden container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px'; // Move off-screen to avoid flickering
    container.style.top = '0';
    container.style.width = `${width}px`;
    container.style.height = `${height}px`; // Start with 1 page height
    // Don't use overflow hidden, let us measure full heights
    // container.style.overflow = 'hidden'; 
    container.style.zIndex = '-9999'; // Hide behind everything
    container.className = 'print_temp_container';
    document.body.appendChild(container);

    // Copy all styles from head to the container to ensure proper rendering
    const styles = document.head.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach(style => {
        container.appendChild(style.cloneNode(true));
    });

    let pages: HTMLElement[] = [];
    if (typeof content === 'string') {
        container.innerHTML = content;
        pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    } else if (Array.isArray(content)) {
        pages = content;
    } else {
        // Clone the element to avoid modifying the original
        // If content is the designer workspace, it might contain multiple pages or just one canvas
        // We assume content is the .workspace-content or similar
        // Let's check if content has children that are pages
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
            wrappers.forEach(w => w.setAttribute('data-print-wrapper', 'true'));

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
        svgToCanvas(container);
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

    return { container, tempWrapper: container, pagesCount };
  };

  const generatePageImages = async (container: HTMLElement, width: number, height: number): Promise<string[]> => {
    const pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
    
    // Optimize: Set all pages to top 0 at once to avoid layout thrashing during capture
    pages.forEach(page => {
        page.style.top = '0px';
    });

    const generatePageImage = async (page: HTMLElement) => {
        const canvas = await domtoimage.toCanvas(page, {
            scale: 1.5, // Reduce scale slightly for performance (2 -> 1.5)
            width: width,
            height: height,
            useCORS: true,
            bgcolor: store.canvasBackground,
        });

        const ctx = canvas.getContext('2d');
        if (ctx) {
            (ctx as any).mozImageSmoothingEnabled = false;
            (ctx as any).webkitImageSmoothingEnabled = false;
            (ctx as any).msImageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;
        }

        return canvas.toDataURL('image/jpeg', 0.5);
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
  };

    const createPdfDocument = async (content: HTMLElement | string | HTMLElement[]) => {
    const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });

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
        alert('Export PDF failed');
    }
  };

      const browserPrint = async (content: HTMLElement | string | HTMLElement[]) => {
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
          return;
        }
        
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
            // Edge needs a short delay for the PDF viewer to finish rendering.
            setTimeout(() => {
              win.print();
            }, 100);
          }
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
            }, 1000); // Give it some time to process
        };
    } catch (error) {
        console.error('Print failed', error);
        alert('Print failed');
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

  const sendWsPrintOnce = (url: string, payload: Record<string, any>, waitFor: 'status' | 'task_result') => new Promise<void>((resolve, reject) => {
    let resolved = false;
    const socket = new WebSocket(url);
    const timeoutId = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      socket.close();
      reject(new Error('Print request timeout'));
    }, 30000);

    socket.onopen = () => {
      socket.send(JSON.stringify(payload));
    };

    socket.onmessage = (event) => {
      if (resolved) return;
      try {
        const msg = JSON.parse(event.data);
        if (waitFor === 'status' && (msg.status === 'success' || msg.status === 'error')) {
          resolved = true;
          window.clearTimeout(timeoutId);
          socket.close();
          if (msg.status === 'success') resolve();
          else reject(new Error(msg.message || 'Print failed'));
          return;
        }

        if (waitFor === 'task_result' && msg.cmd === 'task_result') {
          resolved = true;
          window.clearTimeout(timeoutId);
          socket.close();
          resolve();
          return;
        }
      } catch (error) {
        resolved = true;
        window.clearTimeout(timeoutId);
        socket.close();
        reject(error instanceof Error ? error : new Error('Print failed'));
      }
    };

    socket.onerror = () => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timeoutId);
      socket.close();
      reject(new Error('Print connection failed'));
    };
  });

  let localSocket: WebSocket | null = null;
  let localSocketUrl = '';
  let localSocketPromise: Promise<WebSocket> | null = null;
  let localQueue = Promise.resolve();

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

  const sendLocalWsPrint = (url: string, payload: Record<string, any>, waitFor: 'status') => {
    localQueue = localQueue.then(() => new Promise<void>(async (resolve, reject) => {
      let resolved = false;
      let socket: WebSocket | null = null;
      const timeoutId = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resetLocalSocket();
        reject(new Error('Print request timeout'));
      }, 30000);

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
          if (msg.status === 'success' || msg.status === 'error') {
            resolved = true;
            window.clearTimeout(timeoutId);
            cleanup();
            if (msg.status === 'success') resolve();
            else reject(new Error(msg.message || 'Print failed'));
          }
        } catch (error) {
          resolved = true;
          window.clearTimeout(timeoutId);
          cleanup();
          reject(error instanceof Error ? error : new Error('Print failed'));
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
      await browserPrint(content);
      return;
    }

    const connectionOk = mode === 'local' ? localStatus.value === 'connected' : remoteStatus.value === 'connected';
    if (!connectionOk) {
      await browserPrint(content);
      return;
    }

    const options = request?.options || (mode === 'local' ? localPrintOptions : remotePrintOptions);
    if (!options.printer) {
      alert('Printer is required');
      return;
    }

    try {
      const pdfBlob = await getPdfBlob(content);
      const dataUrl = await blobToDataUrl(pdfBlob);

      if (mode === 'local') {
        const payload = buildPrintPayload(options, dataUrl, localSettings.secretKey.trim());
        await sendLocalWsPrint(localWsUrl.value, payload, 'status');
        return;
      }

      if (!remoteSelectedClientId.value) {
        alert('Client is required');
        return;
      }
      const payload = buildPrintPayload(options, dataUrl);
      payload.cmd = 'submit_task';
      payload.client_id = remoteSelectedClientId.value;
      await sendWsPrintOnce(remoteWsUrl.value, payload, 'task_result');
    } catch (error) {
      console.error('Print failed', error);
      alert('Print failed');
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
            restore();
        }
    } catch (error) {
        console.error('Export Images failed', error);
        alert('Export Images failed');
    }
  };

  const getImageBlob = async (content: HTMLElement | string | HTMLElement[]) => {
    try {
        const targetContent = content || Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const restore = await prepareEnvironment({ mutateStore: false, setExporting: false });
        
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
    exportImages,
    getPdfBlob,
    getImageBlob
  };
};
