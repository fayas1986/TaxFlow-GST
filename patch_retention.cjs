const fs = require('fs');
let file = fs.readFileSync('pages/DocumentVaultPage.tsx', 'utf-8');

// 1. Add states
const stateInjection = `
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionPolicy, setRetentionPolicy] = useState({
    years: 7,
    action: 'ARCHIVE', // 'ARCHIVE' | 'DELETE'
    isActive: false,
  });

  const isRetentionFlagged = (doc) => {
    if (!retentionPolicy.isActive) return false;
    const issueDate = new Date(doc.issueDate).getTime();
    const now = Date.now();
    const diffYears = (now - issueDate) / (1000 * 60 * 60 * 24 * 365.25);
    return diffYears > retentionPolicy.years;
  };
`;
file = file.replace(
  `  const [tagSearchMode, setTagSearchMode] = useState<'AND' | 'OR'>('OR');`,
  stateInjection + `\n  const [tagSearchMode, setTagSearchMode] = useState<'AND' | 'OR'>('OR');`
);

// 2. Add Sidebar Card
const sidebarInjection = `
          {/* Data Governance & Retention */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mt-8 -mr-8" />
            <div className="flex items-center justify-between mb-1 relative z-10">
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Data Governance
              </h3>
              <button 
                onClick={() => setIsRetentionModalOpen(true)}
                className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wide"
              >
                Configure
              </button>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className={\`p-2 rounded-xl border \${retentionPolicy.isActive ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}\`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={\`text-xs font-bold \${retentionPolicy.isActive ? 'text-white' : 'text-slate-400'}\`}>
                  {retentionPolicy.isActive ? \`Retention: \${retentionPolicy.years} Years\` : 'Retention Inactive'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {retentionPolicy.isActive 
                    ? \`Auto-\${retentionPolicy.action.toLowerCase()} aging records.\`
                    : 'Prevent storage bloat.'}
                </p>
              </div>
            </div>
          </div>
`;
file = file.replace(
  `{/* Secure Tag Index & Workspace Search */}`,
  sidebarInjection + `\n          {/* Secure Tag Index & Workspace Search */}`
);

fs.writeFileSync('pages/DocumentVaultPage.tsx', file);
