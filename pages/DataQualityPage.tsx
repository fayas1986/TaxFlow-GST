import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Play, 
  CheckCircle, 
  RotateCcw, 
  AlertOctagon, 
  HelpCircle, 
  Layers, 
  FileSpreadsheet, 
  Plus, 
  CornerDownRight, 
  Database, 
  Sparkles, 
  Trash2, 
  Check, 
  Search, 
  ArrowRight,
  Calculator,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Terminal,
  Upload,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// PIN code first two digits to state code mappings
const pinToStateMap: Record<string, { stateName: string; stateCode: string }> = {
  '11': { stateName: 'Delhi', stateCode: '07' },
  '12': { stateName: 'Haryana', stateCode: '06' },
  '13': { stateName: 'Haryana', stateCode: '06' },
  '14': { stateName: 'Punjab', stateCode: '03' },
  '15': { stateName: 'Punjab', stateCode: '03' },
  '30': { stateName: 'Rajasthan', stateCode: '08' },
  '31': { stateName: 'Rajasthan', stateCode: '08' },
  '32': { stateName: 'Rajasthan', stateCode: '08' },
  '33': { stateName: 'Rajasthan', stateCode: '08' },
  '34': { stateName: 'Rajasthan', stateCode: '08' },
  '36': { stateName: 'Gujarat', stateCode: '24' },
  '37': { stateName: 'Gujarat', stateCode: '24' },
  '38': { stateName: 'Gujarat', stateCode: '24' },
  '39': { stateName: 'Gujarat', stateCode: '24' },
  '40': { stateName: 'Maharashtra', stateCode: '27' },
  '41': { stateName: 'Maharashtra', stateCode: '27' },
  '42': { stateName: 'Maharashtra', stateCode: '27' },
  '43': { stateName: 'Maharashtra', stateCode: '27' },
  '44': { stateName: 'Maharashtra', stateCode: '27' },
  '45': { stateName: 'Madhya Pradesh', stateCode: '23' },
  '46': { stateName: 'Madhya Pradesh', stateCode: '23' },
  '47': { stateName: 'Madhya Pradesh', stateCode: '23' },
  '48': { stateName: 'Madhya Pradesh', stateCode: '23' },
  '50': { stateName: 'Telangana', stateCode: '36' },
  '51': { stateName: 'Andhra Pradesh', stateCode: '37' },
  '52': { stateName: 'Andhra Pradesh', stateCode: '37' },
  '53': { stateName: 'Andhra Pradesh', stateCode: '37' },
  '56': { stateName: 'Karnataka', stateCode: '29' },
  '57': { stateName: 'Karnataka', stateCode: '29' },
  '58': { stateName: 'Karnataka', stateCode: '29' },
  '59': { stateName: 'Karnataka', stateCode: '29' },
  '60': { stateName: 'Tamil Nadu', stateCode: '33' },
  '61': { stateName: 'Tamil Nadu', stateCode: '33' },
  '62': { stateName: 'Tamil Nadu', stateCode: '33' },
  '63': { stateName: 'Tamil Nadu', stateCode: '33' },
  '64': { stateName: 'Tamil Nadu', stateCode: '33' },
  '67': { stateName: 'Kerala', stateCode: '32' },
  '68': { stateName: 'Kerala', stateCode: '32' },
  '69': { stateName: 'Kerala', stateCode: '32' },
  '70': { stateName: 'West Bengal', stateCode: '19' },
  '71': { stateName: 'West Bengal', stateCode: '19' },
  '72': { stateName: 'West Bengal', stateCode: '19' },
  '73': { stateName: 'West Bengal', stateCode: '19' },
  '74': { stateName: 'West Bengal', stateCode: '19' },
  '80': { stateName: 'Bihar', stateCode: '10' },
  '81': { stateName: 'Bihar', stateCode: '10' },
  '82': { stateName: 'Bihar', stateCode: '10' },
  '83': { stateName: 'Bihar', stateCode: '10' },
  '84': { stateName: 'Bihar', stateCode: '10' },
};

// Interface definitions
interface ScrubAlert {
  id: string;
  type: 'PAN_MISMATCH' | 'PIN_STATE_MISMATCH' | 'DUPLICATE_ERP_ENTRY' | 'TAX_ROUNDING_ERROR';
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  field: string;
  originalValue: string;
  suggestedValue: string;
  resolved: boolean;
}

interface ErpInvoiceFeed {
  id: string;
  sourceFeed: 'SAP-ERP' | 'ORACLE-CLOUD' | 'TALLY-SYNC' | 'SALESFORCE' | 'USER-UPLOAD';
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGstin: string;
  supplierPan: string;
  supplierPinCode: string;
  buyerName: string;
  buyerGstin: string;
  buyerPan: string;
  buyerPinCode: string;
  placeOfSupply: string; // State Code
  taxableValue: number;
  igstRecorded: number;
  cgstRecorded: number;
  sgstRecorded: number;
  taxRate: number; // e.g. 18
  totalAmountRecorded: number;
  
  // Results
  scrubbed: boolean;
  qualityScore: number;
  alerts: ScrubAlert[];
  itcStatus?: 'ELIGIBLE' | 'BLOCKED' | 'DISABLED';
}

