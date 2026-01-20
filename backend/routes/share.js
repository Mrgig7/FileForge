/**
 * Share Link Routes
 * 
 * Secure file sharing with:
 * - HMAC signed URLs for tamper protection
 * - Optional password protection
 * - Download limits
 * - Expiry dates
 * - Per-IP rate limiting
 * 
 * Link format: /s/{token}?sig={HMAC}&exp={timestamp}
 */

const router = require('express').Router();
const crypto = require('crypto');
const File = require('../models/file');
const ShareLink = require('../models/ShareLink');
const AuditLog = require('../models/AuditLog');
const { ensureApiAuth } = require('../middleware/auth');
const { requireFeature, optionalAuth } = require('../middleware/rbacMiddleware');
const { shareAccessLimiter, createRateLimiter } = require('../middleware/rateLimiter');

// Server-side HMAC secret (from environment)
const HMAC_SECRET = process.env.SHARE_LINK_SECRET || process.env.JWT_SECRET || 'fileforge_share_secret';

/**
 * @route   POST /api/share/create
 * @desc    Create a new share link for a file
 * @access  Private (file owner only)
 * 
 * @body    {
 *            fileId: string (required) - UUID of the file
 *            expiresIn: string (optional) - "1h"|"24h"|"7d"|"30d"|"never"
 *            password: string (optional) - Password for protection
 *            maxDownloads: number (optional) - Download limit
 *            ipThrottlePerMin: number (optional) - Per-IP rate limit
 *          }
 */
router.post('/create',
  ensureApiAuth,
  async (req, res) => {
    try {
      const { fileId, expiresIn, password, maxDownloads, ipThrottlePerMin } = req.body;
      const userId = req.user._id;
      const userRole = req.user.role || 'USER';
      
      // Validate file UUID
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'fileId is required'
        });
      }
      
      // Find file by UUID
      const file = await File.findOne({ uuid: fileId });
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      // Check ownership
      if (file.userId && file.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You can only create share links for your own files'
        });
      }
      
      // Check PRO features
      if (password && userRole === 'USER') {
        return res.status(403).json({
          success: false,
          error: 'Password-protected links require PRO plan',
          upgradeRequired: true
        });
      }
      
      if (maxDownloads && userRole === 'USER') {
        return res.status(403).json({
          success: false,
          error: 'Download limits require PRO plan',
          upgradeRequired: true
        });
      }
      
      // Calculate expiry (default: never for PRO, 7 days for USER)
      let expiresAt = null;
      if (expiresIn && expiresIn !== 'never') {
        const expiryMap = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000
        };
        expiresAt = new Date(Date.now() + (expiryMap[expiresIn] || expiryMap['7d']));
      } else if (userRole === 'USER') {
        // Free users: default 7 days
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      
      // Generate token and HMAC salt
      const token = ShareLink.generateToken();
      const hmacSalt = ShareLink.generateHmacSalt();
      
      // Create share link
      const shareLink = new ShareLink({
        fileId: file._id,
        ownerId: userId,
        token,
        hmacSalt,
        expiresAt,
        maxDownloads: maxDownloads ? parseInt(maxDownloads, 10) : null,
        ipThrottlePerMin: ipThrottlePerMin ? parseInt(ipThrottlePerMin, 10) : 10
      });
      
      // Set password if provided
      if (password) {
        await shareLink.setPassword(password);
      }
      
      await shareLink.save();
      
      // Generate signed URL
      const expiresTimestamp = expiresAt ? Math.floor(expiresAt.getTime() / 1000) : 0;
      const signature = ShareLink.createSignature(token, expiresTimestamp, HMAC_SECRET, hmacSalt);
      
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const shareUrl = expiresAt
        ? `${baseUrl}/s/${token}?sig=${signature}&exp=${expiresTimestamp}`
        : `${baseUrl}/s/${token}?sig=${signature}`;
      
      // Audit log
      await AuditLog.logFromRequest(req, 'share.create', {
        targetType: 'share',
        targetId: shareLink._id,
        metadata: {
          fileId: file._id,
          hasPassword: !!password,
          hasExpiry: !!expiresAt,
          maxDownloads: shareLink.maxDownloads
        }
      });
      
      return res.status(201).json({
        success: true,
        shareLink: {
          id: shareLink._id,
          token: shareLink.token,
          url: shareUrl,
          expiresAt: shareLink.expiresAt,
          hasPassword: !!password,
          maxDownloads: shareLink.maxDownloads,
          ipThrottlePerMin: shareLink.ipThrottlePerMin
        }
      });
      
    } catch (error) {
      console.error('Create share link error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create share link'
      });
    }
  }
);

/**
 * @route   POST /api/share/revoke
 * @desc    Revoke a share link
 * @access  Private (owner only)
 */
