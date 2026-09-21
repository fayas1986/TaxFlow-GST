import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, updateProfile, addTenant, switchTenant } from '../store/store';
import { updateTenantProfile, requestGstnOtp, verifyGstnOtp, getGstnConnectionStatus, updateSecuritySettings, downloadUserData, deleteUserAccount, createNewTenant, fetchAuditLogs, sendWeeklyDigest } from '../services/api';
import { Building2, Users, Shield, Save, Loader2, CheckCircle2, Globe, Key, AlertCircle, RefreshCw, FileKey, Trash2, DownloadCloud, Lock, Plus, X, Bell, History, Mail, CalendarDays, Database, Cloud, Layers, Clock, Download , FileText, Server, MessageSquare } from 'lucide-react';
import { UserRole } from '../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UserAccessManagement from '../components/organization/UserAccessManagement';
import { AuditLogs } from '../components/organization/AuditLogs';
import GstAuthenticationModule from '../components/GstAuthenticationModule';
import InactivityPolicyConfigurator from '../components/InactivityPolicyConfigurator';
import WorkspaceSyncSettingsTab from '../components/WorkspaceSyncSettingsTab';
import { DocumentStylingConfig } from '../components/DocumentStylingConfig';
import { WhatsAppNotificationCenter } from '../components/WhatsAppNotificationCenter';
import { AutomatedLedgerExportModule } from '../components/AutomatedLedgerExportModule';
import { NeonMultiTenantDatabaseCenter } from '../components/organization/NeonMultiTenantDatabaseCenter';

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 border border-slate-700">
        <div className="bg-green-500 rounded-full p-1 text-slate-900">
          <CheckCircle2 size={20} strokeWidth={3} />
        </div>
        <div>
          <h4 className="font-bold text-sm">Success</h4>
          <p className="text-sm text-slate-300">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-4">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

