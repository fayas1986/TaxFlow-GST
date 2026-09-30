import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { GovernmentModule } from '../government/government.module';
import { EWayBillService } from './ewaybill.service';
import { EWayBillController } from './ewaybill.controller';

@Module({
  imports: [GovernmentModule],
  controllers: [EWayBillController],
  providers: [PrismaService, EWayBillService],
  exports: [EWayBillService],
})
export class EWayBillModule {}