router.post('/revoke',
  ensureApiAuth,
  async (req, res) => {
    try {
      const { shareLinkId, token } = req.body;
      const userId = req.user._id;
      
      // Find by ID or token
      const query = shareLinkId 
        ? { _id: shareLinkId }
        : { token };
        
      const shareLink = await ShareLink.findOne(query);
      
      if (!shareLink) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found'
        });
      }
      
      // Check ownership
      if (shareLink.ownerId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You can only revoke your own share links'
        });
      }
      
      // Revoke
      await shareLink.revoke();
      
      // Audit log
      await AuditLog.logFromRequest(req, 'share.revoke', {
        targetType: 'share',
        targetId: shareLink._id
      });
      
      return res.json({
        success: true,
        message: 'Share link revoked'
      });
      
    } catch (error) {
      console.error('Revoke share link error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke share link'
      });
    }
  }
);

/**
 * @route   GET /api/share/:token
 * @desc    Access a share link (get file info)
 * @access  Public (with signature validation)
 * 
 * Returns file metadata. If password protected, client must call
 * POST /share/:token/verify-password before downloading.
 */
router.get('/:token',
  shareAccessLimiter,
  optionalAuth,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { sig, exp } = req.query;
      
      // Find share link
      const shareLink = await ShareLink.findOne({ token });
      
      if (!shareLink) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found or expired'
        });
      }
      
      // Validate HMAC signature
      if (sig) {
        const expTimestamp = parseInt(exp, 10) || 0;
        
        try {
          const isValidSig = ShareLink.verifySignature(
            sig,
            token,
            expTimestamp,
            HMAC_SECRET,
            shareLink.hmacSalt
          );
          
          if (!isValidSig) {
            await AuditLog.logFromRequest(req, 'share.access', {
              targetType: 'share',
              targetId: shareLink._id,
              success: false,
              errorMessage: 'Invalid signature'
            });
            
            return res.status(403).json({
              success: false,
              error: 'Invalid or tampered link'
            });
          }
          
          // Check if signature expired (if exp was provided in URL)
          if (expTimestamp > 0 && Date.now() > expTimestamp * 1000) {
            return res.status(410).json({
              success: false,
              error: 'This link has expired'
            });
          }
        } catch (sigError) {
          return res.status(403).json({
            success: false,
            error: 'Invalid signature format'
          });
        }
      }
      
      // Check if link is valid
      if (!shareLink.isValid()) {
        let error = 'This link is no longer valid';
        
        if (shareLink.revokedAt) {
          error = 'This link has been revoked';
        } else if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
          error = 'This link has expired';
        } else if (shareLink.maxDownloads && shareLink.downloadsCount >= shareLink.maxDownloads) {
          error = 'This link has reached its download limit';
        }
        
        return res.status(410).json({
          success: false,
          error
        });
      }
      
      // Check IP throttle
      const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
      if (shareLink.isIpThrottled(ip)) {
        await AuditLog.logFromRequest(req, 'share.throttled', {
          targetType: 'share',
          targetId: shareLink._id,
          success: false
        });
        
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please wait a moment.',
          code: 'IP_THROTTLED'
        });
      }
      
      // Log access
      await shareLink.logAccess(ip, req.headers['user-agent'], 'view');
      
      // Get file info
      const file = await File.findById(shareLink.fileId);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      // Check if password required (but don't include hash!)
      const needsPassword = !!(await ShareLink.findById(shareLink._id).select('+passwordHash')).passwordHash;
      
      // Audit log
      await AuditLog.logFromRequest(req, 'share.access', {
        targetType: 'share',
        targetId: shareLink._id,
        success: true
      });
      
      return res.json({
        success: true,
        requiresPassword: needsPassword,
        file: {
          name: file.originalName || file.filename,
          size: file.size,
          mimeType: file.mimetype,
          createdAt: file.createdAt
        },
        shareLink: {
          expiresAt: shareLink.expiresAt,
          maxDownloads: shareLink.maxDownloads,
          downloadsCount: shareLink.downloadsCount
        }
      });
      
    } catch (error) {
      console.error('Share access error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to access share link'
      });
    }
  }
);

/**
 * @route   POST /api/share/:token/verify-password
 * @desc    Verify password for a protected share link
 * @access  Public
 */
