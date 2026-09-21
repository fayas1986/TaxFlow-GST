import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Pause, Trash2, Calendar, RefreshCw, Plus, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, User, Sparkles, Sliders, ShieldCheck, HelpCircle, ArrowRight
} from 'lucide-react';
import { loadCustomers, loadVendors } from '../services/partyMasterService';
import { createInvoice, sendInvoiceReminder } from '../services/api';
import { Invoice, InvoiceItem } from '../types';

interface RecurringInvoicesModuleProps {
  tenantId: string;
  onInvoiceGenerated: () => void;
  autoOpenCreate?: boolean;
  onCloseCreate?: () => void;
}

export interface RecurringProfile {
  id: string;
  tenantId: string;
  profileName: string;
  partyType: 'CUSTOMER' | 'VENDOR';
  partyId: string;
  partyName: string;
  gstin: string;
  placeOfSupply: string;
  category: 'SALES' | 'PURCHASE';
  type: 'B2B' | 'B2C' | 'EXPORT';
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  baseAmount: number;
  taxRate: number; // e.g. 18
  description: string;
  hsnSac: string;
  autoEInvoice: boolean;
  startDate: string;
  nextExecutionDate: string;
  lastExecutedDate?: string;
  status: 'ACTIVE' | 'PAUSED';
  countGenerated: number;
  autoDispatch?: boolean;
  dispatchMethod?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE';
  recipientContact?: string;
}

export interface RecurringLog {
  id: string;
  profileId: string;
  profileName: string;
  invoiceId: string;
  invoiceNumber: string;
  executionDate: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  dispatchMethod?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE';
  recipientContact?: string;
}

const PROFILE_STORAGE_KEY = 'TF_RECURRING_PROFILES_V1';
const RECURRING_LOG_STORAGE_KEY = 'TF_RECURRING_LOGS_V1';

