import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Globe, MapPin, Calendar, FileText, UserCheck, Shield, 
  Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Save, Key, Lock, 
  ExternalLink, Layers, RefreshCw, Check, Sparkles, Building, Briefcase, 
  Clock, ShieldAlert, Award, FileCheck, DollarSign, Settings, Users,
  Activity, Eye, Radio, Zap, ChevronRight, X, Database
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { setGstinsForTenant, setBranchesForTenant } from '../../store/store';
import { NeonMultiTenantDatabaseCenter } from './NeonMultiTenantDatabaseCenter';
import { 
  CompanyRegistrationProfile, 
  GstinRegistrationItem, 
  BranchDetailsItem, 
  FinancialYearConfigItem, 
  StateConfigItem, 
  BusinessProfileDetailsItem, 
  AuthorizedSignatoryItem 
} from '../../types';

interface OrganizationModuleProps {
  currentTenantId?: string;
  onTenantSwitch?: (tenantId: string) => void;
}

interface Collaborator {
  socketId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    role: string;
    avatar?: string;
    color?: string;
  };
  subTab: string;
  editingSection?: string;
}

interface ActivityLogItem {
  id: string;
  user: string;
  action: string;
  section: string;
  timestamp: string;
  details?: string;
}

const PRESET_PERSONAS = [
  { id: 'usr-1', name: 'Dr. Vikram Malhotra', role: 'CFO / Primary Signatory', color: 'bg-indigo-600', avatar: 'VM' },
  { id: 'usr-2', name: 'Anita Desai', role: 'Head of Tax & Compliance', color: 'bg-emerald-600', avatar: 'AD' },
  { id: 'usr-3', name: 'Priya Verma', role: 'Delhi Regional Lead', color: 'bg-amber-600', avatar: 'PV' },
  { id: 'usr-4', name: 'Arun Kumar', role: 'Bengaluru Tech Center SEZ Lead', color: 'bg-sky-600', avatar: 'AK' },
];

