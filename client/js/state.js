/**
 * client/js/state.js
 * Centralized State Management for CollabDraw
 */

class AppState {
  constructor() {
    this.currentUser = {
      userId: this.getOrCreateUserId(),
      username: '',
      userColor: '#2563eb',
      roomId: null,
    };

    this.toolSettings = {
      tool: 'brush', // 'brush' | 'eraser'
      color: '#1e293b',
      width: 5,
    };

    // Shared Room State (Server Authoritative)
    this.operations = []; // Array of active operations
    this.undoneOperations = []; // Array of undone operations (for redo availability)
    this.sequence = 0;
    this.users = new Map(); // userId -> { userId, username, userColor, cursor: {x, y} }

    // In-flight active strokes by userId (for streaming remote strokes)
    this.activeStrokes = new Map(); // strokeId -> { strokeId, userId, tool, color, width, points: [] }

    // Network / App Status
    this.connectionStatus = 'offline'; // 'connected' | 'reconnecting' | 'offline'

    // Event listeners
    this.listeners = new Map();
  }

  getOrCreateUserId() {
    try {
      const stored = localStorage.getItem('collabdraw_user_id');
      if (stored && stored.length > 5) return stored;
      const newId = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('collabdraw_user_id', newId);
      return newId;
    } catch {
      return `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }
  }

  // Subscribe to state change events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  // Tool settings mutators
  setTool(tool) {
    if (this.toolSettings.tool !== tool) {
      this.toolSettings.tool = tool;
      this.emit('tool-change', this.toolSettings);
    }
  }

  setColor(color) {
    if (this.toolSettings.color !== color) {
      this.toolSettings.color = color;
      this.emit('tool-change', this.toolSettings);
    }
  }

  setWidth(width) {
    const validWidth = Math.max(1, Math.min(50, Number(width) || 5));
    if (this.toolSettings.width !== validWidth) {
      this.toolSettings.width = validWidth;
      this.emit('tool-change', this.toolSettings);
    }
  }

  // User Presence mutators
  setCurrentUser(username, userColor, roomId) {
    this.currentUser.username = username;
    this.currentUser.userColor = userColor;
    this.currentUser.roomId = roomId;
    this.emit('user-info-change', this.currentUser);
  }

  setUsers(usersList) {
    this.users.clear();
    if (Array.isArray(usersList)) {
      usersList.forEach((user) => {
        this.users.set(user.userId, user);
      });
    }
    this.emit('users-change', Array.from(this.users.values()));
  }

  addUser(user) {
    this.users.set(user.userId, user);
    this.emit('users-change', Array.from(this.users.values()));
  }

  removeUser(userId) {
    if (this.users.has(userId)) {
      const removed = this.users.get(userId);
      this.users.delete(userId);
      this.emit('users-change', Array.from(this.users.values()));
      return removed;
    }
    return null;
  }

  updateUserCursor(userId, x, y) {
    if (this.users.has(userId)) {
      const user = this.users.get(userId);
      user.cursor = { x, y };
      this.emit('cursor-change', { userId, user, x, y });
    }
  }

  // Operations & Synchronization
  syncState({ operations, sequence, undoneCount = 0 }) {
    this.operations = Array.isArray(operations) ? operations : [];
    this.sequence = sequence || 0;
    this.emit('state-synced', {
      operations: this.operations,
      sequence: this.sequence,
      canUndo: this.operations.length > 0,
      canRedo: undoneCount > 0,
    });
  }

  addOperation(operation) {
    // Avoid duplicate operations
    const exists = this.operations.some((op) => op.id === operation.id);
    if (!exists) {
      this.operations.push(operation);
      // Sort by sequence for deterministic rendering
      this.operations.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      this.emit('operation-added', operation);
    }
  }

  undoOperation(operationId) {
    const idx = this.operations.findIndex((op) => op.id === operationId);
    if (idx !== -1) {
      const removed = this.operations.splice(idx, 1)[0];
      this.undoneOperations.push(removed);
      this.emit('operation-undone', { operationId, operations: this.operations });
    }
  }

  redoOperation(operation) {
    const exists = this.operations.some((op) => op.id === operation.id);
    if (!exists) {
      this.operations.push(operation);
      this.operations.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      // Remove from undone if present
      this.undoneOperations = this.undoneOperations.filter((op) => op.id !== operation.id);
      this.emit('operation-redone', { operation, operations: this.operations });
    }
  }

  clearCanvas(operation) {
    this.operations = [operation];
    this.emit('canvas-cleared', operation);
  }

  setConnectionStatus(status) {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.emit('connection-status-change', status);
    }
  }

  canUndo() {
    return this.operations.length > 0;
  }

  canRedo() {
    return this.undoneOperations.length > 0;
  }
}

export const state = new AppState();
