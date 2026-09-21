import React, { useState, useMemo } from 'react';
import { 
  Calculator, Calendar, Clock, Percent, AlertTriangle, ShieldAlert, 
  CheckCircle2, Info, ArrowUpRight, FileText, Sparkles, Scale, HelpCircle 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

export const TaxPenaltyEstimator: React.FC = () => {
  // Input states
  const [returnType, setReturnType] = useState<'GSTR_3B_REGULAR' | 'GSTR_3B_NIL' | 'GSTR_1_REGULAR' | 'GSTR_9_ANNUAL'>('GSTR_3B_REGULAR');
  const [taxLiability, setTaxLiability] = useState<number>(50000);
  const [turnover, setTurnover] = useState<number>(15000000); // Relevant for GSTR-9 caps
  
  // Dates
  const [dueDate, setDueDate] = useState<string>('2026-07-20');
  const [filingDate, setFilingDate] = useState<string>('2026-08-15');
  const [manualDays, setManualDays] = useState<boolean>(false);
  const [daysDelayedInput, setDaysDelayedInput] = useState<number>(26);

  // Calculate actual days delayed from dates
  const calculatedDays = useMemo(() => {
    if (manualDays) return daysDelayedInput;
    const start = new Date(dueDate);
    const end = new Date(filingDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [dueDate, filingDate, manualDays, daysDelayedInput]);

  // Tax calculations based on Indian GST Law rules
  const calculations = useMemo(() => {
    const days = calculatedDays;
    
    // 1. Interest Calculation (Section 50)
    // 18% p.a. on the cash liability amount, daily pro-rata
    // GSTR-1 does not have interest since it is only statement of outward supplies (no payment)
    const hasInterestPayment = returnType !== 'GSTR_1_REGULAR';
    const interestRatePerAnnum = 0.18;
    const interest = hasInterestPayment && taxLiability > 0 
      ? Math.round(taxLiability * interestRatePerAnnum * (days / 365)) 
      : 0;

    // 2. Late Fee Calculation (Section 47)
    let dailyLateFeeCGST = 0;
    let dailyLateFeeSGST = 0;
    let maxLateFeeCGST = 0;
    let maxLateFeeSGST = 0;

    switch (returnType) {
      case 'GSTR_3B_REGULAR':
        // ₹25 CGST + ₹25 SGST per day = ₹50/day
        dailyLateFeeCGST = 25;
        dailyLateFeeSGST = 25;
        // Max late fee cap per return: standard general cap is ₹5000 per act (CGST/SGST), total ₹10000
        // (However, for low turnovers, there are reduced rationalized caps: e.g. <₹1.5Cr AATO is capped at ₹1000 per act, <₹5Cr is capped at ₹2500 per act)
        if (turnover <= 15000000) {
          maxLateFeeCGST = 1000;
          maxLateFeeSGST = 1000;
        } else if (turnover <= 50000000) {
          maxLateFeeCGST = 2500;
          maxLateFeeSGST = 2500;
        } else {
          maxLateFeeCGST = 5000;
          maxLateFeeSGST = 5000;
        }
        break;

      case 'GSTR_3B_NIL':
        // ₹10 CGST + ₹10 SGST = ₹20/day
        dailyLateFeeCGST = 10;
        dailyLateFeeSGST = 10;
        maxLateFeeCGST = 250;
        maxLateFeeSGST = 250;
        break;

      case 'GSTR_1_REGULAR':
        // ₹25 CGST + ₹25 SGST = ₹50/day
        dailyLateFeeCGST = 25;
        dailyLateFeeSGST = 25;
        if (turnover <= 15000000) {
          maxLateFeeCGST = 1000;
          maxLateFeeSGST = 1000;
        } else if (turnover <= 50000000) {
          maxLateFeeCGST = 2500;
          maxLateFeeSGST = 2500;
        } else {
          maxLateFeeCGST = 5000;
          maxLateFeeSGST = 5000;
        }
        break;

      case 'GSTR_9_ANNUAL':
        // GSTR-9 Annual Return: ₹100 CGST + ₹100 SGST = ₹200/day
        dailyLateFeeCGST = 100;
        dailyLateFeeSGST = 100;
        // Cap is 0.25% of turnover in state under CGST + 0.25% under SGST = Total 0.5%
        const capAmount = Math.round(turnover * 0.0025);
        maxLateFeeCGST = capAmount;
        maxLateFeeSGST = capAmount;
        break;
    }

    const calculatedCgstFee = Math.min(dailyLateFeeCGST * days, maxLateFeeCGST);
    const calculatedSgstFee = Math.min(dailyLateFeeSGST * days, maxLateFeeSGST);
    const lateFee = calculatedCgstFee + calculatedSgstFee;

    const totalLiability = interest + lateFee;

    return {
      days,
      interest,
      cgstLateFee: calculatedCgstFee,
      sgstLateFee: calculatedSgstFee,
      totalLateFee: lateFee,
      totalLiability,
      dailyRate: dailyLateFeeCGST + dailyLateFeeSGST,
      maxCapCGST: maxLateFeeCGST,
      maxCapSGST: maxLateFeeSGST,
      totalCap: maxLateFeeCGST + maxLateFeeSGST
    };
  }, [calculatedDays, returnType, taxLiability, turnover]);

  // Generate Recharts progression data over the days
  const chartData = useMemo(() => {
    const dataPoints = [];
    const step = Math.max(1, Math.ceil(calculations.days / 15));
    
    // Ensure we always have day 0, middle steps, and the final day
    for (let day = 0; day <= calculations.days; day += step) {
      const dailyInterest = returnType !== 'GSTR_1_REGULAR' && taxLiability > 0
        ? Math.round(taxLiability * 0.18 * (day / 365))
        : 0;
      
      let dailyLateFeeCGST = 0;
      let dailyLateFeeSGST = 0;
      let maxLateFeeCGST = 0;
      let maxLateFeeSGST = 0;

      switch (returnType) {
        case 'GSTR_3B_REGULAR':
          dailyLateFeeCGST = 25; dailyLateFeeSGST = 25;
          maxLateFeeCGST = turnover <= 15000000 ? 1000 : turnover <= 50000000 ? 2500 : 5000;
          maxLateFeeSGST = maxLateFeeCGST;
          break;
        case 'GSTR_3B_NIL':
          dailyLateFeeCGST = 10; dailyLateFeeSGST = 10;
          maxLateFeeCGST = 250; maxLateFeeSGST = 250;
          break;
        case 'GSTR_1_REGULAR':
          dailyLateFeeCGST = 25; dailyLateFeeSGST = 25;
          maxLateFeeCGST = turnover <= 15000000 ? 1000 : turnover <= 50000000 ? 2500 : 5000;
          maxLateFeeSGST = maxLateFeeCGST;
          break;
        case 'GSTR_9_ANNUAL':
          dailyLateFeeCGST = 100; dailyLateFeeSGST = 100;
          const cap = Math.round(turnover * 0.0025);
          maxLateFeeCGST = cap; maxLateFeeSGST = cap;
          break;
      }

      const cgstFee = Math.min(dailyLateFeeCGST * day, maxLateFeeCGST);
      const sgstFee = Math.min(dailyLateFeeSGST * day, maxLateFeeSGST);
      const lateFee = cgstFee + sgstFee;

      dataPoints.push({
        day: `Day ${day}`,
        Interest: dailyInterest,
        'Late Fee': lateFee,
        'Total Penalty': dailyInterest + lateFee
      });
    }

    // Always append final day if not perfectly hit
    const lastPointDay = dataPoints[dataPoints.length - 1]?.day;
    if (lastPointDay !== `Day ${calculations.days}`) {
      dataPoints.push({
        day: `Day ${calculations.days}`,
        Interest: calculations.interest,
        'Late Fee': calculations.totalLateFee,
        'Total Penalty': calculations.totalLiability
      });
    }

    return dataPoints;
  }, [calculations, returnType, taxLiability, turnover]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      {/* Title & Eyebrow */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <Calculator size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">Tax Penalty &amp; Interest Estimator</h3>
            <p className="text-xs text-slate-500 mt-0.5">Under Section 50 (Interest) &amp; Section 47 (Late Fees) of Central GST Acts</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-100 uppercase">
          <Clock size={12} className="text-rose-500 animate-pulse" /> Live Calculator
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-5 space-y-5">
          {/* Return Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              Select GST Return Type
              <span title="Late fees and interest apply differently based on the chosen form" className="cursor-help inline-flex">
                <HelpCircle size={12} className="text-slate-400" />
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'GSTR_3B_REGULAR', label: 'GSTR-3B Regular' },
                { id: 'GSTR_3B_NIL', label: 'GSTR-3B Nil' },
                { id: 'GSTR_1_REGULAR', label: 'GSTR-1 Regular' },
                { id: 'GSTR_9_ANNUAL', label: 'GSTR-9 Annual' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setReturnType(type.id as any);
                    if (type.id === 'GSTR_3B_NIL') setTaxLiability(0);
                  }}
                  className={`px-3 py-2 text-[11px] font-bold rounded-xl border transition-all text-center ${
                    returnType === type.id 
                      ? 'bg-rose-50 border-rose-200 text-rose-800 font-extrabold shadow-xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tax Liability */}
          {returnType !== 'GSTR_3B_NIL' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Delayed Tax Amount (Cash Portion)</span>
                <span className="font-mono text-rose-600">₹ {taxLiability.toLocaleString()}</span>
              </div>
              <input 
                type="range"
                min={1000}
                max={500000}
                step={5000}
                value={taxLiability}
                onChange={(e) => setTaxLiability(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
              />
              <div className="flex gap-2">
                <span className="text-[10px] text-slate-400">Min: ₹1k</span>
                <input 
                  type="number"
                  value={taxLiability}
                  onChange={(e) => setTaxLiability(Math.max(0, Number(e.target.value)))}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 self-center">Max: ₹500k</span>
              </div>
            </div>
          )}

          {/* GSTR-9 / GSTR-3B Turnover for Caps */}
          {returnType !== 'GSTR_3B_NIL' && (
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1">
                  Annual Aggregate Turnover (AATO)
                  <span title="Used to calculate the maximum legal late fee caps" className="cursor-help inline-flex">
                    <Info size={11} className="text-slate-400" />
                  </span>
                </span>
                <span className="font-mono text-blue-600">₹ {(turnover / 10000000).toFixed(2)} Cr</span>
              </div>
              <select
                value={turnover}
                onChange={(e) => setTurnover(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value={15000000}>Up to ₹1.5 Crores (Standard Caps)</option>
                <option value={50000000}>₹1.5 Crores to ₹5 Crores (Medium Caps)</option>
                <option value={100000000}>₹5 Crores to ₹10 Crores (Large Caps)</option>
                <option value={500000000}>Above ₹10 Crores (Max Corporate Caps)</option>
              </select>
            </div>
          )}

          {/* Timing/Delay Settings */}
          <div className="space-y-3 bg-rose-50/20 p-4 rounded-xl border border-rose-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">How to enter delay?</span>
              <button
                type="button"
                onClick={() => setManualDays(!manualDays)}
                className="text-[11px] text-blue-600 hover:underline font-bold"
              >
                {manualDays ? 'Calculate from Dates' : 'Input Days Manually'}
              </button>
            </div>

            {manualDays ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Days Delayed</span>
                  <span className="font-mono text-rose-700 font-extrabold">{daysDelayedInput} Days</span>
                </div>
                <input 
                  type="range"
                  min={1}
                  max={180}
                  step={1}
                  value={daysDelayedInput}
                  onChange={(e) => setDaysDelayedInput(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 block">Due Date of Return</label>
                  <div className="relative">
                    <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full h-8 pl-8 pr-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 block">Actual Filing Date</label>
                  <div className="relative">
                    <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="date"
                      value={filingDate}
                      onChange={(e) => setFilingDate(e.target.value)}
                      className="w-full h-8 pl-8 pr-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Outputs & Visualization */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Calculation Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Delay card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Filing Delay</span>
              <p className="text-2xl font-black text-rose-700 font-mono mt-1">{calculations.days}</p>
              <span className="text-[10px] text-slate-500">Days from due date</span>
            </div>

            {/* Interest Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Interest Sec 50</span>
              <p className="text-2xl font-black text-slate-800 font-mono mt-1">₹ {calculations.interest.toLocaleString()}</p>
              <span className="text-[10px] text-slate-500 font-bold">18% p.a. pro-rata</span>
            </div>

            {/* Late Fee Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Late Fee Sec 47</span>
              <p className="text-2xl font-black text-slate-800 font-mono mt-1">₹ {calculations.totalLateFee.toLocaleString()}</p>
              <span className="text-[10px] text-slate-500">₹{calculations.dailyRate}/day (capped)</span>
            </div>
          </div>

          {/* Big Total Box */}
          <div className="p-5 bg-rose-950 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-rose-900 shadow-lg">
            <div>
              <div className="flex items-center gap-1 text-xs text-rose-300 font-bold">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span>Consolidated Penalty Assessment</span>
              </div>
              <p className="text-xs text-rose-200 mt-0.5 leading-tight">Total liability accumulated before reconciliation</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-xs uppercase text-rose-300 tracking-wider font-bold">Payable Amount</p>
              <p className="text-3xl font-black font-mono tracking-tight text-white mt-0.5">
                ₹ {calculations.totalLiability.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Cumulative Growth Chart */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={13} className="text-rose-500" /> Penalty Growth Projection
            </h4>
            <div className="h-44 w-full bg-slate-50 rounded-xl border border-slate-100 p-2">
              {calculations.days > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="lateFeeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={9} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} 
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                    <Area type="monotone" dataKey="Interest" stroke="#ef4444" fillOpacity={1} fill="url(#interestGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Late Fee" stroke="#3b82f6" fillOpacity={1} fill="url(#lateFeeGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                  Select a delay of 1 or more days to visualize penalty build-up
                </div>
              )}
            </div>
          </div>

          {/* Legal Compliance Accordion / Details */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Scale size={14} className="text-slate-600" /> Statutory Provisions (Indian GST Laws)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Section 50 Interest Mandate</span>
                <p className="text-[11px] text-slate-500">
                  Interest is strictly applicable only on the **net cash liability** (portion settled using electronic cash ledger), not on the portion settled with Input Tax Credit (ITC), as validated by the Union Budget amendment.
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-800 block">Section 47 Late Fee Cap Limits</span>
                <p className="text-[11px] text-slate-500">
                  Late fees under CGST and SGST acts accumulate concurrently up to the turnover-linked cap. For regular tax filings, the CGST late fee is limited to ₹5,000 and SGST is limited to ₹5,000.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
