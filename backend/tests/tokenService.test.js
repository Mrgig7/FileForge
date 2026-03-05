jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  sign: jest.fn()
}), { virtual: true });

jest.mock('mongoose', () => {
  class MockSchema {
    constructor(schema, options) {
      this.paths = schema;
      this.options = options;
      this.statics = {};
      this.methods = {};
    }
    index() {}
    pre() {}
  }
  MockSchema.Types = {
    ObjectId: String
  };

  return {
    Schema: MockSchema,
    model: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    }),
    Types: {
        ObjectId: String
    }
  };
}, { virtual: true });

const tokenService = require('../services/tokenService');
const jwt = require('jsonwebtoken');

describe('tokenService', () => {
  describe('verifyAccessToken', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully verify a valid token', () => {
      const mockPayload = { sub: '123', email: 'test@test.com' };
      jwt.verify.mockReturnValue(mockPayload);

      const result = tokenService.verifyAccessToken('valid-token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-token',
        expect.any(String), // Secret
        expect.objectContaining({
          issuer: 'fileforge',
          audience: 'fileforge-api'
        })
      );
      expect(result).toBe(mockPayload);
    });

    it('should throw "Token expired" when jwt.verify throws TokenExpiredError', () => {
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      expect(() => {
        tokenService.verifyAccessToken('expired-token');
      }).toThrow('Token expired');
    });

    it('should throw "Invalid token" when jwt.verify throws any other error', () => {
      const genericError = new Error('jwt malformed');
      genericError.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw genericError;
      });

      expect(() => {
        tokenService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid token');
    });
  });
});
