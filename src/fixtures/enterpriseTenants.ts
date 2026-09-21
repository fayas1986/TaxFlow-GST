/**
 * Enterprise Group Operating Entities Dataset (12 Conglomerate Subsidiaries & SPVs)
 * 
 * Provides complete multi-entity corporate structures with GSTIN registrations,
 * branches, sectors, states, filing statuses, and financial metrics.
 */

import { Tenant, GstinRegistrationItem, BranchDetailsItem } from '../../types';

export const ENTERPRISE_GROUP_TENANTS: Tenant[] = [
  {
    id: 't1',
    name: 'Acme Corp',
    gstin: '27ABCDE1234F1Z5',
    address: '123 Business Park, Bandra Kurla Complex, Mumbai, MH 400051',
    stateCode: '27',
    stateName: 'Maharashtra',
    sector: 'Technology & Cloud',
    entityType: 'HOLDING',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 99.4,
    gstinCount: 4,
    branchCount: 4,
    annualTurnover: 284000000,
    revenueContributionPct: 28,
    pendingExceptionsCount: 0
  },
  {
    id: 't2',
    name: 'Globex Inc',
    gstin: '04XYZZZ9876L1Z1',
    address: 'Sector 17, City Center, Chandigarh, CH 160017',
    stateCode: '04',
    stateName: 'Chandigarh',
    sector: 'Manufacturing & Heavy Engg',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 98.2,
    gstinCount: 3,
    branchCount: 3,
    annualTurnover: 182000000,
    revenueContributionPct: 18,
    pendingExceptionsCount: 1
  },
  {
    id: 't3',
    name: 'Acme Logistics & Cold Chain',
    gstin: '29AAACL9012M1Z8',
    address: 'Whitefield Industrial Corridor, Bengaluru, KA 560066',
    stateCode: '29',
    stateName: 'Karnataka',
    sector: 'Supply Chain & Logistics',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 97.6,
    gstinCount: 5,
    branchCount: 6,
    annualTurnover: 122000000,
    revenueContributionPct: 12,
    pendingExceptionsCount: 2
  },
  {
    id: 't4',
    name: 'Acme Retail & Commerce',
    gstin: '07AAACR4567K1Z3',
    address: 'Connaught Place, Central Delhi, DL 110001',
    stateCode: '07',
    stateName: 'Delhi',
    sector: 'Retail & E-Commerce',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'NEEDS_ATTENTION',
    complianceScore: 95.1,
    gstinCount: 6,
    branchCount: 8,
    annualTurnover: 142000000,
    revenueContributionPct: 14,
    pendingExceptionsCount: 6
  },
  {
    id: 't5',
    name: 'Acme CleanTech & Energy',
    gstin: '24AAACE7890N1Z2',
    address: 'GIFT City SEZ Tower, Gandhinagar, GJ 382355',
    stateCode: '24',
    stateName: 'Gujarat',
    sector: 'Clean Energy & Utilities',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 99.8,
    gstinCount: 3,
    branchCount: 3,
    annualTurnover: 91000000,
    revenueContributionPct: 9,
    pendingExceptionsCount: 0
  },
  {
    id: 't6',
    name: 'Acme Healthcare & Pharma',
    gstin: '33AAACH3456P1Z9',
    address: 'Guindy Industrial Estate, Chennai, TN 600032',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    sector: 'Healthcare & Pharma',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 99.1,
    gstinCount: 3,
    branchCount: 4,
    annualTurnover: 81000000,
    revenueContributionPct: 8,
    pendingExceptionsCount: 1
  },
  {
    id: 't7',
    name: 'Acme Financial Services',
    gstin: '27AAACF8901R1Z4',
    address: 'Maker Maxity, BKC, Mumbai, MH 400051',
    stateCode: '27',
    stateName: 'Maharashtra',
    sector: 'Financial Services',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 100.0,
    gstinCount: 2,
    branchCount: 2,
    annualTurnover: 61000000,
    revenueContributionPct: 6,
    pendingExceptionsCount: 0
  },
  {
    id: 't8',
    name: 'Acme Aerospace & Defence',
    gstin: '36AAACA1234E1Z7',
    address: 'Aerospace Park, Adibatla, Hyderabad, TS 501510',
    stateCode: '36',
    stateName: 'Telangana',
    sector: 'Aerospace & Defence',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 99.0,
    gstinCount: 2,
    branchCount: 2,
    annualTurnover: 51000000,
    revenueContributionPct: 5,
    pendingExceptionsCount: 0
  },
  {
    id: 't9',
    name: 'Acme Infrastructure & EPC',
    gstin: '06AAACI5678D1Z5',
    address: 'DLF Cyber City, Sector 24, Gurugram, HR 122002',
    stateCode: '06',
    stateName: 'Haryana',
    sector: 'Infrastructure & EPC',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'NEEDS_ATTENTION',
    complianceScore: 94.2,
    gstinCount: 4,
    branchCount: 5,
    annualTurnover: 71000000,
    revenueContributionPct: 7,
    pendingExceptionsCount: 5
  },
  {
    id: 't10',
    name: 'Acme Global Exports (SEZ)',
    gstin: '24AAACG2345B1Z0',
    address: 'Kandla Special Economic Zone, Gandhidham, GJ 370230',
    stateCode: '24',
    stateName: 'Gujarat',
    sector: 'International Trade & SEZ',
    entityType: 'SEZ_UNIT',
    isSez: true,
    filingStatus: 'COMPLIANT',
    complianceScore: 98.9,
    gstinCount: 2,
    branchCount: 2,
    annualTurnover: 111000000,
    revenueContributionPct: 11,
    pendingExceptionsCount: 1
  },
  {
    id: 't11',
    name: 'Globex Digital Networks',
    gstin: '19AAACD9012J1Z6',
    address: 'Salt Lake Sector V, Bidhannagar, Kolkata, WB 700091',
    stateCode: '19',
    stateName: 'West Bengal',
    sector: 'Technology & Cloud',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 97.9,
    gstinCount: 3,
    branchCount: 3,
    annualTurnover: 41000000,
    revenueContributionPct: 4,
    pendingExceptionsCount: 1
  },
  {
    id: 't12',
    name: 'Globex Specialty Materials',
    gstin: '08AAACC6789H1Z1',
    address: 'RIICO Industrial Area, Phase II, Bhiwadi, RJ 301019',
    stateCode: '08',
    stateName: 'Rajasthan',
    sector: 'Manufacturing & Heavy Engg',
    entityType: 'SUBSIDIARY',
    isSez: false,
    filingStatus: 'COMPLIANT',
    complianceScore: 98.5,
    gstinCount: 2,
    branchCount: 2,
    annualTurnover: 51000000,
    revenueContributionPct: 5,
    pendingExceptionsCount: 0
  }
];

