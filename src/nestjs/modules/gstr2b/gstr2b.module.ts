import { Module } from '@nestjs/common';
import { Gstr2bService } from './gstr2b.service';
import { Gstr2bController } from './gstr2b.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [Gstr2bController],
  providers: [Gstr2bService, PrismaService],
  exports: [Gstr2bService],
})
export class Gstr2bModule {}
