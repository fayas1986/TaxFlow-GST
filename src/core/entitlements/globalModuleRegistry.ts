/**
 * Global Module Access & Feature Registry
 * Controls platform-wide module availability, kill-switches, minimum required plan tiers, and SLA metrics.
 */

import { Feature, PlanCode } from './types';

export type ModuleStatus = 'ACTIVE' | 'MAINTENANCE' | 'BETA' | 'DISABLED';

export interface GlobalModuleConfig {
  feature: Feature;
  name: string;
  category: 'Core Operations' | 'Logistics' | 'Tax Engine' | 'Compliance' | 'Enterprise' | 'AI Innovation' | 'Developer' | 'Security';
  description: string;
  status: ModuleStatus;
  minPlanTier: PlanCode;
  globalKillSwitch: boolean;
  maintenanceNotice?: string;
  uptimePct: number;
  monthlyRequests: number;
  avgLatencyMs: number;
  lastUpdated: string;
  updatedBy: string;
}

export const DEFAULT_GLOBAL_MODULES: GlobalModuleConfig[] = [
  {
    feature: Feature.INVOICES,
    name: 'Sales Invoicing & Billing',
    category: 'Core Operations',
    description: 'Creation, numbering, validation, PDF dispatch & ledger posting',
    status: 'ACTIVE',
    minPlanTier: PlanCode.STARTER,
    globalKillSwitch: false,
    uptimePct: 99.98,
    monthlyRequests: 485200,
    avgLatencyMs: 42,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.PURCHASES,
    name: 'Vendor Purchases & Inward Bills',
    category: 'Core Operations',
    description: 'Purchase register, 3-way matching & expense tracking',
    status: 'ACTIVE',
    minPlanTier: PlanCode.STARTER,
    globalKillSwitch: false,
    uptimePct: 99.95,
    monthlyRequests: 312000,
    avgLatencyMs: 48,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.E_WAY_BILL,
    name: 'NIC E-Way Bill Generation',
    category: 'Logistics',
    description: 'Direct NIC portal integration, Part-A/B updates & vehicle tracking',
    status: 'ACTIVE',
    minPlanTier: PlanCode.BUSINESS,
    globalKillSwitch: false,
    uptimePct: 99.91,
    monthlyRequests: 194500,
    avgLatencyMs: 120,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.GST_RETURNS,
    name: 'GSTR-1, 2B, 3B Returns & Filing',
    category: 'Tax Engine',
    description: 'Monthly/quarterly summary generation & JSON return export',
    status: 'ACTIVE',
    minPlanTier: PlanCode.STARTER,
    globalKillSwitch: false,
    uptimePct: 99.99,
    monthlyRequests: 128400,
    avgLatencyMs: 85,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.RECONCILIATION,
    name: '2B vs Purchase Auto-Reconciliation',
    category: 'Compliance',
    description: 'Smart 5-way matching engine with configurable tolerance rules',
    status: 'ACTIVE',
    minPlanTier: PlanCode.BUSINESS,
    globalKillSwitch: false,
    uptimePct: 99.88,
    monthlyRequests: 245000,
    avgLatencyMs: 140,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.ITC,
    name: 'Input Tax Credit (ITC) Optimizer',
    category: 'Tax Engine',
    description: 'Rule 37/42/43 reversal calculations & ledger tracking',
    status: 'ACTIVE',
    minPlanTier: PlanCode.PROFESSIONAL,
    globalKillSwitch: false,
    uptimePct: 99.94,
    monthlyRequests: 87000,
    avgLatencyMs: 65,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.E_INVOICE,
    name: 'NIC E-Invoicing IRN & QR Code',
    category: 'Compliance',
    description: 'Mandatory B2B e-invoice generation with digital signature & NIC IRP sync',
    status: 'ACTIVE',
    minPlanTier: PlanCode.PROFESSIONAL,
    globalKillSwitch: false,
    uptimePct: 99.92,
    monthlyRequests: 320000,
    avgLatencyMs: 110,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.MULTI_GSTIN,
    name: 'Multi-State GSTIN Management',
    category: 'Enterprise',
    description: 'Consolidated multi-state reporting and branch filtering across India',
    status: 'ACTIVE',
    minPlanTier: PlanCode.PROFESSIONAL,
    globalKillSwitch: false,
    uptimePct: 99.99,
    monthlyRequests: 160000,
    avgLatencyMs: 35,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.MULTI_BRANCH,
    name: 'Multi-Branch & SEZ Regional Hierarchy',
    category: 'Enterprise',
    description: 'Sub-branch isolation, SEZ zero-rated supplies & unit codes',
    status: 'ACTIVE',
    minPlanTier: PlanCode.PROFESSIONAL,
    globalKillSwitch: false,
    uptimePct: 99.97,
    monthlyRequests: 110000,
    avgLatencyMs: 38,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.AUTOMATION,
    name: 'GST Rules & Workflow Automation',
    category: 'Tax Engine',
    description: 'Custom triggers, auto-reminders and compliance approval flows',
    status: 'ACTIVE',
    minPlanTier: PlanCode.PROFESSIONAL,
    globalKillSwitch: false,
    uptimePct: 99.85,
    monthlyRequests: 95000,
    avgLatencyMs: 55,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.AI,
    name: 'Gemini AI Tax Copilot & Anomaly Detector',
    category: 'AI Innovation',
    description: 'Intelligent HSN classification & tax risk anomaly scoring',
    status: 'BETA',
    minPlanTier: PlanCode.ENTERPRISE,
    globalKillSwitch: false,
    uptimePct: 99.75,
    monthlyRequests: 54000,
    avgLatencyMs: 380,
    lastUpdated: '2026-09-21T08:00:00.000Z',
    updatedBy: 'Super Admin'
  },
  {
    feature: Feature.ERP_INTEGRATION,
    name: 'SAP / Oracle / Tally ERP Connector',
    category: 'Developer',
    description: 'Bi-directional ERP sync & automated webhook data pipeline',
    status: 'ACTIVE',
    minPlanTier: PlanCode.ENTERPRISE,
    globalKillSwitch: false,
    uptimePct: 99.90,
    monthlyRequests: 78000,
    avgLatencyMs: 150,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.API,
    name: 'Developer API Access & Tokens',
    category: 'Developer',
    description: 'High-throughput REST API for headless integrations',
    status: 'ACTIVE',
    minPlanTier: PlanCode.ENTERPRISE,
    globalKillSwitch: false,
    uptimePct: 99.96,
    monthlyRequests: 1450000,
    avgLatencyMs: 28,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.WEBHOOKS,
    name: 'Real-time Event Webhooks',
    category: 'Developer',
    description: 'Outbound webhook notifications on compliance events',
    status: 'ACTIVE',
    minPlanTier: PlanCode.ENTERPRISE,
    globalKillSwitch: false,
    uptimePct: 99.92,
    monthlyRequests: 420000,
    avgLatencyMs: 45,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  },
  {
    feature: Feature.ADVANCED_RBAC,
    name: 'Granular RBAC & Security Audit Logs',
    category: 'Security',
    description: 'Custom roles, immutable audit trail & IP restrictions',
    status: 'ACTIVE',
    minPlanTier: PlanCode.ENTERPRISE,
    globalKillSwitch: false,
    uptimePct: 100.0,
    monthlyRequests: 580000,
    avgLatencyMs: 18,
    lastUpdated: '2026-09-20T10:00:00.000Z',
    updatedBy: 'System Core'
  }
];

