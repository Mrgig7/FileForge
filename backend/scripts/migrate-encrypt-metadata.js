/**
 * Migration Script: Encrypt Sensitive Metadata
 * 
 * Migrates existing plaintext metadata to encrypted format.
 * 
 * Usage:
 *   # Dry run (no changes)
 *   node scripts/migrate-encrypt-metadata.js --dry-run
 *   
 *   # Execute migration
 *   node scripts/migrate-encrypt-metadata.js
 *   
 *   # Rollback (if needed)
 *   node scripts/migrate-encrypt-metadata.js --rollback
 * 
 * Environment:
 *   METADATA_ENCRYPTION_KEY - Required for encryption
 *   MONGO_CONNECTION_URL - Database connection
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { encryptField, decryptField, isEncryptionConfigured } = require('../services/encryptionService');

// Models that may contain sensitive metadata
const AuditLog = require('../models/AuditLog');
const ShareLink = require('../models/ShareLink');

// Configuration
const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes('--dry-run');
const ROLLBACK = process.argv.includes('--rollback');

// Fields to encrypt/decrypt by model
const ENCRYPTION_CONFIG = {
  AuditLog: {
    // Only encrypt specific metadata fields that contain sensitive info
    // We do NOT encrypt action, userId, timestamp, hash as they're needed for queries
    fields: [
      { path: 'metadata.sensitiveData', type: 'object' }
    ],
    // Marker field to track migration status
    migratedField: '_encryptionMigrated'
  },
  ShareLink: {
    // accessLog contains IP addresses - optional encryption
    fields: [
      { path: 'accessLog', type: 'array' }
    ],
    migratedField: '_encryptionMigrated'
  }
};

async function connectDB() {
  const mongoUrl = process.env.MONGO_CONNECTION_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_CONNECTION_URL not set');
  }
  
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');
}

async function migrateModel(Model, modelName, config) {
  console.log(`\n=== Migrating ${modelName} ===`);
  
  const query = ROLLBACK
    ? { [config.migratedField]: true }
    : { [config.migratedField]: { $ne: true } };
  
  const total = await Model.countDocuments(query);
  console.log(`Found ${total} documents to ${ROLLBACK ? 'rollback' : 'migrate'}`);
  
  if (total === 0) return { migrated: 0, errors: 0 };
  
  let migrated = 0;
  let errors = 0;
  let processed = 0;
  
  const cursor = Model.find(query).cursor();
  
  for await (const doc of cursor) {
    try {
      let modified = false;
      
      for (const field of config.fields) {
        const value = getNestedValue(doc, field.path);
        
        if (value === undefined || value === null) continue;
        
        if (ROLLBACK) {
          // Decrypt if it's an encrypted payload
          if (value && typeof value === 'object' && value.ciphertext) {
            const decrypted = decryptField(value);
            setNestedValue(doc, field.path, field.type === 'object' ? JSON.parse(decrypted) : decrypted);
            modified = true;
          }
        } else {
          // Encrypt if not already encrypted
          if (!value.ciphertext) {
            const encrypted = encryptField(value);
            if (encrypted) {
              setNestedValue(doc, field.path, encrypted);
              modified = true;
            }
          }
        }
      }
      
      if (modified) {
        doc[config.migratedField] = !ROLLBACK;
        doc.markModified(config.migratedField);
        
        if (!DRY_RUN) {
          await doc.save();
        }
        migrated++;
      }
      
      processed++;
      if (processed % BATCH_SIZE === 0) {
        console.log(`  Progress: ${processed}/${total} (${migrated} ${ROLLBACK ? 'rolled back' : 'migrated'})`);
      }
      
    } catch (error) {
      console.error(`  Error processing ${doc._id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`  Completed: ${migrated} ${ROLLBACK ? 'rolled back' : 'migrated'}, ${errors} errors`);
  return { migrated, errors };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr && curr[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  parent[last] = value;
}

async function main() {
  console.log('=== Metadata Encryption Migration ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : ROLLBACK ? 'ROLLBACK' : 'MIGRATE'}`);
  
  if (!ROLLBACK && !isEncryptionConfigured()) {
    console.error('ERROR: Encryption not configured. Set METADATA_ENCRYPTION_KEY.');
    process.exit(1);
  }
  
  try {
    await connectDB();
    
    const results = {};
    
    // Migrate AuditLog
    results.AuditLog = await migrateModel(AuditLog, 'AuditLog', ENCRYPTION_CONFIG.AuditLog);
    
    // Migrate ShareLink
    results.ShareLink = await migrateModel(ShareLink, 'ShareLink', ENCRYPTION_CONFIG.ShareLink);
    
    console.log('\n=== Summary ===');
    console.log(JSON.stringify(results, null, 2));
    
    if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to apply changes.');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();
