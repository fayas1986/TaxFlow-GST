const fs = require('fs');
let file = fs.readFileSync('components/dashboard/ComplianceDeadlinesTimeline.tsx', 'utf-8');

file = file.replace(
  `contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}`,
  `contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}`
);

fs.writeFileSync('components/dashboard/ComplianceDeadlinesTimeline.tsx', file);
console.log("Tooltip patched");
