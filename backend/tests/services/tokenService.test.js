jest.mock('jsonwebtoken', () => {
  return {
    sign: jest.fn().mockImplementation((payload, secret, options) => {
      const header = { alg: 'HS256', typ: 'JWT' };
      const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      return `${encode(header)}.${encode(payload)}.mock_signature`;
    }),
    verify: jest.fn()
  };
}, { virtual: true });

jest.mock('../../models/RefreshToken', () => ({}), { virtual: true });
jest.mock('../../models/AuditLog', () => ({}), { virtual: true });
jest.mock('crypto', () => ({}), { virtual: true });

const jwt = require('jsonwebtoken');
const tokenService = require('../../services/tokenService');

describe('tokenService.generateAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate an access token with correct payload', () => {
    // The codebase version uses type: 'access' and stringifies _id.
    const user = {
      _id: { toString: () => '12345' },
      email: 'test@example.com',
      role: 'ADMIN'
    };

    const token = tokenService.generateAccessToken(user);

    expect(jwt.sign).toHaveBeenCalledTimes(1);
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: '12345',
        email: 'test@example.com',
        role: 'ADMIN',
        type: 'access'
      },
      expect.any(String),
      expect.objectContaining({
        expiresIn: expect.any(String),
        issuer: 'fileforge',
        audience: 'fileforge-api'
      })
    );

    // Verify the structure of returned mocked token
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Decode payload
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    expect(decodedPayload).toEqual(expect.objectContaining({
      sub: '12345',
      email: 'test@example.com',
      role: 'ADMIN',
      type: 'access'
    }));
  });

  it('should use default role USER if not provided', () => {
    const user = {
      _id: { toString: () => '67890' },
      email: 'user@example.com'
    };

    tokenService.generateAccessToken(user);

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'USER'
      }),
      expect.any(String),
      expect.any(Object)
    );
  });
});
