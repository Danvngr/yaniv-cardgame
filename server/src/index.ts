import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { roomManager } from './game/RoomManager';
import { verifyToken } from './firebaseAdmin';
import {
    Card,
    ClientGameState,
    ClientRoom,
    ClientToServerEvents,
    RoundResult,
    ServerToClientEvents
} from './types';

const app = express();
const httpServer = createServer(app);

// CORS configuration — defaults to '*' in dev, lock down in production via env var
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET'],
};

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

// ── Input helpers ──────────────────────────────────────────────────────────

const MAX_NAME_LEN = 30;

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_NAME_LEN);
  if (trimmed.length === 0) return null;
  return trimmed;
}

// ── Rate limiting (per socket, in-memory) ─────────────────────────────────

const RATE_WINDOWS: Record<string, { count: number; reset: number }> = {};
const RATE_LIMIT = 60;        // max events per window
const RATE_WINDOW_MS = 10000; // 10-second window

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const entry = RATE_WINDOWS[socketId];
  if (!entry || now > entry.reset) {
    RATE_WINDOWS[socketId] = { count: 1, reset: now + RATE_WINDOW_MS };
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function clearRateLimit(socketId: string): void {
  delete RATE_WINDOWS[socketId];
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Track socket to room mapping
const socketToRoom = new Map<string, string>();
const socketToPlayerId = new Map<string, string>();
const socketToUserId = new Map<string, string>();

// Check if authentication is required (production mode)
const requireAuth = !!process.env.FIREBASE_SERVICE_ACCOUNT;

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Apply rate limiting to every incoming event
  socket.onAny(() => {
    if (isRateLimited(socket.id)) {
      console.warn(`[Socket] Rate limited: ${socket.id}`);
      socket.emit('roomError', { message: 'Too many requests. Slow down.' });
      socket.disconnect(true);
    }
  });

  // === Authentication ===
  socket.on('authenticate', async ({ token }) => {
    if (!requireAuth) {
      // Development mode - skip verification
      const mockUserId = `dev-user-${socket.id.slice(0, 8)}`;
      socketToUserId.set(socket.id, mockUserId);
      socket.emit('authenticated', { userId: mockUserId });
      console.log(`[Socket] Dev mode - assigned userId: ${mockUserId}`);
      return;
    }

    const userId = await verifyToken(token);
    if (!userId) {
      socket.emit('authError', { message: 'Invalid token' });
      return;
    }
    
    socketToUserId.set(socket.id, userId);
    socket.emit('authenticated', { userId });
    console.log(`[Socket] Authenticated: ${socket.id} as ${userId}`);
  });

  // === Room Actions ===

  socket.on('createRoom', ({ settings, player }) => {
    // Check authentication in production
    const userId = socketToUserId.get(socket.id);
    if (requireAuth && !userId) {
      socket.emit('roomError', { message: 'Not authenticated. Please reconnect.' });
      return;
    }

    const cleanName = sanitizeName(player?.name);
    if (!cleanName) {
      socket.emit('roomError', { message: 'Invalid player name.' });
      return;
    }

    const playerId = userId || `player-${socket.id}`;

    const room = roomManager.createRoom(
      playerId,
      cleanName,
      typeof player?.avatar === 'string' ? player.avatar.slice(0, 10) : '👤',
      settings
    );

    if (!room) {
      socket.emit('roomError', { message: 'Failed to create room' });
      return;
    }

    // Setup room callbacks
    setupRoomCallbacks(room, socket);

    // Join socket room
    socket.join(room.code);
    socketToRoom.set(socket.id, room.code);
    socketToPlayerId.set(socket.id, playerId);
    room.mapSocketToPlayer(playerId, socket.id);

    socket.emit('roomCreated', { code: room.code });
    socket.emit('roomJoined', { room: room.toClientRoom() });

    console.log(`[Socket] ${player.name} created room ${room.code}`);
  });

  socket.on('joinRoom', ({ code, player }) => {
    // Check authentication in production
    const userId = socketToUserId.get(socket.id);
    if (requireAuth && !userId) {
      socket.emit('roomError', { message: 'Not authenticated. Please reconnect.' });
      return;
    }

    const cleanName = sanitizeName(player?.name);
    if (!cleanName) {
      socket.emit('roomError', { message: 'Invalid player name.' });
      return;
    }

    // Normalize code: must be 6-char string (server stores uppercase)
    const codeStr = (code != null && typeof code === 'string')
      ? String(code).trim().replace(/\s/g, '').toUpperCase()
      : '';
    if (codeStr.length !== 6) {
      console.log('[Socket] joinRoom invalid or missing code:', JSON.stringify(code));
      socket.emit('roomError', { message: 'Room not found' });
      return;
    }

    const room = roomManager.getRoom(codeStr);
    console.log('[Socket] joinRoom attempt code=%s found=%s totalRooms=%d', codeStr, !!room, roomManager.getRoomCount());

    if (!room) {
      socket.emit('roomError', { message: 'Room not found' });
      return;
    }

    // Check if this is a rejoin attempt (player with same name disconnected)
    if (room.canPlayerRejoin(cleanName)) {
      const cleanAvatar = typeof player?.avatar === 'string' ? player.avatar.slice(0, 10) : '👤';
      const playerId = room.tryRejoinPlayer(cleanName, cleanAvatar, socket.id);
      
      if (playerId) {
        console.log(`[Socket] ${player.name} rejoined room ${room.code}`);
        
        // Setup room callbacks if not already
        setupRoomCallbacks(room, socket);
        
        // Join socket room
        socket.join(room.code);
        socketToRoom.set(socket.id, room.code);
        socketToPlayerId.set(socket.id, playerId);
        
        socket.emit('roomJoined', { room: room.toClientRoom() });
        
        // Send current game state to rejoined player
        if (room.status === 'playing') {
          socket.emit('gameStateUpdated', { gameState: room.toClientGameState(playerId) });
        }
        
        // Notify others
        io.to(room.code).emit('roomUpdated', { room: room.toClientRoom() });
        
        return;
      }
    }

    if (room.status !== 'waiting') {
      socket.emit('roomError', { message: 'Game already in progress' });
      return;
    }

    if (room.playerCount >= 4) {
      socket.emit('roomError', { message: 'Room is full' });
      return;
    }

    const playerId = userId || `player-${socket.id}`;
    const cleanAvatar = typeof player?.avatar === 'string' ? player.avatar.slice(0, 10) : '👤';
    const success = room.addPlayer(playerId, cleanName, cleanAvatar, false);

    if (!success) {
      socket.emit('roomError', { message: 'Failed to join room' });
      return;
    }

    // Setup room callbacks if not already
    setupRoomCallbacks(room, socket);

    // Join socket room
    socket.join(room.code);
    socketToRoom.set(socket.id, room.code);
    socketToPlayerId.set(socket.id, playerId);
    room.mapSocketToPlayer(playerId, socket.id);

    socket.emit('roomJoined', { room: room.toClientRoom() });

    // Notify others
    io.to(room.code).emit('roomUpdated', { room: room.toClientRoom() });

    console.log(`[Socket] ${player.name} joined room ${room.code}`);
  });

  socket.on('leaveRoom', () => {
    handlePlayerLeave(socket);
  });

  socket.on('addAiPlayer', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // Only host can add AI
    if (room.hostId !== playerId) {
      socket.emit('roomError', { message: 'Only host can add AI players' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('roomError', { message: 'Game already started' });
      return;
    }

    const success = room.addAiPlayer();
    if (!success) {
      const reason = room.playerCount >= 4 ? 'Room is full' : 'Failed to add AI player';
      socket.emit('roomError', { message: reason });
    }
  });

  socket.on('removePlayer', ({ odId }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // Only host can remove players
    if (room.hostId !== playerId) {
      socket.emit('roomError', { message: 'Only host can remove players' });
      return;
    }

    room.removePlayer(odId);
  });

  socket.on('startGame', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // Only host can start
    if (room.hostId !== playerId) {
      socket.emit('roomError', { message: 'Only host can start the game' });
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('roomError', { message: 'Game already in progress' });
      return;
    }

    // Rematch rooms can contain players from the previous game who did not press
    // "play again"; remove them before deciding who is in the new game.
    room.removeDisconnectedWaitingPlayers();

    // Auto-add AI if room has only 1 player
    while (room.playerCount < 2) {
      const added = room.addAiPlayer();
      if (!added) break;
    }

    if (room.playerCount < 2) {
      socket.emit('roomError', { message: 'Need at least 2 players to start' });
      return;
    }

    room.startGame();
    console.log(`[Socket] Game started in room ${roomCode}`);
  });

  // === Game Actions ===

  socket.on('throwCards', ({ cardIds, drawFrom, pileIndex, pileCardId }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const result = room.executeMove(playerId, cardIds, drawFrom, pileIndex, pileCardId);
    socket.emit('moveResult', result);
  });

  socket.on('callYaniv', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const result = room.callYaniv(playerId);
    socket.emit('moveResult', result);
  });

  socket.on('stick', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const result = room.executeStick(playerId);
    socket.emit('moveResult', result);
  });

  socket.on('skipStick', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    room.skipStick(playerId);
  });

  socket.on('readyForNextRound', () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    room.markReadyForNextRound(playerId);
  });

  socket.on('chatMessage', ({ text }: { text: string }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);
    if (!roomCode || !playerId || !text?.trim()) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const playerInfo = room.getPlayerInfo(playerId);
    if (!playerInfo) return;

    io.to(roomCode).emit('chatMessage', {
      odId: playerInfo.odId,
      name: playerInfo.name,
      text: text.trim().slice(0, 200),
    });
  });

  socket.on('ping', () => {
    // Keep-alive
  });

  // === Disconnect ===

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    clearRateLimit(socket.id);
    handlePlayerLeave(socket);
  });
});

