import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { BranchesService, CreateBranchDto } from './branches.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/branches')
@UseGuards(TenantContextGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('gstinId') gstinId?: string,
  ) {
    return this.branchesService.findAll(req.tenantId, companyId, gstinId, req.user?.allowedBranches);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.branchesService.findOne(req.tenantId, id, req.user?.allowedBranches);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(req.tenantId, req.user?.userId || 'system', dto);
  }
}
