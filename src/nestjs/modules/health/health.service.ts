import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface HealthCheckResult {
  status: 'UP' | 'DOWN';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: { status: 'UP' | 'DOWN'; responseTimeMs?: number; error?: string };
    backgroundJobs: { status: 'UP' | 'DOWN'; queuedJobs?: number; error?: string };
    gspGateway: { status: 'UP' | 'DOWN' | 'SANDBOX'; mode: string };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): { status: string; timestamp: string } {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const env = process.env.NODE_ENV || 'development';
    let dbStatus: 'UP' | 'DOWN' = 'UP';
    let dbError: string | undefined = undefined;
    let dbResponseTimeMs = 0;

    // 1. Check Database Connectivity
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbResponseTimeMs = Date.now() - dbStart;
    } catch (err: any) {
      dbStatus = 'DOWN';
      dbError = err.message || 'Database query failed';
      this.logger.error(`Readiness check database failure: ${dbError}`);
    }

    // 2. Check Background Job System
    let jobStatus: 'UP' | 'DOWN' = 'UP';
    let queuedCount = 0;
    try {
      queuedCount = await this.prisma.backgroundJobRecord.count({
        where: { status: 'QUEUED' },
      });
    } catch (err: any) {
      jobStatus = 'DOWN';
    }

    // 3. Check GSP Gateway Mode
    const isProductionGsp = env === 'production' && Boolean(process.env.GSP_CLIENT_ID);
    const gspMode = isProductionGsp ? 'PRODUCTION_CERTIFIED' : 'SANDBOX_VERIFIED';

    const isHealthy = dbStatus === 'UP' && jobStatus === 'UP';

    return {
      status: isHealthy ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: env,
      services: {
        database: {
          status: dbStatus,
          responseTimeMs: dbResponseTimeMs,
          error: dbError,
        },
        backgroundJobs: {
          status: jobStatus,
          queuedJobs: queuedCount,
        },
        gspGateway: {
          status: isProductionGsp ? 'UP' : 'SANDBOX',
          mode: gspMode,
        },
      },
    };
  }
}
