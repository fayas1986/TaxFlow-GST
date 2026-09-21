/**
 * Target Architecture: Event Bus
 * Event Broker, Queue Orchestrator, Pub-Sub Event Dispatcher
 */

export type ArchitectureEventType =
  | 'TRANSACTION_INGESTED'
  | 'CANONICAL_NORMALIZED'
  | 'DATA_QUALITY_ASSESSED'
  | 'VALIDATION_COMPLETED'
  | 'TAX_DETERMINED'
  | 'COMPLIANCE_EVALUATED'
  | 'RISK_SCORED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'EINVOICE_DISPATCHED'
  | 'EINVOICE_IRN_GENERATED'
  | 'EWAYBILL_GENERATED'
  | 'RECONCILIATION_MATCHED'
  | 'ITC_LOCKED'
  | 'RETURN_STAGED'
  | 'COMPLIANCE_LEDGER_POSTED';

export interface ArchitectureEvent<T = any> {
  eventId: string;
  eventType: ArchitectureEventType;
  timestamp: string;
  tenantId: string;
  traceId: string;
  source: 'TRANSACTION_ENGINE' | 'COMPLIANCE_ENGINE' | 'WORKFLOW_ENGINE' | 'EINVOICE_PIPELINE' | 'EWAYBILL_PIPELINE' | 'RECON_PIPELINE';
  payload: T;
  retryCount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DLQ';
  durationMs?: number;
}

export type EventHandler = (event: ArchitectureEvent) => Promise<void> | void;

export class EventBus {
  private static subscribers: Map<ArchitectureEventType, EventHandler[]> = new Map();
  private static eventHistory: ArchitectureEvent[] = [];
  private static maxHistory = 100;
  private static metrics = {
    totalEventsPublished: 0,
    totalEventsProcessed: 0,
    totalErrors: 0,
    activeQueueDepth: 0
  };

  static subscribe(eventType: ArchitectureEventType, handler: EventHandler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }

  static async publish<T = any>(
    eventType: ArchitectureEventType,
    source: ArchitectureEvent['source'],
    tenantId: string,
    payload: T,
    traceId?: string
  ): Promise<ArchitectureEvent<T>> {
    const event: ArchitectureEvent<T> = {
      eventId: `EVT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      eventType,
      timestamp: new Date().toISOString(),
      tenantId,
      traceId: traceId || `TRC-${Date.now().toString().slice(-6)}`,
      source,
      payload,
      retryCount: 0,
      status: 'PROCESSING'
    };

    const startTime = Date.now();
    this.metrics.totalEventsPublished++;
    this.metrics.activeQueueDepth++;

    const handlers = this.subscribers.get(eventType) || [];
    try {
      for (const handler of handlers) {
        await handler(event);
      }
      event.status = 'COMPLETED';
      event.durationMs = Date.now() - startTime;
      this.metrics.totalEventsProcessed++;
    } catch (err: any) {
      console.error(`[EventBus] Error processing ${eventType}:`, err);
      event.status = 'FAILED';
      event.durationMs = Date.now() - startTime;
      this.metrics.totalErrors++;
    } finally {
      this.metrics.activeQueueDepth = Math.max(0, this.metrics.activeQueueDepth - 1);
    }

    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.pop();
    }

    return event;
  }

  static getEventHistory(limit = 25): ArchitectureEvent[] {
    return this.eventHistory.slice(0, limit);
  }

  static getMetrics() {
    return {
      ...this.metrics,
      historyCount: this.eventHistory.length
    };
  }

  static clearHistory() {
    this.eventHistory = [];
  }
}
