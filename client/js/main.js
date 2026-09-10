/**
 * client/js/main.js
 * Application Bootstrap & Coordination
 */

import { state } from './state.js';
import { generateRoomId, getRoomIdFromUrl } from './utils.js';
import { CanvasEngine } from './canvas.js';
import { CursorOverlay } from './cursor.js';
import { WebSocketClient } from './websocket.js';
import { UIController } from './ui.js';

class CollabDrawApp {
  constructor() {
    this.canvasEngine = null;
    this.cursorOverlay = null;
    this.wsClient = null;
    this.ui = null;
  }

  init() {
    // 1. Initialize Overlay
    const overlayEl = document.getElementById('cursor-overlay');
    this.cursorOverlay = new CursorOverlay(overlayEl);

    // 2. Initialize WebSocket Client with event listeners
    this.wsClient = new WebSocketClient({
      onStateSync: (payload) => {
        state.syncState(payload);
        if (payload.users) {
          state.setUsers(payload.users);
        }
        this.canvasEngine.redrawAll();
      },

      onUserJoined: (payload) => {
        if (payload.user && payload.user.userId !== state.currentUser.userId) {
          state.addUser(payload.user);
          this.ui.showToast(`${payload.user.username} joined the room`, 'info');
        }
      },

      onUserLeft: (payload) => {
        if (payload.userId && payload.userId !== state.currentUser.userId) {
          state.removeUser(payload.userId);
          this.cursorOverlay.removeCursor(payload.userId);
          this.ui.showToast(`${payload.username || 'Collaborator'} left the room`, 'info');
        }
      },

      onRemoteStrokeStart: (payload) => {
        if (payload.userId !== state.currentUser.userId) {
          this.canvasEngine.handleRemoteStrokeStart(payload);
        }
      },

      onRemoteStrokePoints: (payload) => {
        this.canvasEngine.handleRemoteStrokePoints(payload);
      },

      onRemoteStrokeEnd: (payload) => {
        this.canvasEngine.handleRemoteStrokeEnd(payload);
      },

      onRemoteCursorMove: (payload) => {
        if (payload.userId !== state.currentUser.userId) {
          this.cursorOverlay.updateCursor(
            payload.userId,
            payload.username,
            payload.userColor,
            payload.x,
            payload.y
          );
        }
      },

      onRemoteUndo: (payload) => {
        state.undoOperation(payload.operationId);
        this.canvasEngine.redrawAll();
      },

      onRemoteRedo: (payload) => {
        state.redoOperation(payload.operation);
        this.canvasEngine.redrawAll();
      },

      onRemoteClear: (payload) => {
        state.clearCanvas(payload.operation);
        this.canvasEngine.redrawAll();
        this.ui.showToast('Canvas was cleared', 'info');
      },

      onError: (payload) => {
        this.ui.showToast(payload.message || 'An error occurred', 'danger');
      },
    });

    // 3. Initialize Drawing Canvas Engine
    const canvasEl = document.getElementById('drawing-canvas');
    const stageEl = document.getElementById('canvas-stage');
    this.canvasEngine = new CanvasEngine(canvasEl, stageEl, {
      onStrokeStart: (data) => this.wsClient.emitStrokeStart(data),
      onStrokePoints: (data) => this.wsClient.emitStrokePoints(data),
      onStrokeEnd: (data) => this.wsClient.emitStrokeEnd(data),
      onCursorMove: (coords) => this.wsClient.emitCursorMove(coords),
    });

    // 4. Initialize UI Controller
    this.ui = new UIController({
      onCreateRoom: (username, customRoomId) => {
        const roomId = customRoomId || generateRoomId();
        this.joinSession(roomId, username, true);
      },

      onJoinRoom: (username, roomId) => {
        this.joinSession(roomId, username, false);
      },

      onLeaveRoom: () => {
        this.leaveSession();
      },

      onUndo: () => {
        this.wsClient.emitUndo();
      },

      onRedo: () => {
        this.wsClient.emitRedo();
      },

      onClear: () => {
        this.wsClient.emitClear();
      },
    });

    // Connect WebSocket
    this.wsClient.connect();

    // Check if URL has a room ID (e.g. /room/ABC123 or ?room=ABC123)
    const initialRoom = getRoomIdFromUrl();
    if (initialRoom) {
      const roomInput = document.getElementById('room-input');
      if (roomInput) {
        roomInput.value = initialRoom;
      }
      const usernameInput = document.getElementById('username-input');
      if (usernameInput) {
        usernameInput.focus();
      }
    }

    // Handle browser popstate navigation
    window.addEventListener('popstate', (e) => {
      const targetRoom = getRoomIdFromUrl();
      if (!targetRoom && state.currentUser.roomId) {
        this.leaveSession();
      }
    });
  }

  joinSession(roomId, username, isNewRoom) {
    this.ui.clearLandingError();

    this.wsClient.joinRoom(roomId, username, (response) => {
      if (!response || !response.success) {
        const errorMsg =
          response?.error || 'Room not found. Please check the Room ID.';
        this.ui.showLandingError(errorMsg);
        return;
      }

      // Room joined successfully
      const { user, room } = response;
      state.setCurrentUser(user.username, user.userColor, room.roomId);
      state.setUsers(room.users);
      state.syncState({
        operations: room.operations,
        sequence: room.sequence,
        undoneCount: room.undoneCount || 0,
      });

      this.ui.switchToWorkspace(room.roomId, user.username, user.userColor);

      // Re-setup canvas dimensions for the workspace view
      setTimeout(() => {
        this.canvasEngine.setupResolution();
        this.canvasEngine.redrawAll();
      }, 50);

      this.ui.showToast(`Connected to room ${room.roomId}`, 'success');
    });
  }

  leaveSession() {
    this.wsClient.leaveRoom();
    this.cursorOverlay.clear();
    state.setCurrentUser('', '', null);
    state.syncState({ operations: [], sequence: 0 });
    this.canvasEngine.clearScreen();
    this.ui.switchToLanding();
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CollabDrawApp();
  app.init();
});
