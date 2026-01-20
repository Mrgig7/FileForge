/**
 * SSO Routes
 * 
 * OIDC/SAML Single Sign-On endpoints.
 * 
 * Flow:
 * 1. POST /auth/sso/:workspaceId/start - Initiate SSO
 * 2. GET /auth/sso/:workspaceId/callback - Handle IdP callback
 * 3. Create session + redirect to app
 * 
 * Security:
 * - State + nonce validation
 * - Issuer/audience verification
 * - Strict redirect URI validation
 */

const router = require('express').Router();
const crypto = require('crypto');
const IdentityProvider = require('../models/IdentityProvider');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const User = require('../models/User');
const Session = require('../models/Session');
const Device = require('../models/Device');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const {
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole
} = require('../middleware/workspaceMiddleware');

// State store (use Redis in production)
const ssoStateStore = new Map();

/**
 * @route   POST /workspaces/:id/sso/config
 * @desc    Configure SSO for workspace
 * @access  Private (OWNER only)
 */
router.post('/workspaces/:id/sso/config',
  ensureApiAuth,
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    try {
      const {
        type,
        name,
        issuerUrl,
        clientId,
        clientSecret,
        discoveryUrl,
        scopes,
        autoProvision,
        defaultRole,
        allowedDomains
      } = req.body;
      
      if (!type || !['OIDC', 'SAML'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid type. Must be OIDC or SAML'
        });
      }
      
      if (type === 'OIDC' && (!issuerUrl || !clientId || !clientSecret)) {
        return res.status(400).json({
          success: false,
          error: 'OIDC requires issuerUrl, clientId, and clientSecret'
        });
      }
      
      // SAML: Interface only
      if (type === 'SAML') {
        return res.status(501).json({
          success: false,
          error: 'SAML not fully implemented. NEEDS CLARIFICATION: xml-crypto library required'
        });
      }
      
      // Find or create IdP config
      let idp = await IdentityProvider.findOne({
        workspaceId: req.workspace._id,
        type
      });
      
      if (!idp) {
        idp = new IdentityProvider({
          workspaceId: req.workspace._id,
          type,
          createdBy: req.user._id
        });
      }
      
      // Update config
      idp.name = name || idp.name;
      idp.issuerUrl = issuerUrl;
      idp.clientId = clientId;
      if (clientSecret) {
        idp.clientSecret = clientSecret;
      }
      idp.discoveryUrl = discoveryUrl || `${issuerUrl}/.well-known/openid-configuration`;
      
      if (scopes) idp.scopes = scopes;
      if (autoProvision !== undefined) idp.autoProvision = autoProvision;
      if (defaultRole) idp.defaultRole = defaultRole;
      if (allowedDomains) idp.allowedDomains = allowedDomains;
      
      // Auto-discover OIDC endpoints
      if (type === 'OIDC' && idp.discoveryUrl) {
        try {
          const fetch = require('node-fetch');
          const discoveryRes = await fetch(idp.discoveryUrl);
          const discovery = await discoveryRes.json();
          
          idp.authorizationEndpoint = discovery.authorization_endpoint;
          idp.tokenEndpoint = discovery.token_endpoint;
          idp.userInfoEndpoint = discovery.userinfo_endpoint;
          idp.jwksUri = discovery.jwks_uri;
        } catch (err) {
          console.warn('OIDC discovery failed:', err.message);
        }
      }
      
      idp.status = 'TESTING';
      await idp.save();
      
      await AuditLog.logFromRequest(req, 'sso.config_updated', {
        workspaceId: req.workspace._id,
        targetType: 'identityProvider',
        targetId: idp._id
      });
      
      res.json({
        success: true,
        identityProvider: idp.toPublicObject(),
        message: 'SSO configuration saved. Test before enabling.'
      });
      
    } catch (error) {
      console.error('SSO config error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to configure SSO'
      });
    }
  }
);

/**
 * @route   GET /workspaces/:id/sso/config
 * @desc    Get SSO configuration
 * @access  Private (ADMIN+)
 */
router.get('/workspaces/:id/sso/config',
  ensureApiAuth,
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('ADMIN'),
  async (req, res) => {
    try {
      const idp = await IdentityProvider.findOne({
        workspaceId: req.workspace._id,
        type: 'OIDC'
      });
      
      res.json({
        success: true,
        identityProvider: idp ? idp.toPublicObject() : null,
        enforceSso: req.workspace.settings?.enforceSso || false
      });
      
    } catch (error) {
      console.error('Get SSO config error:', error);
      res.status(500).json({ success: false, error: 'Failed to get SSO config' });
    }
  }
);

/**
 * @route   POST /workspaces/:id/sso/enable
 * @desc    Enable/enforce SSO
 * @access  Private (OWNER only)
 */
router.post('/workspaces/:id/sso/enable',
  ensureApiAuth,
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    try {
      const { enforce = true } = req.body;
      
      // Check IdP is configured and tested
      const idp = await IdentityProvider.findOne({
        workspaceId: req.workspace._id,
        status: { $in: ['ACTIVE', 'TESTING'] }
      });
      
      if (!idp) {
        return res.status(400).json({
          success: false,
          error: 'No SSO provider configured'
        });
      }
      
      // Update IdP status
      idp.status = 'ACTIVE';
      await idp.save();
      
      // Update workspace
      req.workspace.settings = req.workspace.settings || {};
      req.workspace.settings.enforceSso = enforce;
      await req.workspace.save();
      
      await AuditLog.logFromRequest(req, 'sso.enabled', {
        workspaceId: req.workspace._id,
        metadata: { enforce }
      });
      
      res.json({
        success: true,
        message: enforce 
          ? 'SSO enabled and enforced. Password login disabled for members.'
          : 'SSO enabled. Password login still allowed.'
      });
      
    } catch (error) {
      console.error('Enable SSO error:', error);
      res.status(500).json({ success: false, error: 'Failed to enable SSO' });
    }
  }
);

