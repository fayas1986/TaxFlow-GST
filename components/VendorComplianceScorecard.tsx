import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, XCircle, TrendingDown, 
  TrendingUp, Clock, FileText, Database, Lock, Unlock, Mail, Filter, Search, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';

// Mock types
interface FilingTrend {
  month: string;
  gstr1Filed: boolean;
  gstr3bFiled: boolean;
  delayDays: number;
}

interface VendorRiskProfile {
  id: string;
  vendorName: string;
  gstin: string;
  category: 'A' | 'B' | 'C' | 'D'; // A: Excellent, B: Good, C: Risky, D: Critical
  complianceScore: number;
  totalItcAtRisk: number;
  lastFiledPeriod: string;
  filingTrends: FilingTrend[];
  erpPaymentHold: boolean;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';
}

const mockVendors: VendorRiskProfile[] = [
  {
    id: 'v1',
    vendorName: 'Acme Corp Industries',
    gstin: '27AADCB2230M1Z2',
    category: 'C',
    complianceScore: 45,
    totalItcAtRisk: 1250000,
    lastFiledPeriod: 'May 2026',
    erpPaymentHold: false,
    status: 'NON_COMPLIANT',
    filingTrends: [
      { month: 'Mar', gstr1Filed: true, gstr3bFiled: true, delayDays: 5 },
      { month: 'Apr', gstr1Filed: true, gstr3bFiled: false, delayDays: 12 },
      { month: 'May', gstr1Filed: true, gstr3bFiled: true, delayDays: 20 },
      { month: 'Jun', gstr1Filed: false, gstr3bFiled: false, delayDays: 0 },
    ]
  },
  {
    id: 'v2',
    vendorName: 'TechNova Solutions',
    gstin: '29ABCDE1234F2Z5',
    category: 'A',
    complianceScore: 95,
    totalItcAtRisk: 0,
    lastFiledPeriod: 'July 2026',
    erpPaymentHold: false,
    status: 'COMPLIANT',
    filingTrends: [
      { month: 'Apr', gstr1Filed: true, gstr3bFiled: true, delayDays: 0 },
      { month: 'May', gstr1Filed: true, gstr3bFiled: true, delayDays: 1 },
      { month: 'Jun', gstr1Filed: true, gstr3bFiled: true, delayDays: 0 },
      { month: 'Jul', gstr1Filed: true, gstr3bFiled: true, delayDays: 0 },
    ]
  },
  {
    id: 'v3',
    vendorName: 'Global Logistics Pvt Ltd',
    gstin: '07BZZPA9910K1Z1',
    category: 'D',
    complianceScore: 20,
    totalItcAtRisk: 3450000,
    lastFiledPeriod: 'March 2026',
    erpPaymentHold: true,
    status: 'NON_COMPLIANT',
    filingTrends: [
      { month: 'Feb', gstr1Filed: true, gstr3bFiled: true, delayDays: 15 },
      { month: 'Mar', gstr1Filed: true, gstr3bFiled: false, delayDays: 25 },
      { month: 'Apr', gstr1Filed: false, gstr3bFiled: false, delayDays: 0 },
      { month: 'May', gstr1Filed: false, gstr3bFiled: false, delayDays: 0 },
    ]
  },
  {
    id: 'v4',
    vendorName: 'Nexus Traders',
    gstin: '09AAKCN1122M1Z5',
    category: 'B',
    complianceScore: 78,
    totalItcAtRisk: 150000,
    lastFiledPeriod: 'June 2026',
    erpPaymentHold: false,
    status: 'WARNING',
    filingTrends: [
      { month: 'Apr', gstr1Filed: true, gstr3bFiled: true, delayDays: 2 },
      { month: 'May', gstr1Filed: true, gstr3bFiled: true, delayDays: 5 },
      { month: 'Jun', gstr1Filed: true, gstr3bFiled: true, delayDays: 10 },
      { month: 'Jul', gstr1Filed: true, gstr3bFiled: false, delayDays: 0 },
    ]
  }
];

