const fs = require('fs');
let dashboard = fs.readFileSync('pages/Dashboard.tsx', 'utf-8');

// The toggle container: add overflow-x-auto and hide scrollbar
dashboard = dashboard.replace(
  `className="flex items-center gap-1.5 p-1.5 bg-[#1E293B] rounded-xl border border-[#334155]/50 w-full md:w-auto"`,
  `className="flex items-center gap-1.5 p-1.5 bg-[#1E293B] rounded-xl border border-[#334155]/50 w-full xl:w-auto overflow-x-auto shrink-0"`
);

// The buttons inside: add whitespace-nowrap
dashboard = dashboard.replace(
  `className={\`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black tracking-wide transition-all \${`,
  `className={\`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black tracking-wide whitespace-nowrap transition-all \${`
);
dashboard = dashboard.replace(
  `className={\`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black tracking-wide transition-all \${`,
  `className={\`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black tracking-wide whitespace-nowrap transition-all \${`
);

// The text on the right: hide on lg, show on xl, add truncation just in case
dashboard = dashboard.replace(
  `<div className="flex items-center gap-3 px-3 text-xs text-slate-400">`,
  `<div className="flex items-center gap-3 px-3 text-xs text-[#94A3B8] truncate">`
);
dashboard = dashboard.replace(
  `<span className="hidden lg:inline font-medium">`,
  `<span className="hidden xl:inline font-medium truncate">`
);

// We need to fix the parent flex to handle the truncation gracefully
dashboard = dashboard.replace(
  `className="bg-[#0F1523] text-white rounded-[1.5rem] p-3 border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm mt-4"`,
  `className="bg-[#0F1523] text-white rounded-[1.5rem] p-3 border border-[#1E293B] flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm mt-4 overflow-hidden"`
);

fs.writeFileSync('pages/Dashboard.tsx', dashboard);
console.log("Dashboard.tsx overlap patched!");
