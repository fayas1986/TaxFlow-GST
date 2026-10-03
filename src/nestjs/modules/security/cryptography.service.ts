import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptographyService {
  private readonly masterKey: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32-byte master key
    this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  encryptGcm(plaintext: string, aadContext?: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    if (aadContext) {
      cipher.setAAD(Buffer.from(aadContext, 'utf8'));
    }

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store as iv.authTag.encrypted ciphertext in hex
    return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
  }

  decryptGcm(encryptedPayload: string, aadContext?: string): string {
    const parts = encryptedPayload.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid encrypted ciphertext payload format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);

    if (aadContext) {
      decipher.setAAD(Buffer.from(aadContext, 'utf8'));
    }

    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
  }

  encryptSecretKey(plaintext: string, aadContext?: string): string {
    return this.encryptGcm(plaintext, aadContext);
  }

  decryptSecretKey(encryptedPayload: string, aadContext?: string): string {
    return this.decryptGcm(encryptedPayload, aadContext);
  }
}
