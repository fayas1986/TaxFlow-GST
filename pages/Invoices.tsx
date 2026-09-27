import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, setSelectedGstin, setSelectedBranch } from '../store/store';
import { fetchInvoices, createInvoice, generateEInvoice, bulkImportInvoices, bulkReconcileInvoices, generateEWayBill, fetchScheduledReminders, sendInvoiceReminder, scanInvoice, fetchExchangeRates, fetchImportHistory, createInvoiceVersion, restoreInvoiceVersion, autoCategorizeInvoice, updateInvoice, runAutomatedItcTagging } from '../services/api';
import { 
  Filter, Download, Plus, X, Loader2, Calendar, FileText, User, 
  Building, CreditCard, Percent, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, Upload, FileSpreadsheet,
  QrCode, Printer, Receipt, Tag, AlertCircle, ScanLine, Copy, Check, CheckCircle2, RefreshCw, Truck, ShieldAlert, MoreHorizontal, Search, Layers, Maximize2, AlertTriangle, ShieldCheck, Trash2, PlusCircle, Send, Bell, Camera, Clock,
  RotateCw, ZoomIn, ZoomOut, Palette, Share2, ExternalLink, History, Zap, Sliders, Building2, Globe, Repeat, Database, Save, CloudOff, MessageSquare,
  Lock, ArrowUpRight, Sparkles
} from 'lucide-react';
import { Invoice, InvoiceItem, UserRole, InvoiceReminder, ExportConfig, ImportLog, InvoiceVersion } from '../types';
import { exportToCSV } from '../utils/export';
import { useTranslation } from '../utils/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import BulkImportModal from '../components/BulkImportModal';
import ExportInvoicesModal from '../components/ExportInvoicesModal';
import { EvidenceTrailModal } from '../components/EvidenceTrailModal';
import { CurrencyConverterModule } from '../components/CurrencyConverterModule';
import { AutoCategorizationRulesModal } from '../components/AutoCategorizationRulesModal';
import RecurringInvoicesModule from '../components/RecurringInvoicesModule';
import TemplateSelector from '../components/TemplateSelector';
import InvoiceVersionHistory from '../components/InvoiceVersionHistory';
import DocumentCameraScanner, { ExtractedInvoiceData } from '../components/DocumentCameraScanner';
import { generateStyledDocument } from '../services/documentGenerator';
import { ParsedCsvRow } from '../utils/csvImportValidator';
import { DataQualityOverlay } from '../components/DataQualityOverlay';
import InvoiceApprovalWorkflowModal from '../components/InvoiceApprovalWorkflowModal';
import { useOfflineDrafts } from '../hooks/useOfflineDrafts';
import InvoiceStatusDistributionCard from '../components/InvoiceStatusDistributionCard';
import { AiExpenseCategorySuggester, STANDARD_EXPENSE_CATEGORIES } from '../components/AiExpenseCategorySuggester';
import { ExpenseCategorySuggestion } from '../types';
import { SendInvoiceWhatsAppModal } from '../components/SendInvoiceWhatsAppModal';
import { WhatsAppNotificationCenter } from '../components/WhatsAppNotificationCenter';
import { BranchManagerModal } from '../components/BranchManagerModal';
import { subscriptionManager } from '../src/core/billing/SubscriptionManager';
import SmartTaxRateClassifier from '../components/SmartTaxRateClassifier';

type InvoiceCategory = 'SALES' | 'PURCHASE' | 'CN_DN';

