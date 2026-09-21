const fs = require('fs');

const code = `import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'hi' | 'gu' | 'mr' | 'ta' | 'te';

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.control_tower': 'Control Tower',
    'nav.organization': 'Organization',
    'nav.parties': 'Party Master',
    'nav.invoices': 'Invoices',
    'nav.einvoice': 'E-Invoicing',
    'nav.ewaybill': 'E-Way Bills',
    'nav.compliance': 'Compliance',
    'nav.tx_compliance': 'Tx Compliance',
    'nav.computation': 'Tax Engine',
    'nav.reconciliation': 'Reconciliation',
    'nav.exceptions': 'Exceptions',
    'nav.filing': 'File Returns',
    'nav.approvals': 'Approval Flow',
    'nav.risk': 'Risk Analysis',
    'nav.tax_forecast': 'Tax Forecasting',
    'nav.vault': 'Document Vault',
    'nav.reports': 'Reports',
    'nav.integrations': 'Integrations',
    'nav.audit': 'Audit Logs',
    'nav.settings': 'Settings',
    
    'report.invoice.title': 'Invoice Export',
    'report.invoice.date': 'Invoice Date',
    'report.invoice.number': 'Invoice Number',
    'report.invoice.party': 'Party Name',
    'report.invoice.tax': 'Tax Amount',
    'report.invoice.total': 'Total Amount',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.control_tower': 'नियंत्रण टॉवर',
    'nav.organization': 'संगठन',
    'nav.parties': 'पार्टी मास्टर',
    'nav.invoices': 'चालान (Invoices)',
    'nav.einvoice': 'ई-चालान',
    'nav.ewaybill': 'ई-वे बिल',
    'nav.compliance': 'अनुपालन',
    'nav.tx_compliance': 'लेन-देन अनुपालन',
    'nav.computation': 'कर इंजन (Tax Engine)',
    'nav.reconciliation': 'समाधान (Reconciliation)',
    'nav.exceptions': 'अपवाद',
    'nav.filing': 'रिटर्न फाइलिंग',
    'nav.approvals': 'अनुमोदन प्रवाह',
    'nav.risk': 'जोखिम विश्लेषण',
    'nav.tax_forecast': 'कर पूर्वानुमान',
    'nav.vault': 'दस्तावेज़ तिजोरी',
    'nav.reports': 'रिपोर्ट',
    'nav.integrations': 'एकीकरण',
    'nav.audit': 'ऑडिट लॉग',
    'nav.settings': 'सेटिंग्स',

    'report.invoice.title': 'चालान निर्यात (Invoice Export)',
    'report.invoice.date': 'चालान की तारीख',
    'report.invoice.number': 'चालान संख्या',
    'report.invoice.party': 'पार्टी का नाम',
    'report.invoice.tax': 'कर राशि',
    'report.invoice.total': 'कुल राशि',
  },
  gu: {
    'nav.dashboard': 'ડેશબોર્ડ',
    'nav.control_tower': 'નિયંત્રણ ટાવર',
    'nav.organization': 'સંસ્થા',
    'nav.parties': 'પાર્ટી માસ્ટર',
    'nav.invoices': 'ઇન્વૉઇસ',
    'nav.einvoice': 'ઈ-ઇન્વૉઇસ',
    'nav.ewaybill': 'ઈ-વે બિલ',
    'nav.compliance': 'પાલન (Compliance)',
    'nav.tx_compliance': 'ટ્રાન્ઝેક્શન પાલન',
    'nav.computation': 'ટેક્સ એન્જિન',
    'nav.reconciliation': 'સમાધાન (Reconciliation)',
    'nav.exceptions': 'અપવાદો',
    'nav.filing': 'રિટર્ન ફાઇલિંગ',
    'nav.approvals': 'મંજૂરી પ્રવાહ',
    'nav.risk': 'જોખમ વિશ્લેષણ',
    'nav.tax_forecast': 'કરની આગાહી',
    'nav.vault': 'દસ્તાવેજ વૉલ્ટ',
    'nav.reports': 'રિપોર્ટ્સ',
    'nav.integrations': 'એકીકરણ',
    'nav.audit': 'ઓડિટ લોગ',
    'nav.settings': 'સેટિંગ્સ',
    
    'report.invoice.title': 'ઇન્વૉઇસ નિકાસ',
    'report.invoice.date': 'ઇન્વૉઇસ તારીખ',
    'report.invoice.number': 'ઇન્વૉઇસ નંબર',
    'report.invoice.party': 'પાર્ટીનું નામ',
    'report.invoice.tax': 'કર રકમ',
    'report.invoice.total': 'કુલ રકમ',
  },
  mr: {
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.control_tower': 'नियंत्रण टॉवर',
    'nav.organization': 'संस्था',
    'nav.parties': 'पार्टी मास्टर',
    'nav.invoices': 'चलन (Invoices)',
    'nav.einvoice': 'ई-इनव्हॉइस',
    'nav.ewaybill': 'ई-वे बिल',
    'nav.compliance': 'अनुपालन',
    'nav.tx_compliance': 'व्यवहार अनुपालन',
    'nav.computation': 'कर इंजिन',
    'nav.reconciliation': 'ताळेबंद (Reconciliation)',
    'nav.exceptions': 'अपवाद',
    'nav.filing': 'रिटर्न फाइलिंग',
    'nav.approvals': 'मंजुरी प्रवाह',
    'nav.risk': 'जोखीम विश्लेषण',
    'nav.tax_forecast': 'कर अंदाज',
    'nav.vault': 'दस्तऐवज तिजोरी',
    'nav.reports': 'अहवाल',
    'nav.integrations': 'एकात्मिकरण',
    'nav.audit': 'ऑडिट लॉग',
    'nav.settings': 'सेटिंग्ज',
    
    'report.invoice.title': 'चलन निर्यात',
    'report.invoice.date': 'चलनाची तारीख',
    'report.invoice.number': 'चलन क्रमांक',
    'report.invoice.party': 'पार्टीचे नाव',
    'report.invoice.tax': 'कर रक्कम',
    'report.invoice.total': 'एकूण रक्कम',
  },
  ta: {
    'nav.dashboard': 'முகப்பு (Dashboard)',
    'nav.control_tower': 'கட்டுப்பாட்டு கோபுரம்',
    'nav.organization': 'நிறுவனம்',
    'nav.parties': 'கட்சி மாஸ்டர்',
    'nav.invoices': 'விலைப்பட்டியல்',
    'nav.einvoice': 'மின்-விலைப்பட்டியல்',
    'nav.ewaybill': 'இ-வே பில்',
    'nav.compliance': 'இணக்கம்',
    'nav.tx_compliance': 'பரிவர்த்தனை இணக்கம்',
    'nav.computation': 'வரி இயந்திரம்',
    'nav.reconciliation': 'நல்லிணக்கம்',
    'nav.exceptions': 'விதிவிலக்குகள்',
    'nav.filing': 'வரி தாக்கல்',
    'nav.approvals': 'ஒப்புதல் ஓட்டம்',
    'nav.risk': 'ஆபத்து பகுப்பாய்வு',
    'nav.tax_forecast': 'வரி முன்னறிவிப்பு',
    'nav.vault': 'ஆவண பெட்டகம்',
    'nav.reports': 'அறிக்கைகள்',
    'nav.integrations': 'ஒருங்கிணைப்புகள்',
    'nav.audit': 'தணிக்கை பதிவுகள்',
    'nav.settings': 'அமைப்புகள்',
    
    'report.invoice.title': 'விலைப்பட்டியல் ஏற்றுமதி',
    'report.invoice.date': 'விலைப்பட்டியல் தேதி',
    'report.invoice.number': 'விலைப்பட்டியல் எண்',
    'report.invoice.party': 'கட்சியின் பெயர்',
    'report.invoice.tax': 'வரி தொகை',
    'report.invoice.total': 'மொத்த தொகை',
  },
  te: {
    'nav.dashboard': 'డాష్‌బోర్డ్',
    'nav.control_tower': 'కంట్రోల్ టవర్',
    'nav.organization': 'సంస్థ',
    'nav.parties': 'పార్టీ మాస్టర్',
    'nav.invoices': 'ఇన్‌వాయిస్‌లు',
    'nav.einvoice': 'ఈ-ఇన్‌వాయిస్',
    'nav.ewaybill': 'ఈ-వే బిల్లు',
    'nav.compliance': 'అనుసరణ',
    'nav.tx_compliance': 'లావాదేవీ అనుసరణ',
    'nav.computation': 'పన్ను ఇంజిన్',
    'nav.reconciliation': 'రాజీ (Reconciliation)',
    'nav.exceptions': 'మినహాయింపులు',
    'nav.filing': 'రిటర్న్ ఫైలింగ్',
    'nav.approvals': 'ఆమోద ప్రవాహం',
    'nav.risk': 'ప్రమాద విశ్లేషణ',
    'nav.tax_forecast': 'పన్ను సూచన',
    'nav.vault': 'పత్రాల వాల్ట్',
    'nav.reports': 'నివేదికలు',
    'nav.integrations': 'అనుసంధానాలు',
    'nav.audit': 'ఆడిట్ లాగ్‌లు',
    'nav.settings': 'సెట్టింగ్‌లు',
    
    'report.invoice.title': 'ఇన్‌వాయిస్ ఎగుమతి',
    'report.invoice.date': 'ఇన్‌వాయిస్ తేదీ',
    'report.invoice.number': 'ఇన్‌వాయిస్ సంఖ్య',
    'report.invoice.party': 'పార్టీ పేరు',
    'report.invoice.tax': 'పన్ను మొత్తం',
    'report.invoice.total': 'మొత్తం',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('preferred_language') as Language) || 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferred_language', lang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
`;
fs.writeFileSync('utils/i18n.ts', code);
