import { io, Socket } from 'socket.io-client';

// Server URL
const SERVER_URL = 'https://yaniv-game-server.fly.dev';

// === Types (matching server types) ===
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export interface ClientPlayer {
  odId: string;
  name: string;
  avatar: string;
  cardCount: number;
  score: number;
  isHost: boolean;
  isAi: boolean;
  isConnected: boolean;
}

export type RoomStatus = 'waiting' | 'playing' | 'roundEnd' | 'gameOver';

export interface RoomSettings {
  scoreLimit: number;
  allowSticking: boolean;
}

export interface ClientRoom {
  code: string;
  hostId: string;
  settings: RoomSettings;
  status: RoomStatus;
  players: ClientPlayer[];
}

export interface ClientGameState {
  status: RoomStatus;
  players: ClientPlayer[];
  discardPile: Card[];
  lastDiscardGroup?: Card[];
  deckCount: number;
  currentTurnOdId: string;
  turnStartTime: number;
  roundNumber: number;
  yourCards?: Card[];
}

export interface RoundResult {
  winnerId: string;
  winnerName: string;
  type: 'yaniv' | 'assaf';
  callerId: string;
  callerName: string;
  playerResults: {
    odId: string;
    name: string;
    avatar: string;
    cards: Card[];
    pointsAdded: number;
    newScore: number;
    isEliminated: boolean;
  }[];
}

