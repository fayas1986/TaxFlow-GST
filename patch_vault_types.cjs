const fs = require('fs');
const file = 'pages/DocumentVaultPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "category: 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER';",
  "category: 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER' | 'INVOICE';"
);

content = content.replace(
  "isConfidential: boolean;",
  "isConfidential: boolean;\n  detectedLanguage?: string;\n  translatedText?: string;"
);

content = content.replace(
  "activeCategory, setActiveCategory] = useState<'ALL' | 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER'>('ALL');",
  "activeCategory, setActiveCategory] = useState<'ALL' | 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER' | 'INVOICE'>('ALL');"
);

fs.writeFileSync(file, content);
