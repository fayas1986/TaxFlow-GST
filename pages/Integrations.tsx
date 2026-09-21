import React, { useState, useEffect } from 'react';
import { FieldMappingConfiguration } from '../components/FieldMappingConfiguration';
import { ConnectionHealthMonitor } from '../components/ConnectionHealthMonitor';
import { OneClickErpImportModal } from '../components/OneClickErpImportModal';
import { erpIntegrationService, SupportedErpId } from '../services/erpIntegrationService';
import { 
  Check, ArrowRight, Loader2, Link as LinkIcon, AlertCircle, X, Key, Globe, Lock, 
  Server, ShieldCheck, Settings, Database, Calendar, History, Play, FileCheck, 
  RefreshCw, ChevronRight, AlertTriangle, ShieldAlert, Zap, Cpu, BarChart3, 
  Activity, Eye, Search, GitFork, ArrowUpRight, HelpCircle, Flame, Snowflake, Clock,
  Bell, Users, FileText, FileUp, Layers, CheckSquare, CheckCircle2, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  iconColor: string;
  initials: string;
  type: 'OAUTH' | 'API_KEY' | 'ON_PREM';
  lastSync?: string;
}

type TabType = 'CONNECTION' | 'SYNC' | 'MAPPING' | 'LOGS' | 'HEALTH';
type SectionType = 'CONNECTORS' | 'ARCHITECTURE';

// Trace mock interfaces
interface Span {
  id: string;
  service: string;
  operation: string;
  durationMs: number;
  offsetMs: number;
  status: 'SUCCESS' | 'ERROR';
  logs: string[];
}

interface DistributedTrace {
  id: string;
  name: string;
  timestamp: string;
  durationMs: number;
  spans: Span[];
}

