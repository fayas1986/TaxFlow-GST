import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, BellOff, ShieldAlert, CalendarClock, CheckCircle2, 
  AlertTriangle, RefreshCw, ExternalLink, Sparkles, Volume2, 
  Settings2, Clock, Check
} from 'lucide-react';
import { fetchFilingHistory, fetchComplianceAlerts, fetchVendorRisks } from '../services/api';
import { 
  getNotificationPermissionState, 
  requestBrowserNotificationPermission, 
  triggerBrowserNotification, 
  scanAndNotifyComplianceDeadlines,
  NotificationAlertItem,
  checkNotificationSupport
} from '../utils/browserNotifications';

interface NotificationCenterProps {
  tenantId: string;
  onNavigate: (path: string) => void;
}

const EMPTY_FILINGS: any[] = [];
const EMPTY_ALERTS: any[] = [];
const EMPTY_VENDOR_RISKS: any[] = [];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ tenantId, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Filings, Alerts, and Vendor Risks
  const { data: filings } = useQuery({
    queryKey: ['filingHistory', tenantId],
    queryFn: () => fetchFilingHistory(tenantId)
  });

  const { data: alerts } = useQuery({
    queryKey: ['complianceAlerts', tenantId],
    queryFn: () => fetchComplianceAlerts(tenantId)
  });

  const { data: vendorRisks } = useQuery({
    queryKey: ['vendorRisks', tenantId],
    queryFn: () => fetchVendorRisks(tenantId)
  });

  // State for active alerts
  const [activeAlerts, setActiveAlerts] = useState<NotificationAlertItem[]>([]);

  // Update permission state on mount
  useEffect(() => {
    setPermissionState(getNotificationPermissionState());
  }, []);

  // Run automated scan when filings, alerts, or tenantId changes
  useEffect(() => {
    let isCancelled = false;
    const runScan = async () => {
      const result = await scanAndNotifyComplianceDeadlines(
        filings || EMPTY_FILINGS, 
        alerts || EMPTY_ALERTS, 
        vendorRisks || EMPTY_VENDOR_RISKS
      );
      if (!isCancelled) {
        const combined = [...result.deadlineAlerts, ...result.riskAlerts];
        setActiveAlerts(combined);
      }
    };
    if ((filings && filings.length > 0) || (alerts && alerts.length > 0)) {
      runScan();
    }
    return () => {
      isCancelled = true;
    };
  }, [tenantId, filings, alerts, vendorRisks]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRequestPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setPermissionState(perm);
    if (perm === 'granted') {
      triggerBrowserNotification('✅ Desktop Notifications Enabled', {
        body: 'TaxFlow will now alert you when GST filing deadlines are within 48 hours or critical risks occur.',
        force: true
      });
      setScanMessage('Browser notification permission granted successfully!');
    } else if (perm === 'denied') {
      setScanMessage('Notification permission denied. Please allow notifications in your browser settings.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  const handleTestNotification = () => {
    if (permissionState !== 'granted') {
      handleRequestPermission();
      return;
    }
    const success = triggerBrowserNotification('🚨 GST Deadline Test Alert', {
      body: 'GSTR-3B Return for July 2026 is due in 24 hours. Net payable liability: ₹1,24,000.',
      force: true,
      onClickUrl: '#/filing'
    });
    if (success) {
      setScanMessage('Test notification sent to your desktop!');
    } else {
      setScanMessage('Could not send notification. Please check browser permissions.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  const handleManualScan = async () => {
    setIsScanning(true);
    const result = await scanAndNotifyComplianceDeadlines(filings, alerts, vendorRisks, {
      forceDesktopAlert: true
    });
    const combined = [...result.deadlineAlerts, ...result.riskAlerts];
    setActiveAlerts(combined);
    setIsScanning(false);

    if (result.notificationsSentCount > 0) {
      setScanMessage(`Sent ${result.notificationsSentCount} browser alert(s) to desktop!`);
    } else if (combined.length > 0) {
      setScanMessage(`Detected ${combined.length} critical items. Grant permission to see desktop popups.`);
    } else {
      setScanMessage('All compliance deadlines and vendor risk checks are clean.');
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  const highPriorityCount = activeAlerts.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300 transition-all shadow-sm group focus:outline-none"
        title="Compliance & Deadline Notifications"
      >
        <Bell size={18} className="group-hover:scale-105 transition-transform text-slate-700" />
        
        {highPriorityCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {highPriorityCount > 9 ? '9+' : highPriorityCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Bell size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-none">Notification Center</h4>
                <p className="text-[11px] text-slate-400 mt-1">Browser Deadlines & Compliance Radar</p>
              </div>
            </div>

            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Rescan Deadlines & Risks"
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Browser Permission Control Strip */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${permissionState === 'granted' ? 'bg-emerald-500' : permissionState === 'denied' ? 'bg-rose-500' : 'bg-amber-500 animate-ping'}`} />
              <span className="font-semibold text-slate-700">
                Desktop Alerts: <span className="uppercase text-[11px] font-mono">{permissionState}</span>
              </span>
            </div>

            {permissionState !== 'granted' ? (
              <button
                onClick={handleRequestPermission}
                className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-[11px]"
              >
                Enable Desktop
              </button>
            ) : (
              <button
                onClick={handleTestNotification}
                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-all text-[11px]"
              >
                Test Alert
              </button>
            )}
          </div>

          {/* Toast Message inside Dropdown */}
          {scanMessage && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-[11px] font-medium text-indigo-900 flex items-center justify-between animate-in fade-in">
              <span>{scanMessage}</span>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-2">
            {activeAlerts.length === 0 ? (
              <div className="py-8 text-center px-4">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-800">No Imminent Deadlines or Risks</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  All returns are either filed or beyond the 48-hour deadline window.
                </p>
              </div>
            ) : (
              activeAlerts.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-3 group"
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    item.type === 'DEADLINE_48H' 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {item.type === 'DEADLINE_48H' ? <CalendarClock size={16} /> : <ShieldAlert size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                      <span className="text-[9px] font-black uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-full shrink-0">
                        {item.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{item.body}</p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (item.actionUrl) onNavigate(item.actionUrl);
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        Action <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Quick Links */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/compliance');
              }}
              className="text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1"
            >
              Compliance Hub &rarr;
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('/filing');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              File Returns &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
