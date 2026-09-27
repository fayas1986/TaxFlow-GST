import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportGstLiabilityPdfOptions {
  elementId?: string;
  element?: HTMLElement | null;
  reportTitle?: string;
  entityName?: string;
  gstin?: string;
  period?: string;
  fileName?: string;
  onStart?: () => void;
  onProgress?: (status: string) => void;
  onComplete?: (filename: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Exports the current GST Liability Report DOM component to a high-resolution PDF
 * utilizing html2canvas for visual fidelity and jsPDF for document generation.
 */
export async function exportGstLiabilityReportToPdf(
  options: ExportGstLiabilityPdfOptions = {}
): Promise<string> {
  const {
    elementId = 'monthly-gst-liability-trends-bar-chart',
    element: explicitElement,
    reportTitle = 'GST Liability & Performance Analytics Report',
    entityName = 'TaxFlow Enterprise Taxpayer',
    gstin = '27AAAAA0000A1Z5',
    period = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    fileName,
    onStart,
    onProgress,
    onComplete,
    onError,
  } = options;

  try {
    if (onStart) onStart();
    if (onProgress) onProgress('Preparing report elements for export...');

    // Resolve target DOM element
    let targetEl = explicitElement;
    if (!targetEl && elementId) {
      targetEl = document.getElementById(elementId);
    }

    // Fallback selectors if primary is not found
    if (!targetEl) {
      targetEl =
        document.getElementById('monthly-gst-liability-trends-bar-chart') ||
        document.getElementById('monthly-gst-summary-table-chart') ||
        document.getElementById('gst-liability-report-section') ||
        document.querySelector('.gst-liability-export-container') as HTMLElement;
    }

    if (!targetEl) {
      throw new Error(
        `Target GST liability element not found in DOM (checked: #${elementId}).`
      );
    }

    if (onProgress) onProgress('Capturing high-resolution report graphics with html2canvas...');

    // Save existing styles that might interfere with canvas rasterization
    const originalShadow = targetEl.style.boxShadow;
    targetEl.style.boxShadow = 'none';

    // Capture the element using html2canvas with retina 2x scaling
    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: targetEl.scrollWidth > 1200 ? targetEl.scrollWidth : 1200,
      ignoreElements: (el) => {
        // Exclude interactive tooltips or action buttons from the final export if needed
        return el.classList.contains('no-export-pdf') || el.classList.contains('pdf-export-hide');
      }
    });

    // Restore original element style
    targetEl.style.boxShadow = originalShadow;

    if (onProgress) onProgress('Formatting PDF layout and pagination with jsPDF...');

    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const printableWidth = pageWidth - margin * 2; // 186mm

    // Generate Header Banner
    const drawHeader = (doc: jsPDF, pageNum: number, totalPages: number) => {
      // Top header banner background
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, pageWidth, 22, 'F');

      // Accent colored line
      doc.setFillColor(37, 99, 235); // Blue 600
      doc.rect(0, 21, pageWidth, 1, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TAXFLOW — STATUTORY GST LIABILITY REPORT', margin, 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text(
        `Entity: ${entityName}  |  GSTIN: ${gstin}  |  Tax Period: ${period}`,
        margin,
        15.5
      );

      // Top-right timestamp
      doc.setFontSize(7.5);
      doc.setTextColor(226, 232, 240);
      const reportDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.text(`Generated: ${reportDate}`, pageWidth - margin, 9.5, { align: 'right' });
      doc.text(`Form: GSTR-3B & Table 3.1`, pageWidth - margin, 15.5, { align: 'right' });
    };

    // Generate Footer
    const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
      const footerY = pageHeight - 12;

      doc.setFillColor(248, 250, 252);
      doc.rect(0, footerY - 2, pageWidth, 14, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Central Goods and Services Tax Act, 2017 — Reconciled Outward Liability & ITC Ledger',
        margin,
        footerY + 3
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Verified via statutory GSTR-1 outward registers and GSTR-2B credit statements. Tamper-evident record.',
        margin,
        footerY + 7.5
      );

      // Page numbers
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY + 4, {
        align: 'right',
      });
    };

    // Calculate image dimensions and pagination
    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const contentStartY = 27; // below 22mm header + 5mm spacing
    const contentMaxHeightPerPage = pageHeight - contentStartY - 16; // space before footer

    if (imgHeight <= contentMaxHeightPerPage) {
      // Single Page
      drawHeader(pdf, 1, 1);
      pdf.addImage(imgData, 'PNG', margin, contentStartY, imgWidth, imgHeight);
      drawFooter(pdf, 1, 1);
    } else {
      // Multi-page splitting
      let remainingHeight = imgHeight;
      let currentSourceY = 0;
      let pageNum = 1;

      // Calculate total pages
      const totalPages = Math.ceil(imgHeight / contentMaxHeightPerPage);

      // Use canvas slicing for clean multi-page rendering
      const pageCanvas = document.createElement('canvas');
      const pageCtx = pageCanvas.getContext('2d');
      const sourcePageHeightPx = (contentMaxHeightPerPage * canvas.width) / imgWidth;

      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.round(sourcePageHeightPx);

      while (remainingHeight > 0) {
        if (pageNum > 1) {
          pdf.addPage();
        }

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          
          const sliceHeight = Math.min(
            canvas.height - currentSourceY,
            sourcePageHeightPx
          );

          pageCtx.drawImage(
            canvas,
            0,
            currentSourceY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );

          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const renderedSliceHeight = (sliceHeight * imgWidth) / canvas.width;

          drawHeader(pdf, pageNum, totalPages);
          pdf.addImage(
            pageImgData,
            'PNG',
            margin,
            contentStartY,
            imgWidth,
            renderedSliceHeight
          );
          drawFooter(pdf, pageNum, totalPages);

          currentSourceY += sliceHeight;
          remainingHeight -= renderedSliceHeight;
          pageNum++;
        } else {
          // Fallback if slice context fails
          drawHeader(pdf, pageNum, totalPages);
          pdf.addImage(imgData, 'PNG', margin, contentStartY - (pageNum - 1) * contentMaxHeightPerPage, imgWidth, imgHeight);
          drawFooter(pdf, pageNum, totalPages);
          break;
        }
      }
    }

    // Generate clean filename
    const sanitizedEntity = entityName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedPeriod = period.replace(/[^a-zA-Z0-9]/g, '_');
    const finalFileName =
      fileName ||
      `GST_Liability_Report_${sanitizedEntity}_${sanitizedPeriod}_${new Date().toISOString().split('T')[0]}.pdf`;

    pdf.save(finalFileName);

    if (onComplete) onComplete(finalFileName);
    return finalFileName;
  } catch (error: any) {
    console.error('Error during GST Liability PDF export:', error);
    if (onError) onError(error);
    throw error;
  }
}
