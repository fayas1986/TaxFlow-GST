import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Breaker tripped; fast-fail calls
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitStatus {
  domain: string;
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptAllowedAt?: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits = new Map<string, {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    successCount: number;
  }>();

  private readonly failureThreshold = 3; // 3 consecutive errors trip breaker
  private readonly resetTimeoutMs = 10000; // 10 seconds timeout before half-open test

  getCircuitStatus(domain: string): CircuitStatus {
    const circuit = this.circuits.get(domain);
    if (!circuit) {
      return { domain, state: CircuitState.CLOSED, failureCount: 0 };
    }

    const now = Date.now();
    if (circuit.state === CircuitState.OPEN && now - circuit.lastFailureTime > this.resetTimeoutMs) {
      circuit.state = CircuitState.HALF_OPEN;
      this.logger.warn(`Circuit Breaker for domain [${domain}] transitioning OPEN -> HALF_OPEN (Trialing recovery)`);
    }

    return {
      domain,
      state: circuit.state,
      failureCount: circuit.failureCount,
      lastFailureTime: circuit.lastFailureTime,
      nextAttemptAllowedAt: circuit.state === CircuitState.OPEN ? circuit.lastFailureTime + this.resetTimeoutMs : undefined,
    };
  }

  canExecute(domain: string): boolean {
    const status = this.getCircuitStatus(domain);
    if (status.state === CircuitState.OPEN) {
      this.logger.warn(`Circuit Breaker OPEN for domain [${domain}]. Request fast-failed.`);
      return false;
    }
    return true;
  }

  recordSuccess(domain: string): void {
    const circuit = this.circuits.get(domain);
    if (circuit) {
      if (circuit.state === CircuitState.HALF_OPEN) {
        this.logger.log(`Circuit Breaker for domain [${domain}] HALF_OPEN -> CLOSED (Service restored)`);
      }
      this.circuits.delete(domain);
    }
  }

  recordFailure(domain: string, error: string): void {
    const now = Date.now();
    let circuit = this.circuits.get(domain);
    if (!circuit) {
      circuit = { state: CircuitState.CLOSED, failureCount: 0, lastFailureTime: now, successCount: 0 };
      this.circuits.set(domain, circuit);
    }

    circuit.failureCount += 1;
    circuit.lastFailureTime = now;

    if (circuit.failureCount >= this.failureThreshold || circuit.state === CircuitState.HALF_OPEN) {
      circuit.state = CircuitState.OPEN;
      this.logger.error(`Circuit Breaker TRIPPED for domain [${domain}] (Failures: ${circuit.failureCount}). Reason: ${error}`);
    }
  }

  resetAll(): void {
    this.circuits.clear();
  }
}
