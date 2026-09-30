import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CompaniesService, CreateCompanyDto } from './companies.service';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';

@Controller('api/v1/companies')
@UseGuards(TenantContextGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.companiesService.findAll(req.tenantId, req.user?.allowedCompanies);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.companiesService.findOne(req.tenantId, id, req.user?.allowedCompanies);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(req.tenantId, req.user?.userId || 'system', dto);
  }
}
