import { nextTick } from 'vue';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Canvg } from 'canvg';
import cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidv4 } from 'uuid';
import { useDesignerStore } from '@/stores/designer';
import { ElementType, type Page } from '@/types';

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
    
    try {
        const pages = document.querySelectorAll('.print-page');
        const container = document.createElement('div');
        
        pages.forEach((page, index) => {
            const clone = page.cloneNode(true) as HTMLElement;
            // Clean up the clone
            cleanElement(clone);
            
            // Adjust styles for preview flow
            clone.style.position = 'relative';
            clone.style.left = 'auto';
            clone.style.top = 'auto';
            clone.style.margin = '0 auto 20px auto';
            clone.style.transform = 'none';
            clone.style.boxShadow = 'none'; // Remove elevation shadow
            clone.style.border = '1px solid #eee'; // Light border for preview visibility
            
            // Fix IDs to avoid duplicates if previewing multiple times? 
            // Actually cloning doesn't change IDs, but it's fine for string output.
            
            container.appendChild(clone);
        });
        
        return container.outerHTML;
    } finally {
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
      const str = serializer.serializeToString(svg);
      const instance = Canvg.fromString(ctx, str);
      instance.render();
      svg.before(canvas);
      parent.removeChild(svg);
    });
  };

  const createTempContainer = (width: number, height: number, pagesCount: number): HTMLElement => {
    const temp = document.createElement('div');
    temp.className = 'hiprint_temp_Container';
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

  const processContentForImage = async (content: HTMLElement | string, width: number, height: number) => {
    let container: HTMLElement;
    let tempWrapper: HTMLElement | null = null;
    let pagesCount = 1;

    if (typeof content === 'string') {
        // Parse string to elements
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const pages = doc.body.children;
        pagesCount = pages.length;
        
        container = createTempContainer(width, height, pagesCount);
        tempWrapper = container.parentElement;

        Array.from(pages).forEach((page, idx) => {
            const el = page as HTMLElement;
            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.top = `${idx * height}px`;
            el.style.margin = '0';
            container.appendChild(el);
        });
    } else {
        // Existing element (from preview modal)
        // We need to clone it to flatten it into the vertical layout expected by jsPDF
        // But the preview modal already renders them vertically!
        // So we can just capture the preview modal content?
        // But preview modal has margins/borders/scrollbars.
        // Better to recreate the clean layout.
        
        const pages = content.querySelectorAll('.print-page');
        pagesCount = pages.length;
        
        container = createTempContainer(width, height, pagesCount);
        tempWrapper = container.parentElement;
        
        pages.forEach((page, idx) => {
            const clone = page.cloneNode(true) as HTMLElement;
            clone.style.position = 'absolute';
            clone.style.left = '0';
            clone.style.top = `${idx * height}px`;
            clone.style.margin = '0';
            clone.style.border = 'none'; // Remove preview border
            container.appendChild(clone);
        });
    }

    // Handle SVGs
    svgToCanvas(container);

    return { container, tempWrapper, pagesCount };
  };

  const exportPdf = async (content: HTMLElement | string, filename = 'print-design.pdf') => {
    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    
    const { container, tempWrapper, pagesCount } = await processContentForImage(content, width, height);

    try {
        const canvas = await domtoimage.toCanvas(container, {
            scale: 2,
            width: width,
            height: height * pagesCount,
            style: {
                transform: 'scale(1)',
                transformOrigin: 'top left'
            }
        });

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [width, height],
            hotfixes: ['px_scaling']
        });

        const imgData = canvas.toDataURL('image/png');
        for (let p = 0; p < pagesCount; p++) {
            if (p > 0) pdf.addPage([width, height]);
            // Slice the image? No, dom-to-image captured the WHOLE thing.
            // We need to crop it or shift it?
            // jsPDF addImage supports alias, x, y, w, h.
            // But we have one tall image.
            // We can add the SAME image but shifted Y.
            
            pdf.addImage(imgData, 'PNG', 0, -p * height, width, height * pagesCount);
        }
        
        pdf.save(filename);
    } catch (error) {
        console.error('Export PDF failed', error);
        alert('Export PDF failed');
    } finally {
        if (tempWrapper && tempWrapper.parentNode) {
            tempWrapper.parentNode.removeChild(tempWrapper);
        }
    }
  };

  const print = async (content: HTMLElement | string) => {
    const width = store.canvasSize.width;
    const height = store.canvasSize.height;
    
    const { container, tempWrapper, pagesCount } = await processContentForImage(content, width, height);

    try {
        const canvas = await html2canvas(container, {
            scale: 2, // Higher quality for print
            width: width,
            height: height * pagesCount,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Create an iframe to print the image
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.write(`
                <html>
                    <head>
                        <style>
                            @page { size: auto; margin: 0; }
                            body { margin: 0; }
                            img { width: 100%; height: auto; display: block; }
                        </style>
                    </head>
                    <body>
                        <img src="${imgData}" />
                    </body>
                </html>
            `);
            doc.close();
            
            iframe.contentWindow?.focus();
            setTimeout(() => {
                iframe.contentWindow?.print();
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
        }
    } catch (error) {
        console.error('Print failed', error);
        alert('Print failed');
    } finally {
         if (tempWrapper && tempWrapper.parentNode) {
            tempWrapper.parentNode.removeChild(tempWrapper);
        }
    }
  };

  return {
    getPrintHtml,
    print,
    exportPdf
  };
};
