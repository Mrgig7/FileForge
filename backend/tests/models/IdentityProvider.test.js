// Mock mongoose entirely
jest.mock('mongoose', () => {
  const Schema = function(def, options) {
    this.def = def;
    this.options = options;
    this.methods = {};
    this.statics = {};
    this.virtuals = {};

    this.virtual = (name) => {
      const virt = {
        get: (fn) => { virt.getter = fn; return virt; },
        set: (fn) => { virt.setter = fn; return virt; }
      };
      this.virtuals[name] = virt;
      return virt;
    };

    this.pre = (event, fn) => {};
    this.index = (fields, options) => {};
  };

  Schema.Types = {
    ObjectId: 'ObjectId'
  };

  return {
    Schema: Schema,
    model: jest.fn((name, schema) => {
      return {
        ...schema.statics
      };
    })
  };
}, { virtual: true });

const IdentityProvider = require('../../models/IdentityProvider');

describe('IdentityProvider Model', () => {
  describe('Encryption', () => {
    it('should correctly encrypt and decrypt strings', () => {
      const secret = 'my-super-secret-string-123!@#';
      const encrypted = IdentityProvider.encrypt(secret);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(secret);
      expect(encrypted).toContain(':');

      const decrypted = IdentityProvider.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('should return null when encrypting null/undefined/empty string', () => {
      expect(IdentityProvider.encrypt(null)).toBeNull();
      expect(IdentityProvider.encrypt(undefined)).toBeNull();
      expect(IdentityProvider.encrypt('')).toBeNull();
    });

    it('should return the original input when decrypting falsy values', () => {
      expect(IdentityProvider.decrypt(null)).toBeNull();
      expect(IdentityProvider.decrypt(undefined)).toBeUndefined();
      expect(IdentityProvider.decrypt('')).toBe('');
    });

    it('should handle invalid format (missing colon) in decrypt by returning the original string', () => {
      const invalidText = 'not-encrypted-string';
      expect(IdentityProvider.decrypt(invalidText)).toBe(invalidText);
    });

    it('should handle invalid format (multiple colons) in decrypt by returning the original string', () => {
      const manyColons = 'too:many:colons:in:here';
      expect(IdentityProvider.decrypt(manyColons)).toBe(manyColons);
    });

    it('should handle correctly formatted strings but invalid hex data gracefully', () => {
      const invalidIvLength = '1234:5678';
      expect(IdentityProvider.decrypt(invalidIvLength)).toBe(invalidIvLength);
    });
  });
});
