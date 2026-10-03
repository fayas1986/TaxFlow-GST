export interface CanonicalIntegrationEvent<T = any> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  source: string;
  payload: T;
}

export function buildCanonicalEvent<T>(params: {
  eventId: string;
  eventType: string;
  eventVersion?: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  source?: string;
  payload: T;
}): CanonicalIntegrationEvent<T> {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: params.eventVersion || '1.0',
    tenantId: params.tenantId,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    occurredAt: new Date().toISOString(),
    correlationId: params.correlationId,
    causationId: params.causationId,
    source: params.source || 'taxflow-core',
    payload: params.payload,
  };
}
