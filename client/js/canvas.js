/**
 * client/js/canvas.js
 * High-Performance Native HTML5 Canvas Drawing Engine
 * 
 * Features:
 * - Pure HTML5 Canvas API (no external libraries)
 * - Sharp High-DPI (Retina) scaling via window.devicePixelRatio
 * - Smooth stroke rendering with rounded joins & caps
 * - Client-side prediction (zero-latency local rendering)
 * - Incremental remote stroke streaming
 * - Deterministic operation-based replay
 * - Responsive auto-resizing with state preservation
 */

import { state } from './state.js';
import { generateId } from './utils.js';

export class CanvasEngine {
  constructor(canvasElement, containerElement, callbacks = {}) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    // Callbacks to communicate with WebSocket layer
    this.callbacks = {
      onStrokeStart: callbacks.onStrokeStart || (() => {}),
      onStrokePoints: callbacks.onStrokePoints || (() => {}),
      onStrokeEnd: callbacks.onStrokeEnd || (() => {}),
      onCursorMove: callbacks.onCursorMove || (() => {}),
    };

    // Canvas coordinate space & scaling
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    // Local active drawing state
    this.isDrawing = false;
    this.currentStroke = null;
    this.pointBatch = [];
    this.batchTimer = null;
    this.BATCH_INTERVAL_MS = 25; // Balanced for responsive streaming & low bandwidth

    // Remote active strokes: strokeId -> { tool, color, width, lastPoint }
    this.remoteStrokes = new Map();

