import { Module } from '@nestjs/common';
import { PartiesService } from './parties.service';
import { PartiesController } from './parties.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [PartiesController],
  providers: [PartiesService, PrismaService],
  exports: [PartiesService],
})
export class PartiesModule {}
