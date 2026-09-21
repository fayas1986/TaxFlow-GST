// Browser Notification API Utility for TaxFlow

export interface NotificationAlertItem {
  id: string;
  title: string;
  body: string;
  type: 'DEADLINE_48H' | 'CRITICAL_RISK' | 'GENERAL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  actionUrl?: string;
  read?: boolean;
}

const SENT_NOTIFICATIONS_KEY = 'taxflow_sent_notifications_v1';

const getSentNotificationIds = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(SENT_NOTIFICATIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const markNotificationAsSent = (id: string) => {
  try {
    const set = getSentNotificationIds();
    set.add(id);
    sessionStorage.setItem(SENT_NOTIFICATIONS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.error('Failed to save sent notification state', e);
  }
};

export const checkNotificationSupport = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermissionState = (): NotificationPermission => {
  if (!checkNotificationSupport()) return 'denied';
  return Notification.permission;
};

export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!checkNotificationSupport()) {
    alert('Browser notifications are not supported in this browser.');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * Play a subtle Web Audio chime for critical alerts
 */
export const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Create a pleasant two-tone chime (E5 -> A5)
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch {
    // Audio context may be blocked by browser autoplay policy
  }
};

/**
 * Trigger a browser desktop notification
 */
export const triggerBrowserNotification = (
  title: string,
  options?: NotificationOptions & { onClickUrl?: string; alertId?: string; force?: boolean }
): boolean => {
  if (!checkNotificationSupport()) return false;

  const permission = Notification.permission;
  if (permission !== 'granted') return false;

  const { alertId, force, onClickUrl, ...notificationOptions } = options || {};

  // Prevent spamming duplicate browser notifications in the same session
  if (alertId && !force) {
    const sentIds = getSentNotificationIds();
    if (sentIds.has(alertId)) {
      return false;
    }
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: true,
      ...notificationOptions
    });

    playNotificationChime();

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (onClickUrl && typeof window !== 'undefined') {
        window.location.hash = onClickUrl;
      }
      notification.close();
    };

    if (alertId) {
      markNotificationAsSent(alertId);
    }

    return true;
  } catch (e) {
    console.error('Error triggering browser notification:', e);
    return false;
  }
};

/**
 * Calculates hours remaining between current time and target date string (YYYY-MM-DD or ISO)
 */
export const calculateHoursRemaining = (targetDateStr: string): number => {
  const target = new Date(targetDateStr);
  // Set target time to 23:59:59 of due date if time is not specified
  if (targetDateStr.length <= 10) {
    target.setHours(23, 59, 59, 999);
  }
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
};

/**
 * Main Scanner function: Scans filing records and compliance alerts
 * Fires desktop notifications for deadlines <= 48h and critical compliance risks.
 */
export interface ScanResult {
  deadlineAlerts: NotificationAlertItem[];
  riskAlerts: NotificationAlertItem[];
  notificationsSentCount: number;
}

export const scanAndNotifyComplianceDeadlines = async (
  filings: Array<{ id: string; type: string; period: string; dueDate: string; status: string }>,
  alerts: Array<{ id: string; title: string; message: string; severity: string; type: string }>,
  vendorRisks: Array<{ vendorName: string; complianceScore: number; totalItcAtRisk: number; status: string }>,
  options?: { forceDesktopAlert?: boolean }
): Promise<ScanResult> => {
  const deadlineAlertItems: NotificationAlertItem[] = [];
  const riskAlertItems: NotificationAlertItem[] = [];
  let sentCount = 0;

  // 1. Check Filing Deadlines within 48 Hours
  filings.forEach((filing) => {
    if (filing.status === 'FILED') return;

    const hours = calculateHoursRemaining(filing.dueDate);
    const isOverdue = hours < 0;
    const isWithin48Hours = hours >= 0 && hours <= 48;

    if (isWithin48Hours || isOverdue) {
      const hoursFormatted = isOverdue
        ? `OVERDUE by ${Math.abs(Math.round(hours))} hours`
        : `${Math.round(hours)} hours remaining`;

      const alertId = `filing-48h-${filing.id}-${filing.dueDate}`;
      const title = isOverdue
        ? `🔴 OVERDUE: GST ${filing.type} Return`
        : `🚨 Filing Deadline in ${Math.round(hours)}h: ${filing.type}`;

      const body = `${filing.type} (${filing.period}) due date is ${filing.dueDate} [${hoursFormatted}]. File immediately to avoid penal interest!`;

      deadlineAlertItems.push({
        id: alertId,
        title,
        body,
        type: 'DEADLINE_48H',
        severity: 'HIGH',
        timestamp: new Date().toISOString(),
        actionUrl: '/filing'
      });

      const sent = triggerBrowserNotification(title, {
        body,
        tag: alertId,
        alertId,
        force: options?.forceDesktopAlert,
        onClickUrl: '#/filing'
      });

      if (sent) sentCount++;
    }
  });

  // 2. Check Critical Compliance Risks (HIGH severity or Non-compliant vendors)
  alerts.forEach((alert) => {
    if (alert.severity === 'HIGH' || alert.type === 'VENDOR_RISK' || alert.type === 'PENALTY') {
      const alertId = `risk-alert-${alert.id}`;
      const title = `⚠️ Critical Compliance Risk: ${alert.title}`;
      const body = `${alert.message}`;

      riskAlertItems.push({
        id: alertId,
        title,
        body,
        type: 'CRITICAL_RISK',
        severity: alert.severity as any,
        timestamp: new Date().toISOString(),
        actionUrl: '/compliance'
      });

      const sent = triggerBrowserNotification(title, {
        body,
        tag: alertId,
        alertId,
        force: options?.forceDesktopAlert,
        onClickUrl: '#/compliance'
      });

      if (sent) sentCount++;
    }
  });

  // 3. Check High Vendor Compliance Risks (Score < 50 or NON_COMPLIANT with high ITC at risk)
  vendorRisks.forEach((vendor, index) => {
    if (vendor.status === 'NON_COMPLIANT' || vendor.complianceScore < 50) {
      const alertId = `vendor-risk-${vendor.vendorName.replace(/\s+/g, '')}-${index}`;
      const title = `🛡️ Non-Compliant Vendor Risk: ${vendor.vendorName}`;
      const body = `Compliance score ${vendor.complianceScore}%. ₹${vendor.totalItcAtRisk.toLocaleString()} ITC is at risk of blockage.`;

      riskAlertItems.push({
        id: alertId,
        title,
        body,
        type: 'CRITICAL_RISK',
        severity: 'HIGH',
        timestamp: new Date().toISOString(),
        actionUrl: '/compliance'
      });

      const sent = triggerBrowserNotification(title, {
        body,
        tag: alertId,
        alertId,
        force: options?.forceDesktopAlert,
        onClickUrl: '#/compliance'
      });

      if (sent) sentCount++;
    }
  });

  return {
    deadlineAlerts: deadlineAlertItems,
    riskAlerts: riskAlertItems,
    notificationsSentCount: sentCount
  };
};
