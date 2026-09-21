import { GSTRuleEngine } from './ruleEngine';
import { logAuditAction } from '../api';

export interface LifecycleStage {
  name: 'GOVT_CHANGE' | 'RECORD_CREATED' | 'IMPACT_ANALYSIS' | 'RULE_UPDATE' | 'AUTOMATED_TESTS' | 'SANDBOX_VALIDATION' | 'REGRESSION_TESTING' | 'UAT' | 'PRODUCTION_RELEASE';
  label: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
  description: string;
  completedAt?: string;
  completedBy?: string;
}

export interface RegulatoryChange {
  id: string;
  title: string;
  category: 'NOTIFICATION' | 'CIRCULAR' | 'ADVISORY' | 'RATE_CHANGE' | 'HSN_CHANGE' | 'VALIDATION_CHANGE' | 'FILING_CHANGE';
  source: string;
  effectiveDate: string; // Effective Dates
  ruleVersion: string; // Rule Versions
  description: string;
  status: 'PENDING' | 'APPLIED';
  impactScore: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAnalysis: string;
  lifecycle: LifecycleStage[];
  ruleChangePayload: {
    einvoiceThreshold?: number;
    blockedItcKeywords?: string[];
    hsnRateOverrides?: { [hsn: string]: number };
    dueDateExtensions?: { [returnType: string]: string };
  };
  comparison?: {
    previous: {
      title: string;
      details: Array<{ key: string; value: string }>;
    };
    updated: {
      title: string;
      details: Array<{ key: string; value: string }>;
    };
  };
  appliedAt?: string;
  appliedBy?: string;
}

// In-memory active regulatory configuration
export interface RegulatoryConfig {
  einvoiceThreshold: number; // in Crores
  blockedItcKeywords: string[];
  hsnRateOverrides: { [hsn: string]: number };
  dueDateExtensions: { [returnType: string]: string };
}

// Default initial config derived from Indian GST statutes
let activeConfig: RegulatoryConfig = {
  einvoiceThreshold: 5, // ₹5 Crores
  blockedItcKeywords: ['food', 'beverage', 'car hire', 'motor vehicle', 'club membership', 'catering', 'life insurance', 'health insurance', 'beauty treatment', 'travel benefit'],
  hsnRateOverrides: {
    '8471': 18, // Computers & processors
    '8517': 18, // Mobile phones
    '9983': 18  // IT and professional consultancy services
  },
  dueDateExtensions: {
    'GSTR-1': '11th of next month',
    'GSTR-3B': '20th of next month',
    'GSTR-9': '31st December'
  }
};

