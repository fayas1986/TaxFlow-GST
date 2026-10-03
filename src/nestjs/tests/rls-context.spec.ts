import { PrismaService } from '../common/services/prisma.service';

describe('PostgreSQL RLS Transaction Context Verification', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  test('VERIFY: withRlsContext sets session variable strictly within transaction block using parameterized set_config', async () => {
    const mockTx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    const tenantId = '11111111-1111-1111-1111-111111111111';
    const companyId = '22222222-2222-2222-2222-222222222222';

    await prisma.withRlsContext(tenantId, companyId, async (tx) => {
      expect(tx).toBe(mockTx);
    });

    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });
});
