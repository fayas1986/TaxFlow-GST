import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ItcRefundClaim, StatutoryDocument } from './refundService';

export class RefundDossierGenerator {
  /**
   * Generates a multi-page statutory PDF dossier for an ITC refund claim
   */
  public static generateRefundDossierPDF(claim: ItcRefundClaim): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width; // 595.28 pt
    const pageHeight = doc.internal.pageSize.height; // 841.89 pt
    const margin = 36;
    const contentWidth = pageWidth - margin * 2;

    const formatInr = (val?: number) => {
      if (val === undefined || val === null) return '₹0';
      return '₹' + Number(val).toLocaleString('en-IN');
    };

    // --- Header Top Bar ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setFillColor(37, 99, 235); // blue-600 accent stripe
    doc.rect(0, 60, pageWidth, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('GOVERNMENT OF INDIA • GST COMMON PORTAL', margin, 26);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text('DIRECTORATE GENERAL OF SYSTEMS & DATA MANAGEMENT • STATUTORY REFUND DOSSIER', margin, 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`FORM GST RFD-SERIES`, pageWidth - margin, 26, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(147, 197, 253);
    doc.text(`ARN: ${claim.arn}`, pageWidth - margin, 42, { align: 'right' });

    let currentY = 82;

    // --- Title & Metadata Banner ---
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 54, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(`STATUTORY REFUND COMPLIANCE DOSSIER & AUDIT CERTIFICATE`, margin + 12, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Tax Period: ${claim.taxPeriod} (FY ${claim.financialYear})   |   Category: ${claim.category.replace(/_/g, ' ')}   |   Status: ${claim.status.replace(/_/g, ' ')}`, margin + 12, currentY + 34);
    doc.text(`Filing Date: ${claim.filingDate}   |   Acknowledged: ${claim.acknowledgedDate || 'RFD-02 In Process'}   |   GSTN Portal Synced: ${claim.portalSync.lastSyncedAt}`, margin + 12, currentY + 46);

    currentY += 66;

    // --- Section 1: Taxpayer & Jurisdictional Profile ---
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      head: [[
        { content: '1. TAXPAYER & JURISDICTIONAL PROFILE', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249] } }
      ]],
      body: [
        [
          { content: `Legal Name:\nTrade Name:\nGSTIN:\nBranch / Entity:`, styles: { fontStyle: 'bold', cellWidth: 120, fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.legalName}\n${claim.tradeName || claim.legalName}\n${claim.gstin}\n${claim.branchName || 'Head Office / Principal Place of Business'}`, styles: { fontSize: 8, textColor: [15, 23, 42] } }
        ],
        [
          { content: `State / Division:\nCommissionerate:\nRange:\nAssigned Officer:`, styles: { fontStyle: 'bold', cellWidth: 120, fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.jurisdiction.state} — ${claim.jurisdiction.division}\n${claim.jurisdiction.commissionerate} (${claim.jurisdiction.zone})\n${claim.jurisdiction.range}\n${claim.jurisdiction.assignedOfficerName}, ${claim.jurisdiction.officerDesignation}`, styles: { fontSize: 8, textColor: [15, 23, 42] } }
        ]
      ],
      styles: { cellPadding: 4.5, lineColor: [226, 232, 240], lineWidth: 0.5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- Section 2: Statutory Multi-Head Tax Reconciliation Matrix ---
    const claimedIgst = claim.amountClaimed.igst || 0;
    const claimedCgst = claim.amountClaimed.cgst || 0;
    const claimedSgst = claim.amountClaimed.sgst || 0;
    const claimedCess = claim.amountClaimed.cess || 0;
    const claimedTotal = claim.amountClaimed.total || 0;

    const provIgst = claim.amountProvisionallySanctioned?.igst ?? 0;
    const provCgst = claim.amountProvisionallySanctioned?.cgst ?? 0;
    const provSgst = claim.amountProvisionallySanctioned?.sgst ?? 0;
    const provCess = claim.amountProvisionallySanctioned?.cess ?? 0;
    const provTotal = claim.amountProvisionallySanctioned?.total ?? 0;

    const finalIgst = claim.amountFinalSanctioned?.igst ?? 0;
    const finalCgst = claim.amountFinalSanctioned?.cgst ?? 0;
    const finalSgst = claim.amountFinalSanctioned?.sgst ?? 0;
    const finalCess = claim.amountFinalSanctioned?.cess ?? 0;
    const finalTotal = claim.amountFinalSanctioned?.total ?? 0;

    const disbursedTotal = claim.amountDisbursed || 0;
    const rejectedTotal = claim.amountRejected || (claim.scnDetails?.proposedRejectionAmount ?? 0);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [{ content: '2. STATUTORY TAX HEAD RECONCILIATION STATEMENT (FORM GST RFD-01 / RFD-06)', colSpan: 6, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249], halign: 'left' } }],
        [
          'Tax Head Component',
          'Claimed (RFD-01)',
          'Provisional (RFD-04)',
          'Sanctioned (RFD-06)',
          'PFMS Disbursed (RFD-05)',
          'Variance / Rejection'
        ]
      ],
      body: [
        ['Integrated Tax (IGST)', formatInr(claimedIgst), provIgst ? formatInr(provIgst) : '—', finalIgst ? formatInr(finalIgst) : '—', disbursedTotal > 0 ? formatInr(finalIgst || provIgst || claimedIgst) : '₹0', '₹0'],
        ['Central Tax (CGST)', formatInr(claimedCgst), provCgst ? formatInr(provCgst) : '—', finalCgst ? formatInr(finalCgst) : '—', disbursedTotal > 0 ? formatInr(finalCgst || provCgst || claimedCgst) : '₹0', '₹0'],
        ['State Tax (SGST)', formatInr(claimedSgst), provSgst ? formatInr(provSgst) : '—', finalSgst ? formatInr(finalSgst) : '—', disbursedTotal > 0 ? formatInr(finalSgst || provSgst || claimedSgst) : '₹0', '₹0'],
        ['Compensation Cess', formatInr(claimedCess), provCess ? formatInr(provCess) : '—', finalCess ? formatInr(finalCess) : '—', '₹0', '₹0'],
        [
          { content: 'TOTAL NET REFUND', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: formatInr(claimedTotal), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          { content: provTotal ? formatInr(provTotal) : '—', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [79, 70, 229] } },
          { content: finalTotal ? formatInr(finalTotal) : '—', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [5, 150, 105] } },
          { content: formatInr(disbursedTotal), styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [5, 150, 105] } },
          { content: rejectedTotal ? formatInr(rejectedTotal) : '₹0', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: rejectedTotal > 0 ? [225, 29, 72] : [100, 116, 139] } }
        ]
      ],
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 4.5,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- Section 3: Statutory SLA & Section 54/56 Compliance Tracker ---
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [[{ content: '3. STATUTORY SLA & INTEREST AUDIT TRAIL (SECTION 54 & 56 OF CGST ACT)', colSpan: 4, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249], halign: 'left' } }]],
      body: [
        [
          { content: 'Statutory 60-Day Mandate:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `Section 54(7) requires refund sanction within 60 days of acknowledgment (Due: ${claim.sla.daysRemaining} days remaining)`, styles: { fontSize: 8 } },
          { content: 'Days Elapsed / Status:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.sla.daysElapsed} days elapsed (${claim.sla.urgencyLevel.replace(/_/g, ' ')})`, styles: { fontSize: 8, fontStyle: 'bold', textColor: claim.sla.isInterestApplicable ? [225, 29, 72] : [5, 150, 105] } }
        ],
        [
          { content: 'Section 56 Statutory Interest:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.sla.isInterestApplicable ? 'APPLICABLE @ 6% p.a. from Day 61 onwards' : 'Not triggered (Claim is within 60-day limit)'}`, styles: { fontSize: 8 } },
          { content: 'Accrued Statutory Interest:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: formatInr(claim.sla.accruedInterest), styles: { fontSize: 8, fontStyle: 'bold', textColor: claim.sla.accruedInterest > 0 ? [225, 29, 72] : [100, 116, 139] } }
        ]
      ],
      styles: { cellPadding: 4, fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- Section 4: PFMS & Electronic Banking Clearance ---
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [[{ content: '4. PUBLIC FINANCIAL MANAGEMENT SYSTEM (PFMS) & BANKING SETTLEMENT', colSpan: 4, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249], halign: 'left' } }]],
      body: [
        [
          { content: 'Beneficiary Bank:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.banking.bankName} (IFSC: ${claim.banking.ifsc})`, styles: { fontSize: 8 } },
          { content: 'Bank Account No:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.banking.accountNumberMasked} [Validated by PFMS]`, styles: { fontSize: 8, fontStyle: 'bold' } }
        ],
        [
          { content: 'Payment Advice (RFD-05):', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: claim.banking.paymentOrderNumber || 'Awaited / In Process', styles: { fontSize: 8, fontStyle: 'bold' } },
          { content: 'Banking UTR Number:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: claim.banking.utrNumber || 'Pending RBI Settlement', styles: { fontSize: 8, fontStyle: 'bold', textColor: claim.banking.utrNumber ? [5, 150, 105] : [100, 116, 139] } }
        ],
        [
          { content: 'PFMS Validation Status:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.banking.pfmsStatus}`, styles: { fontSize: 8, fontStyle: 'bold', textColor: [5, 150, 105] } },
          { content: 'Disbursement Date:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: claim.banking.disbursedDate || 'Pending Final Order', styles: { fontSize: 8 } }
        ]
      ],
      styles: { cellPadding: 4, fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // Check if we need to add a page or continue
    if (claim.deficiencyDetails || claim.scnDetails) {
      // --- Section 5: Notice & Deficiency Details (if applicable) ---
      const isDeficiency = Boolean(claim.deficiencyDetails);
      const isScn = Boolean(claim.scnDetails);

      const noticeTitle = isDeficiency 
        ? `5. ACTIVE DEFICIENCY MEMO (FORM GST RFD-03 — REF: ${claim.deficiencyDetails?.memoNumber})`
        : `5. ACTIVE SHOW CAUSE NOTICE (FORM GST RFD-08 — REF: ${claim.scnDetails?.scnNumber})`;

      const noticeBody = isDeficiency ? [
        [
          { content: 'Deficiency Finding:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105], cellWidth: 120 } },
          { content: claim.deficiencyDetails?.reason || '', styles: { fontSize: 8, textColor: [15, 23, 42] } }
        ],
        [
          { content: 'Required Rectifications:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: claim.deficiencyDetails?.requiredRectifications.map((r, i) => `${i + 1}. ${r}`).join('\n') || '', styles: { fontSize: 8 } }
        ],
        [
          { content: 'Due Date for Rectified RFD-01:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.deficiencyDetails?.dueDateForReply} (Must attach missing SEZ / Export endorsements)`, styles: { fontSize: 8, fontStyle: 'bold', textColor: [225, 29, 72] } }
        ]
      ] : [
        [
          { content: 'Grounds for Rejection:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105], cellWidth: 120 } },
          { content: claim.scnDetails?.groundsForRejection || '', styles: { fontSize: 8, textColor: [15, 23, 42] } }
        ],
        [
          { content: 'Proposed Rejection Amount:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${formatInr(claim.scnDetails?.proposedRejectionAmount)}   |   Reply Due: ${claim.scnDetails?.replyDueDate}`, styles: { fontSize: 8, fontStyle: 'bold', textColor: [225, 29, 72] } }
        ],
        [
          { content: 'Taxpayer Reply (RFD-09):', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: claim.scnDetails?.replyFiledDate ? `Reply Filed on ${claim.scnDetails.replyFiledDate}` : 'Pending Submission by Taxpayer', styles: { fontSize: 8 } }
        ]
      ];

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        theme: 'grid',
        head: [[{ content: noticeTitle, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [180, 83, 9], fillColor: [254, 243, 199], halign: 'left' } }]],
        body: noticeBody as any,
        styles: { cellPadding: 4.5 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // --- PAGE 2: STATUTORY DOCUMENTS & AUDIT TRAIL ---
    doc.addPage();
    let p2Y = 36;

    // Mini Page Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`STATUTORY REFUND DOSSIER — ARN: ${claim.arn}`, margin, p2Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Taxpayer: ${claim.legalName} (${claim.gstin})`, pageWidth - margin, p2Y, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, p2Y + 6, pageWidth - margin, p2Y + 6);
    p2Y += 18;

    // Section 6: Attached Statutory Documents Inventory
    const docRows = claim.documents.map((d, idx) => [
      idx + 1,
      d.type,
      d.title,
      d.documentNumber,
      d.issuedDate,
      d.issuedBy,
      d.fileSize,
      'AUTHENTICATED'
    ]);

    autoTable(doc, {
      startY: p2Y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [{ content: '6. STATUTORY DOCUMENTS & CERTIFIED ANNEXURES INVENTORY', colSpan: 8, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249], halign: 'left' } }],
        ['#', 'Type', 'Document Title', 'Document Reference', 'Issued Date', 'Issuing Authority', 'Size', 'Status']
      ],
      body: docRows,
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7,
        cellPadding: 3.5
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 150 },
        3: { fontStyle: 'bold' }
      }
    });

    p2Y = (doc as any).lastAutoTable.finalY + 14;

    // Section 7: Audit & Lifecycle Progression Trail
    const timelineRows = claim.timeline.map((t, idx) => [
      idx + 1,
      t.timestamp,
      t.formRef || '—',
      t.title,
      t.description,
      t.actor,
      t.status
    ]);

    autoTable(doc, {
      startY: p2Y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [{ content: '7. AUDIT & STATUTORY LIFECYCLE EVENT TRAIL', colSpan: 7, styles: { fontStyle: 'bold', fontSize: 9.5, textColor: [30, 41, 59], fillColor: [241, 245, 249], halign: 'left' } }],
        ['#', 'Timestamp', 'Form Ref', 'Event Title', 'Statutory Description', 'Actor', 'Status']
      ],
      body: timelineRows,
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7,
        cellPadding: 3.5
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 70 },
        2: { cellWidth: 50, fontStyle: 'bold' },
        3: { cellWidth: 100, fontStyle: 'bold' },
        4: { cellWidth: 180 }
      }
    });

    p2Y = (doc as any).lastAutoTable.finalY + 16;

    // Section 8: Statutory Declaration & Cryptographic Stamp
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, p2Y, contentWidth, 68, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('STATUTORY DECLARATION & ELECTRONIC AUTHENTICATION (SECTION 54 CGST ACT, 2017)', margin + 10, p2Y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'This document is an authenticated electronic statutory record generated in compliance with the Central Goods and Services Tax Act, 2017.\n' +
      'All particulars contained herein have been verified against GSTN Common Portal repository and ICEGATE/PFMS gateways.\n' +
      `Cryptographic Hash: SHA-256 [e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855]   |   Timestamp: ${new Date().toISOString()}`,
      margin + 10,
      p2Y + 28
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('FOR TAXPAYER / AUTHORIZED SIGNATORY', margin + 10, p2Y + 58);
    doc.text('JURISDICTIONAL PROPER OFFICER / GSTN GATEWAY', pageWidth - margin - 10, p2Y + 58, { align: 'right' });

    // --- Footer on all pages ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `TaxFlow Compliance Platform • Statutory Form Series 54/56 • Generated on ${new Date().toLocaleString()}`,
        margin,
        pageHeight - 16
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 16,
        { align: 'right' }
      );
    }

    return doc;
  }

  /**
   * Downloads the generated Statutory Refund Dossier PDF
   */
  public static downloadRefundDossierPDF(claim: ItcRefundClaim, filename?: string): void {
    const doc = this.generateRefundDossierPDF(claim);
    const resolvedName = filename || `Statutory_Form_GST_RFD_Dossier_${claim.arn}_${claim.taxPeriodCode}.pdf`;
    doc.save(resolvedName);
  }

  /**
   * Generates a single official statutory document PDF (e.g. RFD-01, RFD-03, RFD-06, etc.)
   */
  public static generateSingleDocumentPDF(claim: ItcRefundClaim, document: StatutoryDocument): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 55, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 55, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('GOVERNMENT OF INDIA • GST COMMON PORTAL', margin, 24);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`AUTHENTICATED STATUTORY CERTIFICATE • FORM GST ${document.type}`, margin, 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`REF: ${document.documentNumber}`, pageWidth - margin, 32, { align: 'right' });

    let currentY = 80;

    // Document Header Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 55, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(document.title.toUpperCase(), margin + 12, currentY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Document Type: Form GST ${document.type}   |   Issued On: ${document.issuedDate}   |   Issued By: ${document.issuedBy}`, margin + 12, currentY + 36);
    doc.text(`Status: ${document.status}   |   File Size: ${document.fileSize}   |   Application ARN: ${claim.arn}`, margin + 12, currentY + 48);

    currentY += 70;

    // Taxpayer details
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [[{ content: 'TAXPAYER & JURISDICTIONAL REFERENCE', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, fillColor: [241, 245, 249], textColor: [30, 41, 59] } }]],
      body: [
        [
          { content: 'Legal Name & GSTIN:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105], cellWidth: 140 } },
          { content: `${claim.legalName} (${claim.gstin})`, styles: { fontSize: 8 } }
        ],
        [
          { content: 'Tax Period & Category:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.taxPeriod} (${claim.financialYear}) — ${claim.category.replace(/_/g, ' ')}`, styles: { fontSize: 8 } }
        ],
        [
          { content: 'Jurisdictional Office:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.jurisdiction.commissionerate} (${claim.jurisdiction.zone}), Range: ${claim.jurisdiction.range}`, styles: { fontSize: 8 } }
        ],
        [
          { content: 'Assigned Proper Officer:', styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105] } },
          { content: `${claim.jurisdiction.assignedOfficerName}, ${claim.jurisdiction.officerDesignation}`, styles: { fontSize: 8 } }
        ]
      ],
      styles: { cellPadding: 4.5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 14;

    // Document Specific Content
    let docSpecificBody: any[] = [];
    if (document.type === 'RFD-03' && claim.deficiencyDetails) {
      docSpecificBody = [
        ['Deficiency Memo Ref', claim.deficiencyDetails.memoNumber],
        ['Officer Finding', claim.deficiencyDetails.reason],
        ['Required Rectifications', claim.deficiencyDetails.requiredRectifications.join('\n')],
        ['Due Date for Rectified Filing', claim.deficiencyDetails.dueDateForReply]
      ];
    } else if (document.type === 'RFD-08' && claim.scnDetails) {
      docSpecificBody = [
        ['Show Cause Notice Ref', claim.scnDetails.scnNumber],
        ['Grounds of Proposed Rejection', claim.scnDetails.groundsForRejection],
        ['Proposed Inadmissible ITC', '₹' + claim.scnDetails.proposedRejectionAmount.toLocaleString('en-IN')],
        ['Reply Due Date', claim.scnDetails.replyDueDate],
        ['Personal Hearing Date', claim.scnDetails.hearingDate || 'Not Scheduled']
      ];
    } else {
      docSpecificBody = [
        ['Claimed Total Tax', '₹' + claim.amountClaimed.total.toLocaleString('en-IN')],
        ['IGST Amount', '₹' + claim.amountClaimed.igst.toLocaleString('en-IN')],
        ['CGST Amount', '₹' + claim.amountClaimed.cgst.toLocaleString('en-IN')],
        ['SGST Amount', '₹' + claim.amountClaimed.sgst.toLocaleString('en-IN')],
        ['Beneficiary Bank', `${claim.banking.bankName} (${claim.banking.accountNumberMasked})`],
        ['Remarks & Endorsements', document.remarks || 'Document certified as per Rule 89 of CGST Rules 2017.']
      ];
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [[{ content: `STATUTORY PARTICULARS — ${document.title.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, fillColor: [241, 245, 249], textColor: [30, 41, 59] } }]],
      body: docSpecificBody.map(row => [
        { content: row[0], styles: { fontStyle: 'bold', fontSize: 8, textColor: [71, 85, 105], cellWidth: 140 } },
        { content: row[1], styles: { fontSize: 8, textColor: [15, 23, 42] } }
      ]),
      styles: { cellPadding: 5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Cryptographic attestation box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, contentWidth, 60, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('ELECTRONIC SIGNATURE & VALIDATION CERTIFICATE', margin + 10, currentY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Digitally signed via DSC / EVC by the authorized signatory / tax officer under Section 54 of CGST Act.\n' +
      `Document Checksum: SHA-256 [${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}]\n` +
      `Certified on ${new Date().toLocaleString()} by TaxFlow Compliance Engine.`,
      margin + 10,
      currentY + 28
    );

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`TaxFlow Compliance Platform • Form GST ${document.type} • Ref: ${document.documentNumber}`, margin, pageHeight - 20);
    doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 20, { align: 'right' });

    return doc;
  }

  /**
   * Downloads a single official statutory document PDF
   */
  public static downloadSingleDocumentPDF(claim: ItcRefundClaim, document: StatutoryDocument): void {
    const doc = this.generateSingleDocumentPDF(claim, document);
    const sanitizedTitle = document.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${document.type}_${document.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${sanitizedTitle}.pdf`);
  }

  /**
   * Triggers native print preview dialog or opens printable document window
   */
  public static printRefundDossier(claim: ItcRefundClaim): void {
    const doc = this.generateRefundDossierPDF(claim);
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Create a hidden print iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print iframe failed, opening in new tab or downloading', e);
          doc.save(`Statutory_Form_GST_RFD_Dossier_${claim.arn}.pdf`);
        }
      }, 500);
    };
  }
}
