import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { fetchTaxComputation, fetchAiRiskReport, validateHsn, fetchInvoices } from '../services/api';
import { HSN_DIRECTORY } from '../data/hsnData';
import { 
  Calculator, IndianRupee, Percent, ArrowRight, ShieldAlert, 
  Search, CheckCircle2, XCircle, TrendingDown, Clock, AlertTriangle, Lightbulb,
  FileText, BrainCircuit, Table2, Info, Lock, RefreshCw, Tag, Filter, FileBarChart, Download,
  Sliders, Sparkles, TrendingUp, Globe, Scale, Wallet
} from 'lucide-react';
import TaxSummaryModal from '../components/TaxSummaryModal';
import NetLiabilityCalculator from '../components/NetLiabilityCalculator';
import WhatIfSimulationTool from '../components/WhatIfSimulationTool';
import { TaxPenaltyEstimator } from '../components/TaxPenaltyEstimator';
import { generateGstSummaryPdf } from '../utils/pdfReportGenerator';
import { TaxLiabilityOverview } from '../components/TaxLiabilityOverview';
import { RcmCalculator } from '../components/RcmCalculator';
import { FutureTaxLiabilityEstimator } from '../components/FutureTaxLiabilityEstimator';
import { ProactiveTaxAlerts } from '../components/ProactiveTaxAlerts';
import { CurrencyConverterModule } from '../components/CurrencyConverterModule';
import { MultiTierTaxEngineModule } from '../components/MultiTierTaxEngineModule';

import { ElectronicLedgerViewer } from '../components/ElectronicLedgerViewer';
import { AutomatedGstFilingWizard } from '../components/AutomatedGstFilingWizard';

