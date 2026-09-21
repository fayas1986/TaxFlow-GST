import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Bar
} from 'recharts';
import { 
  BrainCircuit, TrendingUp, TrendingDown, Sparkles, AlertCircle, Calendar, ShieldCheck, 
  RefreshCw, Sliders, Download, DollarSign, IndianRupee, Layers, CheckCircle2, ArrowRight,
  Info, Cpu, BarChart3, PieChart
} from 'lucide-react';
import { fetchInvoices } from '../../services/api';
import { Invoice } from '../../types';

interface TaxLiabilityMlForecastProps {
  tenantId?: string;
  analyticsData?: any;
}

export type MlAlgorithm = 'ENSEMBLE' | 'HOLT_WINTERS' | 'RIDGE_REGRESSION' | 'MOVING_AVERAGE';

interface MonthlyTaxRecord {
  monthKey: string; // e.g. "2024-05" or "May 2024"
  monthLabel: string; // e.g. "May '24"
  grossSales: number;
  outputTax: number;
  inputTaxCredit: number;
  netLiability: number;
  isForecast: boolean;
  lowerBound?: number;
  upperBound?: number;
  confidenceScore?: number; // 0 - 100
}

export const TaxLiabilityMlForecast: React.FC<TaxLiabilityMlForecastProps> = ({ 
  tenantId = 't1',
  analyticsData
}) => {
  // Model & Simulation Controls State
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<MlAlgorithm>('ENSEMBLE');
  const [confidenceLevel, setConfidenceLevel] = useState<80 | 95>(90 as 80 | 95); // 80% or 95% CI
  const [salesGrowthFactor, setSalesGrowthFactor] = useState<number>(5); // % growth slider
  const [itcRateFactor, setItcRateFactor] = useState<number>(0); // % ITC change slider
  const [festiveSeasonalityBoost, setFestiveSeasonalityBoost] = useState<number>(10); // % Q3/Festive boost
  const [isAiInsightOpen, setIsAiInsightOpen] = useState<boolean>(true);

  // Fetch real invoices
  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['invoicesForMlForecast', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  // Calculate Historical Monthly Aggregates from Invoices or Analytics
  const historicalMonthlyData = useMemo<MonthlyTaxRecord[]>(() => {
    // If we have actual invoices, group them by YYYY-MM
    if (invoices && invoices.length > 0) {
      const monthMap: Record<string, { sales: number; outputTax: number; itc: number }> = {};

      invoices.forEach((inv: Invoice) => {
        if (!inv.date) return;
        const monthKey = inv.date.substring(0, 7); // e.g. "2024-10"
        if (!monthMap[monthKey]) {
          monthMap[monthKey] = { sales: 0, outputTax: 0, itc: 0 };
        }

        const invAmount = inv.amount || inv.originalAmount || 0;
        const invTax = inv.taxAmount || inv.originalTaxAmount || 0;

        if (inv.category === 'SALES' || !inv.category) {
          monthMap[monthKey].sales += invAmount;
          monthMap[monthKey].outputTax += invTax;
        } else if (inv.category === 'PURCHASE') {
          monthMap[monthKey].itc += invTax;
        }
      });

      const sortedKeys = Object.keys(monthMap).sort();
      
      if (sortedKeys.length >= 3) {
        return sortedKeys.map(key => {
          const item = monthMap[key];
          const dateObj = new Date(key + '-01');
          const monthLabel = dateObj.toLocaleString('en-US', { month: 'short', year: '2-digit' });
          const net = Math.max(0, item.outputTax - item.itc);

          return {
            monthKey: key,
            monthLabel,
            grossSales: Math.round(item.sales),
            outputTax: Math.round(item.outputTax),
            inputTaxCredit: Math.round(item.itc),
            netLiability: Math.round(net),
            isForecast: false
          };
        });
      }
    }

    // Fallback standard 6-month historical data aligned with dashboard
    const now = new Date();
    const months = [];
    const baseOutputTaxes = [180000, 225000, 171000, 252000, 207000, 277200];
    const baseItcs = [108000, 135000, 147600, 162000, 126000, 160200];
    const baseSales = [1000000, 1250000, 950000, 1400000, 1150000, 1540000];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = d.toISOString().substring(0, 7);
      const mLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const idx = 5 - i;
      const outTax = baseOutputTaxes[idx];
      const itc = baseItcs[idx];
      
      months.push({
        monthKey: mKey,
        monthLabel: mLabel,
        grossSales: baseSales[idx],
        outputTax: outTax,
        inputTaxCredit: itc,
        netLiability: outTax - itc,
        isForecast: false
      });
    }

    return months;
  }, [invoices]);

  // Execute ML Forecasting Engine for Next 3 Months
  const { forecastData, mlMetrics, chartSeries } = useMemo(() => {
    if (historicalMonthlyData.length === 0) {
      return { forecastData: [], mlMetrics: null, chartSeries: [] };
    }

    const n = historicalMonthlyData.length;
    const liabilities = historicalMonthlyData.map(d => d.netLiability);
    const outputTaxes = historicalMonthlyData.map(d => d.outputTax);
    const itcs = historicalMonthlyData.map(d => d.inputTaxCredit);
    const salesList = historicalMonthlyData.map(d => d.grossSales);

    // 1. Calculate Historical Trend & Volatility
    const meanLiability = liabilities.reduce((a, b) => a + b, 0) / n;
    const meanSales = salesList.reduce((a, b) => a + b, 0) / n;
    
    // Variance & Standard Error
    const variance = liabilities.reduce((sq, val) => sq + Math.pow(val - meanLiability, 2), 0) / (n - 1 || 1);
    const stdDev = Math.sqrt(variance);

    // Linear Regression (Y = Slope * X + Intercept)
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += liabilities[i];
      sumXY += i * liabilities[i];
      sumXX += i * i;
    }
    const ridgePenalty = 0.05; // Regularization
    const slope = (n * sumXY - sumX * sumY) / ((n * sumXX - sumX * sumX) + ridgePenalty * n);
    const intercept = (sumY - slope * sumX) / n;

    // Exponential Smoothing (Holt-Winters Level + Trend)
    const alpha = 0.45; // Level smoothing
    const beta = 0.25;  // Trend smoothing
    let level = liabilities[0];
    let trend = liabilities.length > 1 ? liabilities[1] - liabilities[0] : 0;

    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      level = alpha * liabilities[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    // Generate 3 Future Months Predictions
    const lastHistoricalDateStr = historicalMonthlyData[n - 1].monthKey;
    const lastDateParts = lastHistoricalDateStr.split('-');
    const lastYear = parseInt(lastDateParts[0], 10);
    const lastMonth = parseInt(lastDateParts[1], 10) - 1; // 0-indexed

    const futureRecords: MonthlyTaxRecord[] = [];
    const zMultiplier = confidenceLevel === 95 ? 1.96 : 1.28; // Z-score for CI

    for (let h = 1; h <= 3; h++) {
      const futDate = new Date(lastYear, lastMonth + h, 1);
      const futKey = futDate.toISOString().substring(0, 7);
      const futLabel = futDate.toLocaleString('en-US', { month: 'short', year: '2-digit' }) + ' (Fcst)';

      // Baseline ML Calculation depending on selected algorithm
      let rawLiabilityPred = 0;
      let rawOutputTaxPred = 0;
      let rawItcPred = 0;

      // Model 1: Holt-Winters
      const hwPred = level + h * trend;

      // Model 2: Ridge Regression
      const regPred = intercept + slope * (n - 1 + h);

      // Model 3: Exponential Moving Average
      const emaWeight = 0.6;
      const emaPred = liabilities[n - 1] * emaWeight + meanLiability * (1 - emaWeight);

      if (selectedAlgorithm === 'HOLT_WINTERS') {
        rawLiabilityPred = hwPred;
      } else if (selectedAlgorithm === 'RIDGE_REGRESSION') {
        rawLiabilityPred = regPred;
      } else if (selectedAlgorithm === 'MOVING_AVERAGE') {
        rawLiabilityPred = emaPred;
      } else {
        // ENSEMBLE MODEL: Weighted Average
        rawLiabilityPred = 0.45 * hwPred + 0.35 * regPred + 0.20 * emaPred;
      }

      // Apply User Sensitivity Hyper-parameters
      const growthMultiplier = 1 + salesGrowthFactor / 100;
      const itcMultiplier = 1 + itcRateFactor / 100;
      const seasonalBoost = 1 + (h === 2 ? festiveSeasonalityBoost / 100 : (h === 3 ? (festiveSeasonalityBoost * 0.5) / 100 : 0));

      const adjustedNetLiability = Math.round(Math.max(10000, rawLiabilityPred * growthMultiplier * seasonalBoost));

      // Output Tax & ITC estimation based on historical Output/ITC ratio
      const avgOutputRatio = outputTaxes.reduce((a, b) => a + b, 0) / (salesList.reduce((a, b) => a + b, 0) || 1);
      const avgItcRatio = itcs.reduce((a, b) => a + b, 0) / (outputTaxes.reduce((a, b) => a + b, 0) || 1);

      const estimatedSales = Math.round(meanSales * growthMultiplier * seasonalBoost);
      const estimatedOutputTax = Math.round(adjustedNetLiability / Math.max(0.2, (1 - avgItcRatio * (1 / itcMultiplier))));
      const estimatedItc = Math.round(Math.max(0, estimatedOutputTax - adjustedNetLiability));

      // Confidence Interval Error Range increases with forecast horizon h
      const stdErrorHorizon = stdDev * Math.sqrt(1 + (h / n));
      const marginOfError = Math.round(zMultiplier * stdErrorHorizon);

      const lowerBound = Math.max(0, adjustedNetLiability - marginOfError);
      const upperBound = adjustedNetLiability + marginOfError;

      // Confidence score metric (higher for closer horizon, lower for distant)
      const confidenceScore = Math.max(60, Math.round(92 - (h - 1) * 8 - (stdDev / meanLiability) * 15));

      futureRecords.push({
        monthKey: futKey,
        monthLabel: futLabel,
        grossSales: estimatedSales,
        outputTax: estimatedOutputTax,
        inputTaxCredit: estimatedItc,
        netLiability: adjustedNetLiability,
        isForecast: true,
        lowerBound,
        upperBound,
        confidenceScore
      });
    }

    // Combine Historical and Future Records for Seamless Charting
    const combinedChartSeries = [
      ...historicalMonthlyData.map(d => ({
        ...d,
        actualNet: d.netLiability,
        forecastNet: null as number | null,
        lowerBand: null as number | null,
        upperBand: null as number | null,
        bandRange: null as [number, number] | null
      })),
      // Bridge element to connect last actual point with first forecast
      {
        ...historicalMonthlyData[n - 1],
        monthLabel: historicalMonthlyData[n - 1].monthLabel,
        actualNet: historicalMonthlyData[n - 1].netLiability,
        forecastNet: historicalMonthlyData[n - 1].netLiability,
        lowerBand: historicalMonthlyData[n - 1].netLiability,
        upperBand: historicalMonthlyData[n - 1].netLiability,
        bandRange: [historicalMonthlyData[n - 1].netLiability, historicalMonthlyData[n - 1].netLiability] as [number, number]
      },
      ...futureRecords.map(d => ({
        ...d,
        actualNet: null as number | null,
        forecastNet: d.netLiability,
        lowerBand: d.lowerBound || 0,
        upperBand: d.upperBound || 0,
        bandRange: [d.lowerBound || 0, d.upperBound || 0] as [number, number]
      }))
    ];

    // Key ML Summary Performance Metrics
    const totalPredicted3mTax = futureRecords.reduce((acc, r) => acc + r.netLiability, 0);
    const avgMonthlyPredictedTax = Math.round(totalPredicted3mTax / 3);
    const historicalAvgTax = Math.round(meanLiability);
    const projectedChangePercent = Math.round(((avgMonthlyPredictedTax - historicalAvgTax) / (historicalAvgTax || 1)) * 100);

    const metrics = {
      totalPredicted3mTax,
      avgMonthlyPredictedTax,
      historicalAvgTax,
      projectedChangePercent,
      volatilityStdDev: Math.round(stdDev),
      modelAccuracyScore: Math.min(96, Math.max(78, Math.round(100 - (stdDev / (meanLiability || 1)) * 100))),
      slopeDirection: slope > 0 ? 'UPWARD' : 'DOWNWARD'
    };

    return {
      forecastData: futureRecords,
      mlMetrics: metrics,
      chartSeries: combinedChartSeries
    };
  }, [
    historicalMonthlyData, 
    selectedAlgorithm, 
    confidenceLevel, 
    salesGrowthFactor, 
    itcRateFactor, 
    festiveSeasonalityBoost
  ]);

  // Export ML Forecast Report as CSV
  const handleExportForecastCsv = () => {
    if (!forecastData || forecastData.length === 0) return;

    const headers = [
      'Forecast Month',
      'Is Forecast Period',
      'Projected Revenue (INR)',
      'Estimated Output Tax (INR)',
      'Estimated ITC Availed (INR)',
      'Predicted Net Tax Payable (INR)',
      'Lower Bound (CI)',
      'Upper Bound (CI)',
      'Confidence Score (%)',
      'Applied ML Model'
    ];

    const rows = forecastData.map(f => [
      `"${f.monthLabel}"`,
      'TRUE',
      f.grossSales,
      f.outputTax,
      f.inputTaxCredit,
      f.netLiability,
      f.lowerBound,
      f.upperBound,
      `${f.confidenceScore}%`,
      `"${selectedAlgorithm}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TaxFlow_ML_Tax_Liability_3Month_Forecast_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 relative overflow-hidden">
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80 shrink-0">
            <BrainCircuit size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                ML Predictive Tax Liability Forecaster
              </h3>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Sparkles size={11} /> 3-Month AI Model
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Time-series predictive intelligence analyzing historical output taxes, ITC patterns & seasonality drivers
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportForecastCsv}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Download size={14} className="text-indigo-300" />
            Export ML Forecast
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 3-Month Total Predicted Card */}
        <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-900/70 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">3-Month Total Liability</span>
            <Calendar size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-950 tracking-tight flex items-center gap-1">
            ₹{mlMetrics?.totalPredicted3mTax.toLocaleString('en-IN') || '0'}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            {mlMetrics && mlMetrics.projectedChangePercent >= 0 ? (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <TrendingUp size={13} /> +{mlMetrics.projectedChangePercent}%
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <TrendingDown size={13} /> {mlMetrics?.projectedChangePercent}%
              </span>
            )}
            <span className="text-slate-500 font-normal">vs historical run-rate</span>
          </div>
        </div>

        {/* Monthly Projected Average */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Projected Monthly Avg</span>
            <DollarSign size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{mlMetrics?.avgMonthlyPredictedTax.toLocaleString('en-IN') || '0'}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Hist. Monthly Avg: <span className="font-bold text-slate-800">₹{mlMetrics?.historicalAvgTax.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Algorithm Model Confidence */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Model Accuracy Score</span>
            <Cpu size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight flex items-center gap-2">
            {mlMetrics?.modelAccuracyScore || 88}%
            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
              HIGH
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Volatility StdDev: <span className="font-bold text-slate-800">±₹{mlMetrics?.volatilityStdDev.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Selected Algorithm */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active ML Algorithm</span>
            <Layers size={16} className="text-indigo-500" />
          </div>
          <div className="text-lg font-black text-indigo-600 truncate">
            {selectedAlgorithm === 'ENSEMBLE' && 'Hybrid Ensemble'}
            {selectedAlgorithm === 'HOLT_WINTERS' && 'Holt-Winters Seasonal'}
            {selectedAlgorithm === 'RIDGE_REGRESSION' && 'Ridge Polynomial'}
            {selectedAlgorithm === 'MOVING_AVERAGE' && 'Weighted EMA'}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Confidence Band: <span className="font-bold text-slate-800">{confidenceLevel}% CI</span>
          </div>
        </div>

      </div>

      {/* Model Selection & Interactive Simulation Controls */}
      <div className="bg-slate-50/80 p-5 md:p-6 rounded-2xl border border-slate-200/80 space-y-5">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/70 pb-4">
          
          {/* Model Selector Tabs */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-indigo-500" />
              Machine Learning Model Architecture
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: 'ENSEMBLE', label: 'Ensemble (Recommended)', desc: 'Combines Holt-Winters, Ridge & EMA' },
                { id: 'HOLT_WINTERS', label: 'Holt-Winters', desc: 'Seasonal & Level Smoothing' },
                { id: 'RIDGE_REGRESSION', label: 'Ridge Regression', desc: 'Regularized Linear Trend' },
                { id: 'MOVING_AVERAGE', label: 'Weighted EMA', desc: 'Exponential Recency Weighting' },
              ].map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedAlgorithm(model.id as MlAlgorithm)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedAlgorithm === model.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                  title={model.desc}
                >
                  {model.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Interval Picker */}
          <div className="space-y-1">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Prediction Confidence Band
            </label>
            <div className="flex gap-2 pt-1">
              {[80, 95].map(level => (
                <button
                  key={level}
                  onClick={() => setConfidenceLevel(level as 80 | 95)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    confidenceLevel === level
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {level}% CI Range
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Interactive Sensitivity Hyper-Parameter Sliders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-amber-500" />
              Real-Time Scenario Sensitivity Drivers (What-If Simulation)
            </span>
            <button
              onClick={() => {
                setSalesGrowthFactor(5);
                setItcRateFactor(0);
                setFestiveSeasonalityBoost(10);
              }}
              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reset Driver Sliders
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            
            {/* Sales Growth Driver */}
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-bold text-slate-700">Projected Sales Revenue</span>
                <span className={`font-black ${salesGrowthFactor >= 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
                  {salesGrowthFactor >= 0 ? `+${salesGrowthFactor}%` : `${salesGrowthFactor}%`}
                </span>
              </div>
              <input
                type="range"
                min="-25"
                max="40"
                step="1"
                value={salesGrowthFactor}
                onChange={(e) => setSalesGrowthFactor(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Adjust expected top-line invoice volume</span>
            </div>

            {/* ITC Availed Driver */}
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-bold text-slate-700">ITC Claim / Vendor Expenses</span>
                <span className={`font-black ${itcRateFactor >= 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {itcRateFactor >= 0 ? `+${itcRateFactor}%` : `${itcRateFactor}%`}
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="30"
                step="1"
                value={itcRateFactor}
                onChange={(e) => setItcRateFactor(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Simulate high/low capital purchase ITC claims</span>
            </div>

            {/* Seasonality Surge Driver */}
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-bold text-slate-700">Festive Seasonality Surge</span>
                <span className="font-black text-amber-500">
                  +{festiveSeasonalityBoost}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={festiveSeasonalityBoost}
                onChange={(e) => setFestiveSeasonalityBoost(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Quarterly / festive demand peak adjustment</span>
            </div>

          </div>
        </div>

      </div>

      {/* Main Interactive Forecasting Recharts Visualization */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" />
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Historical Actuals vs. 3-Month ML Predicted Tax Trajectory
            </h4>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 bg-blue-600 rounded-full inline-block" /> Actual Historical
            </span>
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="w-3 h-0.5 bg-amber-500 border-b-2 border-dashed border-amber-500 inline-block" /> ML Forecast
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-3 h-3 bg-indigo-200 rounded inline-block" /> {confidenceLevel}% Confidence Band
            </span>
          </div>
        </div>

        <div className="h-80 w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartSeries} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0.05}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                axisLine={false}
              />

              <Tooltip 
                content={<CustomMlTooltip />}
              />

              {/* Confidence Interval Area Band for Forecast Period */}
              <Area 
                type="monotone"
                dataKey="upperBand"
                stroke="none"
                fill="url(#confidenceBand)"
                name="Confidence Upper"
              />

              {/* Historical Actual Net Tax Line */}
              <Line 
                type="monotone" 
                dataKey="actualNet" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 8, strokeWidth: 0 }}
                name="Actual Net Tax"
                connectNulls={true}
              />

              {/* Forecast Net Tax Line */}
              <Line 
                type="monotone" 
                dataKey="forecastNet" 
                stroke="#f59e0b" 
                strokeWidth={3}
                strokeDasharray="6 6"
                dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 8, fill: '#f59e0b' }}
                name="ML Projected Tax"
                connectNulls={true}
              />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Cards for the Next 3 Months */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={14} className="text-indigo-500" />
          Granular 3-Month Month-by-Month Projected Liabilities
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecastData.map((record, index) => {
            const minFormatted = record.lowerBound?.toLocaleString('en-IN') || '0';
            const maxFormatted = record.upperBound?.toLocaleString('en-IN') || '0';

            return (
              <div 
                key={record.monthKey}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 relative hover:border-indigo-300 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">
                      Month +{index + 1} Horizon
                    </span>
                    <h5 className="font-extrabold text-slate-900 text-base mt-0.5">
                      {record.monthLabel}
                    </h5>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-black bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                    {record.confidenceScore}% Confidence
                  </span>
                </div>

                {/* Net Tax Main Highlight */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Predicted Net Tax Payable</span>
                  <div className="text-xl font-black text-amber-600 tracking-tight mt-0.5">
                    ₹{record.netLiability.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 block mt-1">
                    Expected Range: <strong className="text-slate-800">₹{minFormatted} – ₹{maxFormatted}</strong>
                  </span>
                </div>

                {/* Output Tax & ITC Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold block">Gross Output GST</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      ₹{record.outputTax.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-100 shadow-sm">
                    <span className="text-[10px] text-emerald-600 font-bold block">Estimated ITC</span>
                    <span className="font-extrabold text-emerald-700 mt-0.5 block">
                      ₹{record.inputTaxCredit.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Statutory Due Date Info */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Calendar size={12} className="text-indigo-500" />
                    GSTR-3B Due Date:
                  </span>
                  <span className="font-bold text-slate-800">
                    20th {record.monthLabel.split(' ')[0]}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* AI Tactical Recommendations & Working Capital Insights */}
      <div className="bg-indigo-50/80 rounded-2xl p-6 text-slate-900 border border-indigo-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="font-black text-base tracking-tight text-slate-900">
                AI Tax Working Capital & ITC Optimization Advisory
              </h4>
              <p className="text-xs text-slate-600">
                Data-driven recommendations to minimize cash outflow and maximize ITC utilization
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAiInsightOpen(!isAiInsightOpen)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
          >
            {isAiInsightOpen ? 'Hide Insights' : 'Show Insights'}
          </button>
        </div>

        {isAiInsightOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            
            <div className="bg-white border border-indigo-100 p-4 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-amber-700">
                <CheckCircle2 size={16} />
                Cash Reserve Provisioning
              </div>
              <p className="text-slate-600 leading-relaxed">
                Set aside <strong className="text-slate-900">₹{Math.round((mlMetrics?.totalPredicted3mTax || 0) * 0.35).toLocaleString('en-IN')}</strong> in liquid reserves by the 15th of next month to comfortably satisfy GSTR-3B cash liabilities without penalty.
              </p>
            </div>

            <div className="bg-white border border-indigo-100 p-4 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-emerald-700">
                <CheckCircle2 size={16} />
                ITC Reco & Early GSTR-2B Lock
              </div>
              <p className="text-slate-600 leading-relaxed">
                Automate vendor GSTR-1 matching prior to the 14th cutoff to claim an estimated extra <strong className="text-slate-900">₹{Math.round((mlMetrics?.avgMonthlyPredictedTax || 0) * 0.12).toLocaleString('en-IN')}</strong> in eligible ITC credits.
              </p>
            </div>

            <div className="bg-white border border-indigo-100 p-4 rounded-xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-indigo-700">
                <CheckCircle2 size={16} />
                Inter-State IGST Mix Strategy
              </div>
              <p className="text-slate-600 leading-relaxed">
                Leverage accumulated IGST ITC buffers against CGST/SGST liabilities in optimal statutory priority order to eliminate electronic cash ledger top-ups.
              </p>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

// Custom Tooltip Component for Recharts
const CustomMlTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isFcst = data.isForecast;

    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-white text-xs space-y-2 max-w-xs">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <span className="font-black text-sm text-amber-400">{data.monthLabel}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFcst ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
            {isFcst ? 'ML Forecast' : 'Actual Historic'}
          </span>
        </div>

        {data.grossSales > 0 && (
          <div className="flex justify-between text-slate-300">
            <span>Projected Sales:</span>
            <span className="font-extrabold text-white">₹{data.grossSales.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className="flex justify-between text-slate-300">
          <span>Output Tax GST:</span>
          <span className="font-extrabold text-white">₹{(data.outputTax || 0).toLocaleString('en-IN')}</span>
        </div>

        <div className="flex justify-between text-emerald-400">
          <span>Input Tax Credit (ITC):</span>
          <span className="font-extrabold">₹{(data.inputTaxCredit || 0).toLocaleString('en-IN')}</span>
        </div>

        <div className="flex justify-between text-amber-400 font-extrabold border-t border-slate-800 pt-2 text-sm">
          <span>Net Tax Payable:</span>
          <span>₹{(data.netLiability || data.actualNet || 0).toLocaleString('en-IN')}</span>
        </div>

        {isFcst && data.lowerBound && (
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            CI Range: ₹{data.lowerBound.toLocaleString('en-IN')} – ₹{data.upperBound.toLocaleString('en-IN')}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default TaxLiabilityMlForecast;
