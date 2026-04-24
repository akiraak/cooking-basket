import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSystemInfo } from '../../src/services/admin-service';
import { setupTestDatabase } from '../helpers/db';

setupTestDatabase();

describe('admin-service / getSystemInfo deployedAt', () => {
  const prev = process.env.DEPLOYED_AT;

  beforeEach(() => {
    delete process.env.DEPLOYED_AT;
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.DEPLOYED_AT;
    } else {
      process.env.DEPLOYED_AT = prev;
    }
  });

  it('returns null when DEPLOYED_AT is unset', () => {
    expect(getSystemInfo().deployedAt).toBeNull();
  });

  it('returns the raw ISO 8601 string as-is when DEPLOYED_AT is valid', () => {
    process.env.DEPLOYED_AT = '2026-04-24T12:34:56+09:00';
    expect(getSystemInfo().deployedAt).toBe('2026-04-24T12:34:56+09:00');
  });

  it('returns null when DEPLOYED_AT is not a valid date', () => {
    process.env.DEPLOYED_AT = 'not-a-date';
    expect(getSystemInfo().deployedAt).toBeNull();
  });
});
