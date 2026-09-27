import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Sparkles,
  Percent,
  Plus,
  Trash2,
  Building2,
  HelpCircle,
  FileText,
  Mail,
  MessageSquare,
  QrCode,
  IndianRupee,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { RecurringInvoiceProfile, RecurringBillingFrequency, RecurringBillingItem } from '../types';

const INDIAN_STATES = [
  { code: '01', name: '01 - Jammu & Kashmir' },
  { code: '02', name: '02 - Himachal Pradesh' },
  { code: '03', name: '03 - Punjab' },
  { code: '04', name: '04 - Chandigarh' },
  { code: '06', name: '06 - Haryana' },
  { code: '07', name: '07 - Delhi' },
  { code: '08', name: '08 - Rajasthan' },
  { code: '09', name: '09 - Uttar Pradesh' },
  { code: '10', name: '10 - Bihar' },
  { code: '19', name: '19 - West Bengal' },
  { code: '24', name: '24 - Gujarat' },
  { code: '27', name: '27 - Maharashtra (Home State)' },
  { code: '29', name: '29 - Karnataka' },
  { code: '32', name: '32 - Kerala' },
  { code: '33', name: '33 - Tamil Nadu' },
  { code: '36', name: '36 - Telangana' },
  { code: '37', name: '37 - Andhra Pradesh' },
  { code: '96', name: '96 - Other Territory / Foreign' }
];

const SAMPLE_CLIENT_TEMPLATES = [
  {
    name: 'Infosys Cloud Solutions Ltd',
    gstin: '29AABCI1234F1Z5',
    pos: '29',
    email: 'billing@infosyscloud.com',
    phone: '+91 98450 11223'
  },
  {
    name: 'Tata Motors Manufacturing Ltd',
    gstin: '27AAACT2727Q1ZW',
    pos: '27',
    email: 'erp.accounts@tatamotors.com',
    phone: '+91 98200 44556'
  },
  {
    name: 'Nexus Healthcare Systems Pvt Ltd',
    gstin: '07AAACN9988P1Z3',
    pos: '07',
    email: 'finance@nexushealthcare.in',
    phone: '+91 98110 33445'
  },
  {
    name: 'Reliance Retail Logistics Division',
    gstin: '27AAACR1122D1Z9',
    pos: '27',
    email: 'logistics.billing@ril.com',
    phone: '+91 98220 77889'
  },
  {
    name: 'FinTech Global Payments Pvt Ltd',
    gstin: '33AAACF5566M1Z8',
    pos: '33',
    email: 'security.finance@fintechglobal.com',
    phone: '+91 98400 66778'
  }
];

interface RecurringInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profileData: Partial<RecurringInvoiceProfile>) => Promise<void>;
  initialData?: RecurringInvoiceProfile | null;
}

