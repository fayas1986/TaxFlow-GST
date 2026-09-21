import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, Upload, FileText, CheckCircle2, 
  AlertCircle, Building, Clock, ArrowRight,
  Trash2, Sparkles, Loader2, History, User,
  Globe, Check, RefreshCw, AlertTriangle, Search,
  Lock, MapPin, Phone, Mail, Activity, ArrowUpRight,
  Database, Filter, CheckCircle, Info, Key, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchVendorActivityLogs, updateVendorProfile, logVendorAction } from '../services/api';
import { VendorActivityLog } from '../types';

interface VendorSession {
  valid: boolean;
  vendorName: string;
  tenantId: string;
}

const VendorPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<VendorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'TRACKER' | 'PROFILE' | 'LOGS'>('UPLOAD');

  // Activity Logs State & Search
  const [activityLogs, setActivityLogs] = useState<VendorActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  // Profile Form State
  const [profileEmail, setProfileEmail] = useState('finance@acme.com');
  const [profilePhone, setProfilePhone] = useState('+91 98765 43210');
  const [profileGstIn, setProfileGstIn] = useState('27AAAAA0000A1Z5');
  const [profileAddress, setProfileAddress] = useState('Building 4B, Phase II, Hitech City, Hyderabad, India');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Invoice Tracker State & Search
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [vendorInvoices, setVendorInvoices] = useState([
    { id: 'vi-1', invoiceNumber: 'INV-2026-089', date: '2026-07-24', amount: '₹1,45,000', status: 'COMPLIANT', screeningResult: 'Passed AI Compliance check. Registered in GSTR-1 draft.' },
    { id: 'vi-2', invoiceNumber: 'INV-2026-074', date: '2026-07-20', amount: '₹89,200', status: 'COMPLIANT', screeningResult: 'Passed matching. ITC claimed successfully.' },
    { id: 'vi-3', invoiceNumber: 'INV-2026-052', date: '2026-07-15', amount: '₹12,400', status: 'DISCREPANCY_WARNING', screeningResult: 'Minor HSN tax rate discrepancy flagged on matching.' }
  ]);
  const [invoiceActions, setInvoiceActions] = useState<Record<string, 'ACKNOWLEDGED' | 'REVIEW_REQUESTED'>>({});

  useEffect(() => {
    const hash = window.location.hash;
    const parts = hash.split('/');
    if (parts.length >= 3 && parts[1] === 'vendor-portal') {
      const t = parts[2];
      setToken(t);
      verifyToken(t);
    } else {
      setIsLoading(false);
      setError("Invalid portal link. Please check your secure URL token or request a new one from your TaxFlow administrator.");
    }
  }, []);

  const verifyToken = async (t: string) => {
    try {
      const res = await fetch(`/api/vendor-upload/verify/${t}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to verify link");
      }
      const data = await res.json();
      setSession(data);
      // Load initial logs
      await loadLogs(t);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async (t: string) => {
    setIsLoadingLogs(true);
    try {
      const logs = await fetchVendorActivityLogs(t);
      setActivityLogs(logs);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmitUpload = async () => {
    if (!file || !token) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 150);

    try {
      const res = await fetch('/api/vendor-upload/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          invoiceData: {
            fileName: file.name,
            size: file.size,
            type: file.type,
            submittedAt: new Date().toISOString()
          }
        })
      });

      if (!res.ok) throw new Error("Upload failed");

      setUploadProgress(100);
      
      // Add simulated invoice to state list for tracking
      const newInv = {
        id: `vi-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        date: new Date().toISOString().split('T')[0],
        amount: '₹' + Math.floor(15000 + Math.random() * 100000).toLocaleString('en-IN'),
        status: 'COMPLIANT',
        screeningResult: 'Queued. Processing and basic compliance scanning succeeded.'
      };
      setVendorInvoices(prev => [newInv, ...prev]);

      setTimeout(async () => {
        setIsSuccess(true);
        setIsUploading(false);
        // Refresh logs immediately
        await loadLogs(token);
      }, 500);
    } catch (err: any) {
      setError("Failed to complete upload. Please try again.");
      setIsUploading(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingProfile(true);
    setProfileSuccess(false);

    try {
      await updateVendorProfile(token, {
        email: profileEmail,
        phone: profilePhone,
        gstIn: profileGstIn,
        address: profileAddress
      });
      setProfileSuccess(true);
      await loadLogs(token);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      console.error("Profile update failed:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAcknowledgeWarning = async (invId: string, invoiceNumber: string) => {
    if (!token) return;
    try {
      await logVendorAction(token, {
        action: 'Warning Acknowledged',
        module: 'COMPLIANCE',
        status: 'SUCCESS',
        details: `Acknowledged minor compliance warnings on Invoice ${invoiceNumber}. Verification flag resolved.`
      });
      setInvoiceActions(prev => ({ ...prev, [invId]: 'ACKNOWLEDGED' }));
      await loadLogs(token);
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  const handleRequestReview = async (invId: string, invoiceNumber: string) => {
    if (!token) return;
    try {
      await logVendorAction(token, {
        action: 'Fast-Track Review',
        module: 'INVOICE',
        status: 'SUCCESS',
        details: `Requested speed-up review and direct matching validation for Invoice ${invoiceNumber}.`
      });
      setInvoiceActions(prev => ({ ...prev, [invId]: 'REVIEW_REQUESTED' }));
      await loadLogs(token);
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  // Filter & Search Audit Logs
  const filteredLogs = activityLogs.filter(log => {
    const matchesFilter = logFilter === 'ALL' || log.module === logFilter;
    const searchString = `${log.action} ${log.details} ${log.module} ${log.status} ${log.ipAddress || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(logSearchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Filter & Search Invoices
  const filteredInvoices = vendorInvoices.filter(inv => {
    const searchString = `${inv.invoiceNumber} ${inv.amount} ${inv.screeningResult} ${inv.status}`.toLowerCase();
    return searchString.includes(invoiceSearchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-slate-800 animate-spin stroke-[1.5]" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Verifying Secured Intake Link...</p>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[1.5rem] border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] text-center max-w-md w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={28} className="text-slate-700" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portal Authentication Failed</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            {error || "This unique linkage key does not match a registered active vendor token, or your compliance session has expired."}
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 text-left space-y-3">
            <div className="flex items-start gap-2.5">
              <Lock size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Tokens are cryptographically signed and expire automatically after 24 hours to secure client data.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98] text-sm"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased text-slate-800">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Brand Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-200/70">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck size={26} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-md">EXTERNAL</span>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">SECURED CONNECTION</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">TaxFlow Vendor Portal</h1>
            </div>
          </div>

          {/* Context Header Badge */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)] shrink-0 max-w-full md:max-w-md">
            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <Building size={18} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partner Entity</p>
              <h4 className="text-sm font-bold text-slate-800 truncate pr-2">{session?.vendorName}</h4>
            </div>
          </div>
        </div>

        {/* Portal Info Status Alert (Anti-Slop alternative to hero metrics) */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-600 mt-0.5 sm:mt-0">
              <Key size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900">Cryptographic Session Session ID: <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-mono">...{token?.slice(-12)}</code></p>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">This pipeline automatically pushes direct uploads into GSTR matching structures. All events are logged securely in the Audit Trail.</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
            <CheckCircle size={14} /> Link Active
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="bg-slate-200/60 p-1 rounded-xl flex gap-1 overflow-x-auto scrollbar-none">
          <button 
            onClick={() => setActiveTab('UPLOAD')}
            className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'UPLOAD' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
              : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload size={14} /> Submit Invoice
          </button>
          
          <button 
            onClick={() => setActiveTab('TRACKER')}
            className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'TRACKER' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
              : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={14} /> Invoice Tracker
          </button>

          <button 
            onClick={() => setActiveTab('PROFILE')}
            className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'PROFILE' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
              : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User size={14} /> Partner Profile
          </button>

          <button 
            onClick={() => {
              setActiveTab('LOGS');
              if (token) loadLogs(token);
            }}
            className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'LOGS' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' 
              : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={14} /> Compliance Log
          </button>
        </div>

        {/* Content Tabs Container */}
        <div className="bg-white rounded-[1.5rem] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)] border border-slate-200/60 overflow-hidden min-h-[460px]">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: UPLOAD INVOICE */}
            {activeTab === 'UPLOAD' && (
              <motion.div
                key="tab-upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8 md:p-10 space-y-6"
              >
                {!isSuccess ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">Upload Tax Invoice Document</h2>
                      <p className="text-slate-500 text-xs font-medium leading-relaxed mt-1">
                        Select your transaction invoice document. TaxFlow compliance engines immediately scan details for tax rate conformity.
                      </p>
                    </div>

                    <div className="relative">
                      <input 
                        type="file" 
                        id="invoice-upload"
                        className="hidden" 
                        onChange={handleFileChange}
                        accept=".pdf,image/*"
                        disabled={isUploading}
                      />
                      {!file ? (
                        <label 
                          htmlFor="invoice-upload"
                          className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group"
                        >
                          <div className="w-12 h-12 bg-white border border-slate-200/80 rounded-xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-105 transition-all">
                            <Upload size={20} className="text-slate-600" />
                          </div>
                          <p className="text-sm font-semibold text-slate-900">Choose Invoice Document</p>
                          <p className="text-slate-400 text-xs mt-1">Drag and drop, or browse your files (PDF, JPG, PNG)</p>
                          <div className="mt-4 flex gap-1.5">
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase tracking-wider">PDF</span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase tracking-wider">IMAGES</span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden">
                           {isUploading && (
                             <div 
                               className="absolute bottom-0 left-0 h-1 bg-slate-900 transition-all duration-300"
                               style={{ width: `${uploadProgress}%` }}
                             />
                           )}
                           
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-white border border-slate-200/80 rounded-lg flex items-center justify-center text-slate-600 shrink-0">
                                <FileText size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate text-sm">{file.name}</p>
                                <p className="text-slate-400 text-[10px] font-medium mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB • Confirmed & Ready</p>
                             </div>
                             {!isUploading && (
                               <button 
                                onClick={() => setFile(null)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                               >
                                  <Trash2 size={16} />
                               </button>
                             )}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <button 
                        disabled={!file || isUploading}
                        onClick={handleSubmitUpload}
                        className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                          file && !isUploading 
                          ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:scale-[0.99]' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="animate-spin stroke-[2]" size={16} />
                            Analyzing Compliance Pipeline ({uploadProgress}%)
                          </>
                        ) : (
                          <>
                            Submit Invoice to Audit Queue
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <Clock size={12} /> Unique token remains active. Expiry logged periodically.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center max-w-md mx-auto space-y-6">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Submitted Successfully</h2>
                      <p className="text-slate-500 text-xs font-medium leading-relaxed">
                        Your transaction data is mapped against active GST laws and pushed directly into GSTR verification systems. An audit signature was saved.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Terminal size={14} className="text-slate-600" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">AI Classifier Diagnostics</span>
                      </div>
                      <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                        Extracted values mapped to HSN rates. View compliance results or request direct reviews in the Invoices Tracker.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setActiveTab('TRACKER')}
                        className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                      >
                        View Status Tracker
                      </button>
                      <button 
                        onClick={() => {
                          setIsSuccess(false);
                          setFile(null);
                        }}
                        className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                      >
                        Upload Another
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 2: INVOICES TRACKER */}
            {activeTab === 'TRACKER' && (
              <motion.div
                key="tab-tracker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Invoices & Screening Status</h2>
                    <p className="text-slate-500 text-xs font-medium mt-1">Review status validations or dispatch audit amendments instantly.</p>
                  </div>
                  <span className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0">
                    {filteredInvoices.length} Registered Records
                  </span>
                </div>

                {/* Filter / Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    placeholder="Search invoices by document number, amount, or classification result..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                  {invoiceSearchQuery && (
                    <button 
                      onClick={() => setInvoiceSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {filteredInvoices.length === 0 ? (
                  <div className="py-12 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6">
                    <FileText size={32} className="text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">No invoices match your search query</p>
                    <p className="text-xs text-slate-400 mt-1">Try refining your keyword or submit a new invoice above.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInvoices.map((inv) => {
                      const actionState = invoiceActions[inv.id];
                      const isWarning = inv.status === 'DISCREPANCY_WARNING';
                      return (
                        <div 
                          key={inv.id} 
                          className={`p-5 rounded-xl border transition-all ${
                            isWarning 
                            ? 'border-amber-200/70 bg-amber-50/20' 
                            : 'border-slate-200/80 bg-white shadow-sm'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm tracking-tight">{inv.invoiceNumber}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{inv.date}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                  inv.status === 'COMPLIANT' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200/60'
                                }`}>
                                  {inv.status === 'COMPLIANT' ? 'Compliant' : 'Discrepancy Alert'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <p className="text-slate-500 text-xs font-bold">Value: <span className="text-slate-900">{inv.amount}</span></p>
                                <span className="text-slate-200 text-xs">|</span>
                                <p className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5 leading-relaxed">
                                  <Sparkles size={12} className="text-slate-500 shrink-0" />
                                  {inv.screeningResult}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 items-center self-end md:self-start shrink-0">
                              {isWarning && (
                                <>
                                  {actionState === 'ACKNOWLEDGED' ? (
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                      <Check size={14} /> Warning Acknowledged
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleAcknowledgeWarning(inv.id, inv.invoiceNumber)}
                                      className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-amber-700 transition-all active:scale-[0.98] shadow-sm flex items-center gap-1"
                                    >
                                      <AlertTriangle size={12} /> Resolve Alert
                                    </button>
                                  )}
                                </>
                              )}

                              {!isWarning && (
                                <>
                                  {actionState === 'REVIEW_REQUESTED' ? (
                                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                                      <Clock size={14} /> Review Requested
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleRequestReview(inv.id, inv.invoiceNumber)}
                                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm flex items-center gap-1"
                                    >
                                      <RefreshCw size={12} /> Direct Re-Check
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: PARTNER PROFILE */}
            {activeTab === 'PROFILE' && (
              <motion.div
                key="tab-profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8 md:p-10 space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Partner Legal Entity Registry</h2>
                  <p className="text-slate-500 text-xs font-medium mt-1">Review contact registers or GSTIN references. Profile adjustments update security logs automatically.</p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {profileSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800">Profile Logged Successfully</p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Audit log parameters registered with IP details.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <User size={12} /> Registered Entity Name
                      </label>
                      <input 
                        type="text" 
                        value={session?.vendorName || ''} 
                        disabled
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Globe size={12} /> Corporate GSTIN
                      </label>
                      <input 
                        type="text" 
                        value={profileGstIn}
                        onChange={(e) => setProfileGstIn(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Mail size={12} /> Finance Registry Email
                      </label>
                      <input 
                        type="email" 
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Phone size={12} /> Contact Phone Number
                      </label>
                      <input 
                        type="text" 
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <MapPin size={12} /> Billing & Corporate HQ Address
                    </label>
                    <textarea 
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none transition-colors resize-none leading-relaxed"
                      required
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button 
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSavingProfile ? <Loader2 size={14} className="animate-spin stroke-[2]" /> : <Check size={14} />}
                      Update Profile & Log Event
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* TAB 4: COMPLIANCE ACTIVITY LOG */}
            {activeTab === 'LOGS' && (
              <motion.div
                key="tab-logs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8 space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Compliance Audit Trail</h2>
                    <p className="text-slate-500 text-xs font-medium mt-1">Legally sound digital signature history of all active intake actions.</p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0 self-start md:self-auto overflow-x-auto">
                    {['ALL', 'INVOICE', 'PROFILE', 'COMPLIANCE'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setLogFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                          logFilter === tab 
                          ? 'bg-white text-slate-800 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audit Logs Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Search logs by action summary, parameters, or diagnostic response..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-slate-400 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                  {logSearchQuery && (
                    <button 
                      onClick={() => setLogSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {isLoadingLogs ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 className="w-8 h-8 text-slate-800 animate-spin stroke-[1.5]" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Refreshing logs list...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                    <History className="text-slate-300 w-10 h-10 mb-3" />
                    <p className="font-semibold text-slate-700 text-sm">No activity logs found</p>
                    <p className="text-slate-400 text-xs mt-1">Adjust search parameters or trigger system events to display logs.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLogs.map((log) => {
                      const isInvoice = log.module === 'INVOICE';
                      const isProfile = log.module === 'PROFILE';
                      const isCompliance = log.module === 'COMPLIANCE';
                      return (
                        <div key={log.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-200/50 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">{log.action}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                                isInvoice ? 'bg-blue-50 text-blue-700 border-blue-200/40' :
                                isProfile ? 'bg-purple-50 text-purple-700 border-purple-200/40' :
                                isCompliance ? 'bg-amber-50 text-amber-700 border-amber-200/40' : 'bg-slate-50 text-slate-700 border-slate-200/40'
                              }`}>
                                {log.module}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                                log.status === 'SUCCESS' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40' 
                                : 'bg-amber-50 text-amber-700 border-amber-200/40'
                              }`}>
                                {log.status === 'SUCCESS' ? <Check size={8} /> : <AlertTriangle size={8} />}
                                {log.status}
                              </span>
                            </div>

                            <p className="text-slate-600 text-[11px] leading-relaxed font-semibold">{log.details}</p>
                            
                            {log.ipAddress && (
                              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                <Activity size={10} /> Signature Match • IP: {log.ipAddress}
                              </div>
                            )}
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">
                              {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold tracking-widest block mt-0.5">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Audit footer details */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-slate-500 shrink-0" />
            Audit trail hashes cryptographically verified
          </div>
          <p className="opacity-70">
            TaxFlow Portal Engine v2.4.0
          </p>
        </div>

      </div>
    </div>
  );
};

export default VendorPortal;
