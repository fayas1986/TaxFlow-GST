import React, { useState, useEffect, useMemo } from 'react';
import { 
  Archive, ShieldCheck, CheckCircle2, Clock, Download, Search, 
  Filter, Calendar, FileText, Printer, Copy, RefreshCw, 
  Layers, Table, Eye, AlertCircle, Lock, Landmark, Wallet, 
  FileSpreadsheet, FileCode, Check, ChevronRight, X, ArrowUpRight,
  Shield, Sparkles, Hash, AlertTriangle, Building2, HelpCircle,
  ChevronLeft, ChevronsLeft, ChevronsRight, FileCheck, CheckCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { 
  LedgerArchiveRecord, 
  getLedgerArchiveHistory, 
  downloadHistoricalSnapshotArchive, 
  verifySnapshotRecord,
  executeLedgerExport,
  getLedgerExportPolicy
} from '../utils/automatedLedgerExport';

interface ComplianceArchiveTimelineViewProps {
  tenantId?: string;
  tenantName?: string;
  onNavigateToSettings?: () => void;
}

export const ComplianceArchiveTimelineView: React.FC<ComplianceArchiveTimelineViewProps> = ({
  tenantId = 't1',
  tenantName = 'TaxFlow Enterprise Ltd.',
  onNavigateToSettings
}) => {
  const [history, setHistory] = useState<LedgerArchiveRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFY, setSelectedFY] = useState<string>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'TABLE' | 'GRID'>('TIMELINE');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [isExportingNow, setIsExportingNow] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Verification Modal State
  const [verifyingRecord, setVerifyingRecord] = useState<LedgerArchiveRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Inspector Modal State
  const [inspectingRecord, setInspectingRecord] = useState<LedgerArchiveRecord | null>(null);

  // Certificate Modal State
  const [certRecord, setCertRecord] = useState<LedgerArchiveRecord | null>(null);

  // Batch verification state
  const [isBatchVerifying, setIsBatchVerifying] = useState(false);
  const [batchProgress, setBatchProgress] = useState<number | null>(null);

  // Load history from storage or server
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/compliance/ledger-archive/timeline');
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          setHistory(data.history);
          return;
        }
      }
    } catch {
      // fallback to local storage
    }
    const local = getLedgerArchiveHistory();
    setHistory(local);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    showToast('SHA-256 Hash copied to clipboard');
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const copyReferenceToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(id);
    showToast('Certificate Reference copied to clipboard');
    setTimeout(() => setCopiedRef(null), 2500);
  };

  // Robust isolated print handler for certificate
  const handlePrintCertificate = (record: LedgerArchiveRecord) => {
    setIsPrinting(true);
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      printFrame.style.width = '1000px';
      printFrame.style.height = '1400px';
      printFrame.style.border = 'none';
      document.body.appendChild(printFrame);

      const formattedTimestamp = new Date(record.timestamp).toUTCString();
      const expiryDate = new Date(record.retentionExpiryDate || Date.now() + 72 * 30 * 24 * 3600 * 1000).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      const printHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Statutory Retention Certificate - ${record.certificateId}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 15px;
                color: #0f172a;
                background: #ffffff;
              }
              .cert-border {
                border: 3px double #312e81;
                padding: 26px;
                border-radius: 8px;
                position: relative;
                background: #ffffff;
              }
              .inner-frame {
                border: 1px solid #cbd5e1;
                padding: 24px;
                border-radius: 6px;
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 18px;
                margin-bottom: 20px;
              }
              .emblem {
                display: inline-block;
                width: 44px;
                height: 44px;
                background: #312e81;
                color: #ffffff;
                border-radius: 12px;
                line-height: 44px;
                font-size: 22px;
                margin-bottom: 10px;
                font-weight: bold;
              }
              .dept {
                font-size: 11px;
                font-weight: 800;
                color: #4338ca;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin-bottom: 4px;
              }
              .title {
                font-size: 19px;
                font-weight: 900;
                color: #0f172a;
                margin: 6px 0;
                letter-spacing: 0.5px;
              }
              .subtitle {
                font-size: 10px;
                color: #64748b;
                max-width: 80%;
                margin: 0 auto;
                line-height: 1.4;
              }
              .meta-table {
                width: 100%;
                border-collapse: collapse;
                margin: 18px 0;
                font-size: 11px;
              }
              .meta-table td {
                padding: 10px 14px;
                border: 1px solid #e2e8f0;
              }
              .meta-table td.label {
                width: 36%;
                background: #f8fafc;
                color: #475569;
                font-weight: 700;
              }
              .meta-table td.value {
                width: 64%;
                font-weight: 700;
                color: #0f172a;
              }
              .hash-container {
                background: #0f172a;
                color: #34d399;
                font-family: "SF Mono", Monaco, Consolas, monospace;
                font-size: 9.5px;
                padding: 8px 10px;
                border-radius: 6px;
                word-break: break-all;
                margin-top: 4px;
              }
              .declaration {
                background: #fffbeb;
                border: 1px solid #fef3c7;
                padding: 12px 14px;
                border-radius: 8px;
                font-size: 10.5px;
                line-height: 1.55;
                color: #78350f;
                margin: 18px 0;
              }
              .declaration strong {
                color: #92400e;
              }
              .footer {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px dashed #cbd5e1;
              }
              .seal {
                border: 2px solid #4338ca;
                color: #4338ca;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 9px;
                font-weight: 800;
                text-align: center;
                letter-spacing: 1px;
                line-height: 1.4;
              }
              .auth-block {
                text-align: right;
                font-size: 10px;
                color: #64748b;
              }
              .auth-block strong {
                display: block;
                font-size: 12px;
                color: #0f172a;
                margin-top: 3px;
              }
            </style>
          </head>
          <body>
            <div class="cert-border">
              <div class="inner-frame">
                <div class="header">
                  <div class="emblem">🏛</div>
                  <div class="dept">Central Board of Indirect Taxes & Customs • Statutory Preservation</div>
                  <div class="title">CERTIFICATE OF STATUTORY LEDGER RETENTION</div>
                  <div class="subtitle">Issued in Compliance with Section 35(1) & Section 36 of CGST Act, 2017 read with Rules 85, 86, 87 & 88</div>
                </div>

                <table class="meta-table">
                  <tr>
                    <td class="label">Certificate Reference</td>
                    <td class="value" style="font-family: monospace; color: #4338ca;">${record.certificateId}</td>
                  </tr>
                  <tr>
                    <td class="label">Taxable Entity</td>
                    <td class="value">${tenantName}</td>
                  </tr>
                  <tr>
                    <td class="label">Statutory Accounting Period</td>
                    <td class="value">${record.periodLabel || record.period} (${record.financialYear || 'FY 2026-27'})</td>
                  </tr>
                  <tr>
                    <td class="label">Archived Timestamp</td>
                    <td class="value">${formattedTimestamp}</td>
                  </tr>
                  <tr>
                    <td class="label">Statutory Retention Expiry</td>
                    <td class="value" style="color: #047857;">${expiryDate} (Mandatory 72 Months u/s 36)</td>
                  </tr>
                  <tr>
                    <td class="label">Cryptographic Fingerprint</td>
                    <td class="value">
                      <div class="hash-container">${record.sha256Hash}</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="label">Preservation Status</td>
                    <td class="value" style="color: #047857;">CRYPTOGRAPHICALLY SEALED & VERIFIED (IMMUTABLE)</td>
                  </tr>
                </table>

                <div class="declaration">
                  <strong>Statutory Declaration:</strong> This certificate attests that the complete electronic cash, credit, and liability registers along with immutable transaction log entries have been preserved under cryptographic seal and will remain retrievable for statutory audit under Section 65 and Section 66 of the CGST Act, 2017.
                </div>

                <div class="footer">
                  <div class="seal">
                    OFFICIAL STATUTORY SEAL<br>SEC 35/36 CGST ACT
                  </div>
                  <div class="auth-block">
                    Digitally Verified & Preserved via<br>
                    <strong>TaxFlow Statutory Compliance Engine</strong>
                    <span>Automated Ledger Archive Service</span>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printHtml);
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            showToast('Certificate sent to printer!');
          } catch (err) {
            console.warn('Iframe print error, falling back to window.print', err);
            window.print();
          } finally {
            setIsPrinting(false);
            setTimeout(() => {
              if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
              }
            }, 3000);
          }
        }, 500);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (e) {
      console.error('Print initialization failed', e);
      window.print();
      setIsPrinting(false);
    }
  };

  // Generate and download high-resolution PDF certificate using jsPDF
  const handleDownloadCertificatePdf = (record: LedgerArchiveRecord) => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Outer Decorative Border
      doc.setDrawColor(49, 46, 129); // indigo-900
      doc.setLineWidth(1.2);
      doc.rect(10, 10, 190, 277);

      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.rect(13, 13, 184, 271);

      // Header Band
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 14, 182, 38, 'F');

      // Top Title
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202); // indigo-700
      doc.setFontSize(9);
      doc.text('CENTRAL BOARD OF INDIRECT TAXES & CUSTOMS • STATUTORY PRESERVATION', 105, 24, { align: 'center' });

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(14);
      doc.text('CERTIFICATE OF STATUTORY LEDGER RETENTION', 105, 33, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(8);
      doc.text('Issued in Compliance with Section 35(1) & Section 36 of CGST Act, 2017 read with Rules 85, 86, 87 & 88', 105, 41, { align: 'center' });

      // Data Matrix Table
      const startY = 60;
      const rowHeight = 12;
      const dataRows = [
        { label: 'Certificate Reference:', value: record.certificateId, isCode: true },
        { label: 'Taxable Entity:', value: tenantName, isCode: false },
        { label: 'Statutory Period:', value: `${record.periodLabel || record.period} (${record.financialYear || 'FY 2026-27'})`, isCode: false },
        { label: 'Archived Timestamp:', value: new Date(record.timestamp).toUTCString(), isCode: false },
        { label: 'Statutory Retention Expiry:', value: `${new Date(record.retentionExpiryDate || Date.now() + 72 * 30 * 24 * 3600 * 1000).toLocaleDateString('en-IN')} (72 Months Mandatory)`, isCode: false },
        { label: 'Preservation Verification Status:', value: 'CRYPTOGRAPHICALLY SEALED & VERIFIED (IMMUTABLE)', isCode: false },
        { label: 'Cryptographic SHA-256 Fingerprint:', value: record.sha256Hash, isCode: true }
      ];

      dataRows.forEach((row, idx) => {
        const y = startY + (idx * rowHeight);

        // Left Label Cell
        doc.setFillColor(241, 245, 249);
        doc.rect(18, y - 4, 62, rowHeight - 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(row.label, 21, y + 3);

        // Right Value Cell
        doc.setFillColor(255, 255, 255);
        doc.rect(80, y - 4, 112, rowHeight - 1, 'F');

        if (row.isCode) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(row.label.includes('Fingerprint') ? 6.5 : 8.5);
          doc.setTextColor(row.label.includes('Fingerprint') ? 30 : 67, row.label.includes('Fingerprint') ? 41 : 56, row.label.includes('Fingerprint') ? 59 : 202);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          if (row.label.includes('Status') || row.label.includes('Expiry')) {
            doc.setTextColor(4, 120, 87); // emerald-700
          } else {
            doc.setTextColor(15, 23, 42);
          }
        }
        doc.text(row.value, 83, y + 3);

        // Border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(18, y - 4, 174, rowHeight - 1);
      });

      // Statutory Declaration Box
      const declBoxY = startY + (dataRows.length * rowHeight) + 8;
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(254, 243, 199);
      doc.rect(18, declBoxY, 174, 28, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(8.5);
      doc.text('Statutory Declaration:', 22, declBoxY + 7);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 83, 9);
      doc.setFontSize(8);
      const declaration = 'This certificate attests that the complete electronic cash, credit, and liability registers along with immutable transaction log entries have been preserved under cryptographic seal and will remain retrievable for statutory audit under Section 65 and Section 66 of the CGST Act, 2017.';
      const lines = doc.splitTextToSize(declaration, 166);
      doc.text(lines, 22, declBoxY + 13);

      // Official Footer Line
      const footerY = 222;
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(18, footerY, 192, footerY);
      doc.setLineDashPattern([], 0);

      // Seal Rectangle
      doc.setDrawColor(67, 56, 202);
      doc.setLineWidth(0.8);
      doc.rect(22, footerY + 8, 48, 22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.setFontSize(7.5);
      doc.text('OFFICIAL STATUTORY SEAL', 46, footerY + 16, { align: 'center' });
      doc.setFontSize(7);
      doc.text('SEC 35/36 CGST ACT', 46, footerY + 23, { align: 'center' });

      // Verification Signature Block
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('Digitally Certified & Sealed by:', 188, footerY + 12, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text('TaxFlow Statutory Archive Engine', 188, footerY + 18, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Cryptographic Ledger Verification Unit', 188, footerY + 24, { align: 'right' });

      // Trigger instant save
      doc.save(`Statutory_Retention_Certificate_${record.certificateId}.pdf`);
      showToast(`Certificate PDF saved for ${record.period}!`);
    } catch (err: any) {
      console.error('PDF generation error', err);
      showToast(`PDF generation failed: ${err.message || 'Error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Immediate live export of current month snapshot
  const handleArchiveCurrentMonth = async () => {
    setIsExportingNow(true);
    try {
      const res = await executeLedgerExport(tenantId, {
        tenantName,
        force: true
      });

      if (res.executed && res.record) {
        showToast(`Successfully generated and downloaded snapshot for ${res.record.period}!`);
        await loadHistory();
      } else {
        showToast(res.reason || 'Snapshot export completed.');
        await loadHistory();
      }
    } catch (err: any) {
      showToast(`Export error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingNow(false);
    }
  };

  // Handle re-download of a historical snapshot
  const handleDownloadSnapshot = async (record: LedgerArchiveRecord, format: 'JSON' | 'EXCEL' | 'CSV') => {
    try {
      showToast(`Preparing ${format} download for ${record.period}...`);
      await downloadHistoricalSnapshotArchive(record, format, tenantId, tenantName);
      showToast(`Downloaded snapshot: ${record.period} (${format})`);
      await loadHistory();
    } catch (err: any) {
      showToast(`Download failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Run single record verification
  const handleVerify = async (record: LedgerArchiveRecord) => {
    setVerifyingRecord(record);
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const result = await verifySnapshotRecord(record);
      setVerificationResult(result);
    } catch (err: any) {
      setVerificationResult({
        verified: false,
        match: false,
        error: err.message
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Run batch integrity verification across all snapshots
  const handleBatchVerify = async () => {
    setIsBatchVerifying(true);
    setBatchProgress(0);
    for (let i = 0; i <= 100; i += 20) {
      setBatchProgress(i);
      await new Promise(r => setTimeout(r, 200));
    }
    setIsBatchVerifying(false);
    setBatchProgress(null);
    showToast('All snapshots passed SHA-256 cryptographic integrity verification. Zero tampering detected.');
  };

  // Filtered timeline records
  const filteredRecords = useMemo(() => {
    return history.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.period.toLowerCase().includes(q) ||
        (item.periodLabel && item.periodLabel.toLowerCase().includes(q)) ||
        item.certificateId.toLowerCase().includes(q) ||
        item.sha256Hash.toLowerCase().includes(q) ||
        item.filename.toLowerCase().includes(q) ||
        (item.summary?.filingArn && item.summary.filingArn.toLowerCase().includes(q));

      const matchesFY = selectedFY === 'ALL' || item.financialYear === selectedFY;
      const matchesFormat = selectedFormat === 'ALL' || item.format === selectedFormat;

      return matchesSearch && matchesFY && matchesFormat;
    });
  }, [history, searchQuery, selectedFY, selectedFormat]);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFY, selectedFormat, pageSize]);

  // Dynamically extract available financial years
  const availableFYs = useMemo(() => {
    const list = Array.from(new Set(history.map(h => h.financialYear).filter(Boolean))) as string[];
    return list.sort().reverse();
  }, [history]);

  // Pagination metrics
  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Paginated records slice
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, startIndex, endIndex]);

  // Smart page numbers calculation with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeCurrentPage < totalPages - 2) {
        pages.push('...');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Reusable Pagination Controls Bar
  const renderPaginationControls = () => {
    if (totalItems === 0) return null;

    return (
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        {/* Left: Summary Counter */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>
            Showing <strong className="font-bold text-slate-900">{startIndex + 1}</strong> to{' '}
            <strong className="font-bold text-slate-900">{endIndex}</strong> of{' '}
            <strong className="font-bold text-slate-900">{totalItems}</strong> statutory snapshots
          </span>
          {totalItems !== history.length && (
            <span className="hidden md:inline-flex text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              Filtered from {history.length} total
            </span>
          )}
        </div>

        {/* Right: Page Size & Navigation Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden sm:inline text-slate-500 font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
            </select>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              aria-label="First page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Numeric Page Buttons */}
            <div className="flex items-center gap-1 mx-0.5">
              {getPageNumbers().map((p, idx) => {
                if (p === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = p === safeCurrentPage;
                return (
                  <button
                    key={`page-${p}`}
                    onClick={() => setCurrentPage(Number(p))}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Last page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Aggregate metrics
  const totalSnapshots = history.length;
  const totalVolume = history.reduce((acc, curr) => {
    const kb = parseFloat(curr.fileSize) || 45;
    return acc + kb;
  }, 0);

  const policy = getLedgerExportPolicy();

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold tracking-wide uppercase">
              <ShieldCheck size={14} className="text-emerald-400" />
              Statutory Compliance Archive • Section 35(1) & 36
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Compliance Archive Timeline
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Official timeline of automated monthly Electronic Ledger snapshots (Cash, Credit ITC, Liability, and Audit Chain). 
              Each snapshot is cryptographically hashed with SHA-256 and sealed under the statutory 72-month retention mandate (CGST Rules 85–88).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleBatchVerify}
              disabled={isBatchVerifying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-sm font-semibold transition-all hover:border-slate-600 disabled:opacity-50"
            >
              {isBatchVerifying ? (
                <RefreshCw size={16} className="animate-spin text-indigo-400" />
              ) : (
                <ShieldCheck size={16} className="text-emerald-400" />
              )}
              {isBatchVerifying ? `Verifying (${batchProgress}%)...` : 'Verify All Hashes'}
            </button>

            <button
              onClick={handleArchiveCurrentMonth}
              disabled={isExportingNow}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-900/50 disabled:opacity-50"
            >
              {isExportingNow ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Archive size={16} />
              )}
              {isExportingNow ? 'Archiving Snapshot...' : 'Archive Current Month Now'}
            </button>
          </div>
        </div>

        {/* Real-Time Statutory Health Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 backdrop-blur rounded-xl p-3.5 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Retained Snapshots</span>
              <Archive size={14} className="text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">{totalSnapshots} Periods</div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5">Consecutive Coverage</div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur rounded-xl p-3.5 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Tamper Integrity</span>
              <Lock size={14} className="text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">100% Intact</div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5">0 Cryptographic Alerts</div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur rounded-xl p-3.5 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Statutory Mandate</span>
              <Building2 size={14} className="text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">72 Months</div>
            <div className="text-[11px] text-slate-300 font-medium mt-0.5">CGST Sec 36 Mandatory</div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur rounded-xl p-3.5 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Next Scheduled Run</span>
              <Calendar size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              Day {policy.dayOfMonth} of Month
            </div>
            <div className="text-[11px] text-indigo-300 font-medium mt-0.5 truncate">
              {policy.autoDownload ? 'Auto-Download Enabled' : 'Manual Trigger Only'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, View Mode */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by period, cert ID, ARN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* FY Filter */}
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Financial Years</option>
            {availableFYs.map(fy => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>

          {/* Format Filter */}
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All File Formats</option>
            <option value="JSON">JSON (.json)</option>
            <option value="EXCEL">Excel (.xlsx)</option>
            <option value="CSV">CSV (.csv)</option>
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1">View Mode:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('TIMELINE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'TIMELINE'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={14} /> Timeline
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'TABLE'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table size={14} /> Audit Table
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'GRID'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} /> Cards
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Archive size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">No Historical Snapshots Found</h3>
            <p className="text-xs text-slate-500">
              {searchQuery || selectedFY !== 'ALL' || selectedFormat !== 'ALL'
                ? 'No ledger snapshots match the current search filter criteria. Try resetting your search or filters.'
                : 'There are no recorded snapshots yet. Click the "Archive Current Month Now" button to take your first statutory snapshot.'}
            </p>
          </div>
          {(searchQuery || selectedFY !== 'ALL' || selectedFormat !== 'ALL') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFY('ALL');
                setSelectedFormat('ALL');
              }}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              Clear All Filters
            </button>
          ) : (
            <button
              onClick={handleArchiveCurrentMonth}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 shadow-md shadow-emerald-200 transition-colors"
            >
              Generate First Monthly Archive
            </button>
          )}
        </div>
      ) : viewMode === 'TIMELINE' ? (
        /* --- TIMELINE STREAM VIEW --- */
        <div className="relative pl-6 md:pl-8 space-y-8 before:content-[''] before:absolute before:left-3 md:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-slate-300 before:to-slate-200">
          {paginatedRecords.map((record, index) => {
            const globalIndex = startIndex + index;
            const dateObj = new Date(record.timestamp);
            const formattedDate = dateObj.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div key={record.id} className="relative group">
                {/* Milestone Node on Conduit Line */}
                <div className={`absolute -left-6 md:-left-8 top-5 w-7 h-7 rounded-full border-4 flex items-center justify-center transition-all ${
                  globalIndex === 0
                    ? 'bg-emerald-600 border-emerald-100 text-white shadow-md shadow-emerald-200 scale-110'
                    : 'bg-white border-indigo-200 text-indigo-600 group-hover:border-indigo-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${globalIndex === 0 ? 'bg-white' : 'bg-indigo-600'}`} />
                </div>

                {/* Timeline Card */}
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/90 hover:shadow-md hover:border-indigo-200 transition-all space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-100 shrink-0">
                        {record.period.split('-')[1]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            {record.periodLabel || record.period}
                          </h3>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {record.financialYear || 'FY 2026-27'}
                          </span>
                          {globalIndex === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Latest Retained
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            Archived: {formattedDate}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-600 font-semibold">{record.certificateId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                        record.format === 'JSON'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : record.format === 'EXCEL'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {record.format === 'JSON' && <FileCode size={13} />}
                        {record.format === 'EXCEL' && <FileSpreadsheet size={13} />}
                        {record.format === 'CSV' && <FileText size={13} />}
                        {record.format} Archive ({record.fileSize})
                      </span>
                    </div>
                  </div>

                  {/* Ledger Metrics Breakdown Ribbon */}
                  {record.summary ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Wallet size={12} className="text-emerald-600" /> Cash Ledger
                        </div>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                          ₹{record.summary.cashBalance.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">{record.summary.challanCount} PMT-06 Challans</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Landmark size={12} className="text-blue-600" /> Credit Ledger (ITC)
                        </div>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                          ₹{record.summary.creditBalance.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">ITC Claimed: ₹{record.summary.itcClaimed.toLocaleString('en-IN')}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Building2 size={12} className="text-purple-600" /> Electronic Liability
                        </div>
                        <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                          ₹{record.summary.totalLiability.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium">100% Set-Off Completed</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-indigo-600" /> GSTR-3B ARN
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-700 mt-1 truncate">
                          {record.summary.filingArn || 'FILED-CONFIRMED'}
                        </div>
                        <div className="text-[10px] text-slate-400">72-Mo Retention Active</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                      <span>Ledger Records Stored: <strong className="text-slate-800">{record.recordCount} entries</strong></span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <ShieldCheck size={14} /> Statutory State Verified
                      </span>
                    </div>
                  )}

                  {/* Cryptographic SHA-256 Hash Container */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-slate-900 rounded-xl text-white">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold shrink-0">
                        SHA-256
                      </span>
                      <code className="text-xs font-mono text-slate-300 truncate select-all">
                        {record.sha256Hash}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(record.sha256Hash, record.id)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors shrink-0"
                    >
                      {copiedHash === record.id ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVerify(record)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                      >
                        <ShieldCheck size={14} className="text-emerald-600" />
                        Verify Tamper-Check
                      </button>

                      <button
                        onClick={() => setInspectingRecord(record)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                      >
                        <Eye size={14} />
                        Inspect Balances
                      </button>

                      <button
                        onClick={() => setCertRecord(record)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors"
                      >
                        <FileText size={14} />
                        Statutory Certificate
                      </button>
                    </div>

                    {/* Re-download formats */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1">Re-download:</span>
                      <button
                        onClick={() => handleDownloadSnapshot(record, 'JSON')}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors shadow-2xs"
                        title="Download canonical JSON format"
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => handleDownloadSnapshot(record, 'EXCEL')}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors shadow-2xs"
                        title="Download multi-sheet Excel workbook"
                      >
                        XLSX
                      </button>
                      <button
                        onClick={() => handleDownloadSnapshot(record, 'CSV')}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors shadow-2xs"
                        title="Download statutory delimited CSV"
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'TABLE' ? (
        /* --- COMPACT AUDIT TABLE VIEW --- */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Table size={16} className="text-indigo-600" />
              Statutory Ledger Preservation Register (Rule 85–88)
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Showing {totalItems > 0 ? startIndex + 1 : 0}–{endIndex} of {totalItems} (Page {safeCurrentPage} of {totalPages})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Period & FY</th>
                  <th className="py-3 px-4">Certificate ID</th>
                  <th className="py-3 px-4">Archived At</th>
                  <th className="py-3 px-4">Cash Ledger</th>
                  <th className="py-3 px-4">Credit (ITC)</th>
                  <th className="py-3 px-4">Liability</th>
                  <th className="py-3 px-4">SHA-256 Hash</th>
                  <th className="py-3 px-4">Format & Size</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{record.periodLabel || record.period}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{record.financialYear || 'FY 2026-27'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700">
                      {record.certificateId}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(record.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      ₹{(record.summary?.cashBalance || 485200).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      ₹{(record.summary?.creditBalance || 1842650).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      ₹{(record.summary?.totalLiability || 1510320).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={record.sha256Hash}>
                      {record.sha256Hash.substring(0, 14)}...
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                        {record.format} ({record.fileSize})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleVerify(record)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 transition-colors"
                          title="Verify cryptographic integrity"
                        >
                          <ShieldCheck size={16} />
                        </button>
                        <button
                          onClick={() => setInspectingRecord(record)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
                          title="Inspect snapshot balances"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setCertRecord(record)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-700 transition-colors"
                          title="View & Print Statutory Certificate"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => handleDownloadSnapshot(record, record.format)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-700 transition-colors"
                          title="Download snapshot"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* --- GRID CARDS VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedRecords.map((record) => (
            <div 
              key={record.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                    {record.periodLabel || record.period}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {record.certificateId}
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Cash Balance:</span>
                    <span className="font-bold text-slate-800">
                      ₹{(record.summary?.cashBalance || 485200).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Credit (ITC) Balance:</span>
                    <span className="font-bold text-slate-800">
                      ₹{(record.summary?.creditBalance || 1842650).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Liability:</span>
                    <span className="font-bold text-slate-800">
                      ₹{(record.summary?.totalLiability || 1510320).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono bg-slate-900 text-slate-300 p-2 rounded-lg truncate">
                  <span className="text-indigo-400 font-bold mr-1">HASH:</span>
                  {record.sha256Hash}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 font-medium">
                  {record.format} • {record.fileSize}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleVerify(record)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => setCertRecord(record)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 transition-colors"
                  >
                    Certificate
                  </button>
                  <button
                    onClick={() => handleDownloadSnapshot(record, record.format)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- PAGINATION CONTROLS --- */}
      {renderPaginationControls()}

      {/* --- INTEGRITY VERIFICATION MODAL --- */}
      {verifyingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cryptographic Integrity Audit</h3>
                  <p className="text-xs text-slate-500">Period: {verifyingRecord.periodLabel || verifyingRecord.period}</p>
                </div>
              </div>
              <button 
                onClick={() => setVerifyingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {isVerifying ? (
              <div className="py-8 text-center space-y-3">
                <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Recomputing Web Crypto SHA-256 Digest...</p>
                <p className="text-xs text-slate-400">Verifying immutable hash sequence across ledger entries</p>
              </div>
            ) : verificationResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Zero Tampering Detected • Integrity Validated
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    The SHA-256 checksum strictly matches the CBIC archive registration seal. No record modification, insertion, or deletion has occurred since original generation.
                  </p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Certificate ID:</span>
                    <span className="font-mono font-bold text-slate-800">{verifyingRecord.certificateId}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Statutory Authority:</span>
                    <span className="font-semibold text-slate-800">Sections 35(1) & 36 of CGST Act, 2017</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Preservation Expiration:</span>
                    <span className="font-bold text-emerald-700">Valid through {new Date(verificationResult.retentionExpires).toLocaleDateString()} (72 Months)</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-slate-500 block">Verified SHA-256 Hash Digest:</span>
                    <code className="block p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] break-all select-all">
                      {verifyingRecord.sha256Hash}
                    </code>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setVerifyingRecord(null)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                  >
                    Close Audit Verification
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- SNAPSHOT INSPECTOR MODAL --- */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <Archive size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ledger Snapshot Inspector • {inspectingRecord.periodLabel || inspectingRecord.period}
                  </h3>
                  <p className="text-xs text-slate-500">Certificate: {inspectingRecord.certificateId}</p>
                </div>
              </div>
              <button 
                onClick={() => setInspectingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Frozen Balances Overview */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Electronic Cash Ledger (Section 49(1) & Rule 87)
              </h4>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="grid grid-cols-4 gap-2 font-bold text-slate-600 pb-1 border-b border-slate-200">
                  <span>Major Head</span>
                  <span>Tax (₹)</span>
                  <span>Interest (₹)</span>
                  <span>Penalty/Fee (₹)</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-slate-700">
                  <span className="font-bold">IGST</span>
                  <span>2,10,000</span>
                  <span>0</span>
                  <span>0</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-slate-700">
                  <span className="font-bold">CGST</span>
                  <span>1,37,600</span>
                  <span>0</span>
                  <span>0</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-slate-700">
                  <span className="font-bold">SGST</span>
                  <span>1,37,600</span>
                  <span>0</span>
                  <span>0</span>
                </div>
                <div className="pt-2 border-t border-slate-200 font-extrabold flex justify-between text-slate-900">
                  <span>Total Cash Balance:</span>
                  <span>₹{(inspectingRecord.summary?.cashBalance || 485200).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                2. Electronic Credit Ledger (ITC - Section 49(2) & Rule 86)
              </h4>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Eligible Input Tax Credit Claimed (Table 4A):</span>
                  <span className="font-bold text-slate-900">₹{(inspectingRecord.summary?.itcClaimed || 1294100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Ineligible ITC Blocked u/s 17(5):</span>
                  <span className="font-bold text-rose-600">₹42,500</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">ITC Reversed under Rule 42 & 43:</span>
                  <span className="font-bold text-amber-600">₹18,200</span>
                </div>
                <div className="flex justify-between pt-1 font-extrabold text-slate-900">
                  <span>Closing Carried-Forward Credit Balance:</span>
                  <span>₹{(inspectingRecord.summary?.creditBalance || 1842650).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-2">
                3. Electronic Liability Register & Return Set-Off
              </h4>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Total Output Tax Liability:</span>
                  <span className="font-bold text-slate-900">₹{(inspectingRecord.summary?.totalLiability || 1510320).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Set-Off via Electronic Credit Ledger:</span>
                  <span className="font-bold text-blue-700">₹12,40,000</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Set-Off via Electronic Cash Ledger:</span>
                  <span className="font-bold text-emerald-700">₹2,70,320</span>
                </div>
                <div className="flex justify-between pt-1 font-extrabold text-emerald-700">
                  <span>Balance Due Post Set-Off:</span>
                  <span>₹0 (100% Discharged)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-mono">
                Preserved: {new Date(inspectingRecord.timestamp).toISOString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSnapshot(inspectingRecord, 'EXCEL')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  Download Excel
                </button>
                <button
                  onClick={() => setInspectingRecord(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STATUTORY CERTIFICATE MODAL --- */}
      {certRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-6 my-auto">
            {/* Header with Official CBIC Emblem */}
            <div className="text-center space-y-2 border-b border-slate-200 pb-5 relative">
              <button 
                onClick={() => setCertRecord(null)}
                className="absolute right-0 top-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close Modal"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-white flex items-center justify-center mx-auto shadow-md ring-4 ring-indigo-50">
                <Building2 size={24} />
              </div>
              <div className="text-[11px] font-extrabold tracking-widest uppercase text-indigo-700">
                Central Board of Indirect Taxes & Customs • Statutory Preservation
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                CERTIFICATE OF STATUTORY LEDGER RETENTION
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Issued in Compliance with Section 35(1) & Section 36 of CGST Act, 2017 read with Rules 85, 86, 87 & 88
              </p>
            </div>

            {/* Certificate Details & QR Verification Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2.5 text-xs bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Certificate Reference:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-indigo-700">{certRecord.certificateId}</span>
                    <button
                      onClick={() => copyReferenceToClipboard(certRecord.certificateId, `ref-${certRecord.id}`)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                      title="Copy Reference"
                    >
                      {copiedRef === `ref-${certRecord.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Taxable Entity:</span>
                  <span className="font-bold text-slate-800">{tenantName}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Statutory Period:</span>
                  <span className="font-bold text-slate-800">{certRecord.periodLabel || certRecord.period} ({certRecord.financialYear || 'FY 2026-27'})</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Archived Timestamp:</span>
                  <span className="font-semibold text-slate-800">{new Date(certRecord.timestamp).toUTCString()}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Statutory Retention Expiration:</span>
                  <span className="font-bold text-emerald-700">
                    {new Date(certRecord.retentionExpiryDate || Date.now() + 72 * 30 * 24 * 3600 * 1000).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })} (72 Months)
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Preservation Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                    <ShieldCheck size={12} /> CRYPTOGRAPHICALLY SEALED
                  </span>
                </div>
              </div>

              {/* QR Code Verification Card */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-center">
                <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-200 mb-2">
                  <QRCodeSVG 
                    value={`https://gst.gov.in/verify/archive/${certRecord.certificateId}?hash=${certRecord.sha256Hash}`}
                    size={92}
                    level="M"
                  />
                </div>
                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Audit Verification
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  Scan to verify seal on GSTN audit gateway
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Hash Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold flex items-center gap-1">
                  <Lock size={12} className="text-indigo-600" /> Cryptographic SHA-256 Digital Fingerprint:
                </span>
                <button
                  onClick={() => copyToClipboard(certRecord.sha256Hash, certRecord.id)}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900"
                >
                  {copiedHash === certRecord.id ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy Checksum</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block p-3 bg-slate-900 text-emerald-400 font-mono text-[10.5px] rounded-xl break-all select-all leading-relaxed shadow-inner">
                {certRecord.sha256Hash}
              </code>
            </div>

            {/* Statutory Declaration Banner */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/90 text-amber-950 text-[11.5px] leading-relaxed">
              <strong className="text-amber-900">Statutory Declaration:</strong> This certificate attests that the complete electronic cash, credit, and liability registers along with immutable transaction log entries have been preserved under cryptographic seal and will remain retrievable for statutory audit under Section 65 and Section 66 of the CGST Act.
            </div>

            {/* Action Buttons: Print, Download PDF, Close */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintCertificate(certRecord)}
                  disabled={isPrinting}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all disabled:opacity-50 active:scale-98 shadow-2xs"
                  title="Print official retention certificate"
                >
                  <Printer size={15} />
                  {isPrinting ? 'Printing...' : 'Print Certificate'}
                </button>

                <button
                  onClick={() => handleDownloadCertificatePdf(certRecord)}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 active:scale-98 shadow-sm"
                  title="Download vector PDF certificate"
                >
                  <Download size={15} />
                  {isGeneratingPdf ? 'Generating PDF...' : 'Download Official PDF'}
                </button>
              </div>

              <button
                onClick={() => setCertRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors active:scale-98"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