export const ENTERPRISE_GSTINS_BY_TENANT: Record<string, GstinRegistrationItem[]> = {
  't1': [
    {
      id: 'g1',
      gstin: '27ABCDE1234F1Z5',
      stateCode: '27',
      stateName: 'Maharashtra',
      registrationType: 'REGULAR',
      registrationDate: '2018-07-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g2',
      gstin: '07ABCDE1234F1Z9',
      stateCode: '07',
      stateName: 'Delhi',
      registrationType: 'REGULAR',
      registrationDate: '2019-10-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g3',
      gstin: '29ABCDE1234F3Z2',
      stateCode: '29',
      stateName: 'Karnataka',
      registrationType: 'SEZ_UNIT',
      registrationDate: '2021-03-20',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g4',
      gstin: '33ABCDE1234F4Z1',
      stateCode: '33',
      stateName: 'Tamil Nadu',
      registrationType: 'REGULAR',
      registrationDate: '2022-01-10',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't2': [
    {
      id: 'g2-1',
      gstin: '04XYZZZ9876L1Z1',
      stateCode: '04',
      stateName: 'Chandigarh',
      registrationType: 'REGULAR',
      registrationDate: '2019-04-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g2-2',
      gstin: '06XYZZZ9876L2Z2',
      stateCode: '06',
      stateName: 'Haryana',
      registrationType: 'REGULAR',
      registrationDate: '2020-08-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g2-3',
      gstin: '03XYZZZ9876L3Z3',
      stateCode: '03',
      stateName: 'Punjab',
      registrationType: 'REGULAR',
      registrationDate: '2021-02-12',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't3': [
    {
      id: 'g3-1',
      gstin: '29AAACL9012M1Z8',
      stateCode: '29',
      stateName: 'Karnataka',
      registrationType: 'REGULAR',
      registrationDate: '2019-06-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g3-2',
      gstin: '36AAACL9012M2Z6',
      stateCode: '36',
      stateName: 'Telangana',
      registrationType: 'REGULAR',
      registrationDate: '2020-02-18',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g3-3',
      gstin: '32AAACL9012M3Z4',
      stateCode: '32',
      stateName: 'Kerala',
      registrationType: 'REGULAR',
      registrationDate: '2021-09-10',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't4': [
    {
      id: 'g4-1',
      gstin: '07AAACR4567K1Z3',
      stateCode: '07',
      stateName: 'Delhi',
      registrationType: 'REGULAR',
      registrationDate: '2018-11-20',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g4-2',
      gstin: '09AAACR4567K2Z1',
      stateCode: '09',
      stateName: 'Uttar Pradesh',
      registrationType: 'REGULAR',
      registrationDate: '2019-05-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    },
    {
      id: 'g4-3',
      gstin: '24AAACR4567K3ZZ',
      stateCode: '24',
      stateName: 'Gujarat',
      registrationType: 'REGULAR',
      registrationDate: '2020-07-22',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't5': [
    {
      id: 'g5-1',
      gstin: '24AAACE7890N1Z2',
      stateCode: '24',
      stateName: 'Gujarat',
      registrationType: 'REGULAR',
      registrationDate: '2020-01-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g5-2',
      gstin: '08AAACE7890N2Z0',
      stateCode: '08',
      stateName: 'Rajasthan',
      registrationType: 'REGULAR',
      registrationDate: '2021-04-10',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't6': [
    {
      id: 'g6-1',
      gstin: '33AAACH3456P1Z9',
      stateCode: '33',
      stateName: 'Tamil Nadu',
      registrationType: 'REGULAR',
      registrationDate: '2019-08-14',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g6-2',
      gstin: '27AAACH3456P2Z7',
      stateCode: '27',
      stateName: 'Maharashtra',
      registrationType: 'REGULAR',
      registrationDate: '2020-11-05',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't7': [
    {
      id: 'g7-1',
      gstin: '27AAACF8901R1Z4',
      stateCode: '27',
      stateName: 'Maharashtra',
      registrationType: 'REGULAR',
      registrationDate: '2018-09-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    }
  ],
  't8': [
    {
      id: 'g8-1',
      gstin: '36AAACA1234E1Z7',
      stateCode: '36',
      stateName: 'Telangana',
      registrationType: 'REGULAR',
      registrationDate: '2020-03-12',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    }
  ],
  't9': [
    {
      id: 'g9-1',
      gstin: '06AAACI5678D1Z5',
      stateCode: '06',
      stateName: 'Haryana',
      registrationType: 'REGULAR',
      registrationDate: '2019-01-20',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    },
    {
      id: 'g9-2',
      gstin: '09AAACI5678D2Z3',
      stateCode: '09',
      stateName: 'Uttar Pradesh',
      registrationType: 'REGULAR',
      registrationDate: '2020-06-18',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: false
    }
  ],
  't10': [
    {
      id: 'g10-1',
      gstin: '24AAACG2345B1Z0',
      stateCode: '24',
      stateName: 'Gujarat',
      registrationType: 'SEZ_DEVELOPER',
      registrationDate: '2018-08-01',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    }
  ],
  't11': [
    {
      id: 'g11-1',
      gstin: '19AAACD9012J1Z6',
      stateCode: '19',
      stateName: 'West Bengal',
      registrationType: 'REGULAR',
      registrationDate: '2019-10-10',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    }
  ],
  't12': [
    {
      id: 'g12-1',
      gstin: '08AAACC6789H1Z1',
      stateCode: '08',
      stateName: 'Rajasthan',
      registrationType: 'REGULAR',
      registrationDate: '2020-02-15',
      status: 'ACTIVE',
      filingFrequency: 'MONTHLY',
      einvoicingStatus: 'ENABLED',
      ewaybillStatus: 'ENABLED',
      isPrimary: true
    }
  ]
};

export const ENTERPRISE_BRANCHES_BY_TENANT: Record<string, BranchDetailsItem[]> = {
  't1': [
    {
      id: 'b1',
      name: 'Mumbai HQ Office',
      code: 'MH-HQ-01',
      type: 'HEAD_OFFICE',
      address: '101 MIDC Andheri East, Mumbai, MH',
      stateCode: '27',
      stateName: 'Maharashtra',
      gstin: '27ABCDE1234F1Z5',
      contactPerson: 'Rajesh Sharma',
      contactEmail: 'rajesh.sharma@acmetech.com',
      contactPhone: '+91 98200 11223',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 55
    },
    {
      id: 'b2',
      name: 'Pune Software Lab',
      code: 'MH-PU-02',
      type: 'FACTORY',
      address: 'Plot 44, MIDC Bhosari, Pune, MH',
      stateCode: '27',
      stateName: 'Maharashtra',
      gstin: '27ABCDE1234F1Z5',
      contactPerson: 'Suresh Patil',
      contactEmail: 'suresh.patil@acmetech.com',
      contactPhone: '+91 98220 44556',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 20
    },
    {
      id: 'b3',
      name: 'Delhi Regional Hub',
      code: 'DL-RO-03',
      type: 'REGIONAL_OFFICE',
      address: 'Connaught Place, New Delhi, DL',
      stateCode: '07',
      stateName: 'Delhi',
      gstin: '07ABCDE1234F1Z9',
      contactPerson: 'Vikas Gupta',
      contactEmail: 'vikas.gupta@acmetech.com',
      contactPhone: '+91 98110 33445',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 15
    },
    {
      id: 'b4',
      name: 'Bengaluru R&D Center (SEZ)',
      code: 'KA-SEZ-04',
      type: 'WAREHOUSE',
      address: 'Electronic City Phase 1, Bengaluru, KA',
      stateCode: '29',
      stateName: 'Karnataka',
      gstin: '29ABCDE1234F3Z2',
      contactPerson: 'Deepa Hegde',
      contactEmail: 'deepa.hegde@acmetech.com',
      contactPhone: '+91 98450 66778',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 10
    }
  ],
  't2': [
    {
      id: 'b2-1',
      name: 'Chandigarh Foundry & Machining',
      code: 'CH-FD-01',
      type: 'FACTORY',
      address: 'Industrial Area Phase 1, Chandigarh',
      stateCode: '04',
      stateName: 'Chandigarh',
      gstin: '04XYZZZ9876L1Z1',
      contactPerson: 'Manpreet Singh',
      contactEmail: 'manpreet@globex.in',
      contactPhone: '+91 98760 12345',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 60
    },
    {
      id: 'b2-2',
      name: 'Gurugram Corporate Office',
      code: 'HR-HQ-02',
      type: 'HEAD_OFFICE',
      address: 'Udyog Vihar Phase 4, Gurugram, HR',
      stateCode: '06',
      stateName: 'Haryana',
      gstin: '06XYZZZ9876L2Z2',
      contactPerson: 'Pooja Verma',
      contactEmail: 'pooja.verma@globex.in',
      contactPhone: '+91 98120 54321',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 40
    }
  ],
  't3': [
    {
      id: 'b3-1',
      name: 'Bengaluru Central Distribution Hub',
      code: 'KA-LOG-01',
      type: 'HEAD_OFFICE',
      address: 'Hosakote Industrial Area, Bengaluru, KA',
      stateCode: '29',
      stateName: 'Karnataka',
      gstin: '29AAACL9012M1Z8',
      contactPerson: 'Girish Kumar',
      contactEmail: 'girish@acmelogistics.in',
      contactPhone: '+91 98455 11223',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 50
    },
    {
      id: 'b3-2',
      name: 'Hyderabad Cold Hub',
      code: 'TS-LOG-02',
      type: 'WAREHOUSE',
      address: 'Medchal Logistics Park, Hyderabad, TS',
      stateCode: '36',
      stateName: 'Telangana',
      gstin: '36AAACL9012M2Z6',
      contactPerson: 'Ravi Teja',
      contactEmail: 'ravi@acmelogistics.in',
      contactPhone: '+91 99890 22334',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 50
    }
  ],
  't4': [
    {
      id: 'b4-1',
      name: 'Delhi Flagship Retail Store',
      code: 'DL-RET-01',
      type: 'HEAD_OFFICE',
      address: 'Khan Market, New Delhi, DL',
      stateCode: '07',
      stateName: 'Delhi',
      gstin: '07AAACR4567K1Z3',
      contactPerson: 'Simran Kaur',
      contactEmail: 'simran@acmeretail.in',
      contactPhone: '+91 98100 44556',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 60
    },
    {
      id: 'b4-2',
      name: 'Noida Fulfillment Center',
      code: 'UP-FC-02',
      type: 'WAREHOUSE',
      address: 'Sector 63, Noida, UP',
      stateCode: '09',
      stateName: 'Uttar Pradesh',
      gstin: '09AAACR4567K2Z1',
      contactPerson: 'Alok Mishra',
      contactEmail: 'alok@acmeretail.in',
      contactPhone: '+91 98180 77889',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 40
    }
  ],
  't5': [
    {
      id: 'b5-1',
      name: 'GIFT City CleanTech HQ',
      code: 'GJ-SOLAR-01',
      type: 'HEAD_OFFICE',
      address: 'Tower 1, GIFT SEZ, Gandhinagar, GJ',
      stateCode: '24',
      stateName: 'Gujarat',
      gstin: '24AAACE7890N1Z2',
      contactPerson: 'Bhavin Patel',
      contactEmail: 'bhavin@acmeclean.in',
      contactPhone: '+91 98250 99887',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't6': [
    {
      id: 'b6-1',
      name: 'Chennai Pharma Formulation Labs',
      code: 'TN-LAB-01',
      type: 'FACTORY',
      address: 'Maraimalai Nagar, Chennai, TN',
      stateCode: '33',
      stateName: 'Tamil Nadu',
      gstin: '33AAACH3456P1Z9',
      contactPerson: 'Dr. S. Ramanathan',
      contactEmail: 'ramanathan@acmepharma.in',
      contactPhone: '+91 98400 12345',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't7': [
    {
      id: 'b7-1',
      name: 'Mumbai Treasury & Finance Corp',
      code: 'MH-FIN-01',
      type: 'HEAD_OFFICE',
      address: 'BKC Financial Center, Mumbai, MH',
      stateCode: '27',
      stateName: 'Maharashtra',
      gstin: '27AAACF8901R1Z4',
      contactPerson: 'Karan Mehra',
      contactEmail: 'karan@acmefin.in',
      contactPhone: '+91 98201 98765',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't8': [
    {
      id: 'b8-1',
      name: 'Hyderabad Aerospace Manufacturing',
      code: 'TS-AERO-01',
      type: 'FACTORY',
      address: 'TSIIC Aerospace Park, Hyderabad, TS',
      stateCode: '36',
      stateName: 'Telangana',
      gstin: '36AAACA1234E1Z7',
      contactPerson: 'K. Venkatesh',
      contactEmail: 'venkatesh@acmeastro.in',
      contactPhone: '+91 99490 88776',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't9': [
    {
      id: 'b9-1',
      name: 'Gurugram Infrastructure Projects',
      code: 'HR-EPC-01',
      type: 'HEAD_OFFICE',
      address: 'Golf Course Road, Gurugram, HR',
      stateCode: '06',
      stateName: 'Haryana',
      gstin: '06AAACI5678D1Z5',
      contactPerson: 'Sunil Choudhary',
      contactEmail: 'sunil@acmeinfra.in',
      contactPhone: '+91 98111 22334',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't10': [
    {
      id: 'b10-1',
      name: 'Kandla Free Trade Zone Operations',
      code: 'GJ-SEZ-01',
      type: 'HEAD_OFFICE',
      address: 'KASEZ Administrative Building, Gandhidham, GJ',
      stateCode: '24',
      stateName: 'Gujarat',
      gstin: '24AAACG2345B1Z0',
      contactPerson: 'Harshil Shah',
      contactEmail: 'harshil@acmeexport.in',
      contactPhone: '+91 98790 33445',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't11': [
    {
      id: 'b11-1',
      name: 'Kolkata Digital Core & NOC',
      code: 'WB-NOC-01',
      type: 'HEAD_OFFICE',
      address: 'Webel More, Sector V, Kolkata, WB',
      stateCode: '19',
      stateName: 'West Bengal',
      gstin: '19AAACD9012J1Z6',
      contactPerson: 'Subhashish Roy',
      contactEmail: 'subhashish@globexdigital.in',
      contactPhone: '+91 98300 44556',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ],
  't12': [
    {
      id: 'b12-1',
      name: 'Bhiwadi Specialty Polymers Plant',
      code: 'RJ-MAT-01',
      type: 'FACTORY',
      address: 'RIICO Phase 2, Bhiwadi, RJ',
      stateCode: '08',
      stateName: 'Rajasthan',
      gstin: '08AAACC6789H1Z1',
      contactPerson: 'Dinesh Agarwal',
      contactEmail: 'dinesh@globexchem.in',
      contactPhone: '+91 98290 66778',
      status: 'ACTIVE',
      annualTurnoverContributionPct: 100
    }
  ]
};
