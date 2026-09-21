const fs = require('fs');
let file = fs.readFileSync('components/CurrencyConverterModule.tsx', 'utf-8');

file = file.replace(
  `export const CurrencyConverterModule: React.FC = () => {`,
  `import { Invoice } from '../types';

export const CurrencyConverterModule: React.FC<{ invoices?: Invoice[] }> = ({ invoices = [] }) => {`
);

// We need to add the foreign invoices list.
const newSection = `
          {invoices.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Foreign Currency Exposure</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {invoices.filter(inv => inv.currency && inv.currency !== 'INR' && inv.status !== 'PAID').map(inv => {
                  const rateToInr = exchangeRates[inv.currency!] || 1;
                  // If rateToInr is X, then 1 INR = X Foreign, so 1 Foreign = 1 / X INR
                  const inrValue = (inv.originalAmount || inv.amount) * (1 / rateToInr);
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{inv.partyName}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-900">{inv.currency} {(inv.originalAmount || inv.amount).toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded mt-0.5">₹{inrValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
                {invoices.filter(inv => inv.currency && inv.currency !== 'INR' && inv.status !== 'PAID').length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-2">No outstanding foreign currency invoices.</div>
                )}
              </div>
            </div>
          )}
`;

file = file.replace(
  `          </div>
        </div>
      </div>
  );
};`,
  `          </div>
${newSection}
        </div>
      </div>
  );
};`
);

fs.writeFileSync('components/CurrencyConverterModule.tsx', file);
console.log("Currency Converter Patched");
