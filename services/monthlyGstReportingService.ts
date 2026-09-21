import { MonthlyGstLiabilityData, FinancialYearReportingSummary } from '../types/monthlyReporting';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Base Financial Year Profiles
export const FINANCIAL_YEARS = [
  { id: '2026-27', label: 'FY 2026-27 (Current FY)', isCurrent: true },
  { id: '2025-26', label: 'FY 2025-26', isCurrent: false },
  { id: '2024-25', label: 'FY 2024-25', isCurrent: false },
];

export const GSTIN_ENTITIES = [
  { gstin: 'ALL', name: 'Consolidated (All GSTINs)', state: 'All India', code: '00' },
  { gstin: '27AABCU9603R1ZM', name: 'Maharashtra Unit (HQ)', state: 'Maharashtra', code: '27' },
  { gstin: '29AABCU9603R1ZN', name: 'Karnataka Tech Hub', state: 'Karnataka', code: '29' },
  { gstin: '24AABCU9603R1ZO', name: 'Gujarat Manufacturing Plant', state: 'Gujarat', code: '24' },
  { gstin: '07AABCU9603R1ZP', name: 'Delhi Logistics Hub', state: 'Delhi', code: '07' },
];

export const MONTH_NAMES = [
  { key: '04', name: 'Apr', fullName: 'April', quarter: 'Q1' as const },
  { key: '05', name: 'May', fullName: 'May', quarter: 'Q1' as const },
  { key: '06', name: 'Jun', fullName: 'June', quarter: 'Q1' as const },
  { key: '07', name: 'Jul', fullName: 'July', quarter: 'Q2' as const },
  { key: '08', name: 'Aug', fullName: 'August', quarter: 'Q2' as const },
  { key: '09', name: 'Sep', fullName: 'September', quarter: 'Q2' as const },
  { key: '10', name: 'Oct', fullName: 'October', quarter: 'Q3' as const },
  { key: '11', name: 'Nov', fullName: 'November', quarter: 'Q3' as const },
  { key: '12', name: 'Dec', fullName: 'December', quarter: 'Q3' as const },
  { key: '01', name: 'Jan', fullName: 'January', quarter: 'Q4' as const },
  { key: '02', name: 'Feb', fullName: 'February', quarter: 'Q4' as const },
  { key: '03', name: 'Mar', fullName: 'March', quarter: 'Q4' as const },
];

/**
 * Generates structured 12-month GST Liability vs ITC reporting dataset
 */
