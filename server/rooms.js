/**
 * server/rooms.js
 * Room Lifecycle & User Presence Management
 */

import { RoomDrawingState } from './drawing-state.js';

const PALETTE = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#9333ea', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#d97706', // Amber
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#059669', // Emerald
];

export class RoomManager {
  constructor() {
    // Map: roomId -> { roomId, users: Map(socketId -> User), drawingState: RoomDrawingState, createdAt }
    this.rooms = new Map();
  }

  /**
   * Check if a room exists
   */
  hasRoom(roomId) {
    return this.rooms.has(roomId);
  }

  /**
   * Get or create room
   */
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId,
        users: new Map(), // socketId -> userObject
        drawingState: new RoomDrawingState(),
        createdAt: Date.now(),
      });
    }
    return this.rooms.get(roomId);
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Add a user to a room
   */
  joinRoom(roomId, socketId, userId, username) {
    const room = this.getOrCreateRoom(roomId);

    // Pick distinct color based on current user count in room
    const colorIndex = room.users.size % PALETTE.length;
    const userColor = PALETTE[colorIndex];

    const user = {
      socketId,
      userId: userId || `user_${socketId}`,
      username: username.slice(0, 24).trim() || 'Anonymous',
      userColor,
      roomId,
      cursor: { x: 0, y: 0 },
      joinedAt: Date.now(),
    };

    room.users.set(socketId, user);
    return { room, user };
  }

  /**
   * Remove a user by socketId
   */
  leaveRoom(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.has(socketId)) {
        const user = room.users.get(socketId);
        room.users.delete(socketId);

        // Keep room in memory even if empty so drawings are preserved if user refreshes!
        return { room, user };
      }
    }
    return null;
  }

  /**
   * Find user by socketId
   */
  getUserBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.users.has(socketId)) {
        return room.users.get(socketId);
      }
    }
    return null;
  }

  /**
   * Get serialized users list for a room
   */
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
      userColor: u.userColor,
      cursor: u.cursor,
    }));
  }
}

export const roomManager = new RoomManager();
