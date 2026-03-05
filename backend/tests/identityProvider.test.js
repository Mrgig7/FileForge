jest.mock('mongoose', () => {
  const Schema = function(def) {
    this.obj = def;
    this.methods = {};
    this.statics = {};
    this.virtuals = {};
    this.index = jest.fn();
    this.virtual = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    });
    this.pre = jest.fn();
  };
  Schema.Types = {
    ObjectId: String
  };
  return {
    Schema,
    model: jest.fn((name, schema) => {
      // Return a mock model with statics
      return {
        ...schema.statics,
        schema
      };
    })
  };
}, { virtual: true });

const IdentityProvider = require('../models/IdentityProvider');

describe('IdentityProvider Model - Encryption', () => {
  const testString = 'super-secret-password-123!';

  describe('encrypt', () => {
    it('should return null for empty or null inputs', () => {
      expect(IdentityProvider.encrypt(null)).toBeNull();
      expect(IdentityProvider.encrypt(undefined)).toBeNull();
      expect(IdentityProvider.encrypt('')).toBeNull();
    });

    it('should encrypt a string into the correct format (iv:ciphertext)', () => {
      const encrypted = IdentityProvider.encrypt(testString);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':');

      const parts = encrypted.split(':');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBeTruthy(); // IV
      expect(parts[1]).toBeTruthy(); // Ciphertext
    });

    it('should produce different outputs for the same input due to random IV', () => {
      const encrypted1 = IdentityProvider.encrypt(testString);
      const encrypted2 = IdentityProvider.encrypt(testString);

      expect(encrypted1).not.toBe(encrypted2);

      // The IV parts should be different
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      expect(iv1).not.toBe(iv2);
    });
  });

  describe('decrypt', () => {
    it('should return null for empty or null inputs', () => {
      expect(IdentityProvider.decrypt(null)).toBeNull();
      expect(IdentityProvider.decrypt(undefined)).toBeNull();
      expect(IdentityProvider.decrypt('')).toBeNull();
    });

    it('should correctly decrypt an encrypted string back to the original text', () => {
      const encrypted = IdentityProvider.encrypt(testString);
      const decrypted = IdentityProvider.decrypt(encrypted);

      expect(decrypted).toBe(testString);
    });
  });
});
