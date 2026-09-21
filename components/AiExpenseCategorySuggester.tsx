import React, { useState, useEffect } from 'react';
import { Sparkles, Check, AlertCircle, ArrowRight, ShieldCheck, Tag, Building2, BookOpen, Layers, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { ExpenseCategorySuggestion } from '../types';
import { suggestExpenseCategory } from '../services/api';

export const STANDARD_EXPENSE_CATEGORIES = [
  'Office Supplies',
  'Professional Fees',
  'IT & Software Services',
  'Travel & Conveyance',
  'Rent & Real Estate',
  'Advertising & Marketing',
  'Logistics & Freight',
  'Repairs & Maintenance',
  'Raw Materials & Direct Costs',
  'Utilities & Communication',
  'Employee Welfare & Perks',
  'Legal & Statutory Compliance',
  'Financial & Bank Charges',
  'Other Operating Expenses'
] as const;

interface AiExpenseCategorySuggesterProps {
  vendorName: string;
  items: Array<{ description: string; hsnSac?: string; amount?: number; quantity?: number; rate?: number; taxRate?: number }>;
  totalAmount?: number;
  gstin?: string;
  invoiceCategory?: string;
  selectedCategory?: string;
  selectedGlCode?: string;
  onApplyCategory: (suggestion: ExpenseCategorySuggestion) => void;
  onSelectCategoryManual?: (category: string) => void;
}

export const AiExpenseCategorySuggester: React.FC<AiExpenseCategorySuggesterProps> = ({
  vendorName,
  items,
  totalAmount = 0,
  gstin = '',
  invoiceCategory = 'PURCHASE',
  selectedCategory = '',
  selectedGlCode = '',
  onApplyCategory,
  onSelectCategoryManual
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<ExpenseCategorySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [applied, setApplied] = useState(false);

  // Debounced auto-fetch or manual trigger
  const handleFetchSuggestion = async (isManual = true) => {
    const itemDesc = items.map(i => i.description).filter(Boolean).join(', ');
    if (!vendorName.trim() && !itemDesc.trim()) {
      if (isManual) {
        setError('Please enter a Vendor Name or Item Description first.');
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setApplied(false);

    try {
      const res = await suggestExpenseCategory({
        vendorName: vendorName.trim(),
        itemDescription: itemDesc,
        items,
        totalAmount,
        gstin,
        invoiceCategory
      });
      setSuggestion(res);
      setIsExpanded(true);
    } catch (err: any) {
      console.error('Failed to get AI expense category:', err);
      setError('Could not complete AI classification. Please select category manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion) return;
    onApplyCategory(suggestion);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const getCategoryColor = (catName: string) => {
    switch (catName) {
      case 'Office Supplies':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Professional Fees':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'IT & Software Services':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Travel & Conveyance':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Rent & Real Estate':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Advertising & Marketing':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Logistics & Freight':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'Repairs & Maintenance':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Employee Welfare & Perks':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'Raw Materials & Direct Costs':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Utilities & Communication':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const hasInputs = Boolean(vendorName.trim() || items.some(i => i.description?.trim()));

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 border border-blue-100/80 rounded-2xl p-4.5 space-y-3.5 transition-all">
      {/* Header & Quick Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Sparkles size={16} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                AI Expense Categorizer & GL Mapping
              </h4>
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-700 rounded-md">
                Gemini 3.8
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Auto-classifies expenses into accounting GL accounts & validates Section 17(5) ITC rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleFetchSuggestion(true)}
            disabled={isLoading || !hasInputs}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm shadow-blue-600/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Analyzing Patterns...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Suggest Category</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggestion Card when loaded */}
      {suggestion && (
        <div className="bg-white border border-blue-100/80 rounded-xl p-4 space-y-3.5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Suggested Category:</span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getCategoryColor(suggestion.suggestedCategory)}`}>
                  {suggestion.suggestedCategory}
                </span>
                {suggestion.subCategory && (
                  <span className="text-xs text-slate-500 font-medium italic">
                    ({suggestion.subCategory})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                  {suggestion.glCode}
                </span>
                {suggestion.costCenter && (
                  <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-50 text-slate-600 rounded border border-slate-200 flex items-center gap-1">
                    <Building2 size={11} className="text-slate-400" /> {suggestion.costCenter}
                  </span>
                )}
                <span className="text-[11px] font-bold text-slate-600">
                  Confidence: <span className="text-blue-600">{suggestion.confidence}%</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApply}
                className={`inline-flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-lg transition-all shadow-sm ${
                  applied
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 cursor-pointer'
                }`}
              >
                {applied ? (
                  <>
                    <Check size={14} /> Applied!
                  </>
                ) : (
                  <>
                    <Check size={14} /> Apply AI Recommendation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Reasoning & ITC Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <BookOpen size={11} /> AI Classification Justification
              </span>
              <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                "{suggestion.reasoning}"
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ShieldCheck size={11} /> GST & ITC Compliance Treatment
              </span>
              <div
                className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                  suggestion.itcEligibility === 'BLOCKED_17_5'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : suggestion.itcEligibility === 'CONDITIONAL'
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  {suggestion.itcEligibility === 'BLOCKED_17_5' && (
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-extrabold text-[10px]">
                      BLOCKED ITC (Sec 17(5))
                    </span>
                  )}
                  {suggestion.itcEligibility === 'ELIGIBLE' && (
                    <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-extrabold text-[10px]">
                      100% ELIGIBLE ITC (Sec 16)
                    </span>
                  )}
                  {suggestion.itcEligibility === 'CONDITIONAL' && (
                    <span className="px-1.5 py-0.2 bg-blue-200 text-blue-900 rounded font-extrabold text-[10px]">
                      CONDITIONAL ITC
                    </span>
                  )}
                  {suggestion.suggestedHsnSac && (
                    <span className="text-[11px] text-slate-600 font-mono font-medium">
                      SAC/HSN: {suggestion.suggestedHsnSac} ({suggestion.suggestedGstRate || 18}%)
                    </span>
                  )}
                </div>
                <p className="text-[11px]">{suggestion.itcReasoning || 'Valid for business deduction and ITC reconciliation.'}</p>
              </div>
            </div>
          </div>

          {/* Tags & Item Breakdowns Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag size={11} className="text-slate-400" />
              <span className="text-[11px] text-slate-400 font-bold">Suggested Tags:</span>
              {suggestion.suggestedTags?.map(tag => (
                <span key={tag} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>

            {suggestion.itemBreakdowns && suggestion.itemBreakdowns.length > 1 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Layers size={11} />
                <span>{suggestion.itemBreakdowns.length} Line Item Mappings</span>
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>

          {/* Detailed item breakdown if multiple */}
          {isExpanded && suggestion.itemBreakdowns && suggestion.itemBreakdowns.length > 1 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Individual Line Item Classification Breakdown
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {suggestion.itemBreakdowns.map((ib, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs border border-slate-100">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">
                      {ib.itemDescription}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                        {ib.suggestedCategory}
                      </span>
                      {ib.hsnSac && (
                        <span className="font-mono text-[10px] text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200">
                          {ib.hsnSac}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-bold">
                        {ib.confidence}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Selection Fallback & Current Selection status */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Selected Category:</span>
          {selectedCategory ? (
            <span className={`px-2 py-0.5 rounded font-bold border ${getCategoryColor(selectedCategory)}`}>
              {selectedCategory}
            </span>
          ) : (
            <span className="text-slate-400 italic">None selected</span>
          )}
          {selectedGlCode && (
            <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
              {selectedGlCode}
            </span>
          )}
        </div>

        {onSelectCategoryManual && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Override / Change:</span>
            <select
              value={selectedCategory}
              onChange={(e) => onSelectCategoryManual(e.target.value)}
              className="h-7 px-2 bg-white border border-slate-200 rounded text-xs text-slate-800 outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="">Select Expense Category...</option>
              {STANDARD_EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
