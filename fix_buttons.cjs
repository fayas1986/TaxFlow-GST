const fs = require('fs');
let file = fs.readFileSync('pages/AuditLogs.tsx', 'utf-8');

file = file.replace(
  `                <button
                  onClick={exportCSV}
                  onClick={downloadRetentionAuditSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Download PDF report of retention deletions for the selected date range"
                >
                  <Download size={13} />
                  Download Audit Summary
                </button>

                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Download filtered logs as CSV"
                >
                  <FileSpreadsheet size={13} />
                  Download CSV
                </button>`,
  `                <button
                  onClick={downloadRetentionAuditSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] rounded-xl text-xs font-black transition-all shadow-sm"
                  title="Download PDF report of retention deletions for the selected date range"
                >
                  <Download size={13} />
                  Download Audit Summary
                </button>

                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Download filtered logs as CSV"
                >
                  <FileSpreadsheet size={13} />
                  Download CSV
                </button>`
);

fs.writeFileSync('pages/AuditLogs.tsx', file);
console.log("Buttons fixed!");
