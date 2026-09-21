const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

file = file.replace(
  `} from 'lucide-react';`,
  `, Archive, Trash2 } from 'lucide-react';`
);

const modalInjection = `
      {/* DATA GOVERNANCE & RETENTION MODAL */}
      <AnimatePresence>
        {isRetentionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wide">Data Governance</h3>
                    <p className="text-xs text-slate-400 font-medium">Configure document retention policies</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Enforce Retention Policy</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically manage aging documents.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={retentionPolicy.isActive}
                      onChange={(e) => setRetentionPolicy(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {retentionPolicy.isActive && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-5"
                  >
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Retention Period</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          value={retentionPolicy.years} 
                          onChange={(e) => setRetentionPolicy(prev => ({ ...prev, years: parseInt(e.target.value) }))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 w-24 text-center shrink-0">
                          {retentionPolicy.years} Years
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">Standard tax compliance recommends a 7-year retention period.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Action After Expiry</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setRetentionPolicy(prev => ({ ...prev, action: 'ARCHIVE' }))}
                          className={\`p-4 rounded-xl border-2 text-left transition-all \${
                            retentionPolicy.action === 'ARCHIVE' 
                              ? 'border-indigo-600 bg-indigo-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }\`}
                        >
                          <div className={\`mb-2 \${retentionPolicy.action === 'ARCHIVE' ? 'text-indigo-600' : 'text-slate-400'}\`}>
                            <Archive size={20} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-800">Cold Storage</h5>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">Archive to cheaper cold storage. Recoverable.</p>
                        </button>

                        <button 
                          onClick={() => setRetentionPolicy(prev => ({ ...prev, action: 'DELETE' }))}
                          className={\`p-4 rounded-xl border-2 text-left transition-all \${
                            retentionPolicy.action === 'DELETE' 
                              ? 'border-rose-600 bg-rose-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }\`}
                        >
                          <div className={\`mb-2 \${retentionPolicy.action === 'DELETE' ? 'text-rose-600' : 'text-slate-400'}\`}>
                            <Trash2 size={20} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-800">Permanent Deletion</h5>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">Permanently purge from all databases.</p>
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">Data Impact Warning</p>
                        <p className="text-[10px] text-amber-700 mt-1">
                          This policy will immediately flag <strong>{documents.filter(isRetentionFlagged).length}</strong> document(s) currently in your vault for {retentionPolicy.action === 'ARCHIVE' ? 'archival' : 'deletion'}.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Policy Config
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
`;

file = file.replace(
  `{/* MANAGE SECURE WORKSPACES MODAL */}`,
  modalInjection + `\n      {/* MANAGE SECURE WORKSPACES MODAL */}`
);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
