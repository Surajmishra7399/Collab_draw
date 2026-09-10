/**
 * client/js/websocket.js
 * Robust Socket.io Real-Time Synchronization Client
 */

import { state } from './state.js';
import { throttle } from './utils.js';

export class WebSocketClient {
  constructor(callbacks = {}) {
    this.socket = null;
    this.callbacks = callbacks;
    this.isReconnecting = false;

    // Cursor update throttling (send at most once every 35ms)
    this.emitCursorThrottled = throttle((coords) => {
      if (this.isConnected() && state.currentUser.roomId) {
        this.socket.emit('cursor-move', {
          roomId: state.currentUser.roomId,
          x: coords.x,
          y: coords.y,
        });
      }
    }, 35);
  }

  /**
   * Initialize Socket.io connection
   */
  connect() {
    if (this.socket) return;

    // Connect to same origin
    // io is provided globally by /socket.io/socket.io.js
    if (typeof window.io === 'undefined') {
      console.warn('Socket.io client library not loaded yet. Retrying...');
      setTimeout(() => this.connect(), 500);
      return;
    }

    this.socket = window.io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    this.setupSocketHandlers();
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  setupSocketHandlers() {
    this.socket.on('connect', () => {
      state.setConnectionStatus('connected');

      // Auto-rejoin room if we had already joined before reconnecting
      if (state.currentUser.roomId && state.currentUser.username) {
        this.joinRoom(state.currentUser.roomId, state.currentUser.username);
      }
    });

    this.socket.on('disconnect', (reason) => {
      state.setConnectionStatus('offline');
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        this.socket.connect();
      }
    });

    this.socket.io.on('reconnect_attempt', () => {
      state.setConnectionStatus('reconnecting');
    });

    this.socket.io.on('reconnect', () => {
      state.setConnectionStatus('connected');
    });

    this.socket.on('connect_error', () => {
      state.setConnectionStatus('offline');
    });

    // Room State Synchronization
    this.socket.on('state-sync', (payload) => {
      this.callbacks.onStateSync?.(payload);
    });

    // Collaborator Presence
    this.socket.on('user-joined', (payload) => {
      this.callbacks.onUserJoined?.(payload);
    });

    this.socket.on('user-left', (payload) => {
      this.callbacks.onUserLeft?.(payload);
    });

    // Streaming Remote Strokes
    this.socket.on('stroke-start', (payload) => {
      this.callbacks.onRemoteStrokeStart?.(payload);
    });

    this.socket.on('stroke-points', (payload) => {
      this.callbacks.onRemoteStrokePoints?.(payload);
    });

    this.socket.on('stroke-end', (payload) => {
      this.callbacks.onRemoteStrokeEnd?.(payload);
    });

    // Remote Cursor Movement
    this.socket.on('cursor-move', (payload) => {
      this.callbacks.onRemoteCursorMove?.(payload);
    });

    // History Actions: Global Undo / Redo / Clear
    this.socket.on('undo', (payload) => {
      this.callbacks.onRemoteUndo?.(payload);
    });

    this.socket.on('redo', (payload) => {
      this.callbacks.onRemoteRedo?.(payload);
    });

    this.socket.on('clear-canvas', (payload) => {
      this.callbacks.onRemoteClear?.(payload);
    });

    // Error from server
    this.socket.on('error', (payload) => {
      this.callbacks.onError?.(payload);
    });
  }

  /* ========================================================================
     OUTGOING CLIENT EMISSIONS
     ======================================================================== */

  joinRoom(roomId, username, callback) {
    if (!this.socket) this.connect();

    this.socket.emit(
      'join-room',
      {
        roomId,
        username,
        userId: state.currentUser.userId,
      },
      (response) => {
        if (callback) callback(response);
      }
    );
  }

  leaveRoom() {
    if (this.socket && state.currentUser.roomId) {
      this.socket.emit('leave-room', {
        roomId: state.currentUser.roomId,
        userId: state.currentUser.userId,
      });
    }
  }

  emitStrokeStart(data) {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('stroke-start', {
      roomId: state.currentUser.roomId,
      ...data,
    });
  }

  emitStrokePoints(data) {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('stroke-points', {
      roomId: state.currentUser.roomId,
      ...data,
    });
  }

  emitStrokeEnd(data) {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('stroke-end', {
      roomId: state.currentUser.roomId,
      ...data,
    });
  }

  emitCursorMove(coords) {
    this.emitCursorThrottled(coords);
  }

  emitUndo() {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('undo', {
      roomId: state.currentUser.roomId,
      userId: state.currentUser.userId,
    });
  }

  emitRedo() {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('redo', {
      roomId: state.currentUser.roomId,
      userId: state.currentUser.userId,
    });
  }

  emitClear() {
    if (!this.isConnected() || !state.currentUser.roomId) return;
    this.socket.emit('clear-canvas', {
      roomId: state.currentUser.roomId,
      userId: state.currentUser.userId,
    });
  }
}
