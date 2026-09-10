# CollabDraw

> **Draw together. Create together.**

A high-performance, real-time collaborative drawing canvas web application built for a college technical engineering assignment. CollabDraw allows multiple users across different browsers and devices to collaborate simultaneously on a shared digital whiteboard with live streaming strokes, remote cursors, global undo/redo, and deterministic conflict resolution.

---

## 🚀 Key Features

- **Pure HTML5 Canvas Drawing Engine**: Implemented from scratch using the native `CanvasRenderingContext2D` and Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). **Zero external canvas libraries** (no Fabric.js, Konva, Paper.js, or React).
- **Client-Side Prediction**: Instant, zero-latency local stroke rendering — the artist never waits for network round-trips.
- **Real-Time Stroke Streaming**: Strokes are transmitted incrementally in lightweight point batches while the user is actively drawing, rather than waiting for mouse release.
- **Multi-User Live Remote Cursors**: See collaborator cursors move in real-time, labeled with their username and unique assigned presence color.
- **Global Operation-Based Undo & Redo**: Undo and redo operate deterministically on the shared room history. Undoing a stroke pops the latest room operation for all participants.
- **Reversible Clear Canvas**: Canvas clears are recorded as reversible operations in the history stack, enabling Undo to restore the entire previous canvas state.
- **Authoritative Server Sequencing & Conflict Resolution**: The Node.js server assigns monotonically increasing sequence numbers (`1, 2, 3...`) to completed operations, guaranteeing deterministic visual ordering without canvas locking.
- **Room Lifecycle & Shareable URLs**: Users can create unique rooms or join existing rooms via Room ID or direct shareable URLs (`/room/:roomId` or `?room=:roomId`).
- **High-DPI / Retina Crispness**: Uses `window.devicePixelRatio` scaling so strokes remain tack-sharp on high-resolution displays without blurriness.
- **Responsive & Touch-Friendly**: Fully functional on desktop, laptop, tablet, and mobile browsers with `touch-action: none` to prevent unintended viewport panning while sketching.
- **Resilience & Auto-Reconnection**: Reconnects automatically on network drops, seamlessly rejoins active rooms, and re-syncs state from the server.

---

## 🛠️ Technology Stack

### Frontend
- **HTML5**: Semantic document structure with accessible ARIA labeling.
- **CSS3**: Modern custom styling, CSS variables, flexbox, CSS transforms for hardware-accelerated cursor movements, and responsive layout.
- **Vanilla JavaScript (ES6+ Modules)**: Modular architecture without React, Vue, Angular, or bundlers.
- **HTML5 Canvas API**: Native 2D context drawing (`beginPath`, `moveTo`, `lineTo`, `arc`, `stroke`, `clearRect`, `globalCompositeOperation`).
- **Native Browser APIs**: Pointer Events, `ResizeObserver`, `navigator.clipboard`, `window.devicePixelRatio`.

### Backend
- **Node.js**: Asynchronous event-driven runtime.
- **Express.js**: HTTP server, static asset delivery, room routing, and health checks.
- **Socket.io**: Real-time bi-directional WebSocket communication with room multiplexing and fallback polling.

---

## 📁 Folder Structure

```text
collaborative-canvas/
├── client/
│   ├── index.html           # Primary web application interface
│   ├── style.css            # Responsive, high-contrast UI stylesheet
│   ├── js/
│   │   ├── main.js          # Application bootstrapper & coordination
│   │   ├── canvas.js        # Native HTML5 Canvas rendering & event engine
│   │   ├── websocket.js     # Socket.io client & networking layer
│   │   ├── state.js         # Central client state & subscription store
│   │   ├── ui.js            # Landing page, toolbar, toast & modal controls
│   │   ├── cursor.js        # Remote user cursor overlay renderer
│   │   └── utils.js         # IDs, throttling, debouncing, colors & clipboard
│   └── assets/              # Static assets & icons
│
├── server/
│   ├── server.js            # Express server, static serving & startup
│   ├── rooms.js             # Room lifecycle & online user presence
│   ├── drawing-state.js     # Authoritative operation history & undo/redo
│   └── websocket.js         # Socket.io event handlers, validation & broadcasting
│
├── package.json             # Scripts & dependencies
├── README.md                # Project documentation & testing guide
└── ARCHITECTURE.md          # Technical architecture, protocol & data flow
```

---

## 💻 Installation & Running Locally

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Application
```bash
npm start
```
*(Or in development mode: `npm run dev`)*

The server will start at:
```text
http://localhost:3000
```

---

## 👥 Testing Multiple Users (Collaboration Verification)

To test real-time collaboration on a single machine:

1. **User A (Host)**:
   - Open `http://localhost:3000` in your standard browser.
   - Enter your name (e.g., `Rahul`).
   - Click **Create Room**.
   - Note the generated Room ID (e.g., `ABC123`) displayed in the header.
   - Click **Copy Link** in the top header.

2. **User B (Collaborator)**:
   - Open an **Incognito / Private Window** (or a second browser such as Firefox, Edge, or Safari).
   - Paste the copied URL (or open `http://localhost:3000` and enter the Room ID `ABC123`).
   - Enter a collaborator name (e.g., `Priya`).
   - Click **Join Room**.

3. **User C (Third Collaborator)**:
   - Open a third tab or mobile device on the same local network.
   - Enter name (e.g., `Aman`) and join `ABC123`.

### Observable Real-Time Behavior:
- **Presence**: When Priya joins, Rahul sees a toast notification `"Priya joined the room"`, and Priya appears in the Online Users panel with an assigned color dot.
- **Streaming Drawing**: When Rahul holds the pointer down and draws, Priya sees the strokes materialize in real-time point-by-point, with zero delay.
- **Remote Cursors**: Priya's mouse movements across the canvas render an arrow cursor labeled `Priya` in Rahul's viewport.
- **Simultaneous Drawing**: Both users can draw simultaneously in different colors or brush sizes; strokes are ordered deterministically by the server without collision or overwrite.
- **Global Undo**: When Priya clicks **Undo**, the most recent stroke created across all participants is removed from everyone's canvas.
- **Reversible Clear**: Clicking **Clear** wipes the canvas for all users. Clicking **Undo** restores the drawings that were erased.

---

## ✅ Testing Checklist

### Canvas & Drawing Engine
- [x] **Brush**: Native Canvas drawing with smooth rounded lines.
- [x] **Eraser**: Destination-out compositing accurately erases strokes down to the canvas background.
- [x] **Colors**: Quick-selection preset swatches + HTML5 native color picker.
- [x] **Stroke Width**: 1px to 50px slider with dynamic preview circle and thickness indicator.
- [x] **Smooth Drawing**: Rounded line caps, rounded line joins, and distance filtering for fluid handwriting.
- [x] **High-DPI Support**: Backing buffer scaled by `window.devicePixelRatio` for retina clarity.
- [x] **Responsive Canvas**: Resizing the window preserves all drawings and recalculates dimensions via `ResizeObserver`.

### Real-Time Collaboration
- [x] **Multi-User Sync**: Real-time streaming between 2+ connected clients.
- [x] **Remote Cursors**: Collaborator cursors follow pointer movement with user colors.
- [x] **User Colors**: Auto-assigned distinctive color palette per room member.
- [x] **Online Users Panel**: Collapsible drawer showing active collaborators with `(You)` badge.
- [x] **Room System**: Isolated rooms with unique IDs and shareable URL routes.
- [x] **Presence Toasts**: Join and leave notifications.

### Operation-Based State
- [x] **Operation History**: Vector operations stored as structured stroke objects (`{ id, tool, color, width, points, sequence }`).
- [x] **Global Undo**: Removes the latest active room operation across all clients.
- [x] **Global Redo**: Re-applies undone operations with newly assigned sequence numbers.
- [x] **Synchronized Clear**: Wipes shared canvas; undo restores pre-clear drawing state.
- [x] **Deterministic Ordering**: Monotonically increasing server sequence numbers resolve concurrency.
- [x] **State Synchronization**: New clients receive complete active history on join.

### Reliability & Error Handling
- [x] **Graceful Disconnect**: Disconnecting users are removed from presence lists without losing drawings.
- [x] **Automatic Reconnection**: Socket.io auto-reconnects and re-requests room state.
- [x] **Input Validation**: Server enforces coordinates sanity, stroke width bounds, and maximum point limits.
- [x] **Room Validation**: Joining non-existent rooms provides clear user feedback.

---

## ⚠️ Known Limitations

1. **In-Memory Storage**: Room states, operations, and user lists are held in server memory. If the Node.js server process restarts, active rooms and drawings are reset (in compliance with the assignment specification omitting external databases).
2. **No User Authentication**: Users are identified by self-provided display names and session UUIDs; there are no passwords or permanent user accounts.
3. **Canvas Size Boundaries**: Canvas coordinate space scales with browser viewports. If collaborators use drastically different aspect ratios, strokes are rendered relative to the canvas origin.

---

## ⏱️ Time Spent

- **Total Time**: ~14 hours
  - Architecture & protocol design: 2 hours
  - Native HTML5 Canvas drawing engine & High-DPI handling: 3 hours
  - Node.js & Socket.io room server & validation: 2.5 hours
  - Real-time streaming, batching & remote cursors: 2.5 hours
  - Operation-based state, sequence numbers & global undo/redo: 2.5 hours
  - UI polish, responsive styling & documentation: 1.5 hours
