// === Card Types ===
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

// === Player Types ===
export interface Player {
  odId: string;
  name: string;
  avatar: string;
  cards: Card[];
  score: number;
  isHost: boolean;
  isAi: boolean;
  isConnected: boolean;
  consecutiveTimeouts: number; // Track consecutive turn timeouts
}

// === Room Types ===
export type RoomStatus = 'waiting' | 'playing' | 'roundEnd' | 'gameOver';

export interface RoomSettings {
  scoreLimit: number;
  allowSticking: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  visitorIdToSocketId: Record<string, string>;
  settings: RoomSettings;
  status: RoomStatus;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  lastDiscardGroup?: Card[];
  currentTurnIndex: number;
  turnStartTime: number;
  roundNumber: number;
  lastRoundWinnerId?: string;
  createdAt: number;
  lastActivity: number;
}

// === Socket Events ===
export interface ServerToClientEvents {
  // Authentication
  authenticated: (data: { userId: string }) => void;
  authError: (data: { message: string }) => void;

  // Room events
  roomCreated: (data: { code: string }) => void;
  roomJoined: (data: { room: ClientRoom }) => void;
  roomUpdated: (data: { room: ClientRoom }) => void;
  playerJoined: (data: { player: ClientPlayer }) => void;
  playerLeft: (data: { odId: string }) => void;
  playerKicked: (data: { reason: string }) => void; // Sent to kicked player
  roomClosed: (data: { reason: string }) => void;
  roomError: (data: { message: string }) => void;

  // Game events
  gameStarted: (data: { gameState: ClientGameState }) => void;
  gameStateUpdated: (data: { gameState: ClientGameState }) => void;
  turnChanged: (data: { currentTurnOdId: string; turnStartTime: number }) => void;
  cardsDealt: (data: { yourCards: Card[] }) => void;
  moveResult: (data: { success: boolean; message?: string }) => void;
  roundEnded: (data: { result: RoundResult }) => void;
  gameEnded: (data: { finalScores: { odId: string; name: string; avatar: string; score: number }[] }) => void;
  
  // Sticking
  stickingAvailable: (data: { card: Card; timeoutMs: number }) => void;
  stickingExpired: () => void;
  
  // AI moves
  aiMove: (data: { playerId: string; cardsThrown: Card[]; drawFrom: 'deck' | 'pile' }) => void;
  // Human player moves (for animations)
  playerMove: (data: { playerId: string; cardsThrown: Card[]; drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId'; drawnCard?: Card }) => void;
  // Sticking animation
  stickPerformed: (data: { playerId: string; card: Card }) => void;

  // Chat (broadcast to all in room)
  chatMessage: (data: { odId: string; name: string; text: string }) => void;
}

export interface ClientToServerEvents {
  // Authentication
  authenticate: (data: { token: string }) => void;

  // Room actions
  createRoom: (data: { settings: RoomSettings; player: { name: string; avatar: string } }) => void;
  joinRoom: (data: { code: string; player: { name: string; avatar: string } }) => void;
  leaveRoom: () => void;
  addAiPlayer: () => void;
  removePlayer: (data: { odId: string }) => void;
  startGame: () => void;

  // Game actions
  throwCards: (data: { cardIds: string[]; drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId'; pileIndex?: number; pileCardId?: string }) => void;
  callYaniv: () => void;
  stick: () => void;
  skipStick: () => void;

  // Chat
  chatMessage: (data: { text: string }) => void;

  // Utility
  ping: () => void;
}

// === Client-safe types (without hidden info) ===
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
