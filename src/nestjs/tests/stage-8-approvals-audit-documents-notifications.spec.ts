import 'dotenv/config';
import { PrismaService } from '../common/services/prisma.service';
import { ImmutableAuditService } from '../modules/audit/immutable-audit.service';
import { ApprovalEngineService } from '../modules/approvals/approval-engine.service';
import { DocumentManagementService } from '../modules/documents/document-management.service';
import { NotificationService } from '../modules/notifications/notification.service';
import { ApprovalEntityType, DocumentType, NotificationChannel, NotificationStatus, ApprovalStatus } from '@prisma/client';
import * as crypto from 'crypto';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, title: string) {
  totalCount++;
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    process.exitCode = 1;
  }
}

async function runStage8VerificationSuite() {
  console.log('===================================================================');
  console.log('STAGE 8: APPROVALS, AUDIT, DOCUMENTS & NOTIFICATIONS TEST SUITE');
  console.log('===================================================================\n');

  const prisma = new PrismaService();

  // In-Memory Database Repositories
  const mockTenants: any[] = [];
  const mockUsers: any[] = [];
  const mockApprovalWorkflows: any[] = [];
  const mockApprovalStageDefs: any[] = [];
  const mockApprovalRequests: any[] = [];
  const mockApprovalActions: any[] = [];
  const mockApprovalDelegations: any[] = [];
  const mockImmutableAuditLogs: any[] = [];
  const mockDocumentMetadata: any[] = [];
  const mockNotificationRecords: any[] = [];

  // Wire Prisma Mock Handlers
  prisma.tenant.create = (async (args: any) => {
    const rec = { ...args.data };
    mockTenants.push(rec);
    return rec;
  }) as any;

  prisma.user.create = (async (args: any) => {
    const rec = { id: args.data.id || `usr-${Date.now()}-${Math.random()}`, ...args.data };
    mockUsers.push(rec);
    return rec;
  }) as any;

  prisma.approvalWorkflow.create = (async (args: any) => {
    const id = `wf-${Date.now()}-${Math.random()}`;
    const stagesData = args.data.stages?.create || [];
    const stages = stagesData.map((st: any) => ({
      id: `stg-${Date.now()}-${Math.random()}`,
      workflowId: id,
      ...st,
    }));
    mockApprovalStageDefs.push(...stages);

    const rec = {
      id,
      tenantId: args.data.tenantId,
      entityType: args.data.entityType,
      name: args.data.name,
      minAmount: args.data.minAmount,
      maxAmount: args.data.maxAmount,
      isActive: args.data.isActive ?? true,
      stages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockApprovalWorkflows.push(rec);
    return rec;
  }) as any;

  prisma.approvalWorkflow.findFirst = (async (args: any) => {
    const wf = mockApprovalWorkflows.find((w) => {
      if (args.where.id && w.id !== args.where.id) return false;
      if (args.where.tenantId && w.tenantId !== args.where.tenantId) return false;
      if (args.where.entityType && w.entityType !== args.where.entityType) return false;
      if (args.where.isActive !== undefined && w.isActive !== args.where.isActive) return false;
      return true;
    });
    if (!wf) return null;
    const stages = mockApprovalStageDefs
      .filter((s) => s.workflowId === wf.id)
      .sort((a, b) => a.stageIndex - b.stageIndex);
    return { ...wf, stages };
  }) as any;

  prisma.approvalRequest.create = (async (args: any) => {
    const id = `req-${Date.now()}-${Math.random()}`;
    const actionsData = args.data.actions?.create || [];
    const actions = (Array.isArray(actionsData) ? actionsData : [actionsData]).map((act: any) => ({
      id: `act-${Date.now()}-${Math.random()}`,
      requestId: id,
      createdAt: new Date(),
      ...act,
    }));
    mockApprovalActions.push(...actions);

    const rec = {
      id,
      tenantId: args.data.tenantId,
      companyId: args.data.companyId || null,
      gstinId: args.data.gstinId || null,
      branchId: args.data.branchId || null,
      entityType: args.data.entityType,
      entityId: args.data.entityId,
      status: args.data.status || ApprovalStatus.SUBMITTED,
      currentStageIndex: args.data.currentStageIndex || 0,
      requesterUserId: args.data.requesterUserId,
      rejectionReason: args.data.rejectionReason || null,
      comments: args.data.comments || null,
      actions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockApprovalRequests.push(rec);
    return rec;
  }) as any;

  prisma.approvalRequest.findFirst = (async (args: any) => {
    const req = mockApprovalRequests.find((r) => {
      if (args.where.id && r.id !== args.where.id) return false;
      if (args.where.tenantId && r.tenantId !== args.where.tenantId) return false;
      if (args.where.entityType && r.entityType !== args.where.entityType) return false;
      if (args.where.entityId && r.entityId !== args.where.entityId) return false;
      if (args.where.status?.in && !args.where.status.in.includes(r.status)) return false;
      return true;
    });
    if (!req) return null;
    const actions = mockApprovalActions.filter((a) => a.requestId === req.id);
    return { ...req, actions };
  }) as any;

  prisma.approvalRequest.update = (async (args: any) => {
    const req = mockApprovalRequests.find((r) => r.id === args.where.id);
    if (!req) throw new Error('Request not found');
    Object.assign(req, args.data);
    req.updatedAt = new Date();

    if (args.data.actions?.create) {
      const act = {
        id: `act-${Date.now()}-${Math.random()}`,
        requestId: req.id,
        createdAt: new Date(),
        ...args.data.actions.create,
      };
      mockApprovalActions.push(act);
    }
    const actions = mockApprovalActions.filter((a) => a.requestId === req.id);
    return { ...req, actions };
  }) as any;

  prisma.approvalDelegation.create = (async (args: any) => {
    const rec = { id: `del-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockApprovalDelegations.push(rec);
    return rec;
  }) as any;

  prisma.approvalDelegation.findFirst = (async (args: any) => {
    return (
      mockApprovalDelegations.find((d) => {
        if (args.where.tenantId && d.tenantId !== args.where.tenantId) return false;
        if (args.where.delegatorUserId && d.delegatorUserId !== args.where.delegatorUserId) return false;
        if (args.where.delegateeUserId && d.delegateeUserId !== args.where.delegateeUserId) return false;
        if (args.where.isActive !== undefined && d.isActive !== args.where.isActive) return false;
        return true;
      }) || null
    );
  }) as any;

  // Immutable Audit Log Mock
  prisma.immutableAuditLog.create = (async (args: any) => {
    const rec = { id: `aud-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockImmutableAuditLogs.push(rec);
    return rec;
  }) as any;

  prisma.immutableAuditLog.findFirst = (async (args: any) => {
    const filtered = mockImmutableAuditLogs.filter((a) => a.tenantId === args.where.tenantId);
    if (args.orderBy?.createdAt === 'desc') {
      return filtered.length > 0 ? filtered[filtered.length - 1] : null;
    }
    return filtered[0] || null;
  }) as any;

  prisma.immutableAuditLog.findMany = (async (args: any) => {
    let filtered = mockImmutableAuditLogs.filter((a) => a.tenantId === args.where.tenantId);
    if (args.where.entityType) filtered = filtered.filter((a) => a.entityType === args.where.entityType);
    if (args.where.entityId) filtered = filtered.filter((a) => a.entityId === args.where.entityId);
    if (args.orderBy?.createdAt === 'desc') {
      return filtered.slice().reverse();
    }
    return filtered.slice();
  }) as any;

  // Document Metadata Mock
  prisma.documentMetadata.create = (async (args: any) => {
    const rec = { id: `doc-${Date.now()}-${Math.random()}`, createdAt: new Date(), ...args.data };
    mockDocumentMetadata.push(rec);
    return rec;
  }) as any;

  prisma.documentMetadata.findFirst = (async (args: any) => {
    const filtered = mockDocumentMetadata.filter((d) => {
      if (args.where.id && d.id !== args.where.id) return false;
      if (args.where.tenantId && d.tenantId !== args.where.tenantId) return false;
      if (args.where.entityType && d.entityType !== args.where.entityType) return false;
      if (args.where.entityId && d.entityId !== args.where.entityId) return false;
      if (args.where.fileName && d.fileName !== args.where.fileName) return false;
      return true;
    });
    if (args.orderBy?.version === 'desc') {
      filtered.sort((a, b) => b.version - a.version);
    }
    return filtered[0] || null;
  }) as any;

  prisma.documentMetadata.findMany = (async (args: any) => {
    let filtered = mockDocumentMetadata.filter((d) => d.tenantId === args.where.tenantId);
    if (args.where.entityType) filtered = filtered.filter((d) => d.entityType === args.where.entityType);
    if (args.where.entityId) filtered = filtered.filter((d) => d.entityId === args.where.entityId);
    if (args.where.fileName) filtered = filtered.filter((d) => d.fileName === args.where.fileName);
    if (args.orderBy?.version === 'asc') {
      filtered.sort((a, b) => a.version - b.version);
    }
    return filtered;
  }) as any;

  // Notification Records Mock
  prisma.notificationRecord.create = (async (args: any) => {
    const rec = {
      id: `notif-${Date.now()}-${Math.random()}`,
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...args.data,
    };
    mockNotificationRecords.push(rec);
    return rec;
  }) as any;

  prisma.notificationRecord.findFirst = (async (args: any) => {
    return (
      mockNotificationRecords.find((n) => {
        if (args.where.tenantId && n.tenantId !== args.where.tenantId) return false;
        if (args.where.idempotencyKey && n.idempotencyKey !== args.where.idempotencyKey) return false;
        return true;
      }) || null
    );
  }) as any;

  prisma.notificationRecord.findUnique = (async (args: any) => {
    return mockNotificationRecords.find((n) => n.id === args.where.id) || null;
  }) as any;

  prisma.notificationRecord.update = (async (args: any) => {
    const notif = mockNotificationRecords.find((n) => n.id === args.where.id);
    if (!notif) throw new Error('Notification not found');
    Object.assign(notif, args.data);
    notif.updatedAt = new Date();
    return notif;
  }) as any;

  prisma.notificationRecord.findMany = (async (args: any) => {
    return mockNotificationRecords.filter((n) => {
      if (args.where.tenantId && n.tenantId !== args.where.tenantId) return false;
      if (args.where.status?.in && !args.where.status.in.includes(n.status)) return false;
      if (args.where.attempts?.lt !== undefined && n.attempts >= args.where.attempts.lt) return false;
      return true;
    });
  }) as any;

  // Instantiate Services
  const auditService = new ImmutableAuditService(prisma);
  const approvalEngine = new ApprovalEngineService(prisma, auditService);
  const documentService = new DocumentManagementService(prisma, auditService);
  const notificationService = new NotificationService(prisma, auditService);

  const tenantAId = 'tenant-corp-alpha-uuid';
  const tenantBId = 'tenant-corp-beta-uuid';
  const userPreparerId = 'user-preparer-101';
  const userApprover1Id = 'user-approver-stage1';
  const userApprover2Id = 'user-approver-stage2';
  const userDelegateeId = 'user-delegatee-999';

  console.log('--- 1. APPROVAL ENGINE & SEGREGATION OF DUTIES TESTS ---');

  // Test 1: Configure Multi-stage Workflow
  const workflow = await approvalEngine.createWorkflow({
    tenantId: tenantAId,
    entityType: ApprovalEntityType.SALES_INVOICE,
    name: 'High-Value Invoice Approval Workflow',
    minAmount: 100000,
    stages: [
      { stageIndex: 0, stageName: 'Finance Manager Review', requiredRole: 'FINANCE_MANAGER', minApprovers: 1 },
      { stageIndex: 1, stageName: 'CFO Final Approval', requiredRole: 'CFO', requiredUserId: userApprover2Id, minApprovers: 1 },
    ],
  });
  assert(workflow.stages.length === 2, 'Multi-stage approval workflow created with 2 stages');

  // Test 2: Submit Invoice for Approval
  const approvalReq = await approvalEngine.submitForApproval({
    tenantId: tenantAId,
    entityType: ApprovalEntityType.SALES_INVOICE,
    entityId: 'inv-high-val-001',
    requesterUserId: userPreparerId,
    comments: 'Invoice exceeds ₹1,00,000 threshold requiring multi-stage approval',
    correlationId: 'corr-app-001',
  });
  assert(approvalReq.status === ApprovalStatus.SUBMITTED, 'Approval request state initialized to SUBMITTED');
  assert(approvalReq.currentStageIndex === 0, 'Approval request assigned to Stage 0');

  // Test 3: Segregation of Duties Guard (Preparer cannot approve own request)
  let sodCaught = false;
  try {
    await approvalEngine.approveRequest({
      tenantId: tenantAId,
      requestId: approvalReq.id,
      actorUserId: userPreparerId,
      actorRole: 'FINANCE_MANAGER',
      correlationId: 'corr-bypass-attempt',
    });
  } catch (err: any) {
    sodCaught = err.message.includes('Segregation of duties violation');
  }
  assert(sodCaught, 'Segregation of duties guard blocked preparer from self-approving invoice');

  // Test 4: Stage 0 Approval by Authorized Finance Manager
  const stage0Approved = await approvalEngine.approveRequest({
    tenantId: tenantAId,
    requestId: approvalReq.id,
    actorUserId: userApprover1Id,
    actorRole: 'FINANCE_MANAGER',
    comment: 'Line items and tax computations verified',
    correlationId: 'corr-app-002',
  });
  assert(stage0Approved.status === ApprovalStatus.UNDER_REVIEW, 'Status transitioned to UNDER_REVIEW after Stage 0 approval');
  assert(stage0Approved.currentStageIndex === 1, 'Approval request advanced to Stage 1');

  // Test 5: Unauthorized User Approval Attempt
  let unauthCaught = false;
  try {
    await approvalEngine.approveRequest({
      tenantId: tenantAId,
      requestId: approvalReq.id,
      actorUserId: 'user-unauthorized-random',
      actorRole: 'TAX_ANALYST',
      correlationId: 'corr-unauth-attempt',
    });
  } catch (err: any) {
    unauthCaught = err.message.includes('Unauthorized approval');
  }
  assert(unauthCaught, 'Unauthorized user attempt to approve Stage 1 failed closed (ForbiddenException)');

  // Test 6: Delegation of Approval Authority
  const delegation = await approvalEngine.delegateApproval({
    tenantId: tenantAId,
    delegatorUserId: userApprover2Id, // CFO
    delegateeUserId: userDelegateeId,
    entityType: ApprovalEntityType.SALES_INVOICE,
    startDate: new Date(Date.now() - 3600000), // 1 hour ago
    endDate: new Date(Date.now() + 86400000),  // 24 hours in future
  });
  assert(delegation.isActive === true, 'Approval delegation created for delegatee user');

  // Test 7: Delegated User Approves Final Stage
  const stage1Approved = await approvalEngine.approveRequest({
    tenantId: tenantAId,
    requestId: approvalReq.id,
    actorUserId: userDelegateeId,
    actorRole: 'ACTING_CFO',
    comment: 'Approved via delegated authority from CFO',
    correlationId: 'corr-app-003',
  });
  assert(stage1Approved.status === ApprovalStatus.APPROVED, 'Approval request state transitioned to APPROVED after final stage');

  // Test 8: Rejection Workflow Test with Mandatory Reason
  const approvalReq2 = await approvalEngine.submitForApproval({
    tenantId: tenantAId,
    entityType: ApprovalEntityType.GST_RETURN,
    entityId: 'ret-gstr3b-009',
    requesterUserId: userPreparerId,
    comments: 'GSTR-3B tax payment draft',
    correlationId: 'corr-app-004',
  });

  const rejectedReq = await approvalEngine.rejectRequest({
    tenantId: tenantAId,
    requestId: approvalReq2.id,
    actorUserId: userApprover1Id,
    actorRole: 'FINANCE_MANAGER',
    rejectionReason: 'ITC discrepancy detected against GSTR-2B table 4A',
    comment: 'Please re-reconcile purchase register before resubmitting',
    correlationId: 'corr-app-005',
  });
  assert(rejectedReq.status === ApprovalStatus.REJECTED, 'Approval request state transitioned to REJECTED');
  assert(rejectedReq.rejectionReason!.includes('GSTR-2B'), 'Rejection reason persisted in immutable record');

  console.log('\n--- 2. IMMUTABLE AUDIT SYSTEM & HASH CHAINING TESTS ---');

  // Test 9: Cryptographic Hash Chain Generation
  const auditLogs = await auditService.getAuditTrail(tenantAId);
  assert(auditLogs.length >= 5, 'Centralized audit events captured for all operational actions');

  const firstLog = auditLogs[auditLogs.length - 1]; // Oldest
  const latestLog = auditLogs[0]; // Newest

  assert(firstLog.previousEventHash === '0'.repeat(64), 'Genesis audit log has 64-zero previous hash');
  assert(latestLog.payloadHash.length === 64, 'Audit event payload hash is 64-char SHA-256 string');
  assert(latestLog.currentEventHash.length === 64, 'Audit event current hash is 64-char SHA-256 string');

  // Test 10: Cryptographic Chain Integrity Verification
  const verification = await auditService.verifyChainIntegrity(tenantAId);
  assert(verification.isValid === true, 'Audit hash chain integrity verified with 100% cryptographic continuity');
  assert(verification.totalEventsScanned === auditLogs.length, 'Scanned all tenant audit records in sequence');

  // Test 11: Audit Immutability Protection (UPDATE/DELETE Forbidden)
  let updateBlocked = false;
  try {
    await auditService.updateEvent();
  } catch (err: any) {
    updateBlocked = err.message.includes('immutable');
  }
  assert(updateBlocked, 'Attempt to UPDATE historical audit log blocked with ForbiddenException');

  let deleteBlocked = false;
  try {
    await auditService.deleteEvent();
  } catch (err: any) {
    deleteBlocked = err.message.includes('immutable');
  }
  assert(deleteBlocked, 'Attempt to DELETE historical audit log blocked with ForbiddenException');

  console.log('\n--- 3. DOCUMENT MANAGEMENT, INTEGRITY & SECURITY TESTS ---');

  // Test 12: Upload Document Binary & Metadata
  const docBufferV1 = Buffer.from('TaxFlow GST Statutory Return Export Content V1 - SHA256 Verification');
  const docV1 = await documentService.uploadDocument({
    tenantId: tenantAId,
    companyId: 'comp-alpha-123',
    gstinId: '27AAAAA0000A1Z5',
    documentType: DocumentType.COMPLIANCE_EXPORT,
    entityType: 'GstReturn',
    entityId: 'ret-gstr1-001',
    fileName: 'gstr1_summary_export.pdf',
    mimeType: 'application/pdf',
    fileBuffer: docBufferV1,
    createdById: userPreparerId,
    correlationId: 'corr-doc-001',
  });

  assert(docV1.version === 1, 'Document uploaded as Version 1');
  assert(docV1.sha256Hash.length === 64, 'SHA-256 hash computed and attached to document metadata');
  assert(docV1.objectKey.includes(`tenants/${tenantAId}/`), 'Document binary stored under tenant-isolated S3 object key');

  // Test 13: Document Versioning
  const docBufferV2 = Buffer.from('TaxFlow GST Statutory Return Export Content V2 - Amended Items Added');
  const docV2 = await documentService.uploadDocument({
    tenantId: tenantAId,
    companyId: 'comp-alpha-123',
    gstinId: '27AAAAA0000A1Z5',
    documentType: DocumentType.COMPLIANCE_EXPORT,
    entityType: 'GstReturn',
    entityId: 'ret-gstr1-001',
    fileName: 'gstr1_summary_export.pdf',
    mimeType: 'application/pdf',
    fileBuffer: docBufferV2,
    createdById: userPreparerId,
    correlationId: 'corr-doc-002',
  });

  assert(docV2.version === 2, 'Uploading revised file auto-incremented document version to V2');
  assert(docV2.parentDocumentId === docV1.id, 'Version 2 linked to Version 1 parent document ID');

  const versions = await documentService.getDocumentVersions(tenantAId, 'GstReturn', 'ret-gstr1-001', 'gstr1_summary_export.pdf');
  assert(versions.length === 2, 'Document version lineage traceable (V1 and V2 exist)');

  // Test 14: Short-Lived Signed Download URL Generation & Authorization
  const signedUrlRes = await documentService.getSignedDownloadUrl({
    tenantId: tenantAId,
    userId: userPreparerId,
    userCompanyIds: ['comp-alpha-123'],
    documentId: docV2.id,
    correlationId: 'corr-doc-003',
    expiresInSeconds: 60,
  });

  assert(signedUrlRes.signedUrl.includes('https://storage.taxflow.internal/download?key='), 'Generated HTTPS signed download URL');
  assert(signedUrlRes.signedUrl.includes('sig='), 'Signed download URL contains HMAC cryptographic signature');

  // Test 15: Cross-Tenant Document Isolation Guard (Tenant B cannot access Tenant A document)
  let crossTenantDocCaught = false;
  try {
    await documentService.getSignedDownloadUrl({
      tenantId: tenantBId, // Tenant B trying to access Tenant A document
      userId: 'user-tenantB',
      documentId: docV2.id,
      correlationId: 'corr-doc-attack',
    });
  } catch (err: any) {
    crossTenantDocCaught = err.message.includes('Tenant isolation violation');
  }
  assert(crossTenantDocCaught, 'Cross-tenant document access attempt blocked (ForbiddenException)');

  // Test 16: Binary Download & SHA-256 Integrity Verification
  const downloaded = await documentService.downloadDocument(tenantAId, docV2.id, signedUrlRes.signedUrl);
  assert(downloaded.binary.toString() === docBufferV2.toString(), 'Downloaded document binary matches original upload');

  // Test 17: Tampered / Expired Signed URL Protection
  let tamperedUrlCaught = false;
  try {
    const tamperedUrl = signedUrlRes.signedUrl.replace('sig=', 'sig=tampered123');
    await documentService.downloadDocument(tenantAId, docV2.id, tamperedUrl);
  } catch (err: any) {
    tamperedUrlCaught = err.message.includes('Invalid or expired signed document URL');
  }
  assert(tamperedUrlCaught, 'Tampered signed URL rejected (ForbiddenException)');

  console.log('\n--- 4. NOTIFICATIONS & DELIVERY RELIABILITY TESTS ---');

  // Test 18: Successful Notification Delivery Tracking
  const notif1 = await notificationService.sendNotification({
    tenantId: tenantAId,
    userId: userPreparerId,
    channel: NotificationChannel.EMAIL,
    eventType: 'GST_RETURN_APPROVED',
    recipient: 'tax.manager@corp-alpha.in',
    payload: { returnType: 'GSTR1', periodKey: '092026' },
    idempotencyKey: 'idem-notif-1001',
    correlationId: 'corr-notif-001',
  });

  assert(notif1.status === NotificationStatus.DELIVERED, 'Notification delivered successfully to email adapter');

  // Test 19: Idempotency Guard (Duplicate event dispatch prevention)
  const notif1Duplicate = await notificationService.sendNotification({
    tenantId: tenantAId,
    userId: userPreparerId,
    channel: NotificationChannel.EMAIL,
    eventType: 'GST_RETURN_APPROVED',
    recipient: 'tax.manager@corp-alpha.in',
    payload: { returnType: 'GSTR1', periodKey: '092026' },
    idempotencyKey: 'idem-notif-1001', // Duplicate key
    correlationId: 'corr-notif-002',
  });

  assert(notif1Duplicate.id === notif1.id, 'Duplicate idempotency key returned original notification record without re-dispatch');

  // Test 20: Provider Failure & Transient Retry Tracking
  const failedNotif = await notificationService.sendNotification({
    tenantId: tenantAId,
    userId: userPreparerId,
    channel: NotificationChannel.WEBHOOK,
    eventType: 'E_INVOICE_GENERATED',
    recipient: 'https://erp.corp-alpha.in/fail-webhook',
    payload: { irn: '64charhexstring...' },
    idempotencyKey: 'idem-notif-1002',
    correlationId: 'corr-notif-003',
  });

  assert(failedNotif.status === NotificationStatus.RETRYING, 'Transient webhook failure set status to RETRYING');
  assert(failedNotif.attempts === 1, 'Delivery attempt count incremented to 1');
  assert(failedNotif.lastError!.includes('Connection Refused'), 'Provider failure error message recorded');

  // Test 21: Retry Engine & Dead-Letter Queue Threshold
  await notificationService.retryFailedNotifications(tenantAId); // Attempt 2
  const deadLetterNotif = await notificationService.retryFailedNotifications(tenantAId); // Attempt 3 -> Dead Letter

  const deadLetterRecord = await prisma.notificationRecord.findUnique({ where: { id: failedNotif.id } });
  assert(deadLetterRecord.status === NotificationStatus.DEAD_LETTER, 'Notification transitioned to DEAD_LETTER status after 3 failed attempts');

  // Test 22: Non-blocking Transaction Isolation (Failed notification does not roll back transaction)
  const safeRes = await notificationService.sendNotificationSafely({
    tenantId: tenantAId,
    channel: NotificationChannel.EMAIL,
    eventType: 'FINANCIAL_POSTING',
    recipient: 'invalid@invalid.domain',
    payload: {},
    idempotencyKey: 'idem-notif-safe-test',
    correlationId: 'corr-notif-safe',
  });

  assert(safeRes !== undefined, 'Financial transaction execution proceeded smoothly despite notification provider exception');

  console.log('\n-------------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('-------------------------------------------------------------------');
  if (passedCount === totalCount) {
    console.log('VERIFICATION RESULT: ALL STAGE 8 AUTOMATED TESTS PASSED 100%');
  } else {
    console.error('VERIFICATION RESULT: STAGE 8 VERIFICATION FAILED');
    process.exitCode = 1;
  }
}

runStage8VerificationSuite().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exitCode = 1;
});
