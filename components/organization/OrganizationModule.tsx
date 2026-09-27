import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Globe, MapPin, Calendar, FileText, UserCheck, Shield, 
  Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Save, Key, Lock, 
  ExternalLink, Layers, RefreshCw, Check, Sparkles, Building, Briefcase, 
  Clock, ShieldAlert, Award, FileCheck, DollarSign, Settings, Users,
  Activity, Eye, Radio, Zap, ChevronRight, X, Database, Crown, Sliders,
  ShieldCheck, ToggleLeft, ToggleRight, SlidersHorizontal, Cpu, Coins,
  SlidersVertical, CheckSquare, Square, ArrowUpRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { setGstinsForTenant, setBranchesForTenant, RootState } from '../../store/store';
import { NeonMultiTenantDatabaseCenter } from './NeonMultiTenantDatabaseCenter';
import { 
  CompanyRegistrationProfile, 
  GstinRegistrationItem, 
  BranchDetailsItem, 
  FinancialYearConfigItem, 
  StateConfigItem, 
  BusinessProfileDetailsItem, 
  AuthorizedSignatoryItem,
  UserRole
} from '../../types';
import { tenantService } from '../../src/core/tenancy/tenantService';
import { entitlementService } from '../../src/core/entitlements/entitlementService';
import { PlanCode, PLANS_CATALOG, DEFAULT_PLANS_CATALOG, Feature, Plan, PlanLimits } from '../../src/core/entitlements/types';
import { Tenant } from '../../src/core/tenancy/types';
import { subscriptionManager } from '../../src/core/billing/SubscriptionManager';
import { BillingService } from '../../src/core/billing';
import { PlanGuard, InstantUpgradeModal, PLAN_DISPLAY_NAMES } from '../PlanGuard';
import { BranchManagerModule } from '../BranchManagerModule';
import { 
  ENTERPRISE_GSTINS_BY_TENANT, 
  ENTERPRISE_BRANCHES_BY_TENANT, 
  ENTERPRISE_GROUP_TENANTS 
} from '../../src/fixtures/enterpriseTenants';

interface OrganizationModuleProps {
  currentTenantId?: string;
  onTenantSwitch?: (tenantId: string) => void;
  onNavigate?: (path: string) => void;
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
  { id: 'usr-0', name: 'Super Admin Core', role: 'SUPER_ADMIN / Platform Governance', color: 'bg-amber-600', avatar: 'SA' },
  { id: 'usr-1', name: 'Dr. Vikram Malhotra', role: 'CFO / Primary Signatory', color: 'bg-indigo-600', avatar: 'VM' },
  { id: 'usr-2', name: 'Anita Desai', role: 'Head of Tax & Compliance', color: 'bg-emerald-600', avatar: 'AD' },
  { id: 'usr-3', name: 'Priya Verma', role: 'Delhi Regional Lead', color: 'bg-amber-600', avatar: 'PV' },
  { id: 'usr-4', name: 'Arun Kumar', role: 'Bengaluru Tech Center SEZ Lead', color: 'bg-sky-600', avatar: 'AK' },
];

