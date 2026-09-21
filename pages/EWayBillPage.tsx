import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  fetchInvoices, 
  generateEWayBill, 
  cancelEWayBill, 
  extendEWayBill,
  updateEWayBillVehicle,
  updateEWayBillTransporter,
  updateEWayBillPartB,
  fetchConsolidatedEWayBills,
  createConsolidatedEWayBill,
  ConsolidatedEWayBill,
  updateInvoice
} from '../services/api';
import { 
  Truck, ArrowRight, HelpCircle, Layers, ShieldCheck, CheckCircle2, 
  AlertCircle, Search, Trash2, Calendar, FileText, RefreshCw, Clock, 
  AlertTriangle, Play, ChevronRight, X, Sparkles, Plus, Send, Sliders, Check,
  Printer, Download, MapPin, Activity, UserCheck, ChevronDown, CheckSquare, Info, Gauge, ShieldAlert
} from 'lucide-react';
import { Invoice, EWayBill, UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { EWayBillPagination } from '../components/EWayBillPagination';

export interface Transporter {
  id: string;
  name: string;
  rating: number;
  fleet: string;
  speed: string;
  avgSpeed: string;
  prefix: string;
}

export const TRANSPORTERS: Transporter[] = [
  { id: 'TRANS-BD902', name: 'BlueDart Cargo Express', rating: 4.9, fleet: '1,200+ trucks', speed: 'Express', avgSpeed: '45 km/h', prefix: 'MH-12' },
  { id: 'TRANS-TC104', name: 'TCI Freight (Transport Corp of India)', rating: 4.8, fleet: '8,500+ trucks', speed: 'Standard', avgSpeed: '38 km/h', prefix: 'DL-01' },
  { id: 'TRANS-SE441', name: 'Safexpress Logistics', rating: 4.7, fleet: '3,000+ trucks', speed: 'Premium', avgSpeed: '42 km/h', prefix: 'KA-03' },
  { id: 'TRANS-VT889', name: 'V-Trans India Ltd', rating: 4.6, fleet: '2,000+ trucks', speed: 'Heavy Cargo', avgSpeed: '35 km/h', prefix: 'GJ-01' },
  { id: 'TRANS-GK230', name: 'Gati KWE Logistics', rating: 4.7, fleet: '1,500+ trucks', speed: 'Express', avgSpeed: '44 km/h', prefix: 'HR-26' }
];

export const ROUTING_ESTIMATES: Record<string, { from: string; to: string; distance: number; days: number }> = {
  'MUM-BLR': { from: 'Mumbai Depot, MH', to: 'Bangalore Hub, KA', distance: 980, days: 5 },
  'DEL-MAA': { from: 'Delhi NCR Depot, DL', to: 'Chennai Industrial Area, TN', distance: 2200, days: 11 },
  'CCU-PAT': { from: 'Kolkata Depot, WB', to: 'Patna Regional Warehouse, BR', distance: 580, days: 3 },
  'PNQ-NGP': { from: 'Pune Plant, MH', to: 'Nagpur Depot, MH', distance: 710, days: 4 },
  'AMD-HYD': { from: 'Ahmedabad Plant, GJ', to: 'Hyderabad Industrial Cluster, TS', distance: 1180, days: 6 },
  'DEFAULT': { from: 'Central Industrial Zone', to: 'Secondary Warehouse Point', distance: 180, days: 1 }
};

export function getRouteForInvoice(invoice: Invoice) {
  if (!invoice) return ROUTING_ESTIMATES['DEFAULT'];
  const pOfSupply = invoice.placeOfSupply;
  if (pOfSupply === '29') return ROUTING_ESTIMATES['MUM-BLR'];
  if (pOfSupply === '33') return ROUTING_ESTIMATES['DEL-MAA'];
  if (pOfSupply === '27') return ROUTING_ESTIMATES['PNQ-NGP'];
  if (pOfSupply === '10' || pOfSupply === '19') return ROUTING_ESTIMATES['CCU-PAT'];
  if (pOfSupply === '36') return ROUTING_ESTIMATES['AMD-HYD'];
  return {
    from: 'Central Industrial Zone',
    to: `State ${pOfSupply} Warehouse`,
    distance: 210,
    days: Math.ceil(210 / 200)
  };
}

export default function EWayBillPage() {
  const queryClient = useQueryClient();
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';

  const getEWayBillValidityInfo = (validUpto: string) => {
    try {
      const expiry = new Date(validUpto);
      const now = new Date();
      const diffMs = expiry.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        return {
          label: 'Expired',
          hoursLeft: 0,
          colorClass: 'text-slate-500 bg-slate-100 border-slate-200',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/50',
          level: 'EXPIRED',
          progressColor: 'bg-slate-400',
          percentage: 0,
          timeText: 'Expired'
        };
      }
      
      const hoursLeft = diffMs / (1000 * 60 * 60);
      const daysLeft = hoursLeft / 24;
      
      // Assume standard validity of 3 days (72 hours) for progress bar
      const percentage = Math.max(0, Math.min(100, (hoursLeft / 72) * 100));
      
      let level: 'STABLE' | 'WARNING' | 'CRITICAL' = 'STABLE';
      let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-100';
      let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
      let progressColor = 'bg-emerald-500';
      
      if (hoursLeft <= 12) {
        level = 'CRITICAL';
        colorClass = 'text-rose-700 bg-rose-50 border-rose-100/50';
        badgeClass = 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse';
        progressColor = 'bg-rose-500 animate-pulse';
      } else if (hoursLeft <= 24) {
        level = 'WARNING';
        colorClass = 'text-amber-700 bg-amber-50 border-amber-100/50';
        badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
        progressColor = 'bg-amber-500';
      }
      
      let timeText = '';
      if (daysLeft >= 1) {
        timeText = `${daysLeft.toFixed(1)} Days Remaining`;
      } else {
        const h = Math.floor(hoursLeft);
        const m = Math.floor((hoursLeft - h) * 60);
        timeText = `${h}h ${m}m Remaining`;
      }
      
      return {
        label: level === 'CRITICAL' ? 'Critical Alert' : level === 'WARNING' ? 'Warning' : 'Stable',
        hoursLeft,
        colorClass,
        badgeClass,
        level,
        progressColor,
        percentage,
        timeText
      };
    } catch (e) {
      return {
        label: 'Unknown',
        hoursLeft: 72,
        colorClass: 'text-slate-500 bg-slate-50 border-slate-200',
        badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
        level: 'STABLE',
        progressColor: 'bg-purple-500',
        percentage: 100,
        timeText: 'Valid'
      };
    }
  };

  // State Management for Active Views
  const [activeTab, setActiveTab] = useState<'ACTIVE_EWBS' | 'GENERATE' | 'CONSOLIDATED' | 'BULK'>('ACTIVE_EWBS');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');

  // Modal States for various operations
  const [activeModal, setActiveModal] = useState<'CANCEL' | 'EXTEND' | 'VEHICLE' | 'TRANSPORTER' | 'PART_B' | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedSlipInvoice, setSelectedSlipInvoice] = useState<Invoice | null>(null);
  const [transporterSearch, setTransporterSearch] = useState('');
  const [showTransporterList, setShowTransporterList] = useState(false);

  // Form Fields - Cancel
  const [cancelReason, setCancelReason] = useState('1'); // 1: Data Entry mistake, 2: Duplicate, 3: Order Cancelled, 4: Others
  const [cancelRemarks, setCancelRemarks] = useState('');

  // Form Fields - Extend Validity
  const [extendReason, setExtendReason] = useState('REASON_BREAKDOWN');
  const [extendVehicleNo, setExtendVehicleNo] = useState('');
  const [extendCurrentPlace, setExtendCurrentPlace] = useState('');
  const [extendRemainingDistance, setExtendRemainingDistance] = useState(150);

  // Form Fields - Vehicle Update
  const [vehUpdateNo, setVehUpdateNo] = useState('');
  const [vehUpdatePlace, setVehUpdatePlace] = useState('');
  const [vehUpdateReason, setVehUpdateReason] = useState('FIRST_TIME'); // FIRST_TIME, TRANSSHIPMENT, BREAKDOWN
  const [vehUpdateDocNo, setVehUpdateDocNo] = useState('');

  // Form Fields - Transporter Update
  const [transporterId, setTransporterId] = useState('');
  const [transporterName, setTransporterName] = useState('');

  // Form Fields - Part-B Update
  const [partBVehicleNo, setPartBVehicleNo] = useState('');
  const [partBDocNo, setPartBDocNo] = useState('');
  const [partBMode, setPartBMode] = useState<'ROAD' | 'RAIL' | 'AIR' | 'SHIP'>('ROAD');

  // Form Fields - Manual Generator
  const [genSelectedInvoiceId, setGenSelectedInvoiceId] = useState('');
  const [genVehicleNo, setGenVehicleNo] = useState('MH-12-PQ-9876');
  const [genTransportMode, setGenTransportMode] = useState<'ROAD' | 'RAIL' | 'AIR' | 'SHIP'>('ROAD');
  const [genTransportDocNo, setGenTransportDocNo] = useState('TR-DOC-1029');
  const [genTransporterId, setGenTransporterId] = useState('TRANS-9081');
  const [genTransporterName, setGenTransporterName] = useState('SuperFast Logistics Ltd');

  // Form Fields - Consolidated E-Way Bill Creation
  const [conVehicleNo, setConVehicleNo] = useState('');
  const [conFromPlace, setConFromPlace] = useState('');
  const [conStateCode, setConStateCode] = useState('27');
  const [conSelectedEwbs, setConSelectedEwbs] = useState<string[]>([]);
  const [conTransportMode, setConTransportMode] = useState<'ROAD' | 'RAIL' | 'AIR' | 'SHIP'>('ROAD');

  // Selected Invoices for Bulk tab
  const [bulkSelectedInvoiceIds, setBulkSelectedInvoiceIds] = useState<string[]>([]);

  // Toast State
  const [toast, setToast] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string } | null>(null);

  const showToast = (message: string, type: 'SUCCESS' | 'ERROR' = 'SUCCESS') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Queries
  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', tenantId],
    queryFn: () => fetchInvoices(tenantId)
  });

  const { data: consolidatedBills = [], refetch: refetchConsolidated } = useQuery<ConsolidatedEWayBill[]>({
    queryKey: ['consolidatedEWayBills'],
    queryFn: fetchConsolidatedEWayBills
  });

  // Filtered invoices with E-Way Bill details
  const invoicesWithEwb = useMemo(() => {
    return invoices.filter(inv => inv.ewayBillDetails !== undefined);
  }, [invoices]);

  // Invoices eligible to generate E-Way Bills (category = PURCHASE/SALES, amount usually > 50,000, or has no EWB yet)
  const eligibleInvoices = useMemo(() => {
    return invoices.filter(inv => inv.ewayBillDetails === undefined);
  }, [invoices]);

  // Active EWBs displayed based on filter and search
  const displayedEwbs = useMemo(() => {
    return invoicesWithEwb.filter(inv => {
      const ewb = inv.ewayBillDetails!;
      const matchesSearch = 
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ewb.ewayBillNo.includes(searchQuery) ||
        (ewb.vehicleNo && ewb.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = 
        filterStatus === 'ALL' || 
        (filterStatus === 'ACTIVE' && ewb.status === 'ACTIVE') ||
        (filterStatus === 'CANCELLED' && ewb.status === 'CANCELLED');

      return matchesSearch && matchesStatus;
    });
  }, [invoicesWithEwb, searchQuery, filterStatus]);

  // Active EWBs Pagination State
  const [ewbCurrentPage, setEwbCurrentPage] = useState(1);
  const [ewbPageSize, setEwbPageSize] = useState(10);

  // Auto-reset page when search query, status filter, or page size changes
  useEffect(() => {
    setEwbCurrentPage(1);
  }, [searchQuery, filterStatus, ewbPageSize]);

  const ewbTotalItems = displayedEwbs.length;
  const ewbTotalPages = Math.max(1, Math.ceil(ewbTotalItems / ewbPageSize));
  const safeEwbCurrentPage = Math.min(Math.max(1, ewbCurrentPage), ewbTotalPages);

  const paginatedDisplayedEwbs = useMemo(() => {
    const start = (safeEwbCurrentPage - 1) * ewbPageSize;
    return displayedEwbs.slice(start, start + ewbPageSize);
  }, [displayedEwbs, safeEwbCurrentPage, ewbPageSize]);

  // Bulk Tab Pagination State
  const [bulkCurrentPage, setBulkCurrentPage] = useState(1);
  const [bulkPageSize, setBulkPageSize] = useState(10);

  useEffect(() => {
    setBulkCurrentPage(1);
  }, [bulkPageSize]);

  const bulkTotalItems = eligibleInvoices.length;
  const bulkTotalPages = Math.max(1, Math.ceil(bulkTotalItems / bulkPageSize));
  const safeBulkCurrentPage = Math.min(Math.max(1, bulkCurrentPage), bulkTotalPages);

  const paginatedEligibleInvoices = useMemo(() => {
    const start = (safeBulkCurrentPage - 1) * bulkPageSize;
    return eligibleInvoices.slice(start, start + bulkPageSize);
  }, [eligibleInvoices, safeBulkCurrentPage, bulkPageSize]);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (payload: { 
      invoiceId: string; 
      vehicleNo?: string; 
      transportMode?: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'; 
      transportDocNo?: string;
      transporterId?: string;
      transporterName?: string;
    }) => generateEWayBill(
      payload.invoiceId, 
      payload.vehicleNo, 
      payload.transportMode, 
      payload.transportDocNo,
      payload.transporterId,
      payload.transporterName
    ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`E-Way Bill ${data.ewayBillNo} generated successfully!`);
      setActiveTab('ACTIVE_EWBS');
      // Reset generate form
      setGenSelectedInvoiceId('');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to generate E-Way Bill', 'ERROR');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; reason: string; remarks: string }) => 
      cancelEWayBill(payload.invoiceId, payload.reason, payload.remarks),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`E-Way Bill ${data.ewayBillNo} cancelled.`);
      setActiveModal(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to cancel E-Way Bill', 'ERROR');
    }
  });

  const extendMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; reason: string; vehicleNo: string; currentPlace: string; remainingDistance: number }) => 
      extendEWayBill(payload.invoiceId, payload.reason, payload.vehicleNo, payload.currentPlace, payload.remainingDistance),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`E-Way Bill ${data.ewayBillNo} extended. Valid up to: ${data.validUpto}`);
      setActiveModal(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to extend E-Way Bill', 'ERROR');
    }
  });

  const updateVehicleMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; vehicleNo: string; fromPlace: string; reason: string; transportDocNo?: string }) => 
      updateEWayBillVehicle(payload.invoiceId, payload.vehicleNo, payload.fromPlace, payload.reason, payload.transportDocNo),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Vehicle updated to ${data.vehicleNo} successfully.`);
      setActiveModal(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update vehicle', 'ERROR');
    }
  });

  const updateTransporterMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; transporterId: string; transporterName: string }) => 
      updateEWayBillTransporter(payload.invoiceId, payload.transporterId, payload.transporterName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Transporter details assigned successfully.`);
      setActiveModal(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update transporter', 'ERROR');
    }
  });

  const updatePartBMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; vehicleNo: string; transportDocNo: string; transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP' }) => 
      updateEWayBillPartB(payload.invoiceId, payload.vehicleNo, payload.transportDocNo, payload.transportMode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Part-B values written successfully to National NIC Portal.`);
      setActiveModal(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update Part-B', 'ERROR');
    }
  });

  const consolidatedMutation = useMutation({
    mutationFn: (payload: { vehicleNo: string; fromPlace: string; stateCode: string; ewbNumbers: string[]; transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP' }) => 
      createConsolidatedEWayBill(payload.vehicleNo, payload.fromPlace, payload.stateCode, payload.ewbNumbers, payload.transportMode),
    onSuccess: () => {
      refetchConsolidated();
      showToast(`Consolidated E-Way Bill generated successfully!`);
      // Reset consolidated form
      setConVehicleNo('');
      setConFromPlace('');
      setConSelectedEwbs([]);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to generate Consolidated EWB', 'ERROR');
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      for (const id of invoiceIds) {
        await generateEWayBill(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      showToast(`Bulk E-Way Bills generated successfully for ${bulkSelectedInvoiceIds.length} documents.`);
      setBulkSelectedInvoiceIds([]);
      setActiveTab('ACTIVE_EWBS');
    },
    onError: (err: any) => {
      showToast(err.message || 'Bulk generation failed', 'ERROR');
    }
  });

  // Action helpers to set initial values and open modals
  const openCancelModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setCancelReason('1');
    setCancelRemarks('');
    setActiveModal('CANCEL');
  };

  const openExtendModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setExtendVehicleNo(inv.ewayBillDetails?.vehicleNo || '');
    setExtendCurrentPlace(inv.ewayBillDetails?.currentPlace || '');
    setExtendReason('REASON_BREAKDOWN');
    setActiveModal('EXTEND');
  };

  const openVehicleModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setVehUpdateNo(inv.ewayBillDetails?.vehicleNo || '');
    setVehUpdatePlace('');
    setVehUpdateReason('TRANSSHIPMENT');
    setVehUpdateDocNo(inv.ewayBillDetails?.transportDocNo || '');
    setActiveModal('VEHICLE');
  };

  const openTransporterModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setTransporterId(inv.ewayBillDetails?.transporterId || '');
    setTransporterName(inv.ewayBillDetails?.transporterName || '');
    setActiveModal('TRANSPORTER');
  };

  const openPartBModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPartBVehicleNo(inv.ewayBillDetails?.vehicleNo || '');
    setPartBDocNo(inv.ewayBillDetails?.transportDocNo || '');
    setPartBMode(inv.ewayBillDetails?.transportMode || 'ROAD');
    setActiveModal('PART_B');
  };

  // Submit handers for compliance operations
  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    cancelMutation.mutate({
      invoiceId: selectedInvoice.id,
      reason: cancelReason,
      remarks: cancelRemarks
    });
  };

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    extendMutation.mutate({
      invoiceId: selectedInvoice.id,
      reason: extendReason,
      vehicleNo: extendVehicleNo,
      currentPlace: extendCurrentPlace,
      remainingDistance: extendRemainingDistance
    });
  };

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    updateVehicleMutation.mutate({
      invoiceId: selectedInvoice.id,
      vehicleNo: vehUpdateNo,
      fromPlace: vehUpdatePlace,
      reason: vehUpdateReason,
      transportDocNo: vehUpdateDocNo
    });
  };

  const handleTransporterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    updateTransporterMutation.mutate({
      invoiceId: selectedInvoice.id,
      transporterId,
      transporterName
    });
  };

  const handlePartBSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    updatePartBMutation.mutate({
      invoiceId: selectedInvoice.id,
      vehicleNo: partBVehicleNo,
      transportDocNo: partBDocNo,
      transportMode: partBMode
    });
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSelectedInvoiceId) return;
    generateMutation.mutate({
      invoiceId: genSelectedInvoiceId,
      vehicleNo: genVehicleNo,
      transportMode: genTransportMode,
      transportDocNo: genTransportDocNo,
      transporterId: genTransporterId,
      transporterName: genTransporterName
    });
  };

  const handleConsolidatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conSelectedEwbs.length === 0) {
      showToast('Please select at least one active E-Way Bill number.', 'ERROR');
      return;
    }
    consolidatedMutation.mutate({
      vehicleNo: conVehicleNo,
      fromPlace: conFromPlace,
      stateCode: conStateCode,
      ewbNumbers: conSelectedEwbs,
      transportMode: conTransportMode
    });
  };

  const handleBulkGenerateSubmit = () => {
    if (bulkSelectedInvoiceIds.length === 0) return;
    bulkMutation.mutate(bulkSelectedInvoiceIds);
  };

  const toggleBulkSelection = (id: string) => {
    setBulkSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleEwbForConsolidated = (ewbNo: string) => {
    setConSelectedEwbs(prev => 
      prev.includes(ewbNo) ? prev.filter(x => x !== ewbNo) : [...prev, ewbNo]
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div id="eway-bill-root" className="space-y-6">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 max-w-sm ${
              toast.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}
          >
            {toast.type === 'SUCCESS' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Truck size={24} />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">E-Way Bill Compliance Hub</h1>
            </div>
            <p className="text-xs text-slate-500">
              Generate, update, cancel, and extend validity of National NIC E-Way Bills for goods transshipment.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex gap-4">
            <div className="bg-purple-50/50 border border-purple-100 px-4 py-2.5 rounded-2xl text-center min-w-[90px]">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Active EWBs</span>
              <span className="text-lg font-black text-slate-800">{invoicesWithEwb.filter(i => i.ewayBillDetails?.status === 'ACTIVE').length}</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 px-4 py-2.5 rounded-2xl text-center min-w-[90px]">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending</span>
              <span className="text-lg font-black text-slate-800">{eligibleInvoices.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-1 mt-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => { setActiveTab('ACTIVE_EWBS'); setSelectedInvoice(null); }} 
            className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${activeTab === 'ACTIVE_EWBS' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Layers size={14}/> Active E-Way Bills
          </button>
          <button 
            onClick={() => { setActiveTab('GENERATE'); setSelectedInvoice(null); }} 
            className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${activeTab === 'GENERATE' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Plus size={14}/> Generate Fresh EWB
          </button>
          <button 
            onClick={() => { setActiveTab('CONSOLIDATED'); setSelectedInvoice(null); }} 
            className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${activeTab === 'CONSOLIDATED' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Truck size={14}/> Consolidated EWB
          </button>
          <button 
            onClick={() => { setActiveTab('BULK'); setSelectedInvoice(null); }} 
            className={`px-4 py-2.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${activeTab === 'BULK' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <Send size={14}/> Bulk Generation ({eligibleInvoices.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'ACTIVE_EWBS' && (
        <div className="space-y-6">
          {/* Simulation & Aging Sandbox controls */}
          <div className="bg-amber-50/50 border border-amber-200/60 p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                <Gauge size={16} />
              </span>
              <div>
                <span className="text-xs font-black text-slate-900 block">E-Way Bill Compliance Simulator</span>
                <span className="text-[10px] text-slate-500 font-medium">Test automatic alert states, critical warnings, and transporter dispatch handshakes in real-time.</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider mr-1">Time Travel:</span>
              {displayedEwbs.length > 0 ? (
                <>
                  <button
                    onClick={async () => {
                      const firstEwb = displayedEwbs[0];
                      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
                      const updatedEwb = { ...firstEwb.ewayBillDetails, validUpto: threeDaysFromNow };
                      await updateInvoice(firstEwb.id, { ewayBillDetails: updatedEwb }, 'Simulate stable E-Way bill');
                      queryClient.invalidateQueries({ queryKey: ['invoices'] });
                      showToast('Time travel: Set ' + firstEwb.ewayBillDetails?.ewayBillNo + ' to stable (3 days remaining)');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 cursor-pointer transition-all shadow-2xs"
                  >
                    🟢 Stable (3d)
                  </button>
                  <button
                    onClick={async () => {
                      const firstEwb = displayedEwbs[0];
                      const eighteenHrsFromNow = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();
                      const updatedEwb = { ...firstEwb.ewayBillDetails, validUpto: eighteenHrsFromNow };
                      await updateInvoice(firstEwb.id, { ewayBillDetails: updatedEwb }, 'Simulate warning state');
                      queryClient.invalidateQueries({ queryKey: ['invoices'] });
                      showToast('Time travel: Set ' + firstEwb.ewayBillDetails?.ewayBillNo + ' to warning (18 hours remaining)');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-amber-700 cursor-pointer transition-all shadow-2xs"
                  >
                    🟡 Warning (18h)
                  </button>
                  <button
                    onClick={async () => {
                      const firstEwb = displayedEwbs[0];
                      const fourHrsFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
                      const updatedEwb = { ...firstEwb.ewayBillDetails, validUpto: fourHrsFromNow };
                      await updateInvoice(firstEwb.id, { ewayBillDetails: updatedEwb }, 'Simulate critical state');
                      queryClient.invalidateQueries({ queryKey: ['invoices'] });
                      showToast('Time travel: Set ' + firstEwb.ewayBillDetails?.ewayBillNo + ' to critical (4 hours remaining)!');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-rose-700 cursor-pointer transition-all animate-pulse shadow-2xs"
                  >
                    🔴 Critical (4h)
                  </button>
                  <button
                    onClick={async () => {
                      const firstEwb = displayedEwbs[0];
                      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                      const updatedEwb = { ...firstEwb.ewayBillDetails, validUpto: pastDate };
                      await updateInvoice(firstEwb.id, { ewayBillDetails: updatedEwb }, 'Simulate expired state');
                      queryClient.invalidateQueries({ queryKey: ['invoices'] });
                      showToast('Time travel: Set ' + firstEwb.ewayBillDetails?.ewayBillNo + ' to expired!');
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all"
                  >
                    ⚫ Expired
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-400 font-bold italic">Generate an E-Way Bill first</span>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search by invoice, transporter, vehicle or ewb number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-purple-500 outline-hidden transition-all"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Status:</label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                {(['ALL', 'ACTIVE', 'CANCELLED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className="px-3 py-1.5 text-[10px] font-black rounded-md transition-all"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table list of Active/Inactive E-Way Bills */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Invoice / Recipient</th>
                    <th className="px-6 py-4">E-Way Bill Details</th>
                    <th className="px-6 py-4">Vehicle/Transporter</th>
                    <th className="px-6 py-4">Valid Upto</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedDisplayedEwbs.map(inv => {
                    const ewb = inv.ewayBillDetails!;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="font-extrabold text-xs text-slate-900 block">{inv.invoiceNumber}</span>
                            <span className="text-[11px] font-semibold text-slate-500 block">{inv.partyName}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">Amt: {formatCurrency(inv.amount)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="font-mono font-black text-xs text-purple-700 tracking-wider block bg-purple-50 border border-purple-100/50 px-2 py-0.5 rounded-md inline-block">
                              {ewb.ewayBillNo}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-semibold">Dated: {ewb.ewayBillDate}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <Truck size={13} className="text-slate-400" />
                              {ewb.vehicleNo || 'Part-A Only'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 block max-w-[150px] truncate">
                              {ewb.transporterName || 'No Transporter Assigned'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {(() => {
                            const valInfo = getEWayBillValidityInfo(ewb.validUpto);
                            return (
                              <div className="space-y-1.5 max-w-[140px]">
                                <span className="text-xs font-mono font-bold text-slate-700 block">{ewb.validUpto}</span>
                                {ewb.status === 'ACTIVE' && (
                                  <div className="space-y-1">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border ${valInfo.badgeClass}`}>
                                      {valInfo.level === 'CRITICAL' && <ShieldAlert size={10} className="animate-bounce" />}
                                      {valInfo.timeText}
                                    </span>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${valInfo.progressColor}`}
                                        style={{ width: `${valInfo.percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            ewb.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {ewb.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {ewb.status === 'ACTIVE' ? (
                            <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setSelectedSlipInvoice(inv)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100/50 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                                title="View/Print official Form GST EWB-01"
                              >
                                <FileText size={11} />
                                Slip
                              </button>
                              <button 
                                onClick={() => openPartBModal(inv)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold transition-all"
                                title="Update Part B parameters"
                              >
                                Part B
                              </button>
                              <button 
                                onClick={() => openVehicleModal(inv)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold transition-all"
                                title="Change Vehicle registration"
                              >
                                Vehicle
                              </button>
                              <button 
                                onClick={() => openTransporterModal(inv)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold transition-all"
                                title="Assign/Change Transporter"
                              >
                                Transporter
                              </button>
                              <button 
                                onClick={() => openExtendModal(inv)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-extrabold border border-amber-100 transition-all"
                                title="Extend validity period"
                              >
                                Extend
                              </button>
                              <button 
                                onClick={() => openCancelModal(inv)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                title="Cancel E-Way Bill"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-semibold">No Actions Allowed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {displayedEwbs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <Truck size={32} />
                          </div>
                          <p className="font-extrabold text-slate-400 text-sm">No active E-Way bills matched search query.</p>
                          <button 
                            onClick={() => { setSearchQuery(''); setFilterStatus('ALL'); }}
                            className="text-xs font-black text-purple-600 hover:underline"
                          >
                            Reset filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {displayedEwbs.length > 0 && (
              <EWayBillPagination
                currentPage={ewbCurrentPage}
                totalItems={ewbTotalItems}
                pageSize={ewbPageSize}
                onPageChange={setEwbCurrentPage}
                onPageSizeChange={setEwbPageSize}
                itemLabel="e-way bills"
                pageSizeOptions={[5, 10, 20, 50, 100]}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'GENERATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Main generator form panel (2/3 width) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              Generate Single E-Way Bill
            </h3>

            <form onSubmit={handleGenerateSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Select Pending Invoice Document</label>
                <select
                  value={genSelectedInvoiceId}
                  onChange={(e) => setGenSelectedInvoiceId(e.target.value)}
                  required
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs outline-hidden focus:bg-white focus:border-purple-500 transition-colors"
                >
                  <option value="">-- Choose Eligible Document --</option>
                  {eligibleInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.partyName} ({formatCurrency(inv.amount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Vehicle Registration No (Part-B)</label>
                  <input
                    type="text"
                    value={genVehicleNo}
                    onChange={(e) => setGenVehicleNo(e.target.value)}
                    placeholder="e.g. MH-12-PQ-9876"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Mode of Transport</label>
                  <select
                    value={genTransportMode}
                    onChange={(e) => setGenTransportMode(e.target.value as any)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  >
                    <option value="ROAD">Road</option>
                    <option value="RAIL">Rail</option>
                    <option value="AIR">Air</option>
                    <option value="SHIP">Ship</option>
                  </select>
                </div>
              </div>

              {/* Route & Distance Prediction Dashboard */}
              {(() => {
                const selectedInvObj = eligibleInvoices.find(i => i.id === genSelectedInvoiceId);
                if (!selectedInvObj) return null;
                const routeInfo = getRouteForInvoice(selectedInvObj);
                return (
                  <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
                        <Activity size={12} />
                        Automated Transit Distance & Routing Estimator
                      </span>
                      <span className="text-[9px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-black">
                        Rule 138 Compliant
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Calculated Distance</span>
                        <span className="font-extrabold text-slate-800">{routeInfo.distance} Kilometers</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Transit Hubs</span>
                        <span className="font-bold text-slate-700">{routeInfo.from} ➔ {routeInfo.to}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Legal Validity Granted</span>
                        <span className="font-black text-emerald-600 block">⏳ {routeInfo.days} Days Standard</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Transporter Assignment Directory</label>
                  <button
                    type="button"
                    onClick={() => setShowTransporterList(!showTransporterList)}
                    className="text-[10px] font-black text-purple-600 hover:underline flex items-center gap-1"
                  >
                    {showTransporterList ? 'Hide Directory' : 'Quick Choose from Fleet Directory ➔'}
                  </button>
                </div>

                {showTransporterList && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                    {TRANSPORTERS.map(tr => (
                      <div
                        key={tr.id}
                        onClick={() => {
                          setGenTransporterId(tr.id);
                          setGenTransporterName(tr.name);
                          const randSuffix = Math.floor(1000 + Math.random() * 9000);
                          const randomAlphabet = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
                          setGenVehicleNo(`${tr.prefix}-${randomAlphabet}-${randSuffix}`);
                          setGenTransportDocNo(`LR-${Math.floor(100000 + Math.random() * 900000)}`);
                          setShowTransporterList(false);
                          showToast(`Assigned ${tr.name}. Carrier vehicle & Lorry Receipt generated!`);
                        }}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          genTransporterId === tr.id ? 'bg-purple-50 border-purple-300 shadow-2xs' : 'bg-white border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{tr.name}</span>
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded font-black">★ {tr.rating}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">ID: {tr.id} • {tr.speed}</p>
                        </div>
                        <span className="text-[9px] font-extrabold text-purple-600 uppercase bg-purple-50/50 px-1.5 py-0.5 rounded">
                          {tr.avgSpeed}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Transporter ID (LID)</label>
                    <input
                      type="text"
                      value={genTransporterId}
                      onChange={(e) => setGenTransporterId(e.target.value)}
                      placeholder="e.g. TRANS-9081"
                      required
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Transporter Name</label>
                    <input
                      type="text"
                      value={genTransporterName}
                      onChange={(e) => setGenTransporterName(e.target.value)}
                      placeholder="e.g. SuperFast Logistics Ltd"
                      required
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Transport Doc / GR No</label>
                    <input
                      type="text"
                      value={genTransportDocNo}
                      onChange={(e) => setGenTransportDocNo(e.target.value)}
                      placeholder="e.g. TR-DOC-1029"
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                    />
                  </div>

                  {genTransporterId && (
                    <div className="flex items-center gap-2 pt-5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      <span className="text-[10px] text-emerald-700 font-extrabold">
                        ✓ Carrier Handshake active (LID-TRANS-SMS-SENT)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={generateMutation.isPending || !genSelectedInvoiceId}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-97"
              >
                {generateMutation.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                {generateMutation.isPending ? 'Transmitting to IRP Gateway...' : 'Submit & Register E-Way Bill'}
              </button>

            </form>
          </div>

          {/* Quick FAQ / Guidelines Sidebar */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">EWB Generation Guidelines</h4>
              
              <div className="space-y-3.5 text-[11px] text-slate-300">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold text-white">Threshold limit:</span> E-Way bill is mandatory for interstate consignments with a value exceeding ₹50,000.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold text-white">Validity rule:</span> Usually, 1 day validity is granted for every 200 km (or part thereof) of transit distance.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold text-white">Part-A & Part-B:</span> Generation of Part-A blocks your tax value, but transit is illegal until Part-B (vehicle assignment) is written.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
              <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Gateway Status</h5>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>National EWB-NIC Gateway Online</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Avg. response time: 210ms. Connection cryptographically signed using GSP GSTIN API integration.
              </p>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'CONSOLIDATED' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Create Consolidated EWB Panel */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Layers size={18} className="text-purple-600" />
              Generate Consolidated E-Way Bill
            </h3>
            <p className="text-[11px] text-slate-500">
              Combine multiple individual E-Way Bills carrying identical transport modes in a single transport vehicle to avoid transit harassment.
            </p>

            <form onSubmit={handleConsolidatedSubmit} className="space-y-4 pt-2">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Consolidated Vehicle Number</label>
                  <input
                    type="text"
                    required
                    value={conVehicleNo}
                    onChange={(e) => setConVehicleNo(e.target.value)}
                    placeholder="e.g. KA-03-MM-1212"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Dispatch Origin Place</label>
                  <input
                    type="text"
                    required
                    value={conFromPlace}
                    onChange={(e) => setConFromPlace(e.target.value)}
                    placeholder="e.g. Bangalore East Depot"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">State of Origin</label>
                  <select
                    value={conStateCode}
                    onChange={(e) => setConStateCode(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  >
                    <option value="27">27 - Maharashtra</option>
                    <option value="29">29 - Karnataka</option>
                    <option value="07">07 - Delhi</option>
                    <option value="33">33 - Tamil Nadu</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Transport Mode</label>
                  <select
                    value={conTransportMode}
                    onChange={(e) => setConTransportMode(e.target.value as any)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  >
                    <option value="ROAD">Road</option>
                    <option value="RAIL">Rail</option>
                    <option value="AIR">Air</option>
                    <option value="SHIP">Ship</option>
                  </select>
                </div>
              </div>

              {/* Select Active EWBs in scope */}
              <div className="space-y-2 pt-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Select Active E-Way Bills to Consolidate</label>
                
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  {invoicesWithEwb.filter(i => i.ewayBillDetails?.status === 'ACTIVE').map(inv => {
                    const ewb = inv.ewayBillDetails!;
                    const isSelected = conSelectedEwbs.includes(ewb.ewayBillNo);
                    return (
                      <div 
                        key={inv.id}
                        onClick={() => toggleEwbForConsolidated(ewb.ewayBillNo)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50/80 border-purple-200' : 'bg-white border-slate-200/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Swallowed, handled by div click
                            className="text-purple-600 rounded-sm"
                          />
                          <div>
                            <span className="font-mono font-bold text-slate-800">{ewb.ewayBillNo}</span>
                            <span className="text-[10px] text-slate-400 block">{inv.partyName} ({formatCurrency(inv.amount)})</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Veh: {ewb.vehicleNo || 'NA'}</span>
                      </div>
                    );
                  })}

                  {invoicesWithEwb.filter(i => i.ewayBillDetails?.status === 'ACTIVE').length === 0 && (
                    <p className="text-center text-[11px] text-slate-400 py-4">No active E-Way bills available to consolidate.</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={consolidatedMutation.isPending || conSelectedEwbs.length === 0}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {consolidatedMutation.isPending ? 'Bundling and Transmitting...' : 'Generate Consolidated EWB Certificate'}
              </button>

            </form>
          </div>

          {/* Consolidated Registry List */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Consolidated Registry</h4>
              
              <div className="space-y-3">
                {consolidatedBills.map(bill => (
                  <div key={bill.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-black text-purple-700">{bill.consolidatedEwbNo}</span>
                      <span className="text-[9px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {bill.transportMode}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600">
                      <p><span className="font-bold text-slate-800">Vehicle:</span> {bill.vehicleNo}</p>
                      <p><span className="font-bold text-slate-800">From Place:</span> {bill.fromPlace}</p>
                      <p><span className="font-bold text-slate-800">Consolidated:</span> {bill.ewbNumbers.length} Bills Bundled</p>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/50 flex flex-wrap gap-1">
                      {bill.ewbNumbers.map(no => (
                        <span key={no} className="font-mono text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                          {no}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'BULK' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Bulk E-Way Bill Generation Registry</h3>
                <p className="text-[11px] text-slate-500">
                  Select multiple pending invoice documents and dispatch E-Way Bills collectively via single batch dispatch.
                </p>
              </div>

              {bulkSelectedInvoiceIds.length > 0 && (
                <button
                  onClick={handleBulkGenerateSubmit}
                  disabled={bulkMutation.isPending}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-97 cursor-pointer"
                >
                  {bulkMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Generate Bulk ({bulkSelectedInvoiceIds.length})
                </button>
              )}
            </div>

            {/* List of eligible invoices */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest text-[9px] border-b border-slate-200/60">
                  <tr>
                    <th className="px-6 py-3 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={bulkSelectedInvoiceIds.length === eligibleInvoices.length && eligibleInvoices.length > 0}
                        onChange={() => {
                          if (bulkSelectedInvoiceIds.length === eligibleInvoices.length) {
                            setBulkSelectedInvoiceIds([]);
                          } else {
                            setBulkSelectedInvoiceIds(eligibleInvoices.map(i => i.id));
                          }
                        }}
                        className="text-purple-600 rounded-sm"
                      />
                    </th>
                    <th className="px-6 py-3">Invoice Number</th>
                    <th className="px-6 py-3">Party Name</th>
                    <th className="px-6 py-3">GSTIN</th>
                    <th className="px-6 py-3">Taxable Value</th>
                    <th className="px-6 py-3">Place of Supply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedEligibleInvoices.map(inv => {
                    const isSelected = bulkSelectedInvoiceIds.includes(inv.id);
                    return (
                      <tr 
                        key={inv.id} 
                        onClick={() => toggleBulkSelection(inv.id)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50/20' : ''}`}
                      >
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBulkSelection(inv.id)}
                            className="text-purple-600 rounded-sm"
                          />
                        </td>
                        <td className="px-6 py-4 font-extrabold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="px-6 py-4 font-semibold text-slate-600">{inv.partyName}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">{inv.gstin}</td>
                        <td className="px-6 py-4 font-mono font-bold">{formatCurrency(inv.amount)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-500">State Code {inv.placeOfSupply}</td>
                      </tr>
                    );
                  })}

                  {eligibleInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                        All invoices currently possess active registered E-Way Bills. None pending!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {eligibleInvoices.length > 0 && (
                <EWayBillPagination
                  currentPage={bulkCurrentPage}
                  totalItems={bulkTotalItems}
                  pageSize={bulkPageSize}
                  onPageChange={setBulkCurrentPage}
                  onPageSizeChange={setBulkPageSize}
                  itemLabel="pending invoices"
                  pageSizeOptions={[5, 10, 20, 50, 100]}
                />
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal - Cancel */}
      {activeModal === 'CANCEL' && selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="text-rose-500" size={18} />
                Cancel E-Way Bill
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Cancelling E-Way Bill <span className="font-bold text-slate-800">{selectedInvoice.ewayBillDetails?.ewayBillNo}</span>. Please state the cancellation grounds for audit preservation.
              </p>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Cancellation Reason Code</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="1">1 - Data Entry Mistake</option>
                  <option value="2">2 - Duplicate Bill Generated</option>
                  <option value="3">3 - Order Cancelled by Client</option>
                  <option value="4">4 - Others (State Remarks below)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Audit Remarks</label>
                <textarea
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                  placeholder="Provide brief explanation..."
                  required={cancelReason === '4'}
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelMutation.isPending}
                  className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-200 text-white font-extrabold rounded-xl"
                >
                  {cancelMutation.isPending ? 'Transmitting Cancellation...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Extend Validity */}
      {activeModal === 'EXTEND' && selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Clock className="text-amber-500" size={18} />
                Extend E-Way Bill Validity
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Extend Validity of E-Way Bill <span className="font-bold text-slate-800">{selectedInvoice.ewayBillDetails?.ewayBillNo}</span>. Must be requested within 8 hours of original expiry.
              </p>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Extension Reason</label>
                <select
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="REASON_BREAKDOWN">Vehicle Breakdown / Mechanical Failure</option>
                  <option value="REASON_TRANSSHIPMENT">Transshipment Delay at Depot</option>
                  <option value="REASON_TRAFFIC">Heavy Traffic Jam / Highway block</option>
                  <option value="REASON_CALAMITY">Natural Calamity / Adverse Weather</option>
                  <option value="REASON_OTHERS">Others / State Order Alteration</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">Active Vehicle No</label>
                  <input
                    type="text"
                    required
                    value={extendVehicleNo}
                    onChange={(e) => setExtendVehicleNo(e.target.value)}
                    placeholder="MH-12-PQ-9876"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">Current Transit Place</label>
                  <input
                    type="text"
                    required
                    value={extendCurrentPlace}
                    onChange={(e) => setExtendCurrentPlace(e.target.value)}
                    placeholder="e.g. Pune Highway Toll"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Remaining Distance (KM)</label>
                <input
                  type="number"
                  required
                  value={extendRemainingDistance}
                  onChange={(e) => setExtendRemainingDistance(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={extendMutation.isPending}
                  className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-200 text-white font-extrabold rounded-xl"
                >
                  {extendMutation.isPending ? 'Extending...' : 'Request Extension'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Vehicle Update */}
      {activeModal === 'VEHICLE' && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Truck className="text-purple-600" size={18} />
                Update EWB Vehicle Registration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleVehicleSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Update vehicle carrying consignment for EWB <span className="font-bold text-slate-800">{selectedInvoice.ewayBillDetails?.ewayBillNo}</span>. Required when goods shift carriers.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">New Vehicle Number</label>
                  <input
                    type="text"
                    required
                    value={vehUpdateNo}
                    onChange={(e) => setVehUpdateNo(e.target.value)}
                    placeholder="e.g. MH-12-PQ-9876"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">Shift Location (Place)</label>
                  <input
                    type="text"
                    required
                    value={vehUpdatePlace}
                    onChange={(e) => setVehUpdatePlace(e.target.value)}
                    placeholder="e.g. Nagpur Warehouse"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Transshipment Reason Code</label>
                <select
                  value={vehUpdateReason}
                  onChange={(e) => setVehUpdateReason(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="TRANSSHIPMENT">Transshipment / Inter-hub dispatch</option>
                  <option value="BREAKDOWN">Vehicle breakdown / Mechanical issue</option>
                  <option value="FIRST_TIME">First time vehicle assignment</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">New Transport Doc No (Optional)</label>
                <input
                  type="text"
                  value={vehUpdateDocNo}
                  onChange={(e) => setVehUpdateDocNo(e.target.value)}
                  placeholder="e.g. TR-DOC- Nagpur-90"
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updateVehicleMutation.isPending}
                  className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-200 text-white font-extrabold rounded-xl"
                >
                  {updateVehicleMutation.isPending ? 'Saving vehicle...' : 'Write Vehicle Update'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Transporter Update */}
      {activeModal === 'TRANSPORTER' && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Send className="text-purple-600" size={18} />
                Assign / Change Transporter
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTransporterSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Update carrying transport agency. Note: Once transporter is assigned, only they can update Part-B.
              </p>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Select Registered Agency Fleet</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {TRANSPORTERS.map(tr => (
                    <div
                      key={tr.id}
                      onClick={() => {
                        setTransporterId(tr.id);
                        setTransporterName(tr.name);
                        showToast(`Selected transporter: ${tr.name}`);
                      }}
                      className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-all flex items-center justify-between ${
                        transporterId === tr.id ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold text-slate-800 block">{tr.name}</span>
                        <span className="text-[9px] text-slate-400">ID: {tr.id} • Rating: {tr.rating}★</span>
                      </div>
                      <span className="text-[9px] font-black text-purple-600 bg-purple-50/50 px-1 py-0.5 rounded">{tr.avgSpeed}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Transporter ID</label>
                <input
                  type="text"
                  required
                  value={transporterId}
                  onChange={(e) => setTransporterId(e.target.value)}
                  placeholder="e.g. TRANS-8819"
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Transporter Agency Name</label>
                <input
                  type="text"
                  required
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  placeholder="e.g. BlueDart Cargo services"
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updateTransporterMutation.isPending}
                  className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-200 text-white font-extrabold rounded-xl"
                >
                  {updateTransporterMutation.isPending ? 'Assigning transporter...' : 'Re-assign Transporter'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Part-B Update */}
      {activeModal === 'PART_B' && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-5"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Sliders className="text-purple-600" size={18} />
                Write Part-B Compliance values
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePartBSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Provide vehicle, dispatch document, and transport mode values to complete the Part-B segment of the E-Way Bill.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">Vehicle Number</label>
                  <input
                    type="text"
                    required
                    value={partBVehicleNo}
                    onChange={(e) => setPartBVehicleNo(e.target.value)}
                    placeholder="MH-12-PQ-9876"
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-500 uppercase text-[9px]">Transport Mode</label>
                  <select
                    value={partBMode}
                    onChange={(e) => setPartBMode(e.target.value as any)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="ROAD">Road</option>
                    <option value="RAIL">Rail</option>
                    <option value="AIR">Air</option>
                    <option value="SHIP">Ship</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-500 uppercase text-[9px]">Transport Doc No / Lorry Receipt</label>
                <input
                  type="text"
                  required
                  value={partBDocNo}
                  onChange={(e) => setPartBDocNo(e.target.value)}
                  placeholder="e.g. LR-908123"
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={updatePartBMutation.isPending}
                  className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-200 text-white font-extrabold rounded-xl"
                >
                  {updatePartBMutation.isPending ? 'Updating Part B...' : 'Update Part B'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
