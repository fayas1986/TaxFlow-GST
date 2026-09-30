export interface EInvoiceGenerateRequest {
  tenantId: string;
  gstinId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalInvoiceValue: number;
  items: Array<{
    hsnCode: string;
    description: string;
    taxableValue: number;
    gstRate: number;
  }>;
  simulateError?: boolean;
  simulateTimeout?: boolean;
}

export interface EInvoiceGenerateResponse {
  success: boolean;
  irn?: string;
  ackNumber?: string;
  ackDate?: string;
  signedInvoice?: string;
  signedQrCode?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface EWayBillGenerateRequest {
  tenantId: string;
  gstinId: string;
  invoiceId: string;
  eInvoiceId?: string;
  transporterId?: string;
  transporterName?: string;
  transportMode?: string;
  distanceKm?: number;
  vehicleNumber?: string;
  vehicleType?: string;
  simulateError?: boolean;
}

export interface EWayBillGenerateResponse {
  success: boolean;
  eWayBillNumber?: string;
  eWayBillDate?: string;
  validUntil?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface GspIntegrationProvider {
  getProviderName(): string;
  getEnvironment(): 'SANDBOX' | 'PRODUCTION';
  generateIRN(req: EInvoiceGenerateRequest): Promise<EInvoiceGenerateResponse>;
  cancelIRN(irn: string, reason: string, remark: string): Promise<{ success: boolean; cancelDate?: string; rawResponse?: any }>;
  generateEWayBill(req: EWayBillGenerateRequest): Promise<EWayBillGenerateResponse>;
  updateVehicleDetails(eWayBillNo: string, vehicleNo: string, reason: string): Promise<{ success: boolean; updatedDate?: string; rawResponse?: any }>;
  cancelEWayBill(eWayBillNo: string, reason: string, remark: string): Promise<{ success: boolean; cancelDate?: string; rawResponse?: any }>;
}