// Initial Standard Erroneous Demo Feed
const INITIAL_DEMO_FEED: ErpInvoiceFeed[] = [
  {
    id: 'erp-1',
    sourceFeed: 'SAP-ERP',
    invoiceNumber: 'INV/2026/0491',
    invoiceDate: '2026-08-10',
    supplierName: 'Acme Heavy Industrials Ltd',
    supplierGstin: '27ABCDE1234F1Z5',
    supplierPan: 'ABXDE9999F', // Mismatch! (PAN inside GSTIN is ABCDE1234F)
    supplierPinCode: '400011', // MH (matches state '27' MH)
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A', // Align checks
    buyerPinCode: '110001', // Delhi (matches '07' Delhi)
    placeOfSupply: '27',
    taxableValue: 1500000.00,
    igstRecorded: 0,
    cgstRecorded: 135000.00,
    sgstRecorded: 135000.00,
    taxRate: 18,
    totalAmountRecorded: 1770000.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-2',
    sourceFeed: 'ORACLE-CLOUD',
    invoiceNumber: 'TX-980123',
    invoiceDate: '2026-08-12',
    supplierName: 'Delta Systems & Cables',
    supplierGstin: '29WXYZ7777A3Z1',
    supplierPan: 'WXYZ7777A',
    supplierPinCode: '560001', // Karnataka (matches '29' KA)
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '400001', // MH pincode! (but Buyer GSTIN is '07' Delhi) - PIN State Mismatch!
    placeOfSupply: '07', // Delhi
    taxableValue: 480000.00,
    igstRecorded: 86400.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 566400.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-3-sap',
    sourceFeed: 'SAP-ERP',
    invoiceNumber: 'INV-AUG-20412', // Duplicate!
    invoiceDate: '2026-08-14',
    supplierName: 'Apex Logistics & Freight',
    supplierGstin: '33LMNOP5555B1Z4',
    supplierPan: 'LMNOP5555B',
    supplierPinCode: '600001', // TN
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 75000.00,
    igstRecorded: 13500.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 88500.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-3-tally',
    sourceFeed: 'TALLY-SYNC',
    invoiceNumber: 'INV-AUG-20412', // Duplicate across feeds!
    invoiceDate: '2026-08-14',
    supplierName: 'Apex Logistics & Freight',
    supplierGstin: '33LMNOP5555B1Z4',
    supplierPan: 'LMNOP5555B',
    supplierPinCode: '600001',
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 75000.00,
    igstRecorded: 13500.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 88500.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-4',
    sourceFeed: 'SALESFORCE',
    invoiceNumber: 'SF-OUT-88910',
    invoiceDate: '2026-08-15',
    supplierName: 'Sterling HR Services',
    supplierGstin: '27AASCS8811K1ZD',
    supplierPan: 'AASCS8811K',
    supplierPinCode: '400033', // MH
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '27',
    taxableValue: 124310.50, // Fractional tax calculations!
    igstRecorded: 0,
    cgstRecorded: 11187.94, // Float discrepancy! (Calculated: 124310.50 * 0.09 = 11187.945)
    sgstRecorded: 11187.95, // Mismatch SGST vs CGST in rounding, statutory rounding missing
    taxRate: 18,
    totalAmountRecorded: 146686.39,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-5',
    sourceFeed: 'TALLY-SYNC',
    invoiceNumber: 'TLY-2026-004',
    invoiceDate: '2026-08-18',
    supplierName: 'Vanguard Security Systems',
    supplierGstin: '07VWXYZ9999C2Z8',
    supplierPan: 'VWXYZ1111C', // PAN Mismatch! (In GSTIN: VWXYZ9999C)
    supplierPinCode: '110012', // Delhi
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 85000.00,
    igstRecorded: 0,
    cgstRecorded: 7650.00,
    sgstRecorded: 7650.00,
    taxRate: 18,
    totalAmountRecorded: 100300.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-6',
    sourceFeed: 'ORACLE-CLOUD',
    invoiceNumber: 'ORC-778921',
    invoiceDate: '2026-08-20',
    supplierName: 'Zenith Office Supplies',
    supplierGstin: '24ZNTHS5544R1Z0',
    supplierPan: 'ZNTHS5544R',
    supplierPinCode: '380009', // Gujarat (matches state '24')
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '560001', // Karnataka pincode, but buyer GSTIN starts with '07' (Delhi)!
    placeOfSupply: '24', // Gujarat
    taxableValue: 12500.00,
    igstRecorded: 2250.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 14750.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-7',
    sourceFeed: 'SAP-ERP',
    invoiceNumber: 'SAP-990812',
    invoiceDate: '2026-08-22',
    supplierName: 'Titanium Castings Ltd',
    supplierGstin: '27TITAN1111F1Z1',
    supplierPan: 'TITAN1111F',
    supplierPinCode: '400050', // MH
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '27',
    taxableValue: 245050.35,
    igstRecorded: 0,
    cgstRecorded: 22054.53, // Mismatched and un-rounded floating point
    sgstRecorded: 22054.53,
    taxRate: 18,
    totalAmountRecorded: 289159.41,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-8',
    sourceFeed: 'ORACLE-CLOUD',
    invoiceNumber: 'INV-2026-8812',
    invoiceDate: '2026-08-23',
    supplierName: 'Kaveri Microcircuits Pvt Ltd',
    supplierGstin: '33KAVMS2233M1Z8',
    supplierPan: 'KAVMS9999M', // PAN Mismatch! In GSTIN: KAVMS2233M
    supplierPinCode: '600028', // TN (matches state 33)
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 360000.00,
    igstRecorded: 64800.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 424800.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-9',
    sourceFeed: 'SAP-ERP',
    invoiceNumber: 'SAP-BLR-55410',
    invoiceDate: '2026-08-24',
    supplierName: 'Indo-German Industrial Valves',
    supplierGstin: '29INVAL4433E1Z3',
    supplierPan: 'INVAL4433E',
    supplierPinCode: '110020', // Delhi PIN, but GSTIN is '29' (Karnataka)!
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 195000.00,
    igstRecorded: 35100.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 230100.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-10-ora',
    sourceFeed: 'ORACLE-CLOUD',
    invoiceNumber: 'TAX-CON-9021', // Cross-feed duplicate
    invoiceDate: '2026-08-25',
    supplierName: 'Pinnacle Cloud Infrastructure',
    supplierGstin: '27PINCL7788P1Z6',
    supplierPan: 'PINCL7788P',
    supplierPinCode: '400076', // MH
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 540000.00,
    igstRecorded: 97200.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 637200.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-10-tly',
    sourceFeed: 'TALLY-SYNC',
    invoiceNumber: 'TAX-CON-9021', // Duplicate from Tally sync
    invoiceDate: '2026-08-25',
    supplierName: 'Pinnacle Cloud Infrastructure',
    supplierGstin: '27PINCL7788P1Z6',
    supplierPan: 'PINCL7788P',
    supplierPinCode: '400076',
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 540000.00,
    igstRecorded: 97200.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 637200.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-11',
    sourceFeed: 'SALESFORCE',
    invoiceNumber: 'SF-IND-3392',
    invoiceDate: '2026-08-26',
    supplierName: 'Matrix Automation Labs',
    supplierGstin: '06MATRX6655L1Z2',
    supplierPan: 'MATRX6655L',
    supplierPinCode: '122001', // Haryana (matches 06)
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 88755.25, // Unrounded decimals
    igstRecorded: 15975.94,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 104731.19,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  },
  {
    id: 'erp-12',
    sourceFeed: 'SAP-ERP',
    invoiceNumber: 'INV-CLEAN-1002',
    invoiceDate: '2026-08-27',
    supplierName: 'Standard Clean Supplies Corp',
    supplierGstin: '27STNDS1234Q1Z9',
    supplierPan: 'STNDS1234Q',
    supplierPinCode: '400001',
    buyerName: 'Global TechSolutions Corp',
    buyerGstin: '07XYZ9876A1Z9',
    buyerPan: 'XYZ9876A',
    buyerPinCode: '110001',
    placeOfSupply: '07',
    taxableValue: 45000.00,
    igstRecorded: 8100.00,
    cgstRecorded: 0,
    sgstRecorded: 0,
    taxRate: 18,
    totalAmountRecorded: 53100.00,
    scrubbed: false,
    qualityScore: 100,
    alerts: []
  }
];

