const fs = require('fs');
let code = fs.readFileSync('utils/i18n.tsx', 'utf-8');

// We want to replace standard header keys in the translations dicts

code = code.replace(/'report.invoice.number': 'Invoice Number',/g, "'Invoice Number': 'Invoice Number',\n    'Date': 'Date',\n    'Customer': 'Customer',\n    'Amount': 'Amount',\n    'Tax': 'Tax',\n    'Status': 'Status',");

code = code.replace(/'report.invoice.number': 'चालान संख्या',/g, "'Invoice Number': 'चालान संख्या (Invoice Number)',\n    'Date': 'तारीख (Date)',\n    'Customer': 'ग्राहक (Customer)',\n    'Amount': 'राशि (Amount)',\n    'Tax': 'कर (Tax)',\n    'Status': 'स्थिति (Status)',");

code = code.replace(/'report.invoice.number': 'ઇન્વૉઇસ નંબર',/g, "'Invoice Number': 'ઇન્વૉઇસ નંબર',\n    'Date': 'તારીખ',\n    'Customer': 'ગ્રાહક',\n    'Amount': 'રકમ',\n    'Tax': 'કર',\n    'Status': 'સ્થિતિ',");

code = code.replace(/'report.invoice.number': 'चलन क्रमांक',/g, "'Invoice Number': 'चलन क्रमांक',\n    'Date': 'तारीख',\n    'Customer': 'ग्राहक',\n    'Amount': 'रक्कम',\n    'Tax': 'कर',\n    'Status': 'स्थिती',");

code = code.replace(/'report.invoice.number': 'விலைப்பட்டியல் எண்',/g, "'Invoice Number': 'விலைப்பட்டியல் எண்',\n    'Date': 'தேதி',\n    'Customer': 'வாடிக்கையாளர்',\n    'Amount': 'தொகை',\n    'Tax': 'வரி',\n    'Status': 'நிலை',");

code = code.replace(/'report.invoice.number': 'ఇన్‌వాయిస్ సంఖ్య',/g, "'Invoice Number': 'ఇన్‌వాయిస్ సంఖ్య',\n    'Date': 'తేదీ',\n    'Customer': 'కస్టమర్',\n    'Amount': 'మొత్తం',\n    'Tax': 'పన్ను',\n    'Status': 'స్థితి',");

fs.writeFileSync('utils/i18n.tsx', code);
