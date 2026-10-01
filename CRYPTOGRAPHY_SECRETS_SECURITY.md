# TaxFlow — Cryptography & Secrets Management Security

## 1. Cryptographic Standards

TaxFlow implements modern cryptographic standards for data at rest, data in transit, and secret management:

- **Symmetric Encryption**: AES-256-GCM (Galois/Counter Mode) with 96-bit unique initialization vectors (IVs) and 128-bit authentication tags (AuthTags).
- **Asymmetric / Token Signing**: HMAC SHA-256 (`HS256`) for JWT access tokens.
- **Webhook Signatures**: HMAC SHA-256 digest signature verification.
- **Audit Hash Chaining**: SHA-256 cryptographic hashing.

---

## 2. AES-256-GCM Credential Protection (`CryptoService`)

ERP credentials, GSP API keys, and payment gateway secrets stored in PostgreSQL are encrypted at rest.

### Ciphertext Storage Schema Format:
`<12-byte IV Hex>:<16-byte AuthTag Hex>:<Encrypted Ciphertext Hex>`

Example: `a1b2c3d4e5f6789012345678:f1e2d3c4b5a69876543210fe:89abcde...`

### Ciphertext Tampering Protection:
If an attacker modifies a single byte of the stored ciphertext or AuthTag, GCM decryption throws an authentication tag error and refuses to process untrusted data.

---

## 3. Secret Redaction & Log Security

- **Zero Plaintext Secrets in Logs**: Sensitive fields (`password`, `clientSecret`, `authToken`, `apiKey`, `creditCard`) are automatically redacted with `[REDACTED]` by logging interceptors.
- **Environment Variable Separation**: Master encryption keys (`ENCRYPTION_SECRET_KEY`) are read exclusively from environment variables and never checked into source control.
