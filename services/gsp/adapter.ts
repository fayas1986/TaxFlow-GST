import { Invoice, EWayBill } from '../../types';

export interface GSPAuthToken {
  token: string;
  expiresAt: string;
  provider: string;
}

export interface IRNResponse {
  success: boolean;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  qrCodeUrl?: string;
  error?: string;
  rawResponse?: any;
}

export interface EWayBillResponse {
  success: boolean;
  ewayBillNo?: string;
  ewayBillDate?: string;
  validUpto?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Universal GSP (GST Suvidha Provider) Adapter Interface
 */
export interface GSPProvider {
  name: string;
  authenticate(): Promise<GSPAuthToken>;
  generateIRN(invoice: Invoice): Promise<IRNResponse>;
  cancelIRN(irn: string, reason: string, remarks: string): Promise<boolean>;
  generateEWayBill(invoice: Invoice, transportDetails: any): Promise<EWayBillResponse>;
  cancelEWayBill(ewayBillNo: string, reasonCode: string, remarks: string): Promise<boolean>;
  verifyGSTIN(gstin: string): Promise<{ valid: boolean; tradeName?: string; status?: string }>;
}

/**
 * Canonical E-Invoice DTO Schema (GST IRP v1.04)
 */
export interface CanonicalEInvoiceDTO {
  Version: string;
  TranDtls: {
    TaxSch: 'GST';
    SupTyp: 'B2B' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';
    RegRev?: 'Y' | 'N';
    EcmGstin?: string;
    IgstOnIntra?: 'Y' | 'N';
  };
  DocDtls: {
    Typ: 'INV' | 'CRN' | 'DBN';
    No: string;
    Dt: string; // DD/MM/YYYY
  };
  SellerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Stcd: string;
  };
  BuyerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Pos: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Stcd: string;
  };
  ItemList: Array<{
    SlNo: string;
    PrdDesc: string;
    IsServc: 'Y' | 'N';
    HsnCd: string;
    Qty: number;
    Unit: string;
    UnitPrice: number;
    TotAmt: number;
    Discount?: number;
    AssAmt: number;
    GstRt: number;
    IgstAmt?: number;
    CgstAmt?: number;
    SgstAmt?: number;
    CesRt?: number;
    CesAmt?: number;
    TotItemVal: number;
  }>;
  ValDtls: {
    AssVal: number;
    CgstVal?: number;
    SgstVal?: number;
    IgstVal?: number;
    CesVal?: number;
    RndOffAmt?: number;
    TotInvVal: number;
  };
}

/**
 * Sandboxed Mock GSP Provider for isolated DEV / TEST environments only
 */
export class MockGSPProvider implements GSPProvider {
  public name = 'TaxFlow Development Sandbox GSP Adapter';

  public async authenticate(): Promise<GSPAuthToken> {
    return {
      token: `sandbox_token_${Date.now()}`,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      provider: this.name,
    };
  }