const initialRegulatoryChanges: RegulatoryChange[] = [
  {
    id: 'reg-01',
    title: 'Lowering of Mandatory E-Invoicing Threshold to ₹2 Crores',
    category: 'VALIDATION_CHANGE',
    source: 'GST Council Notification No. 15/2026',
    effectiveDate: '2026-10-01',
    ruleVersion: 'v2.4.0',
    description: 'The GST Council has approved lowering the aggregate turnover threshold for mandatory generation of e-invoices from ₹5 Crores to ₹2 Crores. Any business exceeding ₹2 Crores aggregate turnover in any preceding financial year must generate IRNs for B2B supplies.',
    status: 'PENDING',
    impactScore: 'HIGH',
    impactAnalysis: 'Your current tenant enterprise aggregate turnover is approximately ₹3.8 Crores. This change will make E-Invoicing mandatory for your organization starting October 1st, 2026. Action required: Enable e-invoicing validations for all Sales registers.',
    ruleChangePayload: {
      einvoiceThreshold: 2
    },
    comparison: {
      previous: {
        title: 'Legacy E-Invoicing Threshold Configuration',
        details: [
          { key: 'Applicability threshold', value: '₹5 Crores aggregate turnover' },
          { key: 'Validation strictness', value: 'Permissive Warning levels' },
          { key: 'IRN Registration SLA', value: '72 Hours delivery window' },
          { key: 'API Gateway schema', value: 'v1.03 legacy JSON format' }
        ]
      },
      updated: {
        title: 'Lowered E-Invoicing Threshold Configuration',
        details: [
          { key: 'Applicability threshold', value: '₹2 Crores aggregate turnover' },
          { key: 'Validation strictness', value: 'Mandatory Block on mismatch' },
          { key: 'IRN Registration SLA', value: 'Strict 24 Hours window' },
          { key: 'API Gateway schema', value: 'v2.4.0 optimized JSON schema' }
        ]
      }
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'CBIC Gazette Notification published.', completedAt: '2026-08-01' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'Parser auto-created intelligence record reg-01.', completedAt: '2026-08-02' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: 'Calculated impact: Over ₹3.8Cr turnover triggers e-invoice requirements.', completedAt: '2026-08-03' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Modified GSTRuleEngine validations to intercept threshold value of 2.', completedAt: '2026-08-05' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'All 24 validation test scenarios passed successfully.', completedAt: '2026-08-06' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Completed IRP API handshake simulations in sandbox.', completedAt: '2026-08-07' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Validated back-compatibility with 15,000 historical documents.', completedAt: '2026-08-09' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'IN_PROGRESS', description: 'Pending final executive approval from Lead Corporate Controller.', completedAt: undefined },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Promote active validation parameter to primary live engine.', completedAt: undefined }
    ]
  },
  {
    id: 'reg-02',
    title: 'Expansion of Blocked ITC under Section 17(5) to include Executive Gym Memberships',
    category: 'CIRCULAR',
    source: 'GST Council Circular No. 248/2026',
    effectiveDate: '2026-09-01',
    ruleVersion: 'v1.18.2',
    description: 'Clarity has been issued declaring that corporate memberships of fitness centers, gyms, and health clubs are strictly ineligible for Input Tax Credit under Section 17(5), even if provided for employee wellbeing programs or occupational perks.',
    status: 'PENDING',
    impactScore: 'MEDIUM',
    impactAnalysis: 'Our scans identified 4 recurring bookings categorized as "gym membership" or "fitness subscription" totaling ₹1,20,000. Applying this rule will automatically block ITC claims on these ledger entries, saving future tax interest penalties.',
    ruleChangePayload: {
      blockedItcKeywords: ['gym membership', 'fitness club', 'health center']
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'CBIC Circular No. 248/2026 uploaded.', completedAt: '2026-08-05' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'System classified under Circular Section 17(5) exclusions.', completedAt: '2026-08-06' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: '4 purchase transactions flagged with keywords "gym", "fitness".', completedAt: '2026-08-07' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Updated blocked matching dictionaries.', completedAt: '2026-08-08' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'Passed mock audit validations (12/12).', completedAt: '2026-08-10' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Tested ledger exclusions dynamically.', completedAt: '2026-08-11' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Confirmed zero overlap with valid business equipment purchases.', completedAt: '2026-08-12' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'COMPLETED', description: 'UAT certified by Compliance Team.', completedAt: '2026-08-14' },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Pending manual deployment trigger in compliance board.', completedAt: undefined }
    ]
  },
  {
    id: 'reg-03',
    title: 'Emergency Extension of GSTR-3B Filing Deadline for Quarter Ending June 2026',
    category: 'FILING_CHANGE',
    source: 'GSTN Portal Order No. 04/2026',
    effectiveDate: '2026-08-15',
    ruleVersion: 'v1.4.1',
    description: 'Due to GSP gateway server congestion, the filing deadline for GSTR-3B for the return period June 2026 is extended by 5 days from 20th August to 25th August, 2026 without late fees.',
    status: 'PENDING',
    impactScore: 'LOW',
    impactAnalysis: 'Provides a safety margin of 5 additional days to finalise multi-branch invoice matches and complete approver signatures. This extends the calendar deadline displays in the active dashboard widgets.',
    ruleChangePayload: {
      dueDateExtensions: {
        'GSTR-3B': '25th of next month (Extended for June 2026 Period)'
      }
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'GSTN Order published on official portal.', completedAt: '2026-08-12' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'Order identified and parsed.', completedAt: '2026-08-13' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: 'Tax calendar adjusted for August return filing.', completedAt: '2026-08-13' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Adjusted compliance calendar state vectors.', completedAt: '2026-08-14' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'Passed mock submission calculations.', completedAt: '2026-08-14' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Validated schema compatibility on state gateways.', completedAt: '2026-08-15' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Verified zero impact on other return due dates.', completedAt: '2026-08-15' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'COMPLETED', description: 'Automated sign-off on emergency orders.', completedAt: '2026-08-15' },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Ready to sync active calendar state.', completedAt: undefined }
    ]
  },
  {
    id: 'reg-04',
    title: 'GST Rate Cut on Corporate Cloud Infrastructure and IT Hosting',
    category: 'RATE_CHANGE',
    source: 'GST Amendment Act 3/2026',
    effectiveDate: '2026-09-01',
    ruleVersion: 'v3.1.0',
    description: 'In an effort to boost cloud adoption, the GST Council has reduced the GST rate on IT hosting services, server space, and cloud infrastructure subscriptions (HSN 998315) from 18% to 12%.',
    status: 'PENDING',
    impactScore: 'MEDIUM',
    impactAnalysis: 'You have recurring expenses under HSN "9983" (Server space & SaaS tools). Applying this rate update ensures line-item audits flag vendor invoices charging the outdated 18% tax rate, allowing you to dispute excess tax valuations.',
    ruleChangePayload: {
      hsnRateOverrides: {
        '9983': 12
      }
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'Act 3/2026 parsed.', completedAt: '2026-08-10' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'Created active rate update record.', completedAt: '2026-08-11' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: 'Flagged Cloud subscription vendors charging 18%.', completedAt: '2026-08-12' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Configured HSN override mappings.', completedAt: '2026-08-13' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'Completed test run on billing catalog.', completedAt: '2026-08-14' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Completed mock tax calculations.', completedAt: '2026-08-15' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Ensured zero impact on non-related SaaS HSNs.', completedAt: '2026-08-15' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'COMPLETED', description: 'Approved by Head of Indirect Tax.', completedAt: '2026-08-16' },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Awaiting deployment window.', completedAt: undefined }
    ]
  },
  {
    id: 'reg-05',
    title: 'GST Council Advisory on Input Tax Credit (ITC) Matching Rules (Rule 36(4))',
    category: 'ADVISORY',
    source: 'GST Advisory No. 12/2026',
    effectiveDate: '2026-08-18',
    ruleVersion: 'v1.0.0',
    description: 'Advisory on strict adherence to GSTR-2B matching protocols. Invoices not auto-populating in GSTR-2B must not be provisionally claimed beyond a 5% buffer margin.',
    status: 'PENDING',
    impactScore: 'MEDIUM',
    impactAnalysis: 'Matches existing reconciliation engine profiles. Ready to activate strict provisional limit validations on current input ledger entries.',
    ruleChangePayload: {
      blockedItcKeywords: ['provisional buffer limit']
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'GST Council portal advisory issued.', completedAt: '2026-08-14' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'System logged advisory under 36(4) rules.', completedAt: '2026-08-15' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: 'Reconciliation discrepancies scanned.', completedAt: '2026-08-15' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Updated GSTR-2B validation filters.', completedAt: '2026-08-16' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'Engine rule test passed (6/6 scenarios).', completedAt: '2026-08-16' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Gateway data stream successfully parsed.', completedAt: '2026-08-17' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Recon metrics are perfectly stable.', completedAt: '2026-08-17' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'COMPLETED', description: 'Approved by Lead Compliance Officer.', completedAt: '2026-08-17' },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Deployment triggered in queue.', completedAt: undefined }
    ]
  },
  {
    id: 'reg-06',
    title: 'HSN Classification & Rate Realignment for Renewable Energy Components',
    category: 'HSN_CHANGE',
    source: 'GST Amendment Act 5/2026',
    effectiveDate: '2026-09-15',
    ruleVersion: 'v4.0.0',
    description: 'Statutory realignment of HSN Code 85044090 (Solar Inverters & Power Conditioners) and HSN Code 85414011 (Solar Photovoltaic Cells) to streamline clean energy tax classifications under standard tariff schedules.',
    status: 'PENDING',
    impactScore: 'HIGH',
    impactAnalysis: 'This directly affects the active procurement lists for our sustainable infrastructure sub-projects. Invoices matching these specific HSN tags will be validated under the revised tariff and verification schema.',
    ruleChangePayload: {
      hsnRateOverrides: {
        '8504': 12,
        '8541': 12
      }
    },
    comparison: {
      previous: {
        title: 'Legacy Clean Energy Tariff Schema (Pre-Amended)',
        details: [
          { key: 'HSN 85044090 Solar Inverters', value: '5% Concessional Rate' },
          { key: 'HSN 85414011 PV Solar Cells', value: '18% Standard Electronics Rate' },
          { key: 'Classification pattern', value: 'Inverted Duty Structure discrepancy' },
          { key: 'Certification requirement', value: 'MNRE ministry physical certificates' }
        ]
      },
      updated: {
        title: 'Amended Simplified Tariff Schema (Realignment)',
        details: [
          { key: 'HSN 85044090 Solar Inverters', value: '12% Rationalized Single Rate' },
          { key: 'HSN 85414011 PV Solar Cells', value: '12% Aligned Single Rate' },
          { key: 'Classification pattern', value: 'Unified Green-Energy Category' },
          { key: 'Certification requirement', value: 'Self-declaration portal upload' }
        ]
      }
    },
    lifecycle: [
      { name: 'GOVT_CHANGE', label: 'Government / GSTN Change', status: 'COMPLETED', description: 'Gazette notification published by CBIC.', completedAt: '2026-08-11' },
      { name: 'RECORD_CREATED', label: 'Regulatory Change Record', status: 'COMPLETED', description: 'System classified under HSN Tariff realignment.', completedAt: '2026-08-12' },
      { name: 'IMPACT_ANALYSIS', label: 'Impact Analysis', status: 'COMPLETED', description: 'Affected vendor profiles cataloged and matched.', completedAt: '2026-08-13' },
      { name: 'RULE_UPDATE', label: 'Rule Update', status: 'COMPLETED', description: 'Tax engine tariff schedules revised for HSN 8504/8541.', completedAt: '2026-08-14' },
      { name: 'AUTOMATED_TESTS', label: 'Automated Tests', status: 'COMPLETED', description: 'Passed mock purchase tax calculations (18/18).', completedAt: '2026-08-15' },
      { name: 'SANDBOX_VALIDATION', label: 'Sandbox Validation', status: 'COMPLETED', description: 'Handshake completed with Sandbox GSP API.', completedAt: '2026-08-16' },
      { name: 'REGRESSION_TESTING', label: 'Regression Testing', status: 'COMPLETED', description: 'Zero tariff conflicts with standard electrical equipment.', completedAt: '2026-08-16' },
      { name: 'UAT', label: 'UAT Sign-off', status: 'COMPLETED', description: 'Approved by sustainable infrastructure project auditor.', completedAt: '2026-08-17' },
      { name: 'PRODUCTION_RELEASE', label: 'Production Release', status: 'PENDING', description: 'Awaiting deployment window.', completedAt: undefined }
    ]
  }
];

