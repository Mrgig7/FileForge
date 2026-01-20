/**
 * IdentityProvider Model
 * 
 * Stores SSO configuration for workspaces.
 * Supports OIDC (fully implemented) and SAML (interface only).
 * 
 * Security Notes:
 * - clientSecret is encrypted at rest using AES-256
 * - Issuer URL must be validated against allowlist
 * - Callback URLs are strictly validated
 * 
 * Threat Model:
 * - Token substitution: Mitigated by nonce/state validation
 * - IdP impersonation: Mitigated by issuer validation
 * - Replay attacks: Mitigated by short-lived tokens + nonce
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

// Encryption key for secrets (should be in env)
const ENCRYPTION_KEY = process.env.IDP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const identityProviderSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  // Provider type
  type: {
    type: String,
    enum: ['OIDC', 'SAML'],
    required: true
  },
  
  // Display name
  name: {
    type: String,
    default: 'SSO Provider'
  },
  
  // OIDC Configuration
  issuerUrl: { type: String },      // e.g., https://accounts.google.com
  clientId: { type: String },
  clientSecretEncrypted: { type: String },  // Encrypted
  discoveryUrl: { type: String },   // .well-known/openid-configuration
  
  // OIDC endpoints (auto-discovered or manual)
  authorizationEndpoint: { type: String },
  tokenEndpoint: { type: String },
  userInfoEndpoint: { type: String },
  jwksUri: { type: String },
  
  // SAML Configuration (interface only)
  // NEEDS CLARIFICATION: Full SAML requires xml-crypto, saml2-js packages
  metadataUrl: { type: String },
  entityId: { type: String },
  ssoUrl: { type: String },
  certificate: { type: String },
  
  // Scopes and claims
  scopes: {
    type: [String],
    default: ['openid', 'profile', 'email']
  },
  
  // Attribute mapping
  attributeMapping: {
    email: { type: String, default: 'email' },
    name: { type: String, default: 'name' },
    groups: { type: String, default: 'groups' }
  },
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'TESTING'],
    default: 'TESTING'
  },
  
  // Settings
  allowedDomains: [{ type: String }],  // Restrict to specific email domains
  autoProvision: { type: Boolean, default: true },  // Create user on first SSO login
  defaultRole: {
    type: String,
    enum: ['MEMBER', 'VIEWER'],
    default: 'MEMBER'
  },
  
  // Lifecycle
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Unique workspace per type
identityProviderSchema.index({ workspaceId: 1, type: 1 }, { unique: true });

// Virtual for decrypted secret
identityProviderSchema.virtual('clientSecret')
  .get(function() {
    return decrypt(this.clientSecretEncrypted);
  })
  .set(function(value) {
    this.clientSecretEncrypted = encrypt(value);
  });

// Pre-save
identityProviderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Methods
identityProviderSchema.methods.isActive = function() {
  return this.status === 'ACTIVE';
};

identityProviderSchema.methods.isOidc = function() {
  return this.type === 'OIDC';
};

identityProviderSchema.methods.getAuthorizationUrl = function({ state, nonce, redirectUri }) {
  if (!this.isOidc()) {
    throw new Error('Not an OIDC provider');
  }
  
  const params = new URLSearchParams({
    client_id: this.clientId,
    response_type: 'code',
    scope: this.scopes.join(' '),
    redirect_uri: redirectUri,
    state,
    nonce
  });
  
  return `${this.authorizationEndpoint}?${params.toString()}`;
};

identityProviderSchema.methods.toPublicObject = function() {
  return {
    id: this._id,
    type: this.type,
    name: this.name,
    issuerUrl: this.issuerUrl,
    status: this.status,
    scopes: this.scopes,
    autoProvision: this.autoProvision,
    defaultRole: this.defaultRole,
    createdAt: this.createdAt
  };
};

// Statics
identityProviderSchema.statics.findActiveForWorkspace = function(workspaceId) {
  return this.findOne({
    workspaceId,
    status: 'ACTIVE'
  });
};

identityProviderSchema.statics.encrypt = encrypt;
identityProviderSchema.statics.decrypt = decrypt;

module.exports = mongoose.model('IdentityProvider', identityProviderSchema);
