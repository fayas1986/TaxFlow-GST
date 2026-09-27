// Customer & Vendor Master Service
// Handles storage, validation, GSTIN structure extraction, and filtering for Parties

import { safeStorage } from '../utils/safeStorage';

export type MsmeStatus = 'MICRO' | 'SMALL' | 'MEDIUM' | 'NON_MSME';

export type CreditTerms = 
  | 'NET_15'
  | 'NET_30'
  | 'NET_45'
  | 'NET_60'
  | 'NET_90'
  | 'DUE_ON_RECEIPT'
  | 'ADVANCE';

export interface PartyContact {
  name: string;
  email: string;
  phone: string;
  designation?: string;
}

export interface CustomerMaster {
  id: string;
  customerCode: string;
  name: string;
  tradeName?: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  stateCode: string;
  contact: PartyContact;
  creditTerms: CreditTerms;
  creditLimitINR?: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

export interface VendorMaster {
  id: string;
  vendorCode: string;
  name: string;
  tradeName?: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  stateCode: string;
  contact: PartyContact;
  reverseCharge: boolean; // RCM Applicable
  compositionScheme: boolean; // Composition Scheme Taxpayer
  msmeStatus: MsmeStatus;
  udyamRegistrationNo?: string;
  vendorCategories: string[];
  creditTerms: CreditTerms;
  status: 'ACTIVE' | 'INACTIVE';
  bankDetails?: BankDetails;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const CUSTOMER_STORAGE_KEY = 'TF_CUSTOMER_MASTER_V1';
const VENDOR_STORAGE_KEY = 'TF_VENDOR_MASTER_V1';

// Available Vendor Category Presets
export const VENDOR_CATEGORY_OPTIONS = [
  'Raw Material & Tooling',
  'Freight & Goods Transport (GTA)',
  'Legal & Professional Services',
  'IT & SaaS Services',
  'Logistics & Warehousing',
  'Capital Goods & Machinery',
  'Maintenance & Repairs',
  'Packaging Materials',
  'Contract Labor & Staffing',
  'Subcontracting & Job Work',
  'Marketing & Advertising',
  'Utilities & Rent'
];

export const CREDIT_TERMS_LABELS: Record<CreditTerms, string> = {
  NET_15: 'Net 15 Days',
  NET_30: 'Net 30 Days',
  NET_45: 'Net 45 Days',
  NET_60: 'Net 60 Days',
  NET_90: 'Net 90 Days',
  DUE_ON_RECEIPT: 'Due on Receipt',
  ADVANCE: '100% Advance Payment'
};

export const MSME_STATUS_LABELS: Record<MsmeStatus, { label: string; badge: string; desc: string }> = {
  MICRO: { label: 'Micro Enterprise', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', desc: 'Investment <= ₹1 Cr & Turnover <= ₹5 Cr' },
  SMALL: { label: 'Small Enterprise', badge: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'Investment <= ₹10 Cr & Turnover <= ₹50 Cr' },
  MEDIUM: { label: 'Medium Enterprise', badge: 'bg-purple-100 text-purple-800 border-purple-300', desc: 'Investment <= ₹50 Cr & Turnover <= ₹250 Cr' },
  NON_MSME: { label: 'Non-MSME Large Enterprise', badge: 'bg-slate-100 text-slate-700 border-slate-300', desc: 'Large Enterprise Exceeding MSME Criteria' }
};

// Initial Mock Seed Data
const INITIAL_CUSTOMERS: CustomerMaster[] = [
  {
    id: 'cust-101',
    customerCode: 'CUST-2026-001',
    name: 'Reliance Retail Limited',
    tradeName: 'Reliance Smart & Digital',
    gstin: '27AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    address: 'Reliance Corporate Park, Building 4, Thane Belapur Road',
    city: 'Navi Mumbai',
    pincode: '400701',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Rajesh Verma',
      email: 'rajesh.v@relianceretail.com',
      phone: '+91 98200 11223',
      designation: 'Senior General Manager - Accounts Payable'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 5000000,
    status: 'ACTIVE',
    notes: 'Key Enterprise Account. Requires monthly E-Invoicing B2B CSV upload before 5th.',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-07-20T14:30:00Z'
  },
  {
    id: 'cust-102',
    customerCode: 'CUST-2026-002',
    name: 'Tata Consultancy Services Ltd',
    tradeName: 'TCS Innovation Labs',
    gstin: '27AAACT2727Q1ZB',
    pan: 'AAACT2727Q',
    address: 'TCS House, Raveline Street, Fort',
    city: 'Mumbai',
    pincode: '400001',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Priya Mehta',
      email: 'p.mehta@tcs.com',
      phone: '+91 98190 44556',
      designation: 'Head of Finance & Procurement'
    },
    creditTerms: 'NET_45',
    creditLimitINR: 12000000,
    status: 'ACTIVE',
    notes: 'Requires Digital Signature on all Debit Notes & Tax Invoices.',
    createdAt: '2026-02-15T09:30:00Z',
    updatedAt: '2026-06-18T11:20:00Z'
  },
  {
    id: 'cust-103',
    customerCode: 'CUST-2026-003',
    name: 'Infosys Limited',
    tradeName: 'Infosys SEZ Campus',
    gstin: '29AAACI4843L1ZD',
    pan: 'AAACI4843L',
    address: 'Plot 44, Electronics City, Hosur Road',
    city: 'Bengaluru',
    pincode: '560100',
    state: 'Karnataka',
    stateCode: '29',
    contact: {
      name: 'Suresh Rao',
      email: 'suresh.rao@infosys.com',
      phone: '+91 98450 77889',
      designation: 'VP - Tax Operations'
    },
    creditTerms: 'NET_60',
    creditLimitINR: 8500000,
    status: 'ACTIVE',
    notes: 'SEZ Unit supply with payment of tax under LUT endorsement.',
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-07-02T16:45:00Z'
  },
  {
    id: 'cust-104',
    customerCode: 'CUST-2026-004',
    name: 'Bharti Airtel Limited',
    tradeName: 'Airtel Enterprise Business',
    gstin: '07AAACB2894G1ZN',
    pan: 'AAACB2894G',
    address: 'Bharti Crescent, 1 Nelson Mandela Road, Vasant Kunj',
    city: 'New Delhi',
    pincode: '110070',
    state: 'Delhi',
    stateCode: '07',
    contact: {
      name: 'Ankit Sharma',
      email: 'ankit.sharma@airtel.in',
      phone: '+91 98110 99001',
      designation: 'Commercial Manager'
    },
    creditTerms: 'NET_15',
    creditLimitINR: 3500000,
    status: 'ACTIVE',
    notes: 'Telecom partner. Monthly B2B invoice auto-cross matched with e-Way bills.',
    createdAt: '2026-04-12T15:10:00Z',
    updatedAt: '2026-05-30T10:00:00Z'
  },
  {
    id: 'cust-105',
    customerCode: 'CUST-2026-005',
    name: 'Larsen & Toubro Limited',
    tradeName: 'L&T Heavy Engineering',
    gstin: '27AAACL0140P1ZL',
    pan: 'AAACL0140P',
    address: 'L&T House, Ballard Estate, P.O. Box 278',
    city: 'Mumbai',
    pincode: '400001',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Nitin Deshmukh',
      email: 'nitin.d@larsentoubro.com',
      phone: '+91 98205 33441',
      designation: 'VP - Capital Procurement'
    },
    creditTerms: 'NET_60',
    creditLimitINR: 25000000,
    status: 'ACTIVE',
    notes: 'Capital goods procurement. Form GSTR-1 IRN e-invoice mandated.',
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-07-10T12:00:00Z'
  },
  {
    id: 'cust-106',
    customerCode: 'CUST-2026-006',
    name: 'Hindustan Unilever Limited',
    tradeName: 'HUL FMCG Distribution',
    gstin: '27AAACH1111Q1Z4',
    pan: 'AAACH1111Q',
    address: 'Unilever House, B.D. Sawant Marg, Chakala, Andheri East',
    city: 'Mumbai',
    pincode: '400099',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Sneha Kulkarni',
      email: 'sneha.k@hul.com',
      phone: '+91 98201 99882',
      designation: 'Finance Controller'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 15000000,
    status: 'ACTIVE',
    notes: 'Fast moving consumer goods supply contract.',
    createdAt: '2026-04-20T11:00:00Z',
    updatedAt: '2026-06-15T14:30:00Z'
  },
  {
    id: 'cust-107',
    customerCode: 'CUST-2026-007',
    name: 'Wipro Technologies Limited',
    tradeName: 'Wipro Digital Services',
    gstin: '29AAACW0387R1Z7',
    pan: 'AAACW0387R',
    address: 'Doddakannelli, Sarjapur Road',
    city: 'Bengaluru',
    pincode: '560035',
    state: 'Karnataka',
    stateCode: '29',
    contact: {
      name: 'Kavita Iyer',
      email: 'kavita.iyer@wipro.com',
      phone: '+91 98455 11229',
      designation: 'Director - Vendor Billing'
    },
    creditTerms: 'NET_45',
    creditLimitINR: 9500000,
    status: 'ACTIVE',
    notes: 'IT export software services vendor.',
    createdAt: '2026-05-01T09:00:00Z',
    updatedAt: '2026-07-12T16:00:00Z'
  },
  {
    id: 'cust-108',
    customerCode: 'CUST-2026-008',
    name: 'HCL Technologies Limited',
    tradeName: 'HCL Tech Park Noida',
    gstin: '09AAACH2702H1ZK',
    pan: 'AAACH2702H',
    address: 'Plot No 3A, Sector 126',
    city: 'Noida',
    pincode: '201303',
    state: 'Uttar Pradesh',
    stateCode: '09',
    contact: {
      name: 'Rohan Mathur',
      email: 'rohan.m@hcl.com',
      phone: '+91 98104 77665',
      designation: 'Commercial Head'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 7000000,
    status: 'ACTIVE',
    notes: 'Enterprise IT infrastructure account.',
    createdAt: '2026-05-05T14:20:00Z',
    updatedAt: '2026-06-28T10:15:00Z'
  },
  {
    id: 'cust-109',
    customerCode: 'CUST-2026-009',
    name: 'Adani Enterprises Limited',
    tradeName: 'Adani Logistics & Trade',
    gstin: '24AAACA2804Q1ZT',
    pan: 'AAACA2804Q',
    address: 'Adani Corporate House, Shantigram, SG Highway',
    city: 'Ahmedabad',
    pincode: '382421',
    state: 'Gujarat',
    stateCode: '24',
    contact: {
      name: 'Jigar Shah',
      email: 'jigar.shah@adani.com',
      phone: '+91 98982 33449',
      designation: 'Senior Manager - Tax Accounts'
    },
    creditTerms: 'NET_45',
    creditLimitINR: 30000000,
    status: 'ACTIVE',
    notes: 'Pan-India port and logistics services.',
    createdAt: '2026-05-10T12:00:00Z',
    updatedAt: '2026-07-18T15:00:00Z'
  },
  {
    id: 'cust-110',
    customerCode: 'CUST-2026-010',
    name: 'Mahindra & Mahindra Limited',
    tradeName: 'Mahindra Automotive Sector',
    gstin: '27AAACM1545M1ZO',
    pan: 'AAACM1545M',
    address: 'Gateway Building, Apollo Bunder',
    city: 'Mumbai',
    pincode: '400001',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Vikram Joshi',
      email: 'joshi.vikram@mahindra.com',
      phone: '+91 98202 88771',
      designation: 'Supply Chain General Manager'
    },
    creditTerms: 'NET_60',
    creditLimitINR: 18000000,
    status: 'ACTIVE',
    notes: 'Automotive assembly vendor.',
    createdAt: '2026-05-15T15:30:00Z',
    updatedAt: '2026-07-05T11:45:00Z'
  },
  {
    id: 'cust-111',
    customerCode: 'CUST-2026-011',
    name: 'ITC Limited',
    tradeName: 'ITC Agri Business Division',
    gstin: '19AAACI0012L1ZV',
    pan: 'AAACI0012L',
    address: 'Virginia House, 37 J.L. Nehru Road',
    city: 'Kolkata',
    pincode: '700071',
    state: 'West Bengal',
    stateCode: '19',
    contact: {
      name: 'Debashis Roy',
      email: 'debashis.roy@itc.in',
      phone: '+91 98300 44332',
      designation: 'Senior Vice President - Accounts'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 11000000,
    status: 'ACTIVE',
    notes: 'Agricultural and paperboard packaging client.',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-06-30T17:00:00Z'
  },
  {
    id: 'cust-112',
    customerCode: 'CUST-2026-012',
    name: 'Sun Pharmaceutical Industries Ltd',
    tradeName: 'Sun Pharma Healthcare',
    gstin: '24AAACS4124N1ZM',
    pan: 'AAACS4124N',
    address: 'Sun Pharma Advanced Research Centre, Akota Road',
    city: 'Vadodara',
    pincode: '390020',
    state: 'Gujarat',
    stateCode: '24',
    contact: {
      name: 'Deepak Patel',
      email: 'deepak.patel@sunpharma.com',
      phone: '+91 98985 66778',
      designation: 'Head of Regulatory & Tax'
    },
    creditTerms: 'NET_45',
    creditLimitINR: 14000000,
    status: 'ACTIVE',
    notes: 'Pharmaceutical formulations and API client.',
    createdAt: '2026-05-25T11:15:00Z',
    updatedAt: '2026-07-22T13:30:00Z'
  },
  {
    id: 'cust-113',
    customerCode: 'CUST-2026-013',
    name: 'Dr. Reddy\'s Laboratories Ltd',
    tradeName: 'Dr. Reddy\'s Biologics',
    gstin: '36AAACD0987K1ZF',
    pan: 'AAACD0987K',
    address: '8-2-337, Road No. 3, Banjara Hills',
    city: 'Hyderabad',
    pincode: '500034',
    state: 'Telangana',
    stateCode: '36',
    contact: {
      name: 'K. Venkat Rao',
      email: 'kvenkat@drreddys.com',
      phone: '+91 98490 22334',
      designation: 'Chief Procurement Officer'
    },
    creditTerms: 'NET_60',
    creditLimitINR: 16500000,
    status: 'ACTIVE',
    notes: 'Biotechnology supplies client.',
    createdAt: '2026-06-01T09:45:00Z',
    updatedAt: '2026-07-14T10:30:00Z'
  },
  {
    id: 'cust-114',
    customerCode: 'CUST-2026-014',
    name: 'Titan Company Limited',
    tradeName: 'Titan Lifestyle & Watches',
    gstin: '33AAACT1002P1ZU',
    pan: 'AAACT1002P',
    address: 'Integrity No. 193, Veerasandra, Electronic City P.O.',
    city: 'Hosur',
    pincode: '635109',
    state: 'Tamil Nadu',
    stateCode: '33',
    contact: {
      name: 'R. Subramanian',
      email: 'rsubramanian@titan.co.in',
      phone: '+91 98401 55667',
      designation: 'Finance Controller'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 6000000,
    status: 'ACTIVE',
    notes: 'Precision components & retail hardware.',
    createdAt: '2026-06-05T14:00:00Z',
    updatedAt: '2026-07-19T15:20:00Z'
  },
  {
    id: 'cust-115',
    customerCode: 'CUST-2026-015',
    name: 'Asian Paints Limited',
    tradeName: 'Asian Paints Industrial Coatings',
    gstin: '27AAACA2100J1ZA',
    pan: 'AAACA2100J',
    address: '6A Shantinagar, Santacruz East',
    city: 'Mumbai',
    pincode: '400055',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Alok Sengupta',
      email: 'alok.s@asianpaints.com',
      phone: '+91 98207 11993',
      designation: 'Vice President - Materials'
    },
    creditTerms: 'NET_45',
    creditLimitINR: 8800000,
    status: 'ACTIVE',
    notes: 'Chemicals and industrial surface coatings.',
    createdAt: '2026-06-10T16:20:00Z',
    updatedAt: '2026-07-21T12:10:00Z'
  },
  {
    id: 'cust-116',
    customerCode: 'CUST-2026-016',
    name: 'Bajaj Auto Limited',
    tradeName: 'Bajaj Two-Wheelers Division',
    gstin: '27AAACB0123Q1ZR',
    pan: 'AAACB0123Q',
    address: 'Mumbai Pune Road, Akurdi',
    city: 'Pune',
    pincode: '411035',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Sameer Bhargava',
      email: 'sameer.b@bajajauto.co.in',
      phone: '+91 97655 44331',
      designation: 'Head - Accounts Payable'
    },
    creditTerms: 'NET_30',
    creditLimitINR: 12500000,
    status: 'INACTIVE',
    notes: 'Account under annual statutory reconciliation review.',
    createdAt: '2026-06-15T11:00:00Z',
    updatedAt: '2026-07-16T14:40:00Z'
  }
];

const INITIAL_VENDORS: VendorMaster[] = [
  {
    id: 'vend-201',
    vendorCode: 'VEND-2026-001',
    name: 'Amazon Seller Services Pvt Ltd',
    tradeName: 'Amazon Web Services India',
    gstin: '27AABCA3241R1ZM',
    pan: 'AABCA3241R',
    address: 'Floor 14, BKC Annexe, Bandra East',
    city: 'Mumbai',
    pincode: '400051',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Amit Saxena',
      email: 'amit.s@amazon.in',
      phone: '+91 98210 33445',
      designation: 'Enterprise Partner Manager'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'NON_MSME',
    vendorCategories: ['IT & SaaS Services', 'Logistics & Warehousing'],
    creditTerms: 'NET_30',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Amazon Seller Services Pvt Ltd',
      accountNumber: '000405009823',
      ifscCode: 'ICIC0000004',
      bankName: 'ICICI Bank BKC Branch'
    },
    notes: 'Primary Cloud Hosting Provider. GSTR-2B ITC reflects on 12th of every month.',
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-07-22T09:15:00Z'
  },
  {
    id: 'vend-202',
    vendorCode: 'VEND-2026-002',
    name: 'Precision Components India LLP',
    tradeName: 'Precision Tech Machining',
    gstin: '27AAAFP1234K1Z2',
    pan: 'AAAFP1234K',
    address: 'Plot 42, MIDC Industrial Area, Chakan',
    city: 'Pune',
    pincode: '410501',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Vikas Shinde',
      email: 'vikas@precisioncomp.co.in',
      phone: '+91 97650 12345',
      designation: 'Managing Partner'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'SMALL',
    udyamRegistrationNo: 'UDYAM-MH-26-0012345',
    vendorCategories: ['Raw Material & Tooling', 'Subcontracting & Job Work'],
    creditTerms: 'NET_45',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Precision Components India LLP',
      accountNumber: '918020033144',
      ifscCode: 'UTIB0000214',
      bankName: 'Axis Bank Chakan'
    },
    notes: 'MSME Small Enterprise. mandatory 45-day MSME payment cycle applies under Section 43B(h).',
    createdAt: '2026-02-01T11:20:00Z',
    updatedAt: '2026-07-15T14:10:00Z'
  },
  {
    id: 'vend-203',
    vendorCode: 'VEND-2026-003',
    name: 'Legal & Regulatory Advisory Partners',
    tradeName: 'Sundaram & Associates Legal',
    gstin: '07AAAAA9999B1Z0',
    pan: 'AAAAA9999B',
    address: '12 Barakhamba Road, Connaught Place',
    city: 'New Delhi',
    pincode: '110001',
    state: 'Delhi',
    stateCode: '07',
    contact: {
      name: 'Adv. Meenakshi Sundaram',
      email: 'm.sundaram@legalpartners.in',
      phone: '+91 98100 55667',
      designation: 'Managing Counsel'
    },
    reverseCharge: true, // RCM applicable on legal advocate services
    compositionScheme: false,
    msmeStatus: 'MICRO',
    udyamRegistrationNo: 'UDYAM-DL-01-0008821',
    vendorCategories: ['Legal & Professional Services'],
    creditTerms: 'DUE_ON_RECEIPT',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Sundaram & Associates Legal',
      accountNumber: '002901004512',
      ifscCode: 'HDFC0000029',
      bankName: 'HDFC Bank Connaught Place'
    },
    notes: 'REVERSE CHARGE APPLICABLE (RCM). Recipient is liable to pay GST directly under Section 9(3).',
    createdAt: '2026-03-10T14:00:00Z',
    updatedAt: '2026-06-25T16:30:00Z'
  },
  {
    id: 'vend-204',
    vendorCode: 'VEND-2026-004',
    name: 'SpeedJet Logistics & Freight Ltd',
    tradeName: 'SpeedJet Express GTA',
    gstin: '24AAACS5432E1Z8',
    pan: 'AAACS5432E',
    address: 'Transport Nagar, Narol Industrial Estate',
    city: 'Ahmedabad',
    pincode: '382405',
    state: 'Gujarat',
    stateCode: '24',
    contact: {
      name: 'Ramesh Patel',
      email: 'ramesh@speedjetlogistics.com',
      phone: '+91 98980 22110',
      designation: 'General Manager - Fleet'
    },
    reverseCharge: true, // RCM on GTA service (5% without ITC)
    compositionScheme: false,
    msmeStatus: 'MEDIUM',
    udyamRegistrationNo: 'UDYAM-GJ-03-0045129',
    vendorCategories: ['Freight & Goods Transport (GTA)', 'Logistics & Warehousing'],
    creditTerms: 'NET_15',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'SpeedJet Logistics & Freight Ltd',
      accountNumber: '30982341209',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India Ahmedabad'
    },
    notes: 'Goods Transport Agency (GTA). 5% GST payable by us under RCM.',
    createdAt: '2026-04-05T10:30:00Z',
    updatedAt: '2026-07-10T11:00:00Z'
  },
  {
    id: 'vend-205',
    vendorCode: 'VEND-2026-005',
    name: 'GreenLeaf Packaging Products',
    tradeName: 'GreenLeaf Eco Packs',
    gstin: '27AABFG8812H1ZP',
    pan: 'AABFG8812H',
    address: 'Shop 14, Sector 19, APMC Market, Vashi',
    city: 'Navi Mumbai',
    pincode: '400703',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Sunita Gupta',
      email: 'sunita@greenleafpack.in',
      phone: '+91 98330 66778',
      designation: 'Proprietor'
    },
    reverseCharge: false,
    compositionScheme: true, // Composition Dealer
    msmeStatus: 'MICRO',
    udyamRegistrationNo: 'UDYAM-MH-26-0099412',
    vendorCategories: ['Packaging Materials'],
    creditTerms: 'ADVANCE',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'GreenLeaf Packaging Products',
      accountNumber: '501002341290',
      ifscCode: 'HDFC0000100',
      bankName: 'HDFC Bank Vashi'
    },
    notes: 'COMPOSITION TAXPAYER. No ITC can be claimed on tax charged by composition suppliers.',
    createdAt: '2026-05-18T13:20:00Z',
    updatedAt: '2026-07-01T09:00:00Z'
  },
  {
    id: 'vend-206',
    vendorCode: 'VEND-2026-006',
    name: 'Apex Cloud Infrastructure Solutions',
    tradeName: 'Apex Data Networks',
    gstin: '29AABCA9876Q1ZL',
    pan: 'AABCA9876Q',
    address: 'Tower B, Outer Ring Road, Bellandur',
    city: 'Bengaluru',
    pincode: '560103',
    state: 'Karnataka',
    stateCode: '29',
    contact: {
      name: 'Manish Varma',
      email: 'manish.v@apexcloud.io',
      phone: '+91 98452 33221',
      designation: 'Enterprise Cloud Architect'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'NON_MSME',
    vendorCategories: ['IT & SaaS Services'],
    creditTerms: 'NET_30',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Apex Cloud Infrastructure Solutions',
      accountNumber: '0002104000341',
      ifscCode: 'UTIB0000002',
      bankName: 'Axis Bank MG Road'
    },
    notes: 'Core networking and SaaS provider.',
    createdAt: '2026-05-22T08:30:00Z',
    updatedAt: '2026-07-11T16:00:00Z'
  },
  {
    id: 'vend-207',
    vendorCode: 'VEND-2026-007',
    name: 'Vanguard Security & Facility Services',
    tradeName: 'Vanguard Guarding India',
    gstin: '27AAECV4432P1ZX',
    pan: 'AAECV4432P',
    address: 'Plot 10, MIDC Marol, Andheri East',
    city: 'Mumbai',
    pincode: '400093',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Capt. Rajveer Singh',
      email: 'rajveer@vanguardfacility.com',
      phone: '+91 98200 77665',
      designation: 'Operations Director'
    },
    reverseCharge: true, // RCM on Security Services under Section 9(3)
    compositionScheme: false,
    msmeStatus: 'SMALL',
    udyamRegistrationNo: 'UDYAM-MH-26-0044120',
    vendorCategories: ['Contract Labor & Staffing', 'Maintenance & Repairs'],
    creditTerms: 'NET_15',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Vanguard Security Services',
      accountNumber: '502000341209',
      ifscCode: 'HDFC0000502',
      bankName: 'HDFC Bank Marol'
    },
    notes: 'Security Personnel Supply. GST liability under RCM for corporate recipient.',
    createdAt: '2026-05-28T10:15:00Z',
    updatedAt: '2026-07-16T11:20:00Z'
  },
  {
    id: 'vend-208',
    vendorCode: 'VEND-2026-008',
    name: 'Shree Ganesh Industrial Tooling',
    tradeName: 'Ganesh Tool Works',
    gstin: '27AAFFS9871M1Z3',
    pan: 'AAFFS9871M',
    address: 'Plot 77, Bhosari Industrial Area',
    city: 'Pune',
    pincode: '411026',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Ganesh Jadhav',
      email: 'ganesh@toolworks.co.in',
      phone: '+91 97652 88990',
      designation: 'Proprietor'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'MICRO',
    udyamRegistrationNo: 'UDYAM-MH-26-0078123',
    vendorCategories: ['Raw Material & Tooling', 'Subcontracting & Job Work'],
    creditTerms: 'NET_45',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Shree Ganesh Industrial Tooling',
      accountNumber: '200109823412',
      ifscCode: 'MAHB0000109',
      bankName: 'Bank of Maharashtra Bhosari'
    },
    notes: 'Micro enterprise supplier under Section 43B(h) priority settlement.',
    createdAt: '2026-06-01T11:00:00Z',
    updatedAt: '2026-07-18T14:30:00Z'
  },
  {
    id: 'vend-209',
    vendorCode: 'VEND-2026-009',
    name: 'BlueDart Express Freight GTA',
    tradeName: 'BlueDart Surface Cargo',
    gstin: '27AAACB4412R1ZU',
    pan: 'AAACB4412R',
    address: 'BlueDart Centre, Sahar Airport Road, Andheri East',
    city: 'Mumbai',
    pincode: '400099',
    state: 'Maharashtra',
    stateCode: '27',
    contact: {
      name: 'Naveen Nair',
      email: 'naveen.n@bluedart.com',
      phone: '+91 98203 44551',
      designation: 'Corporate Accounts Manager'
    },
    reverseCharge: true, // GTA services RCM
    compositionScheme: false,
    msmeStatus: 'NON_MSME',
    vendorCategories: ['Freight & Goods Transport (GTA)', 'Logistics & Warehousing'],
    creditTerms: 'NET_30',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'BlueDart Express Limited',
      accountNumber: '000405001298',
      ifscCode: 'ICIC0000004',
      bankName: 'ICICI Bank Nariman Point'
    },
    notes: 'National logistics & consignment transport under RCM consignment notes.',
    createdAt: '2026-06-04T09:30:00Z',
    updatedAt: '2026-07-20T17:00:00Z'
  },
  {
    id: 'vend-210',
    vendorCode: 'VEND-2026-010',
    name: 'Creative Edge Media & Marketing',
    tradeName: 'Edge Creative Digital',
    gstin: '07AABCC3321L1ZN',
    pan: 'AABCC3321L',
    address: '2nd Floor, Okhla Industrial Area Phase III',
    city: 'New Delhi',
    pincode: '110020',
    state: 'Delhi',
    stateCode: '07',
    contact: {
      name: 'Natasha Kapoor',
      email: 'natasha@creativeedge.in',
      phone: '+91 98114 66778',
      designation: 'Managing Partner'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'SMALL',
    udyamRegistrationNo: 'UDYAM-DL-03-0019283',
    vendorCategories: ['Marketing & Advertising', 'IT & SaaS Services'],
    creditTerms: 'NET_30',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Creative Edge Media',
      accountNumber: '112009834120',
      ifscCode: 'KKBK0000112',
      bankName: 'Kotak Mahindra Bank Okhla'
    },
    notes: 'Brand design, advertising & campaign collateral.',
    createdAt: '2026-06-08T13:00:00Z',
    updatedAt: '2026-07-15T15:45:00Z'
  },
  {
    id: 'vend-211',
    vendorCode: 'VEND-2026-011',
    name: 'Kaveri Polymers & Mouldings',
    tradeName: 'Kaveri Industrial Plastics',
    gstin: '33AAFFK1245R1ZM',
    pan: 'AAFFK1245R',
    address: 'SIDCO Industrial Estate, Guindy',
    city: 'Chennai',
    pincode: '600032',
    state: 'Tamil Nadu',
    stateCode: '33',
    contact: {
      name: 'M. Senthil Kumar',
      email: 'senthil@kaveripolymers.com',
      phone: '+91 98403 99881',
      designation: 'Managing Director'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'MEDIUM',
    udyamRegistrationNo: 'UDYAM-TN-02-0048123',
    vendorCategories: ['Raw Material & Tooling', 'Packaging Materials'],
    creditTerms: 'NET_45',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Kaveri Polymers',
      accountNumber: '0234020000192',
      ifscCode: 'IOBA0000234',
      bankName: 'Indian Overseas Bank Guindy'
    },
    notes: 'High-density polymer packaging supplier.',
    createdAt: '2026-06-12T10:45:00Z',
    updatedAt: '2026-07-17T11:30:00Z'
  },
  {
    id: 'vend-212',
    vendorCode: 'VEND-2026-012',
    name: 'Nexus Electricals & Switchgears',
    tradeName: 'Nexus Power Solutions',
    gstin: '24AABCN7812P1ZF',
    pan: 'AABCN7812P',
    address: 'GIDC Industrial Area, Makarpura',
    city: 'Vadodara',
    pincode: '390010',
    state: 'Gujarat',
    stateCode: '24',
    contact: {
      name: 'Harshil Vora',
      email: 'harshil@nexuselectric.in',
      phone: '+91 98981 12389',
      designation: 'Partner'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'MICRO',
    udyamRegistrationNo: 'UDYAM-GJ-04-0012984',
    vendorCategories: ['Capital Goods & Machinery', 'Maintenance & Repairs'],
    creditTerms: 'NET_45',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Nexus Electricals',
      accountNumber: '401009823412',
      ifscCode: 'BARB0MAKARP',
      bankName: 'Bank of Baroda Makarpura'
    },
    notes: 'Plant electrical switchgear supply & maintenance.',
    createdAt: '2026-06-14T15:20:00Z',
    updatedAt: '2026-07-21T09:10:00Z'
  },
  {
    id: 'vend-213',
    vendorCode: 'VEND-2026-013',
    name: 'Falcon Staffing & Manpower Services',
    tradeName: 'Falcon Workforce Solutions',
    gstin: '36AAECF3312Q1ZW',
    pan: 'AAECF3312Q',
    address: 'Plot 18, Cyber Towers, Hitec City, Madhapur',
    city: 'Hyderabad',
    pincode: '500081',
    state: 'Telangana',
    stateCode: '36',
    contact: {
      name: 'Srinivas Murthy',
      email: 'srinivas.m@falconworkforce.com',
      phone: '+91 98492 88771',
      designation: 'Operations VP'
    },
    reverseCharge: true, // Manpower supply RCM
    compositionScheme: false,
    msmeStatus: 'SMALL',
    udyamRegistrationNo: 'UDYAM-TL-01-0023412',
    vendorCategories: ['Contract Labor & Staffing'],
    creditTerms: 'NET_15',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Falcon Workforce Solutions',
      accountNumber: '001205009812',
      ifscCode: 'ICIC0000012',
      bankName: 'ICICI Bank Hitec City'
    },
    notes: 'Contract manpower staffing. GST paid by recipient under RCM.',
    createdAt: '2026-06-18T12:00:00Z',
    updatedAt: '2026-07-20T16:15:00Z'
  },
  {
    id: 'vend-214',
    vendorCode: 'VEND-2026-014',
    name: 'Modern Office Utilities & Works',
    tradeName: 'Modern Stationary & Rent',
    gstin: '09AABCM9012K1ZY',
    pan: 'AABCM9012K',
    address: 'Shop 8, Commercial Complex, Sector 18',
    city: 'Noida',
    pincode: '201301',
    state: 'Uttar Pradesh',
    stateCode: '09',
    contact: {
      name: 'Pooja Agarwal',
      email: 'pooja@modernoffice.in',
      phone: '+91 98108 33442',
      designation: 'Proprietor'
    },
    reverseCharge: false,
    compositionScheme: true, // Composition
    msmeStatus: 'MICRO',
    udyamRegistrationNo: 'UDYAM-UP-02-0009124',
    vendorCategories: ['Utilities & Rent', 'Packaging Materials'],
    creditTerms: 'DUE_ON_RECEIPT',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Modern Office Utilities',
      accountNumber: '110023412984',
      ifscCode: 'PUNB0110000',
      bankName: 'Punjab National Bank Sector 18'
    },
    notes: 'Composition scheme supplier for office utility items.',
    createdAt: '2026-06-20T14:10:00Z',
    updatedAt: '2026-07-19T10:00:00Z'
  },
  {
    id: 'vend-215',
    vendorCode: 'VEND-2026-015',
    name: 'Pioneer Heavy Machine Tools',
    tradeName: 'Pioneer CNC Automation',
    gstin: '29AAACP5521L1Z9',
    pan: 'AAACP5521L',
    address: 'Phase 2, Peenya Industrial Area',
    city: 'Bengaluru',
    pincode: '560058',
    state: 'Karnataka',
    stateCode: '29',
    contact: {
      name: 'Raghavan Iyer',
      email: 'raghavan@pioneertools.in',
      phone: '+91 98451 77665',
      designation: 'General Manager'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'MEDIUM',
    udyamRegistrationNo: 'UDYAM-KR-03-0045120',
    vendorCategories: ['Capital Goods & Machinery', 'Raw Material & Tooling'],
    creditTerms: 'NET_60',
    status: 'ACTIVE',
    bankDetails: {
      accountName: 'Pioneer Heavy Machine Tools',
      accountNumber: '912020034120',
      ifscCode: 'UTIB0000120',
      bankName: 'Axis Bank Peenya'
    },
    notes: 'CNC fabrication equipment and capital machinery vendor.',
    createdAt: '2026-06-22T09:00:00Z',
    updatedAt: '2026-07-22T14:30:00Z'
  },
  {
    id: 'vend-216',
    vendorCode: 'VEND-2026-016',
    name: 'National Telecom Infrastructure Corp',
    tradeName: 'National Tower Lease',
    gstin: '07AAACN1122M1ZQ',
    pan: 'AAACN1122M',
    address: 'Tower A, Aerocity Business Park',
    city: 'New Delhi',
    pincode: '110037',
    state: 'Delhi',
    stateCode: '07',
    contact: {
      name: 'Deepak Chopra',
      email: 'd.chopra@nationaltelecom.in',
      phone: '+91 98112 44331',
      designation: 'Commercial Director'
    },
    reverseCharge: false,
    compositionScheme: false,
    msmeStatus: 'NON_MSME',
    vendorCategories: ['IT & SaaS Services', 'Utilities & Rent'],
    creditTerms: 'NET_30',
    status: 'INACTIVE',
    bankDetails: {
      accountName: 'National Telecom Infrastructure Corp',
      accountNumber: '000405003312',
      ifscCode: 'ICIC0000004',
      bankName: 'ICICI Bank Connaught Place'
    },
    notes: 'Telecom tower bandwidth lease under vendor renegotiation.',
    createdAt: '2026-06-25T16:00:00Z',
    updatedAt: '2026-07-18T13:00:00Z'
  }
];

