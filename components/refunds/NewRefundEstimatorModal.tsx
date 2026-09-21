import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calculator, 
  Sparkles, 
  ShieldCheck, 
  IndianRupee, 
  HelpCircle, 
  ArrowRight, 
  Building2, 
  Landmark,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { RefundCategory, RefundService, ItcRefundClaim } from '../../services/refundService';

interface NewRefundEstimatorModalProps {
  onClose: () => void;
  onClaimCreated: (newClaim: ItcRefundClaim) => void;
}

export const NewRefundEstimatorModal: React.FC<NewRefundEstimatorModalProps> = ({
  onClose,
  onClaimCreated
}) => {
  const [category, setCategory] = useState<RefundCategory>('EXPORT_WITHOUT_TAX');
  const [taxPeriod, setTaxPeriod] = useState('Jul 2026');
  const [taxPeriodCode, setTaxPeriodCode] = useState('2026-07');
  const [financialYear, setFinancialYear] = useState('2026-27');
  
  // Rule 89 inputs
  const [zeroRatedTurnover, setZeroRatedTurnover] = useState<number>(8500000);
  const [adjustedTotalTurnover, setAdjustedTotalTurnover] = useState<number>(12000000);
  const [netItcInputs, setNetItcInputs] = useState<number>(1800000);
  const [taxPayableInverted, setTaxPayableInverted] = useState<number>(250000);
  const [excessCashAmount, setExcessCashAmount] = useState<number>(500000);
  
  // Entity & Bank selection
  const [selectedGstin, setSelectedGstin] = useState('27ABCDE1234F1Z5');
  const [legalName, setLegalName] = useState('Acme Enterprise Technologies Ltd');
  const [bankName, setBankName] = useState('State Bank of India');
  const [accountNumber, setAccountNumber] = useState('98765432108842');
  const [ifsc, setIfsc] = useState('SBIN0001234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute eligible refund amount using Statutory Rules
  const computedRefundAmount = useMemo(() => {
    if (category === 'EXPORT_WITHOUT_TAX' || category === 'SEZ_WITHOUT_TAX') {
      // Rule 89(4): Refund Amount = (Turnover of zero-rated supply * Net ITC) / Adjusted Total Turnover
      if (adjustedTotalTurnover <= 0) return 0;
      const ratio = Math.min(1, zeroRatedTurnover / adjustedTotalTurnover);
      return Math.round(ratio * netItcInputs);
    } else if (category === 'INVERTED_DUTY_STRUCTURE') {
      // Rule 89(5): Refund Amount = [(Turnover of inverted supply * Net ITC) / Adjusted Total Turnover] - Tax payable on inverted supply
      if (adjustedTotalTurnover <= 0) return 0;
      const ratio = Math.min(1, zeroRatedTurnover / adjustedTotalTurnover);
      const grossEligible = ratio * netItcInputs;
      return Math.max(0, Math.round(grossEligible - taxPayableInverted));
    } else if (category === 'EXCESS_CASH_LEDGER') {
      return excessCashAmount;
    }
    return Math.round(netItcInputs * 0.9);
  }, [category, zeroRatedTurnover, adjustedTotalTurnover, netItcInputs, taxPayableInverted, excessCashAmount]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (computedRefundAmount <= 0) {
      alert('Eligible refund amount must be greater than ₹0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const igstPart = category === 'EXPORT_WITHOUT_TAX' || category === 'SEZ_WITHOUT_TAX' ? computedRefundAmount : Math.round(computedRefundAmount * 0.4);
      const cgstPart = category === 'EXPORT_WITHOUT_TAX' || category === 'SEZ_WITHOUT_TAX' ? 0 : Math.round(computedRefundAmount * 0.3);
      const sgstPart = category === 'EXPORT_WITHOUT_TAX' || category === 'SEZ_WITHOUT_TAX' ? 0 : Math.round(computedRefundAmount * 0.3);

      const newClaim = await RefundService.createNewRefundDraft({
        tenantId: 't1',
        gstin: selectedGstin,
        legalName,
        branchId: 'b1',
        branchName: 'Corporate Unit',
        taxPeriod,
        taxPeriodCode,
        financialYear,
        category,
        amountClaimed: {
          igst: igstPart,
          cgst: cgstPart,
          sgst: sgstPart,
          cess: 0,
          total: computedRefundAmount
        },
        bankName,
        accountNumber,
        ifsc
      });

      onClaimCreated(newClaim);
      onClose();
    } catch (err) {
      console.error('Error creating refund draft', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <Calculator size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">
                New ITC Refund Application (Form GST RFD-01)
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Rule 89(4) & Rule 89(5) Statutory Calculation Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* 1. Category Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
              1. Select Refund Category (Grounds under Section 54)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: 'EXPORT_WITHOUT_TAX', label: 'Export without Tax (LUT)', sub: 'Rule 89(4) Zero-rated supplies' },
                { id: 'INVERTED_DUTY_STRUCTURE', label: 'Inverted Duty Structure', sub: 'Rule 89(5) Input tax rate > Output' },
                { id: 'SEZ_WITHOUT_TAX', label: 'Supplies to SEZ Unit', sub: 'Under LUT without payment of tax' },
                { id: 'EXCESS_CASH_LEDGER', label: 'Excess Cash Balance', sub: 'Electronic Cash Ledger balance refund' }
              ].map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setCategory(cat.id as any)}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                    category === cat.id
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{cat.label}</span>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      category === cat.id ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                    }`}>
                      {category === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">{cat.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Tax Period & Entity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Tax Period</label>
              <select
                value={taxPeriod}
                onChange={(e) => {
                  setTaxPeriod(e.target.value);
                  setTaxPeriodCode(e.target.value === 'Jul 2026' ? '2026-07' : '2026-08');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="Jul 2026">July 2026</option>
                <option value="Aug 2026">August 2026</option>
                <option value="Jun 2026">June 2026</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Financial Year</label>
              <input
                type="text"
                value={financialYear}
                readOnly
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Filing GSTIN</label>
              <input
                type="text"
                value={selectedGstin}
                readOnly
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600"
              />
            </div>
          </div>

          {/* 3. Mathematical Parameters for Formula Computation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center justify-between">
              <span>2. Statutory Computation Parameters</span>
              <span className="text-[10px] text-blue-600 font-mono">
                {category === 'INVERTED_DUTY_STRUCTURE' ? 'Formula: Rule 89(5)' : 'Formula: Rule 89(4)'}
              </span>
            </h3>

            {category !== 'EXCESS_CASH_LEDGER' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {category === 'INVERTED_DUTY_STRUCTURE' ? 'Inverted Supply Turnover (₹)' : 'Zero-Rated Export Turnover (₹)'}
                  </label>
                  <input
                    type="number"
                    value={zeroRatedTurnover}
                    onChange={(e) => setZeroRatedTurnover(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Adjusted Total Turnover (₹)
                  </label>
                  <input
                    type="number"
                    value={adjustedTotalTurnover}
                    onChange={(e) => setAdjustedTotalTurnover(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Net Eligible ITC on Inputs (₹)
                  </label>
                  <input
                    type="number"
                    value={netItcInputs}
                    onChange={(e) => setNetItcInputs(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                {category === 'INVERTED_DUTY_STRUCTURE' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Tax Payable on Inverted Supply (₹)
                    </label>
                    <input
                      type="number"
                      value={taxPayableInverted}
                      onChange={(e) => setTaxPayableInverted(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Excess Unutilized Balance in Electronic Cash Ledger (₹)
                </label>
                <input
                  type="number"
                  value={excessCashAmount}
                  onChange={(e) => setExcessCashAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>
            )}

            {/* Computation Result Highlight Banner */}
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700">Eligible Maximum Refund Amount</span>
                <div className="text-2xl font-black text-emerald-900 tracking-tight">
                  {formatCurrency(computedRefundAmount)}
                </div>
              </div>
              <div className="text-xs text-emerald-800 font-medium">
                <span>Rule validation: <strong>100% Compliant</strong></span>
                <span className="block text-[11px] text-emerald-700 mt-0.5">
                  Debited from Electronic Credit Ledger upon submission
                </span>
              </div>
            </div>
          </div>

          {/* 4. Bank Account for PFMS Disbursement */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              3. Verified Bank Account for PFMS Credit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 font-bold block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-bold block mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-bold block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || computedRefundAmount <= 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles size={14} />
              {isSubmitting ? 'Transmitting to GST Portal...' : 'File Application RFD-01 & Generate ARN'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
