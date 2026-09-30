import { Module } from '@nestjs/common';
import { DocumentManagementService } from './document-management.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [AuditModule],
  providers: [PrismaService, DocumentManagementService],
  exports: [DocumentManagementService],
})
export class DocumentsModule {}
