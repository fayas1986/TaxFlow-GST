import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, AlertCircle, Clock, Calendar, 
  RefreshCw, ShieldAlert, Sparkles, Loader2, DollarSign, Bell, 
  Settings2, Search, Trash2, Filter, ExternalLink, Check, Copy, UserCheck, CheckCheck, Play, Phone
} from 'lucide-react';
import { 
  GstDueDateItem, WhatsAppMessageLog, WhatsAppAutoReminderConfig, 
  AutomatedGstRemindersSummary, Invoice, WhatsAppGatewayStatus, WhatsAppClientItem 
} from '../types';
import { 
  fetchGstDeadlines, fetchWhatsAppLogs, clearWhatsAppLogs, 
  fetchWhatsAppAutoReminderConfig, updateWhatsAppAutoReminderConfig, 
  runAutomatedWhatsAppGstReminders, sendWhatsAppNotification, 
  sendInvoiceStatusWhatsAppNotification, fetchInvoices,
  fetchWhatsAppGatewayStatus, testTwilioWhatsAppConnection,
  fetchWhatsAppClients, sendReconciliationMismatchWhatsAppAlert
} from '../services/api';
import { SendFilingStatusWhatsAppModal } from './SendFilingStatusWhatsAppModal';

interface WhatsAppNotificationCenterProps {
  initialTab?: 'GST_DUE_DATES' | 'FILING_STATUS' | 'RECONCILIATION_MISMATCHES' | 'INVOICES' | 'RULES' | 'LOGS' | 'SETTINGS';
  onClose?: () => void;
  tenantId?: string;
}

