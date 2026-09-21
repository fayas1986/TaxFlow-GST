const fs = require('fs');
let dashboard = fs.readFileSync('pages/Dashboard.tsx', 'utf-8');

// Replace the first card (Executive Welcome Banner)
const originalBanner = `<div className="bg-slate-900 text-white p-6 lg:p-8 rounded-2xl shadow-md border border-slate-800 relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">`;
const newBanner = `<div className="bg-[#0F1523] text-white p-6 lg:p-8 rounded-[1.5rem] relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-sm border border-[#1E293B]">`;
dashboard = dashboard.replace(originalBanner, newBanner);

// Remove the glowing blur circle
dashboard = dashboard.replace(`<div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>`, ``);

// Icon background
dashboard = dashboard.replace(
  `<div className="w-14 h-14 rounded-xl bg-blue-600/90 text-white flex items-center justify-center font-bold text-xl shadow-md border border-blue-400/30 shrink-0">`,
  `<div className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-bold text-2xl shadow-sm shrink-0">`
);

// Enterprise Group Portal badge
dashboard = dashboard.replace(
  `'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'`,
  `'bg-[#272A4B] text-[#A5B4FC] border-transparent px-3 py-1 text-[11px] font-bold rounded-md'`
);
// Subsidiaries text
dashboard = dashboard.replace(
  `<span className="text-slate-400 text-xs font-mono">`,
  `<span className="text-[#94A3B8] text-xs font-medium ml-2">`
);

// Dashboard Title
dashboard = dashboard.replace(
  `<h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">`,
  `<h2 className="text-[32px] font-extrabold tracking-tight text-white mt-3 mb-2 leading-tight">`
);

// Date text
dashboard = dashboard.replace(
  `<p className="text-slate-400 text-xs font-medium flex items-center gap-2 mt-1">`,
  `<p className="text-[#94A3B8] text-sm font-medium flex items-center gap-2">`
);
// Make the calendar icon invisible or smaller since it's not prominently blue in the design
dashboard = dashboard.replace(
  `<CalendarIcon size={13} className="text-blue-400" />`,
  `<CalendarIcon size={14} className="text-[#64748B]" />`
);
// Adjust bullet
dashboard = dashboard.replace(
  `<span className="text-slate-600">•</span>`,
  `<span className="text-[#475569]">•</span>`
);
// Adjust the overview text
dashboard = dashboard.replace(
  `<span className="text-slate-300">`,
  `<span className="text-[#F8FAFC]">`
);

// Yellow Button
dashboard = dashboard.replace(
  `className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 group active:scale-95"`,
  `className="px-5 py-2.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] font-extrabold text-[13px] rounded-xl transition-all flex items-center gap-2 group"`
);
// OCR badge on button
dashboard = dashboard.replace(
  `<span className="px-1.5 py-0.5 rounded-full bg-slate-950/20 text-slate-950 text-[10px] uppercase font-black">`,
  `<span className="px-2 py-0.5 rounded-full bg-black/10 text-black/80 text-[10px] uppercase font-black">`
);

// Segmented Control (WEEKLY/MONTHLY/QUARTERLY)
const originalSegment = `<div className="flex flex-1 lg:flex-none gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shadow-inner">`;
const newSegment = `<div className="flex flex-1 lg:flex-none gap-1 bg-[#1E293B] p-1.5 rounded-xl border border-[#334155]/50">`;
dashboard = dashboard.replace(originalSegment, newSegment);

dashboard = dashboard.replace(
  `'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/40'`,
  `'bg-[#2563EB] text-white shadow-sm'`
);
dashboard = dashboard.replace(
  `'text-slate-400 hover:text-white hover:bg-slate-700/50'`,
  `'text-[#94A3B8] hover:text-white hover:bg-[#334155]/50'`
);
// Adjust font weight for tabs
dashboard = dashboard.replace(
  `className={\`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 \${`,
  `className={\`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 \${`
);

// Hide the trailing weeks badge
dashboard = dashboard.replace(
  `<span className="hidden xl:inline-flex px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] font-semibold text-slate-300 items-center gap-1.5 whitespace-nowrap">`,
  `<span className="hidden">`
);

// Second block: primary Dashboard Mode selector
const origModeSelector = `<div className="bg-slate-900 text-white rounded-2xl p-2.5 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">`;
const newModeSelector = `<div className="bg-[#0F1523] text-white rounded-[1.5rem] p-3 border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm mt-4">`;
dashboard = dashboard.replace(origModeSelector, newModeSelector);

const origModeToggle = `<div className="flex items-center gap-2 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50 w-full md:w-auto">`;
const newModeToggle = `<div className="flex items-center gap-1.5 p-1.5 bg-[#1E293B] rounded-xl border border-[#334155]/50 w-full md:w-auto">`;
dashboard = dashboard.replace(origModeToggle, newModeToggle);

// Dashboard mode toggle buttons
dashboard = dashboard.replace(
  `'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-500/50'`,
  `'bg-[#4F46E5] text-white shadow-sm'`
);
dashboard = dashboard.replace(
  `'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'`,
  `'text-[#94A3B8] hover:text-white hover:bg-[#334155]/50'`
);
// Dashboard mode toggle buttons #2
dashboard = dashboard.replace(
  `'bg-blue-600 text-white shadow-md ring-1 ring-blue-500/50'`,
  `'bg-[#4F46E5] text-white shadow-sm'`
);
dashboard = dashboard.replace(
  `'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'`,
  `'text-[#94A3B8] hover:text-white hover:bg-[#334155]/50'`
);
// Remove trailing texts in the second bar
dashboard = dashboard.replace(
  `<span className="text-slate-400 text-xs font-medium">`,
  `<span className="text-[#94A3B8] text-xs font-medium mr-4">`
);

fs.writeFileSync('pages/Dashboard.tsx', dashboard);
console.log("Dashboard.tsx patched!");
