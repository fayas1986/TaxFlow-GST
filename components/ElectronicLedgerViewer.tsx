import React, { useState } from 'react';
import { 
  Wallet, Landmark, Plus, RefreshCw, AlertTriangle, ArrowRight,
  TrendingUp, TrendingDown, Info, Save, FileText, CheckCircle2,
  Archive, Download, ShieldCheck
} from 'lucide-react';
import { AutomatedLedgerExportModule } from './AutomatedLedgerExportModule';

interface LedgerBalance {
  cgst: { tax: number; interest: number; penalty: number; fee: number; other: number; };
  sgst: { tax: number; interest: number; penalty: number; fee: number; other: number; };
  igst: { tax: number; interest: number; penalty: number; fee: number; other: number; };
  cess: { tax: number; interest: number; penalty: number; fee: number; other: number; };
}

const initialCashLedger: LedgerBalance = {
  cgst: { tax: 15400, interest: 0, penalty: 0, fee: 50, other: 0 },
  sgst: { tax: 15400, interest: 0, penalty: 0, fee: 50, other: 0 },
  igst: { tax: 120500, interest: 0, penalty: 0, fee: 0, other: 0 },
  cess: { tax: 0, interest: 0, penalty: 0, fee: 0, other: 0 },
};

const initialCreditLedger: LedgerBalance = {
  cgst: { tax: 450000, interest: 0, penalty: 0, fee: 0, other: 0 },
  sgst: { tax: 450000, interest: 0, penalty: 0, fee: 0, other: 0 },
  igst: { tax: 1250000, interest: 0, penalty: 0, fee: 0, other: 0 },
  cess: { tax: 50000, interest: 0, penalty: 0, fee: 0, other: 0 },
};

