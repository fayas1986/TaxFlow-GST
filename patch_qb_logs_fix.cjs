const fs = require('fs');
const file = 'pages/Integrations.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLogsBlock = `{logs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 logs.map((log, i) => (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{log.time}]</span>
                     <span className={log.message.includes('ERROR') ? 'text-rose-400' : log.message.includes('SUCCESS') || log.message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{log.message}</span>
                   </div>
                 ))
               )}`;

const newLogsBlock = `{systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('QUICKBOOKS')).map((log, i) => {
                   const timeMatch = log.match(/\\[(.*?)\\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\\[.*?\\]\\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}`;

content = content.replace(oldLogsBlock, newLogsBlock);
fs.writeFileSync(file, content);
