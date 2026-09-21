const fs = require('fs');

// Patch Layout.tsx
let layout = fs.readFileSync('components/Layout.tsx', 'utf-8');

// Header background & shadow
layout = layout.replace(
  `className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-8 shadow-sm z-20 sticky top-0"`,
  `className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20 sticky top-0 shadow-sm"`
);

// H1 Dashboard text
layout = layout.replace(
  `className="text-2xl font-bold text-slate-900 tracking-tight"`,
  `className="text-[26px] font-extrabold text-[#0F172A] tracking-tight"`
);

// Synced & Secure pill
layout = layout.replace(
  `'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/75'`,
  `'bg-[#ECFDF5] border-[#A7F3D0] text-[#047857] hover:bg-[#D1FAE5]'`
);

// Calculator button
layout = layout.replace(
  `className="relative p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-full transition-all shadow-sm group"`,
  `className="relative w-11 h-11 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-full transition-all group"`
);
// Translate button
layout = layout.replace(
  `className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shadow-sm"`,
  `className="w-11 h-11 flex items-center justify-center rounded-full bg-[#F8FAFC] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"`
);

// Bell button
layout = layout.replace(
  `className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shadow-sm relative group"`,
  `className="w-11 h-11 flex items-center justify-center rounded-full bg-[#F8FAFC] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors relative group"`
);

// Tenant switcher (Acme Corp)
layout = layout.replace(
  `className="flex items-center gap-3 bg-white border border-slate-200 rounded-full pl-2 pr-3 py-1.5 hover:border-slate-300 hover:shadow-sm transition-all"`,
  `className="flex items-center gap-3 bg-white border border-slate-200 rounded-full pl-2 pr-4 py-1.5 hover:border-slate-300 transition-all"`
);
layout = layout.replace(
  `className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm"`,
  `className="w-9 h-9 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-sm"`
);

// GSTIN Switcher (Maharashtra)
layout = layout.replace(
  `'bg-indigo-50/90 border-indigo-200 text-indigo-900 hover:bg-indigo-100/80 ring-1 ring-indigo-500/20'`,
  `'bg-[#EEF2FF] border-[#C7D2FE] text-[#312E81] hover:bg-[#E0E7FF]'`
);
layout = layout.replace(
  `'bg-indigo-600 text-white shadow-sm'`,
  `'bg-[#4F46E5] text-white shadow-sm'`
);
layout = layout.replace(
  `className="text-xs font-bold leading-none"`,
  `className="text-[13px] font-extrabold leading-none text-[#1E3A8A]"`
);

// FY pill
layout = layout.replace(
  `className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-white text-slate-600 text-xs font-bold rounded-full border border-slate-200 shadow-sm"`,
  `className="hidden md:flex flex-col items-center justify-center px-4 py-1.5 bg-white text-slate-700 text-xs font-bold rounded-full border border-slate-200 text-center leading-tight"`
);
layout = layout.replace(
  `<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>\n              FY 2024-25`,
  `<span>FY</span><span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>2024-25</span>`
);


fs.writeFileSync('components/Layout.tsx', layout);
console.log("Layout.tsx patched!");
