const fs = require('fs');
let code = fs.readFileSync('components/Layout.tsx', 'utf-8');

const importTarget2 = "import { useWorkspaceSync } from './WorkspaceSyncContext';";
const importReplacement2 = importTarget2 + "\nimport { useTranslation, Language } from '../utils/i18n';";
code = code.replace(importTarget2, importReplacement2);

const layoutStartTarget2 = "const user = useSelector((state: RootState) => state.auth.user);";
const layoutStartReplacement2 = layoutStartTarget2 + "\n  const { language, setLanguage, t } = useTranslation();\n  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);\n  const langMenuRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    const handleClickOutside = (event: MouseEvent) => {\n      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {\n        setIsLangMenuOpen(false);\n      }\n    };\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, []);";

code = code.replace(layoutStartTarget2, layoutStartReplacement2);

fs.writeFileSync('components/Layout.tsx', code);
