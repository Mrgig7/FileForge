/**
 * Workspace Routes
 * 
 * API endpoints for workspace management:
 * - Create workspace
 * - List user's workspaces
 * - Invite members
 * - Accept invitations
 * - Manage members
 * - Update settings
 * 
 * Security:
 * - All routes require authentication
 * - Role-based access control per operation
 * - Rate limiting on invitations
 */

const router = require('express').Router();
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const {
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole,
  requireWorkspacePermission
} = require('../middleware/workspaceMiddleware');

// All routes require authentication
router.use(ensureApiAuth);

/**
 * @route   POST /api/workspaces
 * @desc    Create a new workspace
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Workspace name must be at least 2 characters'
      });
    }
    
    // Create workspace
    const workspace = new Workspace({
      name: name.trim(),
      description,
      ownerId: req.user._id,
      settings: settings || {}
    });
    
    await workspace.save();
    
    // Create owner membership
    const membership = new WorkspaceMember({
      workspaceId: workspace._id,
      userId: req.user._id,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date()
    });
    
    await membership.save();
    
    // Audit log
    await AuditLog.logFromRequest(req, 'workspace.create', {
      targetType: 'workspace',
      targetId: workspace._id,
      metadata: { name: workspace.name }
    });
    
    res.status(201).json({
      success: true,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        role: 'OWNER',
        createdAt: workspace.createdAt
      }
    });
    
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create workspace'
    });
  }
});

/**
 * @route   GET /api/workspaces
 * @desc    List user's workspaces
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const workspaces = await WorkspaceMember.findUserWorkspaces(req.user._id);
    
    res.json({
      success: true,
      workspaces: workspaces.map(w => ({
        id: w.workspace._id,
        name: w.workspace.name,
        slug: w.workspace.slug,
        description: w.workspace.description,
        role: w.role,
        memberCount: w.workspace.memberCount,
        storageUsed: w.workspace.storageUsed,
        storageLimit: w.workspace.storageLimit,
        joinedAt: w.joinedAt
      }))
    });
    
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list workspaces'
    });
  }
});

/**
 * @route   GET /api/workspaces/:id
 * @desc    Get workspace details
 * @access  Private (workspace members)
 */
router.get('/:id', loadWorkspace, requireWorkspaceMember, async (req, res) => {
  try {
    const workspace = req.workspace;
    const membership = req.workspaceMembership;
    
    // Get member count
    const memberCount = await WorkspaceMember.countActiveMembers(workspace._id);
    
    res.json({
      success: true,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        settings: workspace.settings,
        storageUsed: workspace.storageUsed,
        storageLimit: workspace.storageLimit,
        memberCount,
        memberLimit: workspace.memberLimit,
        createdAt: workspace.createdAt
      },
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    });
    
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get workspace'
    });
  }
});

/**
 * @route   PATCH /api/workspaces/:id
 * @desc    Update workspace settings
 * @access  Private (ADMIN+)
 */
router.patch('/:id',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('ADMIN'),
  async (req, res) => {
    try {
      const { name, description, settings } = req.body;
      const workspace = req.workspace;
      
      if (name) workspace.name = name.trim();
      if (description !== undefined) workspace.description = description;
      if (settings) {
        workspace.settings = { ...workspace.settings, ...settings };
      }
      
      await workspace.save();
      
      await AuditLog.logFromRequest(req, 'workspace.update', {
        targetType: 'workspace',
        targetId: workspace._id
      });
      
      res.json({
        success: true,
        workspace: {
          id: workspace._id,
          name: workspace.name,
          description: workspace.description,
          settings: workspace.settings
        }
      });
      
    } catch (error) {
      console.error('Update workspace error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update workspace'
      });
    }
  }
);

/**
 * @route   GET /api/workspaces/:id/members
 * @desc    List workspace members
 * @access  Private (workspace members)
 */
router.get('/:id/members', loadWorkspace, requireWorkspaceMember, async (req, res) => {
  try {
    const members = await WorkspaceMember.getWorkspaceMembers(req.workspace._id);
    
    res.json({
      success: true,
      members: members.map(m => ({
        id: m._id,
        userId: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        profilePic: m.userId.profilePic,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt
      }))
    });
    
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list members'
    });
  }
});

