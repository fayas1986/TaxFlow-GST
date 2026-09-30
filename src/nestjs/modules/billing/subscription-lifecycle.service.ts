import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ImmutableAuditService } from '../audit/immutable-audit.service';
import { PlanCode, DEFAULT_PLANS_CATALOG } from '../../../core/entitlements/types';
import { SubscriptionStatus, BillingCycle, PaymentStatus } from '@prisma/client';

export interface CreateSubscriptionDto {
  tenantId: string;
  planCode: PlanCode;
  billingCycle?: BillingCycle;
  customLimits?: any;
  customFeatures?: any;
}

@Injectable()
export class SubscriptionLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: ImmutableAuditService,
  ) {}

  /**
   * Initialize subscription for a tenant.
   */
  async createSubscription(dto: CreateSubscriptionDto) {
    const catalogPlan = DEFAULT_PLANS_CATALOG[dto.planCode];
    if (!catalogPlan) {
      throw new BadRequestException(`Invalid plan code: ${dto.planCode}`);
    }

    const now = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + (dto.billingCycle === BillingCycle.ANNUAL ? 12 : 1));

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId: dto.tenantId,
        planCode: dto.planCode,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: dto.billingCycle || BillingCycle.MONTHLY,
        startDate: now,
        renewalDate,
        customLimits: dto.customLimits || undefined,
        customFeatures: dto.customFeatures || undefined,
        billingEvents: {
          create: {
            tenantId: dto.tenantId,
            eventType: 'SUBSCRIPTION_CREATED',
            amountInr: dto.billingCycle === BillingCycle.ANNUAL ? catalogPlan.annualPriceInr : catalogPlan.monthlyPriceInr,
            paymentStatus: PaymentStatus.SUCCESS,
            idempotencyKey: `sub-init-${dto.tenantId}-${Date.now()}`,
          },
        },
      },
    });

    await this.auditService.logEvent({
      tenantId: dto.tenantId,
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'Subscription',
      entityId: subscription.id,
      correlationId: `sub-create-${subscription.id}`,
      afterState: { planCode: subscription.planCode, status: subscription.status },
      result: 'SUCCESS',
    });

    return subscription;
  }

  /**
   * Upgrade Subscription: Existing business data remains completely safe.
   */
  async upgradeSubscription(tenantId: string, newPlanCode: PlanCode) {
    const subscription = await this.getTenantSubscription(tenantId);
    const catalogPlan = DEFAULT_PLANS_CATALOG[newPlanCode];
    if (!catalogPlan) {
      throw new BadRequestException(`Invalid plan code: ${newPlanCode}`);
    }

    const oldPlan = subscription.planCode;
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planCode: newPlanCode,
        status: SubscriptionStatus.ACTIVE,
        billingEvents: {
          create: {
            tenantId,
            eventType: 'SUBSCRIPTION_UPGRADED',
            amountInr: catalogPlan.monthlyPriceInr,
            paymentStatus: PaymentStatus.SUCCESS,
            idempotencyKey: `sub-upg-${tenantId}-${Date.now()}`,
            payload: { oldPlan, newPlan: newPlanCode },
          },
        },
      },
    });

    await this.auditService.logEvent({
      tenantId,
      action: 'SUBSCRIPTION_UPGRADED',
      entityType: 'Subscription',
      entityId: subscription.id,
      correlationId: `sub-upg-${subscription.id}`,
      beforeState: { planCode: oldPlan },
      afterState: { planCode: newPlanCode },
      result: 'SUCCESS',
    });

    return updated;
  }

  /**
   * Downgrade Subscription: Data safety guaranteed (existing data is NEVER deleted).
   */
  async downgradeSubscription(tenantId: string, newPlanCode: PlanCode) {
    const subscription = await this.getTenantSubscription(tenantId);
    const catalogPlan = DEFAULT_PLANS_CATALOG[newPlanCode];
    if (!catalogPlan) {
      throw new BadRequestException(`Invalid plan code: ${newPlanCode}`);
    }

    const oldPlan = subscription.planCode;
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planCode: newPlanCode,
        billingEvents: {
          create: {
            tenantId,
            eventType: 'SUBSCRIPTION_DOWNGRADED',
            amountInr: catalogPlan.monthlyPriceInr,
            paymentStatus: PaymentStatus.SUCCESS,
            idempotencyKey: `sub-downgrade-${tenantId}-${Date.now()}`,
            payload: { oldPlan, newPlan: newPlanCode, dataSafetyNotice: 'Existing data preserved intact' },
          },
        },
      },
    });

    await this.auditService.logEvent({
      tenantId,
      action: 'SUBSCRIPTION_DOWNGRADED',
      entityType: 'Subscription',
      entityId: subscription.id,
      correlationId: `sub-downgrade-${subscription.id}`,
      beforeState: { planCode: oldPlan },
      afterState: { planCode: newPlanCode },
      result: 'SUCCESS',
    });

    return updated;
  }

  /**
   * Cancel Subscription.
   */
  async cancelSubscription(tenantId: string, immediate: boolean = false) {
    const subscription = await this.getTenantSubscription(tenantId);
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: immediate ? SubscriptionStatus.CANCELLED : subscription.status,
        cancelAtPeriodEnd: !immediate,
        billingEvents: {
          create: {
            tenantId,
            eventType: immediate ? 'SUBSCRIPTION_CANCELLED_IMMEDIATE' : 'SUBSCRIPTION_CANCELLED_PERIOD_END',
            paymentStatus: PaymentStatus.SUCCESS,
            idempotencyKey: `sub-cancel-${tenantId}-${Date.now()}`,
          },
        },
      },
    });

    await this.auditService.logEvent({
      tenantId,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Subscription',
      entityId: subscription.id,
      correlationId: `sub-cancel-${subscription.id}`,
      afterState: { status: updated.status, cancelAtPeriodEnd: updated.cancelAtPeriodEnd },
      result: 'SUCCESS',
    });

    return updated;
  }

  /**
   * Renew Subscription for next billing period.
   */
  async renewSubscription(tenantId: string) {
    const subscription = await this.getTenantSubscription(tenantId);
    const now = new Date();
    const nextRenewal = new Date(now);
    nextRenewal.setMonth(nextRenewal.getMonth() + (subscription.billingCycle === BillingCycle.ANNUAL ? 12 : 1));

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        renewalDate: nextRenewal,
        cancelAtPeriodEnd: false,
        billingEvents: {
          create: {
            tenantId,
            eventType: 'SUBSCRIPTION_RENEWED',
            paymentStatus: PaymentStatus.SUCCESS,
            idempotencyKey: `sub-renew-${tenantId}-${Date.now()}`,
          },
        },
      },
    });

    await this.auditService.logEvent({
      tenantId,
      action: 'SUBSCRIPTION_RENEWED',
      entityType: 'Subscription',
      entityId: subscription.id,
      correlationId: `sub-renew-${subscription.id}`,
      afterState: { renewalDate: nextRenewal },
      result: 'SUCCESS',
    });

    return updated;
  }

  private async getTenantSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
      throw new NotFoundException(`No active subscription found for tenant ${tenantId}`);
    }
    return sub;
  }
}
