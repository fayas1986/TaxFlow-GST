import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import Decimal from 'decimal.js';

export interface Gstr3bSection31 {
  outwardTaxableSupplies: {
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
  };
  zeroRatedSupplies: {
    taxableValue: number;
    igstAmount: number;
  };
  inwardReverseChargeSupplies: {
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
  };
  totalLiability: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
  };
}

export interface Gstr3bSection4Itc {
  itcAvailable: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
  };
  itcReversed: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
  };
  netItcAvailable: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
  };
  itcIneligibleBlocked: {
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalAmount: number;
  };
}

export interface Gstr3bAggregationResult {
  periodKey: string;
  gstin: string;
  section3_1: Gstr3bSection31;
  section4_itc: Gstr3bSection4Itc;
  explanation: {
    outwardLedgerEntriesCount: number;
    itcRecordsCount: number;
    formulaTrace: string[];
  };
}

@Injectable()
export class Gstr3bService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateGstr3b(
    tenantId: string,
    gstinId: string,
    taxPeriodId: string,
  ): Promise<Gstr3bAggregationResult> {
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

    // Fetch TaxLedgerEntries for outward liability
    const ledgerEntries = await this.prisma.taxLedgerEntry.findMany({
      where: {
        tenantId,
        gstinId,
        taxPeriodId,
        isReversed: false,
      },
    });

    // Fetch ItcRecords for eligible & reversed ITC
    const itcRecords = await this.prisma.itcRecord.findMany({
      where: {
        tenantId,
        gstinId,
        taxPeriodId,
      },
    });

    let outwardTaxable = new Decimal(0);
    let outwardCgst = new Decimal(0);
    let outwardSgst = new Decimal(0);
    let outwardIgst = new Decimal(0);
    let outwardCess = new Decimal(0);

    let zeroTaxable = new Decimal(0);
    let zeroIgst = new Decimal(0);

    let rcmTaxable = new Decimal(0);
    let rcmCgst = new Decimal(0);
    let rcmSgst = new Decimal(0);
    let rcmIgst = new Decimal(0);
    let rcmCess = new Decimal(0);

    for (const entry of ledgerEntries) {
      if (entry.entryType === 'OUTPUT_LIABILITY') {
        outwardTaxable = outwardTaxable.plus(entry.taxableValue.toString());
        outwardCgst = outwardCgst.plus(entry.cgstAmount.toString());
        outwardSgst = outwardSgst.plus(entry.sgstAmount.toString());
        outwardIgst = outwardIgst.plus(entry.igstAmount.toString());
        outwardCess = outwardCess.plus(entry.cessAmount.toString());
      } else if (entry.entryType === 'ADJUSTMENT') {
        rcmTaxable = rcmTaxable.plus(entry.taxableValue.toString());
        rcmCgst = rcmCgst.plus(entry.cgstAmount.toString());
        rcmSgst = rcmSgst.plus(entry.sgstAmount.toString());
        rcmIgst = rcmIgst.plus(entry.igstAmount.toString());
        rcmCess = rcmCess.plus(entry.cessAmount.toString());
      }
    }

    let availCgst = new Decimal(0);
    let availSgst = new Decimal(0);
    let availIgst = new Decimal(0);
    let availCess = new Decimal(0);

    let revCgst = new Decimal(0);
    let revSgst = new Decimal(0);
    let revIgst = new Decimal(0);
    let revCess = new Decimal(0);

    let ineligCgst = new Decimal(0);
    let ineligSgst = new Decimal(0);
    let ineligIgst = new Decimal(0);
    let ineligCess = new Decimal(0);

    for (const itc of itcRecords) {
      if (itc.status === 'ELIGIBLE' || itc.status === 'CLAIMED' || itc.status === 'RECLAIMED') {
        availCgst = availCgst.plus(itc.eligibleCgst.toString());
        availSgst = availSgst.plus(itc.eligibleSgst.toString());
        availIgst = availIgst.plus(itc.eligibleIgst.toString());
        availCess = availCess.plus(itc.eligibleCess.toString());
      } else if (itc.status === 'REVERSED') {
        revCgst = revCgst.plus(itc.eligibleCgst.toString());
        revSgst = revSgst.plus(itc.eligibleSgst.toString());
        revIgst = revIgst.plus(itc.eligibleIgst.toString());
        revCess = revCess.plus(itc.eligibleCess.toString());
      } else if (itc.status === 'INELIGIBLE') {
        ineligCgst = ineligCgst.plus(itc.blockedTaxAmount.toString().split('.')[0] || '0'); // simplified split/full blocked amount
        ineligSgst = ineligSgst.plus(0);
        ineligIgst = ineligIgst.plus(itc.blockedTaxAmount.toString());
        ineligCess = ineligCess.plus(0);
      }
    }

    const netCgst = availCgst.minus(revCgst);
    const netSgst = availSgst.minus(revSgst);
    const netIgst = availIgst.minus(revIgst);
    const netCess = availCess.minus(revCess);

    const totLiabCgst = outwardCgst.plus(rcmCgst);
    const totLiabSgst = outwardSgst.plus(rcmSgst);
    const totLiabIgst = outwardIgst.plus(rcmIgst);
    const totLiabCess = outwardCess.plus(rcmCess);

    return {
      periodKey: taxPeriod.periodKey,
      gstin: gstinRecord.gstin,
      section3_1: {
        outwardTaxableSupplies: {
          taxableValue: outwardTaxable.toNumber(),
          cgstAmount: outwardCgst.toNumber(),
          sgstAmount: outwardSgst.toNumber(),
          igstAmount: outwardIgst.toNumber(),
          cessAmount: outwardCess.toNumber(),
        },
        zeroRatedSupplies: {
          taxableValue: zeroTaxable.toNumber(),
          igstAmount: zeroIgst.toNumber(),
        },
        inwardReverseChargeSupplies: {
          taxableValue: rcmTaxable.toNumber(),
          cgstAmount: rcmCgst.toNumber(),
          sgstAmount: rcmSgst.toNumber(),
          igstAmount: rcmIgst.toNumber(),
          cessAmount: rcmCess.toNumber(),
        },
        totalLiability: {
          cgstAmount: totLiabCgst.toNumber(),
          sgstAmount: totLiabSgst.toNumber(),
          igstAmount: totLiabIgst.toNumber(),
          cessAmount: totLiabCess.toNumber(),
          totalAmount: totLiabCgst.plus(totLiabSgst).plus(totLiabIgst).plus(totLiabCess).toNumber(),
        },
      },
      section4_itc: {
        itcAvailable: {
          cgstAmount: availCgst.toNumber(),
          sgstAmount: availSgst.toNumber(),
          igstAmount: availIgst.toNumber(),
          cessAmount: availCess.toNumber(),
          totalAmount: availCgst.plus(availSgst).plus(availIgst).plus(availCess).toNumber(),
        },
        itcReversed: {
          cgstAmount: revCgst.toNumber(),
          sgstAmount: revSgst.toNumber(),
          igstAmount: revIgst.toNumber(),
          cessAmount: revCess.toNumber(),
          totalAmount: revCgst.plus(revSgst).plus(revIgst).plus(revCess).toNumber(),
        },
        netItcAvailable: {
          cgstAmount: netCgst.toNumber(),
          sgstAmount: netSgst.toNumber(),
          igstAmount: netIgst.toNumber(),
          cessAmount: netCess.toNumber(),
          totalAmount: netCgst.plus(netSgst).plus(netIgst).plus(netCess).toNumber(),
        },
        itcIneligibleBlocked: {
          cgstAmount: ineligCgst.toNumber(),
          sgstAmount: ineligSgst.toNumber(),
          igstAmount: ineligIgst.toNumber(),
          cessAmount: ineligCess.toNumber(),
          totalAmount: ineligCgst.plus(ineligSgst).plus(ineligIgst).plus(ineligCess).toNumber(),
        },
      },
      explanation: {
        outwardLedgerEntriesCount: ledgerEntries.length,
        itcRecordsCount: itcRecords.length,
        formulaTrace: [
          `GSTR-3B Section 3.1 Liability derived from ${ledgerEntries.length} Tax Ledger entries.`,
          `GSTR-3B Section 4 ITC derived from ${itcRecords.length} ITC lifecycle records.`,
          `Net ITC = Available ITC (${availIgst.plus(availCgst).plus(availSgst).toNumber()}) - Reversed ITC (${revIgst.plus(revCgst).plus(revSgst).toNumber()}).`,
        ],
      },
    };
  }
}
