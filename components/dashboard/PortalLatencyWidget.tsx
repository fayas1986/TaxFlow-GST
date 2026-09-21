import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Activity, RefreshCw, Zap, CheckCircle2, AlertTriangle, 
  Clock, ShieldCheck, Wifi, ExternalLink, ArrowUpRight, ArrowDownRight, Radio
} from 'lucide-react';
import { fetchGstPortalHealth, pingGstPortalEndpoints } from '../../services/api';
import { GstPortalHealthSummary, LatencyTimePoint } from '../../types';

export const PortalLatencyWidget: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chartType, setChartType] = useState<'timeSeries' | 'comparison'>('timeSeries');
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccessMsg, setPingSuccessMsg] = useState<string | null>(null);

  // Active portal filters for Recharts lines
  const [visiblePortals, setVisiblePortals] = useState({
    gstn: true,
    irp: true,
    ewb: true,
    gstin: true,
  });

  // Query to fetch health summary
  const { data: healthData, isLoading, refetch, isFetching } = useQuery<GstPortalHealthSummary>({
    queryKey: ['gstPortalHealth'],
    queryFn: fetchGstPortalHealth,
    refetchInterval: autoRefresh ? 4000 : false,
  });

  // Time-series history kept in local state so real-time pings dynamically push new ticks
  const [liveHistory, setLiveHistory] = useState<LatencyTimePoint[]>([]);

  useEffect(() => {
    if (healthData?.history) {
      setLiveHistory(healthData.history);
    }
  }, [healthData]);

  const handlePingAll = async () => {
    setIsPinging(true);
    setPingSuccessMsg(null);
    try {
      const res = await pingGstPortalEndpoints();
      if (res.success) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        
        const gstn = res.pings['ep-gstn'] || 110;
        const irp = res.pings['ep-irp'] || 75;
        const ewb = res.pings['ep-ewb'] || 135;
        const gstin = res.pings['ep-gstin'] || 50;
        const avg = Math.round((gstn + irp + ewb + gstin) / 4);

        const newPoint: LatencyTimePoint = {
          time: timeStr,
          timestamp: now.getTime(),
          gstnLatency: gstn,
          irpLatency: irp,
          ewbLatency: ewb,
          gstinLatency: gstin,
          overallAvgLatency: avg,
          targetSla: 200,
        };

        setLiveHistory(prev => [...prev.slice(1), newPoint]);
        setPingSuccessMsg(`Pinged 4 tax gateways successfully in ${avg}ms!`);
        setTimeout(() => setPingSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('Ping failed', err);
    } finally {
      setIsPinging(false);
    }
  };

  const togglePortal = (key: keyof typeof visiblePortals) => {
    setVisiblePortals(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading || !healthData) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs flex items-center justify-center h-80 text-slate-400">
        <RefreshCw className="animate-spin mr-2" size={20} /> Loading Real-Time GST Portal Metrics...
      </div>
    );
  }

  // Calculate quick current averages from history
  const latestPoint = liveHistory.length > 0 ? liveHistory[liveHistory.length - 1] : null;
  const currentAvgLatency = latestPoint ? latestPoint.overallAvgLatency : healthData.avgLatencyMs;

  const portalConfig = [
    { key: 'gstnLatency', name: 'GSTN Filing API', color: '#2563eb', field: 'gstn' as const },
    { key: 'irpLatency', name: 'IRP e-Invoicing', color: '#10b981', field: 'irp' as const },
    { key: 'ewbLatency', name: 'e-Way Bill Gateway', color: '#f59e0b', field: 'ewb' as const },
    { key: 'gstinLatency', name: 'GSTIN Directory', color: '#8b5cf6', field: 'gstin' as const },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Widget Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/80">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  GST Portal Connection & API Latency Monitor
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Real-time API response benchmarks, HTTP roundtrip latency, and SLA compliance across official tax gateways
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Chart View Switcher */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setChartType('timeSeries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartType === 'timeSeries'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Latency Trend
            </button>
            <button
              onClick={() => setChartType('comparison')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartType === 'comparison'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Portal Breakdown
            </button>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
            title="Toggle 4-second auto-refresh polling"
          >
            <Radio size={14} className={autoRefresh ? 'text-blue-600 animate-pulse' : 'text-slate-400'} />
            {autoRefresh ? 'Polling Active' : 'Polling Paused'}
          </button>

          {/* Ping All Gateway APIs */}
          <button
            onClick={handlePingAll}
            disabled={isPinging}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Zap size={14} className={isPinging ? 'animate-bounce text-amber-300' : 'text-amber-400'} />
            {isPinging ? 'Pinging Gateways...' : 'Ping All APIs'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Manual data refresh"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Toast Banner for Ping Notification */}
      {pingSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{pingSuccessMsg}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-600">Updated Recharts Dataset</span>
        </div>
      )}

      {/* High-Level Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Latency */}
        <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
            <span>Overall Avg Latency</span>
            <Clock size={14} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{currentAvgLatency} <span className="text-sm font-semibold text-slate-500">ms</span></span>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center">
              <ArrowDownRight size={12} /> -14ms
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Target SLA: &lt; 200ms</p>
        </div>

        {/* Success Rate */}
        <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
            <span>Gateway Success Rate</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{healthData.overallSuccessRate}%</span>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center">
              <ArrowUpRight size={12} /> +0.02%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">HTTP 200 OK responses</p>
        </div>

        {/* Uptime SLA */}
        <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
            <span>24h System Uptime</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{healthData.uptime24h}%</span>
            <span className="text-[11px] font-bold text-slate-400">99.9% SLA</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">0 active outages</p>
        </div>

        {/* Request Throughput */}
        <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
            <span>API Throughput (1h)</span>
            <Wifi size={14} className="text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{healthData.totalRequests1h.toLocaleString()}</span>
            <span className="text-[11px] font-bold text-blue-600">64 req/min</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Across all connected tenants</p>
        </div>
      </div>

      {/* Main Recharts Visual Area */}
      <div className="p-5 bg-slate-50/50 border border-slate-200/60 rounded-2xl space-y-4">
        {/* Chart Header & Interactive Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {chartType === 'timeSeries' ? 'Real-Time API Latency Time-Series (ms)' : 'Latency Benchmark Comparison Across Gateways'}
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              {chartType === 'timeSeries' ? 'Click gateway pills below to toggle lines on/off' : 'Compare current response times against SLA thresholds'}
            </p>
          </div>

          {/* Interactive Legend / Filters for Time-Series */}
          {chartType === 'timeSeries' && (
            <div className="flex flex-wrap items-center gap-2">
              {portalConfig.map((item) => (
                <button
                  key={item.field}
                  onClick={() => togglePortal(item.field)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
                    visiblePortals[item.field]
                      ? 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                      : 'bg-slate-100 border-transparent text-slate-400 line-through'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: visiblePortals[item.field] ? item.color : '#cbd5e1' }}
                  ></span>
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recharts Chart Component */}
        <div className="h-72 w-full pt-2">
          {chartType === 'timeSeries' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gstnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="irpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="ewbGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="gstinGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" domain={[0, 'auto']} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-2 border border-slate-700 min-w-[200px]">
                          <div className="font-bold border-b border-slate-700 pb-1.5 flex justify-between items-center">
                            <span>Time: {label}</span>
                            <span className="text-[10px] text-emerald-400 font-mono">SLA Target &lt;200ms</span>
                          </div>
                          <div className="space-y-1">
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                  {entry.name}:
                                </span>
                                <span className="font-mono font-bold text-white">{entry.value} ms</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={200} label={{ value: 'Target SLA (200ms)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} stroke="#ef4444" strokeDasharray="4 4" />

                {visiblePortals.gstn && (
                  <Area
                    type="monotone"
                    dataKey="gstnLatency"
                    name="GSTN Filing"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#gstnGrad)"
                  />
                )}
                {visiblePortals.irp && (
                  <Area
                    type="monotone"
                    dataKey="irpLatency"
                    name="IRP e-Invoicing"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#irpGrad)"
                  />
                )}
                {visiblePortals.ewb && (
                  <Area
                    type="monotone"
                    dataKey="ewbLatency"
                    name="e-Way Bill"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#ewbGrad)"
                  />
                )}
                {visiblePortals.gstin && (
                  <Area
                    type="monotone"
                    dataKey="gstinLatency"
                    name="GSTIN Directory"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#gstinGrad)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={healthData.endpoints.map(e => ({
                  name: e.name.split(' ')[0] + ' Gateway',
                  fullName: e.name,
                  latency: e.currentLatencyMs,
                  p95: e.p95LatencyMs,
                  avg: e.avgLatencyMs,
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="ms" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 border border-slate-700">
                          <p className="font-bold">{data.fullName}</p>
                          <p className="text-blue-400 font-mono">Current Latency: {data.latency} ms</p>
                          <p className="text-slate-300 font-mono">Average (24h): {data.avg} ms</p>
                          <p className="text-amber-400 font-mono">P95 Latency: {data.p95} ms</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'SLA Max (200ms)', fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="latency" name="Current Latency (ms)" radius={[8, 8, 0, 0]}>
                  {healthData.endpoints.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.currentLatencyMs < 100
                          ? '#10b981'
                          : entry.currentLatencyMs < 180
                          ? '#2563eb'
                          : '#f59e0b'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gateway Endpoint Detailed Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Connected Tax Gateway Endpoints Status
          </h4>
          <span className="text-xs font-semibold text-slate-400">4 Active Gateways Operational</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {healthData.endpoints.map((ep) => {
            const isFast = ep.currentLatencyMs < 100;
            const isModerate = ep.currentLatencyMs >= 100 && ep.currentLatencyMs <= 180;
            return (
              <div
                key={ep.id}
                className="p-4 bg-white border border-slate-200/80 rounded-2xl hover:border-blue-300 transition-all shadow-2xs space-y-3 group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md uppercase mb-1">
                      {ep.category}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1" title={ep.name}>
                      {ep.name}
                    </h5>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <CheckCircle2 size={12} />
                    Active
                  </span>
                </div>

                <div className="flex justify-between items-end border-t border-slate-100 pt-2.5">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Response Time</p>
                    <p className="text-lg font-black text-slate-900 flex items-center gap-1">
                      {ep.currentLatencyMs} <span className="text-xs font-normal text-slate-500">ms</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">P95 / Success</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">
                      {ep.p95LatencyMs}ms | {ep.successRatePercent}%
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 truncate font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="truncate max-w-[140px]">{ep.endpointUrl}</span>
                  <ExternalLink size={10} className="shrink-0 text-slate-300 group-hover:text-blue-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PortalLatencyWidget;
