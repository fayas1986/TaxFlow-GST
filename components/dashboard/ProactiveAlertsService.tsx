import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ShieldAlert, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ProactiveAlertsService: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isDismissed, setIsDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Generate some proactive alerts based on typical GST requirements
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const newAlerts = [];

    // 1. Filing Deadlines (e.g. GSTR-1 is 11th, GSTR-3B is 20th)
    if (currentDay <= 11) {
      const daysLeft = 11 - currentDay;
      newAlerts.push({
        id: 'gstr1-deadline',
        type: 'WARNING',
        icon: Clock,
        title: 'Approaching GSTR-1 Deadline',
        message: `Your GSTR-1 filing for the previous month is due in ${daysLeft} day(s). Please finalize outward supplies.`,
        actionText: 'Review Outward Supplies',
        link: '#/invoices'
      });
    } else if (currentDay <= 20) {
      const daysLeft = 20 - currentDay;
      newAlerts.push({
        id: 'gstr3b-deadline',
        type: 'WARNING',
        icon: Clock,
        title: 'Approaching GSTR-3B Deadline',
        message: `Your GSTR-3B filing is due in ${daysLeft} day(s). Finalize ITC claims to avoid penalties.`,
        actionText: 'Prepare GSTR-3B',
        link: '#/filing'
      });
    }

    // 2. GSTR-2A/2B Mismatches
    // We'll simulate finding some mismatches from the reconciliation background process
    newAlerts.push({
      id: 'gstr2b-mismatch',
      type: 'CRITICAL',
      icon: ShieldAlert,
      title: 'Action Required: GSTR-2B Mismatches Detected',
      message: 'Background reconciliation identified 3 invoices missing from the official GSTN portal. ₹45,200 of ITC is currently at risk.',
      actionText: 'Resolve Mismatches',
      link: '#/reconciliation'
    });

    setAlerts(newAlerts);
  }, []);

  const handleDismiss = (id: string) => {
    setIsDismissed(prev => ({ ...prev, [id]: true }));
  };

  const activeAlerts = alerts.filter(a => !isDismissed[a.id]);

  if (activeAlerts.length === 0) {
    return null; // All clear
  }

  return (
    <div className="space-y-3 mb-8">
      <AnimatePresence>
        {activeAlerts.map((alert) => {
          const Icon = alert.icon;
          const isCritical = alert.type === 'CRITICAL';
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                isCritical 
                  ? 'bg-rose-50 border-rose-200/60' 
                  : 'bg-amber-50/50 border-amber-200/60'
              }`}
            >
              {/* Alert icon badge */}
              <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                isCritical ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <Icon size={20} className={isCritical ? 'animate-pulse' : ''} />
              </div>

              <div className="flex-1 space-y-1 pr-8">
                <h4 className={`text-sm font-bold tracking-tight flex items-center gap-2 ${
                  isCritical ? 'text-rose-900' : 'text-amber-900'
                }`}>
                  {alert.title}
                  {isCritical && (
                     <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-200 text-rose-800">
                       High Priority
                     </span>
                  )}
                </h4>
                <p className={`text-xs ${isCritical ? 'text-rose-700' : 'text-amber-700/80'} leading-relaxed`}>
                  {alert.message}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <a 
                  href={alert.link}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    isCritical 
                      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20' 
                      : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20'
                  }`}
                >
                  {alert.actionText}
                  <ChevronRight size={14} />
                </a>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => handleDismiss(alert.id)}
                className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${
                  isCritical ? 'text-rose-400 hover:bg-rose-100' : 'text-amber-400 hover:bg-amber-100'
                }`}
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
