const { getClientIp } = require('../../middleware/rateLimitMiddleware');

// Mock external dependencies to avoid real connections during testing
jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: class {},
  RateLimiterMemory: class {}
}), { virtual: true });

jest.mock('ioredis', () => {
  return class Redis {
    constructor() {
      // Stub
    }
  };
}, { virtual: true });

jest.mock('../../models/SecurityEvent', () => ({
  logBruteForce: jest.fn()
}), { virtual: true });

describe('rateLimitMiddleware - getClientIp', () => {
  let req;

  beforeEach(() => {
    // Reset the request object before each test
    req = {
      headers: {},
      connection: {}
    };
  });

  it('should return req.ip if present', () => {
    req.ip = '192.168.1.1';
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('should return the first IP from x-forwarded-for header', () => {
    req.headers['x-forwarded-for'] = '203.0.113.195';
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  it('should return the first IP and trim whitespace from x-forwarded-for header with multiple IPs', () => {
    req.headers['x-forwarded-for'] = ' 203.0.113.195 , 198.51.100.1, 192.0.2.1';
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  it('should return req.connection.remoteAddress if req.ip and x-forwarded-for are not present', () => {
    req.connection.remoteAddress = '10.0.0.1';
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('should return "unknown" if no IP information is available', () => {
    expect(getClientIp(req)).toBe('unknown');
  });
});
