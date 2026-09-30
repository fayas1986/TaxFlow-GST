import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PartyType } from '@prisma/client';

export interface CreatePartyGstinDto {
  gstin: string;
  stateCode: string;
  address?: any;
}

export interface CreatePartyDto {
  partyCode: string;
  legalName: string;
  tradeName?: string;
  partyType: PartyType;
  pan?: string;
  email?: string;
  phone?: string;
  address?: any;
  gstins?: CreatePartyGstinDto[];
}

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, partyType?: PartyType) {
    const whereClause: any = { tenantId };
    if (partyType) whereClause.partyType = partyType;

    return this.prisma.party.findMany({
      where: whereClause,
      include: {
        partyGstins: true,
      },
    });
  }

  async findOne(tenantId: string, partyId: string) {
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, tenantId },
      include: { partyGstins: true },
    });

    if (!party) {
      throw new NotFoundException(`Party '${partyId}' not found under tenant '${tenantId}'.`);
    }

    return party;
  }

  async create(tenantId: string, userId: string, dto: CreatePartyDto) {
    const party = await this.prisma.party.create({
      data: {
        tenantId,
        partyCode: dto.partyCode,
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        partyType: dto.partyType,
        pan: dto.pan,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        partyGstins: dto.gstins
          ? {
              create: dto.gstins.map((g) => ({
                tenantId,
                gstin: g.gstin,
                stateCode: g.stateCode,
                address: g.address,
              })),
            }
          : undefined,
      },
      include: { partyGstins: true },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'MASTER_DATA_MUTATION',
        action: 'PARTY_CREATED',
        entityName: 'Party',
        entityId: party.id,
        diff: dto as any,
      },
    });

    return party;
  }

  async addGstin(tenantId: string, userId: string, partyId: string, dto: CreatePartyGstinDto) {
    // Verify party exists in exact tenant boundary
    const party = await this.findOne(tenantId, partyId);

    const partyGstin = await this.prisma.partyGSTIN.create({
      data: {
        tenantId,
        partyId: party.id,
        gstin: dto.gstin,
        stateCode: dto.stateCode,
        address: dto.address,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'MASTER_DATA_MUTATION',
        action: 'PARTY_GSTIN_ADDED',
        entityName: 'PartyGSTIN',
        entityId: partyGstin.id,
        diff: dto as any,
      },
    });

    return partyGstin;
  }
}
