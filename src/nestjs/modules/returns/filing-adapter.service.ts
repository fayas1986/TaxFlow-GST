import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { FilingStatus } from '@prisma/client';

export interface FilingRequestPayload {
  tenantId: string;
  returnId: string;
  versionNumber: number;
  gstin: string;
  periodKey: string;
  returnType: string;
  summaryData: any;
  submittedByUserId?: string;
  simulateError?: boolean;
}

export interface FilingResponsePayload {
  success: boolean;
  arn?: string;
  ackNumber?: string;
  ackDate?: string;
  errorCode?: string;
  errorMessage?: string;
  status: FilingStatus;
  rawResponse: any;
}

export interface GspFilingAdapter {
  submitReturn(payload: FilingRequestPayload): Promise<FilingResponsePayload>;
}

@Injectable()
export class MockGspFilingAdapter implements GspFilingAdapter {
  async submitReturn(payload: FilingRequestPayload): Promise<FilingResponsePayload> {
    if (payload.simulateError) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'GSTN_500_INTERNAL',
        errorMessage: 'Simulated government portal timeout / server error',
        rawResponse: { error: 'GSTN Portal Unreachable', timestamp: new Date().toISOString() },
      };
    }

    const randomArn = `AA${payload.gstin.substring(0, 2)}${payload.periodKey}${Math.floor(100000 + Math.random() * 900000)}`;
    const randomAck = `ACK${Math.floor(10000000 + Math.random() * 90000000)}`;
    const ackDate = new Date().toISOString();

    return {
      success: true,
      status: 'SUCCESS',
      arn: randomArn,
      ackNumber: randomAck,
      ackDate,
      rawResponse: {
        status_cd: '1',
        arn: randomArn,
        ack_num: randomAck,
        ack_dt: ackDate,
        message: 'Return Filed Successfully',
      },
    };
  }
}

@Injectable()
export class FilingAdapterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gspAdapter: MockGspFilingAdapter,
  ) {}

  async fileReturnWithIdempotency(
    tenantId: string,
    idempotencyKey: string,
    payload: FilingRequestPayload,
  ): Promise<{ submissionLog: any; response: FilingResponsePayload; isDuplicateRequest: boolean }> {
    // 1. Idempotency Check
    const existingLog = await this.prisma.filingSubmissionLog.findFirst({
      where: { tenantId, idempotencyKey },
    });

    if (existingLog) {
      // Return existing filing submission log without duplicate API execution
      return {
        submissionLog: existingLog,
        response: {
          success: existingLog.status === 'SUCCESS',
          status: existingLog.status,
          arn: existingLog.arn || undefined,
          errorCode: existingLog.errorCode || undefined,
          errorMessage: existingLog.errorMessage || undefined,
          rawResponse: existingLog.responsePayload,
        },
        isDuplicateRequest: true,
      };
    }

    // 2. Create pending log record
    const pendingLog = await this.prisma.filingSubmissionLog.create({
      data: {
        tenantId,
        returnId: payload.returnId,
        versionNumber: payload.versionNumber,
        idempotencyKey,
        gspProvider: 'TAXFLOW_MOCK_GSP_ADAPTER',
        requestPayload: payload.summaryData || {},
        status: 'IN_PROGRESS',
        submittedByUserId: payload.submittedByUserId,
      },
    });

    // 3. Execute submission via GSP Adapter
    let gspResponse: FilingResponsePayload;
    try {
      gspResponse = await this.gspAdapter.submitReturn(payload);
    } catch (err: any) {
      gspResponse = {
        success: false,
        status: 'FAILED',
        errorCode: 'ADAPTER_EXCEPTION',
        errorMessage: err.message || 'GSP Adapter runtime exception',
        rawResponse: { error: err.toString() },
      };
    }

    // 4. Update log record with final response
    const updatedLog = await this.prisma.filingSubmissionLog.update({
      where: { id: pendingLog.id },
      data: {
        status: gspResponse.status,
        arn: gspResponse.arn || null,
        errorCode: gspResponse.errorCode || null,
        errorMessage: gspResponse.errorMessage || null,
        responsePayload: gspResponse.rawResponse || {},
        responseTimestamp: new Date(),
      },
    });

    return {
      submissionLog: updatedLog,
      response: gspResponse,
      isDuplicateRequest: false,
    };
  }
}
