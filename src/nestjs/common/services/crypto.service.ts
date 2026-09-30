import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY || 'taxflow-stage-7-super-secret-encryption-key-32b';
    this.key = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32));
  }

  /**
   * Encrypt plain text using AES-256-GCM
   * Returns formatted string: "iv_hex:authTag_hex:ciphertext_hex"
   */
  encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt payload encrypted with encrypt()
   */
  decrypt(encryptedPayload: string): string {
    if (!encryptedPayload || !encryptedPayload.includes(':')) return encryptedPayload;
    try {
      const [ivHex, authTagHex, ciphertext] = encryptedPayload.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      throw new Error('Failed to decrypt payload: invalid ciphertext or tampered auth tag');
    }
  }

  /**
   * Redact sensitive fields from Json objects for security audit logs
   */
  redactSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = ['password', 'secret', 'clientsecret', 'client_secret', 'authtoken', 'user_password', 'token'];
    const clone = JSON.parse(JSON.stringify(obj));

    const sanitize = (target: any) => {
      if (typeof target !== 'object' || target === null) return;
      for (const key of Object.keys(target)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
          target[key] = '***REDACTED***';
        } else if (typeof target[key] === 'object') {
          sanitize(target[key]);
        }
      }
    };

    sanitize(clone);
    return clone;
  }
}
