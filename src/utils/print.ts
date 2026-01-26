import { nextTick } from 'vue';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  const generatePdf = async (width: number, height: number): Promise<jsPDF> => {
    const pages = document.querySelectorAll('.print-page');
    if (!pages.length) throw new Error('No pages found');

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [width, height],
      hotfixes: ['px_scaling']
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i] as HTMLElement;

      const canvas = await html2canvas(page, {
        scale: 1, // 1:1 scale to match canvas size
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');

      if (i > 0) {
        pdf.addPage([width, height]);
      }

      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    }

    return pdf;
  };

  const prepareEnvironment = async () => {
    const previousSelection = store.selectedElementId;
    const previousShowGrid = store.showGrid;
    const previousZoom = store.zoom;
    const previousPages = cloneDeep(store.pages);

    store.selectElement(null);
    store.setShowGrid(false);
    store.setZoom(1); // Ensure 100% zoom for correct rendering
    document.body.classList.add('exporting');
    
    // Apply repeats
    store.pages = createRepeatedPages(store.pages);
    
    await nextTick();

    return {
      restore: () => {
        document.body.classList.remove('exporting');
        store.setShowGrid(previousShowGrid);
        store.selectElement(previousSelection);
        store.setZoom(previousZoom);
        store.pages = previousPages;
      }
    };
  };

  const print = async () => {
    const { restore } = await prepareEnvironment();
    try {
      const pdf = await generatePdf(store.canvasSize.width, store.canvasSize.height);
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Optional: Cleanup logic
          // setTimeout(() => {
          //   document.body.removeChild(iframe);
          //   URL.revokeObjectURL(blobUrl);
          // }, 60000);
        }, 500);
      };
    } catch (error) {
      console.error('Print failed', error);
      alert('Print failed');
    } finally {
      restore();
    }
  };

  const exportPdf = async (filename = 'print-design.pdf') => {
    const { restore } = await prepareEnvironment();
    try {
      const pdf = await generatePdf(store.canvasSize.width, store.canvasSize.height);
      pdf.save(filename);
    } catch (error) {
      console.error('Export failed', error);
      alert('Export failed');
    } finally {
      restore();
    }
  };

  return {
    print,
    exportPdf
  };
};
