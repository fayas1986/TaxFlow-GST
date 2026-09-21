import React, { useState } from 'react';
import { MessageSquare, Send, Reply, User, Clock, Trash2, ShieldCheck, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DocumentComment {
  id: string;
  authorName: string;
  authorRole: string;
  timestamp: string;
  content: string;
  replies?: DocumentComment[];
}

interface DocumentCommentThreadProps {
  comments?: DocumentComment[] | null;
  onAddComment: (content: string, parentId?: string) => void;
  onDeleteComment?: (id: string, parentId?: string) => void;
}

export const DocumentCommentThread: React.FC<DocumentCommentThreadProps> = ({ comments = [], onAddComment, onDeleteComment }) => {
  const safeComments = comments || [];
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment);
    setNewComment('');
  };

  const handleSendReply = (parentId: string) => {
    if (!replyContent.trim()) return;
    onAddComment(replyContent, parentId);
    setReplyContent('');
    setReplyingTo(null);
  };

  const renderComment = (comment: DocumentComment, isReply = false, parentId?: string) => {
    return (
      <div key={comment.id} className={`flex gap-3 ${isReply ? 'ml-6 mt-3 relative before:absolute before:left-[-14px] before:top-[-10px] before:w-[2px] before:h-[20px] before:bg-slate-200 before:content-[""] after:absolute after:left-[-14px] after:top-[8px] after:w-[12px] after:h-[2px] after:bg-slate-200 after:content-[""]' : 'mt-4'}`}>
        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200 z-10">
          <span className="text-[10px] font-black text-indigo-700">{comment.authorName.charAt(0)}</span>
        </div>
        <div className="flex-1 space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-800">{comment.authorName}</span>
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                {comment.authorRole}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
              <span>{comment.timestamp}</span>
              {onDeleteComment && (
                <button onClick={() => onDeleteComment(comment.id, parentId)} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">{comment.content}</p>
          
          {!isReply && (
            <div className="pt-1 flex items-center justify-between">
              <button 
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1"
              >
                <Reply size={10} /> {replyingTo === comment.id ? 'Cancel' : 'Reply'}
              </button>
            </div>
          )}

          {/* Reply Input Box */}
          <AnimatePresence>
            {!isReply && replyingTo === comment.id && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-start gap-2 overflow-hidden"
              >
                <input 
                  type="text" 
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply(comment.id)}
                  placeholder="Write a reply..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                <button 
                  onClick={() => handleSendReply(comment.id)}
                  disabled={!replyContent.trim()}
                  className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg transition-colors"
                >
                  <Send size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare size={12} /> Audit Discussion Thread
        </h4>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{safeComments.reduce((acc, c) => acc + 1 + (c?.replies?.length || 0), 0)} Comments</span>
      </div>

      <div className="space-y-1">
        {safeComments.map(comment => (
          <div key={comment.id}>
            {renderComment(comment)}
            {comment.replies && comment.replies.length > 0 && (
              <div className="relative">
                {comment.replies.map(reply => renderComment(reply, true, comment.id))}
              </div>
            )}
          </div>
        ))}

        {safeComments.length === 0 && (
          <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-slate-200/50 border-dashed">
             <MessageSquare size={16} className="mx-auto text-slate-300 mb-1" />
             <p className="text-xs font-bold text-slate-400">No discussion yet</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 relative">
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendComment())}
            placeholder="Add a comment or tag team members..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 min-h-[60px] resize-none pr-10 shadow-sm"
          />
          <button 
            onClick={handleSendComment}
            disabled={!newComment.trim()}
            className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-all shadow-sm"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] font-bold text-slate-400 mt-1 ml-1 flex items-center gap-1">
          <Tag size={10} /> Use @ to mention team members for faster audit clearance
        </p>
      </div>
    </div>
  );
};
