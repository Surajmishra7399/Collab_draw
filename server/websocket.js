/**
 * server/websocket.js
 * Socket.io Event Handling, Validation, and Synchronization Logic
 */

import { roomManager } from './rooms.js';

export function setupWebSocket(io) {
  io.on('connection', (socket) => {
    // Current room tracking on socket session
    let currentRoomId = null;

    /**
     * JOIN ROOM
     */
    socket.on('join-room', (payload, callback) => {
      try {
        if (!payload || typeof payload !== 'object') {
          if (callback) callback({ success: false, error: 'Invalid payload' });
          return;
        }

        const rawRoomId = String(payload.roomId || '').trim().toUpperCase();
        const rawUsername = String(payload.username || '').trim();
        const rawUserId = String(payload.userId || '').trim();

        // Validate Room ID (1-32 chars alphanumeric and hyphens)
        if (!rawRoomId || !/^[A-Z0-9_-]{1,32}$/.test(rawRoomId)) {
          if (callback) callback({ success: false, error: 'Invalid Room ID format' });
          return;
        }

        // Validate Username (1-24 chars)
        if (!rawUsername || rawUsername.length > 24) {
          if (callback) callback({ success: false, error: 'Username must be 1 to 24 characters' });
          return;
        }

        // If previously in another room, leave it
        if (currentRoomId && currentRoomId !== rawRoomId) {
          leaveCurrentRoom();
        }

        currentRoomId = rawRoomId;
        socket.join(rawRoomId);

        const { room, user } = roomManager.joinRoom(
          rawRoomId,
          socket.id,
          rawUserId,
          rawUsername
        );

        // Notify other room participants
        socket.to(rawRoomId).emit('user-joined', {
          user: {
            userId: user.userId,
            username: user.username,
            userColor: user.userColor,
            cursor: user.cursor,
          },
        });

        // Provide complete room state to joining client
        const roomUsers = roomManager.getRoomUsers(rawRoomId);
        const drawingState = room.drawingState.getState();

        if (callback) {
          callback({
            success: true,
            user: {
              userId: user.userId,
              username: user.username,
              userColor: user.userColor,
            },
            room: {
              roomId: rawRoomId,
              users: roomUsers,
              operations: drawingState.operations,
              sequence: drawingState.sequence,
              undoneCount: drawingState.undoneCount,
            },
          });
        }
      } catch (err) {
        console.error('Error in join-room handler:', err);
        if (callback) callback({ success: false, error: 'Internal server error' });
      }
    });

    /**
     * LEAVE ROOM
     */
    socket.on('leave-room', () => {
      leaveCurrentRoom();
    });

    function leaveCurrentRoom() {
      if (!currentRoomId) return;

      const result = roomManager.leaveRoom(socket.id);
      socket.leave(currentRoomId);

      if (result && result.user) {
        socket.to(currentRoomId).emit('user-left', {
          userId: result.user.userId,
          username: result.user.username,
        });
      }

      currentRoomId = null;
    }

    /**
     * REAL-TIME STROKE STREAMING
     * 1. stroke-start: Collaborators initialize in-flight stroke
     * 2. stroke-points: Incremental point segments streamed
     * 3. stroke-end: Stroke finalized and saved to authoritative state
     */
    socket.on('stroke-start', (data) => {
      try {
        if (!currentRoomId || !data || data.roomId !== currentRoomId) return;
        const user = roomManager.getUserBySocketId(socket.id);
        if (!user) return;

        // Broadcast to other collaborators in this room
        socket.to(currentRoomId).emit('stroke-start', {
          strokeId: String(data.strokeId).slice(0, 64),
          userId: user.userId,
          x: Number(data.x) || 0,
          y: Number(data.y) || 0,
          color: String(data.color || '#1e293b').slice(0, 32),
          width: Math.max(1, Math.min(50, Number(data.width) || 5)),
          tool: data.tool === 'eraser' ? 'eraser' : 'brush',
        });
      } catch (err) {
        console.error('Error in stroke-start:', err);
      }
    });

    socket.on('stroke-points', (data) => {
      try {
        if (!currentRoomId || !data || data.roomId !== currentRoomId) return;
        if (!Array.isArray(data.points) || data.points.length === 0) return;

        // Broadcast points batch to collaborators
        socket.to(currentRoomId).emit('stroke-points', {
          strokeId: String(data.strokeId).slice(0, 64),
          points: data.points.slice(0, 100).map((p) => ({
            x: Math.round(Number(p.x) * 10) / 10,
            y: Math.round(Number(p.y) * 10) / 10,
          })),
        });
      } catch (err) {
        console.error('Error in stroke-points:', err);
      }
    });

    socket.on('stroke-end', (data) => {
      try {
        if (!currentRoomId || !data || data.roomId !== currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        const user = roomManager.getUserBySocketId(socket.id);
        if (!room || !user) return;

        // Add stroke to server-authoritative history
        const savedOperation = room.drawingState.addStroke({
          id: data.strokeId,
          userId: user.userId,
          tool: data.tool,
          color: data.color,
          width: data.width,
          points: data.points,
        });

        // Notify other room participants of completed stroke
        socket.to(currentRoomId).emit('stroke-end', {
          strokeId: data.strokeId,
          sequence: savedOperation ? savedOperation.sequence : undefined,
        });
      } catch (err) {
        console.error('Error in stroke-end:', err);
      }
    });

    /**
     * CURSOR TRACKING
     */
    socket.on('cursor-move', (data) => {
      try {
        if (!currentRoomId || !data || data.roomId !== currentRoomId) return;
        const user = roomManager.getUserBySocketId(socket.id);
        if (!user) return;

        const x = Math.round(Number(data.x) * 10) / 10;
        const y = Math.round(Number(data.y) * 10) / 10;
        user.cursor = { x, y };

        // Broadcast to collaborators
        socket.to(currentRoomId).emit('cursor-move', {
          userId: user.userId,
          username: user.username,
          userColor: user.userColor,
          x,
          y,
        });
      } catch (err) {
        console.error('Error in cursor-move:', err);
      }
    });

    /**
     * GLOBAL UNDO
     */
    socket.on('undo', (data) => {
      try {
        if (!currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        if (!room) return;

        const undoneOp = room.drawingState.undo();
        if (undoneOp) {
          // Broadcast undo event to all participants (including sender)
          io.in(currentRoomId).emit('undo', {
            operationId: undoneOp.id,
            undoneOp,
          });
        }
      } catch (err) {
        console.error('Error in undo:', err);
      }
    });

    /**
     * GLOBAL REDO
     */
    socket.on('redo', (data) => {
      try {
        if (!currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        if (!room) return;

        const redoneOp = room.drawingState.redo();
        if (redoneOp) {
          // Broadcast redo event to all participants (including sender)
          io.in(currentRoomId).emit('redo', {
            operation: redoneOp,
          });
        }
      } catch (err) {
        console.error('Error in redo:', err);
      }
    });

    /**
     * CLEAR CANVAS
     */
    socket.on('clear-canvas', () => {
      try {
        if (!currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        const user = roomManager.getUserBySocketId(socket.id);
        if (!room || !user) return;

        const clearOp = room.drawingState.clear(user.userId);

        // Broadcast clear event to all participants
        io.in(currentRoomId).emit('clear-canvas', {
          operation: clearOp,
        });
      } catch (err) {
        console.error('Error in clear-canvas:', err);
      }
    });

    /**
     * STATE SYNCHRONIZATION REQUEST
     */
    socket.on('request-state', () => {
      try {
        if (!currentRoomId) return;
        const room = roomManager.getRoom(currentRoomId);
        if (!room) return;

        const statePayload = room.drawingState.getState();
        const usersPayload = roomManager.getRoomUsers(currentRoomId);

        socket.emit('state-sync', {
          ...statePayload,
          users: usersPayload,
        });
      } catch (err) {
        console.error('Error in request-state:', err);
      }
    });

    /**
     * DISCONNECT HANDLING
     */
    socket.on('disconnect', () => {
      leaveCurrentRoom();
    });
  });
}
