/**
 * SCIM Routes
 * 
 * SCIM 2.0 provisioning endpoints for enterprise identity providers.
 * Enables automatic user provisioning/deprovisioning from IdP.
 * 
 * Security Notes:
 * - Bearer token authentication (hash stored)
 * - Rate limited
 * - All operations audit logged
 */

const router = require('express').Router();
const User = require('../models/User');
const WorkspaceMember = require('../models/WorkspaceMember');
const ScimToken = require('../models/ScimToken');
const AuditLog = require('../models/AuditLog');

/**
 * SCIM Bearer Token Authentication Middleware
 */
async function scimAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Missing or invalid Authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  const scimToken = await ScimToken.validateToken(token);
  
  if (!scimToken) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Invalid or expired SCIM token'
    });
  }
  
  req.scimToken = scimToken;
  req.workspace = scimToken.workspaceId;
  next();
}

// Apply auth to all SCIM routes
router.use(scimAuth);

/**
 * @route   GET /scim/v2/Users
 * @desc    List users in workspace
 * @access  SCIM Token
 */
router.get('/Users', async (req, res) => {
  try {
    const { startIndex = 1, count = 100, filter } = req.query;
    
    // Get workspace members
    const members = await WorkspaceMember.find({
      workspaceId: req.workspace._id,
      status: 'ACTIVE'
    }).populate('userId');
    
    const resources = members.map(m => userToScim(m.userId, m));
    
    await AuditLog.log({
      action: 'scim.list_users',
      workspaceId: req.workspace._id,
      metadata: { count: resources.length }
    });
    
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex: parseInt(startIndex, 10),
      itemsPerPage: resources.length,
      Resources: resources
    });
    
  } catch (error) {
    console.error('SCIM list users error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * @route   GET /scim/v2/Users/:id
 * @desc    Get single user
 * @access  SCIM Token
 */
router.get('/Users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }
    
    const membership = await WorkspaceMember.findMembership(req.workspace._id, user._id);
    
    res.json(userToScim(user, membership));
    
  } catch (error) {
    console.error('SCIM get user error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * @route   POST /scim/v2/Users
 * @desc    Create/provision user
 * @access  SCIM Token
 */
router.post('/Users', async (req, res) => {
  try {
    const { userName, name, emails, active = true } = req.body;
    
    const email = userName || emails?.[0]?.value;
    
    if (!email) {
      return res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'userName (email) is required'
      });
    }
    
    // Check existing user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user
      const crypto = require('crypto');
      user = new User({
        email: email.toLowerCase(),
        name: name?.formatted || name?.givenName || email.split('@')[0],
        password: crypto.randomBytes(32).toString('hex'),  // Random password
        role: 'USER'
      });
      await user.save();
    }
    
    // Add to workspace
    let membership = await WorkspaceMember.findOne({
      workspaceId: req.workspace._id,
      userId: user._id
    });
    
    if (!membership) {
      membership = new WorkspaceMember({
        workspaceId: req.workspace._id,
        userId: user._id,
        role: 'MEMBER',
        status: active ? 'ACTIVE' : 'SUSPENDED'
      });
      await membership.save();
    } else {
      membership.status = active ? 'ACTIVE' : 'SUSPENDED';
      await membership.save();
    }
    
    await AuditLog.log({
      action: 'scim.create_user',
      workspaceId: req.workspace._id,
      targetType: 'user',
      targetId: user._id,
      metadata: { email, membershipId: membership._id }
    });
    
    res.status(201).json(userToScim(user, membership));
    
  } catch (error) {
    console.error('SCIM create user error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * @route   PATCH /scim/v2/Users/:id
 * @desc    Update user (typically active status)
 * @access  SCIM Token
 */
router.patch('/Users/:id', async (req, res) => {
  try {
    const { Operations } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }
    
    let membership = await WorkspaceMember.findMembership(req.workspace._id, user._id);
    
    // Process SCIM operations
    for (const op of Operations || []) {
      if (op.path === 'active' || op.op === 'replace' && op.value?.active !== undefined) {
        const active = op.value?.active ?? op.value;
        
        if (membership) {
          membership.status = active ? 'ACTIVE' : 'SUSPENDED';
          await membership.save();
        }
        
        // Also update user disabled status
        user.disabled = !active;
        await user.save();
      }
    }
    
    await AuditLog.log({
      action: 'scim.update_user',
      workspaceId: req.workspace._id,
      targetType: 'user',
      targetId: user._id
    });
    
    res.json(userToScim(user, membership));
    
  } catch (error) {
    console.error('SCIM patch user error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /scim/v2/Users/:id
 * @desc    Deprovision user
 * @access  SCIM Token
 */
router.delete('/Users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: 'User not found'
      });
    }
    
    // Remove from workspace (don't delete user)
    await WorkspaceMember.findOneAndDelete({
      workspaceId: req.workspace._id,
      userId: user._id
    });
    
    await AuditLog.log({
      action: 'scim.delete_user',
      workspaceId: req.workspace._id,
      targetType: 'user',
      targetId: user._id
    });
    
    res.status(204).send();
    
  } catch (error) {
    console.error('SCIM delete user error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * @route   GET /scim/v2/Groups
 * @desc    List groups (workspace roles)
 * @access  SCIM Token
 */
router.get('/Groups', async (req, res) => {
  try {
    // Map workspace roles to SCIM groups
    const groups = [
      { id: 'role-admin', displayName: 'Admins' },
      { id: 'role-member', displayName: 'Members' },
      { id: 'role-viewer', displayName: 'Viewers' }
    ];
    
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: groups.length,
      Resources: groups.map(g => ({
        schemas: ['urn:ietf:params:scim:core:2.0:Group'],
        id: g.id,
        displayName: g.displayName
      }))
    });
    
  } catch (error) {
    console.error('SCIM list groups error:', error);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Internal server error'
    });
  }
});

/**
 * Convert user to SCIM format
 */
function userToScim(user, membership) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user._id.toString(),
    userName: user.email,
    name: {
      formatted: user.name,
      givenName: user.name?.split(' ')[0],
      familyName: user.name?.split(' ').slice(1).join(' ') || ''
    },
    emails: [{
      value: user.email,
      primary: true
    }],
    active: membership?.status === 'ACTIVE' && !user.disabled,
    groups: membership ? [{
      value: `role-${membership.role.toLowerCase()}`,
      display: membership.role
    }] : [],
    meta: {
      resourceType: 'User',
      created: user.createdAt?.toISOString(),
      lastModified: user.updatedAt?.toISOString()
    }
  };
}

module.exports = router;
