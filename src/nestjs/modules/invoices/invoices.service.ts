import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TaxEngineService } from '../tax-engine/tax-engine.service';
import { TaxPeriodsService } from '../tax-periods/tax-periods.service';
import { TaxLedgerService } from '../tax-ledger/tax-ledger.service';
import { InvoiceCategory, InvoiceType, InvoiceStatus, LedgerEntryType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface CreateInvoiceItemDto {
  itemNumber: number;
  hsnSacCode: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discountAmount?: number | string;
}

export interface CreateInvoiceDto {
  companyId: string;
  gstinId: string;
  branchId?: string;
  partyId: string;
  taxPeriodId: string;
  category?: InvoiceCategory;
  invoiceType?: InvoiceType;
  invoiceNumber: string;
  invoiceDate: string;
  placeOfSupplyStateCode: string;
  isReverseCharge?: boolean;
  originalInvoiceId?: string;
  lineItems: CreateInvoiceItemDto[];
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxEngine: TaxEngineService,
    private readonly taxPeriodsService: TaxPeriodsService,
    private readonly taxLedgerService: TaxLedgerService,
  ) {}

  async findAll(tenantId: string, category?: InvoiceCategory, gstinId?: string, taxPeriodId?: string) {
    const whereClause: any = { tenantId };
    if (category) whereClause.category = category;
    if (gstinId) whereClause.gstinId = gstinId;
    if (taxPeriodId) whereClause.taxPeriodId = taxPeriodId;

    return this.prisma.salesInvoice.findMany({
      where: whereClause,
      include: {
        company: true,
        gstRegistration: true,
        branch: true,
        party: true,
        lineItems: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async findOne(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        company: true,
        gstRegistration: true,
        branch: true,
        party: true,
        lineItems: true,
        taxLedgerEntries: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found in tenant '${tenantId}'.`);
    }

    return invoice;
  }

  /**
   * Atomic Transactional Creation of Sales / Purchase Invoices
   */
  async createInvoice(tenantId: string, userId: string, dto: CreateInvoiceDto) {
    // 1. Validate Tax Period Lock Status (Fails closed if LOCKED or FILED)
    await this.taxPeriodsService.assertPeriodOpen(tenantId, dto.taxPeriodId);

    // 2. Validate Master Data Hierarchy Integrity
    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: { id: dto.gstinId, companyId: dto.companyId, tenantId },
    });
    if (!gstin) {
      throw new BadRequestException(
        `GSTIN '${dto.gstinId}' does not belong to Company '${dto.companyId}' under Tenant '${tenantId}'.`,
      );
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, gstinId: dto.gstinId, tenantId },
      });
      if (!branch) {
        throw new BadRequestException(
          `Branch '${dto.branchId}' does not belong to GSTIN '${dto.gstinId}' under Tenant '${tenantId}'.`,
        );
      }
    }

    const party = await this.prisma.party.findFirst({
      where: { id: dto.partyId, tenantId },
    });
    if (!party) {
      throw new BadRequestException(`Party '${dto.partyId}' not found under Tenant '${tenantId}'.`);
    }

    // 3. Prevent Duplicate Invoice Numbers per GSTIN and Category
    const category = dto.category || InvoiceCategory.SALES;
    const existing = await this.prisma.salesInvoice.findFirst({
      where: {
        tenantId,
        gstinId: dto.gstinId,
        invoiceNumber: dto.invoiceNumber,
        category,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Invoice number '${dto.invoiceNumber}' already exists for GSTIN '${gstin.gstin}' (${category}).`,
      );
    }

    // 4. Calculate Taxes for Line Items using Backend Tax Engine (Decimal.js)
    let totalTaxable = new Decimal(0);
    let totalCgst = new Decimal(0);
    let totalSgst = new Decimal(0);
    let totalIgst = new Decimal(0);
    let totalCess = new Decimal(0);

    const computedItems: any[] = [];

    for (const item of dto.lineItems) {
      const qty = new Decimal(item.quantity.toString());
      const price = new Decimal(item.unitPrice.toString());
      const disc = new Decimal((item.discountAmount || 0).toString());
      const lineTaxable = qty.times(price).minus(disc).toDecimalPlaces(4);

      const taxRes = await this.taxEngine.calculateTax({
        supplierStateCode: gstin.stateCode,
        placeOfSupplyStateCode: dto.placeOfSupplyStateCode,
        hsnSacCode: item.hsnSacCode,
        taxableValue: lineTaxable.toFixed(4),
      });

      const lineCgst = new Decimal(taxRes.cgstAmount);
      const lineSgst = new Decimal(taxRes.sgstAmount);
      const lineIgst = new Decimal(taxRes.igstAmount);
      const lineCess = new Decimal(0);
      const lineTotal = lineTaxable.plus(lineCgst).plus(lineSgst).plus(lineIgst).plus(lineCess);

      totalTaxable = totalTaxable.plus(lineTaxable);
      totalCgst = totalCgst.plus(lineCgst);
      totalSgst = totalSgst.plus(lineSgst);
      totalIgst = totalIgst.plus(lineIgst);
      totalCess = totalCess.plus(lineCess);

      computedItems.push({
        itemNumber: item.itemNumber,
        hsnSacCode: item.hsnSacCode,
        description: item.description,
        quantity: qty.toFixed(4),
        unitPrice: price.toFixed(4),
        discountAmount: disc.toFixed(4),
        taxableValue: lineTaxable.toFixed(4),
        cgstRate: taxRes.cgstRate,
        cgstAmount: lineCgst.toFixed(4),
        sgstRate: taxRes.sgstRate,
        sgstAmount: lineSgst.toFixed(4),
        igstRate: taxRes.igstRate,
        igstAmount: lineIgst.toFixed(4),
        cessRate: '0.00',
        cessAmount: lineCess.toFixed(4),
        totalAmount: lineTotal.toFixed(4),
      });
    }

    const subTotal = totalTaxable.plus(totalCgst).plus(totalSgst).plus(totalIgst).plus(totalCess);
    // Statutori Round-off to Nearest Integer
    const roundedTotal = subTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const roundOff = roundedTotal.minus(subTotal);

    // 5. Execute Atomic Database Transaction (All or Nothing)
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          gstinId: dto.gstinId,
          branchId: dto.branchId || null,
          partyId: dto.partyId,
          taxPeriodId: dto.taxPeriodId,
          category,
          invoiceType: dto.invoiceType || InvoiceType.B2B,
          status: InvoiceStatus.POSTED, // Auto-post upon creation
          invoiceNumber: dto.invoiceNumber,
          invoiceDate: new Date(dto.invoiceDate),
          placeOfSupplyStateCode: dto.placeOfSupplyStateCode,
          isReverseCharge: dto.isReverseCharge || false,
          originalInvoiceId: dto.originalInvoiceId || null,
          totalTaxableAmount: totalTaxable.toFixed(4),
          totalCgstAmount: totalCgst.toFixed(4),
          totalSgstAmount: totalSgst.toFixed(4),
          totalIgstAmount: totalIgst.toFixed(4),
          totalCessAmount: totalCess.toFixed(4),
          roundOffAmount: roundOff.toFixed(4),
          totalInvoiceAmount: roundedTotal.toFixed(4),
          lineItems: {
            create: computedItems,
          },
        },
        include: { lineItems: true },
      });

      // 6. Automatically Post to Append-Only Financial Tax Ledger
      const entryType =
        category === InvoiceCategory.SALES
          ? LedgerEntryType.OUTPUT_LIABILITY
          : LedgerEntryType.INPUT_TAX_CREDIT;

      await tx.taxLedgerEntry.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          gstinId: dto.gstinId,
          branchId: dto.branchId || null,
          invoiceId: invoice.id,
          taxPeriodId: dto.taxPeriodId,
          entryType,
          taxableValue: totalTaxable.toFixed(4),
          cgstAmount: totalCgst.toFixed(4),
          sgstAmount: totalSgst.toFixed(4),
          igstAmount: totalIgst.toFixed(4),
          cessAmount: totalCess.toFixed(4),
          totalTaxAmount: totalCgst.plus(totalSgst).plus(totalIgst).plus(totalCess).toFixed(4),
          referenceNumber: dto.invoiceNumber,
          description: `${category} Invoice Posted: ${dto.invoiceNumber}`,
        },
      });

      // 7. Write Audit Event
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'INVOICE_MUTATION',
          action: 'INVOICE_CREATED_AND_POSTED',
          entityName: 'SalesInvoice',
          entityId: invoice.id,
          diff: { invoiceNumber: dto.invoiceNumber, totalInvoiceAmount: roundedTotal.toFixed(4) } as any,
        },
      });

      return invoice;
    });
  }

  /**
   * Cancel Posted Invoice with Controlled Reversal Entry
   */
  async cancelInvoice(tenantId: string, userId: string, invoiceId: string) {
    const invoice = await this.findOne(tenantId, invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Invoice '${invoice.invoiceNumber}' is already CANCELLED.`);
    }

    // Verify Period Lock Status
    await this.taxPeriodsService.assertPeriodOpen(tenantId, invoice.taxPeriodId);

    return this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.salesInvoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // Append Reversal Entry in Tax Ledger
      const reversalType =
        invoice.category === InvoiceCategory.SALES
          ? LedgerEntryType.LIABILITY_REVERSAL
          : LedgerEntryType.ITC_REVERSAL;

      await tx.taxLedgerEntry.create({
        data: {
          tenantId,
          companyId: invoice.companyId,
          gstinId: invoice.gstinId,
          branchId: invoice.branchId,
          invoiceId: invoice.id,
          taxPeriodId: invoice.taxPeriodId,
          entryType: reversalType,
          taxableValue: invoice.totalTaxableAmount.toString(),
          cgstAmount: invoice.totalCgstAmount.toString(),
          sgstAmount: invoice.totalSgstAmount.toString(),
          igstAmount: invoice.totalIgstAmount.toString(),
          cessAmount: invoice.totalCessAmount.toString(),
          totalTaxAmount: new Decimal(invoice.totalCgstAmount.toString())
            .plus(new Decimal(invoice.totalSgstAmount.toString()))
            .plus(new Decimal(invoice.totalIgstAmount.toString()))
            .plus(new Decimal(invoice.totalCessAmount.toString()))
            .toFixed(4),
          referenceNumber: `REV-${invoice.invoiceNumber}`,
          description: `Cancellation Reversal for Invoice ${invoice.invoiceNumber}`,
          isReversed: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          category: 'INVOICE_MUTATION',
          action: 'INVOICE_CANCELLED',
          entityName: 'SalesInvoice',
          entityId: invoiceId,
          diff: { invoiceNumber: invoice.invoiceNumber } as any,
        },
      });

      return updatedInvoice;
    });
  }
}
