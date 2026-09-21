const fs = require('fs');
let code = fs.readFileSync('components/Layout.tsx', 'utf-8');

// 1. Import useTranslation
const importTarget = "import { WorkspaceSyncContext } from './WorkspaceSyncContext';";
const importReplacement = importTarget + "\nimport { useTranslation, Language } from '../utils/i18n';";
if (code.includes(importTarget)) {
    code = code.replace(importTarget, importReplacement);
} else {
    console.log("Failed to find importTarget");
}

// 2. Import Languages icon from lucide-react if not present, but let's just use Globe since it's common.
if (code.includes("import {") && !code.includes("Languages,")) {
    code = code.replace("Globe,", "Globe, Languages,");
    if (!code.includes("Languages,")) {
        code = code.replace("import {", "import { Languages,");
    }
}

// 3. Add to Layout component body
const layoutStartTarget = "const { user } = useSelector((state: RootState) => state.auth);";
const layoutStartReplacement = layoutStartTarget + "\n  const { language, setLanguage, t } = useTranslation();\n  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);\n  const langMenuRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    const handleClickOutside = (event: MouseEvent) => {\n      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {\n        setIsLangMenuOpen(false);\n      }\n    };\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, []);";

if (code.includes(layoutStartTarget)) {
    code = code.replace(layoutStartTarget, layoutStartReplacement);
} else {
    console.log("Failed to find layoutStartTarget");
}

// 4. Translate allMenuItems labels. Wait, they are defined inside the component. We can just change the 'label' values.
// We'll replace the hardcoded labels with t('nav.xyz')
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

// 5. Add language switcher to header. 
// Before user profile, we can insert our dropdown.
const userProfileTarget = `{/* User Profile Dropdown */}`;
const languageSwitcher = `
            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Change Language"
              >
                <Languages size={18} />
              </button>
              
              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Language</span>
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
                          setLanguage(lang.code as Language);
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
if (code.includes(userProfileTarget)) {
    code = code.replace(userProfileTarget, languageSwitcher + userProfileTarget);
} else {
    console.log("Failed to find userProfileTarget");
}

fs.writeFileSync('components/Layout.tsx', code);
console.log("LAYOUT UPDATED");