class GlobalModuleRegistry {
  private modules: Map<Feature, GlobalModuleConfig> = new Map();

  constructor() {
    this.resetToDefaults();
  }

  public resetToDefaults(): GlobalModuleConfig[] {
    this.modules.clear();
    DEFAULT_GLOBAL_MODULES.forEach((m) => {
      this.modules.set(m.feature, JSON.parse(JSON.stringify(m)));
    });
    return this.getAllModules();
  }

  public getAllModules(): GlobalModuleConfig[] {
    return Array.from(this.modules.values());
  }

  public getModule(feature: Feature): GlobalModuleConfig | null {
    return this.modules.get(feature) || null;
  }

  public updateModule(
    feature: Feature,
    updates: Partial<GlobalModuleConfig>,
    updatedBy = 'Super Admin'
  ): GlobalModuleConfig {
    const existing = this.modules.get(feature);
    if (!existing) {
      throw new Error(`Module ${feature} not found in global registry`);
    }

    const updated: GlobalModuleConfig = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString(),
      updatedBy
    };

    this.modules.set(feature, updated);
    return updated;
  }

  public toggleKillSwitch(
    feature: Feature,
    killSwitch: boolean,
    updatedBy = 'Super Admin'
  ): GlobalModuleConfig {
    return this.updateModule(
      feature,
      {
        globalKillSwitch: killSwitch,
        status: killSwitch ? 'DISABLED' : 'ACTIVE'
      },
      updatedBy
    );
  }

  public isFeatureGloballyAvailable(feature: Feature): boolean {
    const config = this.modules.get(feature);
    if (!config) return true;
    if (config.globalKillSwitch || config.status === 'DISABLED') return false;
    return true;
  }
}

export const globalModuleRegistry = new GlobalModuleRegistry();
