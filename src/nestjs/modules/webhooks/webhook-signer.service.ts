import { Injectable } from '@nestjs/common';
import { CryptographyService } from '../security/cryptography.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignerService {
  constructor(private readonly cryptoService: CryptographyService) {}

  generateSecretKey(): string {
    return 'whsec_' + crypto.randomBytes(24).toString('hex');
  }

  encryptSecretKey(plainSecret: string, tenantId: string): string {
    return this.cryptoService.encryptGcm(plainSecret, tenantId);
  }

  decryptSecretKey(encryptedSecret: string, tenantId: string): string {
    return this.cryptoService.decryptGcm(encryptedSecret, tenantId);
  }

  computeSignature(plainSecret: string, payloadJson: string, timestampSeconds: number): string {
    const stringToSign = `${timestampSeconds}.${payloadJson}`;
    const hmac = crypto
      .createHmac('sha256', plainSecret)
      .update(stringToSign, 'utf8')
      .digest('hex');
    return `t=${timestampSeconds},v1=${hmac}`;
  }

  verifySignature(
    plainSecret: string,
    payloadJson: string,
    signatureHeader: string,
    maxAgeSeconds: number = 300,
  ): boolean {
    if (!signatureHeader || !signatureHeader.includes('t=') || !signatureHeader.includes('v1=')) {
      return false;
    }

    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const versionPart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !versionPart) return false;

    const timestampSeconds = parseInt(timestampPart.substring(2), 10);
    const expectedHmac = versionPart.substring(3);

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > maxAgeSeconds) {
      return false; // Replay attack detected (timestamp older than 5 minutes)
    }

    const computedHeader = this.computeSignature(plainSecret, payloadJson, timestampSeconds);
    const computedHmac = computedHeader.split('v1=')[1];

    return crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(expectedHmac));
  }
}
