/**
 * WorkspaceMember Model
 * 
 * Represents membership in a workspace with role-based permissions.
 * 
 * Roles (hierarchical):
 * - OWNER: Full control, cannot be removed
 * - ADMIN: Manage members, settings, all content
 * - MEMBER: Upload, share, manage own content
 * - VIEWER: Read-only access to workspace content
 * 
 * Security Notes:
 * - Role changes must be done by ADMIN or above
 * - OWNER role cannot be assigned directly (use transfer)
 * - Membership status tracks invite flow
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Role hierarchy (higher = more permissions)
const WORKSPACE_ROLES = {
  VIEWER: { level: 1, name: 'VIEWER' },
  MEMBER: { level: 2, name: 'MEMBER' },
  ADMIN: { level: 3, name: 'ADMIN' },
  OWNER: { level: 4, name: 'OWNER' }
};

const ROLE_PERMISSIONS = {
  VIEWER: ['files:read', 'shares:read'],
  MEMBER: ['files:read', 'files:write', 'files:delete:own', 'shares:read', 'shares:create'],
  ADMIN: ['files:*', 'shares:*', 'members:read', 'members:invite', 'members:remove', 'settings:read', 'settings:write'],
  OWNER: ['*']
};

const workspaceMemberSchema = new Schema({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  role: {
    type: String,
    enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
    default: 'MEMBER'
  },
  
  status: {
    type: String,
    enum: ['INVITED', 'ACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  
  // Invitation tracking
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: { type: Date },
  joinedAt: { type: Date, default: Date.now },
  
  // Notifications preferences
  notifications: {
    fileUploads: { type: Boolean, default: true },
    memberChanges: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false }
  }
});

// Compound unique index
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

// Methods
workspaceMemberSchema.methods.hasRole = function(role) {
  const myLevel = WORKSPACE_ROLES[this.role]?.level || 0;
  const requiredLevel = WORKSPACE_ROLES[role]?.level || 999;
  return myLevel >= requiredLevel;
};

workspaceMemberSchema.methods.hasPermission = function(permission) {
  const permissions = ROLE_PERMISSIONS[this.role] || [];
  
  // Check for wildcard
  if (permissions.includes('*')) return true;
  
  // Check exact match
  if (permissions.includes(permission)) return true;
  
  // Check category wildcard (e.g., 'files:*' matches 'files:read')
  const [category] = permission.split(':');
  if (permissions.includes(`${category}:*`)) return true;
  
  return false;
};

workspaceMemberSchema.methods.canManage = function(targetRole) {
  // Can only manage roles lower than own
  const myLevel = WORKSPACE_ROLES[this.role]?.level || 0;
  const targetLevel = WORKSPACE_ROLES[targetRole]?.level || 0;
  return myLevel > targetLevel;
};

// Statics
workspaceMemberSchema.statics.ROLES = WORKSPACE_ROLES;
workspaceMemberSchema.statics.PERMISSIONS = ROLE_PERMISSIONS;

workspaceMemberSchema.statics.findMembership = function(workspaceId, userId) {
  return this.findOne({ workspaceId, userId, status: 'ACTIVE' });
};

workspaceMemberSchema.statics.findUserWorkspaces = async function(userId) {
  const memberships = await this.find({ userId, status: 'ACTIVE' })
    .populate('workspaceId')
    .lean();
  
  return memberships
    .filter(m => m.workspaceId && !m.workspaceId.deletedAt)
    .map(m => ({
      workspace: m.workspaceId,
      role: m.role,
      joinedAt: m.joinedAt
    }));
};

workspaceMemberSchema.statics.getWorkspaceMembers = function(workspaceId) {
  return this.find({ workspaceId, status: { $in: ['ACTIVE', 'INVITED'] } })
    .populate('userId', 'name email profilePic')
    .sort({ role: -1, joinedAt: 1 });
};

workspaceMemberSchema.statics.countActiveMembers = function(workspaceId) {
  return this.countDocuments({ workspaceId, status: 'ACTIVE' });
};

module.exports = mongoose.model('WorkspaceMember', workspaceMemberSchema);
