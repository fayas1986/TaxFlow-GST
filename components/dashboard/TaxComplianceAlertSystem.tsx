import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  TaxProfile, 
  TaxComplianceAlert, 
  TaxComplianceSummary,
  TaxpayerClassification 
} from '../../types/taxCompliance';
import { 
  getTaxProfile, 
  computeTaxComplianceAlerts, 
  markAlertAsFiled, 
  dismissAlert, 
  snoozeAlert, 
  resetAlertStates,
  generateIcsCalendar,
  saveTaxProfile
} from '../../services/taxComplianceService';
import { fetchFilingHistory } from '../../services/api';
import { TaxProfileConfigModal } from './TaxProfileConfigModal';
import { 
  ShieldAlert, Clock, AlertTriangle, CheckCircle2, ChevronRight, 
  Sliders, Calendar, Bell, Sparkles, ExternalLink, Download, 
  Smartphone, Mail, Check, RotateCcw, ChevronDown, ChevronUp,
  Info, ShieldCheck, Zap, FileText, ArrowRight, X, AlertOctagon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaxComplianceAlertSystemProps {
  tenantId?: string;
  companyName?: string;
  stateCode?: string;
  isAggregate?: boolean;
}

export const TaxComplianceAlertSystem: React.FC<TaxComplianceAlertSystemProps> = ({
  tenantId = 't1',
  companyName = 'Acme Corp',
  stateCode = '27',
  isAggregate = false
}) => {
  const queryClient = useQueryClient();
  const [taxProfile, setTaxProfile] = useState<TaxProfile>(() => getTaxProfile(tenantId, stateCode, companyName));
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'URGENT' | 'UPCOMING' | 'FILED'>('ALL');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [filingArnInput, setFilingArnInput] = useState<{ alertId: string; arn: string } | null>(null);
  const [timeRemainingText, setTimeRemainingText] = useState<string>('');

  // Fetch filing records for the tenant to auto-detect filed status
  const { data: filings } = useQuery({
    queryKey: ['filingHistory', tenantId],
    queryFn: () => fetchFilingHistory(tenantId),
    enabled: Boolean(tenantId)
  });

  // Re-sync tax profile when tenantId or stateCode changes
  useEffect(() => {
    setTaxProfile(getTaxProfile(tenantId, stateCode, companyName));
  }, [tenantId, stateCode, companyName]);

  // Listen to profile update events
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail?.tenantId === tenantId) {
        setTaxProfile(e.detail.profile);
      }
    };
    const handleStateUpdate = () => {
      // Force recalculation
      setTaxProfile(getTaxProfile(tenantId, stateCode, companyName));
    };

    window.addEventListener('taxProfileUpdated', handleProfileUpdate);
    window.addEventListener('taxAlertStateUpdated', handleStateUpdate);
    return () => {
      window.removeEventListener('taxProfileUpdated', handleProfileUpdate);
      window.removeEventListener('taxAlertStateUpdated', handleStateUpdate);
    };
  }, [tenantId, stateCode, companyName]);

  // Compute live compliance alerts and summary
  const { alerts, summary } = useMemo(() => {
    return computeTaxComplianceAlerts(tenantId, taxProfile, filings || []);
  }, [tenantId, taxProfile, filings]);

  // Real-time countdown clock for nearest critical deadline
  useEffect(() => {
    if (!summary.nextCriticalDeadline) {
      setTimeRemainingText('');
      return;
    }

    const updateClock = () => {
      const targetDate = new Date(summary.nextCriticalDeadline!.dueDateStr + 'T23:59:59');
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        const daysAgo = Math.abs(Math.floor(diff / (1000 * 60 * 60 * 24)));
        setTimeRemainingText(`Overdue by ${daysAgo === 0 ? 'today' : `${daysAgo} day(s)`}`);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemainingText(`${days}d ${hours}h ${minutes}m left`);
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, [summary.nextCriticalDeadline]);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleDismiss = (alertId: string) => {
    dismissAlert(tenantId, alertId);
    showToast('Alert dismissed for this session.');
  };

  const handleSnooze = (alertId: string) => {
    snoozeAlert(tenantId, alertId, 24);
    showToast('Reminder snoozed for 24 hours.');
  };

  const handleMarkAsFiledSubmit = (alertId: string) => {
    const arn = filingArnInput?.arn || `AA270926${Math.floor(100000 + Math.random() * 900000)}`;
    markAlertAsFiled(tenantId, alertId, arn);
    setFilingArnInput(null);
    queryClient.invalidateQueries({ queryKey: ['filingHistory', tenantId] });
    showToast(`Return marked as FILED! Reference ARN: ${arn}`);
  };

  const handleExportCalendar = () => {
    const icsContent = generateIcsCalendar(alerts, companyName);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Statutory_Deadlines_${tenantId}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('GST Statutory Deadlines calendar (.ics) exported successfully!');
  };

  const handleSendSimulatedReminders = (channel: 'WHATSAPP' | 'EMAIL') => {
    if (channel === 'WHATSAPP') {
      showToast(`📲 WhatsApp Alert dispatched to CFO & Finance Lead with ${summary.criticalOverdueCount + summary.urgentDueSoonCount} upcoming deadlines.`);
    } else {
      showToast(`✉️ Daily Compliance Digest emailed to registered finance team.`);
    }
  };

  const handleQuickSchemeSimulate = (newScheme: TaxpayerClassification) => {
    let freq: 'MONTHLY' | 'QUARTERLY' = 'MONTHLY';
    let bracket = taxProfile.turnoverBracket;
    let einv = taxProfile.isEInvoicingApplicable;
    let isSez = false;

    if (newScheme === 'QRMP_QUARTERLY') {
      freq = 'QUARTERLY';
      bracket = '1_5CR_TO_5CR';
      einv = false;
    } else if (newScheme === 'COMPOSITION') {
      freq = 'QUARTERLY';
      bracket = 'BELOW_1_5CR';
      einv = false;
    } else if (newScheme === 'SEZ_UNIT') {
      freq = 'MONTHLY';
      isSez = true;
    }

    const updated: TaxProfile = {
      ...taxProfile,
      taxpayerType: newScheme,
      filingFrequency: freq,
      turnoverBracket: bracket,
      isEInvoicingApplicable: einv,
      isSez: isSez
    };
    saveTaxProfile(tenantId, updated);
    setTaxProfile(updated);
    showToast(`Simulated Scheme: ${newScheme.replace(/_/g, ' ')}. Deadlines updated!`);
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (alert.isDismissed && activeFilter !== 'FILED') return false;
      if (alert.isSnoozed && activeFilter !== 'FILED') return false;
      if (activeFilter === 'URGENT') return alert.status === 'OVERDUE' || alert.status === 'URGENT' || alert.status === 'DUE_SOON';
      if (activeFilter === 'UPCOMING') return alert.status === 'SCHEDULED';
      if (activeFilter === 'FILED') return alert.status === 'FILED';
      return true;
    });
  }, [alerts, activeFilter]);

  return (
    <div className="space-y-4 mb-8">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE COMPLIANCE ALERT HERO BANNER                                 */}
      {/* ========================================================================= */}
      <div className={`relative overflow-hidden rounded-3xl border transition-all shadow-sm ${
        summary.overallStatus === 'CRITICAL_RISK'
          ? 'bg-gradient-to-br from-rose-50/90 via-white to-rose-50/50 border-rose-200'
          : summary.overallStatus === 'ATTENTION_REQUIRED'
            ? 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 border-amber-200'
            : 'bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 border-blue-200'
      }`}>
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/70">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              summary.overallStatus === 'CRITICAL_RISK'
                ? 'bg-rose-600 text-white animate-pulse'
                : summary.overallStatus === 'ATTENTION_REQUIRED'
                  ? 'bg-amber-500 text-white'
                  : 'bg-blue-600 text-white'
            }`}>
              {summary.overallStatus === 'CRITICAL_RISK' ? (
                <ShieldAlert size={24} />
              ) : summary.overallStatus === 'ATTENTION_REQUIRED' ? (
                <AlertTriangle size={24} />
              ) : (
                <ShieldCheck size={24} />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  Tax Compliance Alert System
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                  summary.overallStatus === 'CRITICAL_RISK'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : summary.overallStatus === 'ATTENTION_REQUIRED'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}>
                  {summary.overallStatus === 'CRITICAL_RISK' 
                    ? 'Critical Action Required' 
                    : summary.overallStatus === 'ATTENTION_REQUIRED' 
                      ? 'Approaching Deadlines' 
                      : 'Statutory Health 100% Compliant'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                {summary.nextCriticalDeadline ? (
                  <span>
                    {summary.nextCriticalDeadline.title} ({summary.nextCriticalDeadline.period})
                  </span>
                ) : (
                  <span>All Statutory Filings for Current Period Completed</span>
                )}
              </h3>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-all shadow-2xs hover:border-slate-400 cursor-pointer"
              title="Calibrate Taxpayer Scheme & Thresholds"
            >
              <Sliders size={14} className="text-indigo-600" />
              <span>Tax Profile</span>
            </button>

            <button
              onClick={handleExportCalendar}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-all shadow-2xs hover:border-slate-400 cursor-pointer"
              title="Download Outlook / Google Calendar Schedule (.ics)"
            >
              <Calendar size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Export .ics</span>
            </button>

            <button
              onClick={() => handleSendSimulatedReminders('WHATSAPP')}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Dispatch WhatsApp Alert to Registered Stakeholders"
            >
              <Smartphone size={14} className="text-emerald-600" />
              <span className="hidden lg:inline">WhatsApp Alert</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Badges Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-white/60">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Health Index</span>
              <ShieldCheck size={14} className="text-blue-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-extrabold ${
                summary.complianceHealthScore >= 90 ? 'text-emerald-600' : summary.complianceHealthScore >= 70 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {summary.complianceHealthScore}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Compliance</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Alerts</span>
              <AlertTriangle size={14} className="text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900">
                {summary.criticalOverdueCount + summary.urgentDueSoonCount}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">pending attention</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Next Due In</span>
              <Clock size={14} className="text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-extrabold text-indigo-700 truncate">
                {timeRemainingText || 'No pending dues'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Late Fee Exposure</span>
              <AlertOctagon size={14} className={summary.potentialLateFeeExposure > 0 ? 'text-rose-600' : 'text-emerald-600'} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-extrabold ${summary.potentialLateFeeExposure > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                ₹{summary.potentialLateFeeExposure.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">{summary.potentialLateFeeExposure > 0 ? 'accruing daily' : '₹0 penalty'}</span>
            </div>
          </div>
        </div>

        {/* Tax Profile Summary Indicator Strip */}
        <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span className="text-slate-400">Target Tax Profile:</span>
            <span className="px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {taxProfile.taxpayerType.replace(/_/g, ' ')}
            </span>
            <span className="px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {taxProfile.stateName || 'State'} ({taxProfile.stateCategory === 'CATEGORY_1' ? 'Category 1' : 'Category 2'})
            </span>
            <span className="px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Turnover: {taxProfile.turnoverBracket === 'ABOVE_50CR' ? '> ₹50 Cr' : taxProfile.turnoverBracket === '5CR_TO_50CR' ? '₹5 - 50 Cr' : '< ₹5 Cr'}
            </span>
            {taxProfile.isEInvoicingApplicable && (
              <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                ⚡ E-Invoicing Active
              </span>
            )}
            <span className="text-slate-400 text-[11px]">
              (Alert Window: {taxProfile.alertLeadDays} Days)
            </span>
          </div>

          {/* Quick Simulation Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Simulate Scheme:</span>
            <select
              value={taxProfile.taxpayerType}
              onChange={(e) => handleQuickSchemeSimulate(e.target.value as TaxpayerClassification)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="REGULAR_MONTHLY">🏢 Regular (Monthly GSTR-1/3B)</option>
              <option value="QRMP_QUARTERLY">📦 QRMP Scheme (IFF & PMT-06)</option>
              <option value="COMPOSITION">🏷️ Composition (CMP-08)</option>
              <option value="SEZ_UNIT">🌐 SEZ Developer Unit</option>
              <option value="ISD">🔗 ISD (GSTR-6)</option>
              <option value="TDS_TCS">🏛️ TDS/TCS (GSTR-7/8)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ALERT ACTION HUB TABS & CARDS LIST                                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900 tracking-tight">
              Statutory Deadlines Tailored to Profile ({filteredAlerts.length})
            </h4>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveFilter('URGENT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === 'URGENT'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Critical & Urgent ({summary.criticalOverdueCount + summary.urgentDueSoonCount})
            </button>
            <button
              onClick={() => setActiveFilter('UPCOMING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === 'UPCOMING'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Upcoming ({summary.upcomingScheduledCount})
            </button>
            <button
              onClick={() => setActiveFilter('FILED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeFilter === 'FILED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Completed ({summary.filedCompletedCount})
            </button>
          </div>
        </div>

        {/* Alert Cards Container */}
        <div className="space-y-3.5">
          <AnimatePresence>
            {filteredAlerts.map(alert => {
              const isExpanded = expandedAlertId === alert.id;
              const isOverdue = alert.status === 'OVERDUE';
              const isUrgent = alert.status === 'URGENT';
              const isDueSoon = alert.status === 'DUE_SOON';
              const isFiled = alert.status === 'FILED';

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    isOverdue
                      ? 'bg-rose-50/50 border-rose-200/80 shadow-xs'
                      : isUrgent
                        ? 'bg-amber-50/50 border-amber-200/80 shadow-xs'
                        : isDueSoon
                          ? 'bg-indigo-50/30 border-indigo-200/70'
                          : isFiled
                            ? 'bg-emerald-50/30 border-emerald-200/60'
                            : 'bg-slate-50/50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Form Badge + Title + Description */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 shadow-2xs ${
                        isOverdue 
                          ? 'bg-rose-600 text-white' 
                          : isUrgent 
                            ? 'bg-amber-500 text-white' 
                            : isFiled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                      }`}>
                        <span className="text-[10px] uppercase font-bold tracking-tighter opacity-80">{alert.formType.substring(0, 4)}</span>
                        <span className="text-xs font-black">{alert.formType.replace('GSTR-', '')}</span>
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                            {alert.title}
                          </h4>
                          <span className="text-xs font-medium text-slate-500">
                            • Period: <strong className="text-slate-800">{alert.period}</strong>
                          </span>

                          {/* Status Badge */}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-800 animate-pulse">
                              Overdue by {Math.abs(alert.daysRemaining)} Days
                            </span>
                          )}
                          {isUrgent && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900">
                              Urgent: Due in {alert.daysRemaining} Day(s)
                            </span>
                          )}
                          {isDueSoon && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                              Due in {alert.daysRemaining} Days
                            </span>
                          )}
                          {isFiled && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Filed (ARN: {alert.filedArn})
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {alert.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            Statutory Due Date: <strong className="text-slate-900">{alert.dueDateFormatted}</strong>
                          </span>
                          <span>•</span>
                          <span className="text-slate-600">
                            Section: <em>{alert.statutorySection}</em>
                          </span>
                          <span>•</span>
                          <span className="text-indigo-600 font-medium">
                            {alert.taxProfileMatchReason}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons & Exposure */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
                      {isOverdue && (
                        <div className="px-3 py-1.5 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <AlertOctagon size={14} />
                          <span>Penalty Risk: ₹{alert.accumulatedLateFee}</span>
                        </div>
                      )}

                      {!isFiled ? (
                        <>
                          <a
                            href={alert.actionPath}
                            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                              isOverdue
                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                                : isUrgent
                                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                            }`}
                          >
                            <span>{alert.actionLabel}</span>
                            <ArrowRight size={14} />
                          </a>

                          <button
                            onClick={() => setFilingArnInput({ alertId: alert.id, arn: '' })}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 transition-colors cursor-pointer"
                            title="Record filing acknowledgment number (ARN)"
                          >
                            Mark Filed
                          </button>

                          <button
                            onClick={() => handleSnooze(alert.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                            title="Snooze 24h"
                          >
                            <Clock size={16} />
                          </button>

                          <button
                            onClick={() => handleDismiss(alert.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                            title="Dismiss Alert"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <CheckCircle2 size={15} />
                            Compliant & Recorded
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/60 transition-colors"
                        title="View Statutory Checklist & Rules"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Inline ARN Record Input Prompt */}
                  {filingArnInput?.alertId === alert.id && (
                    <div className="mt-3 p-3.5 bg-white rounded-xl border border-emerald-300 shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in">
                      <span className="text-xs font-bold text-slate-700">Enter Portal Filing ARN:</span>
                      <input
                        type="text"
                        placeholder="e.g. AA2709260192837"
                        value={filingArnInput.arn}
                        onChange={(e) => setFilingArnInput({ alertId: alert.id, arn: e.target.value })}
                        className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg flex-1 min-w-[200px] uppercase"
                      />
                      <button
                        onClick={() => handleMarkAsFiledSubmit(alert.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Save ARN & Complete
                      </button>
                      <button
                        onClick={() => setFilingArnInput(null)}
                        className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Expandable Statutory Compliance Checklist & Regulatory References */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-in fade-in">
                      <div className="space-y-2">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                          Pre-Filing Compliance Checklist:
                        </span>
                        <ul className="space-y-1.5">
                          {alert.complianceChecklist.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-slate-600">
                              <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                          Statutory Provisions & Late Fee Rules:
                        </span>
                        <div className="space-y-1 text-slate-600 text-[11px]">
                          <p><strong>Rule Reference:</strong> {alert.ruleReference}</p>
                          <p><strong>Daily Late Fee:</strong> ₹{alert.dailyLateFee}/day (₹25 CGST + ₹25 SGST) under Section 47</p>
                          <p><strong>Interest Penalty:</strong> 18% per annum on unpaid net cash liability under Section 50(1)</p>
                          <p><strong>Filing Method:</strong> Online via GSTN Portal or Automated TaxFlow EVC/DSC integration</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredAlerts.length === 0 && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <h5 className="text-sm font-bold text-slate-800">No Alerts Matching Selected Filter</h5>
              <p className="text-xs text-slate-500 mt-1">All returns for this filter criteria are up to date or satisfied.</p>
              <button
                onClick={() => resetAlertStates(tenantId)}
                className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset Dismissed / Snoozed Alerts</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tax Profile Configuration Modal */}
      <TaxProfileConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        tenantId={tenantId}
        currentProfile={taxProfile}
        companyName={companyName}
        onProfileUpdated={(newProfile) => {
          setTaxProfile(newProfile);
          showToast('Tax profile updated. Filing deadlines recalculated!');
        }}
      />

      {/* Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles size={16} className="text-blue-400 shrink-0" />
          <span className="text-xs font-bold">{actionToast}</span>
        </div>
      )}
    </div>
  );
};
