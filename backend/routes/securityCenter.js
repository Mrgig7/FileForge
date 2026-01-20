/**
 * Security Center Routes
 * 
 * Admin endpoints for security monitoring and incident response.
 * 
 * Features:
 * - Security event listing
 * - Summary dashboard
 * - Lockdown mode
 * - Legal hold management
 */

const router = require('express').Router();
const SecurityEvent = require('../models/SecurityEvent');
const LegalHold = require('../models/LegalHold');
const Workspace = require('../models/Workspace');
const File = require('../models/file');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const {
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole
} = require('../middleware/workspaceMiddleware');

// All routes require authentication
router.use(ensureApiAuth);

/**
 * @route   GET /admin/security/summary
 * @desc    Get security dashboard summary
 * @access  Private (ADMIN+)
 */
router.get('/summary',
  async (req, res) => {
    try {
      const { workspaceId, days = 7 } = req.query;
      
      // Get summary
      const summary = await SecurityEvent.getSummary(workspaceId || null, parseInt(days, 10));
      
      // Get open critical events
      const criticalEvents = await SecurityEvent.getOpenCritical(workspaceId || null);
      
      res.json({
        success: true,
        summary: {
          ...summary,
          openCritical: criticalEvents.length,
          period: `${days} days`
        },
        criticalEvents: criticalEvents.slice(0, 5).map(e => ({
          id: e._id,
          type: e.type,
          severity: e.severity,
          title: e.title,
          createdAt: e.createdAt
        }))
      });
      
    } catch (error) {
      console.error('Security summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
  }
);

/**
 * @route   GET /admin/security/events
 * @desc    List security events
 * @access  Private (ADMIN+)
 */
router.get('/events', async (req, res) => {
  try {
    const {
      workspaceId,
      type,
      severity,
      status,
      from,
      to,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    const [events, total] = await Promise.all([
      SecurityEvent.find(query)
        .populate('actorUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
        .limit(parseInt(limit, 10)),
      SecurityEvent.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      events: events.map(e => ({
        id: e._id,
        type: e.type,
        severity: e.severity,
        title: e.title,
        description: e.description,
        actor: e.actorUserId ? {
          id: e.actorUserId._id,
          name: e.actorUserId.name
        } : null,
        ip: e.ip,
        status: e.status,
        createdAt: e.createdAt
      })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
    
  } catch (error) {
    console.error('Security events error:', error);
    res.status(500).json({ success: false, error: 'Failed to get events' });
  }
});

/**
 * @route   PATCH /admin/security/events/:id
 * @desc    Update event status (resolve, investigate)
 * @access  Private (ADMIN+)
 */
router.patch('/events/:id', async (req, res) => {
  try {
    const { status, resolution } = req.body;
    
    const event = await SecurityEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') {
      await event.resolve(req.user._id, resolution, status);
    } else {
      event.status = status;
      await event.save();
    }
    
    res.json({
      success: true,
      event: { id: event._id, status: event.status }
    });
    
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, error: 'Failed to update event' });
  }
});

/**
 * @route   POST /admin/workspaces/:id/lockdown/enable
 * @desc    Enable lockdown mode
 * @access  Private (OWNER only)
 */
router.post('/workspaces/:id/lockdown/enable',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    try {
      const { reason } = req.body;
      
      req.workspace.settings = req.workspace.settings || {};
      req.workspace.settings.lockdownMode = true;
      req.workspace.settings.lockdownAt = new Date();
      req.workspace.settings.lockdownBy = req.user._id;
      req.workspace.settings.lockdownReason = reason;
      
      await req.workspace.save();
      
      // Log security event
      await SecurityEvent.logLockdown(req.workspace._id, req.user._id, true);
      
      await AuditLog.logFromRequest(req, 'lockdown.enable', {
        workspaceId: req.workspace._id,
        metadata: { reason }
      });
      
      res.json({
        success: true,
        message: 'Lockdown mode ENABLED. All shares blocked, downloads restricted to members only.'
      });
      
    } catch (error) {
      console.error('Enable lockdown error:', error);
      res.status(500).json({ success: false, error: 'Failed to enable lockdown' });
    }
  }
);

/**
 * @route   POST /admin/workspaces/:id/lockdown/disable
 * @desc    Disable lockdown mode
 * @access  Private (OWNER only)
 */
router.post('/workspaces/:id/lockdown/disable',
  loadWorkspace,
  requireWorkspaceMember,
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    try {
      if (!req.workspace.settings?.lockdownMode) {
        return res.status(400).json({
          success: false,
          error: 'Lockdown is not enabled'
        });
      }
      
      req.workspace.settings.lockdownMode = false;
      await req.workspace.save();
      
      await SecurityEvent.logLockdown(req.workspace._id, req.user._id, false);
      
      await AuditLog.logFromRequest(req, 'lockdown.disable', {
        workspaceId: req.workspace._id
      });
      
      res.json({
        success: true,
        message: 'Lockdown mode DISABLED. Normal operations resumed.'
      });
      
    } catch (error) {
      console.error('Disable lockdown error:', error);
      res.status(500).json({ success: false, error: 'Failed to disable lockdown' });
    }
  }
);

/**
 * @route   POST /admin/legal-holds
 * @desc    Create a legal hold
 * @access  Private (ADMIN+)
 */
router.post('/legal-holds',
  async (req, res) => {
    try {
      const { workspaceId, name, reference, reason, fileIds = [] } = req.body;
      
      if (!workspaceId || !name || !reason) {
        return res.status(400).json({
          success: false,
          error: 'workspaceId, name, and reason are required'
        });
      }
      
      const legalHold = new LegalHold({
        workspaceId,
        name,
        reference,
        reason,
        createdBy: req.user._id,
        fileIds
      });
      
      await legalHold.save();
      
      await AuditLog.logFromRequest(req, 'legal_hold.create', {
        workspaceId,
        targetType: 'legalHold',
        targetId: legalHold._id,
        metadata: { name, fileCount: fileIds.length }
      });
      
      res.status(201).json({
        success: true,
        legalHold: legalHold.toPublicObject()
      });
      
    } catch (error) {
      console.error('Create legal hold error:', error);
      res.status(500).json({ success: false, error: 'Failed to create legal hold' });
    }
  }
);

/**
 * @route   GET /admin/legal-holds
 * @desc    List legal holds
 * @access  Private (ADMIN+)
 */
router.get('/legal-holds', async (req, res) => {
  try {
    const { workspaceId, status = 'ACTIVE' } = req.query;
    
    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (status) query.status = status;
    
    const holds = await LegalHold.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      legalHolds: holds.map(h => h.toPublicObject())
    });
    
  } catch (error) {
    console.error('List legal holds error:', error);
    res.status(500).json({ success: false, error: 'Failed to list legal holds' });
  }
});