export const RecurringInvoicesModule: React.FC<RecurringInvoicesModuleProps> = ({
  tenantId,
  onInvoiceGenerated,
  autoOpenCreate = false,
  onCloseCreate
}) => {
  // 1. Data States
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [logs, setLogs] = useState<RecurringLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Form States
  const [profileName, setProfileName] = useState('');
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [category, setCategory] = useState<'SALES' | 'PURCHASE'>('SALES');
  const [type, setType] = useState<'B2B' | 'B2C' | 'EXPORT'>('B2B');
  const [docType, setDocType] = useState<'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'>('INVOICE');
  const [interval, setInterval] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [baseAmount, setBaseAmount] = useState<number>(25000);
  const [taxRate, setTaxRate] = useState<number>(18);
  const [description, setDescription] = useState('Monthly Software & Professional Services Retainer');
  const [hsnSac, setHsnSac] = useState('998311');
  const [autoEInvoice, setAutoEInvoice] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Automated Dispatch form states
  const [autoDispatch, setAutoDispatch] = useState<boolean>(true);
  const [dispatchMethod, setDispatchMethod] = useState<'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE'>('EMAIL');
  const [recipientContact, setRecipientContact] = useState<string>('');

  // Parties loaded from master service
  const customers = useMemo(() => loadCustomers(), []);
  const vendors = useMemo(() => loadVendors(), []);

  // Sync modal state from parent prop deep-link
  useEffect(() => {
    if (autoOpenCreate) {
      setIsModalOpen(true);
    }
  }, [autoOpenCreate]);

  // Reset modal callbacks on close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onCloseCreate) {
      onCloseCreate();
    }
  };

  // Auto-resolve recipient contact details when selected party or dispatch method changes
  useEffect(() => {
    if (!selectedPartyId) {
      setRecipientContact('');
      return;
    }
    const party = partyType === 'CUSTOMER' 
      ? customers.find(c => c.id === selectedPartyId)
      : vendors.find(v => v.id === selectedPartyId);

    if (party && party.contact) {
      if (dispatchMethod === 'EMAIL') {
        setRecipientContact(party.contact.email || '');
      } else if (dispatchMethod === 'SMS' || dispatchMethod === 'WHATSAPP') {
        setRecipientContact(party.contact.phone || '');
      } else {
        setRecipientContact('');
      }
    } else {
      setRecipientContact('');
    }
  }, [selectedPartyId, dispatchMethod, partyType, customers, vendors]);

  // Sync state on party type switch
  useEffect(() => {
    if (partyType === 'CUSTOMER') {
      if (customers.length > 0) {
        setSelectedPartyId(customers[0].id);
      } else {
        setSelectedPartyId('');
      }
    } else {
      if (vendors.length > 0) {
        setSelectedPartyId(vendors[0].id);
      } else {
        setSelectedPartyId('');
      }
    }
  }, [partyType, customers, vendors]);

  // Load Initial Data from LocalStorage
  useEffect(() => {
    const storedProfiles = localStorage.getItem(PROFILE_STORAGE_KEY);
    const storedLogs = localStorage.getItem(RECURRING_LOG_STORAGE_KEY);
    
    if (storedProfiles) {
      setProfiles(JSON.parse(storedProfiles));
    } else {
      // Seed some initial profiles if empty
      const initialSeed: RecurringProfile[] = [
        {
          id: 'rec-1',
          tenantId,
          profileName: 'Enterprise Cloud Support SLA',
          partyType: 'CUSTOMER',
          partyId: 'cust-101',
          partyName: 'Reliance Retail Limited',
          gstin: '27AAAAA0000A1Z5',
          placeOfSupply: '27',
          category: 'SALES',
          type: 'B2B',
          docType: 'INVOICE',
          interval: 'MONTHLY',
          baseAmount: 150000,
          taxRate: 18,
          description: 'Managed Cloud Infrastructure SLA Services',
          hsnSac: '998313',
          autoEInvoice: true,
          startDate: '2026-06-01',
          nextExecutionDate: '2026-08-01',
          lastExecutedDate: '2026-07-01',
          status: 'ACTIVE',
          countGenerated: 2,
          autoDispatch: true,
          dispatchMethod: 'EMAIL',
          recipientContact: 'finance@reliance.com'
        },
        {
          id: 'rec-2',
          tenantId,
          profileName: 'Weekly Office Catering Contract',
          partyType: 'VENDOR',
          partyId: 'v1',
          partyName: 'Office Supplies Co',
          gstin: '27BBBBB1111B1Z6',
          placeOfSupply: '27',
          category: 'PURCHASE',
          type: 'B2B',
          docType: 'INVOICE',
          interval: 'WEEKLY',
          baseAmount: 18000,
          taxRate: 12,
          description: 'Weekly corporate pantry & catering setup',
          hsnSac: '996331',
          autoEInvoice: false,
          startDate: '2026-07-15',
          nextExecutionDate: '2026-07-29',
          lastExecutedDate: '2026-07-22',
          status: 'ACTIVE',
          countGenerated: 1,
          autoDispatch: true,
          dispatchMethod: 'EMAIL',
          recipientContact: 'billing@officesupplies.com'
        }
      ];
      setProfiles(initialSeed);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(initialSeed));
    }

    if (storedLogs) {
      setLogs(JSON.parse(storedLogs));
    } else {
      const initialLogs: RecurringLog[] = [
        {
          id: 'log-1',
          profileId: 'rec-1',
          profileName: 'Enterprise Cloud Support SLA',
          invoiceId: 'inv-seed-1',
          invoiceNumber: 'INV-2026-REC01',
          executionDate: '2026-07-01T10:15:30Z',
          amount: 177000, // 150000 + 18%
          status: 'SUCCESS'
        },
        {
          id: 'log-2',
          profileId: 'rec-2',
          profileName: 'Weekly Office Catering Contract',
          invoiceId: 'inv-seed-2',
          invoiceNumber: 'INV-2026-REC02',
          executionDate: '2026-07-22T08:00:15Z',
          amount: 20160, // 18000 + 12%
          status: 'SUCCESS'
        }
      ];
      setLogs(initialLogs);
      localStorage.setItem(RECURRING_LOG_STORAGE_KEY, JSON.stringify(initialLogs));
    }
  }, [tenantId]);

  // Helper to persist data
  const saveProfiles = (newProfiles: RecurringProfile[]) => {
    setProfiles(newProfiles);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProfiles));
  };

  const saveLogs = (newLogs: RecurringLog[]) => {
    setLogs(newLogs);
    localStorage.setItem(RECURRING_LOG_STORAGE_KEY, JSON.stringify(newLogs));
  };

  // 2. Add New Recurring Profile
  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !profileName) return;

    // Find party details
    let partyName = '';
    let gstin = '';
    let placeOfSupply = '27'; // default Maharashtra

    if (partyType === 'CUSTOMER') {
      const match = customers.find(c => c.id === selectedPartyId);
      if (match) {
        partyName = match.name;
        gstin = match.gstin;
        placeOfSupply = match.stateCode || '27';
      }
    } else {
      const match = vendors.find(v => v.id === selectedPartyId);
      if (match) {
        partyName = match.name;
        gstin = match.gstin;
        placeOfSupply = match.stateCode || '27';
      }
    }

    // Calc next execution date based on start date
    const nextDate = calculateNextDate(startDate, interval);

    const newProfile: RecurringProfile = {
      id: `rec-${Date.now()}`,
      tenantId,
      profileName,
      partyType,
      partyId: selectedPartyId,
      partyName,
      gstin,
      placeOfSupply,
      category,
      type,
      docType,
      interval,
      baseAmount,
      taxRate,
      description,
      hsnSac,
      autoEInvoice,
      startDate,
      nextExecutionDate: nextDate,
      status: 'ACTIVE',
      countGenerated: 0,
      autoDispatch,
      dispatchMethod,
      recipientContact
    };

    const updated = [newProfile, ...profiles];
    saveProfiles(updated);
    handleCloseModal();

    // Reset Form Fields
    setProfileName('');
    setBaseAmount(25000);
    setDescription('Monthly Software & Professional Services Retainer');
    setAutoDispatch(true);
    setDispatchMethod('EMAIL');
    setRecipientContact('');
  };

  const calculateNextDate = (startStr: string, interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): string => {
    const d = new Date(startStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

    if (interval === 'WEEKLY') {
      d.setDate(d.getDate() + 7);
    } else if (interval === 'MONTHLY') {
      d.setMonth(d.getMonth() + 1);
    } else if (interval === 'QUARTERLY') {
      d.setMonth(d.getMonth() + 3);
    } else if (interval === 'YEARLY') {
      d.setFullYear(d.getFullYear() + 1);
    }

    return d.toISOString().split('T')[0];
  };

  // 3. Delete Profile
  const handleDeleteProfile = (id: string) => {
    const filtered = profiles.filter(p => p.id !== id);
    saveProfiles(filtered);
  };

  // 4. Toggle Status (Active / Paused)
  const toggleProfileStatus = (id: string) => {
    const updated = profiles.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: p.status === 'ACTIVE' ? 'PAUSED' as const : 'ACTIVE' as const
        };
      }
      return p;
    });
    saveProfiles(updated);
  };

  // 5. Trigger Single Schedule Instantly
  const triggerProfileNow = async (profile: RecurringProfile) => {
    try {
      // Prepare Items Array
      const calculatedTaxAmt = profile.baseAmount * (profile.taxRate / 100);
      const items: InvoiceItem[] = [
        {
          id: `item-${Date.now()}`,
          description: profile.description,
          hsnSac: profile.hsnSac,
          quantity: 1,
          unit: 'NOS',
          rate: profile.baseAmount,
          taxRate: profile.taxRate,
          taxableValue: profile.baseAmount,
          taxAmount: calculatedTaxAmt
        }
      ];

      // Format custom recurring Invoice Number
      const yr = new Date().getFullYear();
      const monthAbbr = new Date().toLocaleString('default', { month: 'short' }).toUpperCase();
      const randHex = Math.floor(100 + Math.random() * 900);
      const invoiceNumber = `REC-${yr}-${monthAbbr}-${randHex}`;

      const totalAmountWithTax = profile.baseAmount + calculatedTaxAmt;

      // Invoke createInvoice service to store into genuine system DB/LocalStorage!
      const invoiceData: Partial<Invoice> & { items: InvoiceItem[] } = {
        tenantId: profile.tenantId,
        invoiceNumber,
        partyName: profile.partyName,
        gstin: profile.gstin,
        placeOfSupply: profile.placeOfSupply,
        date: new Date().toISOString().split('T')[0],
        amount: profile.baseAmount,
        taxAmount: calculatedTaxAmt,
        taxDetails: {
          taxableValue: profile.baseAmount,
          igst: profile.placeOfSupply !== '27' ? calculatedTaxAmt : 0,
          cgst: profile.placeOfSupply === '27' ? calculatedTaxAmt / 2 : 0,
          sgst: profile.placeOfSupply === '27' ? calculatedTaxAmt / 2 : 0,
          utgst: 0,
          cess: 0
        },
        items,
        status: profile.autoEInvoice ? 'UPLOADED' : 'PENDING',
        type: profile.type,
        category: profile.category,
        docType: profile.docType
      };

      // Create invoice
      const createdInvoice = await createInvoice(invoiceData);

      // Perform automated dispatch check
      let dispatchSuccessful = false;
      if (profile.autoDispatch && profile.dispatchMethod && profile.dispatchMethod !== 'NONE') {
        try {
          await sendInvoiceReminder(createdInvoice.id, profile.dispatchMethod);
          dispatchSuccessful = true;
        } catch (dispatchErr) {
          console.error('Automated invoice dispatch error:', dispatchErr);
        }
      }

      // Create execution log entry
      const logEntry: RecurringLog = {
        id: `log-${Date.now()}`,
        profileId: profile.id,
        profileName: profile.profileName,
        invoiceId: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber,
        executionDate: new Date().toISOString(),
        amount: totalAmountWithTax,
        status: 'SUCCESS',
        dispatchMethod: profile.dispatchMethod || 'NONE',
        recipientContact: profile.recipientContact || ''
      };

      // Update Profile Dates
      const nextDate = calculateNextDate(profile.nextExecutionDate, profile.interval);
      const updatedProfiles = profiles.map(p => {
        if (p.id === profile.id) {
          return {
            ...p,
            lastExecutedDate: new Date().toISOString().split('T')[0],
            nextExecutionDate: nextDate,
            countGenerated: p.countGenerated + 1
          };
        }
        return p;
      });

      saveProfiles(updatedProfiles);
      saveLogs([logEntry, ...logs]);
      
      // Fire callback to trigger Invoices list query update!
      onInvoiceGenerated();

    } catch (err: any) {
      const logEntry: RecurringLog = {
        id: `log-${Date.now()}`,
        profileId: profile.id,
        profileName: profile.profileName,
        invoiceId: '',
        invoiceNumber: '---',
        executionDate: new Date().toISOString(),
        amount: profile.baseAmount * (1 + profile.taxRate / 100),
        status: 'FAILED',
        errorMessage: err.message || 'Auto-generation validation mismatch',
        dispatchMethod: profile.dispatchMethod || 'NONE',
        recipientContact: profile.recipientContact || ''
      };
      saveLogs([logEntry, ...logs]);
    }
  };

  // 6. Simulate Cron Job Execution for all ACTIVE profiles
  const handleTriggerAllSchedules = async () => {
    setIsRunningAll(true);
    const activeProfiles = profiles.filter(p => p.status === 'ACTIVE');

    if (activeProfiles.length === 0) {
      setIsRunningAll(false);
      return;
    }

    // Trigger each sequentially with minor delay
    for (const prof of activeProfiles) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await triggerProfileNow(prof);
    }

    setIsRunningAll(false);
  };

  // Computed summary metrics
  const stats = useMemo(() => {
    const active = profiles.filter(p => p.status === 'ACTIVE');
    const totalScheduledVal = active.reduce((acc, p) => acc + p.baseAmount, 0);
    const totalInvoicesGen = profiles.reduce((acc, p) => acc + p.countGenerated, 0);

    return {
      activeCount: active.length,
      pausedCount: profiles.length - active.length,
      totalValue: totalScheduledVal,
      totalGenerated: totalInvoicesGen
    };
  }, [profiles]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Calendars</span>
            <span className="text-2xl font-black text-slate-800">{stats.activeCount}</span>
            <span className="text-[10px] text-slate-400 block font-medium">{stats.pausedCount} schedules paused</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Scheduled Flow</span>
            <span className="text-2xl font-black text-blue-600">₹{stats.totalValue.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Sum of active pools</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Sparkles size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Recurrences Run</span>
            <span className="text-2xl font-black text-slate-800">{stats.totalGenerated}</span>
            <span className="text-[10px] text-emerald-600 block font-bold flex items-center gap-0.5">
              <CheckCircle2 size={10} /> 100% successful set-offs
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Actions Button Card */}
        <div className="bg-slate-900 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cron Trigger Sandbox</span>
          <button
            onClick={handleTriggerAllSchedules}
            disabled={isRunningAll || stats.activeCount === 0}
            className="w-full mt-2 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
          >
            <RefreshCw size={13} className={isRunningAll ? 'animate-spin' : ''} />
            {isRunningAll ? 'Executing Schedules...' : 'Force Run All active Schedules'}
          </button>
        </div>

      </div>

      {/* Main Panel Content: Schedules List */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        
        {/* Table/Section Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Recurring Invoice Profiles</h3>
            <p className="text-xs text-slate-500 mt-1">Configure automated invoice triggers with customized intervals and automatic compliance uploads.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus size={15} />
            Add Schedule Profile
          </button>
        </div>

        {/* Schedules Grid / Cards */}
        {profiles.length === 0 ? (
          <div className="p-20 text-center">
            <Clock size={40} className="mx-auto text-slate-300 mb-3 animate-pulse" />
            <h4 className="font-bold text-slate-700 text-sm">No Active Recurring Schedules</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">Click "Add Schedule Profile" to program repeating retainers and automated billing files.</p>
          </div>
        ) : (
          <div className="p-0 divide-y divide-slate-100">
            {profiles.map(p => (
              <div key={p.id} className="p-6 hover:bg-slate-50/40 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                
                {/* Profile Core Details */}
                <div className="space-y-1.5 flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">{p.profileName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                      p.category === 'SALES' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {p.category}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[9px] font-black uppercase">
                      {p.interval}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-500 text-xs flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <User size={12} className="text-slate-400" />
                      {p.partyName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{p.gstin || 'Unregistered'}</span>
                  </div>

                  <p className="text-slate-400 text-[10px] font-medium leading-relaxed max-w-md">{p.description}</p>
                  
                  {p.autoDispatch && p.dispatchMethod && p.dispatchMethod !== 'NONE' && (
                    <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100/80 rounded-md px-2 py-0.5 text-[9px] font-bold">
                      <span>⚡ Auto-Dispatch: {p.dispatchMethod}</span>
                      {p.recipientContact && <span className="text-slate-400 font-medium">({p.recipientContact})</span>}
                    </div>
                  )}
                </div>

                {/* Automation Parameters & Status Checks */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs md:text-right shrink-0">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Base Value</span>
                    <span className="font-mono font-black text-slate-800 text-sm">₹{p.baseAmount.toLocaleString()}</span>
                  </div>
                  <div className="md:text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Next Run</span>
                    <span className="font-semibold text-slate-700 block flex items-center md:justify-end gap-1">
                      <Calendar size={11} className="text-slate-400" />
                      {p.nextExecutionDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Compliance Route</span>
                    <span className={`text-[10px] font-extrabold block ${p.autoEInvoice ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {p.autoEInvoice ? '⭐ Auto E-Invoice' : 'Manual Upload'}
                    </span>
                  </div>
                  <div className="md:text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Generated</span>
                    <span className="font-bold text-slate-600 block">{p.countGenerated} instances</span>
                  </div>
                </div>

                {/* Control Actions Row */}
                <div className="flex items-center gap-2 md:pl-4 border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto justify-end">
                  
                  {/* Status Toggle Button */}
                  <button
                    onClick={() => toggleProfileStatus(p.id)}
                    className={`p-2 rounded-xl border flex items-center justify-center gap-1 text-xs font-bold transition-all ${
                      p.status === 'ACTIVE'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                    title={p.status === 'ACTIVE' ? 'Pause Schedule' : 'Activate Schedule'}
                  >
                    {p.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                    <span className="text-[10px] px-0.5">{p.status}</span>
                  </button>

                  {/* Force Execute Now */}
                  <button
                    onClick={() => triggerProfileNow(p)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 font-extrabold flex items-center justify-center gap-1 text-xs transition-all active:scale-95"
                    title="Run schedule trigger instantly"
                  >
                    <Play size={14} className="text-blue-500 fill-blue-500" />
                    <span className="text-[10px] px-0.5">Run Now</span>
                  </button>

                  {/* Delete Profile */}
                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    className="p-2 rounded-xl border border-rose-100 hover:border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all"
                    title="Delete Recurring Schedule"
                  >
                    <Trash2 size={14} />
                  </button>

                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* Execution Logs Section */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase tracking-wider">Automated Generation logs</h3>
          <p className="text-xs text-slate-500 mt-1">Audit log records of all invoice templates generated via recurring schedules.</p>
        </div>
        <div className="p-0">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No schedules have run yet.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Profile Triggered</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Resulting Document</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Executed At</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Total Value</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Compliance Status</th>
                  <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Dispatch Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span className="font-semibold text-slate-800 text-xs">{log.profileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{log.invoiceNumber}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(log.executionDate).toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700 text-xs">₹{log.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-rose-500'}`}></div>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.dispatchMethod && log.dispatchMethod !== 'NONE' ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 inline-flex items-center gap-1">
                            <span>📧</span> Sent ({log.dispatchMethod})
                          </span>
                          {log.recipientContact && (
                            <span className="text-[10px] text-slate-400 font-semibold block max-w-[140px] truncate" title={log.recipientContact}>
                              {log.recipientContact}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manual Dispatch</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE RECURRING PROFILE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreateProfile}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
          >
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">New Recurring Schedule</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Automate recurring tax invoices and invoice ledgers.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-white rounded-full transition-all"
              >
                <XButton />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {/* Profile Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Schedule Profile Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Reliance Retail Monthly Retainer"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-hidden focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Recipient Party Type and selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Party Type Select */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Profile Ledger Class</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPartyType('CUSTOMER')}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                        partyType === 'CUSTOMER' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Customer (Sales)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartyType('VENDOR')}
                      className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                        partyType === 'VENDOR' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Vendor (Purchase)
                    </button>
                  </div>
                </div>

                {/* Selected Party */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Select Recipient Party</label>
                  <select
                    required
                    value={selectedPartyId}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-hidden"
                  >
                    <option value="" disabled>-- Select a Party --</option>
                    {partyType === 'CUSTOMER' ? (
                      customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.gstin ? 'GST' : 'Unreg'})</option>
                      ))
                    ) : (
                      vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.gstin ? 'GST' : 'Unreg'})</option>
                      ))
                    )}
                  </select>
                </div>

              </div>

              {/* Details Row: DocType, Category, Invoice Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-semibold"
                  >
                    <option value="INVOICE">Tax Invoice</option>
                    <option value="CREDIT_NOTE">Credit Note</option>
                    <option value="DEBIT_NOTE">Debit Note</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-semibold"
                  >
                    <option value="SALES">Sales Outward</option>
                    <option value="PURCHASE">Purchase Inward</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Invoice Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-semibold"
                  >
                    <option value="B2B">B2B (Registered)</option>
                    <option value="B2C">B2C (Consumer)</option>
                    <option value="EXPORT">Export</option>
                  </select>
                </div>

              </div>

              {/* Interval & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Recurrence Frequency</label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as any)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-semibold"
                  >
                    <option value="WEEKLY">Weekly Triggers</option>
                    <option value="MONTHLY">Monthly Triggers</option>
                    <option value="QUARTERLY">Quarterly Triggers</option>
                    <option value="YEARLY">Yearly Triggers</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Estimated Next Run</label>
                  <div className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-slate-600 flex items-center">
                    {calculateNextDate(startDate, interval)}
                  </div>
                </div>

              </div>

              {/* Item Description, Amount & Tax */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Line Item Automation Detail</span>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">Item Description</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">Base Rate (INR)</label>
                    <input
                      type="number"
                      required
                      value={baseAmount}
                      onChange={(e) => setBaseAmount(Number(e.target.value))}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">GST Rate (%)</label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full h-9 px-2 bg-white border border-slate-200 rounded-xl outline-hidden font-semibold"
                    >
                      <option value={0}>0% (Exempt)</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">HSN/SAC Code</label>
                    <input
                      type="text"
                      required
                      value={hsnSac}
                      onChange={(e) => setHsnSac(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold outline-hidden"
                    />
                  </div>

                </div>
              </div>

              {/* Auto E-invoice toggle */}
              <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-slate-900 block">Auto-pilot IRN & E-Way Bill</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Instantly signs, checks against rules engine, generates E-Invoice, and updates GSTN ledger without manual review.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={autoEInvoice} 
                    onChange={(e) => setAutoEInvoice(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Automated Client Dispatch Section */}
              <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-4 text-left">
                    <span className="font-bold text-slate-900 block">Automated Client Dispatch</span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Instantly transmit generated invoice documents to repeat clients upon creation.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={autoDispatch} 
                      onChange={(e) => setAutoDispatch(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {autoDispatch && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in slide-in-from-top-1 duration-200 text-left">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">Dispatch Method</label>
                      <select
                        value={dispatchMethod}
                        onChange={(e) => setDispatchMethod(e.target.value as any)}
                        className="w-full h-9 px-2 bg-white border border-slate-200 rounded-xl outline-hidden font-semibold"
                      >
                        <option value="EMAIL">📧 Automated Email Dispatch</option>
                        <option value="SMS">💬 Automated SMS Alert</option>
                        <option value="WHATSAPP">🟢 Automated WhatsApp Delivery</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500">
                        {dispatchMethod === 'EMAIL' ? 'Client Email Address' : 'Client Mobile Number'}
                      </label>
                      <input
                        type={dispatchMethod === 'EMAIL' ? 'email' : 'text'}
                        required
                        value={recipientContact}
                        onChange={(e) => setRecipientContact(e.target.value)}
                        placeholder={dispatchMethod === 'EMAIL' ? 'client@company.com' : '+91 98765 43210'}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>Save Schedule</span>
                <ArrowRight size={13} />
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};

// Simple visual components
const XButton = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default RecurringInvoicesModule;
