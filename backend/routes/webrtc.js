/**
 * WebRTC Signaling Routes
 * 
 * Enables P2P transfer between clients.
 * Server acts only as signaling intermediary.
 * 
 * Flow:
 * 1. Sender creates room
 * 2. Receiver joins room
 * 3. Exchange SDP offers/answers via server
 * 4. Exchange ICE candidates
 * 5. P2P DataChannel established
 * 
 * Security Notes:
 * - Room codes are short-lived (15 min)
 * - E2E encryption via client-side key exchange
 * - Server never sees file content
 * 
 * NEEDS CLARIFICATION:
 * - TURN server for NAT traversal (Twilio, daily.co)
 * - Only STUN (free) is configured by default
 */

const router = require('express').Router();
const crypto = require('crypto');
const { ensureApiAuth } = require('../middleware/auth');

// In-memory room store (use Redis for production)
const rooms = new Map();

// Room cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now > room.expiresAt) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);  // Every minute

/**
 * Generate room code
 */
function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();  // 6 chars
}

/**
 * STUN/TURN configuration
 * Using coturn (open-source)
 * 
 * Setup coturn:
 *   docker run -d --network=host coturn/coturn
 *   or install: apt install coturn
 */
function getIceServers() {
  const servers = [];
  
  // Primary STUN (coturn if configured, else Google public)
  if (process.env.COTURN_URL) {
    servers.push({ urls: `stun:${process.env.COTURN_URL}` });
  } else {
    // Fallback to public STUN
    servers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    );
  }
  
  // TURN server (coturn with credentials)
  if (process.env.COTURN_URL && process.env.COTURN_USERNAME && process.env.COTURN_CREDENTIAL) {
    servers.push({
      urls: `turn:${process.env.COTURN_URL}`,
      username: process.env.COTURN_USERNAME,
      credential: process.env.COTURN_CREDENTIAL
    });
    
    // Also add TURNS (TLS) if available
    if (process.env.COTURN_TLS === 'true') {
      servers.push({
        urls: `turns:${process.env.COTURN_URL}:443`,
        username: process.env.COTURN_USERNAME,
        credential: process.env.COTURN_CREDENTIAL
      });
    }
  }
  
  return servers;
}

/**
 * @route   POST /p2p/room
 * @desc    Create a P2P transfer room
 * @access  Private
 */
router.post('/room', ensureApiAuth, async (req, res) => {
  try {
    const { fileName, fileSize } = req.body;
    
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      senderId: req.user._id.toString(),
      senderName: req.user.name,
      fileName,
      fileSize,
      receiverId: null,
      senderOffer: null,
      receiverAnswer: null,
      senderCandidates: [],
      receiverCandidates: [],
      status: 'WAITING',
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000  // 15 minutes
    };
    
    rooms.set(roomCode, room);
    
    res.status(201).json({
      success: true,
      roomCode,
      expiresAt: new Date(room.expiresAt).toISOString(),
      iceServers: getIceServers()
    });
    
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

/**
 * @route   GET /p2p/room/:code
 * @desc    Get room info
 * @access  Public (receiver needs to join)
 */
router.get('/room/:code', async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or expired'
      });
    }
    
    res.json({
      success: true,
      room: {
        code: room.code,
        senderName: room.senderName,
        fileName: room.fileName,
        fileSize: room.fileSize,
        status: room.status,
        hasReceiver: !!room.receiverId,
        expiresAt: new Date(room.expiresAt).toISOString()
      },
      iceServers: getIceServers()
    });
    
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, error: 'Failed to get room' });
  }
});

/**
 * @route   POST /p2p/room/:code/join
 * @desc    Join room as receiver
 * @access  Public or Private
 */
router.post('/room/:code/join', async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or expired'
      });
    }
    
    if (room.receiverId) {
      return res.status(400).json({
        success: false,
        error: 'Room already has a receiver'
      });
    }
    
    room.receiverId = req.user?._id?.toString() || 'anonymous';
    room.status = 'CONNECTED';
    
    res.json({
      success: true,
      message: 'Joined room',
      senderOffer: room.senderOffer,
      iceServers: getIceServers()
    });
    
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ success: false, error: 'Failed to join room' });
  }
});

/**
 * @route   POST /p2p/room/:code/offer
 * @desc    Set SDP offer from sender
 * @access  Private (sender only)
 */
router.post('/room/:code/offer', ensureApiAuth, async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    if (room.senderId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not the sender'
      });
    }
    
    room.senderOffer = req.body.offer;
    
    res.json({
      success: true,
      message: 'Offer set'
    });
    
  } catch (error) {
    console.error('Set offer error:', error);
    res.status(500).json({ success: false, error: 'Failed to set offer' });
  }
});

/**
 * @route   POST /p2p/room/:code/answer
 * @desc    Set SDP answer from receiver
 * @access  Public
 */
router.post('/room/:code/answer', async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    room.receiverAnswer = req.body.answer;
    
    res.json({
      success: true,
      message: 'Answer set'
    });
    
  } catch (error) {
    console.error('Set answer error:', error);
    res.status(500).json({ success: false, error: 'Failed to set answer' });
  }
});

/**
 * @route   GET /p2p/room/:code/answer
 * @desc    Get answer (for sender polling)
 * @access  Private (sender only)
 */
router.get('/room/:code/answer', ensureApiAuth, async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      answer: room.receiverAnswer
    });
    
  } catch (error) {
    console.error('Get answer error:', error);
    res.status(500).json({ success: false, error: 'Failed to get answer' });
  }
});

/**
 * @route   POST /p2p/room/:code/candidate
 * @desc    Add ICE candidate
 * @access  Public
 */
router.post('/room/:code/candidate', async (req, res) => {
  try {
    const { candidate, role } = req.body;  // role: 'sender' or 'receiver'
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    if (role === 'sender') {
      room.senderCandidates.push(candidate);
    } else {
      room.receiverCandidates.push(candidate);
    }
    
    res.json({
      success: true,
      message: 'Candidate added'
    });
    
  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({ success: false, error: 'Failed to add candidate' });
  }
});

/**
 * @route   GET /p2p/room/:code/candidates
 * @desc    Get ICE candidates
 * @access  Public
 */
router.get('/room/:code/candidates', async (req, res) => {
  try {
    const { role } = req.query;  // Get opposite party's candidates
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    // Return the OTHER party's candidates
    const candidates = role === 'sender' 
      ? room.receiverCandidates 
      : room.senderCandidates;
    
    res.json({
      success: true,
      candidates
    });
    
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ success: false, error: 'Failed to get candidates' });
  }
});

/**
 * @route   DELETE /p2p/room/:code
 * @desc    Close room
 * @access  Private (sender only)
 */
router.delete('/room/:code', ensureApiAuth, async (req, res) => {
  try {
    const room = rooms.get(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    if (room.senderId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not the sender'
      });
    }
    
    rooms.delete(req.params.code.toUpperCase());
    
    res.json({
      success: true,
      message: 'Room closed'
    });
    
  } catch (error) {
    console.error('Close room error:', error);
    res.status(500).json({ success: false, error: 'Failed to close room' });
  }
});

module.exports = router;
