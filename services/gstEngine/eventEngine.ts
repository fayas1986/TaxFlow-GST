import { ComplianceAlert } from '../../types';

export type ComplianceEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_CANCELLED'
  | 'PURCHASE_POSTED'
  | 'CREDIT_NOTE_CREATED'
  | 'DEBIT_NOTE_CREATED'
  | 'IRN_GENERATED'
  | 'IRN_FAILED'
  | 'IRN_CANCELLED'
  | 'EWB_GENERATED'
  | 'EWB_FAILED'
  | 'GST_DATA_RECEIVED'
  | 'RECONCILIATION_COMPLETED'
  | 'ITC_MISMATCH_DETECTED'
  | 'RCM_EXPOSURE_DETECTED'
  | 'RETURN_GENERATED'
  | 'RETURN_APPROVED'
  | 'RETURN_FILED';

export interface ComplianceEvent {
  id: string;
  tenantId: string;
  type: ComplianceEventType;
  timestamp: string;
  userId: string;
  userName: string;
  payload: any;
  referenceId?: string;
}

export interface ExceptionItem {
  id: string;
  tenantId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  eventRef: ComplianceEventType;
  referenceId?: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Real-Time Compliance Event Engine
 * Manages event publishing, rule evaluation, and automated exception triggering.
 */
export class GSTComplianceEventEngine {
  private static listeners: Map<ComplianceEventType, Array<(event: ComplianceEvent) => void>> = new Map();
  private static eventHistory: ComplianceEvent[] = [];
  private static exceptions: ExceptionItem[] = [];