export const VendorComplianceScorecard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');
  
  // Local state for optimistic updates on ERP hold toggle
  const [vendors, setVendors] = useState<VendorRiskProfile[]>(mockVendors);
  
  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) || v.gstin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalRiskAmount = vendors.reduce((sum, v) => sum + v.totalItcAtRisk, 0);
  const criticalVendors = vendors.filter(v => v.category === 'D' || v.category === 'C').length;

  const toggleErpHold = (id: string) => {
    setVendors(prev => prev.map(v => 
      v.id === id ? { ...v, erpPaymentHold: !v.erpPaymentHold } : v
    ));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-6">
      
      {/* Dashboard Headers & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider">Total ITC at Risk</h4>
          </div>
          <p className="text-2xl font-black text-slate-800">₹{totalRiskAmount.toLocaleString('en-IN')}</p>
          <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1">
            <TrendingUp size={12} /> +12% from last month
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider">Critical / Risky Vendors</h4>
          </div>
          <p className="text-2xl font-black text-slate-800">{criticalVendors}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Vendors in Category C & D
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-slate-500">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database size={18} />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider">ERP Holds Active</h4>
          </div>
          <p className="text-2xl font-black text-slate-800">{vendors.filter(v => v.erpPaymentHold).length}</p>
          <p className="text-xs font-medium text-indigo-600 flex items-center gap-1 mt-1">
            Payments blocked at source (SAP/Oracle)
          </p>
        </div>
      </div>

      {/* Main Scorecard Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="text-indigo-600" size={16} />
              Vendor Compliance Scorecard
            </h3>
            <p className="text-xs text-slate-500 font-medium">Evaluate GSTR-1/3B filing punctuality and manage ERP holds.</p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor or GSTIN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2">
              <Filter size={14} className="text-slate-400 ml-1" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as any)}
                className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none py-2 pl-2 pr-4 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="A">Cat A (Excellent)</option>
                <option value="B">Cat B (Good)</option>
                <option value="C">Cat C (Risky)</option>
                <option value="D">Cat D (Critical)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Supplier & Score</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Filing Punctuality (Last 4 Months)</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">ITC Exposure (₹)</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-center">ERP Payment Control</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <ShieldAlert size={32} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold">No vendors matched your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredVendors.map(vendor => (
                  <tr key={vendor.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Supplier Profile & Score */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl border ${getScoreColor(vendor.complianceScore)} shrink-0`}>
                          <span className="text-[10px] font-bold uppercase mb-[-2px]">Score</span>
                          <span className="text-sm font-black">{vendor.complianceScore}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{vendor.vendorName}</p>
                          <p className="font-mono text-[10px] font-semibold text-slate-500">{vendor.gstin}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              vendor.category === 'A' ? 'bg-emerald-100 text-emerald-700' :
                              vendor.category === 'B' ? 'bg-blue-100 text-blue-700' :
                              vendor.category === 'C' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              Category {vendor.category}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">Last Filed: {vendor.lastFiledPeriod}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Filing Trend Micro-charts */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {vendor.filingTrends.map((trend, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1 group relative">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{trend.month}</span>
                            <div className="flex gap-0.5">
                              {/* GSTR-1 Status */}
                              <div className={`w-2.5 h-6 rounded-sm ${trend.gstr1Filed ? 'bg-emerald-400' : 'bg-rose-400'} opacity-90`}></div>
                              {/* GSTR-3B Status */}
                              <div className={`w-2.5 h-6 rounded-sm ${trend.gstr3bFiled ? 'bg-indigo-400' : 'bg-rose-400'} opacity-90`}></div>
                            </div>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-32 bg-slate-800 text-white text-[10px] font-medium p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                              GSTR-1: {trend.gstr1Filed ? 'Filed' : 'Pending'}<br/>
                              GSTR-3B: {trend.gstr3bFiled ? 'Filed' : 'Pending'}<br/>
                              Delay: {trend.delayDays} days
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* ITC Exposure */}
                    <td className="px-5 py-4 text-right">
                      {vendor.totalItcAtRisk > 0 ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="text-sm font-black text-rose-600 font-mono tracking-tight">
                            ₹{vendor.totalItcAtRisk.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={10} /> At Risk
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1 justify-end ml-auto w-max">
                          <CheckCircle2 size={12} /> No Risk
                        </span>
                      )}
                    </td>

                    {/* ERP Hold Controls */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => toggleErpHold(vendor.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all border ${
                          vendor.erpPaymentHold 
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {vendor.erpPaymentHold ? (
                          <>
                            <Lock size={12} /> Payment Blocked
                          </>
                        ) : (
                          <>
                            <Unlock size={12} /> Auto-Pay Active
                          </>
                        )}
                      </button>
                      {vendor.erpPaymentHold && (
                        <p className="text-[9px] text-rose-400 font-semibold mt-1">Syncing to ERP...</p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200">
                          <FileText size={14} />
                        </button>
                        <button className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                          <Mail size={12} /> Dunning
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