export const OrganizationModule: React.FC<OrganizationModuleProps> = ({
  currentTenantId = 't1',
  onTenantSwitch
}) => {
  const dispatch = useDispatch();
  const [activeSubTab, setActiveSubTab] = useState<
    'COMPANY' | 'GSTIN' | 'BRANCHES' | 'FY_SETTINGS' | 'STATE_CONFIG' | 'BUSINESS_PROFILE' | 'SIGNATORIES' | 'NEON_DATASETS'
  >('COMPANY');

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: 'info' | 'success' | 'remote' } | null>(null);

  const triggerToast = (text: string, type: 'info' | 'success' | 'remote' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // --- REALTIME SOCKET & COLLABORATION STATE ---
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUser, setActiveUser] = useState(PRESET_PERSONAS[0]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [remoteEditing, setRemoteEditing] = useState<{ user: any; section: string } | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: 'act-1',
      user: 'System Admin',
      action: 'Organization Workspace Initialized',
      section: 'COMPANY',
      timestamp: new Date().toISOString(),
      details: 'Real-time multi-entity synchronization active'
    }
  ]);

  // --- 1. COMPANY REGISTRATION STATE ---
  const [companyProfile, setCompanyProfile] = useState<CompanyRegistrationProfile>({
    id: currentTenantId,
    legalName: 'Acme Technologies Private Limited',
    tradeName: 'Acme Tech Solutions',
    entityType: 'PRIVATE_LIMITED',
    cinLLPin: 'U72200MH2018PTC312456',
    dateOfIncorporation: '2018-04-12',
    pan: 'AAAAA0000A',
    tan: 'MUMB00000A',
    registeredAddress: '101, Business Park, MIDC Andheri East, Mumbai, Maharashtra 400093',
    corporateAddress: 'Floor 5, Tech Tower, BKC, Mumbai, Maharashtra 400051',
    contactEmail: 'tax.compliance@acmetech.com',
    contactPhone: '+91 98765 43210',
    website: 'https://acmetech.com',
    logoUrl: ''
  });

  // --- 2. GSTIN MANAGEMENT STATE ---
  const [gstinList, setGstinList] = useState<GstinRegistrationItem[]>([
    {
      id: 'g1',
      gstin: '27AAAAA0000A1Z5',
      stateCode: '27',
      stateName: 'Maharashtra',
      registrationType: 'REGULAR',
      registrationDate: '2018-07-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g2',
      gstin: '07AAAAA0000A1Z2',
      stateCode: '07',
      stateName: 'Delhi',
      registrationType: 'REGULAR',
      registrationDate: '2019-10-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g3',
      gstin: '29AAAAA0000A1Z9',
      stateCode: '29',
      stateName: 'Karnataka',
      registrationType: 'SEZ_UNIT',
      registrationDate: '2021-03-20',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ]);

  const [showAddGstinModal, setShowAddGstinModal] = useState(false);
  const [newGstinForm, setNewGstinForm] = useState({
    gstin: '',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    registrationType: 'REGULAR',
    filingFrequency: 'MONTHLY'
  });

  // --- 3. BRANCH MANAGEMENT STATE ---
  const [branches, setBranches] = useState<BranchDetailsItem[]>([
    {
      id: 'b1',
      name: 'Mumbai HQ Office',
      code: 'MH-HQ-01',
      type: 'HEAD_OFFICE',
      address: '101 MIDC Andheri East, Mumbai, MH',
      stateCode: '27',
      stateName: 'Maharashtra',
      gstin: '27AAAAA0000A1Z5',
      contactPerson: 'Rajesh Sharma',
      contactEmail: 'rajesh.sharma@acmetech.com',
      contactPhone: '+91 98200 11223',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 55
    },
    {
      id: 'b2',
      name: 'Delhi Regional Hub',
      code: 'DL-RO-02',
      type: 'REGIONAL_OFFICE',
      address: 'Connaught Place, New Delhi, DL',
      stateCode: '07',
      stateName: 'Delhi',
      gstin: '07AAAAA0000A1Z2',
      contactPerson: 'Priya Verma',
      contactEmail: 'priya.verma@acmetech.com',
      contactPhone: '+91 98110 44556',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 25
    },
    {
      id: 'b3',
      name: 'Bengaluru Tech Center (SEZ)',
      code: 'KA-SEZ-03',
      type: 'SEZ_UNIT',
      address: 'Electronic City Phase 1, Bengaluru, KA',
      stateCode: '29',
      stateName: 'Karnataka',
      gstin: '29AAAAA0000A1Z9',
      contactPerson: 'Arun Kumar',
      contactEmail: 'arun.kumar@acmetech.com',
      contactPhone: '+91 98450 77889',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 20
    }
  ]);

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    type: 'WAREHOUSE' as any,
    address: '',
    stateCode: '27',
    contactPerson: '',
    contactEmail: '',
    contactPhone: ''
  });

  // --- 4. FINANCIAL YEAR SETTINGS STATE ---
  const [fyConfig, setFyConfig] = useState<FinancialYearConfigItem>({
    activeFY: '2026-27',
    periodLockDate: '2026-06-30',
    taxMethod: 'ACCRUAL',
    defaultCurrency: 'INR (₹)',
    returnFilingCycle: 'MONTHLY',
    booksBeginDate: '2026-04-01',
    autoLockFiledPeriods: true
  });

  // --- 5. STATE-WISE CONFIGURATION STATE ---
  const [selectedStateCode, setSelectedStateCode] = useState('27');
  const [stateConfigs, setStateConfigs] = useState<Record<string, StateConfigItem>>({
    '27': {
      stateCode: '27',
      stateName: 'Maharashtra',
      jurisdictionWard: 'Ward 202 - Andheri East',
      jurisdictionCircle: 'Circle 12, Division IV',
      commissionerate: 'Mumbai East Central GST Commissionerate',
      intraStateEwayThreshold: 100000,
      interStateEwayThreshold: 50000,
      posRulesNote: 'Intra-state supply when location of supplier & place of supply are both in Maharashtra (CGST+SGST).'
    },
    '07': {
      stateCode: '07',
      stateName: 'Delhi',
      jurisdictionWard: 'Ward 64 - Central Delhi',
      jurisdictionCircle: 'Circle 08, Connaught Place',
      commissionerate: 'Delhi North GST Commissionerate',
      intraStateEwayThreshold: 100000,
      interStateEwayThreshold: 50000,
      posRulesNote: 'Intra-state supply when location of supplier & POS are in Delhi UT.'
    },
    '29': {
      stateCode: '29',
      stateName: 'Karnataka',
      jurisdictionWard: 'Ward 10 - Bengaluru South',
      jurisdictionCircle: 'Circle 03, Koramangala',
      commissionerate: 'Bengaluru East GST Commissionerate',
      intraStateEwayThreshold: 50000,
      interStateEwayThreshold: 50000,
      posRulesNote: 'SEZ Zero-Rated supply rules apply for exports & SEZ developers in Bengaluru.'
    }
  });

  // --- 6. BUSINESS PROFILE & HSN STATE ---
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileDetailsItem>({
    turnoverBracket: '5 CR - 20 CR',
    natureOfBusiness: ['MANUFACTURING', 'SERVICES'],
    primaryHsnSacCodes: ['998311 (IT Software Services)', '847130 (Computers)', '998313 (Consulting)'],
    iecCode: '0318045921',
    sezStatus: true,
    eInvoicingApplicable: true
  });
  const [newHsnInput, setNewHsnInput] = useState('');

  // --- 7. AUTHORIZED SIGNATORIES STATE ---
  const [signatories, setSignatories] = useState<AuthorizedSignatoryItem[]>([
    {
      id: 's1',
      name: 'Dr. Vikram Malhotra',
      designation: 'Chief Financial Officer (CFO)',
      pan: 'AAAAA1111B',
      dinDpin: '08123456',
      mobile: '+91 98210 99887',
      email: 'vikram.m@acmetech.com',
      isPrimary: true,
      dscStatus: 'ACTIVE',
      dscExpiryDate: '2027-03-31',
      evcStatus: 'ACTIVE'
    },
    {
      id: 's2',
      name: 'Anita Desai',
      designation: 'Head of Tax & Regulatory Affairs',
      pan: 'BBBBB2222C',
      dinDpin: '09876543',
      mobile: '+91 98200 44332',
      email: 'anita.desai@acmetech.com',
      isPrimary: false,
      dscStatus: 'ACTIVE',
      dscExpiryDate: '2026-11-15',
      evcStatus: 'ACTIVE'
    }
  ]);

  const [showAddSignatoryModal, setShowAddSignatoryModal] = useState(false);
  const [newSignatoryForm, setNewSignatoryForm] = useState({
    name: '',
    designation: 'Tax Manager',
    pan: '',
    dinDpin: '',
    mobile: '',
    email: '',
    isPrimary: false
  });

  // State Name Mapper
  const stateNames: Record<string, string> = {
    '27': 'Maharashtra',
    '07': 'Delhi',
    '29': 'Karnataka',
    '33': 'Tamil Nadu',
    '09': 'Uttar Pradesh',
    '19': 'West Bengal',
    '24': 'Gujarat',
    '36': 'Telangana'
  };

  // --- REAL-TIME WEBSOCKET INITIALIZATION & LISTENERS ---
  useEffect(() => {
    // Connect to websocket server
    const socket = io({
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-org-room', {
        tenantId: currentTenantId,
        user: activeUser,
        subTab: activeSubTab
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receive server initial authoritative state
    socket.on('org-init-state', (serverState: any) => {
      if (serverState) {
        if (serverState.companyProfile) setCompanyProfile(serverState.companyProfile);
        if (serverState.gstinList) setGstinList(serverState.gstinList);
        if (serverState.branches) setBranches(serverState.branches);
        if (serverState.fyConfig) setFyConfig(serverState.fyConfig);
        if (serverState.stateConfigs) setStateConfigs(serverState.stateConfigs);
        if (serverState.businessProfile) setBusinessProfile(serverState.businessProfile);
        if (serverState.signatories) setSignatories(serverState.signatories);
        if (serverState.activityLogs) setActivityLogs(serverState.activityLogs);
      }
    });

    // Receive live presence updates
    socket.on('org-presence-update', (users: Collaborator[]) => {
      setCollaborators(users);
    });

    // Receive remote editing status
    socket.on('org-remote-editing', (data: { user: any; section: string; isEditing: boolean }) => {
      if (data.isEditing) {
        setRemoteEditing({ user: data.user, section: data.section });
      } else {
        setRemoteEditing(null);
      }
    });

    // Receive live state updates broadcasted from co-workers
    socket.on('org-remote-update', (data: { section: string; payload: any; activityLog: ActivityLogItem; user: any }) => {
      const { section, payload, activityLog, user } = data;

      if (section === 'companyProfile') setCompanyProfile(payload);
      else if (section === 'gstinList') setGstinList(payload);
      else if (section === 'branches') setBranches(payload);
      else if (section === 'fyConfig') setFyConfig(payload);
      else if (section === 'stateConfigs') setStateConfigs(payload);
      else if (section === 'businessProfile') setBusinessProfile(payload);
      else if (section === 'signatories') setSignatories(payload);

      if (activityLog) {
        setActivityLogs(prev => [activityLog, ...prev.filter(l => l.id !== activityLog.id)].slice(0, 50));
      }

      triggerToast(`⚡ ${user?.name || 'Teammate'} updated ${section} in real time!`, 'remote');
    });

    return () => {
      socket.disconnect();
    };
  }, [currentTenantId]);

  // Handle identity / persona changes
  const handlePersonaSwitch = (persona: typeof PRESET_PERSONAS[0]) => {
    setActiveUser(persona);
    triggerToast(`Switched active user identity to ${persona.name} (${persona.role})`, 'info');
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join-org-room', {
        tenantId: currentTenantId,
        user: persona,
        subTab: activeSubTab
      });
    }
  };

  // Handle sub-tab change with real-time socket sync
  const handleTabChange = (tab: typeof activeSubTab) => {
    setActiveSubTab(tab);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('org-change-tab', {
        tenantId: currentTenantId,
        subTab: tab
      });
    }
  };

  // Core Sync Helper Function: Broadcasts state change over WebSocket & saves to HTTP endpoint
  const syncSection = (sectionKey: string, payload: any, actionText: string) => {
    // 1. WebSocket Broadcast
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('org-update-section', {
        tenantId: currentTenantId,
        section: sectionKey,
        payload,
        actionText,
        user: activeUser
      });
    }

    // 2. HTTP Endpoint Backup Persist
    fetch(`/api/organization/${currentTenantId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: sectionKey,
        payload,
        actionText,
        user: activeUser
      })
    }).catch(err => console.error("HTTP Sync Backup Error:", err));

    triggerToast(`${actionText} (Synced live)`, 'success');
  };

  // --- REAL-TIME FORM SUBMISSION HANDLERS ---
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    syncSection('companyProfile', companyProfile, 'Updated Company Legal Profile');
  };

  const handleAddGstin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGstinForm.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters.');
      return;
    }
    const newItem: GstinRegistrationItem = {
      id: 'g' + Date.now(),
      gstin: newGstinForm.gstin.toUpperCase(),
      stateCode: newGstinForm.stateCode,
      stateName: stateNames[newGstinForm.stateCode] || 'State ' + newGstinForm.stateCode,
      registrationType: newGstinForm.registrationType as any,
      registrationDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      filingFrequency: newGstinForm.filingFrequency as any,
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    };
    const updatedList = [...gstinList, newItem];
    setGstinList(updatedList);
    dispatch(setGstinsForTenant({ tenantId: currentTenantId, gstins: updatedList }));
    setShowAddGstinModal(false);
    syncSection('gstinList', updatedList, `Registered GSTIN ${newItem.gstin} (${newItem.stateName})`);
  };

  const handleSetPrimaryGstin = (gstinId: string) => {
    const updatedList = gstinList.map(g => ({ ...g, isPrimary: g.id === gstinId }));
    setGstinList(updatedList);
    dispatch(setGstinsForTenant({ tenantId: currentTenantId, gstins: updatedList }));
    const target = gstinList.find(g => g.id === gstinId);
    syncSection('gstinList', updatedList, `Set primary HQ GSTIN to ${target?.gstin}`);
  };

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchForm.name.trim()) return;
    const associatedGstin = gstinList.find(g => g.stateCode === newBranchForm.stateCode)?.gstin || companyProfile.pan;
    const newB: BranchDetailsItem = {
      id: 'b' + Date.now(),
      name: newBranchForm.name,
      code: newBranchForm.code || 'BR-' + Math.floor(Math.random() * 100),
      type: newBranchForm.type,
      address: newBranchForm.address,
      stateCode: newBranchForm.stateCode,
      stateName: stateNames[newBranchForm.stateCode] || 'State ' + newBranchForm.stateCode,
      gstin: associatedGstin,
      contactPerson: newBranchForm.contactPerson,
      contactEmail: newBranchForm.contactEmail,
      contactPhone: newBranchForm.contactPhone,
      status: 'ACTIVE',
      annualTurnoverContributionPct: 10
    };
    const updatedBranches = [...branches, newB];
    setBranches(updatedBranches);
    dispatch(setBranchesForTenant({ tenantId: currentTenantId, branches: updatedBranches }));
    setShowAddBranchModal(false);
    syncSection('branches', updatedBranches, `Added branch "${newB.name}" in ${newB.stateName}`);
  };

  const handleDeleteBranch = (branchId: string, branchName: string) => {
    const updatedBranches = branches.filter(b => b.id !== branchId);
    setBranches(updatedBranches);
    dispatch(setBranchesForTenant({ tenantId: currentTenantId, branches: updatedBranches }));
    syncSection('branches', updatedBranches, `Removed branch "${branchName}"`);
  };

  const handleSaveFyConfig = () => {
    syncSection('fyConfig', fyConfig, `Updated FY & Accounting Lock Date (${fyConfig.periodLockDate})`);
  };

  const handleSaveStateConfig = () => {
    const updatedConfigs = {
      ...stateConfigs,
      [selectedStateCode]: stateConfigs[selectedStateCode]
    };
    setStateConfigs(updatedConfigs);
    syncSection('stateConfigs', updatedConfigs, `Updated Tax Rules for State Code ${selectedStateCode}`);
  };

  const handleSaveBusinessProfile = () => {
    syncSection('businessProfile', businessProfile, 'Updated Business Profile & Turnover Classification');
  };

  const handleAddHsn = () => {
    if (!newHsnInput.trim()) return;
    const updatedCodes = [...businessProfile.primaryHsnSacCodes, newHsnInput.trim()];
    const updatedProfile = { ...businessProfile, primaryHsnSacCodes: updatedCodes };
    setBusinessProfile(updatedProfile);
    setNewHsnInput('');
    syncSection('businessProfile', updatedProfile, `Added HSN/SAC code ${newHsnInput}`);
  };

  const handleRemoveHsn = (idx: number) => {
    const removed = businessProfile.primaryHsnSacCodes[idx];
    const updatedCodes = businessProfile.primaryHsnSacCodes.filter((_, i) => i !== idx);
    const updatedProfile = { ...businessProfile, primaryHsnSacCodes: updatedCodes };
    setBusinessProfile(updatedProfile);
    syncSection('businessProfile', updatedProfile, `Removed HSN/SAC code ${removed}`);
  };

  const handleAddSignatory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSignatoryForm.name.trim()) return;
    const newS: AuthorizedSignatoryItem = {
      id: 's' + Date.now(),
      name: newSignatoryForm.name,
      designation: newSignatoryForm.designation,
      pan: newSignatoryForm.pan.toUpperCase(),
      dinDpin: newSignatoryForm.dinDpin,
      mobile: newSignatoryForm.mobile,
      email: newSignatoryForm.email,
      isPrimary: newSignatoryForm.isPrimary,
      dscStatus: 'ACTIVE',
      dscExpiryDate: '2028-06-30',
      evcStatus: 'ACTIVE'
    };
    let updatedSignatories = [];
    if (newSignatoryForm.isPrimary) {
      updatedSignatories = signatories.map(s => ({ ...s, isPrimary: false })).concat(newS);
    } else {
      updatedSignatories = [...signatories, newS];
    }
    setSignatories(updatedSignatories);
    setShowAddSignatoryModal(false);
    syncSection('signatories', updatedSignatories, `Added Authorized Signatory "${newS.name}"`);
  };

  const handleSetPrimarySignatory = (sigId: string) => {
    const updated = signatories.map(s => ({ ...s, isPrimary: s.id === sigId }));
    setSignatories(updated);
    const target = signatories.find(s => s.id === sigId);
    syncSection('signatories', updated, `Set "${target?.name}" as primary authorized signatory`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border animate-in slide-in-from-top duration-300 ${
          toastMsg.type === 'remote' ? 'bg-indigo-900 border-indigo-500' : 'bg-slate-900 border-slate-700'
        }`}>
          {toastMsg.type === 'remote' ? (
            <Zap size={18} className="text-amber-400 shrink-0 animate-pulse" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{toastMsg.text}</span>
        </div>
      )}

      {/* SIMPLE ELEGANT PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-slate-800" size={22} />
            Organization & Multi-Entity Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure statutory company info, multi-state GST registrations, branch networks, and accounting rules
          </p>
        </div>
      </div>

      {/* SUB-MODULE NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'COMPANY', label: 'Company Profile', icon: Building, color: 'text-indigo-600' },
          { id: 'GSTIN', label: 'GSTIN Registrations', icon: FileCheck, color: 'text-emerald-600', count: gstinList.length },
          { id: 'BRANCHES', label: 'Branch Network', icon: MapPin, color: 'text-amber-600', count: branches.length },
          { id: 'FY_SETTINGS', label: 'FY & Lock Date', icon: Calendar, color: 'text-sky-600' },
          { id: 'STATE_CONFIG', label: 'State Rules', icon: Settings, color: 'text-purple-600' },
          { id: 'BUSINESS_PROFILE', label: 'Business Profile', icon: Briefcase, color: 'text-rose-600' },
          { id: 'SIGNATORIES', label: 'Signatories & DSC', icon: UserCheck, color: 'text-teal-600', count: signatories.length },
          { id: 'NEON_DATASETS', label: 'Postgres Neon Multi-Tenant', icon: Database, color: 'text-blue-600' }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap relative ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : tab.color} />
              {tab.label}

              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-MODULE 1: COMPANY REGISTRATION PROFILE */}
      {activeSubTab === 'COMPANY' && (
        <form onSubmit={handleSaveCompany} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Building className="text-indigo-600" size={20} /> Statutory Company Information
              </h3>
              <p className="text-xs text-slate-500">Corporate identity, Legal Name, Trade Name, CIN, and PAN/TAN numbers</p>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Save size={16} /> Broadcast & Save Company Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Legal Company Name *</label>
              <input
                type="text"
                required
                value={companyProfile.legalName}
                onChange={e => setCompanyProfile({ ...companyProfile, legalName: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Trade Name (Brand Name) *</label>
              <input
                type="text"
                required
                value={companyProfile.tradeName}
                onChange={e => setCompanyProfile({ ...companyProfile, tradeName: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Entity Type Structure *</label>
              <select
                value={companyProfile.entityType}
                onChange={e => setCompanyProfile({ ...companyProfile, entityType: e.target.value as any })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="PRIVATE_LIMITED">Private Limited Company</option>
                <option value="PUBLIC_LIMITED">Public Limited Company</option>
                <option value="LLP">Limited Liability Partnership (LLP)</option>
                <option value="PROPRIETORSHIP">Sole Proprietorship</option>
                <option value="PARTNERSHIP">Partnership Firm</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">PAN (Permanent Account Number) *</label>
              <input
                type="text"
                required
                maxLength={10}
                value={companyProfile.pan}
                onChange={e => setCompanyProfile({ ...companyProfile, pan: e.target.value.toUpperCase() })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">TAN (Tax Deduction Account No) *</label>
              <input
                type="text"
                required
                maxLength={10}
                value={companyProfile.tan}
                onChange={e => setCompanyProfile({ ...companyProfile, tan: e.target.value.toUpperCase() })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">CIN / LLPIN Identifier</label>
              <input
                type="text"
                value={companyProfile.cinLLPin}
                onChange={e => setCompanyProfile({ ...companyProfile, cinLLPin: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Registered Office Address *</label>
              <textarea
                rows={3}
                required
                value={companyProfile.registeredAddress}
                onChange={e => setCompanyProfile({ ...companyProfile, registeredAddress: e.target.value })}
                className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Corporate Office Address</label>
              <textarea
                rows={3}
                value={companyProfile.corporateAddress}
                onChange={e => setCompanyProfile({ ...companyProfile, corporateAddress: e.target.value })}
                className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Official Compliance Email *</label>
              <input
                type="email"
                required
                value={companyProfile.contactEmail}
                onChange={e => setCompanyProfile({ ...companyProfile, contactEmail: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Contact Phone Number *</label>
              <input
                type="text"
                required
                value={companyProfile.contactPhone}
                onChange={e => setCompanyProfile({ ...companyProfile, contactPhone: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Company Website</label>
              <input
                type="url"
                value={companyProfile.website}
                onChange={e => setCompanyProfile({ ...companyProfile, website: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </form>
      )}

      {/* SUB-MODULE 2: GSTIN MANAGEMENT */}
      {activeSubTab === 'GSTIN' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="text-emerald-600" size={20} /> GST Registrations & Multi-State Directory
              </h3>
              <p className="text-xs text-slate-500">Manage state-wise GSTIN numbers, filing frequencies, and primary HQ flags</p>
            </div>

            <button
              onClick={() => setShowAddGstinModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus size={16} /> Register New GSTIN
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {gstinList.map((g) => (
              <div
                key={g.id}
                className={`p-5 rounded-2xl border transition-all ${
                  g.isPrimary
                    ? 'bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200 shadow-md ring-1 ring-emerald-400/30'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                      State Code {g.stateCode} ({g.stateName})
                    </span>
                    <h4 className="text-base font-mono font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                      {g.gstin}
                      {g.isPrimary && (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-full">
                          Primary HQ
                        </span>
                      )}
                    </h4>
                  </div>

                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    {g.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Registration Type:</span>
                    <strong className="text-slate-800">{g.registrationType}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Filing Cycle:</span>
                    <strong className="text-slate-800">{g.filingFrequency}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>E-Invoicing:</span>
                    <strong className="text-emerald-700">{g.einvoicingStatus}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>E-Way Bill:</span>
                    <strong className="text-emerald-700">{g.ewaybillStatus}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {!g.isPrimary && (
                    <button
                      onClick={() => handleSetPrimaryGstin(g.id)}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Set as Primary HQ
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono ml-auto">
                    Reg Date: {g.registrationDate}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add GSTIN Modal */}
          {showAddGstinModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="text-emerald-600" size={18} /> Add State GSTIN Registration
                  </h3>
                  <button onClick={() => setShowAddGstinModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleAddGstin} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">15-Digit GSTIN Number *</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      placeholder="33AAAAA0000A1Z5"
                      value={newGstinForm.gstin}
                      onChange={e => setNewGstinForm({ ...newGstinForm, gstin: e.target.value.toUpperCase() })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-mono uppercase font-bold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">State Code</label>
                      <select
                        value={newGstinForm.stateCode}
                        onChange={e => setNewGstinForm({ ...newGstinForm, stateCode: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-bold outline-none"
                      >
                        {Object.entries(stateNames).map(([code, name]) => (
                          <option key={code} value={code}>{code} - {name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700">Registration Type</label>
                      <select
                        value={newGstinForm.registrationType}
                        onChange={e => setNewGstinForm({ ...newGstinForm, registrationType: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                      >
                        <option value="REGULAR">Regular</option>
                        <option value="SEZ_UNIT">SEZ Unit</option>
                        <option value="SEZ_DEVELOPER">SEZ Developer</option>
                        <option value="COMPOSITION">Composition Scheme</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">GSTR-3B Return Frequency</label>
                    <select
                      value={newGstinForm.filingFrequency}
                      onChange={e => setNewGstinForm({ ...newGstinForm, filingFrequency: e.target.value })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                    >
                      <option value="MONTHLY">Monthly Return</option>
                      <option value="QUARTERLY_QRMP">Quarterly (QRMP Scheme)</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddGstinModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700"
                    >
                      Save & Sync GSTIN
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 3: BRANCH MANAGEMENT */}
      {activeSubTab === 'BRANCHES' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="text-amber-600" size={20} /> Branch & Operational Locations Network
              </h3>
              <p className="text-xs text-slate-500">Map branch locations, head offices, warehouses, and associate with state GSTINs</p>
            </div>

            <button
              onClick={() => setShowAddBranchModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus size={16} /> Add Branch Office
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {branches.map((b) => (
              <div key={b.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative group">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                      {b.type.replace('_', ' ')} • CODE: {b.code}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{b.name}</h4>
                  </div>

                  <button
                    onClick={() => handleDeleteBranch(b.id, b.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Branch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="space-y-1 text-xs text-slate-600 font-medium border-t border-slate-100 pt-2">
                  <p className="flex items-center gap-1">
                    <MapPin size={12} className="text-amber-600" /> {b.address}
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[11px] text-slate-800">
                    <FileCheck size={12} className="text-emerald-600" /> GSTIN: {b.gstin}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Contact: {b.contactPerson} ({b.contactPhone})
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                  <span className="text-slate-500">Turnover Share:</span>
                  <strong className="text-amber-700 font-mono">{b.annualTurnoverContributionPct}%</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Add Branch Modal */}
          {showAddBranchModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="text-amber-600" size={18} /> Add Branch Office
                  </h3>
                  <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleAddBranch} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">Branch Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pune Regional Warehouse"
                      value={newBranchForm.name}
                      onChange={e => setNewBranchForm({ ...newBranchForm, name: e.target.value })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">Branch Code</label>
                      <input
                        type="text"
                        placeholder="MH-PN-04"
                        value={newBranchForm.code}
                        onChange={e => setNewBranchForm({ ...newBranchForm, code: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-mono uppercase font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Branch Type</label>
                      <select
                        value={newBranchForm.type}
                        onChange={e => setNewBranchForm({ ...newBranchForm, type: e.target.value as any })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                      >
                        <option value="REGIONAL_OFFICE">Regional Office</option>
                        <option value="BRANCH_OFFICE">Branch Office</option>
                        <option value="WAREHOUSE">Warehouse / Depot</option>
                        <option value="FACTORY">Factory / Manufacturing</option>
                        <option value="SEZ_UNIT">SEZ Unit</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">State Location</label>
                    <select
                      value={newBranchForm.stateCode}
                      onChange={e => setNewBranchForm({ ...newBranchForm, stateCode: e.target.value })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-bold outline-none"
                    >
                      {Object.entries(stateNames).map(([code, name]) => (
                        <option key={code} value={code}>{code} - {name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Full Address</label>
                    <textarea
                      rows={2}
                      value={newBranchForm.address}
                      onChange={e => setNewBranchForm({ ...newBranchForm, address: e.target.value })}
                      className="w-full p-2 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-medium outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">Contact Person</label>
                      <input
                        type="text"
                        value={newBranchForm.contactPerson}
                        onChange={e => setNewBranchForm({ ...newBranchForm, contactPerson: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Phone</label>
                      <input
                        type="text"
                        value={newBranchForm.contactPhone}
                        onChange={e => setNewBranchForm({ ...newBranchForm, contactPhone: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-medium outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddBranchModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700"
                    >
                      Save Branch
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 4: FINANCIAL YEAR & PERIOD LOCK */}
      {activeSubTab === 'FY_SETTINGS' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-sky-600" size={20} /> Financial Year & Books Period Locking
              </h3>
              <p className="text-xs text-slate-500">Configure default accounting period, tax calculation method, and lock historical filings</p>
            </div>

            <button
              onClick={handleSaveFyConfig}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Save size={16} /> Broadcast FY Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Active Financial Year *</label>
              <select
                value={fyConfig.activeFY}
                onChange={e => setFyConfig({ ...fyConfig, activeFY: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="2026-27">FY 2026-27 (Current Active)</option>
                <option value="2025-26">FY 2025-26</option>
                <option value="2024-25">FY 2024-25</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Accounting Period Lock Date</label>
              <input
                type="date"
                value={fyConfig.periodLockDate}
                onChange={e => setFyConfig({ ...fyConfig, periodLockDate: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 block">No invoices prior to this date can be edited or deleted.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tax Accounting Method</label>
              <select
                value={fyConfig.taxMethod}
                onChange={e => setFyConfig({ ...fyConfig, taxMethod: e.target.value as any })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="ACCRUAL">Accrual Basis (Mandatory for Corporate Entities)</option>
                <option value="CASH">Cash Basis</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-md">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Auto-Lock Filed GST Periods</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Automatically freeze purchase and sales ledger entries once GSTR-3B return is filed for the period.
                </p>
              </div>
            </div>

            <div
              onClick={() => setFyConfig({ ...fyConfig, autoLockFiledPeriods: !fyConfig.autoLockFiledPeriods })}
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${fyConfig.autoLockFiledPeriods ? 'bg-sky-600' : 'bg-slate-300'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${fyConfig.autoLockFiledPeriods ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE 5: STATE-WISE CONFIGURATION */}
      {activeSubTab === 'STATE_CONFIG' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="text-purple-600" size={20} /> State Tax Jurisdiction & E-Way Bill Rules
              </h3>
              <p className="text-xs text-slate-500">Configure state tax wards, circles, and intra-state e-way bill threshold limits</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Select State:</span>
              <select
                value={selectedStateCode}
                onChange={e => setSelectedStateCode(e.target.value)}
                className="h-9 px-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 outline-none"
              >
                {gstinList.map(g => (
                  <option key={g.id} value={g.stateCode}>
                    {g.stateCode} - {g.stateName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {stateConfigs[selectedStateCode] && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tax Ward / Circle *</label>
                  <input
                    type="text"
                    value={stateConfigs[selectedStateCode].jurisdictionWard}
                    onChange={e => setStateConfigs({
                      ...stateConfigs,
                      [selectedStateCode]: { ...stateConfigs[selectedStateCode], jurisdictionWard: e.target.value }
                    })}
                    className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Division / Circle Name</label>
                  <input
                    type="text"
                    value={stateConfigs[selectedStateCode].jurisdictionCircle}
                    onChange={e => setStateConfigs({
                      ...stateConfigs,
                      [selectedStateCode]: { ...stateConfigs[selectedStateCode], jurisdictionCircle: e.target.value }
                    })}
                    className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">GST Commissionerate Jurisdiction</label>
                  <input
                    type="text"
                    value={stateConfigs[selectedStateCode].commissionerate}
                    onChange={e => setStateConfigs({
                      ...stateConfigs,
                      [selectedStateCode]: { ...stateConfigs[selectedStateCode], commissionerate: e.target.value }
                    })}
                    className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="text-xs font-bold text-slate-800">Intra-State E-Way Bill Value Threshold (₹)</label>
                  <input
                    type="number"
                    value={stateConfigs[selectedStateCode].intraStateEwayThreshold}
                    onChange={e => setStateConfigs({
                      ...stateConfigs,
                      [selectedStateCode]: { ...stateConfigs[selectedStateCode], intraStateEwayThreshold: Number(e.target.value) }
                    })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block">E.g., ₹100,000 threshold in Maharashtra/Delhi for intra-state movement.</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="text-xs font-bold text-slate-800">Inter-State E-Way Bill Value Threshold (₹)</label>
                  <input
                    type="number"
                    value={stateConfigs[selectedStateCode].interStateEwayThreshold}
                    onChange={e => setStateConfigs({
                      ...stateConfigs,
                      [selectedStateCode]: { ...stateConfigs[selectedStateCode], interStateEwayThreshold: Number(e.target.value) }
                    })}
                    className="w-full h-10 px-3 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block">Standard National Inter-State threshold is ₹50,000.</span>
                </div>
              </div>

              <button
                onClick={handleSaveStateConfig}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Save size={16} /> Broadcast State Configuration
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 6: BUSINESS PROFILE & HSN */}
      {activeSubTab === 'BUSINESS_PROFILE' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="text-rose-600" size={20} /> Business Classification & HSN/SAC Codes
              </h3>
              <p className="text-xs text-slate-500">Configure annual turnover bracket, mandatory e-invoicing applicability, and primary HSN codes</p>
            </div>

            <button
              onClick={handleSaveBusinessProfile}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Save size={16} /> Save Business Profile
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Annual Aggregate Turnover Bracket *</label>
              <select
                value={businessProfile.turnoverBracket}
                onChange={e => setBusinessProfile({ ...businessProfile, turnoverBracket: e.target.value as any })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="< 1.5 CR">&lt; ₹1.5 Crore (Quarterly QRMP Eligible)</option>
                <option value="1.5 CR - 5 CR">₹1.5 Crore - ₹5 Crore</option>
                <option value="5 CR - 20 CR">₹5 Crore - ₹20 Crore (Mandatory E-Invoicing)</option>
                <option value="> 20 CR">&gt; ₹20 Crore (Mandatory E-Invoicing & E-Waybill)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Import Export Code (IEC Number)</label>
              <input
                type="text"
                placeholder="0318045921"
                value={businessProfile.iecCode || ''}
                onChange={e => setBusinessProfile({ ...businessProfile, iecCode: e.target.value })}
                className="w-full h-10 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">E-Invoicing Applicability Status</label>
              <div className="h-10 px-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">Mandatory (B2B Tax Invoices)</span>
                <CheckCircle2 size={16} className="text-rose-600" />
              </div>
            </div>
          </div>

          {/* HSN Code Manager */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800">Primary HSN / SAC Goods & Services Codes</h4>
            <p className="text-[11px] text-slate-500">Add common 6-digit or 8-digit HSN/SAC codes for automated invoice creation</p>

            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                placeholder="e.g. 998311 (IT Software Services)"
                value={newHsnInput}
                onChange={e => setNewHsnInput(e.target.value)}
                className="flex-1 h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
              />
              <button
                type="button"
                onClick={handleAddHsn}
                className="px-3 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700"
              >
                Add HSN
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {businessProfile.primaryHsnSacCodes.map((hsn, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                  {hsn}
                  <button onClick={() => handleRemoveHsn(idx)} className="text-slate-400 hover:text-rose-600">✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE 7: AUTHORIZED SIGNATORIES & DSC */}
      {activeSubTab === 'SIGNATORIES' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="text-teal-600" size={20} /> Authorized Signatories & Digital Signatures (DSC)
              </h3>
              <p className="text-xs text-slate-500">Designated tax signatories, Digital Signature Certificates (DSC), and EVC verification tokens</p>
            </div>

            <button
              onClick={() => setShowAddSignatoryModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus size={16} /> Add Authorized Signatory
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {signatories.map((s) => (
              <div
                key={s.id}
                className={`p-5 rounded-2xl border transition-all ${
                  s.isPrimary
                    ? 'bg-gradient-to-br from-teal-50/70 to-white border-teal-200 shadow-sm ring-1 ring-teal-400/20'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {s.name}
                      {s.isPrimary && (
                        <span className="px-2 py-0.5 bg-teal-600 text-white text-[9px] font-black uppercase rounded-full">
                          Primary Signatory
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">{s.designation}</p>
                  </div>

                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold rounded">
                    DSC: {s.dscStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3 font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>PAN Number:</span>
                    <strong className="text-slate-800 font-mono">{s.pan}</strong>
                  </div>
                  {s.dinDpin && (
                    <div className="flex justify-between text-slate-600">
                      <span>DIN / DPIN:</span>
                      <strong className="text-slate-800 font-mono">{s.dinDpin}</strong>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Mobile:</span>
                    <strong className="text-slate-800">{s.mobile}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Email:</span>
                    <strong className="text-slate-800">{s.email}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>DSC Expiry Date:</span>
                    <strong className="text-emerald-700">{s.dscExpiryDate || '2027-03-31'}</strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => triggerToast(`DSC token USB Dongle test for ${s.name} passed.`, 'info')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Key size={12} /> Test DSC USB Dongle
                  </button>

                  {!s.isPrimary && (
                    <button
                      onClick={() => handleSetPrimarySignatory(s.id)}
                      className="text-xs font-bold text-teal-600 hover:underline"
                    >
                      Set as Primary
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Signatory Modal */}
          {showAddSignatoryModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="text-teal-600" size={18} /> Add Authorized Signatory
                  </h3>
                  <button onClick={() => setShowAddSignatoryModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleAddSignatory} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newSignatoryForm.name}
                      onChange={e => setNewSignatoryForm({ ...newSignatoryForm, name: e.target.value })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">Designation</label>
                      <input
                        type="text"
                        value={newSignatoryForm.designation}
                        onChange={e => setNewSignatoryForm({ ...newSignatoryForm, designation: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">PAN Number</label>
                      <input
                        type="text"
                        value={newSignatoryForm.pan}
                        onChange={e => setNewSignatoryForm({ ...newSignatoryForm, pan: e.target.value.toUpperCase() })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-mono uppercase font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700">DIN / DPIN</label>
                      <input
                        type="text"
                        value={newSignatoryForm.dinDpin}
                        onChange={e => setNewSignatoryForm({ ...newSignatoryForm, dinDpin: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700">Mobile Number</label>
                      <input
                        type="text"
                        value={newSignatoryForm.mobile}
                        onChange={e => setNewSignatoryForm({ ...newSignatoryForm, mobile: e.target.value })}
                        className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      value={newSignatoryForm.email}
                      onChange={e => setNewSignatoryForm({ ...newSignatoryForm, email: e.target.value })}
                      className="w-full h-9 px-3 bg-slate-50 text-slate-900 border border-slate-300 rounded-xl outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isPrimary"
                      checked={newSignatoryForm.isPrimary}
                      onChange={e => setNewSignatoryForm({ ...newSignatoryForm, isPrimary: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <label htmlFor="isPrimary" className="font-semibold text-slate-800">Set as Primary Signatory</label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddSignatoryModal(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700"
                    >
                      Save Signatory
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 8: POSTGRES NEON MULTI-TENANT DATASETS */}
      {activeSubTab === 'NEON_DATASETS' && (
        <div className="animate-in fade-in">
          <NeonMultiTenantDatabaseCenter
            currentTenantId={currentTenantId}
            onShowToast={(msg) => triggerToast(msg, 'success')}
          />
        </div>
      )}

      {/* REAL-TIME AUDIT LOG SLIDE-OVER DRAWER */}
      {showAuditDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-slate-900 text-white h-full p-6 space-y-6 shadow-2xl border-l border-slate-800 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Activity size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Live Realtime Audit Feed</h3>
              </div>
              <button onClick={() => setShowAuditDrawer(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Broadcasting live events across connected sessions for tenant <strong className="text-indigo-300 font-mono">{currentTenantId}</strong>:
              </p>

              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-300">{log.user}</span>
                      <span className="text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-100">{log.action}</p>
                    {log.details && (
                      <p className="text-[10px] text-slate-400">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationModule;
