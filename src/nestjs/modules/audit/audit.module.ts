import { Module } from '@nestjs/common';
import { ImmutableAuditService } from './immutable-audit.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  providers: [PrismaService, ImmutableAuditService],
  exports: [ImmutableAuditService],
})
export class AuditModule {}
