# TaxFlow — Dependency & Supply Chain Security

## 1. Overview & Scan Summary

To protect against supply chain vulnerabilities, malicious package injections, and container exploitation, TaxFlow enforces lockfile verification, non-root Docker container configurations, and dependency vulnerability auditing.

---

## 2. Supply Chain Security Controls

1. **Lockfile Enforcement**: `package-lock.json` is checked into version control and enforced during CI/CD builds (`npm ci`).
2. **Container Image Hardening**:
   - Docker images utilize minimal Alpine base images (`node:20-alpine`).
   - Container processes execute under a dedicated non-root user (`USER node`).
   - Root capabilities are dropped in production containers (`securityOpt: no-new-privileges`).
3. **Dependency Vulnerability Scanning**:
   - Regular `npm audit` scans executed to detect transitive vulnerability disclosures.

---

## 3. Dockerfile Hardening Verification

```dockerfile
# Production Container Hardening Snapshot
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run container as non-root user
USER node

EXPOSE 3000
CMD ["node", "dist/nestjs/main.js"]
```
