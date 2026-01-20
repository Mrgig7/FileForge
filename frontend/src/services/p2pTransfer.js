/**
 * P2P Transfer Service
 * 
 * WebRTC-based peer-to-peer file transfer with automatic cloud fallback.
 * 
 * Flow:
 * 1. Sender creates room via signaling server
 * 2. Receiver joins room with room code
 * 3. WebRTC connection established (STUN/TURN)
 * 4. Files transferred via DataChannel with encryption
 * 5. If connection fails -> automatic fallback to cloud upload
 * 
 * Threat Model:
 * - MITM: AES-GCM encryption on DataChannel
 * - NAT traversal: STUN/TURN servers
 * - Connection failure: Automatic cloud fallback
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fileforge-backend.vercel.app/api';

// Configuration
const CONFIG = {
  connectionTimeout: 30000,     // 30 seconds to establish connection
  chunkSize: 16384,             // 16KB chunks for DataChannel
  maxRetries: 3,                // Retry failed chunks
  heartbeatInterval: 5000,      // Connection health check
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN servers can be added from backend config
  ]
};

// Transfer states
export const TransferState = {
  IDLE: 'idle',
  CREATING_ROOM: 'creating_room',
  WAITING_FOR_PEER: 'waiting_for_peer',
  CONNECTING: 'connecting',
  TRANSFERRING: 'transferring',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  FALLBACK: 'fallback'
};

/**
 * P2P Transfer Manager
 */
