import { Injectable } from '@nestjs/common';
import {
  GspIntegrationProvider,
  EInvoiceGenerateRequest,
  EInvoiceGenerateResponse,
  EWayBillGenerateRequest,
  EWayBillGenerateResponse,
} from './gsp-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class SandboxGspAdapter implements GspIntegrationProvider {
  getProviderName(): string {
    return 'TAXFLOW_SANDBOX_GSP';
  }

  getEnvironment(): 'SANDBOX' | 'PRODUCTION' {
    return 'SANDBOX';
  }

  async generateIRN(req: EInvoiceGenerateRequest): Promise<EInvoiceGenerateResponse> {
    if (req.simulateTimeout) {
      throw new Error('ETIMEDOUT: Sandbox GSP portal connection timed out after 30000ms');
    }

    if (req.simulateError) {
      return {
        success: false,
        errorCode: 'NIC_2150',
        errorMessage: 'Invalid Buyer GSTIN or Taxable Value mismatch on NIC portal validation',
        rawResponse: { Status: '0', ErrorDetails: [{ ErrorCode: '2150', ErrorMessage: 'Invalid Buyer GSTIN' }] },
      };
    }

    // Generate deterministic 64-character SHA-256 IRN hash based on seller GSTIN + invoice number
    const hashPayload = `${req.sellerGstin}:${req.invoiceNumber}:${req.invoiceDate}`;
    const irn = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const ackNumber = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const ackDate = new Date().toISOString();
    const signedQrCode = `QR-${irn.substring(0, 16)}-${ackNumber}`;

    return {
      success: true,
      irn,
      ackNumber,
      ackDate,
      signedInvoice: `JWT-SIGNED-INVOICE-${irn.substring(0, 10)}`,
      signedQrCode,
      rawResponse: {
        Status: '1',
        Irn: irn,
        AckNo: parseInt(ackNumber, 10),
        AckDt: ackDate,
        SignedQrCode: signedQrCode,
      },
    };
  }

  async cancelIRN(irn: string, reason: string, remark: string): Promise<{ success: boolean; cancelDate?: string; rawResponse?: any }> {
    const cancelDate = new Date().toISOString();
    return {
      success: true,
      cancelDate,
      rawResponse: {
        Status: '1',
        Irn: irn,
        CancelDate: cancelDate,
        Reason: reason,
        Remark: remark,
      },
    };
  }

  async generateEWayBill(req: EWayBillGenerateRequest): Promise<EWayBillGenerateResponse> {
    if (req.simulateError) {
      return {
        success: false,
        errorCode: 'EWB_301',
        errorMessage: 'Invalid Vehicle Number format for Part B generation',
        rawResponse: { status_cd: '0', error: 'Invalid Vehicle Number' },
      };
    }

    const eWayBillNumber = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const eWayBillDate = new Date().toISOString();
    const validUntil = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days validity

    return {
      success: true,
      eWayBillNumber,
      eWayBillDate,
      validUntil,
      rawResponse: {
        status_cd: '1',
        ewayBillNo: parseInt(eWayBillNumber, 10),
        ewayBillDate: eWayBillDate,
        validUpto: validUntil,
      },
    };
  }

  async updateVehicleDetails(eWayBillNo: string, vehicleNo: string, reason: string): Promise<{ success: boolean; updatedDate?: string; rawResponse?: any }> {
    const updatedDate = new Date().toISOString();
    return {
      success: true,
      updatedDate,
      rawResponse: {
        status_cd: '1',
        ewayBillNo: eWayBillNo,
        vehicleNo,
        updatedDate,
        reason,
      },
    };
  }

  async cancelEWayBill(eWayBillNo: string, reason: string, remark: string): Promise<{ success: boolean; cancelDate?: string; rawResponse?: any }> {
    const cancelDate = new Date().toISOString();
    return {
      success: true,
      cancelDate,
      rawResponse: {
        status_cd: '1',
        ewayBillNo: eWayBillNo,
        cancelDate,
        reason,
        remark,
      },
    };
  }
}
