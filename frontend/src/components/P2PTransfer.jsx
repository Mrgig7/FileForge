import { useState, useEffect, useCallback } from 'react';
import { createP2PTransfer, TransferState } from '../services/p2pTransfer';

/**
 * P2P Transfer Component
 * 
 * UI for peer-to-peer file transfer with cloud fallback.
 * 
 * Props:
 * - file: File to send (for sender mode)
 * - onFallback: (file) => void - Called when P2P fails and should fallback to cloud
 * - onComplete: () => void - Called on successful transfer
 * - onCancel: () => void - Called when user cancels
 */
const P2PTransfer = ({ file, onFallback, onComplete, onCancel }) => {
  const [transfer, setTransfer] = useState(null);
  const [state, setState] = useState(TransferState.IDLE);
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'send' or 'receive'

  // Initialize transfer instance
  useEffect(() => {
    const t = createP2PTransfer();
    
    t.onStateChange = (newState, data) => {
      setState(newState);
      
      if (newState === TransferState.WAITING_FOR_PEER && data.roomCode) {
        setRoomCode(data.roomCode);
      }
      
      if (newState === TransferState.FALLBACK && data.file) {
        // Trigger fallback to cloud upload
        onFallback?.(data.file);
      }
      
      if (newState === TransferState.COMPLETED) {
        onComplete?.();
      }
      
      if (newState === TransferState.FAILED) {
        setError(data.error || 'Transfer failed');
      }
    };
    
    t.onProgress = (pct) => {
      setProgress(pct);
    };
    
    setTransfer(t);
    
    return () => {
      t.cleanup();
    };
  }, [onFallback, onComplete]);

  // Auto-start if file provided
  useEffect(() => {
    if (file && transfer && mode === 'send') {
      handleStartSend();
    }
  }, [file, transfer, mode]);

  const handleStartSend = async () => {
    if (!file || !transfer) return;
    
    setError(null);
    try {
      await transfer.createRoom(file);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputRoomCode.trim() || !transfer) return;
    
    setError(null);
    try {
      await transfer.joinRoom(inputRoomCode.trim().toUpperCase());
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    transfer?.cancel();
    onCancel?.();
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  // Render based on mode/state
  const renderContent = () => {
    // Initial mode selection
    if (!mode && state === TransferState.IDLE) {
      return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm text-center mb-4">
            Transfer files directly to another user's browser - no server needed!
          </p>
          
          <button
            onClick={() => setMode('send')}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            📤 Send a File
          </button>
          
          <button
            onClick={() => setMode('receive')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all"
          >
            📥 Receive a File
          </button>
        </div>
      );
    }

    // Sender: waiting for peer
    if (mode === 'send' && state === TransferState.WAITING_FOR_PEER) {
      return (
        <div className="space-y-4 text-center">
          <div className="animate-pulse">
            <span className="text-4xl">📡</span>
          </div>
          <p className="text-gray-400 text-sm">Share this code with the receiver:</p>
          
          <div className="flex items-center justify-center space-x-2">
            <code className="text-3xl font-mono bg-indigo-600/30 px-6 py-3 rounded-xl text-white tracking-widest">
              {roomCode}
            </code>
            <button
              onClick={copyRoomCode}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
              title="Copy code"
            >
              📋
            </button>
          </div>
          
          <p className="text-gray-500 text-xs">
            Waiting for peer to connect...
          </p>
        </div>
      );
    }

    // Receiver: enter code
    if (mode === 'receive' && state === TransferState.IDLE) {
      return (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm text-center">
            Enter the room code from the sender:
          </p>
          
          <input
            type="text"
            value={inputRoomCode}
            onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            maxLength={9}
          />
          
          <button
            onClick={handleJoinRoom}
            disabled={inputRoomCode.length < 5}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      );
    }

    // Connecting
    if (state === TransferState.CONNECTING) {
      return (
        <div className="text-center space-y-4">
          <div className="animate-spin text-4xl">🔄</div>
          <p className="text-gray-400">Establishing secure connection...</p>
          <p className="text-gray-500 text-xs">This may take a few seconds</p>
        </div>
      );
    }

    // Transferring
    if (state === TransferState.TRANSFERRING) {
      return (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-4xl">{mode === 'send' ? '📤' : '📥'}</span>
          </div>
          
          <p className="text-gray-400 text-sm text-center">
            {mode === 'send' ? 'Sending file...' : 'Receiving file...'}
          </p>
          
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-center text-indigo-400 font-mono">{progress}%</p>
        </div>
      );
    }

    // Verifying
    if (state === TransferState.VERIFYING) {
      return (
        <div className="text-center space-y-4">
          <div className="animate-pulse text-4xl">🔍</div>
          <p className="text-gray-400">Verifying file integrity...</p>
        </div>
      );
    }

    // Completed
    if (state === TransferState.COMPLETED) {
      return (
        <div className="text-center space-y-4">
          <div className="text-4xl">✅</div>
          <p className="text-green-400 font-semibold">Transfer Complete!</p>
          <p className="text-gray-500 text-sm">
            File transferred securely peer-to-peer
          </p>
        </div>
      );
    }

    // Fallback
    if (state === TransferState.FALLBACK) {
      return (
        <div className="text-center space-y-4">
          <div className="text-4xl">☁️</div>
          <p className="text-yellow-400 font-semibold">Switching to Cloud Upload</p>
          <p className="text-gray-500 text-sm">
            P2P connection couldn't be established. Uploading via server...
          </p>
        </div>
      );
    }

    // Failed
    if (state === TransferState.FAILED) {
      return (
        <div className="text-center space-y-4">
          <div className="text-4xl">❌</div>
          <p className="text-red-400 font-semibold">Transfer Failed</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setState(TransferState.IDLE);
              setMode(null);
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
          >
            Try Again
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🔗</span> Direct Transfer (P2P)
        </h3>
        {mode && state !== TransferState.COMPLETED && (
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {error && state !== TransferState.FAILED && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {renderContent()}

      {/* Mode switch button */}
      {mode && state === TransferState.IDLE && (
        <button
          onClick={() => {
            setMode(null);
            setInputRoomCode('');
            setError(null);
          }}
          className="mt-4 w-full text-gray-500 hover:text-white text-sm transition-colors"
        >
          ← Back to mode selection
        </button>
      )}
    </div>
  );
};

export default P2PTransfer;
