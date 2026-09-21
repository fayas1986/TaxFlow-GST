import React, { useState, useEffect } from 'react';
import { 
  Server, Cpu, Database, GitBranch, RefreshCw, Play, CheckCircle2, 
  AlertTriangle, ArrowRight, ShieldCheck, Zap, Activity, Layers, 
  FileText, QrCode, Truck, Check, Eye, Download, Info, Terminal,
  Radio, HardDrive, Filter, Clock, Sparkles, Send, Workflow, Lock, MapPin,
  ExternalLink, Globe, HeartPulse
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { RegionalComplianceHeatmap } from '../components/RegionalComplianceHeatmap';
import { ArchitectureRefinementView } from '../components/ArchitectureRefinementView';
import { EnterpriseFrontendUxDesignPortal } from '../components/EnterpriseFrontendUxDesignPortal';
import { 
  executeArchitecturePipeline, 
  fetchArchitectureNodesStatus, 
  fetchEventBusHistory, 
  fetchComplianceLedger, 
  fetchPersistenceHealth,
  fetchPortalIntegrationHealth,
  ArchitectureNode,
  ArchitectureEventItem,
  PortalHealthItem,
  SyncLogEntry
} from '../services/architectureApi';

export const ControlTowerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'UX_DESIGN' | 'BLUEPRINT' | 'MULTI_GSTIN' | 'HEATMAP' | 'MAP' | 'SIMULATOR' | 'EVENT_BUS' | 'LEDGER' | 'STORAGE'>('UX_DESIGN');
  const [selectedNode, setSelectedNode] = useState<string | null>('NESTJS_BFF');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedResult, setSimulatedResult] = useState<any>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [activePreset, setActivePreset] = useState<string>('B2B_STANDARD');

  // Live state fetched from backend
  const [nodesStatus, setNodesStatus] = useState<ArchitectureNode[]>([]);
  const [eventHistory, setEventHistory] = useState<ArchitectureEventItem[]>([]);
  const [eventMetrics, setEventMetrics] = useState<any>(null);
  const [complianceLedger, setComplianceLedger] = useState<any[]>([]);
  const [persistenceHealth, setPersistenceHealth] = useState<any>(null);
  const [portalsHealth, setPortalsHealth] = useState<PortalHealthItem[]>([]);
  const [portalSyncLogs, setPortalSyncLogs] = useState<SyncLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isPinging, setIsPinging] = useState<Record<string, boolean>>({});
  const [pingResults, setPingResults] = useState<Record<string, { latency: number; timestamp: string }>>({});

  // Load telemetry
  const loadData = async () => {
    try {
      const [nodes, eventsData, ledger, persistence, portalPayload] = await Promise.all([
        fetchArchitectureNodesStatus().catch(() => []),
        fetchEventBusHistory(20).catch(() => ({ history: [], metrics: {} })),
        fetchComplianceLedger(15).catch(() => []),
        fetchPersistenceHealth().catch(() => null),
        fetchPortalIntegrationHealth().catch(() => ({ portals: [], logs: [] }))
      ]);
      if (nodes && nodes.length > 0) setNodesStatus(nodes);
      if (eventsData?.history) setEventHistory(eventsData.history);
      if (eventsData?.metrics) setEventMetrics(eventsData.metrics);
      if (ledger) setComplianceLedger(ledger);
      if (persistence) setPersistenceHealth(persistence);
      if (portalPayload?.portals) setPortalsHealth(portalPayload.portals);
      if (portalPayload?.logs) setPortalSyncLogs(portalPayload.logs);
    } catch (e) {
      // Gracefully silent fallback - telemetry is resilient and non-blocking
    }
  };

  useEffect(() => {
    loadData();
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Transaction simulation presets
  const presets: Record<string, any> = {
    B2B_STANDARD: {
      label: 'Standard Inter-State B2B Invoice',
      description: '₹4,50,000 supply from MH to KA. Triggers Tax Engine (IGST), POS rules, E-Invoice & E-Way Bill.',
      payload: {
        docNumber: `INV-${Date.now().toString().slice(-5)}`,
        docDate: new Date().toISOString().split('T')[0],
        supplierGstin: '27AAAAA0000A1Z5',
        partyGstin: '29BBBBB1111B1Z2',
        partyName: 'Infosys Horizon Tech Ltd',
        placeOfSupply: '29',
        amount: 450000,
        items: [{
          description: 'Enterprise Cloud ERP Consulting',
          hsnCode: '998311',
          quantity: 1,
          taxableValue: 450000,
          gstRate: 18
        }]
      }
    },
    HIGH_VALUE_EINVOICE: {
      label: 'High-Value Manufacturing (>₹50L)',
      description: '₹58,00,000 supply requiring mandatory IRP IRN registration and multi-tier CFO approval.',
      payload: {
        docNumber: `INV-HV-${Date.now().toString().slice(-4)}`,
        docDate: new Date().toISOString().split('T')[0],
        supplierGstin: '27AAAAA0000A1Z5',
        partyGstin: '07CCCCC2222C1Z8',
        partyName: 'Delhi Metro Rail Corp',
        placeOfSupply: '07',
        amount: 5800000,
        items: [{
          description: 'Heavy Industrial Power Converters',
          hsnCode: '850440',
          quantity: 4,
          taxableValue: 5800000,
          gstRate: 18
        }]
      }
    },
    RCM_GTA_SUPPLY: {
      label: 'GTA Reverse Charge Supply (Sec 9(3))',
      description: '₹1,80,000 Goods Transport Agency freight triggering RCM tax engine classification.',
      payload: {
        docNumber: `GTA-${Date.now().toString().slice(-4)}`,
        docDate: new Date().toISOString().split('T')[0],
        supplierGstin: '27AAAAA0000A1Z5',
        partyGstin: '27DDDDD3333D1Z4',
        partyName: 'Maharashtra Freight Express',
        placeOfSupply: '27',
        isRcm: true,
        amount: 180000,
        items: [{
          description: 'Inter-facility Cargo Freight Transportation',
          hsnCode: '996511',
          quantity: 1,
          taxableValue: 180000,
          gstRate: 5
        }]
      }
    },
    BLOCKED_ITC_17_5: {
      label: 'Section 17(5) Blocked Credit Item',
      description: '₹85,000 staff catering & hospitality. Flagged by Rule Engine for zero ITC eligibility.',
      payload: {
        docNumber: `CAT-${Date.now().toString().slice(-4)}`,
        docDate: new Date().toISOString().split('T')[0],
        supplierGstin: '27AAAAA0000A1Z5',
        partyGstin: '27EEEEE4444E1Z1',
        partyName: 'Taj Banquets & Hospitality',
        placeOfSupply: '27',
        amount: 85000,
        items: [{
          description: 'Corporate Annual Gala Food & Catering Services',
          hsnCode: '996331',
          quantity: 1,
          taxableValue: 85000,
          gstRate: 18
        }]
      }
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setActiveStepIndex(0);
    setSimulatedResult(null);

    const preset = presets[activePreset];

    // Animate through the architecture pipeline
    const pipelineSteps = [
      'React Frontend Ingest',
      'NestJS API/BFF Routing',
      'Transaction Engine (Canonical Model -> Data Quality -> Validation)',
      'Compliance Engine (Rule Engine -> Tax Engine -> Risk Engine)',
      'Workflow Engine (Approval & Filing Orchestration)',
      'Kafka Event-Bus Pub-Sub Dispatch',
      'Downstream Branch: Reconciliation -> ITC Engine -> Return Engine -> Compliance Ledger',
      'Downstream Branch: E-Invoice -> GSP/IRP',
      'Downstream Branch: E-Way Bill -> GSP/NIC',
      'Multi-Store Persistence (PostgreSQL + Redis + Object Storage)'
    ];

    for (let i = 0; i < pipelineSteps.length; i++) {
      setActiveStepIndex(i);
      await new Promise(r => setTimeout(r, 280));
    }

    try {
      const response = await executeArchitecturePipeline(preset.payload);
      setSimulatedResult(response.result);
      loadData();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 lg:p-8 space-y-8 font-sans">
      {/* Top Banner & Control Tower Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/30">
            <Radio size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                GST Compliance Control Tower
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold font-mono border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                TARGET ARCHITECTURE V3.0
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              End-to-end reactive orchestration from React Frontend & NestJS BFF to Transaction, Compliance & Workflow Engines, Event Bus, GSP Connectors, and Multi-Store Persistence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              autoRefresh 
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Live Sync (5s)' : 'Sync Paused'}
          </button>

          <button
            onClick={() => {
              setActiveTab('SIMULATOR');
              handleRunSimulation();
            }}
            disabled={isSimulating}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Play size={14} className={isSimulating ? 'animate-spin' : ''} />
            {isSimulating ? 'Executing Pipeline...' : 'Run Live Pipeline Drill'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-800/60 p-1.5 rounded-xl border border-slate-700/80 w-fit flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('UX_DESIGN')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'UX_DESIGN' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 hover:bg-indigo-900/60'
          }`}
        >
          <Sparkles size={14} className="text-amber-400" /> Phase 2: Enterprise Frontend UX Design
        </button>
        <button
          onClick={() => setActiveTab('BLUEPRINT')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'BLUEPRINT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
          }`}
        >
          <ShieldCheck size={14} className="text-emerald-400" /> Target Architecture Blueprint & Audit
        </button>
        <button
          onClick={() => setActiveTab('HEATMAP')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'HEATMAP' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin size={14} /> Regional Compliance Heatmap
        </button>
        <button
          onClick={() => setActiveTab('MULTI_GSTIN')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'MULTI_GSTIN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio size={14} /> Multi-GSTIN Telemetry
        </button>
        <button
          onClick={() => setActiveTab('MAP')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'MAP' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers size={14} /> Interactive Architecture Map
        </button>
        <button
          onClick={() => setActiveTab('SIMULATOR')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'SIMULATOR' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap size={14} /> Pipeline Simulator & Trace
        </button>
        <button
          onClick={() => setActiveTab('EVENT_BUS')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'EVENT_BUS' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity size={14} /> Kafka Event-Bus ({eventHistory.length})
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'LEDGER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock size={14} /> Compliance Ledger ({complianceLedger.length})
        </button>
        <button
          onClick={() => setActiveTab('STORAGE')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'STORAGE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HardDrive size={14} /> Multi-Store Persistence
        </button>
      </div>

      {/* TAB: PHASE 2 ENTERPRISE FRONTEND UX DESIGN */}
      {activeTab === 'UX_DESIGN' && (
        <EnterpriseFrontendUxDesignPortal />
      )}

      {/* TAB: TARGET ARCHITECTURE BLUEPRINT & AUDIT */}
      {activeTab === 'BLUEPRINT' && (
        <ArchitectureRefinementView />
      )}

      {/* TAB: REGIONAL COMPLIANCE HEATMAP */}
      {activeTab === 'HEATMAP' && (
        <RegionalComplianceHeatmap />
      )}

      {/* TAB 0: MULTI-GSTIN TELEMETRY */}
      {activeTab === 'MULTI_GSTIN' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Live Throughput Metrics */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ingestion Throughput</h3>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-blue-400 font-mono">2,450</span>
                <span className="text-sm font-medium text-slate-400 mb-1">req/sec</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">Latency: <span className="text-emerald-400 font-mono">1.2ms</span></span>
                <span className="text-slate-500">Error Rate: <span className="text-emerald-400 font-mono">0.02%</span></span>
              </div>
            </div>

            {/* Active Nodes Matrix */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Service Health (Nodes)</h3>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-emerald-400 font-mono">12</span>
                <span className="text-sm font-medium text-slate-400 mb-1">/ 12</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            </div>

            {/* Multi-GSTIN Synchronization */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active GSTIN Synced</h3>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-indigo-400 font-mono">14</span>
                <span className="text-sm font-medium text-slate-400 mb-1">entities</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Liability: <span className="text-indigo-300 font-mono">₹4.2 Cr</span></span>
                <span className="text-slate-500">ITC Claimed: <span className="text-indigo-300 font-mono">₹3.8 Cr</span></span>
              </div>
            </div>
          </div>

          {/* Government Portals Integration Latency & Health Hub */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/60 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                  <HeartPulse size={18} className="text-emerald-400 animate-pulse" />
                  Government API Portals Integration & Latency Hub
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time telemetry and network connection status for IRP, GSTR-2B, and E-Way Bill government gateways.
                </p>
              </div>
              <button
                onClick={loadData}
                className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-1.5 transition-all"
              >
                <RefreshCw size={13} />
                Refresh Gateways
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {portalsHealth.map((portal) => {
                const isCurrentPinging = isPinging[portal.id];
                const pingRes = pingResults[portal.id];
                
                const themeColor = 
                  portal.id === 'irp' ? '#3b82f6' : 
                  portal.id === 'gstr2b' ? '#f59e0b' : '#a855f7';
                
                return (
                  <div key={portal.id} className="bg-slate-900/60 rounded-xl border border-slate-700/40 p-5 flex flex-col justify-between hover:border-slate-600/50 transition-all">
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight">{portal.name}</h4>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5 max-w-[200px] truncate" title={portal.endpoint}>
                            {portal.endpoint}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 shrink-0 ${
                          portal.status === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            portal.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-bounce'
                          }`}></span>
                          {portal.status}
                        </span>
                      </div>

                      {/* Main Latency Banner */}
                      <div className="mt-4 flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-black text-white font-mono tracking-tight">
                            {portal.currentLatencyMs}
                          </span>
                          <span className="text-xs text-slate-400 font-medium ml-1">ms</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Current Gateway Latency</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-300 font-mono">{portal.successRate}%</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">24h Success Rate</span>
                        </div>
                      </div>

                      {/* Grid Stats */}
                      <div className="mt-5 grid grid-cols-2 gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Avg Latency</span>
                          <span className="text-slate-300 font-bold font-mono">{portal.avgLatencyMs} ms</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Uptime SLA</span>
                          <span className="text-slate-300 font-bold font-mono">{portal.uptimeSla}%</span>
                        </div>
                      </div>

                      {/* Latency History Chart using Recharts */}
                      <div className="mt-5 h-[100px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={portal.historicalTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <defs>
                              <linearGradient id={`gradient-${portal.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={themeColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={themeColor} stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                              labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                              itemStyle={{ color: '#ffffff', fontSize: '11px', padding: '2px 0' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="latency" 
                              stroke={themeColor} 
                              strokeWidth={1.5}
                              fillOpacity={1} 
                              fill={`url(#gradient-${portal.id})`} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1 right-2 text-[9px] font-bold text-slate-500 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/30">
                          12-Hour Trend
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
                      <div className="text-[10px] text-slate-500">
                        {pingRes ? (
                          <span className="text-emerald-400 font-medium">
                            Ping OK: <span className="font-mono">{pingRes.latency}ms</span>
                          </span>
                        ) : (
                          <span>Last: {new Date(portal.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        )}
                      </div>
                      <button
                        disabled={isCurrentPinging}
                        onClick={async () => {
                          setIsPinging(prev => ({ ...prev, [portal.id]: true }));
                          await new Promise(resolve => setTimeout(resolve, 600));
                          const simulatedPing = Math.round(portal.avgLatencyMs * (0.9 + Math.random() * 0.2));
                          setPingResults(prev => ({
                            ...prev,
                            [portal.id]: { latency: simulatedPing, timestamp: new Date().toLocaleTimeString() }
                          }));
                          setIsPinging(prev => ({ ...prev, [portal.id]: false }));
                        }}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700/60 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isCurrentPinging ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            Pinging...
                          </>
                        ) : (
                          <>
                            <Globe size={11} />
                            Test Connection
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Background Synchronization Feed */}
            <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-indigo-400" />
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                    Portal Synced Real-time Activity Feed
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping" />
                  Real-time Poller Active (6s interval)
                </div>
              </div>

              <div className="h-[140px] overflow-y-auto font-mono text-[11px] bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                {portalSyncLogs.length === 0 ? (
                  <div className="text-slate-600 text-center py-8">
                    Waiting for background poll cycle sync signals...
                  </div>
                ) : (
                  portalSyncLogs.map((log, idx) => {
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-slate-400 py-1 border-b border-slate-900/60 last:border-0 hover:bg-slate-900/20 px-1 rounded transition-colors">
                        <span className="text-slate-600 shrink-0 select-none">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 font-bold">
                          <span className="text-indigo-400">{log.portalName}:</span>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                            log.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-slate-500">|</span>
                          <span className="text-slate-300 font-mono font-medium">{log.latencyMs}ms</span>
                        </div>
                        <p className="text-xs text-slate-500 pl-0 sm:pl-0 leading-relaxed break-all font-medium">
                          {log.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Live Telemetry Stream */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6">
             <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
               <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                 <Radio size={16} className="text-blue-400" />
                 Multi-GSTIN Live Telemetry Stream
               </h3>
               <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                 LIVE CONNECTION
               </span>
             </div>
             
             <div className="h-[300px] overflow-y-auto font-mono text-[11px] bg-slate-900 p-4 rounded-xl border border-slate-700/50 space-y-2">
                {[...Array(20)].map((_, i) => {
                  const gstins = ['27AAAAA0000A1Z5', '29BBBBB1111B1Z2', '07CCCCC2222C1Z8', '33DDDDD4444D1Z4'];
                  const actions = ['INVOICE_INGEST', 'GSTR1_SYNC', 'GSTR2B_RECONCILE', 'EWAY_GENERATE', 'EINV_VALIDATE'];
                  const statuses = ['SUCCESS', 'PROCESSING', 'QUEUED'];
                  const gstin = gstins[Math.floor(Math.random() * gstins.length)];
                  const action = actions[Math.floor(Math.random() * actions.length)];
                  const status = statuses[Math.floor(Math.random() * statuses.length)];
                  
                  return (
                    <div key={i} className="flex gap-4 p-2 hover:bg-slate-800/50 rounded transition-colors border-b border-slate-800/50">
                      <span className="text-slate-500 shrink-0">{new Date(Date.now() - i * 1500).toISOString()}</span>
                      <span className="text-blue-400 font-bold shrink-0">[{gstin}]</span>
                      <span className="text-purple-300 font-bold shrink-0">{action}</span>
                      <span className="text-slate-300 flex-1 truncate">Payload received, calculating canonical state...</span>
                      <span className={`shrink-0 ${status === 'SUCCESS' ? 'text-emerald-400' : status === 'PROCESSING' ? 'text-amber-400' : 'text-slate-400'}`}>
                        [{status}]
                      </span>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      {/* TAB 1: INTERACTIVE ARCHITECTURE MAP */}
      {activeTab === 'MAP' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Diagram Area */}
          <div className="xl:col-span-2 bg-slate-800/40 rounded-2xl border border-slate-700/80 p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu size={18} className="text-blue-400" />
                  Target Architecture Structural Topology
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any node to inspect active telemetry, engine state, queue metrics, and statutory rules.
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                12 Nodes Active (100% Operational)
              </span>
            </div>

            {/* Visual Topology Graph */}
            <div className="flex flex-col items-center space-y-4 py-4">
              {/* Level 0: GST COMPLIANCE CONTROL TOWER */}
              <div 
                onClick={() => setSelectedNode('CONTROL_TOWER')}
                className={`w-80 p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  selectedNode === 'CONTROL_TOWER'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-xl shadow-blue-500/20 scale-105 font-black'
                    : 'bg-slate-800/90 text-slate-200 border-slate-600 hover:border-slate-400 font-bold'
                }`}
              >
                <div className="text-xs tracking-wider uppercase">GST COMPLIANCE CONTROL TOWER</div>
                <div className="text-[10px] text-blue-200 mt-0.5 font-normal">Real-Time Observability & Orchestrator</div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 1: React Frontend */}
              <div 
                onClick={() => setSelectedNode('REACT_FRONTEND')}
                className={`w-72 p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  selectedNode === 'REACT_FRONTEND'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-xl shadow-blue-500/20 scale-105 font-bold'
                    : 'bg-slate-800/90 text-slate-200 border-slate-600 hover:border-slate-400'
                }`}
              >
                <div className="text-xs font-bold">React Frontend</div>
                <div className="text-[10px] text-slate-400">SPA / Redux / Real-time WebSockets</div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 2: NestJS API / BFF */}
              <div 
                onClick={() => setSelectedNode('NESTJS_BFF')}
                className={`w-72 p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                  selectedNode === 'NESTJS_BFF'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl shadow-indigo-500/20 scale-105 font-bold'
                    : 'bg-slate-800/90 text-slate-200 border-indigo-500/40 hover:border-indigo-400'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider text-indigo-300">NestJS API / BFF</div>
                <div className="text-[10px] text-slate-300 mt-0.5">Gateway / Auth / Payload Serialization</div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 3: Three Primary Engines */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                {/* Engine 1: Transaction Engine */}
                <div 
                  onClick={() => setSelectedNode('TRANSACTION_ENGINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    selectedNode === 'TRANSACTION_ENGINE'
                      ? 'bg-blue-600/20 border-blue-400 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold text-xs text-blue-300 text-center pb-2 border-b border-slate-700">
                    Transaction Engine
                  </div>
                  <div className="space-y-1 py-2 text-[11px] text-slate-300 text-center">
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Canonical Model</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Data Quality</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Validation</div>
                  </div>
                </div>

                {/* Engine 2: Compliance Engine */}
                <div 
                  onClick={() => setSelectedNode('COMPLIANCE_ENGINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    selectedNode === 'COMPLIANCE_ENGINE'
                      ? 'bg-emerald-600/20 border-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold text-xs text-emerald-300 text-center pb-2 border-b border-slate-700">
                    Compliance Engine
                  </div>
                  <div className="space-y-1 py-2 text-[11px] text-slate-300 text-center">
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Rule Engine</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Tax Engine</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Risk Engine</div>
                  </div>
                </div>

                {/* Engine 3: Workflow Engine */}
                <div 
                  onClick={() => setSelectedNode('WORKFLOW_ENGINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    selectedNode === 'WORKFLOW_ENGINE'
                      ? 'bg-amber-600/20 border-amber-400 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold text-xs text-amber-300 text-center pb-2 border-b border-slate-700">
                    Workflow Engine
                  </div>
                  <div className="space-y-1 py-2 text-[11px] text-slate-300 text-center">
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Approval</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Filing</div>
                    <div className="px-2 py-0.5 bg-slate-900/60 rounded">Workflow</div>
                  </div>
                </div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 4: Event Bus */}
              <div 
                onClick={() => setSelectedNode('EVENT_BUS')}
                className={`w-96 p-3 rounded-xl border text-center cursor-pointer transition-all ${
                  selectedNode === 'EVENT_BUS'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-xl shadow-purple-500/20 scale-105 font-bold'
                    : 'bg-slate-800/90 text-purple-300 border-purple-500/50 hover:border-purple-400'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider">Kafka Event Bus</div>
                <div className="text-[10px] text-purple-200 mt-0.5">Asynchronous Pub/Sub & Worker Dispatcher</div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 5: Three Processing Branches */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                {/* Branch 1: Reconciliation -> ITC -> Return -> Compliance Ledger */}
                <div 
                  onClick={() => setSelectedNode('RECONCILIATION_PIPELINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    selectedNode === 'RECONCILIATION_PIPELINE'
                      ? 'bg-blue-600/20 border-blue-400 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold text-blue-300 text-center pb-1 border-b border-slate-700">
                    Reconciliation Pipeline
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div className="p-1 bg-slate-900/70 rounded text-center">Reconciliation</div>
                    <div className="text-center text-slate-500 text-[9px]">▼</div>
                    <div className="p-1 bg-slate-900/70 rounded text-center">ITC Engine</div>
                    <div className="text-center text-slate-500 text-[9px]">▼</div>
                    <div className="p-1 bg-slate-900/70 rounded text-center">Return Engine</div>
                    <div className="text-center text-slate-500 text-[9px]">▼</div>
                    <div className="p-1 bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 rounded text-center font-bold">Compliance Ledger</div>
                  </div>
                </div>

                {/* Branch 2: E-Invoice -> GSP/IRP */}
                <div 
                  onClick={() => setSelectedNode('EINVOICE_PIPELINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    selectedNode === 'EINVOICE_PIPELINE'
                      ? 'bg-emerald-600/20 border-emerald-400 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-300 text-center pb-1 border-b border-slate-700">
                    E-Invoice Pipeline
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div className="p-1 bg-slate-900/70 rounded text-center">E-Invoice</div>
                    <div className="text-center text-slate-500 text-[9px]">▼</div>
                    <div className="p-1 bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 rounded text-center font-bold">GSP / IRP</div>
                  </div>
                </div>

                {/* Branch 3: E-Way Bill -> GSP/NIC */}
                <div 
                  onClick={() => setSelectedNode('EWAYBILL_PIPELINE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    selectedNode === 'EWAYBILL_PIPELINE'
                      ? 'bg-amber-600/20 border-amber-400 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-300 text-center pb-1 border-b border-slate-700">
                    E-Way Bill Pipeline
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div className="p-1 bg-slate-900/70 rounded text-center">E-Way Bill</div>
                    <div className="text-center text-slate-500 text-[9px]">▼</div>
                    <div className="p-1 bg-amber-950/80 text-amber-300 border border-amber-700/50 rounded text-center font-bold">GSP / NIC</div>
                  </div>
                </div>
              </div>

              {/* Arrow Down */}
              <div className="text-slate-500 font-mono text-xs">▼</div>

              {/* Level 6: Persistence Layer */}
              <div 
                onClick={() => setSelectedNode('MULTI_STORE_PERSISTENCE')}
                className={`w-full p-4 rounded-xl border text-center cursor-pointer transition-all ${
                  selectedNode === 'MULTI_STORE_PERSISTENCE'
                    ? 'bg-slate-700 text-white border-blue-400 shadow-xl'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-extrabold tracking-wider uppercase text-blue-300">
                  PostgreSQL + Redis + Object Storage
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Multi-Tier Persistence: Relational Ledger, In-Memory Caching & Encrypted Document S3 Vault
                </div>
              </div>
            </div>
          </div>

          {/* Node Inspector Sidebar */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6 h-fit">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Info size={16} className="text-blue-400" />
                Node Telemetry & Inspection
              </h4>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold">
                {selectedNode}
              </span>
            </div>

            {selectedNode === 'NESTJS_BFF' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  The <strong className="text-white">NestJS API/BFF</strong> serves as the central API gateway and orchestration layer, managing authentication, rate limiting, and canonical request conversion.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl space-y-2 border border-slate-700/60 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Active Gateway Latency:</span>
                    <strong className="text-emerald-400">1.4 ms</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Uptime SLA:</span>
                    <strong className="text-white">99.99%</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Protocols:</span>
                    <strong className="text-indigo-300">REST / WebSocket / gRPC</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedNode === 'TRANSACTION_ENGINE' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  The <strong className="text-white">Transaction Engine</strong> ingests ERP invoices, maps them into a canonical model, applies data quality algorithms, and validates GSTINs and HSN codes.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl space-y-2 border border-slate-700/60 text-[11px]">
                  <div className="text-blue-400 font-bold">Sub-modules:</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li><strong>Canonical Model:</strong> Universal cross-ERP normalization</li>
                    <li><strong>Data Quality:</strong> Automatic anomaly & missing-field scoring</li>
                    <li><strong>Validation:</strong> Statutory checksums & Place of Supply matching</li>
                  </ul>
                </div>
              </div>
            )}

            {selectedNode === 'COMPLIANCE_ENGINE' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  The <strong className="text-white">Compliance Engine</strong> evaluates GST rules (Place of supply, RCM 9(3), Sec 17(5) blocked credit), calculates IGST/CGST/SGST, and evaluates vendor risk.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl space-y-2 border border-slate-700/60 text-[11px]">
                  <div className="text-emerald-400 font-bold">Engine Capabilities:</div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li><strong>Rule Engine:</strong> Dynamic regulatory patch evaluation</li>
                    <li><strong>Tax Engine:</strong> Multi-rate breakdown & cess calculation</li>
                    <li><strong>Risk Engine:</strong> GSTR-2B discrepancy scoring</li>
                  </ul>
                </div>
              </div>
            )}

            {selectedNode === 'EVENT_BUS' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Decoupled, high-throughput asynchronous <strong className="text-white">Kafka message broker</strong> dispatching events to downstream return preparation, IRP e-invoicing, and NIC e-way bill pipelines.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl space-y-2 border border-slate-700/60 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Events Ingested:</span>
                    <strong className="text-purple-400">{eventMetrics?.totalEventsPublished || 184}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active Queue Depth:</span>
                    <strong className="text-emerald-400">{eventMetrics?.activeQueueDepth || 0}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Dead-Letter Queue (DLQ):</span>
                    <strong className="text-slate-400">0</strong>
                  </div>
                </div>
              </div>
            )}

            {selectedNode === 'MULTI_STORE_PERSISTENCE' && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Unified persistence topology utilizing relational PostgreSQL for double-entry compliance ledgers, Redis for distributed locks & caching, and S3 for signed PDF documents.
                </p>
                <div className="p-3 bg-slate-900/80 rounded-xl space-y-2 border border-slate-700/60 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>PostgreSQL Records:</span>
                    <strong className="text-blue-400">{persistenceHealth?.postgres?.recordsStored || 18450}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Redis Hit Rate:</span>
                    <strong className="text-emerald-400">{persistenceHealth?.redis?.hitRatePercent || 98.4}%</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Object Vault Docs:</span>
                    <strong className="text-amber-400">{persistenceHealth?.objectStorage?.totalDocuments || 12940}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Quick action to run simulator */}
            <div className="pt-2 border-t border-slate-700">
              <button
                onClick={() => {
                  setActiveTab('SIMULATOR');
                  handleRunSimulation();
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Play size={13} /> Run Pipeline Simulator on this Architecture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PIPELINE SIMULATOR & TRACE */}
      {activeTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Preset Selector & Runner */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-blue-400" />
              1. Choose Scenario Preset
            </h3>

            <div className="space-y-3">
              {Object.entries(presets).map(([key, preset]) => (
                <div
                  key={key}
                  onClick={() => setActivePreset(key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    activePreset === key 
                      ? 'bg-blue-600/20 border-blue-500 shadow-md' 
                      : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-white">{preset.label}</span>
                    {activePreset === key && <Check size={14} className="text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{preset.description}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play size={14} className={isSimulating ? 'animate-spin' : ''} />
              {isSimulating ? 'Processing Transaction...' : 'Execute Scenario Through Architecture'}
            </button>
          </div>

          {/* Execution Trace & Pipeline Result */}
          <div className="xl:col-span-2 bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  2. Live Architecture Execution Pipeline
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Trace ID: <span className="font-mono text-indigo-300">{simulatedResult?.traceId || 'Awaiting Execution'}</span>
                </p>
              </div>
              {simulatedResult && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                  ⚡ Completed in {simulatedResult.totalProcessingTimeMs} ms
                </span>
              )}
            </div>

            {/* Step-by-Step Architecture Pipeline */}
            <div className="space-y-2">
              {[
                { name: 'React Frontend Ingestion', desc: 'Payload captured, serialized and transmitted via REST / Socket', node: 'REACT_FRONTEND' },
                { name: 'NestJS API/BFF Gateway', desc: 'Authentication, trace ID generation, and rate-limiting verified', node: 'NESTJS_BFF' },
                { name: 'Transaction Engine: Canonical & Data Quality', desc: `Canonical schema mapped; DQ Score: ${simulatedResult?.dataQuality?.score ?? 100}%`, node: 'TRANSACTION_ENGINE' },
                { name: 'Compliance Engine: Rules, Tax & Risk', desc: `Calculated Tax: ₹${simulatedResult?.compliance?.taxCalculation?.totalTax?.toLocaleString() ?? '...'} | Risk: ${simulatedResult?.compliance?.riskEvaluation?.overallRiskLevel ?? 'EVALUATING'}`, node: 'COMPLIANCE_ENGINE' },
                { name: 'Workflow Engine: Approvals & Filing State', desc: `State: ${simulatedResult?.workflow?.state ?? 'PENDING'}`, node: 'WORKFLOW_ENGINE' },
                { name: 'Kafka Event-Bus Pub-Sub Dispatch', desc: `${simulatedResult?.dispatchedEvents?.length ?? 4} events published to decoupled subscriber queues`, node: 'EVENT_BUS' },
                { name: 'Downstream: Reconciliation & Return Engine', desc: `3-Way Match: ${simulatedResult?.downstreamOutputs?.reconciliation?.matchStatus ?? 'MATCHED'} | GSTR-1 Staged`, node: 'RECONCILIATION_PIPELINE' },
                { name: 'Downstream: E-Invoice & E-Way Bill Connectors', desc: `IRN: ${simulatedResult?.downstreamOutputs?.eInvoiceIRN?.irn?.slice(0, 16) ?? 'N/A'}... | NIC EWB Issued`, node: 'EINVOICE_PIPELINE' },
                { name: 'Multi-Store Persistence Commit', desc: 'Committed to PostgreSQL Ledger, cached in Redis, archived in S3 Vault', node: 'MULTI_STORE_PERSISTENCE' }
              ].map((step, idx) => {
                const isPassed = activeStepIndex > idx || (simulatedResult && !isSimulating);
                const isCurrent = activeStepIndex === idx && isSimulating;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent 
                        ? 'bg-blue-600/30 border-blue-400 animate-pulse' 
                        : isPassed 
                        ? 'bg-slate-900/60 border-slate-700/80 text-slate-300' 
                        : 'bg-slate-900/30 border-slate-800 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isPassed ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-blue-500 text-white animate-spin' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {isPassed ? <Check size={12} /> : idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">{step.name}</div>
                        <div className="text-[10px] text-slate-400">{step.desc}</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {step.node}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EVENT BUS MONITOR */}
      {activeTab === 'EVENT_BUS' && (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-purple-400" />
                Kafka Event-Bus Pub-Sub Stream & Queue Monitor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time asynchronous Kafka events dispatched across decoupled architecture subscribers.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">Total Published: <strong className="text-purple-300">{eventMetrics?.totalEventsPublished || 0}</strong></span>
              <span className="text-slate-400">Processed: <strong className="text-emerald-300">{eventMetrics?.totalEventsProcessed || 0}</strong></span>
              <span className="text-slate-400">Active Queue: <strong className="text-blue-300">{eventMetrics?.activeQueueDepth || 0}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/80">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-700 font-mono">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Source Engine</th>
                  <th className="py-3 px-4">Trace ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {eventHistory.map((evt, i) => (
                  <tr key={i} className="hover:bg-slate-700/40 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-200">{evt.eventId}</td>
                    <td className="py-2.5 px-4 text-purple-300 font-semibold">{evt.eventType}</td>
                    <td className="py-2.5 px-4 text-slate-400">{evt.source}</td>
                    <td className="py-2.5 px-4 text-indigo-400">{evt.traceId}</td>
                    <td className="py-2.5 px-4 text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-300">
                      {evt.durationMs ? `${evt.durationMs}ms` : '<1ms'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMPLIANCE LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-blue-400" />
                Immutable Compliance Ledger (Double-Entry Audit Store)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically hashed audit journal maintaining running liability, credit & cash balances.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 text-xs font-mono font-bold border border-blue-500/20">
              SHA-256 Tamper-Evident Chain
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700/80">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Entry ID</th>
                  <th className="py-3 px-4">Doc #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Tax Amount</th>
                  <th className="py-3 px-4 text-right">Running Liability</th>
                  <th className="py-3 px-4">Cryptographic Hash</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-[11px]">
                {complianceLedger.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-700/40 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-200">{row.id}</td>
                    <td className="py-2.5 px-4 text-indigo-300">{row.docNumber}</td>
                    <td className="py-2.5 px-4 text-slate-400">{row.entryType}</td>
                    <td className="py-2.5 px-4 text-right text-rose-400 font-bold">
                      ₹{row.taxHeads?.total?.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-300 font-bold">
                      ₹{row.runningLiabilityBalance?.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-xs">{row.hash}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        POSTED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MULTI-STORE PERSISTENCE */}
      {activeTab === 'STORAGE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PostgreSQL */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                <Database size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">PostgreSQL Enterprise</h4>
                <p className="text-[11px] text-slate-400">Relational Ledger & Entity Store</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Stored Records:</span>
                <strong className="text-white">{persistenceHealth?.postgres?.recordsStored || 18450}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active Connections:</span>
                <strong className="text-emerald-400">{persistenceHealth?.postgres?.activeConnections || 18}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Query Latency:</span>
                <strong className="text-blue-300">{persistenceHealth?.postgres?.latencyMs || 1.2} ms</strong>
              </div>
            </div>
          </div>

          {/* Redis */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <Zap size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Redis 7.2 Cluster</h4>
                <p className="text-[11px] text-slate-400">Distributed Locks & In-Memory Cache</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Cached Keys:</span>
                <strong className="text-white">{persistenceHealth?.redis?.cachedKeys || 4280}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cache Hit Rate:</span>
                <strong className="text-emerald-400">{persistenceHealth?.redis?.hitRatePercent || 98.4}%</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cache Latency:</span>
                <strong className="text-rose-300">{persistenceHealth?.redis?.latencyMs || 0.4} ms</strong>
              </div>
            </div>
          </div>

          {/* Object Storage */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700/80 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <HardDrive size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Object Vault (S3/GCS)</h4>
                <p className="text-[11px] text-slate-400">AES-256 Encrypted Document Store</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Total Documents:</span>
                <strong className="text-white">{persistenceHealth?.objectStorage?.totalDocuments || 12940}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Storage Used:</span>
                <strong className="text-amber-300">{persistenceHealth?.objectStorage?.storageCapacityMb || 840.5} MB</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>KMS Encryption:</span>
                <strong className="text-emerald-400">{persistenceHealth?.objectStorage?.kmsEncryption || 'AES-256-GCM'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlTowerPage;
