jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  request: jest.fn(),
}));

import { request } from '../../src/api/client';
import { migrate } from '../../src/api/migrate';

const mockRequest = request as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('migrate', () => {
  it('forwards a 120s timeout so big payloads do not trip the default 30s', async () => {
    mockRequest.mockResolvedValue({ dishIdMap: {}, itemIdMap: {}, savedRecipeIdMap: {} });

    await migrate({ items: [], dishes: [], savedRecipes: [] });

    expect(mockRequest).toHaveBeenCalledWith(
      'post',
      '/api/migrate',
      { items: [], dishes: [], savedRecipes: [] },
      { timeout: 120000 },
    );
  });
});
