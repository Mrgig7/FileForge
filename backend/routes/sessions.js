/**
 * Session Routes
 * 
 * Endpoints for managing user sessions and devices.
 * 
 * Features:
 * - List active sessions
 * - Revoke individual sessions
 * - Revoke all sessions
 * - Device management
 */

const router = require('express').Router();
const Session = require('../models/Session');
const Device = require('../models/Device');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');

// All routes require authentication
router.use(ensureApiAuth);

/**
 * @route   GET /me/sessions
 * @desc    List user's active sessions
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.getUserSessions(req.user._id, true);
    
    res.json({
      success: true,
      sessions: sessions.map(s => ({
        ...s.toPublicObject(),
        device: s.deviceId ? s.deviceId.toPublicObject() : null,
        isCurrent: s._id.toString() === req.sessionId
      }))
    });
    
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

/**
 * @route   POST /me/sessions/:id/revoke
 * @desc    Revoke a specific session
 * @access  Private
 */
router.post('/:id/revoke', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    if (!session.isActive()) {
      return res.status(400).json({
        success: false,
        error: 'Session already revoked or expired'
      });
    }
    
    await session.revoke(req.user._id, 'user_revoke');
    
    await AuditLog.logFromRequest(req, 'session.revoke', {
      targetType: 'session',
      targetId: session._id
    });
    
    res.json({
      success: true,
      message: 'Session revoked'
    });
    
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

/**
 * @route   POST /me/sessions/revoke-all
 * @desc    Revoke all sessions except current
 * @access  Private
 */
router.post('/revoke-all', async (req, res) => {
  try {
    const { includeCurrent = false } = req.body;
    
    if (includeCurrent) {
      await Session.revokeAllForUser(req.user._id, req.user._id, 'revoke_all');
    } else {
      // Revoke all except current
      await Session.updateMany(
        {
          userId: req.user._id,
          _id: { $ne: req.sessionId },
          revokedAt: null
        },
        {
          revokedAt: new Date(),
          revokedBy: req.user._id,
          revokeReason: 'revoke_all'
        }
      );
    }
    
    await AuditLog.logFromRequest(req, 'session.revoke_all', {
      metadata: { includeCurrent }
    });
    
    res.json({
      success: true,
      message: includeCurrent 
        ? 'All sessions revoked'
        : 'All other sessions revoked'
    });
    
  } catch (error) {
    console.error('Revoke all error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke sessions' });
  }
});

/**
 * @route   GET /me/devices
 * @desc    List user's devices
 * @access  Private
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.getUserDevices(req.user._id);
    
    res.json({
      success: true,
      devices: devices.map(d => d.toPublicObject())
    });
    
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
});

/**
 * @route   PATCH /me/devices/:id
 * @desc    Update device (name, trust)
 * @access  Private
 */
router.patch('/devices/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    const { name } = req.body;
    
    if (name !== undefined) {
      device.name = name;
    }
    
    await device.save();
    
    res.json({
      success: true,
      device: device.toPublicObject()
    });
    
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
});

/**
 * @route   DELETE /me/devices/:id
 * @desc    Revoke/forget a device
 * @access  Private
 */
router.delete('/devices/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    await device.revoke();
    
    // Also revoke sessions on this device
    await Session.updateMany(
      { deviceId: device._id, revokedAt: null },
      { revokedAt: new Date(), revokeReason: 'device_revoked' }
    );
    
    await AuditLog.logFromRequest(req, 'device.revoke', {
      targetType: 'device',
      targetId: device._id
    });
    
    res.json({
      success: true,
      message: 'Device revoked'
    });
    
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke device' });
  }
});

module.exports = router;
