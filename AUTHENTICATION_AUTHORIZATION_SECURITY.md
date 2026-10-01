# TaxFlow — Authentication & Authorization Security

## 1. Authentication Mechanisms

TaxFlow uses stateless JWT access tokens signed with HMAC SHA-256 (`HS256`) combined with persistent session tracking.

### JWT Payload Schema:
```json
{
  "sub": "usr-11111111-1111-1111-1111-111111111111",
  "email": "accountant@enterprise.com",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "role": "ACCOUNTANT",
  "iat": 1759312000,
  "exp": 1759315600
}
```

### Security Controls:
- **Algorithm Confusion Defense**: `JwtService.verify` explicitly enforces the allowed signing algorithm (`HS256`). Unsigned tokens (`alg: "none"`) or RS256/HS256 algorithm confusion attempts are rejected.
- **Session Invalidation**: When a user logs out or changes credentials, their `sessionId` is added to a Redis/database token revocation list.
- **Credential Hashing**: User passwords are stored using bcrypt with cost factor 12. Plaintext passwords are never logged or stored.

---

## 2. Authorization & RBAC Matrix

Access control combines Role-Based Access Control (RBAC) with fine-grained permissions:

| Role | Allowed Scope | Key Permissions |
|---|---|---|
| `SUPER_ADMIN` | Platform Administration | All permissions (`*`) |
| `TENANT_ADMIN` | Full Tenant Scope | `TENANT_MANAGE`, `USER_MANAGE`, `FINANCE_ALL` |
| `TAX_MANAGER` | Tenant Company Scope | `INVOICE_POST`, `RETURN_FILE`, `RECONCILE_EXECUTE` |
| `ACCOUNTANT` | Branch / Company Scope | `INVOICE_CREATE`, `REPORT_VIEW` |
| `AUDITOR` | Tenant Read-Only Scope | `AUDIT_READ`, `REPORT_VIEW` |

### Privilege Escalation Defenses:
1. **Vertical Escalation Guard**: Role assignment endpoints require `USER_MANAGE` permission. Non-admin users cannot grant themselves `ADMIN` roles or bypass permission checks.
2. **Horizontal Privilege Escalation**: Users cannot access records belonging to another company or branch unless explicitly included in their `allowedCompanies` / `allowedBranches` claim lists.
3. **Segregation of Duties (SoD)**: The user who creates a financial transaction or approval workflow cannot approve their own submission (`creatorUserId !== approverUserId`).
