import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Trash2, X, Plus, Highlighter } from 'lucide-react';
import { InvoiceAnnotation } from '../types';

interface InvoiceAnnotatorProps {
  imageSrc: string;
  annotations: InvoiceAnnotation[];
  onAddAnnotation: (annotation: InvoiceAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  isEnabled: boolean;
  zoom: number;
}

const InvoiceAnnotator: React.FC<InvoiceAnnotatorProps> = ({
  imageSrc,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  isEnabled,
  zoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tempNote, setTempNote] = useState('');

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEnabled || showNoteInput) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !isEnabled || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const width = x - startPos.x;
    const height = y - startPos.y;

    setCurrentRect({
      x: width < 0 ? x : startPos.x,
      y: height < 0 ? y : startPos.y,
      w: Math.abs(width),
      h: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentRect && currentRect.w > 1 && currentRect.h > 1) {
      setShowNoteInput(true);
    } else {
      setCurrentRect(null);
    }
  };

  const saveAnnotation = () => {
    if (!currentRect) return;

    const newAnnotation: InvoiceAnnotation = {
      id: `ann-${Date.now()}`,
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.w,
      height: currentRect.h,
      text: tempNote || 'Verification point',
      author: 'Current User',
      createdAt: new Date().toISOString()
    };

    onAddAnnotation(newAnnotation);
    setCurrentRect(null);
    setTempNote('');
    setShowNoteInput(false);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block select-none ${isEnabled ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <img 
        src={imageSrc} 
        alt="Invoice for annotation" 
        className="block max-w-full h-auto pointer-events-none shadow-sm border border-slate-100 rounded-sm"
        draggable={false}
      />

      {/* Existing Annotations */}
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className={`absolute border-2 transition-all duration-200 group ${
            selectedAnnotationId === ann.id 
              ? 'border-indigo-500 bg-indigo-500/10 ring-4 ring-indigo-500/20' 
              : 'border-amber-400 bg-amber-400/20 hover:border-amber-500 hover:bg-amber-500/30'
          }`}
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            width: `${ann.width}%`,
            height: `${ann.height}%`,
            cursor: isEnabled ? 'default' : 'pointer'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAnnotationId(ann.id === selectedAnnotationId ? null : ann.id);
          }}
        >
          {/* Note Indicator */}
          <div className="absolute -top-3 -right-3 p-1.5 bg-amber-500 text-white rounded-full shadow-lg scale-75 group-hover:scale-100 transition-transform">
            <MessageSquare size={12} fill="currentColor" />
          </div>

          {/* Tooltip/Popver for Note */}
          <AnimatePresence>
            {selectedAnnotationId === ann.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-48 bg-white border border-slate-200 p-3 rounded-xl shadow-xl z-50 ring-1 ring-slate-900/5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verification Note</span>
                  <button 
                    onClick={() => onDeleteAnnotation(ann.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">{ann.text}</p>
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                   <span className="text-[9px] text-slate-400 font-bold uppercase">{ann.author}</span>
                   <span className="text-[9px] text-slate-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Current Drawing Rect */}
      {currentRect && (
        <div 
          className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none"
          style={{
            left: `${currentRect.x}%`,
            top: `${currentRect.y}%`,
            width: `${currentRect.w}%`,
            height: `${currentRect.h}%`,
          }}
        />
      )}

      {/* Note Input Modal */}
      <AnimatePresence>
        {showNoteInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 border border-slate-200"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Highlighter size={20} />
                </div>
                <h4 className="font-bold text-slate-800">Add Verification Note</h4>
              </div>
              <textarea 
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="What needs attention in this area?"
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => {
                    setShowNoteInput(false);
                    setCurrentRect(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveAnnotation}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Add Annotation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceAnnotator;