export const RecurringInvoiceModal: React.FC<RecurringInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  if (!isOpen) return null;

  // Form State
  const [profileName, setProfileName] = useState(initialData?.profileName || '');
  const [partyName, setPartyName] = useState(initialData?.partyName || '');
  const [gstin, setGstin] = useState(initialData?.gstin || '');
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialData?.placeOfSupply || '27');
  const [frequency, setFrequency] = useState<RecurringBillingFrequency>(initialData?.frequency || 'MONTHLY');
  const [intervalDayOfMonth, setIntervalDayOfMonth] = useState<number>(initialData?.intervalDayOfMonth || 1);
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>(initialData?.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(initialData?.paymentTermsDays || 15);
  const [customPrefix, setCustomPrefix] = useState(initialData?.customPrefix || 'REC-INV');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isRcm, setIsRcm] = useState(Boolean(initialData?.isRcm));

  // Automation flags
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(initialData?.autoGenerateInvoice ?? true);
  const [autoSendEmail, setAutoSendEmail] = useState(initialData?.autoSendEmail ?? true);
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(initialData?.autoSendWhatsApp ?? false);
  const [autoGenerateIrn, setAutoGenerateIrn] = useState(initialData?.autoGenerateIrn ?? true);

  // Line items
  const [items, setItems] = useState<RecurringBillingItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items;
    }
    return [
      {
        id: `item-${Date.now()}-1`,
        description: 'Monthly Cloud Infrastructure & Managed Services for {{PERIOD}}',
        hsnSac: '998315',
        quantity: 1,
        unit: 'MONTH',
        rate: 50000,
        taxRate: 18,
        taxableValue: 50000,
        taxAmount: 9000,
        cgstAmount: 4500,
        sgstAmount: 4500,
        igstAmount: 0
      }
    ];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Determine supply type (Maharashtra supplier 27)
  const isInterstate = placeOfSupply !== '27';

  // Live tax calculation
  const computedTotals = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    const recalculatedItems = items.map((item) => {
      const lineTaxable = (Number(item.quantity) || 1) * (Number(item.rate) || 0);
      const rate = Number(item.taxRate) || 18;
      const lineTax = (lineTaxable * rate) / 100;
      const lineCgst = isInterstate ? 0 : lineTax / 2;
      const lineSgst = isInterstate ? 0 : lineTax / 2;
      const lineIgst = isInterstate ? lineTax : 0;

      taxable += lineTaxable;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;
      totalTax += lineTax;

      return {
        ...item,
        taxableValue: lineTaxable,
        taxAmount: lineTax,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        igstAmount: lineIgst
      };
    });

    return {
      items: recalculatedItems,
      taxable,
      cgst,
      sgst,
      igst,
      totalTax,
      totalAmount: taxable + totalTax
    };
  }, [items, isInterstate]);

  // Handle line item changes
  const handleItemChange = (index: number, field: keyof RecurringBillingItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        description: 'Professional Services & Consulting for {{PERIOD}}',
        hsnSac: '998311',
        quantity: 1,
        unit: frequency === 'QUARTERLY' ? 'QUARTER' : 'MONTH',
        rate: 25000,
        taxRate: 18,
        taxableValue: 25000,
        taxAmount: 4500,
        cgstAmount: isInterstate ? 0 : 2250,
        sgstAmount: isInterstate ? 0 : 2250,
        igstAmount: isInterstate ? 4500 : 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectClientPreset = (preset: typeof SAMPLE_CLIENT_TEMPLATES[0]) => {
    setPartyName(preset.name);
    setGstin(preset.gstin);
    setPlaceOfSupply(preset.pos);
    setClientEmail(preset.email);
    setClientPhone(preset.phone);
    if (!profileName) {
      setProfileName(`${preset.name} ${frequency === 'QUARTERLY' ? 'Quarterly AMC' : 'Monthly Retainer'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !partyName.trim() || !gstin.trim()) {
      setValidationError('Please provide Contract Profile Name, Client Name, and Valid GSTIN.');
      return;
    }

    if (items.length === 0 || computedTotals.taxable <= 0) {
      setValidationError('Please add at least one line item with a valid billing rate.');
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      await onSave({
        profileName: profileName.trim(),
        partyName: partyName.trim(),
        gstin: gstin.trim().toUpperCase(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        placeOfSupply,
        frequency,
        intervalDayOfMonth: Number(intervalDayOfMonth),
        startDate,
        endDate: endDate || undefined,
        status,
        paymentTermsDays: Number(paymentTermsDays),
        customPrefix: customPrefix.trim().toUpperCase() || 'REC-INV',
        notes: notes.trim(),
        isRcm,
        autoGenerateInvoice,
        autoSendEmail,
        autoSendWhatsApp,
        autoGenerateIrn,
        currency: 'INR',
        items: computedTotals.items,
        taxableAmount: computedTotals.taxable,
        cgstAmount: computedTotals.cgst,
        sgstAmount: computedTotals.sgst,
        igstAmount: computedTotals.igst,
        totalTaxAmount: computedTotals.totalTax,
        totalInvoiceAmount: computedTotals.totalAmount,
        isInterstate
      });
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save recurring schedule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col my-auto">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {initialData ? 'Edit Recurring Billing Schedule' : 'Create Recurring Billing Contract'}
              </h3>
              <p className="text-xs text-indigo-200">
                Automate monthly / quarterly invoicing with statutory GST tax liability calculations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {validationError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Preset Selector */}
          <div>
            <div className="text-slate-500 font-bold mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Quick Fill from Client Directory:
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_CLIENT_TEMPLATES.map((client, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectClientPreset(client)}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded-lg text-slate-700 font-medium transition-all text-left"
                >
                  {client.name.split(' ')[0]} ({client.gstin.substring(0, 2)})
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Client & Contract Profile */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Contract & Client Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contract Profile Name *</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Infosys Cloud Infrastructure Monthly Retainer"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Client Legal Name *</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Infosys Cloud Solutions Ltd"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Client GSTIN *</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setGstin(val);
                    if (val.length >= 2) {
                      const statePrefix = val.substring(0, 2);
                      if (INDIAN_STATES.some((s) => s.code === statePrefix)) {
                        setPlaceOfSupply(statePrefix);
                      }
                    }
                  }}
                  placeholder="e.g. 29AABCI1234F1Z5"
                  maxLength={15}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Place of Supply (POS) *</label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-semibold text-slate-500 mt-1 block">
                  Tax Type: <strong className={isInterstate ? 'text-indigo-600' : 'text-emerald-600'}>
                    {isInterstate ? 'Inter-state Supply (IGST Only)' : 'Intra-state Supply (CGST + SGST 50/50)'}
                  </strong>
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Email (Notifications)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="billing@client.com"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">WhatsApp Mobile (Reminders)</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+91 98450 11223"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Frequency & Schedule Rules */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recurrence Frequency & Billing Calendar
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Frequency *</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MONTHLY">Monthly (12 cycles/year)</option>
                  <option value="QUARTERLY">Quarterly (4 cycles/year)</option>
                  <option value="BI_ANNUAL">Bi-Annual (2 cycles/year)</option>
                  <option value="ANNUAL">Annual (1 cycle/year)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing Day of Month *</label>
                <select
                  value={intervalDayOfMonth}
                  onChange={(e) => setIntervalDayOfMonth(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>1st of the Month / Quarter</option>
                  <option value={5}>5th of the Month</option>
                  <option value={10}>10th of the Month</option>
                  <option value={15}>15th of the Month</option>
                  <option value={20}>20th of the Month</option>
                  <option value={25}>25th of the Month</option>
                  <option value={28}>28th (Month-end Safe)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Credit Terms</label>
                <select
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>Immediate (Due upon receipt)</option>
                  <option value={7}>Net 7 Days</option>
                  <option value={15}>Net 15 Days</option>
                  <option value={30}>Net 30 Days</option>
                  <option value={45}>Net 45 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Line Items & Live Tax Computation Matrix */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Recurring Line Items & Statutory GST Slabs
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Use <code className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded">&#123;&#123;PERIOD&#125;&#125;</code> in description to dynamically inject billing period (e.g. October 2026).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>
            </div>

            {/* Table of items */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200/80 text-slate-700 font-bold">
                    <th className="p-2.5 rounded-l-lg">Item / Service Description</th>
                    <th className="p-2.5 w-24">HSN/SAC</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    <th className="p-2.5 w-20">Unit</th>
                    <th className="p-2.5 w-28 text-right">Unit Rate (₹)</th>
                    <th className="p-2.5 w-20 text-center">GST %</th>
                    <th className="p-2.5 w-28 text-right">Taxable (₹)</th>
                    <th className="p-2.5 w-28 text-right">Tax (₹)</th>
                    <th className="p-2.5 w-10 text-center rounded-r-lg"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {items.map((item, idx) => {
                    const lineTaxable = (Number(item.quantity) || 1) * (Number(item.rate) || 0);
                    const lineTax = (lineTaxable * (Number(item.taxRate) || 18)) / 100;

                    return (
                      <tr key={item.id || idx} className="hover:bg-white/60">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Description with {{PERIOD}}"
                            className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.hsnSac}
                            onChange={(e) => handleItemChange(idx, 'hsnSac', e.target.value)}
                            placeholder="998315"
                            className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            min={1}
                            className="w-full h-8 px-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full h-8 px-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="MONTH">MONTH</option>
                            <option value="QUARTER">QUARTER</option>
                            <option value="HRS">HRS</option>
                            <option value="NOS">NOS</option>
                            <option value="SET">SET</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            min={0}
                            className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.taxRate}
                            onChange={(e) => handleItemChange(idx, 'taxRate', parseFloat(e.target.value))}
                            className="w-full h-8 px-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-800">
                          ₹{lineTaxable.toLocaleString('en-IN')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-indigo-600">
                          ₹{lineTax.toLocaleString('en-IN')}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live Computed Summary Box */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Taxable Value</div>
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  ₹{computedTotals.taxable.toLocaleString('en-IN')}
                </div>
              </div>

              {isInterstate ? (
                <div>
                  <div className="text-[10px] uppercase font-bold text-indigo-500">IGST Output Liability</div>
                  <div className="text-base font-extrabold text-indigo-700 font-mono">
                    ₹{computedTotals.igst.toLocaleString('en-IN')}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500">CGST (50%)</div>
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      ₹{computedTotals.cgst.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500">SGST (50%)</div>
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      ₹{computedTotals.sgst.toLocaleString('en-IN')}
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-700">Gross Invoice Total</div>
                <div className="text-base font-black text-slate-900 font-mono">
                  ₹{computedTotals.totalAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Automation Toggles & Delivery Settings */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Automated Compliance & Client Dispatch Triggers
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-all">
                <input
                  type="checkbox"
                  checked={autoGenerateInvoice}
                  onChange={(e) => setAutoGenerateInvoice(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div>
                  <div className="font-bold text-slate-800 text-[11px]">Auto-Generate Invoice</div>
                  <div className="text-[10px] text-slate-400">Creates sales invoice automatically on run date</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-all">
                <input
                  type="checkbox"
                  checked={autoGenerateIrn}
                  onChange={(e) => setAutoGenerateIrn(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div>
                  <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-indigo-600" /> Auto E-Invoice (IRN)
                  </div>
                  <div className="text-[10px] text-slate-400">Pushes to IRP portal for QR code generation</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-all">
                <input
                  type="checkbox"
                  checked={autoSendEmail}
                  onChange={(e) => setAutoSendEmail(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div>
                  <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <Mail className="w-3 h-3 text-blue-600" /> Dispatch via Email
                  </div>
                  <div className="text-[10px] text-slate-400">Sends PDF invoice copy to client email</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-all">
                <input
                  type="checkbox"
                  checked={autoSendWhatsApp}
                  onChange={(e) => setAutoSendWhatsApp(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <div>
                  <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp Notice
                  </div>
                  <div className="text-[10px] text-slate-400">Instant WhatsApp payment link notification</div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>Saving Schedule...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Recurring Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecurringInvoiceModal;
