import { Injectable, BadRequestException } from '@nestjs/common';

export interface EventDefinition {
  eventType: string;
  version: string;
  aggregateType: string;
  description: string;
}

@Injectable()
export class EventRegistryService {
  private readonly registeredEvents = new Map<string, EventDefinition>();

  constructor() {
    this.registerDefaultEvents();
  }

  private registerDefaultEvents() {
    this.registerEvent({
      eventType: 'taxflow.invoice.created',
      version: '1.0',
      aggregateType: 'INVOICE',
      description: 'Emitted when a new Sales or Purchase Invoice is created in TaxFlow',
    });
    this.registerEvent({
      eventType: 'taxflow.einvoice.irn_generated',
      version: '1.0',
      aggregateType: 'INVOICE',
      description: 'Emitted when an E-Invoice IRN is registered with NIC/GSP',
    });
    this.registerEvent({
      eventType: 'taxflow.ewaybill.generated',
      version: '1.0',
      aggregateType: 'EWAYBILL',
      description: 'Emitted when an E-Way Bill number is generated',
    });
    this.registerEvent({
      eventType: 'taxflow.gstr2b.reconciled',
      version: '1.0',
      aggregateType: 'RECONCILIATION',
      description: 'Emitted when GSTR-2B purchase reconciliation run finishes',
    });
    this.registerEvent({
      eventType: 'taxflow.gstreturn.filed',
      version: '1.0',
      aggregateType: 'GST_RETURN',
      description: 'Emitted when a GSTR-1 or GSTR-3B return is successfully filed',
    });
  }

  registerEvent(def: EventDefinition): void {
    this.registeredEvents.set(def.eventType, def);
  }

  validateEventType(eventType: string): EventDefinition {
    const def = this.registeredEvents.get(eventType);
    if (!def) {
      throw new BadRequestException(`Unregistered event type: ${eventType}`);
    }
    return def;
  }

  listRegisteredEvents(): EventDefinition[] {
    return Array.from(this.registeredEvents.values());
  }
}
