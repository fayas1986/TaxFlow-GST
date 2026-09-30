import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import Decimal from 'decimal.js';

export interface Gstr1B2bRecord {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerGstin: string;
  customerLegalName: string;
  placeOfSupply: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalAmount: number;
}

export interface Gstr1CdnrRecord {
  invoiceId: string;
  noteNumber: string;
  noteDate: string;
  noteType: string;
  customerGstin: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Gstr1ExportRecord {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  exportType: string;
  taxableValue: number;
  igstAmount: number;
  totalAmount: number;
}

export interface Gstr1AggregationResult {
  periodKey: string;
  gstin: string;
  b2b: Gstr1B2bRecord[];
  b2c: {
    totalTaxableValue: number;
    totalCgstAmount: number;
    totalSgstAmount: number;
    totalIgstAmount: number;
    totalAmount: number;
    count: number;
  };
  cdnr: Gstr1CdnrRecord[];
  exports: Gstr1ExportRecord[];
  totals: {
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalInvoiceValue: number;
    invoiceCount: number;
  };
  sourceInvoiceIds: string[];
}

@Injectable()
export class Gstr1Service {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateGstr1(
    tenantId: string,
    gstinId: string,
    taxPeriodId: string,
  ): Promise<Gstr1AggregationResult> {
    const gstinRecord = await this.prisma.gSTRegistration.findFirst({
      where: { id: gstinId, tenantId },
    });
    if (!gstinRecord) {
      throw new NotFoundException(`GSTIN registration ${gstinId} not found`);
    }

    const taxPeriod = await this.prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, tenantId, gstinId },
    });
    if (!taxPeriod) {
      throw new NotFoundException(`Tax period ${taxPeriodId} not found`);
    }

    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        tenantId,
        gstinId,
        taxPeriodId,
        category: 'SALES',
        status: { in: ['POSTED', 'VALIDATED'] },
      },
      include: {
        party: true,
      },
    });

    const b2bList: Gstr1B2bRecord[] = [];
    const cdnrList: Gstr1CdnrRecord[] = [];
    const exportsList: Gstr1ExportRecord[] = [];

    let b2cTaxable = new Decimal(0);
    let b2cCgst = new Decimal(0);
    let b2cSgst = new Decimal(0);
    let b2cIgst = new Decimal(0);
    let b2cTotal = new Decimal(0);
    let b2cCount = 0;

    let totTaxable = new Decimal(0);
    let totCgst = new Decimal(0);
    let totSgst = new Decimal(0);
    let totIgst = new Decimal(0);
    let totCess = new Decimal(0);
    let totInvoiceVal = new Decimal(0);

    const sourceInvoiceIds: string[] = [];

    for (const inv of invoices) {
      sourceInvoiceIds.push(inv.id);

      const taxable = new Decimal(inv.totalTaxableAmount.toString());
      const cgst = new Decimal(inv.totalCgstAmount.toString());
      const sgst = new Decimal(inv.totalSgstAmount.toString());
      const igst = new Decimal(inv.totalIgstAmount.toString());
      const cess = new Decimal(inv.totalCessAmount.toString());
      const totalInv = new Decimal(inv.totalInvoiceAmount.toString());

      totTaxable = totTaxable.plus(taxable);
      totCgst = totCgst.plus(cgst);
      totSgst = totSgst.plus(sgst);
      totIgst = totIgst.plus(igst);
      totCess = totCess.plus(cess);
      totInvoiceVal = totInvoiceVal.plus(totalInv);

      const partyGstin = inv.party?.pan ? `${inv.party.pan}1Z5` : 'UNREGISTERED';

      if (inv.invoiceType === 'B2B') {
        b2bList.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
          customerGstin: partyGstin,
          customerLegalName: inv.party?.legalName || 'Customer',
          placeOfSupply: inv.placeOfSupplyStateCode,
          taxableValue: taxable.toNumber(),
          cgstAmount: cgst.toNumber(),
          sgstAmount: sgst.toNumber(),
          igstAmount: igst.toNumber(),
          cessAmount: cess.toNumber(),
          totalAmount: totalInv.toNumber(),
        });
      } else if (inv.invoiceType === 'B2C') {
        b2cTaxable = b2cTaxable.plus(taxable);
        b2cCgst = b2cCgst.plus(cgst);
        b2cSgst = b2cSgst.plus(sgst);
        b2cIgst = b2cIgst.plus(igst);
        b2cTotal = b2cTotal.plus(totalInv);
        b2cCount++;
      } else if (inv.invoiceType === 'CREDIT_NOTE' || inv.invoiceType === 'DEBIT_NOTE') {
        cdnrList.push({
          invoiceId: inv.id,
          noteNumber: inv.invoiceNumber,
          noteDate: inv.invoiceDate.toISOString().split('T')[0],
          noteType: inv.invoiceType,
          customerGstin: partyGstin,
          taxableValue: taxable.toNumber(),
          cgstAmount: cgst.toNumber(),
          sgstAmount: sgst.toNumber(),
          igstAmount: igst.toNumber(),
          totalAmount: totalInv.toNumber(),
        });
      } else if (
        inv.invoiceType === 'EXPORT_WITH_PAYMENT' ||
        inv.invoiceType === 'EXPORT_WITHOUT_PAYMENT' ||
        inv.invoiceType === 'SEZ_WITH_PAYMENT' ||
        inv.invoiceType === 'SEZ_WITHOUT_PAYMENT'
      ) {
        exportsList.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
          exportType: inv.invoiceType,
          taxableValue: taxable.toNumber(),
          igstAmount: igst.toNumber(),
          totalAmount: totalInv.toNumber(),
        });
      }
    }

    return {
      periodKey: taxPeriod.periodKey,
      gstin: gstinRecord.gstin,
      b2b: b2bList,
      b2c: {
        totalTaxableValue: b2cTaxable.toNumber(),
        totalCgstAmount: b2cCgst.toNumber(),
        totalSgstAmount: b2cSgst.toNumber(),
        totalIgstAmount: b2cIgst.toNumber(),
        totalAmount: b2cTotal.toNumber(),
        count: b2cCount,
      },
      cdnr: cdnrList,
      exports: exportsList,
      totals: {
        taxableValue: totTaxable.toNumber(),
        cgstAmount: totCgst.toNumber(),
        sgstAmount: totSgst.toNumber(),
        igstAmount: totIgst.toNumber(),
        cessAmount: totCess.toNumber(),
        totalInvoiceValue: totInvoiceVal.toNumber(),
        invoiceCount: invoices.length,
      },
      sourceInvoiceIds,
    };
  }
}