    this.init();
  }

  init() {
    this.setupResolution();
    this.setupEventListeners();
    this.setupResizeObserver();
  }

  /**
   * Set up high-DPI scaling for sharp rendering
   */
  setupResolution() {
    const rect = this.container.getBoundingClientRect();
    const cssWidth = Math.max(100, Math.floor(rect.width));
    const cssHeight = Math.max(100, Math.floor(rect.height));

    this.dpr = window.devicePixelRatio || 1;
    this.width = cssWidth;
    this.height = cssHeight;

    // Physical pixel dimensions
    this.canvas.width = Math.floor(cssWidth * this.dpr);
    this.canvas.height = Math.floor(cssHeight * this.dpr);

    // CSS display dimensions
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    // Scale drawing context so logical units match CSS pixels
    this.ctx.resetTransform?.();
    this.ctx.scale(this.dpr, this.dpr);
  }

  setupResizeObserver() {
    let resizeTimeout = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const prevWidth = this.width;
        const prevHeight = this.height;
        const rect = this.container.getBoundingClientRect();
        const newW = Math.max(100, Math.floor(rect.width));
        const newH = Math.max(100, Math.floor(rect.height));

        if (prevWidth !== newW || prevHeight !== newH) {
          this.setupResolution();
          this.redrawAll();
        }
      }, 80);
    });

    observer.observe(this.container);
  }

  /**
   * Translate pointer event client coordinates to canvas logical coordinates
   */
  getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
    };
  }

  setupEventListeners() {
    // Native Pointer Events for unified Mouse, Touch, and Stylus support
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    window.addEventListener('pointercancel', this.handlePointerCancel.bind(this));

    // Prevent default touch behaviors (pinch zoom / rubberband scrolling on canvas)
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  /**
   * Pointer Down: Start local stroke
   */
  handlePointerDown(e) {
    // Only handle primary button clicks (left click or touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.canvas.setPointerCapture?.(e.pointerId);
    this.isDrawing = true;

    const coords = this.getCanvasCoordinates(e);
    const tool = state.toolSettings.tool;
    const color = state.toolSettings.color;
    const width = state.toolSettings.width;
    const strokeId = generateId('stroke');

    this.currentStroke = {
      id: strokeId,
      userId: state.currentUser.userId,
      tool,
      color,
      width,
      points: [coords],
    };

    // Client-side prediction: render first point immediately
    this.renderStrokeStart(this.currentStroke, coords);

    // Notify backend and collaborators
    this.callbacks.onStrokeStart({
      strokeId,
      userId: state.currentUser.userId,
      x: coords.x,
      y: coords.y,
      color,
      width,
      tool,
    });

    this.pointBatch = [];
    this.startBatchTimer();
  }

  /**
   * Pointer Move: Continue drawing & emit cursor
   */
  handlePointerMove(e) {
    const coords = this.getCanvasCoordinates(e);

    // Track cursor for collaborator presence (throttled in websocket layer)
    const isInside =
      coords.x >= 0 && coords.x <= this.width && coords.y >= 0 && coords.y <= this.height;

    if (isInside) {
      this.callbacks.onCursorMove(coords);
    }

    if (!this.isDrawing || !this.currentStroke) return;

    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];

    // Discard redundant or microscopic moves (< 1px) for performance
    const distSq = (coords.x - lastPoint.x) ** 2 + (coords.y - lastPoint.y) ** 2;
    if (distSq < 1.0) return;

    // Render locally immediately (client-side prediction)
    this.renderStrokeSegment(this.currentStroke, lastPoint, coords);

    this.currentStroke.points.push(coords);
    this.pointBatch.push(coords);

    // Flush batch immediately if queue has accumulated sufficient points
    if (this.pointBatch.length >= 6) {
      this.flushPointBatch();
    }
  }

  /**
   * Pointer Up / Cancel: Finalize local stroke
   */
  handlePointerUp(e) {
    if (!this.isDrawing) return;
    this.finishDrawing();
  }

  handlePointerCancel(e) {
    if (!this.isDrawing) return;
    this.finishDrawing();
  }

  finishDrawing() {
    this.isDrawing = false;
    this.stopBatchTimer();
    this.flushPointBatch();

    if (this.currentStroke) {
      // Completed operation
      const completedOp = {
        id: this.currentStroke.id,
        userId: this.currentStroke.userId,
        type: 'stroke',
        tool: this.currentStroke.tool,
        color: this.currentStroke.color,
        width: this.currentStroke.width,
        points: this.currentStroke.points,
      };

      this.callbacks.onStrokeEnd({
        strokeId: this.currentStroke.id,
        points: this.currentStroke.points,
      });

      // Add to local state (server will sequence it)
      state.addOperation(completedOp);
      this.currentStroke = null;
    }
  }

  startBatchTimer() {
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.batchTimer = setInterval(() => {
      if (this.pointBatch.length > 0) {
        this.flushPointBatch();
      }
    }, this.BATCH_INTERVAL_MS);
  }

  stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  flushPointBatch() {
    if (!this.currentStroke || this.pointBatch.length === 0) return;

    const pointsToSend = [...this.pointBatch];
    this.pointBatch = [];

    this.callbacks.onStrokePoints({
      strokeId: this.currentStroke.id,
      points: pointsToSend,
    });
  }

  /* ========================================================================
     IMMEDIATE / INCREMENTAL RENDERING METHODS
     ======================================================================== */

  /**
   * Render initial point/dot of a stroke
   */
  renderStrokeStart(stroke, point) {
    this.ctx.save();
    if (stroke.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillStyle = stroke.color;
    }

    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  /**
   * Render a smooth line segment between two consecutive points
   */
  renderStrokeSegment(stroke, p1, p2) {
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = stroke.width;

    if (stroke.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = stroke.color;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /* ========================================================================
     REMOTE STREAMING STROKES (INCREMENTAL RENDERING)
     ======================================================================== */

  handleRemoteStrokeStart({ strokeId, userId, x, y, color, width, tool }) {
    const initialPoint = { x, y };
    const remoteStroke = {
      strokeId,
      userId,
      tool: tool || 'brush',
      color: color || '#1e293b',
      width: width || 5,
      points: [initialPoint],
      lastPoint: initialPoint,
    };

    this.remoteStrokes.set(strokeId, remoteStroke);
    this.renderStrokeStart(remoteStroke, initialPoint);
  }

  handleRemoteStrokePoints({ strokeId, points }) {
    const stroke = this.remoteStrokes.get(strokeId);
    if (!stroke || !Array.isArray(points) || points.length === 0) return;

    let current = stroke.lastPoint;
    for (const nextPoint of points) {
      this.renderStrokeSegment(stroke, current, nextPoint);
      stroke.points.push(nextPoint);
      current = nextPoint;
    }
    stroke.lastPoint = current;
  }

  handleRemoteStrokeEnd({ strokeId }) {
    const stroke = this.remoteStrokes.get(strokeId);
    if (!stroke) return;

    const op = {
      id: stroke.strokeId,
      userId: stroke.userId,
      type: 'stroke',
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points,
    };

    this.remoteStrokes.delete(strokeId);
    state.addOperation(op);
  }

  /* ========================================================================
     FULL CANVAS RECONSTRUCTION (REPLAY AUTHORITATIVE OPERATIONS)
     ======================================================================== */

  clearScreen() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Replays all authoritative operations from room history
   */
  redrawAll() {
    this.clearScreen();

    const operations = state.operations;
    for (const op of operations) {
      if (op.type === 'clear') {
        this.clearScreen();
        continue;
      }

      if (op.type === 'stroke' && Array.isArray(op.points) && op.points.length > 0) {
        this.drawFullStroke(op);
      }
    }

    // Replay any currently active local stroke
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.drawFullStroke(this.currentStroke);
    }

    // Replay any active remote strokes in progress
    for (const remote of this.remoteStrokes.values()) {
      if (remote.points && remote.points.length > 0) {
        this.drawFullStroke(remote);
      }
    }
  }

  /**
   * Draw an entire stroke from its array of points
   */
  drawFullStroke(stroke) {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = stroke.width || 5;

    if (stroke.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
      this.ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = stroke.color || '#1e293b';
      this.ctx.fillStyle = stroke.color || '#1e293b';
    }

    if (points.length === 1) {
      this.ctx.beginPath();
      this.ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}