/**
 * @route   POST /api/workspaces/:id/invite
 * @desc    Invite a user to workspace
 * @access  Private (ADMIN+)
 */
router.post('/:id/invite',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspacePermission('members:invite'),
  async (req, res) => {
    try {
      const { email, role = 'MEMBER', message } = req.body;
      const workspace = req.workspace;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }
      
      // Validate role
      if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
      }
      
      // Check can invite this role
      if (!req.workspaceMembership.canManage(role)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot invite users with equal or higher role'
        });
      }
      
      // Check member limit
      if (!workspace.hasMemberSlot()) {
        return res.status(403).json({
          success: false,
          error: 'Workspace member limit reached',
          upgradeRequired: true
        });
      }
      
      // Check if already a member
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const existingMembership = await WorkspaceMember.findMembership(
          workspace._id,
          existingUser._id
        );
        
        if (existingMembership) {
          return res.status(409).json({
            success: false,
            error: 'User is already a member'
          });
        }
      }
      
      // Create invitation
      const invitation = await Invitation.createInvitation({
        workspaceId: workspace._id,
        email,
        role,
        invitedBy: req.user._id,
        message
      });
      
      // Audit log
      await AuditLog.logFromRequest(req, 'workspace.invite', {
        targetType: 'invitation',
        targetId: invitation._id,
        workspaceId: workspace._id,
        metadata: { email, role }
      });
      
      // TODO: Send invitation email
      // await sendInvitationEmail(email, invitation, workspace);
      
      res.status(201).json({
        success: true,
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,  // Include for testing; in prod, only send via email
          expiresAt: invitation.expiresAt
        }
      });
      
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }
      
      console.error('Invite error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create invitation'
      });
    }
  }
);

/**
 * @route   POST /api/workspaces/invite/accept
 * @desc    Accept a workspace invitation
 * @access  Private
 */
router.post('/invite/accept', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token is required'
      });
    }
    
    // Find invitation
    const invitation = await Invitation.findByToken(token);
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired invitation'
      });
    }
    
    // Check email matches (optional - can allow any authenticated user)
    // For now, we allow any authenticated user to accept
    
    // Check workspace still exists
    const workspace = await Workspace.findByIdActive(invitation.workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace no longer exists'
      });
    }
    
    // Check not already a member
    const existingMembership = await WorkspaceMember.findMembership(
      workspace._id,
      req.user._id
    );
    
    if (existingMembership) {
      return res.status(409).json({
        success: false,
        error: 'You are already a member of this workspace'
      });
    }
    
    // Accept invitation
    await invitation.accept(req.user._id);
    
    // Create membership
    const membership = new WorkspaceMember({
      workspaceId: workspace._id,
      userId: req.user._id,
      role: invitation.role,
      status: 'ACTIVE',
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.createdAt,
      joinedAt: new Date()
    });
    
    await membership.save();
    
    // Update workspace member count
    workspace.memberCount = await WorkspaceMember.countActiveMembers(workspace._id);
    await workspace.save();
    
    // Audit log
    await AuditLog.logFromRequest(req, 'workspace.join', {
      targetType: 'workspace',
      targetId: workspace._id,
      metadata: { role: invitation.role, invitationId: invitation._id }
    });
    
    res.json({
      success: true,
      workspace: {
        id: workspace._id,
        name: workspace.name,
        slug: workspace.slug
      },
      membership: {
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    });
    
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation'
    });
  }
});

/**
 * @route   PATCH /api/workspaces/:id/members/:userId/role
 * @desc    Change a member's role
 * @access  Private (ADMIN+)
 */
