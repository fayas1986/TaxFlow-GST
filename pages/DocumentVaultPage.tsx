import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { 
  FileText, ShieldCheck, Tag, Search, Plus, Filter, Calendar, Clock, 
  Trash2, Download, Eye, AlertCircle, Copy, Check, FileCheck, Award, 
  Mail, ClipboardList, Info, Lock, Upload, Key, X, Sparkles, ChevronRight, 
  RotateCw, ArrowUpRight, CheckCircle2, AlertTriangle, FileUp, ExternalLink, HelpCircle,
  Camera, Database, CloudOff, FolderKey, Users, Shield
, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentCameraScanner, { ExtractedInvoiceData } from '../components/DocumentCameraScanner';
import { useOfflineDrafts } from '../hooks/useOfflineDrafts';
import { localDb } from '../utils/localDb';
import { logAuditAction } from '../services/api';
import { dispatchEmailNotification } from "../utils/emailNotificationService";
import PdfPreviewModal, { DocumentAnnotation } from '../components/PdfPreviewModal';

// Types for Document Vault
import { DocumentComment, DocumentCommentThread } from "../components/DocumentCommentThread";

interface DocumentVersion {
  versionId: string;
  uploadDate: string;
  fileSize: string;
  fileType: string;
  sha256Hash: string;
  fileUrl?: string;
  user: string;
}

interface DocumentRecord {
  id: string;
  title: string;
  refNumber: string;
  category: 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER' | 'INVOICE';
  issueDate: string;
  uploadDate: string;
  replyDeadline?: string;
  status: 'ACTIVE' | 'REPLIED' | 'PENDING_ACTION' | 'CLOSED';
  tags: string[];
  description: string;
  fileSize: string;
  fileType: string;
  sha256Hash: string;
  authorityName?: string;
  isConfidential: boolean;
  detectedLanguage?: string;
  translatedText?: string;
  comments?: DocumentComment[];
  fileUrl?: string;
  versions?: DocumentVersion[];
  annotations?: DocumentAnnotation[];
  activityLog: {
    date: string;
    action: string;
    user: string;
  }[];
}

// Default Seed Documents
const DEFAULT_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'doc-foreign-1',
    title: 'Facture Commerciale - Acme SAS France',
    refNumber: 'INV-FR-2026-0892',
    category: 'INVOICE',
    issueDate: '2026-08-20',
    uploadDate: '2026-08-22',
    status: 'ACTIVE',
    tags: ['Cross-Border', 'France', 'Import'],
    description: 'Facture commerciale pour services de conseil numérique.\nMontant Total: €12,500.00\nTVA: €2,500.00\nMontant Net: €15,000.00\nVeuillez régler ce montant sous 30 jours. Coordonnées bancaires jointes.',
    fileSize: '1.2 MB',
    fileType: 'application/pdf',
    sha256Hash: 'e4d909c290d0fb1ca068ffaddf22cbd0a245582f3c7e47be48',
    authorityName: 'Acme SAS France',
    isConfidential: false,
    activityLog: [
      { date: '2026-08-22 10:15', action: 'Invoice Uploaded via Cross-Border Portal', user: 'System' }
    ]
  },
  {
    id: 'doc-1',
    title: 'REG-06 GST Registration Certificate',
    refNumber: 'GST/REG/2021/REG06-0082',
    category: 'CERTIFICATE',
    issueDate: '2021-05-15',
    uploadDate: '2021-05-16',
    status: 'ACTIVE',
    tags: ['REG-06', 'Registration', 'GSTIN_Active', 'Corporate'],
    description: 'Official Government issued GST REG-06 registration certificate containing registered place of business, partners details, and active GSTIN registrations.',
    fileSize: '1.2 MB',
    fileType: 'application/pdf',
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    authorityName: 'Goods and Services Tax Network (GSTN)',
    isConfidential: true,
    activityLog: [
      { date: '2021-05-16 10:24', action: 'Uploaded official REG-06 certificate', user: 'Admin User' },
      { date: '2024-02-10 14:15', action: 'Verified security checksum', user: 'Internal Auditor' }
    ]
  },
  {
    id: 'doc-2',
    title: 'GSTR-9C Annual Audit Reconciliation Statement',
    refNumber: 'AUD/9C/FY24-25/RECON-0921',
    category: 'AUDIT_REPORT',
    issueDate: '2025-10-24',
    uploadDate: '2025-10-25',
    status: 'CLOSED',
    tags: ['GSTR-9C', 'FY 2024-25', 'Audit', 'Reconciled', 'Income Tax'],
    description: 'Certified GSTR-9C Reconciliation Statement audited and signed by the statutory CA, aligning gross turnover, input tax credit pools, and tax liabilities with the audited financial balance sheets.',
    fileSize: '4.8 MB',
    fileType: 'application/pdf',
    sha256Hash: '8f4327201b5e58faee20a11e1fdf9fc286ae79d615991b7852b855e3b0c44298',
    authorityName: 'Central Board of Indirect Taxes and Customs',
    isConfidential: false,
    activityLog: [
      { date: '2025-10-25 11:00', action: 'Uploaded audited report GSTR-9C', user: 'Senior Accountant' },
      { date: '2025-10-26 16:45', action: 'CA Digital Signature verified', user: 'Filing Lead' }
    ]
  },
  {
    id: 'doc-3',
    title: 'Show Cause Notice u/s 73 - Input Tax Credit Mismatch',
    refNumber: 'SCN/73/FY25-26/GSTN-8842',
    category: 'CORRESPONDENCE',
    issueDate: '2026-08-01',
    uploadDate: '2026-08-03',
    replyDeadline: '2026-08-31',
    status: 'PENDING_ACTION',
    tags: ['SCN', 'Section 73', 'ITC Mismatch', 'Department Notice', 'Disputed'],
    description: 'Show cause notice served under Section 73 of the CGST Act regarding mismatch in GSTR-2B eligible credit pool vs GSTR-3B claimed amount for Q3 FY 25-26.',
    fileSize: '840 KB',
    fileType: 'application/pdf',
    sha256Hash: 'c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0',
    authorityName: 'Superintendent of GST, Ward 44, Mumbai',
    isConfidential: true,
    activityLog: [
      { date: '2026-08-03 09:12', action: 'Notice received and logged', user: 'Tax Specialist' },
      { date: '2026-08-05 14:30', action: 'Assigned to Legal Consultant', user: 'Finance Director' }
    ]
  },
  {
    id: 'doc-4',
    title: 'Commissioner Appeals Order (FY 23-24 Refusal Reversed)',
    refNumber: 'ORD/APPEALS/MUM/2026/894',
    category: 'CORRESPONDENCE',
    issueDate: '2026-04-12',
    uploadDate: '2026-04-14',
    status: 'REPLIED',
    tags: ['Appeals', 'CGST Order', 'Favorable', 'FY 2023-24', 'Legal Wins'],
    description: 'Final ruling issued by the Commissioner (Appeals) overturning the adjudicating officer\'s block of input tax credits worth ₹18,40,000 under Section 17(5)(c).',
    fileSize: '3.1 MB',
    fileType: 'application/pdf',
    sha256Hash: 'a11e1fdf9fc286ae79d615991b7852b855e3b0c44298fc1c149afbf4c8996fb9',
    authorityName: 'Office of Commissioner of CGST Appeals, Mumbai',
    isConfidential: true,
    activityLog: [
      { date: '2026-04-14 15:00', action: 'Order logged and closed out of liabilities', user: 'Admin User' }
    ]
  }
];

