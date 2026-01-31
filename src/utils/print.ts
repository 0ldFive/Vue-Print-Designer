import { nextTick } from 'vue';
import jsPDF from 'jspdf';
import domtoimage from 'dom-to-image-more';
import { Canvg } from 'canvg';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type Page } from '@/types';

import { pxToMm } from '@/utils/units';

export const usePrint = () => {
  const store = useDesignerStore();

  const createRepeatedPages = (originalPages: Page[]): Page[] => {
    const original = cloneDeep(originalPages);
    
    // Check if header/footer regions are defined
    const hasHeader = store.headerHeight > 0;
    const hasFooter = store.footerHeight > 0;

    if (!hasHeader && !hasFooter) return original;

    const basePage = original[0];
    const canvasHeight = store.canvasSize.height;
    
    // Filter elements that should be repeated (exclude pageNumber placeholders and elements outside range)
    const repeatHeaders = hasHeader ? basePage.elements.filter(e => 
      e.type !== ElementType.PAGE_NUMBER && 
      (e.y + e.height) <= store.headerHeight
    ) : [];
    
    const repeatFooters = hasFooter ? basePage.elements.filter(e => 
      e.type !== ElementType.PAGE_NUMBER && 
      e.y >= (canvasHeight - store.footerHeight)
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

  const prepareEnvironment = async () => {
    const previousSelection = store.selectedElementId;
    const previousShowGrid = store.showGrid;
    const previousZoom = store.zoom;
    const previousPages = cloneDeep(store.pages);
    
    // Save UI state
    const previousShowHeaderLine = store.showHeaderLine;
    const previousShowFooterLine = store.showFooterLine;
    const previousShowCornerMarkers = store.showCornerMarkers;

    store.selectElement(null);
    store.setShowGrid(false);
    store.setZoom(1); // Ensure 100% zoom for correct rendering
    
    // Hide UI overlays
    store.setShowHeaderLine(false);
    store.setShowFooterLine(false);
    store.showCornerMarkers = false;

    store.setIsExporting(true);
    document.body.classList.add('exporting');
    
    // Apply repeats
    store.pages = createRepeatedPages(store.pages);
    
    await nextTick();

    return () => {
      document.body.classList.remove('exporting');
      store.setIsExporting(false);
      store.setShowGrid(previousShowGrid);
      store.selectElement(previousSelection);
      store.setZoom(previousZoom);
      store.pages = previousPages;
      store.setShowHeaderLine(previousShowHeaderLine);
      store.setShowFooterLine(previousShowFooterLine);
      store.showCornerMarkers = previousShowCornerMarkers;
    };
  };

  const cleanElement = (element: HTMLElement) => {
    // Remove interactive and wrapper classes
    element.classList.remove(
      'element-wrapper', 
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

  const getPrintHtml = async (): Promise<string> => {
    const restore = await prepareEnvironment();
    
    const width = store.canvasSize.width;
    const height = store.canvasSize.height;

    let resultContainer: HTMLElement | null = null;
    let tempWrapper: HTMLElement | null = null;
    
    try {
        // Use real DOM elements to ensure computed styles are captured correctly
        const pages = Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        
        // Use the shared processing logic (handles pagination, SVG, etc.)
        const result = await processContentForImage(pages, width, height);
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

  const copyHeaderFooter = (sourcePage: HTMLElement, targetPage: HTMLElement, headerHeight: number, footerHeight: number, pageHeight: number) => {
    const wrappers = sourcePage.querySelectorAll('[data-print-wrapper]');
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
      const isHeader = top < headerHeight;
      const isFooter = top >= (pageHeight - footerHeight);
      
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

  const handleTablePagination = (container: HTMLElement, pageHeight: number, headerHeight: number, footerHeight: number) => {
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
             const limitBottom = pageRect.top + pageHeight - footerHeight;
             
             // Check if table extends beyond limit
             const tableRect = table.getBoundingClientRect();
             if (tableRect.bottom <= limitBottom) {
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
                         const wrapperTop = parseFloat(wrapper.style.top) || 0;
                         const startY = headerHeight > 0 ? headerHeight + 10 : 20;
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
                 copyHeaderFooter(page, newPage, headerHeight, footerHeight, pageHeight);

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
                 const startY = headerHeight > 0 ? headerHeight + 10 : 20;
                 newWrapper.style.top = `${startY}px`; 
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

  const cloneElementWithStyles = (element: HTMLElement): HTMLElement => {
    const clone = element.cloneNode(true) as HTMLElement;
    const queue: [HTMLElement, HTMLElement][] = [[element, clone]];
    
    while (queue.length > 0) {
        const [source, target] = queue.shift()!;
        
        if ((source as any) instanceof HTMLElement || (source as any) instanceof SVGElement) {
            const computed = window.getComputedStyle(source);
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

  const processContentForImage = async (content: HTMLElement | string | HTMLElement[], width: number, height: number, convertSvg = true) => {
    // Create hidden container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0'; // Move to viewport to ensure rendering
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
        const clone = cloneElementWithStyles(page);
            clone.style.position = 'absolute';
            clone.style.left = '0';
            clone.style.top = `${idx * height}px`;
            clone.style.width = `${width}px`;
            clone.style.height = `${height}px`;
            clone.style.transform = 'none'; // Reset zoom
            clone.style.background = store.canvasBackground;

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
    await new Promise(resolve => setTimeout(resolve, 100));

    // Handle SVGs
    if (convertSvg) {
        svgToCanvas(container);
    }

    // Handle Table Pagination
    const pagesCount = handleTablePagination(container, height, store.headerHeight, store.footerHeight);
    
    // Update Page Numbers
    updatePageNumbers(container, pagesCount);
    
    // Update container height based on new page count
    container.style.height = `${height * pagesCount}px`;

    return { container, tempWrapper: container, pagesCount };
  };

  const createPdfDocument = async (content: HTMLElement | string | HTMLElement[]) => {
    const restore = await prepareEnvironment();
    
    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    const widthMm = pxToMm(width);
    const heightMm = pxToMm(height);

    const { container, tempWrapper, pagesCount } = await processContentForImage(content, width, height);

    try {
        const pdf = new jsPDF({
            orientation: width > height ? 'l' : 'p',
            unit: 'mm',
            format: [widthMm, heightMm],
            hotfixes: ['px_scaling']
        });

        const pages = Array.from(container.children).filter(el => !['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) as HTMLElement[];
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const originalTop = page.style.top;
            page.style.top = '0px';

            const canvas = await domtoimage.toCanvas(page, {
                scale: 2,
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

            page.style.top = originalTop;
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            if (i > 0) pdf.addPage([widthMm, heightMm]);
            pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);
        }
        
        return pdf;
    } finally {
        if (tempWrapper && tempWrapper.parentNode) {
            tempWrapper.parentNode.removeChild(tempWrapper);
        }
        restore();
    }
  };

  const exportPdf = async (filename = 'print-design.pdf') => {
    try {
        const pages = Array.from(document.querySelectorAll('.print-page')) as HTMLElement[];
        const pdf = await createPdfDocument(pages);
        pdf.save(filename);
    } catch (error) {
        console.error('Export PDF failed', error);
        alert('Export PDF failed');
    }
  };

  const print = async (content: HTMLElement | string | HTMLElement[]) => {
    try {
        const pdf = await createPdfDocument(content);
        pdf.autoPrint();
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '0';
        iframe.style.top = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'fixed';
        iframe.style.visibility = 'hidden';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
            if (iframe.contentWindow) {
                iframe.contentWindow.print();
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

  return {
    getPrintHtml,
    print,
    exportPdf
  };
};
