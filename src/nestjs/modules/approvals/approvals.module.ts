import { Module } from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ApprovalEngineService],
  exports: [ApprovalEngineService],
})
export class ApprovalsModule {}
