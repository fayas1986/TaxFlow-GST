const fs = require('fs');
const file = 'pages/DocumentVaultPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// First, add the translate function
const fn = `
  const [isTranslating, setIsTranslating] = useState(false);
  const handleTranslate = async () => {
    if (!selectedDoc) return;
    setIsTranslating(true);
    try {
      const response = await fetch('/api/v1/documents/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedDoc.description })
      });
      const result = await response.json();
      if (result.success) {
        // Update the selected document
        const updatedDoc = {
          ...selectedDoc,
          detectedLanguage: result.detectedLanguage,
          translatedText: result.translatedText
        };
        setSelectedDoc(updatedDoc);
        
        // Optionally update the list of documents
        setDocuments(docs => docs.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      } else {
        alert(result.error || 'Failed to translate');
      }
    } catch (e) {
      alert('Translation error');
    } finally {
      setIsTranslating(false);
    }
  };
`;

content = content.replace(
  '  const copyHash = (hash: string) => {',
  fn + '\n  const copyHash = (hash: string) => {'
);

const uiOriginal = `                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Description</span>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200/50">
                      {selectedDoc.description}
                    </p>
                  </div>`;

const uiReplacement = `                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Content / Description</span>
                      {selectedDoc.category === 'INVOICE' && (
                        <button
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                        >
                          <Sparkles size={12} className={isTranslating ? 'animate-pulse' : ''} />
                          {isTranslating ? 'Detecting Language...' : 'Translate Invoice'}
                        </button>
                      )}
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200/50 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {selectedDoc.description}
                      </p>
                      {selectedDoc.translatedText && (
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                              Detected: {selectedDoc.detectedLanguage}
                            </span>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                              Translated to English
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {selectedDoc.translatedText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>`;

content = content.replace(uiOriginal, uiReplacement);

fs.writeFileSync(file, content);