  /**
   * Subscribes a listener to a specific compliance event type
   */
  public static subscribe(type: ComplianceEventType, callback: (event: ComplianceEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  /**
   * Unsubscribes a listener
   */
  public static unsubscribe(type: ComplianceEventType, callback: (event: ComplianceEvent) => void): void {
    if (!this.listeners.has(type)) return;
    const callbacks = this.listeners.get(type)!;
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Publishes a compliance event to the engine, processing real-time rules & alerts
   */
  public static dispatchEvent(event: Omit<ComplianceEvent, 'id' | 'timestamp'>): ComplianceEvent {
    const fullEvent: ComplianceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Keep an in-memory sliding window history of events
    this.eventHistory.unshift(fullEvent);
    if (this.eventHistory.length > 1000) {
      this.eventHistory.pop();
    }

    console.log(`[Event Engine] Event dispatched: ${fullEvent.type} (Tenant: ${fullEvent.tenantId})`);

    // Process immediate compliance rule matches (Heuristics)
    this.processEventRules(fullEvent);

    // Alert listeners
    const callbacks = this.listeners.get(fullEvent.type) || [];
    callbacks.forEach(cb => {
      try {
        cb(fullEvent);
      } catch (err) {
        console.error(`Error executing event listener for ${fullEvent.type}:`, err);
      }
    });

    return fullEvent;
  }

  /**
   * Evaluates rules against incoming events to create standard alerts and Exception Inbox items
   */
  private static processEventRules(event: ComplianceEvent): void {
    const { type, tenantId, payload, referenceId } = event;

    switch (type) {
      case 'INVOICE_CREATED':
      case 'INVOICE_UPDATED':
        // Run pre-compliance and generate data exceptions
        if (payload && payload.amount > 500000 && !payload.gstin) {
          this.triggerException({
            tenantId,
            severity: 'CRITICAL',
            title: 'E-Invoice Requirement Pending',
            description: `High-value B2C/unregistered transaction ₹${payload.amount.toLocaleString()} detected. Verify mandatory E-Invoice thresholds.`,
            eventRef: type,
            referenceId
          });
        }
        break;

      case 'IRN_FAILED':
        this.triggerException({
          tenantId,
          severity: 'HIGH',
          title: 'IRN Registration Failure',
          description: `E-Invoicing failed for ${payload.invoiceNumber || 'Invoice'}: ${payload.error || 'Unknown IRP mismatch'}`,
          eventRef: type,
          referenceId
        });
        break;

      case 'EWB_FAILED':
        this.triggerException({
          tenantId,
          severity: 'HIGH',
          title: 'E-Way Bill Assignment Failed',
          description: `Transit registration rejected: ${payload.error || 'Vehicle check fail'}`,
          eventRef: type,
          referenceId
        });
        break;

      case 'ITC_MISMATCH_DETECTED':
        this.triggerException({
          tenantId,
          severity: 'HIGH',
          title: 'ITC Credit Mismatch At Risk',
          description: `Internal purchase mismatch of ₹${payload.difference?.toLocaleString()} found on Invoice ${payload.invoiceNumber}.`,
          eventRef: type,
          referenceId
        });
        break;

      case 'RCM_EXPOSURE_DETECTED':
        this.triggerException({
          tenantId,
          severity: 'MEDIUM',
          title: 'Undeclared RCM Exposure Found',
          description: `Transaction for "${payload.description}" requires RCM tax liability validation under Section 9(3).`,
          eventRef: type,
          referenceId
        });
        break;

      case 'RETURN_FILED':
        // Clear matching exceptions
        this.resolveExceptionsByReference(referenceId);
        break;

      default:
        break;
    }
  }

  /**
   * Adds a structured exception into the accountant's Exception Inbox
   */
  public static triggerException(item: Omit<ExceptionItem, 'id' | 'resolved' | 'createdAt'>): ExceptionItem {
    const newEx: ExceptionItem = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      resolved: false,
      createdAt: new Date().toISOString(),
      ...item
    };

    // Avoid duplicate open exceptions for the same reference and title
    const duplicate = this.exceptions.find(
      e => e.tenantId === item.tenantId && 
           e.referenceId === item.referenceId && 
           e.title === item.title && 
           !e.resolved
    );

    if (!duplicate) {
      this.exceptions.unshift(newEx);
      console.log(`[Exception Triggered] Severity: ${newEx.severity} - ${newEx.title}`);
    }

    return duplicate || newEx;
  }

  /**
   * Marks a specific exception as resolved
   */
  public static resolveException(id: string): boolean {
    const ex = this.exceptions.find(e => e.id === id);
    if (ex && !ex.resolved) {
      ex.resolved = true;
      ex.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Resolves exceptions linked to a specific entity reference
   */
  public static resolveExceptionsByReference(referenceId?: string): void {
    if (!referenceId) return;
    this.exceptions.forEach(ex => {
      if (ex.referenceId === referenceId && !ex.resolved) {
        ex.resolved = true;
        ex.resolvedAt = new Date().toISOString();
      }
    });
  }

  /**
   * Gets list of active exceptions for a tenant (Exception Inbox feeds)
   */
  public static getExceptions(tenantId: string): ExceptionItem[] {
    // Populate default seeds if empty to provide a beautiful playground instantly
    if (this.exceptions.length === 0) {
      this.seedDefaultExceptions(tenantId);
    }
    return this.exceptions.filter(e => e.tenantId === tenantId);
  }

  /**
   * Fetch event logs
   */
  public static getHistory(tenantId: string): ComplianceEvent[] {
    return this.eventHistory.filter(h => h.tenantId === tenantId);
  }

  /**
   * Populates default compliance inbox items for demonstration and sandbox verification
   */
  private static seedDefaultExceptions(tenantId: string): void {
    const baseDate = new Date();
    this.exceptions = [
      {
        id: 'ex-seed-1',
        tenantId,
        severity: 'CRITICAL',
        title: 'GSTIN Format Mismatch',
        description: 'Invoice INV-2026-1044 has an invalid buyer GSTIN suffix character code. Required for GSTR-1 preparation.',
        eventRef: 'INVOICE_CREATED',
        referenceId: 'inv-t1-4',
        resolved: false,
        createdAt: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ex-seed-2',
        tenantId,
        severity: 'HIGH',
        title: 'ITC Credit Value Discrepancy',
        description: 'Purchase INV-2026-1011 GSTR-2B tax rate is filed at 12% but Books show 18% calculation. Risk of lost Input Tax Credit (₹18,500).',
        eventRef: 'ITC_MISMATCH_DETECTED',
        referenceId: 'inv-t1-11',
        resolved: false,
        createdAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ex-seed-3',
        tenantId,
        severity: 'MEDIUM',
        title: 'RCM Activity Check Required',
        description: 'Line item in voucher PUR-2026-1209 lists "Advocate Litigation Consulting Fees" but RCM Flag was not checked.',
        eventRef: 'RCM_EXPOSURE_DETECTED',
        referenceId: 'inv-t1-18',
        resolved: false,
        createdAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'ex-seed-4',
        tenantId,
        severity: 'LOW',
        title: 'E-Invoice Registration Delayed',
        description: 'Sales Invoice INV-2026-1025 has been created for 4 days but E-Invoice Ack number has not been logged.',
        eventRef: 'INVOICE_CREATED',
        referenceId: 'inv-t1-25',
        resolved: false,
        createdAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
}
