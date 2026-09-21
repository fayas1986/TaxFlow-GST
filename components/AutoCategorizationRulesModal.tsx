import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save, Filter, Tag, Settings } from 'lucide-react';

interface AutoCatRule {
  id: string;
  field: 'vendorName' | 'itemDescription' | 'amount';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string;
  assignType: 'hsn' | 'category' | 'taxRate';
  assignValue: string;
}

interface AutoCategorizationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoCategorizationRulesModal: React.FC<AutoCategorizationRulesModalProps> = ({ isOpen, onClose }) => {
  const [rules, setRules] = useState<AutoCatRule[]>([
    {
      id: '1',
      field: 'vendorName',
      operator: 'contains',
      value: 'AWS',
      assignType: 'category',
      assignValue: 'Cloud Hosting'
    },
    {
      id: '2',
      field: 'itemDescription',
      operator: 'contains',
      value: 'Consulting',
      assignType: 'hsn',
      assignValue: '998311'
    }
  ]);

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: Math.random().toString(36).substr(2, 9),
        field: 'vendorName',
        operator: 'contains',
        value: '',
        assignType: 'hsn',
        assignValue: ''
      }
    ]);
  };

  const updateRule = (id: string, updates: Partial<AutoCatRule>) => {
    setRules(rules.map(rule => rule.id === id ? { ...rule, ...updates } : rule));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleSave = () => {
    // In a real app, save to backend
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Auto-Categorization Rules</h2>
              <p className="text-sm text-slate-500">Define logic to automatically assign HSN codes or tax categories to new invoices.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div key={rule.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-sm shrink-0">
                  {index + 1}
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                  <div className="md:col-span-1 flex items-center">
                    <span className="text-sm font-semibold text-slate-500">If</span>
                  </div>
                  
                  <div className="md:col-span-3">
                    <select 
                      value={rule.field}
                      onChange={(e) => updateRule(rule.id, { field: e.target.value as any })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="vendorName">Vendor Name</option>
                      <option value="itemDescription">Item Description</option>
                      <option value="amount">Invoice Amount</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select 
                      value={rule.operator}
                      onChange={(e) => updateRule(rule.id, { operator: e.target.value as any })}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="startsWith">Starts With</option>
                      <option value="endsWith">Ends With</option>
                      {rule.field === 'amount' && (
                        <>
                          <option value="greaterThan">Greater Than</option>
                          <option value="lessThan">Less Than</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <input 
                      type="text"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      placeholder="Value..."
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-1 flex items-center justify-center">
                    <span className="text-sm font-semibold text-slate-500">Then Assign</span>
                  </div>

                  <div className="md:col-span-3 flex gap-2">
                     <select 
                        value={rule.assignType}
                        onChange={(e) => updateRule(rule.id, { assignType: e.target.value as any })}
                        className="w-1/2 h-10 px-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-medium text-indigo-700 outline-none focus:border-indigo-500"
                      >
                        <option value="hsn">HSN Code</option>
                        <option value="category">Category</option>
                        <option value="taxRate">Tax Rate (%)</option>
                      </select>
                      <input 
                        type="text"
                        value={rule.assignValue}
                        onChange={(e) => updateRule(rule.id, { assignValue: e.target.value })}
                        placeholder="Value..."
                        className="w-1/2 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                      />
                  </div>
                </div>

                <button 
                  onClick={() => deleteRule(rule.id)}
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            
            <button 
              onClick={addRule}
              className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
            >
              <Plus size={20} /> Add New Rule
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save size={18} /> Save Rules
          </button>
        </div>
      </motion.div>
    </div>
  );
};
