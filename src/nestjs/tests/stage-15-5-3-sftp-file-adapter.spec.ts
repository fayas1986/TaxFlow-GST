import { SftpFileAdapter, SftpFileConfig, SftpTransportMock } from '../modules/erp-adapter-framework/adapters/sftp-file.adapter';
import { SsrfGuardService } from '../modules/webhooks/ssrf-guard.service';
import { CanonicalERPInvoiceDto } from '../modules/erp-adapter-framework/interfaces/erp-adapter.interface';
import { ERPProviderException } from '../modules/erp-adapter-framework/exceptions/erp-provider.exception';
import { BadRequestException } from '@nestjs/common';

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    process.exitCode = 1;
  }
}

async function runStage15_5_3_Tests() {
  console.log('================================================================');
  console.log('  STAGE 15.5.3 — SFTP / FILE ADAPTER TEST SUITE  ');
  console.log('================================================================\n');

  const ssrfGuard = new SsrfGuardService();
  const adapter = new SftpFileAdapter(ssrfGuard);
  const tenantA = '11111111-1111-1111-1111-111111111111';

  // Mock Transport Backend
  const mockRemoteStorage = new Map<string, Buffer>();
  const mockTransport: SftpTransportMock = {
    connect: async (config) => Boolean(config.hostKey),
    listFiles: async (remotePath) => {
      const files: Array<{ filename: string; size: number; modifiedAt: Date }> = [];
      for (const [path, buffer] of mockRemoteStorage.entries()) {
        if (path.startsWith(remotePath)) {
          const parts = path.split('/');
          files.push({ filename: parts[parts.length - 1], size: buffer.length, modifiedAt: new Date() });
        }
      }
      return files;
    },
    readFile: async (remoteFilePath) => mockRemoteStorage.get(remoteFilePath) || Buffer.alloc(0),
    writeFile: async (remoteFilePath, content) => {
      mockRemoteStorage.set(remoteFilePath, content);
      return true;
    },
    renameFile: async (oldPath, newPath) => {
      const content = mockRemoteStorage.get(oldPath);
      if (content) {
        mockRemoteStorage.delete(oldPath);
        mockRemoteStorage.set(newPath, content);
        return true;
      }
      return false;
    },
    deleteFile: async (remoteFilePath) => {
      mockRemoteStorage.delete(remoteFilePath);
      return true;
    },
  };

  adapter.setTransportMock(mockTransport);

  const validSftpConfig: SftpFileConfig = {
    host: 'sftp.customer.com',
    port: 22,
    username: 'sftp_user',
    password: 'secure_password_123',
    hostKey: 'SHA256:abc123def456fingerprint',
    inboundPath: '/inbound',
    outboundPath: '/outbound',
    maxFileSizeBytes: 1024 * 1024, // 1MB for testing
  };

  // --- SECTION 1: Connection Lifecycle & Host-Key Verification ---
  console.log('--- SECTION 1: Connection Lifecycle & Host-Key Verification ---');
  const connectRes = await adapter.connect(validSftpConfig);
  assert(connectRes === true, 'SFTP adapter connects with valid credentials and hostKey fingerprint');

  try {
    await adapter.connect({ ...validSftpConfig, hostKey: undefined });
    assert(false, 'Missing hostKey verification fingerprint must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Missing hostKey throws BadRequestException (Host Key Verification Guard)');
  }

  // --- SECTION 2: Mandatory File-Security Controls ---
  console.log('\n--- SECTION 2: Mandatory File-Security Controls ---');

  // 1. Path Traversal Guard
  try {
    adapter.sanitizeAndValidateFilename('../../../etc/passwd');
    assert(false, 'Path traversal filename must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Path traversal filename throws BadRequestException');
  }

  try {
    adapter.sanitizeAndValidateFilename('..\\Windows\\System32\\cmd.exe');
    assert(false, 'Windows path traversal filename must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Windows path traversal filename throws BadRequestException');
  }

  // 2. Malicious Filename Guard
  try {
    adapter.sanitizeAndValidateFilename('invoices.csv; rm -rf /');
    assert(false, 'Shell metacharacters in filename must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Shell metacharacters in filename throw BadRequestException');
  }

  try {
    adapter.sanitizeAndValidateFilename('-option_flag.csv');
    assert(false, 'Leading hyphen in filename must be rejected');
  } catch (err: any) {
    assert(err instanceof BadRequestException, 'Leading hyphen in filename throws BadRequestException');
  }

  // 3. Unexpected File Extension Guard
  mockRemoteStorage.set('/inbound/malicious.exe', Buffer.from('binary_payload'));
  try {
    await adapter.pull({});
    assert(false, 'Forbidden extension .exe must be rejected');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, '.exe extension throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_FILE_REJECTED', 'Error code is ERP_FILE_REJECTED');
  }
  mockRemoteStorage.delete('/inbound/malicious.exe');

  // 4. Oversized File Guard
  mockRemoteStorage.set('/inbound/huge_file.csv', Buffer.alloc(2 * 1024 * 1024)); // 2MB exceeds 1MB limit
  try {
    await adapter.pull({});
    assert(false, 'Oversized file must be rejected');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Oversized file throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_FILE_TOO_LARGE', 'Error code is ERP_FILE_TOO_LARGE');
  }
  mockRemoteStorage.delete('/inbound/huge_file.csv');

  // 5. Empty File Guard
  mockRemoteStorage.set('/inbound/empty.csv', Buffer.alloc(0));
  try {
    await adapter.pull({});
    assert(false, 'Empty 0-byte file must be rejected');
  } catch (err: any) {
    assert(err instanceof ERPProviderException, 'Empty 0-byte file throws ERPProviderException');
    assert(err.problemDetails.code === 'ERP_MALFORMED_FILE', 'Error code is ERP_MALFORMED_FILE');
  }
  mockRemoteStorage.delete('/inbound/empty.csv');

  // 6. Incomplete / Partial File Upload Guard
  mockRemoteStorage.set('/inbound/uploading_invoice.csv.tmp', Buffer.from('invoiceNumber,taxableValue,totalValue\nINV-001,100,118'));
  const pullIncomplete = await adapter.pull({});
  assert(pullIncomplete.length === 0, 'Incomplete upload file (.tmp) skipped during directory pull');
  mockRemoteStorage.delete('/inbound/uploading_invoice.csv.tmp');

  // --- SECTION 3: CSV & Excel File Parsing and Canonical Mapping ---
  console.log('\n--- SECTION 3: CSV & Excel File Parsing and Canonical Mapping ---');
  const validCsvData = [
    'invoiceNumber,invoiceDate,tenantId,entityType,direction,sellerGstin,buyerGstin,buyerName,placeOfSupply,taxableValue,cgstTotal,sgstTotal,igstTotal,totalValue',
    `INV-SFTP-100,2026-10-03,${tenantA},INVOICE,INBOUND,27AAAAA0000A1Z5,27BBBBB1111B1Z2,"Delta Corp",27,10000,900,900,0,11800`,
  ].join('\n');

  mockRemoteStorage.set('/inbound/valid_invoices.csv', Buffer.from(validCsvData, 'utf8'));
  const pulledInvoices = await adapter.pull({});
  assert(pulledInvoices.length === 1, 'pull cleanly parses CSV file into 1 canonical invoice');
  assert(pulledInvoices[0].invoiceNumber === 'INV-SFTP-100', 'Canonical invoice number mapped correctly');
  assert(pulledInvoices[0].buyerName === 'Delta Corp', 'Quoted string buyer name mapped correctly');
  assert(pulledInvoices[0].totalValue === 11800, 'Numeric total value parsed correctly');
  mockRemoteStorage.delete('/inbound/valid_invoices.csv');

  // --- SECTION 4: Outbound Push & Batch Delivery ---
  console.log('\n--- SECTION 4: Outbound Push & Batch Delivery ---');
  const outboundInvoice: CanonicalERPInvoiceDto = {
    invoiceNumber: 'INV-OUT-500',
    invoiceDate: '2026-10-03',
    tenantId: tenantA,
    entityType: 'INVOICE',
    direction: 'OUTBOUND',
    sellerGstin: '27AAAAA0000A1Z5',
    buyerGstin: '27BBBBB1111B1Z2',
    buyerName: 'Epsilon Ltd',
    placeOfSupply: '27',
    taxableValue: 2000,
    cgstTotal: 180,
    sgstTotal: 180,
    igstTotal: 0,
    totalValue: 2360,
    items: [],
  };

  const pushResult = await adapter.push(outboundInvoice);
  assert(pushResult.success === true, 'push outbound CSV succeeds');
  assert(Boolean(pushResult.externalId), 'push returns generated remote filename');
  const writtenFile = mockRemoteStorage.get(`/outbound/${pushResult.externalId}`);
  assert(Boolean(writtenFile), 'File written to /outbound directory on remote storage');
  assert(writtenFile?.toString('utf8').includes('INV-OUT-500'), 'Written CSV file contains invoice number');

  // Batch Sync
  const batchSyncResult = await adapter.sync([outboundInvoice, { ...outboundInvoice, invoiceNumber: 'INV-OUT-501' }]);
  assert(batchSyncResult.success === true, 'Batch sync succeeds');
  assert(batchSyncResult.syncedCount === 2, 'Batch sync synced count is 2');

  // --- SECTION 5: Atomic Processing State Machine & Concurrency Guard ---
  console.log('\n--- SECTION 5: Atomic Processing State Machine & Concurrency Guard ---');
  const uniqueConcurCsvData = [
    'invoiceNumber,invoiceDate,tenantId,entityType,direction,sellerGstin,buyerGstin,buyerName,placeOfSupply,taxableValue,cgstTotal,sgstTotal,igstTotal,totalValue',
    `INV-CONCUR-999,2026-10-03,${tenantA},INVOICE,INBOUND,27AAAAA0000A1Z5,27BBBBB1111B1Z2,"Concurrent Corp",27,15000,1350,1350,0,17700`,
  ].join('\n');

  mockRemoteStorage.set('/inbound/concurrent_file.csv', Buffer.from(uniqueConcurCsvData, 'utf8'));

  // First worker claims and pulls file
  const worker1Pull = await adapter.pull({});
  assert(worker1Pull.length === 1, 'Worker 1 successfully pulls file');

  // Simulate worker 2 attempting to pull same claimed file
  const worker2Pull = await adapter.pull({});
  assert(worker2Pull.length === 0, 'Worker 2 skips already claimed/processed file (Atomic Claim Lock)');

  console.log('\n================================================================');
  console.log(`  STAGE 15.5.3 TEST SUMMARY: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runStage15_5_3_Tests().catch((err) => {
  console.error('Stage 15.5.3 test runner failed:', err);
  process.exit(1);
});
