const fs = require('fs');
const file = 'pages/Invoices.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update eligibleForEInvoice
content = content.replace(
  "return inv && !inv.irn && (inv.type === 'B2B' || inv.type === 'EXPORT') && inv.docType === 'INVOICE';",
  "return inv && !inv.irn && (inv.status === 'APPROVED' || inv.status === 'PENDING') && (inv.type === 'B2B' || inv.type === 'EXPORT') && inv.docType === 'INVOICE';"
);

// 2. Update Modal Footer Actions
const oldFooter = `                       <div className="flex items-center gap-4">
                           {canEdit && selectedInvoice.status === 'PENDING' && !selectedInvoice.irn && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'UPLOADED'}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <ScanLine size={16}/> Generate E-Invoice Now </button>
                           )}
                           {canEdit && selectedInvoice.status === 'FAILED' && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'PENDING', irnError: undefined}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <RefreshCw size={14}/> Retry Generation </button>
                           )}`;

const newFooter = `                       <div className="flex items-center gap-4">
                           {canEdit && selectedInvoice.status === 'DRAFT' && (
                               <button onClick={() => { handleInlineEdit(selectedInvoice.id, 'status', 'PENDING_APPROVAL'); setSelectedInvoice({...selectedInvoice, status: 'PENDING_APPROVAL'}); }} className="text-sm text-orange-600 font-semibold hover:text-orange-700 hover:underline flex items-center gap-1"> <Send size={16}/> Send for Approval </button>
                           )}
                           {canEdit && selectedInvoice.status === 'PENDING_APPROVAL' && user?.role === UserRole.FINANCE_MANAGER && (
                               <>
                                <button onClick={() => { handleInlineEdit(selectedInvoice.id, 'status', 'APPROVED'); setSelectedInvoice({...selectedInvoice, status: 'APPROVED'}); }} className="text-sm text-teal-600 font-semibold hover:text-teal-700 hover:underline flex items-center gap-1 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200"> <CheckCircle2 size={16}/> Approve Draft </button>
                                <button onClick={() => { handleInlineEdit(selectedInvoice.id, 'status', 'DRAFT'); setSelectedInvoice({...selectedInvoice, status: 'DRAFT'}); }} className="text-sm text-rose-600 font-semibold hover:text-rose-700 hover:underline flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200"> <X size={16}/> Reject </button>
                               </>
                           )}
                           {selectedInvoice.status === 'PENDING_APPROVAL' && user?.role !== UserRole.FINANCE_MANAGER && (
                               <span className="text-sm text-orange-500 font-semibold flex items-center gap-1"> <Clock size={16}/> Waiting for Finance Manager Approval </span>
                           )}
                           {canEdit && (selectedInvoice.status === 'PENDING' || selectedInvoice.status === 'APPROVED') && !selectedInvoice.irn && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'UPLOADED'}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <ScanLine size={16}/> Generate E-Invoice Now </button>
                           )}
                           {canEdit && selectedInvoice.status === 'FAILED' && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'PENDING', irnError: undefined}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <RefreshCw size={14}/> Retry Generation </button>
                           )}`;

content = content.replace(oldFooter, newFooter);

fs.writeFileSync(file, content);
