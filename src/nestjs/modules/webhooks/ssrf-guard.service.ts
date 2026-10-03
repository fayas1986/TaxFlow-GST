import { Injectable, BadRequestException } from '@nestjs/common';
import * as net from 'net';

@Injectable()
export class SsrfGuardService {
  validateWebhookUrl(targetUrl: string, allowHttp: boolean = false, allowInternal: boolean = false): { isValid: boolean; hostname: string } {
    if (!targetUrl || typeof targetUrl !== 'string') {
      throw new BadRequestException('Target URL is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch (err) {
      throw new BadRequestException('Invalid target URL format');
    }

    // 1. HTTPS Enforcement
    if (!allowHttp && parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook target URL must use secure HTTPS protocol (https://)');
    }

    const hostname = parsed.hostname;
    if (!hostname) {
      throw new BadRequestException('Invalid target URL hostname');
    }

    if (!allowInternal) {
      // 2. Direct IP Address Validation
      if (net.isIP(hostname)) {
        if (this.isPrivateOrInternalIp(hostname)) {
          throw new BadRequestException(`Target IP address '${hostname}' is a restricted private/internal network address (SSRF Protection)`);
        }
      } else {
        // Hostname Checks
        const lowerHost = hostname.toLowerCase();
        if (
          lowerHost === 'localhost' ||
          lowerHost.endsWith('.local') ||
          lowerHost.endsWith('.internal') ||
          lowerHost === 'metadata.google.internal'
        ) {
          throw new BadRequestException(`Target hostname '${hostname}' is a restricted internal address (SSRF Protection)`);
        }
      }
    }

    return { isValid: true, hostname };
  }

  /**
   * DNS Rebinding Protection:
   * Resolves hostname right before connection and validates destination IP.
   */
  validateResolvedDnsIp(resolvedIp: string): void {
    if (this.isPrivateOrInternalIp(resolvedIp)) {
      throw new BadRequestException(
        `DNS Rebinding Violation: Resolved destination IP '${resolvedIp}' is a restricted private/internal network address`,
      );
    }
  }

  isPrivateOrInternalIp(ip: string): boolean {
    if (!net.isIP(ip)) return false;

    // IPv4 Checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      
      // 127.0.0.0/8 (Loopback)
      if (parts[0] === 127) return true;
      // 10.0.0.0/8 (Private)
      if (parts[0] === 10) return true;
      // 172.16.0.0/12 (Private)
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16 (Private)
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 169.254.169.254 (Cloud Metadata IMDS)
      if (parts[0] === 169 && parts[1] === 254) return true;
      // 0.0.0.0/8
      if (parts[0] === 0) return true;
    }

    // IPv6 Checks
    if (net.isIPv6(ip)) {
      const lowerIp = ip.toLowerCase();
      if (lowerIp === '::1' || lowerIp === '0:0:0:0:0:0:0:1' || lowerIp.startsWith('fe80:')) return true;
    }

    return false;
  }
}
