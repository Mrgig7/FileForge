import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTokenExpired, getTokenExpirationDate, clearAuthData } from '../../utils/tokenUtils';

describe('tokenUtils', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Spy on console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock localStorage
    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
          store[key] = value.toString();
        }),
        removeItem: vi.fn((key) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      };
    })();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createToken = (payload) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = 'fake-signature';
    return `${header}.${encodedPayload}.${signature}`;
  };

  describe('isTokenExpired', () => {
    it('returns true for missing or null/undefined strings', () => {
      expect(isTokenExpired()).toBe(true);
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired('undefined')).toBe(true);
      expect(isTokenExpired('null')).toBe(true);
    });

    it('returns true for malformed tokens', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
      expect(console.warn).toHaveBeenCalledWith('Invalid JWT token format');
    });

    it('returns true if token decoding fails', () => {
      expect(isTokenExpired('header.invalid_base64.sig')).toBe(true);
      expect(console.error).toHaveBeenCalled();
    });

    it('returns false for tokens without an expiration time', () => {
      const token = createToken({ userId: 123 });
      expect(isTokenExpired(token)).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('Token does not have expiration time');
    });

    it('returns false for tokens that expire in the future', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createToken({ userId: 123, exp: futureTime });
      expect(isTokenExpired(token)).toBe(false);
    });

    it('returns true for tokens that have already expired', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createToken({ userId: 123, exp: pastTime });
      expect(isTokenExpired(token)).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Token is expired:'),
        expect.any(Object)
      );
    });
  });

  describe('getTokenExpirationDate', () => {
    it('returns null for missing or null/undefined strings', () => {
      expect(getTokenExpirationDate()).toBeNull();
      expect(getTokenExpirationDate(null)).toBeNull();
      expect(getTokenExpirationDate('undefined')).toBeNull();
      expect(getTokenExpirationDate('null')).toBeNull();
    });

    it('returns null for malformed tokens', () => {
      expect(getTokenExpirationDate('invalid-token')).toBeNull();
    });

    it('returns null if token decoding fails', () => {
      expect(getTokenExpirationDate('header.invalid_base64.sig')).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('returns null for tokens without an expiration time', () => {
      const token = createToken({ userId: 123 });
      expect(getTokenExpirationDate(token)).toBeNull();
    });

    it('returns a formatted date string for tokens with an expiration time', () => {
      const timeInSeconds = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createToken({ userId: 123, exp: timeInSeconds });
      const expectedDate = new Date(timeInSeconds * 1000).toLocaleString();
      expect(getTokenExpirationDate(token)).toBe(expectedDate);
    });
  });

  describe('clearAuthData', () => {
    it('removes authentication data from localStorage', () => {
      // Setup some dummy data in localStorage
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userInfo', JSON.stringify({ name: 'User' }));
      localStorage.setItem('profilePicUrl', 'http://example.com/pic.jpg');

      clearAuthData();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('userInfo');
      expect(localStorage.removeItem).toHaveBeenCalledWith('profilePicUrl');
      expect(console.log).toHaveBeenCalledWith('Cleared all authentication data from localStorage');
    });
  });
});
