import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { GspEnvironment } from '@prisma/client';

export interface LogGovApiCallDto {
  tenantId: string;
  gstinId: string;
  documentReference?: string;
  provider: string;
  environment: GspEnvironment;
  action: string;
  correlationId: string;
  requestPayload?: any;
  responsePayload?: any;
  httpStatus?: number;
  isSuccess: boolean;
  governmentReference?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount?: number;
}

@Injectable()
export class GovAuditLoggerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async logApiCall(dto: LogGovApiCallDto) {
    const redactedRequest = this.cryptoService.redactSensitiveFields(dto.requestPayload);
    const redactedResponse = this.cryptoService.redactSensitiveFields(dto.responsePayload);

    return this.prisma.govApiAuditLog.create({
      data: {
        tenantId: dto.tenantId,
        gstinId: dto.gstinId,
        documentReference: dto.documentReference,
        provider: dto.provider,
        environment: dto.environment,
        action: dto.action,
        correlationId: dto.correlationId,
        httpStatus: dto.httpStatus || (dto.isSuccess ? 200 : 400),
        isSuccess: dto.isSuccess,
        governmentReference: dto.governmentReference || null,
        errorCode: dto.errorCode || null,
        errorMessage: dto.errorMessage || null,
        retryCount: dto.retryCount || 0,
        redactedRequest,
        redactedResponse,
      },
    });
  }
}
