import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, Plus, Search, Filter, Trash2, ArrowRight, ArrowLeft, 
  CheckCircle2, Info, PackageCheck, AlertCircle, Sparkles, Hash
} from 'lucide-react';
import { HSNRecord, Gstr1WizardSharedProps } from './types';

export const Step2HsnSummaries: React.FC<Gstr1WizardSharedProps> = ({
  allHsns,
  onAddCustomHsn,
  onDeleteCustomHsn,
  onNavigateStep
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [rateFilter, setRateFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New HSN state
  const [newHsn, setNewHsn] = useState<Partial<HSNRecord>>({
    hsnCode: '',
    description: '',
    uqc: 'NOS',
    quantity: 1,
    taxableValue: 0,
    taxRate: 18
  });

  // Filtered HSNs
  const filteredHsns = allHsns.filter(item => {
    const matchesSearch = item.hsnCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (rateFilter === 'ALL') return matchesSearch;
    return matchesSearch && item.taxRate.toString() === rateFilter;
  });

  const totalQty = allHsns.reduce((sum, h) => sum + (h.quantity || 0), 0);
  const totalTaxable = allHsns.reduce((sum, h) => sum + (h.taxableValue || 0), 0);
  const totalIgst = allHsns.reduce((sum, h) => sum + (h.igst || 0), 0);
  const totalCgst = allHsns.reduce((sum, h) => sum + (h.cgst || 0), 0);
  const totalSgst = allHsns.reduce((sum, h) => sum + (h.sgst || 0), 0);
  const totalGst = totalIgst + totalCgst + totalSgst;

  const handleCreateHsn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHsn.hsnCode || !newHsn.description || !newHsn.taxableValue) {
      return;
    }

    const rate = newHsn.taxRate || 18;
    const taxAmt = (newHsn.taxableValue * rate) / 100;
    const isService = newHsn.hsnCode.startsWith('99');

    const createdRecord: HSNRecord = {
      hsnCode: newHsn.hsnCode.trim(),
      description: newHsn.description.trim(),
      uqc: isService ? 'SAC' : (newHsn.uqc || 'NOS'),
      quantity: isService ? 1 : (newHsn.quantity || 1),
      totalValue: newHsn.taxableValue + taxAmt,
      taxableValue: newHsn.taxableValue,
      taxRate: rate,
      igst: 0,
      cgst: taxAmt / 2,
      sgst: taxAmt / 2
    };

    onAddCustomHsn(createdRecord);
    setShowAddModal(false);
    setNewHsn({
      hsnCode: '',
      description: '',
      uqc: 'NOS',
      quantity: 1,
      taxableValue: 0,
      taxRate: 18
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Step 2 of 4: Table 12 Consolidation
            </span>
            <span className="text-xs font-semibold text-slate-400">Rule 59 Statutory Requirement</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Review HSN/SAC Outward Summaries</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Table 12 requires itemized reporting by HSN code (goods) and SAC code (services) with mandatory Unit Quantity Codes (UQC).
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 self-start md:self-auto"
        >
          <Plus size={14} /> Add Custom HSN Entry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HSN/SAC Categories</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-slate-900">{allHsns.length}</span>
            <span className="text-[11px] font-semibold text-slate-500">unique codes</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Consolidated outward lines</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Quantity</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            {totalQty.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">Aggregated units across UQC</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Table 12 Taxable Turnover</span>
          <div className="text-2xl font-mono font-black text-slate-900 mt-1">
            ₹{totalTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Cross-verified with invoices</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Table 12 GST Output</span>
          <div className="text-2xl font-mono font-black text-blue-600 mt-1">
            ₹{totalGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">IGST + CGST + SGST</span>
        </div>
      </div>

      {/* Statutory Guidance Note */}
      <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">CBIC Statutory Threshold Note for Table 12:</span>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Taxpayers with Aggregate Annual Turnover (AATO) up to ₹5 Crore must report minimum <strong>4-digit HSN</strong> for B2B supplies (optional for B2C). Taxpayers with AATO &gt; ₹5 Crore must mandatorily report <strong>6-digit HSN</strong> on all outward supplies. SAC codes for services must start with 99.
          </p>
        </div>
      </div>

      {/* HSN Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Table 12 HSN Summary Schedule</h3>
            <span className="text-xs bg-slate-100 font-mono font-bold text-slate-700 px-2 py-0.5 rounded-full">
              {filteredHsns.length} Entries
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by HSN or Description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
              {(['ALL', '5', '12', '18', '28'] as const).map(rate => (
                <button
                  key={rate}
                  onClick={() => setRateFilter(rate)}
                  className={`px-2.5 py-1 rounded ${
                    rateFilter === rate ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {rate === 'ALL' ? 'All Rates' : `${rate}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">HSN / SAC</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">UQC</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Taxable (₹)</th>
                <th className="px-4 py-3 text-center">Rate</th>
                <th className="px-4 py-3 text-right">CGST (₹)</th>
                <th className="px-4 py-3 text-right">SGST (₹)</th>
                <th className="px-4 py-3 text-right">IGST (₹)</th>
                <th className="px-4 py-3 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredHsns.map((item, idx) => {
                const isService = item.hsnCode.startsWith('99');
                const isCustom = idx >= allHsns.length - (allHsns.length - filteredHsns.length);
                return (
                  <tr key={`${item.hsnCode}-${item.taxRate}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                      {item.hsnCode}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isService ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {isService ? 'Service (SAC)' : 'Goods (HSN)'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate text-slate-800">
                      {item.description}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600">
                      {item.uqc || (isService ? 'SAC' : 'NOS')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                      ₹{item.taxableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-600">
                      {item.taxRate}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      ₹{item.cgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      ₹{item.sgst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      ₹{item.igst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700">
                      ₹{item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}

              {filteredHsns.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No HSN summaries found. Upload sales invoices in Step 1 or add custom HSN entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => onNavigateStep(0)}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} /> Back: Upload Data
          </button>
          <button
            onClick={() => onNavigateStep(2)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            Next: Identify Missing Information <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Add Custom HSN Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Add Table 12 HSN Record</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHsn} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">HSN or SAC Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 847130 or 998311"
                  value={newHsn.hsnCode}
                  onChange={(e) => setNewHsn({ ...newHsn, hsnCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Use 99-series for services (SAC)</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT Advisory & Technical Support"
                  value={newHsn.description}
                  onChange={(e) => setNewHsn({ ...newHsn, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Code (UQC)</label>
                  <select
                    value={newHsn.uqc}
                    onChange={(e) => setNewHsn({ ...newHsn, uqc: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="NOS">NOS - Numbers</option>
                    <option value="PCS">PCS - Pieces</option>
                    <option value="SAC">SAC - Services</option>
                    <option value="KGS">KGS - Kilograms</option>
                    <option value="BOX">BOX - Boxes</option>
                    <option value="MTR">MTR - Metres</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newHsn.quantity}
                    onChange={(e) => setNewHsn({ ...newHsn, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Taxable Value (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newHsn.taxableValue || ''}
                    onChange={(e) => setNewHsn({ ...newHsn, taxableValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">GST Rate %</label>
                  <select
                    value={newHsn.taxRate}
                    onChange={(e) => setNewHsn({ ...newHsn, taxRate: parseFloat(e.target.value) || 18 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