export const ElectronicLedgerViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CASH' | 'CREDIT' | 'LIABILITY' | 'ADJUST' | 'ARCHIVE'>('CASH');
  const [cashLedger, setCashLedger] = useState<LedgerBalance>(initialCashLedger);
  const [creditLedger, setCreditLedger] = useState<LedgerBalance>(initialCreditLedger);

  const [adjustmentForm, setAdjustmentForm] = useState({
    ledger: 'CASH',
    head: 'CGST',
    minorHead: 'INTEREST',
    amount: '',
    reason: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    setTimeout(() => {
      // Apply optimistic update for Demo purposes
      if (adjustmentForm.ledger === 'CASH') {
        const newLedger = { ...cashLedger };
        const head = adjustmentForm.head.toLowerCase() as keyof LedgerBalance;
        const minor = adjustmentForm.minorHead.toLowerCase() as keyof LedgerBalance['cgst'];
        const amt = Number(adjustmentForm.amount);
        if (newLedger[head] && newLedger[head][minor] !== undefined) {
          newLedger[head][minor] += amt;
        }
        setCashLedger(newLedger);
      }
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setAdjustmentForm({ ...adjustmentForm, amount: '', reason: '' });
    }, 800);
  };

  const calculateTotal = (ledger: LedgerBalance, head: keyof LedgerBalance) => {
    return Object.values(ledger[head]).reduce((sum, val) => sum + val, 0);
  };

  const calculateGrandTotal = (ledger: LedgerBalance) => {
    return (
      calculateTotal(ledger, 'cgst') +
      calculateTotal(ledger, 'sgst') +
      calculateTotal(ledger, 'igst') +
      calculateTotal(ledger, 'cess')
    );
  };

  const renderLedgerTable = (ledger: LedgerBalance, title: string) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          {title === 'Cash' ? <Wallet className="text-emerald-600" size={18} /> : <Landmark className="text-blue-600" size={18} />}
          Electronic {title} Ledger Balance
        </h3>
        <span className="text-xl font-black text-slate-800">{formatCurrency(calculateGrandTotal(ledger))}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">Major Head</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right">Tax</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right">Interest</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right">Penalty</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right">Fee</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right">Others</th>
              <th className="p-3 font-bold border-b border-slate-200 uppercase text-xs tracking-wider text-right bg-slate-50">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(['igst', 'cgst', 'sgst', 'cess'] as const).map(head => (
              <tr key={head} className="hover:bg-slate-50">
                <td className="p-3 font-black text-slate-700 uppercase">{head}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(ledger[head].tax)}</td>
                <td className="p-3 text-right font-mono text-amber-600">{formatCurrency(ledger[head].interest)}</td>
                <td className="p-3 text-right font-mono text-rose-600">{formatCurrency(ledger[head].penalty)}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(ledger[head].fee)}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(ledger[head].other)}</td>
                <td className="p-3 text-right font-mono font-bold bg-slate-50">{formatCurrency(calculateTotal(ledger, head))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Landmark className="text-indigo-600" />
            GST Portal Ledgers
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Real-time synchronization with GSTN Electronic Cash, Credit, and Liability ledgers.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('ARCHIVE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              activeTab === 'ARCHIVE'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Archive size={16} /> Monthly Compliance Archive
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors">
            <RefreshCw size={16} /> Sync with GSTN
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
        {[
          { id: 'CASH', label: 'Electronic Cash Ledger' },
          { id: 'CREDIT', label: 'Electronic Credit Ledger' },
          { id: 'LIABILITY', label: 'Liability Register' },
          { id: 'ADJUST', label: 'Post Adjustments (Interest/Penalty)' },
          { id: 'ARCHIVE', label: 'Compliance Archiving & Export' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white shadow-sm text-indigo-600 border border-slate-200/50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'CASH' && renderLedgerTable(cashLedger, 'Cash')}
        {activeTab === 'CREDIT' && renderLedgerTable(creditLedger, 'Credit')}
        
        {activeTab === 'LIABILITY' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-800">
            <AlertTriangle size={32} className="mx-auto mb-3 opacity-80" />
            <h3 className="font-bold text-lg">Electronic Liability Register</h3>
            <p className="text-sm mt-2 max-w-md mx-auto">
              Your liability register is currently matching with GSTR-3B filings. Any delayed filings will automatically reflect interest calculations here post-sync.
            </p>
          </div>
        )}

        {activeTab === 'ADJUST' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <form onSubmit={handleAdjustmentSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-4">
                <Plus className="text-indigo-600" size={20} />
                <h3 className="font-black text-slate-800">Post Manual Adjustment</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Ledger</label>
                  <select 
                    value={adjustmentForm.ledger}
                    onChange={e => setAdjustmentForm({...adjustmentForm, ledger: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value="CASH">Cash Ledger</option>
                    <option value="CREDIT">Credit Ledger</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Major Head</label>
                  <select 
                    value={adjustmentForm.head}
                    onChange={e => setAdjustmentForm({...adjustmentForm, head: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value="IGST">IGST</option>
                    <option value="CGST">CGST</option>
                    <option value="SGST">SGST</option>
                    <option value="CESS">CESS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Minor Head</label>
                  <select 
                    value={adjustmentForm.minorHead}
                    onChange={e => setAdjustmentForm({...adjustmentForm, minorHead: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value="TAX">Tax</option>
                    <option value="INTEREST">Interest</option>
                    <option value="PENALTY">Penalty</option>
                    <option value="FEE">Fee</option>
                    <option value="OTHER">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                  <input 
                    type="number"
                    required
                    value={adjustmentForm.amount}
                    onChange={e => setAdjustmentForm({...adjustmentForm, amount: e.target.value})}
                    placeholder="e.g. 1500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Reference Document</label>
                <textarea 
                  required
                  value={adjustmentForm.reason}
                  onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                  rows={2}
                  placeholder="e.g. Voluntary payment of interest for delayed filing of GSTR-3B for Mar-26"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Processing via DRC-03...' : 'Submit Adjustment (DRC-03 / PMT-09)'}
              </button>

              {showSuccess && (
                <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-bold animate-in fade-in">
                  <CheckCircle2 size={16} /> Adjustment posted successfully
                </div>
              )}
            </form>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4">
                <FileText size={18} className="text-slate-500" />
                Recent Ledger Adjustments
              </h3>
              <div className="space-y-3">
                {[
                  { date: '25 Aug 2026', type: 'PMT-09', desc: 'Transfer CGST Tax to SGST Tax', amount: '₹ 15,000' },
                  { date: '10 Aug 2026', type: 'DRC-03', desc: 'Interest payment for delayed GSTR-3B', amount: '₹ 1,250' }
                ].map((adj, i) => (
                  <div key={i} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded text-slate-600">{adj.type}</span>
                        <span className="text-xs font-bold text-slate-800">{adj.desc}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">{adj.date}</p>
                    </div>
                    <span className="font-mono text-sm font-black text-slate-700">{adj.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ARCHIVE' && (
          <div className="animate-in fade-in duration-200">
            <AutomatedLedgerExportModule />
          </div>
        )}
      </div>
    </div>
  );
};
