import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Decimal } from 'decimal.js';

export interface CalculateTaxDto {
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  hsnSacCode: string;
  taxableValue: number | string;
}

export interface TaxCalculationResult {
  isInterstate: boolean;
  hsnSacCode: string;
  taxableValue: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  totalTaxAmount: string;
  totalInvoiceAmount: string;
}

@Injectable()
export class TaxEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async searchHsn(query: string) {
    return this.prisma.hsnSacMaster.findMany({
      where: {
        OR: [
          { code: { contains: query } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  async calculateTax(dto: CalculateTaxDto): Promise<TaxCalculationResult> {
    const hsn = await this.prisma.hsnSacMaster.findFirst({
      where: { code: dto.hsnSacCode },
    });

    // Fallback standard rate if HSN not found in database seeding yet
    const igstRate = hsn ? new Decimal(hsn.igstRate.toString()) : new Decimal('18.00');
    const cgstRate = hsn ? new Decimal(hsn.cgstRate.toString()) : new Decimal('9.00');
    const sgstRate = hsn ? new Decimal(hsn.sgstRate.toString()) : new Decimal('9.00');

    const taxableValue = new Decimal(dto.taxableValue.toString());
    const isInterstate = dto.supplierStateCode !== dto.placeOfSupplyStateCode;

    let cgstAmt = new Decimal(0);
    let sgstAmt = new Decimal(0);
    let igstAmt = new Decimal(0);

    if (isInterstate) {
      igstAmt = taxableValue.times(igstRate).dividedBy(100).toDecimalPlaces(4);
    } else {
      cgstAmt = taxableValue.times(cgstRate).dividedBy(100).toDecimalPlaces(4);
      sgstAmt = taxableValue.times(sgstRate).dividedBy(100).toDecimalPlaces(4);
    }

    const totalTax = cgstAmt.plus(sgstAmt).plus(igstAmt);
    const totalInvoiceAmount = taxableValue.plus(totalTax);

    return {
      isInterstate,
      hsnSacCode: dto.hsnSacCode,
      taxableValue: taxableValue.toFixed(4),
      cgstRate: isInterstate ? '0.00' : cgstRate.toFixed(2),
      cgstAmount: cgstAmt.toFixed(4),
      sgstRate: isInterstate ? '0.00' : sgstRate.toFixed(2),
      sgstAmount: sgstAmt.toFixed(4),
      igstRate: isInterstate ? igstRate.toFixed(2) : '0.00',
      igstAmount: igstAmt.toFixed(4),
      totalTaxAmount: totalTax.toFixed(4),
      totalInvoiceAmount: totalInvoiceAmount.toFixed(4),
    };
  }
}