// LocalStorage Helper Functions
export const loadCustomers = (): CustomerMaster[] => {
  try {
    const raw = safeStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (!raw) {
      safeStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(INITIAL_CUSTOMERS));
      return INITIAL_CUSTOMERS;
    }
    const parsed: CustomerMaster[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 6) {
      // Merge unique seed customers with existing
      const existingIds = new Set(parsed.map(c => c.id || c.customerCode));
      const missing = INITIAL_CUSTOMERS.filter(c => !existingIds.has(c.id) && !existingIds.has(c.customerCode));
      const merged = [...parsed, ...missing];
      safeStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load customers:', err);
    return INITIAL_CUSTOMERS;
  }
};

export const saveCustomers = (customers: CustomerMaster[]) => {
  try {
    safeStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
  } catch (err) {
    console.error('Failed to save customers:', err);
  }
};

export const loadVendors = (): VendorMaster[] => {
  try {
    const raw = safeStorage.getItem(VENDOR_STORAGE_KEY);
    if (!raw) {
      safeStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(INITIAL_VENDORS));
      return INITIAL_VENDORS;
    }
    const parsed: VendorMaster[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 6) {
      // Merge unique seed vendors with existing
      const existingIds = new Set(parsed.map(v => v.id || v.vendorCode));
      const missing = INITIAL_VENDORS.filter(v => !existingIds.has(v.id) && !existingIds.has(v.vendorCode));
      const merged = [...parsed, ...missing];
      safeStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load vendors:', err);
    return INITIAL_VENDORS;
  }
};

