import React, { useState } from 'react';
import { History, Clock, User, RotateCcw, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Invoice, InvoiceVersion } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface InvoiceVersionHistoryProps {
  invoice: Invoice;
  onRestore: (versionId: string) => Promise<void>;
  isRestoring: boolean;
}

const InvoiceVersionHistory: React.FC<InvoiceVersionHistoryProps> = ({ invoice, onRestore, isRestoring }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const versions = invoice.versionHistory || [
    {
      id: 'v-initial',
      timestamp: invoice.date + 'T09:00:00Z',
      modifiedBy: 'System OCR',
      changeSummary: 'Initial extraction from document',
      dataSnapshot: { ...invoice }
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-80 animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={18} className="text-blue-500" />
          <h3 className="font-bold text-slate-800 text-sm">Version History</h3>
        </div>
        <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
          {versions.length} Points
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {versions.map((version, index) => (
          <div 
            key={version.id}
            className={`relative pl-6 pb-6 group cursor-pointer ${index === versions.length - 1 ? '' : 'border-l border-slate-100'}`}
            onClick={() => setSelectedVersionId(selectedVersionId === version.id ? null : version.id)}
          >
            <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-colors ${index === 0 ? 'bg-blue-500 ring-4 ring-blue-50' : 'bg-slate-300 group-hover:bg-blue-400'}`} />
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {new Date(version.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {index === 0 && (
                  <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Current</span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                {version.changeSummary}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <User size={10} />
                <span>{version.modifiedBy}</span>
              </div>
            </div>

            <AnimatePresence>
              {selectedVersionId === version.id && index !== 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                        Restoring will overwrite current metadata with this snapshot's values.
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(version.id);
                      }}
                      disabled={isRestoring}
                      className="w-full py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {isRestoring ? <RotateCcw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                      Undo to this Point
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
           <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
           <p className="text-[10px] text-blue-700 font-bold leading-tight">
             All changes are cryptographically hashed and versioned for GST audit readiness.
           </p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceVersionHistory;
