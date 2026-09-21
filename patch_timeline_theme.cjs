const fs = require('fs');
let file = fs.readFileSync('components/dashboard/ComplianceDeadlinesTimeline.tsx', 'utf-8');

file = file.replace(
  `className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 relative overflow-hidden"`,
  `className="bg-white text-slate-900 p-5 rounded-[1.5rem] border border-slate-200 relative overflow-hidden shadow-sm"`
);

file = file.replace(
  `className="text-sm font-bold text-white tracking-wide"`,
  `className="text-[17px] font-extrabold text-[#0F172A] tracking-tight"`
);

// We need to change the colors of the Recharts axes and grids to dark instead of white text
file = file.replace(
  `stroke="rgba(255,255,255,0.1)"`,
  `stroke="#E2E8F0"`
);
file = file.replace(
  `stroke="rgba(255,255,255,0.1)"`,
  `stroke="#E2E8F0"`
);
file = file.replace(
  `fill="#94a3b8"`,
  `fill="#64748B"`
);
file = file.replace(
  `fill="#94a3b8"`,
  `fill="#64748B"`
);

file = file.replace(
  `stroke="#cbd5e1"`,
  `stroke="#475569"`
);

// Change the footer text colors
file = file.replace(
  `className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-4"`,
  `className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4"`
);
file = file.replace(
  `className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5"`,
  `className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"`
);
file = file.replace(
  `className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5"`,
  `className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"`
);
file = file.replace(
  `className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5"`,
  `className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"`
);
file = file.replace(
  `className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5"`,
  `className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"`
);
file = file.replace(
  `className="text-[10px] text-slate-500 font-medium italic"`,
  `className="text-[10px] text-[#64748B] font-medium italic"`
);

fs.writeFileSync('components/dashboard/ComplianceDeadlinesTimeline.tsx', file);
console.log("Timeline theme patched!");