  public async generateIRN(invoice: Invoice): Promise<IRNResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PRODUCTION BLOCKER: MockGSPProvider cannot be invoked in production environment.');
    }

    if (!invoice.gstin) {
      return { success: false, error: 'Sandbox Error: Counter-party GSTIN is missing' };
    }
    if (!invoice.amount || invoice.amount <= 0) {
      return { success: false, error: 'Sandbox Error: Taxable value must be greater than zero' };
    }

    const testIrn = `sandbox_irn_${invoice.id}_${Date.now()}`;
    const testAck = `ack_${Date.now()}`;

    return {
      success: true,
      irn: testIrn,
      ackNo: testAck,
      ackDate: new Date().toISOString(),
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=DEV_SANDBOX_IRN:${testIrn}`,
    };
  }

  public async cancelIRN(irn: string, reason: string, remarks: string): Promise<boolean> {
    if (!irn) return false;
    return true;
  }

  public async generateEWayBill(invoice: Invoice, transportDetails: any): Promise<EWayBillResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PRODUCTION BLOCKER: MockGSPProvider cannot be invoked in production environment.');
    }

    if (!transportDetails.vehicleNo && !transportDetails.transporterId) {
      return { success: false, error: 'Sandbox Error: Vehicle Number or Transporter ID required' };
    }

    const validUpto = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      ewayBillNo: `ewb_dev_${Date.now()}`,
      ewayBillDate: new Date().toISOString(),
      validUpto,
    };
  }

  public async cancelEWayBill(ewayBillNo: string, reasonCode: string, remarks: string): Promise<boolean> {
    return true;
  }

  public async verifyGSTIN(gstin: string): Promise<{ valid: boolean; tradeName?: string; status?: string }> {
    const validGstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!validGstinPattern.test(gstin)) {
      return { valid: false };
    }
    return {
      valid: true,
      tradeName: 'Sandbox Verified Partner',
      status: 'ACTIVE',
    };
  }
}

/**
 * Enterprise Production GSP Provider Adapter
 * Connects directly to authenticated GSP / IRP HTTP Endpoints.
 * Enforces production configuration readiness.
 */
export class ProductionGSPProvider implements GSPProvider {
  public name = 'Enterprise Production GSP Adapter';
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private cachedToken: GSPAuthToken | null = null;

  constructor(config?: { baseUrl?: string; clientId?: string; clientSecret?: string }) {
    this.baseUrl = config?.baseUrl || process.env.GSP_BASE_URL || '';
    this.clientId = config?.clientId || process.env.GSP_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || process.env.GSP_CLIENT_SECRET || '';

    if (process.env.NODE_ENV === 'production' && (!this.clientId || !this.clientSecret || !this.baseUrl)) {
      console.warn('[ProductionGSPProvider] Warning: Production GSP credentials (GSP_CLIENT_ID / GSP_CLIENT_SECRET / GSP_BASE_URL) are not set.');
    }
  }

  public async authenticate(): Promise<GSPAuthToken> {
    if (this.cachedToken && new Date(this.cachedToken.expiresAt) > new Date()) {
      return this.cachedToken;
    }

    if (!this.baseUrl || !this.clientId || !this.clientSecret) {
      throw new Error('500 Internal Server Error [GSP Provider]: GSP credentials missing in production environment.');
    }

    const response = await fetch(`${this.baseUrl}/v2/user/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': this.clientId,
        'client-secret': this.clientSecret,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GSP Authentication Failed (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    this.cachedToken = {
      token: data.auth_token || data.token,
      expiresAt: new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString(),
      provider: this.name,
    };

    return this.cachedToken;
  }

  public async generateIRN(invoice: Invoice): Promise<IRNResponse> {
    const auth = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/einvoice/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(invoice),
    });

    const data: any = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || data.error || `IRP Error (${response.status})`,
        rawResponse: data,
      };
    }

    return {
      success: true,
      irn: data.Irn,
      ackNo: data.AckNo?.toString(),
      ackDate: data.AckDt,
      qrCodeUrl: data.SignedQRCode,
      rawResponse: data,
    };
  }

  public async cancelIRN(irn: string, reason: string, remarks: string): Promise<boolean> {
    const auth = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/einvoice/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ Irn: irn, CnlRsn: reason, CnlRem: remarks }),
    });

    const data: any = await response.json();
    return response.ok && data.success;
  }

  public async generateEWayBill(invoice: Invoice, transportDetails: any): Promise<EWayBillResponse> {
    const auth = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/ewaybill/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ invoice, transportDetails }),
    });

    const data: any = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || data.error || `EWB Error (${response.status})`,
        rawResponse: data,
      };
    }

    return {
      success: true,
      ewayBillNo: data.EwbNo?.toString(),
      ewayBillDate: data.EwbDt,
      validUpto: data.EwbValidTill,
      rawResponse: data,
    };
  }

  public async cancelEWayBill(ewayBillNo: string, reasonCode: string, remarks: string): Promise<boolean> {
    const auth = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/ewaybill/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ ewbNo: ewayBillNo, cancelRsnCode: reasonCode, remark: remarks }),
    });

    return response.ok;
  }

  public async verifyGSTIN(gstin: string): Promise<{ valid: boolean; tradeName?: string; status?: string }> {
    const auth = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/gstin/${gstin}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data: any = await response.json();
    return {
      valid: data.valid || data.status === 'ACT',
      tradeName: data.tradeName || data.lgnm,
      status: data.status || 'ACTIVE',
    };
  }
}

/**
 * Compliance Gateway Provider Router
 * Resolves appropriate GSP provider instance based on environment & tenant configuration.
 */
export class ComplianceGatewayRouter {
  public static getProvider(): GSPProvider {
    if (process.env.NODE_ENV === 'production' || process.env.GSP_BASE_URL) {
      return new ProductionGSPProvider();
    }
    return new MockGSPProvider();
  }
}
