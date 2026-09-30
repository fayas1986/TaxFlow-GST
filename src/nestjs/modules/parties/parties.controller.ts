import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PartiesService, CreatePartyDto, CreatePartyGstinDto } from './parties.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import { PartyType } from '@prisma/client';

@Controller('api/v1/parties')
@UseGuards(TenantContextGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  async findAll(@Req() req: any, @Query('partyType') partyType?: PartyType) {
    return this.partiesService.findAll(req.tenantId, partyType);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.partiesService.findOne(req.tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreatePartyDto) {
    return this.partiesService.create(req.tenantId, req.user?.userId || 'system', dto);
  }

  @Post(':id/gstins')
  async addGstin(
    @Req() req: any,
    @Param('id') partyId: string,
    @Body() dto: CreatePartyGstinDto,
  ) {
    return this.partiesService.addGstin(req.tenantId, req.user?.userId || 'system', partyId, dto);
  }
}
