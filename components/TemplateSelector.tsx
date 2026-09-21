import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, FileText, Settings, Download, Eye, Layout, Image as ImageIcon, Signature } from 'lucide-react';
import { DocumentTemplate, ExportConfig } from '../types';
import { PREDEFINED_TEMPLATES } from '../services/documentGenerator';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  category: 'INVOICE' | 'REPORT';
  title: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onExport,
  category,
  title
}) => {
  const filteredTemplates = PREDEFINED_TEMPLATES.filter(t => t.category === category);
  const [selectedTemplateId, setSelectedTemplateId] = useState(filteredTemplates[0]?.id);
  const [config, setConfig] = useState<ExportConfig>({
    templateId: filteredTemplates[0]?.id,
    includeLogo: true,
    includeSignature: true,
    paperSize: 'A4'
  });

  const handleSelect = (id: string) => {
    setSelectedTemplateId(id);
    setConfig(prev => ({ ...prev, templateId: id }));
  };

  const handleExport = () => {
    onExport(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] max-h-[700px]"
      >
        {/* Left: Template Selection */}
        <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Export Settings</h2>
              <p className="text-slate-500 text-sm">Choose a professional style for your {category.toLowerCase()}</p>
            </div>
            <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-full">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Layout size={14}/> Available Templates
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all group ${
                    selectedTemplateId === template.id 
                      ? 'border-blue-600 bg-blue-50/30' 
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg shadow-sm flex items-center justify-center text-white"
                      style={{ backgroundColor: template.previewColor }}
                    >
                      <FileText size={20} />
                    </div>
                    {selectedTemplateId === template.id && (
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800">{template.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{template.description}</p>
                </button>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Settings size={14}/> Document Configuration
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                      <ImageIcon size={16}/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Company Logo</p>
                      <p className="text-[10px] text-slate-500 font-medium">Include branding in header</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setConfig(prev => ({ ...prev, includeLogo: !prev.includeLogo }))}
                    className={`w-10 h-6 rounded-full transition-colors relative ${config.includeLogo ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.includeLogo ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                      <Signature size={16}/>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Digital Signature</p>
                      <p className="text-[10px] text-slate-500 font-medium">Include authorized sign-off</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setConfig(prev => ({ ...prev, includeSignature: !prev.includeSignature }))}
                    className={`w-10 h-6 rounded-full transition-colors relative ${config.includeSignature ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.includeSignature ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Paper Size</label>
                      <select 
                        value={config.paperSize}
                        onChange={(e) => setConfig(prev => ({ ...prev, paperSize: e.target.value as any }))}
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-600 transition-all"
                      >
                        <option value="A4">A4 Standard</option>
                        <option value="LETTER">US Letter</option>
                      </select>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview & Actions */}
        <div className="w-full md:w-[320px] bg-slate-50 p-8 flex flex-col">
          <div className="flex justify-end mb-6 hidden md:block">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Styling Preview</span>
             </div>

             <div className="aspect-[3/4] bg-white rounded-xl shadow-lg border border-slate-200 p-4 relative overflow-hidden flex flex-col gap-3">
                <div className="flex justify-between">
                  <div className={`w-12 h-3 rounded-full ${config.includeLogo ? 'bg-slate-200' : 'bg-transparent'}`} />
                  <div className="w-8 h-8 rounded bg-slate-100" />
                </div>
                <div className="space-y-1 mt-2">
                  <div className="w-full h-2 bg-slate-100 rounded" />
                  <div className="w-2/3 h-2 bg-slate-100 rounded" />
                </div>
                <div className="flex-1 mt-4 space-y-2">
                   <div className="w-full h-20 border border-dashed border-slate-200 rounded flex items-center justify-center">
                      <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Document Body</div>
                   </div>
                </div>
                {config.includeSignature && (
                  <div className="flex justify-end mt-auto">
                    <div className="w-16 h-4 bg-blue-50 border border-blue-100 rounded" />
                  </div>
                )}
                
                {/* Visual Accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ backgroundColor: PREDEFINED_TEMPLATES.find(t => t.id === selectedTemplateId)?.previewColor || '#3b82f6' }}
                />
             </div>

             <div className="mt-8 space-y-3">
                <button 
                  onClick={handleExport}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  <Download size={18} />
                  Export {category === 'INVOICE' ? 'Invoice' : 'Report'}
                </button>
                <p className="text-[10px] text-center text-slate-400 font-medium">
                  PDF will be generated with {config.paperSize} formatting
                </p>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TemplateSelector;
