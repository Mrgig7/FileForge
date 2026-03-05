const crypto = require('crypto');

// Mock ioredis since it's not needed for generateETag and missing in offline environment
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
  });
}, { virtual: true });

const { generateETag } = require('../services/cacheService');

describe('cacheService', () => {
  describe('generateETag', () => {
    it('should generate an MD5 hash for a string', () => {
      const data = 'test string';
      const expectedHash = crypto.createHash('md5').update(data).digest('hex');
      const expectedETag = expectedHash;

      const etag = generateETag(data);
      expect(etag).toBe(expectedETag);
    });

    it('should generate an MD5 hash for an object', () => {
      const data = { key: 'value', number: 123 };
      const expectedHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      const expectedETag = expectedHash;

      const etag = generateETag(data);
      expect(etag).toBe(expectedETag);
    });

    it('should generate deterministic hashes for the same string input', () => {
      const data1 = 'consistent';
      const data2 = 'consistent';

      expect(generateETag(data1)).toBe(generateETag(data2));
    });

    it('should generate deterministic hashes for the same object input', () => {
      const data1 = { a: 1, b: 'two' };
      const data2 = { a: 1, b: 'two' };

      expect(generateETag(data1)).toBe(generateETag(data2));
    });

    it('should generate different hashes for different inputs', () => {
      const data1 = 'string 1';
      const data2 = 'string 2';

      expect(generateETag(data1)).not.toBe(generateETag(data2));
    });

    it('should handle empty strings', () => {
      const data = '';
      const expectedHash = crypto.createHash('md5').update(data).digest('hex');
      const expectedETag = expectedHash;

      const etag = generateETag(data);
      expect(etag).toBe(expectedETag);
    });

    it('should handle null by treating it as an object (JSON.stringify)', () => {
      const data = null;
      const expectedHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');

      const etag = generateETag(data);
      expect(etag).toBe(expectedHash);
    });

    it('should handle arrays correctly', () => {
      const data = [1, 2, 3];
      const expectedHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');

      const etag = generateETag(data);
      expect(etag).toBe(expectedHash);
    });
  });
});
