/**
 * Workspace Middleware
 * 
 * Middleware for workspace-scoped routes:
 * - loadWorkspace: Load workspace from request param
 * - requireWorkspaceMember: Ensure user is a member
 * - requireWorkspaceRole: Check minimum role level
 * - requireWorkspacePermission: Check specific permission
 * 
 * Security Notes:
 * - All workspace operations must verify membership
 * - Role checks are hierarchical (OWNER > ADMIN > MEMBER > VIEWER)
 * - Suspended members are treated as non-members
 */

const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');

/**
 * Load workspace from :workspaceId param
 * Attaches to req.workspace and req.workspaceMembership
 */
async function loadWorkspace(req, res, next) {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required'
      });
    }
    
    // Load workspace
    const workspace = await Workspace.findByIdActive(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }
    
    req.workspace = workspace;
    
    // Load membership if user is authenticated
    if (req.user) {
      const membership = await WorkspaceMember.findMembership(
        workspace._id,
        req.user._id
      );
      req.workspaceMembership = membership;
    }
    
    next();
  } catch (error) {
    console.error('Load workspace error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load workspace'
    });
  }
}

/**
 * Require user to be a workspace member
 * Must be called after loadWorkspace
 */
function requireWorkspaceMember(req, res, next) {
  if (!req.workspace) {
    return res.status(500).json({
      success: false,
      error: 'Workspace not loaded'
    });
  }
  
  if (!req.workspaceMembership) {
    return res.status(403).json({
      success: false,
      error: 'You are not a member of this workspace'
    });
  }
  
  if (req.workspaceMembership.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      error: 'Your membership is not active'
    });
  }
  
  next();
}

/**
 * Require minimum workspace role
 * @param {string} role - Minimum role required (VIEWER|MEMBER|ADMIN|OWNER)
 */
function requireWorkspaceRole(role) {
  return (req, res, next) => {
    if (!req.workspaceMembership) {
      return res.status(403).json({
        success: false,
        error: 'Workspace membership required'
      });
    }
    
    if (!req.workspaceMembership.hasRole(role)) {
      return res.status(403).json({
        success: false,
        error: `Requires ${role} role or higher`,
        currentRole: req.workspaceMembership.role
      });
    }
    
    next();
  };
}

/**
 * Require specific workspace permission
 * @param {string} permission - Permission string (e.g., 'files:write')
 */
function requireWorkspacePermission(permission) {
  return (req, res, next) => {
    if (!req.workspaceMembership) {
      return res.status(403).json({
        success: false,
        error: 'Workspace membership required'
      });
    }
    
    if (!req.workspaceMembership.hasPermission(permission)) {
      return res.status(403).json({
        success: false,
        error: `Missing permission: ${permission}`,
        currentRole: req.workspaceMembership.role
      });
    }
    
    next();
  };
}

/**
 * Optional workspace loading from query param
 * For routes that work with or without workspace context
 */
async function optionalWorkspace(req, res, next) {
  try {
    const workspaceId = req.query.workspaceId || req.body?.workspaceId;
    
    if (workspaceId) {
      const workspace = await Workspace.findByIdActive(workspaceId);
      
      if (workspace && req.user) {
        const membership = await WorkspaceMember.findMembership(
          workspace._id,
          req.user._id
        );
        
        if (membership && membership.status === 'ACTIVE') {
          req.workspace = workspace;
          req.workspaceMembership = membership;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional workspace error:', error);
    next();  // Continue without workspace
  }
}

/**
 * Check if user can access a file based on workspace membership
 * For use in file routes
 */
async function canAccessWorkspaceFile(userId, file) {
  if (!file.workspaceId) {
    // Personal file - check ownership
    return file.userId?.toString() === userId.toString();
  }
  
  // Workspace file - check membership
  const membership = await WorkspaceMember.findMembership(
    file.workspaceId,
    userId
  );
  
  return membership && membership.status === 'ACTIVE';
}

/**
 * Check if user can modify a file based on workspace role
 */
async function canModifyWorkspaceFile(userId, file) {
  if (!file.workspaceId) {
    return file.userId?.toString() === userId.toString();
  }
  
  const membership = await WorkspaceMember.findMembership(
    file.workspaceId,
    userId
  );
  
  if (!membership || membership.status !== 'ACTIVE') {
    return false;
  }
  
  // Owner of file can always modify
  if (file.userId?.toString() === userId.toString()) {
    return true;
  }
  
  // ADMIN and above can modify any file
  return membership.hasRole('ADMIN');
}

module.exports = {
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole,
  requireWorkspacePermission,
  optionalWorkspace,
  canAccessWorkspaceFile,
  canModifyWorkspaceFile
};
