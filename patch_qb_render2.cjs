const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const qbSyncSettings = `
        {activeIntegration?.id === 'qb' && (
          <div className="flex items-center justify-between p-4 border border-green-200 rounded-xl bg-green-50/50">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-green-900 flex items-center gap-2">
                 <BarChart3 size={14} className="text-green-700"/> Sync General Ledger & Tax Liability
              </h4>
              <p className="text-[11px] text-green-700 mt-1 font-medium leading-relaxed">
                Automatically push Tax Liability Reports and Journal Entries directly to QuickBooks Online.
              </p>
            </div>
            <div 
                onClick={() => setQbSyncTaxLiability(!qbSyncTaxLiability)}
                className={\`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 \${qbSyncTaxLiability ? 'bg-green-600' : 'bg-green-200'}\`}
            >
                <div className={\`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 \${qbSyncTaxLiability ? 'translate-x-5' : 'translate-x-0'}\`}></div>
            </div>
          </div>
        )}
`;

content = content.replace(
  '        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">',
  qbSyncSettings + '\n        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">'
);

fs.writeFileSync(file, content);