export function getMonthlyGstReportingData(
  fy: string = '2026-27',
  gstin: string = 'ALL',
  tenantId: string = 't1',
  quarterFilter: 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' = 'ALL'
): FinancialYearReportingSummary {
  // Multipliers based on entity/tenant
  let scale = 1.0;
  if (tenantId === 't2') scale = 1.45;
  if (gstin === '27AABCU9603R1ZM') scale *= 0.45; // MH 45%
  else if (gstin === '29AABCU9603R1ZN') scale *= 0.25; // KA 25%
  else if (gstin === '24AABCU9603R1ZO') scale *= 0.20; // GJ 20%
  else if (gstin === '07AABCU9603R1ZP') scale *= 0.10; // DL 10%

  const [startYearStr, endYearStr] = fy.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = 2000 + parseInt(endYearStr, 10);

  // Initial Opening Credit Ledger Balance on 1st April
  let runningLedgerBalance = Math.round(185000 * scale);
  const openingFyBalance = runningLedgerBalance;

  // Base patterns for standard 12 months with seasonal tax business cycle
  const baseMonthlyTurnover = [
    3250000, 3480000, 3920000, // Q1: Apr, May, Jun (Steady start to FY)
    3600000, 3850000, 4200000, // Q2: Jul, Aug, Sep (Mid-year ramp)
    4650000, 5100000, 5800000, // Q3: Oct, Nov, Dec (Festival surge / Diwali)
    4400000, 4750000, 6200000  // Q4: Jan, Feb, Mar (Year-end closing peak)
  ];

  const monthlyRecords: MonthlyGstLiabilityData[] = MONTH_NAMES.map((m, idx) => {
    const calendarYear = ['01', '02', '03'].includes(m.key) ? endYear : startYear;
    const monthKey = `${calendarYear}-${m.key}`;
    const monthName = `${m.name} ${calendarYear}`;
    
    // For FY 2026-27, Apr to Sep 2026 are completed/filed, Oct to Mar 2027 are model projections
    // For prior FYs, all 12 months are historical filed actuals
    const isProjected = fy === '2026-27' && ['10', '11', '12', '01', '02', '03'].includes(m.key);
    
    const turnover = Math.round(baseMonthlyTurnover[idx] * scale);
    const b2bTurnover = Math.round(turnover * 0.72);
    const b2cTurnover = Math.round(turnover * 0.18);
    const exportTurnover = Math.round(turnover * 0.10);

    // Effective Outward GST Tax rate ~18% blended
    const grossLiability = Math.round(turnover * 0.18);
    
    // Tax Head Breakdown: IGST (~52%), CGST (~24%), SGST (~24%), Cess (~1.5%)
    const outputIgst = Math.round(grossLiability * 0.50);
    const outputCgst = Math.round(grossLiability * 0.24);
    const outputSgst = Math.round(grossLiability * 0.24);
    const outputCess = grossLiability - (outputIgst + outputCgst + outputSgst);

    // Inward Supplies ~70% of Turnover
    const totalInwardSupplies = Math.round(turnover * 0.70);
    
    // Total gross ITC generated from Inward Supplies ~18%
    const totalGrossItc = Math.round(totalInwardSupplies * 0.18);
    
    // Ineligible / Blocked ITC u/s 17(5) (~4% to 6% of inward tax)
    const ineligibleItc17_5 = Math.round(totalGrossItc * 0.045);
    // Rule 42/43 Reversals (~1.5%)
    const itcReversals = Math.round(totalGrossItc * 0.015);
    
    // Net Available ITC (GSTR-2B eligible)
    const availableItc = totalGrossItc - ineligibleItc17_5;
    const netItcClaimed = availableItc - itcReversals;

    // ITC Composition
    const itcInputs = Math.round(netItcClaimed * 0.58);
    const itcServices = Math.round(netItcClaimed * 0.28);
    const itcCapitalGoods = netItcClaimed - (itcInputs + itcServices);

    // ITC Tax Heads
    const itcIgst = Math.round(netItcClaimed * 0.52);
    const itcCgst = Math.round(netItcClaimed * 0.23);
    const itcSgst = Math.round(netItcClaimed * 0.23);
    const itcCess = netItcClaimed - (itcIgst + itcCgst + itcSgst);

    // Opening balance for the month
    const openingCreditBalance = runningLedgerBalance;
    
    // Total credit available for utilization in Table 6.1 = Opening + Current Month Claimed
    const totalCreditInPool = openingCreditBalance + netItcClaimed;
    
    // Statutory set-off: Paid via ITC up to available credit, remaining via Cash (Electronic Cash Ledger)
    // Average utilization ratio: ~80% - 88% of gross liability offset by ITC
    const maxItcUtilizable = Math.min(totalCreditInPool, Math.round(grossLiability * 0.85));
    const paidViaItc = maxItcUtilizable;
    const paidViaCash = Math.max(0, grossLiability - paidViaItc);
    
    // Closing Credit Ledger Balance
    const closingCreditBalance = Math.max(0, totalCreditInPool - paidViaItc);
    runningLedgerBalance = closingCreditBalance;

    const itcUtilizationRate = grossLiability > 0 ? Math.round((paidViaItc / grossLiability) * 100) : 0;
    const cashPaidRate = grossLiability > 0 ? Math.round((paidViaCash / grossLiability) * 100) : 0;

    const filingStatus: 'FILED' | 'AUTO_DRAFTED' | 'PROJECTED' = 
      isProjected ? 'PROJECTED' : (idx === 5 ? 'AUTO_DRAFTED' : 'FILED');

    const dayPad = (idx * 2 + 11) % 20 + 1;
    const gstr1FilingDate = !isProjected ? `${calendarYear}-${m.key}-${String(dayPad).padStart(2, '0')}` : undefined;
    const gstr3bFilingDate = !isProjected ? `${calendarYear}-${m.key}-20` : undefined;
    const arn = !isProjected ? `AA${calendarYear}${m.key}${100234 + idx * 45}` : undefined;

    return {
      monthKey,
      monthName,
      shortMonth: m.name,
      quarter: m.quarter,
      isProjected,
      taxableTurnover: turnover,
      b2bTurnover,
      b2cTurnover,
      exportTurnover,
      grossLiability,
      outputIgst,
      outputCgst,
      outputSgst,
      outputCess,
      totalInwardSupplies,
      availableItc,
      itcInputs,
      itcCapitalGoods,
      itcServices,
      itcIgst,
      itcCgst,
      itcSgst,
      itcCess,
      ineligibleItc17_5,
      itcReversals,
      netItcClaimed,
      paidViaItc,
      paidViaCash,
      itcUtilizationRate,
      cashPaidRate,
      openingCreditBalance,
      closingCreditBalance,
      filingStatus,
      gstr1FilingDate,
      gstr3bFilingDate,
      arn
    };
  });

  // Apply Quarter Filter if requested
  const filteredRecords = quarterFilter === 'ALL' 
    ? monthlyRecords 
    : monthlyRecords.filter(r => r.quarter === quarterFilter);

  // Aggregations
  const totalTurnover = filteredRecords.reduce((s, r) => s + r.taxableTurnover, 0);
  const totalGrossLiability = filteredRecords.reduce((s, r) => s + r.grossLiability, 0);
  const totalAvailableItc = filteredRecords.reduce((s, r) => s + r.availableItc, 0);
  const totalItcClaimed = filteredRecords.reduce((s, r) => s + r.netItcClaimed, 0);
  const totalIneligibleItc = filteredRecords.reduce((s, r) => s + r.ineligibleItc17_5, 0);
  const totalPaidViaItc = filteredRecords.reduce((s, r) => s + r.paidViaItc, 0);
  const totalPaidViaCash = filteredRecords.reduce((s, r) => s + r.paidViaCash, 0);
  const overallItcCoverage = totalGrossLiability > 0 ? Math.round((totalPaidViaItc / totalGrossLiability) * 100) : 0;

  const totalOutputIgst = filteredRecords.reduce((s, r) => s + r.outputIgst, 0);
  const totalOutputCgst = filteredRecords.reduce((s, r) => s + r.outputCgst, 0);
  const totalOutputSgst = filteredRecords.reduce((s, r) => s + r.outputSgst, 0);
  const totalOutputCess = filteredRecords.reduce((s, r) => s + r.outputCess, 0);

  const totalItcIgst = filteredRecords.reduce((s, r) => s + r.itcIgst, 0);
  const totalItcCgst = filteredRecords.reduce((s, r) => s + r.itcCgst, 0);
  const totalItcSgst = filteredRecords.reduce((s, r) => s + r.itcSgst, 0);
  const totalItcCess = filteredRecords.reduce((s, r) => s + r.itcCess, 0);

  const closingFyBalance = monthlyRecords[monthlyRecords.length - 1]?.closingCreditBalance || 0;

  return {
    financialYear: `FY ${fy}`,
    tenantId,
    selectedGstin: gstin,
    selectedQuarter: quarterFilter,
    totalTurnover,
    totalGrossLiability,
    totalAvailableItc,
    totalItcClaimed,
    totalIneligibleItc,
    totalPaidViaItc,
    totalPaidViaCash,
    overallItcCoverage,
    totalOutputIgst,
    totalOutputCgst,
    totalOutputSgst,
    totalOutputCess,
    totalItcIgst,
    totalItcCgst,
    totalItcSgst,
    totalItcCess,
    openingFyBalance,
    closingFyBalance,
    monthlyRecords
  };
}