const Integrations: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>('CONNECTORS');

  // Existing Integrations State
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: 'tally', name: 'Tally Prime', description: 'Sync ledgers and vouchers directly from Tally.', status: 'CONNECTED', iconColor: 'bg-green-600', initials: 'TP', type: 'ON_PREM', lastSync: '10 mins ago' },
    { id: 'zoho', name: 'Zoho Books', description: 'Real-time invoice push and pull via API.', status: 'DISCONNECTED', iconColor: 'bg-blue-600', initials: 'ZB', type: 'OAUTH' },
    { id: 'sap', name: 'SAP ERP', description: 'Enterprise grade integration for SAP ECC/S4 HANA.', status: 'DISCONNECTED', iconColor: 'bg-slate-700', initials: 'SAP', type: 'API_KEY' },
    { id: 'oracle', name: 'Oracle NetSuite', description: 'Automated reconciliation with Oracle financials.', status: 'DISCONNECTED', iconColor: 'bg-red-600', initials: 'OR', type: 'API_KEY' },
    { id: 'dynamics', name: 'MS Dynamics 365 Business Central', description: 'OData v4 REST & Azure AD OAuth 2.0 integration for Business Central Sales & Purchase Ledgers.', status: 'DISCONNECTED', iconColor: 'bg-indigo-600', initials: 'BC', type: 'OAUTH' },
    { id: 'dynamics_fo', name: 'MS Dynamics 365 Finance & Operations', description: 'Enterprise Data Entities, OData & DMF batch package integration for D365 F&O / AX.', status: 'DISCONNECTED', iconColor: 'bg-blue-700', initials: 'FO', type: 'OAUTH' },
    { id: 'qb', name: 'QuickBooks', description: 'Connect your QuickBooks Online account.', status: 'CONNECTED', iconColor: 'bg-green-500', initials: 'QB', type: 'OAUTH' },
    { id: 'xero', name: 'Xero Accounting', description: 'Automated invoice and tax rate sync via Xero OAuth 2.0 API.', status: 'CONNECTED', iconColor: 'bg-cyan-500', initials: 'XR', type: 'OAUTH' },
    { id: 'custom', name: 'Custom ERP API', description: 'Connect custom software using REST API keys.', status: 'DISCONNECTED', iconColor: 'bg-slate-500', initials: 'API', type: 'API_KEY' },
  ]);

  const [modalState, setModalState] = useState<{ isOpen: boolean; integrationId: string | null }>({
    isOpen: false,
    integrationId: null,
  });
  const [activeTab, setActiveTab] = useState<TabType>('CONNECTION');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Mock Settings State
  const [autoImport, setAutoImport] = useState(true);
  const [syncFreq, setSyncFreq] = useState('HOURLY');

  // MS Dynamics 365 Business Central State
  const [bcTenantId, setBcTenantId] = useState('contoso.onmicrosoft.com');
  const [bcEnvironment, setBcEnvironment] = useState<'Production' | 'Sandbox' | 'Custom'>('Production');
  const [bcCompany, setBcCompany] = useState('CRONUS India Ltd.');
  const [bcClientId, setBcClientId] = useState('36a87c12-89b4-4b8c-a110-384992ad81f1');
  const [bcClientSecret, setBcClientSecret] = useState('secret_bc_live_99a800d1');
  const [bcEnableWriteback, setBcEnableWriteback] = useState(true);
  const [bcIrnField, setBcIrnField] = useState('GST_IRN_No');
  const [bcQrField, setBcQrField] = useState('GST_QR_Code');
  const [bcEWayField, setBcEWayField] = useState('EWay_Bill_No');
  const [bcODataTesting, setBcODataTesting] = useState(false);
  const [bcODataTestResult, setBcODataTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    discoveredEntities: string[];
    companyGuid: string;
    sampleCount: number;
  } | null>(null);

  const [bcTaxGroupMap, setBcTaxGroupMap] = useState<Record<string, string>>({
    'GST-INTRA-18': '18% CGST+SGST (9%+9%)',
    'GST-INTER-18': '18% IGST',
    'GST-INTRA-12': '12% CGST+SGST (6%+6%)',
    'GST-INTER-12': '12% IGST',
    'GST-EXEMPT': 'Exempt / Zero Rated',
    'GST-EXPORT-LUT': 'Export Under LUT (0%)',
  });

  // MS Dynamics 365 Finance & Operations State
  const [foInstanceUrl, setFoInstanceUrl] = useState('https://contoso.operations.dynamics.com');
  const [foTenantId, setFoTenantId] = useState('contoso.onmicrosoft.com');
  const [foLegalEntity, setFoLegalEntity] = useState('IN01 (India Operations)');
  const [foClientId, setFoClientId] = useState('8a4d71bc-11e2-47f9-b881-992018274a12');
  const [foClientSecret, setFoClientSecret] = useState('secret_fo_live_88a910d2');
  const [foIntegrationMode, setFoIntegrationMode] = useState<'ODATA_REST' | 'DMF_BATCH'>('ODATA_REST');
  const [foEnableWriteback, setFoEnableWriteback] = useState(true);
  const [foIrnField, setFoIrnField] = useState('Tax_IRN_Num');
  const [foQrField, setFoQrField] = useState('Tax_QRCode_Base64');
  const [foEWayField, setFoEWayField] = useState('Tax_EWayBill_Num');
  const [foTesting, setFoTesting] = useState(false);
  const [foTestResult, setFoTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    discoveredEntities: string[];
    legalEntityGuid: string;
    sampleCount: number;
  } | null>(null);

  const [foTaxGroupMap, setFoTaxGroupMap] = useState<Record<string, string>>({
    'GST_18_INTRA': '18% CGST+SGST (9%+9%)',
    'GST_18_INTER': '18% IGST',
    'GST_12_INTRA': '12% CGST+SGST (6%+6%)',
    'GST_12_INTER': '12% IGST',
    'GST_EXEMPT': 'Exempt / Zero Rated',
    'GST_EXPORT': 'Export Under LUT (0%)',
  });



  // One-Click ERP Import Modal State
  const [isOneClickModalOpen, setIsOneClickModalOpen] = useState(false);
  const [selectedErpForImport, setSelectedErpForImport] = useState<SupportedErpId | null>(null);

  const handleOpenOneClickImport = (erpId?: string) => {
    const validErpId = erpIntegrationService.normalizeErpId(erpId || 'tally');
    setSelectedErpForImport(validErpId);
    setIsOneClickModalOpen(true);
  };

  // Zoho Books State
  const [zohoOrgId, setZohoOrgId] = useState('60019284712');
  const [zohoClientId, setZohoClientId] = useState('1000.8B97X120A47189KLM');
  const [zohoClientSecret, setZohoClientSecret] = useState('secret_zoho_live_9921b');
  const [zohoDc, setZohoDc] = useState<'in' | 'com' | 'eu'>('in');
  const [zohoTesting, setZohoTesting] = useState(false);
  const [zohoTestResult, setZohoTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    organizationName: string;
    currency: string;
  } | null>(null);

  const handleTestZohoConnection = () => {
    setZohoTesting(true);
    addLog(`ZOHO_BOOKS: Initiating OAuth 2.0 handshake with Zoho Books DC (.${zohoDc}) for Org ${zohoOrgId}...`);
    setTimeout(() => {
      setZohoTesting(false);
      setZohoTestResult({
        status: 'SUCCESS',
        latencyMs: 78,
        organizationName: 'TaxFlow Solutions India Pvt Ltd',
        currency: 'INR (₹)'
      });
      erpIntegrationService.saveCredentials('zoho', {
        clientId: zohoClientId,
        clientSecret: zohoClientSecret,
        organizationId: zohoOrgId,
        dataCenter: zohoDc
      });
      setIntegrations(prev => prev.map(i => i.id === 'zoho' ? { ...i, status: 'CONNECTED', lastSync: 'Just now' } : i));
      addLog(`ZOHO_BOOKS: OAuth 2.0 handshake successful! Connected to '${zohoOrgId}'. Latency: 78ms.`);
    }, 950);
  };

  // SAP ERP (ECC / S4 HANA) State
  const [sapHost, setSapHost] = useState('https://s4hana.taxflow-corp.internal:44300');
  const [sapClientNo, setSapClientNo] = useState('100');
  const [sapSystemId, setSapSystemId] = useState('PRD');
  const [sapAuthType, setSapAuthType] = useState<'OAUTH' | 'BASIC' | 'API_KEY'>('API_KEY');
  const [sapApiKey, setSapApiKey] = useState('sap_live_sec_884910ad');
  const [sapTesting, setSapTesting] = useState(false);
  const [sapTestResult, setSapTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    systemRelease: string;
    companyCodes: string[];
  } | null>(null);

  const handleTestSapConnection = () => {
    setSapTesting(true);
    addLog(`SAP_ERP: Connecting to SAP S/4HANA OData catalog at ${sapHost} (Client: ${sapClientNo}, SID: ${sapSystemId})...`);
    setTimeout(() => {
      setSapTesting(false);
      setSapTestResult({
        status: 'SUCCESS',
        latencyMs: 142,
        systemRelease: 'SAP S/4HANA 2023 FPS01 / NetWeaver 7.58',
        companyCodes: ['1000 (India HQ)', '1100 (West Plant)', '1200 (South DC)']
      });
      erpIntegrationService.saveCredentials('sap', {
        host: sapHost,
        clientNumber: sapClientNo,
        systemId: sapSystemId,
        apiKey: sapApiKey,
        authType: sapAuthType
      });
      setIntegrations(prev => prev.map(i => i.id === 'sap' ? { ...i, status: 'CONNECTED', lastSync: 'Just now' } : i));
      addLog(`SAP_ERP: RFC & OData V2 Catalog Verified! Discovered 3 Company Codes. Latency: 142ms.`);
    }, 1150);
  };

  // Oracle NetSuite State
  const [oracleAccountId, setOracleAccountId] = useState('TSTDRV1984210');
  const [oracleConsumerKey, setOracleConsumerKey] = useState('98d1a4e810a9c849102b');
  const [oracleConsumerSecret, setOracleConsumerSecret] = useState('sec_netsuite_consumer_881');
  const [oracleTokenId, setOracleTokenId] = useState('tok_netsuite_7721a');
  const [oracleTokenSecret, setOracleTokenSecret] = useState('sec_netsuite_tok_9918');
  const [oracleTesting, setOracleTesting] = useState(false);
  const [oracleTestResult, setOracleTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    subsidiary: string;
    suiteTaxEnabled: boolean;
  } | null>(null);

  const handleTestOracleConnection = () => {
    setOracleTesting(true);
    addLog(`ORACLE_NETSUITE: Verifying TBA (Token-Based Authentication HMAC-SHA256) for Account '${oracleAccountId}'...`);
    setTimeout(() => {
      setOracleTesting(false);
      setOracleTestResult({
        status: 'SUCCESS',
        latencyMs: 164,
        subsidiary: 'India Commercial Operations Ltd (ID: 4)',
        suiteTaxEnabled: true
      });
      erpIntegrationService.saveCredentials('oracle', {
        accountId: oracleAccountId,
        consumerKey: oracleConsumerKey,
        consumerSecret: oracleConsumerSecret,
        tokenId: oracleTokenId,
        tokenSecret: oracleTokenSecret
      });
      setIntegrations(prev => prev.map(i => i.id === 'oracle' ? { ...i, status: 'CONNECTED', lastSync: 'Just now' } : i));
      addLog(`ORACLE_NETSUITE: SuiteTalk REST Web Services & SuiteTax engine verified! Latency: 164ms.`);
    }, 1050);
  };

  // Xero State
  const [xeroTenantId, setXeroTenantId] = useState('');
  const [xeroSyncInvoices, setXeroSyncInvoices] = useState(true);
  const [xeroSyncTaxLiability, setXeroSyncTaxLiability] = useState(true);
  
  const handleTestXeroConnection = () => {
    addLog('XERO: Redirecting to Xero OAuth 2.0...');
    window.location.href = '/api/v1/xero/auth';
  };

  // QuickBooks Online State
  const [qbEnvironment, setQbEnvironment] = useState<'Production' | 'Sandbox'>('Sandbox');
  const [qbRealmId, setQbRealmId] = useState('');
  const [qbSyncInvoices, setQbSyncInvoices] = useState(true);
  const [qbSyncTaxLiability, setQbSyncTaxLiability] = useState(true);
  const [qbTesting, setQbTesting] = useState(false);
  const [qbTestResult, setQbTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    companyName: string;
  } | null>(null);

    const handleTestQbConnection = () => {
    addLog(`QUICKBOOKS: Redirecting to Intuit OAuth 2.0...`);
    window.location.href = `/api/v1/quickbooks/auth?environment=${qbEnvironment}`;
  };

  useEffect(() => {
    // Check if we just returned from QuickBooks OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('qb_connected') === 'true') {
      const realmId = urlParams.get('realmId');
      setQbRealmId(realmId || '');
      setQbTestResult({
        status: 'SUCCESS',
        latencyMs: 145,
        companyName: 'QuickBooks Company (' + realmId + ')'
      });
      setIntegrations(prev => prev.map(item => 
        item.id === 'qb' ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('xero_connected') === 'true') {
      setIntegrations(prev => prev.map(item => 
        item.id === 'xero' ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Tally Prime Bidirectional Canonical Integration State
  const [tallyHost, setTallyHost] = useState('http://localhost:9000');
  const [tallyCompany, setTallyCompany] = useState('M/S ACME INDIA PRIVATE LIMITED');
  const [tallyPort, setTallyPort] = useState('9000');
  const [tallySyncMode, setTallySyncMode] = useState<'BIDIRECTIONAL' | 'PULL_ONLY' | 'PUSH_ONLY'>('BIDIRECTIONAL');
  const [tallyEnableWriteback, setTallyEnableWriteback] = useState(true);
  const [tallyWritebackIrn, setTallyWritebackIrn] = useState(true);
  const [tallyWritebackQr, setTallyWritebackQr] = useState(true);
  const [tallyWritebackEWay, setTallyWritebackEWay] = useState(true);
  const [tallyAutoCreateLedgers, setTallyAutoCreateLedgers] = useState(true);
  const [tallyTesting, setTallyTesting] = useState(false);
  const [tallyTestResult, setTallyTestResult] = useState<{
    status: 'SUCCESS' | 'ERROR' | null;
    latencyMs: number;
    companyGstin: string;
    totalVouchers: number;
    totalLedgers: number;
    tallyRelease: string;
  } | null>({
    status: 'SUCCESS',
    latencyMs: 24,
    companyGstin: '27AAACN8301B1Z2',
    totalVouchers: 4820,
    totalLedgers: 284,
    tallyRelease: 'TallyPrime 4.1 (64-bit)'
  });

  const [tallySchemaMappings, setTallySchemaMappings] = useState<Record<string, string>>({
    'Invoice Number': 'voucher_number',
    'Invoice Date': 'doc_date',
    'Customer GSTIN': 'party_gstin_id',
    'Taxable Value': 'assessable_amt',
    'Tax Amount': 'total_tax_amt',
    'CGST Amount': 'cgst_amt',
    'SGST Amount': 'sgst_amt',
    'IGST Amount': 'igst_amt',
    'Place of Supply': 'state_code',
    'HSN/SAC Code': 'hsn_sac_code',
    'Party Ledger Name': 'party_ledger_name',
    'Voucher Type': 'voucher_type_name',
    'Reverse Charge': 'reverse_charge_applicable'
  });

  const [tallyTaxLedgerMap, setTallyTaxLedgerMap] = useState<Record<string, string>>({
    'Output CGST @ 9%': '9% CGST (18% Intra-State)',
    'Output SGST @ 9%': '9% SGST (18% Intra-State)',
    'Output IGST @ 18%': '18% IGST (Inter-State)',
    'Output CGST @ 6%': '6% CGST (12% Intra-State)',
    'Output SGST @ 6%': '6% SGST (12% Intra-State)',
    'Output IGST @ 12%': '12% IGST (Inter-State)',
    'Input CGST @ 9% (ITC)': '9% Input CGST',
    'Input SGST @ 9% (ITC)': '9% Input SGST',
    'Input IGST @ 18% (ITC)': '18% Input IGST',
  });

  const handleTestTallyConnection = () => {
    setTallyTesting(true);
    addLog(`TALLY_PRIME: Connecting to Tally XML HTTP Server on ${tallyHost} for '${tallyCompany}'...`);
    
    setTimeout(() => {
      setTallyTesting(false);
      setTallyTestResult({
        status: 'SUCCESS',
        latencyMs: 22,
        companyGstin: '27AAACN8301B1Z2',
        totalVouchers: 5120,
        totalLedgers: 312,
        tallyRelease: 'TallyPrime Release 4.1 (64-bit Build)'
      });
      addLog(`TALLY_PRIME: XML Handshake Verified! Discovered 312 Party Ledgers & 5,120 Vouchers in '${tallyCompany}'. Latency: 22ms.`);
    }, 1100);
  };

  const activeIntegration = integrations.find(i => i.id === modalState.integrationId);

  const handleTestBcODataConnection = () => {
    setBcODataTesting(true);
    addLog(`BUSINESS_CENTRAL: Testing OData v4 REST Endpoint https://api.businesscentral.dynamics.com/v2.0/${bcTenantId}/${bcEnvironment}/api/v2.0...`);
    
    setTimeout(() => {
      setBcODataTesting(false);
      setBcODataTestResult({
        status: 'SUCCESS',
        latencyMs: 118,
        discoveredEntities: ['salesInvoices', 'purchaseInvoices', 'customers', 'vendors', 'salesCreditMemos', 'salesOrderLines'],
        companyGuid: 'a8e932b1-0941-4c12-89f0-21019d882a10',
        sampleCount: 3820
      });
      addLog(`BUSINESS_CENTRAL: Connection Verified! Discovered 6 OData v4 web service entities in '${bcCompany}'. Latency: 118ms.`);
    }, 1200);
  };

  const handleTestFoConnection = () => {
    setFoTesting(true);
    addLog(`DYNAMICS_FO: Connecting to Enterprise Instance ${foInstanceUrl} for Legal Entity '${foLegalEntity}'...`);
    
    setTimeout(() => {
      setFoTesting(false);
      setFoTestResult({
        status: 'SUCCESS',
        latencyMs: 142,
        discoveredEntities: ['SalesInvoiceHeadersV2', 'SalesInvoiceLinesV2', 'VendInvoiceInfoSubLineEntities', 'TaxGroupEntities', 'TaxItemGroupEntities', 'CustomerV3Entities'],
        legalEntityGuid: 'IN01-D365-LEGAL-ENTITY-902',
        sampleCount: 14820
      });
      addLog(`DYNAMICS_FO: OAuth 2.0 Authenticated! Discovered 6 Enterprise Data Entities in '${foLegalEntity}'. Latency: 142ms.`);
    }, 1300);
  };

  // Architecture Simulation States
  const [circuitBreaker, setCircuitBreaker] = useState<'CLOSED' | 'OPEN' | 'HALF_OPEN'>('CLOSED');
  const [dlqCount, setDlqCount] = useState<number>(4);
  const [isReprocessingDlq, setIsReprocessingDlq] = useState(false);
  const [idempotencyEnforced, setIdempotencyEnforced] = useState(true);

  const [tenantType, setTenantType] = useState<'SMB' | 'ENTERPRISE_A' | 'ENTERPRISE_B'>('SMB');
  const [hotStorageGb, setHotStorageGb] = useState<number>(42.5);
  const [coldStorageGb, setColdStorageGb] = useState<number>(812.4);
  const [isArchiving, setIsArchiving] = useState(false);

  const [kafkaLoad, setKafkaLoad] = useState<number>(1250); // Invoices/sec
  const [activePods, setActivePods] = useState<number>(3);
  const [spotInstanceRatio, setSpotInstanceRatio] = useState<number>(85); // % spot instances

  const [mtlsEnforced, setMtlsEnforced] = useState(true);
  const [vaultKeyAgeDays, setVaultKeyAgeDays] = useState<number>(76);
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);

  const [selectedTraceId, setSelectedTraceId] = useState<string>('tr-8201a');
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[SYSTEM] Architecture Dashboard initialized successfully.",
    "[MTLS] Service mesh secure channels validated.",
    "[DB] Sharding routing metadata loaded into Redis memory layer."
  ]);

  // Advanced Architecture Hub sub-tab state
  const [activeArchSubTab, setActiveArchSubTab] = useState<'CLUSTER' | 'RULES' | 'NOTIFICATIONS' | 'WORKFLOWS' | 'DOCUMENTS' | 'TRACES'>('CLUSTER');

  // 1. GST Rule Engine & Master Data Simulator States
  const [ruleVoucherType, setRuleVoucherType] = useState<'B2B' | 'B2C' | 'EXPORT' | 'RCM'>('B2B');
  const [rulePOS, setRulePOS] = useState<string>('Maharashtra');
  const [ruleClientState, setRuleClientState] = useState<string>('Maharashtra');
  const [ruleHSN, setRuleHSN] = useState<string>('8517');
  const [ruleValue, setRuleValue] = useState<number>(150000);
  const [ruleIsCompiling, setRuleIsCompiling] = useState<boolean>(false);
  const [ruleResult, setRuleResult] = useState<{
    baseTaxRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    totalTax: number;
    rulesetId: string;
    effectiveDate: string;
    priority: string;
    exemptionApplied: string | null;
  } | null>(null);

  // Master Data HSN search state
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>('');

  // 2. Workflows Maker-Checker Simulator States
  const [makerCheckerEnabled, setMakerCheckerEnabled] = useState<boolean>(true);
  const [approvalThreshold, setApprovalThreshold] = useState<number>(500000);
  const [checkerLevel, setCheckerLevel] = useState<string>('CFO_PARTNER');
  const [wfInvoiceValue, setWfInvoiceValue] = useState<number>(750000);
  const [wfStep, setWfStep] = useState<number>(0); // 0: Idle, 1: Created, 2: Auto Risk Check, 3: Pending Approval, 4: Sealed & Committed
  const [wfRiskScore, setWfRiskScore] = useState<number>(0);
  const [wfRiskStatus, setWfRiskStatus] = useState<string>('PENDING');

  // 3. Notification Service & Webhook Simulator States
  const [webhookUrl, setWebhookUrl] = useState<string>('https://erp.mycompany.in/webhooks/gst-gateway');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['InvoiceCreated', 'GSTFiled']);
  const [webhookTestSending, setWebhookTestSending] = useState<boolean>(false);
  const [webhookSuccess, setWebhookSuccess] = useState<boolean | null>(null);
  const [webhookTestHistory, setWebhookTestHistory] = useState<Array<{ id: string; event: string; status: number; latency: number; time: string }>>([
    { id: 'wh-001', event: 'GSTFiled', status: 200, latency: 42, time: '2 hours ago' },
    { id: 'wh-002', event: 'InvoiceCreated', status: 202, latency: 58, time: '4 hours ago' }
  ]);

  // 4. Document OCR & DSC Storage Pipeline States
  const [docOcrStep, setDocOcrStep] = useState<number>(0); // 0: Idle, 1: Virus Scan, 2: DSC Verify, 3: OCR Engine, 4: Ingested
  const [docOcrFileName, setDocOcrFileName] = useState<string>('vendor_invoice_8820a.pdf');
  const [docOcrConfidence, setDocOcrConfidence] = useState<number>(0);
  const [extractedOcrData, setExtractedOcrData] = useState<any>(null);
  const [cloudStorageFiles, setCloudStorageFiles] = useState<Array<{ name: string; size: string; status: string; date: string }>>([
    { name: 'gstr1_q1_final_signed.pdf', size: '2.4 MB', status: 'Sealed & Digitally Signed', date: 'Jul 20, 2026' },
    { name: 'purchase_journal_june.xlsx', size: '1.8 MB', status: 'Archived Cold', date: 'Jul 15, 2026' },
    { name: 'vendor_tally_vouchers_v3.xml', size: '420 KB', status: 'Secured Hot', date: 'Jul 24, 2026' }
  ]);

  // Interactive Simulation Handlers
  const handleCompileRules = () => {
    if (ruleIsCompiling) return;
    setRuleIsCompiling(true);
    addLog(`COMPILER: Starting rule evaluation for HSN ${ruleHSN}, POS: ${rulePOS}...`);
    
    setTimeout(() => {
      let rate = 18;
      let isExempt = false;
      let clause = null;
      let isCess = false;
      let cessRate = 0;
      
      if (ruleHSN === '0101') {
        rate = 0;
        isExempt = true;
        clause = 'Exempted under Notification No. 2/2017-Central Tax (Rate)';
      } else if (ruleHSN === '5007') {
        rate = 5;
      } else if (ruleHSN === '2202') {
        rate = 28;
        isCess = true;
        cessRate = 12;
      }
      
      const isIntra = rulePOS === ruleClientState;
      let cgst = 0, sgst = 0, igst = 0, cess = 0;
      
      if (ruleVoucherType === 'EXPORT') {
        igst = 0;
        cgst = 0;
        sgst = 0;
        isExempt = true;
        clause = 'Zero-rated under Section 16 of IGST Act (Export under LUT)';
      } else if (isIntra) {
        cgst = (ruleValue * (rate / 2)) / 100;
        sgst = (ruleValue * (rate / 2)) / 100;
      } else {
        igst = (ruleValue * rate) / 100;
      }
      
      if (isCess) {
        cess = (ruleValue * cessRate) / 100;
      }
      
      setRuleResult({
        baseTaxRate: rate,
        cgst,
        sgst,
        igst,
        cess,
        totalTax: cgst + sgst + igst + cess,
        rulesetId: `RULESET-v2.6-SEC${ruleVoucherType === 'RCM' ? '9_3' : '15'}`,
        effectiveDate: '01-Apr-2026',
        priority: 'Strict compliance',
        exemptionApplied: clause
      });
      
      setRuleIsCompiling(false);
      addLog(`COMPILER: Compiled rules successfully. Computed Tax: ₹${(cgst + sgst + igst + cess).toLocaleString()}.`);
    }, 1000);
  };

  const handleTriggerWebhook = () => {
    if (webhookTestSending) return;
    setWebhookTestSending(true);
    addLog(`WEBHOOK_SENTRY: Dispatching simulated webhook event 'GSTFiled' to ${webhookUrl}...`);
    
    setTimeout(() => {
      const success = Math.random() > 0.15;
      setWebhookSuccess(success);
      setWebhookTestSending(false);
      
      const newJob = {
        id: `wh-${Math.floor(100 + Math.random() * 900)}`,
        event: 'GSTFiled',
        status: success ? 200 : 504,
        latency: Math.floor(30 + Math.random() * 80),
        time: 'Just now'
      };
      
      setWebhookTestHistory(prev => [newJob, ...prev]);
      
      if (success) {
        addLog(`WEBHOOK_SENTRY: Delivery succeeded. Client system responded with 200 OK in ${newJob.latency}ms.`);
      } else {
        addLog(`WEBHOOK_SENTRY: Delivery failed. Client endpoint timed out (504 Gateway Timeout).`);
      }
    }, 1200);
  };

  const handleWorkflowInit = () => {
    setWfStep(1);
    setWfRiskStatus('PENDING');
    addLog(`WORKFLOW: Invoice Maker created record value ₹${wfInvoiceValue.toLocaleString()}. Triggering pipeline.`);
    
    setTimeout(() => {
      setWfStep(2);
      addLog(`WORKFLOW: Running automated micro-compliance check on invoice...`);
      
      setTimeout(() => {
        const isHighRisk = wfInvoiceValue > 1500000;
        const score = isHighRisk ? Math.floor(65 + Math.random() * 15) : Math.floor(92 + Math.random() * 7);
        const status = score < 80 ? 'WARNING' : 'LOW_RISK';
        
        setWfStep(3);
        setWfRiskScore(score);
        setWfRiskStatus(status);
        addLog(`WORKFLOW: Auto audit score compiled: ${score}%. Status: ${status === 'WARNING' ? 'HIGH RISK' : 'LOW RISK'}.`);
        
        const needsChecker = makerCheckerEnabled && (wfInvoiceValue >= approvalThreshold);
        if (!needsChecker) {
          setTimeout(() => {
            setWfStep(4);
            addLog(`WORKFLOW: Under threshold limit of ₹${approvalThreshold.toLocaleString()}. Auto-Approved & Sealed.`);
          }, 1000);
        } else {
          addLog(`WORKFLOW: Locked! Value ₹${wfInvoiceValue.toLocaleString()} is >= threshold. Pending checker approval.`);
        }
      }, 1200);
    }, 800);
  };

  const handleWorkflowCheckerApprove = () => {
    if (wfStep !== 3) return;
    setWfStep(4);
    addLog(`WORKFLOW: Checker role approved transaction. Signed cryptographically by authorized Auditor.`);
  };

  const handleWorkflowReset = () => {
    setWfStep(0);
    setWfRiskStatus('PENDING');
    addLog(`WORKFLOW: Simulation reset to idle state.`);
  };

  const handleOcrDocumentIngest = () => {
    if (docOcrStep > 0 && docOcrStep < 4) return;
    setDocOcrStep(1);
    addLog(`OCR_SERVICE: Ingesting file '${docOcrFileName}'...`);
    
    setTimeout(() => {
      setDocOcrStep(2);
      addLog(`OCR_SERVICE: ClamAV sandbox scan complete. No malware detected. Processing DSC...`);
      
      setTimeout(() => {
        setDocOcrStep(3);
        addLog(`OCR_SERVICE: DSC cryptographic certificate signature: VALID.`);
        
        setTimeout(() => {
          setDocOcrStep(4);
          const confidence = parseFloat((98.5 + Math.random() * 1.4).toFixed(2));
          setDocOcrConfidence(confidence);
          
          const mockData = {
            extracted_vendor_gstin: '27AAACN8301B1Z2',
            extracted_buyer_gstin: '27AABCT2049H1Z3',
            extracted_hsn: '8517',
            subtotal_extracted: parseFloat((ruleValue * 0.84).toFixed(2)),
            cgst_extracted: parseFloat((ruleValue * 0.08).toFixed(2)),
            sgst_extracted: parseFloat((ruleValue * 0.08).toFixed(2)),
            ocr_processing_confidence: `${confidence}%`
          };
          
          setExtractedOcrData(mockData);
          
          setCloudStorageFiles(prev => [
            {
              name: docOcrFileName,
              size: '1.2 MB',
              status: 'Scanned & Authenticated',
              date: 'Just now'
            },
            ...prev
          ]);
          
          addLog(`OCR_SERVICE: Processing complete with ${confidence}% OCR confidence score. Extracted invoice JSON.`);
        }, 1200);
      }, 1000);
    }, 800);
  };

  // Handle auto-scaling calculations based on Kafka Load
  useEffect(() => {
    // scale background pods linearly based on load
    const calculatedPods = Math.ceil(kafkaLoad / 400);
    setActivePods(calculatedPods === 0 ? 0 : Math.min(calculatedPods, 50));
  }, [kafkaLoad]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 4)]);
  };

  const handleCircuitBreakerToggle = () => {
    if (circuitBreaker === 'CLOSED') {
      setCircuitBreaker('OPEN');
      addLog("CIRCUIT BREAKER: Tripped to OPEN. Bypassing active GSTN gateways, spooling bulk filings to local queues.");
    } else if (circuitBreaker === 'OPEN') {
      setCircuitBreaker('HALF_OPEN');
      addLog("CIRCUIT BREAKER: Moved to HALF-OPEN. Running safety probes against GSTN gateway APIs.");
    } else {
      setCircuitBreaker('CLOSED');
      addLog("CIRCUIT BREAKER: Circuit CLOSED. Direct high-speed API connections to GSTR engines fully restored.");
    }
  };

  const handleReprocessDlq = () => {
    if (dlqCount === 0 || isReprocessingDlq) return;
    setIsReprocessingDlq(true);
    addLog(`DLQ WORKER: Spooling ${dlqCount} failed messages from dead letter queues...`);
    
    setTimeout(() => {
      addLog(`DLQ WORKER: Idempotent scheduler successfully reprocessed ${dlqCount} invoices with SHA-256 validation.`);
      setDlqCount(0);
      setIsReprocessingDlq(false);
    }, 2000);
  };

  const handleArchivalPipeline = () => {
    if (isArchiving) return;
    setIsArchiving(true);
    addLog("FINOPS PIPELINE: Initiating scheduled data archival (>1 year old records)...");
    
    setTimeout(() => {
      const movedGb = Math.floor(15 + Math.random() * 10);
      setHotStorageGb(prev => Math.max(10, parseFloat((prev - movedGb * 0.1).toFixed(2))));
      setColdStorageGb(prev => parseFloat((prev + movedGb).toFixed(2)));
      setIsArchiving(false);
      addLog(`FINOPS PIPELINE: Completed. Shifted transaction logs to cold storage. DB optimization complete.`);
    }, 2500);
  };

  const handleRotateSecrets = () => {
    if (isRotatingKeys) return;
    setIsRotatingKeys(true);
    addLog("SECURITY: Contacting Vault API to trigger cryptographic key rotation...");
    
    setTimeout(() => {
      setVaultKeyAgeDays(0);
      setIsRotatingKeys(false);
      addLog("SECURITY: Symmetric envelope keys successfully rotated. Decryption caches flushed.");
    }, 1800);
  };

  const mockTraces: DistributedTrace[] = [
    {
      id: 'tr-8201a',
      name: 'Bulk GSTR-1 File Pipeline (Enterprise)',
      timestamp: 'Just now',
      durationMs: 414,
      spans: [
        { id: 's1', service: 'api-gateway', operation: 'POST /api/v1/filings/gstr1', durationMs: 414, offsetMs: 0, status: 'SUCCESS', logs: ['Route parsed', 'Tenant context resolved', 'Authorized token'] },
        { id: 's2', service: 'core-invoicing-service', operation: 'Database transaction lock', durationMs: 145, offsetMs: 12, status: 'SUCCESS', logs: ['Acquired lock', 'Fetched 450 ledger vouchers', 'Mapped GSTR data models'] },
        { id: 's3', service: 'kafka-broker', operation: 'Queue message publish', durationMs: 12, offsetMs: 160, status: 'SUCCESS', logs: ['Topic partition: 2', 'Offset: 928401'] },
        { id: 's4', service: 'compliance-audit-engine', operation: 'SHA-256 Idempotency Check', durationMs: 52, offsetMs: 175, status: 'SUCCESS', logs: ['Document signature verified', 'No duplicates detected'] },
        { id: 's5', service: 'gstn-filing-service-client', operation: 'REST POST /gstn-gateway/file', durationMs: 180, offsetMs: 230, status: 'SUCCESS', logs: ['mTLS connection established', 'Payload encrypted', 'Received ACK: GSTN-200'] },
      ]
    },
    {
      id: 'tr-4402x',
      name: 'Real-time Vendor Upload Matching',
      timestamp: '2 mins ago',
      durationMs: 185,
      spans: [
        { id: 's11', service: 'api-gateway', operation: 'POST /api/vendor-upload/submit', durationMs: 185, offsetMs: 0, status: 'SUCCESS', logs: ['Authenticated vendor portal token'] },
        { id: 's12', service: 'core-invoicing-service', operation: 'Create temp voucher record', durationMs: 45, offsetMs: 8, status: 'SUCCESS', logs: ['Temp record saved'] },
        { id: 's13', service: 'compliance-audit-engine', operation: 'Validate GSTIN active', durationMs: 60, offsetMs: 55, status: 'SUCCESS', logs: ['Queried local GSTIN directory', 'GSTIN Status: ACTIVE'] },
        { id: 's14', service: 'kafka-broker', operation: 'Trigger matching webhook', durationMs: 10, offsetMs: 120, status: 'SUCCESS', logs: ['Payload pushed to client-stream'] },
      ]
    },
    {
      id: 'tr-9082f',
      name: 'ERP Ledgers Incremental Sync',
      timestamp: '5 mins ago',
      durationMs: 1250,
      spans: [
        { id: 's21', service: 'api-gateway', operation: 'POST /api/integrations/sync', durationMs: 1250, offsetMs: 0, status: 'SUCCESS', logs: ['API-Key authentication verified'] },
        { id: 's22', service: 'tally-onprem-connector', operation: 'TCP Pull XML Ledgers', durationMs: 1150, offsetMs: 32, status: 'ERROR', logs: ['Timeout threshold breached: 1000ms', 'Attempting retry #1', 'Succeeded on retry #1'] },
        { id: 's23', service: 'core-invoicing-service', operation: 'Bulk DB Save Vouchers', durationMs: 65, offsetMs: 1180, status: 'SUCCESS', logs: ['Parsed 126 records', 'Saved with bulk batch queries'] },
      ]
    }
  ];

  const activeTrace = mockTraces.find(t => t.id === selectedTraceId) || mockTraces[0];

  // Original ERP Integration functions
  const openConnectModal = (id: string, tab: TabType = 'CONNECTION') => {
    setModalState({ isOpen: true, integrationId: id });
    setActiveTab(tab);
  };

  const closeConnectModal = () => {
    setModalState({ isOpen: false, integrationId: null });
    setIsConnecting(false);
    setIsSyncing(false);
  };

  const handleDisconnect = (id: string) => {
    if (window.confirm('Are you sure you want to disconnect? Syncing will stop immediately.')) {
      setIntegrations(prev => prev.map(item => 
        item.id === id ? { ...item, status: 'DISCONNECTED' } : item
      ));
    }
  };


  const handleManualSync = () => {
    setIsSyncing(true);
    
    if (activeIntegration?.id === 'qb') {
      addLog('QUICKBOOKS: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('QUICKBOOKS: Pulling 25 new commercial invoices from QBO...'), 500);
      setTimeout(() => addLog('QUICKBOOKS: Pushing Tax Liability Journal Entry for August...'), 1200);
    } else if (activeIntegration?.id === 'xero') {
      addLog('XERO: Starting manual sync for Invoices & Tax Liability.');
      setTimeout(() => addLog('XERO: Pulling 32 new commercial invoices from Xero API...'), 500);
      setTimeout(() => addLog('XERO: Pushing Manual Journal Entry for August Tax Liability...'), 1200);
    } else if (activeIntegration?.id === 'tally') {
      addLog('TALLY_PRIME: Starting manual sync over ODBC.');
    } else if (activeIntegration?.id === 'dynamics') {
      addLog('DYNAMICS_BC: Starting manual sync over OData v4 REST.');
    } else if (activeIntegration?.id === 'dynamics_fo') {
      addLog('DYNAMICS_FO: Starting manual sync over DMF batch.');
    } else {
      addLog('Starting manual sync.');
    }
    
    setTimeout(() => {
        setIsSyncing(false);
        if (activeIntegration?.id === 'qb') {
          addLog('QUICKBOOKS: Sync Completed successfully.');
        } else if (activeIntegration?.id === 'xero') {
          addLog('XERO: Sync Completed successfully.');
        } else {
          addLog('Sync Completed successfully.');
        }
        setIntegrations(prev => prev.map(item => 
            item.id === activeIntegration?.id ? { ...item, lastSync: 'Just now' } : item
        ));
    }, 2000);
  };

  const handleSubmitConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntegration) return;
    
    setIsConnecting(true);
    setTimeout(() => {
      setIntegrations(prev => prev.map(item => 
        item.id === activeIntegration.id ? { ...item, status: 'CONNECTED', lastSync: 'Just now' } : item
      ));
      setIsConnecting(false);
      
      if (activeIntegration.status !== 'CONNECTED') {
          setActiveTab('SYNC');
      } else {
          closeConnectModal();
      }
    }, 1500);
  };

  function renderConnectionTab() {
    if (!activeIntegration) return null;

    if (activeIntegration.id === 'zoho') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Zoho Books OAuth 2.0 Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects to Zoho Books India/Global REST API to sync outward invoices, vendor bills, contacts, and tax rates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Zoho Organization ID</label>
              <input type="text" value={zohoOrgId} onChange={e => setZohoOrgId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Data Center</label>
              <select value={zohoDc} onChange={e => setZohoDc(e.target.value as any)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold">
                <option value="in">India (.zoho.in)</option>
                <option value="com">US & Global (.zoho.com)</option>
                <option value="eu">Europe (.zoho.eu)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Client ID</label>
              <input type="text" value={zohoClientId} onChange={e => setZohoClientId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Client Secret</label>
              <input type="password" value={zohoClientSecret} onChange={e => setZohoClientSecret(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestZohoConnection}
              disabled={zohoTesting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {zohoTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {zohoTesting ? 'Authenticating...' : 'Test OAuth 2.0 Connection'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenOneClickImport('zoho')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap size={14} />
              1-Click Import Ledgers
            </button>
          </div>

          {zohoTestResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
              <span className="font-extrabold text-emerald-900 flex items-center gap-1.5"><Check size={14} /> Connected to {zohoTestResult.organizationName}</span>
              <p className="text-[11px] text-emerald-700 font-medium">Currency: {zohoTestResult.currency} • Latency: {zohoTestResult.latencyMs}ms</p>
            </div>
          )}
        </div>
      );
    }

    if (activeIntegration.id === 'sap') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-slate-800 text-white rounded-xl flex items-start gap-3">
            <div className="p-2 bg-slate-700 text-slate-200 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-xs">SAP S/4HANA / ECC OData & Netweaver Gateway</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Connects to SAP Gateway (API_BILLING_DOCUMENT_SRV & API_SUPPLIERINVOICE_PROCESS_SRV) with RFC & OData V2/V4.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SAP Host URL</label>
              <input type="text" value={sapHost} onChange={e => setSapHost(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Client No.</label>
              <input type="text" value={sapClientNo} onChange={e => setSapClientNo(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">System ID (SID)</label>
              <input type="text" value={sapSystemId} onChange={e => setSapSystemId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">API Key / Token</label>
              <input type="password" value={sapApiKey} onChange={e => setSapApiKey(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestSapConnection}
              disabled={sapTesting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {sapTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {sapTesting ? 'Validating OData Catalog...' : 'Test SAP Connection'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenOneClickImport('sap')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap size={14} />
              1-Click Import Ledgers
            </button>
          </div>

          {sapTestResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
              <span className="font-extrabold text-emerald-900 flex items-center gap-1.5"><Check size={14} /> SAP Release: {sapTestResult.systemRelease}</span>
              <p className="text-[11px] text-emerald-700 font-medium">Company Codes: {sapTestResult.companyCodes.join(', ')} • Latency: {sapTestResult.latencyMs}ms</p>
            </div>
          )}
        </div>
      );
    }

    if (activeIntegration.id === 'oracle') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-red-50/80 border border-red-200 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Oracle NetSuite SuiteTalk & SuiteTax API</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Token-Based Authentication (TBA HMAC-SHA256) to access Sales Invoices, Vendor Bills, and SuiteTax GST engines.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Account ID</label>
              <input type="text" value={oracleAccountId} onChange={e => setOracleAccountId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Consumer Key</label>
              <input type="text" value={oracleConsumerKey} onChange={e => setOracleConsumerKey(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Consumer Secret</label>
              <input type="password" value={oracleConsumerSecret} onChange={e => setOracleConsumerSecret(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Token ID</label>
              <input type="text" value={oracleTokenId} onChange={e => setOracleTokenId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Token Secret</label>
              <input type="password" value={oracleTokenSecret} onChange={e => setOracleTokenSecret(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestOracleConnection}
              disabled={oracleTesting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {oracleTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {oracleTesting ? 'Verifying TBA Signatures...' : 'Test NetSuite SuiteTalk Connection'}
            </button>
            <button
              type="button"
              onClick={() => handleOpenOneClickImport('oracle')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap size={14} />
              1-Click Import Ledgers
            </button>
          </div>

          {oracleTestResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
              <span className="font-extrabold text-emerald-900 flex items-center gap-1.5"><Check size={14} /> Subsidiary: {oracleTestResult.subsidiary}</span>
              <p className="text-[11px] text-emerald-700 font-medium">SuiteTax Engine: Enabled • Latency: {oracleTestResult.latencyMs}ms</p>
            </div>
          )}
        </div>
      );
    }

    
    
    if (activeIntegration.id === 'xero') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-cyan-50/70 border border-cyan-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-cyan-100 text-cyan-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Xero OAuth 2.0 Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects to Xero to sync invoices and chart of accounts mapping for TaxFlow liability.
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Connection Status</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Not authenticated</p>
              </div>
              <button 
                type="button"
                onClick={handleTestXeroConnection}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Connect to Xero
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration.id === 'qb') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-green-50/70 border border-green-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Intuit QuickBooks Online Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Connects via Intuit Developer OAuth 2.0 to securely sync Invoices, Expenses, and General Ledger (Tax Liability) reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} /> Environment
              </label>
              <select 
                value={qbEnvironment} 
                onChange={(e) => setQbEnvironment(e.target.value as any)} 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-green-500 focus:outline-none"
              >
                <option value="Production">Production</option>
                <option value="Sandbox">Sandbox</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Realm ID (Company ID)
              </label>
              <input 
                value={qbRealmId} 
                onChange={(e) => setQbRealmId(e.target.value)} 
                placeholder="e.g. 193514... (Optional)" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-green-500 focus:outline-none" 
              />
            </div>
          </div>

          {/* Test Connection Button / Status */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Connection Status</p>
                {qbTestResult ? (
                  <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={12} /> Connected to {qbTestResult.companyName} ({qbTestResult.latencyMs}ms)
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Not authenticated</p>
                )}
              </div>
              <button 
                type="button"
                onClick={handleTestQbConnection}
                disabled={qbTesting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2"
              >
                {qbTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Authenticate with Intuit
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration.id === 'dynamics') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Microsoft Dynamics 365 Business Central Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Authenticates via Azure AD App Registration (OAuth 2.0 Client Credentials flow) and connects directly to Business Central OData v4 REST API web services.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} /> Tenant ID / Azure Domain
              </label>
              <input 
                value={bcTenantId} 
                onChange={(e) => setBcTenantId(e.target.value)} 
                placeholder="contoso.onmicrosoft.com or Tenant GUID" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Layers size={12} /> Environment Name
              </label>
              <select 
                value={bcEnvironment} 
                onChange={(e) => setBcEnvironment(e.target.value as any)} 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none"
              >
                <option value="Production">Production</option>
                <option value="Sandbox">Sandbox</option>
                <option value="Custom">Custom On-Prem Endpoint</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Company Name / ID
              </label>
              <input 
                value={bcCompany} 
                onChange={(e) => setBcCompany(e.target.value)} 
                placeholder="e.g. CRONUS India Ltd." 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Key size={12} /> Azure AD Client ID
              </label>
              <input 
                value={bcClientId} 
                onChange={(e) => setBcClientId(e.target.value)} 
                placeholder="App Registration Application ID" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Lock size={12} /> Azure AD Client Secret
            </label>
            <input 
              type="password"
              value={bcClientSecret} 
              onChange={(e) => setBcClientSecret(e.target.value)} 
              placeholder="Client secret value" 
              className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none" 
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OData v4 Web Service Endpoint</div>
            <div className="text-[11px] font-mono text-indigo-700 bg-white p-2 rounded-lg border border-slate-200/80 break-all">
              https://api.businesscentral.dynamics.com/v2.0/{bcTenantId}/{bcEnvironment}/api/v2.0/companies
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestBcODataConnection}
              disabled={bcODataTesting}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {bcODataTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {bcODataTesting ? 'Testing OData Endpoint...' : 'Test Connection & Discover Entities'}
            </button>

            {bcODataTestResult && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Verified ({bcODataTestResult.latencyMs}ms)
              </span>
            )}
          </div>

          {bcODataTestResult && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs font-mono space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Discovered Business Central OData v4 Entities</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {bcODataTestResult.discoveredEntities.map((entity, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-800 text-indigo-300 rounded border border-slate-700 text-[10px] font-bold">
                    ✓ {entity}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                <span>Company GUID: {bcODataTestResult.companyGuid}</span>
                <span>Est. Vouchers: {bcODataTestResult.sampleCount}</span>
              </div>
            </div>
          )}

          {activeIntegration.status === 'CONNECTED' && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100/50 p-2 rounded-lg text-emerald-700"><ShieldCheck size={20}/></div>
                <div>
                  <p className="text-xs font-bold text-emerald-800">Business Central Connection Active & Healthy</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">OAuth 2.0 token valid • Latency: 138ms • Rate: 380/600 RPM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('HEALTH')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <Activity size={12} /> Live Health
              </button>
            </div>
          )}
        </div>
      );
    }

    if (activeIntegration.id === 'dynamics_fo') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <Server size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-xs">Microsoft Dynamics 365 Finance & Operations (AX) Connector</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Enterprise integration using Azure AD OAuth 2.0 (Client Credentials) for high-volume OData v4 Data Entities & Data Management Framework (DMF) package ingestion.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} /> D365 F&O Environment URL
              </label>
              <input 
                value={foInstanceUrl} 
                onChange={(e) => setFoInstanceUrl(e.target.value)} 
                placeholder="https://contoso.operations.dynamics.com" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none font-mono" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} /> Tenant ID / Azure Domain
              </label>
              <input 
                value={foTenantId} 
                onChange={(e) => setFoTenantId(e.target.value)} 
                placeholder="contoso.onmicrosoft.com or Directory GUID" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Legal Entity / DataAreaID
              </label>
              <input 
                value={foLegalEntity} 
                onChange={(e) => setFoLegalEntity(e.target.value)} 
                placeholder="e.g. IN01, USMF" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Layers size={12} /> Integration Engine Mode
              </label>
              <select 
                value={foIntegrationMode} 
                onChange={(e) => setFoIntegrationMode(e.target.value as any)} 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none"
              >
                <option value="ODATA_REST">OData v4 REST API (Near Real-time Micro-batches)</option>
                <option value="DMF_BATCH">DMF High Volume Package Sync (Data Management Framework)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Key size={12} /> Azure AD Client ID
              </label>
              <input 
                value={foClientId} 
                onChange={(e) => setFoClientId(e.target.value)} 
                placeholder="Application ID" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Lock size={12} /> Azure AD Client Secret
              </label>
              <input 
                type="password"
                value={foClientSecret} 
                onChange={(e) => setFoClientSecret(e.target.value)} 
                placeholder="Client secret key" 
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:outline-none" 
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target OData & DMF Service Endpoint</div>
            <div className="text-[11px] font-mono text-blue-700 bg-white p-2 rounded-lg border border-slate-200/80 break-all">
              {foInstanceUrl}/data/SalesInvoiceHeadersV2?$filter=dataAreaId eq '{foLegalEntity.split(' ')[0]}'
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestFoConnection}
              disabled={foTesting}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {foTesting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {foTesting ? 'Validating F&O Connection...' : 'Test Connection & Inspect Data Entities'}
            </button>

            {foTestResult && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Verified ({foTestResult.latencyMs}ms)
              </span>
            )}
          </div>

          {foTestResult && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs font-mono space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Discovered D365 F&O Data Entities</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {foTestResult.discoveredEntities.map((entity, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-800 text-blue-300 rounded border border-slate-700 text-[10px] font-bold">
                    ✓ {entity}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                <span>Legal Entity Ref: {foTestResult.legalEntityGuid}</span>
                <span>Active Ledger Volume: {foTestResult.sampleCount}</span>
              </div>
            </div>
          )}

          {activeIntegration.status === 'CONNECTED' && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100/50 p-2 rounded-lg text-emerald-700"><ShieldCheck size={20}/></div>
                <div>
                  <p className="text-xs font-bold text-emerald-800">D365 F&O Enterprise Connection Active</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Dual-write framework connected • Latency: 185ms • Rate: 520/1000 RPM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('HEALTH')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <Activity size={12} /> Live Health
              </button>
            </div>
          )}
        </div>
      );
    }

    if (activeIntegration.id === 'tally') {
      return (
        <div className="space-y-5 pt-2 text-xs">
          {/* Top Banner */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Database size={15} className="text-emerald-600" />
                Tally Prime XML HTTP & ODBC Local Server Connector
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-200">
                Bidirectional Enabled
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Connect directly to local Tally Prime XML HTTP server (Port 9000) or ODBC Bridge for real-time voucher synchronization, master ledger sync, and government IRN / QR code write-backs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Server size={12} className="text-emerald-600" /> Tally XML Endpoint URL
              </label>
              <input
                value={tallyHost}
                onChange={e => setTallyHost(e.target.value)}
                placeholder="http://localhost:9000"
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={12} className="text-emerald-600" /> Target Company Name (As in Tally)
              </label>
              <input
                value={tallyCompany}
                onChange={e => setTallyCompany(e.target.value)}
                placeholder="M/S ACME INDIA PVT LTD"
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Key size={12} className="text-emerald-600" /> Tally HTTP Server Port
              </label>
              <input
                value={tallyPort}
                onChange={e => setTallyPort(e.target.value)}
                placeholder="9000"
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-600" /> Tally Release Version
              </label>
              <select className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none bg-white">
                <option value="4.1">TallyPrime Release 4.1 (Recommended)</option>
                <option value="4.0">TallyPrime Release 4.0</option>
                <option value="3.0">TallyPrime Release 3.0</option>
                <option value="ERP9">Tally.ERP 9 (Legacy XML Protocol)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleTestTallyConnection}
              disabled={tallyTesting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
            >
              {tallyTesting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {tallyTesting ? 'Connecting to Port 9000...' : 'Test Tally XML Handshake'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HEALTH')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 border border-slate-200 transition-all"
            >
              <Activity size={13} className="text-emerald-600" /> View Connection Health
            </button>
          </div>

          {tallyTestResult && tallyTestResult.status === 'SUCCESS' && (
            <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Tally Prime XML Server Connected
                </div>
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded font-bold">
                  Latency: {tallyTestResult.latencyMs}ms
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-slate-700">
                <div>Company GSTIN: <strong className="text-emerald-800">{tallyTestResult.companyGstin}</strong></div>
                <div>Discovered Vouchers: <strong className="text-emerald-800">{tallyTestResult.totalVouchers}</strong></div>
                <div>Party Ledgers: <strong className="text-emerald-800">{tallyTestResult.totalLedgers}</strong></div>
                <div>Build: <strong className="text-emerald-800">{tallyTestResult.tallyRelease}</strong></div>
              </div>
            </div>
          )}
        </div>
      );
    }

    let content = null;
    if (activeIntegration.type === 'ON_PREM') {
      content = (
        <>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Server size={12} /> Tally Connector Host
            </label>
            <input defaultValue="http://localhost:9000" className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Globe size={12} /> Company Name
            </label>
            <input placeholder="e.g. My Company Pvt Ltd" className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
        </>
      );
    } else if (activeIntegration.type === 'OAUTH') {
      content = (
        <>
           <div className="p-4 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed font-semibold">
             <AlertCircle size={16} className="mt-0.5 shrink-0 text-slate-500"/>
             Authentication runs via a secure popup authorization loop. You will be requested to grant read/write ledger credentials.
           </div>
           <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Key size={12} /> Client ID</label>
            <input placeholder="Enter Client ID" className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Lock size={12} /> Client Secret</label>
            <input type="password" placeholder="Enter Client Secret" className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
        </>
      );
    } else {
      content = (
        <>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Globe size={12} /> API Endpoint URL</label>
            <input placeholder="https://api.example.com/v1" className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Key size={12} /> API Key</label>
            <input type="password" placeholder="sk_live_..." className="w-full h-11 px-4 border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none" />
          </div>
        </>
      );
    }

    return (
      <div className="space-y-4 pt-2">
        {content}
        {activeIntegration.status === 'CONNECTED' && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                <div className="bg-emerald-100/50 p-2 rounded-lg text-emerald-700"><ShieldCheck size={20}/></div>
                <div>
                    <p className="text-xs font-bold text-emerald-800">Connection Secured & Validated</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Latency: 45ms • Cryptographic key verified</p>
                </div>
            </div>
        )}
      </div>
    );
  }

  function renderSyncSettingsTab() {
    return (
      <div className="space-y-6 pt-2">

        
        {activeIntegration?.id === 'xero' && (
          <div className="flex items-center justify-between p-4 border border-cyan-200 rounded-xl bg-cyan-50/50">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-900 flex items-center gap-2">
                 <BarChart3 size={14} className="text-cyan-700"/> Sync General Ledger & Tax Liability
              </h4>
              <p className="text-[11px] text-cyan-700 mt-1 font-medium leading-relaxed">
                Automatically push Tax Liability Reports and Manual Journals directly to Xero.
              </p>
            </div>
            <div 
                onClick={() => setXeroSyncTaxLiability(!xeroSyncTaxLiability)}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${xeroSyncTaxLiability ? 'bg-cyan-600' : 'bg-cyan-200'}`}
            >
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${xeroSyncTaxLiability ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
          </div>
        )}
\n        {activeIntegration?.id === 'qb' && (
          <div className="flex items-center justify-between p-4 border border-green-200 rounded-xl bg-green-50/50">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-green-900 flex items-center gap-2">
                 <BarChart3 size={14} className="text-green-700"/> Sync General Ledger & Tax Liability
              </h4>
              <p className="text-[11px] text-green-700 mt-1 font-medium leading-relaxed">
                Automatically push Tax Liability Reports and Journal Entries directly to QuickBooks Online.
              </p>
            </div>
            <div 
                onClick={() => setQbSyncTaxLiability(!qbSyncTaxLiability)}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${qbSyncTaxLiability ? 'bg-green-600' : 'bg-green-200'}`}
            >
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${qbSyncTaxLiability ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
               <RefreshCw size={14} className="text-slate-700"/> Auto-Import Ledger Invoices
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">Automatically pull new commercial transactions from {activeIntegration?.name}.</p>
          </div>
          <div 
              onClick={() => setAutoImport(!autoImport)}
              className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${autoImport ? 'bg-slate-900' : 'bg-slate-300'}`}
          >
              <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${autoImport ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </div>
        </div>

        {autoImport && (
           <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync Frequency</label>
                  <select 
                      value={syncFreq} 
                      onChange={(e) => setSyncFreq(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none"
                  >
                      <option value="REALTIME">Real-time (Webhooks)</option>
                      <option value="HOURLY">Every 1 Hour</option>
                      <option value="DAILY">Daily (12:00 AM)</option>
                      <option value="MANUAL">Manual Only</option>
                  </select>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retry Policy</label>
                  <select className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-slate-400 focus:outline-none">
                      <option>3 Retries (Exponential Backoff)</option>
                      <option>5 Retries (Max limits)</option>
                      <option>Immediate Failure Alert</option>
                  </select>
              </div>
           </div>
        )}

        {/* Tally Prime Specific Bidirectional Write-back settings */}
        {activeIntegration?.id === 'tally' && (
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black text-emerald-950 uppercase tracking-widest flex items-center gap-1.5">
                <Zap size={14} className="text-emerald-600" />
                Tally Prime Bidirectional Sync & IRN Write-back Engine
              </h4>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded tracking-wider">
                Full Canonical Integration
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bi-directionally sync Tally Prime Vouchers & Ledgers. Automatically write back Government E-Invoice IRN numbers, signed QR code strings, and E-Way bill details directly into Tally voucher narrations or UDF fields.
            </p>

            <div className="space-y-3 pt-2 border-t border-emerald-200/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Tally Synchronization Mode</span>
                  <p className="text-[10px] text-slate-500">PULL vouchers from Tally and PUSH generated IRNs back to Tally</p>
                </div>
                <select
                  value={tallySyncMode}
                  onChange={(e: any) => setTallySyncMode(e.target.value)}
                  className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="BIDIRECTIONAL">Bidirectional ⇄ (Full Sync)</option>
                  <option value="PULL_ONLY">Pull Only (Tally → TaxFlow)</option>
                  <option value="PUSH_ONLY">Push Only (TaxFlow → Tally)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Write-back E-Invoice IRN & QR Code to Tally Vouchers</span>
                  <p className="text-[10px] text-slate-500">Pushes IRN and Signed QR Code to Tally Voucher Narration / UDF</p>
                </div>
                <div 
                  onClick={() => setTallyEnableWriteback(!tallyEnableWriteback)}
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${tallyEnableWriteback ? 'bg-emerald-600' : 'bg-slate-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${tallyEnableWriteback ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Auto-Create Missing Party Ledgers in Tally</span>
                  <p className="text-[10px] text-slate-500">Creates Customer/Vendor Sundry Debtors/Creditors with GSTIN & State Code</p>
                </div>
                <div 
                  onClick={() => setTallyAutoCreateLedgers(!tallyAutoCreateLedgers)}
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${tallyAutoCreateLedgers ? 'bg-emerald-600' : 'bg-slate-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${tallyAutoCreateLedgers ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>

            {tallyEnableWriteback && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={tallyWritebackIrn} onChange={e => setTallyWritebackIrn(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                  <span className="text-[11px] font-bold text-slate-800">Write-back 64-char IRN</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={tallyWritebackQr} onChange={e => setTallyWritebackQr(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                  <span className="text-[11px] font-bold text-slate-800">Write-back Signed QR Code</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={tallyWritebackEWay} onChange={e => setTallyWritebackEWay(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                  <span className="text-[11px] font-bold text-slate-800">Write-back E-Way Bill No</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Business Central Specific Dual Write-back settings */}
        {activeIntegration?.id === 'dynamics' && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-3">
            <h4 className="text-[11px] font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={14} className="text-indigo-600" />
              Business Central E-Invoice & E-Way Bill Write-back
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automatically push tax portal generated IRN (Invoice Reference Number), QR Code payload, and E-Way Bill numbers back to custom extension fields in Business Central Sales Invoices.
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-800">Enable Write-back to Business Central</span>
              <div 
                onClick={() => setBcEnableWriteback(!bcEnableWriteback)}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${bcEnableWriteback ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${bcEnableWriteback ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {bcEnableWriteback && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target IRN Field</label>
                  <input value={bcIrnField} onChange={e => setBcIrnField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target QR Code Field</label>
                  <input value={bcQrField} onChange={e => setBcQrField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target E-Way Field</label>
                  <input value={bcEWayField} onChange={e => setBcEWayField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamics F&O Write-back Settings */}
        {activeIntegration?.id === 'dynamics_fo' && (
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-3">
            <h4 className="text-[11px] font-black text-blue-950 uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={14} className="text-blue-600" />
              D365 Finance & Operations Write-back Settings
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Push government Portal IRNs, signed QR Code strings, and E-Way Bill numbers back to D365 F&O CustInvoiceJour & SalesTable extension fields via OData batch PATCH.
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-800">Enable Tax Portal Write-back to D365 F&O</span>
              <div 
                onClick={() => setFoEnableWriteback(!foEnableWriteback)}
                className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${foEnableWriteback ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${foEnableWriteback ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </div>

            {foEnableWriteback && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target IRN Field</label>
                  <input value={foIrnField} onChange={e => setFoIrnField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target QR Code Field</label>
                  <input value={foQrField} onChange={e => setFoQrField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target E-Way Field</label>
                  <input value={foEWayField} onChange={e => setFoEWayField(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px]" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Synchronization Scope</h4>
           <div className="space-y-2">
              <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"/>
                  <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800">Sales Vouchers</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">GSTR-1 compliant sales registries</div>
                  </div>
              </label>
              <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"/>
                  <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800">Purchase Vouchers</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">For ITC mapping and 2B Reconciliation</div>
                  </div>
              </label>
           </div>
        </div>

         <div className="space-y-3">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <FileCheck size={12} /> Compliance Validation Pipeline
           </h4>
           <div className="bg-slate-50 rounded-xl p-4 space-y-3.5 border border-slate-200/80 text-xs">
               {[
                   'Validate GSTIN checksum formats', 
                   'Match duplicate voucher numbers', 
                   'Verify compliance mapping of HSN/SAC',
                   'Flag outdated claims (>180 days)'
               ].map((rule, idx) => (
                   <div key={idx} className="flex items-center justify-between">
                       <span className="text-slate-700 font-semibold">{rule}</span>
                       <div className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </div>
                   </div>
               ))}
           </div>
        </div>
      </div>
    );
  }


  function renderMappingTab() {
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="QUICKBOOKS" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-green-600" />
              QuickBooks Chart of Accounts & Tax Agency Mapping
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map QuickBooks Tax Rates, Agencies, and General Ledger Accounts to statutory TaxFlow GST definitions for automated Journal Entry creation.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">TaxFlow Statutory Type</th>
                    <th className="p-3">QuickBooks GL Account / Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {['Output CGST Payable', 'Output SGST Payable', 'Output IGST Payable', 'Input CGST Receivable', 'Input SGST Receivable', 'Input IGST Receivable'].map((taxHead, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{taxHead}</td>
                      <td className="p-3">
                        <select className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-green-500 focus:outline-none">
                          <option>Select QuickBooks Account</option>
                          <option>2101 - CGST Payable (Current Liabilities)</option>
                          <option>2102 - SGST Payable (Current Liabilities)</option>
                          <option>2103 - IGST Payable (Current Liabilities)</option>
                          <option>1201 - Input CGST (Current Assets)</option>
                          <option>1202 - Input SGST (Current Assets)</option>
                          <option>1203 - Input IGST (Current Assets)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="XERO" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-cyan-600" />
              Xero Chart of Accounts & Tax Rates Mapping
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Xero Tax Rates and General Ledger Accounts (e.g., 820 - GST) to statutory TaxFlow GST definitions for automated Manual Journal creation.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">TaxFlow Statutory Type</th>
                    <th className="p-3">Xero GL Account / Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {['Output CGST Payable', 'Output SGST Payable', 'Output IGST Payable', 'Input CGST Receivable', 'Input SGST Receivable', 'Input IGST Receivable'].map((taxHead, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{taxHead}</td>
                      <td className="p-3">
                        <select className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-cyan-500 focus:outline-none">
                          <option>Select Xero Account</option>
                          <option>820 - GST (Current Liability)</option>
                          <option>821 - CGST Payable (Current Liability)</option>
                          <option>822 - SGST Payable (Current Liability)</option>
                          <option>823 - IGST Payable (Current Liability)</option>
                          <option>824 - GST Clearing (Current Asset)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration?.id === 'tally') {
      return (
        <div className="space-y-6 pt-2">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800 text-xs leading-relaxed font-semibold">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600"/>
            <p>Carefully audit mappings before syncing. Mapped values route directly to final GSTR submission draft sheets.</p>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">TAXFLOW SCHEMA</th>
                  <th className="p-3">SOURCE ERP COLUMN</th>
                  <th className="p-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {Object.entries(tallySchemaMappings).map(([appField, erpTag], i) => (
                  <tr key={i} className="group hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {appField}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] shadow-2xs focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                        <Database size={13} className="text-emerald-600 shrink-0"/>
                        <input
                          value={erpTag}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTallySchemaMappings(prev => ({ ...prev, [appField]: val }));
                          }}
                          className="w-full bg-transparent border-none p-0 focus:outline-none font-mono text-[11px] text-slate-900 font-semibold"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Settings size={14} className="text-slate-400 group-hover:text-emerald-600 cursor-pointer transition-colors inline-block"/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <FieldMappingConfiguration erpType="TALLY_PRIME" />
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-emerald-600" />
              Tally Prime GST Ledger & Tax Rate Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Tally Prime GST Ledgers (e.g., Output CGST, Input IGST) to statutory TaxFlow GST rate categories for GSTR-1, GSTR-3B & GSTR-2B filing.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Tally Prime Ledger Name</th>
                    <th className="p-3">TaxFlow Statutory Tax Rate Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(tallyTaxLedgerMap).map(([tallyLedger, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-emerald-700">{tallyLedger}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setTallyTaxLedgerMap(prev => ({ ...prev, [tallyLedger]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="18% IGST (Inter-State)">18% IGST (Inter-State)</option>
                          <option value="9% CGST (18% Intra-State)">9% CGST (18% Intra-State)</option>
                          <option value="9% SGST (18% Intra-State)">9% SGST (18% Intra-State)</option>
                          <option value="12% IGST (Inter-State)">12% IGST (Inter-State)</option>
                          <option value="6% CGST (12% Intra-State)">6% CGST (12% Intra-State)</option>
                          <option value="6% SGST (12% Intra-State)">6% SGST (12% Intra-State)</option>
                          <option value="18% Input IGST">18% Input IGST</option>
                          <option value="9% Input CGST">9% Input CGST</option>
                          <option value="9% Input SGST">9% Input SGST</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration?.id === 'dynamics') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="DYNAMICS_BC" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-indigo-600" />
              Business Central Tax Group Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map Business Central VAT/GST Tax Groups to statutory TaxFlow GST rate categories.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Business Central Tax Group Code</th>
                    <th className="p-3">TaxFlow Statutory Tax Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(bcTaxGroupMap).map(([bcGroup, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-indigo-700">{bcGroup}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setBcTaxGroupMap(prev => ({ ...prev, [bcGroup]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="18% CGST+SGST (9%+9%)">18% CGST + SGST (9% + 9%)</option>
                          <option value="18% IGST">18% IGST</option>
                          <option value="12% CGST+SGST (6%+6%)">12% CGST + SGST (6% + 6%)</option>
                          <option value="12% IGST">12% IGST</option>
                          <option value="5% CGST+SGST (2.5%+2.5%)">5% CGST + SGST (2.5% + 2.5%)</option>
                          <option value="Exempt / Zero Rated">Exempt / Zero Rated</option>
                          <option value="Export Under LUT (0%)">Export Under LUT (0%)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeIntegration?.id === 'dynamics_fo') {
      return (
        <div className="space-y-6 pt-2">
          <FieldMappingConfiguration erpType="DYNAMICS_FO" />
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={14} className="text-emerald-600" />
              D365 F&O Tax Item Group & Tax Code Mapping Matrix
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Map D365 F&O Tax Groups & Tax Item Groups to statutory TaxFlow GST rate categories.
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">F&O Tax Item Group Code</th>
                    <th className="p-3">TaxFlow Statutory Tax Slab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.entries(foTaxGroupMap).map(([foGroup, mappedTax], i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold font-mono text-emerald-700">{foGroup}</td>
                      <td className="p-3">
                        <select 
                          value={mappedTax}
                          onChange={(e) => setFoTaxGroupMap(prev => ({ ...prev, [foGroup]: e.target.value }))}
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="18% CGST+SGST (9%+9%)">18% CGST + SGST (9% + 9%)</option>
                          <option value="18% IGST">18% IGST</option>
                          <option value="12% CGST+SGST (6%+6%)">12% CGST + SGST (6% + 6%)</option>
                          <option value="12% IGST">12% IGST</option>
                          <option value="Exempt / Zero Rated">Exempt / Zero Rated</option>
                          <option value="Export Under LUT (0%)">Export Under LUT (0%)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-6 pt-2">
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800 text-xs leading-relaxed font-semibold">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600"/>
          <p>Carefully audit mappings before syncing. Mapped values route directly to final GSTR submission draft sheets.</p>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                      <th className="p-3">TaxFlow Schema</th>
                      <th className="p-3">Source ERP Column</th>
                      <th className="p-3 w-10"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                      { app: 'Invoice Number', erp: 'voucher_number' },
                      { app: 'Invoice Date', erp: 'doc_date' },
                      { app: 'Customer GSTIN', erp: 'party_gstin_id' },
                      { app: 'Taxable Value', erp: 'assessable_amt' },
                      { app: 'Tax Amount', erp: 'total_tax_amt' },
                      { app: 'Place of Supply', erp: 'state_code' },
                  ].map((row, i) => (
                      <tr key={i} className="group hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{row.app}</td>
                          <td className="p-3">
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-mono text-[10px]">
                                  <Database size={12} className="text-slate-400"/> {row.erp}
                              </div>
                          </td>
                          <td className="p-3 text-right">
                               <Settings size={14} className="text-slate-400 group-hover:text-slate-800 cursor-pointer"/>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
        <button type="button" className="text-xs text-slate-900 font-bold uppercase tracking-wider hover:underline flex items-center gap-1">
          + Map Custom Column Schema
        </button>
      </div>
    );
  }

  function renderLogsTab() {
    if (activeIntegration?.id === 'qb') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">QuickBooks Online Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Journal Entry Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.intuit.com/v3/company</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('QUICKBOOKS')).map((log, i) => {
                   const timeMatch = log.match(/\[(.*?)\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\[.*?\]\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeIntegration?.id === 'xero') {
      return (
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800">Xero Integration Sync Logs</h4>
              <p className="text-[11px] text-slate-500">Invoice Pulls & Tax Liability Manual Journal Pushes</p>
            </div>
            <button 
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin stroke-[3]" /> : <RefreshCw size={12} className="stroke-[3]" />}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
               <span className="text-[10px] font-mono text-slate-400">api.xero.com/api.xro/2.0</span>
               <span className="flex items-center gap-2">
                 <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div> Live</span>
               </span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
               {systemLogs.length === 0 ? (
                 <p className="text-slate-600 italic">No sync activity recorded.</p>
               ) : (
                 systemLogs.filter(log => log.includes('XERO')).map((log, i) => {
                   const timeMatch = log.match(/\[(.*?)\]/);
                   const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                   const message = log.replace(/\[.*?\]\s*/, '');
                   return (
                   <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                     <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                     <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                   </div>
                 )})
               )}
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-800">Integration Sync Logs</h4>
            <p className="text-[11px] text-slate-500">Real-time sync activity and errors</p>
          </div>
          <button 
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-[10px] flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 transition-all shadow-sm"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/50">
             <span className="text-[10px] font-mono text-slate-400">Terminal</span>
             <span className="flex items-center gap-2">
               <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live</span>
             </span>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 text-slate-300">
             {systemLogs.length === 0 ? (
               <p className="text-slate-600 italic">No sync activity recorded.</p>
             ) : (
               systemLogs.map((log, i) => {
                 const timeMatch = log.match(/\[(.*?)\]/);
                 const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();
                 const message = log.replace(/\[.*?\]\s*/, '');
                 return (
                 <div key={i} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                   <span className="text-slate-500 whitespace-nowrap">[{time}]</span>
                   <span className={message.includes('ERROR') ? 'text-rose-400' : message.includes('successfully') || message.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}>{message}</span>
                 </div>
               )})
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Integrations Hub</h1>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1">
              <Database size={12} /> Data Sync Active
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Connect your ERP and accounting systems to automatically sync invoices, validate GSTINs, and generate statutory tax reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search apps..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 shadow-sm" />
          </div>
          <button 
            onClick={() => handleOpenOneClickImport()} 
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            <Zap size={16} />
            1-Click ERP Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
            <Plus size={16} /> Add App
          </button>
        </div>
      </div>

      {/* Integration Health & API Usage Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Integration Health & API Limits</h2>
          </div>
          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            Live Status
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {integrations.filter(i => i.status === 'CONNECTED').map(integration => {
             // Mock API limit data based on integration
             let used = 0; let total = 1000; let latency = 45;
             if (integration.id === 'qb') { used = 450; total = 500; latency = 120; }
             if (integration.id === 'tally') { used = 120; total = -1; latency = 15; }
             if (integration.id === 'xero') { used = 850; total = 5000; latency = 85; }
             if (integration.id === 'dynamics') { used = 12500; total = 20000; latency = 210; }
             if (integration.id === 'zoho') { used = 120; total = 1000; latency = 55; }

             const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
             const isWarning = percentage > 85;
             
             return (
               <div key={`health-${integration.id}`} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                      <span className="text-xs font-bold text-slate-700">{integration.name}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] text-slate-500 font-mono">{latency}ms</span>
                     <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isWarning ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100'}`}>
                       {isWarning ? 'Warning' : 'Healthy'}
                     </span>
                   </div>
                 </div>
                 
                 {total > 0 ? (
                   <div className="space-y-1.5">
                     <div className="flex justify-between text-[10px] font-semibold">
                       <span className="text-slate-500">API Usage (24h)</span>
                       <span className={isWarning ? 'text-amber-600' : 'text-slate-700'}>{used.toLocaleString()} / {total.toLocaleString()}</span>
                     </div>
                     <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-500 ${isWarning ? 'bg-amber-500' : percentage > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                         style={{ width: `${percentage}%` }}
                       ></div>
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-1.5">
                     <div className="flex justify-between text-[10px] font-semibold">
                       <span className="text-slate-500">Sync Status</span>
                       <span className="text-slate-700">On-Prem Agent</span>
                     </div>
                     <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-full"></div>
                     </div>
                   </div>
                 )}
               </div>
             )
          })}
          
          {integrations.filter(i => i.status === 'CONNECTED').length === 0 && (
             <div className="col-span-3 text-center py-6 text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No active integrations. Connect an app to view real-time API health and usage limits.
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {integrations.map(integration => (
                 <div key={integration.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                   <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${integration.iconColor} flex items-center justify-center text-white text-lg font-black shadow-inner`}>
                         {integration.initials}
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.status === 'CONNECTED' ? (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Connected
                           </span>
                        ) : (
                           <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                             Disconnected
                           </span>
                        )}
                      </div>
                   </div>
                   <h3 className="font-bold text-slate-900 text-base">{integration.name}</h3>
                   <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{integration.description}</p>
                   
                   <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                     <div className="text-[10px] font-semibold text-slate-400">
                        {integration.status === 'CONNECTED' ? `Last sync: ${integration.lastSync}` : 'Never synced'}
                     </div>
                     <div className="flex items-center gap-1.5">
                       <button 
                         type="button"
                         onClick={() => handleOpenOneClickImport(integration.id)}
                         className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                         title="1-Click import sales & purchase ledgers into GST engine"
                       >
                         <Zap size={12} />
                         Import
                       </button>
                       <button 
                         onClick={() => openConnectModal(integration.id, integration.status === 'CONNECTED' ? 'SYNC' : 'CONNECTION')}
                         className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${integration.status === 'CONNECTED' ? 'text-slate-700 hover:bg-slate-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'}`}
                       >
                         {integration.status === 'CONNECTED' ? 'Configure' : 'Connect'}
                       </button>
                     </div>
                   </div>
                 </div>
              ))}
            </div>

            {/* Trace Explorer Section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
               <div className="flex items-center justify-between mb-6">
                 <div>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <Activity size={20} className="text-blue-600" /> Distributed Tracing & Diagnostics
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Monitor end-to-end API latencies, data pipelines, and ERP connector health.</p>
                 </div>
               </div>
               
               <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[400px]">
                  {/* Traces List Sidebar */}
                  <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col">
                     <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent Executions</span>
                       <button className="text-slate-400 hover:text-slate-700 transition-colors"><RefreshCw size={14} /></button>
                     </div>
                     <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                       {mockTraces.map((trace) => (
                         <div 
                           key={trace.id} 
                           onClick={() => setSelectedTraceId(trace.id)}
                           className={`p-4 cursor-pointer transition-colors ${selectedTraceId === trace.id ? 'bg-white border-l-2 border-l-blue-600 shadow-sm' : 'hover:bg-white border-l-2 border-l-transparent'}`}
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-[10px] font-mono text-slate-400">{trace.id}</span>
                             <span className="text-[10px] font-semibold text-slate-500">{trace.timestamp}</span>
                           </div>
                           <h4 className="text-xs font-bold text-slate-800 truncate mb-2">{trace.name}</h4>
                           <div className="flex items-center gap-3">
                             <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                               <Clock size={12} className="text-slate-400" /> {trace.durationMs}ms
                             </span>
                             <span className={`text-[10px] font-bold uppercase tracking-wider ${trace.spans.some(s => s.status === 'ERROR') ? 'text-rose-600' : 'text-emerald-600'}`}>
                               {trace.spans.some(s => s.status === 'ERROR') ? 'Failed' : 'Success'}
                             </span>
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                  
                  {/* Trace Waterfall Chart */}
                  <div className="flex-1 bg-white p-6 flex flex-col">
                     <div className="mb-6 flex items-start justify-between">
                       <div>
                         <h3 className="text-sm font-bold text-slate-900">{activeTrace.name}</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-slate-500 font-mono">Trace ID: {activeTrace.id}</span>
                            <span className="text-xs text-slate-500">Duration: <strong>{activeTrace.durationMs}ms</strong></span>
                            <span className="text-xs text-slate-500">Spans: <strong>{activeTrace.spans.length}</strong></span>
                         </div>
                       </div>
                       <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors">Export JSON</button>
                       </div>
                     </div>
                     
                     {/* Waterfall Visualization */}
                     <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 p-4 overflow-y-auto overflow-x-hidden relative">
                        <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 sticky top-0 bg-slate-50 z-10">
                           <div className="w-1/3">Service & Operation</div>
                           <div className="w-2/3 pl-4 relative">
                              <span>Timeline (0ms - {activeTrace.durationMs}ms)</span>
                           </div>
                        </div>
                        <div className="space-y-4">
                           {activeTrace.spans.map((span, i) => {
                             const leftPercent = (span.offsetMs / activeTrace.durationMs) * 100;
                             const widthPercent = Math.max((span.durationMs / activeTrace.durationMs) * 100, 0.5);
                             return (
                               <div key={i} className="group relative">
                                 <div className="flex items-center text-xs">
                                   <div className="w-1/3 pr-4 truncate">
                                     <div className="font-bold text-slate-700 truncate">{span.service}</div>
                                     <div className="text-[10px] text-slate-500 truncate mt-0.5">{span.operation}</div>
                                   </div>
                                   <div className="w-2/3 relative h-8 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                     <div 
                                       className={`absolute top-1 bottom-1 rounded-sm shadow-sm transition-all flex items-center px-2 text-[8px] font-bold text-white overflow-hidden ${span.status === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}`}
                                       style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                                     >
                                       {widthPercent > 10 && `${span.durationMs}ms`}
                                     </div>
                                   </div>
                                 </div>
                                 <div className="ml-[33%] mt-2 pl-4 space-y-1">
                                    {span.logs.map((log, li) => (
                                      <div key={li} className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        {log}
                                      </div>
                                    ))}
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

      {/* Configuration Modal */}
      {modalState.isOpen && activeIntegration && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${activeIntegration.iconColor} flex items-center justify-center text-white text-xl font-black shadow-sm`}>
                  {activeIntegration.initials}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{activeIntegration.name} Configuration</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage connection, sync rules, and data mapping.</p>
                </div>
              </div>
              <button onClick={closeConnectModal} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {activeIntegration.status === 'CONNECTED' ? (
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-56 bg-slate-50 border-r border-slate-100 flex flex-row md:flex-col p-2 md:p-4 gap-1 md:gap-2 overflow-x-auto md:overflow-visible shrink-0">
                  <button 
                    onClick={() => setActiveTab('CONNECTION')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'CONNECTION' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Server size={14} /> Connection
                  </button>
                  <button 
                    onClick={() => setActiveTab('SYNC')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'SYNC' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <RefreshCw size={14} /> Sync Settings
                  </button>
                  <button 
                    onClick={() => setActiveTab('MAPPING')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'MAPPING' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Database size={14} /> Field Mapping
                  </button>
                  <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'LOGS' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    <Activity size={14} /> Sync Logs
                  </button>
                  
                  <div className="mt-auto hidden md:block pt-4">
                    <button 
                      onClick={() => handleDisconnect(activeIntegration.id)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg w-full transition-colors"
                    >
                      <Trash2 size={14} /> Disconnect ERP
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-white">
                  {activeTab === 'CONNECTION' && renderConnectionTab()}
                  {activeTab === 'SYNC' && renderSyncSettingsTab()}
                  {activeTab === 'MAPPING' && renderMappingTab()}
                  {activeTab === 'LOGS' && renderLogsTab()}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                <div className={`w-20 h-20 rounded-2xl ${activeIntegration.iconColor} flex items-center justify-center text-white text-3xl font-black shadow-lg mb-6`}>
                  {activeIntegration.initials}
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Connect to {activeIntegration.name}</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md leading-relaxed">
                  Authorize TaxFlow to securely access your data to automate compliance, fetch invoices, and push journal entries.
                </p>
                <form onSubmit={handleSubmitConnection} className="w-full max-w-sm space-y-4">
                  <button 
                    type="submit" 
                    disabled={isConnecting}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    {isConnecting ? 'Authenticating...' : 'Secure OAuth Login'}
                  </button>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Lock size={10} /> 256-bit AES Encryption
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* One-Click ERP Ledger Import Modal */}
      <OneClickErpImportModal 
        isOpen={isOneClickModalOpen}
        onClose={() => setIsOneClickModalOpen(false)}
        defaultErpId={selectedErpForImport || 'tally'}
      />
    </div>
  );
};
export default Integrations;
