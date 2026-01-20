/**
 * Encryption Service Tests
 * 
 * Run with: npm test -- --testPathPattern=encryption
 */

// Set up test encryption key before importing
process.env.METADATA_ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('base64');
process.env.METADATA_KEY_VERSION = '1';

const {
  encryptField,
  decryptField,
  decryptFieldAsObject,
  isEncryptionConfigured,
  getCurrentKeyVersion,
  reEncrypt,
  IV_LENGTH,
  AUTH_TAG_LENGTH
} = require('../services/encryptionService');

describe('Encryption Service', () => {
  
  describe('encryptField', () => {
    it('should encrypt a string and return proper structure', () => {
      const plaintext = 'sensitive data';
      const result = encryptField(plaintext);
      
      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('keyVersion');
      expect(result.keyVersion).toBe('1');
      
      // Verify base64 encoding
      expect(() => Buffer.from(result.ciphertext, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.authTag, 'base64')).not.toThrow();
      
      // Verify IV length
      expect(Buffer.from(result.iv, 'base64').length).toBe(IV_LENGTH);
      
      // Verify auth tag length
      expect(Buffer.from(result.authTag, 'base64').length).toBe(AUTH_TAG_LENGTH);
    });
    
    it('should encrypt objects by JSON stringifying', () => {
      const obj = { name: 'John', secret: 'password123' };
      const result = encryptField(obj);
      
      expect(result).toHaveProperty('ciphertext');
      
      // Should decrypt back to original object
      const decrypted = decryptFieldAsObject(result);
      expect(decrypted).toEqual(obj);
    });
    
    it('should return null for null input', () => {
      expect(encryptField(null)).toBeNull();
      expect(encryptField(undefined)).toBeNull();
    });
    
    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'same text';
      const result1 = encryptField(plaintext);
      const result2 = encryptField(plaintext);
      
      // Different IVs should produce different ciphertexts
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
    
    it('should encrypt empty string', () => {
      const result = encryptField('');
      expect(result).toHaveProperty('ciphertext');
      expect(decryptField(result)).toBe('');
    });
    
    it('should encrypt unicode characters', () => {
      const unicode = '🔐 Encrypted émojis & spëcial châräctérs 日本語';
      const result = encryptField(unicode);
      expect(decryptField(result)).toBe(unicode);
    });
    
    it('should encrypt large data', () => {
      const largeData = 'x'.repeat(100000);
      const result = encryptField(largeData);
      expect(decryptField(result)).toBe(largeData);
    });
  });
  
  describe('decryptField', () => {
    it('should correctly decrypt encrypted data', () => {
      const plaintext = 'my secret message';
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
    
    it('should return null for null/undefined payload', () => {
      expect(decryptField(null)).toBeNull();
      expect(decryptField(undefined)).toBeNull();
      expect(decryptField({})).toBeNull();
      expect(decryptField({ iv: 'x', authTag: 'y' })).toBeNull();
    });
  });
  
  describe('Tamper Detection (AuthTag)', () => {
    it('should detect modified ciphertext', () => {
      const encrypted = encryptField('original data');
      
      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from('tampered!!').toString('base64')
      };
      
      expect(() => decryptField(tampered)).toThrow('tampered');
    });
    
    it('should detect modified IV', () => {
      const encrypted = encryptField('original data');
      
      // Tamper with IV
      const tampered = {
        ...encrypted,
        iv: require('crypto').randomBytes(IV_LENGTH).toString('base64')
      };
      
      expect(() => decryptField(tampered)).toThrow('tampered');
    });
    
    it('should detect modified authTag', () => {
      const encrypted = encryptField('original data');
      
      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: require('crypto').randomBytes(AUTH_TAG_LENGTH).toString('base64')
      };
      
      expect(() => decryptField(tampered)).toThrow('tampered');
    });
  });
  
  describe('Key Versioning', () => {
    it('should use current key version', () => {
      const encrypted = encryptField('test');
      expect(encrypted.keyVersion).toBe(getCurrentKeyVersion());
    });
    
    it('should re-encrypt with new key version', () => {
      // Set up second key
      process.env.METADATA_ENCRYPTION_KEY_V2 = require('crypto').randomBytes(32).toString('base64');
      
      const original = encryptField('secret');
      expect(original.keyVersion).toBe('1');
      
      // Re-encrypt with new key
      const reEncrypted = reEncrypt(original, '2');
      expect(reEncrypted.keyVersion).toBe('2');
      
      // Both should decrypt to same value
      // Reset version for decryption
      process.env.METADATA_KEY_VERSION = '1';
      const decrypted1 = decryptField(original);
      
      process.env.METADATA_KEY_VERSION = '2';
      const decrypted2 = decryptField(reEncrypted);
      
      expect(decrypted1).toBe(decrypted2);
      
      // Cleanup
      process.env.METADATA_KEY_VERSION = '1';
    });
  });
  
  describe('isEncryptionConfigured', () => {
    it('should return true when key is configured', () => {
      expect(isEncryptionConfigured()).toBe(true);
    });
    
    it('should return false when key is missing', () => {
      const originalKey = process.env.METADATA_ENCRYPTION_KEY;
      delete process.env.METADATA_ENCRYPTION_KEY;
      
      expect(isEncryptionConfigured()).toBe(false);
      
      // Restore
      process.env.METADATA_ENCRYPTION_KEY = originalKey;
    });
  });
  
  describe('decryptFieldAsObject', () => {
    it('should parse JSON objects', () => {
      const obj = { a: 1, b: [2, 3], c: { nested: true } };
      const encrypted = encryptField(obj);
      const decrypted = decryptFieldAsObject(encrypted);
      
      expect(decrypted).toEqual(obj);
    });
    
    it('should return string if not valid JSON', () => {
      const str = 'not json';
      const encrypted = encryptField(str);
      const decrypted = decryptFieldAsObject(encrypted);
      
      expect(decrypted).toBe(str);
    });
  });
});

module.exports = {};
