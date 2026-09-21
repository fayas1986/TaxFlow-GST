const fs = require('fs');
let dashboard = fs.readFileSync('pages/Dashboard.tsx', 'utf-8');

dashboard = dashboard.replace(
  `'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'`,
  `'bg-[#4F46E5] text-white shadow-sm'`
);
dashboard = dashboard.replace(
  `'bg-blue-600 text-white shadow-lg shadow-blue-600/30'`,
  `'bg-[#4F46E5] text-white shadow-sm'`
);

fs.writeFileSync('pages/Dashboard.tsx', dashboard);
console.log("Colors patched!");