const DocumentVaultPage: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  
  const { drafts: offlineDrafts, isOnline, saveDraft, deleteDraft } = useOfflineDrafts('DOCUMENT');

  // Persistence per Tenant
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forceUpload, setForceUpload] = useState(false);
  const [computedFileHash, setComputedFileHash] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const closeUploadModal = () => {
    setIsUploadOpen(false);
    setDuplicateWarning(null);
    setForceUpload(false);
    setComputedFileHash(null);
  };

  const openUploadModal = () => {
    setDuplicateWarning(null);
    setForceUpload(false);
    setComputedFileHash(null);
    setIsUploadOpen(true);
  };
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const [sharedCollections, setSharedCollections] = useState([
    {
      id: 'COLLECTION_AUDITORS',
      name: 'External Auditors',
      description: 'Read-only access to Audit & Invoice records.',
      tags: ['Audit', 'Invoice', 'GST R-9C'],
      allowedRoles: ['Auditor', 'Admin']
    },
    {
      id: 'COLLECTION_LEGAL',
      name: 'Legal Counsel',
      description: 'Notices and appeals for external legal review.',
      tags: ['Legal Notice', 'Certificate'],
      allowedRoles: ['Legal Counsel', 'Admin']
    }
  ]);
  
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionPolicy, setRetentionPolicy] = useState({
    years: 7,
    action: 'ARCHIVE', // 'ARCHIVE' | 'DELETE'
    isActive: false,
  });

  const isRetentionFlagged = (doc) => {
    if (!retentionPolicy.isActive) return false;
    const issueDate = new Date(doc.issueDate).getTime();
    const now = Date.now();
    const diffYears = (now - issueDate) / (1000 * 60 * 60 * 24 * 365.25);
    return diffYears > retentionPolicy.years;
  };


  const handleExecuteRetention = async () => {
    const flaggedDocs = documents.filter(isRetentionFlagged);
    if (flaggedDocs.length === 0) {
      alert('No documents are currently flagged for retention.');
      return;
    }

    const confirmMsg = `Are you sure you want to ${retentionPolicy.action.toLowerCase()} ${flaggedDocs.length} document(s)? This action will be securely logged in the global audit trail.`;
    if (!confirm(confirmMsg)) return;

    // Log each removal to the global audit trail
    for (const doc of flaggedDocs) {
      await logAuditAction(
        `Document Retention ${retentionPolicy.action === 'ARCHIVE' ? 'Archived' : 'Deleted'}`,
        'COMPLIANCE',
        `Automated retention service processed document: ${doc.title} (${doc.refNumber})`,
        [
          { field: 'File Name', oldValue: doc.title, newValue: 'REMOVED' },
          { field: 'Original Creation Date', oldValue: doc.issueDate, newValue: '-' },
          { field: 'Deletion Date', oldValue: '-', newValue: new Date().toISOString() },
          { field: 'Retention Policy', oldValue: '-', newValue: `${retentionPolicy.years} Years` }
        ]
      );
    }

    const remainingDocs = documents.filter(doc => !isRetentionFlagged(doc));
    setDocuments(remainingDocs);
    saveToStorage(remainingDocs);
    
    if (selectedDoc && isRetentionFlagged(selectedDoc)) {
      setSelectedDoc(null);
    }
    
    setIsRetentionModalOpen(false);
    dispatchEmailNotification(
      `Retention Policy Executed`, 
      `Successfully ${retentionPolicy.action.toLowerCase()}d ${flaggedDocs.length} aging document(s).`,
      'compliance-team@vault.local'
    );
  };

  const [tagSearchMode, setTagSearchMode] = useState<'AND' | 'OR'>('OR');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  // New Document Upload Form State
  const [newDocData, setNewDocData] = useState<{
    title: string;
    refNumber: string;
    category: 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER';
    issueDate: string;
    replyDeadline: string;
    status: 'ACTIVE';
    tagsString: string;
    description: string;
    authorityName: string;
    isConfidential: boolean;
  }>({
    title: '',
    refNumber: '',
    category: 'CERTIFICATE',
    issueDate: '',
    replyDeadline: '',
    status: 'ACTIVE',
    tagsString: '',
    description: '',
    authorityName: '',
    isConfidential: false
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load and Save local storage
  useEffect(() => {
    const key = `taxflow_document_vault_${tenantId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setDocuments(JSON.parse(stored));
      } catch (err) {
        setDocuments(DEFAULT_DOCUMENTS);
      }
    } else {
      setDocuments(DEFAULT_DOCUMENTS);
      localStorage.setItem(key, JSON.stringify(DEFAULT_DOCUMENTS));
    }
  }, [tenantId]);

  const saveToStorage = (updatedDocs: DocumentRecord[]) => {
    setDocuments(updatedDocs);
    localStorage.setItem(`taxflow_document_vault_${tenantId}`, JSON.stringify(updatedDocs));
  };

  // Get unique tags across all documents in tenant
  const allTags = Array.from(
    new Set(documents.flatMap(doc => doc.tags))
  );

  // File drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };  const generateFileHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      const chars = '0123456789abcdef';
      let generatedHash = '';
      for (let i = 0; i < 64; i++) {
        generatedHash += chars[Math.floor(Math.random() * chars.length)];
      }
      return generatedHash;
    }
  };

  const handleSelectedFile = async (file: File) => {
    setUploadFile(file);
    
    const hash = await generateFileHash(file);
    setComputedFileHash(hash);
    
    // Auto-fill some fields based on filename
    const nameNoExt = file.name.split('.').slice(0, -1).join('.');
    const cleanTitle = nameNoExt.replace(/[-_]/g, ' ');
    
    let guessedCategory: 'CERTIFICATE' | 'AUDIT_REPORT' | 'CORRESPONDENCE' | 'OTHER' = 'OTHER';
    const tags: string[] = [];
    if (cleanTitle.toLowerCase().includes('certificate') || cleanTitle.toLowerCase().includes('reg')) {
      guessedCategory = 'CERTIFICATE';
      tags.push('REG', 'Registration');
    } else if (cleanTitle.toLowerCase().includes('audit') || cleanTitle.toLowerCase().includes('report') || cleanTitle.toLowerCase().includes('gstr9')) {
      guessedCategory = 'AUDIT_REPORT';
      tags.push('Audit', 'Reconciliation');
    } else if (cleanTitle.toLowerCase().includes('notice') || cleanTitle.toLowerCase().includes('scn') || cleanTitle.toLowerCase().includes('letter') || cleanTitle.toLowerCase().includes('appeal')) {
      guessedCategory = 'CORRESPONDENCE';
      tags.push('Department', 'Official');
    }

    setNewDocData(prev => ({
      ...prev,
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      category: guessedCategory,
      tagsString: tags.join(', '),
      issueDate: new Date().toISOString().split('T')[0]
    }));

    // Perform AI Classification if it's an image
    if (file.type.startsWith('image/')) {
      setIsClassifying(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            const res = await fetch('/api/document/classify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64data, mimeType: file.type })
            });
            if (res.ok) {
              const aiData = await res.json();
              if (aiData.category) {
                setNewDocData(prev => ({
                  ...prev,
                  category: aiData.category === 'NOTICE' ? 'CORRESPONDENCE' : (aiData.category || prev.category),
                  title: aiData.title || prev.title,
                  refNumber: aiData.refNumber || prev.refNumber,
                  description: aiData.summary || prev.description,
                  tagsString: prev.tagsString ? prev.tagsString + ', AI-Verified' : 'AI-Verified'
                }));
              }
            }
          } catch (e) {
            console.error('Failed AI classification:', e);
          } finally {
            setIsClassifying(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        console.error('Failed to read file:', e);
        setIsClassifying(false);
      }
    }
  };

  const autoTagDocument = (doc: DocumentRecord): DocumentRecord => {
    const content = `${doc.title} ${doc.description} ${doc.category}`.toLowerCase();
    const newTags = new Set(doc.tags);
    const initialSize = newTags.size;
    
    if (content.includes('gst r-1') || content.includes('gstr-1') || content.includes('gstr1')) newTags.add('GST R-1');
    if (content.includes('gst r-3b') || content.includes('gstr-3b') || content.includes('gstr3b')) newTags.add('GST R-3B');
    if (content.includes('gst r-9') || content.includes('gstr-9') || content.includes('gstr9')) newTags.add('GST R-9');
    if (content.includes('gst r-9c') || content.includes('gstr-9c') || content.includes('gstr9c')) newTags.add('GSTR-9C');
    if (content.includes('invoice') || content.includes('bill') || content.includes('facture')) newTags.add('Invoice');
    if (content.includes('bill of entry') || content.includes('boe')) newTags.add('Bill of Entry');
    if (content.includes('notice') || content.includes('scn') || content.includes('summons')) newTags.add('Legal Notice');
    if (content.includes('audit') || content.includes('reconciliation')) newTags.add('Audit');
    if (content.includes('challan') || content.includes('payment')) newTags.add('Challan');
    if (content.includes('certificate') || content.includes('registration') || content.includes('reg-06')) newTags.add('Certificate');
    if (content.includes('way bill') || content.includes('ewb') || content.includes('eway')) newTags.add('E-Way Bill');
    
    if (newTags.size > initialSize) {
      const newActivity = {
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        action: `Auto-tagged document based on AI content rules`,
        user: user?.name || 'System'
      };
      dispatchEmailNotification('Document Tagged: ' + doc.title, 'Document was auto-tagged with new AI content rules. New tags: ' + Array.from(newTags).join(', '), 'team@vault.local');
      return { ...doc, tags: Array.from(newTags), activityLog: [newActivity, ...(doc.activityLog || [])] };
    }
    
    return { ...doc, tags: Array.from(newTags) };
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.title) return;

    let generatedHash = computedFileHash || '';
    if (!generatedHash) {
      // Simulate high-fidelity SHA-256 computation
      const chars = '0123456789abcdef';
      for (let i = 0; i < 64; i++) {
        generatedHash += chars[Math.floor(Math.random() * chars.length)];
      }
    }

    if (!forceUpload) {
      // Check for duplicates
      const duplicateByRef = newDocData.refNumber ? documents.find(d => d.refNumber === newDocData.refNumber) : null;
      const duplicateByHash = computedFileHash ? documents.find(d => d.sha256Hash === computedFileHash) : null;
      
      if (duplicateByHash) {
        setDuplicateWarning(`Identical file hash detected. This exact file already exists as "${duplicateByHash.title}".`);
        return;
      }
      
      if (duplicateByRef) {
        setDuplicateWarning(`Matching Reference / Notice ID detected on "${duplicateByRef.title}".`);
        return;
      }
    }

    const processedTags = newDocData.tagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const sizeStr = uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB` : '320 KB';
    const typeStr = uploadFile ? uploadFile.type : 'application/pdf';

    let fileUrl;
    if (uploadFile) {
      fileUrl = URL.createObjectURL(uploadFile);
    }

    let newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      title: newDocData.title,
      refNumber: newDocData.refNumber || `REF/${newDocData.category.substring(0, 3)}/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
      category: newDocData.category,
      issueDate: newDocData.issueDate || new Date().toISOString().split('T')[0],
      uploadDate: new Date().toISOString().split('T')[0],
      replyDeadline: newDocData.replyDeadline || undefined,
      status: newDocData.replyDeadline ? 'PENDING_ACTION' : 'ACTIVE',
      tags: processedTags.length > 0 ? processedTags : [newDocData.category],
      description: newDocData.description || 'Securely archived regulatory compliance artifact.',
      fileSize: sizeStr,
      fileType: typeStr,
      sha256Hash: generatedHash,
      authorityName: newDocData.authorityName || 'State Indirect Tax Department',
      isConfidential: newDocData.isConfidential,
      fileUrl,
      activityLog: [
        {
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: `Archived secure record in compliance vault`,
          user: user?.name || 'Authorized Auditor'
        }
      ]
    };
    
    newDoc = autoTagDocument(newDoc);

    const updated = [newDoc, ...documents];
    saveToStorage(updated);
    if (newDoc.status === 'PENDING_ACTION') {
      dispatchEmailNotification('Action Required: ' + newDoc.title, 'A scanned invoice requires review before ' + newDoc.replyDeadline + '. Reference: ' + newDoc.refNumber, 'auditor@vault.local');
    }

    // Reset Form
    setNewDocData({
      title: '',
      refNumber: '',
      category: 'CERTIFICATE',
      issueDate: '',
      replyDeadline: '',
      status: 'ACTIVE',
      tagsString: '',
      description: '',
      authorityName: '',
      isConfidential: false
    });
    setUploadFile(null);
    closeUploadModal();
  };

  const handleInvoiceExtracted = (extractedData: ExtractedInvoiceData) => {
    const chars = '0123456789abcdef';
    let generatedHash = '';
    for (let i = 0; i < 64; i++) {
      generatedHash += chars[Math.floor(Math.random() * chars.length)];
    }

    let newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      title: `Scanned GST Invoice - ${extractedData.partyName || 'Unknown Vendor'}`,
      refNumber: extractedData.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'OTHER',
      issueDate: extractedData.date || new Date().toISOString().split('T')[0],
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      tags: ['Invoice-Scan', 'OCR-Extracted', extractedData.partyGstin ? 'Valid-GSTIN' : 'OCR-Verified'],
      description: `Automatically extracted tax invoice. GSTIN: ${extractedData.partyGstin || 'N/A'}. Taxable: ₹${(extractedData.taxableValue || 0).toLocaleString('en-IN')}. Total GST: ₹${(extractedData.totalGst || 0).toLocaleString('en-IN')}. Total Bill Amount: ₹${(extractedData.totalAmount || 0).toLocaleString('en-IN')}. Language/Format: ${extractedData.detectedLanguage || 'English'}.`,
      fileSize: '420 KB',
      fileType: 'image/jpeg',
      sha256Hash: generatedHash,
      authorityName: extractedData.partyName || 'Scanned Vendor',
      isConfidential: false,
      activityLog: [
        {
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: `Captured physical invoice using device camera and ran text recognition (OCR)`,
          user: user?.name || 'Authorized Auditor'
        }
      ]
    };
    
    newDoc = autoTagDocument(newDoc);

    const updated = [newDoc, ...documents];
    saveToStorage(updated);
    if (newDoc.status === 'PENDING_ACTION') {
      dispatchEmailNotification('Action Required: ' + newDoc.title, 'A new document requires review before ' + newDoc.replyDeadline + '. Reference: ' + newDoc.refNumber, 'auditor@vault.local');
    }
    setSelectedDoc(newDoc); // highlight it right away by opening the inspector!
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm('Are you sure you want to permanently delete this document and remove its secure digital signature from the vault? This action is irreversible.')) {
      const filtered = documents.filter(doc => doc.id !== id);
      saveToStorage(filtered);
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
    }
  };


  const [isTranslating, setIsTranslating] = useState(false);
  const handleTranslate = async () => {
    if (!selectedDoc) return;
    setIsTranslating(true);
    try {
      const response = await fetch('/api/v1/documents/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedDoc.description })
      });
      const result = await response.json();
      if (result.success) {
        // Update the selected document
        const updatedDoc = {
          ...selectedDoc,
          detectedLanguage: result.detectedLanguage,
          translatedText: result.translatedText
        };
        setSelectedDoc(updatedDoc);
        
        // Optionally update the list of documents
        setDocuments(docs => docs.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      } else {
        alert(result.error || 'Failed to translate');
      }
    } catch (e) {
      alert('Translation error');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Filter Documents
  const filteredDocuments = documents.filter(doc => {
    // 1. Category / Collection Filter
    if (activeCategory.startsWith('COLLECTION_')) {
      const collection = sharedCollections.find(c => c.id === activeCategory);
      if (collection) {
        // filter docs that have AT LEAST ONE of the collection tags
        const hasTag = doc.tags.some(t => collection.tags.includes(t));
        if (!hasTag) return false;
      }
    } else if (activeCategory !== 'ALL' && activeCategory !== 'OFFLINE_DRAFTS' && doc.category !== activeCategory) {
      return false;
    }

    // 2. Clicked Tag Filter
    if (selectedTag && !doc.tags.includes(selectedTag)) return false;

    // 3. Text Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      
      // Match title, refNumber, authority or tags
      const titleMatch = doc.title.toLowerCase().includes(q);
      const refMatch = doc.refNumber.toLowerCase().includes(q);
      const authMatch = doc.authorityName?.toLowerCase().includes(q);
      const tagMatch = doc.tags.some(t => t.toLowerCase().includes(q));

      return titleMatch || refMatch || authMatch || tagMatch;
    }

    return true;
  });

  // Calculate high-level compliance indicators
  const totalCertificates = documents.filter(d => d.category === 'CERTIFICATE').length;
  const totalAudits = documents.filter(d => d.category === 'AUDIT_REPORT').length;

  const handleAddComment = (content: string, parentId?: string, targetDocId?: string) => {
    const docId = targetDocId || selectedDoc?.id;
    if (!docId) return;
    
    const newComment: DocumentComment = {
      id: `comment-${Date.now()}`,
      authorName: user?.name || 'Current User',
      authorRole: user?.role || 'Auditor',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      content,
      replies: []
    };

    setDocuments(docs => docs.map(d => {
      if (d.id !== docId) return d;
      let updatedComments = [...(d.comments || [])];
      if (parentId) {
        updatedComments = updatedComments.map(c => {
          if (c.id === parentId) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        });
      } else {
        updatedComments.push(newComment);
      }
      const updated = { ...d, comments: updatedComments };
      if (selectedDoc?.id === docId) {
        setSelectedDoc(updated);
      }
      dispatchEmailNotification('New Comment on Document', 'A new comment was added to a document by ' + newComment.authorName + ': "' + newComment.content + '"', 'team@vault.local');
      return updated;
    }));
  };

  const handleDeleteComment = (id: string, parentId?: string, targetDocId?: string) => {
    const docId = targetDocId || selectedDoc?.id;
    if (!docId) return;

    setDocuments(docs => docs.map(d => {
      if (d.id !== docId) return d;
      let updatedComments = [...(d.comments || [])];
      if (parentId) {
        updatedComments = updatedComments.map(c => {
          if (c.id === parentId) {
            return { ...c, replies: (c.replies || []).filter(r => r.id !== id) };
          }
          return c;
        });
      } else {
        updatedComments = updatedComments.filter(c => c.id !== id);
      }
      const updated = { ...d, comments: updatedComments };
      if (selectedDoc?.id === docId) {
        setSelectedDoc(updated);
      }
      return updated;
    }));
  };

  const pendingActionsCount = documents.filter(d => d.status === 'PENDING_ACTION').length;

  const versionInputRef = useRef<HTMLInputElement>(null);
  const handleVersionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedDoc) return;
    const file = e.target.files[0];
    
    // Create new hash
    const chars = '0123456789abcdef';
    let generatedHash = '';
    for (let i = 0; i < 64; i++) {
      generatedHash += chars[Math.floor(Math.random() * chars.length)];
    }

    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const typeStr = file.type || 'application/pdf';
    const fileUrl = URL.createObjectURL(file);

    // Save current as version
    const currentAsVersion: DocumentVersion = {
      versionId: `v-${Date.now()}`,
      uploadDate: selectedDoc.uploadDate,
      fileSize: selectedDoc.fileSize,
      fileType: selectedDoc.fileType,
      sha256Hash: selectedDoc.sha256Hash,
      fileUrl: selectedDoc.fileUrl,
      user: 'System'
    };

    const newActivity = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      action: `Uploaded new version of document`,
      user: user?.name || 'Authorized Auditor'
    };

    const updatedDoc: DocumentRecord = {
      ...selectedDoc,
      fileSize: sizeStr,
      fileType: typeStr,
      sha256Hash: generatedHash,
      fileUrl,
      uploadDate: new Date().toISOString().split('T')[0],
      versions: [currentAsVersion, ...(selectedDoc.versions || [])],
      activityLog: [newActivity, ...selectedDoc.activityLog]
    };

    const updatedDocuments = documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
    setDocuments(updatedDocuments);
    saveToStorage(updatedDocuments);
    setSelectedDoc(updatedDoc);
    dispatchEmailNotification('Document Updated: ' + updatedDoc.title, 'A new version of this document has been uploaded.', 'team@vault.local');
    
    // Reset file input
    if (versionInputRef.current) versionInputRef.current.value = '';
  };

  const handleRestoreVersion = (version: DocumentVersion) => {
    if (!selectedDoc) return;
    
    // Save current as version
    const currentAsVersion: DocumentVersion = {
      versionId: `v-${Date.now()}`,
      uploadDate: selectedDoc.uploadDate,
      fileSize: selectedDoc.fileSize,
      fileType: selectedDoc.fileType,
      sha256Hash: selectedDoc.sha256Hash,
      fileUrl: selectedDoc.fileUrl,
      user: 'System'
    };

    const newActivity = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      action: `Restored document to previous version (${version.sha256Hash.substring(0, 8)})`,
      user: user?.name || 'Authorized Auditor'
    };

    // Filter out the version we are restoring, and add the current active as a version
    const otherVersions = (selectedDoc.versions || []).filter(v => v.versionId !== version.versionId);

    const updatedDoc: DocumentRecord = {
      ...selectedDoc,
      fileSize: version.fileSize,
      fileType: version.fileType,
      sha256Hash: version.sha256Hash,
      fileUrl: version.fileUrl,
      uploadDate: version.uploadDate,
      versions: [currentAsVersion, ...otherVersions].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()),
      activityLog: [newActivity, ...selectedDoc.activityLog]
    };

    const updatedDocuments = documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
    setDocuments(updatedDocuments);
    saveToStorage(updatedDocuments);
    setSelectedDoc(updatedDoc);
    dispatchEmailNotification('Document Version Restored', 'Document "' + updatedDoc.title + '" was restored to an older version.', 'team@vault.local');
  };

  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const handleAutoTagVault = async () => {
    setIsAutoTagging(true);
    // Simulate minor delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const updatedDocuments = documents.map(doc => autoTagDocument(doc));
    
    setDocuments(updatedDocuments);
    saveToStorage(updatedDocuments);
    setIsAutoTagging(false);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6" id="document-vault-dashboard">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shadow-inner">
            <Lock size={28} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Corporate Document Vault
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg">
                <ShieldCheck size={11} /> Cryptographic Seal Active
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Secure ledger storing GST registration certificates, statutory CA audit statements, and official tax notice correspondences.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleAutoTagVault}
            disabled={isAutoTagging}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Tag size={14} className={isAutoTagging ? "animate-pulse" : ""} /> 
            {isAutoTagging ? "Analyzing Vault..." : "Auto-Tag Vault"}
          </button>
          <button 
            onClick={() => setIsCameraScannerOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-100"
          >
            <Camera size={14} /> Scan Physical Invoice
          </button>
          <button 
            onClick={() => openUploadModal()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
          >
            <Upload size={14} /> Deposit Document
          </button>
        </div>
      </div>

      {/* High-Level Vault Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">GST Certificates</span>
            <span className="text-lg font-black text-slate-800">{totalCertificates} Active Certs</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ClipboardList size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Audits & Reports</span>
            <span className="text-lg font-black text-slate-800">{totalAudits} Filed Audit Reports</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={20} className={pendingActionsCount > 0 ? "animate-spin-slow text-amber-600" : ""} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Pending Actions</span>
            <span className={`text-lg font-black ${pendingActionsCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {pendingActionsCount} Urgent Notice Replies
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SHA-256 Verification</span>
            <span className="text-lg font-black text-slate-800">100% Immutable Seals</span>
          </div>
        </div>
      </div>

      {/* Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Filter & Tags Column */}
        <div className="space-y-4 lg:col-span-1">
          
          {/* Main Category Selector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Filter size={12} /> Classifications
            </h3>
            {[
              { id: 'ALL', label: 'All Documents', count: documents.length, icon: FileText },
              { id: 'CERTIFICATE', label: 'GST Certificates', count: totalCertificates, icon: Award },
              { id: 'AUDIT_REPORT', label: 'Audit Reports', count: totalAudits, icon: ClipboardList },
              { id: 'CORRESPONDENCE', label: 'Official Correspondence', count: documents.filter(d => d.category === 'CORRESPONDENCE').length, icon: Mail },
              { id: 'INVOICE', label: 'Invoices', count: documents.filter(d => d.category === 'INVOICE').length, icon: FileText },
              { id: 'OTHER', label: 'Other Appendices', count: documents.filter(d => d.category === 'OTHER').length, icon: FileText },
              { id: 'OFFLINE_DRAFTS', label: 'Local Drafts', count: offlineDrafts?.length || 0, icon: Database }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id as any); setSelectedTag(null); }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === cat.id 
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <cat.icon size={14} className={activeCategory === cat.id ? "text-indigo-600" : "text-slate-400"} />
                  <span>{cat.label}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeCategory === cat.id ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-100 text-slate-500'}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Permission-based Shared Collections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FolderKey size={12} /> Secure Workspaces
              </h3>
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="text-[10px] font-black text-indigo-600 hover:underline"
              >
                Manage
              </button>
            </div>
            {sharedCollections.map(collection => (
              <button
                key={collection.id}
                onClick={() => { setActiveCategory(collection.id); setSelectedTag(null); }}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === collection.id 
                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
                title={`Roles: ${collection.allowedRoles.join(', ')}`}
              >
                <div className="flex items-center gap-2">
                  <FolderKey size={14} className={activeCategory === collection.id ? "text-blue-600" : "text-slate-400"} />
                  <span>{collection.name}</span>
                </div>
              </button>
            ))}
          </div>

          
          {/* Data Governance & Retention */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mt-8 -mr-8" />
            <div className="flex items-center justify-between mb-1 relative z-10">
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Database size={12} /> Data Governance
              </h3>
              <button 
                onClick={() => setIsRetentionModalOpen(true)}
                className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wide"
              >
                Configure
              </button>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${retentionPolicy.isActive ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${retentionPolicy.isActive ? 'text-white' : 'text-slate-400'}`}>
                  {retentionPolicy.isActive ? `Retention: ${retentionPolicy.years} Years` : 'Retention Inactive'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {retentionPolicy.isActive 
                    ? `Auto-${retentionPolicy.action.toLowerCase()} aging records.`
                    : 'Prevent storage bloat.'}
                </p>
              </div>
            </div>
          </div>

          {/* Secure Tag Index & Workspace Search */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag size={12} /> Filter by Tags
              </h3>
              {selectedTag && (
                <button 
                  onClick={() => setSelectedTag(null)}
                  className="text-[10px] font-black text-rose-600 hover:underline"
                >
                  Clear Tag
                </button>
              )}
            </div>

            {allTags.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-medium">No tags available.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => {
                  const isTagSelected = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isTagSelected ? null : tag)}
                      className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                        isTagSelected 
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compliance SCN Timeline Widget */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-2xl space-y-2.5">
            <h4 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-600" /> Correspondence Deadlines
            </h4>
            <div className="space-y-2">
              {documents.filter(d => d.status === 'PENDING_ACTION').map(doc => (
                <div key={doc.id} className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-xs space-y-1">
                  <p className="text-[11px] font-bold text-slate-800 truncate">{doc.title}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <Clock size={10} /> Due: {doc.replyDeadline}
                    </span>
                    <button 
                      onClick={() => setSelectedDoc(doc)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Review SCN
                    </button>
                  </div>
                  
                  {/* Threaded Comments Section */}
                  <div className="pt-3 border-t border-slate-100">
                    <DocumentCommentThread 
                      comments={doc.comments || []}
                      onAddComment={(content, parentId) => handleAddComment(content, parentId, doc.id)}
                      onDeleteComment={(id, parentId) => handleDeleteComment(id, parentId, doc.id)}
                    />
                  </div>

                </div>
              ))}
              {documents.filter(d => d.status === 'PENDING_ACTION').length === 0 && (
                <p className="text-[11px] text-slate-500 font-medium">✅ All department queries and Show Cause Notices have been responded to.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Search, Grid and List Column */}
        <div className="lg:col-span-3 space-y-4">
          
          {activeCategory === 'OFFLINE_DRAFTS' ? (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-6">
               <div className="flex items-center gap-2 mb-4 text-orange-700">
                  <Database size={24} />
                  <h3 className="text-lg font-bold">Local Offline Drafts</h3>
               </div>
               
               {!isOnline && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                    <CloudOff size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800">You are currently offline</h4>
                      <p className="text-xs text-amber-700 mt-1">Changes are saved locally. You can sync these drafts when your connection is restored.</p>
                    </div>
                  </div>
               )}
               
               {(!offlineDrafts || offlineDrafts.length === 0) ? (
                 <div className="py-12 text-center text-slate-500">
                   <Database size={48} className="mx-auto mb-4 text-slate-300" />
                   <p>No local drafts found.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {offlineDrafts.map(draft => (
                      <div key={draft.id} className="border border-slate-200 p-4 rounded-xl bg-slate-50 flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{draft.data?.title || 'Untitled Document'}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">Saved: {new Date(draft.updatedAt).toLocaleString()}</p>
                          </div>
                          <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded">LOCAL ONLY</span>
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-2">
                          Category: {draft.data?.category} <br/>
                          Ref No: {draft.data?.refNumber || 'N/A'}
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-auto pt-2">
                           <button onClick={() => deleteDraft(draft.id)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1">
                             <Trash2 size={12} /> Discard
                           </button>
                           <button onClick={() => alert("Sync functionality to be connected. Draft Data: " + JSON.stringify(draft.data))} disabled={!isOnline} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1 transition-colors">
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
            {/* Live Activity Feed */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 mb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-500" /> Live Activity Feed
                </h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {documents
                  .flatMap(doc => (doc.activityLog || []).map(log => ({ ...log, docTitle: doc.title, docId: doc.id, status: doc.status })))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((activity, idx) => (
                    <div key={idx} className="w-[280px] shrink-0 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${activity.status === 'PENDING_ACTION' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {activity.status === 'PENDING_ACTION' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5 truncate">{activity.date} • {activity.user}</p>
                        <p className="text-xs font-bold text-slate-700 leading-tight line-clamp-2">{activity.action}</p>
                        <p className="text-[10px] font-medium text-slate-500 truncate mt-1 border-t border-slate-200/60 pt-1">{activity.docTitle}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Tag-based Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, reference no, authority, or #tag name..."
                className="w-full text-xs font-semibold bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-4 focus:outline-none transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-bold text-slate-400">Matches:</span>
              <span className="text-xs font-black px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/80">
                {filteredDocuments.length} Documents
              </span>
            </div>
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 flex flex-col items-center">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-full border border-slate-100">
                <FileText size={36} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">No Documents Found</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  We couldn't find any documents matching the category selection, search terms, or active tags inside the vault.
                </p>
              </div>
              {(searchQuery || selectedTag) && (
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedTag(null); setActiveCategory('ALL'); }}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map(doc => {
                const isUrgent = doc.status === 'PENDING_ACTION';
                
                return (
                  <div 
                    key={doc.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group ${
                      isUrgent ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        {/* Title & Icon */}
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-xl ${
                            doc.category === 'CERTIFICATE' ? 'bg-indigo-50 text-indigo-600' :
                            doc.category === 'AUDIT_REPORT' ? 'bg-emerald-50 text-emerald-600' :
                            doc.category === 'CORRESPONDENCE' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {doc.category === 'CERTIFICATE' ? <Award size={18} /> :
                             doc.category === 'AUDIT_REPORT' ? <ClipboardList size={18} /> :
                             <Mail size={18} />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-relaxed">
                              {doc.title}
                            </h4>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{doc.refNumber}</p>
                          </div>
                        </div>

                        {/* Status chip */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase whitespace-nowrap ${
                            doc.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            doc.status === 'REPLIED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            doc.status === 'PENDING_ACTION' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                            'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {doc.status.replace('_', ' ')}
                          </span>
                          {isRetentionFlagged(doc) && (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase whitespace-nowrap bg-rose-50 text-rose-700 border-rose-200 animate-pulse flex items-center gap-1 shadow-sm">
                              <Archive size={8} /> {retentionPolicy.action === 'ARCHIVE' ? 'Archival Due' : 'Purge Due'}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-normal line-clamp-2 pl-10">
                        {doc.description}
                      </p>
                    </div>

                    {/* Metadata Footer */}
                    <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-400 pl-10">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span>Issued: {doc.issueDate}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">
                          {doc.fileSize}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedDoc(doc)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                            title="Inspect metadata and visual template"
                          >
                            <Eye size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md"
                            title="Delete permanently"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Custom Tag Badges */}
                    <div className="flex flex-wrap gap-1 pl-10">
                      {doc.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] font-black px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-200/60">
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-[9px] font-black px-1 py-0.5 text-slate-400">
                          +{doc.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* MODAL: DOCUMENT DEPOSIT DRAG-N-DROP DRAWER */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
                    <FileUp size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Deposit Compliance Artifact</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Upload historical filings, registration letters or show cause notices safely</p>
                  </div>
                </div>
                <button 
                  onClick={() => closeUploadModal()}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleUploadSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
                
                {/* Drag n Drop zone */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer text-center ${
                    uploadFile 
                      ? 'border-indigo-300 bg-indigo-50/20' 
                      : isDragging 
                      ? 'border-indigo-500 bg-slate-50' 
                      : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                  />
                  <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full shadow-xs">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {uploadFile ? uploadFile.name : 'Drag & Drop PDF or scan copies here'}
                    </p>
                    {isClassifying ? (
                      <p className="text-[10px] text-indigo-600 font-bold mt-1 animate-pulse">
                        Analyzing document with AI...
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Supports PDF, PNG or Excel up to 25MB. Will automatically compute digital SHA-256 seal.
                      </p>
                    )}
                  </div>
                </div>

                {/* Grid inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Document Title *</label>
                    <input 
                      type="text" 
                      required
                      value={newDocData.title}
                      onChange={(e) => setNewDocData({ ...newDocData, title: e.target.value })}
                      placeholder="e.g. REG-06 GST Registration"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Reference / Notice ID</label>
                    <input 
                      type="text" 
                      value={newDocData.refNumber}
                      onChange={(e) => setNewDocData({ ...newDocData, refNumber: e.target.value })}
                      placeholder="e.g. SCN/73/2026/012"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Document Classification</label>
                    <select
                      value={newDocData.category}
                      onChange={(e) => setNewDocData({ ...newDocData, category: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold"
                    >
                      <option value="CERTIFICATE">GST Certificate</option>
                      <option value="AUDIT_REPORT">Audit / Financial Statement</option>
                      <option value="CORRESPONDENCE">Official Correspondence / Notice</option>
                      <option value="OTHER">Other Documents</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Authority / Issuing Body</label>
                    <input 
                      type="text" 
                      value={newDocData.authorityName}
                      onChange={(e) => setNewDocData({ ...newDocData, authorityName: e.target.value })}
                      placeholder="e.g. Superintendent Ward 11"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Issue Date *</label>
                    <input 
                      type="date" 
                      required
                      value={newDocData.issueDate}
                      onChange={(e) => setNewDocData({ ...newDocData, issueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center gap-1 text-amber-700">
                      Reply Deadline <span className="text-[10px] font-normal">(if notice)</span>
                    </label>
                    <input 
                      type="date" 
                      value={newDocData.replyDeadline}
                      onChange={(e) => setNewDocData({ ...newDocData, replyDeadline: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700">Metadata Tags <span className="text-[10px] text-slate-400">(Comma separated)</span></label>
                  <input 
                    type="text" 
                    value={newDocData.tagsString}
                    onChange={(e) => setNewDocData({ ...newDocData, tagsString: e.target.value })}
                    placeholder="e.g. FY 2026-27, Audited, CA Signed, Urgent"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700">Core Summary Description</label>
                  <textarea 
                    value={newDocData.description}
                    onChange={(e) => setNewDocData({ ...newDocData, description: e.target.value })}
                    placeholder="Briefly state what compliance audit, certificate detail, or official response is held in this document record..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <input 
                    type="checkbox"
                    id="confidentialCheck"
                    checked={newDocData.isConfidential}
                    onChange={(e) => setNewDocData({ ...newDocData, isConfidential: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="confidentialCheck" className="text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer">
                    <Lock size={12} className="text-slate-500" /> Restrict access as Audit Confidential
                  </label>
                </div>
                
                {duplicateWarning && (
                  <div className="p-4 mt-2 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl shadow-sm">
                    <p className="text-sm font-bold text-rose-800 mb-1 flex items-center gap-2">
                      <AlertTriangle size={16} /> Duplicate Detection Alert
                    </p>
                    <p className="text-xs text-rose-700 mb-3">{duplicateWarning}</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id="forceUploadCheck"
                        checked={forceUpload}
                        onChange={(e) => setForceUpload(e.target.checked)}
                        className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      />
                      <label htmlFor="forceUploadCheck" className="text-xs font-bold text-rose-700 cursor-pointer">
                        Acknowledge and deposit duplicate record anyway
                      </label>
                    </div>
                  </div>
                )}
              </form>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => closeUploadModal()}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    saveDraft(Date.now().toString(), newDocData);
                    closeUploadModal();
                    setActiveCategory('OFFLINE_DRAFTS');
                  }}
                  className="px-4 py-2 border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all"
                >
                  <Database size={14} /> Save Draft
                </button>
                <button 
                  onClick={handleUploadSubmit}
                  disabled={!isOnline || (!!duplicateWarning && !forceUpload)}
                  className={`px-6 py-2 ${(!isOnline || (!!duplicateWarning && !forceUpload)) ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2`}
                >
                  {duplicateWarning && forceUpload ? 'Deposit Anyway' : 'Secure Deposit'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: HIGH-FIDELITY DOCUMENT DETAIL INSPECTOR */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">{selectedDoc.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Vault ID: {selectedDoc.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Grid split Workspace */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-5 min-h-0">
                
                {/* Left Side: Metadata & Security Log (2 cols) */}
                <div className="md:col-span-2 p-6 border-r border-slate-100 space-y-5 bg-slate-50/50">
                  
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Classification</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg">
                        {selectedDoc.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-bold border rounded-lg ${
                        selectedDoc.status === 'PENDING_ACTION' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {selectedDoc.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Content / Description</span>
                      {selectedDoc.category === 'INVOICE' && (
                        <button
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                        >
                          <Sparkles size={12} className={isTranslating ? 'animate-pulse' : ''} />
                          {isTranslating ? 'Detecting Language...' : 'Translate Invoice'}
                        </button>
                      )}
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200/50 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {selectedDoc.description}
                      </p>
                      {selectedDoc.translatedText && (
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
                              Detected: {selectedDoc.detectedLanguage}
                            </span>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                              Translated to English
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {selectedDoc.translatedText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Index Tags</span>
                      <button
                        onClick={() => {
                          const updated = autoTagDocument(selectedDoc);
                          setSelectedDoc(updated);
                          const newDocs = documents.map(d => d.id === updated.id ? updated : d);
                          setDocuments(newDocs);
                          saveToStorage(newDocs);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100"
                      >
                        <Tag size={12} />
                        Auto-Tag
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedDoc.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase tracking-wide border border-slate-200">
                          {tag}
                        </span>
                      ))}
                      {selectedDoc.tags.length === 0 && (
                        <span className="text-xs font-medium text-slate-400 italic">No tags applied.</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Reference No</span>
                      <span className="font-mono font-bold text-slate-800">{selectedDoc.refNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Issue Date</span>
                      <span className="font-bold text-slate-800">{selectedDoc.issueDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Upload Timestamp</span>
                      <span className="font-bold text-slate-800">{selectedDoc.uploadDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">File Metadata</span>
                      <span className="font-bold text-slate-800">{selectedDoc.fileSize} ({selectedDoc.fileType.split('/')[1]?.toUpperCase()})</span>
                    </div>
                  </div>

                  {selectedDoc.replyDeadline && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-rose-800">
                      <AlertCircle className="text-rose-600" size={16} />
                      <div>
                        <p>Reply Deadline Required</p>
                        <p className="text-[10px] text-rose-600 font-medium">Please submit your correspondence appeal before {selectedDoc.replyDeadline}.</p>
                      </div>
                    </div>
                  )}

                  {/* SHA-256 Tamper Proof Validation Card */}
                  <div className="p-3 bg-indigo-950 text-white rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                        <Key size={12} /> Crypto Seal Checksum
                      </span>
                      <button 
                        onClick={() => copyHash(selectedDoc.sha256Hash)}
                        className="text-[10px] font-black text-indigo-400 hover:text-white"
                      >
                        {copiedHash === selectedDoc.sha256Hash ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[9px] font-mono break-all text-slate-300 border border-indigo-800 bg-indigo-950/80 p-2 rounded-xl">
                      {selectedDoc.sha256Hash}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                      <ShieldCheck size={11} /> Cryptographic Seal matches GSP registry node
                    </div>
                  </div>

                  {/* Activity Log Trail */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Vault Verification Log</span>
                    <div className="space-y-2 max-h-36 overflow-y-auto pl-1">
                      {selectedDoc.activityLog.map((log, i) => (
                        <div key={i} className="relative pl-4 border-l border-slate-200 text-[11px] space-y-0.5 pb-2 last:pb-0">
                          <div className="absolute left-[-4.5px] top-1 w-2 h-2 rounded-full bg-slate-400 border border-white" />
                          <p className="text-slate-700 font-bold leading-none">{log.action}</p>
                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                            <span>By {log.user}</span>
                            <span>{log.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Version Control History */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Version History</span>
                      <button 
                        onClick={() => versionInputRef.current?.click()}
                        className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                      >
                        <FileUp size={10} /> Upload New Revision
                      </button>
                      <input 
                        type="file" 
                        ref={versionInputRef}
                        onChange={handleVersionUpload}
                        className="hidden" 
                        accept="application/pdf,image/*" 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      {/* Current Active Version */}
                      <div className="p-2 border border-indigo-200 bg-indigo-50/50 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-indigo-800">Current (Active)</span>
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded">Latest</span>
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">{selectedDoc.uploadDate} • {selectedDoc.fileSize}</div>
                        </div>
                      </div>

                      {/* Older Versions */}
                      {(selectedDoc.versions || []).map(v => (
                        <div key={v.versionId} className="p-2 border border-slate-200 bg-white rounded-xl flex items-center justify-between group hover:border-slate-300 transition-colors">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700">{v.user}</span>
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">{v.uploadDate} • {v.fileSize}</div>
                          </div>
                          <button 
                            onClick={() => handleRestoreVersion(v)}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-all"
                          >
                            <RotateCw size={10} /> Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Threaded Discussion in Modal */}
                  <div className="pt-3 border-t border-slate-200">
                    <DocumentCommentThread 
                      comments={selectedDoc.comments || []}
                      onAddComment={(content, parentId) => handleAddComment(content, parentId, selectedDoc.id)}
                      onDeleteComment={(id, parentId) => handleDeleteComment(id, parentId, selectedDoc.id)}
                    />
                  </div>

                </div>

                {/* Right Side: High-fidelity visual mockup of document (3 cols) */}
                <div className="md:col-span-3 p-6 flex flex-col items-center justify-center bg-slate-100 min-h-[400px]">
                  
                  {/* Visual Document Mockup depending on category */}
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-full max-w-md aspect-[3/4] p-8 flex flex-col justify-between relative overflow-hidden font-serif select-none">
                    
                    {/* Background seal watermarks */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                      <Lock size={200} />
                    </div>

                    {/* Gov style borders */}
                    <div className="absolute inset-2 border border-slate-300 pointer-events-none" />
                    <div className="absolute inset-3 border-2 border-double border-slate-200 pointer-events-none" />

                    {/* Document Header */}
                    <div className="text-center space-y-1.5 z-10 font-sans">
                      <div className="flex justify-center gap-1.5 mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                        <span>GOVERNMENT OF INDIA</span>
                        <span>•</span>
                        <span>DEPARTMENT OF REVENUE</span>
                      </div>
                      
                      {selectedDoc.category === 'CERTIFICATE' ? (
                        <>
                          <Award size={24} className="mx-auto text-indigo-600" />
                          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">FORM GST REG-06</h4>
                          <p className="text-[9px] font-bold text-slate-500">REGISTRATION CERTIFICATE FOR BUSINESS ENTITIES</p>
                        </>
                      ) : selectedDoc.category === 'AUDIT_REPORT' ? (
                        <>
                          <ClipboardList size={24} className="mx-auto text-emerald-600" />
                          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">FORM GST GSTR-9C</h4>
                          <p className="text-[9px] font-bold text-slate-500">STATUTORY RECONCILIATION AUDIT REPORT</p>
                        </>
                      ) : (
                        <>
                          <Mail size={24} className="mx-auto text-amber-600" />
                          <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">SHOW CAUSE NOTICE u/s 73</h4>
                          <p className="text-[9px] font-bold text-slate-500">CGST ACT REVENUE CORRESPONDENCE</p>
                        </>
                      )}
                    </div>

                    {/* Document Content Mock Table/Details */}
                    <div className="flex-1 flex flex-col justify-center space-y-4 my-4 font-sans text-xs">
                      
                      <div className="space-y-1 border-b border-dashed border-slate-200 pb-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <span>REGISTRY REFERENCE NUMBER</span>
                          <span>REGISTRATION STATE</span>
                        </div>
                        <div className="flex justify-between font-mono font-bold text-slate-800">
                          <span>{selectedDoc.refNumber.split('-')[0] || selectedDoc.refNumber}</span>
                          <span>MAHARASHTRA (27)</span>
                        </div>
                      </div>

                      {selectedDoc.category === 'CERTIFICATE' ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="font-bold text-slate-400 block">TRADE LEGAL NAME</span>
                              <span className="font-black text-slate-800">TAXFLOW SAAS CORP</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400 block">GSTIN NUMBER</span>
                              <span className="font-mono font-black text-indigo-700">27AAAAA0000A1Z5</span>
                            </div>
                          </div>
                          
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] text-slate-500 leading-normal">
                            This is to certify that the business enterprise listed above has been registered under Section 25(1) of the Central Goods and Services Tax Act, 2017.
                          </div>
                        </div>
                      ) : selectedDoc.category === 'AUDIT_REPORT' ? (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] font-medium space-y-1.5">
                            <div className="flex justify-between text-slate-500 font-bold border-b border-slate-200 pb-1">
                              <span>RECONCILIATION HEADS</span>
                              <span>DIFFERENCE</span>
                            </div>
                            <div className="flex justify-between text-slate-700 font-mono">
                              <span>Annual Turnover declared</span>
                              <span className="text-emerald-600 font-bold">₹0.00 (Perfect Match)</span>
                            </div>
                            <div className="flex justify-between text-slate-700 font-mono">
                              <span>Unreconciled Input Credit</span>
                              <span className="text-emerald-600 font-bold">₹0.00 (No mismatch)</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-600 font-medium leading-relaxed italic">
                            "You are hereby required to explain mismatches regarding GSTR-2B input pools and GSTR-3B filed values. Please provide reconciling spreadsheets within 30 days of the date listed."
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-2">
                        <div>
                          <span className="block font-bold">ISSUING AUTHORITY</span>
                          <span className="font-bold text-slate-700">{selectedDoc.authorityName || 'Department of GST Office'}</span>
                        </div>
                      </div>

                    </div>

                    {/* Official Stamp Simulation */}
                    <div className="flex justify-between items-end">
                      <div className="text-[9px] font-mono text-slate-400">
                        <span>Digital Seal: SHA-256 Verified</span>
                      </div>
                      
                      <div className="w-16 h-16 rounded-full border-4 border-indigo-400/30 flex flex-col items-center justify-center text-center rotate-[-12deg] relative select-none">
                        <ShieldCheck size={20} className="text-indigo-400/40" />
                        <span className="text-[7px] font-black text-indigo-400/40 tracking-widest uppercase">SECURE</span>
                        <span className="text-[6px] font-mono text-indigo-400/40">VAULT</span>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteDoc(selectedDoc.id)}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                >
                  <Trash2 size={14} /> Permanently Delete
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsPdfPreviewOpen(true)}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                  >
                    <Eye size={14} /> View PDF Document
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedDoc(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Close
                  </button>
                  <button 
                    type="button"
                    onClick={() => { alert('Downloading official encrypted PDF container directly from GSP server network...'); }}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                  >
                    <Download size={14} /> Download Secure Copy
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        fileUrl={selectedDoc?.fileUrl || 'data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCidJRgo+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqCjw8IC9MZW5ndGggMzkgPj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgowIDAgMApyZwowIDUwIFRECihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjcgMDAwMDAgbiAKMDAwMDAwMDEyMyAwMDAwMCBuIAowMDAwMDAwMjQ5IDAwMDAwIG4gCjAwMDAwMDAzNDEgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzkwCiUlRU9GCg=='}
        documentTitle={selectedDoc?.title}
        annotations={selectedDoc?.annotations || []}
        activityLog={selectedDoc?.activityLog || []}
        onSaveAnnotations={(annotations, actionSummary) => {
          if (selectedDoc) {
            const newActivity = actionSummary ? {
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              action: actionSummary,
              user: user?.name || 'System'
            } : null;
            
            const newLog = newActivity ? [newActivity, ...(selectedDoc.activityLog || [])] : selectedDoc.activityLog || [];
            const updatedDoc = { ...selectedDoc, annotations, activityLog: newLog };
            setSelectedDoc(updatedDoc);
            const newDocs = documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
            setDocuments(newDocs);
            saveToStorage(newDocs);
          }
        }}
        currentUser={user?.name || 'Authorized Auditor'}
      />

      <DocumentCameraScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onInvoiceExtracted={handleInvoiceExtracted}
        defaultCategory="PURCHASE"
      />

      
      {/* DATA GOVERNANCE & RETENTION MODAL */}
      <AnimatePresence>
        {isRetentionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wide">Data Governance</h3>
                    <p className="text-xs text-slate-400 font-medium">Configure document retention policies</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Enforce Retention Policy</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically manage aging documents.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={retentionPolicy.isActive}
                      onChange={(e) => setRetentionPolicy(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {retentionPolicy.isActive && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-5"
                  >
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Retention Period</label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          value={retentionPolicy.years} 
                          onChange={(e) => setRetentionPolicy(prev => ({ ...prev, years: parseInt(e.target.value) }))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 w-24 text-center shrink-0">
                          {retentionPolicy.years} Years
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">Standard tax compliance recommends a 7-year retention period.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">Action After Expiry</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setRetentionPolicy(prev => ({ ...prev, action: 'ARCHIVE' }))}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            retentionPolicy.action === 'ARCHIVE' 
                              ? 'border-indigo-600 bg-indigo-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mb-2 ${retentionPolicy.action === 'ARCHIVE' ? 'text-indigo-600' : 'text-slate-400'}`}>
                            <Archive size={20} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-800">Cold Storage</h5>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">Archive to cheaper cold storage. Recoverable.</p>
                        </button>

                        <button 
                          onClick={() => setRetentionPolicy(prev => ({ ...prev, action: 'DELETE' }))}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            retentionPolicy.action === 'DELETE' 
                              ? 'border-rose-600 bg-rose-50/50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`mb-2 ${retentionPolicy.action === 'DELETE' ? 'text-rose-600' : 'text-slate-400'}`}>
                            <Trash2 size={20} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-800">Permanent Deletion</h5>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">Permanently purge from all databases.</p>
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">Data Impact Warning</p>
                        <p className="text-[10px] text-amber-700 mt-1">
                          This policy will immediately flag <strong>{documents.filter(isRetentionFlagged).length}</strong> document(s) currently in your vault for {retentionPolicy.action === 'ARCHIVE' ? 'archival' : 'deletion'}.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={handleExecuteRetention}
                  className="px-4 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                  title="Manually trigger the retention policy"
                >
                  <AlertTriangle size={14} /> Execute Policy Now
                </button>
                <button 
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Policy Config
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANAGE SECURE WORKSPACES MODAL */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <FolderKey size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Secure Workspaces</h3>
                    <p className="text-xs text-slate-500 font-medium">Manage role-based access control for document sub-collections</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
                {sharedCollections.map(collection => (
                  <div key={collection.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-slate-100 text-slate-600`}>
                          <FolderKey size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{collection.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{collection.description}</p>
                        </div>
                      </div>
                      <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-bold">
                        <CheckCircle2 size={12} /> Active
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Authorized Roles</span>
                        <div className="flex flex-wrap gap-1.5">
                          {collection.allowedRoles.map(role => (
                            <span key={role} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200/60">
                              <Shield size={10} /> {role}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Included Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                          {collection.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> Create New Secure Workspace
                </button>
              </div>

              <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default DocumentVaultPage;
