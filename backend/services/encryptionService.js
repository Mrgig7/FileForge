/**
 * Encryption Service
 * 
 * Field-level encryption using AES-256-GCM for sensitive metadata.
 * 
 * Security Design:
 * - AES-256-GCM: Authenticated encryption (confidentiality + integrity)
 * - Random 12-byte IV per encryption (NIST recommendation)
 * - 16-byte authentication tag for tamper detection
 * - Envelope encryption with master key from environment
 * - Key versioning for rotation readiness
 * 
 * Threat Model:
 * - Database breach: Encrypted data is unreadable without master key
 * - Tampering: AuthTag verification detects any modification
 * - Key compromise: Key versioning allows graceful rotation
 * 
 * Usage:
 *   const { encryptField, decryptField } = require('./encryptionService');
 *   const encrypted = encryptField('sensitive data');
 *   const decrypted = decryptField(encrypted);
 */

const crypto = require('crypto');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // 12 bytes = 96 bits (NIST recommendation for GCM)
const AUTH_TAG_LENGTH = 16;  // 16 bytes = 128 bits
const KEY_LENGTH = 32;       // 32 bytes = 256 bits for AES-256

// Get master key from environment
// Key should be base64-encoded 32-byte (256-bit) key
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function getMasterKey(version = null) {
  const keyVersion = version || process.env.METADATA_KEY_VERSION || '1';
  
  // Support multiple key versions: METADATA_ENCRYPTION_KEY, METADATA_ENCRYPTION_KEY_V2, etc.
  const envKey = keyVersion === '1' 
    ? process.env.METADATA_ENCRYPTION_KEY
    : process.env[`METADATA_ENCRYPTION_KEY_V${keyVersion}`];
  
  if (!envKey) {
    // In development, return null to indicate encryption not configured
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    throw new Error(`Encryption key not configured for version ${keyVersion}`);
  }
  
  const key = Buffer.from(envKey, 'base64');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  
  return key;
}

/**
 * Encrypt a plaintext string or object
 * 
 * @param {string|object} plaintext - Data to encrypt (objects will be JSON stringified)
 * @returns {object|null} Encrypted payload { ciphertext, iv, authTag, keyVersion } or null if not configured
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }
  
  const keyVersion = process.env.METADATA_KEY_VERSION || '1';
  const key = getMasterKey(keyVersion);
  
  // If encryption not configured, return null (for dev environments)
  if (!key) {
    console.warn('Encryption not configured, storing plaintext');
    return null;
  }
  
  // Convert object to string if needed
  const plaintextStr = typeof plaintext === 'object' 
    ? JSON.stringify(plaintext) 
    : String(plaintext);
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  // Encrypt
  let ciphertext = cipher.update(plaintextStr, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion
  };
}

/**
 * Decrypt an encrypted payload
 * 
 * @param {object} payload - { ciphertext, iv, authTag, keyVersion }
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails or data has been tampered with
 */
function decryptField(payload) {
  if (!payload || !payload.ciphertext) {
    return null;
  }
  
  const { ciphertext, iv, authTag, keyVersion } = payload;
  
  // Get key for the version used to encrypt
  const key = getMasterKey(keyVersion || '1');
  
  if (!key) {
    throw new Error('Encryption key not available for decryption');
  }
  
  // Create decipher
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    key, 
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  
  // Set auth tag for verification
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  // Decrypt
  try {
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (error) {
    if (error.message.includes('Unsupported state') || error.message.includes('auth')) {
      throw new Error('Decryption failed: data may have been tampered with');
    }
    throw error;
  }
}

/**
 * Decrypt and parse as JSON
 * 
 * @param {object} payload - Encrypted payload
 * @returns {object|null} Parsed JSON object or null
 */
function decryptFieldAsObject(payload) {
  const decrypted = decryptField(payload);
  if (!decrypted) return null;
  
  try {
    return JSON.parse(decrypted);
  } catch {
    // Not JSON, return as string
    return decrypted;
  }
}

/**
 * Check if encryption is configured and operational
 * 
 * @returns {boolean}
 */
function isEncryptionConfigured() {
  try {
    const key = getMasterKey();
    return key !== null;
  } catch {
    return false;
  }
}

/**
 * Get current key version
 * 
 * @returns {string}
 */
function getCurrentKeyVersion() {
  return process.env.METADATA_KEY_VERSION || '1';
}

/**
 * Re-encrypt data with new key version
 * Used during key rotation to migrate existing encrypted data
 * 
 * @param {object} oldPayload - Old encrypted payload
 * @param {string} newKeyVersion - New key version to encrypt with
 * @returns {object} New encrypted payload
 */
function reEncrypt(oldPayload, newKeyVersion) {
  // Decrypt with old key
  const plaintext = decryptField(oldPayload);
  
  // Save current version temporarily
  const currentVersion = process.env.METADATA_KEY_VERSION;
  
  // Set new version for encryption
  process.env.METADATA_KEY_VERSION = newKeyVersion;
  
  // Encrypt with new key
  const newPayload = encryptField(plaintext);
  
  // Restore original version
  process.env.METADATA_KEY_VERSION = currentVersion;
  
  return newPayload;
}

/**
 * Mongoose schema type for encrypted fields
 * Can be used in schemas as: { type: EncryptedFieldSchema }
 */
const EncryptedFieldSchema = {
  ciphertext: { type: String },
  iv: { type: String },
  authTag: { type: String },
  keyVersion: { type: String, default: '1' }
};

module.exports = {
  encryptField,
  decryptField,
  decryptFieldAsObject,
  isEncryptionConfigured,
  getCurrentKeyVersion,
  reEncrypt,
  EncryptedFieldSchema,
  // Constants for testing
  ALGORITHM,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  KEY_LENGTH
};