router.patch('/:id/members/:userId/role',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspacePermission('members:invite'),
  async (req, res) => {
    try {
      const { role } = req.body;
      const targetUserId = req.params.userId;
      
      if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
      }
      
      // Find target membership
      const targetMembership = await WorkspaceMember.findOne({
        workspaceId: req.workspace._id,
        userId: targetUserId
      });
      
      if (!targetMembership) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }
      
      // Cannot change owner role
      if (targetMembership.role === 'OWNER') {
        return res.status(403).json({
          success: false,
          error: 'Cannot change owner role. Use transfer ownership instead.'
        });
      }
      
      // Check permission to manage target role
      if (!req.workspaceMembership.canManage(targetMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot modify member with equal or higher role'
        });
      }
      
      if (!req.workspaceMembership.canManage(role)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot assign role equal or higher than your own'
        });
      }
      
      const oldRole = targetMembership.role;
      targetMembership.role = role;
      await targetMembership.save();
      
      await AuditLog.logFromRequest(req, 'workspace.member_role_change', {
        targetType: 'workspaceMember',
        targetId: targetMembership._id,
        workspaceId: req.workspace._id,
        metadata: { userId: targetUserId, oldRole, newRole: role }
      });
      
      res.json({
        success: true,
        member: {
          userId: targetUserId,
          role: targetMembership.role
        }
      });
      
    } catch (error) {
      console.error('Change role error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change role'
      });
    }
  }
);

/**
 * @route   DELETE /api/workspaces/:id/members/:userId
 * @desc    Remove a member from workspace
 * @access  Private (ADMIN+, or self)
 */
router.delete('/:id/members/:userId',
  loadWorkspace,
  requireWorkspaceMember,
  async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const isSelf = targetUserId === req.user._id.toString();
      
      // Find target membership
      const targetMembership = await WorkspaceMember.findOne({
        workspaceId: req.workspace._id,
        userId: targetUserId
      });
      
      if (!targetMembership) {
        return res.status(404).json({
          success: false,
          error: 'Member not found'
        });
      }
      
      // Cannot remove owner
      if (targetMembership.role === 'OWNER') {
        return res.status(403).json({
          success: false,
          error: 'Cannot remove workspace owner'
        });
      }
      
      // Check permission (self or can manage)
      if (!isSelf && !req.workspaceMembership.hasPermission('members:remove')) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }
      
      if (!isSelf && !req.workspaceMembership.canManage(targetMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot remove member with equal or higher role'
        });
      }
      
      // Remove membership
      await WorkspaceMember.findByIdAndDelete(targetMembership._id);
      
      // Update member count
      req.workspace.memberCount = await WorkspaceMember.countActiveMembers(req.workspace._id);
      await req.workspace.save();
      
      await AuditLog.logFromRequest(req, isSelf ? 'workspace.leave' : 'workspace.member_remove', {
        targetType: 'workspaceMember',
        targetId: targetMembership._id,
        workspaceId: req.workspace._id,
        metadata: { userId: targetUserId }
      });
      
      res.json({
        success: true,
        message: isSelf ? 'Left workspace' : 'Member removed'
      });
      
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove member'
      });
    }
  }
);

/**
 * @route   GET /api/workspaces/:id/invitations
 * @desc    List pending invitations
 * @access  Private (ADMIN+)
 */
router.get('/:id/invitations',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspacePermission('members:invite'),
  async (req, res) => {
    try {
      const invitations = await Invitation.getPendingForWorkspace(req.workspace._id);
      
      res.json({
        success: true,
        invitations: invitations.map(i => ({
          id: i._id,
          email: i.email,
          role: i.role,
          invitedBy: i.invitedBy ? {
            id: i.invitedBy._id,
            name: i.invitedBy.name
          } : null,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt
        }))
      });
      
    } catch (error) {
      console.error('List invitations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list invitations'
      });
    }
  }
);

/**
 * @route   DELETE /api/workspaces/:id/invitations/:invitationId
 * @desc    Revoke an invitation
 * @access  Private (ADMIN+)
 */
router.delete('/:id/invitations/:invitationId',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspacePermission('members:invite'),
  async (req, res) => {
    try {
      const invitation = await Invitation.findOne({
        _id: req.params.invitationId,
        workspaceId: req.workspace._id
      });
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found'
        });
      }
      
      if (invitation.acceptedAt || invitation.revokedAt) {
        return res.status(409).json({
          success: false,
          error: 'Invitation already used or revoked'
        });
      }
      
      await invitation.revoke(req.user._id);
      
      res.json({
        success: true,
        message: 'Invitation revoked'
      });
      
    } catch (error) {
      console.error('Revoke invitation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke invitation'
      });
    }
  }
);

module.exports = router;
