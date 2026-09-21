/**
 * Target Architecture: NestJS API / BFF Orchestrator
 * Connects React Frontend -> NestJS BFF -> Transaction Engine -> Compliance Engine -> Workflow Engine -> Event Bus -> Downstream Pipelines -> Multi-Store Storage
 */

import { CanonicalModelService, DataQualityService, ValidationEngine, CanonicalTransaction } from './transactionEngine';
import { TaxEngine, RuleEngine, RiskEngine } from './complianceEngine';
import { WorkflowEngine } from './workflowEngine';
import { EventBus, ArchitectureEvent } from './eventBus';
import { 
  ReconciliationPipeline, ITCEngine, ReturnEngine, ComplianceLedgerEngine, 
  EInvoicePipeline, EWayBillPipeline, MultiStorePersistence 
} from './downstreamPipelines';

export interface ArchitectureExecutionResult {
  transactionId: string;
  traceId: string;
  timestamp: string;
  canonicalTransaction: CanonicalTransaction;
  dataQuality: { score: number; issues: string[] };
  validation: { isValid: boolean; errors: string[]; warnings: string[] };
  compliance: {
    taxCalculation: any;
    statutoryRules: any[];
    riskEvaluation: any;
  };
  workflow: {
    state: string;
    approvalRequirement: any;
  };
  dispatchedEvents: ArchitectureEvent[];
  downstreamOutputs: {
    reconciliation: any;
    itcClassification: any;
    returnStaging: any;
    complianceLedgerEntry: any;
    eInvoiceIRN?: any;
    eWayBill?: any;
  };
  persistenceMetrics: any;
  totalProcessingTimeMs: number;
}

export class NestJsBffOrchestrator {
  static async processTransaction(rawPayload: any): Promise<ArchitectureExecutionResult> {
    const startTime = Date.now();
    const traceId = `BFF-TRC-${Date.now().toString().slice(-6)}`;
    const tenantId = rawPayload.tenantId || 't1';

    // 1. Transaction Engine: Ingest & Canonical Normalization
    const canonicalTx = CanonicalModelService.normalize(rawPayload);
    const dataQuality = DataQualityService.assessQuality(canonicalTx);
    canonicalTx.dataQualityScore = dataQuality.score;

    const validation = ValidationEngine.validate(canonicalTx);
    canonicalTx.validationStatus = validation.isValid ? 'PASSED' : 'FAILED';
    canonicalTx.validationErrors = validation.errors;

    const dispatchedEvents: ArchitectureEvent[] = [];

    // Publish Transaction Ingested Event
    const evt1 = await EventBus.publish(
      'TRANSACTION_INGESTED',
      'TRANSACTION_ENGINE',
      tenantId,
      { canonicalTx, dataQuality, validation },
      traceId
    );
    dispatchedEvents.push(evt1);

    // 2. Compliance Engine: Rules, Tax, Risk
    const taxCalculation = TaxEngine.calculate(canonicalTx);
    const statutoryRules = RuleEngine.evaluate(canonicalTx);
    const riskEvaluation = RiskEngine.evaluateRisk(canonicalTx, statutoryRules, dataQuality.score);

    const evt2 = await EventBus.publish(
      'TAX_DETERMINED',
      'COMPLIANCE_ENGINE',
      tenantId,
      { taxCalculation, statutoryRules, riskEvaluation },
      traceId
    );
    dispatchedEvents.push(evt2);

    // 3. Workflow Engine: Approval & State determination
    const approvalRequirement = WorkflowEngine.determineRequiredApproval(canonicalTx.totalInvoiceValue);

    // 4. Downstream Processing via Event Bus
    // Branch 1: Reconciliation -> ITC Engine -> Return Engine -> Compliance Ledger
    const reconciliation = ReconciliationPipeline.reconcileInvoice(canonicalTx);
    const isBlocked = statutoryRules.some(r => r.category === 'ITC_ELIGIBILITY' && r.status === 'WARNING');
    const itcClassification = ITCEngine.classifyITC(canonicalTx, isBlocked);
    const returnStaging = ReturnEngine.stageReturn(canonicalTx, taxCalculation);
    const complianceLedgerEntry = ComplianceLedgerEngine.postEntry(canonicalTx, taxCalculation);

    const evt3 = await EventBus.publish(
      'COMPLIANCE_LEDGER_POSTED',
      'RECON_PIPELINE',
      tenantId,
      { complianceLedgerEntry, returnStaging },
      traceId
    );
    dispatchedEvents.push(evt3);

    // Branch 2: E-Invoice -> GSP/IRP
    let eInvoiceIRN = undefined;
    if (canonicalTx.supplyType === 'B2B') {
      eInvoiceIRN = await EInvoicePipeline.generateIRN(canonicalTx);
      const evt4 = await EventBus.publish(
        'EINVOICE_IRN_GENERATED',
        'EINVOICE_PIPELINE',
        tenantId,
        { irn: eInvoiceIRN.irn, ackNo: eInvoiceIRN.ackNo },
        traceId
      );
      dispatchedEvents.push(evt4);
    }

    // Branch 3: E-Way Bill -> GSP/NIC
    let eWayBill = undefined;
    if (canonicalTx.totalInvoiceValue >= 50000) {
      eWayBill = await EWayBillPipeline.generateEwb(canonicalTx);
      const evt5 = await EventBus.publish(
        'EWAYBILL_GENERATED',
        'EWAYBILL_PIPELINE',
        tenantId,
        { ewbNo: eWayBill.ewayBillNo, validUpto: eWayBill.validUpto },
        traceId
      );
      dispatchedEvents.push(evt5);
    }

    // 5. Multi-Store Persistence Commit
    MultiStorePersistence.incrementRecordCount();
    const persistenceMetrics = MultiStorePersistence.getPersistenceHealth();

    const totalProcessingTimeMs = Date.now() - startTime;

    return {
      transactionId: canonicalTx.id,
      traceId,
      timestamp: new Date().toISOString(),
      canonicalTransaction: canonicalTx,
      dataQuality,
      validation,
      compliance: {
        taxCalculation,
        statutoryRules,
        riskEvaluation
      },
      workflow: {
        state: approvalRequirement.requiresApproval ? 'PENDING_APPROVAL' : 'STAGED_FOR_FILING',
        approvalRequirement
      },
      dispatchedEvents,
      downstreamOutputs: {
        reconciliation,
        itcClassification,
        returnStaging,
        complianceLedgerEntry,
        eInvoiceIRN,
        eWayBill
      },
      persistenceMetrics,
      totalProcessingTimeMs
    };
  }
}