router.post('/:token/verify-password',
  shareAccessLimiter,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
      
      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password is required'
        });
      }
      
      // Find share link with password
      const shareLink = await ShareLink.findOne({ token }).select('+passwordHash');
      
      if (!shareLink) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found'
        });
      }
      
      // Check IP throttle for password attempts
      if (shareLink.isIpThrottled(ip)) {
        return res.status(429).json({
          success: false,
          error: 'Too many attempts. Please wait.',
          code: 'IP_THROTTLED'
        });
      }
      
      // Verify password
      const isValid = await shareLink.verifyPassword(password);
      
      // Log attempt
      await shareLink.logAccess(ip, req.headers['user-agent'], 'password_attempt', isValid);
      
      if (!isValid) {
        await AuditLog.logFromRequest(req, 'share.password_failed', {
          targetType: 'share',
          targetId: shareLink._id,
          success: false
        });
        
        return res.status(401).json({
          success: false,
          error: 'Incorrect password'
        });
      }
      
      // Generate a one-time download token (valid for 5 minutes)
      const downloadToken = crypto.randomBytes(32).toString('hex');
      
      // Store temporarily in shareLink or Redis
      // For now, simple approach: encode expiry in token itself
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const downloadAuthSig = crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(`${token}:${downloadToken}:${expiresAt}`)
        .digest('hex');
      
      return res.json({
        success: true,
        downloadToken,
        downloadAuth: {
          sig: downloadAuthSig,
          exp: expiresAt
        }
      });
      
    } catch (error) {
      console.error('Password verify error:', error);
      return res.status(500).json({
        success: false,
        error: 'Password verification failed'
      });
    }
  }
);

/**
 * @route   GET /api/share/:token/download
 * @desc    Download file through share link
 * @access  Public (with validations)
 */
router.get('/:token/download',
  shareAccessLimiter,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { sig, exp, downloadToken, downloadAuth } = req.query;
      const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
      
      // Find share link
      const shareLink = await ShareLink.findOne({ token }).select('+passwordHash');
      
      if (!shareLink) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found'
        });
      }
      
      // Check validity
      if (!shareLink.isValid()) {
        return res.status(410).json({
          success: false,
          error: 'This link is no longer valid'
        });
      }
      
      // Check IP throttle
      if (shareLink.isIpThrottled(ip)) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests'
        });
      }
      
      // If password protected, verify download token
      if (shareLink.passwordHash) {
        if (!downloadToken || !downloadAuth) {
          return res.status(401).json({
            success: false,
            error: 'Password verification required',
            code: 'PASSWORD_REQUIRED'
          });
        }
        
        // Parse downloadAuth (could be JSON or query param)
        let authSig, authExp;
        try {
          const authData = typeof downloadAuth === 'string' 
            ? JSON.parse(downloadAuth) 
            : downloadAuth;
          authSig = authData.sig;
          authExp = parseInt(authData.exp, 10);
        } catch (e) {
          return res.status(401).json({
            success: false,
            error: 'Invalid download authorization'
          });
        }
        
        // Verify download token hasn't expired
        if (Date.now() > authExp) {
          return res.status(401).json({
            success: false,
            error: 'Download authorization expired',
            code: 'AUTH_EXPIRED'
          });
        }
        
        // Verify signature
        const expectedSig = crypto
          .createHmac('sha256', HMAC_SECRET)
          .update(`${token}:${downloadToken}:${authExp}`)
          .digest('hex');
        
        if (!crypto.timingSafeEqual(Buffer.from(authSig), Buffer.from(expectedSig))) {
          return res.status(401).json({
            success: false,
            error: 'Invalid download authorization'
          });
        }
      }
      
      // Get file
      const file = await File.findById(shareLink.fileId);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      
      // Increment download count
      await shareLink.incrementDownload();
      
      // Log download
      await shareLink.logAccess(ip, req.headers['user-agent'], 'download');
      await AuditLog.logFromRequest(req, 'file.download', {
        targetType: 'file',
        targetId: file._id,
        metadata: {
          shareToken: token,
          downloadsCount: shareLink.downloadsCount
        }
      });
      
      // Redirect to file download (reuse existing file download logic)
      // Could also stream directly from Cloudinary here
      return res.redirect(`/api/files/${file.uuid}`);
      
    } catch (error) {
      console.error('Share download error:', error);
      return res.status(500).json({
        success: false,
        error: 'Download failed'
      });
    }
  }
);

/**
 * @route   GET /api/share/user/links
 * @desc    Get all share links for current user
 * @access  Private
 */
router.get('/user/links',
  ensureApiAuth,
  async (req, res) => {
    try {
      const links = await ShareLink.find({ 
        ownerId: req.user._id,
        revokedAt: null
      })
        .populate('fileId', 'uuid originalName filename size')
        .sort({ createdAt: -1 })
        .limit(100);
      
      return res.json({
        success: true,
        links: links.map(link => ({
          id: link._id,
          token: link.token,
          file: link.fileId ? {
            uuid: link.fileId.uuid,
            name: link.fileId.originalName || link.fileId.filename,
            size: link.fileId.size
          } : null,
          expiresAt: link.expiresAt,
          maxDownloads: link.maxDownloads,
          downloadsCount: link.downloadsCount,
          createdAt: link.createdAt
        }))
      });
      
    } catch (error) {
      console.error('Get user links error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get share links'
      });
    }
  }
);

module.exports = router;