// === Socket Events ===
type ServerToClientEvents = {
  // Authentication
  authenticated: (data: { userId: string }) => void;
  authError: (data: { message: string }) => void;
  // Room events
  roomCreated: (data: { code: string }) => void;
  roomJoined: (data: { room: ClientRoom }) => void;
  roomUpdated: (data: { room: ClientRoom }) => void;
  playerJoined: (data: { player: ClientPlayer }) => void;
  playerLeft: (data: { odId: string }) => void;
  playerKicked: (data: { reason: string }) => void; // Sent when player is kicked for inactivity
  roomClosed: (data: { reason: string }) => void;
  roomError: (data: { message: string }) => void;
  gameStarted: (data: { gameState: ClientGameState }) => void;
  gameStateUpdated: (data: { gameState: ClientGameState }) => void;
  turnChanged: (data: { currentTurnOdId: string; turnStartTime: number }) => void;
  cardsDealt: (data: { yourCards: Card[] }) => void;
  moveResult: (data: { success: boolean; message?: string }) => void;
  roundEnded: (data: { result: RoundResult }) => void;
  gameEnded: (data: { finalScores: { odId: string; name: string; avatar: string; score: number }[] }) => void;
  stickingAvailable: (data: { card: Card; timeoutMs: number }) => void;
  stickingExpired: () => void;
  aiMove: (data: { playerId: string; cardsThrown: Card[]; drawFrom: 'deck' | 'pile' }) => void;
  playerMove: (data: { playerId: string; cardsThrown: Card[]; drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId'; drawnCard?: Card }) => void;
  stickPerformed: (data: { playerId: string; card: Card }) => void;
  chatMessage: (data: { odId: string; name: string; text: string }) => void;
};

type ClientToServerEvents = {
  // Authentication
  authenticate: (data: { token: string }) => void;
  // Room & Game events
  createRoom: (data: { settings: RoomSettings; player: { name: string; avatar: string } }) => void;
  joinRoom: (data: { code: string; player: { name: string; avatar: string } }) => void;
  leaveRoom: () => void;
  addAiPlayer: () => void;
  removePlayer: (data: { odId: string }) => void;
  startGame: () => void;
  throwCards: (data: { cardIds: string[]; drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId'; pileIndex?: number; pileCardId?: string }) => void;
  callYaniv: () => void;
  stick: () => void;
  skipStick: () => void;
  chatMessage: (data: { text: string }) => void;
  ping: () => void;
};

// === Socket Service Class ===
class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentRoom: ClientRoom | null = null;
  private currentGameState: ClientGameState | null = null;
  private myPlayerId: string | null = null;
  private authToken: string | null = null;
  private isAuthenticated = false;
  
  // Reconnection data - stored to allow rejoining after disconnect
  private lastRoomCode: string | null = null;
  private lastPlayerName: string | null = null;
  private lastPlayerAvatar: string | null = null;
  private isReconnecting = false;

  // Event callbacks
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onReconnecting?: (attempt: number) => void;
  public onReconnected?: () => void; // Called after successful rejoin
  public onReconnectFailed?: (reason: string) => void;
  public onError?: (message: string) => void;
  public onAuthenticated?: (userId: string) => void;
  public onAuthError?: (message: string) => void;
  
  // Room callbacks
  public onRoomCreated?: (code: string) => void;
  public onRoomJoined?: (room: ClientRoom) => void;
  public onRoomUpdated?: (room: ClientRoom) => void;
  public onPlayerJoined?: (player: ClientPlayer) => void;
  public onPlayerLeft?: (odId: string) => void;
  public onPlayerKicked?: (reason: string) => void; // Called when player is kicked for inactivity
  public onRoomClosed?: (reason: string) => void;
  
  // Game callbacks
  public onGameStarted?: (gameState: ClientGameState) => void;
  public onGameStateUpdated?: (gameState: ClientGameState) => void;
  public onTurnChanged?: (currentTurnOdId: string, turnStartTime: number) => void;
  public onMoveResult?: (success: boolean, message?: string) => void;
  public onRoundEnded?: (result: RoundResult) => void;
  public onGameEnded?: (finalScores: { odId: string; name: string; avatar: string; score: number }[]) => void;
  public onStickingAvailable?: (card: Card, timeoutMs: number) => void;
  public onStickingExpired?: () => void;
  public onAiMove?: (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile') => void;
  public onPlayerMove?: (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', drawnCard?: Card) => void;
  public onStickPerformed?: (playerId: string, card: Card) => void;
  public onChatMessage?: (odId: string, name: string, text: string) => void;

  // === Connection ===
  connect(authToken?: string): void {
    if (this.socket?.connected) return;

    console.log('[Socket] Connecting to server...');
    
    // Store auth token for reconnection
    if (authToken) {
      this.authToken = authToken;
    }

    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRoom = null;
    this.currentGameState = null;
    this.myPlayerId = null;
    this.isAuthenticated = false;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // === Authentication ===
  private authenticate(): void {
    if (!this.socket || !this.authToken) {
      console.log('[Socket] No auth token, skipping authentication');
      this.isAuthenticated = true; // Allow connection without auth in dev mode
      this.onConnected?.();
      return;
    }

    console.log('[Socket] Authenticating...');
    this.socket.emit('authenticate', { token: this.authToken });
  }

  // === Event Listeners ===
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.reconnectAttempts = 0;
      
      // Authenticate immediately after connection
      this.authenticate();
    });

    // Authentication events
    this.socket.on('authenticated', ({ userId }) => {
      console.log('[Socket] Authenticated as:', userId);
      this.isAuthenticated = true;
      this.myPlayerId = userId;
      
      // If we were reconnecting, try to rejoin room
      if (this.isReconnecting && this.lastRoomCode && this.lastPlayerName && this.lastPlayerAvatar) {
        console.log('[Socket] Attempting to rejoin room:', this.lastRoomCode);
        this.joinRoom(this.lastRoomCode, this.lastPlayerName, this.lastPlayerAvatar);
      } else {
        this.isReconnecting = false;
        this.onConnected?.();
      }
      
      this.onAuthenticated?.(userId);
    });

    this.socket.on('authError', ({ message }) => {
      console.error('[Socket] Authentication error:', message);
      this.isAuthenticated = false;
      this.onAuthError?.(message);
      this.onError?.(message);
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this.isAuthenticated = false;
      // Mark as reconnecting if we were in a room - don't clear room data yet
      if (this.lastRoomCode) {
        this.isReconnecting = true;
      }
      this.onDisconnected?.();
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.isReconnecting = true;
      console.log(`[Socket] Reconnecting... attempt ${attempt}`);
      this.onReconnecting?.(attempt);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.log('[Socket] Reconnection failed');
      this.isReconnecting = false;
      this.clearReconnectionData();
      this.onReconnectFailed?.('Connection failed. Please try again.');
      this.onError?.('Connection failed. Please try again.');
    });

    // Room events
    this.socket.on('roomCreated', ({ code }) => {
      console.log(`[Socket] Room created: ${code}`);
      this.onRoomCreated?.(code);
    });

    this.socket.on('roomJoined', ({ room }) => {
      console.log(`[Socket] Joined room: ${room.code}`);
      this.currentRoom = room;
      this.lastRoomCode = room.code; // Store for potential reconnection
      
      // Find myself in the room - use authenticated userId or socket id
      const me = room.players.find(p => p.odId === this.myPlayerId) || 
                 room.players.find(p => p.odId === `player-${this.socket?.id}`);
      if (me) {
        this.myPlayerId = me.odId;
        console.log(`[Socket] Identified as player: ${me.odId} (${me.name})`);
      } else {
        console.warn(`[Socket] Could not find myself in room! myPlayerId: ${this.myPlayerId}, players:`, room.players.map(p => p.odId));
      }
      
      // Handle reconnection case
      if (this.isReconnecting) {
        console.log('[Socket] Successfully rejoined room after reconnection');
        this.isReconnecting = false;
        this.onReconnected?.();
      }
      
      this.onRoomJoined?.(room);
    });

    this.socket.on('roomUpdated', ({ room }) => {
      this.currentRoom = room;
      this.onRoomUpdated?.(room);
    });

    this.socket.on('playerJoined', ({ player }) => {
      this.onPlayerJoined?.(player);
    });

    this.socket.on('playerLeft', ({ odId }) => {
      this.onPlayerLeft?.(odId);
    });

    this.socket.on('playerKicked', ({ reason }) => {
      console.log(`[Socket] Player kicked: ${reason}`);
      this.currentRoom = null;
      this.currentGameState = null;
      this.clearReconnectionData(); // Can't rejoin after being kicked
      this.onPlayerKicked?.(reason);
    });

    this.socket.on('roomClosed', ({ reason }) => {
      console.log(`[Socket] Room closed: ${reason}`);
      this.currentRoom = null;
      this.currentGameState = null;
      this.clearReconnectionData(); // Room no longer exists, can't rejoin
      this.onRoomClosed?.(reason);
    });

    this.socket.on('roomError', ({ message }) => {
      console.log(`[Socket] Error: ${message}`);
      // If room error during reconnection, stop trying to rejoin
      if (this.isReconnecting) {
        console.log('[Socket] Reconnection failed - room error');
        this.isReconnecting = false;
        this.clearReconnectionData();
        this.onReconnectFailed?.(message);
      }
      this.onError?.(message);
    });

    // Game events
    this.socket.on('gameStarted', ({ gameState }) => {
      console.log('[Socket] Game started');
      this.currentGameState = gameState;
      this.onGameStarted?.(gameState);
    });

    this.socket.on('gameStateUpdated', ({ gameState }) => {
      this.currentGameState = gameState;
      this.onGameStateUpdated?.(gameState);
    });

    this.socket.on('turnChanged', ({ currentTurnOdId, turnStartTime }) => {
      this.onTurnChanged?.(currentTurnOdId, turnStartTime);
    });

    this.socket.on('moveResult', ({ success, message }) => {
      this.onMoveResult?.(success, message);
    });

    this.socket.on('roundEnded', ({ result }) => {
      console.log(`[Socket] Round ended: ${result.type}`);
      this.onRoundEnded?.(result);
    });

    this.socket.on('gameEnded', ({ finalScores }) => {
      console.log('[Socket] Game ended');
      this.onGameEnded?.(finalScores);
    });

    this.socket.on('stickingAvailable', ({ card, timeoutMs }) => {
      this.onStickingAvailable?.(card, timeoutMs);
    });

    this.socket.on('stickingExpired', () => {
      this.onStickingExpired?.();
    });

    this.socket.on('aiMove', ({ playerId, cardsThrown, drawFrom }) => {
      this.onAiMove?.(playerId, cardsThrown, drawFrom);
    });

    this.socket.on('playerMove', ({ playerId, cardsThrown, drawFrom, drawnCard }) => {
      this.onPlayerMove?.(playerId, cardsThrown, drawFrom, drawnCard);
    });

    this.socket.on('stickPerformed', ({ playerId, card }) => {
      this.onStickPerformed?.(playerId, card);
    });

    this.socket.on('chatMessage', ({ odId, name, text }) => {
      this.onChatMessage?.(odId, name, text);
    });
  }

  // === Helper Methods ===
  private clearReconnectionData(): void {
    this.lastRoomCode = null;
    this.lastPlayerName = null;
    this.lastPlayerAvatar = null;
    this.isReconnecting = false;
  }

  // Update auth token (e.g., when token is refreshed)
  updateAuthToken(token: string): void {
    this.authToken = token;
  }

  // === Room Actions ===
  createRoom(settings: RoomSettings, playerName: string, playerAvatar: string): void {
    if (!this.socket?.connected) {
      this.onError?.('Not connected to server');
      return;
    }
    // Store player info for potential reconnection
    this.lastPlayerName = playerName;
    this.lastPlayerAvatar = playerAvatar;
    this.socket.emit('createRoom', { settings, player: { name: playerName, avatar: playerAvatar } });
  }

  joinRoom(code: string, playerName: string, playerAvatar: string): void {
    if (!this.socket?.connected) {
      this.onError?.('Not connected to server');
      return;
    }
    // Store player info for potential reconnection
    this.lastRoomCode = code;
    this.lastPlayerName = playerName;
    this.lastPlayerAvatar = playerAvatar;
    this.socket.emit('joinRoom', { code, player: { name: playerName, avatar: playerAvatar } });
  }

  leaveRoom(): void {
    this.socket?.emit('leaveRoom');
    this.currentRoom = null;
    this.currentGameState = null;
    this.clearReconnectionData(); // Clear reconnection data when intentionally leaving
  }

  addAiPlayer(): void {
    this.socket?.emit('addAiPlayer');
  }

  removePlayer(odId: string): void {
    this.socket?.emit('removePlayer', { odId });
  }

  startGame(): void {
    this.socket?.emit('startGame');
  }

  // === Game Actions ===
  throwCards(cardIds: string[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', pileIndex?: number, pileCardId?: string): void {
    this.socket?.emit('throwCards', { cardIds, drawFrom, pileIndex, pileCardId });
  }

  callYaniv(): void {
    this.socket?.emit('callYaniv');
  }

  stick(): void {
    this.socket?.emit('stick');
  }

  skipStick(): void {
    this.socket?.emit('skipStick');
  }

  sendChatMessage(text: string): void {
    const trimmed = text?.trim();
    if (!trimmed) return;
    this.socket?.emit('chatMessage', { text: trimmed.slice(0, 200) });
  }

  // === Getters ===
  getRoom(): ClientRoom | null {
    return this.currentRoom;
  }

  getGameState(): ClientGameState | null {
    return this.currentGameState;
  }

  getMyPlayerId(): string | null {
    return this.myPlayerId;
  }

  isMyTurn(): boolean {
    if (!this.currentGameState || !this.myPlayerId) return false;
    return this.currentGameState.currentTurnOdId === this.myPlayerId;
  }

  amIHost(): boolean {
    if (!this.currentRoom || !this.myPlayerId) return false;
    return this.currentRoom.hostId === this.myPlayerId;
  }

  isCurrentlyReconnecting(): boolean {
    return this.isReconnecting;
  }

  getLastRoomCode(): string | null {
    return this.lastRoomCode;
  }

  // Public method to abandon reconnection attempt (e.g., when user navigates to lobby)
  abandonReconnection(): void {
    this.clearReconnectionData();
  }
}

// Singleton export
export const socketService = new SocketService();