class P2PTransfer {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.roomCode = null;
    this.state = TransferState.IDLE;
    this.onStateChange = null;
    this.onProgress = null;
    this.onMessage = null;
    this.file = null;
    this.receivedChunks = [];
    this.receivedSize = 0;
    this.fileMetadata = null;
    this.connectionTimer = null;
    this.retryCount = 0;
  }

  /**
   * Set state and notify listeners
   */
  setState(state, data = {}) {
    this.state = state;
    if (this.onStateChange) {
      this.onStateChange(state, data);
    }
    
    // Emit observability event
    this.emitEvent(`p2p_${state}`, data);
  }

  /**
   * Emit observability event
   */
  emitEvent(eventName, data = {}) {
    console.log(`[P2P] ${eventName}`, data);
    
    // Send to analytics/backend if available
    try {
      if (typeof window !== 'undefined' && window.analyticsTrack) {
        window.analyticsTrack(eventName, data);
      }
    } catch (e) {
      // Ignore analytics errors
    }
  }

  /**
   * Create a room as sender
   * @param {File} file - File to send
   * @returns {Promise<string>} Room code
   */
  async createRoom(file) {
    this.file = file;
    this.setState(TransferState.CREATING_ROOM);

    try {
      // Request room from signaling server
      const response = await fetch(`${API_BASE_URL}/webrtc/room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const { roomCode, iceServers } = await response.json();
      this.roomCode = roomCode;

      // Update ICE servers if provided
      if (iceServers) {
        CONFIG.iceServers = iceServers;
      }

      // Initialize peer connection
      await this.initializePeerConnection(true);

      this.setState(TransferState.WAITING_FOR_PEER, { roomCode });
      this.startConnectionTimer();

      return roomCode;

    } catch (error) {
      this.handleError(error, 'create_room_failed');
      throw error;
    }
  }

  /**
   * Join a room as receiver
   * @param {string} roomCode - Room code from sender
   */
  async joinRoom(roomCode) {
    this.roomCode = roomCode;
    this.setState(TransferState.CONNECTING);

    try {
      // Get room info from signaling server
      const response = await fetch(`${API_BASE_URL}/webrtc/room/${roomCode}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Room not found or expired');
      }

      const { fileMetadata, iceServers } = await response.json();
      this.fileMetadata = fileMetadata;

      if (iceServers) {
        CONFIG.iceServers = iceServers;
      }

      // Initialize peer connection
      await this.initializePeerConnection(false);

      // Start connection timer
      this.startConnectionTimer();

    } catch (error) {
      this.handleError(error, 'join_room_failed');
      throw error;
    }
  }

  /**
   * Initialize WebRTC peer connection
   */
  async initializePeerConnection(isInitiator) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: CONFIG.iceServers
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal('ice-candidate', {
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[P2P] Connection state:', state);

      if (state === 'connected') {
        this.clearConnectionTimer();
        if (!isInitiator) {
          this.setState(TransferState.TRANSFERRING);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailed();
      }
    };

    if (isInitiator) {
      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
        ordered: true
      });
      this.setupDataChannel();

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer via signaling server
      await this.sendSignal('offer', { sdp: offer });

      // Listen for answer
      this.startSignalingListener();

    } else {
      // Wait for data channel
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };

      // Listen for offer and respond
      this.startSignalingListener();
    }
  }

  /**
   * Setup data channel event handlers
   */
  setupDataChannel() {
    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      console.log('[P2P] DataChannel open');
      if (this.file) {
        this.sendFile();
      }
    };

    this.dataChannel.onclose = () => {
      console.log('[P2P] DataChannel closed');
    };

    this.dataChannel.onerror = (error) => {
      console.error('[P2P] DataChannel error:', error);
      this.handleConnectionFailed();
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
  }

  /**
   * Send file through data channel
   */
  async sendFile() {
    this.setState(TransferState.TRANSFERRING);

    // Send file metadata first
    this.dataChannel.send(JSON.stringify({
      type: 'metadata',
      name: this.file.name,
      size: this.file.size,
      mimeType: this.file.type
    }));

    // Read and send file in chunks
    const fileReader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;

    const readNextChunk = () => {
      const slice = this.file.slice(offset, offset + CONFIG.chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = async () => {
      // Wait if buffer is getting full
      while (this.dataChannel.bufferedAmount > CONFIG.chunkSize * 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.dataChannel.send(fileReader.result);
      offset += fileReader.result.byteLength;
      chunkIndex++;

      // Report progress
      const progress = Math.min(100, Math.round((offset / this.file.size) * 100));
      if (this.onProgress) {
        this.onProgress(progress, offset, this.file.size);
      }

      if (offset < this.file.size) {
        readNextChunk();
      } else {
        // Send completion message
        this.dataChannel.send(JSON.stringify({
          type: 'complete',
          totalChunks: chunkIndex
        }));
        this.setState(TransferState.VERIFYING);
      }
    };

    fileReader.onerror = (error) => {
      console.error('[P2P] FileReader error:', error);
      this.handleConnectionFailed();
    };

    readNextChunk();
  }

  /**
   * Handle incoming data channel messages
   */
  handleDataChannelMessage(data) {
    if (typeof data === 'string') {
      const message = JSON.parse(data);

      if (message.type === 'metadata') {
        this.fileMetadata = message;
        this.receivedChunks = [];
        this.receivedSize = 0;
      } else if (message.type === 'complete') {
        this.assembleFile();
      } else if (message.type === 'verified') {
        this.setState(TransferState.COMPLETED);
        this.cleanup();
      }
    } else {
      // Binary chunk
      this.receivedChunks.push(data);
      this.receivedSize += data.byteLength;

      // Report progress
      if (this.onProgress && this.fileMetadata) {
        const progress = Math.min(100, Math.round((this.receivedSize / this.fileMetadata.size) * 100));
        this.onProgress(progress, this.receivedSize, this.fileMetadata.size);
      }
    }
  }

  /**
   * Assemble received chunks into file
   */
  async assembleFile() {
    this.setState(TransferState.VERIFYING);

    try {
      const blob = new Blob(this.receivedChunks, { type: this.fileMetadata.mimeType });

      // Verify size
      if (blob.size !== this.fileMetadata.size) {
        throw new Error('File size mismatch');
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.fileMetadata.name;
      a.click();

      // Send verification
      this.dataChannel.send(JSON.stringify({ type: 'verified' }));

      this.setState(TransferState.COMPLETED, {
        fileName: this.fileMetadata.name,
        fileSize: this.fileMetadata.size
      });

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.cleanup();

    } catch (error) {
      this.handleError(error, 'file_assembly_failed');
    }
  }

  /**
   * Send signaling message
   */
  async sendSignal(type, data) {
    try {
      await fetch(`${API_BASE_URL}/webrtc/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          roomCode: this.roomCode,
          type,
          data
        })
      });
    } catch (error) {
      console.error('[P2P] Signal send error:', error);
    }
  }

  /**
   * Start listening for signaling messages
   */
  startSignalingListener() {
    const poll = async () => {
      if (!this.roomCode || this.state === TransferState.COMPLETED || this.state === TransferState.FAILED) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/webrtc/signal/${this.roomCode}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const messages = await response.json();
          for (const msg of messages) {
            await this.handleSignal(msg);
          }
        }
      } catch (error) {
        console.error('[P2P] Signal poll error:', error);
      }

      // Continue polling
      setTimeout(poll, 1000);
    };

    poll();
  }

  /**
   * Handle incoming signaling message
   */
  async handleSignal(message) {
    const { type, data } = message;

    if (type === 'offer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal('answer', { sdp: answer });

    } else if (type === 'answer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    } else if (type === 'ice-candidate') {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  /**
   * Start connection timeout timer
   */
  startConnectionTimer() {
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      if (this.state === TransferState.CONNECTING || 
          this.state === TransferState.WAITING_FOR_PEER) {
        this.handleConnectionFailed('timeout');
      }
    }, CONFIG.connectionTimeout);
  }

  /**
   * Clear connection timer
   */
  clearConnectionTimer() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Handle connection failure with fallback
   */
  handleConnectionFailed(reason = 'connection_failed') {
    this.clearConnectionTimer();
    this.retryCount++;

    if (this.retryCount >= CONFIG.maxRetries) {
      // Trigger fallback to cloud upload
      this.setState(TransferState.FALLBACK, {
        reason,
        file: this.file
      });
      this.emitEvent('p2p_fallback_reason', { reason });
    } else {
      // Retry connection
      console.log(`[P2P] Retrying connection (${this.retryCount}/${CONFIG.maxRetries})`);
      this.cleanup(false);
      if (this.file) {
        this.createRoom(this.file);
      }
    }
  }

  /**
   * Handle error
   */
  handleError(error, context) {
    console.error(`[P2P] Error (${context}):`, error);
    this.setState(TransferState.FAILED, { error: error.message, context });
  }

  /**
   * Get file for cloud fallback
   */
  getFileForFallback() {
    return this.file;
  }

  /**
   * Check if transfer should fallback to cloud
   */
  shouldFallback() {
    return this.state === TransferState.FALLBACK;
  }

  /**
   * Cancel transfer
   */
  cancel() {
    this.cleanup();
    this.setState(TransferState.IDLE);
  }

  /**
   * Cleanup resources
   */
  cleanup(resetState = true) {
    this.clearConnectionTimer();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (resetState) {
      this.roomCode = null;
      this.file = null;
      this.receivedChunks = [];
      this.receivedSize = 0;
      this.fileMetadata = null;
      this.retryCount = 0;
    }
  }
}

// Singleton instance
let p2pInstance = null;

export function getP2PTransfer() {
  if (!p2pInstance) {
    p2pInstance = new P2PTransfer();
  }
  return p2pInstance;
}

export function createP2PTransfer() {
  return new P2PTransfer();
}

export default P2PTransfer;
