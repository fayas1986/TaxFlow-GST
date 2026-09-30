import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { GspEnvironment } from '@prisma/client';

export interface SaveGspCredentialsDto {
  gstinId: string;
  provider: string;
  environment: GspEnvironment;
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class GspCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async saveCredentials(tenantId: string, userId: string, dto: SaveGspCredentialsDto) {
    const gstin = await this.prisma.gSTRegistration.findFirst({
      where: { id: dto.gstinId, tenantId },
    });
    if (!gstin) {
      throw new NotFoundException(`GSTIN registration ${dto.gstinId} not found under tenant ${tenantId}`);
    }

    const encryptedUsername = this.cryptoService.encrypt(dto.username);
    const encryptedPassword = this.cryptoService.encrypt(dto.password);
    const encryptedClientId = this.cryptoService.encrypt(dto.clientId);
    const encryptedClientSecret = this.cryptoService.encrypt(dto.clientSecret);

    const credential = await this.prisma.govGspCredential.upsert({
      where: {
        tenantId_gstinId_provider_environment: {
          tenantId,
          gstinId: dto.gstinId,
          provider: dto.provider,
          environment: dto.environment,
        },
      },
      create: {
        tenantId,
        gstinId: dto.gstinId,
        provider: dto.provider,
        environment: dto.environment,
        encryptedUsername,
        encryptedPassword,
        encryptedClientId,
        encryptedClientSecret,
        authMethod: 'AES-256-GCM',
        isActive: true,
      },
      update: {
        encryptedUsername,
        encryptedPassword,
        encryptedClientId,
        encryptedClientSecret,
        updatedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        category: 'GOV_CREDENTIAL_MUTATION',
        action: 'SAVE_GSP_CREDENTIALS',
        entityName: 'GovGspCredential',
        entityId: credential.id,
        diff: { provider: dto.provider, environment: dto.environment, gstinId: dto.gstinId },
      },
    });

    return {
      id: credential.id,
      tenantId,
      gstinId: dto.gstinId,
      provider: dto.provider,
      environment: dto.environment,
      hasUsername: true,
      hasPassword: true,
      hasClientId: true,
      hasClientSecret: true,
    };
  }

  async getDecryptedCredentials(tenantId: string, gstinId: string, provider: string, environment: GspEnvironment) {
    const cred = await this.prisma.govGspCredential.findFirst({
      where: { tenantId, gstinId, provider, environment, isActive: true },
    });

    if (!cred) {
      throw new NotFoundException(
        `Active GSP credentials for GSTIN ${gstinId}, Provider ${provider} (${environment}) not found`,
      );
    }

    return {
      username: this.cryptoService.decrypt(cred.encryptedUsername),
      password: this.cryptoService.decrypt(cred.encryptedPassword),
      clientId: this.cryptoService.decrypt(cred.encryptedClientId),
      clientSecret: this.cryptoService.decrypt(cred.encryptedClientSecret),
    };
  }
}
