import { jest } from '@jest/globals';

describe('tokenUtils', () => {
  let isTokenExpired, getTokenExpirationDate, clearAuthData;
  let consoleWarnSpy, consoleLogSpy, consoleErrorSpy;
  let originalAtob;

  beforeAll(async () => {
    // Dynamic import to support ES Modules in Jest in this setup
    const module = await import('./tokenUtils.js');
    isTokenExpired = module.isTokenExpired;
    getTokenExpirationDate = module.getTokenExpirationDate;
    clearAuthData = module.clearAuthData;

    originalAtob = global.atob;
  });

  afterAll(() => {
    if (originalAtob !== undefined) {
        global.atob = originalAtob;
    } else {
        delete global.atob;
    }
  });

  beforeEach(() => {
    // Mock global fetch, localStorage, etc if needed.
    // For this test, we need localStorage and atob mock for the Node environment.
    if (typeof global.atob === 'undefined' || global.atob === originalAtob) {
      global.atob = (str) => {
        if (str.includes('!')) {
           throw new Error('Invalid character in base64 string');
        }
        return Buffer.from(str, 'base64').toString('binary');
      };
    }

    if (typeof global.localStorage === 'undefined') {
      global.localStorage = {
        removeItem: jest.fn(),
      };
    } else {
      global.localStorage.removeItem = jest.fn();
    }

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAtob !== undefined) {
        global.atob = originalAtob;
    } else {
        delete global.atob;
    }
  });

  const createMockToken = (payload) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = 'mock_signature';
    return `${header}.${encodedPayload}.${signature}`;
  };

  describe('isTokenExpired', () => {
    it('should return true for null, undefined, and string literals', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
      expect(isTokenExpired('undefined')).toBe(true);
      expect(isTokenExpired('null')).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });

    it('should return true and warn for invalid token format', () => {
      expect(isTokenExpired('invalid.token')).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid JWT token format');
    });

    it('should return false and warn if token has no expiration time', () => {
      const token = createMockToken({ userId: 123 });
      expect(isTokenExpired(token)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Token does not have expiration time');
    });

    it('should return true for an expired token', () => {
      // Current time is roughly Math.floor(Date.now() / 1000)
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createMockToken({ exp: pastTime });

      expect(isTokenExpired(token)).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Token is expired:',
        expect.objectContaining({ exp: pastTime })
      );
    });

    it('should return false for an unexpired token', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createMockToken({ exp: futureTime });

      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true and log error if token payload cannot be decoded', () => {
      const token = 'header.invalid_base64_payload!.signature';
      expect(isTokenExpired(token)).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking token expiration:',
        expect.any(Error)
      );
    });
  });

  describe('getTokenExpirationDate', () => {
    it('should return null for null, undefined, and string literals', () => {
      expect(getTokenExpirationDate(null)).toBe(null);
      expect(getTokenExpirationDate(undefined)).toBe(null);
      expect(getTokenExpirationDate('undefined')).toBe(null);
      expect(getTokenExpirationDate('null')).toBe(null);
      expect(getTokenExpirationDate('')).toBe(null);
    });

    it('should return null for invalid token format', () => {
      expect(getTokenExpirationDate('invalid.token')).toBe(null);
    });

    it('should return null if token has no expiration time', () => {
      const token = createMockToken({ userId: 123 });
      expect(getTokenExpirationDate(token)).toBe(null);
    });

    it('should return formatted date string for valid token', () => {
      const expTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createMockToken({ exp: expTime });
      const expectedDate = new Date(expTime * 1000).toLocaleString();

      expect(getTokenExpirationDate(token)).toBe(expectedDate);
    });

    it('should return null and log error if token payload cannot be decoded', () => {
      const token = 'header.invalid_base64_payload!.signature';
      expect(getTokenExpirationDate(token)).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting token expiration date:',
        expect.any(Error)
      );
    });
  });

  describe('clearAuthData', () => {
    it('should remove token, userInfo, and profilePicUrl from localStorage', () => {
      clearAuthData();

      expect(global.localStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('userInfo');
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('profilePicUrl');

      expect(consoleLogSpy).toHaveBeenCalledWith('Cleared all authentication data from localStorage');
    });
  });
});