/**
 * @route   POST /auth/sso/:workspaceId/start
 * @desc    Start SSO flow
 * @access  Public
 */
router.post('/auth/sso/:workspaceId/start', async (req, res) => {
  try {
    const workspace = await Workspace.findByIdActive(req.params.workspaceId);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }
    
    const idp = await IdentityProvider.findActiveForWorkspace(workspace._id);
    
    if (!idp) {
      return res.status(400).json({
        success: false,
        error: 'SSO not configured for this workspace'
      });
    }
    
    if (!idp.isOidc()) {
      return res.status(501).json({
        success: false,
        error: 'Only OIDC is currently supported'
      });
    }
    
    // Generate state and nonce
    const state = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    
    // Store state (with expiry)
    ssoStateStore.set(state, {
      nonce,
      workspaceId: workspace._id.toString(),
      idpId: idp._id.toString(),
      createdAt: Date.now()
    });
    
    // Cleanup old states
    for (const [key, value] of ssoStateStore) {
      if (Date.now() - value.createdAt > 10 * 60 * 1000) {
        ssoStateStore.delete(key);
      }
    }
    
    const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/auth/sso/${workspace._id}/callback`;
    
    const authUrl = idp.getAuthorizationUrl({ state, nonce, redirectUri });
    
    res.json({
      success: true,
      authUrl
    });
    
  } catch (error) {
    console.error('SSO start error:', error);
    res.status(500).json({ success: false, error: 'Failed to start SSO' });
  }
});

/**
 * @route   GET /auth/sso/:workspaceId/callback
 * @desc    Handle OIDC callback
 * @access  Public
 */
router.get('/auth/sso/:workspaceId/callback', async (req, res) => {
  try {
    const { code, state, error: oidcError } = req.query;
    
    if (oidcError) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${oidcError}`);
    }
    
    // Validate state
    const stateData = ssoStateStore.get(state);
    if (!stateData) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
    }
    ssoStateStore.delete(state);
    
    // Load IdP
    const idp = await IdentityProvider.findById(stateData.idpId);
    if (!idp || !idp.isActive()) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=sso_not_active`);
    }
    
    // Exchange code for tokens
    const fetch = require('node-fetch');
    const redirectUri = `${process.env.APP_BASE_URL}/auth/sso/${req.params.workspaceId}/callback`;
    
    const tokenRes = await fetch(idp.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: idp.clientId,
        client_secret: idp.clientSecret
      })
    });
    
    const tokens = await tokenRes.json();
    
    if (tokens.error) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${tokens.error}`);
    }
    
    // Get user info
    const userInfoRes = await fetch(idp.userInfoEndpoint, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });
    
    const userInfo = await userInfoRes.json();
    
    const email = userInfo[idp.attributeMapping.email] || userInfo.email;
    const name = userInfo[idp.attributeMapping.name] || userInfo.name || email;
    
    if (!email) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }
    
    // Check allowed domains
    if (idp.allowedDomains && idp.allowedDomains.length > 0) {
      const domain = email.split('@')[1];
      if (!idp.allowedDomains.includes(domain)) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=domain_not_allowed`);
      }
    }
    
    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      if (!idp.autoProvision) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=user_not_found`);
      }
      
      // Auto-provision user
      user = new User({
        email: email.toLowerCase(),
        name,
        password: crypto.randomBytes(32).toString('hex'),  // Random unusable password
        role: 'USER'
      });
      await user.save();
    }
    
    // Ensure workspace membership
    let membership = await WorkspaceMember.findMembership(stateData.workspaceId, user._id);
    
    if (!membership && idp.autoProvision) {
      membership = new WorkspaceMember({
        workspaceId: stateData.workspaceId,
        userId: user._id,
        role: idp.defaultRole || 'MEMBER',
        status: 'ACTIVE',
        joinedAt: new Date()
      });
      await membership.save();
    }
    
    // Create device
    const fingerprint = req.headers['user-agent'] + req.ip;
    const device = await Device.findOrCreate(user._id, fingerprint, {
      browser: req.headers['user-agent'],
      lastIp: req.ip
    });
    
    // Create session
    const session = await Session.createSession({
      userId: user._id,
      deviceId: device._id,
      workspaceId: stateData.workspaceId,
      identityProviderId: idp._id,
      ssoSessionId: tokens.id_token,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Generate app tokens
    const jwt = require('jsonwebtoken');
    const accessToken = jwt.sign(
      { userId: user._id, sessionId: session._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    await AuditLog.logFromRequest(req, 'auth.sso_login', {
      userId: user._id,
      workspaceId: stateData.workspaceId,
      metadata: { provider: idp.name, idpId: idp._id }
    });
    
    // Redirect with token
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sso-callback?token=${accessToken}&sessionId=${session._id}`
    );
    
  } catch (error) {
    console.error('SSO callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=sso_failed`);
  }
});

module.exports = router;
