/**
 * Lockdown Middleware
 * 
 * Enforces lockdown mode restrictions on workspaces.
 * When enabled:
 * - Block all new share creations
 * - Block downloads for non-members
 * - Force re-authentication
 * 
 * Usage: Apply to share and download routes
 */

const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const SecurityEvent = require('../models/SecurityEvent');

/**
 * Check if workspace is in lockdown mode
 * Blocks share creation when lockdown is active
 */
async function checkLockdown(req, res, next) {
  try {
    // Get workspace from request or file
    let workspaceId = req.workspace?._id || 
                     req.body?.workspaceId ||
                     req.file?.workspaceId;
    
    if (!workspaceId) {
      return next();
    }
    
    const workspace = await Workspace.findByIdActive(workspaceId);
    
    if (!workspace) {
      return next();
    }
    
    if (workspace.settings?.lockdownMode) {
      return res.status(403).json({
        success: false,
        error: 'Workspace is in lockdown mode. Sharing is temporarily disabled.',
        lockdown: true,
        lockdownAt: workspace.settings.lockdownAt
      });
    }
    
    next();
  } catch (error) {
    console.error('Lockdown check error:', error);
    next();  // Don't block on error
  }
}

/**
 * Check download restrictions during lockdown
 * Only workspace members can download during lockdown
 */
async function checkLockdownDownload(req, res, next) {
  try {
    const file = req.file;  // Loaded by previous middleware
    
    if (!file?.workspaceId) {
      return next();
    }
    
    const workspace = await Workspace.findByIdActive(file.workspaceId);
    
    if (!workspace || !workspace.settings?.lockdownMode) {
      return next();
    }
    
    // During lockdown, require authentication
    if (!req.user) {
      return res.status(403).json({
        success: false,
        error: 'Authentication required during lockdown mode',
        lockdown: true
      });
    }
    
    // Check membership
    const membership = await WorkspaceMember.findMembership(workspace._id, req.user._id);
    
    if (!membership || membership.status !== 'ACTIVE') {
      // Log blocked access attempt
      await SecurityEvent.create({
        workspaceId: workspace._id,
        type: 'unauthorized_access',
        severity: 'MEDIUM',
        actorUserId: req.user._id,
        targetType: 'file',
        targetId: file._id,
        ip: req.ip,
        title: 'Download blocked during lockdown',
        description: 'Non-member attempted download during lockdown mode'
      });
      
      return res.status(403).json({
        success: false,
        error: 'Only workspace members can access files during lockdown',
        lockdown: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Lockdown download check error:', error);
    next();
  }
}

/**
 * Workspace lockdown status helper
 */
async function isWorkspaceLockedDown(workspaceId) {
  if (!workspaceId) return false;
  
  const workspace = await Workspace.findByIdActive(workspaceId);
  return workspace?.settings?.lockdownMode === true;
}

module.exports = {
  checkLockdown,
  checkLockdownDownload,
  isWorkspaceLockedDown
};
