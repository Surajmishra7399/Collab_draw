/**
 * server/server.js
 * Express & Socket.io Application Server for CollabDraw
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocket } from './websocket.js';
import { roomManager } from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Initialize Socket.io with WebSocket & Polling transports
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Attach real-time WebSocket protocol handlers
setupWebSocket(io);

// Middleware
app.use(express.json());

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CollabDraw',
    timestamp: new Date().toISOString(),
    activeRooms: roomManager.rooms.size,
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const exists = roomManager.hasRoom(roomId);
  res.json({
    roomId,
    exists,
    userCount: exists ? roomManager.getRoomUsers(roomId).length : 0,
  });
});

// Serve static frontend assets from client directory
app.use(express.static(clientDir));

// Route handling: serve index.html for root and room shareable URLs
app.get(['/', '/room', '/room/:roomId'], (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Start HTTP + WebSocket Server
server.listen(PORT, HOST, () => {
  console.log(`[CollabDraw] Server running at http://${HOST}:${PORT}`);
  console.log(`[CollabDraw] Serving static client from: ${clientDir}`);
});
