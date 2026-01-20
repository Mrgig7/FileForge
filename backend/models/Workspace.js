/**
 * Workspace Model
 * 
 * Represents an organization/team workspace.
 * Files and shares can belong to a workspace for team collaboration.
 * 
 * Security Notes:
 * - All workspace operations require membership verification
 * - Owner cannot be removed (must transfer ownership first)
 * - Workspace deletion is soft-delete to preserve audit trail
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const workspaceSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    maxlength: [100, 'Workspace name cannot exceed 100 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  
  description: {
    type: String,
    maxlength: 500
  },
  
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Workspace settings
  settings: {
    // Default sharing restrictions
    defaultShareExpiry: { type: Number, default: 30 },
    allowPublicShares: { type: Boolean, default: true },
    allowExternalShares: { type: Boolean, default: true },
    requireLoginForDownload: { type: Boolean, default: false },
    
    // Domain restrictions
    allowedEmailDomains: [{ type: String }],
    
    // Branding
    logoUrl: { type: String },
    primaryColor: { type: String },
    
    enforceSso: { type: Boolean, default: false },
    
    lockdownMode: { type: Boolean, default: false },
    lockdownAt: { type: Date },
    lockdownBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockdownReason: { type: String },
    
    retentionDays: { type: Number, default: null },
    
    breakGlassEnabled: { type: Boolean, default: false },
    breakGlassAdminIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    
    maxSessionsPerUser: { type: Number, default: null },
    requireTrustedDevice: { type: Boolean, default: false }
  },
  
  dlpPolicy: {
    enabled: { type: Boolean, default: false },
    blockExternalSharing: { type: Boolean, default: false },
    requirePasswordForConfidential: { type: Boolean, default: false },
    watermarkConfidentialDownloads: { type: Boolean, default: false },
    restrictDomains: [{ type: String }],
    disablePublicLinksForRestricted: { type: Boolean, default: true },
    maxDownloadsPerDay: { type: Number, default: null },
    requireMfaForRestricted: { type: Boolean, default: false }
  },
  
  // Plan/subscription reference
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  
  // Quota tracking
  storageUsed: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 1024 * 1024 * 1024 },  // 1GB default
  memberCount: { type: Number, default: 1 },
  memberLimit: { type: Number, default: 5 },
  
  // Lifecycle
  deletedAt: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
workspaceSchema.index({ ownerId: 1, deletedAt: 1 });
workspaceSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Pre-save: generate slug if not provided
workspaceSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + 
      '-' + Date.now().toString(36);
  }
  this.updatedAt = new Date();
  next();
});

// Methods
workspaceSchema.methods.isOwner = function(userId) {
  return this.ownerId.toString() === userId.toString();
};

workspaceSchema.methods.hasStorageSpace = function(bytes) {
  return (this.storageUsed + bytes) <= this.storageLimit;
};

workspaceSchema.methods.hasMemberSlot = function() {
  return this.memberCount < this.memberLimit;
};

// Statics
workspaceSchema.statics.findByIdActive = function(id) {
  return this.findOne({ _id: id, deletedAt: null });
};

workspaceSchema.statics.findUserWorkspaces = function(userId) {
  // Returns workspaces where user is owner
  // For full membership list, use WorkspaceMember.findUserWorkspaces
  return this.find({ ownerId: userId, deletedAt: null });
};

module.exports = mongoose.model('Workspace', workspaceSchema);
