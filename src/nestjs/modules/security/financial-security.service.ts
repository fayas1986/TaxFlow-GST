import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';

@Injectable()
export class FinancialSecurityService {
  /**
   * Enforces Immutability of Posted Financial Documents.
   */
  validateInvoiceImmutability(existingInvoiceStatus: string): void {
    if (existingInvoiceStatus === 'POSTED' || existingInvoiceStatus === 'VALIDATED') {
      throw new ForbiddenException(
        `Financial Immutability Protection: Cannot modify or delete invoice with status [${existingInvoiceStatus}]. Posted invoices must be adjusted via Credit/Debit Notes.`
      );
    }
  }

  /**
   * Enforces Immutability of Tax Ledger Entries.
   */
  validateLedgerImmutability(operation: 'UPDATE' | 'DELETE'): void {
    throw new ForbiddenException(
      `Statutory Ledger Protection: Direct ${operation} operations on posted TaxLedgerEntry records are prohibited. Ledger adjustments require reversing entries.`
    );
  }

  /**
   * Enforces Statutory Tax Period Locks.
   */
  validateTaxPeriodLock(periodStatus: string, periodKey: string): void {
    if (periodStatus === 'LOCKED' || periodStatus === 'FILED') {
      throw new ForbiddenException(
        `Statutory Period Lock Violation: Tax Period [${periodKey}] is [${periodStatus}]. New transactions or modifications are locked.`
      );
    }
  }

  /**
   * Enforces Segregation of Duties (SoD).
   */
  validateSegregationOfDuties(creatorUserId: string, approverUserId: string): void {
    if (creatorUserId === approverUserId) {
      throw new ForbiddenException(
        `Segregation of Duties (SoD) Violation: User [${approverUserId}] cannot approve an approval workflow or transaction created by themselves.`
      );
    }
  }

  /**
   * Validates calculation tamper resistance against frontend values.
   */
  validateTaxCalculationTampering(
    clientCgst: number,
    clientSgst: number,
    clientIgst: number,
    engineCgst: number,
    engineSgst: number,
    engineIgst: number
  ): void {
    const diff =
      Math.abs(clientCgst - engineCgst) +
      Math.abs(clientSgst - engineSgst) +
      Math.abs(clientIgst - engineIgst);

    if (diff > 0.01) {
      throw new BadRequestException(
        `Tax Calculation Tamper Protection: Frontend tax values [CGST:${clientCgst}, SGST:${clientSgst}, IGST:${clientIgst}] do not match authoritative TaxEngine calculation [CGST:${engineCgst}, SGST:${engineSgst}, IGST:${engineIgst}].`
      );
    }
  }
}
