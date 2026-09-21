import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Calendar, ShieldAlert, CheckCircle2, Info, ArrowUpRight, 
  Sparkles, HelpCircle, FileText, ArrowRight, UserPlus, Layers, PlusCircle, 
  AlertTriangle, Search, Download, Plus, Trash2, Printer, Check, Copy, 
  AlertCircle, FileSpreadsheet, Send, Landmark, CreditCard, Receipt, RefreshCw, Eye
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell 
} from 'recharts';
import { createInvoice, fetchInvoices } from '../services/api';
import { Invoice, InvoiceItem } from '../types';

interface RcmCalculatorProps {
  tenantId?: string;
  onInvoiceCreated?: () => void;
}

// State code list
const GST_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '07', name: 'Delhi' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '24', name: 'Gujarat' },
  { code: '36', name: 'Telangana' },
  { code: '32', name: 'Kerala' },
  { code: '99', name: 'Import/Other' }
];

// Predefined RCM Categories
const RCM_CATEGORIES = [
  {
    id: 'gta',
    name: 'Goods Transport Agency (GTA)',
    defaultRate: 5,
    hsnSac: '996711',
    section: 'Section 9(3)',
    description: 'Services provided by a Goods Transport Agency in respect of transportation of goods by road.',
    itcNote: 'Eligible for Input Tax Credit if recipient did not opt for GTA 12% forward charge.',
    defaultBlocked: false
  },
  {
    id: 'advocate',
    name: 'Legal Services by Advocate / Firm',
    defaultRate: 18,
    hsnSac: '998211',
    section: 'Section 9(3)',
    description: 'Legal services provided by an individual advocate, senior advocate, or firm of advocates.',
    itcNote: '100% Eligible for ITC when used for commercial business/legal operations.',
    defaultBlocked: false
  },
  {
    id: 'director',
    name: 'Company Director Services',
    defaultRate: 18,
    hsnSac: '998311',
    section: 'Section 9(3)',
    description: 'Services supplied by a director of a company or body corporate to the said company.',
    itcNote: 'Eligible for ITC in full as a business expense.',
    defaultBlocked: false
  },
  {
    id: 'security',
    name: 'Security Personnel Services',
    defaultRate: 18,
    hsnSac: '998525',
    section: 'Section 9(3)',
    description: 'Security services provided by any person other than a body corporate to a registered person.',
    itcNote: 'Eligible for ITC if security is deployed for business premises.',
    defaultBlocked: false
  },
  {
    id: 'rent_cab',
    name: 'Renting of Motor Vehicle (Rent-a-cab)',
    defaultRate: 5,
    hsnSac: '996412',
    section: 'Section 9(3)',
    description: 'Renting of a motor vehicle designed to carry passengers, where fuel cost is included.',
    itcNote: 'Blocked under Section 17(5) unless used for specified passenger transport operations.',
    defaultBlocked: true
  },
  {
    id: 'sponsorship',
    name: 'Sponsorship Services',
    defaultRate: 18,
    hsnSac: '998397',
    section: 'Section 9(3)',
    description: 'Sponsorship services provided to any body corporate or partnership firm.',
    itcNote: 'Eligible for ITC if promoting commercial trade business.',
    defaultBlocked: false
  },
  {
    id: 'unregistered_goods',
    name: 'Cement / Materials from Unregistered Dealer',
    defaultRate: 18,
    hsnSac: '382400',
    section: 'Section 9(4)',
    description: 'Promoter purchases of cement, capital goods, or other specified items from unregistered suppliers.',
    itcNote: 'Eligible for ITC unless blocked under special real estate sector rules.',
    defaultBlocked: false
  },
  {
    id: 'unregistered_services',
    name: 'Services from Unregistered Suppliers',
    defaultRate: 18,
    hsnSac: '990000',
    section: 'Section 9(4)',
    description: 'Inward business services procured from domestic unregistered contractors or service providers.',
    itcNote: 'Eligible for ITC when used exclusively for taxable business operations.',
    defaultBlocked: false
  }
];

interface PaymentVoucher {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  voucherNumber: string;
  voucherDate: string;
  paymentDate: string;
  paymentMode: string;
  bankName: string;
  utrNumber: string;
  amountPaid: number;
  taxAmount: number;
  supplierName: string;
  remarks: string;
}