const Computation: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const tenantId = user?.currentTenantId || 't1';
  const [activeTab, setActiveTab] = useState<'STATUTORY_ENGINE' | 'LIABILITY' | 'ESTIMATOR' | 'SIMULATOR' | 'MAPPING' | 'AI_RISK' | 'TOOLS' | 'LEDGER'>('STATUTORY_ENGINE');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isFilingWizardOpen, setIsFilingWizardOpen] = useState(false);
  const [period] = useState('July 2026');

  const { data: taxData, isLoading: isTaxLoading, refetch } = useQuery({ 
      queryKey: ['taxComputation', tenantId, selectedGstin, selectedBranchId], 
      queryFn: () => fetchTaxComputation(tenantId, selectedGstin, selectedBranchId) 
  });

  const { data: invoices = [] } = useQuery({
      queryKey: ['invoicesForEngine', tenantId, selectedGstin, selectedBranchId],
      queryFn: () => fetchInvoices(tenantId, selectedGstin, selectedBranchId)
  });

  const { data: aiRisks, isLoading: isRiskLoading, refetch: refetchAiRisks } = useQuery({ 
      queryKey: ['aiRisks', tenantId], 
      queryFn: () => fetchAiRiskReport(tenantId),
      enabled: false // Only run on demand for "scaling" demonstration
  });

  const handleRunAiAnalysis = () => {
    refetchAiRisks();
  };

  // Tools State
  const [activeToolSubTab, setActiveToolSubTab] = useState<'HSN' | 'RCM' | 'PENALTY'>('RCM');
  const [hsnInput, setHsnInput] = useState('');
  const [hsnResult, setHsnResult] = useState<{ isValid: boolean; description?: string; rate?: number } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hsnSearch, setHsnSearch] = useState('');
  const [hsnCategoryFilter, setHsnCategoryFilter] = useState<'ALL' | 'GOODS' | 'SERVICES'>('ALL');

  const handleValidateHsn = async () => {
    if (!hsnInput) return;
    setIsValidating(true);
    const res = await validateHsn(hsnInput);
    setHsnResult(res);
    setIsValidating(false);
  };

  const filteredHsn = useMemo(() => {
    return HSN_DIRECTORY.filter(item => {
      const matchesSearch = 
        item.code.toLowerCase().includes(hsnSearch.toLowerCase()) || 
        item.description.toLowerCase().includes(hsnSearch.toLowerCase());
      const matchesCategory = hsnCategoryFilter === 'ALL' || item.category === hsnCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [hsnSearch, hsnCategoryFilter]);

  const TaxCard = ({ title, amount, color }: { title: string, amount: number, color: string }) => (
      <div className={`p-4 rounded-xl border flex flex-col justify-between h-full bg-white ${color}`}>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{title}</p>
          <p className="text-xl font-bold mt-1">₹ {amount.toLocaleString()}</p>
      </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Header Bar: Title & GSTIN Scope on Left, Primary Actions on Right */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tax Computation Engine</h2>
            {selectedGstin !== 'ALL' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-bold font-mono shadow-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                GSTIN: {selectedGstin}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-xs">
                All Registrations (Consolidated)
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl leading-relaxed">
            {selectedGstin === 'ALL' 
              ? 'Consolidated statutory liability, compliance rule mapping, and ITC set-off across all GST registrations.' 
              : `Scoped computation and tax position for GSTIN registration ${selectedGstin}.`}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full lg:w-auto shrink-0 no-print">
          <button 
            onClick={() => setIsFilingWizardOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer whitespace-nowrap"
            title="Launch Official Automated GST Filing Wizard"
          >
            <Sparkles size={16} className="text-blue-100" />
            <span>Automated GST Filing</span>
          </button>

          <button 
            onClick={() => setIsSummaryModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
            title="View Tax Position Summary"
          >
            <FileBarChart size={16} className="text-slate-500" />
            <span>Tax Summary</span>
          </button>

          <button 
            onClick={() => {
              if (taxData) {
                const currentTenant = user?.availableTenants.find(t => t.id === tenantId);
                generateGstSummaryPdf(taxData, period, currentTenant);
              }
            }}
            disabled={!taxData || isTaxLoading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title="Download Consolidated Monthly GST Summary Report as PDF"
          >
            <Download size={16} className="text-emerald-100" />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs Bar - Dedicated Full-Width Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-xs overflow-x-auto">
        <nav className="flex items-center gap-1.5 min-w-max" aria-label="Tax Engine Modules">
          {[
            { id: 'STATUTORY_ENGINE', label: 'Multi-Tier Statutory Engine', icon: Scale },
            { id: 'LIABILITY', label: 'Liability & ITC Summary', icon: Calculator },
            { id: 'LEDGER', label: 'Cash & Credit Ledger', icon: Wallet },
            { id: 'ESTIMATOR', label: 'Quarterly Estimator', icon: TrendingUp },
            { id: 'SIMULATOR', label: "'What-If' Simulation", icon: Sliders },
            { id: 'MAPPING', label: 'GSTR Mapping', icon: Table2 },
            { id: 'AI_RISK', label: 'AI Risk Check', icon: BrainCircuit },
            { id: 'TOOLS', label: 'Tax Tools', icon: Search },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xs font-black' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <tab.icon size={15} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <TaxSummaryModal 
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        data={taxData}
        period={period}
      />

      {activeTab === 'STATUTORY_ENGINE' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <MultiTierTaxEngineModule
            invoices={invoices}
            currentTenantGstin={selectedGstin !== 'ALL' ? selectedGstin : '27ABCDE1234F1Z5'}
            onApplyToDraftFiling={() => setIsSummaryModalOpen(true)}
          />
        </div>
      )}

      {activeTab === 'LIABILITY' && taxData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <ProactiveTaxAlerts tenantId={tenantId} period={period} />
              
              {/* Automated Net Liability Calculator from Reconciled Invoices & Pending Credits */}
              <NetLiabilityCalculator 
                tenantId={tenantId} 
                period={period} 
                onApplyTo3B={() => setIsSummaryModalOpen(true)} 
              />

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Net Payable Card - Aligned with Light Theme */}
                  <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
                        <Calculator size={120} className="text-indigo-600"/>
                      </div>
                      
                      <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4">
                              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                                  <Calculator size={24}/>
                              </div>
                              <div>
                                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Net Payable (Estimate)</p>
                                  <p className="text-xs text-slate-400">Projected cash outflow</p>
                              </div>
                          </div>
                          
                          <p className="text-4xl font-bold text-slate-800 tracking-tight mt-2">
                              ₹ {(taxData.netPayable.igst + taxData.netPayable.cgst + taxData.netPayable.sgst + taxData.netPayable.utgst + taxData.netPayable.cess).toLocaleString()}
                          </p>
                          
                          <div className="mt-6 flex gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 font-bold">
                                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> Cash Required
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 font-bold">
                                  <CheckCircle2 size={12}/> ITC Adjusted
                              </span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-700">Output Liability</h3>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">Sales + RCM</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <TaxCard title="IGST" amount={taxData.outputLiability.igst + taxData.rcmLiability.igst} color="border-blue-100 text-blue-800"/>
                          <TaxCard title="CGST" amount={taxData.outputLiability.cgst + taxData.rcmLiability.cgst} color="border-blue-100 text-blue-800"/>
                          <TaxCard title="SGST" amount={taxData.outputLiability.sgst + taxData.rcmLiability.sgst} color="border-blue-100 text-blue-800"/>
                          <TaxCard title="UTGST" amount={taxData.outputLiability.utgst + taxData.rcmLiability.utgst} color="border-purple-100 text-purple-800"/>
                      </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-700">Input Tax Credit</h3>
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-bold">Eligible</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <TaxCard title="IGST" amount={taxData.inputTaxCredit.igst} color="border-green-100 text-green-800"/>
                          <TaxCard title="CGST" amount={taxData.inputTaxCredit.cgst} color="border-green-100 text-green-800"/>
                          <TaxCard title="SGST" amount={taxData.inputTaxCredit.sgst} color="border-green-100 text-green-800"/>
                          <TaxCard title="Blocked" amount={taxData.inputTaxCredit.blocked} color="border-red-100 text-red-800"/>
                      </div>
                  </div>
              </div>

              {/* Tax Liability Recharts Visualizer */}
              <TaxLiabilityOverview data={taxData} period={period} />

              {/* Advanced Logic Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Set-off Rules */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Lightbulb size={20} className="text-yellow-500"/> ITC Optimization Rules
                      </h3>
                      <div className="space-y-4 text-sm">
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <span className="font-bold text-slate-700 w-16">Step 1</span>
                              <p className="text-slate-600">IGST Credit is used to pay <span className="font-bold text-blue-600">IGST</span> liability first.</p>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <span className="font-bold text-slate-700 w-16">Step 2</span>
                              <p className="text-slate-600">Remaining IGST Credit is used for <span className="font-bold text-blue-600">CGST</span> then <span className="font-bold text-blue-600">SGST/UTGST</span>.</p>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <span className="font-bold text-slate-700 w-16">Step 3</span>
                              <p className="text-slate-600">CGST Credit cannot be used for SGST/UTGST and vice versa.</p>
                          </div>
                      </div>
                  </div>

                  {/* RCM Analysis */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <ShieldAlert size={20} className="text-amber-500"/> RCM Analysis
                      </h3>
                      <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 border-b border-slate-100">
                              <span className="text-sm text-slate-600">RCM Liability Added</span>
                              <span className="font-bold text-amber-600">+ ₹{(taxData.rcmLiability.igst + taxData.rcmLiability.cgst + taxData.rcmLiability.sgst).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 border-b border-slate-100">
                              <span className="text-sm text-slate-600">ITC Claimed (Contra)</span>
                              <span className="font-bold text-green-600">- ₹{(taxData.rcmLiability.igst + taxData.rcmLiability.cgst + taxData.rcmLiability.sgst).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                              <span className="text-sm font-bold text-amber-800">Net Cash Impact</span>
                              <span className="font-bold text-amber-800">₹ 0 (Neutral)</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">* RCM must be paid in cash ledger, then claimed as credit.</p>
                      </div>
                  </div>
              </div>

              {/* Banner CTA to launch What-If Simulation Tool */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-400 text-slate-950 rounded-2xl font-black shrink-0">
                    <Sliders size={24} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white flex items-center gap-2">
                      'What-if' GST Liability & Credit Simulator
                      <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">Interactive</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Adjust sales volume forecasts, Section 17(5) blocked ITC reversals, and vendor 2B mismatch risks to project real-time net cash outflows before filing GSTR-3B.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('SIMULATOR')}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2 active:scale-95"
                >
                  <Sparkles size={16} /> Open 'What-If' Simulator
                </button>
              </div>
          </div>
      )}

      {activeTab === 'LEDGER' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
              <ElectronicLedgerViewer />
          </div>
      )}

      {activeTab === 'ESTIMATOR' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
              <FutureTaxLiabilityEstimator tenantId={tenantId} />
          </div>
      )}

      {activeTab === 'SIMULATOR' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
              <WhatIfSimulationTool 
                tenantId={tenantId} 
                baselineData={taxData} 
                onApplyScenario={() => setIsSummaryModalOpen(true)}
              />
          </div>
      )}

      {activeTab === 'MAPPING' && taxData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                  <Info size={20} className="text-blue-600 mt-0.5 shrink-0"/>
                  <div>
                      <h4 className="font-bold text-blue-800 text-sm">Explainable Audit Log</h4>
                      <p className="text-xs text-blue-700 mt-1">Data is auto-populated from Sales/Purchase registers. Click on any row to see the source invoices.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* GSTR-1 View */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800">GSTR-1 (Outward Supplies)</h3>
                          <span className="text-xs bg-white border border-slate-300 px-2 py-1 rounded">Auto-Drafted</span>
                      </div>
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-3">Table</th>
                                  <th className="px-6 py-3">Taxable Value</th>
                                  <th className="px-6 py-3 text-right">Tax Liability</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {taxData.gstr1Mapping.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50 group cursor-pointer">
                                      <td className="px-6 py-3">
                                          <p className="font-bold text-slate-700">{row.table}</p>
                                          <p className="text-xs text-slate-500">{row.description}</p>
                                      </td>
                                      <td className="px-6 py-3 font-mono text-slate-600">₹{row.taxableValue.toLocaleString()}</td>
                                      <td className="px-6 py-3 font-mono text-right text-slate-800 font-bold">₹{row.liability.toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  {/* GSTR-3B View */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800">GSTR-3B (Summary)</h3>
                          <span className="text-xs bg-white border border-slate-300 px-2 py-1 rounded">System Calculated</span>
                      </div>
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                              <tr>
                                  <th className="px-6 py-3">Table</th>
                                  <th className="px-6 py-3">Taxable Value</th>
                                  <th className="px-6 py-3 text-right">Tax / ITC</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {taxData.gstr3bMapping.map((row, i) => (
                                  <tr key={i} className="hover:bg-slate-50 group cursor-pointer">
                                      <td className="px-6 py-3">
                                          <p className="font-bold text-slate-700">{row.table}</p>
                                          <p className="text-xs text-slate-500">{row.description}</p>
                                      </td>
                                      <td className="px-6 py-3 font-mono text-slate-600">₹{row.taxableValue.toLocaleString()}</td>
                                      <td className="px-6 py-3 font-mono text-right text-slate-800 font-bold">₹{row.liability.toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'AI_RISK' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-8 text-white flex items-center justify-between">
                  <div>
                      <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><BrainCircuit/> AI Compliance Guard</h3>
                      <p className="text-purple-100 max-w-xl">Our AI engine scans 100% of your invoices against Section 16, 17(5), and Rule 36(4) to detect compliance risks before you file.</p>
                      <button 
                        onClick={handleRunAiAnalysis}
                        disabled={isRiskLoading}
                        className="mt-4 px-6 py-2.5 bg-white text-purple-700 font-bold rounded-lg shadow-lg hover:bg-purple-50 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isRiskLoading ? <RefreshCw className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                        {isRiskLoading ? 'Analyzing Invoices...' : 'Analyze with AI'}
                      </button>
                  </div>
                  <div className="text-right">
                      <p className="text-sm opacity-80 uppercase tracking-wider">Risk Score</p>
                      <p className="text-4xl font-bold">{aiRisks && aiRisks.length > 0 ? 'Medium' : 'Low'}</p>
                  </div>
              </div>

              {isRiskLoading ? <div className="text-center py-12">Running AI Analysis...</div> : (
                  <div className="grid grid-cols-1 gap-4">
                      {aiRisks?.map(risk => (
                          <div key={risk.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                              <div className="shrink-0">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                      risk.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 
                                      risk.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                  }`}>
                                      <ShieldAlert size={24}/>
                                  </div>
                              </div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                  risk.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                              }`}>{risk.severity} Risk</span>
                                              <span className="text-xs text-slate-400 font-mono">Confidence: {risk.aiConfidence}%</span>
                                          </div>
                                          <h4 className="font-bold text-slate-800 text-lg">{risk.category.replace('_', ' ')}</h4>
                                      </div>
                                      {risk.potentialImpact > 0 && (
                                          <div className="text-right">
                                              <p className="text-xs text-slate-500 uppercase">Potential Impact</p>
                                              <p className="font-bold text-red-600">₹ {risk.potentialImpact.toLocaleString()}</p>
                                          </div>
                                      )}
                                  </div>
                                  <p className="text-slate-600 mt-2 text-sm">{risk.description}</p>
                                  {risk.invoiceNumber && (
                                      <p className="text-xs font-mono text-slate-400 mt-1">Ref Invoice: {risk.invoiceNumber}</p>
                                  )}
                                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2">
                                      <Lightbulb size={16} className="text-yellow-600 mt-0.5 shrink-0"/>
                                      <p className="text-sm text-slate-700"><span className="font-semibold">Recommendation:</span> {risk.recommendation}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {aiRisks?.length === 0 && (
                          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4"/>
                              <h3 className="text-lg font-bold text-slate-800">No Risks Detected</h3>
                              <p>Your data looks compliant with current GST laws.</p>
                          </div>
                      )}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'TOOLS' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                {/* Tools Navigation Bar */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl max-w-2xl">
                     <button
                          onClick={() => setActiveToolSubTab('RCM')}
                          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeToolSubTab === 'RCM' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                          <Calculator size={15} /> RCM Calculator
                     </button>
                     <button
                          onClick={() => setActiveToolSubTab('CURRENCY' as any)}
                          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeToolSubTab === 'CURRENCY' as any ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                          <Globe size={15} /> FX Converter
                     </button>
                     <button
                          onClick={() => setActiveToolSubTab('HSN')}
                          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeToolSubTab === 'HSN' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                          <Tag size={15} /> HSN/SAC Directory
                     </button>
                     <button
                          onClick={() => setActiveToolSubTab('PENALTY')}
                          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeToolSubTab === 'PENALTY' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                          <Clock size={15} /> Interest & Late Fees
                     </button>
                </div>

                {activeToolSubTab === 'RCM' && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <RcmCalculator tenantId={tenantId} onInvoiceCreated={refetch} />
                     </div>
                )}

                {activeToolSubTab === 'CURRENCY' as any && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <CurrencyConverterModule />
                     </div>
                )}

                {activeToolSubTab === 'PENALTY' && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <TaxPenaltyEstimator />
                     </div>
                )}

                {activeToolSubTab === 'HSN' && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                               <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                   <Search size={20} className="text-blue-500"/> HSN/SAC Validator
                               </h3>
                               <div className="flex gap-4 mb-6">
                                   <input 
                                       value={hsnInput}
                                       onChange={(e) => setHsnInput(e.target.value)}
                                       placeholder="Enter Code (e.g. 998313)" 
                                       className="flex-1 h-12 px-4 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                                   />
                                   <button 
                                       onClick={handleValidateHsn}
                                       disabled={!hsnInput || isValidating}
                                       className="px-6 h-12 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-70"
                                   >
                                       {isValidating ? '...' : 'Check'}
                                   </button>
                               </div>
                               {hsnResult && (
                                   <div className={`p-4 rounded-lg border ${hsnResult.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                       <p className={`font-bold ${hsnResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
                                           {hsnResult.isValid ? `Valid: ${hsnResult.description}` : 'Invalid Code'}
                                       </p>
                                       {hsnResult.isValid && <p className="text-sm text-green-700 mt-1">Rate: {hsnResult.rate}%</p>}
                                   </div>
                               )}
                          </div>

                          {/* HSN/SAC Directory */}
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                               <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                   <div>
                                       <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                           <Tag size={24} className="text-blue-600"/> HSN/SAC Code Directory
                                       </h3>
                                       <p className="text-slate-500 text-sm mt-1">Official classification directory for GST tax rates.</p>
                                   </div>
                                   
                                   <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                       <div className="relative flex-1 sm:w-64">
                                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                           <input 
                                               value={hsnSearch}
                                               onChange={(e) => setHsnSearch(e.target.value)}
                                               placeholder="Search by code or name..."
                                               className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                                           />
                                       </div>
                                       <div className="flex bg-slate-100 p-1 rounded-xl">
                                           {(['ALL', 'GOODS', 'SERVICES'] as const).map(cat => (
                                               <button
                                                   key={cat}
                                                   onClick={() => setHsnCategoryFilter(cat)}
                                                   className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${hsnCategoryFilter === cat ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                               >
                                                   {cat}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               </div>

                               <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                   <table className="w-full text-left border-collapse">
                                       <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                           <tr>
                                               <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                                               <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                               <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tax Rate</th>
                                               <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Category</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50">
                                           {filteredHsn.map((item, idx) => (
                                               <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                   <td className="px-8 py-5">
                                                       <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
                                                           {item.code}
                                                       </span>
                                                   </td>
                                                   <td className="px-8 py-5">
                                                       <p className="text-sm font-semibold text-slate-700 leading-relaxed">{item.description}</p>
                                                   </td>
                                                   <td className="px-8 py-5 text-center">
                                                       <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                                                           item.taxRate >= 18 ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                                                           item.taxRate > 0 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                       }`}>
                                                           {item.taxRate}%
                                                       </span>
                                                   </td>
                                                   <td className="px-8 py-5 text-right">
                                                       <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                                                           item.category === 'GOODS' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                       }`}>
                                                           {item.category}
                                                       </span>
                                                   </td>
                                               </tr>
                                           ))}
                                           {filteredHsn.length === 0 && (
                                               <tr>
                                                   <td colSpan={4} className="px-8 py-20 text-center">
                                                       <div className="flex flex-col items-center gap-3">
                                                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                                               <Search size={32} />
                                                           </div>
                                                           <p className="font-bold text-slate-400">No HSN codes found matching your criteria</p>
                                                           <button 
                                                               onClick={() => { setHsnSearch(''); setHsnCategoryFilter('ALL'); }}
                                                               className="text-sm font-bold text-blue-600 hover:underline"
                                                           >
                                                               Clear all filters
                                                           </button>
                                                       </div>
                                                   </td>
                                               </tr>
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                               
                               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                   <p className="text-xs text-slate-500 font-medium italic">
                                       Showing {filteredHsn.length} of {HSN_DIRECTORY.length} classifications
                                   </p>
                                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                       <Info size={12}/> Updated for FY 2024-25
                                   </div>
                               </div>
                          </div>
                     </div>
                )}
           </div>
      )}

      {/* Automated GST Filing Wizard Modal */}
      {isFilingWizardOpen && (
        <AutomatedGstFilingWizard 
          isOpen={isFilingWizardOpen}
          onClose={() => setIsFilingWizardOpen(false)}
          taxComputation={taxData}
          invoices={invoices}
          tenantId={tenantId}
          user={user as any}
          currentTenant={user?.availableTenants.find(t => t.id === tenantId)}
          initialPeriod={period}
          initialGstin={selectedGstin !== 'ALL' ? selectedGstin : undefined}
          onFilingSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default Computation;