export const DataQualityPage: React.FC = () => {
  const [feeds, setFeeds] = useState<ErpInvoiceFeed[]>(INITIAL_DEMO_FEED);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [itcAutoTaggingEnabled, setItcAutoTaggingEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('TF_ITC_AUTO_TAGGING_ENABLED');
      return stored !== null ? JSON.parse(stored) : true;
    }
    return true;
  });
  
  const handleToggleItcAutoTagging = (val: boolean) => {
    setItcAutoTaggingEnabled(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('TF_ITC_AUTO_TAGGING_ENABLED', JSON.stringify(val));
    }
  };

  const [activeTab, setActiveTab] = useState<'all' | 'pan' | 'pin' | 'duplicates' | 'rounding'>('all');
  const [scrubHistory, setScrubHistory] = useState<Array<{
    id: string;
    timestamp: string;
    totalInvoices: number;
    errorsDetected: number;
    errorsCorrected: number;
    avgScoreBefore: number;
    avgScoreAfter: number;
  }>>([
    {
      id: 'h-1',
      timestamp: '2026-08-20 14:32',
      totalInvoices: 45,
      errorsDetected: 12,
      errorsCorrected: 12,
      avgScoreBefore: 81.5,
      avgScoreAfter: 100
    },
    {
      id: 'h-2',
      timestamp: '2026-08-24 09:15',
      totalInvoices: 104,
      errorsDetected: 18,
      errorsCorrected: 17,
      avgScoreBefore: 89.2,
      avgScoreAfter: 99.4
    }
  ]);
  
  // Pipeline Simulation states
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customJson, setCustomJson] = useState<string>('');
  const [showJsonInput, setShowJsonInput] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Reset page on search query, filter tab, or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, pageSize]);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute Statistics
  const stats = useMemo(() => {
    let total = feeds.length;
    let scrubbedCount = feeds.filter(f => f.scrubbed).length;
    
    let totalAlertsCount = 0;
    let criticalAlertsCount = 0;
    let warningAlertsCount = 0;
    let resolvedAlertsCount = 0;
    
    let duplicateCount = 0;
    let panCount = 0;
    let pinCount = 0;
    let roundingCount = 0;

    let avgScore = 0;

    feeds.forEach(f => {
      avgScore += f.qualityScore;
      f.alerts.forEach(a => {
        totalAlertsCount++;
        if (a.severity === 'CRITICAL') criticalAlertsCount++;
        else warningAlertsCount++;
        
        if (a.resolved) resolvedAlertsCount++;

        if (a.type === 'DUPLICATE_ERP_ENTRY') duplicateCount++;
        else if (a.type === 'PAN_MISMATCH') panCount++;
        else if (a.type === 'PIN_STATE_MISMATCH') pinCount++;
        else if (a.type === 'TAX_ROUNDING_ERROR') roundingCount++;
      });
    });

    return {
      total,
      scrubbedCount,
      totalAlerts: totalAlertsCount,
      criticalAlerts: criticalAlertsCount,
      warningAlerts: warningAlertsCount,
      resolvedAlerts: resolvedAlertsCount,
      duplicates: duplicateCount,
      panErrors: panCount,
      pinErrors: pinCount,
      roundingErrors: roundingCount,
      qualityScore: total > 0 ? Math.round(avgScore / total) : 100,
      unresolvedAlerts: totalAlertsCount - resolvedAlertsCount
    };
  }, [feeds]);

  // Scrubber Algorithm (Dynamic Logic)
  const runScrubPipeline = async () => {
    setIsScrubbing(true);
    setPipelineStep(1);
    setPipelineLogs([]);
    
    const addLog = (msg: string) => {
      setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Step 1: Ingest Feeds
    addLog("Initializing Data Quality Engine Ingestion pipeline...");
    await new Promise(r => setTimeout(r, 600));
    addLog(`Scanning ${feeds.length} ERP feeds and user uploads...`);
    setPipelineStep(2);

    // Step 2: Verify PAN-to-GSTIN alignment
    addLog("STAGE 1: Executing PAN-to-GSTIN alignment validator...");
    await new Promise(r => setTimeout(r, 800));
    
    // Step 3: PIN-to-state mapping
    addLog("STAGE 2: Analyzing physical PIN-codes to GSTIN State mappings...");
    setPipelineStep(3);
    await new Promise(r => setTimeout(r, 800));

    // Step 4: Duplicate Invoice detection across feeds
    addLog("STAGE 3: Launching Cross-ERP feed Duplicate Detection Matrix...");
    setPipelineStep(4);
    await new Promise(r => setTimeout(r, 800));

    // Step 5: Tax Rounding corrections
    addLog("STAGE 4: Verifying fractional statutory tax amounts & decimal limits...");
    setPipelineStep(5);
    await new Promise(r => setTimeout(r, 800));

    // Input Tax Credit auto-tagging
    if (itcAutoTaggingEnabled) {
      addLog("STAGE 5: Analyzing ITC auto-tagging eligibility parameters...");
      await new Promise(r => setTimeout(r, 600));
    } else {
      addLog("STAGE 5: Input Tax Credit auto-tagging is DISABLED. Skipping credit tagging.");
      await new Promise(r => setTimeout(r, 400));
    }

    // Finish & Aggregate Results
    addLog("Scrub complete. Generating Audit trail and mapping discrepancies...");
    setPipelineStep(6);
    await new Promise(r => setTimeout(r, 600));

    // Process actual feeds list and insert scrub metrics
    const scrubbedFeeds = feeds.map(feed => {
      const alerts: ScrubAlert[] = [];
      let score = 100;

      // 1. PAN to GSTIN Alignment check
      // Characters 3-12 of GSTIN is the corporate PAN
      if (feed.supplierGstin && feed.supplierGstin.length === 15) {
        const expectedPan = feed.supplierGstin.substring(2, 12);
        if (feed.supplierPan && feed.supplierPan.toUpperCase() !== expectedPan) {
          alerts.push({
            id: `${feed.id}-pan-s`,
            type: 'PAN_MISMATCH',
            severity: 'CRITICAL',
            field: 'Supplier PAN',
            originalValue: feed.supplierPan,
            suggestedValue: expectedPan,
            message: `Supplier registered PAN (${feed.supplierPan}) does not align with corporate PAN substring in the provided GSTIN (${expectedPan}).`,
            resolved: false
          });
          score -= 20;
        }
      }
      if (feed.buyerGstin && feed.buyerGstin.length === 15) {
        const expectedPan = feed.buyerGstin.substring(2, 12);
        if (feed.buyerPan && feed.buyerPan.toUpperCase() !== expectedPan) {
          alerts.push({
            id: `${feed.id}-pan-b`,
            type: 'PAN_MISMATCH',
            severity: 'CRITICAL',
            field: 'Buyer PAN',
            originalValue: feed.buyerPan,
            suggestedValue: expectedPan,
            message: `Buyer registered PAN (${feed.buyerPan}) does not align with corporate PAN substring in the provided GSTIN (${expectedPan}).`,
            resolved: false
          });
          score -= 20;
        }
      }

      // 2. PIN to State mapping checks
      if (feed.buyerPinCode && feed.buyerPinCode.length >= 2) {
        const pinPrefix = feed.buyerPinCode.substring(0, 2);
        const mappedState = pinToStateMap[pinPrefix];
        if (mappedState) {
          const gstinStateCode = feed.buyerGstin.substring(0, 2);
          if (gstinStateCode !== mappedState.stateCode) {
            alerts.push({
              id: `${feed.id}-pin-b`,
              type: 'PIN_STATE_MISMATCH',
              severity: 'WARNING',
              field: 'Buyer State Code',
              originalValue: gstinStateCode,
              suggestedValue: mappedState.stateCode,
              message: `Postal Code ${feed.buyerPinCode} belongs to ${mappedState.stateName} (State Code ${mappedState.stateCode}), but invoice transaction utilizes GSTIN State Code ${gstinStateCode}.`,
              resolved: false
            });
            score -= 15;
          }
        }
      }

      if (feed.supplierPinCode && feed.supplierPinCode.length >= 2) {
        const pinPrefix = feed.supplierPinCode.substring(0, 2);
        const mappedState = pinToStateMap[pinPrefix];
        if (mappedState) {
          const gstinStateCode = feed.supplierGstin.substring(0, 2);
          if (gstinStateCode !== mappedState.stateCode) {
            alerts.push({
              id: `${feed.id}-pin-s`,
              type: 'PIN_STATE_MISMATCH',
              severity: 'WARNING',
              field: 'Supplier State Code',
              originalValue: gstinStateCode,
              suggestedValue: mappedState.stateCode,
              message: `Postal Code ${feed.supplierPinCode} belongs to ${mappedState.stateName} (State Code ${mappedState.stateCode}), but invoice utilizes supplier GSTIN starting with ${gstinStateCode}.`,
              resolved: false
            });
            score -= 15;
          }
        }
      }

      // 3. Duplicate checks (Duplicate if same Invoice Number, Supplier, and Date)
      const matches = feeds.filter(item => 
        item.invoiceNumber === feed.invoiceNumber && 
        item.supplierGstin === feed.supplierGstin &&
        item.id !== feed.id
      );
      if (matches.length > 0) {
        alerts.push({
          id: `${feed.id}-dup`,
          type: 'DUPLICATE_ERP_ENTRY',
          severity: 'CRITICAL',
          field: 'Invoice Reference',
          originalValue: `${feed.invoiceNumber} (${feed.sourceFeed})`,
          suggestedValue: 'Deduplicated & Consolidated',
          message: `Identical invoice reference detected across ERP feeds (${feed.sourceFeed} vs ${matches.map(m => m.sourceFeed).join(', ')}).`,
          resolved: false
        });
        score -= 25;
      }

      // 4. Rounding and floating point mismatch checker
      const calculatedTotalTax = Math.round(feed.taxableValue * (feed.taxRate / 100));
      const recordedTotalTax = feed.igstRecorded + feed.cgstRecorded + feed.sgstRecorded;
      const difference = Math.abs(calculatedTotalTax - recordedTotalTax);

      // Check fractional decimals on individual components or CGST/SGST balance
      const hasDecimals = feed.cgstRecorded % 1 !== 0 || feed.sgstRecorded % 1 !== 0 || feed.igstRecorded % 1 !== 0;
      const cgstSgstMismatch = feed.cgstRecorded > 0 && feed.sgstRecorded > 0 && Math.abs(feed.cgstRecorded - feed.sgstRecorded) > 0.01;

      if (difference > 1 || hasDecimals || cgstSgstMismatch) {
        let suggestedValuesMsg = '';
        if (feed.igstRecorded > 0) {
          suggestedValuesMsg = `IGST: ₹${calculatedTotalTax}.00`;
        } else {
          suggestedValuesMsg = `CGST: ₹${calculatedTotalTax / 2}.00, SGST: ₹${calculatedTotalTax / 2}.00`;
        }

        alerts.push({
          id: `${feed.id}-rounding`,
          type: 'TAX_ROUNDING_ERROR',
          severity: 'WARNING',
          field: 'Tax Rounding Schema',
          originalValue: `CGST: ₹${feed.cgstRecorded}, SGST: ₹${feed.sgstRecorded}, IGST: ₹${feed.igstRecorded}`,
          suggestedValue: suggestedValuesMsg,
          message: `Floating point calculations found (diff ₹${difference.toFixed(2)}). Statutory filings require integer-rounded values matching total calculated tax of ₹${calculatedTotalTax}.00.`,
          resolved: false
        });
        score -= 10;
      }

      // Determine ITC eligibility
      let itcStatus: 'ELIGIBLE' | 'BLOCKED' | 'DISABLED' = 'DISABLED';
      if (itcAutoTaggingEnabled) {
        // Blocked if supplier mismatch, duplicate, or high-risk alignment discrepancies
        const isBlocked = alerts.some(a => a.type === 'DUPLICATE_ERP_ENTRY' || a.type === 'PAN_MISMATCH');
        itcStatus = isBlocked ? 'BLOCKED' : 'ELIGIBLE';
      }

      return {
        ...feed,
        scrubbed: true,
        qualityScore: Math.max(score, 20),
        alerts,
        itcStatus
      };
    });

    setFeeds(scrubbedFeeds);
    
    // Add history record
    const totalAlertsCount = scrubbedFeeds.reduce((acc, curr) => acc + curr.alerts.length, 0);
    const avgScoreAfter = Math.round(scrubbedFeeds.reduce((acc, curr) => acc + curr.qualityScore, 0) / scrubbedFeeds.length);
    
    setScrubHistory(prev => [
      {
        id: `h-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        totalInvoices: scrubbedFeeds.length,
        errorsDetected: totalAlertsCount,
        errorsCorrected: 0,
        avgScoreBefore: stats.qualityScore,
        avgScoreAfter: avgScoreAfter
      },
      ...prev
    ]);

    setIsScrubbing(false);
    setPipelineStep(0);
  };

  // Reset Engine state
  const resetEngine = () => {
    setFeeds(INITIAL_DEMO_FEED.map(f => ({ ...f, scrubbed: false, qualityScore: 100, alerts: [] })));
    setPipelineLogs([]);
    setPipelineStep(0);
  };

  // Resolve single alert
  const resolveAlert = (invoiceId: string, alertId: string, actionType: 'PAN' | 'PIN' | 'MERGE' | 'ROUND') => {
    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id !== invoiceId) return feed;
      
      const updatedAlerts = feed.alerts.map(a => {
        if (a.id !== alertId) return a;
        return { ...a, resolved: true };
      });

      // Apply actual correction in feed object
      let updatedFeed = { ...feed, alerts: updatedAlerts };
      
      if (actionType === 'PAN') {
        const expectedPan = feed.supplierGstin.substring(2, 12);
        updatedFeed.supplierPan = expectedPan;
      } else if (actionType === 'PIN') {
        // Fix placeOfSupply or buyer's GSTIN State based on postal pin
        const pinPrefix = feed.buyerPinCode.substring(0, 2);
        const mappedState = pinToStateMap[pinPrefix];
        if (mappedState) {
          updatedFeed.buyerGstin = mappedState.stateCode + feed.buyerGstin.substring(2);
        }
      } else if (actionType === 'ROUND') {
        // Correct CGST / SGST / IGST to standard integers
        const calculatedTotalTax = Math.round(feed.taxableValue * (feed.taxRate / 100));
        if (feed.igstRecorded > 0) {
          updatedFeed.igstRecorded = calculatedTotalTax;
          updatedFeed.cgstRecorded = 0;
          updatedFeed.sgstRecorded = 0;
        } else {
          updatedFeed.igstRecorded = 0;
          updatedFeed.cgstRecorded = Math.round(calculatedTotalTax / 2);
          updatedFeed.sgstRecorded = Math.round(calculatedTotalTax / 2);
        }
        updatedFeed.totalAmountRecorded = feed.taxableValue + calculatedTotalTax;
      }

      // Re-calculate local quality score based on resolved alerts count
      const unresolvedCount = updatedAlerts.filter(a => !a.resolved).length;
      const resolvedCount = updatedAlerts.filter(a => a.resolved).length;
      const initialScore = feed.qualityScore;
      const restoredScore = Math.min(100, initialScore + (resolvedCount * 15));

      return {
        ...updatedFeed,
        qualityScore: unresolvedCount === 0 ? 100 : restoredScore
      };
    }));
  };

  // Resolve All Alerts of a specific type
  const resolveAllOfType = (type: 'PAN_MISMATCH' | 'PIN_STATE_MISMATCH' | 'DUPLICATE_ERP_ENTRY' | 'TAX_ROUNDING_ERROR') => {
    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (!feed.scrubbed) return feed;

      let updatedFeed = { ...feed };
      const updatedAlerts = feed.alerts.map(a => {
        if (a.type !== type) return a;
        
        // Execute corrections inline
        if (type === 'PAN_MISMATCH') {
          const expectedPan = feed.supplierGstin.substring(2, 12);
          updatedFeed.supplierPan = expectedPan;
        } else if (type === 'PIN_STATE_MISMATCH') {
          const pinPrefix = feed.buyerPinCode.substring(0, 2);
          const mappedState = pinToStateMap[pinPrefix];
          if (mappedState) {
            updatedFeed.buyerGstin = mappedState.stateCode + feed.buyerGstin.substring(2);
          }
        } else if (type === 'TAX_ROUNDING_ERROR') {
          const calculatedTotalTax = Math.round(feed.taxableValue * (feed.taxRate / 100));
          if (feed.igstRecorded > 0) {
            updatedFeed.igstRecorded = calculatedTotalTax;
            updatedFeed.cgstRecorded = 0;
            updatedFeed.sgstRecorded = 0;
          } else {
            updatedFeed.igstRecorded = 0;
            updatedFeed.cgstRecorded = Math.round(calculatedTotalTax / 2);
            updatedFeed.sgstRecorded = Math.round(calculatedTotalTax / 2);
          }
          updatedFeed.totalAmountRecorded = feed.taxableValue + calculatedTotalTax;
        } else if (type === 'DUPLICATE_ERP_ENTRY') {
          // Keep SAP or Oracle feeds, cancel out duplicate Syncs
          if (feed.sourceFeed === 'TALLY-SYNC' || feed.sourceFeed === 'SALESFORCE') {
            updatedFeed.qualityScore = 100; // Resets
          }
        }

        return { ...a, resolved: true };
      });

      const unresolvedCount = updatedAlerts.filter(a => !a.resolved).length;
      return {
        ...updatedFeed,
        alerts: updatedAlerts,
        qualityScore: unresolvedCount === 0 ? 100 : 90
      };
    }));

    // Increment correction in history
    setScrubHistory(prev => prev.map((h, i) => i === 0 ? { ...h, errorsCorrected: h.errorsCorrected + 2 } : h));
  };

  // Complete Duplication Merge (Deduplication)
  const resolveDuplicatePair = (invoiceNum: string) => {
    // Keep first, discard second by turning it into consolidator
    setFeeds(prevFeeds => {
      const items = prevFeeds.filter(f => f.invoiceNumber === invoiceNum);
      if (items.length <= 1) return prevFeeds;

      // Maintain primary item, mark secondary duplicates as resolved/removed
      return prevFeeds.map(feed => {
        if (feed.invoiceNumber !== invoiceNum) return feed;
        
        const isTallySync = feed.sourceFeed === 'TALLY-SYNC';
        if (isTallySync) {
          // This duplicate is flagged for removal/archiving
          return {
            ...feed,
            scrubbed: true,
            qualityScore: 100,
            alerts: feed.alerts.map(a => ({ ...a, resolved: true })),
            invoiceNumber: `${feed.invoiceNumber} [DE-DUP_MERGED]`
          };
        } else {
          // Primary SAP record is cleared
          return {
            ...feed,
            alerts: feed.alerts.map(a => a.type === 'DUPLICATE_ERP_ENTRY' ? { ...a, resolved: true } : a),
            qualityScore: feed.alerts.filter(a => a.type !== 'DUPLICATE_ERP_ENTRY' && !a.resolved).length === 0 ? 100 : 85
          };
        }
      });
    });
  };

  // Add customized manual feed pastes
  const handleAddCustomJson = () => {
    try {
      const parsed = JSON.parse(customJson);
      const invoices = Array.isArray(parsed) ? parsed : [parsed];
      
      const normalized: ErpInvoiceFeed[] = invoices.map((inv, idx) => ({
        id: `custom-${Date.now()}-${idx}`,
        sourceFeed: inv.sourceFeed || 'USER-UPLOAD',
        invoiceNumber: inv.invoiceNumber || `CS-${Math.floor(Math.random() * 90000 + 10000)}`,
        invoiceDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
        supplierName: inv.supplierName || 'Custom Supplier',
        supplierGstin: inv.supplierGstin || '27ABCDE1234F1Z5',
        supplierPan: inv.supplierPan || 'ABCDE1234F',
        supplierPinCode: inv.supplierPinCode || '400011',
        buyerName: inv.buyerName || 'Global TechSolutions Corp',
        buyerGstin: inv.buyerGstin || '07XYZ9876A1Z9',
        buyerPan: inv.buyerPan || 'XYZ9876A',
        buyerPinCode: inv.buyerPinCode || '110001',
        placeOfSupply: inv.placeOfSupply || '07',
        taxableValue: Number(inv.taxableValue) || 10000.00,
        igstRecorded: Number(inv.igstRecorded) || 0,
        cgstRecorded: Number(inv.cgstRecorded) || 0,
        sgstRecorded: Number(inv.sgstRecorded) || 0,
        taxRate: Number(inv.taxRate) || 18,
        totalAmountRecorded: Number(inv.totalAmountRecorded) || 11800.00,
        scrubbed: false,
        qualityScore: 100,
        alerts: []
      }));

      setFeeds(prev => [...normalized, ...prev]);
      setShowJsonInput(false);
      setCustomJson('');
    } catch (e: any) {
      alert(`Invalid JSON structure: ${e.message}`);
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileImport(file);
    }
  };

  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Mock CSV ingestion parsing
      const rows = text.split('\n');
      if (rows.length < 2) {
        alert("File appears empty or malformed");
        return;
      }
      
      const parsedInvoices: ErpInvoiceFeed[] = [];
      // Quick parser skipping header
      for (let i = 1; i < rows.length; i++) {
        const columns = rows[i].split(',');
        if (columns.length < 6) continue;
        
        parsedInvoices.push({
          id: `csv-${Date.now()}-${i}`,
          sourceFeed: 'USER-UPLOAD',
          invoiceNumber: columns[0]?.trim() || `CSV-${1000 + i}`,
          invoiceDate: columns[1]?.trim() || '2026-08-25',
          supplierName: columns[2]?.trim() || 'Uploaded Vendor',
          supplierGstin: columns[3]?.trim() || '27ABCDE1234F1Z5',
          supplierPan: columns[4]?.trim() || 'ABCDE1234F',
          supplierPinCode: columns[5]?.trim() || '400011',
          buyerName: 'Global TechSolutions Corp',
          buyerGstin: '07XYZ9876A1Z9',
          buyerPan: 'XYZ9876A',
          buyerPinCode: '110001',
          placeOfSupply: '07',
          taxableValue: 50000.00,
          igstRecorded: 9000.00,
          cgstRecorded: 0,
          sgstRecorded: 0,
          taxRate: 18,
          totalAmountRecorded: 59000.00,
          scrubbed: false,
          qualityScore: 100,
          alerts: []
        });
      }

      if (parsedInvoices.length > 0) {
        setFeeds(prev => [...parsedInvoices, ...prev]);
        alert(`Successfully imported ${parsedInvoices.length} invoices from CSV file.`);
      }
    };
    reader.readAsText(file);
  };

  // Filtered List View
  const filteredFeeds = useMemo(() => {
    return feeds.filter(feed => {
      const matchQuery = 
        feed.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feed.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feed.supplierGstin.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchQuery) return false;

      if (activeTab === 'pan') {
        return feed.alerts.some(a => a.type === 'PAN_MISMATCH');
      }
      if (activeTab === 'pin') {
        return feed.alerts.some(a => a.type === 'PIN_STATE_MISMATCH');
      }
      if (activeTab === 'duplicates') {
        return feed.alerts.some(a => a.type === 'DUPLICATE_ERP_ENTRY');
      }
      if (activeTab === 'rounding') {
        return feed.alerts.some(a => a.type === 'TAX_ROUNDING_ERROR');
      }

      return true;
    });
  }, [feeds, searchQuery, activeTab]);

  // Pagination Calculations
  const totalItems = filteredFeeds.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedFeeds = useMemo(() => {
    return filteredFeeds.slice(startIndex, endIndex);
  }, [filteredFeeds, startIndex, endIndex]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpPageInput('');
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500" id="data-quality-dashboard">
      
      {/* Dynamic Banner Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2.5 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200/80 rounded-full text-blue-700 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Sparkles size={11} className="text-blue-600" />
            <span>AI-Driven GST Scrubbing Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
            Corporate Ingestion Pipeline Scrubber
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Automatic integrity checks for multi-channel ERP data feeds. Scrutinizes PAN alignments, maps ZIP codes directly to regulatory tax states, isolates duplicate invoice references, and corrects floating-point tax rounding errors prior to statutory GSTR-1 & 3B transmission.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 relative z-10 w-full sm:w-auto justify-end">
          <button 
            onClick={resetEngine}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RotateCcw size={14} />
            <span>Reset Feed</span>
          </button>
          
          <button 
            onClick={runScrubPipeline}
            disabled={isScrubbing}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play size={14} className={isScrubbing ? "animate-ping" : ""} />
            <span>{isScrubbing ? "Scrubbing Feed..." : "Execute Pipeline"}</span>
          </button>
        </div>
      </div>

      {/* Grid of Key Performance Indicators (Before vs After) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Ingestion Data Quality Score */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Aggregated Quality Index</span>
            <div className={`p-2 rounded-xl text-white ${stats.qualityScore >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.qualityScore}%</span>
              {stats.scrubbedCount > 0 && stats.qualityScore < 100 && (
                <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-black">
                  Scrub Complete
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.qualityScore === 100 ? "Zero discrepancies detected." : `${stats.unresolvedAlerts} unresolved data flags in progress.`}
            </p>
          </div>
        </div>

        {/* KPI 2: Duplicate Invoices */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ERP Duplicate Feeds</span>
            <div className={`p-2 rounded-xl ${stats.duplicates > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.duplicates}
              </span>
              {stats.duplicates > 0 && (
                <button 
                  onClick={() => resolveAllOfType('DUPLICATE_ERP_ENTRY')}
                  className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wide hover:bg-rose-100"
                >
                  Merge All
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cross-referencing SAP, Oracle, and Tally logs side-by-side.
            </p>
          </div>
        </div>

        {/* KPI 3: PAN-to-GSTIN alignment */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">PAN-to-GSTIN Mismatches</span>
            <div className={`p-2 rounded-xl ${stats.panErrors > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.panErrors}</span>
              {stats.panErrors > 0 && (
                <button 
                  onClick={() => resolveAllOfType('PAN_MISMATCH')}
                  className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide hover:bg-amber-100"
                >
                  Align All
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Validating ERP Tax Master profile against registered corporate PAN substring.
            </p>
          </div>
        </div>

        {/* KPI 4: Tax decimal rounding errors */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fractional Rounding Errors</span>
            <div className={`p-2 rounded-xl ${stats.roundingErrors > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <Calculator size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.roundingErrors}</span>
              {stats.roundingErrors > 0 && (
                <button 
                  onClick={() => resolveAllOfType('TAX_ROUNDING_ERROR')}
                  className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-wide hover:bg-blue-100"
                >
                  Round All
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Decimal deviations vs statutory GSTR mathematical integers.
            </p>
          </div>
        </div>

      </div>

      {/* Ingestion Settings Control */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-left" id="pipeline-config-settings">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles size={16} className="text-blue-600" />
              <span>Ingestion Pipeline Ruleset Controls</span>
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Configure background automated services executed during the invoice scrubbing pipeline. Disabling components excludes their processing from live validation runs.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-xl shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-slate-800 block">Auto-Tag Input Tax Credit (ITC)</span>
              <p className="text-[10px] text-slate-500 font-medium max-w-[240px]">
                Analyzes invoice data quality to dynamically determine GSTR-2B ITC eligibility.
              </p>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => handleToggleItcAutoTagging(!itcAutoTaggingEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-200 relative ${
                itcAutoTaggingEnabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              id="itc-auto-tag-toggle-btn"
              aria-label="Toggle Auto-Tag Input Tax Credit (ITC)"
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-all duration-200 ${
                  itcAutoTaggingEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Pipeline Progress Screen */}
      <AnimatePresence>
        {isScrubbing && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Database className="text-blue-600 animate-pulse" size={18} />
                <span className="text-xs font-black uppercase text-slate-900 tracking-widest font-mono">
                  Live Scrubbing Pipeline Execution Tracker
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Processing...</span>
              </div>
            </div>

            {/* Stages Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {[
                { step: 1, label: "Feed Ingestion" },
                { step: 2, label: "PAN Alignment" },
                { step: 3, label: "PIN Code Mapping" },
                { step: 4, label: "Deduplication" },
                { step: 5, label: "Decimal Rounding" }
              ].map((stage) => {
                const isActive = pipelineStep === stage.step;
                const isCompleted = pipelineStep > stage.step || pipelineStep === 6;
                return (
                  <div 
                    key={stage.step}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isActive 
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs scale-102 font-bold' 
                        : isCompleted 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-extrabold text-slate-500">STAGE 0{stage.step}</span>
                      {isCompleted ? (
                        <CheckCircle size={14} className="text-emerald-600" />
                      ) : isActive ? (
                        <RefreshCw size={12} className="text-blue-600 animate-spin" />
                      ) : (
                        <Clock size={12} className="text-slate-400" />
                      )}
                    </div>
                    <span className={`text-xs font-extrabold ${isActive ? 'text-blue-950' : ''}`}>{stage.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Terminal Log Output */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar text-slate-300 select-none">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold border-b border-slate-800 pb-1 mb-2">
                <Terminal size={12} />
                <span>LOGS OUTPUT</span>
              </div>
              {pipelineLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-slate-600 select-none">❯</span>
                  <span>{log}</span>
                </div>
              ))}
              <div className="h-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag, Drop and Manual Pastes Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Upload Hub / File Drag and Drop */}
        <div className="md:col-span-2">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all ${
              dragActive 
                ? 'border-blue-500 bg-blue-50/20' 
                : 'border-slate-300 bg-white hover:bg-slate-50/50 hover:border-slate-400'
            }`}
          >
            <div className="bg-slate-100 p-3.5 rounded-full mb-3 text-slate-600">
              <Upload size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Drag & Drop ERP Feeds Here</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Supports CSV exports from SAP, Tally, or Oracle systems. Direct upload automatically triggers pre-validation algorithms.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])}
                className="hidden" 
                accept=".csv,.txt"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Browse CSV File
              </button>
              
              <button 
                onClick={() => {
                  setFeeds(INITIAL_DEMO_FEED);
                  alert("Standard flawed ERP feed loaded (8 transactions with alignment, duplicate, PIN and float rounding errors). Click 'Execute Pipeline' above to scan.");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
              >
                Load Demo Feed
              </button>
            </div>
          </div>
        </div>

        {/* Manual JSON Paste Area */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-1.5">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Terminal size={15} className="text-slate-600" />
              Manual JSON ERP Paste
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Inject single raw ERP invoice objects for immediate testing and scrub trace.
            </p>
          </div>
          
          <div className="mt-3">
            {!showJsonInput ? (
              <button 
                onClick={() => {
                  setShowJsonInput(true);
                  setCustomJson(JSON.stringify({
                    invoiceNumber: "ERP-99120",
                    supplierName: "Custom Supplier Ltd",
                    supplierGstin: "27ABCDE1234F1Z5",
                    supplierPan: "WRONGPAN99",
                    supplierPinCode: "400033",
                    taxableValue: 10000.50,
                    cgstRecorded: 900.04,
                    sgstRecorded: 900.05,
                    taxRate: 18
                  }, null, 2));
                }}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Open JSON Editor</span>
              </button>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={customJson}
                  onChange={(e) => setCustomJson(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 bg-slate-900 text-slate-200 font-mono text-[10px] rounded-xl border border-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setShowJsonInput(false)}
                    className="px-3 py-1.5 text-slate-500 text-[10px] font-bold hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddCustomJson}
                    className="px-3.5 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-500"
                  >
                    Load & Inject
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main Tabs Audit Console */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        
        {/* Navigation Tabs Header */}
        <div className="bg-slate-50/50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Tabs Controllers */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: 'All Ingested Records', count: feeds.length },
              { id: 'pan', label: 'PAN Verification', count: stats.panErrors },
              { id: 'pin', label: 'PIN State Alignment', count: stats.pinErrors },
              { id: 'duplicates', label: 'Duplicate Matrix', count: stats.duplicates },
              { id: 'rounding', label: 'Rounding Controls', count: stats.roundingErrors }
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                    isSelected 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by invoice reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden w-64"
            />
          </div>

        </div>

        {/* Dynamic Audited Rows Layout */}
        <div className="overflow-x-auto">
          {filteredFeeds.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <HelpCircle className="mx-auto mb-3 text-slate-300" size={32} />
              <h3 className="text-sm font-bold text-slate-700">No discrepancies or items match filters</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {feeds.some(f => f.scrubbed) 
                  ? "All data quality checks passed or resolved. Run 'Execute Pipeline' if you've uploaded new sheets."
                  : "Feeds loaded in draft. Press 'Execute Pipeline' to trigger deep alignment checks."
                }
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/20 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="px-6 py-4">Source Feed</th>
                  <th className="px-6 py-4">Invoice Info</th>
                  <th className="px-6 py-4">Supplier Profile</th>
                  <th className="px-6 py-4">Buyer Profile</th>
                  <th className="px-6 py-4">Financials & Taxes</th>
                  <th className="px-6 py-4">Quality Status</th>
                  <th className="px-6 py-4 text-right">Scrubber Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {paginatedFeeds.map((feed) => {
                  const verified = feed.scrubbed && feed.alerts.length === 0;
                  const hasResolvedAll = feed.scrubbed && feed.alerts.every(a => a.resolved);
                  
                  return (
                    <tr 
                      key={feed.id} 
                      className={`text-xs transition-colors hover:bg-slate-50/50 ${
                        verified ? 'bg-emerald-50/5' : ''
                      }`}
                    >
                      {/* Source Feed column */}
                      <td className="px-6 py-4 font-mono font-bold text-[10px]">
                        <span className={`px-2.5 py-1 rounded-full border ${
                          feed.sourceFeed === 'SAP-ERP' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                          feed.sourceFeed === 'ORACLE-CLOUD' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                          feed.sourceFeed === 'TALLY-SYNC' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                          'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          {feed.sourceFeed}
                        </span>
                      </td>

                      {/* Invoice details */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div>
                            <p className="font-extrabold text-slate-900">{feed.invoiceNumber}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{feed.invoiceDate}</p>
                          </div>
                          {feed.scrubbed && (
                            <div>
                              {feed.itcStatus === 'ELIGIBLE' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-md">
                                  ITC Eligible
                                </span>
                              ) : feed.itcStatus === 'BLOCKED' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-md">
                                  ITC Blocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md">
                                  ITC Not Tagged
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Supplier particulars */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800 truncate max-w-[160px]" title={feed.supplierName}>
                          {feed.supplierName}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          GST: <span className="font-extrabold text-slate-700">{feed.supplierGstin}</span>
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          PAN: {feed.supplierPan} • PIN: {feed.supplierPinCode}
                        </p>
                      </td>

                      {/* Buyer particulars */}
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800 truncate max-w-[160px]">
                          {feed.buyerName}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          GST: <span className="font-extrabold text-slate-700">{feed.buyerGstin}</span>
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          PAN: {feed.buyerPan} • PIN: {feed.buyerPinCode}
                        </p>
                      </td>

                      {/* Tax details */}
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900">₹{feed.totalAmountRecorded.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Taxable: ₹{feed.taxableValue.toLocaleString('en-IN')} ({feed.taxRate}%)
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {feed.igstRecorded > 0 
                            ? `IGST: ₹${feed.igstRecorded}` 
                            : `CGST: ₹${feed.cgstRecorded} | SGST: ₹${feed.sgstRecorded}`}
                        </p>
                      </td>

                      {/* Quality indicators */}
                      <td className="px-6 py-4">
                        {!feed.scrubbed ? (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            Draft Feed
                          </span>
                        ) : verified || hasResolvedAll ? (
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <ShieldCheck size={11} className="text-emerald-500" />
                            <span>100% Quality Verified</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                              <AlertTriangle size={11} className="text-rose-500" />
                              <span>{feed.qualityScore}% Quality Score</span>
                            </span>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {feed.alerts.filter(a => !a.resolved).length} Unresolved Errors
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Scrubber resolutions actions */}
                      <td className="px-6 py-4 text-right">
                        {feed.scrubbed && feed.alerts.length > 0 && (
                          <div className="flex flex-col gap-1.5 items-end">
                            {feed.alerts.map((alert) => (
                              <div key={alert.id} className="flex items-center gap-2 justify-end bg-slate-50 border border-slate-100 p-2 rounded-xl max-w-sm text-left">
                                <div className="space-y-0.5">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded font-mono ${
                                    alert.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {alert.type.replace(/_/g, ' ')}
                                  </span>
                                  <p className="text-[10px] text-slate-600 font-medium leading-normal mt-1">
                                    {alert.message}
                                  </p>
                                  {alert.resolved ? (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-1">
                                      <Check size={11} strokeWidth={3} />
                                      <span>Auto-Corrected to statutory standard: {alert.suggestedValue}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <span className="text-[10px] text-slate-400">Apply Statutory Correction:</span>
                                      <button
                                        onClick={() => {
                                          let action: 'PAN' | 'PIN' | 'MERGE' | 'ROUND' = 'PAN';
                                          if (alert.type === 'PAN_MISMATCH') action = 'PAN';
                                          else if (alert.type === 'PIN_STATE_MISMATCH') action = 'PIN';
                                          else if (alert.type === 'TAX_ROUNDING_ERROR') action = 'ROUND';
                                          
                                          if (alert.type === 'DUPLICATE_ERP_ENTRY') {
                                            resolveDuplicatePair(feed.invoiceNumber);
                                          } else {
                                            resolveAlert(feed.id, alert.id, action);
                                          }
                                        }}
                                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[9px] rounded-md transition-colors"
                                      >
                                        Accept ({alert.suggestedValue})
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!feed.scrubbed && (
                          <span className="text-[11px] text-slate-400">Awaiting Ingestion Run</span>
                        )}
                        {feed.scrubbed && feed.alerts.length === 0 && (
                          <div className="flex items-center gap-1.5 justify-end text-emerald-600 font-extrabold">
                            <CheckCircle size={14} />
                            <span>Audit Cleared</span>
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls Bar */}
        {filteredFeeds.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Range and Rows Per Page selector */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
              <div>
                Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
                <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
                <span className="font-bold text-slate-800">{totalItems}</span> records
              </div>

              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <span className="text-slate-400 font-medium">Rows per page:</span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  {[5, 10, 20, 50].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
                        pageSize === size
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Page Navigation & Direct Jump */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {getPageNumbers().map((pageNum, idx) => {
                    if (pageNum === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold text-xs select-none">
                          ...
                        </span>
                      );
                    }
                    const isCurrent = safeCurrentPage === pageNum;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => setCurrentPage(Number(pageNum))}
                        className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>

              {/* Direct Page Jump Input */}
              {totalPages > 1 && (
                <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-xs text-slate-400 font-medium">Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={`${safeCurrentPage}`}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    className="w-12 h-7 px-1.5 text-center bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={!jumpPageInput.trim()}
                    className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Scrub History & Compliance Integrity Ledger Logs */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              Scrubber Compliance Audit Logs
            </h3>
            <p className="text-xs text-slate-500">
              Tamper-proof history tracing pipeline execution events, mismatch volumes, and auto-correct percentages.
            </p>
          </div>
          <span className="text-xs font-mono font-bold uppercase text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-full">
            256-Bit SHA Integrity Signed
          </span>
        </div>

        <div className="space-y-3.5">
          {scrubHistory.map((history) => (
            <div 
              key={history.id}
              className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-slate-50 hover:border-slate-300/80 transition-colors"
            >
              <div className="flex items-center gap-3.5 w-full sm:w-auto">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 shrink-0 shadow-2xs">
                  <Clock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Ingestion Stream Sync #{history.id}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Executed: {history.timestamp}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 sm:gap-12 w-full sm:w-auto justify-between sm:justify-end text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Scanned</span>
                  <span className="text-slate-900 font-extrabold">{history.totalInvoices} Invoices</span>
                </div>
                
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Discrepancies</span>
                  <span className="text-rose-600 font-extrabold">{history.errorsDetected} Detected</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Quality Index</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 line-through">{history.avgScoreBefore}%</span>
                    <ArrowRight size={10} className="text-slate-400" />
                    <span className="text-emerald-600 font-extrabold">{history.avgScoreAfter}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default DataQualityPage;
