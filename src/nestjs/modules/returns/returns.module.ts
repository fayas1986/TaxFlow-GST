import { Module } from '@nestjs/common';
import { Gstr1Service } from './gstr1.service';
import { Gstr3bService } from './gstr3b.service';
import { ReturnValidationService } from './return-validation.service';
import { FilingAdapterService, MockGspFilingAdapter } from './filing-adapter.service';
import { GstReturnsService } from './gst-returns.service';
import { GstReturnsController } from './gst-returns.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [GstReturnsController],
  providers: [
    PrismaService,
    Gstr1Service,
    Gstr3bService,
    ReturnValidationService,
    MockGspFilingAdapter,
    FilingAdapterService,
    GstReturnsService,
  ],
  exports: [
    Gstr1Service,
    Gstr3bService,
    ReturnValidationService,
    FilingAdapterService,
    GstReturnsService,
  ],
})
export class ReturnsModule {}
