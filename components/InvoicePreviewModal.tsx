import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Loader2, Maximize2, Highlighter, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InvoiceAnnotator from './InvoiceAnnotator';
import { InvoiceAnnotation } from '../types';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSource: string | null;
  onConfirm: () => void;
  isScanning: boolean;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  imageSource, 
  onConfirm,
  isScanning 
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotations, setAnnotations] = useState<InvoiceAnnotation[]>([]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const addAnnotation = (ann: InvoiceAnnotation) => {
    setAnnotations(prev => [...prev, ann]);
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  if (!isOpen || !imageSource) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Maximize2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Invoice Verification & Analysis</h3>
                <p className="text-xs text-slate-500 font-medium">Annotate key areas for auditing or AI verification</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button 
                   onClick={() => setIsAnnotating(false)}
                   className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!isAnnotating ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   View Only
                 </button>
                 <button 
                   onClick={() => setIsAnnotating(true)}
                   className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isAnnotating ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Highlighter size={14} />
                   Annotation Mode
                 </button>
              </div>
              <div className="w-px h-6 bg-slate-200 mx-2" />
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleZoomOut}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-500 min-w-[60px] text-center shadow-sm">
                {Math.round(zoom * 100)}%
              </div>
              <button 
                onClick={handleZoomIn}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-6 bg-slate-200 mx-2" />
              <button 
                onClick={handleRotate}
                className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Rotate 90°"
              >
                <RotateCw size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3">
               {annotations.length > 0 && (
                 <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                    <MessageCircle size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">{annotations.length} Annotations Active</span>
                 </div>
               )}
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 bg-slate-200 overflow-auto relative p-8 flex items-start justify-center min-h-[300px]">
            <motion.div
              animate={{ rotate: rotation, scale: zoom }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative shadow-2xl rounded-sm overflow-hidden bg-white origin-center"
              style={{ maxWidth: '100%', minWidth: '400px' }}
            >
              <InvoiceAnnotator 
                imageSrc={imageSource}
                annotations={annotations}
                onAddAnnotation={addAnnotation}
                onDeleteAnnotation={deleteAnnotation}
                isEnabled={isAnnotating}
                zoom={zoom}
              />
            </motion.div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-amber-600">
                 <RotateCw size={14} className="animate-pulse" />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Visual transforms do not affect OCR extraction</span>
              </div>
              {isAnnotating && (
                <p className="text-[10px] text-indigo-500 font-medium">Click and drag to highlight an area of the invoice.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={onConfirm}
                disabled={isScanning}
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing with Gemini AI...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Confirm & Start Extraction
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InvoicePreviewModal;
