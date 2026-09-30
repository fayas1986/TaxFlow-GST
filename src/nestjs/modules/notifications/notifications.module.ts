import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [AuditModule],
  providers: [PrismaService, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