export const RcmCalculator: React.FC<RcmCalculatorProps> = ({ 
  tenantId = 't1', 
  onInvoiceCreated 
}) => {
  // Navigation & Sub-Tabs
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'SELF_INVOICE' | 'VOUCHER_TRACKER'>('REGISTER');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Real and seed RCM Invoices State
  const [rcmInvoices, setRcmInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSection, setFilterSection] = useState<'ALL' | 'SEC_9_3' | 'SEC_9_4'>('ALL');
  const [filterCompliance, setFilterCompliance] = useState<'ALL' | 'PENDING_INVOICE' | 'PENDING_VOUCHER' | 'COMPLIANT'>('ALL');

  // Custom persistent RCM Payment Vouchers State
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);

  // State code definitions for current business entity (Recipient)
  const RecipientCompany = {
    name: 'Acme Taxflow Solutions Private Limited',
    gstin: '27AAACA1234F1Z1', // Maharashtra GSTIN
    state: '27',
    stateName: 'Maharashtra',
    address: '801-804, Kohinoor Commercial Tower, Senapati Bapat Marg, Dadar West, Mumbai, MH - 400028'
  };

  // Self-Invoice Generator Form States
  const [siCategory, setSiCategory] = useState<string>('gta');
  const [siSupplierName, setSiSupplierName] = useState<string>('Om Logistics Unregistered');
  const [siTaxableValue, setSiTaxableValue] = useState<number>(85000);
  const [siCustomRate, setSiCustomRate] = useState<number>(5);
  const [siUseCustomRate, setSiUseCustomRate] = useState<boolean>(false);
  const [siSupplierState, setSiSupplierState] = useState<string>('27'); // Maharashtra
  const [siInvoiceNo, setSiInvoiceNo] = useState<string>('');
  const [siDate, setSiDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [siIsBlocked, setSiIsBlocked] = useState<boolean>(false);
  const [isSiSubmitting, setIsSiSubmitting] = useState<boolean>(false);

  // Payment Voucher Generator Form States
  const [selectedInvoiceIdForVoucher, setSelectedInvoiceIdForVoucher] = useState<string>('');
  const [pvVoucherNo, setPvVoucherNo] = useState<string>('');
  const [pvPaymentDate, setPvPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pvPaymentMode, setPvPaymentMode] = useState<string>('NEFT');
  const [pvBankName, setPvBankName] = useState<string>('HDFC Bank');
  const [pvUtrNo, setPvUtrNo] = useState<string>('');
  const [pvRemarks, setPvRemarks] = useState<string>('Paid reverse charge inward supply settlement.');

  // Selected document preview states (Modal)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewVoucher, setPreviewVoucher] = useState<PaymentVoucher | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Default initial RCM invoices (merged with GSTR register data)
  const getSeedRcmInvoices = (): Invoice[] => [
    {
      id: 'rcm-seed-1',
      tenantId,
      invoiceNumber: 'SELF-2026-GTA-109',
      partyName: 'Express Goods Carriers (Unregistered)',
      gstin: 'URD-SUPPLIER',
      placeOfSupply: '27',
      date: '2026-08-05',
      amount: 120000,
      taxAmount: 6000,
      taxDetails: { taxableValue: 120000, igst: 0, cgst: 3000, sgst: 3000, utgst: 0, cess: 0 },
      status: 'PAID',
      type: 'B2B',
      category: 'PURCHASE',
      docType: 'INVOICE',
      isRcm: true,
      tags: ['GTA', 'Section 9(3)'],
      supplierGstin: 'URD-SUPPLIER'
    },
    {
      id: 'rcm-seed-2',
      tenantId,
      invoiceNumber: 'SELF-2026-ADV-452',
      partyName: 'Chambers of Advocate Malhotra & Associates',
      gstin: 'URD-SUPPLIER',
      placeOfSupply: '27',
      date: '2026-08-12',
      amount: 250000,
      taxAmount: 45000,
      taxDetails: { taxableValue: 250000, igst: 0, cgst: 22500, sgst: 22500, utgst: 0, cess: 0 },
      status: 'PENDING',
      type: 'B2B',
      category: 'PURCHASE',
      docType: 'INVOICE',
      isRcm: true,
      tags: ['Legal Services', 'Section 9(3)'],
      supplierGstin: 'URD-SUPPLIER'
    },
    {
      id: 'rcm-seed-3',
      tenantId,
      invoiceNumber: 'SELF-2026-DIR-004',
      partyName: 'Dr. Anand Mahindra (Independent Director)',
      gstin: 'URD-SUPPLIER',
      placeOfSupply: '27',
      date: '2026-08-18',
      amount: 400000,
      taxAmount: 72000,
      taxDetails: { taxableValue: 400000, igst: 0, cgst: 36000, sgst: 36000, utgst: 0, cess: 0 },
      status: 'PENDING',
      type: 'B2B',
      category: 'PURCHASE',
      docType: 'INVOICE',
      isRcm: true,
      tags: ['Director Remuneration', 'Section 9(3)'],
      supplierGstin: 'URD-SUPPLIER'
    },
    {
      id: 'rcm-seed-4',
      tenantId,
      invoiceNumber: 'SELF-2026-CEM-881',
      partyName: 'Standard Cement Traders (Unregistered Local Dealer)',
      gstin: 'URD-SUPPLIER',
      placeOfSupply: '27',
      date: '2026-08-20',
      amount: 550000,
      taxAmount: 99000,
      taxDetails: { taxableValue: 550000, igst: 0, cgst: 49500, sgst: 49500, utgst: 0, cess: 0 },
      status: 'PENDING',
      type: 'B2B',
      category: 'PURCHASE',
      docType: 'INVOICE',
      isRcm: true,
      tags: ['Real Estate Procurement', 'Section 9(4)'],
      supplierGstin: 'URD-SUPPLIER'
    }
  ];

  // Load Invoices and Vouchers on Mount
  const loadRcmData = async () => {
    setLoading(true);
    try {
      // 1. Fetch from server API
      const serverInvoices = await fetchInvoices(tenantId);
      const serverRcm = serverInvoices.filter(inv => inv.isRcm === true);
      
      // Merge with seed data if they do not exist
      const seeds = getSeedRcmInvoices();
      const merged = [...serverRcm];
      
      seeds.forEach(s => {
        if (!merged.some(m => m.invoiceNumber === s.invoiceNumber)) {
          merged.push(s);
        }
      });
      
      // Sort newest first
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRcmInvoices(merged);

      // 2. Load payment vouchers from localStorage
      const storedVouchers = localStorage.getItem(`rcm_vouchers_${tenantId}`);
      if (storedVouchers) {
        setVouchers(JSON.parse(storedVouchers));
      } else {
        // Create a default seed voucher for rcm-seed-1
        const defaultVoucher: PaymentVoucher = {
          id: 'voucher-seed-1',
          invoiceId: 'rcm-seed-1',
          invoiceNumber: 'SELF-2026-GTA-109',
          voucherNumber: 'PV-2026-AUG-01',
          voucherDate: '2026-08-06',
          paymentDate: '2026-08-06',
          paymentMode: 'NEFT',
          bankName: 'HDFC Bank',
          utrNumber: 'HDFCR5202608069921',
          amountPaid: 120000,
          taxAmount: 6000,
          supplierName: 'Express Goods Carriers (Unregistered)',
          remarks: 'Settlement for freight cargo inward supplies under reverse charge Section 9(3).'
        };
        setVouchers([defaultVoucher]);
        localStorage.setItem(`rcm_vouchers_${tenantId}`, JSON.stringify([defaultVoucher]));
      }

      // Generate invoice number draft for self-invoice
      generateInvoiceDraftNumber();

    } catch (err) {
      console.error('Error loading RCM registries:', err);
      showToast('Error syncing purchase ledgers. Using local cache.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRcmData();
  }, [tenantId]);

  // Draft invoice number generation helper
  const generateInvoiceDraftNumber = () => {
    const yr = new Date().getFullYear();
    const month = new Date().toLocaleString('default', { month: 'short' }).toUpperCase();
    const randHex = Math.floor(100 + Math.random() * 900);
    setSiInvoiceNo(`SELF-${yr}-${month}-${randHex}`);
  };

  // Draft payment voucher number helper
  const generateVoucherNumberDraft = (invNo: string) => {
    const cleanNo = invNo.replace('SELF-', '').replace('INV-', '');
    setPvVoucherNo(`PV-${cleanNo}`);
  };

  // Watch for Category change in Self-Invoice to reset rate/blocked defaults
  useEffect(() => {
    const match = RCM_CATEGORIES.find(c => c.id === siCategory);
    if (match) {
      if (!siUseCustomRate) {
        setSiCustomRate(match.defaultRate);
      }
      setSiIsBlocked(match.defaultBlocked);
    }
  }, [siCategory, siUseCustomRate]);

  // Determine supply type for self-invoice
  const isSiInterstate = RecipientCompany.state !== siSupplierState;

  // Real-time Self-Invoice mathematical model
  const siCalcs = useMemo(() => {
    const value = siTaxableValue;
    const rate = siCustomRate;
    const totalTax = value * (rate / 100);

    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    if (isSiInterstate) {
      igst = totalTax;
    } else {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    }

    const netTaxTotal = igst + cgst + sgst;
    const grossTotal = value + netTaxTotal;

    return {
      value,
      rate,
      igst,
      cgst,
      sgst,
      netTaxTotal,
      grossTotal
    };
  }, [siTaxableValue, siCustomRate, isSiInterstate]);

  // ==========================================
  // HANDLER: Create Section 31(3)(f) Self-Invoice
  // ==========================================
  const handleIssueSelfInvoice = async () => {
    if (!siSupplierName) {
      showToast('Supplier Name is a mandatory statutory field.', 'warning');
      return;
    }
    if (siTaxableValue <= 0) {
      showToast('Taxable value must be greater than zero.', 'warning');
      return;
    }

    setIsSiSubmitting(true);
    try {
      const selectedCatObj = RCM_CATEGORIES.find(c => c.id === siCategory) || RCM_CATEGORIES[0];
      const items: InvoiceItem[] = [
        {
          id: `item-${Date.now()}`,
          description: `Self-Invoice: RCM inward procurement under ${selectedCatObj.section} - ${selectedCatObj.name}`,
          hsnSac: selectedCatObj.hsnSac,
          quantity: 1,
          unit: 'NOS',
          rate: siTaxableValue,
          taxRate: siCalcs.rate,
          taxableValue: siTaxableValue,
          taxAmount: siCalcs.netTaxTotal
        }
      ];

      const invoiceData: Partial<Invoice> & { items: InvoiceItem[] } = {
        tenantId,
        invoiceNumber: siInvoiceNo,
        partyName: siSupplierName,
        gstin: 'URD-SUPPLIER', // Unregistered Supplier
        placeOfSupply: RecipientCompany.state,
        date: siDate,
        amount: siTaxableValue,
        taxAmount: siCalcs.netTaxTotal,
        taxDetails: {
          taxableValue: siTaxableValue,
          igst: siCalcs.igst,
          cgst: siCalcs.cgst,
          sgst: siCalcs.sgst,
          utgst: 0,
          cess: 0
        },
        items,
        status: 'PENDING',
        type: 'B2B',
        category: 'PURCHASE',
        docType: 'INVOICE',
        isRcm: true,
        isBlockedItc: siIsBlocked,
        tags: [selectedCatObj.name, selectedCatObj.section],
        supplierGstin: 'URD-SUPPLIER'
      };

      // Push real API post
      await createInvoice(invoiceData);

      // Instantly inject into our local react list state to avoid lagging reload
      setRcmInvoices(prev => [invoiceData as Invoice, ...prev]);

      // Call outer hook if present
      if (onInvoiceCreated) {
        onInvoiceCreated();
      }

      showToast(`Self-Invoice ${siInvoiceNo} officially posted & recorded in books!`, 'success');
      
      // Reset form and jump back to registers
      generateInvoiceDraftNumber();
      setActiveTab('REGISTER');
    } catch (err) {
      console.error('Error generating self-invoice:', err);
      showToast('Statutory posting failed. Please review values.', 'warning');
    } finally {
      setIsSiSubmitting(false);
    }
  };

  // ==========================================
  // HANDLER: Create Section 31(3)(g) Payment Voucher
  // ==========================================
  const handleIssuePaymentVoucher = () => {
    if (!selectedInvoiceIdForVoucher) {
      showToast('Please select an RCM transaction reference.', 'warning');
      return;
    }
    if (!pvVoucherNo) {
      showToast('Voucher Serial number is mandatory.', 'warning');
      return;
    }
    if (!pvUtrNo) {
      showToast('Please input bank transaction reference / UTR number for audits.', 'warning');
      return;
    }

    const matchedInvoice = rcmInvoices.find(inv => inv.id === selectedInvoiceIdForVoucher);
    if (!matchedInvoice) return;

    const newVoucher: PaymentVoucher = {
      id: `voucher-${Date.now()}`,
      invoiceId: matchedInvoice.id,
      invoiceNumber: matchedInvoice.invoiceNumber,
      voucherNumber: pvVoucherNo,
      voucherDate: pvPaymentDate,
      paymentDate: pvPaymentDate,
      paymentMode: pvPaymentMode,
      bankName: pvBankName,
      utrNumber: pvUtrNo,
      amountPaid: matchedInvoice.amount,
      taxAmount: matchedInvoice.taxAmount,
      supplierName: matchedInvoice.partyName,
      remarks: pvRemarks
    };

    const updatedVouchers = [newVoucher, ...vouchers];
    setVouchers(updatedVouchers);
    localStorage.setItem(`rcm_vouchers_${tenantId}`, JSON.stringify(updatedVouchers));

    // Update invoice status locally to PAID
    setRcmInvoices(prev => prev.map(inv => {
      if (inv.id === matchedInvoice.id) {
        return { ...inv, status: 'PAID' };
      }
      return inv;
    }));

    showToast(`Payment Voucher ${pvVoucherNo} generated! Invoice marked as paid.`, 'success');
    
    // Clear forms and switch back
    setSelectedInvoiceIdForVoucher('');
    setPvUtrNo('');
    setActiveTab('REGISTER');
  };

  // Quick launch generator helper for an invoice directly from register rows
  const launchPaymentVoucherDraftForInvoice = (invoice: Invoice) => {
    setSelectedInvoiceIdForVoucher(invoice.id);
    generateVoucherNumberDraft(invoice.invoiceNumber);
    setActiveTab('VOUCHER_TRACKER');
  };

  // Filtered RCM Invoices computed data
  const filteredInvoices = useMemo(() => {
    return rcmInvoices.filter(inv => {
      // 1. Search Query
      const query = searchQuery.toLowerCase();
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(query) || 
                            inv.partyName.toLowerCase().includes(query);

      // 2. Section Type (GTA, Director, etc. mapped to Section 9(3) vs 9(4))
      const hasSec94Tag = inv.tags?.some(t => t.includes('9(4)'));
      const matchesSection = filterSection === 'ALL' || 
                             (filterSection === 'SEC_9_3' && !hasSec94Tag) ||
                             (filterSection === 'SEC_9_4' && hasSec94Tag);

      // 3. Compliance Level filters
      const hasVoucher = vouchers.some(v => v.invoiceId === inv.id);
      const isPaid = inv.status === 'PAID';
      
      let matchesCompliance = true;
      if (filterCompliance === 'PENDING_INVOICE') {
        matchesCompliance = false; // By definition all listed here are invoices, but lets say if invoice number is blank?
      } else if (filterCompliance === 'PENDING_VOUCHER') {
        matchesCompliance = !hasVoucher;
      } else if (filterCompliance === 'COMPLIANT') {
        matchesCompliance = hasVoucher && isPaid;
      }

      return matchesSearch && matchesSection && matchesCompliance;
    });
  }, [rcmInvoices, searchQuery, filterSection, filterCompliance, vouchers]);

  // Master KPI Summaries
  const ledgerMetrics = useMemo(() => {
    let totalInwardVal = 0;
    let sec93Tax = 0;
    let sec94Tax = 0;
    let selfInvoiceCount = 0;
    let voucherCount = 0;

    rcmInvoices.forEach(inv => {
      totalInwardVal += inv.amount;
      const is94 = inv.tags?.some(t => t.includes('9(4)'));
      if (is94) {
        sec94Tax += inv.taxAmount;
      } else {
        sec93Tax += inv.taxAmount;
      }
      
      // All items in Rcm list represent self-invoiced inward supplies
      selfInvoiceCount++;

      const hasVou = vouchers.some(v => v.invoiceId === inv.id);
      if (hasVou) {
        voucherCount++;
      }
    });

    const totalCashTax = sec93Tax + sec94Tax;
    const selfInvoiceCompliance = rcmInvoices.length > 0 ? (selfInvoiceCount / rcmInvoices.length) * 100 : 100;
    const voucherCompliance = rcmInvoices.length > 0 ? (voucherCount / rcmInvoices.length) * 100 : 100;

    return {
      totalInwardVal,
      sec93Tax,
      sec94Tax,
      totalCashTax,
      selfInvoiceCompliance,
      voucherCompliance,
      voucherCount
    };
  }, [rcmInvoices, vouchers]);

  // Recharts Chart Config
  const chartData = useMemo(() => {
    return [
      { name: 'Sec 9(3) Liabilities', 'Liabilities (CGST+SGST+IGST)': ledgerMetrics.sec93Tax, fill: '#3b82f6' },
      { name: 'Sec 9(4) Unreg Supplies', 'Liabilities (CGST+SGST+IGST)': ledgerMetrics.sec94Tax, fill: '#f59e0b' }
    ];
  }, [ledgerMetrics]);

  return (
    <div id="rcm-control-center-root" className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast alert box */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl border bg-slate-900 text-white border-slate-800 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-sans">{toast.message}</span>
        </div>
      )}

      {/* Main RCM Premium Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-44 h-44 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-200 rounded-md text-xs text-amber-800 font-extrabold uppercase tracking-wider">
              <ShieldAlert size={12} />
              Statutory RCM Register
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 font-sans">Reverse Charge Mechanism (RCM) Workspace</h2>
            <p className="text-slate-500 text-xs max-w-3xl leading-relaxed">
              Enforce Indian GST Section 9(3) and 9(4) statutory reverse-charge registries. Draft compliance-regulated **Section 31(3)(f) Self-Invoices**, issue audited **Section 31(3)(g) Payment Vouchers**, and balance mandatory cash ledger payables dynamically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadRcmData();
                showToast("Reverse charge ledgers synchronized with portal.");
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border flex items-center justify-center shrink-0"
              title="Refresh register"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => {
                generateInvoiceDraftNumber();
                setActiveTab('SELF_INVOICE');
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <PlusCircle size={14} className="text-blue-400" />
              New Self-Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Modern Control subtabs */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-xs border">
        {[
          { key: 'REGISTER', label: 'RCM Compliance Ledger', icon: Layers },
          { key: 'SELF_INVOICE', label: 'Sec 31(3)(f) Self-Invoice Generator', icon: FileText },
          { key: 'VOUCHER_TRACKER', label: 'Sec 31(3)(g) Payment Voucher Tracker', icon: Receipt }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-xs font-bold rounded-lg transition-all border border-transparent ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEWPORT CONTROLLER */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="text-slate-500 text-xs mt-4 font-semibold font-sans">Scanning inward supplies ledger and compiling RCM records...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: REGISTER TAB */}
          {activeTab === 'REGISTER' && (
            <div className="space-y-6">
              
              {/* Core Ledger KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Inward RCM Purchases</span>
                  <div className="text-xl font-black text-slate-900 font-mono">₹{ledgerMetrics.totalInwardVal.toLocaleString()}</div>
                  <div className="text-[9px] text-slate-400 font-bold">{rcmInvoices.length} Transactions</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Sec 9(3) Cash Liability</span>
                  <div className="text-xl font-black text-blue-700 font-mono">₹{ledgerMetrics.sec93Tax.toLocaleString()}</div>
                  <div className="text-[9px] text-blue-500 font-bold">GTA & Professional Fees</div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Sec 9(4) Cash Liability</span>
                  <div className="text-xl font-black text-amber-700 font-mono">₹{ledgerMetrics.sec94Tax.toLocaleString()}</div>
                  <div className="text-[9px] text-amber-500 font-bold">Unregistered Supplies</div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1 border border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Self-Invoice Rate</span>
                  <div className="text-xl font-black text-emerald-400 font-mono">{ledgerMetrics.selfInvoiceCompliance.toFixed(0)}%</div>
                  <div className="text-[9px] text-emerald-200/75 font-semibold">Section 31(3)(f) Compliant</div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1 border border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Payment Vouchers</span>
                  <div className="text-xl font-black text-sky-400 font-mono">{ledgerMetrics.voucherCompliance.toFixed(0)}%</div>
                  <div className="text-[9px] text-sky-200/75 font-semibold">{ledgerMetrics.voucherCount} Vouchers tracked</div>
                </div>

              </div>

              {/* Advanced Register Grid with search/filters */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Table list left 2/3 */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Reverse Charge Registers</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Auditable record of all reverse charge liabilities incurred.</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search registers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-7 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-[11px] outline-none w-36 font-sans focus:border-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-tier Filter Panel */}
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Statute:</span>
                      {['ALL', 'SEC_9_3', 'SEC_9_4'].map(sec => (
                        <button
                          key={sec}
                          onClick={() => setFilterSection(sec as any)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black border transition-colors ${
                            filterSection === sec 
                              ? 'bg-slate-900 text-white border-transparent' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sec === 'ALL' ? 'All' : sec === 'SEC_9_3' ? 'Sec 9(3)' : 'Sec 9(4)'}
                        </button>
                      ))}
                    </div>

                    <div className="h-4 w-px bg-slate-200 self-center"></div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Audit Compliance:</span>
                      {[
                        { key: 'ALL', label: 'All' },
                        { key: 'PENDING_VOUCHER', label: 'Missing Voucher' },
                        { key: 'COMPLIANT', label: 'Fully Compliant' }
                      ].map(cmp => (
                        <button
                          key={cmp.key}
                          onClick={() => setFilterCompliance(cmp.key as any)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black border transition-colors ${
                            filterCompliance === cmp.key 
                              ? 'bg-slate-900 text-white border-transparent' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cmp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Register Invoices Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-black text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="px-4 py-3">Inward Doc / Supplier</th>
                          <th className="px-4 py-3">Audit Section</th>
                          <th className="px-4 py-3 text-right">Procurement Value</th>
                          <th className="px-4 py-3 text-right">RCM Cash Tax</th>
                          <th className="px-4 py-3 text-center">Compliance Checks</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-slate-400 font-sans text-xs">
                              No reverse charge transactions matched the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map(inv => {
                            const is94 = inv.tags?.some(t => t.includes('9(4)'));
                            const hasVoucher = vouchers.some(v => v.invoiceId === inv.id);
                            const matchedVoucher = vouchers.find(v => v.invoiceId === inv.id);
                            
                            return (
                              <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800">{inv.invoiceNumber}</span>
                                    <button 
                                      onClick={() => setPreviewInvoice(inv)}
                                      className="p-0.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                      title="Preview Statutory Self-Invoice"
                                    >
                                      <Eye size={12} />
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-semibold truncate max-w-[180px]" title={inv.partyName}>
                                    {inv.partyName}
                                  </p>
                                </td>
                                <td className="px-4 py-3.5">
                                  {is94 ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase">
                                      Section 9(4)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-black uppercase">
                                      Section 9(3)
                                    </span>
                                  )}
                                  <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{inv.date}</p>
                                </td>
                                <td className="px-4 py-3.5 text-right font-bold font-mono">
                                  ₹{inv.amount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3.5 text-right font-black text-slate-900 font-mono">
                                  ₹{inv.taxAmount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex flex-col gap-1 items-center justify-center">
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded uppercase">
                                      <Check size={10} /> Self-Invoice
                                    </span>
                                    
                                    {hasVoucher ? (
                                      <button 
                                        onClick={() => matchedVoucher && setPreviewVoucher(matchedVoucher)}
                                        className="inline-flex items-center gap-1 text-[9px] font-black text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.2 rounded uppercase hover:bg-sky-100"
                                        title="Click to view Payment Voucher"
                                      >
                                        <Check size={10} /> Voucher Issued
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.2 rounded uppercase">
                                        <AlertTriangle size={10} /> Voucher Pending
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {!hasVoucher ? (
                                      <button
                                        onClick={() => launchPaymentVoucherDraftForInvoice(inv)}
                                        className="px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors text-[10px] font-black"
                                      >
                                        Issue Voucher
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-bold">Compliant</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Statutory summary & visual offset chart (1/3 width) */}
                <div className="space-y-6">
                  
                  {/* Liability chart */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider block">RCM Cash Liabilities Share</h4>
                    
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                          <YAxis stroke="#64748b" fontSize={9} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                          <Bar dataKey="Liabilities (CGST+SGST+IGST)" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-900 leading-normal flex gap-2">
                      <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-amber-950">Mandatory Cash Payment Rule:</strong>
                        Tax liability arising under reverse charge CANNOT be settled using existing Input Tax Credit. It MUST be paid fully in cash via electronic ledger (GSTR-3B Table 6.1). Recipient can claim corresponding ITC on the same invoice after cash payment.
                      </div>
                    </div>
                  </div>

                  {/* Quick summary of Section 31 obligations */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3.5 text-xs">
                    <h5 className="font-black text-slate-300 flex items-center gap-1.5 uppercase text-[10px] tracking-wider border-b border-slate-800 pb-2">
                      <Info size={14} className="text-amber-400" />
                      GST Audit Checklist (RCM)
                    </h5>

                    <ul className="space-y-2.5 text-[11px] text-slate-400">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Sec 31(3)(f):</strong> Must issue a self-invoice for inward supplies from unregistered suppliers on receipt date.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>Sec 31(3)(g):</strong> Must issue a payment voucher at payment time to suppliers.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>GSTR-3B Table 3.1(d):</strong> Total reverse-charge taxes must be fully declared.</span>
                      </li>
                    </ul>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: AUTOMATED SELF-INVOICE GENERATOR */}
          {activeTab === 'SELF_INVOICE' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: Form parameters */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Calculator size={16} />
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm">Self-Invoice Parameters</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Statutory Procurement Category</label>
                    <select
                      value={siCategory}
                      onChange={(e) => setSiCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                    >
                      {RCM_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.section})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Supplier Name (Unregistered)</label>
                    <input
                      type="text"
                      value={siSupplierName}
                      onChange={(e) => setSiSupplierName(e.target.value)}
                      placeholder="e.g. Om Logistics Unregistered"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs outline-none focus:bg-white focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Self-Invoice Serial #</label>
                    <input
                      type="text"
                      value={siInvoiceNo}
                      onChange={(e) => setSiInvoiceNo(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Supply Date</label>
                    <input
                      type="date"
                      value={siDate}
                      onChange={(e) => setSiDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Taxable Value (₹)</label>
                    <input
                      type="number"
                      value={siTaxableValue}
                      onChange={(e) => setSiTaxableValue(Math.max(0, Number(e.target.value)))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-sm outline-none focus:bg-white focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">GST Rate (%)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSiUseCustomRate(!siUseCustomRate);
                        }}
                        className="text-[9px] text-blue-600 font-bold hover:underline"
                      >
                        {siUseCustomRate ? 'Reset' : 'Override'}
                      </button>
                    </div>
                    <select
                      disabled={!siUseCustomRate}
                      value={siCustomRate}
                      onChange={(e) => setSiCustomRate(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none disabled:opacity-75 focus:bg-white focus:border-slate-400"
                    >
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">ITC blocked Sec 17(5)</label>
                    <div className="flex h-10 items-center justify-between px-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-black text-slate-700">Blocked</span>
                      <input
                        type="checkbox"
                        checked={siIsBlocked}
                        onChange={(e) => setSiIsBlocked(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Recipient State (Acme POS)</label>
                    <select
                      disabled
                      value={RecipientCompany.state}
                      className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-500"
                    >
                      <option value="27">27 - Maharashtra (HO)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Unregistered Supplier State</label>
                    <select
                      value={siSupplierState}
                      onChange={(e) => setSiSupplierState(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-slate-400"
                    >
                      {GST_STATES.map(st => (
                        <option key={st.code} value={st.code}>{st.code} - {st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Statutory Callout */}
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-900 leading-normal flex gap-2">
                  <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-black text-blue-950">Section 31(3)(f) Legal Obligation:</strong>
                    A registered person liable to pay tax under reverse charge shall issue an invoice in respect of goods or services received by him from the supplier who is not registered on the date of receipt of goods or services.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleIssueSelfInvoice}
                  disabled={isSiSubmitting}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isSiSubmitting ? (
                    <span className="animate-spin text-white">⏳</span>
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  )}
                  {isSiSubmitting ? 'Posting invoice...' : 'Commit, Post & Issue Self-Invoice'}
                </button>
              </div>

              {/* Right Column: Live PDF Style Rendering Sheet */}
              <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col items-center justify-center overflow-auto max-h-[750px]">
                <div className="w-full max-w-lg bg-white border border-slate-300 rounded-xl p-6 shadow-md font-sans text-xs text-slate-800 space-y-5 flex flex-col justify-between relative overflow-hidden aspect-[1/1.414]">
                  
                  {/* Tax Invoice Header */}
                  <div className="text-center space-y-1 border-b border-slate-200 pb-4">
                    <span className="text-[14px] font-black uppercase text-slate-900 tracking-wide block">SELF-INVOICE</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">
                      Issued under Section 31(3)(f) of the Central Goods and Services Tax Act, 2017
                    </span>
                    <div className="mt-1 flex justify-center">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-100 rounded text-[8px] font-black uppercase">
                        Reverse Charge Applicable
                      </span>
                    </div>
                  </div>

                  {/* Supplier & Recipient info block */}
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
                    <div className="space-y-1">
                      <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Recipient (Billed To)</span>
                      <p className="font-black text-slate-900 text-[10px] leading-tight">{RecipientCompany.name}</p>
                      <p className="text-[8px] text-slate-500 font-semibold leading-relaxed">{RecipientCompany.address}</p>
                      <p className="text-[9px] font-bold text-slate-800 font-mono">GSTIN: {RecipientCompany.gstin}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Supplier (Procured From)</span>
                      <p className="font-black text-slate-900 text-[10px] leading-tight">{siSupplierName || 'Unregistered Supplier'}</p>
                      <p className="text-[8px] text-slate-500 leading-relaxed font-semibold">
                        Domestic Address, {GST_STATES.find(s => s.code === siSupplierState)?.name || 'Maharashtra'} State
                      </p>
                      <p className="text-[9px] font-black text-rose-700 uppercase">GSTIN: UNREGISTERED (URD)</p>
                    </div>
                  </div>

                  {/* Document date metadata */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-[9px] border border-slate-100 font-medium">
                    <div>
                      <span className="text-slate-400 font-bold block">Invoice No</span>
                      <span className="font-bold text-slate-800 font-mono">{siInvoiceNo || 'DRAFT'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block">Document Date</span>
                      <span className="font-bold text-slate-800 font-mono">{siDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block">Place of Supply</span>
                      <span className="font-bold text-slate-800">{RecipientCompany.stateName}</span>
                    </div>
                  </div>

                  {/* Table Listing Items */}
                  <div className="flex-1 min-h-[140px] space-y-3.5 pt-2">
                    <div className="border-b border-slate-200 pb-1 flex font-black text-[8px] text-slate-400 uppercase tracking-wider">
                      <span className="flex-1">Description of supply</span>
                      <span className="w-16 text-center">HSN/SAC</span>
                      <span className="w-18 text-right">Taxable (₹)</span>
                      <span className="w-12 text-center">Rate</span>
                      <span className="w-18 text-right">Tax (₹)</span>
                    </div>

                    <div className="flex font-semibold text-[9px] text-slate-800 leading-relaxed">
                      <span className="flex-1">
                        Inward RCM supplies of {RCM_CATEGORIES.find(c => c.id === siCategory)?.name}
                      </span>
                      <span className="w-16 text-center font-mono">
                        {RCM_CATEGORIES.find(c => c.id === siCategory)?.hsnSac}
                      </span>
                      <span className="w-18 text-right font-mono">
                        {siCalcs.value.toLocaleString()}
                      </span>
                      <span className="w-12 text-center font-mono">
                        {siCalcs.rate}%
                      </span>
                      <span className="w-18 text-right font-bold font-mono">
                        {siCalcs.netTaxTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Summary calculations block */}
                  <div className="border-t border-slate-200 pt-3 flex justify-between items-start">
                    <div className="max-w-[200px] border border-slate-200 border-dashed rounded-lg p-2 bg-slate-50 text-[8px] text-slate-400 leading-normal">
                      <span className="font-extrabold text-slate-600 block mb-0.5">STATUTORY NOTE:</span>
                      This invoice is generated in terms of statutory Section 31(3)(f) of the CGST Act, 2017. Tax is fully payable by recipient under reverse charge.
                    </div>

                    <div className="w-48 text-[9px] space-y-1 font-semibold">
                      <div className="flex justify-between text-slate-500">
                        <span>Taxable Value:</span>
                        <span className="font-mono">₹{siCalcs.value.toLocaleString()}</span>
                      </div>
                      
                      {isSiInterstate ? (
                        <div className="flex justify-between text-slate-500">
                          <span>Integrated IGST:</span>
                          <span className="font-mono">₹{siCalcs.igst.toLocaleString()}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-slate-500">
                            <span>Central CGST:</span>
                            <span className="font-mono">₹{siCalcs.cgst.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>State SGST:</span>
                            <span className="font-mono">₹{siCalcs.sgst.toLocaleString()}</span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1">
                        <span>Total RCM Cash Tax:</span>
                        <span className="font-mono font-bold text-slate-800">₹{siCalcs.netTaxTotal.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1.5 text-[11px] font-black">
                        <span>Gross Payable Value:</span>
                        <span className="font-mono text-slate-900">₹{siCalcs.grossTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-[8px] text-slate-400">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 border border-emerald-200 rounded px-2 py-0.5 bg-emerald-50 text-emerald-800 w-fit">
                        <CheckCircle2 size={10} className="text-emerald-600" />
                        <span className="font-black font-sans uppercase text-[7px] tracking-wide">E-Signed Compliant</span>
                      </div>
                      <p className="font-semibold text-slate-500 leading-tight">Post Date: {siDate}</p>
                    </div>

                    <div className="text-right space-y-1.5">
                      <div className="h-4"></div>
                      <p className="font-black text-slate-700 border-t border-slate-200 pt-1 uppercase tracking-wider text-[7px]">
                        Authorized Signatory
                      </p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SECTION 31(3)(g) PAYMENT VOUCHER */}
          {activeTab === 'VOUCHER_TRACKER' && (
            <div className="space-y-6">
              
              {/* Generator Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Form configuration pane */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
                      <Receipt size={16} />
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">Issue Statutory Payment Voucher</h4>
                  </div>

                  {/* Unvouchered Invoices selector */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Select RCM Invoice Reference</label>
                    <select
                      value={selectedInvoiceIdForVoucher}
                      onChange={(e) => {
                        setSelectedInvoiceIdForVoucher(e.target.value);
                        const match = rcmInvoices.find(i => i.id === e.target.value);
                        if (match) {
                          generateVoucherNumberDraft(match.invoiceNumber);
                        }
                      }}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                    >
                      <option value="">-- Choose Unpaid RCM Inward Supply --</option>
                      {rcmInvoices.map(inv => {
                        const hasVou = vouchers.some(v => v.invoiceId === inv.id);
                        return (
                          <option key={inv.id} value={inv.id} disabled={hasVou}>
                            {inv.invoiceNumber} - {inv.partyName} (₹{inv.amount.toLocaleString()}) {hasVou ? ' [Voucher Issued]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Form fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Voucher Serial No</label>
                      <input
                        type="text"
                        value={pvVoucherNo}
                        onChange={(e) => setPvVoucherNo(e.target.value)}
                        placeholder="PV-XXXX"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Date of Payment</label>
                      <input
                        type="date"
                        value={pvPaymentDate}
                        onChange={(e) => setPvPaymentDate(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Payment Mode</label>
                      <select
                        value={pvPaymentMode}
                        onChange={(e) => setPvPaymentMode(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                      >
                        <option value="NEFT">NEFT / RTGS</option>
                        <option value="IMPS">IMPS Net Banking</option>
                        <option value="UPI">UPI Digital Payment</option>
                        <option value="CHEQUE">Bank Cheque</option>
                        <option value="CASH">Cash Disbursements</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Disbursing Bank</label>
                      <input
                        type="text"
                        value={pvBankName}
                        onChange={(e) => setPvBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs outline-none focus:bg-white focus:border-slate-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase">UTR / Txn Ref No</label>
                      <input
                        type="text"
                        value={pvUtrNo}
                        onChange={(e) => setPvUtrNo(e.target.value)}
                        placeholder="Transaction UTR Ref"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none focus:bg-white focus:border-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase">Voucher Remarks</label>
                    <textarea
                      value={pvRemarks}
                      onChange={(e) => setPvRemarks(e.target.value)}
                      rows={2}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs outline-none focus:bg-white focus:border-slate-400 resize-none"
                    />
                  </div>

                  {/* Legal standard warning */}
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-900 leading-normal flex gap-2">
                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-black text-amber-950">Section 31(3)(g) Legal Obligation:</strong>
                      A registered person who is liable to pay tax under reverse charge shall issue a payment voucher at the time of making payment to the supplier. Failure to issue and preserve vouchers represents a critical audit penalty.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleIssuePaymentVoucher}
                    disabled={!selectedInvoiceIdForVoucher}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Issue & Post Payment Voucher
                  </button>
                </div>

                {/* Right Column: Live Voucher PDF style sheet preview */}
                <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200/60 shadow-xs flex flex-col items-center justify-center overflow-auto max-h-[750px]">
                  <div className="w-full max-w-lg bg-white border border-slate-300 rounded-xl p-6 shadow-md font-sans text-xs text-slate-800 space-y-4 flex flex-col justify-between relative overflow-hidden aspect-[1/1.414]">
                    
                    {/* Header */}
                    <div className="text-center space-y-1 border-b border-slate-200 pb-3">
                      <span className="text-[14px] font-black uppercase text-slate-900 tracking-wide block">PAYMENT VOUCHER</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-center">
                        Issued under Section 31(3)(g) of the Central Goods and Services Tax Act, 2017
                      </span>
                    </div>

                    {/* Parties info block */}
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Recipient (Payer)</span>
                        <p className="font-black text-slate-900 text-[10px] leading-tight">{RecipientCompany.name}</p>
                        <p className="text-[8px] text-slate-500 font-semibold leading-relaxed">{RecipientCompany.address}</p>
                        <p className="text-[9px] font-bold text-slate-800 font-mono">GSTIN: {RecipientCompany.gstin}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Supplier (Paid To)</span>
                        <p className="font-black text-slate-900 text-[10px] leading-tight">
                          {selectedInvoiceIdForVoucher 
                            ? rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.partyName 
                            : 'Unregistered Supplier'}
                        </p>
                        <p className="text-[8px] text-slate-500 leading-relaxed font-semibold">
                          Domestic Unregistered Provider
                        </p>
                        <p className="text-[9px] font-black text-rose-700 uppercase">GSTIN: UNREGISTERED (URD)</p>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-[9px] border border-slate-100 font-medium">
                      <div>
                        <span className="text-slate-400 font-bold block">Voucher No</span>
                        <span className="font-bold text-slate-800 font-mono">{pvVoucherNo || 'DRAFT'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Voucher Date</span>
                        <span className="font-bold text-slate-800 font-mono">{pvPaymentDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Payment Date</span>
                        <span className="font-bold text-slate-800 font-mono">{pvPaymentDate}</span>
                      </div>
                    </div>

                    {/* Payment reference info */}
                    <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-lg text-[9px] grid grid-cols-2 gap-4 font-semibold text-sky-950">
                      <div>
                        <span className="text-sky-800/80 font-bold block">Disbursed Via</span>
                        <span className="font-black">{pvPaymentMode} ({pvBankName})</span>
                      </div>
                      <div>
                        <span className="text-sky-800/80 font-bold block">UTR / Txn Reference No</span>
                        <span className="font-bold font-mono text-slate-900">{pvUtrNo || 'PENDING'}</span>
                      </div>
                    </div>

                    {/* Voucher breakdown */}
                    <div className="flex-1 min-h-[100px] space-y-3.5 pt-2">
                      <div className="border-b border-slate-200 pb-1 flex font-black text-[8px] text-slate-400 uppercase tracking-wider">
                        <span className="flex-1">Payment Reference supply</span>
                        <span className="w-24 text-right">Settled Amount</span>
                        <span className="w-24 text-right">RCM Tax Payable</span>
                      </div>

                      <div className="flex font-semibold text-[9px] text-slate-800">
                        <span className="flex-1">
                          Payment against Self-Invoice: <strong className="font-bold text-slate-900 font-mono">
                            {selectedInvoiceIdForVoucher 
                              ? rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.invoiceNumber 
                              : 'SELF-XXXX'}
                          </strong>
                        </span>
                        <span className="w-24 text-right font-bold font-mono">
                          ₹{selectedInvoiceIdForVoucher 
                            ? (rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.amount || 0).toLocaleString() 
                            : '0'}
                        </span>
                        <span className="w-24 text-right font-bold font-mono">
                          ₹{selectedInvoiceIdForVoucher 
                            ? (rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.taxAmount || 0).toLocaleString() 
                            : '0'}
                        </span>
                      </div>
                    </div>

                    {/* Summary Calculations */}
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-start">
                      <div className="max-w-[200px] border border-slate-200 border-dashed rounded-lg p-2 bg-slate-50 text-[8px] text-slate-400 leading-normal">
                        <span className="font-extrabold text-slate-600 block mb-0.5">STATUTORY STATEMENT:</span>
                        This is an official Payment Voucher issued in terms of Section 31(3)(g) of the Central Goods and Services Tax Act, 2017.
                      </div>

                      <div className="w-48 text-[9px] space-y-1 font-semibold">
                        <div className="flex justify-between text-slate-500">
                          <span>Amount Disbursed:</span>
                          <span className="font-mono text-slate-800">
                            ₹{selectedInvoiceIdForVoucher 
                              ? (rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.amount || 0).toLocaleString() 
                              : '0'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>RCM Cash Tax Payable:</span>
                          <span className="font-mono text-slate-800">
                            ₹{selectedInvoiceIdForVoucher 
                              ? (rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.taxAmount || 0).toLocaleString() 
                              : '0'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 text-[11px] font-black">
                          <span>Total Settlement:</span>
                          <span className="font-mono text-slate-950">
                            ₹{selectedInvoiceIdForVoucher 
                              ? (rcmInvoices.find(i => i.id === selectedInvoiceIdForVoucher)?.amount || 0).toLocaleString() 
                              : '0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-[8px] text-slate-400">
                      <div>
                        <div className="flex items-center gap-1.5 border border-sky-200 rounded px-2 py-0.5 bg-sky-50 text-sky-800 w-fit font-bold">
                          <CheckCircle2 size={10} className="text-sky-600" />
                          <span className="font-black text-[7px] tracking-wide uppercase">Audit Locked</span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="h-4"></div>
                        <p className="font-black text-slate-700 border-t border-slate-200 pt-1 uppercase tracking-wider text-[7px]">
                          Authorized Signatory
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Existing Payment Vouchers Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Issued Payment Vouchers Log</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Historical Section 31(3)(g) vouchers recorded under reverse charge.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 border rounded text-[10px] font-black text-slate-600 uppercase">
                    {vouchers.length} Vouchers Issued
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-black text-slate-500 uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-3">Voucher Details</th>
                        <th className="px-4 py-3">Inward Invoice Ref</th>
                        <th className="px-4 py-3">Supplier Name</th>
                        <th className="px-4 py-3">Payment Reference</th>
                        <th className="px-4 py-3 text-right font-bold">Value Paid</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {vouchers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 text-xs font-sans">
                            No payment vouchers issued yet. Select an RCM invoice above to start tracking.
                          </td>
                        </tr>
                      ) : (
                        vouchers.map(vou => (
                          <tr key={vou.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              <div>{vou.voucherNumber}</div>
                              <div className="text-[9px] text-slate-400">{vou.voucherDate}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {vou.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-700 truncate max-w-[120px]">
                              {vou.supplierName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-extrabold text-[9px] bg-slate-100 border px-1.5 py-0.5 rounded uppercase">
                                {vou.paymentMode}
                              </span>
                              <p className="text-[9px] text-slate-400 mt-0.5 font-mono truncate max-w-[140px]">{vou.utrNumber}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-black font-mono">
                              ₹{vou.amountPaid.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setPreviewVoucher(vou)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border text-slate-700 font-bold rounded hover:text-slate-900 transition-colors"
                              >
                                View Voucher
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ==========================================
          MODAL: STATUTORY DOCUMENT PREVIEW SHEET
         ========================================== */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border max-w-xl w-full flex flex-col justify-between relative max-h-[90vh]">
            <button 
              onClick={() => setPreviewInvoice(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Trash2 size={16} />
            </button>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="w-full bg-white font-sans text-xs text-slate-800 space-y-4">
                
                {/* Header */}
                <div className="text-center space-y-1 border-b border-slate-200 pb-3">
                  <span className="text-[14px] font-black uppercase text-slate-900 tracking-wide block">SELF-INVOICE</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-center">
                    Section 31(3)(f) CGST Act, 2017 Compliance Document
                  </span>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-100 rounded text-[8px] font-black uppercase">
                      Reverse Charge Applicable
                    </span>
                  </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3 text-[10px]">
                  <div className="space-y-1">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Recipient (Billed To)</span>
                    <p className="font-black text-slate-900 leading-tight">{RecipientCompany.name}</p>
                    <p className="text-[8px] text-slate-500 font-semibold leading-relaxed">{RecipientCompany.address}</p>
                    <p className="font-bold text-slate-800 font-mono">GSTIN: {RecipientCompany.gstin}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Supplier (Procured From)</span>
                    <p className="font-black text-slate-900 leading-tight">{previewInvoice.partyName}</p>
                    <p className="text-[8px] text-slate-500 leading-relaxed font-semibold">
                      Domestic Unregistered Provider
                    </p>
                    <p className="font-black text-rose-700 uppercase">GSTIN: UNREGISTERED (URD)</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-[9px] border border-slate-100 font-medium">
                  <div>
                    <span className="text-slate-400 font-bold block">Invoice No</span>
                    <span className="font-bold text-slate-800 font-mono">{previewInvoice.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Document Date</span>
                    <span className="font-bold text-slate-800 font-mono">{previewInvoice.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Place of Supply</span>
                    <span className="font-bold text-slate-800">{RecipientCompany.stateName}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3 pt-2">
                  <div className="border-b border-slate-200 pb-1 flex font-black text-[8px] text-slate-400 uppercase tracking-wider">
                    <span className="flex-1">Description of supply</span>
                    <span className="w-16 text-center">HSN/SAC</span>
                    <span className="w-18 text-right">Taxable (₹)</span>
                    <span className="w-18 text-right">Tax Rate</span>
                    <span className="w-18 text-right">Tax Amount</span>
                  </div>

                  <div className="flex font-semibold text-[9px] text-slate-800 leading-relaxed">
                    <span className="flex-1">
                      {previewInvoice.items?.[0]?.description || `Reverse charge inward supply`}
                    </span>
                    <span className="w-16 text-center font-mono">
                      {previewInvoice.items?.[0]?.hsnSac || '990000'}
                    </span>
                    <span className="w-18 text-right font-mono">
                      {previewInvoice.amount.toLocaleString()}
                    </span>
                    <span className="w-18 text-right font-mono">
                      {previewInvoice.items?.[0]?.taxRate || '18'}%
                    </span>
                    <span className="w-18 text-right font-bold font-mono">
                      {previewInvoice.taxAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Calculations */}
                <div className="border-t border-slate-200 pt-3 flex justify-between items-start">
                  <div className="max-w-[200px] border border-slate-200 border-dashed rounded-lg p-2 bg-slate-50 text-[8px] text-slate-400 leading-normal">
                    <span className="font-extrabold text-slate-600 block mb-0.5">STATUTORY NOTE:</span>
                    This invoice is generated in terms of statutory Section 31(3)(f) of the CGST Act, 2017. Tax is fully payable by recipient under reverse charge.
                  </div>

                  <div className="w-48 text-[9px] space-y-1 font-semibold">
                    <div className="flex justify-between text-slate-500">
                      <span>Taxable Value:</span>
                      <span className="font-mono">₹{previewInvoice.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Central CGST:</span>
                      <span className="font-mono">₹{(previewInvoice.taxAmount / 2).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Central SGST:</span>
                      <span className="font-mono">₹{(previewInvoice.taxAmount / 2).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1">
                      <span>Total Cash Tax:</span>
                      <span className="font-mono font-bold text-slate-800">₹{previewInvoice.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1.5 text-[11px] font-black">
                      <span>Gross Value:</span>
                      <span className="font-mono text-slate-900">₹{(previewInvoice.amount + previewInvoice.taxAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Foot signatures */}
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-[8px] text-slate-400">
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-2 py-0.5 font-bold uppercase text-[7px]">
                    <CheckCircle2 size={10} className="text-emerald-600" />
                    <span>Statutory Signed</span>
                  </div>
                  <p className="font-black text-slate-600 uppercase">Authorized Signatory</p>
                </div>

              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
              >
                <Printer size={12} /> Print PDF
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-xs font-bold transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: STATUTORY VOUCHER PREVIEW SHEET
         ========================================== */}
      {previewVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border max-w-xl w-full flex flex-col justify-between relative max-h-[90vh]">
            <button 
              onClick={() => setPreviewVoucher(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Trash2 size={16} />
            </button>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="w-full bg-white font-sans text-xs text-slate-800 space-y-4">
                
                {/* Header */}
                <div className="text-center space-y-1 border-b border-slate-200 pb-3">
                  <span className="text-[14px] font-black uppercase text-slate-900 tracking-wide block">PAYMENT VOUCHER</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-center">
                    Section 31(3)(g) CGST Act, 2017 Compliance Document
                  </span>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-3 text-[10px]">
                  <div className="space-y-1">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Recipient (Payer)</span>
                    <p className="font-black text-slate-900 leading-tight">{RecipientCompany.name}</p>
                    <p className="text-[8px] text-slate-500 font-semibold leading-relaxed">{RecipientCompany.address}</p>
                    <p className="font-bold text-slate-800 font-mono">GSTIN: {RecipientCompany.gstin}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] font-extrabold uppercase text-slate-400 block">Supplier (Paid To)</span>
                    <p className="font-black text-slate-900 leading-tight">{previewVoucher.supplierName}</p>
                    <p className="text-[8px] text-slate-500 leading-relaxed font-semibold font-sans">
                      Domestic Unregistered Provider
                    </p>
                    <p className="font-black text-rose-700 uppercase">GSTIN: UNREGISTERED (URD)</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-[9px] border border-slate-100 font-medium">
                  <div>
                    <span className="text-slate-400 font-bold block">Voucher No</span>
                    <span className="font-bold text-slate-800 font-mono">{previewVoucher.voucherNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Document Date</span>
                    <span className="font-bold text-slate-800 font-mono">{previewVoucher.voucherDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Payment Date</span>
                    <span className="font-bold text-slate-800 font-mono">{previewVoucher.paymentDate}</span>
                  </div>
                </div>

                {/* Transaction details banner */}
                <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-lg text-[9px] grid grid-cols-2 gap-4 font-semibold text-sky-950">
                  <div>
                    <span className="text-sky-800/80 font-bold block">Disbursed Via</span>
                    <span className="font-black">{previewVoucher.paymentMode} ({previewVoucher.bankName})</span>
                  </div>
                  <div>
                    <span className="text-sky-800/80 font-bold block">UTR / Txn Reference No</span>
                    <span className="font-bold font-mono text-slate-900">{previewVoucher.utrNumber}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3 pt-2">
                  <div className="border-b border-slate-200 pb-1 flex font-black text-[8px] text-slate-400 uppercase tracking-wider">
                    <span className="flex-1">Payment Reference supply</span>
                    <span className="w-24 text-right">Settled Amount</span>
                    <span className="w-24 text-right">RCM Tax Payable</span>
                  </div>

                  <div className="flex font-semibold text-[9px] text-slate-800">
                    <span className="flex-1">
                      Payment against Self-Invoice: <strong className="font-bold text-slate-900 font-mono">
                        {previewVoucher.invoiceNumber}
                      </strong>
                    </span>
                    <span className="w-24 text-right font-bold font-mono">
                      ₹{previewVoucher.amountPaid.toLocaleString()}
                    </span>
                    <span className="w-24 text-right font-bold font-mono">
                      ₹{previewVoucher.taxAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Remarks callout */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px] text-slate-500 leading-normal">
                  <strong className="text-slate-700 block mb-0.5">Payment Remarks:</strong>
                  {previewVoucher.remarks}
                </div>

                {/* Calculations */}
                <div className="border-t border-slate-200 pt-3 flex justify-between items-start">
                  <div className="max-w-[200px] border border-slate-200 border-dashed rounded-lg p-2 bg-slate-50 text-[8px] text-slate-400 leading-normal">
                    <span className="font-extrabold text-slate-600 block mb-0.5">STATUTORY STATEMENT:</span>
                    This is an official Payment Voucher issued in terms of Section 31(3)(g) of the Central Goods and Services Tax Act, 2017.
                  </div>

                  <div className="w-48 text-[9px] space-y-1 font-semibold">
                    <div className="flex justify-between text-slate-500">
                      <span>Amount Disbursed:</span>
                      <span className="font-mono text-slate-800">₹{previewVoucher.amountPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>RCM Cash Tax:</span>
                      <span className="font-mono text-slate-800">₹{previewVoucher.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 text-[11px] font-black">
                      <span>Total Settlement:</span>
                      <span className="font-mono text-slate-950">₹{previewVoucher.amountPaid.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Foot signatures */}
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-[8px] text-slate-400">
                  <div className="flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-100 rounded px-2 py-0.5 font-bold uppercase text-[7px]">
                    <CheckCircle2 size={10} className="text-sky-600" />
                    <span>Audit Compliance Locked</span>
                  </div>
                  <p className="font-black text-slate-600 uppercase">Authorized Signatory</p>
                </div>

              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
              >
                <Printer size={12} /> Print PDF
              </button>
              <button
                onClick={() => setPreviewVoucher(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-xs font-bold transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RcmCalculator;