const Invoices: React.FC = () => {
  const { language } = useTranslation();
  const { drafts: offlineDrafts, isOnline, saveDraft, deleteDraft } = useOfflineDrafts('INVOICE');


  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedGstin = useSelector((state: RootState) => state.org.selectedGstin);
  const selectedBranchId = useSelector((state: RootState) => state.org.selectedBranchId);
  const gstinsByTenant = useSelector((state: RootState) => state.org.gstinsByTenant);
  const branchesByTenant = useSelector((state: RootState) => state.org.branchesByTenant);
  const dispatch = useDispatch();
  const tenantId = user?.currentTenantId || 't1';

  const currentTenantGstins = gstinsByTenant[tenantId] || [];
  const currentTenantBranches = branchesByTenant[tenantId] || [];
  const activeGstinObj = currentTenantGstins.find(g => g.gstin === selectedGstin);
  const activeBranchObj = currentTenantBranches.find(b => b.id === selectedBranchId);
  
  // RBAC & Plan Entitlements
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const canEdit = isSuperAdmin || user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE_MANAGER || user?.role === UserRole.ACCOUNTANT;
  const subProfile = subscriptionManager.getUserSubscriptionProfile(user?.role, tenantId);
  const canBulkEInvoice = isSuperAdmin || Boolean(subProfile.canEInvoicing);
  const canMultiGstin = isSuperAdmin || Boolean(subProfile.canMultiGstin);
  const canMultiBranch = isSuperAdmin || Boolean(subProfile.canMultiBranch);

  const [upgradePrompt, setUpgradePrompt] = useState<{
    isOpen: boolean;
    feature: string;
    description: string;
    requiredPlan: string;
  } | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({ 
      queryKey: ['invoices', tenantId, selectedGstin, selectedBranchId], 
      queryFn: () => fetchInvoices(tenantId, selectedGstin, selectedBranchId) 
  });
  
  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'status' | 'dueDate' | 'date' } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [isCellUpdating, setIsCellUpdating] = useState<string | null>(null);

  const handleInlineUpdate = async (invoiceId: string, field: 'status' | 'dueDate' | 'date', value: string) => {
    setIsCellUpdating(`${invoiceId}-${field}`);
    try {
      await updateInvoice(invoiceId, { [field]: value }, `Inline Edit: Updated ${field}`);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setEditingCell(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice inline');
    } finally {
      setIsCellUpdating(null);
    }
  };

  // View State
  const [activeCategory, setActiveCategory] = useState<InvoiceCategory>('SALES');
  const [activeSubTab, setActiveSubTab] = useState<'LIST' | 'REMINDERS' | 'IMPORT_HISTORY' | 'RECURRING' | 'OFFLINE_DRAFTS'>('LIST');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterItcEligibility, setFilterItcEligibility] = useState<'ALL' | 'ELIGIBLE' | 'NON_ELIGIBLE'>('ALL');
  const [isAutoTaggingRunning, setIsAutoTaggingRunning] = useState(false);
  const [autoTagToast, setAutoTagToast] = useState<string | null>(null);

  const handleRunAutoItcTagging = async () => {
    setIsAutoTaggingRunning(true);
    try {
      const res = await runAutomatedItcTagging(tenantId);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setAutoTagToast(`Automated ITC Tagging engine finished! Scanned ${res.taggedCount} purchase invoices (${res.eligibleCount} Eligible, ${res.nonEligibleCount} Non-Eligible/Blocked).`);
      setTimeout(() => setAutoTagToast(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to run automated ITC tagging service.');
    } finally {
      setIsAutoTaggingRunning(false);
    }
  };
  
  // UI State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [whatsAppModalInvoice, setWhatsAppModalInvoice] = useState<Invoice | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isEvidenceTrailOpen, setIsEvidenceTrailOpen] = useState(false);
  const [isAiTaxClassifierModalOpen, setIsAiTaxClassifierModalOpen] = useState(false);
  const [isCurrencyConverterOpen, setIsCurrencyConverterOpen] = useState(false);
  const [isAutoCatRulesOpen, setIsAutoCatRulesOpen] = useState(false);
  
  // Invoice Multi-Stage Approval Workflow States
  const [isApprovalWorkflowOpen, setIsApprovalWorkflowOpen] = useState(false);
  const [approvalWorkflowTarget, setApprovalWorkflowTarget] = useState<Invoice | null>(null);
  const [approvalGateWarning, setApprovalGateWarning] = useState<{ isOpen: boolean; invoice: Invoice | null; reason: string }>({
    isOpen: false,
    invoice: null,
    reason: ''
  });
  const [approvalStageFilter, setApprovalStageFilter] = useState<string>('ALL');
  
  // Camera Scanner Modal & Toast state
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isDataQualityOverlayOpen, setIsDataQualityOverlayOpen] = useState(false);
  const [scanSuccessToast, setScanSuccessToast] = useState<string | null>(null);

  const location = useLocation();

  // Detect and apply draft calculation passed from Quick Tax Calculator or Rate Calculator Page
  useEffect(() => {
    const navState = location.state as { openDraft?: boolean; prefilledDraftItem?: any } | null;
    let draftItem = navState?.prefilledDraftItem;

    if (!draftItem) {
      try {
        const stored = sessionStorage.getItem('taxflow_quick_tax_draft_item');
        if (stored) {
          draftItem = JSON.parse(stored);
          sessionStorage.removeItem('taxflow_quick_tax_draft_item');
        }
      } catch (e) {
        // ignore
      }
    }

    if (navState?.openDraft || draftItem) {
      setIsCreateModalOpen(true);
      if (draftItem) {
        const qty = draftItem.quantity || 1;
        const rateVal = draftItem.rate || draftItem.taxableValue || 0;
        const taxable = draftItem.taxableValue || (qty * rateVal);
        const tRate = typeof draftItem.taxRate === 'number' ? draftItem.taxRate : 18;
        const tAmount = draftItem.taxAmount || (taxable * tRate) / 100;

        setLineItems([{
          id: `draft-${Date.now()}`,
          description: draftItem.description || 'Estimated Taxable Item',
          hsnSac: draftItem.hsnSac || '8471',
          quantity: qty,
          unit: draftItem.unit || 'PCS',
          rate: rateVal,
          taxRate: tRate,
          taxableValue: taxable,
          taxAmount: tAmount,
        }]);

        if (draftItem.partyName) setPartyNameInput(draftItem.partyName);
        if (draftItem.isInterstate) {
          // If interstate, we can prefill party or leave as standard B2B
          setCreateFormType('B2B');
        }

        setAutoTagToast(`Tax Calculator item (${draftItem.hsnSac ? `HSN ${draftItem.hsnSac}` : ''} ${tRate}% - ₹${taxable.toLocaleString('en-IN')}) applied to draft invoice.`);
        setTimeout(() => setAutoTagToast(null), 6000);
      }
      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleCameraInvoiceExtracted = async (extractedData: ExtractedInvoiceData, createDirectly?: boolean) => {
    // Populate form inputs with extracted camera scanner data
    if (extractedData.invoiceNumber) setInvoiceNumberInput(extractedData.invoiceNumber);
    if (extractedData.partyName) setPartyNameInput(extractedData.partyName);
    if (extractedData.partyGstin) setGstinInput(extractedData.partyGstin);
    if (extractedData.date) setDateInput(extractedData.date);
    if (extractedData.type) setCreateFormType(extractedData.type as any);

    if (extractedData.items && extractedData.items.length > 0) {
      setLineItems(extractedData.items.map((item, idx) => ({
        id: (Date.now() + idx).toString(),
        description: item.description || 'Scanned Line Item',
        hsnSac: item.hsnSac || '998313',
        quantity: item.quantity || 1,
        unit: item.unit || 'PCS',
        rate: item.rate || 0,
        taxRate: item.gstRate || 18,
        taxableValue: (item.quantity || 1) * (item.rate || 0),
        taxAmount: (item.quantity || 1) * (item.rate || 0) * ((item.gstRate || 18) / 100)
      })));
    }

    if (extractedData.category) {
      setActiveCategory(extractedData.category);
    }

    if (createDirectly) {
      const draftPayload: any = {
        tenantId,
        gstin: extractedData.partyGstin || selectedGstin || '27AAAAA0000A1Z5',
        branchId: selectedBranchId || 'b1',
        category: extractedData.category || (activeCategory === 'CN_DN' ? 'SALES' : activeCategory),
        docType: 'INVOICE',
        invoiceNumber: extractedData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        date: extractedData.date || new Date().toISOString().split('T')[0],
        partyName: extractedData.partyName || 'Scanned Vendor Entity',
        partyGstin: extractedData.partyGstin || '27AABCU9632R1ZT',
        placeOfSupply: extractedData.placeOfSupply || '27',
        items: (extractedData.items || []).map((item, idx) => ({
          id: (Date.now() + idx).toString(),
          description: item.description || 'Scanned Line Item',
          hsnSac: item.hsnSac || '998313',
          quantity: item.quantity || 1,
          unit: item.unit || 'PCS',
          rate: item.rate || 0,
          taxRate: item.gstRate || 18,
          taxableValue: (item.quantity || 1) * (item.rate || 0),
          taxAmount: (item.quantity || 1) * (item.rate || 0) * ((item.gstRate || 18) / 100)
        })),
        taxableValue: extractedData.taxableValue || 10000,
        cgst: extractedData.cgst || 900,
        sgst: extractedData.sgst || 900,
        igst: extractedData.igst || 0,
        totalGst: extractedData.totalGst || 1800,
        totalAmount: extractedData.totalAmount || 11800,
        status: 'APPROVED' as const,
        isRcm: false,
        isBlockedItc: false,
        isImport: false,
        isSez: false,
        vaultSynced: true,
        documentVaultId: `DOC-VAULT-${Date.now().toString().slice(-6)}`,
        capturedImageDataUrl: extractedData.capturedImageDataUrl
      };

      if (!isOnline) {
        // Automatically persist receipt in offline database queue
        await saveDraft(`DRAFT-${Date.now()}`, draftPayload);
        setScanSuccessToast(`Offline Mode: Scanned invoice #${draftPayload.invoiceNumber} stored in local queue. Ready to sync when online!`);
        setTimeout(() => setScanSuccessToast(null), 6000);
        return;
      }

      try {
        await createInvoice(draftPayload);
        queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
        setScanSuccessToast(`Invoice #${draftPayload.invoiceNumber} processed & saved to Document Vault!`);
        setTimeout(() => setScanSuccessToast(null), 5000);
      } catch (err: any) {
        console.error('Direct invoice creation error, saving offline fallback:', err);
        await saveDraft(`DRAFT-${Date.now()}`, draftPayload);
        setScanSuccessToast(`Saved locally to Offline Drafts: #${draftPayload.invoiceNumber}`);
        setTimeout(() => setScanSuccessToast(null), 5000);
      }
    } else {
      // Open Create Modal prefilled with camera scan data
      setIsCreateModalOpen(true);
    }
  };

  const [isSyncingDrafts, setIsSyncingDrafts] = useState(false);

  const handleSyncOfflineDraft = async (draft: any) => {
    try {
      const d = draft.data || {};
      const payload: any = {
        tenantId,
        gstin: d.gstin || selectedGstin || '27AAAAA0000A1Z5',
        branchId: d.branchId || selectedBranchId || 'b1',
        category: d.category || (activeCategory === 'CN_DN' ? 'SALES' : activeCategory),
        docType: d.docType || 'INVOICE',
        invoiceNumber: d.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        date: d.date || new Date().toISOString().split('T')[0],
        partyName: d.partyName || 'Synced Entity',
        partyGstin: d.gstin || d.partyGstin || '',
        placeOfSupply: d.placeOfSupply || '27',
        items: d.items || [],
        taxableValue: d.taxableValue || d.amount || d.totalValue || 0,
        cgst: d.cgst || 0,
        sgst: d.sgst || 0,
        igst: d.igst || 0,
        totalGst: d.totalGst || 0,
        totalAmount: d.totalAmount || d.totalValue || 0,
        status: 'APPROVED',
        isRcm: !!d.isRcm,
        isBlockedItc: !!d.isBlockedItc,
        vaultSynced: true
      };

      await createInvoice(payload);
      await deleteDraft(draft.id);
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setScanSuccessToast(`Draft #${payload.invoiceNumber} successfully synced to cloud!`);
      setTimeout(() => setScanSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to sync draft:', err);
      alert('Failed to sync draft: ' + (err?.message || 'Server error'));
    }
  };

  const handleSyncAllOfflineDrafts = async () => {
    if (!offlineDrafts || offlineDrafts.length === 0) return;
    setIsSyncingDrafts(true);
    let successCount = 0;
    try {
      for (const draft of offlineDrafts) {
        try {
          const d = draft.data || {};
          const payload: any = {
            tenantId,
            gstin: d.gstin || selectedGstin || '27AAAAA0000A1Z5',
            branchId: d.branchId || selectedBranchId || 'b1',
            category: d.category || (activeCategory === 'CN_DN' ? 'SALES' : activeCategory),
            docType: d.docType || 'INVOICE',
            invoiceNumber: d.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
            date: d.date || new Date().toISOString().split('T')[0],
            partyName: d.partyName || 'Synced Entity',
            partyGstin: d.gstin || d.partyGstin || '',
            placeOfSupply: d.placeOfSupply || '27',
            items: d.items || [],
            taxableValue: d.taxableValue || d.amount || d.totalValue || 0,
            cgst: d.cgst || 0,
            sgst: d.sgst || 0,
            igst: d.igst || 0,
            totalGst: d.totalGst || 0,
            totalAmount: d.totalAmount || d.totalValue || 0,
            status: 'APPROVED',
            isRcm: !!d.isRcm,
            isBlockedItc: !!d.isBlockedItc,
            vaultSynced: true
          };
          await createInvoice(payload);
          await deleteDraft(draft.id);
          successCount++;
        } catch (e) {
          console.error('Error syncing individual draft:', e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setScanSuccessToast(`Successfully synced ${successCount} offline draft(s) to cloud!`);
      setTimeout(() => setScanSuccessToast(null), 5000);
    } finally {
      setIsSyncingDrafts(false);
    }
  };
  
  // Versions
  const { mutateAsync: restoreVersionAsync, isPending: isRestoring } = useMutation({
    mutationFn: ({ invoiceId, versionId }: { invoiceId: string, versionId: string }) => restoreInvoiceVersion(invoiceId, versionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setSelectedInvoice(null);
      setShowVersionHistory(false);
      alert(data.message);
    }
  });

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedInvoice) return;
    await restoreVersionAsync({ invoiceId: selectedInvoice.id, versionId });
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [generatingIrnId, setGeneratingIrnId] = useState<string | null>(null);
  const [generatingEwbId, setGeneratingEwbId] = useState<string | null>(null);
  const [isVendorUploadModalOpen, setIsVendorUploadModalOpen] = useState(false);
  const [generatedUploadLink, setGeneratedUploadLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [viewArchived, setViewArchived] = useState(false);

  // HTML5 Interactive Camera & Scheduled Dispatch States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [recurringAutoOpen, setRecurringAutoOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error('Camera capture access error:', err);
          alert('Could not initialize camera stream. Falling back to file upload.');
          setIsCameraOpen(false);
          handleScanClick();
        });
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPreviewImage(dataUrl);
        setPreviewMimeType('image/jpeg');
        setIsCameraOpen(false);
        setIsPreviewModalOpen(true);
      }
    }
  };
  
  const { data: importHistory } = useQuery({
      queryKey: ['importHistory', tenantId],
      queryFn: () => fetchImportHistory(tenantId)
  });
  
  // Create Form State
  const [createFormType, setCreateFormType] = useState<'B2B' | 'B2C' | 'EXPORT'>('B2B');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [gstinInput, setGstinInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([
      { id: '1', description: '', hsnSac: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, taxableValue: 0, taxAmount: 0 }
  ]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jumpPageInput, setJumpPageInput] = useState('');

  // Multi-currency handling
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  const { data: ratesData } = useQuery({
    queryKey: ['exchangeRates'],
    queryFn: fetchExchangeRates,
  });

  useEffect(() => {
    if (ratesData) {
      setExchangeRates(ratesData.rates);
    }
  }, [ratesData]);

  const currentExchangeRate = useMemo(() => {
    if (selectedCurrency === 'INR') return 1;
    // Rates are fetched as 1 INR = X Foreign
    // We need 1 Foreign = X INR for normalization
    const rateToInr = exchangeRates[selectedCurrency];
    return rateToInr ? 1 / rateToInr : 1;
  }, [selectedCurrency, exchangeRates]);

  // Sorting State
  const [sortConfigs, setSortConfigs] = useState<{ key: keyof Invoice; direction: 'asc' | 'desc' }[]>([]);

  // Custom Filter States
  const [filterDocType, setFilterDocType] = useState<'ALL' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'AMENDMENT'>('ALL');
  const [filterCompliance, setFilterCompliance] = useState<'ALL' | 'RCM' | 'BLOCKED_ITC' | 'IMPORT' | 'SEZ'>('ALL');
  const [filterVendorBillOnly, setFilterVendorBillOnly] = useState(false);

  // Branch Management States
  const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);
  const [branchIdInput, setBranchIdInput] = useState<string>('');
  const [costCenterInput, setCostCenterInput] = useState<string>('');

  // New Invoice Form Toggles & State
  const [isRcmInput, setIsRcmInput] = useState(false);
  const [isAmendmentInput, setIsAmendmentInput] = useState(false);
  const [originalInvoiceNumberInput, setOriginalInvoiceNumberInput] = useState('');
  const [originalDateInput, setOriginalDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [amendmentReasonInput, setAmendmentReasonInput] = useState('Tax Rate Correction');
  const [purchaseTypeInput, setPurchaseTypeInput] = useState<'DOMESTIC' | 'IMPORT_GOODS' | 'IMPORT_SERVICES' | 'SEZ'>('DOMESTIC');
  const [isVendorBillInput, setIsVendorBillInput] = useState(false);

  // AI Auto-Categorization & Expense Classification States
  const [taxCategoryInput, setTaxCategoryInput] = useState<string>('');
  const [expenseCategoryInput, setExpenseCategoryInput] = useState<string>('');
  const [glCodeInput, setGlCodeInput] = useState<string>('');
  const [itcEligibilityInput, setItcEligibilityInput] = useState<'ELIGIBLE' | 'BLOCKED_17_5' | 'CONDITIONAL' | undefined>(undefined);
  const [expenseConfidenceInput, setExpenseConfidenceInput] = useState<number | undefined>(undefined);
  const [expenseReasoningInput, setExpenseReasoningInput] = useState<string | undefined>(undefined);
  const [filterExpenseCategory, setFilterExpenseCategory] = useState<string>('ALL');

  const [isCategorizing, setIsCategorizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggestedCategory: 'Input' | 'Output' | 'Exempt';
    confidence: number;
    reasoning: string;
    suggestedTags: string[];
  } | null>(null);
  const [customTags, setCustomTags] = useState<string[]>([]);

  // Mutations
  const { mutate: addInvoice, isPending: isAdding } = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      setIsCreateModalOpen(false);
    },
  });

  const { mutate: genEInvoice } = useMutation({
    mutationFn: generateEInvoice,
    onMutate: (id) => setGeneratingIrnId(id),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
        setGeneratingIrnId(null);
    },
    onError: () => {
        setGeneratingIrnId(null);
        queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] }); // Ensure we see the FAILED status
    }
  });

  // ... (Bulk Mutations kept same) ...
  const { mutate: bulkGenEInvoices, isPending: isBulkGenerating } = useMutation({
      mutationFn: async (ids: string[]) => {
          const promises = ids.map(async (id) => {
              try {
                  const res = await generateEInvoice(id);
                  return { status: 'fulfilled' as const, value: res, id };
              } catch (error) {
                  return { status: 'rejected' as const, reason: error, id };
              }
          });
          return await Promise.all(promises);
      },
      onSuccess: async (results) => {
          await queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
          await refetch();
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failCount = results.filter(r => r.status === 'rejected').length;
          const failedIds = results.filter(r => r.status === 'rejected').map(r => r.id);
          const newSelected = new Set(failedIds);
          setSelectedIds(new Set(newSelected));
          if (failCount === 0) {
              alert(`Success! Generated E-Invoices for all ${successCount} documents.`);
          } else {
              alert(`Batch Processing Complete.\n\n✅ Success: ${successCount}\n❌ Failed: ${failCount}\n\nFailed items remain selected.`);
          }
      },
      onError: (error) => {
          queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
          alert('An unexpected error occurred during bulk generation.');
      }
  });

  const { mutate: genEWayBill } = useMutation({
      mutationFn: (id: string) => generateEWayBill(id),
      onMutate: (id) => setGeneratingEwbId(id),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
          setGeneratingEwbId(null);
          if (selectedInvoice) {
              setSelectedInvoice(prev => prev ? { ...prev, ewayBillDetails: { ewayBillNo: 'GENERATED', ewayBillDate: 'Just Now', validUpto: 'TBD', status: 'ACTIVE' } } : null); 
          }
      },
      onError: () => {
          setGeneratingEwbId(null);
          queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
      }
  });

  const { mutate: bulkGenEWayBills, isPending: isBulkEwbGenerating } = useMutation({
      mutationFn: async (ids: string[]) => {
          const promises = ids.map(async (id) => {
              try {
                  const res = await generateEWayBill(id);
                  return { status: 'fulfilled' as const, value: res, id };
              } catch (error) {
                  return { status: 'rejected' as const, reason: error, id };
              }
          });
          return await Promise.all(promises);
      },
      onSuccess: async (results) => {
          await queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
          await refetch();
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          const failCount = results.filter(r => r.status === 'rejected').length;
          const failedIds = results.filter(r => r.status === 'rejected').map(r => r.id);
          const newSelected = new Set(failedIds);
          setSelectedIds(new Set(newSelected));
          if (failCount === 0) {
              alert(`Success! Generated E-Way Bills for all ${successCount} documents.`);
          } else {
              alert(`Batch Complete.\n\n✅ EWB Generated: ${successCount}\n❌ Failed: ${failCount}`);
          }
      },
      onError: () => {
          queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
          alert('An unexpected error occurred during bulk EWB generation.');
      }
  });

  const { mutate: scan, isPending: isScanning } = useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string, mimeType: string }) => scanInvoice(base64, mimeType),
    onSuccess: (data) => {
        if (data.invoiceNumber) setInvoiceNumberInput(data.invoiceNumber);
        if (data.partyName) setPartyNameInput(data.partyName);
        if (data.partyGstin) setGstinInput(data.partyGstin);
        if (data.date) setDateInput(data.date);
        if (data.type) setCreateFormType(data.type as any);
        if (data.items && data.items.length > 0) {
            setLineItems(data.items.map((item: any, idx: number) => ({
                id: (Date.now() + idx).toString(),
                description: item.description || '',
                hsnSac: item.hsnSac || '',
                quantity: item.quantity || 1,
                unit: 'PCS',
                rate: item.rate || 0,
                taxRate: item.gstRate || 18,
                taxableValue: (item.quantity || 1) * (item.rate || 0),
                taxAmount: (item.quantity || 1) * (item.rate || 0) * ((item.gstRate || 18) / 100)
            })));
        }
    },
    onError: (error: any) => {
        alert(`Failed to scan invoice: ${error.message}`);
    }
  });

  const handleScanClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setPreviewImage(reader.result as string);
                setPreviewMimeType(file.type);
                setIsPreviewModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
  };

  const handleConfirmScan = () => {
    if (previewImage) {
        const base64 = previewImage.split(',')[1];
        scan({ base64, mimeType: previewMimeType });
        setIsPreviewModalOpen(false);
    }
  };

  const handleAutoCategorize = async () => {
    if (!partyNameInput) {
      alert("Please enter a Party Name first to analyze patterns.");
      return;
    }
    setIsCategorizing(true);
    setAiSuggestion(null);
    try {
      const currentInvoiceDraft = {
        partyName: partyNameInput,
        gstin: gstinInput,
        amount: formTotals.total,
        category: activeCategory,
        type: createFormType,
        items: lineItems
      };
      const result = await autoCategorizeInvoice(currentInvoiceDraft, invoices || []);
      setAiSuggestion(result);
    } catch (err: any) {
      console.error(err);
      alert("Failed to auto-categorize. Using local heuristics fallback.");
    } finally {
      setIsCategorizing(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setTaxCategoryInput(aiSuggestion.suggestedCategory);
    setCustomTags(aiSuggestion.suggestedTags || []);
    if (aiSuggestion.suggestedTags?.includes('RCM')) {
      setIsRcmInput(true);
    }
  };

  const handleProfessionalExport = (config: ExportConfig) => {
    if (!selectedInvoice) return;
    generateStyledDocument(selectedInvoice, config);
    setShowTemplateSelector(false);
  };

  const handleGenerateVendorLink = async (vendorName: string) => {
    setIsGeneratingLink(true);
    try {
      const res = await fetch('/api/vendor-upload/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, vendorName })
      });
      const data = await res.json();
      setGeneratedUploadLink(data.uploadUrl);
    } catch (error) {
      alert("Failed to generate vendor upload link");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleBulkImport = async (
    file: File, 
    validInvoices?: ParsedCsvRow[], 
    totalCount?: number, 
    failureCount?: number
  ) => {
    const result = await bulkImportInvoices(file, validInvoices, totalCount, failureCount);
    queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['importHistory', tenantId] });
    return result;
  };

  const handleReconcileApply = async (reconciledItems: { invoiceId: string; refNo?: string }[]) => {
    await bulkReconcileInvoices(reconciledItems);
    queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
  };

  // Sync selectedInvoice with fresh data from React Query
  useEffect(() => {
    if (invoices) {
      setSelectedInvoice(prev => {
        if (!prev) return null;
        const freshData = invoices.find(i => i.id === prev.id);
        if (!freshData || freshData === prev) return prev;
        return freshData;
      });
    }
  }, [invoices]);

  useEffect(() => {
      setSelectedIds(new Set());
  }, [activeCategory, filterStatus, searchQuery]);

  useEffect(() => {
      if (isCreateModalOpen) {
          setCreateFormType('B2B');
          setLineItems(prev => {
            // Keep if already populated from draft or camera
            if (prev.length > 0 && (prev[0].taxableValue > 0 || (prev[0].hsnSac && prev[0].hsnSac !== ''))) {
              return prev;
            }
            return [{ id: '1', description: '', hsnSac: '', quantity: 1, unit: 'PCS', rate: 0, taxRate: 18, taxableValue: 0, taxAmount: 0 }];
          });
          
          // Auto Generate Invoice Number
          const prefix = activeCategory === 'PURCHASE' ? 'PUR' : (activeCategory === 'CN_DN' ? 'CN' : 'INV');
          const year = new Date().getFullYear();
          // Simulate sequence based on existing + random to avoid collision in mock
          const sequence = Math.floor(1000 + Math.random() * 9000); 
          setInvoiceNumberInput(`${prefix}-${year}-${sequence}`);

          // Reset form toggles
          setIsRcmInput(false);
          setIsAmendmentInput(false);
          setOriginalInvoiceNumberInput('');
          setOriginalDateInput(new Date().toISOString().split('T')[0]);
          setAmendmentReasonInput('Tax Rate Correction');
          setPurchaseTypeInput('DOMESTIC');
          setIsVendorBillInput(false);

          // Reset AI suggestion states
          setTaxCategoryInput('');
          setExpenseCategoryInput('');
          setGlCodeInput('');
          setItcEligibilityInput(undefined);
          setExpenseConfidenceInput(undefined);
          setExpenseReasoningInput(undefined);
          setAiSuggestion(null);
          setCustomTags([]);
      }
  }, [isCreateModalOpen, activeCategory]);

  // Line Item Handlers
  const handleAddItem = () => {
      setLineItems([...lineItems, { 
          id: Date.now().toString(), 
          description: '', 
          hsnSac: '', 
          quantity: 1, 
          unit: 'PCS', 
          rate: 0, 
          taxRate: 18, 
          taxableValue: 0, 
          taxAmount: 0 
      }]);
  };

  const handleRemoveItem = (id: string) => {
      if (lineItems.length > 1) {
          setLineItems(lineItems.filter(item => item.id !== id));
      }
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
      setLineItems(items => items.map(item => {
          if (item.id === id) {
              const updatedItem = { ...item, [field]: value };
              // Auto Calculate
              if (field === 'quantity' || field === 'rate' || field === 'taxRate') {
                  const qty = field === 'quantity' ? Number(value) : item.quantity;
                  const rate = field === 'rate' ? Number(value) : item.rate;
                  const taxRate = field === 'taxRate' ? Number(value) : item.taxRate;
                  
                  updatedItem.taxableValue = qty * rate;
                  updatedItem.taxAmount = updatedItem.taxableValue * (taxRate / 100);
              }
              return updatedItem;
          }
          return item;
      }));
  };

  // Calculated Totals for Form
  const formTotals = useMemo(() => {
      return lineItems.reduce((acc, item) => ({
          taxable: acc.taxable + item.taxableValue,
          tax: acc.tax + item.taxAmount,
          total: acc.total + item.taxableValue + item.taxAmount
      }), { taxable: 0, tax: 0, total: 0 });
  }, [lineItems]);

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = activeCategory === 'CN_DN' ? 'SALES' : activeCategory; 
    
    // Normalize items for GST calculation (store in INR)
    const normalizedItems = lineItems.map(item => ({
        ...item,
        rate: item.rate * currentExchangeRate,
        taxableValue: item.taxableValue * currentExchangeRate,
        taxAmount: item.taxAmount * currentExchangeRate
    }));

    const isPurchase = activeCategory === 'PURCHASE';
    const targetBranch = currentTenantBranches.find(b => b.id === (branchIdInput || selectedBranchId)) || currentTenantBranches[0];

    addInvoice({
      tenantId: tenantId,
      branchId: targetBranch?.id || 'b1',
      branchName: targetBranch?.name || 'Primary Head Office',
      costCenter: costCenterInput || targetBranch?.costCenter || 'CC-CORP-100',
      invoiceNumber: invoiceNumberInput,
      partyName: partyNameInput,
      gstin: gstinInput,
      date: dateInput,
      type: createFormType,
      category: category,
      docType: formData.get('docType') as 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE',
      placeOfSupply: formData.get('placeOfSupply') as string,
      items: normalizedItems,
      currency: selectedCurrency,
      exchangeRate: currentExchangeRate,
      originalAmount: formTotals.total,
      originalTaxAmount: formTotals.tax,
      
      // Compliance, expense classification, and custom fields
      expenseCategory: expenseCategoryInput || undefined,
      glCode: glCodeInput || undefined,
      itcEligibility: itcEligibilityInput || undefined,
      expenseCategoryConfidence: expenseConfidenceInput || undefined,
      expenseCategoryReasoning: expenseReasoningInput || undefined,
      isBlockedItc: isPurchase && (itcEligibilityInput === 'BLOCKED_17_5' || undefined),
      reasonForBlocked: isPurchase && itcEligibilityInput === 'BLOCKED_17_5' ? (expenseReasoningInput || 'Section 17(5) of CGST Act') : undefined,

      isRcm: isRcmInput,
      isAmended: isAmendmentInput,
      originalInvoiceNumber: isAmendmentInput ? originalInvoiceNumberInput : undefined,
      originalDate: isAmendmentInput ? originalDateInput : undefined,
      amendmentReason: isAmendmentInput ? amendmentReasonInput : undefined,
      isImport: isPurchase && (purchaseTypeInput === 'IMPORT_GOODS' || purchaseTypeInput === 'IMPORT_SERVICES'),
      isSez: purchaseTypeInput === 'SEZ',
      isVendorBill: isPurchase ? isVendorBillInput : undefined,
      tags: [
        ...(isPurchase ? [purchaseTypeInput] : []),
        ...(isRcmInput ? ['RCM'] : []),
        ...(isAmendmentInput ? ['AMENDED'] : []),
        ...(taxCategoryInput ? [taxCategoryInput] : []),
        ...(expenseCategoryInput ? [expenseCategoryInput] : []),
        ...customTags
      ]
    } as any);
  };

  const { data: reminders, isLoading: isRemindersLoading } = useQuery({
    queryKey: ['invoiceReminders', tenantId],
    queryFn: () => fetchScheduledReminders(tenantId),
    enabled: activeSubTab === 'REMINDERS'
  });

  const reminderMutation = useMutation({
    mutationFn: ({ invId, type }: { invId: string, type: 'EMAIL' | 'SMS' | 'WHATSAPP' }) => 
      sendInvoiceReminder(invId, type),
    onSuccess: () => {
      // Show success notification
    }
  });

  const handleSendReminder = (invId: string, type: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
    reminderMutation.mutate({ invId, type });
  };

  const handleExport = () => {
      const dataToExport = filteredInvoices.map(inv => ({
          'Invoice Date': inv.date,
          'Invoice Number': inv.invoiceNumber,
          'Party Name': inv.partyName,
          'GSTIN': inv.gstin || 'Unregistered',
          'Type': inv.type,
          'Taxable Value': inv.amount - inv.taxAmount,
          'Tax Amount': inv.taxAmount,
          'Total Amount': inv.amount,
          'Status': inv.status,
          'IRN Status': inv.irn ? 'Generated' : 'Pending'
      }));
      exportToCSV(dataToExport, `TaxFlow_Invoices_${activeCategory}_${new Date().toISOString().split('T')[0]}`, language);
  };

  const handleSort = (key: keyof Invoice, isShiftKey: boolean = false) => {
    setSortConfigs(prev => {
      const existingIdx = prev.findIndex(c => c.key === key);
      
      if (isShiftKey) {
        if (existingIdx > -1) {
          const current = prev[existingIdx];
          if (current.direction === 'asc') {
            const updated = [...prev];
            updated[existingIdx] = { key, direction: 'desc' };
            return updated;
          } else {
            return prev.filter(c => c.key !== key);
          }
        } else {
          return [...prev, { key, direction: 'asc' }];
        }
      } else {
        if (existingIdx > -1) {
          const current = prev[existingIdx];
          if (current.direction === 'asc') {
            const filtered = prev.filter(c => c.key !== key);
            return [{ key, direction: 'desc' as const }, ...filtered];
          } else {
            return prev.filter(c => c.key !== key);
          }
        } else {
          return [{ key, direction: 'asc' as const }, ...prev].slice(0, 4);
        }
      }
    });
  };

  const copyToClipboard = (text: string, label: string) => navigator.clipboard.writeText(text);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const idsOnPage = currentInvoices.map(i => i.id);
          const newSelected = new Set(selectedIds);
          idsOnPage.forEach(id => newSelected.add(id));
          setSelectedIds(newSelected);
      } else {
          const idsOnPage = currentInvoices.map(i => i.id);
          const newSelected = new Set(selectedIds);
          idsOnPage.forEach(id => newSelected.delete(id));
          setSelectedIds(newSelected);
      }
  };

  const handleSelectOne = (id: string) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
      setSelectedIds(newSelected);
  };

  // Filter & Process Data
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let filtered = invoices.filter(inv => {
        // Archival Filter
        const isArchived = !!inv.archivedAt;
        if (viewArchived !== isArchived) return false;

        if (activeCategory === 'CN_DN') return inv.docType === 'CREDIT_NOTE' || inv.docType === 'DEBIT_NOTE';
        return inv.category === activeCategory && inv.docType === 'INVOICE';
    });
    if (filterStatus !== 'ALL') {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayMs = new Date().getTime();
      if (filterStatus === 'PAID') {
        filtered = filtered.filter(inv => inv.status === 'PAID' || inv.status === 'FILED');
      } else if (filterStatus === 'OVERDUE') {
        filtered = filtered.filter(inv => {
          if (inv.status === 'PAID' || inv.status === 'FILED') return false;
          if (inv.status === 'FAILED') return true;
          if (inv.dueDate) return inv.dueDate < todayStr;
          if (inv.date) return (todayMs - new Date(inv.date).getTime()) > 30 * 24 * 60 * 60 * 1000;
          return false;
        });
      } else if (filterStatus === 'PENDING') {
        filtered = filtered.filter(inv => {
          if (inv.status === 'PAID' || inv.status === 'FILED') return false;
          if (inv.status === 'FAILED') return false;
          if (inv.dueDate && inv.dueDate < todayStr) return false;
          if (!inv.dueDate && inv.date && (todayMs - new Date(inv.date).getTime()) > 30 * 24 * 60 * 60 * 1000) return false;
          return true;
        });
      } else {
        filtered = filtered.filter(inv => inv.status === filterStatus);
      }
    }
    
    // Custom Filter: Doc Type
    if (filterDocType === 'CREDIT_NOTE') {
        filtered = filtered.filter(inv => inv.docType === 'CREDIT_NOTE');
    } else if (filterDocType === 'DEBIT_NOTE') {
        filtered = filtered.filter(inv => inv.docType === 'DEBIT_NOTE');
    } else if (filterDocType === 'AMENDMENT') {
        filtered = filtered.filter(inv => inv.isAmended === true);
    }
    
    // Custom Filter: Compliance / RCM / Import / SEZ
    if (filterCompliance === 'RCM') {
        filtered = filtered.filter(inv => inv.isRcm === true);
    } else if (filterCompliance === 'BLOCKED_ITC') {
        filtered = filtered.filter(inv => inv.isBlockedItc === true);
    } else if (filterCompliance === 'IMPORT') {
        filtered = filtered.filter(inv => inv.isImport === true);
    } else if (filterCompliance === 'SEZ') {
        filtered = filtered.filter(inv => inv.isSez === true);
    }

    // Custom Filter: Vendor Bills Only
    if (filterVendorBillOnly) {
        filtered = filtered.filter(inv => inv.isVendorBill === true);
    }

    // Custom Filter: ITC Statutory Eligibility
    if (filterItcEligibility === 'ELIGIBLE') {
        filtered = filtered.filter(inv => !inv.isBlockedItc);
    } else if (filterItcEligibility === 'NON_ELIGIBLE') {
        filtered = filtered.filter(inv => inv.isBlockedItc === true);
    }

    // Custom Filter: Expense Category
    if (filterExpenseCategory !== 'ALL') {
        filtered = filtered.filter(inv => inv.expenseCategory === filterExpenseCategory);
    }

    // Custom Filter: Approval Stage
    if (approvalStageFilter !== 'ALL') {
        filtered = filtered.filter(inv => {
            const stage = inv.approvalStage || (inv.status === 'APPROVED' ? 'APPROVED' : 'DRAFT');
            return stage === approvalStageFilter;
        });
    }

    // Advanced Filters
    if (startDate) filtered = filtered.filter(inv => inv.date >= startDate);
    if (endDate) filtered = filtered.filter(inv => inv.date <= endDate);
    if (minAmount) filtered = filtered.filter(inv => inv.amount >= parseFloat(minAmount));
    if (maxAmount) filtered = filtered.filter(inv => inv.amount <= parseFloat(maxAmount));
    
    // Search Filtering
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        filtered = filtered.filter(inv => 
            inv.invoiceNumber.toLowerCase().includes(lower) ||
            inv.partyName.toLowerCase().includes(lower) ||
            (inv.gstin && inv.gstin.toLowerCase().includes(lower)) ||
            (inv.expenseCategory && inv.expenseCategory.toLowerCase().includes(lower)) ||
            (inv.glCode && inv.glCode.toLowerCase().includes(lower)) ||
            inv.amount.toString().includes(lower)
        );
    }

    return filtered;
  }, [invoices, activeCategory, filterStatus, searchQuery, startDate, endDate, minAmount, maxAmount, viewArchived, filterDocType, filterCompliance, filterVendorBillOnly, filterItcEligibility, filterExpenseCategory, approvalStageFilter]);

  const sortedInvoices = useMemo(() => {
    let sortableItems = [...filteredInvoices];
    if (sortConfigs.length > 0) {
      sortableItems.sort((a, b) => {
        for (const config of sortConfigs) {
          let aValue = a[config.key];
          let bValue = b[config.key];

          if (aValue === undefined || aValue === null) aValue = '';
          if (bValue === undefined || bValue === null) bValue = '';

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comp = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
            if (comp !== 0) {
              return config.direction === 'asc' ? comp : -comp;
            }
          } else {
            if (aValue < bValue) {
              return config.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
              return config.direction === 'asc' ? 1 : -1;
            }
          }
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredInvoices, sortConfigs]);
  
  const totalItems = sortedInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const currentInvoices = sortedInvoices.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  // Auto-reset page when filters change or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeCategory,
    filterStatus,
    filterDocType,
    filterCompliance,
    filterVendorBillOnly,
    filterItcEligibility,
    filterExpenseCategory,
    approvalStageFilter,
    searchQuery,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    viewArchived,
    itemsPerPage,
    selectedGstin,
    selectedBranchId,
  ]);

  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, safeCurrentPage - delta);
    const right = Math.min(totalPages - 1, safeCurrentPage + delta);

    range.push(1);

    if (left > 2) {
      range.push('...');
    }

    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    if (right < totalPages - 1) {
      range.push('...');
    }

    range.push(totalPages);
    return range;
  }, [currentPage, totalPages]);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPageInput('');
    }
  };

  const eligibleForEInvoice = useMemo(() => {
      if(activeCategory !== 'SALES') return [];
      return Array.from(selectedIds).filter(id => {
          const inv = invoices?.find(i => i.id === id);
          return inv && !inv.irn && (inv.status === 'APPROVED' || inv.status === 'PENDING') && (inv.type === 'B2B' || inv.type === 'EXPORT') && inv.docType === 'INVOICE';
      });
  }, [selectedIds, invoices, activeCategory]);

  const eligibleForEWayBill = useMemo(() => {
      if(activeCategory !== 'SALES') return [];
      return Array.from(selectedIds).filter(id => {
          const inv = invoices?.find(i => i.id === id);
          return inv && inv.irn && !inv.ewayBillDetails && (inv.type === 'B2B' || inv.type === 'EXPORT');
      });
  }, [selectedIds, invoices, activeCategory]);

  const handleGenerateEInvoiceWithGate = (inv: Invoice) => {
      const stage = inv.approvalStage || (inv.status === 'APPROVED' ? 'APPROVED' : 'DRAFT');
      if (stage !== 'APPROVED' && stage !== 'SUBMITTED_TO_PORTAL') {
          setApprovalGateWarning({
              isOpen: true,
              invoice: inv,
              reason: `Invoice #${inv.invoiceNumber} is currently at stage "${stage.replace(/_/g, ' ')}". Under statutory tax compliance governance, draft documents require mandatory Senior Finance Manager sign-off before dispatching to the government IRP portal.`
          });
          return;
      }
      genEInvoice(inv.id);
  };

  const handleBulkGenerate = () => {
      if (!canBulkEInvoice) {
          setUpgradePrompt({
              isOpen: true,
              feature: 'Bulk Batch E-Invoice Generation',
              description: 'Batch generating statutory IRN numbers and cryptographically signed QR codes for multiple invoices simultaneously is available on Business Growth and Enterprise plans.',
              requiredPlan: 'Business Growth'
          });
          return;
      }

      if (eligibleForEInvoice.length > 0) {
          const unapprovedInvoices = eligibleForEInvoice
              .map(id => invoices?.find(i => i.id === id))
              .filter((inv): inv is Invoice => {
                  if (!inv) return false;
                  const stage = inv.approvalStage || (inv.status === 'APPROVED' ? 'APPROVED' : 'DRAFT');
                  return stage !== 'APPROVED' && stage !== 'SUBMITTED_TO_PORTAL';
              });

          if (unapprovedInvoices.length > 0) {
              setApprovalGateWarning({
                  isOpen: true,
                  invoice: unapprovedInvoices[0],
                  reason: `${unapprovedInvoices.length} selected draft invoice(s) (including #${unapprovedInvoices[0].invoiceNumber}) require Senior Finance Manager sign-off before they can be transmitted to the government portal.`
              });
              return;
          }

          if (confirm(`Generate E-Invoices for ${eligibleForEInvoice.length} selected approved documents?`)) {
              bulkGenEInvoices(eligibleForEInvoice);
          }
      } else alert("No eligible invoices selected for E-Invoice generation.");
  };

  const handleBulkEWayBill = () => {
      if (!canBulkEInvoice) {
          setUpgradePrompt({
              isOpen: true,
              feature: 'Bulk Batch E-Way Bill Generation',
              description: 'Batch dispatching E-Way Bills directly to the government portal across multiple invoices is available on Business Growth and Enterprise plans.',
              requiredPlan: 'Business Growth'
          });
          return;
      }

      if (eligibleForEWayBill.length > 0) {
          if (confirm(`Generate E-Way Bills for ${eligibleForEWayBill.length} selected documents?`)) bulkGenEWayBills(eligibleForEWayBill);
      } else alert("No eligible invoices selected for E-Way Bill generation.\nEnsure selected invoices have IRNs and no existing E-Way Bill.");
  };

  const getApprovalStageBadge = (inv: Invoice) => {
      if (inv.category !== 'SALES') return null;
      const stage = inv.approvalStage || (inv.status === 'APPROVED' ? 'APPROVED' : 'DRAFT');
      switch (stage) {
          case 'DRAFT':
              return (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setApprovalWorkflowTarget(inv);
                      setIsApprovalWorkflowOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                    title="Click to initiate Finance Review workflow"
                  >
                      <Clock size={10} className="text-slate-400" /> Draft
                  </button>
              );
          case 'PENDING_FINANCE_REVIEW':
              return (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setApprovalWorkflowTarget(inv);
                      setIsApprovalWorkflowOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors animate-pulse"
                    title="Finance Review required before Senior Finance sign-off"
                  >
                      <ShieldAlert size={10} className="text-amber-600" /> Fin. Review
                  </button>
              );
          case 'PENDING_SR_FINANCE_SIGNOFF':
              return (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setApprovalWorkflowTarget(inv);
                      setIsApprovalWorkflowOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-xs"
                    title="Senior Finance Manager sign-off required for portal dispatch"
                  >
                      <ShieldCheck size={10} className="text-indigo-600" /> Sr. Sign-off
                  </button>
              );
          case 'APPROVED':
              return (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setApprovalWorkflowTarget(inv);
                      setIsApprovalWorkflowOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    title="Signed off and authorized for government portal dispatch"
                  >
                      <CheckCircle2 size={10} className="text-emerald-600" /> Approved
                  </button>
              );
          case 'SUBMITTED_TO_PORTAL':
              return (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setApprovalWorkflowTarget(inv);
                      setIsApprovalWorkflowOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
                    title="Transmitted to government IRP portal"
                  >
                      <Globe size={10} className="text-blue-600" /> Transmitted
                  </button>
              );
          default:
              return null;
      }
  };

  const getStatusBadge = (status: string) => {
    const styles = { FILED: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20', FAILED: 'bg-rose-100 text-rose-800 ring-rose-600/20', PENDING: 'bg-amber-100 text-amber-800 ring-amber-600/20', UPLOADED: 'bg-blue-100 text-blue-800 ring-blue-600/20', };
    return ( <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700 ring-slate-600/20'}`}> {status.charAt(0) + status.slice(1).toLowerCase()} </span> );
  };

  const getIrnStatus = (inv: Invoice) => {
      if (inv.category === 'PURCHASE') return null;
      if (inv.type === 'B2C') return <span className="text-xs text-slate-400 font-medium px-2">N/A</span>;
      if (inv.irn) {
          return (
              <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                      <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center text-emerald-600"><QrCode size={10}/></div> Generated
                  </div>
                  {inv.ewayBillDetails ? (
                      <div className="flex flex-col gap-0.5">
                          <div className={`flex items-center gap-1.5 text-xs font-medium ${inv.ewayBillDetails.status === 'ACTIVE' ? 'text-blue-700' : 'text-red-700'}`}>
                              <Truck size={12}/> <span className="font-mono">{inv.ewayBillDetails.ewayBillNo}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${inv.ewayBillDetails.status === 'ACTIVE' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                                  {inv.ewayBillDetails.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                              </span>
                          </div>
                      </div>
                  ) : inv.ewayBillError ? ( <div className="flex items-center gap-1 text-red-600 text-[10px] font-medium" title={inv.ewayBillError}><AlertCircle size={10}/> EWB Failed</div> ) : ( <span className="text-[10px] text-slate-400 pl-6">EWB Pending</span> )}
              </div>
          );
      }
      if (inv.status === 'PENDING' || inv.status === 'FAILED') return <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertCircle size={10}/> Pending</span>;
      return <span className="text-xs text-slate-400">Not Generated</span>;
  };

  const SortHeader: React.FC<{ label: string; sortKey: keyof Invoice; align?: 'left' | 'right' }> = ({ label, sortKey, align = 'left' }) => {
    const configIndex = sortConfigs.findIndex(c => c.key === sortKey);
    const activeConfig = configIndex > -1 ? sortConfigs[configIndex] : null;

    const handleClick = (e: React.MouseEvent) => {
      handleSort(sortKey, e.shiftKey);
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
                {activeConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />}
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

  const registerTotals = useMemo(() => {
    const list = filteredInvoices || [];
    const count = list.length;
    const taxableValue = list.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const taxValue = list.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0);
    const grossValue = taxableValue + taxValue;
    return { count, taxableValue, taxValue, grossValue };
  }, [filteredInvoices]);

  const handlePrintDocument = (targetType: 'REGISTER' | 'INVOICE') => {
    if (targetType === 'INVOICE' && selectedInvoice) {
      const invoiceEl = document.getElementById('printable-invoice-document');
      if (invoiceEl) {
        try {
          let printFrame = document.getElementById('taxflow-print-frame') as HTMLIFrameElement;
          if (printFrame) {
            printFrame.remove();
          }
          printFrame = document.createElement('iframe');
          printFrame.id = 'taxflow-print-frame';
          printFrame.style.position = 'fixed';
          printFrame.style.right = '0';
          printFrame.style.bottom = '0';
          printFrame.style.width = '0';
          printFrame.style.height = '0';
          printFrame.style.border = '0';
          document.body.appendChild(printFrame);

          const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
          if (frameDoc) {
            frameDoc.open();
            frameDoc.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <title>Tax Invoice - ${selectedInvoice.invoiceNumber}</title>
                  <script src="https://cdn.tailwindcss.com"></script>
                  <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #ffffff !important; color: #0f172a !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; }
                    .no-print { display: none !important; }
                    table { width: 100%; border-collapse: collapse; }
                  </style>
                </head>
                <body class="p-6 bg-white">
                  <div class="max-w-4xl mx-auto bg-white">
                    ${invoiceEl.innerHTML}
                  </div>
                  <script>
                    setTimeout(function() {
                      window.focus();
                      window.print();
                    }, 400);
                  </script>
                </body>
              </html>
            `);
            frameDoc.close();
            return;
          }
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print', e);
        }
      }
      window.print();
      return;
    }

    // Print register report
    const registerEl = document.getElementById('printable-invoices-register');
    if (registerEl) {
      try {
        let printFrame = document.getElementById('taxflow-print-frame') as HTMLIFrameElement;
        if (printFrame) {
          printFrame.remove();
        }
        printFrame = document.createElement('iframe');
        printFrame.id = 'taxflow-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
        if (frameDoc) {
          frameDoc.open();
          frameDoc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>GST Invoices Register - ${activeCategory}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                  @page { size: A4 landscape; margin: 8mm; }
                  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #ffffff !important; color: #0f172a !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; }
                  .no-print { display: none !important; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border: 1px solid #cbd5e1; }
                </style>
              </head>
              <body class="p-6 bg-white">
                <div class="w-full">
                  ${registerEl.innerHTML}
                </div>
                <script>
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 400);
                </script>
              </body>
            </html>
          `);
          frameDoc.close();
          return;
        }
      } catch (e) {
        console.warn('Iframe print register error, falling back to window.print', e);
      }
    }
    window.print();
  };

  if (isLoading) return <div className="flex h-96 items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Loading data...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 1. Header Bar: Title + Primary Action CTAs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs no-print">
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${activeCategory === 'PURCHASE' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
              <Receipt size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {activeCategory === 'SALES' ? 'Sales Invoices' : activeCategory === 'PURCHASE' ? 'Purchase Invoices' : 'Credit & Debit Notes'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage, track, validate and file your {activeCategory.toLowerCase()} tax documents
              </p>
            </div>
          </div>
          {autoTagToast && (
            <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-xs font-bold text-teal-900 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-teal-600 shrink-0" />
                <span>{autoTagToast}</span>
              </div>
              <button onClick={() => setAutoTagToast(null)} className="text-teal-600 hover:text-teal-900 p-1">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => setIsBranchManagerOpen(true)} 
              className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              title="Allocate invoices & filings across branches or cost centers"
            >
              <Building2 size={15} className="text-slate-600" />
              <span>Branch Manager</span>
            </button>

            <button 
              onClick={() => setIsImportModalOpen(true)} 
              className="h-10 px-4 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              title="Bulk import batch transaction data via CSV"
            >
              <FileSpreadsheet size={15} />
              <span>Bulk Import CSV</span>
            </button>

            <button 
              onClick={() => {
                setActiveSubTab('RECURRING');
                setRecurringAutoOpen(true);
              }}
              className="h-10 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              title="Schedule automated repeating invoices"
            >
              <Clock size={15} />
              <span>Recurring</span>
            </button>

            <button 
              onClick={() => setIsCreateModalOpen(true)} 
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>New {activeCategory === 'CN_DN' ? 'Note' : 'Invoice'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs & Active Scope Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs no-print">
        {/* Category & Sub-view Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
            {(['SALES', 'PURCHASE', 'CN_DN'] as const).map(cat => (
              <button 
                key={cat} 
                onClick={() => { setActiveCategory(cat); setActiveSubTab('LIST'); }} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeCategory === cat && activeSubTab === 'LIST' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'CN_DN' ? 'Credit/Debit Notes' : cat === 'SALES' ? 'Sales Invoices' : 'Purchase Invoices'}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => setActiveSubTab('REMINDERS')} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'REMINDERS' 
                  ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell size={13} /> Reminders
            </button>

            <button 
              onClick={() => setActiveSubTab('IMPORT_HISTORY')} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'IMPORT_HISTORY' 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History size={13} /> Import History
            </button>

            <button 
              onClick={() => setActiveSubTab('RECURRING')} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'RECURRING' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Repeat size={13} /> Recurring
            </button>

            <button 
              onClick={() => setActiveSubTab('OFFLINE_DRAFTS')} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'OFFLINE_DRAFTS' 
                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database size={13} /> Local Drafts {offlineDrafts?.length ? `(${offlineDrafts.length})` : ''}
            </button>

            <button 
              onClick={() => { setViewArchived(!viewArchived); setActiveSubTab('LIST'); }} 
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewArchived 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers size={13} /> {viewArchived ? 'Archived Records' : 'Archives'}
            </button>
          </div>
        </div>

        {/* GST Registration Scope Badge */}
        <div className="flex items-center gap-2 text-xs shrink-0 self-end lg:self-center">
          <span className="text-slate-400 font-semibold text-[11px]">GST Scope:</span>
          {selectedGstin === 'ALL' && selectedBranchId === 'ALL' ? (
            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5 font-bold text-xs">
              <Layers size={12} className="text-slate-500" /> All Registrations
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold text-xs">
                <Building2 size={12} className="text-indigo-600" />
                {activeGstinObj?.stateName || 'State'} ({selectedGstin})
                {activeBranchObj && <span className="text-indigo-600"> • {activeBranchObj.name}</span>}
              </span>
              <button 
                onClick={() => {
                  dispatch(setSelectedGstin('ALL'));
                  dispatch(setSelectedBranch('ALL'));
                }}
                className="text-[11px] text-slate-400 hover:text-rose-600 px-1 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Reset to All GSTINs"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Search, Date Range Filter & Utility Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs no-print">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice number, customer/vendor..." 
              className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Billing Period Date-Range Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 h-10 select-none">
            <Calendar size={14} className="text-indigo-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">Period:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none py-0.5 px-1 focus:ring-0 w-28 cursor-pointer"
              title="Start Date"
            />
            <span className="text-slate-300 text-xs font-bold shrink-0">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none py-0.5 px-1 focus:ring-0 w-28 cursor-pointer"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
                title="Clear date filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filters Toggle Button */}
          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
            className={`h-10 px-3.5 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              showAdvancedFilters || startDate || endDate || minAmount || maxAmount || filterDocType !== 'ALL'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs' 
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <Filter size={14} className={showAdvancedFilters ? 'text-indigo-600' : 'text-slate-500'} />
            <span>Filters</span>
            {(minAmount || maxAmount || filterDocType !== 'ALL') && (
              <span className="w-2 h-2 bg-indigo-600 rounded-full" />
            )}
          </button>

          {/* Data Quality Overlay Button */}
          <button 
            onClick={() => setIsDataQualityOverlayOpen(true)}
            className="h-10 px-3.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Data Quality</span>
          </button>
        </div>

        {/* Right: Tools & Utilities */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* Bulk E-Invoice / E-Way Bill */}
          {eligibleForEInvoice.length > 0 && (
            <button 
              onClick={handleBulkGenerate} 
              disabled={isBulkGenerating} 
              className={`h-10 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                !canBulkEInvoice
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              title={!canBulkEInvoice ? 'Bulk E-Invoice is available on Business Growth plan' : 'Batch generate E-Invoices'}
            >
              {isBulkGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : !canBulkEInvoice ? (
                <Lock size={13} className="text-amber-600" />
              ) : (
                <Layers size={14} />
              )}
              <span>E-Invoice ({eligibleForEInvoice.length})</span>
              {!canBulkEInvoice && (
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-black border border-amber-200">
                  GROWTH
                </span>
              )}
            </button>
          )}

          {eligibleForEWayBill.length > 0 && (
            <button 
              onClick={handleBulkEWayBill} 
              disabled={isBulkEwbGenerating} 
              className={`h-10 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                !canBulkEInvoice
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
              title={!canBulkEInvoice ? 'Bulk E-Way Bill is available on Business Growth plan' : 'Batch generate E-Way Bills'}
            >
              {isBulkEwbGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : !canBulkEInvoice ? (
                <Lock size={13} className="text-amber-600" />
              ) : (
                <Truck size={14} />
              )}
              <span>E-Way Bill ({eligibleForEWayBill.length})</span>
              {!canBulkEInvoice && (
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-black border border-amber-200">
                  GROWTH
                </span>
              )}
            </button>
          )}

          {activeCategory === 'PURCHASE' && (
            <button 
              onClick={handleRunAutoItcTagging} 
              disabled={isAutoTaggingRunning}
              className="h-10 px-3.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Execute statutory rules engine to classify ITC Eligibility across all purchase invoices"
            >
              {isAutoTaggingRunning ? <Loader2 size={14} className="animate-spin text-teal-600" /> : <ShieldCheck size={14} className="text-teal-600" />}
              <span>Auto-Tag ITC</span>
            </button>
          )}

          <button 
            onClick={() => navigate('/recurring-invoices')}
            className="h-10 px-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Recurring Invoices & Periodic Tax Automation"
          >
            <Calendar size={14} className="text-indigo-600" />
            <span>Recurring Invoices</span>
          </button>

          <button 
            onClick={() => setIsAiTaxClassifierModalOpen(true)}
            className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="AI Smart Tax Rate Classifier & HSN Suggestion"
          >
            <Sparkles size={14} className="text-indigo-600" />
            <span>AI Tax Classifier</span>
          </button>

          <button 
            onClick={() => setIsAutoCatRulesOpen(true)} 
            className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Automation & auto-categorization rules"
          >
            <Zap size={14} className="text-amber-500" />
            <span>Rules</span>
          </button>

          <button 
            onClick={() => setIsCurrencyConverterOpen(true)} 
            className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Multi-currency exchange rates and conversion"
          >
            <Globe size={14} className="text-blue-500" />
            <span>FX</span>
          </button>

          <button 
            onClick={() => setIsVendorUploadModalOpen(true)}
            className="h-10 px-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Open Vendor document submission portal"
          >
            <Share2 size={14} className="text-indigo-600" />
            <span>Vendor Portal</span>
          </button>

          <button 
            onClick={() => setIsExportModalOpen(true)} 
            className="h-10 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export CSV or JSON data"
          >
            <Download size={14} className="text-blue-600" />
            <span>Export</span>
          </button>

          <button 
            onClick={() => handlePrintDocument('REGISTER')} 
            className="h-10 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Print GST Invoices Register Summary Report"
          >
            <Printer size={14} className="text-slate-600" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && activeSubTab === 'LIST' && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
            >
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-6 relative">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date From</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date To</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Min Amount</label>
                        <input type="number" placeholder="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Amount</label>
                        <input type="number" placeholder="Any" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Sub-Type</label>
                        <select 
                            value={filterDocType} 
                            onChange={e => setFilterDocType(e.target.value as any)} 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Documents</option>
                            <option value="CREDIT_NOTE">Credit Notes Only</option>
                            <option value="DEBIT_NOTE">Debit Notes Only</option>
                            <option value="AMENDMENT">Amendments Only</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compliance Category</label>
                        <select 
                            value={filterCompliance} 
                            onChange={e => setFilterCompliance(e.target.value as any)} 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Categories</option>
                            <option value="RCM">Reverse Charge (RCM)</option>
                            <option value="BLOCKED_ITC">Blocked ITC (Sec 17(5))</option>
                            <option value="IMPORT">Import Transactions</option>
                            <option value="SEZ">SEZ Transactions</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expense Category</label>
                        <select 
                            value={filterExpenseCategory} 
                            onChange={e => setFilterExpenseCategory(e.target.value)} 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Expense Categories</option>
                            {STANDARD_EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-end">
                        <div className="flex items-center justify-between gap-2 h-10">
                            {activeCategory === 'PURCHASE' ? (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={filterVendorBillOnly} 
                                        onChange={e => setFilterVendorBillOnly(e.target.checked)} 
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Vendor Bills Only</span>
                                </label>
                            ) : <div />}
                            
                            {(startDate || endDate || minAmount || maxAmount || filterDocType !== 'ALL' || filterCompliance !== 'ALL' || filterVendorBillOnly || filterExpenseCategory !== 'ALL') && (
                                <button 
                                    onClick={() => { 
                                        setStartDate(''); 
                                        setEndDate(''); 
                                        setMinAmount(''); 
                                        setMaxAmount(''); 
                                        setFilterDocType('ALL'); 
                                        setFilterCompliance('ALL'); 
                                        setFilterExpenseCategory('ALL'); 
                                        setFilterVendorBillOnly(false); 
                                    }} 
                                    className="text-xs font-bold text-blue-600 hover:text-red-500 transition-colors flex items-center gap-1"
                                >
                                    <RefreshCw size={10}/> Reset All
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      {activeSubTab === 'REMINDERS' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <WhatsAppNotificationCenter initialTab="INVOICES" tenantId={tenantId} />
          </div>
      ) : activeSubTab === 'IMPORT_HISTORY' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">Bulk Import Logs</h3>
                    <p className="text-xs text-slate-500 mt-1">Audit trail of all spreadsheet uploads and data ingestion tasks</p>
                </div>
                <div className="p-0">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">File Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Results</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">processed File</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {importHistory?.map((log: ImportLog) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                <FileSpreadsheet size={18} />
                                            </div>
                                            <span className="font-semibold text-slate-800">{log.fileName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Success</p>
                                                <p className="text-sm font-bold text-emerald-600">{log.successCount}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Failed</p>
                                                <p className="text-sm font-bold text-rose-600">{log.failureCount}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                                            log.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                                            log.status === 'PARTIAL_SUCCESS' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {log.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                          onClick={() => window.open(log.processedFileUrl, '_blank')}
                                          className="p-2 hover:bg-slate-100 rounded-lg text-blue-600 transition-all flex items-center gap-2 text-xs font-bold ml-auto"
                                        >
                                            <Download size={14} /> Download
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
          </div>
      ) : activeSubTab === 'RECURRING' ? (
          <RecurringInvoicesModule 
            tenantId={tenantId} 
            onInvoiceGenerated={refetch} 
            autoOpenCreate={recurringAutoOpen}
            onCloseCreate={() => setRecurringAutoOpen(false)}
          />
      ) : activeSubTab === 'OFFLINE_DRAFTS' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-200/60">
                   <Database size={22} />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     Local Offline Drafts & Scanned Receipts
                     <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-bold">
                       {offlineDrafts?.length || 0} queued
                     </span>
                   </h3>
                   <p className="text-xs text-slate-500">
                     IndexedDB local persistence for receipts scanned or drafted while disconnected
                   </p>
                 </div>
              </div>

              {offlineDrafts && offlineDrafts.length > 0 && (
                <button
                  onClick={handleSyncAllOfflineDrafts}
                  disabled={!isOnline || isSyncingDrafts}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
                >
                  {isSyncingDrafts ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Sync All Drafts ({offlineDrafts.length})
                </button>
              )}
            </div>
            
            {!isOnline && (
               <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                 <CloudOff size={18} className="text-amber-600 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold text-amber-800">Device is Offline</h4>
                   <p className="text-xs text-amber-700 mt-1">Receipts and drafts are safely preserved on your device storage. They will be available for automatic or manual cloud synchronization as soon as internet connection is restored.</p>
                 </div>
               </div>
            )}
            
            {(!offlineDrafts || offlineDrafts.length === 0) ? (
              <div className="py-16 text-center text-slate-500 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                  <Database size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700">No Local Offline Drafts</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    When you scan physical receipts or create draft invoices without an internet connection, they will be listed here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offlineDrafts.map(draft => (
                   <div key={draft.id} className="border border-slate-200 p-4 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors flex flex-col gap-3 shadow-xs">
                     <div className="flex items-start justify-between">
                       <div>
                         <h4 className="font-bold text-slate-800 text-sm font-mono">{draft.data?.invoiceNumber || 'Untitled Draft'}</h4>
                         <p className="text-xs text-slate-500 mt-0.5">Saved: {new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(draft.updatedAt).toLocaleDateString()}</p>
                       </div>
                       <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">LOCAL</span>
                     </div>
                     <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-lg border border-slate-200/80">
                       <div className="font-semibold text-slate-800 truncate">{draft.data?.partyName || 'Party Not Specified'}</div>
                       <div className="text-slate-500 flex justify-between">
                         <span>GSTIN:</span>
                         <span className="font-mono text-slate-700">{draft.data?.gstin || draft.data?.partyGstin || 'Unregistered'}</span>
                       </div>
                       <div className="text-slate-500 flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900">
                         <span>Total Value:</span>
                         <span>₹{Number(draft.data?.totalAmount || draft.data?.totalValue || 0).toLocaleString()}</span>
                       </div>
                     </div>
                     <div className="flex items-center justify-end gap-2 mt-auto pt-2 border-t border-slate-200/60">
                        <button 
                          onClick={() => deleteDraft(draft.id)} 
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Discard
                        </button>
                        <button 
                          onClick={() => handleSyncOfflineDraft(draft)} 
                          disabled={!isOnline} 
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                        >
                          <Upload size={12} /> Sync & File
                        </button>
                     </div>
                   </div>
                ))}
              </div>
            )}
          </div>
      ) : (
      <>
      {/* 30-Day Invoice Status Distribution Recharts Summary Card */}
      <div className="mt-6">
        <InvoiceStatusDistributionCard
          invoices={invoices || []}
          activeCategory={activeCategory}
          onFilterByStatus={setFilterStatus}
          selectedGstin={selectedGstin}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 border-b border-slate-200 pb-1 mt-2">
        <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0">
          {['ALL', 'PAID', 'OVERDUE', 'PENDING', 'UPLOADED', 'FILED', 'FAILED'].map((tab) => (
            <button key={tab} onClick={() => setFilterStatus(tab)} className={`text-sm font-medium transition-colors whitespace-nowrap px-1 py-2 relative ${filterStatus === tab ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              {filterStatus === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full"></div>}
            </button>
          ))}
        </div>

        {activeCategory === 'SALES' && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <span className="text-[10px] text-slate-500 uppercase px-2 font-bold flex items-center gap-1">
              <ShieldCheck size={12} className="text-slate-700" /> Sign-Off:
            </span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'DRAFT', label: 'Drafts' },
              { id: 'PENDING_FINANCE_REVIEW', label: 'Fin. Review' },
              { id: 'PENDING_SR_FINANCE_SIGNOFF', label: 'Sr. Sign-Off' },
              { id: 'APPROVED', label: 'Approved' }
            ].map(stage => (
              <button
                key={stage.id}
                onClick={() => setApprovalStageFilter(stage.id)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                  approvalStageFilter === stage.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-10"><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" onChange={handleSelectAll} checked={currentInvoices.length > 0 && currentInvoices.every(i => selectedIds.has(i.id))}/></th>
                <SortHeader label="Date" sortKey="date" />
                <SortHeader label="Due Date" sortKey="dueDate" />
                <SortHeader label="Invoice No." sortKey="invoiceNumber" />
                <SortHeader label={activeCategory === 'PURCHASE' ? 'Vendor' : 'Customer'} sortKey="partyName" />
                <SortHeader label="Type" sortKey="type" />
                <SortHeader label="Amount" sortKey="amount" align="right" />
                <SortHeader label="Status" sortKey="status" />
                {activeCategory === 'SALES' && <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-slate-500 whitespace-nowrap">Approval Stage</th>}
                {activeCategory !== 'PURCHASE' && <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-slate-500 whitespace-nowrap">E-Invoice</th>}
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-slate-500 text-right whitespace-nowrap w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentInvoices.map((inv) => {
                const resolvedDueDate = inv.dueDate || (inv.date ? new Date(new Date(inv.date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '');
                return (
                  <tr key={inv.id} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${selectedIds.has(inv.id) ? 'bg-slate-50' : ''}`} onClick={() => setSelectedInvoice(inv)}>
                    <td className="px-6 py-4 w-10" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" checked={selectedIds.has(inv.id)} onChange={() => handleSelectOne(inv.id)}/></td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap font-medium" onClick={(e) => e.stopPropagation()}>
                      {editingCell && editingCell.id === inv.id && editingCell.field === 'date' ? (
                        <input 
                          type="date" 
                          value={editingValue} 
                          onChange={(e) => setEditingValue(e.target.value)} 
                          onBlur={() => handleInlineUpdate(inv.id, 'date', editingValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInlineUpdate(inv.id, 'date', editingValue);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="p-1 border border-blue-500 rounded text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div 
                          onClick={() => { 
                            if (canEdit) {
                              setEditingCell({ id: inv.id, field: 'date' }); 
                              setEditingValue(inv.date); 
                            }
                          }}
                          className={`cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors group/cell flex items-center gap-1.5 ${canEdit ? 'hover:text-blue-600' : ''}`}
                          title={canEdit ? "Click to edit Invoice Date inline" : undefined}
                        >
                          <span>{inv.date}</span>
                          {canEdit && <Calendar size={12} className="text-slate-400 opacity-0 group-hover/cell:opacity-100" />}
                          {isCellUpdating === `${inv.id}-date` && <Loader2 size={12} className="animate-spin text-blue-500" />}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap font-medium" onClick={(e) => e.stopPropagation()}>
                      {editingCell && editingCell.id === inv.id && editingCell.field === 'dueDate' ? (
                        <input 
                          type="date" 
                          value={editingValue} 
                          onChange={(e) => setEditingValue(e.target.value)} 
                          onBlur={() => handleInlineUpdate(inv.id, 'dueDate', editingValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInlineUpdate(inv.id, 'dueDate', editingValue);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="p-1 border border-blue-500 rounded text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div 
                          onClick={() => { 
                            if (canEdit) {
                              setEditingCell({ id: inv.id, field: 'dueDate' }); 
                              setEditingValue(resolvedDueDate); 
                            }
                          }}
                          className={`cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors group/cell flex items-center gap-1.5 ${canEdit ? 'hover:text-blue-600' : ''}`}
                          title={canEdit ? "Click to edit Due Date inline" : undefined}
                        >
                          <span>{resolvedDueDate}</span>
                          {canEdit && <Calendar size={12} className="text-slate-400 opacity-0 group-hover/cell:opacity-100" />}
                          {isCellUpdating === `${inv.id}-dueDate` && <Loader2 size={12} className="animate-spin text-blue-500" />}
                        </div>
                      )}
                    </td>
                  <td className="px-6 py-4"><div className="font-semibold text-slate-900 flex items-center gap-2"><FileText size={14} className="text-slate-400"/>{inv.invoiceNumber}</div></td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900 font-medium truncate max-w-[180px]" title={inv.partyName}>{inv.partyName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{inv.gstin || 'Unregistered'}</div>
                    {(inv.costCenter || inv.expenseCategory || (inv.tags && inv.tags.length > 0) || inv.isRcm || inv.isBlockedItc || inv.isAmended || inv.isVendorBill || inv.isImport || inv.isSez) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {inv.costCenter && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5" title={`Cost Center: ${inv.costCenter}`}>
                            <Building2 size={9} /> {inv.costCenter}
                          </span>
                        )}
                        {inv.expenseCategory && (
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5" title={`Expense GL: ${inv.glCode || 'Standard'}`}>
                            <Tag size={9} className="text-blue-600" /> {inv.expenseCategory}
                          </span>
                        )}
                        {inv.isRcm && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200" title="Reverse Charge Mechanism">
                            RCM
                          </span>
                        )}
                        {inv.isAmended && (
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200" title={`Amendment of #${inv.originalInvoiceNumber}`}>
                            Amended
                          </span>
                        )}
                        {inv.isVendorBill && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200" title="Verified Vendor Ledger Bill">
                            Vendor Bill
                          </span>
                        )}
                        {inv.isImport && (
                          <span className="text-[9px] font-bold bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200" title="Import of Goods/Services">
                            Import
                          </span>
                        )}
                        {inv.isSez && (
                          <span className="text-[9px] font-bold bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200" title="Special Economic Zone Supply">
                            SEZ
                          </span>
                        )}
                        {inv.category === 'PURCHASE' && (
                          inv.isBlockedItc ? (
                            <span className="text-[9px] font-bold bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-0.5" title={inv.reasonForBlocked || 'CGST Act Section 17(5)'}>
                              <ShieldAlert size={9} className="text-rose-600" /> Non-Eligible ITC
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-0.5" title="Input Tax Credit Eligible under CGST Sec 16">
                              <ShieldCheck size={9} className="text-teal-600" /> ITC Eligible
                            </span>
                          )
                        )}
                        {inv.tags && inv.tags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[9px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4"><div className="flex flex-wrap gap-1"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${inv.type === 'EXPORT' ? 'bg-purple-50 text-purple-700 border-purple-100' : inv.type === 'B2B' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{inv.type}</span>{inv.docType !== 'INVOICE' && (<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">{inv.docType === 'CREDIT_NOTE' ? 'CN' : 'DN'}</span>)}</div></td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono font-semibold text-slate-900">₹{inv.amount.toLocaleString()}</div>
                    <div className="relative group/compliance inline-block cursor-help">
                      <span className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline decoration-dashed underline-offset-2 transition-colors">
                        Tax: ₹{inv.taxAmount.toLocaleString()}
                      </span>
                      
                      {/* Interactive Compliance Impact Dropdown Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover/compliance:block z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-4 text-left font-sans text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 bg-blue-50 text-blue-600 rounded">
                              <ShieldAlert size={12} />
                            </div>
                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Compliance Impact</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                            inv.category === 'PURCHASE' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {inv.category === 'PURCHASE' ? 'ITC Ledger' : 'Liability'}
                          </span>
                        </div>

                        {/* Calculation Breakdown Stats */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">Taxable Base:</span>
                            <span className="font-mono text-slate-800 font-bold">₹{(inv.amount - inv.taxAmount).toLocaleString()}</span>
                          </div>

                          <div className="border-t border-dashed border-slate-100 pt-2 space-y-1">
                            {/* Split CGST, SGST, IGST */}
                            {inv.type === 'EXPORT' || (inv.gstin && !inv.gstin.startsWith('27')) ? (
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">IGST (Inter-state 100%):</span>
                                <span className="font-mono text-slate-800 font-bold">₹{inv.taxAmount.toLocaleString()}</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500">CGST (Central 50%):</span>
                                  <span className="font-mono text-slate-800 font-bold">₹{(inv.taxAmount / 2).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500">SGST (State 50%):</span>
                                  <span className="font-mono text-slate-800 font-bold">₹{(inv.taxAmount / 2).toLocaleString()}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* RCM status if applicable */}
                          {inv.isRcm && (
                            <div className="flex justify-between items-center text-[10px] bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-100 font-semibold">
                              <span>RCM Active:</span>
                              <span>Liable as Recipient</span>
                            </div>
                          )}

                          {/* Sec 17(5) Blocked ITC status */}
                          {inv.isBlockedItc && (
                            <div className="p-2 bg-rose-50 border border-rose-100 text-rose-800 rounded text-[10px] leading-relaxed">
                              <div className="font-bold flex items-center gap-1 mb-0.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Blocked ITC Exception (Sec 17/5)
                              </div>
                              {inv.reasonForBlocked || 'Ineligible corporate purchase expense credit deduction.'}
                            </div>
                          )}

                          {/* Net GST Impact Summary */}
                          <div className="border-t border-slate-100 pt-2 mt-1 flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                            <div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Net Monthly Cash Impact</div>
                              <p className="text-[10px] text-slate-500 leading-none mt-0.5">
                                {inv.category === 'PURCHASE' 
                                  ? (inv.isBlockedItc ? 'Credits forfeited' : 'Reduces tax liability') 
                                  : 'Direct GSTR-1 payable'
                                }
                              </p>
                            </div>
                            <div className={`text-right font-mono font-black text-xs ${
                              inv.isBlockedItc 
                                ? 'text-rose-600' 
                                : inv.category === 'PURCHASE' 
                                ? 'text-emerald-600' 
                                : 'text-indigo-600'
                            }`}>
                              {inv.category === 'PURCHASE' 
                                ? (inv.isBlockedItc ? '₹0' : `+₹${inv.taxAmount.toLocaleString()}`) 
                                : `-₹${inv.taxAmount.toLocaleString()}`
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                     {editingCell && editingCell.id === inv.id && editingCell.field === 'status' ? (
                       <select
                         value={editingValue}
                         onChange={(e) => handleInlineUpdate(inv.id, 'status', e.target.value)}
                         onBlur={() => setEditingCell(null)}
                         className="p-1 border border-blue-500 rounded text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-slate-800"
                         autoFocus
                       >
                         <option value="UPLOADED">Uploaded</option>
                         <option value="PENDING">Pending</option>
                         <option value="FILED">Filed</option>
                         <option value="FAILED">Failed</option>
                       </select>
                     ) : (
                       <div 
                         onClick={() => {
                           if (canEdit) {
                             setEditingCell({ id: inv.id, field: 'status' });
                             setEditingValue(inv.status);
                           }
                         }}
                         className="flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                         title={canEdit ? "Click to edit Status inline" : undefined}
                       >
                         {getStatusBadge(inv.status)}
                         {inv.status === 'FAILED' && inv.irnError && (
                           <div className="relative group/tooltip">
                             <AlertCircle size={16} className="text-rose-500 cursor-help"/>
                           </div>
                         )}
                         {isCellUpdating === `${inv.id}-status` && <Loader2 size={12} className="animate-spin text-blue-500" />}
                       </div>
                     )}
                   </td>
                  {activeCategory === 'SALES' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getApprovalStageBadge(inv)}
                    </td>
                  )}
                  {activeCategory !== 'PURCHASE' && (<td className="px-6 py-4 whitespace-nowrap">{getIrnStatus(inv)}</td>)}
                  <td className="px-6 py-4 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {activeCategory === 'SALES' && !inv.irn && (
                                <button 
                                  className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" 
                                  title="Review & Sign-Off Workflow" 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setApprovalWorkflowTarget(inv);
                                    setIsApprovalWorkflowOpen(true);
                                  }}
                                > 
                                  <ShieldCheck size={16} /> 
                                </button>
                            )}
                            {activeCategory === 'SALES' && !inv.irn && (inv.type === 'B2B' || inv.type === 'EXPORT') && (
                                <button 
                                  className={`p-2 rounded-lg transition-colors ${
                                    (inv.approvalStage && inv.approvalStage !== 'APPROVED' && inv.approvalStage !== 'SUBMITTED_TO_PORTAL')
                                      ? 'hover:bg-amber-50 text-slate-300 hover:text-amber-600'
                                      : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'
                                  }`} 
                                  title={(inv.approvalStage && inv.approvalStage !== 'APPROVED' && inv.approvalStage !== 'SUBMITTED_TO_PORTAL') ? `Sign-Off Required (${inv.approvalStage.replace(/_/g, ' ')})` : "Generate E-Invoice"} 
                                  onClick={(e) => { e.stopPropagation(); handleGenerateEInvoiceWithGate(inv); }} 
                                  disabled={generatingIrnId === inv.id}
                                > 
                                  {generatingIrnId === inv.id ? <Loader2 size={16} className="animate-spin text-blue-600"/> : <ScanLine size={16} />} 
                                </button>
                            )}
                            {activeCategory === 'SALES' && inv.irn && !inv.ewayBillDetails && (inv.type === 'B2B' || inv.type === 'EXPORT') && (
                                <button className={`p-2 rounded-lg transition-colors ${inv.ewayBillError ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700' : 'hover:bg-purple-50 text-slate-400 hover:text-purple-600'}`} title={inv.ewayBillError || "Generate E-Way Bill"} onClick={(e) => { e.stopPropagation(); genEWayBill(inv.id); }} disabled={generatingEwbId === inv.id}> {generatingEwbId === inv.id ? <Loader2 size={16} className="animate-spin text-purple-600"/> : <Truck size={16} />} </button>
                            )}
                             {activeCategory === 'SALES' && (
                               <>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setWhatsAppModalInvoice(inv); }}
                                   className="p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors group relative" 
                                   title="Send WhatsApp Notification"
                                 > 
                                   <MessageSquare size={16} /> 
                                 </button>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleSendReminder(inv.id, 'EMAIL'); }}
                                   className="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors group relative" 
                                   title="Send Payment Reminder (Email)"
                                 > 
                                   <Send size={16} /> 
                                 </button>
                               </>
                             )}
                             <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700" title="More Actions" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}><MoreHorizontal size={16}/></button>
                        </div>
                      )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredInvoices.length === 0 && (
          <div className="p-20 text-center text-slate-500 border-t border-slate-100 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner"> <FileText size={40} className="text-slate-300"/> </div>
            <h3 className="text-lg font-bold text-slate-900">No invoices found</h3>
            <p className="max-w-xs mx-auto mt-2 text-slate-500">Adjust your filters or create a new invoice to get started.</p>
            {canEdit && (
                <button onClick={() => setIsCreateModalOpen(true)} className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-md transition-all"> Create Invoice </button>
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex flex-col xl:flex-row items-center justify-between gap-4 no-print select-none">
            {/* Left: Range and Summary & Rows per page */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold">Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-xs"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div>
                Showing <span className="font-bold text-slate-900">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                <span className="font-bold text-slate-900">{Math.min(totalItems, currentPage * itemsPerPage)}</span> of{' '}
                <span className="font-bold text-slate-900">{totalItems}</span> documents
              </div>
            </div>

            {/* Center / Right: Pagination Buttons & Quick Jump */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Pagination Controls */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:pointer-events-none transition-colors cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page Number Pills */}
                {paginationRange.map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 font-bold select-none">
                        ...
                      </span>
                    );
                  }
                  const pageNum = page as number;
                  const isActive = currentPage === pageNum;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>

              {/* Jump to Page Form (if more than 3 pages) */}
              {totalPages > 3 && (
                <form onSubmit={handleJumpToPage} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span className="hidden sm:inline text-[11px] text-slate-400 font-bold uppercase">Go to</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder={currentPage.toString()}
                    className="w-12 h-8 px-1.5 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                  />
                  <span className="text-slate-400 text-xs font-semibold">/ {totalPages}</span>
                  <button
                    type="submit"
                    className="h-8 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                      New {activeCategory === 'PURCHASE' ? 'Purchase' : 'Sales'} Document
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Enter invoice details below</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Type</label>
                    <select name="docType" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow">
                        <option value="INVOICE">Invoice</option>
                        <option value="CREDIT_NOTE">Credit Note</option>
                        <option value="DEBIT_NOTE">Debit Note</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document No.</label>
                    <div className="relative">
                        <input 
                            name="invoiceNumber" 
                            required 
                            value={invoiceNumberInput}
                            onChange={(e) => setInvoiceNumberInput(e.target.value)}
                            placeholder="INV-001" 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow font-mono" 
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const prefix = activeCategory === 'PURCHASE' ? 'PUR' : (activeCategory === 'CN_DN' ? 'CN' : 'INV');
                                const year = new Date().getFullYear();
                                const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                                setInvoiceNumberInput(`${prefix}-${year}-${sequence}`);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded transition-all"
                            title="Generate New Number"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                    <input 
                      name="date" 
                      type="date" 
                      required 
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currency</label>
                        <div className="flex gap-2">
                            <select 
                                value={selectedCurrency} 
                                onChange={(e) => setSelectedCurrency(e.target.value)}
                                className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 shadow-sm"
                            >
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="AED">AED (د.إ)</option>
                                <option value="SGD">SGD ($)</option>
                            </select>
                            {selectedCurrency !== 'INR' && (
                                <div className="flex items-center px-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-700 whitespace-nowrap">
                                    1 {selectedCurrency} = ₹{currentExchangeRate.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Party Name</label>
                        <input 
                          name="partyName" 
                          required 
                          value={partyNameInput}
                          onChange={(e) => setPartyNameInput(e.target.value)}
                          placeholder="Customer/Vendor Name" 
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow" 
                        />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider"> GSTIN {createFormType === 'B2B' && <span className="text-red-500">*</span>} </label>
                      <input 
                        name="gstin" 
                        required={createFormType === 'B2B'} 
                        value={gstinInput}
                        onChange={(e) => setGstinInput(e.target.value)}
                        placeholder="27ABCDE1234F1Z5" 
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow uppercase font-mono" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Place of Supply</label>
                      <select name="placeOfSupply" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow">
                          <option value="27">Maharashtra (27)</option>
                          <option value="07">Delhi (07)</option>
                          <option value="29">Karnataka (29)</option>
                          <option value="33">Tamil Nadu (33)</option>
                          <option value="24">Gujarat (24)</option>
                          <option value="04">Chandigarh (04)</option>
                          <option value="96">Foreign (96)</option>
                      </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GST Category</label>
                    <div className="flex gap-4">
                        {(['B2B', 'B2C', 'EXPORT'] as const).map(type => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="type" 
                                    value={type} 
                                    checked={createFormType === type}
                                    onChange={() => setCreateFormType(type)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-slate-700">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Organizational Branch & Cost Center Allocation (Clean for Starter) */}
                {canMultiBranch && currentTenantBranches.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50/40 rounded-2xl border border-amber-200/80">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={13} className="text-amber-600" /> Organizational Branch
                      </label>
                      <select
                        value={branchIdInput || selectedBranchId || currentTenantBranches[0]?.id || ''}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setBranchIdInput(bId);
                          const matched = currentTenantBranches.find(b => b.id === bId);
                          if (matched?.costCenter) {
                            setCostCenterInput(matched.costCenter);
                          }
                        }}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-amber-500 font-medium"
                      >
                        {currentTenantBranches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code}) - {b.stateName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag size={13} className="text-amber-600" /> Cost Center Allocation
                      </label>
                      <input
                        type="text"
                        value={costCenterInput}
                        onChange={(e) => setCostCenterInput(e.target.value)}
                        placeholder="e.g. CC-CORP-100 or CC-LOGISTICS-MH"
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* AI Expense Category Suggester & Statutory Tax Category */}
                <div className="space-y-4">
                  <AiExpenseCategorySuggester 
                    vendorName={partyNameInput}
                    items={lineItems}
                    totalAmount={formTotals.total}
                    gstin={gstinInput}
                    invoiceCategory={activeCategory}
                    selectedCategory={expenseCategoryInput}
                    selectedGlCode={glCodeInput}
                    onApplyCategory={(suggestion) => {
                      setExpenseCategoryInput(suggestion.suggestedCategory);
                      setGlCodeInput(suggestion.glCode);
                      setItcEligibilityInput(suggestion.itcEligibility);
                      setExpenseConfidenceInput(suggestion.confidence);
                      setExpenseReasoningInput(suggestion.reasoning);
                      if (suggestion.suggestedTags && suggestion.suggestedTags.length > 0) {
                        setCustomTags(prev => Array.from(new Set([...prev, ...suggestion.suggestedTags])));
                      }
                      if (suggestion.itemBreakdowns && suggestion.itemBreakdowns.length > 0) {
                        setLineItems(prev => prev.map((item, idx) => {
                          const match = suggestion.itemBreakdowns?.[idx] || suggestion.itemBreakdowns?.find(b => b.itemDescription.toLowerCase() === item.description.toLowerCase());
                          if (match) {
                            return {
                              ...item,
                              expenseCategory: match.suggestedCategory,
                              glCode: match.glCode,
                              hsnSac: item.hsnSac || match.hsnSac || ''
                            };
                          }
                          return item;
                        }));
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag size={12} className="text-blue-500"/> GSTR Tax Return Classification
                      </label>
                      <select 
                        value={taxCategoryInput}
                        onChange={(e) => setTaxCategoryInput(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-shadow"
                      >
                        <option value="">Auto / Standard Classification</option>
                        <option value="Input">Input (Tax Credit Eligible Purchase)</option>
                        <option value="Output">Output (Taxable Outward Sales)</option>
                        <option value="Exempt">Exempt / Zero Rated (Nil Supply)</option>
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Select return reporting category for GSTR-1 (sales) or GSTR-3B Table 4 (ITC).
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders size={12} className="text-indigo-500"/> Selected General Ledger (GL) Code
                      </label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={glCodeInput} 
                          onChange={(e) => setGlCodeInput(e.target.value)} 
                          placeholder="e.g. 5200-OFFICE or 5100-LEGAL"
                          className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-900 outline-none focus:border-blue-500"
                        />
                        {expenseCategoryInput && (
                          <span className="text-xs font-bold px-2.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg shrink-0">
                            {expenseCategoryInput}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Mapped account in Chart of Accounts for ERP synchronization.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Advanced Compliance & Document Settings */}
                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200 space-y-5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <Sliders size={12} className="text-slate-500"/> Advanced Compliance & Billing Options
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
                        {/* Reverse Charge (RCM) */}
                        <div className="flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                id="rcmToggle"
                                checked={isRcmInput}
                                onChange={(e) => setIsRcmInput(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-1"
                            />
                            <div>
                                <label htmlFor="rcmToggle" className="text-sm font-bold text-slate-700 cursor-pointer">Reverse Charge (RCM)</label>
                                <p className="text-[11px] text-slate-500 mt-0.5">Check if tax liability lies with the recipient</p>
                            </div>
                        </div>

                        {/* Vendor Bill (Only for Purchase) */}
                        {activeCategory === 'PURCHASE' && (
                            <div className="flex items-start gap-3">
                                <input 
                                    type="checkbox" 
                                    id="vendorBillToggle"
                                    checked={isVendorBillInput}
                                    onChange={(e) => setIsVendorBillInput(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-1"
                                />
                                <div>
                                    <label htmlFor="vendorBillToggle" className="text-sm font-bold text-slate-700 cursor-pointer">Classify as Vendor Bill</label>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Enables ledger matching and compliance checks</p>
                                </div>
                            </div>
                        )}

                        {/* Amendment */}
                        <div className="flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                id="amendToggle"
                                checked={isAmendmentInput}
                                onChange={(e) => setIsAmendmentInput(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-1"
                            />
                            <div>
                                <label htmlFor="amendToggle" className="text-sm font-bold text-slate-700 cursor-pointer">Is Amendment</label>
                                <p className="text-[11px] text-slate-500 mt-0.5">Corrects or revises a previously filed invoice</p>
                            </div>
                        </div>
                    </div>

                    {/* Purchase Type Sub-selector */}
                    {activeCategory === 'PURCHASE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Type</label>
                                <select 
                                    value={purchaseTypeInput} 
                                    onChange={(e) => {
                                        const val = e.target.value as any;
                                        setPurchaseTypeInput(val);
                                        if (val === 'IMPORT_GOODS' || val === 'IMPORT_SERVICES') {
                                            setGstinInput(''); // Imports don't have GSTIN
                                            setCreateFormType('EXPORT'); // Maps to interstate IGST
                                        }
                                    }}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-shadow"
                                >
                                    <option value="DOMESTIC">Domestic Purchase (Standard)</option>
                                    <option value="IMPORT_GOODS">Import of Goods</option>
                                    <option value="IMPORT_SERVICES">Import of Services</option>
                                    <option value="SEZ">Purchase from SEZ Unit/Developer</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Collapsible Amendment Details */}
                    {isAmendmentInput && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Invoice No.</label>
                                <input 
                                    required={isAmendmentInput}
                                    value={originalInvoiceNumberInput}
                                    onChange={(e) => setOriginalInvoiceNumberInput(e.target.value)}
                                    placeholder="INV-2026-Original"
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Date</label>
                                <input 
                                    type="date"
                                    required={isAmendmentInput}
                                    value={originalDateInput}
                                    onChange={(e) => setOriginalDateInput(e.target.value)}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Amendment</label>
                                <select 
                                    value={amendmentReasonInput}
                                    onChange={(e) => setAmendmentReasonInput(e.target.value)}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-500"
                                >
                                    <option value="Tax Rate Correction">Tax Rate Correction</option>
                                    <option value="Value Understated/Overstated">Value Understated/Overstated</option>
                                    <option value="GSTIN or POS Correction">GSTIN or POS Correction</option>
                                    <option value="Product Classification Update">Product Classification Update</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 pt-6">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        Line Items <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{lineItems.length} items</span>
                    </h4>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 w-[30%]">Product Description</th>
                                    <th className="px-4 py-3 w-[15%]">HSN/SAC</th>
                                    <th className="px-4 py-3 w-[10%] text-right">Qty</th>
                                    <th className="px-4 py-3 w-[15%] text-right">Rate ({selectedCurrency === 'INR' ? '₹' : selectedCurrency})</th>
                                    <th className="px-4 py-3 w-[10%] text-right">GST %</th>
                                    <th className="px-4 py-3 w-[15%] text-right">Amount ({selectedCurrency === 'INR' ? '₹' : selectedCurrency})</th>
                                    <th className="px-4 py-3 w-[5%]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lineItems.map((item, idx) => (
                                    <tr key={item.id} className="group hover:bg-slate-50">
                                        <td className="p-2">
                                            <input 
                                                value={item.description}
                                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                                placeholder="Item Name"
                                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                                required
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                value={item.hsnSac}
                                                onChange={(e) => handleItemChange(item.id, 'hsnSac', e.target.value)}
                                                placeholder="HSN"
                                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-mono"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number"
                                                min="0"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                                className="w-full h-9 px-3 text-right bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input 
                                                type="number"
                                                min="0"
                                                value={item.rate}
                                                onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                                                className="w-full h-9 px-3 text-right bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                            />
                                        </td>
                                        <td className="p-2 text-right">
                                            <select 
                                                value={item.taxRate}
                                                onChange={(e) => handleItemChange(item.id, 'taxRate', e.target.value)}
                                                className="h-9 px-2 bg-white border border-slate-200 rounded text-sm text-slate-900 focus:border-blue-500 outline-none cursor-pointer w-full"
                                            >
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="12">12%</option>
                                                <option value="18">18%</option>
                                                <option value="28">28%</option>
                                            </select>
                                        </td>
                                        <td className="p-4 text-right font-medium text-slate-800">
                                            {item.taxableValue.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={handleAddItem} className="mt-3 text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
                        <PlusCircle size={16}/> Add Line Item
                    </button>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <div className="w-64 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        {selectedCurrency !== 'INR' && (
                             <div className="border-b border-slate-200 pb-2 mb-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Normalized (INR)</p>
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                    <span>Taxable:</span>
                                    <span>₹{(formTotals.taxable * currentExchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-indigo-600">
                                    <span>GST:</span>
                                    <span>₹{(formTotals.tax * currentExchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                             </div>
                        )}
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Taxable Value</span>
                            <span className="font-mono font-medium">{selectedCurrency} {formTotals.taxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>Total Tax</span>
                            <span className="font-mono font-medium">{selectedCurrency} {formTotals.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                            <span>Grand Total</span>
                            <span className="font-mono">{selectedCurrency} {formTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white text-sm transition-colors">Cancel</button>
                <button 
                  type="button" 
                  onClick={() => {
                    const draftData = {
                      invoiceNumber: invoiceNumberInput,
                      partyName: partyNameInput,
                      gstin: gstinInput,
                      date: dateInput,
                      type: createFormType,
                      category: activeCategory,
                      items: lineItems,
                      totalValue: formTotals.total
                    };
                    saveDraft(Date.now().toString(), draftData);
                    setIsCreateModalOpen(false);
                    setActiveSubTab('OFFLINE_DRAFTS');
                  }} 
                  className="px-6 py-2.5 border border-orange-200 bg-orange-50 text-orange-700 font-semibold rounded-lg hover:bg-orange-100 flex items-center gap-2 text-sm shadow-sm transition-colors"
                >
                  <Database size={16} /> Save as Local Draft
                </button>
                <button type="submit" disabled={isAdding || !isOnline} className={`px-6 py-2.5 ${!isOnline ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'} text-white font-semibold rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors`}>
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InvoicePreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        imageSource={previewImage}
        onConfirm={handleConfirmScan}
        isScanning={isScanning}
      />

      <BulkImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBulkImport}
        invoices={invoices || []}
        onReconcileApply={handleReconcileApply}
      />

      <ExportInvoicesModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        invoices={invoices || []}
        activeCategory={activeCategory}
      />

      {/* Vendor Upload Link Modal */}
      <AnimatePresence>
        {isVendorUploadModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => {
                setIsVendorUploadModalOpen(false);
                setGeneratedUploadLink(null);
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden relative z-[201]"
            >
              <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20">
                      <Share2 size={20} />
                   </div>
                   <h3 className="text-xl font-bold tracking-tight">Vendor Upload Portal</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsVendorUploadModalOpen(false);
                    setGeneratedUploadLink(null);
                  }} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8">
                {!generatedUploadLink ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      handleGenerateVendorLink(formData.get('vendorName') as string);
                    }}
                    className="space-y-6"
                  >
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">
                      Generate a secure, time-limited link that you can share with your vendors. 
                      They can use this link to upload invoices directly into your system.
                    </p>
                    
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Name / Entity</label>
                       <input 
                         name="vendorName" 
                         required 
                         placeholder="e.g. Acme Corporation" 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-slate-300"
                       />
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                       <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                       <p className="text-xs text-amber-700 font-bold leading-relaxed">
                         Security Protocol: Generated links are single-purpose and expire automatically after 24 hours.
                       </p>
                    </div>

                    <button 
                      type="submit"
                      disabled={isGeneratingLink}
                      className="w-full py-4 bg-blue-600 text-white rounded-xl font-black flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:bg-slate-300 disabled:shadow-none uppercase tracking-widest text-xs"
                    >
                      {isGeneratingLink ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
                      Generate Secure Portal Link
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-800">
                       <ShieldCheck size={28} />
                    </div>
                    <div className="text-center space-y-1">
                       <h4 className="text-base font-bold text-slate-900 tracking-tight">Portal Activated Successfully</h4>
                       <p className="text-slate-500 text-xs font-medium">Share this secure temporary URL with your vendor partner.</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 break-all text-xs font-mono text-slate-600 leading-relaxed relative group pr-12">
                       <span className="inline-block">{generatedUploadLink}</span>
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(generatedUploadLink);
                           setIsLinkCopied(true);
                           setTimeout(() => setIsLinkCopied(false), 2500);
                         }}
                         className="absolute right-2.5 top-2.5 p-2 bg-white border border-slate-200/80 rounded-lg shadow-sm text-slate-400 hover:text-slate-900 transition-all active:scale-95"
                         title="Copy URL"
                       >
                         {isLinkCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                       </button>
                    </div>

                    {isLinkCopied && (
                      <p className="text-emerald-600 text-[11px] font-bold text-center flex items-center justify-center gap-1 animate-pulse">
                        <Check size={12} /> Copied secure link to clipboard
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                       <a 
                         href={generatedUploadLink}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all text-center"
                       >
                         <ExternalLink size={14} /> Preview Portal
                       </a>
                       <button 
                         onClick={() => {
                           navigator.clipboard.writeText(generatedUploadLink);
                           setIsLinkCopied(true);
                           setTimeout(() => setIsLinkCopied(false), 2500);
                         }}
                         className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                       >
                         {isLinkCopied ? <Check size={14} /> : <Copy size={14} />}
                         {isLinkCopied ? 'Copied' : 'Copy URL'}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Detail / E-Invoice Modal */}
      {selectedInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
              <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col h-[90vh] max-h-[95vh] overflow-hidden border border-slate-200">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white rounded-t-2xl">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedInvoice.category === 'PURCHASE' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                              {selectedInvoice.category === 'PURCHASE' ? <Receipt size={20}/> : <FileText size={20}/>}
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-slate-800">{selectedInvoice.docType === 'INVOICE' ? 'Tax Invoice' : selectedInvoice.docType.replace('_', ' ')}</h3>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500 font-mono">{selectedInvoice.invoiceNumber}</p>
                                {getStatusBadge(selectedInvoice.status)}
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer" 
                            onClick={() => handlePrintDocument('INVOICE')}
                            title="Print Tax Invoice Document"
                        >
                            <Printer size={16}/> <span className="hidden sm:inline">Print</span>
                        </button>
                        <button 
                            onClick={() => setShowTemplateSelector(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                        >
                            <Palette size={16} /> <span className="hidden sm:inline">Professional Style</span>
                        </button>
                        <button 
                            onClick={() => setShowQrModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer"
                        >
                            <Share2 size={16} /> <span className="hidden sm:inline">Client QR Portal</span>
                        </button>
                        <button 
                            onClick={() => setShowVersionHistory(!showVersionHistory)}
                            className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer ${showVersionHistory ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <History size={16}/> <span className="hidden sm:inline">History</span>
                        </button>
                        <button 
                            onClick={() => setWhatsAppModalInvoice(selectedInvoice)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                            title="Send WhatsApp Invoice Notification"
                        >
                            <MessageSquare size={16} /> <span className="hidden sm:inline">WhatsApp Notify</span>
                        </button>
                        <button 
                            onClick={() => setIsEvidenceTrailOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-slate-800/10 cursor-pointer"
                        >
                            <ShieldCheck size={16}/> <span className="hidden sm:inline">Evidence Trail</span>
                        </button>
                        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <Download size={16}/> <span className="hidden sm:inline">Download</span>
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <button onClick={() => setSelectedInvoice(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                            <X size={20} />
                        </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 custom-scrollbar">
                        <div id="printable-invoice-document" className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm print:shadow-none print:border-none relative overflow-hidden">
                          
                          {/* Decorative Background */}
                          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-slate-50 to-blue-50 rounded-bl-full -mr-32 -mt-32 opacity-50 pointer-events-none"></div>

                          {/* Formal Invoice Header */}
                          <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-100 pb-6 mb-6 relative z-10">
                             <div>
                                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">
                                    {selectedInvoice.docType === 'INVOICE' ? 'Tax Invoice' : selectedInvoice.docType.replace('_', ' ')}
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Original for Recipient
                                </p>
                             </div>
                             {selectedInvoice.qrCodeUrl && (
                                <div className="mt-4 md:mt-0 text-right">
                                   <div className="bg-white p-1 rounded-lg border border-slate-200 inline-block">
                                      <img src={selectedInvoice.qrCodeUrl} className="w-20 h-20" alt="QR Code" />
                                   </div>
                                   <p className="text-[10px] text-slate-400 mt-1">Scan for E-Invoice</p>
                                </div>
                             )}
                          </div>

                          {/* Parties Grid (Same as before) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billed By (Seller)</h3>
                                <p className="font-bold text-slate-900 text-lg">{tenantId === 't2' ? 'Globex Inc' : 'Acme Corp'}</p>
                                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                    {tenantId === 't2' ? '456 Tech Park, Bangalore, KA' : '123 Business Park, Mumbai, MH'}
                                </p>
                                <div className="mt-3 flex items-center gap-2 group">
                                    <span className="text-xs font-semibold text-slate-500">GSTIN:</span>
                                    <code className="text-xs font-mono font-medium text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                        {tenantId === 't2' ? '29XYZZZ9876L1Z1' : '27ABCDE1234F1Z5'}
                                    </code>
                                </div>
                             </div>
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-right md:text-left">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billed To (Buyer)</h3>
                                <p className="font-bold text-slate-900 text-lg">{selectedInvoice.partyName}</p>
                                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                    Registered Office Address<br/>
                                    {selectedInvoice.placeOfSupply ? `Place of Supply: ${selectedInvoice.placeOfSupply}` : 'City, State, Pin Code'}
                                </p>
                                <div className="mt-3 flex items-center gap-2 justify-end md:justify-start group">
                                    <span className="text-xs font-semibold text-slate-500">GSTIN:</span>
                                    <code className="text-xs font-mono font-medium text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                        {selectedInvoice.gstin || 'Unregistered'}
                                    </code>
                                </div>
                             </div>
                          </div>

                          {/* Invoice Meta Grid (Same as before) */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="p-3 border border-slate-100 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Invoice Number</p>
                                <p className="font-semibold text-slate-800 text-sm break-all">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Invoice Date</p>
                                <p className="font-semibold text-slate-800 text-sm">{selectedInvoice.date}</p>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Type</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                    selectedInvoice.type === 'EXPORT' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                    selectedInvoice.type === 'B2B' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    {selectedInvoice.type}
                                </span>
                            </div>
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50">
                                <p className="text-xs text-slate-500 mb-1">Total (INR)</p>
                                <p className="font-bold text-slate-900 text-sm">₹ {(selectedInvoice.amount + selectedInvoice.taxAmount).toLocaleString()}</p>
                            </div>
                            {selectedInvoice.currency && selectedInvoice.currency !== 'INR' && (
                                <div className="p-3 border border-indigo-100 rounded-lg bg-indigo-50/50">
                                    <p className="text-xs text-indigo-600 mb-1 font-bold">Foreign Amount</p>
                                    <p className="font-bold text-indigo-900 text-sm">
                                        {selectedInvoice.currency} {selectedInvoice.originalAmount?.toLocaleString()} 
                                        <span className="text-[10px] font-medium text-indigo-400 ml-1">(@ ₹{selectedInvoice.exchangeRate?.toFixed(2)})</span>
                                    </p>
                                </div>
                            )}
                          </div>

                          {/* Custom Compliance details in Invoice Modal */}
                          {(selectedInvoice.isRcm || selectedInvoice.isAmended || selectedInvoice.isVendorBill || selectedInvoice.isImport || selectedInvoice.isSez) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                  {selectedInvoice.isAmended && (
                                      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 flex gap-3">
                                          <History size={20} className="text-blue-600 shrink-0 mt-0.5" />
                                          <div>
                                              <h5 className="font-bold text-sm text-blue-950">Amended Document Registered</h5>
                                              <p className="text-xs text-blue-800 leading-relaxed mt-0.5">
                                                  This document amends the previously filed invoice <span className="font-mono font-bold">#{selectedInvoice.originalInvoiceNumber}</span> dated <span className="font-semibold">{selectedInvoice.originalDate}</span>.
                                              </p>
                                              <p className="text-[11px] font-bold text-blue-900 mt-1">Reason: {selectedInvoice.amendmentReason || 'Value/Tax Correction'}</p>
                                          </div>
                                      </div>
                                  )}
                                  {selectedInvoice.isRcm && (
                                      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex gap-3">
                                          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                                          <div>
                                              <h5 className="font-bold text-sm text-amber-950">Reverse Charge Applicable (RCM)</h5>
                                              <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                                                  Reverse charge is applicable for this document. The recipient is liable to pay tax directly to the government instead of the supplier.
                                              </p>
                                          </div>
                                      </div>
                                  )}
                                  {selectedInvoice.isVendorBill && (
                                      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 flex gap-3">
                                          <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                          <div>
                                              <h5 className="font-bold text-sm text-emerald-950">Vendor Bill Verified</h5>
                                              <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                                                  This is a verified Vendor Bill registered under the accounts ledger. Eligible for Input Tax Credit reconciliation checks.
                                              </p>
                                          </div>
                                      </div>
                                  )}
                                  {(selectedInvoice.isImport || selectedInvoice.isSez) && (
                                      <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-purple-900 flex gap-3">
                                          <Globe size={20} className="text-purple-600 shrink-0 mt-0.5" />
                                          <div>
                                              <h5 className="font-bold text-sm text-purple-950">
                                                  {selectedInvoice.isImport ? 'Import Transaction' : 'SEZ Supply Category'}
                                              </h5>
                                              <p className="text-xs text-purple-800 leading-relaxed mt-0.5">
                                                  {selectedInvoice.isImport 
                                                      ? 'Subject to Integrated GST (IGST) booking on imports of goods/services. Exempt from domestic SGST/CGST.'
                                                      : 'Registered under Special Economic Zone (SEZ) supply category. Subject to zero-rated supply set-off rules.'}
                                              </p>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )}

                          {/* Expense Classification & Accounting Card */}
                          {(selectedInvoice.expenseCategory || selectedInvoice.glCode || selectedInvoice.itcEligibility) && (
                              <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">
                                      Expense Account
                                    </span>
                                    <h5 className="font-bold text-slate-900 text-sm">
                                      {selectedInvoice.expenseCategory || 'General Expense'}
                                    </h5>
                                    {selectedInvoice.glCode && (
                                      <code className="text-xs bg-white text-blue-800 font-mono px-2 py-0.5 rounded border border-blue-200">
                                        GL: {selectedInvoice.glCode}
                                      </code>
                                    )}
                                  </div>
                                  {selectedInvoice.expenseCategoryReasoning && (
                                    <p className="text-xs text-slate-600 italic">
                                      "{selectedInvoice.expenseCategoryReasoning}"
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {selectedInvoice.itcEligibility === 'BLOCKED_17_5' || selectedInvoice.isBlockedItc ? (
                                    <span className="text-xs font-bold bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
                                      <ShieldAlert size={14} className="text-rose-600" /> Blocked ITC (Sec 17(5))
                                    </span>
                                  ) : selectedInvoice.itcEligibility === 'ELIGIBLE' ? (
                                    <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-lg border border-teal-200 flex items-center gap-1">
                                      <ShieldCheck size={14} className="text-teal-600" /> Full ITC Eligible (Sec 16)
                                    </span>
                                  ) : null}

                                  {selectedInvoice.expenseCategoryConfidence && (
                                    <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-1 rounded-lg border border-blue-200">
                                      AI Confidence: {selectedInvoice.expenseCategoryConfidence}%
                                    </span>
                                  )}
                                </div>
                              </div>
                          )}

                          {/* Line Items Table */}
                          <div className="mb-8 rounded-lg border border-slate-200 overflow-hidden">
                              <table className="w-full text-sm">
                                  <thead className="bg-slate-50">
                                      <tr>
                                          <th className="text-left py-3 px-4 font-semibold text-slate-600">Description</th>
                                          <th className="text-right py-3 px-4 font-semibold text-slate-600">HSN/SAC</th>
                                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Qty</th>
                                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                                          <th className="text-right py-3 px-4 font-semibold text-slate-600">GST %</th>
                                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Amount</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                                          selectedInvoice.items.map((item, idx) => (
                                              <tr key={item.id || idx}>
                                                  <td className="py-4 px-4 text-slate-800 font-medium">
                                                      {item.description}
                                                  </td>
                                                  <td className="py-4 px-4 text-right text-slate-600 font-mono">{item.hsnSac || '-'}</td>
                                                  <td className="py-4 px-4 text-right text-slate-600">{item.quantity} {item.unit}</td>
                                                  <td className="py-4 px-4 text-right text-slate-600">₹{item.rate.toLocaleString()}</td>
                                                  <td className="py-4 px-4 text-right text-slate-600">{item.taxRate}%</td>
                                                  <td className="py-4 px-4 text-right text-slate-800 font-bold">₹{item.taxableValue.toLocaleString()}</td>
                                              </tr>
                                          ))
                                      ) : (
                                          <tr>
                                              <td colSpan={6} className="py-4 px-4 text-center text-slate-500 italic">No line item details available.</td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>

                          {/* Totals Section with Tax Breakup */}
                          <div className="flex justify-end mb-8">
                             <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                   <h4 className="font-bold text-slate-700 text-sm">Payment Details</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                   <div className="flex justify-between text-sm text-slate-600">
                                      <span>Taxable Amount</span>
                                      <span className="font-mono font-medium">₹{selectedInvoice.amount.toLocaleString()}</span>
                                   </div>
                                   
                                   {selectedInvoice.taxDetails ? (
                                       <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                                           <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                               <Receipt size={10}/> Tax Breakup
                                           </p>
                                           {selectedInvoice.taxDetails.igst > 0 && (
                                               <div className="flex justify-between text-xs text-slate-600">
                                                   <span>IGST</span>
                                                   <span className="font-mono">₹{selectedInvoice.taxDetails.igst.toLocaleString()}</span>
                                               </div>
                                           )}
                                           {selectedInvoice.taxDetails.cgst > 0 && (
                                               <div className="flex justify-between text-xs text-slate-600">
                                                   <span>CGST</span>
                                                   <span className="font-mono">₹{selectedInvoice.taxDetails.cgst.toLocaleString()}</span>
                                               </div>
                                           )}
                                           {selectedInvoice.taxDetails.sgst > 0 && (
                                               <div className="flex justify-between text-xs text-slate-600">
                                                   <span>SGST</span>
                                                   <span className="font-mono">₹{selectedInvoice.taxDetails.sgst.toLocaleString()}</span>
                                               </div>
                                           )}
                                           {selectedInvoice.taxDetails.utgst > 0 && (
                                               <div className="flex justify-between text-xs text-slate-600">
                                                   <span>UTGST</span>
                                                   <span className="font-mono">₹{selectedInvoice.taxDetails.utgst.toLocaleString()}</span>
                                               </div>
                                           )}
                                           {selectedInvoice.taxDetails.cess > 0 && (
                                               <div className="flex justify-between text-xs text-slate-600">
                                                   <span>CESS</span>
                                                   <span className="font-mono">₹{selectedInvoice.taxDetails.cess.toLocaleString()}</span>
                                               </div>
                                           )}
                                       </div>
                                   ) : (
                                       <div className="flex justify-between text-sm text-slate-600">
                                           <span>Total Tax</span>
                                           <span className="font-mono">₹{selectedInvoice.taxAmount.toLocaleString()}</span>
                                       </div>
                                   )}
                                   
                                   <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
                                      <span>Grand Total</span>
                                      <span className="font-mono">₹{(selectedInvoice.amount + selectedInvoice.taxAmount).toLocaleString()}</span>
                                   </div>
                                </div>
                             </div>
                          </div>

                          {/* IRN Footer (Raw Data for Ref) */}
                          {selectedInvoice.irn && (
                              <div className="mt-6 pt-6 border-t border-slate-100">
                                  <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">IRN Hash</p>
                                      <button onClick={() => copyToClipboard(selectedInvoice.irn!, 'IRN')} className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition-colors"><Copy size={10}/> Copy</button>
                                  </div>
                                  <p className="text-[10px] font-mono text-slate-500 break-all bg-slate-50 p-2 rounded border border-slate-200 select-all">{selectedInvoice.irn}</p>
                              </div>
                          )}

                      </div>
                    </div>
                    {showVersionHistory && (
                        <InvoiceVersionHistory 
                            invoice={selectedInvoice} 
                            onRestore={handleRestoreVersion}
                            isRestoring={isRestoring}
                        />
                    )}
                  </div>
                  
                  {/* Modal Footer Actions */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-between items-center">
                       <div className="flex items-center gap-4">
                           {canEdit && selectedInvoice.status === 'DRAFT' && (
                               <button onClick={() => { handleInlineUpdate(selectedInvoice.id, 'status', 'PENDING_APPROVAL'); setSelectedInvoice({...selectedInvoice, status: 'PENDING_APPROVAL'}); }} className="text-sm text-orange-600 font-semibold hover:text-orange-700 hover:underline flex items-center gap-1"> <Send size={16}/> Send for Approval </button>
                           )}
                           {canEdit && selectedInvoice.status === 'PENDING_APPROVAL' && user?.role === UserRole.FINANCE_MANAGER && (
                               <>
                                <button onClick={() => { handleInlineUpdate(selectedInvoice.id, 'status', 'APPROVED'); setSelectedInvoice({...selectedInvoice, status: 'APPROVED'}); }} className="text-sm text-teal-600 font-semibold hover:text-teal-700 hover:underline flex items-center gap-1 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200"> <CheckCircle2 size={16}/> Approve Draft </button>
                                <button onClick={() => { handleInlineUpdate(selectedInvoice.id, 'status', 'DRAFT'); setSelectedInvoice({...selectedInvoice, status: 'DRAFT'}); }} className="text-sm text-rose-600 font-semibold hover:text-rose-700 hover:underline flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200"> <X size={16}/> Reject </button>
                               </>
                           )}
                           {selectedInvoice.status === 'PENDING_APPROVAL' && user?.role !== UserRole.FINANCE_MANAGER && (
                               <span className="text-sm text-orange-500 font-semibold flex items-center gap-1"> <Clock size={16}/> Waiting for Finance Manager Approval </span>
                           )}
                           {canEdit && (selectedInvoice.status === 'PENDING' || selectedInvoice.status === 'APPROVED') && !selectedInvoice.irn && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'UPLOADED'}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <ScanLine size={16}/> Generate E-Invoice Now </button>
                           )}
                           {canEdit && selectedInvoice.status === 'FAILED' && (
                               <button onClick={() => { genEInvoice(selectedInvoice.id); setSelectedInvoice({...selectedInvoice, status: 'PENDING', irnError: undefined}); }} className="text-sm text-blue-600 font-semibold hover:text-blue-700 hover:underline flex items-center gap-1"> <RefreshCw size={14}/> Retry Generation </button>
                           )}
                           {canEdit && selectedInvoice.irn && !selectedInvoice.ewayBillDetails && (
                               <button onClick={() => genEWayBill(selectedInvoice.id)} disabled={generatingEwbId === selectedInvoice.id} className="text-sm text-purple-600 font-semibold hover:text-purple-700 hover:underline flex items-center gap-1"> {generatingEwbId === selectedInvoice.id ? <Loader2 size={14} className="animate-spin"/> : <Truck size={14}/>} Generate E-Way Bill </button>
                           )}
                       </div>
                       <button onClick={() => setSelectedInvoice(null)} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"> Close </button>
                  </div>
              </div>
          </div>
      )}

      <AutoCategorizationRulesModal 
        isOpen={isAutoCatRulesOpen} 
        onClose={() => setIsAutoCatRulesOpen(false)} 
      />

      <AnimatePresence>
        {isCurrencyConverterOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
               <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 20 }}
                   className="w-full max-w-md"
               >
                   <div className="flex justify-end mb-2">
                       <button onClick={() => setIsCurrencyConverterOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md">
                           <X size={20} />
                       </button>
                   </div>
                   <CurrencyConverterModule invoices={invoices || []} />
               </motion.div>
           </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateSelector && (
          <TemplateSelector 
            isOpen={showTemplateSelector}
            onClose={() => setShowTemplateSelector(false)}
            onExport={handleProfessionalExport}
            category="INVOICE"
            title={`Invoice ${selectedInvoice?.invoiceNumber}`}
          />
        )}
      </AnimatePresence>

      {/* QR Code Portal Modal */}
      <AnimatePresence>
        {showQrModal && selectedInvoice && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <QrCode size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Client Access Portal</h3>
                <p className="text-slate-500 text-sm font-medium mb-8">
                  Scan this code to allow your client to verify the status and details of 
                  <span className="text-slate-900 font-bold ml-1">#{selectedInvoice.invoiceNumber}</span>.
                </p>

                <div className="p-6 bg-white border-4 border-slate-50 rounded-3xl shadow-inner mb-8">
                  <QRCodeSVG 
                    value={`${window.location.origin}${window.location.pathname}#/portal/${selectedInvoice.id}`} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "https://raw.githubusercontent.com/lucide-react/lucide/main/icons/shield-check.svg",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Direct Link</p>
                      <p className="text-xs text-slate-600 font-mono truncate">
                        {`${window.location.origin}${window.location.pathname}#/portal/${selectedInvoice.id}`}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/portal/${selectedInvoice.id}`);
                        // Optional: Show a toast here if available
                      }}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-blue-600"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  
                  <a 
                    href={`#/portal/${selectedInvoice.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                  >
                    <ExternalLink size={18} />
                    Open Portal View
                  </a>
                  
                  <button 
                    onClick={() => setShowQrModal(false)}
                    className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <EvidenceTrailModal 
        isOpen={isEvidenceTrailOpen}
        onClose={() => setIsEvidenceTrailOpen(false)}
        invoice={selectedInvoice}
      />

      {/* Printable Invoices Register Table & Summary Report (Included in DOM for print generation) */}
      <div id="printable-invoices-register" className="hidden print:block p-8 bg-white text-slate-900">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                GST Tax Document Register
              </h1>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Category: <span className="font-bold text-slate-900">{activeCategory === 'SALES' ? 'Sales Invoices' : activeCategory === 'PURCHASE' ? 'Purchase Invoices' : 'Credit & Debit Notes'}</span>
                {selectedGstin !== 'ALL' && <span> | GSTIN Scope: {selectedGstin}</span>}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 font-medium">
              <p>Generated on: {new Date().toLocaleString()}</p>
              <p>Total Records: {registerTotals.count}</p>
            </div>
          </div>

          {/* Metric Summary Ribbon for Print */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-200 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-bold uppercase text-[10px]">Total Invoices</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{registerTotals.count}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-bold uppercase text-[10px]">Total Taxable Value</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{registerTotals.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-bold uppercase text-[10px]">Total Tax (GST)</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{registerTotals.taxValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-slate-500 font-bold uppercase text-[10px]">Gross Invoice Value</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{registerTotals.grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <table className="w-full text-xs text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
              <th className="p-2 border border-slate-300 text-center w-8">#</th>
              <th className="p-2 border border-slate-300">Date</th>
              <th className="p-2 border border-slate-300">Invoice No</th>
              <th className="p-2 border border-slate-300">Type</th>
              <th className="p-2 border border-slate-300">Customer / Vendor</th>
              <th className="p-2 border border-slate-300">GSTIN</th>
              <th className="p-2 border border-slate-300 text-right">Taxable (₹)</th>
              <th className="p-2 border border-slate-300 text-right">Tax (₹)</th>
              <th className="p-2 border border-slate-300 text-right">Total (₹)</th>
              <th className="p-2 border border-slate-300 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {(filteredInvoices || []).map((inv, idx) => (
              <tr key={inv.id || idx} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="p-2 border border-slate-300 text-center font-mono text-[10px] text-slate-500">{idx + 1}</td>
                <td className="p-2 border border-slate-300 whitespace-nowrap">{inv.date}</td>
                <td className="p-2 border border-slate-300 font-mono font-bold whitespace-nowrap">{inv.invoiceNumber}</td>
                <td className="p-2 border border-slate-300 whitespace-nowrap">{inv.type || 'B2B'}</td>
                <td className="p-2 border border-slate-300 font-medium">{inv.partyName}</td>
                <td className="p-2 border border-slate-300 font-mono text-[10px]">{inv.gstin || '-'}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-medium">₹{(inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-medium">₹{(inv.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border border-slate-300 text-right font-mono font-bold text-slate-900">₹{((inv.amount || 0) + (inv.taxAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border border-slate-300 text-center font-bold text-[10px] uppercase">{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
          <div>GST Compliance & Statutory Invoicing Management Engine</div>
          <div>Page 1 of 1 • Internal Audit Copy</div>
        </div>
      </div>

      {/* Document Camera Scanner Modal Interface */}
      <DocumentCameraScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onInvoiceExtracted={handleCameraInvoiceExtracted}
        defaultCategory={activeCategory === 'CN_DN' ? 'SALES' : activeCategory}
      />

      {/* Instant Scan Success Toast Notification */}
      {scanSuccessToast && (
        <div className="fixed bottom-24 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{scanSuccessToast}</span>
          <button onClick={() => setScanSuccessToast(null)} className="text-slate-400 hover:text-white ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      <DataQualityOverlay 
        invoices={filteredInvoices || []} 
        isOpen={isDataQualityOverlayOpen} 
        onClose={() => setIsDataQualityOverlayOpen(false)} 
      />

      {/* Multi-Stage Invoice Approval Workflow Modal */}
      {isApprovalWorkflowOpen && (
        <InvoiceApprovalWorkflowModal
          isOpen={isApprovalWorkflowOpen}
          onClose={() => {
            setIsApprovalWorkflowOpen(false);
            setApprovalWorkflowTarget(null);
          }}
          invoice={approvalWorkflowTarget}
          onWorkflowUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
            refetch();
          }}
        />
      )}

      {/* Statutory Sign-Off Gatekeeper Warning Modal */}
      {approvalGateWarning.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
              <ShieldAlert size={26} />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Finance Sign-Off Required
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">
              {approvalGateWarning.reason}
            </p>
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-[11px] text-amber-900">
              <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <span>
                To prevent non-compliant statutory filings, draft invoices must progress through Finance Review and Senior Finance Manager Sign-off before transmission to the government IRP portal.
              </span>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setApprovalGateWarning({ isOpen: false, invoice: null, reason: '' })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Dismiss
              </button>
              {approvalGateWarning.invoice && (
                <button
                  onClick={() => {
                    const target = approvalGateWarning.invoice;
                    setApprovalGateWarning({ isOpen: false, invoice: null, reason: '' });
                    if (target) {
                      setApprovalWorkflowTarget(target);
                      setIsApprovalWorkflowOpen(true);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} /> Open Approval Workflow
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Invoice Notification Modal */}
      {whatsAppModalInvoice && (
        <SendInvoiceWhatsAppModal
          invoice={whatsAppModalInvoice}
          isOpen={Boolean(whatsAppModalInvoice)}
          onClose={() => setWhatsAppModalInvoice(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
            queryClient.invalidateQueries({ queryKey: ['auditLogs', tenantId] });
          }}
        />
      )}

      {/* Branch Manager Modal */}
      {isBranchManagerOpen && (
        <BranchManagerModal
          isOpen={isBranchManagerOpen}
          onClose={() => setIsBranchManagerOpen(false)}
          tenantId={tenantId}
        />
      )}

      {/* Plan Upgrade Prompt Modal */}
      {upgradePrompt?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
              <Lock size={24} />
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                {upgradePrompt.requiredPlan}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-2">
              {upgradePrompt.feature}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {upgradePrompt.description}
            </p>
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Your organization is currently on the <strong className="text-slate-800">{subProfile.planName}</strong> plan. Upgrade anytime from Settings to unlock enterprise batch capabilities.
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setUpgradePrompt(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              <a
                href="#/settings"
                onClick={() => setUpgradePrompt(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all shadow-blue-600/20"
              >
                <ArrowUpRight size={14} />
                View Plans in Settings
              </a>
            </div>
          </div>
        </div>
      )}

      {/* AI Smart Tax Rate Classifier Modal */}
      {isAiTaxClassifierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full p-2 relative my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">AI Tax Rate Classifier</h3>
                  <p className="text-xs text-slate-500">Analyze product or service descriptions to apply the correct statutory GST tax rates</p>
                </div>
              </div>
              <button
                onClick={() => setIsAiTaxClassifierModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 max-h-[80vh] overflow-y-auto">
              <SmartTaxRateClassifier
                onApplyToInvoice={(classified) => {
                  setIsAiTaxClassifierModalOpen(false);
                  // Open create modal with prefilled line item
                  setIsCreateModalOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;