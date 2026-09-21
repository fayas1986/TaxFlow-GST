import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateBrandedPDF = (
  title: string,
  data: any[],
  columns: string[],
  fileName: string
) => {
  const doc = new jsPDF('p', 'pt', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Fetch logo and letterhead from localStorage
  const logo = localStorage.getItem('company_logo');
  const letterhead = localStorage.getItem('company_letterhead');

  let startY = 40;

  if (letterhead) {
    try {
      // Assuming letterhead is a full page background or just a top banner
      // If it's a top banner, say height is 100
      doc.addImage(letterhead, 'PNG', 0, 0, pageWidth, 100);
      startY = 120;
    } catch (e) {
      console.error("Error adding letterhead to PDF", e);
    }
  } else if (logo) {
    try {
      doc.addImage(logo, 'PNG', 40, 30, 100, 50);
      startY = 100;
    } catch (e) {
      console.error("Error adding logo to PDF", e);
    }
  }

  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(title, 40, startY);
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, startY + 15);

  const tableData = data.map(row => columns.map(col => row[col] || ''));

  autoTable(doc, {
    startY: startY + 30,
    head: [columns],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { top: startY + 30, right: 40, bottom: 40, left: 40 },
    didDrawPage: (data) => {
      // Draw footer on every page
      const footerStr = `Page ${data.pageNumber}`;
      doc.setFontSize(10);
      doc.text(footerStr, pageWidth - 80, pageHeight - 30);
    },
  });

  doc.save(`${fileName}.pdf`);
};