function handlePlayerLeave(socket: Socket) {
  const roomCode = socketToRoom.get(socket.id);
  const playerId = socketToPlayerId.get(socket.id);

  if (roomCode && playerId) {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      const shouldDelete = !room.removePlayer(playerId);
      if (shouldDelete) {
        roomManager.deleteRoom(roomCode);
        io.to(roomCode).emit('roomClosed', { reason: 'Room closed' });
      }
    }
  }

  socket.leave(roomCode || '');
  socketToRoom.delete(socket.id);
  socketToPlayerId.delete(socket.id);
}

function setupRoomCallbacks(room: ReturnType<typeof roomManager.getRoom>, socket: Socket) {
  if (!room) return;

  room.onRoomUpdated = (clientRoom: ClientRoom) => {
    io.to(room.code).emit('roomUpdated', { room: clientRoom });
  };

  room.onPlayerJoined = (player) => {
    io.to(room.code).emit('playerJoined', { player });
  };

  room.onPlayerLeft = (odId) => {
    io.to(room.code).emit('playerLeft', { odId });
  };

  room.onGameStateUpdated = (state: ClientGameState, forPlayerId?: string) => {
    if (forPlayerId) {
      const socketId = room.getSocketId(forPlayerId);
      if (socketId) {
        io.to(socketId).emit('gameStateUpdated', { gameState: state });
      }
    } else {
      // Broadcast to all (without private cards)
      const publicState = { ...state, yourCards: undefined };
      io.to(room.code).emit('gameStateUpdated', { gameState: publicState });
    }
  };

  room.onTurnChanged = (odId: string, turnStartTime: number) => {
    io.to(room.code).emit('turnChanged', { currentTurnOdId: odId, turnStartTime });
  };

  room.onRoundEnded = (result: RoundResult) => {
    io.to(room.code).emit('roundEnded', { result });
  };

  room.onGameEnded = (finalScores) => {
    io.to(room.code).emit('gameEnded', { finalScores });
  };

  room.onStickingAvailable = (playerId: string, card: Card, timeoutMs: number) => {
    const socketId = room.getSocketId(playerId);
    if (socketId) {
      io.to(socketId).emit('stickingAvailable', { card, timeoutMs });
    }
  };

  room.onStickingExpired = (playerId: string) => {
    const socketId = room.getSocketId(playerId);
    if (socketId) {
      io.to(socketId).emit('stickingExpired');
    }
  };

  room.onAiMove = (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile') => {
    // Broadcast AI move to all players for animations
    io.to(room.code).emit('aiMove', { playerId, cardsThrown, drawFrom });
  };

  room.onPlayerMove = (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', drawnCard?: Card) => {
    io.to(room.code).emit('playerMove', { playerId, cardsThrown, drawFrom, drawnCard });
  };

  room.onStickPerformed = (playerId: string, card: Card) => {
    io.to(room.code).emit('stickPerformed', { playerId, card });
  };

  room.onPlayerKicked = (playerId: string, reason: string) => {
    const socketId = room.getSocketId(playerId);
    if (socketId) {
      io.to(socketId).emit('playerKicked', { reason });
      // Also close their connection to the room
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(room.code);
        socketToRoom.delete(socketId);
        socketToPlayerId.delete(socketId);
      }
    }
  };

  room.onRoomShouldClose = (reason: string) => {
    console.log(`[Socket] Room ${room.code} closing: ${reason}`);
    io.to(room.code).emit('roomClosed', { reason });
    roomManager.deleteRoom(room.code);
  };
}

// Start server - listen on 0.0.0.0 so Fly.io (and other hosts) can reach the app
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`🎮 Yaniv Server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  roomManager.destroy();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
