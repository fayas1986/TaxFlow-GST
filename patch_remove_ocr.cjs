const fs = require('fs');
let dashboard = fs.readFileSync('pages/Dashboard.tsx', 'utf-8');

const originalBtn = `<button
             onClick={() => setIsCameraScannerOpen(true)}
             className="px-5 py-2.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#111827] font-extrabold text-[13px] rounded-xl transition-all flex items-center gap-2 group"
           >
             <Camera size={16} className="text-slate-950 group-hover:rotate-12 transition-transform" />
             <span>Scan Physical Receipt</span>
             <span className="px-2 py-0.5 rounded-full bg-black/10 text-black/80 text-[10px] uppercase font-black">
               OCR
             </span>
           </button>`;

dashboard = dashboard.replace(originalBtn, '');

fs.writeFileSync('pages/Dashboard.tsx', dashboard);
console.log("OCR button removed!");
