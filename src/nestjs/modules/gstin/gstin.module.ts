import { Module } from '@nestjs/common';
import { GstinService } from './gstin.service';
import { GstinController } from './gstin.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [GstinController],
  providers: [GstinService, PrismaService],
  exports: [GstinService],
})
export class GstinModule {}
