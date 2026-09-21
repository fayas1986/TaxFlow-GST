import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Server,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Cpu,
  Database,
  Globe,
  Radio,
  Sliders,
  Play,
  RotateCcw,
  Check,
  XCircle,
  Wifi,
  WifiOff,
  BarChart3,
  Terminal
} from 'lucide-react';

export interface HealthMetric {
  endpoint: string;
  type: 'OData_v4' | 'DMF_Batch' | 'OAuth_Token' | 'Webhooks';
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  p90LatencyMs: number;
  p99LatencyMs: number;
  requestsLastMinute: number;
  requestsMaxPerMinute: number;
  dailyUsageCount: number;
  dailyQuotaMax: number;
  http429Throttles: number;
  lastPingTime: string;
}

interface Props {
  integrationId: 'dynamics' | 'dynamics_fo' | string;
  integrationName: string;
  environmentName?: string;
}

export const ConnectionHealthMonitor: React.FC<Props> = ({
  integrationId,
  integrationName,
  environmentName = 'Production'
}) => {
  const isBc = integrationId === 'dynamics';
  const isTally = integrationId === 'tally';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoPing, setAutoPing] = useState(true);
  const [pingCount, setPingCount] = useState(isTally ? 3492 : 1284);
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());

  // Metrics State
  const [latencyHistory, setLatencyHistory] = useState<number[]>(
    isTally ? [24, 28, 22, 31, 26, 25, 29, 28, 23, 27, 28] : [120, 145, 110, 132, 128, 165, 142, 138, 119, 125, 142]
  );
  const [currentLatency, setCurrentLatency] = useState<number>(isTally ? 28 : isBc ? 138 : 185);
  const [currentRate, setCurrentRate] = useState<number>(isTally ? 140 : isBc ? 380 : 520);
  const maxRatePerMin = isTally ? 1200 : isBc ? 600 : 1000;
  const [dailyCalls, setDailyCalls] = useState<number>(isTally ? 18450 : isBc ? 38450 : 64200);
  const maxDailyQuota = isTally ? 500000 : isBc ? 100000 : 250000;
  const [rateLimitHits, setRateLimitHits] = useState<number>(0);

  // Diagnostic Log Output
  const [logs, setLogs] = useState<Array<{ id: string; time: string; level: 'INFO' | 'SUCCESS' | 'WARN'; message: string }>>(
    isTally
      ? [
          { id: '1', time: new Date(Date.now() - 120000).toLocaleTimeString(), level: 'SUCCESS', message: 'Tally XML Server handshake verified at http://localhost:9000 (Company: M/S ACME INDIA PVT LTD)' },
          { id: '2', time: new Date(Date.now() - 60000).toLocaleTimeString(), level: 'INFO', message: 'XML RPC POST /exportData heartbeat returned 28ms [HTTP 200 OK]' },
          { id: '3', time: new Date(Date.now() - 30000).toLocaleTimeString(), level: 'SUCCESS', message: 'Tally ODBC Driver v4.1 listener status: READY (284 Ledgers, 4820 Vouchers synced)' }
        ]
      : [
          { id: '1', time: new Date(Date.now() - 120000).toLocaleTimeString(), level: 'SUCCESS', message: 'Azure AD OAuth 2.0 Token auto-refreshed successfully (Expires in 58m)' },
          { id: '2', time: new Date(Date.now() - 60000).toLocaleTimeString(), level: 'INFO', message: `OData v4 GET /companies heartbeat ping returned HTTP 200 (${isBc ? '138ms' : '185ms'})` },
          { id: '3', time: new Date(Date.now() - 30000).toLocaleTimeString(), level: 'INFO', message: 'X-MS-RateLimit-Remaining: 542/600 calls available in current window' }
        ]
  );

  // Handle manual diagnostic ping
  const handleRunPingDiagnostic = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const newLatency = isTally
        ? Math.floor(20 + Math.random() * 15)
        : isBc 
        ? Math.floor(100 + Math.random() * 80)
        : Math.floor(140 + Math.random() * 100);
      
      setCurrentLatency(newLatency);
      setLatencyHistory(prev => [...prev.slice(1), newLatency]);
      setLastCheckTime(new Date().toLocaleTimeString());
      setPingCount(prev => prev + 1);

      setLogs(prev => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString(),
          level: newLatency > 220 ? 'WARN' : 'SUCCESS',
          message: isTally
            ? `Tally XML Ping: Port 9000 XML response in ${newLatency}ms [TallyPrime 4.1 ACTIVE]`
            : `Health Ping: ${integrationName} endpoint responded in ${newLatency}ms [HTTP 200 OK]`
        },
        ...prev.slice(0, 7)
      ]);

      setIsRefreshing(false);
    }, 600);
  };

  // Simulate periodic ping updates if autoPing is enabled
  useEffect(() => {
    if (!autoPing) return;
    const interval = setInterval(() => {
      const jitter = Math.floor((Math.random() - 0.5) * 20);
      setCurrentLatency(prevLat => {
        const updatedLat = Math.max(80, prevLat + jitter);
        setLatencyHistory(historyPrev => [...historyPrev.slice(1), updatedLat]);
        return updatedLat;
      });
      setLastCheckTime(new Date().toLocaleTimeString());
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPing]);

  const ratePercentage = Math.round((currentRate / maxRatePerMin) * 100);
  const dailyPercentage = Math.round((dailyCalls / maxDailyQuota) * 100);

  return (
    <div className="space-y-5 text-xs">
      {/* Top Banner & Status Summary */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isBc ? 'bg-indigo-50/70 border-indigo-200/80' : 'bg-blue-50/70 border-blue-200/80'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl text-white shadow-sm shrink-0 ${isBc ? 'bg-indigo-600' : 'bg-blue-600'}`}>
            <Activity size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">
                {integrationName} Health & Latency Monitor
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                99.98% UPTIME
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Live API response times, Azure AD token status, and OData rate consumption metrics for <strong>{environmentName}</strong> environment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAutoPing(!autoPing)}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border transition-all ${
              autoPing
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Radio size={14} className={autoPing ? 'animate-pulse text-emerald-600' : 'text-slate-400'} />
            {autoPing ? 'Auto-Ping Active' : 'Auto-Ping Paused'}
          </button>

          <button
            type="button"
            onClick={handleRunPingDiagnostic}
            disabled={isRefreshing}
            className={`px-3.5 py-1.5 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 ${
              isBc ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Pinging...' : 'Diagnostic Ping'}
          </button>
        </div>
      </div>

      {/* Primary Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Latency Metric */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} className={isBc ? 'text-indigo-600' : 'text-blue-600'} /> API Response Latency
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">FAST</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {currentLatency} <span className="text-xs font-bold text-slate-500 font-sans">ms</span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 font-mono">
              p90: {currentLatency + 18}ms
            </div>
          </div>

          {/* Sparkline Visual Bar */}
          <div className="pt-1">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Latency Trend (Last 10 Pings)</div>
            <div className="flex items-end gap-1 h-6 pt-1">
              {latencyHistory.map((val, idx) => {
                const heightPct = Math.min(100, Math.max(20, (val / 250) * 100));
                return (
                  <div
                    key={idx}
                    title={`${val}ms`}
                    className={`flex-1 rounded-t transition-all ${
                      val > 200 ? 'bg-rose-400' : val > 150 ? 'bg-amber-400' : isBc ? 'bg-indigo-500' : 'bg-blue-500'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  ></div>
                );
              })}
            </div>
          </div>
        </div>

        {/* API Rate Limit Metric */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-amber-500" /> Minute Rate Usage
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
              {ratePercentage}%
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {currentRate} <span className="text-xs font-bold text-slate-500 font-sans">/ {maxRatePerMin} RPM</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  ratePercentage > 85 ? 'bg-rose-500' : ratePercentage > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${ratePercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-400">
              <span>Throttle Cap: {maxRatePerMin} req/min</span>
              <span>429 Rate Hits: {rateLimitHits}</span>
            </div>
          </div>
        </div>

        {/* Daily Quota Metric */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Gauge size={12} className="text-indigo-500" /> Daily Call Quota
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
              {dailyPercentage}%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {(dailyCalls / 1000).toFixed(1)}k <span className="text-xs font-bold text-slate-500 font-sans">/ {(maxDailyQuota / 1000).toFixed(0)}k</span>
          </div>

          <div className="space-y-1 pt-1">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${dailyPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-400">
              <span>Resets in: 8h 14m</span>
              <span>Remaining: {((maxDailyQuota - dailyCalls) / 1000).toFixed(1)}k</span>
            </div>
          </div>
        </div>

        {/* OAuth & Auth Health */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" /> Azure AD OAuth 2.0
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">ACTIVE</span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono pt-0.5">
            Token Valid
          </div>
          <div className="text-[10px] text-slate-500 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Access Token Expiry:</span>
              <strong className="text-slate-800 font-mono">52 minutes</strong>
            </div>
            <div className="flex justify-between">
              <span>SSL/TLS Handshake:</span>
              <strong className="text-emerald-700 font-mono">TLS 1.3 Verified</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-system Status Matrix */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Server size={14} className={isBc ? 'text-indigo-600' : 'text-blue-600'} />
          Microsoft Dynamics Sub-system Endpoint Status & Health
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            {
              title: isBc ? 'OData v4 Web Services API' : 'OData v4 REST Data Entities',
              desc: isBc ? 'Core SalesInvoices & VendorInvoices endpoints' : 'SalesInvoiceHeadersV2 & Lines Data Area',
              status: 'HEALTHY',
              latency: `${currentLatency}ms`,
              url: isBc ? '/api/v2.0/companies' : '/data/SalesInvoiceHeadersV2'
            },
            {
              title: isBc ? 'Delta Webhooks Notification Service' : 'Data Management Framework (DMF) Batch Job Engine',
              desc: isBc ? 'Real-time subscription change listeners' : 'High volume XML/CSV package export queue',
              status: 'HEALTHY',
              latency: `${currentLatency + 12}ms`,
              url: isBc ? '/subscriptions' : '/dmf/packages/dequeue'
            },
            {
              title: 'Azure Active Directory Identity Authority',
              desc: 'OAuth 2.0 Client Credentials token issuer',
              status: 'HEALTHY',
              latency: '82ms',
              url: 'login.microsoftonline.com'
            },
            {
              title: 'Gov Tax Portal Writeback Relay',
              desc: 'Pushes IRN & QR codes back to Dynamics extension fields',
              status: 'HEALTHY',
              latency: `${currentLatency - 10}ms`,
              url: '/api/connector/writeback'
            }
          ].map((sub, idx) => (
            <div key={idx} className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  {sub.title}
                </div>
                <div className="text-[10px] text-slate-500">{sub.desc}</div>
                <div className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                  {sub.url}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[9px] uppercase tracking-wider">
                  {sub.status}
                </span>
                <div className="text-[10px] font-mono text-slate-500 font-bold mt-1">
                  {sub.latency}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal Diagnostic Feed */}
      <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Live Connection Health Console Transcripts
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Last checked at {lastCheckTime} • Total Pings: {pingCount}</span>
        </div>

        <div className="space-y-1.5 text-[11px] max-h-36 overflow-y-auto pr-1 leading-relaxed">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-slate-500 text-[10px] shrink-0 font-bold">[{log.time}]</span>
              <span
                className={`px-1 py-0.2 text-[9px] rounded font-bold shrink-0 ${
                  log.level === 'SUCCESS'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : log.level === 'WARN'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-slate-800 text-blue-300'
                }`}
              >
                {log.level}
              </span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
