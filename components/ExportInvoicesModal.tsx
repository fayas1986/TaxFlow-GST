import React, { useState, useMemo } from 'react';
import { 
  X, Download, FileSpreadsheet, FileText, Check, Calendar, 
  Layers, CheckCircle2, Sliders, AlertCircle, RefreshCw, BarChart3, Info
} from 'lucide-react';
import { Invoice } from '../types';
import * as XLSX from 'xlsx';

interface ExportInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  activeCategory: string;
}

interface ColumnConfig {
  id: string;
  label: string;
  getter: (inv: Invoice) => string | number;
}

export const ExportInvoicesModal: React.FC<ExportInvoicesModalProps> = ({
  isOpen,
  onClose,
  invoices,
  activeCategory
}) => {
  if (!isOpen) return null;

  // 1. Export options states
  const [fileFormat, setFileFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [fileNamePrefix, setFileNamePrefix] = useState('TaxFlow_Invoices_Report');
  const [categoryFilter, setCategoryFilter] = useState<string>('CURRENT'); // 'CURRENT', 'ALL', 'SALES', 'PURCHASE', 'CN_DN'
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRangeOption, setDateRangeOption] = useState<'ALL_TIME' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'CUSTOM'>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [includeSummaryBlock, setIncludeSummaryBlock] = useState(true);

  // 2. All Available Columns Config
  const columnsList: ColumnConfig[] = [
    { id: 'date', label: 'Invoice Date', getter: (inv) => inv.date },
    { id: 'invoiceNumber', label: 'Invoice Number', getter: (inv) => inv.invoiceNumber },
    { id: 'partyName', label: 'Party Name', getter: (inv) => inv.partyName },
    { id: 'gstin', label: 'GSTIN', getter: (inv) => inv.gstin || 'Unregistered' },
    { id: 'category', label: 'Category', getter: (inv) => inv.category },
    { id: 'type', label: 'Document Type', getter: (inv) => inv.type },
    { id: 'taxable', label: 'Taxable Value (INR)', getter: (inv) => inv.amount - (inv.taxAmount || 0) },
    { id: 'tax', label: 'Tax Amount (INR)', getter: (inv) => inv.taxAmount || 0 },
    { id: 'total', label: 'Total Value (INR)', getter: (inv) => inv.amount },
    { id: 'status', label: 'Invoice Status', getter: (inv) => inv.status },
    { id: 'irn', label: 'IRN Hash', getter: (inv) => inv.irn || '---' },
    { id: 'irnStatus', label: 'IRN Status', getter: (inv) => inv.irnStatus || '---' },
    { id: 'ewayBill', label: 'E-Way Bill No', getter: (inv) => inv.ewayBillDetails?.ewayBillNo || '---' },
  ];

  // Active columns set (defaults to all)
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(
    new Set(columnsList.map(c => c.id))
  );

  const toggleColumn = (id: string) => {
    const newSet = new Set(selectedColumnIds);
    if (newSet.has(id)) {
      if (newSet.size > 1) { // keep at least 1 column
        newSet.delete(id);
      }
    } else {
      newSet.add(id);
    }
    setSelectedColumnIds(newSet);
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(new Set(columnsList.map(c => c.id)));
  };

  const selectNoneColumns = () => {
    // Keep at least one column (invoiceNumber)
    setSelectedColumnIds(new Set(['invoiceNumber']));
  };

  // 3. Filtering logic to calculate live matches
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Category filter
      if (categoryFilter === 'CURRENT') {
        if (inv.category !== activeCategory) return false;
      } else if (categoryFilter !== 'ALL') {
        if (inv.category !== categoryFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (inv.status !== statusFilter) return false;
      }

      // Date filter
      if (dateRangeOption === 'ALL_TIME') {
        return true;
      }

      const invDate = new Date(inv.date);
      const now = new Date();
      
      if (dateRangeOption === 'THIS_MONTH') {
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      }

      if (dateRangeOption === 'LAST_MONTH') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return invDate.getMonth() === lastMonth && invDate.getFullYear() === year;
      }

      if (dateRangeOption === 'THIS_QUARTER') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const invQuarter = Math.floor(invDate.getMonth() / 3);
        return currentQuarter === invQuarter && invDate.getFullYear() === now.getFullYear();
      }

      if (dateRangeOption === 'CUSTOM') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          if (invDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          // Set to end of the day
          end.setHours(23, 59, 59, 999);
          if (invDate > end) return false;
        }
      }

      return true;
    });
  }, [invoices, categoryFilter, statusFilter, dateRangeOption, customStartDate, customEndDate, activeCategory]);

  // Summaries
  const totals = useMemo(() => {
    let totalTaxable = 0;
    let totalTax = 0;
    let totalInvoiceValue = 0;

    filteredInvoices.forEach(inv => {
      totalTaxable += inv.amount - (inv.taxAmount || 0);
      totalTax += inv.taxAmount || 0;
      totalInvoiceValue += inv.amount;
    });

    return {
      count: filteredInvoices.length,
      taxable: totalTaxable,
      tax: totalTax,
      total: totalInvoiceValue
    };
  }, [filteredInvoices]);

  // 4. Execution of Export
  const handleDownload = () => {
    if (filteredInvoices.length === 0) return;

    // Get selected columns in correct order
    const activeColumns = columnsList.filter(col => selectedColumnIds.has(col.id));
    const sheetHeaders = activeColumns.map(col => col.label);

    // Build row data arrays
    const dataRows = filteredInvoices.map(inv => {
      return activeColumns.map(col => col.getter(inv));
    });

    if (fileFormat === 'XLSX') {
      const workbook = XLSX.utils.book_new();
      let aoa: any[][] = [];

      if (includeSummaryBlock) {
        // Add a styled summary header blocks
        aoa.push(['TAXFLOW ENTERPRISE GST SUITE - COMPLIANCE EXPORT']);
        aoa.push(['Generated On:', new Date().toLocaleString()]);
        aoa.push(['Active Tenant Category:', categoryFilter === 'CURRENT' ? activeCategory : categoryFilter]);
        aoa.push(['Date Scope:', dateRangeOption.replace('_', ' ')]);
        aoa.push(['Total Record Count:', totals.count]);
        aoa.push(['Cumulative Taxable value:', totals.taxable]);
        aoa.push(['Cumulative Tax Amount:', totals.tax]);
        aoa.push(['Cumulative Total Invoice Value:', totals.total]);
        aoa.push([]); // Blank row
      }

      // Add actual headers & table data
      aoa.push(sheetHeaders);
      dataRows.forEach(row => aoa.push(row));

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      // Autofit columns logic
      const maxColLengths = aoa[aoa.length - 1]?.map((_, colIdx) => {
        return Math.max(
          ...aoa.map(row => {
            const cellVal = row[colIdx];
            return cellVal ? String(cellVal).length : 10;
          })
        );
      }) || [];
      worksheet['!cols'] = maxColLengths.map(len => ({ wch: Math.min(Math.max(len + 3, 10), 50) }));

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices Export');
      
      const fileName = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } else {
      // Generate standard plain CSV with clean comma escaping
      const csvLines: string[] = [];
      
      if (includeSummaryBlock) {
        csvLines.push(`# TAXFLOW ENTERPRISE REPORT`);
        csvLines.push(`# Generated On: ${new Date().toLocaleString()}`);
        csvLines.push(`# Total Records: ${totals.count}`);
        csvLines.push(`# Cumulative Total Value: INR ${totals.total.toLocaleString()}`);
        csvLines.push(``);
      }

      csvLines.push(sheetHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
      dataRows.forEach(row => {
        const escaped = row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`);
        csvLines.push(escaped.join(','));
      });

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
              <Download size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Export Invoices List</h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure report formats, custom filters, and data columns for external compliance reviews.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          
          {/* Format Selection & Prefix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Format Card */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                1. Select Export Format
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFileFormat('XLSX')}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    fileFormat === 'XLSX'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <FileSpreadsheet size={20} className={fileFormat === 'XLSX' ? 'text-blue-600' : 'text-slate-400'} />
                  <div className="text-left">
                    <p className="font-bold">Excel (.xlsx)</p>
                    <p className="text-[10px] text-slate-500 font-medium">Auto-styled grid workbook</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFileFormat('CSV')}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                    fileFormat === 'CSV'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <FileText size={20} className={fileFormat === 'CSV' ? 'text-blue-600' : 'text-slate-400'} />
                  <div className="text-left">
                    <p className="font-bold">Comma Separated (.csv)</p>
                    <p className="text-[10px] text-slate-500 font-medium">Standard plain-text table</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Filename Prefix */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                2. Base Filename Prefix
              </label>
              <div className="space-y-1">
                <input
                  type="text"
                  value={fileNamePrefix}
                  onChange={(e) => setFileNamePrefix(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 transition-colors"
                  placeholder="e.g. Invoices_Report"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Resulting name: <span className="font-mono text-slate-500">{fileNamePrefix}_{new Date().toISOString().split('T')[0]}.{fileFormat.toLowerCase()}</span>
                </p>
              </div>
            </div>

          </div>

          {/* Scope Filters: Category, Status, Date Range */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
              3. Data Scope & Filter Parameters
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Category Range */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Invoice Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="CURRENT">Current Screen Only ({activeCategory})</option>
                  <option value="ALL">All Ledger Categories (Combine All)</option>
                  <option value="SALES">Sales Invoices Only</option>
                  <option value="PURCHASE">Purchase Invoices Only</option>
                  <option value="CN_DN">Debit / Credit Notes Only</option>
                </select>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Filing & IRN Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Statuses (Active, Failed, Pending)</option>
                  <option value="UPLOADED">Uploaded / Active Only</option>
                  <option value="PENDING">Pending Portal Upload Only</option>
                  <option value="FAILED">Compliance Failed Only</option>
                </select>
              </div>

              {/* Date Scope */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Date Range</label>
                <select
                  value={dateRangeOption}
                  onChange={(e) => setDateRangeOption(e.target.value as any)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL_TIME">All-Time Invoices</option>
                  <option value="THIS_MONTH">This Month ({new Date().toLocaleString('default', { month: 'long' })})</option>
                  <option value="LAST_MONTH">Last Month</option>
                  <option value="THIS_QUARTER">Current Financial Quarter</option>
                  <option value="CUSTOM">Custom Date Window...</option>
                </select>
              </div>

              {/* Custom Dates Fields */}
              {dateRangeOption === 'CUSTOM' && (
                <div className="md:col-span-3 grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/50">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">From Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">To Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Column Checklist Picker */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                4. Select Columns to Export
              </label>
              <div className="flex gap-2 text-[10px]">
                <button 
                  type="button" 
                  onClick={selectAllColumns} 
                  className="text-blue-600 hover:underline font-bold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button 
                  type="button" 
                  onClick={selectNoneColumns} 
                  className="text-slate-500 hover:underline font-bold"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-4 border border-slate-200 rounded-2xl bg-slate-50/50">
              {columnsList.map(col => {
                const isChecked = selectedColumnIds.has(col.id);
                return (
                  <label 
                    key={col.id} 
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                      isChecked 
                        ? 'bg-white border-blue-200 text-blue-950 font-bold shadow-xs' 
                        : 'border-slate-200 hover:bg-white text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.id)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Toggle Summary Statistics Block */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="space-y-0.5 pr-4">
              <span className="font-bold text-slate-900">Include Summary Metadata Sheet</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Appends key totals (cumulative taxable, tax sum, aggregate invoice count) to the top of the spreadsheet block for instant dashboard reporting.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={includeSummaryBlock} 
                onChange={(e) => setIncludeSummaryBlock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Live Preview Summary Bar */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl text-blue-700">
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="font-black">Matches Selection: {totals.count} Invoice(s)</p>
                <p className="text-[10px] opacity-80 font-medium">
                  Taxable: ₹{totals.taxable.toLocaleString()} | Tax: ₹{totals.tax.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block">Total Aggregate Value</span>
              <span className="font-black text-sm text-slate-800">₹{totals.total.toLocaleString()}</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} className="text-green-500" /> Fully compatible with Microsoft Excel and modern reporting pipelines
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={totals.count === 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Generate & Download</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExportInvoicesModal;