const BackupHistoryList: React.FC = () => {
    const { data: backups, isLoading } = useQuery({
        queryKey: ['backupHistory'],
        queryFn: async () => {
            const res = await fetch('/api/backups/history');
            return res.json();
        },
        refetchInterval: 30000 // Refresh every 30s
    });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>;
    
    if (!backups || backups.length === 0) return (
        <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-500 font-medium">No backup history available yet.</p>
        </div>
    );

    return (
        <div className="space-y-3">
            {backups.map((bkp: any) => (
                <div key={bkp.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                           <FileKey size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{bkp.id}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                                {new Date(bkp.timestamp).toLocaleString()} • {bkp.size}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-green-100">
                            {bkp.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const StorageSettings: React.FC<{ tenantId: string; setToast: (msg: string) => void }> = ({ tenantId, setToast }) => {
    const queryClient = useQueryClient();
    const { data: policy, isLoading: isPolicyLoading } = useQuery({
        queryKey: ['archivalPolicy'],
        queryFn: async () => {
            const res = await fetch('/api/settings/archival-policy');
            return res.json();
        }
    });

    const { data: vaultPolicy, isLoading: isVaultLoading } = useQuery({
        queryKey: ['vaultRetentionPolicy'],
        queryFn: async () => {
            const res = await fetch('/api/settings/vault-retention-policy');
            return res.json();
        }
    });

    const [threshold, setThreshold] = useState(6);
    const [autoArchive, setAutoArchive] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // Vault Retention Settings States
    const [vaultEnabled, setVaultEnabled] = useState(true);
    const [retentionYears, setRetentionYears] = useState(7);
    const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>(['INVOICE', 'E_WAY_BILL', 'AUDIT_REPORT', 'CORRESPONDENCE']);
    const [isSavingVault, setIsSavingVault] = useState(false);
    const [isMigratingVault, setIsMigratingVault] = useState(false);

    useEffect(() => {
        if (policy) {
            setThreshold(policy.thresholdMonths);
            setAutoArchive(policy.autoArchive);
        }
    }, [policy]);

    useEffect(() => {
        if (vaultPolicy) {
            setVaultEnabled(vaultPolicy.enabled);
            setRetentionYears(vaultPolicy.retentionYears);
            setSelectedDocTypes(vaultPolicy.documentTypes || []);
        }
    }, [vaultPolicy]);

    const handleSave = async () => {
        setIsUpdating(true);
        try {
            await fetch('/api/settings/archival-policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thresholdMonths: threshold, autoArchive })
            });
            queryClient.invalidateQueries({ queryKey: ['archivalPolicy'] });
            setToast('Archival policy updated successfully');
        } catch (err) {
            alert('Failed to update policy');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleManualArchive = async () => {
        if (!confirm(`Are you sure you want to archive all invoices older than ${threshold} months now? This will improve table performance.`)) return;
        
        setIsUpdating(true);
        try {
            const res = await fetch('/api/invoices/archive-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thresholdMonths: threshold })
            });
            const data = await res.json();
            setToast(data.message);
        } catch (err) {
            alert('Failed to trigger archival');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveVaultPolicy = async () => {
        setIsSavingVault(true);
        try {
            await fetch('/api/settings/vault-retention-policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: vaultEnabled, retentionYears, documentTypes: selectedDocTypes })
            });
            queryClient.invalidateQueries({ queryKey: ['vaultRetentionPolicy'] });
            setToast('Document Vault retention policy saved successfully');
        } catch (err) {
            alert('Failed to save document vault policy');
        } finally {
            setIsSavingVault(false);
        }
    };

    const handleRunVaultMigration = async () => {
        if (!confirm(`Confirm manual run of document retention migration. Historical files older than ${retentionYears} years matching selected types will be migrated to the Document Vault.`)) return;
        
        setIsMigratingVault(true);
        try {
            const res = await fetch('/api/settings/vault-retention-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ retentionYears, documentTypes: selectedDocTypes })
            });
            const data = await res.json();
            setToast(data.message);
        } catch (err) {
            alert('Failed to run document migration');
        } finally {
            setIsMigratingVault(false);
        }
    };

    const toggleDocType = (type: string) => {
        if (selectedDocTypes.includes(type)) {
            setSelectedDocTypes(prev => prev.filter(t => t !== type));
        } else {
            setSelectedDocTypes(prev => [...prev, type]);
        }
    };

    if (isPolicyLoading || isVaultLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-10">
            
            {/* Ledger Archival Section */}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers size={20} className="text-blue-500" />
                    Data Retention & Ledger Archival Policy
                </h3>

                <div className="space-y-6">
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            To maintain high performance of your invoice ledger, we automatically archive older records to cold storage. Archived records remain accessible via the "Archives" tab but are excluded from primary reports and active computations.
                        </p>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-800">Automated Archival</h4>
                                    <p className="text-xs text-slate-500">System will periodically move old records.</p>
                                </div>
                                <button 
                                    onClick={() => setAutoArchive(!autoArchive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoArchive ? 'bg-blue-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`${autoArchive ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Archival Threshold</label>
                                    <span className="text-sm font-bold text-blue-600">{threshold} Months</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="24" 
                                    step="1" 
                                    value={threshold} 
                                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                    <span>1 Month</span>
                                    <span>12 Months</span>
                                    <span>24 Months</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <button 
                                    onClick={handleSave}
                                    disabled={isUpdating}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                                >
                                    {isUpdating ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                                    Save Policy
                                </button>
                                <button 
                                    onClick={handleManualArchive}
                                    disabled={isUpdating}
                                    className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                                >
                                    <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''}/>
                                    Run Archive Now
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                        <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h5 className="text-xs font-bold text-amber-900">Policy Implications</h5>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                Archiving invoices older than {threshold} months will significantly speed up searches and exports. You can still view and restore these records from the Invoice Archives if needed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Vault Retention Section */}
            <div className="border-t border-slate-200 pt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <FileKey size={20} className="text-indigo-600" />
                        Historical Document Vault Retention Policy
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Secure Vault Sync
                    </span>
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            Define automated statutory schedules to move historical PDFs, compliance attachments, filings, and audit statements from the primary hot database directly to the secure, tamper-proof **Document Vault** after a selected number of years.
                        </p>

                        <div className="space-y-6">
                            {/* Toggle policy */}
                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">Automated Document Vault Archiving</h4>
                                    <p className="text-xs text-slate-500">Automatically transfers qualified files on monthly audits.</p>
                                </div>
                                <button 
                                    onClick={() => setVaultEnabled(!vaultEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${vaultEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`${vaultEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>

                            {/* Year Threshold Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Retention Age Threshold</label>
                                    <span className="text-sm font-extrabold text-indigo-600">{retentionYears} Years {retentionYears === 7 ? '(Statutory Requirement)' : ''}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    step="1" 
                                    value={retentionYears} 
                                    onChange={(e) => setRetentionYears(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                    <span>1 Year</span>
                                    <span>5 Years</span>
                                    <span>7 Years (GST Standard)</span>
                                    <span>10 Years</span>
                                </div>
                            </div>

                            {/* Multi-select categories */}
                            <div className="space-y-3 pt-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Applicable Document Classes</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    {[
                                        { key: 'INVOICE', label: 'E-Invoices & Purchase Invoices' },
                                        { key: 'E_WAY_BILL', label: 'E-Way Shipment Slips' },
                                        { key: 'AUDIT_REPORT', label: 'Statutory GSTR Audit Reports' },
                                        { key: 'CORRESPONDENCE', label: 'GST Notice Communications' },
                                    ].map((docClass) => {
                                        const isChecked = selectedDocTypes.includes(docClass.key);
                                        return (
                                            <button
                                                key={docClass.key}
                                                type="button"
                                                onClick={() => toggleDocType(docClass.key)}
                                                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                                                    isChecked 
                                                        ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950' 
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>{docClass.label}</span>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                    isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                                                }`}>
                                                    {isChecked && <CheckCircle2 size={10} strokeWidth={4} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Save and Run Triggers */}
                            <div className="flex items-center gap-4 pt-4 border-t border-slate-200/50">
                                <button 
                                    onClick={handleSaveVaultPolicy}
                                    disabled={isSavingVault}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-2"
                                >
                                    {isSavingVault ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                                    Save Vault Schedule
                                </button>
                                <button 
                                    onClick={handleRunVaultMigration}
                                    disabled={isMigratingVault}
                                    className="px-6 py-2 bg-white border border-slate-200 text-indigo-700 hover:bg-slate-50 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2"
                                >
                                    {isMigratingVault ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
                                    Run Migration Sync Now
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 border border-indigo-100/60 rounded-xl flex gap-3">
                        <Lock size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h5 className="text-xs font-bold text-indigo-900">Vault Immutability Assurance</h5>
                            <p className="text-[11px] text-indigo-700 leading-relaxed">
                                Documents transferred to the Document Vault are locked with SHA-256 cryptographic signatures. This satisfies section 144 tax audit standards in India, protecting historical files from subsequent deletions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Automated Monthly Ledger Compliance Export Section */}
            <div className="border-t border-slate-200 pt-8">
                <AutomatedLedgerExportModule tenantId={tenantId} />
            </div>
        </div>
    );
};

const WhatsAppSettingsTab: React.FC<{ setToast: (msg: string) => void }> = ({ setToast }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    const handleTestAlert = async (template: string, data: any) => {
        if (!phoneNumber || phoneNumber.length < 10) {
            alert('Please enter a valid phone number with country code (e.g., +919876543210)');
            return;
        }

        setIsTesting(true);
        try {
            const res = await fetch('/api/v1/whatsapp/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phoneNumber,
                    template,
                    data
                })
            });
            const result = await res.json();
            
            if (res.ok) {
                setToast('WhatsApp alert sent successfully!');
            } else {
                alert(result.error || 'Failed to send WhatsApp alert.');
            }
        } catch (err) {
            console.error('Error sending WhatsApp test:', err);
            alert('Failed to connect to the notification server.');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <MessageSquare size={20} className="text-emerald-500" />
                    WhatsApp Alerts Configuration
                </h3>
                <p className="text-sm text-slate-500">Configure mobile numbers for the finance team to receive automated alerts for critical tax deadlines, filing reminders, and refund statuses.</p>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Finance Team Mobile Number</label>
                    <input 
                        type="text" 
                        placeholder="+919876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-xs text-slate-500 mt-1">Include country code (e.g. +91 for India). Notifications will be routed to this number.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h4 className="text-sm font-bold text-slate-700">Test Alert Configurations</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm mb-1">Deadline Alert</h5>
                                <p className="text-xs text-slate-500 mb-4">Simulate an urgent tax filing deadline notification.</p>
                            </div>
                            <button 
                                onClick={() => handleTestAlert('DEADLINE_ALERT', { returnType: 'GSTR-3B', period: 'August 2026', dueDate: '20th Sept 2026' })}
                                disabled={isTesting}
                                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                                Test Deadline Alert
                            </button>
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm mb-1">Refund Status Update</h5>
                                <p className="text-xs text-slate-500 mb-4">Simulate a status change on a pending refund claim.</p>
                            </div>
                            <button 
                                onClick={() => handleTestAlert('REFUND_STATUS', { status: 'APPROVED', arn: 'AA2708230001234', amount: '450,000', remarks: 'Processed by jurisdictional officer.' })}
                                disabled={isTesting}
                                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                                Test Refund Alert
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm mb-1">Filing Reminder</h5>
                                <p className="text-xs text-slate-500 mb-4">Simulate an upcoming filing action reminder.</p>
                            </div>
                            <button 
                                onClick={() => handleTestAlert('FILING_REMINDER', { returnType: 'GSTR-1', status: 'Pending Review', pendingActions: 'Approve 14 Invoices' })}
                                disabled={isTesting}
                                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                                Test Filing Reminder
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-emerald-50 border border-emerald-100/60 rounded-xl flex gap-3">
                <MessageSquare size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h5 className="text-xs font-bold text-emerald-900">Twilio Integration Details</h5>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                        Messages are routed via Twilio WhatsApp API. Ensure that <code>TWILIO_ACCOUNT_SID</code> and <code>TWILIO_AUTH_TOKEN</code> are correctly configured in your server environment variables.
                    </p>
                </div>
            </div>
        </div>
    );
};

const Settings: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentTenant = user?.availableTenants.find(t => t.id === user.currentTenantId);
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'GSTN' | 'NEON_DATABASE' | 'USERS' | 'SECURITY' | 'INACTIVITY' | 'AUDIT' | 'NOTIFICATIONS' | 'BACKUP' | 'STORAGE' | 'STYLING' | 'WORKSPACE' | 'WHATSAPP'>('GSTN');
  const [isSaving, setIsSaving] = useState(false);
  
  // Weekly Digest State
  const [digestEmail, setDigestEmail] = useState(user?.email || '');
  const [digestDay, setDigestDay] = useState('MONDAY');
  const [isDigestEnabled, setIsDigestEnabled] = useState(true);
  
  // Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState(''); // Inline form success

  // Security State
  const [isSSOEnabled, setIsSSOEnabled] = useState(false);
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);
  const [ssoConfig, setSsoConfig] = useState({
      domain: 'acme.com',
      metadataUrl: 'https://idp.acme.com/metadata.xml'
  });

  // GSTN Auth State
  const [gstnUsername, setGstnUsername] = useState('');
  const [gstnOtp, setGstnOtp] = useState('');
  const [authStep, setAuthStep] = useState<'INIT' | 'OTP' | 'CONNECTED'>('INIT');
  const [authError, setAuthError] = useState('');

  // State code to Name mapping
  const STATE_NAMES: Record<string, string> = {
    '27': 'Maharashtra',
    '07': 'Delhi',
    '29': 'Karnataka',
    '33': 'Tamil Nadu',
    '24': 'Gujarat',
    '04': 'Chandigarh',
    '36': 'Telangana'
  };

  // Create Tenant State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFormData, setCreateFormData] = useState({
      name: '',
      gstin: '',
      address: '',
      stateCode: '27'
  });

  // Automatically reset creation error and set initial GSTIN prefix when modal opens
  const handleOpenCreateModal = () => {
      setCreateError(null);
      setCreateFormData({
          name: '',
          gstin: '27',
          address: '',
          stateCode: '27'
      });
      setShowCreateModal(true);
  };

  // Keep state code and GSTIN first 2 digits aligned
  const handleStateCodeChange = (newCode: string) => {
      setCreateFormData(prev => {
          let updatedGstin = prev.gstin;
          if (prev.gstin.length >= 2) {
              updatedGstin = newCode + prev.gstin.substring(2);
          } else {
              updatedGstin = newCode;
          }
          return {
              ...prev,
              stateCode: newCode,
              gstin: updatedGstin
          };
      });
  };

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      let finalGstin = val;

      // Lock the first 2 digits to stateCode
      if (val.length <= 2) {
          finalGstin = createFormData.stateCode;
      } else if (!val.startsWith(createFormData.stateCode)) {
          finalGstin = createFormData.stateCode + val.substring(2);
      }

      // Max GSTIN length is 15 characters
      if (finalGstin.length > 15) {
          finalGstin = finalGstin.substring(0, 15);
      }

      setCreateFormData(prev => ({
          ...prev,
          gstin: finalGstin
      }));
  };

  // Privacy State
  const { mutate: exportData, isPending: isExporting } = useMutation({
    mutationFn: downloadUserData,
    onSuccess: () => alert('Data package has been emailed to you.')
  });

  const { mutate: deleteAccount, isPending: isDeleting } = useMutation({
    mutationFn: deleteUserAccount,
    onSuccess: () => alert('Your request for erasure has been submitted.')
  });

  // Create Tenant Mutation
  const { mutate: createOrganization, isPending: isCreatingOrg } = useMutation({
      mutationFn: createNewTenant,
      onSuccess: (newTenant) => {
          // 1. Update Redux Store
          dispatch(addTenant(newTenant));
          
          // 2. Auto-switch context to the new tenant immediately
          dispatch(switchTenant(newTenant.id));
          
          // 3. Reset UI & Close Modal
          setCreateFormData({ name: '', gstin: '', address: '', stateCode: '27' });
          setShowCreateModal(false);
          setCreateError(null);
          
          // 4. Force a profile data refresh for the form fields
          setProfileData({
            name: newTenant.name,
            gstin: newTenant.gstin,
            address: newTenant.address
          });

          // 5. Show Notification
          setToastMessage(`Organization "${newTenant.name}" created and selected!`);
          
          // 6. Scroll to top to show the change
          window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (err) => {
          console.error("Create organization failed", err);
          setCreateError('Failed to create organization. Please try again.');
      }
  });

  // Form State
  const [profileData, setProfileData] = useState({
    name: currentTenant?.name || '',
    gstin: currentTenant?.gstin || '',
    address: currentTenant?.address || ''
  });

  // Sync state when tenant changes
  useEffect(() => {
    if (currentTenant) {
      setProfileData({
        name: currentTenant.name,
        gstin: currentTenant.gstin,
        address: currentTenant.address
      });
    }
  }, [currentTenant]);

  const { data: gstnStatus, isLoading: isStatusLoading } = useQuery({
      queryKey: ['gstnStatus', user?.currentTenantId], 
      queryFn: getGstnConnectionStatus,
      refetchInterval: 30000 
  });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    
    setIsSaving(true);
    await updateTenantProfile(currentTenant.id, profileData);
    setIsSaving(false);
    setSuccessMessage('Profile updated successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null);
      
      // Basic validation
      if (!createFormData.name.trim() || !createFormData.gstin.trim() || !createFormData.address.trim()) {
          setCreateError('Please fill in all required fields (Name, GSTIN, Address)');
          return;
      }

      // GSTIN Length Validation
      if (createFormData.gstin.length !== 15) {
          setCreateError(`GSTIN must be exactly 15 characters. Currently ${createFormData.gstin.length} characters.`);
          return;
      }

      // State Code Match Validation
      if (!createFormData.gstin.startsWith(createFormData.stateCode)) {
          setCreateError(`GSTIN state code prefix mismatch. Selected State Code is ${createFormData.stateCode} (${STATE_NAMES[createFormData.stateCode]}), so GSTIN must start with ${createFormData.stateCode}.`);
          return;
      }

      // Format regex matching
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(createFormData.gstin)) {
          setCreateError('Invalid Indian GSTIN structure. Standard format: 27AAAAA0000A1Z5 (e.g., 2 State Code, 5 Letters, 4 Digits, 1 Letter, 1 Alphanumeric, \'Z\', 1 Checksum character).');
          return;
      }

      createOrganization(createFormData);
  };

  const { mutate: requestOtp, isPending: isRequestingOtp } = useMutation({
      mutationFn: requestGstnOtp,
      onSuccess: () => {
          setAuthStep('OTP');
          setAuthError('');
      },
      onError: () => setAuthError('Failed to send OTP. Verify username.')
  });

  const { mutate: submitOtp, isPending: isVerifyingOtp } = useMutation({
      mutationFn: () => verifyGstnOtp(gstnUsername, gstnOtp),
      onSuccess: () => {
          setAuthStep('CONNECTED');
          queryClient.invalidateQueries({ queryKey: ['gstnStatus'] });
          setAuthError('');
          setGstnOtp('');
      },
      onError: () => setAuthError('Invalid OTP. Please try again.')
  });

  const tabs = [
    { id: 'GSTN', label: 'GSTN Portal', icon: Globe },
    { id: 'NEON_DATABASE', label: 'Postgres Neon Multi-Tenant', icon: Server },
    { id: 'USERS', label: 'User Management', icon: Users },
    { id: 'SECURITY', label: 'Security & SSO', icon: Shield },
    { id: 'INACTIVITY', label: 'Session Inactivity', icon: Clock },
    { id: 'WORKSPACE', label: 'Workspace Sync', icon: Cloud },
    { id: 'BACKUP', label: 'Cloud Backups', icon: Database },
    { id: 'STORAGE', label: 'Data Storage', icon: Layers },
    { id: 'STYLING', label: 'Document Styling', icon: FileText },
    { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },
    { id: 'WHATSAPP', label: 'WhatsApp Alerts', icon: MessageSquare },
    { id: 'AUDIT', label: 'Audit Logs', icon: History },
  ];

  const { data: auditLogs, isLoading: isAuditLoading } = useQuery({
    queryKey: ['auditLogs', user?.currentTenantId],
    queryFn: () => fetchAuditLogs(user?.currentTenantId || 't1'),
    enabled: activeTab === 'AUDIT'
  });

  const handleExportAuditLogs = () => {
    if (!auditLogs || auditLogs.length === 0) return;
    
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Status', 'Details'];
    const csvContent = [
      headers.join(','),
      ...auditLogs.map(log => [
        `"${new Date(log.timestamp).toISOString()}"`,
        `"${log.user.replace(/"/g, '""')}"`,
        `"${log.role.replace(/"/g, '""')}"`,
        `"${log.action.replace(/"/g, '""')}"`,
        `"${log.module.replace(/"/g, '""')}"`,
        `"${log.status.replace(/"/g, '""')}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage('Audit logs exported successfully');
  };

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Shield size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Access Restricted</h2>
        <p className="text-slate-500">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-slate-500">Manage your organization profile and security preferences.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col md:flex-row w-full min-w-0 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 relative overflow-x-auto custom-scrollbar-visible">
          {activeTab === 'GSTN' && (
             <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <GstAuthenticationModule />
             </div>
          )}

          {activeTab === 'NEON_DATABASE' && (
             <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <NeonMultiTenantDatabaseCenter 
                  currentTenantId={user?.currentTenantId || 't1'} 
                  onShowToast={(msg) => setToastMessage(msg)} 
                />
             </div>
          )}

          {activeTab === 'WORKSPACE' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
                <WorkspaceSyncSettingsTab setToastMessage={(msg) => setToastMessage(msg)} />
             </div>
          )}

          {/* ... (Other tabs kept same for brevity, logic unchanged) ... */}
          {activeTab === 'USERS' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
               <UserAccessManagement 
                 currentTenantId={user?.currentTenantId} 
                 onShowToast={(msg) => setToastMessage(msg)} 
               />
             </div>
          )}

          {activeTab === 'INACTIVITY' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
               <InactivityPolicyConfigurator 
                 onShowToast={(msg) => setToastMessage(msg)}
                 adminName={user?.name || 'Security Admin'}
               />
             </div>
          )}

          {activeTab === 'SECURITY' && (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <Shield size={20} className="text-blue-500" />
                Security & SSO Settings
              </h3>
              
              <div className="space-y-6">
                {/* SSO Section */}
                <div className={`border border-slate-200 rounded-lg bg-white transition-all overflow-hidden ${isSSOEnabled ? 'ring-1 ring-blue-500 border-blue-500' : ''}`}>
                   <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                       <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-900">SSO Integration</h4>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wide">Enterprise</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Enable Single Sign-On with your Identity Provider (IdP).</p>
                      </div>
                      <button 
                        onClick={() => setIsSSOEnabled(!isSSOEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSSOEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <span className={`${isSSOEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                      </button>
                   </div>
                   
                   {isSSOEnabled && (
                       <div className="p-6 space-y-4 animate-in slide-in-from-top-2">
                           <div className="space-y-2">
                               <label className="text-sm font-semibold text-slate-700">Company Domain</label>
                               <div className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                   <Globe size={16} className="text-slate-400"/>
                                   <input 
                                     value={ssoConfig.domain}
                                     onChange={(e) => setSsoConfig({...ssoConfig, domain: e.target.value})}
                                     className="flex-1 text-sm outline-none"
                                   />
                               </div>
                           </div>
                           <div className="space-y-2">
                               <label className="text-sm font-semibold text-slate-700">IdP Metadata URL</label>
                               <div className="flex items-center gap-3 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                   <Key size={16} className="text-slate-400"/>
                                   <input 
                                     value={ssoConfig.metadataUrl}
                                     onChange={(e) => setSsoConfig({...ssoConfig, metadataUrl: e.target.value})}
                                     className="flex-1 text-sm outline-none"
                                   />
                               </div>
                           </div>
                           <div className="pt-2 flex justify-end">
                               <button className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                                   Save Configuration
                               </button>
                           </div>
                       </div>
                   )}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'BACKUP' && (
             <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
               <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                 <Database size={20} className="text-blue-500" />
                 Cloud Automated Backups
               </h3>
               
               <div className="space-y-6">
                 <div className="p-6 bg-slate-900 text-white rounded-2xl relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                             <Cloud size={20} />
                          </div>
                          <div>
                             <h4 className="font-black tracking-tight">Automated Protection</h4>
                             <p className="text-[10px] text-blue-300 uppercase tracking-widest font-black">Daily Snapshots Active</p>
                          </div>
                       </div>
                       <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                          Your invoice data, compliance history, and audit logs are automatically snapshotted to our secure external vault every 24 hours.
                       </p>
                       
                       <div className="mb-6 space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest">
                             <span>Storage Utilization</span>
                             <span>4.2 GB / 10 GB</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                             <div className="bg-blue-500 h-2 rounded-full w-[42%] shadow-lg shadow-blue-500/20"></div>
                          </div>
                       </div>

                       <button 
                         onClick={async () => {
                           try {
                             const res = await fetch('/api/backups/trigger', { method: 'POST' });
                             if (res.ok) {
                               queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
                               setToastMessage('Manual backup triggered successfully!');
                             }
                           } catch (err) {
                             setToastMessage('Failed to trigger backup');
                           }
                         }}
                         className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                       >
                          Trigger Manual Backup
                       </button>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Snapshot History (Last 10)</h4>
                        <button 
                           onClick={() => queryClient.invalidateQueries({ queryKey: ['backupHistory'] })}
                           className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                        >
                           <RefreshCw size={14}/>
                        </button>
                    </div>
                    <BackupHistoryList />
                 </div>
               </div>
             </div>
          )}

          {activeTab === 'STORAGE' && (
             <StorageSettings 
               tenantId={user?.currentTenantId || 't1'} 
               setToast={(msg) => setToastMessage(msg)}
             />
          )}

          {activeTab === 'STYLING' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
               <DocumentStylingConfig setToastMessage={(msg) => setToastMessage(msg)} />
             </div>
          )}

          {activeTab === 'NOTIFICATIONS' && (
             <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                  <Bell size={20} className="text-blue-500" />
                  Notification Preferences
                </h3>
                
                <div className="space-y-8">
                  {/* Weekly Digest Service */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Mail size={20}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">Weekly Compliance Digest</h4>
                                <p className="text-xs text-slate-500">Summary of processed invoices and detected risks.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsDigestEnabled(!isDigestEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDigestEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                            <span className={`${isDigestEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </button>
                    </div>
                    
                    <div className={`p-6 space-y-6 transition-opacity ${!isDigestEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Recipient Email</label>
                                <div className="flex items-center gap-3 px-4 h-11 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <Mail size={16} className="text-slate-400"/>
                                    <input 
                                        type="email"
                                        value={digestEmail}
                                        onChange={(e) => setDigestEmail(e.target.value)}
                                        className="flex-1 bg-transparent text-sm outline-none"
                                        placeholder="admin@company.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Delivery Day</label>
                                <div className="flex items-center gap-3 px-4 h-11 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <CalendarDays size={16} className="text-slate-400"/>
                                    <select 
                                        value={digestDay}
                                        onChange={(e) => setDigestDay(e.target.value)}
                                        className="flex-1 bg-transparent text-sm outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="MONDAY">Monday Morning</option>
                                        <option value="FRIDAY">Friday Evening</option>
                                        <option value="SUNDAY">Sunday Morning</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-xs text-blue-700 leading-relaxed">
                                <strong>System Note:</strong> The digest covers data from the previous 7 days. You will receive an email summary including total taxable turnover, GST liability, and top AI-flagged compliance risks.
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button 
                                onClick={async () => {
                                    try {
                                        await sendWeeklyDigest(user?.currentTenantId || 't1', digestEmail);
                                        setToastMessage('Test digest email sent successfully!');
                                    } catch (e) {
                                        alert('Failed to send test email.');
                                    }
                                }}
                                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                Send Test Digest Now
                            </button>
                            <button 
                                onClick={() => {
                                    setToastMessage('Notification preferences saved!');
                                }}
                                className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
                            >
                                Save Preferences
                            </button>
                        </div>
                    </div>
                  </div>
                </div>
             </div>
          )}

          {activeTab === 'AUDIT' && (
             <AuditLogs 
               auditLogs={auditLogs} 
               isAuditLoading={isAuditLoading} 
               onExport={handleExportAuditLogs} 
             />
          )}

           {activeTab === 'WHATSAPP' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <WhatsAppNotificationCenter initialTab="SETTINGS" tenantId={currentTenant?.id || 't1'} />
               <WhatsAppSettingsTab setToast={(msg) => setToastMessage(msg)} />
             </div>
          )}

        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">Create New Organization</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              {createError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Cannot Create Organization</p>
                    <p className="text-xs text-red-600 mt-0.5">{createError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Legal Business Name</label>
                <input 
                    required
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                    placeholder="e.g. My New Company Pvt Ltd"
                    className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700">GSTIN</label>
                  <span className="text-[11px] text-slate-400 font-mono">Starts with State Code</span>
                </div>
                <input 
                    required
                    value={createFormData.gstin}
                    onChange={handleGstinChange}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono uppercase tracking-wider"
                />
              </div>

              <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">Place of Business (State)</label>
                  <select 
                    name="stateCode" 
                    value={createFormData.stateCode}
                    onChange={(e) => handleStateCodeChange(e.target.value)}
                    className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-shadow"
                  >
                      <option value="27">Maharashtra (27)</option>
                      <option value="07">Delhi (07)</option>
                      <option value="29">Karnataka (29)</option>
                      <option value="33">Tamil Nadu (33)</option>
                      <option value="24">Gujarat (24)</option>
                      <option value="04">Chandigarh (04)</option>
                      <option value="36">Telangana (36)</option>
                  </select>
              </div>

              {/* GSTIN Real-time Checklist */}
              {createFormData.gstin.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className={createFormData.gstin.length === 15 && createFormData.gstin.startsWith(createFormData.stateCode) && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(createFormData.gstin) ? "text-green-500" : "text-slate-400"} />
                    GSTIN Validation Helper
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={createFormData.gstin.length === 15 ? "text-green-600 font-bold" : "text-slate-400 font-bold"}>
                        {createFormData.gstin.length === 15 ? '✓' : '•'}
                      </span>
                      <span className={createFormData.gstin.length === 15 ? "text-green-700 font-medium" : "text-slate-500"}>
                        Length: exactly 15 characters ({createFormData.gstin.length}/15)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={createFormData.gstin.startsWith(createFormData.stateCode) ? "text-green-600 font-bold" : "text-slate-400 font-bold"}>
                        {createFormData.gstin.startsWith(createFormData.stateCode) ? '✓' : '•'}
                      </span>
                      <span className={createFormData.gstin.startsWith(createFormData.stateCode) ? "text-green-700 font-medium" : "text-slate-500"}>
                        Starts with selected State Code: {createFormData.stateCode} ({STATE_NAMES[createFormData.stateCode]})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(createFormData.gstin) ? "text-green-600 font-bold" : "text-slate-400 font-bold"}>
                        {/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(createFormData.gstin) ? '✓' : '•'}
                      </span>
                      <span className={/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(createFormData.gstin) ? "text-green-700 font-medium" : "text-slate-500"}>
                        Matches standard format (2 State, 5 PAN letters, 4 PAN numbers, 1 alpha, 1 alphanumeric, 'Z', 1 checksum)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Registered Address</label>
                <textarea 
                    rows={3}
                    required
                    value={createFormData.address}
                    onChange={(e) => setCreateFormData({...createFormData, address: e.target.value})}
                    className="w-full p-4 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="e.g. 123 Business Park, Chennai, TN"
                />
              </div>

              <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isCreatingOrg}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      {isCreatingOrg ? <Loader2 size={20} className="animate-spin"/> : 'Create Organization'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;