/**
 * Computes Cumulative Series for financial trajectory charts
 */
export function getCumulativeTrajectory(records: MonthlyGstLiabilityData[]) {
  let cumTurnover = 0;
  let cumLiability = 0;
  let cumItc = 0;
  let cumCash = 0;

  return records.map(r => {
    cumTurnover += r.taxableTurnover;
    cumLiability += r.grossLiability;
    cumItc += r.availableItc;
    cumCash += r.paidViaCash;

    return {
      month: r.shortMonth,
      monthName: r.monthName,
      isProjected: r.isProjected,
      cumTurnover: Math.round(cumTurnover / 100000), // In Lakhs
      cumLiability: Math.round(cumLiability / 100000),
      cumItc: Math.round(cumItc / 100000),
      cumCash: Math.round(cumCash / 100000),
      cumTurnoverRaw: cumTurnover,
      cumLiabilityRaw: cumLiability,
      cumItcRaw: cumItc,
      cumCashRaw: cumCash,
    };
  });
}

/**
 * Exports the Monthly GST Report to a styled Excel (.xlsx) file
 */
export function exportMonthlyReportToExcel(summary: FinancialYearReportingSummary, entityName?: string) {
  const wb = XLSX.utils.book_new();

  // 1. Monthly Breakdown Sheet
  const monthlyRows = summary.monthlyRecords.map(m => ({
    'Month': m.monthName,
    'Quarter': m.quarter,
    'Status': m.isProjected ? 'Projected' : m.filingStatus,
    'Taxable Turnover (INR)': m.taxableTurnover,
    'Gross Output Tax (INR)': m.grossLiability,
    'Output IGST (INR)': m.outputIgst,
    'Output CGST (INR)': m.outputCgst,
    'Output SGST (INR)': m.outputSgst,
    'Output Cess (INR)': m.outputCess,
    'Available ITC (GSTR-2B) (INR)': m.availableItc,
    'ITC Inputs (INR)': m.itcInputs,
    'ITC Capital Goods (INR)': m.itcCapitalGoods,
    'ITC Services (INR)': m.itcServices,
    'Ineligible ITC u/s 17(5) (INR)': m.ineligibleItc17_5,
    'Net ITC Claimed (INR)': m.netItcClaimed,
    'Discharged via ITC (INR)': m.paidViaItc,
    'Discharged via Cash (INR)': m.paidViaCash,
    'ITC Coverage %': `${m.itcUtilizationRate}%`,
    'Opening Credit Balance (INR)': m.openingCreditBalance,
    'Closing Credit Balance (INR)': m.closingCreditBalance,
    'GSTR-3B ARN': m.arn || 'N/A'
  }));

  const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly GST Trajectory');

  // 2. Executive Summary Sheet
  const summaryRows = [
    { 'Metric': 'Financial Year', 'Value': summary.financialYear },
    { 'Metric': 'Entity / Scope', 'Value': entityName || summary.selectedGstin },
    { 'Metric': 'Total Taxable Turnover', 'Value': summary.totalTurnover },
    { 'Metric': 'Total Gross Output Tax Liability', 'Value': summary.totalGrossLiability },
    { 'Metric': 'Total Available Eligible ITC', 'Value': summary.totalAvailableItc },
    { 'Metric': 'Total Net ITC Claimed in 3B', 'Value': summary.totalItcClaimed },
    { 'Metric': 'Total Blocked ITC u/s 17(5)', 'Value': summary.totalIneligibleItc },
    { 'Metric': 'Total Paid via ITC Ledger', 'Value': summary.totalPaidViaItc },
    { 'Metric': 'Total Net Cash Tax Paid (PMT-06)', 'Value': summary.totalPaidViaCash },
    { 'Metric': 'Overall ITC Coverage Ratio', 'Value': `${summary.overallItcCoverage}%` },
    { 'Metric': 'Opening FY Credit Balance', 'Value': summary.openingFyBalance },
    { 'Metric': 'Closing FY Credit Balance', 'Value': summary.closingFyBalance }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive FY Summary');

  XLSX.writeFile(wb, `TaxFlow_Monthly_GST_Liability_ITC_${summary.financialYear.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Exports CSV file
 */
export function exportMonthlyReportToCsv(summary: FinancialYearReportingSummary) {
  const headers = [
    'Month', 'Quarter', 'Status', 'Taxable Turnover', 'Gross Liability', 
    'Output IGST', 'Output CGST', 'Output SGST', 'Available ITC', 
    'Ineligible ITC 17(5)', 'Paid via ITC', 'Paid via Cash', 'ITC Utilization %', 'Closing Balance'
  ];

  const rows = summary.monthlyRecords.map(m => [
    `"${m.monthName}"`,
    `"${m.quarter}"`,
    `"${m.isProjected ? 'Projected' : m.filingStatus}"`,
    m.taxableTurnover,
    m.grossLiability,
    m.outputIgst,
    m.outputCgst,
    m.outputSgst,
    m.availableItc,
    m.ineligibleItc17_5,
    m.paidViaItc,
    m.paidViaCash,
    `"${m.itcUtilizationRate}%"`,
    m.closingCreditBalance
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Monthly_GST_Trends_ITC_${summary.financialYear.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a Statutory Executive PDF Summary
 */
export function exportMonthlyReportToPdf(
  summary: FinancialYearReportingSummary, 
  tenantName: string = 'TaxFlow Enterprise Ltd',
  entityName: string = 'Consolidated (All GSTINs)'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TaxFlow Enterprise - Statutory GST Reporting Dashboard', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Monthly GST Liability & ITC Availability Analysis | ${summary.financialYear} | Entity: ${entityName}`, 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 245, 18);

  // Executive KPI summary box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 28, 269, 22, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TAXABLE TURNOVER', 20, 35);
  doc.text('GROSS OUTPUT LIABILITY', 80, 35);
  doc.text('AVAILABLE ITC (2B)', 140, 35);
  doc.text('NET CASH TAX PAID', 200, 35);
  doc.text('ITC COVERAGE', 255, 35);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`INR ${(summary.totalTurnover / 10000000).toFixed(2)} Cr`, 20, 43);
  doc.text(`INR ${(summary.totalGrossLiability / 100000).toFixed(2)} L`, 80, 43);
  
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`INR ${(summary.totalAvailableItc / 100000).toFixed(2)} L`, 140, 43);

  doc.setTextColor(37, 99, 235); // Blue
  doc.text(`INR ${(summary.totalPaidViaCash / 100000).toFixed(2)} L`, 200, 43);

  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.overallItcCoverage}%`, 255, 43);

  // Monthly Table
  const tableData = summary.monthlyRecords.map(m => [
    m.monthName,
    m.quarter,
    m.isProjected ? 'Projected' : m.filingStatus,
    `₹${(m.taxableTurnover / 100000).toFixed(1)}L`,
    `₹${(m.grossLiability / 100000).toFixed(2)}L`,
    `₹${(m.outputIgst / 100000).toFixed(2)}L`,
    `₹${(m.outputCgst / 100000).toFixed(2)}L`,
    `₹${(m.availableItc / 100000).toFixed(2)}L`,
    `₹${(m.ineligibleItc17_5 / 1000).toFixed(0)}k`,
    `₹${(m.paidViaItc / 100000).toFixed(2)}L`,
    `₹${(m.paidViaCash / 100000).toFixed(2)}L`,
    `${m.itcUtilizationRate}%`,
    `₹${(m.closingCreditBalance / 100000).toFixed(2)}L`
  ]);

  autoTable(doc, {
    startY: 54,
    head: [[
      'Month', 'Qtr', 'Status', 'Turnover', 'Gross Liab', 
      'IGST', 'CGST/SGST', 'Avail ITC', 'Blocked 17(5)', 
      'Paid ITC', 'Paid Cash', 'ITC %', 'Closing Bal'
    ]],
    body: tableData,
    foot: [[
      'TOTAL (FY)',
      '12M',
      '-',
      `₹${(summary.totalTurnover / 10000000).toFixed(2)}Cr`,
      `₹${(summary.totalGrossLiability / 100000).toFixed(2)}L`,
      `₹${(summary.totalOutputIgst / 100000).toFixed(2)}L`,
      `₹${((summary.totalOutputCgst + summary.totalOutputSgst) / 100000).toFixed(2)}L`,
      `₹${(summary.totalAvailableItc / 100000).toFixed(2)}L`,
      `₹${(summary.totalIneligibleItc / 1000).toFixed(0)}k`,
      `₹${(summary.totalPaidViaItc / 100000).toFixed(2)}L`,
      `₹${(summary.totalPaidViaCash / 100000).toFixed(2)}L`,
      `${summary.overallItcCoverage}%`,
      `₹${(summary.closingFyBalance / 100000).toFixed(2)}L`
    ]],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right' },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', textColor: [16, 185, 129] },
      8: { halign: 'right', textColor: [225, 29, 72] },
      9: { halign: 'right', textColor: [16, 185, 129] },
      10: { halign: 'right', textColor: [37, 99, 235], fontStyle: 'bold' },
      11: { halign: 'center', fontStyle: 'bold' },
      12: { halign: 'right' }
    }
  });

  // Statutory Footer Notes
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Statutory Notes: Available ITC corresponds to auto-drafted GSTR-2B eligible supplies under Section 16(2)(aa). Blocked ITC identified under Section 17(5) and Rule 42/43.', 14, finalY);
  doc.text('Discharge of liability computed strictly in compliance with Section 49(5) and Rule 88A of the CGST Rules.', 14, finalY + 4);

  doc.save(`Monthly_GST_Liability_ITC_Report_${summary.financialYear.replace(/\s+/g, '_')}.pdf`);
}
