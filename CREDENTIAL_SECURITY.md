# Credential & Secret Security Architecture

**TaxFlow GST Compliance SaaS — Stage 7 Architecture Specification**

---

## 1. Zero Plain-Text Credential Policy

Government and GSP API credentials (usernames, passwords, client IDs, client secrets, auth tokens) must **never** be stored in plain text anywhere in PostgreSQL databases, source code, git repositories, Docker images, log output, or error messages.

---

## 2. Encryption Mechanism (`CryptoService`)

Credentials stored in the `GovGspCredential` table are encrypted using **AES-256-GCM** (Authenticated Encryption with Associated Data).

### Encryption Specification
- **Algorithm**: `aes-256-gcm`
- **Key Source**: 32-byte secret loaded from `ENCRYPTION_KEY` environment variable.
- **Initialization Vector (IV)**: 16-byte cryptographically secure random IV generated per field (`crypto.randomBytes(16)`).
- **Authentication Tag**: 16-byte auth tag verified during decryption to prevent ciphertext tampering.
- **Payload Format**: `iv_hex:authTag_hex:ciphertext_hex`

```typescript
// Conceptual Implementation
export class CryptoService {
  private readonly key: Buffer;

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY || 'default-32-byte-secret-key-123456789012';
    this.key = Buffer.from(keyHex.padEnd(32, '0').slice(0, 32));
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedPayload: string): string {
    const [ivHex, authTagHex, ciphertext] = encryptedPayload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

---

## 3. Redaction & Logging Controls

1. **Log Redaction**: Outgoing HTTP request logs and error traces automatically mask sensitive keys (`username`, `password`, `clientId`, `clientSecret`, `AuthToken`).
2. **API Output Hygiene**: DTOs returned by `GovGspCredentialController` return `hasUsername: true`, `hasPassword: true` without exposing raw ciphertext or decrypted plain-text strings.
3. **Tenant & GSTIN Scope Isolation**: A tenant cannot decrypt or use GSP credentials created under another tenant or GSTIN.