export const saveVendors = (vendors: VendorMaster[]) => {
  try {
    safeStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(vendors));
  } catch (err) {
    console.error('Failed to save vendors:', err);
  }
};

// CRUD Operations for Customers
export const createCustomer = (data: Omit<CustomerMaster, 'id' | 'customerCode' | 'createdAt' | 'updatedAt'>): CustomerMaster => {
  const current = loadCustomers();
  const nextNum = current.length + 1;
  const code = `CUST-2026-${String(nextNum).padStart(3, '0')}`;
  
  const newCustomer: CustomerMaster = {
    ...data,
    id: `cust-${Date.now()}`,
    customerCode: code,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updated = [newCustomer, ...current];
  saveCustomers(updated);
  return newCustomer;
};

export const updateCustomer = (id: string, data: Partial<CustomerMaster>): CustomerMaster => {
  const current = loadCustomers();
  const index = current.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Customer not found');

  const updatedItem: CustomerMaster = {
    ...current[index],
    ...data,
    updatedAt: new Date().toISOString()
  };

  current[index] = updatedItem;
  saveCustomers(current);
  return updatedItem;
};

export const deleteCustomer = (id: string) => {
  const current = loadCustomers();
  const filtered = current.filter(c => c.id !== id);
  saveCustomers(filtered);
};

// CRUD Operations for Vendors
export const createVendor = (data: Omit<VendorMaster, 'id' | 'vendorCode' | 'createdAt' | 'updatedAt'>): VendorMaster => {
  const current = loadVendors();
  const nextNum = current.length + 1;
  const code = `VEND-2026-${String(nextNum).padStart(3, '0')}`;

  const newVendor: VendorMaster = {
    ...data,
    id: `vend-${Date.now()}`,
    vendorCode: code,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updated = [newVendor, ...current];
  saveVendors(updated);
  return newVendor;
};

export const updateVendor = (id: string, data: Partial<VendorMaster>): VendorMaster => {
  const current = loadVendors();
  const index = current.findIndex(v => v.id === id);
  if (index === -1) throw new Error('Vendor not found');

  const updatedItem: VendorMaster = {
    ...current[index],
    ...data,
    updatedAt: new Date().toISOString()
  };

  current[index] = updatedItem;
  saveVendors(current);
  return updatedItem;
};

export const deleteVendor = (id: string) => {
  const current = loadVendors();
  const filtered = current.filter(v => v.id !== id);
  saveVendors(filtered);
};

// Reset Master Data back to initial seeds
export const resetPartyMasterToSeed = () => {
  saveCustomers(INITIAL_CUSTOMERS);
  saveVendors(INITIAL_VENDORS);
  return { customers: INITIAL_CUSTOMERS, vendors: INITIAL_VENDORS };
};

// Extract PAN from 15-digit GSTIN
export const extractPanFromGstin = (gstin: string): string => {
  if (!gstin || gstin.trim().length !== 15) return '';
  return gstin.trim().substring(2, 12).toUpperCase();
};

// Extract State Code from 15-digit GSTIN
export const extractStateCodeFromGstin = (gstin: string): string => {
  if (!gstin || gstin.trim().length < 2) return '';
  return gstin.trim().substring(0, 2);
};
