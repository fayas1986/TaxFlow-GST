const fs = require('fs');
let code = fs.readFileSync('components/Layout.tsx', 'utf-8');

const itemsMap = [
    { old: "'Dashboard'", new: "t('nav.dashboard')" },
    { old: "'Control Tower'", new: "t('nav.control_tower')" },
    { old: "'Organization'", new: "t('nav.organization')" },
    { old: "'Party Master'", new: "t('nav.parties')" },
    { old: "'Invoices'", new: "t('nav.invoices')" },
    { old: "'E-Invoicing'", new: "t('nav.einvoice')" },
    { old: "'E-Way Bills'", new: "t('nav.ewaybill')" },
    { old: "'Compliance'", new: "t('nav.compliance')" },
    { old: "'Tx Compliance'", new: "t('nav.tx_compliance')" },
    { old: "'Tax Engine'", new: "t('nav.computation')" },
    { old: "'Reconciliation'", new: "t('nav.reconciliation')" },
    { old: "'Exceptions'", new: "t('nav.exceptions')" },
    { old: "'File Returns'", new: "t('nav.filing')" },
    { old: "'Approval Flow'", new: "t('nav.approvals')" },
    { old: "'Risk Analysis'", new: "t('nav.risk')" },
    { old: "'Tax Forecasting'", new: "t('nav.tax_forecast')" },
    { old: "'Document Vault'", new: "t('nav.vault')" },
    { old: "'Reports'", new: "t('nav.reports')" },
    { old: "'Integrations'", new: "t('nav.integrations')" },
    { old: "'Audit Logs'", new: "t('nav.audit')" },
    { old: "'Settings'", new: "t('nav.settings')" },
];

let allMenuItemsRegex = /const allMenuItems = \[([\s\S]*?)\];/;
let match = code.match(allMenuItemsRegex);
if (match) {
    let replacedItems = match[1];
    itemsMap.forEach(m => {
        replacedItems = replacedItems.replace(new RegExp(`label: ${m.old}`, 'g'), `label: ${m.new}`);
    });
    code = code.replace(match[1], replacedItems);
}

const notifTarget = "<NotificationCenter tenantId={user?.currentTenantId || 't1'} onNavigate={onNavigate} />";
const languageSwitcher = `
            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shadow-sm"
                title="Change Language"
              >
                <Languages size={18} />
              </button>
              
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Interface Language</span>
                  </div>
                  <div className="p-1">
                    {[
                      { code: 'en', name: 'English' },
                      { code: 'hi', name: 'हिन्दी (Hindi)' },
                      { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
                      { code: 'mr', name: 'मराठी (Marathi)' },
                      { code: 'ta', name: 'தமிழ் (Tamil)' },
                      { code: 'te', name: 'తెలుగు (Telugu)' }
                    ].map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                        }}
                        className={\`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors \${language === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'}\`}
                      >
                        {lang.name}
                        {language === lang.code && <Check size={14} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            `;
code = code.replace(notifTarget, languageSwitcher + notifTarget);

fs.writeFileSync('components/Layout.tsx', code);
