// Mock rate-limiter-flexible to prevent missing module errors
jest.mock('rate-limiter-flexible', () => {
  return {
    RateLimiterRedis: jest.fn(),
    RateLimiterMemory: jest.fn()
  };
}, { virtual: true });

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn()
    };
  });
}, { virtual: true });

// Mock SecurityEvent model
jest.mock('../../models/SecurityEvent', () => {
  return {
    logBruteForce: jest.fn().mockResolvedValue()
  };
}, { virtual: true });

const { getClientIp } = require('../../middleware/rateLimitMiddleware');

describe('rateLimitMiddleware - getClientIp', () => {
  it('should return ip from req.ip if available and no x-forwarded-for', () => {
    const req = {
      ip: '192.168.1.1',
      headers: {},
      connection: {}
    };
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('should prioritize req.ip over x-forwarded-for header', () => {
    const req = {
      ip: '192.168.1.1',
      headers: {
        'x-forwarded-for': '10.0.0.1'
      },
      connection: {}
    };
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('should return ip from x-forwarded-for header if req.ip is not available', () => {
    const req = {
      headers: {
        'x-forwarded-for': '10.0.0.1'
      },
      connection: {}
    };
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('should return first ip from x-forwarded-for header list', () => {
    const req = {
      headers: {
        'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3'
      },
      connection: {}
    };
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('should return trimmed first ip from x-forwarded-for header list', () => {
    const req = {
      headers: {
        'x-forwarded-for': '  10.0.0.1 , 10.0.0.2'
      },
      connection: {}
    };
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('should return ip from req.connection.remoteAddress if others are not available', () => {
    const req = {
      headers: {},
      connection: {
        remoteAddress: '172.16.0.1'
      }
    };
    expect(getClientIp(req)).toBe('172.16.0.1');
  });

  it('should return unknown if no IP is available', () => {
    const req = {
      headers: {},
      connection: {}
    };
    expect(getClientIp(req)).toBe('unknown');
  });
});
