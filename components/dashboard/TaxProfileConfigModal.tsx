import React, { useState } from 'react';
import { 
  TaxProfile, 
  TaxpayerClassification, 
  TurnoverBracket, 
  StateCategory 
} from '../../types/taxCompliance';
import { 
  getStateCategory, 
  STATE_NAMES_BY_CODE, 
  saveTaxProfile 
} from '../../services/taxComplianceService';
import { 
  Building2, Shield, Calendar, Bell, CheckCircle2, 
  AlertTriangle, Sparkles, X, Info, Zap, Globe, FileText, 
  Check, Sliders, Smartphone, Mail, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TaxProfileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  currentProfile: TaxProfile;
  companyName: string;
  onProfileUpdated: (newProfile: TaxProfile) => void;
}

export const TaxProfileConfigModal: React.FC<TaxProfileConfigModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  currentProfile,
  companyName,
  onProfileUpdated
}) => {
  const [formData, setFormData] = useState<TaxProfile>({ ...currentProfile });
  const [activeTab, setActiveTab] = useState<'CLASSIFICATION' | 'TURNOVER_STATE' | 'NOTIFICATIONS'>('CLASSIFICATION');
  const [saveToast, setSaveToast] = useState(false);

  if (!isOpen) return null;

  const currentCategory = getStateCategory(formData.stateCode);

  const handleStateChange = (newCode: string) => {
    const cat = getStateCategory(newCode);
    const sName = STATE_NAMES_BY_CODE[newCode] || 'State';
    setFormData(prev => ({
      ...prev,
      stateCode: newCode,
      stateName: sName,
      stateCategory: cat
    }));
  };

  const handleTurnoverChange = (bracket: TurnoverBracket) => {
    let est = 25000000;
    let einv = false;
    if (bracket === 'BELOW_1_5CR') {
      est = 12000000;
      einv = false;
    } else if (bracket === '1_5CR_TO_5CR') {
      est = 35000000;
      einv = false;
    } else if (bracket === '5CR_TO_50CR') {
      est = 180000000;
      einv = true;
    } else if (bracket === 'ABOVE_50CR') {
      est = 284000000;
      einv = true;
    }
    setFormData(prev => ({
      ...prev,
      turnoverBracket: bracket,
      annualTurnoverEstimate: est,
      isEInvoicingApplicable: einv
    }));
  };

  const applyPreset = (presetType: 'REGULAR_ENTERPRISE' | 'QRMP_SMALL_BIZ' | 'COMPOSITION_DEALER' | 'SEZ_TECH') => {
    if (presetType === 'REGULAR_ENTERPRISE') {
      setFormData(prev => ({
        ...prev,
        taxpayerType: 'REGULAR_MONTHLY',
        filingFrequency: 'MONTHLY',
        turnoverBracket: 'ABOVE_50CR',
        annualTurnoverEstimate: 284000000,
        isEInvoicingApplicable: true,
        isRcmApplicable: true,
        isSez: false,
        alertLeadDays: 7
      }));
    } else if (presetType === 'QRMP_SMALL_BIZ') {
      setFormData(prev => ({
        ...prev,
        taxpayerType: 'QRMP_QUARTERLY',
        filingFrequency: 'QUARTERLY',
        turnoverBracket: '1_5CR_TO_5CR',
        annualTurnoverEstimate: 32000000,
        isEInvoicingApplicable: false,
        isRcmApplicable: true,
        isSez: false,
        alertLeadDays: 5
      }));
    } else if (presetType === 'COMPOSITION_DEALER') {
      setFormData(prev => ({
        ...prev,
        taxpayerType: 'COMPOSITION',
        filingFrequency: 'QUARTERLY',
        turnoverBracket: 'BELOW_1_5CR',
        annualTurnoverEstimate: 8500000,
        isEInvoicingApplicable: false,
        isRcmApplicable: false,
        isSez: false,
        alertLeadDays: 5
      }));
    } else if (presetType === 'SEZ_TECH') {
      setFormData(prev => ({
        ...prev,
        taxpayerType: 'SEZ_UNIT',
        filingFrequency: 'MONTHLY',
        turnoverBracket: '5CR_TO_50CR',
        annualTurnoverEstimate: 95000000,
        isEInvoicingApplicable: true,
        isRcmApplicable: false,
        isSez: true,
        alertLeadDays: 7
      }));
    }
  };

  const handleSave = () => {
    saveTaxProfile(tenantId, formData);
    onProfileUpdated(formData);
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-inner">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Tax Profile & Compliance Calibrator</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {companyName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Calibrate GST registration rules, turnover thresholds, and statutory deadline triggers.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600" />
            Quick Presets:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPreset('REGULAR_ENTERPRISE')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
            >
              🏢 Regular Monthly (&gt; ₹50 Cr)
            </button>
            <button
              onClick={() => applyPreset('QRMP_SMALL_BIZ')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
            >
              📦 QRMP Quarterly (IFF/PMT-06)
            </button>
            <button
              onClick={() => applyPreset('COMPOSITION_DEALER')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors"
            >
              🏷️ Composition (CMP-08)
            </button>
            <button
              onClick={() => applyPreset('SEZ_TECH')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
            >
              🌐 SEZ Tech Unit
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('CLASSIFICATION')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'CLASSIFICATION'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Shield size={15} />
            1. Taxpayer Classification
          </button>
          <button
            onClick={() => setActiveTab('TURNOVER_STATE')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'TURNOVER_STATE'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 size={15} />
            2. Turnover & State Jurisdiction
          </button>
          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'NOTIFICATIONS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bell size={15} />
            3. Alert Lead Times & Dispatch
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* TAB 1: CLASSIFICATION */}
          {activeTab === 'CLASSIFICATION' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Select GST Taxpayer Scheme & Registration Type:
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Regular Monthly */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'REGULAR_MONTHLY', filingFrequency: 'MONTHLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'REGULAR_MONTHLY'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          M
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">Regular Taxpayer (Monthly)</h4>
                      </div>
                      {formData.taxpayerType === 'REGULAR_MONTHLY' && (
                        <CheckCircle2 size={18} className="text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                      Standard GST registration. Files <strong>GSTR-1 by 11th</strong> and <strong>GSTR-3B by 20th</strong> each month with full ITC reconciliation.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100/80 text-blue-800">
                        Monthly GSTR-1 (11th)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100/80 text-indigo-800">
                        Monthly GSTR-3B (20th)
                      </span>
                    </div>
                  </div>

                  {/* QRMP Quarterly */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'QRMP_QUARTERLY', filingFrequency: 'QUARTERLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'QRMP_QUARTERLY'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          Q
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">QRMP Scheme (Quarterly)</h4>
                      </div>
                      {formData.taxpayerType === 'QRMP_QUARTERLY' && (
                        <CheckCircle2 size={18} className="text-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                      Turnover up to ₹5 Cr. Optional <strong>IFF by 13th</strong>, <strong>PMT-06 by 25th</strong> in M1/M2, and Quarterly GSTR-1/3B (22nd or 24th).
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100/80 text-indigo-800">
                        IFF (13th M1/M2)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100/80 text-amber-800">
                        PMT-06 (25th M1/M2)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100/80 text-blue-800">
                        GSTR-3B (22nd/24th Qtr)
                      </span>
                    </div>
                  </div>

                  {/* Composition Scheme */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'COMPOSITION', filingFrequency: 'QUARTERLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'COMPOSITION'
                        ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                          C
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">Composition Scheme</h4>
                      </div>
                      {formData.taxpayerType === 'COMPOSITION' && (
                        <CheckCircle2 size={18} className="text-amber-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                      Turnover up to ₹1.5 Cr (goods) or ₹50 Lakhs (services). Files <strong>CMP-08 by 18th</strong> after quarter end and annual <strong>GSTR-4</strong>.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100/80 text-amber-800">
                        CMP-08 (18th of Qtr)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-800">
                        Annual GSTR-4 (Apr 30)
                      </span>
                    </div>
                  </div>

                  {/* SEZ Unit */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'SEZ_UNIT', isSez: true, filingFrequency: 'MONTHLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'SEZ_UNIT'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          SEZ
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">SEZ Developer / Unit</h4>
                      </div>
                      {formData.taxpayerType === 'SEZ_UNIT' && (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">
                      Zero-rated supplies with/without payment of IGST under LUT/Bond. Monthly GSTR-1 and GSTR-3B filings.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100/80 text-emerald-800">
                        Zero-Rated LUT
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100/80 text-blue-800">
                        Monthly 1 & 3B
                      </span>
                    </div>
                  </div>

                  {/* ISD */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'ISD', filingFrequency: 'MONTHLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'ISD'
                        ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                          ISD
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">Input Service Distributor (ISD)</h4>
                      </div>
                      {formData.taxpayerType === 'ISD' && (
                        <CheckCircle2 size={18} className="text-purple-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Distributes input tax credit on common service invoices to manufacturing and sales branches. <strong>GSTR-6 due by 13th</strong>.
                    </p>
                  </div>

                  {/* TDS / TCS */}
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, taxpayerType: 'TDS_TCS', filingFrequency: 'MONTHLY' }))}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      formData.taxpayerType === 'TDS_TCS'
                        ? 'border-cyan-600 bg-cyan-50/60 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs">
                          TDS
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">Tax Deductor / E-Commerce (TCS)</h4>
                      </div>
                      {formData.taxpayerType === 'TDS_TCS' && (
                        <CheckCircle2 size={18} className="text-cyan-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Deducts TDS under Sec 51 or collects TCS under Sec 52. <strong>GSTR-7 / GSTR-8 due by 10th</strong> of the following month.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TURNOVER & STATE */}
          {activeTab === 'TURNOVER_STATE' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Turnover Brackets */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Annual Aggregate Turnover Bracket:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    onClick={() => handleTurnoverChange('BELOW_1_5CR')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.turnoverBracket === 'BELOW_1_5CR'
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>Under ₹1.5 Crore</span>
                      {formData.turnoverBracket === 'BELOW_1_5CR' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <span className="text-xs text-slate-500 block mt-1">Eligible for Composition & QRMP schemes</span>
                  </div>

                  <div 
                    onClick={() => handleTurnoverChange('1_5CR_TO_5CR')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.turnoverBracket === '1_5CR_TO_5CR'
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>₹1.5 Cr to ₹5.0 Crore</span>
                      {formData.turnoverBracket === '1_5CR_TO_5CR' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <span className="text-xs text-slate-500 block mt-1">Eligible for QRMP; GSTR-9 annual return optional</span>
                  </div>

                  <div 
                    onClick={() => handleTurnoverChange('5CR_TO_50CR')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.turnoverBracket === '5CR_TO_50CR'
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>₹5.0 Cr to ₹50.0 Crore</span>
                      {formData.turnoverBracket === '5CR_TO_50CR' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <span className="text-xs text-blue-700 font-medium block mt-1">⚡ Mandatory E-Invoicing & GSTR-9/9C Audit</span>
                  </div>

                  <div 
                    onClick={() => handleTurnoverChange('ABOVE_50CR')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.turnoverBracket === 'ABOVE_50CR'
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                      <span>Above ₹50.0 Crore (Large Enterprise)</span>
                      {formData.turnoverBracket === 'ABOVE_50CR' && <Check size={16} className="text-blue-600" />}
                    </div>
                    <span className="text-xs text-blue-700 font-medium block mt-1">⚡ Mandatory E-Invoicing, GSTR-9C, HSN 6-digit</span>
                  </div>
                </div>
              </div>

              {/* State Selection with Category 1 vs Category 2 Explanation */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Principal Registered State:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <select
                      value={formData.stateCode}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    >
                      {Object.entries(STATE_NAMES_BY_CODE).map(([code, name]) => (
                        <option key={code} value={code}>
                          [{code}] {name} ({getStateCategory(code) === 'CATEGORY_1' ? 'Category 1' : 'Category 2'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${
                    currentCategory === 'CATEGORY_1'
                      ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                      : 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Globe size={14} />
                      <span>{currentCategory === 'CATEGORY_1' ? 'Category 1 State Jurisdiction' : 'Category 2 State Jurisdiction'}</span>
                    </div>
                    <p className="text-[11px] mt-1 opacity-90">
                      {currentCategory === 'CATEGORY_1' 
                        ? 'QRMP GSTR-3B statutory due date is 22nd of the month following the quarter.' 
                        : 'QRMP GSTR-3B statutory due date is 24th of the month following the quarter.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Compliance Flags */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Applicable GST Modules:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input 
                      type="checkbox"
                      checked={formData.isEInvoicingApplicable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isEInvoicingApplicable: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>E-Invoicing Real-Time (IRN)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input 
                      type="checkbox"
                      checked={formData.isRcmApplicable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isRcmApplicable: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Reverse Charge (RCM)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input 
                      type="checkbox"
                      checked={formData.isSez}
                      onChange={(e) => setFormData(prev => ({ ...prev, isSez: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>SEZ Special Economic Unit</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  Statutory Alert Advance Notice Window:
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[3, 5, 7, 10].map(days => (
                    <button
                      key={days}
                      onClick={() => setFormData(prev => ({ ...prev, alertLeadDays: days }))}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        formData.alertLeadDays === days
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg block font-extrabold">{days}</span>
                      <span className="text-[11px]">Days Ahead</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  TaxFlow will surface high-priority alert cards on the dashboard and trigger reminders {formData.alertLeadDays} days before statutory due dates.
                </p>
              </div>

              {/* Channel Toggles */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Active Notification Channels:
                </label>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <Bell size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Browser Push Notifications</span>
                        <span className="text-[11px] text-slate-500">Instant desktop alerts for 48h deadline countdowns</span>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={formData.enableBrowserPush}
                      onChange={(e) => setFormData(prev => ({ ...prev, enableBrowserPush: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Smartphone size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">WhatsApp Compliance Reminders</span>
                        <span className="text-[11px] text-slate-500">Automated summary dispatch to finance team and CFO</span>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={formData.enableWhatsAppReminders}
                      onChange={(e) => setFormData(prev => ({ ...prev, enableWhatsAppReminders: e.target.checked }))}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Mail size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Daily Email Compliance Digest</span>
                        <span className="text-[11px] text-slate-500">Scheduled morning briefing of overdue items & ITC risk</span>
                      </div>
                    </div>
                    <input 
                      type="checkbox"
                      checked={formData.enableEmailReminders}
                      onChange={(e) => setFormData(prev => ({ ...prev, enableEmailReminders: e.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Active Scheme: <span className="font-bold text-slate-800">{formData.taxpayerType.replace(/_/g, ' ')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {saveToast ? (
                <>
                  <CheckCircle2 size={16} className="text-white" />
                  <span>Profile Applied!</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>Recalculate & Save Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