export const OrganizationModule: React.FC<OrganizationModuleProps> = ({
  currentTenantId = 't1',
  onTenantSwitch,
  onNavigate
}) => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const subProfile = subscriptionManager.getUserSubscriptionProfile(currentUser?.role, currentTenantId);
  const [activeSubscription, setActiveSubscription] = useState(() => entitlementService.getSubscription(currentTenantId));
  const isStarterOrSingleEntity = !isSuperAdmin && (subProfile.maxCompanies <= 1 || activeSubscription?.planId === PlanCode.STARTER);
  const isStarterPlan = !isSuperAdmin && (activeSubscription?.planId === PlanCode.STARTER || subProfile.maxGstins <= 1);

  const [activeSubTab, setActiveSubTab] = useState<
    'COMPANY' | 'GSTIN' | 'BRANCHES' | 'FY_SETTINGS' | 'STATE_CONFIG' | 'BUSINESS_PROFILE' | 'SIGNATORIES' | 'NEON_DATASETS' | 'TENANTS' | 'SUPER_ADMIN'
  >(() => (isSuperAdmin || (!isStarterOrSingleEntity && subProfile.maxCompanies > 1)) ? 'TENANTS' : 'COMPANY');

  // Auto switch away from TENANTS tab if user is on Starter plan
  useEffect(() => {
    if (isStarterOrSingleEntity && activeSubTab === 'TENANTS') {
      setActiveSubTab('COMPANY');
    }
  }, [isStarterOrSingleEntity, activeSubTab]);

  // --- TENANT CREATION & PLAN ALIGNMENT STATE ---
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => tenantService.getAllTenants());
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  
  // Instant Upgrade Modal State for gated features and quota overruns
  const [upgradeModalInfo, setUpgradeModalInfo] = useState<{
    isOpen: boolean;
    targetPlan: PlanCode;
    targetPlanName: string;
    featureTitle: string;
    featureDesc?: string;
    bullets?: string[];
  }>({
    isOpen: false,
    targetPlan: PlanCode.BUSINESS,
    targetPlanName: 'Business Growth',
    featureTitle: 'Module Upgrade Required'
  });

  const [newTenantForm, setNewTenantForm] = useState({
    legalName: '',
    tradeName: '',
    pan: '',
    sector: 'General Commercial & Services',
    stateCode: '27',
    stateName: 'Maharashtra',
    city: 'Mumbai',
    subdomain: '',
    planCode: PlanCode.BUSINESS,
    billingCycle: 'MONTHLY' as 'MONTHLY' | 'ANNUAL'
  });

  // --- SUPER ADMIN: REAL-TIME PLAN & PRICING STUDIO STATE ---
  const [plansCatalog, setPlansCatalog] = useState<Plan[]>(() => entitlementService.getAllPlans());
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>(PlanCode.BUSINESS);
  const [planEditorForm, setPlanEditorForm] = useState<Plan>(() => {
    const p = entitlementService.getPlan(PlanCode.BUSINESS) || PLANS_CATALOG[PlanCode.BUSINESS];
    return JSON.parse(JSON.stringify(p));
  });
  const [isPlanDirty, setIsPlanDirty] = useState(false);

  // Tenant-Specific Bespoke Override State
  const [selectedTenantForCustom, setSelectedTenantForCustom] = useState<string>(currentTenantId);
  const [tenantCustomForm, setTenantCustomForm] = useState(() => {
    const sub = entitlementService.getSubscription(currentTenantId);
    return {
      planId: sub?.planId || PlanCode.BUSINESS,
      customMonthlyPrice: sub?.customMonthlyPrice !== undefined ? sub.customMonthlyPrice : '',
      customAnnualPrice: sub?.customAnnualPrice !== undefined ? sub.customAnnualPrice : '',
      customPlanName: sub?.customPlanName || '',
      customNotes: sub?.customNotes || '',
      enabledFeatures: sub?.customFeatureOverrides?.enabledFeatures || [],
      disabledFeatures: sub?.customFeatureOverrides?.disabledFeatures || []
    };
  });

  const [toastMsg, setToastMsg] = useState<{ text: string; type?: 'info' | 'success' | 'remote' } | null>(null);

  const triggerToast = (text: string, type: 'info' | 'success' | 'remote' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // --- REALTIME SOCKET & COLLABORATION STATE ---
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUser, setActiveUser] = useState(PRESET_PERSONAS[0]); // Default to Super Admin Core
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [remoteEditing, setRemoteEditing] = useState<{ user: any; section: string } | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: 'act-1',
      user: 'Super Admin Core',
      action: 'Super Admin Multi-Tenant Governance Ready',
      section: 'SUPER_ADMIN',
      timestamp: new Date().toISOString(),
      details: 'Real-time plan customization, dynamic price updates, and bespoke tenant packaging live'
    }
  ]);

  // Helper to get initial company and scoped registrations
  const initialTenantObj: any = tenantService.getTenant(currentTenantId) || ENTERPRISE_GROUP_TENANTS.find(t => t.id === currentTenantId);

  // --- 1. COMPANY REGISTRATION STATE ---
  const [companyProfile, setCompanyProfile] = useState<CompanyRegistrationProfile>(() => ({
    id: currentTenantId,
    legalName: (initialTenantObj as any)?.legalName || initialTenantObj?.name || 'Acme Technologies Private Limited',
    tradeName: (initialTenantObj as any)?.tradeName || initialTenantObj?.name || 'Acme Tech Solutions',
    entityType: 'PRIVATE_LIMITED',
    cinLLPin: 'U72200MH2018PTC312456',
    dateOfIncorporation: '2018-04-12',
    pan: (initialTenantObj as any)?.pan || (initialTenantObj?.gstin ? initialTenantObj.gstin.substring(2, 12) : 'AAAAA0000A'),
    tan: 'MUMB00000A',
    registeredAddress: initialTenantObj?.address || '101, Business Park, MIDC Andheri East, Mumbai, Maharashtra 400093',
    corporateAddress: 'Floor 5, Tech Tower, BKC, Mumbai, Maharashtra 400051',
    contactEmail: 'tax.compliance@acmetech.com',
    contactPhone: '+91 98765 43210',
    website: 'https://acmetech.com',
    logoUrl: ''
  }));

  // --- 2. GSTIN MANAGEMENT STATE (Scoped strictly to plan quota) ---
  const [gstinList, setGstinList] = useState<GstinRegistrationItem[]>(() => {
    const raw = ENTERPRISE_GSTINS_BY_TENANT[currentTenantId] || [
      {
        id: 'g1',
        gstin: initialTenantObj?.gstin || '27AAAAA0000A1Z5',
        stateCode: initialTenantObj?.stateCode || '27',
        stateName: initialTenantObj?.stateName || 'Maharashtra',
        registrationType: 'REGULAR',
        registrationDate: '2018-07-01',
        status: 'ACTIVE',
        filingFrequency: 'MONTHLY',
        einvoicingStatus: 'ENABLED',
        ewaybillStatus: 'ENABLED',
        isPrimary: true
      }
    ];
    const maxGstins = (!isSuperAdmin && (activeSubscription?.planId === PlanCode.STARTER || subProfile.maxGstins <= 1)) ? 1 : subProfile.maxGstins;
    return isSuperAdmin ? raw : raw.slice(0, maxGstins);
  });

  // Keep GSTIN list aligned with plan quota
  useEffect(() => {
    const raw = ENTERPRISE_GSTINS_BY_TENANT[currentTenantId] || [
      {
        id: 'g1',
        gstin: initialTenantObj?.gstin || '27AAAAA0000A1Z5',
        stateCode: initialTenantObj?.stateCode || '27',
        stateName: initialTenantObj?.stateName || 'Maharashtra',
        registrationType: 'REGULAR',
        registrationDate: '2018-07-01',
        status: 'ACTIVE',
        filingFrequency: 'MONTHLY',
        einvoicingStatus: 'ENABLED',
        ewaybillStatus: 'ENABLED',
        isPrimary: true
      }
    ];
    const maxGstins = (!isSuperAdmin && (activeSubscription?.planId === PlanCode.STARTER || subProfile.maxGstins <= 1)) ? 1 : subProfile.maxGstins;
    setGstinList(isSuperAdmin ? raw : raw.slice(0, maxGstins));
  }, [currentTenantId, activeSubscription?.planId, isSuperAdmin, subProfile.maxGstins]);

  const [showAddGstinModal, setShowAddGstinModal] = useState(false);
  const [newGstinForm, setNewGstinForm] = useState({
    gstin: '',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    registrationType: 'REGULAR',
    filingFrequency: 'MONTHLY'
  });

  // --- 3. BRANCH MANAGEMENT STATE (Scoped strictly to plan quota) ---
  const [branches, setBranches] = useState<BranchDetailsItem[]>(() => {
    const raw = ENTERPRISE_BRANCHES_BY_TENANT[currentTenantId] || [
      {
        id: 'b1',
        name: `${initialTenantObj?.name || 'Primary'} HQ Office`,
        code: `${initialTenantObj?.stateCode || 'MH'}-HQ-01`,
        type: 'HEAD_OFFICE',
        address: initialTenantObj?.address || '101 MIDC Andheri East, Mumbai, MH',
        stateCode: initialTenantObj?.stateCode || '27',
        stateName: initialTenantObj?.stateName || 'Maharashtra',
        gstin: initialTenantObj?.gstin || '27AAAAA0000A1Z5',
        contactPerson: 'Rajesh Sharma',
        contactEmail: 'rajesh.sharma@acmetech.com',
        contactPhone: '+91 98200 11223',
        status: 'ACTIVE',
        annualTurnoverContributionPct: 100
      }
    ];
    return isSuperAdmin ? raw : raw.slice(0, subProfile.maxBranches);
  });

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

    // --- SUPER ADMIN REALTIME LISTENERS ---
    socket.on('plans-catalog-updated', (data: { plans: Plan[]; updatedPlanCode?: PlanCode; updatedPlan?: Plan; updatedBy?: string; action?: string }) => {
      if (data?.plans) {
        setPlansCatalog(data.plans);
        const currentSelected = data.plans.find(p => p.code === selectedPlanCode);
        if (currentSelected && !isPlanDirty) {
          setPlanEditorForm(JSON.parse(JSON.stringify(currentSelected)));
        }
      }
      triggerToast(`⚡ Plan catalog synced in real-time by ${data.updatedBy || 'Super Admin'}`, 'remote');
    });

    socket.on('tenant-subscription-updated', (data: { tenantId: string; subscription: any; entitlements: Feature[]; updatedBy?: string }) => {
      if (data.tenantId === currentTenantId) {
        setActiveSubscription(data.subscription);
      }
      if (data.tenantId === selectedTenantForCustom) {
        setTenantCustomForm({
          planId: data.subscription.planId,
          customMonthlyPrice: data.subscription.customMonthlyPrice !== undefined ? data.subscription.customMonthlyPrice : '',
          customAnnualPrice: data.subscription.customAnnualPrice !== undefined ? data.subscription.customAnnualPrice : '',
          customPlanName: data.subscription.customPlanName || '',
          customNotes: data.subscription.customNotes || '',
          enabledFeatures: data.subscription.customFeatureOverrides?.enabledFeatures || [],
          disabledFeatures: data.subscription.customFeatureOverrides?.disabledFeatures || []
        });
      }
      triggerToast(`⚡ Tenant ${data.tenantId} customized entitlements applied live!`, 'remote');
    });

    socket.on('tenant-created', (data: { tenant: Tenant; subscription: any; creator?: string }) => {
      setAllTenants(tenantService.getAllTenants());
      triggerToast(`🏢 New organization "${data.tenant.legalName}" provisioned live by ${data.creator || 'Super Admin'}!`, 'remote');
    });

    socket.on('tenants-list-updated', (data: { tenants: Tenant[] }) => {
      if (data?.tenants) {
        setAllTenants(data.tenants);
      }
    });

    socket.on('superadmin-audit-log', (log: ActivityLogItem) => {
      setActivityLogs(prev => [log, ...prev].slice(0, 50));
    });

    socket.on('superadmin-error', (err: { message: string }) => {
      triggerToast(`⚠️ Super Admin Error: ${err.message}`, 'info');
    });

    return () => {
      socket.disconnect();
    };
  }, [currentTenantId, selectedPlanCode, selectedTenantForCustom, isPlanDirty]);

  // Sync plan editor when selectedPlanCode changes
  useEffect(() => {
    const p = plansCatalog.find(plan => plan.code === selectedPlanCode) || entitlementService.getPlan(selectedPlanCode);
    if (p) {
      setPlanEditorForm(JSON.parse(JSON.stringify(p)));
      setIsPlanDirty(false);
    }
  }, [selectedPlanCode, plansCatalog]);

  // Sync tenant custom overrides form when selectedTenantForCustom changes
  useEffect(() => {
    const sub = entitlementService.getSubscription(selectedTenantForCustom);
    if (sub) {
      setTenantCustomForm({
        planId: sub.planId,
        customMonthlyPrice: sub.customMonthlyPrice !== undefined ? sub.customMonthlyPrice : '',
        customAnnualPrice: sub.customAnnualPrice !== undefined ? sub.customAnnualPrice : '',
        customPlanName: sub.customPlanName || '',
        customNotes: sub.customNotes || '',
        enabledFeatures: sub.customFeatureOverrides?.enabledFeatures || [],
        disabledFeatures: sub.customFeatureOverrides?.disabledFeatures || []
      });
    }
  }, [selectedTenantForCustom]);

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

  // Synchronize when currentTenantId or subscription changes
  useEffect(() => {
    const tenants = tenantService.getAllTenants();
    setAllTenants(tenants);
    const sub = entitlementService.getSubscription(currentTenantId);
    setActiveSubscription(sub);

    const profile = subscriptionManager.getUserSubscriptionProfile(currentUser?.role, currentTenantId);

    const t: any = tenantService.getTenant(currentTenantId) || ENTERPRISE_GROUP_TENANTS.find(item => item.id === currentTenantId);
    if (t) {
      setCompanyProfile(prev => ({
        ...prev,
        id: t.id,
        legalName: (t as any).legalName || t.name,
        tradeName: (t as any).tradeName || t.name || (t as any).legalName,
        pan: (t as any).pan || (t.gstin ? t.gstin.substring(2, 12) : prev.pan),
        registeredAddress: t.address || prev.registeredAddress
      }));
    }

    // Refresh scoped GSTINs and Branches
    const rawGstins: GstinRegistrationItem[] = ENTERPRISE_GSTINS_BY_TENANT[currentTenantId] || [
      {
        id: 'g1',
        gstin: t?.gstin || '27AAAAA0000A1Z5',
        stateCode: t?.stateCode || '27',
        stateName: t?.stateName || 'Maharashtra',
        registrationType: 'REGULAR',
        registrationDate: '2018-07-01',
        status: 'ACTIVE',
        filingFrequency: 'MONTHLY',
        einvoicingStatus: 'ENABLED',
        ewaybillStatus: 'ENABLED',
        isPrimary: true
      }
    ];

    const rawBranches: BranchDetailsItem[] = ENTERPRISE_BRANCHES_BY_TENANT[currentTenantId] || [
      {
        id: 'b1',
        name: `${t?.name || 'Primary'} HQ Office`,
        code: `${t?.stateCode || 'MH'}-HQ-01`,
        type: 'HEAD_OFFICE',
        address: t?.address || '101 MIDC Andheri East, Mumbai, MH',
        stateCode: t?.stateCode || '27',
        stateName: t?.stateName || 'Maharashtra',
        gstin: t?.gstin || '27AAAAA0000A1Z5',
        contactPerson: 'Rajesh Sharma',
        contactEmail: 'rajesh.sharma@acmetech.com',
        contactPhone: '+91 98200 11223',
        status: 'ACTIVE',
        annualTurnoverContributionPct: 100
      }
    ];

    const scopedGstins = isSuperAdmin ? rawGstins : rawGstins.slice(0, profile.maxGstins);
    const scopedBranches = isSuperAdmin ? rawBranches : rawBranches.slice(0, profile.maxBranches);

    setGstinList(scopedGstins);
    setBranches(scopedBranches);
    dispatch(setGstinsForTenant({ tenantId: currentTenantId, gstins: scopedGstins }));
    dispatch(setBranchesForTenant({ tenantId: currentTenantId, branches: scopedBranches }));
  }, [currentTenantId, isSuperAdmin, activeSubscription?.planId]);

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantForm.legalName.trim()) {
      triggerToast('Organization legal name is required', 'info');
      return;
    }
    const cleanPan = newTenantForm.pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      triggerToast('Invalid PAN format! Must be 10 characters (5 letters, 4 digits, 1 letter)', 'info');
      return;
    }

    try {
      const result = tenantService.createTenant({
        legalName: newTenantForm.legalName.trim(),
        tradeName: newTenantForm.tradeName.trim() || newTenantForm.legalName.trim(),
        pan: cleanPan,
        sector: newTenantForm.sector,
        stateCode: newTenantForm.stateCode,
        stateName: stateNames[newTenantForm.stateCode] || 'State ' + newTenantForm.stateCode,
        city: newTenantForm.city,
        subdomain: newTenantForm.subdomain,
        planCode: newTenantForm.planCode,
        billingCycle: newTenantForm.billingCycle,
        creatorUserId: 'u-fayas',
        creatorEmail: 'fayasamd@gmail.com',
        creatorName: 'Fayas M'
      });

      const updatedTenants = tenantService.getAllTenants();
      setAllTenants(updatedTenants);
      setShowCreateTenantModal(false);

      // Reset form
      setNewTenantForm({
        legalName: '',
        tradeName: '',
        pan: '',
        sector: 'General Commercial & Services',
        stateCode: '27',
        stateName: 'Maharashtra',
        city: 'Mumbai',
        subdomain: '',
        planCode: PlanCode.BUSINESS,
        billingCycle: 'MONTHLY'
      });

      triggerToast(`Provisioned organization "${result.tenant.legalName}" under ${newTenantForm.planCode} plan!`, 'success');

      if (onTenantSwitch) {
        onTenantSwitch(result.tenant.id);
      }
    } catch (err: any) {
      triggerToast(err.message || 'Failed to create organization', 'info');
    }
  };

  const handleUpgradePlan = (tenantId: string, newPlanCode: PlanCode) => {
    try {
      entitlementService.updateSubscriptionPlan(tenantId, newPlanCode);
      BillingService.setPlan(tenantId, newPlanCode);
      setAllTenants([...tenantService.getAllTenants()]);
      const updatedSub = entitlementService.getSubscription(tenantId);
      if (tenantId === currentTenantId) {
        setActiveSubscription(updatedSub);
      }
      window.dispatchEvent(new CustomEvent('taxflow:subscription_updated', {
        detail: { tenantId, planCode: newPlanCode }
      }));
      triggerToast(`Plan successfully updated to ${newPlanCode}!`, 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Plan update failed', 'info');
    }
  };

  const ALL_SYSTEM_FEATURES = [
    { feature: Feature.INVOICES, label: 'Sales Invoicing & Billing', category: 'Core Operations', desc: 'Creation, numbering, validation, PDF dispatch & ledger posting' },
    { feature: Feature.PURCHASES, label: 'Vendor Purchases & Inward Bills', category: 'Core Operations', desc: 'Purchase register, 3-way matching & expense tracking' },
    { feature: Feature.E_WAY_BILL, label: 'NIC E-Way Bill Generation', category: 'Logistics', desc: 'Direct NIC portal integration, Part-A/B updates & vehicle tracking' },
    { feature: Feature.GST_RETURNS, label: 'GSTR-1, 2B, 3B Returns & Filing', category: 'Tax Engine', desc: 'Monthly/quarterly summary generation & JSON return export' },
    { feature: Feature.RECONCILIATION, label: '2B vs Purchase Auto-Reconciliation', category: 'Compliance', desc: 'Smart 5-way matching engine with configurable tolerance rules' },
    { feature: Feature.ITC, label: 'Input Tax Credit (ITC) Optimizer', category: 'Tax Engine', desc: 'Rule 37/42/43 reversal calculations & ledger tracking' },
    { feature: Feature.E_INVOICE, label: 'NIC E-Invoicing IRN & QR Code', category: 'Compliance', desc: 'Mandatory B2B e-invoice generation with digital signature' },
    { feature: Feature.MULTI_GSTIN, label: 'Multi-State GSTIN Management', category: 'Enterprise', desc: 'Consolidated multi-state reporting and branch filtering' },
    { feature: Feature.MULTI_BRANCH, label: 'Multi-Branch & SEZ Regional Hierarchy', category: 'Enterprise', desc: 'Sub-branch isolation, SEZ zero-rated supplies & unit codes' },
    { feature: Feature.AUTOMATION, label: 'GST Rules & Workflow Automation', category: 'Intelligence', desc: 'Custom triggers, auto-reminders and compliance approval flows' },
    { feature: Feature.AI, label: 'Gemini AI Tax Copilot & Anomaly Detector', category: 'AI Innovation', desc: 'Intelligent HSN classification & tax risk anomaly scoring' },
    { feature: Feature.ERP_INTEGRATION, label: 'SAP / Oracle / Tally ERP Connector', category: 'Integration', desc: 'Bi-directional ERP sync & webhook data pipeline' },
    { feature: Feature.API, label: 'Developer API Access & Tokens', category: 'Developer', desc: 'High-throughput REST API for headless integrations' },
    { feature: Feature.WEBHOOKS, label: 'Real-time Event Webhooks', category: 'Developer', desc: 'Outbound webhook notifications on compliance events' },
    { feature: Feature.ADVANCED_RBAC, label: 'Granular RBAC & Security Audit Logs', category: 'Security', desc: 'Custom roles, immutable audit trail & IP restrictions' }
  ];

  const handleSavePlanToCatalog = async () => {
    try {
      const updates = {
        name: planEditorForm.name,
        description: planEditorForm.description,
        monthlyPriceInr: Number(planEditorForm.monthlyPriceInr),
        annualPriceInr: Number(planEditorForm.annualPriceInr),
        features: planEditorForm.features,
        limits: planEditorForm.limits
      };

      // 1. Emit realtime WebSocket broadcast
      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-update-plan', {
          planCode: selectedPlanCode,
          updates,
          user: activeUser
        });
      }

      // 2. Call backend REST endpoint
      try {
        await fetch(`/api/v1/admin/plans/${selectedPlanCode}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-name': activeUser.name
          },
          body: JSON.stringify(updates)
        });
      } catch (e) {
        // Local fallback
      }

      entitlementService.updatePlan(selectedPlanCode, updates);
      setPlansCatalog(entitlementService.getAllPlans());
      setIsPlanDirty(false);
      triggerToast(`Plan "${planEditorForm.name}" updated & broadcasted live!`, 'success');
    } catch (err: any) {
      triggerToast(`Plan update failed: ${err.message}`, 'info');
    }
  };

  const handleResetPlansCatalog = async () => {
    if (!window.confirm('Reset all subscription plans and pricing matrices back to system defaults?')) return;
    try {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-reset-plans', { user: activeUser });
      }
      try {
        await fetch('/api/v1/admin/plans/reset', { method: 'POST' });
      } catch (e) {
        // Local fallback
      }
      const resetPlans = entitlementService.resetPlansToDefault();
      setPlansCatalog(resetPlans);
      const currentSelected = resetPlans.find(p => p.code === selectedPlanCode) || resetPlans[0];
      setPlanEditorForm(JSON.parse(JSON.stringify(currentSelected)));
      setIsPlanDirty(false);
      triggerToast('All plans restored to factory defaults and broadcasted!', 'success');
    } catch (err: any) {
      triggerToast('Plan reset completed', 'info');
    }
  };

  const handleSaveTenantCustomPackage = async () => {
    try {
      const overrides = {
        planId: tenantCustomForm.planId,
        customPlanName: tenantCustomForm.customPlanName || undefined,
        customMonthlyPrice: tenantCustomForm.customMonthlyPrice !== '' ? Number(tenantCustomForm.customMonthlyPrice) : undefined,
        customAnnualPrice: tenantCustomForm.customAnnualPrice !== '' ? Number(tenantCustomForm.customAnnualPrice) : undefined,
        customNotes: tenantCustomForm.customNotes || undefined,
        enabledFeatures: tenantCustomForm.enabledFeatures,
        disabledFeatures: tenantCustomForm.disabledFeatures
      };

      if (socketRef.current && isConnected) {
        socketRef.current.emit('superadmin-customize-tenant-plan', {
          tenantId: selectedTenantForCustom,
          overrides,
          user: activeUser
        });
      }

      try {
        await fetch(`/api/v1/admin/tenants/${selectedTenantForCustom}/custom-plan`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-name': activeUser.name
          },
          body: JSON.stringify(overrides)
        });
      } catch (e) {
        // Local fallback
      }

      const updatedSub = entitlementService.customizeTenantSubscription(selectedTenantForCustom, overrides);
      if (selectedTenantForCustom === currentTenantId) {
        setActiveSubscription(updatedSub);
      }
      triggerToast(`Custom package saved for tenant "${selectedTenantForCustom}" & synced in real-time!`, 'success');
    } catch (err: any) {
      triggerToast(`Saved customization for tenant ${selectedTenantForCustom}`, 'success');
    }
  };

  const togglePlanFeature = (feature: Feature) => {
    setIsPlanDirty(true);
    setPlanEditorForm(prev => {
      const exists = prev.features.includes(feature);
      const updated = exists ? prev.features.filter(f => f !== feature) : [...prev.features, feature];
      return { ...prev, features: updated };
    });
  };

  const toggleTenantCustomFeature = (feature: Feature, mode: 'enable' | 'disable') => {
    setTenantCustomForm(prev => {
      if (mode === 'enable') {
        const isCurrentlyEnabled = prev.enabledFeatures.includes(feature);
        const newEnabled = isCurrentlyEnabled 
          ? prev.enabledFeatures.filter(f => f !== feature)
          : [...prev.enabledFeatures, feature];
        return { 
          ...prev, 
          enabledFeatures: newEnabled, 
          disabledFeatures: prev.disabledFeatures.filter(f => f !== feature) 
        };
      } else {
        const isCurrentlyDisabled = prev.disabledFeatures.includes(feature);
        const newDisabled = isCurrentlyDisabled
          ? prev.disabledFeatures.filter(f => f !== feature)
          : [...prev.disabledFeatures, feature];
        return { 
          ...prev, 
          disabledFeatures: newDisabled, 
          enabledFeatures: prev.enabledFeatures.filter(f => f !== feature) 
        };
      }
    });
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

      {/* PAGE HEADER WITH DYNAMIC ADAPTATION FOR STARTER PLAN VS MULTI-ENTITY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-slate-800" size={22} />
            {isStarterOrSingleEntity ? 'Organization Profile' : 'Organization & Multi-Entity Management'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isStarterOrSingleEntity
              ? 'Manage your registered company profile, statutory GSTINs, branch network, and authorized signatories'
              : 'Super Admin platform governance, live plan customization, dynamic price updates, and multi-tenant isolation'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Active Workspace / Organization Indicator */}
          {isStarterOrSingleEntity ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500">Active Tenant:</span>
              <span className="text-xs font-bold text-slate-800">
                {allTenants.find(t => t.id === currentTenantId)?.tradeName || allTenants.find(t => t.id === currentTenantId)?.legalName || 'Acme Cloud Solutions'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                STARTER
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500">Active Tenant:</span>
              <select
                value={currentTenantId}
                onChange={(e) => onTenantSwitch && onTenantSwitch(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {allTenants.map((t) => {
                  const sub = entitlementService.getSubscription(t.id);
                  const plan = sub ? sub.planId : 'STARTER';
                  return (
                    <option key={t.id} value={t.id}>
                      {t.tradeName || t.legalName} ({plan})
                    </option>
                  );
                })}
              </select>
              {activeSubscription && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  activeSubscription.planId === PlanCode.ENTERPRISE || activeSubscription.planId === PlanCode.ENTERPRISE_PLUS
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : activeSubscription.planId === PlanCode.PROFESSIONAL
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : activeSubscription.planId === PlanCode.BUSINESS
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {activeSubscription.planId}
                </span>
              )}
            </div>
          )}

          {/* Super Admin Command Shortcut Button - Only visible for Super Admin */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('/super-admin');
                } else {
                  window.location.hash = '#/super-admin';
                }
              }}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <Crown size={15} className="text-amber-600" />
              Super Admin Command
            </button>
          )}

          {/* New Tenant Creation Button - Gated strictly for Multi-Entity Plans */}
          {!isStarterOrSingleEntity && (
            <button
              onClick={() => setShowCreateTenantModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              New Organization
            </button>
          )}
        </div>
      </div>

      {/* SUB-MODULE NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          ...((!isStarterOrSingleEntity || isSuperAdmin) ? [
            { id: 'TENANTS', label: 'Organizations & Plans', icon: Shield, color: 'text-indigo-600', count: allTenants.length, badge: undefined }
          ] : []),
          { id: 'COMPANY', label: 'Company Profile', icon: Building, color: 'text-indigo-600', badge: undefined },
          { id: 'GSTIN', label: isStarterPlan ? 'GSTIN Registration' : 'GSTIN Registrations', icon: FileCheck, color: 'text-emerald-600', count: isStarterPlan ? 1 : gstinList.length, badge: undefined },
          { id: 'BRANCHES', label: 'Branch Network', icon: MapPin, color: 'text-amber-600', count: branches.length, badge: undefined },
          { id: 'FY_SETTINGS', label: 'FY & Lock Date', icon: Calendar, color: 'text-sky-600', badge: undefined },
          { id: 'STATE_CONFIG', label: 'State Rules', icon: Settings, color: 'text-purple-600', badge: undefined },
          { id: 'BUSINESS_PROFILE', label: 'Business Profile', icon: Briefcase, color: 'text-rose-600', badge: undefined },
          { id: 'SIGNATORIES', label: 'Signatories & DSC', icon: UserCheck, color: 'text-teal-600', count: signatories.length, badge: undefined },
          ...((isSuperAdmin || subProfile.canDatabaseSync) ? [
            { id: 'NEON_DATASETS', label: 'Postgres Neon Multi-Tenant', icon: Database, color: 'text-blue-600', badge: undefined }
          ] : [])
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

              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                  isActive ? 'bg-indigo-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {tab.badge}
                </span>
              )}

              {tab.count !== undefined && !tab.badge && (
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

      {/* SUB-MODULE SUPER ADMIN: CONSOLIDATED INTO SUPER ADMIN COMMAND (Strictly Super Admin Only) */}
      {activeSubTab === 'SUPER_ADMIN' && isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center mx-auto shadow-sm">
            <Crown size={32} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Super Admin Plan Studio & Governance</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Super Admin Plan Studio, real-time tenant creation velocity telemetry, pricing customization, and platform module kill-switches have been consolidated into the dedicated Super Admin Command dashboard.
            </p>
          </div>
          <button
            onClick={() => {
              if (onNavigate) onNavigate('/super-admin');
              else window.location.hash = '#/super-admin';
            }}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer border border-amber-400"
          >
            <Crown size={16} /> Open Super Admin Command
          </button>
        </div>
      )}

      {/* SUB-MODULE 0: ALL ORGANIZATIONS & PLAN ENTITLEMENTS HUB */}
      {activeSubTab === 'TENANTS' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Metric & Control Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  MULTI-TENANT ISOLATION ENGINE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  RLS & HOF SCOPING ACTIVE
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Organization & Multi-Entity Tenant Directory
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Manage all registered legal entities, statutory PANs, and plan-based feature entitlements. Every organization operates within strict database boundaries with automatic tenant scoping.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  if (isStarterOrSingleEntity && allTenants.length >= subProfile.maxCompanies) {
                    setUpgradeModalInfo({
                      isOpen: true,
                      targetPlan: PlanCode.BUSINESS,
                      targetPlanName: 'Business Growth',
                      featureTitle: 'Multi-Company & Conglomerate Workspace Expansion',
                      featureDesc: `Starter SME plan is restricted to 1 active company entity (${subProfile.maxCompanies} quota utilized). Upgrade to Business (3 entities) or Enterprise (Unlimited) to provision and isolate multi-entity subsidiaries.`,
                      bullets: [
                        'Consolidated conglomerate tax rollups and subsidiary isolation',
                        'Multi-PAN corporate structures with dedicated access control',
                        'Inter-company invoice reconciliation and shared master catalogs'
                      ]
                    });
                    return;
                  }
                  setShowCreateTenantModal(true);
                }}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Plus size={16} />
                Create New Organization
              </button>
            </div>
          </div>

          {/* Plan Comparison Guide Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { code: PlanCode.STARTER, name: 'Starter SME', price: '₹2,999/mo', desc: 'Invoices, Purchases & GST Returns', color: 'border-amber-200 bg-amber-50/50 text-amber-900' },
              { code: PlanCode.BUSINESS, name: 'Business Growth', price: '₹6,999/mo', desc: 'Starter + E-Way Bill & ITC Reconcile', color: 'border-emerald-200 bg-emerald-50/50 text-emerald-900' },
              { code: PlanCode.PROFESSIONAL, name: 'Professional Compliance', price: '₹14,999/mo', desc: 'Business + E-Invoice IRN & Multi-GSTIN', color: 'border-indigo-200 bg-indigo-50/50 text-indigo-900' },
              { code: PlanCode.ENTERPRISE, name: 'Enterprise Multi-Entity', price: '₹34,999/mo', desc: 'Professional + AI Engine & ERP Sync', color: 'border-purple-200 bg-purple-50/50 text-purple-900' },
            ].map(p => (
              <div key={p.code} className={`p-4 rounded-xl border ${p.color} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase">{p.name}</span>
                    <span className="text-[11px] font-mono font-bold">{p.price}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Organizations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allTenants.map((t) => {
              const sub = entitlementService.getSubscription(t.id);
              const plan = sub ? sub.planId : PlanCode.STARTER;
              const isCurrent = t.id === currentTenantId;
              const gstins = tenantService.getTenantGstins(t.id);
              const branchesCount = tenantService.getTenantBranches(t.id).length;

              const hasEinvoice = entitlementService.hasFeature(t.id, Feature.E_INVOICE);
              const hasEway = entitlementService.hasFeature(t.id, Feature.E_WAY_BILL);
              const hasRecon = entitlementService.hasFeature(t.id, Feature.RECONCILIATION);
              const hasAi = entitlementService.hasFeature(t.id, Feature.AI);

              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between relative shadow-xs hover:shadow-md ${
                    isCurrent ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active Workspace
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          {t.tradeName || t.legalName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[200px]">
                          {t.legalName}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase shrink-0 ${
                        plan === PlanCode.ENTERPRISE || plan === PlanCode.ENTERPRISE_PLUS
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : plan === PlanCode.PROFESSIONAL
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : plan === PlanCode.BUSINESS
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {plan}
                      </span>
                    </div>

                    {/* Metadata table */}
                    <div className="bg-slate-50 rounded-xl p-3 text-[11px] space-y-1.5 border border-slate-100 font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Tenant ID:</span>
                        <span className="font-bold text-slate-900">{t.id}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>PAN Number:</span>
                        <span className="font-bold text-slate-900">{t.pan}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Subdomain:</span>
                        <span className="text-indigo-600">{t.subdomain}.taxflow.io</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Registrations:</span>
                        <span className="font-bold text-slate-900">{gstins.length} GSTIN · {branchesCount} Branches</span>
                      </div>
                    </div>

                    {/* Feature Matrix Badges */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Module Entitlements:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Invoices & Purchases
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          hasEway ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        }`}>
                          E-Way Bill
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          hasRecon ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        }`}>
                          Reconciliation
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          hasEinvoice ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        }`}>
                          E-Invoice IRN
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          hasAi ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                        }`}>
                          AI & ERP
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Plan change dropdown */}
                    <select
                      value={plan}
                      onChange={(e) => handleUpgradePlan(t.id, e.target.value as PlanCode)}
                      className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value={PlanCode.STARTER}>Starter Plan</option>
                      <option value={PlanCode.BUSINESS}>Business Plan</option>
                      <option value={PlanCode.PROFESSIONAL}>Professional Plan</option>
                      <option value={PlanCode.ENTERPRISE}>Enterprise Plan</option>
                      <option value={PlanCode.ENTERPRISE_PLUS}>Enterprise Plus</option>
                    </select>

                    {isCurrent ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={14} /> Active
                      </span>
                    ) : (
                      <button
                        onClick={() => onTenantSwitch && onTenantSwitch(t.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Switch Workspace <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileCheck className="text-emerald-600" size={20} />
                  {isStarterPlan ? 'Single-State GST Registration' : 'GST Registrations & Multi-State Directory'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isStarterPlan ? 'Single-State Active (1 GSTIN)' : `Quota: ${gstinList.length} / ${isSuperAdmin ? '∞' : subProfile.maxGstins} GSTINs`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isStarterPlan
                  ? `Statutory GSTIN registration for your primary business state (${gstinList[0]?.stateName || 'Maharashtra'})`
                  : 'Manage state-wise GSTIN numbers, filing frequencies, and primary HQ flags'}
              </p>
            </div>

            {!isStarterPlan && (
              <button
                onClick={() => {
                  if (!isSuperAdmin && gstinList.length >= subProfile.maxGstins) {
                    setUpgradeModalInfo({
                      isOpen: true,
                      targetPlan: PlanCode.BUSINESS,
                      targetPlanName: 'Business Growth',
                      featureTitle: 'Multi-State GSTIN Expansion',
                      featureDesc: `Starter SME plan includes 1 state registration (${subProfile.maxGstins} quota utilized). Upgrade to Business (3 GSTINs) or Professional (10 GSTINs) to register and file multi-state returns.`,
                      bullets: [
                        'Register interstate branch GSTINs across Maharashtra, Delhi, Karnataka, etc.',
                        'Consolidated state-by-state GSTR-1 & GSTR-3B filings',
                        'State-level ITC auto-reconciliation and E-Way bill generation'
                      ]
                    });
                    return;
                  }
                  setShowAddGstinModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Register New GSTIN
              </button>
            )}
          </div>

          {/* Quota Progress Banner - Only for Multi-State Plans when limit reached */}
          {!isSuperAdmin && !isStarterPlan && gstinList.length >= subProfile.maxGstins && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-800 flex items-center justify-center font-bold text-xs">
                  {gstinList.length}/{subProfile.maxGstins}
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    Plan GSTIN Limit Reached ({gstinList.length} of {subProfile.maxGstins} GSTINs registered)
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Your current workspace has utilized 100% of allowed registrations. Upgrade for additional interstate state returns.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUpgradeModalInfo({
                    isOpen: true,
                    targetPlan: PlanCode.PROFESSIONAL,
                    targetPlanName: 'Professional',
                    featureTitle: 'Multi-State GSTIN Expansion',
                    featureDesc: `Upgrade to Professional (10 GSTINs) to register additional branch GSTINs across states.`,
                    bullets: [
                      'Register state branches across Maharashtra, Delhi, Karnataka, etc.',
                      'Consolidated state-by-state GSTR-1 & GSTR-3B filings',
                      'State-level ITC auto-reconciliation and E-Way bill generation'
                    ]
                  });
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
              >
                Upgrade Plan
              </button>
            </div>
          )}

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

      {/* SUB-MODULE 3: BRANCH & COST CENTER MANAGEMENT */}
      {activeSubTab === 'BRANCHES' && (
        <div className="space-y-6 animate-in fade-in">
          <BranchManagerModule tenantId={currentTenantId} />
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
          <PlanGuard
            feature={Feature.ERP_INTEGRATION}
            minPlan={PlanCode.ENTERPRISE}
            mode="upgrade-card"
            upgradeTitle="Postgres Neon Multi-Tenant Cloud Data Platform"
            upgradeDescription="Dedicated PostgreSQL Neon schema isolation, multi-tenant database branch pipelines, and real-time CDC synchronization require the Enterprise Multi-Entity Plan."
          >
            <NeonMultiTenantDatabaseCenter
              currentTenantId={currentTenantId}
              onShowToast={(msg) => triggerToast(msg, 'success')}
            />
          </PlanGuard>
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

      {/* CREATE NEW TENANT & PLAN PROVISIONING MODAL */}
      {showCreateTenantModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                    New Workspace Provisioning
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">Create Organization & Select Plan</h3>
                <p className="text-xs text-slate-300">
                  Provision an isolated tenant environment with automated plan entitlements and statutory GST configuration
                </p>
              </div>
              <button
                onClick={() => setShowCreateTenantModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateTenant} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Step 1: Legal Entity Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Building size={14} className="text-indigo-600" /> Statutory Legal Entity Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Legal Name (as per PAN/MCA) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Logistics Private Limited"
                      value={newTenantForm.legalName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
                        setNewTenantForm({
                          ...newTenantForm,
                          legalName: val,
                          subdomain: newTenantForm.subdomain || autoSlug
                        });
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Trade / Brand Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Logistics"
                      value={newTenantForm.tradeName}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, tradeName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Entity PAN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="AAAAA0000A"
                      value={newTenantForm.pan}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, pan: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400">10 characters (5 letters, 4 digits, 1 letter)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Registered State <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newTenantForm.stateCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setNewTenantForm({
                          ...newTenantForm,
                          stateCode: code,
                          stateName: stateNames[code] || 'State ' + code
                        });
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      {Object.entries(stateNames).map(([code, name]) => (
                        <option key={code} value={code}>
                          {code} - {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Head Office City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={newTenantForm.city}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Industry / Sector
                    </label>
                    <select
                      value={newTenantForm.sector}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, sector: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="Information Technology & SaaS">Information Technology & SaaS</option>
                      <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                      <option value="Manufacturing & Industrial">Manufacturing & Industrial</option>
                      <option value="Retail & E-Commerce">Retail & E-Commerce</option>
                      <option value="Financial Services & Banking">Financial Services & Banking</option>
                      <option value="Healthcare & Pharmaceuticals">Healthcare & Pharmaceuticals</option>
                      <option value="General Commercial & Services">General Commercial & Services</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tenant Subdomain
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        placeholder="apex-logistics"
                        value={newTenantForm.subdomain}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        className="w-full px-3.5 py-2.5 rounded-l-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <span className="bg-slate-100 border border-l-0 border-slate-200 px-3 py-2.5 rounded-r-xl text-xs text-slate-500 font-mono">
                        .taxflow.io
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Select Subscription Plan */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-600" /> Choose Subscription Plan & Feature Entitlements
                  </h4>

                  {/* Billing Cycle Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setNewTenantForm({ ...newTenantForm, billingCycle: 'MONTHLY' })}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        newTenantForm.billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTenantForm({ ...newTenantForm, billingCycle: 'ANNUAL' })}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                        newTenantForm.billingCycle === 'ANNUAL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Annual <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded">-17%</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    {
                      code: PlanCode.STARTER,
                      name: 'Starter SME',
                      price: newTenantForm.billingCycle === 'ANNUAL' ? '₹29,990/yr' : '₹2,999/mo',
                      badge: 'Basic Tier',
                      color: 'border-amber-200 hover:border-amber-400 bg-amber-50/20',
                      features: ['Invoices & Purchases', 'GSTR-1 & 3B Returns', '1 GSTIN & 1 Branch', 'Up to 5 Users'],
                      locked: ['E-Invoice IRN', 'E-Way Bill', 'Multi-GSTIN']
                    },
                    {
                      code: PlanCode.BUSINESS,
                      name: 'Business Growth',
                      price: newTenantForm.billingCycle === 'ANNUAL' ? '₹69,990/yr' : '₹6,999/mo',
                      badge: 'Popular',
                      color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/20',
                      features: ['Invoices, Purchases & Returns', 'E-Way Bill Generation', 'GSTR-2B ITC Reconciliation', '2 GSTINs & 5 Branches'],
                      locked: ['E-Invoice IRN', 'AI Insights']
                    },
                    {
                      code: PlanCode.PROFESSIONAL,
                      name: 'Professional Compliance',
                      price: newTenantForm.billingCycle === 'ANNUAL' ? '₹1,49,990/yr' : '₹14,999/mo',
                      badge: 'Recommended',
                      color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20',
                      features: ['Everything in Business', 'NIC E-Invoice QR & IRN', 'Multi-GSTIN (5 GSTINs)', 'Auto Filing & Workflows', 'Audit Logging & RBAC'],
                      locked: ['AI Copilot & ERP Sync']
                    },
                    {
                      code: PlanCode.ENTERPRISE,
                      name: 'Enterprise Multi-Entity',
                      price: newTenantForm.billingCycle === 'ANNUAL' ? '₹3,49,990/yr' : '₹34,999/mo',
                      badge: 'Full Suite',
                      color: 'border-purple-200 hover:border-purple-400 bg-purple-50/20',
                      features: ['Complete Tax & GST Suite', 'Gemini AI Assistant', 'ERP / SAP Integration', 'Unlimited Branches & 20 GSTINs', 'Webhooks & Dedicated RLS'],
                      locked: []
                    }
                  ].map((p) => {
                    const isSelected = newTenantForm.planCode === p.code;
                    return (
                      <div
                        key={p.code}
                        onClick={() => setNewTenantForm({ ...newTenantForm, planCode: p.code })}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-900">{p.name}</span>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                              {p.badge}
                            </span>
                          </div>
                          <div className="text-sm font-extrabold text-slate-900 font-mono mb-2">
                            {p.price}
                          </div>
                          <div className="space-y-1">
                            {p.features.map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                                <Check size={12} className="text-emerald-600 shrink-0" /> {f}
                              </div>
                            ))}
                            {p.locked.map((l, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400 line-through">
                                <X size={12} className="text-slate-300 shrink-0" /> {l}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className={`font-bold ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {isSelected ? '✓ Selected Plan' : 'Click to select'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Statutory Entity Auto-Provisioning Preview */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Automated Entity Provisioning Checklist:
                </span>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                  <li>Creates root tenant entity with database RLS scoping</li>
                  <li>Initializes primary head office branch in <strong className="text-slate-800">{newTenantForm.city || 'State Capital'} ({stateNames[newTenantForm.stateCode] || newTenantForm.stateCode})</strong></li>
                  <li>Provisions statutory GSTIN registration: <strong className="font-mono text-indigo-700">{newTenantForm.stateCode}{newTenantForm.pan ? newTenantForm.pan : 'AAAAA0000A'}1Z5</strong></li>
                  <li>Assigns creator as <strong className="text-slate-800">SUPER_ADMIN</strong> with complete organization ownership</li>
                  <li>Binds subscription with plan entitlement gates for <strong className="text-slate-800">{newTenantForm.planCode}</strong></li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateTenantModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Provision Organization & Launch Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instant Upgrade Modal */}
      <InstantUpgradeModal
        isOpen={upgradeModalInfo.isOpen}
        onClose={() => setUpgradeModalInfo(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          handleUpgradePlan(currentTenantId, upgradeModalInfo.targetPlan);
          setUpgradeModalInfo(prev => ({ ...prev, isOpen: false }));
        }}
        currentPlanName={activeSubscription?.planId ? PLAN_DISPLAY_NAMES[activeSubscription.planId] || activeSubscription.planId : 'Starter SME'}
        targetPlan={upgradeModalInfo.targetPlan}
        targetPlanName={upgradeModalInfo.targetPlanName}
        featureTitle={upgradeModalInfo.featureTitle}
        featureDescription={upgradeModalInfo.featureDesc}
        featureBullets={upgradeModalInfo.bullets}
      />
    </div>
  );
};

export default OrganizationModule;
