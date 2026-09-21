import React, { useState, useMemo } from 'react';
import { History, Download, Lock, Loader2, List, AlignLeft, Filter, Activity, Clock, User, Shield } from 'lucide-react';
import { AuditLogData } from '../../types';
import { motion } from 'framer-motion';

interface AuditLogsProps {
  auditLogs: AuditLogData[] | undefined;
  isAuditLoading: boolean;
  onExport: () => void;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ auditLogs, isAuditLoading, onExport }) => {
  const [viewMode, setViewMode] = useState<'TABLE' | 'TIMELINE'>('TIMELINE');
  
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  const handleJumpToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setFilterDate(today);
    setViewMode('TIMELINE');
  };

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs.filter(log => {
      const matchRole = filterRole === 'ALL' || log.role === filterRole;
      const matchAction = filterAction === 'ALL' || log.action === filterAction;
      const matchDate = !filterDate || log.timestamp.startsWith(filterDate);
      return matchRole && matchAction && matchDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, filterRole, filterAction, filterDate]);

  const uniqueRoles = useMemo(() => Array.from(new Set(auditLogs?.map(l => l.role) || [])), [auditLogs]);
  const uniqueActions = useMemo(() => Array.from(new Set(auditLogs?.map(l => l.action) || [])), [auditLogs]);

  return (
    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <History size={20} className="text-blue-500" />
          Audit Logs & Activity Trail
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('TIMELINE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'TIMELINE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlignLeft size={14} /> Timeline
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'TABLE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List size={14} /> Table
            </button>
          </div>
          <button
            onClick={onExport}
            disabled={!auditLogs || auditLogs.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} className="text-blue-500" />
            Export Logs
          </button>
          <span className="hidden sm:flex text-[10px] text-slate-500 bg-slate-100 px-2 py-1.5 rounded border border-slate-200 items-center gap-1 font-bold uppercase tracking-wider">
            <Lock size={12}/> Cryptographically Signed
          </span>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
        <p className="text-sm text-slate-600 mb-4">
          This ledger tracks all critical actions taken by users within this organization. 
          Each entry is cryptographically hashed to ensure immutability and compliance with enterprise audit standards.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User size={12} /> User Role
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Activity size={12} /> Action Type
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock size={12} /> Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleJumpToToday}
                className="px-3 h-9 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors whitespace-nowrap shadow-sm"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAuditLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
          <span className="text-sm font-medium text-slate-500">Loading audit trail...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <Shield className="text-slate-300 mb-3" size={48} />
          <span className="text-sm font-bold text-slate-700">No audit logs found</span>
          <span className="text-xs text-slate-500">Try adjusting your filters</span>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          {viewMode === 'TABLE' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-700">Timestamp</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">User</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Action</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Module</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-slate-600">{new Date(log.timestamp).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{log.user}</div>
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-tight">{log.role}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800 font-medium">{log.action}</div>
                        {log.details && <div className="text-slate-500 text-[11px] mt-0.5 max-w-xs truncate" title={log.details}>{log.details}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 relative">
              <div className="absolute left-10 top-6 bottom-6 w-0.5 bg-slate-100"></div>
              <div className="space-y-6">
                {filteredLogs.map((log, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                    key={log.id} 
                    className="relative pl-12 sm:pl-16 group"
                  >
                    <div className={`absolute left-[13px] sm:left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 ${
                      log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}></div>
                    
                    <div className="bg-white border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md transition-all rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-black uppercase tracking-wider">
                            {log.module}
                          </span>
                          <span className={`text-[10px] font-bold ${log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {log.status}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <h4 className="text-sm font-bold text-slate-800 mb-1">{log.action}</h4>
                      {log.details && (
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">{log.details}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {log.user.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-slate-700">{log.user}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{log.role}</span>
                        
                        {log.ipAddress && (
                           <>
                             <span className="text-slate-300">•</span>
                             <span className="text-[10px] font-mono text-slate-400">{log.ipAddress}</span>
                           </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
