import { DocumentTemplate, ExportConfig } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const PREDEFINED_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'inv-modern',
    name: 'Modern Professional',
    description: 'Clean design with professional slate accents and balanced spacing.',
    category: 'INVOICE',
    previewColor: '#3b82f6',
    styles: {
      primaryColor: '#0f172a',
      fontFamily: 'Inter, sans-serif',
      layout: 'MODERN'
    }
  },
  {
    id: 'inv-classic',
    name: 'Classic Corporate',
    description: 'Traditional layout with serif headers and formal structure.',
    category: 'INVOICE',
    previewColor: '#64748b',
    styles: {
      primaryColor: '#1e293b',
      fontFamily: 'Playfair Display, serif',
      layout: 'CLASSIC'
    }
  },
  {
    id: 'rep-corporate',
    name: 'Executive Summary',
    description: 'Dense, data-rich layout optimized for board-level reporting.',
    category: 'REPORT',
    previewColor: '#1e3a8a',
    styles: {
      primaryColor: '#1e3a8a',
      fontFamily: 'Inter, sans-serif',
      layout: 'MODERN'
    }
  },
  {
    id: 'rep-minimal',
    name: 'Minimalist Insight',
    description: 'Focus on core metrics with zero visual noise and high legibility.',
    category: 'REPORT',
    previewColor: '#94a3b8',
    styles: {
      primaryColor: '#334155',
      fontFamily: 'Inter, sans-serif',
      layout: 'MINIMAL'
    }
  }
];

export const generateStyledDocument = (data: any, config: ExportConfig) => {
  const template = PREDEFINED_TEMPLATES.find(t => t.id === config.templateId) || PREDEFINED_TEMPLATES[0];
  
  const doc = new jsPDF(config.paperSize === 'LETTER' ? 'p' : 'p', 'pt', config.paperSize === 'LETTER' ? 'letter' : 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Colors
  const primaryRGB = hexToRgb(template.styles.primaryColor);
  
  let startY = 40;

  // Add Letterhead or Logo from local storage
  if (config.includeLogo) {
    const letterhead = localStorage.getItem('company_letterhead');
    const logo = localStorage.getItem('company_logo');

    if (letterhead) {
      try {
        doc.addImage(letterhead, 'PNG', 0, 0, pageWidth, 100);
        startY = 120;
      } catch (e) {
        console.error("Error drawing letterhead", e);
      }
    } else if (logo) {
      try {
        doc.addImage(logo, 'PNG', 40, 30, 100, 50);
        startY = 100;
      } catch (e) {
        console.error("Error drawing logo", e);
      }
    }
  }

  // Accent Line
  doc.setDrawColor(primaryRGB.r, primaryRGB.g, primaryRGB.b);
  doc.setLineWidth(2);
  doc.line(40, startY - 10, pageWidth - 40, startY - 10);

  // Document Title
  doc.setFontSize(24);
  doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b);
  const title = template.category === 'INVOICE' ? 'TAX INVOICE' : 'RECONCILIATION REPORT';
  doc.text(title, pageWidth - 40, startY + 10, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 40, startY + 25, { align: 'right' });

  // Add content based on category
  if (template.category === 'INVOICE') {
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Invoice No: ${data.invoiceNumber || 'N/A'}`, 40, startY + 10);
    doc.text(`Date: ${data.date || 'N/A'}`, 40, startY + 25);
    
    doc.setFontSize(10);
    doc.text(`Billed To:`, 40, startY + 50);
    doc.setFontSize(12);
    doc.text(data.partyName || 'Customer Name', 40, startY + 65);
    doc.setFontSize(10);
    doc.text(`GSTIN: ${data.gstin || 'Unregistered'}`, 40, startY + 80);

    const columns = ['Description', 'HSN/SAC', 'Amount (Rs)', 'Tax (Rs)', 'Total (Rs)'];
    let items = data.items || [];
    if (items.length === 0) {
      // Mock item if no items exist
      items = [{
        description: 'Professional Services',
        hsn: '9983',
        taxable: data.amount - data.taxAmount || 0,
        taxAmount: data.taxAmount || 0,
        amount: data.amount || 0
      }];
    }

    const tableData = items.map((item: any) => [
      item.description || item.name || 'Item',
      item.hsn || item.hsnSac || 'N/A',
      ((item.taxable || (item.amount - item.taxAmount)) || 0).toLocaleString(),
      (item.taxAmount || 0).toLocaleString(),
      (item.amount || item.total || 0).toLocaleString()
    ]);

    let finalY = startY + 100;
    autoTable(doc, {
      startY: startY + 100,
      head: [columns],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [primaryRGB.r, primaryRGB.g, primaryRGB.b], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 },
      didDrawPage: (d: any) => {
        finalY = d.cursor.y;
      }
    });

    // Totals
    const finalTableData = [
      ['Total Taxable Value:', `Rs ${(data.amount - data.taxAmount).toLocaleString()}`],
      ['Total Tax:', `Rs ${data.taxAmount.toLocaleString()}`],
      ['Grand Total:', `Rs ${data.amount.toLocaleString()}`]
    ];
    autoTable(doc, {
      startY: finalY + 10,
      body: finalTableData,
      theme: 'plain',
      styles: { fontSize: 11, fontStyle: 'bold', halign: 'right' },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80 } },
      margin: { left: pageWidth - 220, right: 40 }
    });

  } else {
    // Report layout
    const columns = ['Invoice #', 'Party', 'Type', 'Amount', 'Tax', 'Status'];
    const rows = (data.invoices || []).map((inv: any) => [
      inv.invoiceNumber,
      inv.partyName,
      inv.type,
      inv.amount,
      inv.taxAmount,
      inv.status
    ]);
    
    autoTable(doc, {
      startY: startY + 50,
      head: [columns],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [primaryRGB.r, primaryRGB.g, primaryRGB.b] },
      margin: { left: 40, right: 40 }
    });
  }

  // Footer signature
  if (config.includeSignature) {
    doc.setFontSize(10);
    doc.text("Authorized Signatory", pageWidth - 40, pageHeight - 60, { align: 'right' });
    doc.setLineWidth(1);
    doc.line(pageWidth - 140, pageHeight - 75, pageWidth - 40, pageHeight - 75);
  }

  doc.save(`${template.category}_${new Date().toISOString().split('T')[0]}.pdf`);

  return { template, config, data, generatedAt: new Date().toISOString() };
};

function hexToRgb(hex: string) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 }; // Default blue
}