/**
 * @route   POST /admin/legal-holds/:id/add-file
 * @desc    Add file to legal hold
 * @access  Private (ADMIN+)
 */
router.post('/legal-holds/:id/add-file', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    const legalHold = await LegalHold.findById(req.params.id);
    
    if (!legalHold || legalHold.status !== 'ACTIVE') {
      return res.status(404).json({
        success: false,
        error: 'Legal hold not found or not active'
      });
    }
    
    await legalHold.addFile(fileId);
    
    await AuditLog.logFromRequest(req, 'legal_hold.add_file', {
      targetType: 'legalHold',
      targetId: legalHold._id,
      metadata: { fileId }
    });
    
    res.json({
      success: true,
      legalHold: legalHold.toPublicObject()
    });
    
  } catch (error) {
    console.error('Add file to hold error:', error);
    res.status(500).json({ success: false, error: 'Failed to add file' });
  }
});

/**
 * @route   POST /admin/legal-holds/:id/release
 * @desc    Release a legal hold
 * @access  Private (OWNER only)
 */
router.post('/legal-holds/:id/release', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const legalHold = await LegalHold.findById(req.params.id);
    
    if (!legalHold) {
      return res.status(404).json({
        success: false,
        error: 'Legal hold not found'
      });
    }
    
    if (legalHold.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Legal hold is not active'
      });
    }
    
    await legalHold.release(req.user._id, reason);
    
    await AuditLog.logFromRequest(req, 'legal_hold.release', {
      targetType: 'legalHold',
      targetId: legalHold._id,
      metadata: { reason }
    });
    
    res.json({
      success: true,
      message: 'Legal hold released'
    });
    
  } catch (error) {
    console.error('Release legal hold error:', error);
    res.status(500).json({ success: false, error: 'Failed to release legal hold' });
  }
});

module.exports = router;