export const WhatsAppNotificationCenter: React.FC<WhatsAppNotificationCenterProps> = ({
  initialTab = 'GST_DUE_DATES',
  onClose,
  tenantId = 't1'
}) => {
  const [activeTab, setActiveTab] = useState<'GST_DUE_DATES' | 'FILING_STATUS' | 'RECONCILIATION_MISMATCHES' | 'INVOICES' | 'RULES' | 'LOGS'>(
    initialTab === 'SETTINGS' ? 'RULES' : (initialTab as any)
  );
  
  // Data states
  const [deadlines, setDeadlines] = useState<GstDueDateItem[]>([]);
  const [logs, setLogs] = useState<WhatsAppMessageLog[]>([]);
  const [config, setConfig] = useState<WhatsAppAutoReminderConfig | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<WhatsAppGatewayStatus | null>(null);
  const [clients, setClients] = useState<WhatsAppClientItem[]>([]);

  // Reconciliation Mismatches state
  const [reconMismatches] = useState([
    {
      id: 'rm-1',
      clientName: 'Acme Industrial Corp',
      recipientPhone: '+919876543210',
      recipientGstin: '27AABCU9603R1ZM',
      period: 'August 2026',
      mismatchCount: 4,
      taxImpact: 42500,
      matchScore: 92.4,
      topReason: 'Missing 4 supplier invoices in GSTR-2B statement',
      vendorName: 'Apex Raw Materials Ltd',
      invoiceNumber: 'INV-2026-889'
    },
    {
      id: 'rm-2',
      clientName: 'Global Tech Solutions',
      recipientPhone: '+919822012345',
      recipientGstin: '27AABCG1234R1ZP',
      period: 'August 2026',
      mismatchCount: 2,
      taxImpact: 18400,
      matchScore: 96.8,
      topReason: 'Tax rate variance (18% vs 12% reported in GSTR-1)',
      vendorName: 'Zenith Logistics',
      invoiceNumber: 'ZL-90231'
    },
    {
      id: 'rm-3',
      clientName: 'Bharat Logistics Fleet',
      recipientPhone: '+919844054321',
      recipientGstin: '27AABCB8901L1ZT',
      period: 'August 2026',
      mismatchCount: 6,
      taxImpact: 98000,
      matchScore: 84.1,
      topReason: 'GSTR-2B vs Purchase Register value discrepancy > ₹50,000',
      vendorName: 'Mahindra Auto Components',
      invoiceNumber: 'MAC-11029'
    }
  ]);

  const [selectedReconMismatchForModal, setSelectedReconMismatchForModal] = useState<typeof reconMismatches[0] | null>(null);
  const [reconModalPhone, setReconModalPhone] = useState('+919876543210');
  const [reconModalNotes, setReconModalNotes] = useState('');
  const [isSendingReconAlert, setIsSendingReconAlert] = useState(false);

  const handleSendReconAlert = async () => {
    if (!selectedReconMismatchForModal) return;
    if (!reconModalPhone || reconModalPhone.trim().length < 10) {
      alert('Please enter a valid mobile number with country code (e.g. +919876543210)');
      return;
    }
    setIsSendingReconAlert(true);
    try {
      await sendReconciliationMismatchWhatsAppAlert({
        recipientPhone: reconModalPhone.trim(),
        recipientName: selectedReconMismatchForModal.clientName,
        recipientGstin: selectedReconMismatchForModal.recipientGstin,
        period: selectedReconMismatchForModal.period,
        mismatchCount: selectedReconMismatchForModal.mismatchCount,
        taxImpact: selectedReconMismatchForModal.taxImpact,
        matchScore: selectedReconMismatchForModal.matchScore,
        topReason: selectedReconMismatchForModal.topReason,
        vendorName: selectedReconMismatchForModal.vendorName,
        invoiceNumber: selectedReconMismatchForModal.invoiceNumber,
        customNotes: reconModalNotes || undefined
      });
      showToast(`Reconciliation mismatch WhatsApp alert dispatched to ${reconModalPhone}!`);
      setSelectedReconMismatchForModal(null);
      loadLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to send reconciliation mismatch alert.');
    } finally {
      setIsSendingReconAlert(false);
    }
  };
  
  // Loading & Action states
  const [isLoadingDeadlines, setIsLoadingDeadlines] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRunningAutoEngine, setIsRunningAutoEngine] = useState(false);
  const [autoEngineResult, setAutoEngineResult] = useState<AutomatedGstRemindersSummary | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Gateway test modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('+919876543210');
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; sid?: string } | null>(null);

  // Filing Status Modal
  const [selectedFilingForModal, setSelectedFilingForModal] = useState<{
    returnType: string;
    period: string;
    status: string;
    arn?: string;
    filedDate?: string;
    taxLiability?: number;
    recipientPhone?: string;
    clientName?: string;
    recipientGstin?: string;
  } | null>(null);

  // Filter states for clients/filings
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('ALL');
  const [clientReturnFilter, setClientReturnFilter] = useState('ALL');

  // Single dispatch modal for GST Due Date
  const [selectedDeadlineForModal, setSelectedDeadlineForModal] = useState<GstDueDateItem | null>(null);
  const [customClientName, setCustomClientName] = useState('');
  const [customPhone, setCustomPhone] = useState('+919876543210');
  const [customGstin, setCustomGstin] = useState('');
  const [isSendingSingle, setIsSendingSingle] = useState(false);

  // Log filter states
  const [logFilterTemplate, setLogFilterTemplate] = useState('ALL');
  const [logFilterStatus, setLogFilterStatus] = useState('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<WhatsAppMessageLog | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial data
  useEffect(() => {
    loadDeadlines();
    loadLogs();
    loadConfig();
    loadInvoicesData();
    loadGatewayStatus();
    loadClientsData();
  }, []);

  const loadGatewayStatus = async () => {
    try {
      const status = await fetchWhatsAppGatewayStatus();
      setGatewayStatus(status);
    } catch (err) {
      console.error('Failed to load WhatsApp gateway status:', err);
    }
  };

  const loadClientsData = async () => {
    setIsLoadingClients(true);
    try {
      const data = await fetchWhatsAppClients();
      setClients(data);
    } catch (err) {
      console.error('Failed to load WhatsApp clients:', err);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testPhoneNumber || testPhoneNumber.trim().length < 10) {
      alert('Please enter a valid mobile number with country code (e.g. +919876543210)');
      return;
    }
    setIsTestingGateway(true);
    setTestResult(null);
    try {
      const res = await testTwilioWhatsAppConnection(testPhoneNumber.trim());
      setTestResult({
        success: true,
        message: (res as any).message || 'WhatsApp message successfully transmitted via Twilio gateway!',
        sid: res.messageId
      });
      showToast('Twilio WhatsApp test message dispatched!');
      loadLogs();
      loadGatewayStatus();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Twilio WhatsApp test dispatch failed'
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  const loadDeadlines = async () => {
    setIsLoadingDeadlines(true);
    try {
      const data = await fetchGstDeadlines();
      setDeadlines(data);
    } catch (err) {
      console.error('Failed to load GST deadlines:', err);
    } finally {
      setIsLoadingDeadlines(false);
    }
  };

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const { logs } = await fetchWhatsAppLogs({
        template: logFilterTemplate !== 'ALL' ? logFilterTemplate : undefined,
        status: logFilterStatus !== 'ALL' ? logFilterStatus : undefined,
        search: logSearchQuery || undefined
      });
      setLogs(logs);
    } catch (err) {
      console.error('Failed to load WhatsApp logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await fetchWhatsAppAutoReminderConfig();
      setConfig(data);
    } catch (err) {
      console.error('Failed to load WhatsApp config:', err);
    }
  };

  const loadInvoicesData = async () => {
    try {
      const data = await fetchInvoices(tenantId);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  };

  // Run automated GST reminder engine
  const handleRunAutomatedEngine = async (daysAhead: number = 7) => {
    setIsRunningAutoEngine(true);
    setAutoEngineResult(null);
    try {
      const res = await runAutomatedWhatsAppGstReminders({
        daysAhead,
        dryRun: false
      });
      setAutoEngineResult(res.summary);
      showToast(`Automated reminder engine completed! Sent ${res.summary.sentCount} WhatsApp alerts.`);
      loadLogs();
    } catch (err: any) {
      console.error('Error running automated GST reminder engine:', err);
      alert(err.message || 'Failed to execute automated GST reminders');
    } finally {
      setIsRunningAutoEngine(false);
    }
  };

  // Dispatch single GST due date reminder
  const handleSendSingleGstReminder = async () => {
    if (!selectedDeadlineForModal) return;
    if (!customPhone || customPhone.trim().length < 10) {
      alert('Please enter a valid mobile number with country code (e.g. +919876543210)');
      return;
    }

    setIsSendingSingle(true);
    try {
      await sendWhatsAppNotification({
        to: customPhone.trim(),
        template: 'GST_DUE_DATE_REMINDER',
        recipientName: customClientName || 'Registered Taxpayer',
        recipientGstin: customGstin || undefined,
        entityId: selectedDeadlineForModal.returnType,
        entityType: 'GST_RETURN',
        isAutomated: false,
        data: {
          returnType: selectedDeadlineForModal.returnType,
          period: selectedDeadlineForModal.period,
          dueDate: selectedDeadlineForModal.dueDate,
          daysRemaining: selectedDeadlineForModal.daysRemaining,
          estimatedLiability: selectedDeadlineForModal.estimatedLiability || 125000
        }
      });

      showToast(`WhatsApp reminder for ${selectedDeadlineForModal.returnType} sent to ${customPhone}!`);
      setSelectedDeadlineForModal(null);
      loadLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch WhatsApp reminder.');
    } finally {
      setIsSendingSingle(false);
    }
  };

  // Save rules
  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSavingConfig(true);
    try {
      await updateWhatsAppAutoReminderConfig(config);
      showToast('Automated WhatsApp reminder rules saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save reminder config');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all WhatsApp message history logs?')) return;
    try {
      await clearWhatsAppLogs();
      setLogs([]);
      showToast('Message history logs cleared.');
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col min-h-[600px] animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header & Gateway Telemetry */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <MessageSquare size={24} className="text-emerald-400 fill-emerald-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black tracking-tight">
                  WhatsApp Compliance & Notifications Gateway
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Twilio Connected
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Automated statutory GST due date alerts, payment reminders, and live invoice lifecycle notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${gatewayStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-emerald-200 font-semibold">
                {gatewayStatus?.configured ? 'Live Twilio:' : 'Twilio Sandbox:'}
              </span>
              <code className="font-mono text-white font-bold">{gatewayStatus?.fromNumber || 'whatsapp:+14155238886'}</code>
            </div>

            <button
              onClick={() => {
                setIsTestModalOpen(true);
                setTestResult(null);
              }}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="Ping WhatsApp Gateway via Twilio"
            >
              <Sparkles size={13} className="text-amber-300" /> Test Connection
            </button>

            <button
              onClick={() => handleRunAutomatedEngine(7)}
              disabled={isRunningAutoEngine}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isRunningAutoEngine ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Running Engine...
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current" /> Run Automated Reminders
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('GST_DUE_DATES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'GST_DUE_DATES'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <Calendar size={14} /> Statutory GST Due Date Reminders
          </button>

          <button
            onClick={() => {
              setActiveTab('FILING_STATUS');
              loadClientsData();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'FILING_STATUS'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <CheckCircle2 size={14} /> Statutory Filing Status Updates ({clients.length})
          </button>

          <button
            onClick={() => setActiveTab('RECONCILIATION_MISMATCHES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'RECONCILIATION_MISMATCHES'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <ShieldAlert size={14} /> Reconciliation Mismatch Alerts ({reconMismatches.length})
          </button>

          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'INVOICES'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <DollarSign size={14} /> Invoice Status Notifications
          </button>

          <button
            onClick={() => setActiveTab('RULES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'RULES'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <Settings2 size={14} /> Automated Schedule & Rules
          </button>

          <button
            onClick={() => {
              setActiveTab('LOGS');
              loadLogs();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'LOGS'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 text-emerald-100 hover:bg-white/20'
            }`}
          >
            <Clock size={14} /> Dispatch History & Delivery Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 flex-1 bg-slate-50/50">
        {/* =========================================================================
            TAB 1: STATUTORY GST DUE DATES & AUTOMATED REMINDERS
        ========================================================================= */}
        {activeTab === 'GST_DUE_DATES' && (
          <div className="space-y-6">
            {/* Banner with automated engine summary */}
            {autoEngineResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      Automated Reminder Run Summary
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Successfully processed {autoEngineResult.totalProcessed} registered clients. Dispatched{' '}
                      <strong>{autoEngineResult.sentCount}</strong> WhatsApp reminders. Skipped {autoEngineResult.skippedCount} (outside notification window).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAutoEngineResult(null)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upcoming Statutory GST Return Deadlines
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically calculates days remaining for GSTR-1, GSTR-3B, CMP-08, and Annual returns with one-click WhatsApp dispatch
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadDeadlines}
                  disabled={isLoadingDeadlines}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={13} className={isLoadingDeadlines ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {/* Deadlines Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {deadlines.map((dl) => {
                const isUrgent = dl.daysRemaining >= 0 && dl.daysRemaining <= 5;
                const isOverdue = dl.daysRemaining < 0;

                return (
                  <div
                    key={dl.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      isOverdue
                        ? 'border-rose-200 ring-1 ring-rose-500/20'
                        : isUrgent
                        ? 'border-amber-200 ring-1 ring-amber-500/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono">
                          {dl.returnType}
                        </span>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : isUrgent
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {isOverdue ? (
                            <>🚨 Overdue by {Math.abs(dl.daysRemaining)} days</>
                          ) : dl.daysRemaining === 0 ? (
                            <>⚠️ Due Today</>
                          ) : (
                            <>⏳ Due in {dl.daysRemaining} days</>
                          )}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{dl.period}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {dl.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="text-slate-600">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            Statutory Due Date
                          </span>
                          <span className="font-mono font-bold text-slate-800">{dl.dueDate}</span>
                        </div>

                        <div className="text-right text-slate-600">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">
                            Target Filers
                          </span>
                          <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {dl.taxpayerCategory}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedDeadlineForModal(dl);
                          setCustomClientName('');
                          setCustomPhone('+919876543210');
                          setCustomGstin('');
                        }}
                        className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare size={14} /> Send WhatsApp Reminder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Automation Banner */}
            <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-600" /> Automated Schedule Status: Active
                </h4>
                <p className="text-xs text-emerald-800">
                  TaxFlow automatically evaluates registered client taxpayer categories and dispatches WhatsApp due date alerts at <strong>T-7, T-3, and T-1 days</strong> before statutory deadlines.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('RULES')}
                className="px-4 py-2 bg-white text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl hover:bg-emerald-100 transition-colors shrink-0"
              >
                Configure Automated Rules →
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: STATUTORY FILING STATUS UPDATES
        ========================================================================= */}
        {activeTab === 'FILING_STATUS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Client Statutory Filing Status Updates
                </h3>
                <p className="text-xs text-slate-500">
                  Transmit official ARN confirmations, draft review alerts, and overdue reminders directly to client WhatsApp numbers
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadClientsData}
                  disabled={isLoadingClients}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={13} className={isLoadingClients ? 'animate-spin' : ''} /> Refresh Clients
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by client name, GSTIN..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <select
                  value={clientReturnFilter}
                  onChange={(e) => setClientReturnFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">All Return Forms</option>
                  <option value="GSTR-1">GSTR-1</option>
                  <option value="GSTR-3B">GSTR-3B</option>
                  <option value="CMP-08">CMP-08</option>
                  <option value="GSTR-9">GSTR-9</option>
                </select>

                <select
                  value={clientStatusFilter}
                  onChange={(e) => setClientStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">All Filing Statuses</option>
                  <option value="FILED">Filed (ARN Generated)</option>
                  <option value="DRAFT_READY">Draft Ready</option>
                  <option value="PENDING">Pending</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>
            </div>

            {/* Client Filing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clients
                .filter(c => {
                  if (clientSearchQuery) {
                    const q = clientSearchQuery.toLowerCase();
                    const match = c.name.toLowerCase().includes(q) || 
                                  c.gstin.toLowerCase().includes(q) || 
                                  (c.tradeName && c.tradeName.toLowerCase().includes(q));
                    if (!match) return false;
                  }
                  if (clientReturnFilter !== 'ALL' && c.currentFiling?.returnType !== clientReturnFilter) {
                    return false;
                  }
                  if (clientStatusFilter !== 'ALL' && c.currentFiling?.status !== clientStatusFilter) {
                    return false;
                  }
                  return true;
                })
                .map((client) => {
                  const f = client.currentFiling;
                  const isFiled = f?.status === 'FILED';
                  const isOverdue = f?.status === 'OVERDUE';
                  const isDraft = f?.status === 'DRAFT_READY';

                  return (
                    <div
                      key={client.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="space-y-3.5">
                        {/* Client Identity Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {client.taxpayerCategory}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm mt-1.5 leading-tight">
                              {client.name}
                            </h4>
                            {client.tradeName && (
                              <p className="text-[11px] text-slate-500">{client.tradeName}</p>
                            )}
                          </div>

                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1 ${
                            isFiled
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : isDraft
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isFiled && <CheckCheck size={12} />}
                            {f?.status || 'PENDING'}
                          </span>
                        </div>

                        {/* GSTIN & WhatsApp Phone */}
                        <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs border border-slate-100">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>GSTIN:</span>
                            <span className="font-mono font-bold text-slate-900">{client.gstin}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1">
                              <MessageSquare size={12} className="text-emerald-600" /> WhatsApp:
                            </span>
                            <span className="font-mono font-bold text-slate-900">{client.phone}</span>
                          </div>
                        </div>

                        {/* Current Filing Details */}
                        {f && (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Return & Period:</span>
                              <span className="font-bold text-slate-800">{f.returnType} • {f.period}</span>
                            </div>

                            {f.arn && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">ARN:</span>
                                <span className="font-mono text-[11px] font-bold text-emerald-700">{f.arn}</span>
                              </div>
                            )}

                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Tax Liability / Cleared:</span>
                              <span className="font-mono font-bold text-slate-900">
                                ₹{Number(f.taxLiability || 0).toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Due Date:</span>
                              <span className="font-mono text-slate-700">{f.dueDate}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-4 mt-4 border-t border-slate-100 flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedFilingForModal({
                              returnType: f?.returnType || 'GSTR-3B',
                              period: f?.period || 'July 2026',
                              status: f?.status || 'FILED',
                              arn: f?.arn,
                              filedDate: f?.filedDate,
                              taxLiability: f?.taxLiability || 145000,
                              recipientPhone: client.phone,
                              clientName: client.name,
                              recipientGstin: client.gstin
                            });
                          }}
                          className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Send size={13} /> Send WhatsApp Status
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: RECONCILIATION MISMATCH ALERTS
        ========================================================================= */}
        {activeTab === 'RECONCILIATION_MISMATCHES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-600" />
                  Real-Time Reconciliation Mismatch Alerts
                </h3>
                <p className="text-xs text-slate-500">
                  Send immediate WhatsApp notifications to clients and suppliers when GSTR-2B vs Purchase Register variances or missing ITC invoices are detected.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                  {reconMismatches.length} Active Reconciliation Variances
                </span>
              </div>
            </div>

            {/* Mismatch Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reconMismatches.map((rm) => (
                <div
                  key={rm.id}
                  className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                          {rm.period}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5 leading-tight">
                          {rm.clientName}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-500">{rm.recipientGstin}</p>
                      </div>

                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase flex items-center gap-1">
                        <AlertCircle size={12} /> {rm.mismatchCount} Mismatches
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tax / ITC Impact:</span>
                        <span className="font-mono font-black text-rose-600">
                          ₹{rm.taxImpact.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Match Score:</span>
                        <span className="font-mono font-bold text-amber-700">{rm.matchScore}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Primary Vendor:</span>
                        <span className="font-bold text-slate-800">{rm.vendorName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">WhatsApp Mobile:</span>
                        <span className="font-mono font-bold text-emerald-700">{rm.recipientPhone}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60 leading-relaxed font-medium">
                      ⚠️ <strong>Primary Reason:</strong> {rm.topReason}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedReconMismatchForModal(rm);
                        setReconModalPhone(rm.recipientPhone);
                        setReconModalNotes('');
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-700 hover:to-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <MessageSquare size={14} /> Send WhatsApp Mismatch Alert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: INVOICE STATUS NOTIFICATIONS & PAYMENT REMINDERS
        ========================================================================= */}
        {activeTab === 'INVOICES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Client Invoice Status Notifications
                </h3>
                <p className="text-xs text-slate-500">
                  Send real-time WhatsApp updates for issued invoices, upcoming payment deadlines, overdue notices, and payment receipts
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  {invoices.length} Total Invoices
                </span>
              </div>
            </div>

            {/* Invoices List for WhatsApp Dispatch */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Client / Party Name</th>
                      <th className="p-4">Amount (₹)</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">WhatsApp Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.slice(0, 10).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{inv.partyName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{inv.gstin || 'Unregistered'}</div>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-900">
                          ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 font-mono text-slate-600">
                          {inv.dueDate || inv.date}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            (inv.status as string) === 'OVERDUE' ? 'bg-rose-100 text-rose-800' :
                            inv.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={async () => {
                              const targetPhone = (inv as any).billingAddress?.phone || (inv as any).phone || '+919876543210';
                              try {
                                await sendInvoiceStatusWhatsAppNotification({
                                  invoiceNumber: inv.invoiceNumber,
                                  partyName: inv.partyName,
                                  recipientPhone: targetPhone,
                                  amount: inv.amount,
                                  status: inv.status,
                                  dueDate: inv.dueDate,
                                  date: inv.date,
                                  isOverdue: (inv.status as string) === 'OVERDUE'
                                });
                                showToast(`WhatsApp status notification sent for ${inv.invoiceNumber}!`);
                                loadLogs();
                              } catch (err: any) {
                                alert(err.message || 'Failed to dispatch notification');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] transition-colors inline-flex items-center gap-1"
                          >
                            <MessageSquare size={12} className="text-emerald-600" /> Notify on WhatsApp
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: AUTOMATED SCHEDULE & RULES CONFIGURATION
        ========================================================================= */}
        {activeTab === 'RULES' && config && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Automated WhatsApp Reminder Rules
              </h3>
              <p className="text-xs text-slate-500">
                Configure when and how the automated compliance daemon triggers WhatsApp alerts to clients
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
              {/* Master Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Master WhatsApp Automation Engine
                  </h4>
                  <p className="text-xs text-slate-500">
                    Enable continuous background schedule evaluation and alert dispatching
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* GST Due Date Rules */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  GST Due Date Reminder Schedule
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Trigger Days Prior to Deadline
                    </label>
                    <div className="flex items-center gap-2">
                      {[7, 3, 1].map((day) => (
                        <span
                          key={day}
                          className="px-3 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200"
                        >
                          T-{day} Days
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dispatches alerts 7 days, 3 days, and 1 day prior to statutory filing date.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Default Country Code & Fallback Number
                    </label>
                    <input
                      type="text"
                      value={config.defaultFallbackNumber || '+919876543210'}
                      onChange={(e) => setConfig({ ...config, defaultFallbackNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="latefee"
                    checked={config.gstDueDateReminders.includeLateFeeWarning}
                    onChange={(e) => setConfig({
                      ...config,
                      gstDueDateReminders: {
                        ...config.gstDueDateReminders,
                        includeLateFeeWarning: e.target.checked
                      }
                    })}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="latefee" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Include Section 47 Late Fee warning (₹50/day) & 18% p.a. interest notice in reminders
                  </label>
                </div>
              </div>

              {/* Invoice Status Notification Rules */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Invoice Status Notification Triggers
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={config.invoiceStatusNotifications.notifyOnIssued}
                      onChange={(e) => setConfig({
                        ...config,
                        invoiceStatusNotifications: {
                          ...config.invoiceStatusNotifications,
                          notifyOnIssued: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Notify immediately on Invoice Issuance
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={config.invoiceStatusNotifications.notifyOnPaymentDue}
                      onChange={(e) => setConfig({
                        ...config,
                        invoiceStatusNotifications: {
                          ...config.invoiceStatusNotifications,
                          notifyOnPaymentDue: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Send Payment Due reminder at T-3 days
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={config.invoiceStatusNotifications.notifyOnOverdue}
                      onChange={(e) => setConfig({
                        ...config,
                        invoiceStatusNotifications: {
                          ...config.invoiceStatusNotifications,
                          notifyOnOverdue: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Auto-trigger Urgent Overdue Notice
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50">
                    <input
                      type="checkbox"
                      checked={config.invoiceStatusNotifications.notifyOnPaymentReceived}
                      onChange={(e) => setConfig({
                        ...config,
                        invoiceStatusNotifications: {
                          ...config.invoiceStatusNotifications,
                          notifyOnPaymentReceived: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Send Payment Received Receipt Note
                    </span>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingConfig ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Reminder Rules
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: DISPATCH HISTORY & DELIVERY LOGS
        ========================================================================= */}
        {activeTab === 'LOGS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  WhatsApp Communication History & Logs
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time audit trail of all automated and manual WhatsApp notifications dispatched via Twilio
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear Logs
                </button>

                <button
                  onClick={loadLogs}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                >
                  <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by recipient, phone, or invoice #..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={logFilterTemplate}
                onChange={(e) => setLogFilterTemplate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none"
              >
                <option value="ALL">All Templates</option>
                <option value="GST_DUE_DATE_REMINDER">GST Due Date Reminder</option>
                <option value="INVOICE_STATUS_NOTIFICATION">Invoice Status</option>
                <option value="PAYMENT_REMINDER">Payment Reminder</option>
                <option value="PAYMENT_OVERDUE">Payment Overdue</option>
                <option value="PAYMENT_RECEIVED">Payment Received</option>
              </select>

              <button
                onClick={loadLogs}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Apply Filter
              </button>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Recipient</th>
                      <th className="p-4">Template / Purpose</th>
                      <th className="p-4">Entity</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No WhatsApp communication logs found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 text-slate-500 font-mono">
                            {new Date(log.timestamp).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{log.recipientName || 'Valued Client'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{log.recipientPhone}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {log.template}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-700 font-semibold">
                            {log.entityId || 'N/A'}
                          </td>
                          <td className="p-4">
                            {log.isAutomated ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                🤖 Auto Schedule
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                                👤 Manual
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 w-fit ${
                              log.status === 'DELIVERED' || log.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {log.status === 'DELIVERED' ? <CheckCheck size={11} /> : <Check size={11} />}
                              {log.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedLogForPreview(log)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              View Message
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: SEND SINGLE GST DUE DATE REMINDER
      ========================================================================= */}
      {selectedDeadlineForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={20} />
                <h3 className="font-bold text-base">
                  Send {selectedDeadlineForModal.returnType} Due Date Reminder
                </h3>
              </div>
              <button
                onClick={() => setSelectedDeadlineForModal(null)}
                className="p-1 hover:bg-white/10 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/70 text-xs text-emerald-950 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Return: {selectedDeadlineForModal.returnType}</span>
                  <span>Due: {selectedDeadlineForModal.dueDate}</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Tax Period: {selectedDeadlineForModal.period} ({selectedDeadlineForModal.daysRemaining} days remaining)
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Client / Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Industrial Corp"
                  value={customClientName}
                  onChange={(e) => setCustomClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Client WhatsApp Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="27AABCU9603R1ZM"
                  value={customGstin}
                  onChange={(e) => setCustomGstin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedDeadlineForModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendSingleGstReminder}
                disabled={isSendingSingle || !customPhone}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSendingSingle ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send WhatsApp Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: VIEW DISPATCHED MESSAGE TEXT
      ========================================================================= */}
      {selectedLogForPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400" />
                <h4 className="font-bold text-sm">Dispatched WhatsApp Message</h4>
              </div>
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="p-1 hover:bg-white/10 rounded-full text-white/80"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 border-b pb-3">
                <span>To: <strong className="text-slate-900">{selectedLogForPreview.recipientPhone}</strong></span>
                <span>Status: <strong className="text-emerald-600">{selectedLogForPreview.status}</strong></span>
              </div>

              <div className="p-4 bg-[#E5DDD5] rounded-2xl border border-slate-200 shadow-inner">
                <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm text-xs text-slate-800 space-y-2 whitespace-pre-wrap leading-relaxed">
                  {selectedLogForPreview.messageBody}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SEND STATUTORY FILING STATUS UPDATE
      ========================================================================= */}
      {selectedFilingForModal && (
        <SendFilingStatusWhatsAppModal
          isOpen={!!selectedFilingForModal}
          onClose={() => setSelectedFilingForModal(null)}
          filing={selectedFilingForModal}
          onSuccess={() => {
            showToast('Filing status notification sent successfully!');
            loadLogs();
          }}
        />
      )}

      {/* =========================================================================
          MODAL: TEST TWILIO WHATSAPP CONNECTION
      ========================================================================= */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-amber-300" />
                <h4 className="font-bold text-sm">Ping & Test Twilio WhatsApp Gateway</h4>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white/80"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/70 text-xs text-emerald-950 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Gateway Mode: {gatewayStatus?.configured ? 'Live Twilio' : 'Twilio Sandbox'}</span>
                  <span>From: {gatewayStatus?.fromNumber || 'whatsapp:+14155238886'}</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Sends a real-time statutory handshake payload to verify network latency and Twilio credentials.
                </p>
              </div>

              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  testResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                    <span>{testResult.success ? 'Gateway Verified' : 'Gateway Ping Failed'}</span>
                  </div>
                  <p className="text-[11px]">{testResult.message}</p>
                  {testResult.sid && (
                    <p className="text-[10px] font-mono text-slate-500">SID: {testResult.sid}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Target WhatsApp Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="+919876543210"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-emerald-500 font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400">Include country code (+91 for India)</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold"
              >
                Close
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTestingGateway || !testPhoneNumber}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {isTestingGateway ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Transmitting Ping...
                  </>
                ) : (
                  <>
                    <Send size={13} /> Ping WhatsApp Gateway
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Reconciliation Mismatch Dispatch */}
      {selectedReconMismatchForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Send WhatsApp Mismatch Alert</h3>
                  <p className="text-[11px] text-slate-500">{selectedReconMismatchForModal.clientName} ({selectedReconMismatchForModal.period})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReconMismatchForModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Recipient WhatsApp Phone Number *
                </label>
                <input
                  type="text"
                  value={reconModalPhone}
                  onChange={(e) => setReconModalPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Custom Notes or Supplier Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reconModalNotes}
                  onChange={(e) => setReconModalNotes(e.target.value)}
                  placeholder="e.g. Please send amended GSTR-1 acknowledgement before 10th..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              {/* Message Live Bubble Preview */}
              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800">
                  <Sparkles size={13} className="text-emerald-600" /> WhatsApp Message Body Preview
                </div>
                <div className="p-3 bg-white rounded-xl text-[11px] text-slate-800 border border-emerald-100 font-sans leading-relaxed whitespace-pre-wrap shadow-xs">
                  ⚠️ *GST RECONCILIATION MISMATCH ALERT*{"\n\n"}
                  Dear *{selectedReconMismatchForModal.clientName}*,{"\n\n"}
                  A reconciliation variance was detected for tax period *{selectedReconMismatchForModal.period}*.{"\n\n"}
                  📊 *Reconciliation Summary:*{"\n"}
                  • *Mismatched Invoices:* {selectedReconMismatchForModal.mismatchCount} record(s){"\n"}
                  • *ITC Impact / Tax Variance:* ₹{selectedReconMismatchForModal.taxImpact.toLocaleString('en-IN')}{"\n"}
                  • *Primary Reason:* {selectedReconMismatchForModal.topReason}{"\n\n"}
                  🚨 *Statutory Risk:* Claiming ITC on mismatched or missing supplier invoices in GSTR-3B attracts Section 16(2)(aa) blockage and 18% p.a. interest.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedReconMismatchForModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReconAlert}
                disabled={isSendingReconAlert}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSendingReconAlert ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Transmitting via Twilio...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Transmit Alert via WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
