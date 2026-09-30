import * as crypto from 'crypto';

export interface StorageObject {
  objectKey: string;
  data: Buffer;
  mimeType: string;
  sha256Hash: string;
}

export interface StorageAdapter {
  uploadObject(objectKey: string, data: Buffer, mimeType: string): Promise<StorageObject>;
  downloadObject(objectKey: string): Promise<Buffer>;
  generateSignedUrl(objectKey: string, tenantId: string, expiresInSeconds?: number): Promise<string>;
  verifySignedUrl(signedUrl: string, expectedTenantId: string): { isValid: boolean; objectKey?: string };
}

export class LocalS3CompatibleStorageAdapter implements StorageAdapter {
  private storageBucket = new Map<string, StorageObject>();
  private secretKey = 'taxflow-s3-signed-url-secret';

  async uploadObject(objectKey: string, data: Buffer, mimeType: string): Promise<StorageObject> {
    const sha256Hash = crypto.createHash('sha256').update(data).digest('hex');
    const storedObject: StorageObject = {
      objectKey,
      data,
      mimeType,
      sha256Hash,
    };
    this.storageBucket.set(objectKey, storedObject);
    return storedObject;
  }

  async downloadObject(objectKey: string): Promise<Buffer> {
    const stored = this.storageBucket.get(objectKey);
    if (!stored) {
      throw new Error(`Object ${objectKey} not found in object storage.`);
    }
    return stored.data;
  }

  async generateSignedUrl(objectKey: string, tenantId: string, expiresInSeconds: number = 300): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const payload = `${objectKey}|${tenantId}|${expiresAt}`;
    const hmac = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
    const encodedKey = encodeURIComponent(objectKey);
    return `https://storage.taxflow.internal/download?key=${encodedKey}&tenant=${tenantId}&expires=${expiresAt}&sig=${hmac}`;
  }

  verifySignedUrl(signedUrl: string, expectedTenantId: string): { isValid: boolean; objectKey?: string } {
    try {
      const url = new URL(signedUrl);
      const key = url.searchParams.get('key');
      const tenant = url.searchParams.get('tenant');
      const expires = url.searchParams.get('expires');
      const sig = url.searchParams.get('sig');

      if (!key || !tenant || !expires || !sig) {
        return { isValid: false };
      }

      if (tenant !== expectedTenantId) {
        return { isValid: false };
      }

      if (Date.now() > Number(expires)) {
        return { isValid: false }; // Expired
      }

      const payload = `${key}|${tenant}|${expires}`;
      const expectedSig = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');

      if (sig !== expectedSig) {
        return { isValid: false }; // Tampered signature
      }

      return { isValid: true, objectKey: key };
    } catch {
      return { isValid: false };
    }
  }
}