let regulatoryChangesStore = [...initialRegulatoryChanges];

export const GSTRegulatoryService = {
  getRegulatoryChanges: (): RegulatoryChange[] => {
    return regulatoryChangesStore;
  },

  getActiveConfig: (): RegulatoryConfig => {
    return activeConfig;
  },

  applyRegulatoryPatch: async (id: string, userId: string, userName: string): Promise<boolean> => {
    const changeIndex = regulatoryChangesStore.findIndex(c => c.id === id);
    if (changeIndex === -1) return false;
    
    const change = regulatoryChangesStore[changeIndex];
    if (change.status === 'APPLIED') return true;

    // Execute rule changes on active configuration
    const payload = change.ruleChangePayload;
    
    if (payload.einvoiceThreshold !== undefined) {
      activeConfig.einvoiceThreshold = payload.einvoiceThreshold;
    }
    if (payload.blockedItcKeywords !== undefined) {
      activeConfig.blockedItcKeywords = [...activeConfig.blockedItcKeywords, ...payload.blockedItcKeywords];
    }
    if (payload.hsnRateOverrides !== undefined) {
      activeConfig.hsnRateOverrides = { ...activeConfig.hsnRateOverrides, ...payload.hsnRateOverrides };
    }
    if (payload.dueDateExtensions !== undefined) {
      activeConfig.dueDateExtensions = { ...activeConfig.dueDateExtensions, ...payload.dueDateExtensions };
    }

    // Mark as APPLIED
    const updatedLifecycle = change.lifecycle.map(stage => {
      if (stage.name === 'UAT' || stage.name === 'PRODUCTION_RELEASE') {
        return {
          ...stage,
          status: 'COMPLETED' as const,
          completedAt: new Date().toISOString().split('T')[0],
          completedBy: userName
        };
      }
      return stage;
    });

    regulatoryChangesStore[changeIndex] = {
      ...change,
      status: 'APPLIED',
      appliedAt: new Date().toISOString(),
      appliedBy: `${userName} (${userId})`,
      lifecycle: updatedLifecycle
    };

    const auditChanges: any[] = [];
    if (payload.einvoiceThreshold !== undefined) {
      auditChanges.push({ field: 'einvoiceThreshold', oldValue: '5', newValue: String(payload.einvoiceThreshold) });
    }
    if (payload.blockedItcKeywords !== undefined) {
      auditChanges.push({ field: 'blockedItcKeywords', oldValue: 'Standard Restricted list', newValue: payload.blockedItcKeywords.join(', ') });
    }
    if (payload.hsnRateOverrides !== undefined) {
      auditChanges.push({ field: 'hsnRateOverrides', oldValue: 'Standard HSN catalog rates', newValue: JSON.stringify(payload.hsnRateOverrides) });
    }
    if (payload.dueDateExtensions !== undefined) {
      auditChanges.push({ field: 'dueDateExtensions', oldValue: 'Original statutory dates', newValue: JSON.stringify(payload.dueDateExtensions) });
    }

    // Log this action to the system-wide Audit Trail
    await logAuditAction(
      `Regulatory Patch Applied: ${change.id}`,
      'SETTINGS',
      `Fitted statutory amendment "${change.title}" by ${change.source}. Config fields changed.`,
      auditChanges
    );

    return true;
  },

  // Audit incoming line item against the active dynamically patched rules
  auditLineWithActiveRules: (item: any): any[] => {
    const violations: any[] = [];
    const desc = (item.description || '').toLowerCase();
    
    // Check dynamic blocked keywords
    const activeKeywords = activeConfig.blockedItcKeywords;
    const matched = activeKeywords.find(kw => desc.includes(kw));
    if (matched) {
      violations.push({
        field: 'description',
        severity: 'HIGH',
        category: 'ITC_BLOCK',
        description: `Blocked Input Tax Credit (ITC) under Section 17(5) [Applied via Regulatory Rule Change]. Item matched keywords: "${matched}".`,
        recommendation: 'Verify expense class. Block the ITC ledger claims to satisfy statutory regulations.'
      });
    }

    // Check dynamic tax rate override for HSN codes
    if (item.hsnSac) {
      const hsnPrefix = item.hsnSac.substring(0, 4);
      const expectedRate = activeConfig.hsnRateOverrides[hsnPrefix] || activeConfig.hsnRateOverrides[item.hsnSac];
      if (expectedRate !== undefined && item.taxRate !== expectedRate) {
        violations.push({
          field: 'taxRate',
          severity: 'MEDIUM',
          category: 'TAX_RATE',
          description: `Outdated or incorrect GST rate of ${item.taxRate}% specified. Regulatory standard for HSN prefix ${hsnPrefix} is currently ${expectedRate}%.`,
          recommendation: `Align line-item taxation rate to ${expectedRate}% to match active GST council guidelines.`
        });
      }
    }

    return violations;
  }
};
