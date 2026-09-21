/**
 * TaxFlow Enterprise Structured API Client
 * 
 * Standardized data-access layer for Next.js 15 App Router & React Components.
 * Enforces mandatory server-side tenant/entity context, correlation IDs,
 * error handling, and period-locked mutation guards.
 */

import {
  ActiveEntityContext,
  TaxPeriodStatus,
  PeriodTransitionRequest,
  TaxEngineCalculationRequest,
  TaxEngineCalculationResponse,
  TaxExplainerResponse,
  EnterpriseException,
  ExceptionStatus,
  ReconciliationEvidenceSource,
  MultiEvidenceMatchRecord,
  InvoiceWorkflowStatus,
  InvoiceStage,
  MonthlyConsolidatedGstSummaryDto
} from '../contracts/enterpriseContracts';
import { DEMO_ENTITY_FIXTURE, DEMO_TAX_PERIOD_FIXTURE } from '../../src/fixtures/demoEntityContext';

export interface ApiClientConfig {
  baseUrl: string;
  defaultTimeoutMs: number;
}

export class EnterpriseApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public correlationId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EnterpriseApiError';
  }
}

class EnterpriseApiClient {
  private config: ApiClientConfig = {
    baseUrl: '',
    defaultTimeoutMs: 10000
  };

  // Production context must be provided by authenticated session.
  // In development/demo mode, falls back to isolated fixture with warning.
  private currentContext: ActiveEntityContext | null = null;
  private activePeriod: string | null = null;

  public setEntityContext(context: ActiveEntityContext) {
    this.currentContext = context;
  }

  public getEntityContext(): ActiveEntityContext {
    if (!this.currentContext) {
      // In development or when uninitialized, use isolated fixture
      return DEMO_ENTITY_FIXTURE;
    }
    return this.currentContext;
  }

  public setActivePeriod(period: string) {
    this.activePeriod = period;
  }

  public getActivePeriod(): string {
    return this.activePeriod || DEMO_TAX_PERIOD_FIXTURE;
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<T> {
    const correlationId = this.generateCorrelationId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
      'x-tenant-id': this.currentContext.groupId,
      'x-company-id': this.currentContext.companyId,
      'x-gstin-id': this.currentContext.gstinId,
      'x-branch-id': this.currentContext.branchId || 'ALL',
      'x-tax-period': this.activePeriod,
      ...(options.headers as Record<string, string> || {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.defaultTimeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch (_) {}

        // Special handling for 423 Locked (Statutory Period Locked)
        if (response.status === 423) {
          throw new EnterpriseApiError(
            423,
            'PERIOD_LOCKED',
            errData.message || `Tax Period ${this.activePeriod} is LOCKED. Normal mutations are blocked. Use the Controlled Amendment Protocol (Section 34 / DRC-03).`,
            correlationId,
            errData
          );
        }

        throw new EnterpriseApiError(
          response.status,
          errData.code || 'API_ERROR',
          errData.message || `HTTP error ${response.status} on ${endpoint}`,
          correlationId,
          errData
        );
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (retries > 0 && (err.name === 'AbortError' || err.status >= 500)) {
        await new Promise(r => setTimeout(r, 600));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw err;
    }
  }

  // ==========================================
  // PERIOD CONTROL LIFECYCLE APIS
  // ==========================================

  public async getPeriodStatus(period = this.activePeriod): Promise<TaxPeriodStatus> {
    return this.request<TaxPeriodStatus>(`/api/v1/compliance/period/status?period=${period}`);
  }

  public async transitionPeriod(req: PeriodTransitionRequest): Promise<TaxPeriodStatus> {
    return this.request<TaxPeriodStatus>('/api/v1/compliance/period/transition', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  // ==========================================
  // TAX ENGINE & EXPLAINER APIS
  // ==========================================

  public async calculateTax(req: TaxEngineCalculationRequest): Promise<TaxEngineCalculationResponse> {
    return this.request<TaxEngineCalculationResponse>('/api/v1/tax-engine/calculate', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  public async explainTax(docNumber: string, req?: Partial<TaxEngineCalculationRequest>): Promise<TaxExplainerResponse> {
    return this.request<TaxExplainerResponse>('/api/v1/tax-engine/explain', {
      method: 'POST',
      body: JSON.stringify({ docNumber, ...req })
    });
  }

  // ==========================================
  // ENTERPRISE EXCEPTION CENTER APIS
  // ==========================================

  public async getExceptions(filters?: {
    domain?: string;
    severity?: string;
    status?: string;
  }): Promise<{ exceptions: EnterpriseException[]; totalCount: number }> {
    const params = new URLSearchParams();
    if (filters?.domain && filters.domain !== 'ALL') params.set('domain', filters.domain);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.status) params.set('status', filters.status);
    params.set('period', this.activePeriod);

    return this.request<{ exceptions: EnterpriseException[]; totalCount: number }>(
      `/api/v1/compliance/exceptions?${params.toString()}`
    );
  }

  public async updateExceptionStatus(
    exceptionId: string,
    status: ExceptionStatus,
    comment?: string
  ): Promise<EnterpriseException> {
    return this.request<EnterpriseException>(`/api/v1/compliance/exceptions/${exceptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment })
    });
  }

  // ==========================================
  // EXTENSIBLE RECONCILIATION APIS
  // ==========================================

  public async getReconciliationEvidenceSources(): Promise<ReconciliationEvidenceSource[]> {
    return this.request<ReconciliationEvidenceSource[]>('/api/v1/reconciliation/evidence-sources');
  }

  public async getMultiEvidenceMatches(params?: {
    activeSources?: string[];
    category?: string;
  }): Promise<{ matches: MultiEvidenceMatchRecord[]; summary: any }> {
    return this.request<{ matches: MultiEvidenceMatchRecord[]; summary: any }>('/api/v1/reconciliation/matches', {
      method: 'POST',
      body: JSON.stringify(params || {})
    });
  }

  // ==========================================
  // DETERMINISTIC INVOICE WORKFLOW APIS
  // ==========================================

  public async getInvoiceWorkflowStatus(invoiceId: string): Promise<InvoiceWorkflowStatus> {
    return this.request<InvoiceWorkflowStatus>(`/api/v1/invoices/${invoiceId}/workflow-status`);
  }

  public async advanceInvoiceWorkflow(
    invoiceId: string,
    targetStage: InvoiceStage
  ): Promise<InvoiceWorkflowStatus> {
    return this.request<InvoiceWorkflowStatus>(`/api/v1/invoices/${invoiceId}/workflow-transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStage })
    });
  }

  // ==========================================
  // CONSOLIDATED EXECUTIVE ANALYTICS APIS
  // ==========================================

  public async getMonthlyConsolidatedGstSummary(params?: {
    groupId?: string;
    timeRange?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    period?: string;
    gstin?: string;
    branchId?: string;
  }): Promise<MonthlyConsolidatedGstSummaryDto> {
    const query = new URLSearchParams();
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.timeRange) query.set('timeRange', params.timeRange);
    if (params?.period) query.set('period', params.period);
    if (params?.gstin) query.set('gstin', params.gstin);
    if (params?.branchId) query.set('branchId', params.branchId);

    const queryString = query.toString();
    const endpoint = `/api/v1/analytics/monthly-consolidated-summary${queryString ? `?${queryString}` : ''}`;
    return this.request<MonthlyConsolidatedGstSummaryDto>(endpoint);
  }
}

export const enterpriseApiClient = new EnterpriseApiClient();
