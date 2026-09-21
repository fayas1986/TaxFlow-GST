import React, { useState } from 'react';
import { X, Clock, Mail, Calendar, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (config: any) => Promise<void>;
}

export const ScheduleReportModal: React.FC<Props> = ({ isOpen, onClose, onSchedule }) => {
  const [reportType, setReportType] = useState('Consolidated GST Summary');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [time, setTime] = useState('09:00');
  const [recipients, setRecipients] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipients) return;
    
    setIsScheduling(true);
    try {
      await onSchedule({
        reportType,
        frequency,
        time,
        emailRecipients: recipients.split(',').map(e => e.trim()).filter(e => e)
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to schedule the report.');
    } finally {
      setIsScheduling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Schedule Automated Report</h3>
                <p className="text-xs text-slate-500">Configure recurring email delivery of GST reports</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {isSuccess ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2 animate-bounce">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-800">Job Scheduled Successfully</h4>
              <p className="text-sm text-slate-500 max-w-xs">Your automated report has been queued and will be delivered according to the specified frequency.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400"/> Report Type
                  </label>
                  <select 
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Consolidated GST Summary">Consolidated Monthly GST Summary</option>
                    <option value="Reconciliation Report (GSTR-2A/2B)">Reconciliation Report (GSTR-2A/2B)</option>
                    <option value="ITC Deficit & Risk Assessment">ITC Deficit & Risk Assessment</option>
                    <option value="Multi-Branch Compliance Snapshot">Multi-Branch Compliance Snapshot</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Frequency</label>
                    <select 
                      value={frequency}
                      onChange={e => setFrequency(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly (Monday)</option>
                      <option value="MONTHLY">Monthly (1st)</option>
                      <option value="QUARTERLY">Quarterly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Time of Day</label>
                    <input 
                      type="time" 
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Mail size={14} className="text-slate-400"/> Delivery Recipients
                  </label>
                  <input 
                    type="text" 
                    placeholder="finance@company.com, audit@company.com"
                    value={recipients}
                    onChange={e => setRecipients(e.target.value)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-[11px] text-slate-500">Separate multiple email addresses with a comma.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isScheduling || !recipients}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isScheduling ? 'Scheduling...' : 'Save Job Schedule'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
