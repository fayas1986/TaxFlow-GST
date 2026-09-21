const fs = require('fs');
let code = fs.readFileSync('pages/Settings.tsx', 'utf-8');

const importStyling = "import { DocumentStylingConfig } from '../components/DocumentStylingConfig';";
if (!code.includes("DocumentStylingConfig")) {
    code = code.replace("import WorkspaceSyncSettingsTab from '../components/WorkspaceSyncSettingsTab';", "import WorkspaceSyncSettingsTab from '../components/WorkspaceSyncSettingsTab';\n" + importStyling);
}

const tabTarget = "{ id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },";
const newTab = "{ id: 'STYLING', label: 'Document Styling', icon: FileText },\n    " + tabTarget;

if (code.includes(tabTarget)) {
    code = code.replace(tabTarget, newTab);
}

const contentTarget = "{activeTab === 'NOTIFICATIONS' && (";
const newContent = `{activeTab === 'STYLING' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
               <DocumentStylingConfig setToastMessage={(msg) => setToastMessage(msg)} />
             </div>
          )}\n\n          ` + contentTarget;

if (code.includes(contentTarget)) {
    code = code.replace(contentTarget, newContent);
}

const iconImport = "import { Building2, Users, Shield, Save, Loader2, CheckCircle2, Globe, Key, AlertCircle, RefreshCw, FileKey, Trash2, DownloadCloud, Lock, Plus, X, Bell, History, Mail, CalendarDays, Database, Cloud, Layers, Clock, Download, FileText } from 'lucide-react';";

let oldIconImportMatch = code.match(/import { Building2.*?} from 'lucide-react';/);
if (oldIconImportMatch) {
    if (!oldIconImportMatch[0].includes("FileText")) {
       let newImport = oldIconImportMatch[0].replace("} from", ", FileText } from");
       code = code.replace(oldIconImportMatch[0], newImport);
    }
} else {
    console.log("Could not find lucide import");
}

fs.writeFileSync('pages/Settings.tsx', code);
