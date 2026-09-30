import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { TenancyController } from './tenancy.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService, PrismaService],
  exports: [TenancyService],
})
export class TenancyModule {}
