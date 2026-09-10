/**
 * server/drawing-state.js
 * Authoritative Operation-Based Drawing State Engine
 * 
 * Implements:
 * - Monotonically increasing sequence numbers
 * - Conflict resolution via deterministic sequence ordering
 * - Global room-level Undo & Redo
 * - Reversible Clear Canvas operations
 * - Robust input validation and sanitization
 */

export class RoomDrawingState {
  constructor() {
    this.operations = []; // Array of active operations in sequence order
    this.undoneOperations = []; // Stack of undone operations
    this.sequence = 0; // Monotonically increasing sequence number
  }

  /**
   * Add a completed stroke operation to authoritative history
   */
  addStroke(strokeData) {
    // Validate inputs
    const tool = strokeData.tool === 'eraser' ? 'eraser' : 'brush';
    const width = Math.max(1, Math.min(50, Number(strokeData.width) || 5));
    const color = typeof strokeData.color === 'string' ? strokeData.color.slice(0, 32) : '#1e293b';

    // Validate points array
    let points = [];
    if (Array.isArray(strokeData.points)) {
      points = strokeData.points
        .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice(0, 5000) // Cap at 5000 points to prevent memory abuse
        .map((p) => ({
          x: Math.round(p.x * 10) / 10,
          y: Math.round(p.y * 10) / 10,
        }));
    }

    if (points.length === 0) return null;

    this.sequence += 1;

    const operation = {
      id: strokeData.id || `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: strokeData.userId,
      type: 'stroke',
      tool,
      color,
      width,
      points,
      sequence: this.sequence,
      timestamp: Date.now(),
    };

    this.operations.push(operation);

    // New operation clears redo stack (standard operation history branching)
    this.undoneOperations = [];

    return operation;
  }

  /**
   * Global Undo:
   * Identifies the latest active operation in the shared room history,
   * removes it from active operations, and moves it to undone operations.
   */
  undo() {
    if (this.operations.length === 0) return null;

    // Pop the latest active operation
    const undoneOp = this.operations.pop();
    this.undoneOperations.push(undoneOp);

    return undoneOp;
  }

  /**
   * Global Redo:
   * Re-activates the most recently undone operation, assigns a new
   * monotonically increasing sequence number, and moves it back to active.
   */
  redo() {
    if (this.undoneOperations.length === 0) return null;

    const redoneOp = this.undoneOperations.pop();
    this.sequence += 1;
    redoneOp.sequence = this.sequence;

    this.operations.push(redoneOp);

    return redoneOp;
  }

  /**
   * Clear Canvas:
   * Recorded as a reversible operation in the shared history.
   * Undoing a Clear operation restores the exact previous canvas state!
   */
  clear(userId) {
    this.sequence += 1;

    const clearOp = {
      id: `clear_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      type: 'clear',
      sequence: this.sequence,
      timestamp: Date.now(),
    };

    this.operations.push(clearOp);
    this.undoneOperations = [];

    return clearOp;
  }

  /**
   * Get serialized room state for new users (state-sync)
   */
  getState() {
    return {
      operations: this.operations,
      sequence: this.sequence,
      undoneCount: this.undoneOperations.length,
    };
  }
}
