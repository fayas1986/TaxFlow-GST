import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, UserCheck, ShieldCheck, Plus, Search, Filter, 
  Edit2, Trash2, CheckCircle2, AlertCircle, FileText, Download, Upload, 
  Sparkles, Layers, Tag, CreditCard, RefreshCw, Phone, Mail, MapPin, 
  ShieldAlert, Check, X, FileSpreadsheet, Info, Award, HelpCircle, ArrowRight,
  ArrowUp, ArrowDown, ArrowUpDown, LayoutGrid, TableProperties
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CustomerMaster, VendorMaster, MsmeStatus, CreditTerms, 
  loadCustomers, saveCustomers, createCustomer, updateCustomer, deleteCustomer,
  loadVendors, saveVendors, createVendor, updateVendor, deleteVendor,
  resetPartyMasterToSeed, VENDOR_CATEGORY_OPTIONS, CREDIT_TERMS_LABELS, MSME_STATUS_LABELS,
  extractPanFromGstin, extractStateCodeFromGstin
} from '../services/partyMasterService';
import { PartyMasterPagination } from './PartyMasterPagination';

export const PartyMasterModule: React.FC = () => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'VENDORS' | 'MSME_RCM_DIRECTORY' | 'BULK_IMPORT'>('CUSTOMERS');

  // Customer & Vendor Lists
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [vendors, setVendors] = useState<VendorMaster[]>([]);

  // Pagination States
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(10);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [creditFilter, setCreditFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [msmeFilter, setMsmeFilter] = useState('ALL');
  const [rcmFilter, setRcmFilter] = useState('ALL');
  const [compositionFilter, setCompositionFilter] = useState('ALL');

  // Advanced filters states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [cityFilter, setCityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [gstinStatusFilter, setGstinStatusFilter] = useState('ALL');
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState('ALL');
  const [minCreditLimit, setMinCreditLimit] = useState('');
  const [maxCreditLimit, setMaxCreditLimit] = useState('');
  const [sortField, setSortField] = useState<'NAME' | 'CODE' | 'STATE' | 'CREDIT_LIMIT' | 'MSME_STATUS'>('NAME');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Multi-column sorting & layout states
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [partySortConfigs, setPartySortConfigs] = useState<{ key: 'NAME' | 'CODE' | 'STATE' | 'CREDIT_LIMIT' | 'MSME_STATUS' | 'STATUS'; direction: 'ASC' | 'DESC' }[]>([
    { key: 'NAME', direction: 'ASC' }
  ]);

  // Synchronize legacy sort selection with multi-column sort configurations
  useEffect(() => {
    setPartySortConfigs(prev => {
      if (prev.length > 0 && prev[0].key === sortField && prev[0].direction === sortOrder) {
        return prev;
      }
      return [{ key: sortField as any, direction: sortOrder }];
    });
  }, [sortField, sortOrder]);

  const handlePartySort = (key: 'NAME' | 'CODE' | 'STATE' | 'CREDIT_LIMIT' | 'MSME_STATUS' | 'STATUS', isShiftKey: boolean = false) => {
    setPartySortConfigs(prev => {
      let newConfigs;
      const existingIdx = prev.findIndex(c => c.key === key);
      if (isShiftKey) {
        if (existingIdx > -1) {
          const current = prev[existingIdx];
          if (current.direction === 'ASC') {
            const updated = [...prev];
            updated[existingIdx] = { key, direction: 'DESC' };
            newConfigs = updated;
          } else {
            newConfigs = prev.filter(c => c.key !== key);
          }
        } else {
          newConfigs = [...prev, { key, direction: 'ASC' }];
        }
      } else {
        if (existingIdx > -1) {
          const current = prev[existingIdx];
          if (current.direction === 'ASC') {
            const filtered = prev.filter(c => c.key !== key);
            newConfigs = [{ key, direction: 'DESC' as const }, ...filtered];
          } else {
            newConfigs = prev.filter(c => c.key !== key);
          }
        } else {
          newConfigs = [{ key, direction: 'ASC' as const }, ...prev].slice(0, 4);
        }
      }

      // Sync first config with legacy single-column states
      if (newConfigs.length > 0) {
        const primary = newConfigs[0];
        if (primary.key === 'NAME' || primary.key === 'CODE' || primary.key === 'STATE' || primary.key === 'CREDIT_LIMIT' || primary.key === 'MSME_STATUS') {
          setSortField(primary.key);
        }
        setSortOrder(primary.direction);
      }
      return newConfigs;
    });
  };

  const PartySortHeader: React.FC<{ label: string; sortKey: 'NAME' | 'CODE' | 'STATE' | 'CREDIT_LIMIT' | 'MSME_STATUS' | 'STATUS'; align?: 'left' | 'right' }> = ({ label, sortKey, align = 'left' }) => {
    const configIndex = partySortConfigs.findIndex(c => c.key === sortKey);
    const activeConfig = configIndex > -1 ? partySortConfigs[configIndex] : null;

    const handleClick = (e: React.MouseEvent) => {
      handlePartySort(sortKey, e.shiftKey);
    };

    return (
      <th 
        className={`px-6 py-4 font-semibold text-xs uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-50 hover:text-slate-700 transition-colors group select-none whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`} 
        onClick={handleClick}
        title="Click to sort (Shift+Click for multi-column sort)"
      >
        <div className={`flex items-center gap-1.5 w-full ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <span>{label}</span>
          <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-blue-600 transition-colors">
            {activeConfig ? (
              <div className="flex items-center gap-0.5">
                {activeConfig.direction === 'ASC' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />}
                <span className="text-[9px] px-1 bg-blue-100 text-blue-700 rounded-md font-extrabold leading-none">
                  {configIndex + 1}
                </span>
              </div>
            ) : (
              <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Reset filters when activeTab changes
  useEffect(() => {
    setSearchQuery('');
    setStateFilter('ALL');
    setCreditFilter('ALL');
    setCategoryFilter('ALL');
    setMsmeFilter('ALL');
    setRcmFilter('ALL');
    setCompositionFilter('ALL');
    setCityFilter('ALL');
    setStatusFilter('ALL');
    setGstinStatusFilter('ALL');
    setVendorCategoryFilter('ALL');
    setMinCreditLimit('');
    setMaxCreditLimit('');
    setSortField('NAME');
    setSortOrder('ASC');
    setCustomerPage(1);
    setVendorPage(1);
  }, [activeTab]);

  // Reset pagination on filter or query change
  useEffect(() => {
    setCustomerPage(1);
    setVendorPage(1);
  }, [
    searchQuery, stateFilter, creditFilter, categoryFilter, msmeFilter,
    rcmFilter, compositionFilter, cityFilter, statusFilter, gstinStatusFilter,
    vendorCategoryFilter, minCreditLimit, maxCreditLimit, partySortConfigs
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStateFilter('ALL');
    setCreditFilter('ALL');
    setCategoryFilter('ALL');
    setMsmeFilter('ALL');
    setRcmFilter('ALL');
    setCompositionFilter('ALL');
    setCityFilter('ALL');
    setStatusFilter('ALL');
    setGstinStatusFilter('ALL');
    setVendorCategoryFilter('ALL');
    setMinCreditLimit('');
    setMaxCreditLimit('');
    setSortField('NAME');
    setSortOrder('ASC');
    setCustomerPage(1);
    setVendorPage(1);
    showToast('Filters cleared successfully');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (stateFilter !== 'ALL') count++;
    if (cityFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (gstinStatusFilter !== 'ALL') count++;
    
    if (activeTab === 'CUSTOMERS') {
      if (creditFilter !== 'ALL') count++;
      if (minCreditLimit !== '') count++;
      if (maxCreditLimit !== '') count++;
    } else if (activeTab === 'VENDORS') {
      if (msmeFilter !== 'ALL') count++;
      if (rcmFilter !== 'ALL') count++;
      if (compositionFilter !== 'ALL') count++;
      if (vendorCategoryFilter !== 'ALL') count++;
    }
    return count;
  };

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerMaster | null>(null);

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorMaster | null>(null);

  // Customer Form State
  const [custForm, setCustForm] = useState({
    name: '',
    tradeName: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    pincode: '',
    state: 'Maharashtra',
    stateCode: '27',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    creditTerms: 'NET_30' as CreditTerms,
    creditLimitINR: 5000000,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    notes: ''
  });

  // Vendor Form State
  const [vendForm, setVendForm] = useState({
    name: '',
    tradeName: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    pincode: '',
    state: 'Maharashtra',
    stateCode: '27',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'NON_MSME' as MsmeStatus,
    udyamRegistrationNo: '',
    vendorCategories: [] as string[],
    creditTerms: 'NET_30' as CreditTerms,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankName: '',
    notes: ''
  });

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setCustomers(loadCustomers());
    setVendors(loadVendors());
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // GSTIN change handlers with auto PAN extraction
  const handleCustGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    const pan = extractPanFromGstin(clean);
    const stCode = extractStateCodeFromGstin(clean);
    setCustForm(prev => ({
      ...prev,
      gstin: clean,
      pan: pan || prev.pan,
      stateCode: stCode || prev.stateCode
    }));
  };

  const handleVendGstinChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    const pan = extractPanFromGstin(clean);
    const stCode = extractStateCodeFromGstin(clean);
    setVendForm(prev => ({
      ...prev,
      gstin: clean,
      pan: pan || prev.pan,
      stateCode: stCode || prev.stateCode
    }));
  };

  // Open Customer Modal
  const openNewCustomerModal = () => {
    setEditingCustomer(null);
    setCustForm({
      name: '',
      tradeName: '',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      address: '',
      city: 'Mumbai',
      pincode: '400001',
      state: 'Maharashtra',
      stateCode: '27',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactDesignation: '',
      creditTerms: 'NET_30',
      creditLimitINR: 5000000,
      status: 'ACTIVE',
      notes: ''
    });
    setIsCustomerModalOpen(true);
  };

  const openEditCustomerModal = (cust: CustomerMaster) => {
    setEditingCustomer(cust);
    setCustForm({
      name: cust.name,
      tradeName: cust.tradeName || '',
      gstin: cust.gstin,
      pan: cust.pan,
      address: cust.address,
      city: cust.city,
      pincode: cust.pincode,
      state: cust.state,
      stateCode: cust.stateCode,
      contactName: cust.contact.name,
      contactEmail: cust.contact.email,
      contactPhone: cust.contact.phone,
      contactDesignation: cust.contact.designation || '',
      creditTerms: cust.creditTerms,
      creditLimitINR: cust.creditLimitINR || 0,
      status: cust.status,
      notes: cust.notes || ''
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim()) {
      showToast('Customer Name is required');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name: custForm.name,
        tradeName: custForm.tradeName,
        gstin: custForm.gstin,
        pan: custForm.pan,
        address: custForm.address,
        city: custForm.city,
        pincode: custForm.pincode,
        state: custForm.state,
        stateCode: custForm.stateCode,
        contact: {
          name: custForm.contactName,
          email: custForm.contactEmail,
          phone: custForm.contactPhone,
          designation: custForm.contactDesignation
        },
        creditTerms: custForm.creditTerms,
        creditLimitINR: custForm.creditLimitINR,
        status: custForm.status,
        notes: custForm.notes
      });
      showToast(`Updated Customer ${custForm.name}`);
    } else {
      createCustomer({
        name: custForm.name,
        tradeName: custForm.tradeName,
        gstin: custForm.gstin,
        pan: custForm.pan,
        address: custForm.address,
        city: custForm.city,
        pincode: custForm.pincode,
        state: custForm.state,
        stateCode: custForm.stateCode,
        contact: {
          name: custForm.contactName,
          email: custForm.contactEmail,
          phone: custForm.contactPhone,
          designation: custForm.contactDesignation
        },
        creditTerms: custForm.creditTerms,
        creditLimitINR: custForm.creditLimitINR,
        status: custForm.status,
        notes: custForm.notes
      });
      showToast(`Created Customer ${custForm.name}`);
    }

    refreshData();
    setIsCustomerModalOpen(false);
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete customer ${name}?`)) {
      deleteCustomer(id);
      refreshData();
      showToast(`Deleted Customer ${name}`);
    }
  };

  // Open Vendor Modal
  const openNewVendorModal = () => {
    setEditingVendor(null);
    setVendForm({
      name: '',
      tradeName: '',
      gstin: '27AAAFP1234K1Z2',
      pan: 'AAAFP1234K',
      address: '',
      city: 'Pune',
      pincode: '411001',
      state: 'Maharashtra',
      stateCode: '27',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactDesignation: '',
      reverseCharge: false,
      compositionScheme: false,
      msmeStatus: 'MICRO',
      udyamRegistrationNo: 'UDYAM-MH-26-0012345',
      vendorCategories: ['Raw Material & Tooling'],
      creditTerms: 'NET_30',
      status: 'ACTIVE',
      bankAccountName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankName: '',
      notes: ''
    });
    setIsVendorModalOpen(true);
  };

  const openEditVendorModal = (vend: VendorMaster) => {
    setEditingVendor(vend);
    setVendForm({
      name: vend.name,
      tradeName: vend.tradeName || '',
      gstin: vend.gstin,
      pan: vend.pan,
      address: vend.address,
      city: vend.city,
      pincode: vend.pincode,
      state: vend.state,
      stateCode: vend.stateCode,
      contactName: vend.contact.name,
      contactEmail: vend.contact.email,
      contactPhone: vend.contact.phone,
      contactDesignation: vend.contact.designation || '',
      reverseCharge: vend.reverseCharge,
      compositionScheme: vend.compositionScheme,
      msmeStatus: vend.msmeStatus,
      udyamRegistrationNo: vend.udyamRegistrationNo || '',
      vendorCategories: vend.vendorCategories || [],
      creditTerms: vend.creditTerms,
      status: vend.status,
      bankAccountName: vend.bankDetails?.accountName || '',
      bankAccountNumber: vend.bankDetails?.accountNumber || '',
      bankIfscCode: vend.bankDetails?.ifscCode || '',
      bankName: vend.bankDetails?.bankName || '',
      notes: vend.notes || ''
    });
    setIsVendorModalOpen(true);
  };

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendForm.name.trim()) {
      showToast('Vendor Name is required');
      return;
    }

    const bankDetails = (vendForm.bankAccountName || vendForm.bankAccountNumber) ? {
      accountName: vendForm.bankAccountName,
      accountNumber: vendForm.bankAccountNumber,
      ifscCode: vendForm.bankIfscCode,
      bankName: vendForm.bankName
    } : undefined;

    if (editingVendor) {
      updateVendor(editingVendor.id, {
        name: vendForm.name,
        tradeName: vendForm.tradeName,
        gstin: vendForm.gstin,
        pan: vendForm.pan,
        address: vendForm.address,
        city: vendForm.city,
        pincode: vendForm.pincode,
        state: vendForm.state,
        stateCode: vendForm.stateCode,
        contact: {
          name: vendForm.contactName,
          email: vendForm.contactEmail,
          phone: vendForm.contactPhone,
          designation: vendForm.contactDesignation
        },
        reverseCharge: vendForm.reverseCharge,
        compositionScheme: vendForm.compositionScheme,
        msmeStatus: vendForm.msmeStatus,
        udyamRegistrationNo: vendForm.udyamRegistrationNo,
        vendorCategories: vendForm.vendorCategories,
        creditTerms: vendForm.creditTerms,
        status: vendForm.status,
        bankDetails,
        notes: vendForm.notes
      });
      showToast(`Updated Vendor ${vendForm.name}`);
    } else {
      createVendor({
        name: vendForm.name,
        tradeName: vendForm.tradeName,
        gstin: vendForm.gstin,
        pan: vendForm.pan,
        address: vendForm.address,
        city: vendForm.city,
        pincode: vendForm.pincode,
        state: vendForm.state,
        stateCode: vendForm.stateCode,
        contact: {
          name: vendForm.contactName,
          email: vendForm.contactEmail,
          phone: vendForm.contactPhone,
          designation: vendForm.contactDesignation
        },
        reverseCharge: vendForm.reverseCharge,
        compositionScheme: vendForm.compositionScheme,
        msmeStatus: vendForm.msmeStatus,
        udyamRegistrationNo: vendForm.udyamRegistrationNo,
        vendorCategories: vendForm.vendorCategories,
        creditTerms: vendForm.creditTerms,
        status: vendForm.status,
        bankDetails,
        notes: vendForm.notes
      });
      showToast(`Created Vendor ${vendForm.name}`);
    }

    refreshData();
    setIsVendorModalOpen(false);
  };

  const handleDeleteVendor = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete vendor ${name}?`)) {
      deleteVendor(id);
      refreshData();
      showToast(`Deleted Vendor ${name}`);
    }
  };

  const toggleCategorySelection = (cat: string) => {
    setVendForm(prev => {
      const exists = prev.vendorCategories.includes(cat);
      if (exists) {
        return { ...prev, vendorCategories: prev.vendorCategories.filter(c => c !== cat) };
      } else {
        return { ...prev, vendorCategories: [...prev.vendorCategories, cat] };
      }
    });
  };

  // Extract unique locations dynamically for filter dropdowns
  const uniqueStates = Array.from(new Set([
    ...customers.map(c => c.state),
    ...vendors.map(v => v.state)
  ].filter(Boolean))).sort();

  const uniqueCities = Array.from(new Set([
    ...customers.map(c => c.city),
    ...vendors.map(v => v.city)
  ].filter(Boolean))).sort();

  // Filtered lists
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.gstin.toLowerCase().includes(q) ||
        c.pan.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.pincode.toLowerCase().includes(q) ||
        c.contact.name.toLowerCase().includes(q) ||
        (c.contact.email && c.contact.email.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      const matchesState = stateFilter === 'ALL' || c.state === stateFilter;
      const matchesCity = cityFilter === 'ALL' || c.city === cityFilter;
      const matchesCredit = creditFilter === 'ALL' || c.creditTerms === creditFilter;
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      
      const matchesGstin = gstinStatusFilter === 'ALL' || (
        gstinStatusFilter === 'REGISTERED' 
          ? (c.gstin && c.gstin.trim().length === 15 && c.gstin !== 'UNREGISTERED')
          : (!c.gstin || c.gstin.trim() === '' || c.gstin === 'UNREGISTERED')
      );

      const matchesMinCredit = minCreditLimit === '' || (c.creditLimitINR || 0) >= Number(minCreditLimit);
      const matchesMaxCredit = maxCreditLimit === '' || (c.creditLimitINR || 0) <= Number(maxCreditLimit);

      return matchesSearch && matchesState && matchesCity && matchesCredit && matchesStatus && matchesGstin && matchesMinCredit && matchesMaxCredit;
    });
  }, [customers, searchQuery, stateFilter, cityFilter, creditFilter, statusFilter, gstinStatusFilter, minCreditLimit, maxCreditLimit]);

  const sortedCustomers = useMemo(() => {
    let sortableItems = [...filteredCustomers];
    if (partySortConfigs.length > 0) {
      sortableItems.sort((a, b) => {
        for (const config of partySortConfigs) {
          let aValue: any;
          let bValue: any;

          if (config.key === 'NAME') {
            aValue = a.name;
            bValue = b.name;
          } else if (config.key === 'CODE') {
            aValue = a.customerCode;
            bValue = b.customerCode;
          } else if (config.key === 'STATE') {
            aValue = a.state;
            bValue = b.state;
          } else if (config.key === 'CREDIT_LIMIT') {
            aValue = a.creditLimitINR || 0;
            bValue = b.creditLimitINR || 0;
          } else if (config.key === 'STATUS') {
            aValue = a.status;
            bValue = b.status;
          } else {
            aValue = a.name;
            bValue = b.name;
          }

          if (aValue === undefined || aValue === null) aValue = '';
          if (bValue === undefined || bValue === null) bValue = '';

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comp = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
            if (comp !== 0) {
              return config.direction === 'ASC' ? comp : -comp;
            }
          } else {
            if (aValue < bValue) return config.direction === 'ASC' ? -1 : 1;
            if (aValue > bValue) return config.direction === 'ASC' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredCustomers, partySortConfigs]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        v.name.toLowerCase().includes(q) ||
        v.vendorCode.toLowerCase().includes(q) ||
        v.gstin.toLowerCase().includes(q) ||
        v.pan.toLowerCase().includes(q) ||
        v.state.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.pincode.toLowerCase().includes(q) ||
        (v.udyamRegistrationNo && v.udyamRegistrationNo.toLowerCase().includes(q)) ||
        v.vendorCategories.some(cat => cat.toLowerCase().includes(q)) ||
        v.contact.name.toLowerCase().includes(q) ||
        (v.contact.email && v.contact.email.toLowerCase().includes(q)) ||
        (v.notes && v.notes.toLowerCase().includes(q));

      const matchesState = stateFilter === 'ALL' || v.state === stateFilter;
      const matchesCity = cityFilter === 'ALL' || v.city === cityFilter;
      const matchesMsme = msmeFilter === 'ALL' || v.msmeStatus === msmeFilter;
      const matchesRcm = rcmFilter === 'ALL' || (rcmFilter === 'RCM' ? v.reverseCharge : !v.reverseCharge);
      const matchesComp = compositionFilter === 'ALL' || (compositionFilter === 'COMP' ? v.compositionScheme : !v.compositionScheme);
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const matchesCategory = vendorCategoryFilter === 'ALL' || v.vendorCategories.includes(vendorCategoryFilter);
      
      const matchesGstin = gstinStatusFilter === 'ALL' || (
        gstinStatusFilter === 'REGISTERED' 
          ? (v.gstin && v.gstin.trim().length === 15 && v.gstin !== 'UNREGISTERED')
          : (!v.gstin || v.gstin.trim() === '' || v.gstin === 'UNREGISTERED')
      );

      return matchesSearch && matchesState && matchesCity && matchesMsme && matchesRcm && matchesComp && matchesStatus && matchesCategory && matchesGstin;
    });
  }, [vendors, searchQuery, stateFilter, cityFilter, msmeFilter, rcmFilter, compositionFilter, statusFilter, vendorCategoryFilter, gstinStatusFilter]);

  const sortedVendors = useMemo(() => {
    let sortableItems = [...filteredVendors];
    if (partySortConfigs.length > 0) {
      sortableItems.sort((a, b) => {
        for (const config of partySortConfigs) {
          let aValue: any;
          let bValue: any;

          if (config.key === 'NAME') {
            aValue = a.name;
            bValue = b.name;
          } else if (config.key === 'CODE') {
            aValue = a.vendorCode;
            bValue = b.vendorCode;
          } else if (config.key === 'STATE') {
            aValue = a.state;
            bValue = b.state;
          } else if (config.key === 'MSME_STATUS') {
            const msmeRank = (status: string) => {
              switch (status) {
                case 'MICRO': return 3;
                case 'SMALL': return 2;
                case 'MEDIUM': return 1;
                case 'NON_MSME': return 0;
                default: return -1;
              }
            };
            aValue = msmeRank(a.msmeStatus);
            bValue = msmeRank(b.msmeStatus);
          } else if (config.key === 'STATUS') {
            aValue = a.status;
            bValue = b.status;
          } else {
            aValue = a.name;
            bValue = b.name;
          }

          if (aValue === undefined || aValue === null) aValue = '';
          if (bValue === undefined || bValue === null) bValue = '';

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comp = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
            if (comp !== 0) {
              return config.direction === 'ASC' ? comp : -comp;
            }
          } else {
            if (aValue < bValue) return config.direction === 'ASC' ? -1 : 1;
            if (aValue > bValue) return config.direction === 'ASC' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredVendors, partySortConfigs]);

  // Paginated Slices for Customers & Vendors
  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * customerPageSize;
    return sortedCustomers.slice(start, start + customerPageSize);
  }, [sortedCustomers, customerPage, customerPageSize]);

  const paginatedVendors = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return sortedVendors.slice(start, start + vendorPageSize);
  }, [sortedVendors, vendorPage, vendorPageSize]);

  // Calculate Metrics
  const totalCreditLimit = customers.reduce((acc, c) => acc + (c.creditLimitINR || 0), 0);
  const msmeVendorCount = vendors.filter(v => v.msmeStatus !== 'NON_MSME').length;
  const rcmVendorCount = vendors.filter(v => v.reverseCharge).length;
  const compVendorCount = vendors.filter(v => v.compositionScheme).length;

  // Reset to seed data
  const handleResetData = () => {
    if (confirm('Reset party master data back to default sample records?')) {
      resetPartyMasterToSeed();
      refreshData();
      showToast('Party master data reset to sample state');
    }
  };

  // CSV Export Handler
  const handleExportCsv = (type: 'CUSTOMERS' | 'VENDORS') => {
    let csvContent = '';
    if (type === 'CUSTOMERS') {
      csvContent = 'Customer Code,Name,GSTIN,PAN,Address,City,State,Contact Person,Email,Phone,Credit Terms,Credit Limit INR\n';
      customers.forEach(c => {
        csvContent += `"${c.customerCode}","${c.name}","${c.gstin}","${c.pan}","${c.address}","${c.city}","${c.state}","${c.contact.name}","${c.contact.email}","${c.contact.phone}","${c.creditTerms}","${c.creditLimitINR || 0}"\n`;
      });
    } else {
      csvContent = 'Vendor Code,Name,GSTIN,PAN,Address,City,State,Contact Person,RCM Applicable,Composition Scheme,MSME Status,UDYAM No,Categories,Credit Terms\n';
      vendors.forEach(v => {
        csvContent += `"${v.vendorCode}","${v.name}","${v.gstin}","${v.pan}","${v.address}","${v.city}","${v.state}","${v.contact.name}","${v.reverseCharge ? 'YES' : 'NO'}","${v.compositionScheme ? 'YES' : 'NO'}","${v.msmeStatus}","${v.udyamRegistrationNo || ''}","${v.vendorCategories.join('; ')}","${v.creditTerms}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TaxFlow_${type}_Master_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast(`Exported ${type} master CSV`);
  };

  const renderSearchAndFilters = () => {
    const isCustomer = activeTab === 'CUSTOMERS';
    const activeFiltersCount = getActiveFilterCount();

    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Main Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full min-w-[280px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isCustomer ? "Search by Name, GSTIN, PAN, City, State, Contact, Code..." : "Search by Name, GSTIN, UDYAM, Category, City, State, Code..."}
              className="w-full pl-9 pr-4 py-2 h-10 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'GRID'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Detailed Data Table View"
              >
                <TableProperties size={16} />
              </button>
            </div>

            {/* Toggle Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-10 px-4 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-extrabold'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Filter size={15} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full leading-none">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Quick reset filters button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                title="Clear all filters"
              >
                Clear
              </button>
            )}

            {/* Add Party Button */}
            <button
              type="button"
              onClick={isCustomer ? openNewCustomerModal : openNewVendorModal}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} /> 
              <span>{isCustomer ? 'Add Customer' : 'Add Vendor'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 mt-2 text-xs">
                {/* Common Location Filters */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">State Location</label>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="ALL">All States</option>
                    {uniqueStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">City Location</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="ALL">All Cities</option>
                    {uniqueCities.map(ct => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">GST Registration</label>
                  <select
                    value={gstinStatusFilter}
                    onChange={(e) => setGstinStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="ALL">All GST Formats</option>
                    <option value="REGISTERED">Registered (15-Digit GSTIN)</option>
                    <option value="UNREGISTERED">Unregistered / Missing</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>

                {/* Tab-Specific Filters */}
                {isCustomer ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Credit Terms</label>
                      <select
                        value={creditFilter}
                        onChange={(e) => setCreditFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                      >
                        <option value="ALL">All Credit Terms</option>
                        {Object.entries(CREDIT_TERMS_LABELS).map(([key, val]) => (
                          <option key={key} value={key}>{val}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Credit Limit Range (INR)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Min ₹ Limit"
                          value={minCreditLimit}
                          onChange={(e) => setMinCreditLimit(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500"
                        />
                        <span className="text-slate-400 font-bold shrink-0">to</span>
                        <input
                          type="number"
                          placeholder="Max ₹ Limit"
                          value={maxCreditLimit}
                          onChange={(e) => setMaxCreditLimit(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">MSME Sec 43B(h)</label>
                      <select
                        value={msmeFilter}
                        onChange={(e) => setMsmeFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                      >
                        <option value="ALL">All MSME Statuses</option>
                        <option value="MICRO">Micro Enterprise</option>
                        <option value="SMALL">Small Enterprise</option>
                        <option value="MEDIUM">Medium Enterprise</option>
                        <option value="NON_MSME">Non-MSME</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Reverse Charge (RCM)</label>
                      <select
                        value={rcmFilter}
                        onChange={(e) => setRcmFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                      >
                        <option value="ALL">All RCM Flags</option>
                        <option value="RCM">RCM Registered Suppliers</option>
                        <option value="NORMAL">Normal Forward Charge</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Composition Scheme</label>
                      <select
                        value={compositionFilter}
                        onChange={(e) => setCompositionFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                      >
                        <option value="ALL">All Schemes</option>
                        <option value="COMP">Composition Dealer</option>
                        <option value="REGULAR">Regular Taxpayer</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider block text-[10px]">Vendor Category</label>
                      <select
                        value={vendorCategoryFilter}
                        onChange={(e) => setVendorCategoryFilter(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                      >
                        <option value="ALL">All Categories</option>
                        {VENDOR_CATEGORY_OPTIONS.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Sorting Options row */}
                <div className="sm:col-span-2 md:col-span-4 border-t border-slate-200/60 pt-4 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500">Sort By:</span>
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as any)}
                        className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 text-xs outline-hidden focus:border-blue-500 cursor-pointer"
                      >
                        <option value="NAME">Party Name</option>
                        <option value="CODE">{isCustomer ? 'Customer Code' : 'Vendor Code'}</option>
                        <option value="STATE">State Location</option>
                        {isCustomer && <option value="CREDIT_LIMIT">Credit Limit</option>}
                        {!isCustomer && <option value="MSME_STATUS">MSME Classification</option>}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                      className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-bold text-slate-700 text-xs transition-all flex items-center gap-1"
                    >
                      <span>{sortOrder === 'ASC' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black text-xs transition-all"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* TOAST POPUP */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-[1000] px-4 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2"
          >
            <Sparkles size={16} className="text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BANNER WITH SUMMARY METRICS (Statutory Company Information White Theme) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  Customer &amp; Vendor Master
                </h2>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-mono font-bold rounded-full uppercase">
                  GST Compliance Directory
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Centralized registry for Customer &amp; Vendor entities. Tracks 15-digit GSTINs, PAN structures, Reverse Charge (RCM) applicability, Composition Scheme status, MSME Section 43B(h) classifications, and Credit Terms.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all flex items-center gap-1.5"
              title="Reset sample party data"
            >
              <RefreshCw size={14} /> Reset Data
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv(activeTab === 'VENDORS' ? 'VENDORS' : 'CUSTOMERS')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Customers</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-1">{customers.length}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Credit Cap: ₹{(totalCreditLimit/100000).toFixed(1)} Lakhs</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Vendors</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-1">{vendors.length}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{rcmVendorCount} RCM / {compVendorCount} Composition</p>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 hover:border-emerald-300 transition-all">
            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">MSME Vendors (Sec 43B)</p>
            <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{msmeVendorCount}</p>
            <p className="text-xs text-emerald-600 mt-0.5 font-medium">Micro &amp; Small Entities</p>
          </div>

          <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200/80 hover:border-purple-300 transition-all">
            <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">RCM Registered Vendors</p>
            <p className="text-2xl font-black text-purple-700 font-mono mt-1">{rcmVendorCount}</p>
            <p className="text-xs text-purple-600 mt-0.5 font-medium">GTA Freight &amp; Advocates</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'CUSTOMERS'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users size={15} className={activeTab === 'CUSTOMERS' ? 'text-white' : 'text-slate-500'} /> Customer Master ({customers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VENDORS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'VENDORS'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 size={15} className={activeTab === 'VENDORS' ? 'text-white' : 'text-slate-500'} /> Vendor Master ({vendors.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MSME_RCM_DIRECTORY')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'MSME_RCM_DIRECTORY'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldAlert size={15} className={activeTab === 'MSME_RCM_DIRECTORY' ? 'text-white' : 'text-slate-500'} /> MSME &amp; RCM Compliance Directory
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BULK_IMPORT')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'BULK_IMPORT'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Upload size={15} className={activeTab === 'BULK_IMPORT' ? 'text-white' : 'text-slate-500'} /> Bulk Data Import
          </button>
        </div>
      </div>

      {/* TAB 1: CUSTOMER MASTER */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-4">
          {/* BAR: Search, Filters & Add Button */}
          {renderSearchAndFilters()}

          {/* CUSTOMERS VIEW MODE TOGGLE RENDER */}
          {viewMode === 'TABLE' ? (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <PartySortHeader label="Code" sortKey="CODE" />
                      <PartySortHeader label="Customer Name" sortKey="NAME" />
                      <PartySortHeader label="GSTIN / PAN" sortKey="NAME" />
                      <PartySortHeader label="State / Location" sortKey="STATE" />
                      <PartySortHeader label="Credit Limit" sortKey="CREDIT_LIMIT" align="right" />
                      <PartySortHeader label="Status" sortKey="STATUS" />
                      <th className="px-6 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          <Users size={40} className="mx-auto mb-3 opacity-50 text-slate-400" />
                          <p className="text-sm font-extrabold text-slate-800">No Customers Found</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map(cust => (
                        <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {cust.customerCode}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{cust.name}</div>
                            {cust.tradeName && <div className="text-[10px] text-slate-500 italic">Trade: {cust.tradeName}</div>}
                          </td>
                          <td className="px-6 py-4 font-mono">
                            <div className="text-slate-800 font-bold">{cust.gstin}</div>
                            <div className="text-[10px] text-slate-400">PAN: {cust.pan}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{cust.city}</div>
                            <div className="text-[10px] text-slate-500">{cust.state} (Code {cust.stateCode})</div>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="font-bold text-slate-800">₹{(cust.creditLimitINR || 0).toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-slate-500">{CREDIT_TERMS_LABELS[cust.creditTerms]}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                              cust.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {cust.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditCustomerModal(cust)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Customer"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Customer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedCustomers.length === 0 ? (
                <div className="col-span-2 p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                  <Users size={40} className="mx-auto mb-3 opacity-50 text-slate-400" />
                  <p className="text-sm font-extrabold text-slate-800">No Customers Found</p>
                  <p className="text-xs mt-1">Try adjusting your search query or add a new customer.</p>
                </div>
              ) : (
                paginatedCustomers.map(cust => (
                  <div key={cust.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                            {cust.customerCode}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            cust.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cust.status}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-1.5">{cust.name}</h3>
                        {cust.tradeName && (
                          <p className="text-xs text-slate-500 italic">Trade Name: {cust.tradeName}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditCustomerModal(cust)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Customer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* GSTIN & PAN BADGES */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">15-Digit GSTIN</span>
                        <strong className="text-slate-900 font-bold">{cust.gstin}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">PAN Number</span>
                        <strong className="text-slate-900 font-bold">{cust.pan}</strong>
                      </div>
                    </div>

                    {/* ADDRESS & STATE */}
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="flex items-start gap-1.5">
                        <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{cust.address}, {cust.city} - {cust.pincode} (<strong>{cust.state}</strong> - Code {cust.stateCode})</span>
                      </p>
                    </div>

                    {/* CONTACT & CREDIT TERMS */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{cust.contact.name}</p>
                        <p className="text-slate-500 text-[11px]">{cust.contact.email} &bull; {cust.contact.phone}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] block">
                          {CREDIT_TERMS_LABELS[cust.creditTerms]}
                        </span>
                        {cust.creditLimitINR && (
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Limit: ₹{cust.creditLimitINR.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CUSTOMER PAGINATION */}
          <PartyMasterPagination
            currentPage={customerPage}
            totalItems={sortedCustomers.length}
            pageSize={customerPageSize}
            onPageChange={setCustomerPage}
            onPageSizeChange={(newSize) => {
              setCustomerPageSize(newSize);
              setCustomerPage(1);
            }}
            itemLabel="customers"
          />
        </div>
      )}

      {/* TAB 2: VENDOR MASTER */}
      {activeTab === 'VENDORS' && (
        <div className="space-y-4">
          {/* BAR: Search, Filters & Add Vendor Button */}
          {renderSearchAndFilters()}

          {/* VENDORS VIEW MODE TOGGLE RENDER */}
          {viewMode === 'TABLE' ? (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <PartySortHeader label="Code" sortKey="CODE" />
                      <PartySortHeader label="Vendor Name" sortKey="NAME" />
                      <PartySortHeader label="GSTIN" sortKey="NAME" />
                      <PartySortHeader label="State / Location" sortKey="STATE" />
                      <PartySortHeader label="MSME Classification" sortKey="MSME_STATUS" />
                      <PartySortHeader label="Compliance" sortKey="STATUS" />
                      <th className="px-6 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right whitespace-nowrap w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedVendors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-500">
                          <Building2 size={40} className="mx-auto mb-3 opacity-50 text-slate-400" />
                          <p className="text-sm font-extrabold text-slate-800">No Vendors Found</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedVendors.map(vend => (
                        <tr key={vend.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {vend.vendorCode}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{vend.name}</div>
                            {vend.tradeName && <div className="text-[10px] text-slate-500 italic">Trade: {vend.tradeName}</div>}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-800">
                            {vend.gstin}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{vend.city}</div>
                            <div className="text-[10px] text-slate-500">{vend.state}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${MSME_STATUS_LABELS[vend.msmeStatus].badge}`}>
                              {MSME_STATUS_LABELS[vend.msmeStatus].label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {vend.reverseCharge && (
                                <span className="w-fit px-1.5 py-0.5 text-[9px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200 rounded">
                                  RCM ACTIVE
                                </span>
                              )}
                              {vend.compositionScheme && (
                                <span className="w-fit px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 rounded">
                                  COMPOSITION
                                </span>
                              )}
                              {!vend.reverseCharge && !vend.compositionScheme && (
                                <span className="text-[10px] text-slate-500">Standard GST</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditVendorModal(vend)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Vendor"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVendor(vend.id, vend.name)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Vendor"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedVendors.length === 0 ? (
                <div className="col-span-2 p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                  <Building2 size={40} className="mx-auto mb-3 opacity-50 text-slate-400" />
                  <p className="text-sm font-extrabold text-slate-800">No Vendors Found</p>
                  <p className="text-xs mt-1">Try adjusting your search query or add a new vendor.</p>
                </div>
              ) : (
                paginatedVendors.map(vend => (
                  <div key={vend.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                            {vend.vendorCode}
                          </span>

                          {/* RCM BADGE */}
                          {vend.reverseCharge && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 rounded-md flex items-center gap-1">
                              <ShieldAlert size={12} /> RCM APPLICABLE
                            </span>
                          )}

                          {/* COMPOSITION BADGE */}
                          {vend.compositionScheme && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                              COMPOSITION TAXPAYER
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-black text-slate-900 mt-1.5">{vend.name}</h3>
                        {vend.tradeName && (
                          <p className="text-xs text-slate-500 italic">Trade Name: {vend.tradeName}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditVendorModal(vend)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Vendor"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVendor(vend.id, vend.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Vendor"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* GSTIN & PAN & MSME */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">GSTIN Number</span>
                        <strong className="text-slate-900 font-bold">{vend.gstin}</strong>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">MSME Classification</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${MSME_STATUS_LABELS[vend.msmeStatus].badge}`}>
                          {MSME_STATUS_LABELS[vend.msmeStatus].label}
                        </span>
                      </div>

                      {vend.udyamRegistrationNo && (
                        <div className="col-span-2 pt-1 border-t border-slate-200">
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">UDYAM Reg Number</span>
                          <span className="text-emerald-700 font-bold">{vend.udyamRegistrationNo}</span>
                        </div>
                      )}
                    </div>

                    {/* VENDOR CATEGORIES */}
                    {vend.vendorCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {vend.vendorCategories.map(cat => (
                          <span key={cat} className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md border border-slate-200">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* CONTACT & ADDRESS */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{vend.contact.name}</p>
                        <p className="text-slate-500 text-[11px]">{vend.contact.email} &bull; {vend.contact.phone}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-bold text-[11px] block">
                          {CREDIT_TERMS_LABELS[vend.creditTerms]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VENDOR PAGINATION */}
          <PartyMasterPagination
            currentPage={vendorPage}
            totalItems={sortedVendors.length}
            pageSize={vendorPageSize}
            onPageChange={setVendorPage}
            onPageSizeChange={(newSize) => {
              setVendorPageSize(newSize);
              setVendorPage(1);
            }}
            itemLabel="vendors"
          />
        </div>
      )}

      {/* TAB 3: MSME & RCM COMPLIANCE DIRECTORY */}
      {activeTab === 'MSME_RCM_DIRECTORY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MSME SECTION 43B(h) DIRECTORY */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">MSME Sec 43B(h) Payment Compliance</h3>
                  <p className="text-xs text-slate-500">Invoices payable to Micro &amp; Small enterprises must be settled within 45 days.</p>
                </div>
              </div>

              <div className="space-y-3">
                {vendors.filter(v => v.msmeStatus === 'MICRO' || v.msmeStatus === 'SMALL').map(v => (
                  <div key={v.id} className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-950">{v.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${MSME_STATUS_LABELS[v.msmeStatus].badge}`}>
                        {v.msmeStatus}
                      </span>
                    </div>
                    <p className="text-emerald-800 font-mono text-[11px]">UDYAM: {v.udyamRegistrationNo || 'Not Provided'}</p>
                    <p className="text-slate-600 text-[11px]">Contact: {v.contact.name} ({v.contact.phone})</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RCM DIRECTORY */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-800 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Reverse Charge (RCM) Supplier Directory</h3>
                  <p className="text-xs text-slate-500">Suppliers where tax liability is borne directly by recipient under Section 9(3).</p>
                </div>
              </div>

              <div className="space-y-3">
                {vendors.filter(v => v.reverseCharge).map(v => (
                  <div key={v.id} className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-950">{v.name}</span>
                      <span className="px-2 py-0.5 bg-purple-200 text-purple-900 font-mono text-[10px] font-bold rounded-md">
                        RCM MANDATE
                      </span>
                    </div>
                    <p className="text-purple-800 font-mono text-[11px]">GSTIN: {v.gstin}</p>
                    <p className="text-slate-600 text-[11px]">Categories: {v.vendorCategories.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BULK DATA IMPORT */}
      {activeTab === 'BULK_IMPORT' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-2xl mx-auto shadow-sm space-y-6 text-center">
          <div className="p-4 bg-blue-50 text-blue-700 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <Upload size={32} />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900">Bulk Import Customer &amp; Vendor Masters</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Upload your ERP vendor/customer master CSV or Excel file to populate GSTINs, PAN numbers, credit terms, and MSME flags.
            </p>
          </div>

          <div className="p-8 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer">
            <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700">Drag &amp; Drop CSV or Excel Master File</p>
            <p className="text-[11px] text-slate-400 mt-1">Supports standard Tally, SAP, and Zoho Books exporter formats.</p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => handleExportCsv('CUSTOMERS')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Download size={14} /> Download Sample Customer Template
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('VENDORS')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Download size={14} /> Download Sample Vendor Template
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                {editingCustomer ? 'Edit Customer Entity' : 'Add New Customer Entity'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Legal Company Name *</label>
                  <input
                    type="text"
                    required
                    value={custForm.name}
                    onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                    placeholder="e.g. Reliance Retail Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1">Trade Name (Optional)</label>
                  <input
                    type="text"
                    value={custForm.tradeName}
                    onChange={(e) => setCustForm({ ...custForm, tradeName: e.target.value })}
                    placeholder="e.g. Reliance Digital"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">15-Digit GSTIN *</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={custForm.gstin}
                    onChange={(e) => handleCustGstinChange(e.target.value)}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block mb-1">Extracted PAN Number</label>
                  <input
                    type="text"
                    readOnly
                    value={custForm.pan}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-700 uppercase cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Registered Address</label>
                <input
                  type="text"
                  value={custForm.address}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  placeholder="Street / Building address..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1">City</label>
                  <input
                    type="text"
                    value={custForm.city}
                    onChange={(e) => setCustForm({ ...custForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block mb-1">Pincode</label>
                  <input
                    type="text"
                    value={custForm.pincode}
                    onChange={(e) => setCustForm({ ...custForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block mb-1">State</label>
                  <input
                    type="text"
                    value={custForm.state}
                    onChange={(e) => setCustForm({ ...custForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              {/* CONTACT & CREDIT TERMS */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-slate-900 font-black text-[11px] uppercase">Primary Contact &amp; Credit Terms</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Person Name"
                    value={custForm.contactName}
                    onChange={(e) => setCustForm({ ...custForm, contactName: e.target.value })}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={custForm.contactEmail}
                    onChange={(e) => setCustForm({ ...custForm, contactEmail: e.target.value })}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={custForm.contactPhone}
                    onChange={(e) => setCustForm({ ...custForm, contactPhone: e.target.value })}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl"
                  />
                  <select
                    value={custForm.creditTerms}
                    onChange={(e) => setCustForm({ ...custForm, creditTerms: e.target.value as CreditTerms })}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl"
                  >
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_45">Net 45 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md"
                >
                  Save Customer Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT VENDOR */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-purple-600" />
                {editingVendor ? 'Edit Vendor Entity' : 'Add New Vendor Entity'}
              </h3>
              <button
                type="button"
                onClick={() => setIsVendorModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Vendor Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={vendForm.name}
                    onChange={(e) => setVendForm({ ...vendForm, name: e.target.value })}
                    placeholder="e.g. Amazon Seller Services Pvt Ltd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block mb-1">Trade Name (Optional)</label>
                  <input
                    type="text"
                    value={vendForm.tradeName}
                    onChange={(e) => setVendForm({ ...vendForm, tradeName: e.target.value })}
                    placeholder="e.g. AWS India"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">15-Digit GSTIN *</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={vendForm.gstin}
                    onChange={(e) => handleVendGstinChange(e.target.value)}
                    placeholder="e.g. 27AAAFP1234K1Z2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block mb-1">Extracted PAN Number</label>
                  <input
                    type="text"
                    readOnly
                    value={vendForm.pan}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-700 uppercase cursor-not-allowed"
                  />
                </div>
              </div>

              {/* GST TAXPAYER COMPLIANCE TOGGLES: RCM & COMPOSITION SCHEME */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-purple-950 text-xs">Reverse Charge (RCM) Applicable</p>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">Section 9(3) / 9(4) recipient pays GST</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={vendForm.reverseCharge}
                    onChange={(e) => setVendForm({ ...vendForm, reverseCharge: e.target.checked })}
                    className="w-5 h-5 accent-purple-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-amber-950 text-xs">Composition Scheme Taxpayer</p>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">Section 10 dealer (No ITC available)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={vendForm.compositionScheme}
                    onChange={(e) => setVendForm({ ...vendForm, compositionScheme: e.target.checked })}
                    className="w-5 h-5 accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* MSME CLASSIFICATION & UDYAM NUMBER */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                <label className="block text-emerald-950 font-black text-[11px] uppercase">MSME Status &amp; Sec 43B(h) Registration</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={vendForm.msmeStatus}
                    onChange={(e) => setVendForm({ ...vendForm, msmeStatus: e.target.value as MsmeStatus })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900"
                  >
                    <option value="MICRO">Micro Enterprise (&lt;= ₹1 Cr Inv / ₹5 Cr TO)</option>
                    <option value="SMALL">Small Enterprise (&lt;= ₹10 Cr Inv / ₹50 Cr TO)</option>
                    <option value="MEDIUM">Medium Enterprise (&lt;= ₹50 Cr Inv / ₹250 Cr TO)</option>
                    <option value="NON_MSME">Non-MSME Large Enterprise</option>
                  </select>

                  <input
                    type="text"
                    placeholder="UDYAM Registration No (e.g. UDYAM-MH-00-12345)"
                    value={vendForm.udyamRegistrationNo}
                    onChange={(e) => setVendForm({ ...vendForm, udyamRegistrationNo: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* VENDOR CATEGORIES SELECTOR */}
              <div>
                <label className="block mb-1">Vendor Categories</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-300 rounded-xl max-h-28 overflow-y-auto">
                  {VENDOR_CATEGORY_OPTIONS.map(cat => {
                    const selected = vendForm.vendorCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategorySelection(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          selected 
                            ? 'bg-blue-600 text-white shadow-2xs' 
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ADDRESS & CREDIT TERMS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Address</label>
                  <input
                    type="text"
                    value={vendForm.address}
                    onChange={(e) => setVendForm({ ...vendForm, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block mb-1">Credit Terms</label>
                  <select
                    value={vendForm.creditTerms}
                    onChange={(e) => setVendForm({ ...vendForm, creditTerms: e.target.value as CreditTerms })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  >
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_45">Net 45 Days (MSME Max limit)</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="DUE_ON_RECEIPT">Due on Receipt</option>
                    <option value="ADVANCE">100% Advance Payment</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md"
                >
                  Save Vendor Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartyMasterModule;
