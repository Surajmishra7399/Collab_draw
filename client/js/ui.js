/**
 * client/js/ui.js
 * User Interface Controller & Interaction Handlers
 */

import { state } from './state.js';
import { copyToClipboard, buildRoomUrl } from './utils.js';

export class UIController {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.dom = {};
    this.initDOM();
    this.bindEvents();
    this.subscribeState();
  }

  initDOM() {
    // Views
    this.dom.landingView = document.getElementById('landing-view');
    this.dom.workspaceView = document.getElementById('workspace-view');
    this.dom.landingError = document.getElementById('landing-error');
    this.dom.landingErrorText = document.getElementById('landing-error-text');
    this.dom.usernameInput = document.getElementById('username-input');
    this.dom.roomInput = document.getElementById('room-input');
    this.dom.btnCreateRoom = document.getElementById('btn-create-room');
    this.dom.btnJoinRoom = document.getElementById('btn-join-room');

    // Header
    this.dom.currentRoomId = document.getElementById('current-room-id');
    this.dom.connectionIndicator = document.getElementById('connection-indicator');
    this.dom.connectionText = document.getElementById('connection-text');
    this.dom.btnCopyLink = document.getElementById('btn-copy-link');
    this.dom.btnToggleUsers = document.getElementById('btn-toggle-users');
    this.dom.userCountBadge = document.getElementById('user-count-badge');
    this.dom.currentUserChip = document.getElementById('current-user-chip');
    this.dom.currentUserDot = document.getElementById('current-user-dot');
    this.dom.currentUsername = document.getElementById('current-username');
    this.dom.btnLeaveRoom = document.getElementById('btn-leave-room');

    // Users panel
    this.dom.usersPanel = document.getElementById('users-panel');
    this.dom.usersList = document.getElementById('users-list');
    this.dom.panelUserCount = document.getElementById('panel-user-count');
    this.dom.btnCloseUsersPanel = document.getElementById('btn-close-users-panel');

    // Toolbar
    this.dom.toolBrush = document.getElementById('tool-brush');
    this.dom.toolEraser = document.getElementById('tool-eraser');
    this.dom.colorPalette = document.getElementById('color-palette');
    this.dom.colorSwatches = document.querySelectorAll('.color-swatch');
    this.dom.nativeColorPicker = document.getElementById('native-color-picker');
    this.dom.widthSlider = document.getElementById('width-slider');
    this.dom.widthLabel = document.getElementById('width-label');
    this.dom.strokePreview = document.getElementById('stroke-preview');
    this.dom.btnUndo = document.getElementById('btn-undo');
    this.dom.btnRedo = document.getElementById('btn-redo');
    this.dom.btnClear = document.getElementById('btn-clear');

    // Toast
    this.dom.toastContainer = document.getElementById('toast-container');
  }

  bindEvents() {
    // Landing View Actions
    this.dom.btnCreateRoom.addEventListener('click', () => {
      const username = this.dom.usernameInput.value.trim();
      const customRoomId = this.dom.roomInput.value.trim().toUpperCase();
      if (!username) {
        this.showLandingError('Please enter your name to create a room.');
        this.dom.usernameInput.focus();
        return;
      }
      this.clearLandingError();
      this.callbacks.onCreateRoom(username, customRoomId);
    });

    this.dom.btnJoinRoom.addEventListener('click', () => {
      const username = this.dom.usernameInput.value.trim();
      const roomId = this.dom.roomInput.value.trim().toUpperCase();
      if (!username) {
        this.showLandingError('Please enter your name to join a room.');
        this.dom.usernameInput.focus();
        return;
      }
      if (!roomId) {
        this.showLandingError('Please enter a Room ID to join.');
        this.dom.roomInput.focus();
        return;
      }
      this.clearLandingError();
      this.callbacks.onJoinRoom(username, roomId);
    });

    // Enter key submits form
    [this.dom.usernameInput, this.dom.roomInput].forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.dom.roomInput.value.trim()) {
            this.dom.btnJoinRoom.click();
          } else {
            this.dom.btnCreateRoom.click();
          }
        }
      });
    });

    // Header Actions
    this.dom.btnCopyLink.addEventListener('click', async () => {
      if (!state.currentUser.roomId) return;
      const url = buildRoomUrl(state.currentUser.roomId);
      const success = await copyToClipboard(url);
      if (success) {
        this.showToast('Room link copied!', 'success');
      } else {
        this.showToast('Failed to copy room link.', 'danger');
      }
    });

    this.dom.btnToggleUsers.addEventListener('click', () => {
      this.dom.usersPanel.classList.toggle('closed');
    });

    this.dom.btnCloseUsersPanel.addEventListener('click', () => {
      this.dom.usersPanel.classList.add('closed');
    });

    this.dom.btnLeaveRoom.addEventListener('click', () => {
      this.callbacks.onLeaveRoom();
    });

    // Toolbar Tools
    this.dom.toolBrush.addEventListener('click', () => {
      state.setTool('brush');
    });

    this.dom.toolEraser.addEventListener('click', () => {
      state.setTool('eraser');
    });

    // Color swatches
    this.dom.colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        state.setColor(color);
        state.setTool('brush'); // Switching color automatically selects brush
      });
    });

    // Native color picker
    this.dom.nativeColorPicker.addEventListener('input', (e) => {
      state.setColor(e.target.value);
      state.setTool('brush');
    });

    // Stroke width slider
    this.dom.widthSlider.addEventListener('input', (e) => {
      state.setWidth(e.target.value);
    });

    // Undo / Redo / Clear
    this.dom.btnUndo.addEventListener('click', () => {
      this.callbacks.onUndo();
    });

    this.dom.btnRedo.addEventListener('click', () => {
      this.callbacks.onRedo();
    });

    this.dom.btnClear.addEventListener('click', () => {
      if (confirm('Clear the shared canvas for all participants?')) {
        this.callbacks.onClear();
      }
    });

    // Keyboard Shortcuts (B = Brush, E = Eraser, Ctrl+Z = Undo, Ctrl+Y = Redo)
    window.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.callbacks.onRedo();
        } else {
          this.callbacks.onUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.callbacks.onRedo();
      } else if (e.key.toLowerCase() === 'b') {
        state.setTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        state.setTool('eraser');
      }
    });
  }

  subscribeState() {
    state.on('tool-change', (settings) => {
      this.updateToolUI(settings);
    });

    state.on('user-info-change', (user) => {
      this.updateUserBadge(user);
    });

    state.on('users-change', (users) => {
      this.updateUsersList(users);
    });

    state.on('connection-status-change', (status) => {
      this.updateConnectionStatus(status);
    });

    state.on('state-synced', (data) => {
      this.updateHistoryButtons(data.canUndo, data.canRedo);
    });

    state.on('operation-added', () => {
      this.updateHistoryButtons(state.canUndo(), state.canRedo());
    });

    state.on('operation-undone', () => {
      this.updateHistoryButtons(state.canUndo(), state.canRedo());
    });

    state.on('operation-redone', () => {
      this.updateHistoryButtons(state.canUndo(), state.canRedo());
    });

    state.on('canvas-cleared', () => {
      this.updateHistoryButtons(state.canUndo(), state.canRedo());
    });

    // Initial tool UI setup
    this.updateToolUI(state.toolSettings);
  }

  showLandingError(msg) {
    this.dom.landingErrorText.textContent = msg;
    this.dom.landingError.classList.remove('hidden');
  }

  clearLandingError() {
    this.dom.landingError.classList.add('hidden');
  }

  switchToWorkspace(roomId, username, userColor) {
    this.dom.currentRoomId.textContent = roomId;
    this.dom.currentUsername.textContent = username;
    this.dom.currentUserDot.style.backgroundColor = userColor;

    this.dom.landingView.classList.add('hidden');
    this.dom.workspaceView.classList.remove('hidden');

    // Update browser URL without reload
    const newUrl = `/room/${encodeURIComponent(roomId)}`;
    if (window.location.pathname !== newUrl) {
      window.history.pushState({ roomId }, '', newUrl);
    }
  }

  switchToLanding() {
    this.dom.workspaceView.classList.add('hidden');
    this.dom.landingView.classList.remove('hidden');
    this.clearLandingError();

    // Reset browser URL
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }

  updateToolUI({ tool, color, width }) {
    // Tool buttons active state
    if (tool === 'brush') {
      this.dom.toolBrush.classList.add('active');
      this.dom.toolEraser.classList.remove('active');
    } else {
      this.dom.toolBrush.classList.remove('active');
      this.dom.toolEraser.classList.add('active');
    }

    // Swatches active state
    this.dom.colorSwatches.forEach((swatch) => {
      if (swatch.dataset.color.toLowerCase() === color.toLowerCase()) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });

    // Slider & label
    this.dom.widthSlider.value = width;
    this.dom.widthLabel.textContent = `Thickness: ${width} px`;

    // Preview circle
    this.dom.strokePreview.style.setProperty('--stroke-size', `${Math.min(22, width)}px`);
    this.dom.strokePreview.style.setProperty(
      '--current-color',
      tool === 'eraser' ? '#cbd5e1' : color
    );
  }

  updateUserBadge(user) {
    if (user.username) {
      this.dom.currentUsername.textContent = user.username;
    }
    if (user.userColor) {
      this.dom.currentUserDot.style.backgroundColor = user.userColor;
    }
    if (user.roomId) {
      this.dom.currentRoomId.textContent = user.roomId;
    }
  }

  updateUsersList(users) {
    const count = users.length;
    this.dom.userCountBadge.textContent = count;
    this.dom.panelUserCount.textContent = count;

    this.dom.usersList.innerHTML = '';

    users.forEach((user) => {
      const isYou = user.userId === state.currentUser.userId;
      const li = document.createElement('li');
      li.className = 'user-item';

      const dot = document.createElement('span');
      dot.className = 'user-item-dot';
      dot.style.backgroundColor = user.userColor || '#2563eb';

      const name = document.createElement('span');
      name.className = 'user-item-name';
      name.textContent = user.username || 'Collaborator';

      li.appendChild(dot);
      li.appendChild(name);

      if (isYou) {
        const youBadge = document.createElement('span');
        youBadge.className = 'user-item-you';
        youBadge.textContent = '(You)';
        li.appendChild(youBadge);
      }

      this.dom.usersList.appendChild(li);
    });
  }

  updateConnectionStatus(status) {
    const el = this.dom.connectionIndicator;
    const txt = this.dom.connectionText;

    el.classList.remove('status-connected', 'status-reconnecting', 'status-offline');

    if (status === 'connected') {
      el.classList.add('status-connected');
      txt.textContent = 'Connected';
    } else if (status === 'reconnecting') {
      el.classList.add('status-reconnecting');
      txt.textContent = 'Reconnecting...';
    } else {
      el.classList.add('status-offline');
      txt.textContent = 'Offline';
    }
  }

  updateHistoryButtons(canUndo, canRedo) {
    this.dom.btnUndo.disabled = !canUndo;
    this.dom.btnRedo.disabled = !canRedo;
  }

  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}
