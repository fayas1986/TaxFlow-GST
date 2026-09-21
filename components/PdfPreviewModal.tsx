import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCw, FileText, MousePointer2, Highlighter, MessageSquare, Check, Trash2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface DocumentAnnotation {
  id: string;
  pageNumber: number;
  type: 'highlight' | 'comment';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  authorName: string;
  date: string;
}

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | File | null;
  documentTitle?: string;
  annotations?: DocumentAnnotation[];
  onSaveAnnotations?: (annotations: DocumentAnnotation[], actionSummary?: string) => void;
  currentUser?: string;
  activityLog?: { date: string; action: string; user: string }[];
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  documentTitle = 'Document Preview',
  annotations = [],
  onSaveAnnotations,
  currentUser = 'Current User',
  activityLog = []
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);

  // View State
  const [activeTab, setActiveTab] = useState<'preview' | 'changelog'>('preview');

  // Annotation State
  const [localAnnotations, setLocalAnnotations] = useState<DocumentAnnotation[]>(annotations);
  const [activeTool, setActiveTool] = useState<'select' | 'highlight' | 'comment'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<{startX: number, startY: number, currentX: number, currentY: number} | null>(null);
  const [draftComment, setDraftComment] = useState<{x: number, y: number, text: string} | null>(null);

  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  // Annotation Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTool === 'highlight') {
      setIsDrawing(true);
      setCurrentDraw({ startX: x, startY: y, currentX: x, currentY: y });
    } else if (activeTool === 'comment') {
      if (!draftComment) {
        setDraftComment({ x, y, text: '' });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || activeTool !== 'highlight' || !currentDraw) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setCurrentDraw({ ...currentDraw, currentX: x, currentY: y });
  };

  const handleMouseUp = () => {
    if (activeTool === 'highlight' && isDrawing && currentDraw) {
      setIsDrawing(false);
      const width = Math.abs(currentDraw.currentX - currentDraw.startX);
      const height = Math.abs(currentDraw.currentY - currentDraw.startY);
      
      if (width > 0.5 && height > 0.5) {
        const newAnnotation: DocumentAnnotation = {
          id: `ann-${Date.now()}`,
          pageNumber,
          type: 'highlight',
          x: Math.min(currentDraw.startX, currentDraw.currentX),
          y: Math.min(currentDraw.startY, currentDraw.currentY),
          width,
          height,
          authorName: currentUser,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        const updated = [...localAnnotations, newAnnotation];
        setLocalAnnotations(updated);
        onSaveAnnotations?.(updated, 'Added regional highlight annotation');
      }
      setCurrentDraw(null);
    }
  };

  const saveDraftComment = () => {
    if (!draftComment || !draftComment.text.trim()) return;
    const newAnnotation: DocumentAnnotation = {
      id: `ann-${Date.now()}`,
      pageNumber,
      type: 'comment',
      x: draftComment.x,
      y: draftComment.y,
      text: draftComment.text,
      authorName: currentUser,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    const updated = [...localAnnotations, newAnnotation];
    setLocalAnnotations(updated);
    onSaveAnnotations?.(updated, 'Added comment pin to document');
    setDraftComment(null);
    setActiveTool('select');
  };

  const deleteAnnotation = (id: string) => {
    const updated = localAnnotations.filter(a => a.id !== id);
    setLocalAnnotations(updated);
    onSaveAnnotations?.(updated, 'Removed document annotation');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{documentTitle}</h3>
                  <p className="text-[10px] text-slate-500 font-medium">PDF Document Viewer</p>
                </div>
              </div>

              <div className="flex bg-slate-200/50 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('preview')} 
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Document Preview
                </button>
                <button 
                  onClick={() => setActiveTab('changelog')} 
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'changelog' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Change Log
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Annotation Tools */}
                {activeTab === 'preview' && (
                  <>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                      <button 
                        onClick={() => setActiveTool('select')} 
                        className={`p-1.5 rounded transition-colors ${activeTool === 'select' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`} 
                        title="Select Text"
                      >
                        <MousePointer2 size={14} />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button 
                        onClick={() => setActiveTool('highlight')} 
                        className={`p-1.5 rounded transition-colors ${activeTool === 'highlight' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`} 
                        title="Highlight Area"
                      >
                        <Highlighter size={14} />
                      </button>
                      <button 
                        onClick={() => setActiveTool('comment')} 
                        className={`p-1.5 rounded transition-colors ${activeTool === 'comment' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`} 
                        title="Add Comment Pin"
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 mr-2">
                      <button onClick={zoomOut} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Zoom Out">
                        <ZoomOut size={16} />
                      </button>
                      <span className="text-[10px] font-bold px-1 w-12 text-center text-slate-600">
                        {Math.round(scale * 100)}%
                      </span>
                      <button onClick={zoomIn} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Zoom In">
                        <ZoomIn size={16} />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button onClick={rotate} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="Rotate">
                        <RotateCw size={16} />
                      </button>
                    </div>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            {activeTab === 'preview' && (
              <div className="flex-1 overflow-auto bg-slate-200/50 relative p-4 flex justify-center items-start min-h-[500px]">
                {fileUrl ? (
                <Document
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center h-64 text-slate-400">
                      <div className="animate-pulse flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        <span className="text-sm font-bold">Loading PDF...</span>
                      </div>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                      <FileText size={32} className="text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-500">Failed to load PDF.</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">The file might be corrupted or in an unsupported format.</p>
                    </div>
                  }
                >
                  <div className="shadow-lg transition-transform duration-200 origin-top bg-white relative inline-block" style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}>
                    <Page 
                      pageNumber={pageNumber} 
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="max-w-full"
                    />
                    
                    {/* Annotation Overlay */}
                    <div 
                      className={`absolute inset-0 z-10 ${activeTool === 'highlight' ? 'cursor-crosshair' : activeTool === 'comment' ? 'cursor-text' : 'pointer-events-none'}`}
                      onMouseDown={activeTool !== 'select' ? handleMouseDown : undefined}
                      onMouseMove={activeTool !== 'select' ? handleMouseMove : undefined}
                      onMouseUp={activeTool !== 'select' ? handleMouseUp : undefined}
                      onMouseLeave={activeTool !== 'select' ? handleMouseUp : undefined}
                    >
                      {/* Render Committed Annotations */}
                      {localAnnotations.filter(a => a.pageNumber === pageNumber).map(ann => {
                        if (ann.type === 'highlight') {
                          return (
                            <div 
                              key={ann.id} 
                              className="absolute bg-yellow-300/40 border-2 border-yellow-400/50 mix-blend-multiply group pointer-events-auto"
                              style={{ left: ann.x + '%', top: ann.y + '%', width: ann.width + '%', height: ann.height + '%' }}
                              title={`Highlighted by ${ann.authorName}`}
                            >
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                                className="absolute -top-3 -right-3 bg-white text-rose-500 p-0.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          );
                        } else {
                          return (
                            <div 
                              key={ann.id} 
                              className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
                              style={{ left: ann.x + '%', top: ann.y + '%' }}
                            >
                              <div className="w-5 h-5 bg-rose-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform">
                                <MessageSquare size={10} />
                              </div>
                              {/* Tooltip for comment */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 text-left">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="text-[9px] font-bold text-slate-400">{ann.authorName} • {ann.date}</div>
                                  <button onClick={() => deleteAnnotation(ann.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={10} /></button>
                                </div>
                                <div className="text-[11px] text-slate-700 leading-tight">{ann.text}</div>
                              </div>
                            </div>
                          );
                        }
                      })}

                      {/* Render Current Drawing Highlight */}
                      {isDrawing && currentDraw && activeTool === 'highlight' && (
                        <div 
                          className="absolute bg-yellow-300/40 border-2 border-yellow-400/50 mix-blend-multiply"
                          style={{
                            left: Math.min(currentDraw.startX, currentDraw.currentX) + '%',
                            top: Math.min(currentDraw.startY, currentDraw.currentY) + '%',
                            width: Math.abs(currentDraw.currentX - currentDraw.startX) + '%',
                            height: Math.abs(currentDraw.currentY - currentDraw.startY) + '%'
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Draft Comment Input (rendered above overlay) */}
                    {draftComment && activeTool === 'comment' && (
                      <div 
                        className="absolute z-20 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 w-56 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: draftComment.x + '%', top: draftComment.y + '%' }}
                      >
                         <textarea 
                           autoFocus
                           value={draftComment.text}
                           onChange={e => setDraftComment({...draftComment, text: e.target.value})}
                           className="w-full text-[11px] border border-slate-200 rounded-lg p-2 mb-2 outline-none focus:border-indigo-500 resize-none"
                           placeholder="Type comment..."
                           rows={3}
                         />
                         <div className="flex justify-end gap-1.5">
                           <button onClick={() => {setDraftComment(null); setActiveTool('select');}} className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                           <button onClick={saveDraftComment} className="px-2 py-1 text-[9px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded flex items-center gap-1"><Check size={10}/> Post</button>
                         </div>
                      </div>
                    )}
                  </div>
                </Document>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <FileText size={32} className="text-slate-300 mb-2" />
                  <span className="text-sm font-bold text-slate-500">No Document File Available</span>
                </div>
              )}
            </div>
            )}

            {/* Footer Pagination */}
            {activeTab === 'preview' && numPages && numPages > 1 && (
              <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-center gap-4">
                <button
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(p => p - 1)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-slate-500">
                  Page {pageNumber} of {numPages}
                </span>
                <button
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            )}
            
            {activeTab === 'changelog' && (
              <div className="flex-1 overflow-auto bg-slate-50 p-6 flex flex-col min-h-[500px]">
                <div className="max-w-2xl mx-auto w-full">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 pb-2 border-b border-slate-200">
                    Comprehensive Change Log
                  </h4>
                  {activityLog.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="text-xs font-medium">No activity recorded for this document.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activityLog.map((log, idx) => (
                        <div key={idx} className="relative pl-6 border-l-2 border-indigo-100 pb-2 last:pb-0">
                          <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-indigo-400 ring-4 ring-indigo-50" />
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[13px] font-bold text-slate-700 leading-snug">{log.action}</p>
                            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-medium">
                              <span className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                  {log.user?.charAt(0)}
                                </span>
                                {log.user}
                              </span>
                              <span>{log.date}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PdfPreviewModal;
