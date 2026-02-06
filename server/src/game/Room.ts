import { v4 as uuidv4 } from 'uuid';
import {
  Card,
  ClientGameState,
  ClientPlayer,
  ClientRoom,
  Player,
  Room,
  RoomSettings,
  RoomStatus,
  RoundResult,
} from '../types';
import {
  calculateRoundScores,
  canCallYaniv,
  checkForAssaf,
  generateDeck,
  getAiMove,
  getHandValue,
  isValidThrow,
  playerHasCards,
  shouldAiCallYaniv,
  shuffleDeck,
  sortHand,
} from './YanivLogic';

const AI_NAMES = ['בוט רועי', 'בוט דנה', 'בוט יוסי', 'בוט מיכל', 'בוט אבי', 'בוט שירה'];
const AI_AVATARS = ['🤖', '🎮', '🎯', '🎲', '🃏', '🎰'];
const CARDS_PER_PLAYER = 5;
const TURN_TIMEOUT_MS = 60000; // 60 seconds

export class GameRoom {
  private room: Room;
  private turnTimer: NodeJS.Timeout | null = null;
  private stickingTimer: NodeJS.Timeout | null = null;
  private playAgainHostTimer: NodeJS.Timeout | null = null;
  private stickingCard: Card | null = null;
  private stickingPlayerId: string | null = null;
  
  // Constants for timeout kick logic
  private static readonly MAX_CONSECUTIVE_TIMEOUTS = 2;

  // Callbacks for socket events
  public onRoomUpdated?: (room: ClientRoom) => void;
  public onGameStateUpdated?: (state: ClientGameState, forPlayerId?: string) => void;
  public onPlayerJoined?: (player: ClientPlayer) => void;
  public onPlayerLeft?: (odId: string) => void;
  public onPlayerKicked?: (odId: string, reason: string) => void; // New callback for kicked players
  public onTurnChanged?: (odId: string, turnStartTime: number) => void;
  public onRoundEnded?: (result: RoundResult) => void;
  public onGameEnded?: (finalScores: { odId: string; name: string; avatar: string; score: number }[]) => void;
  public onStickingAvailable?: (playerId: string, card: Card, timeoutMs: number) => void;
  public onStickingExpired?: (playerId: string) => void;
  public onAiTurn?: (playerId: string) => void;
  public onAiMove?: (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile') => void;
  public onPlayerMove?: (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', drawnCard?: Card) => void;
  public onStickPerformed?: (playerId: string, card: Card) => void;
  public onRoomShouldClose?: (reason: string) => void; // New callback when room should close

  constructor(code: string, hostId: string, hostName: string, hostAvatar: string, settings: RoomSettings) {
    this.room = {
      code,
      hostId,
      visitorIdToSocketId: {},
      settings,
      status: 'waiting',
      players: [
        {
          odId: hostId,
          name: hostName,
          avatar: hostAvatar,
          cards: [],
          score: 0,
          isHost: true,
          isAi: false,
          isConnected: true,
          consecutiveTimeouts: 0,
        },
      ],
      deck: [],
      discardPile: [],
      lastDiscardGroup: [],
      currentTurnIndex: 0,
      turnStartTime: 0,
      roundNumber: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
  }

  // === Getters ===
  get code(): string {
    return this.room.code;
  }

  get hostId(): string {
    return this.room.hostId;
  }

  get status(): RoomStatus {
    return this.room.status;
  }

  get playerCount(): number {
    return this.room.players.length;
  }

  get lastActivity(): number {
    return this.room.lastActivity;
  }

  // === Player Management ===
  addPlayer(odId: string, name: string, avatar: string, isAi: boolean = false): boolean {
    if (this.room.players.length >= 4) return false;
    if (this.room.status !== 'waiting') return false;
    if (this.room.players.some(p => p.odId === odId)) return false;

    const player: Player = {
      odId,
      name,
      avatar,
      cards: [],
      score: 0,
      isHost: false,
      isAi,
      isConnected: !isAi,
      consecutiveTimeouts: 0,
    };

    this.room.players.push(player);
    this.room.lastActivity = Date.now();
    this.onPlayerJoined?.(this.toClientPlayer(player));
    this.onRoomUpdated?.(this.toClientRoom());
    return true;
  }

  addAiPlayer(): boolean {
    if (this.room.players.length >= 4) return false;
    
    const usedNames = new Set(this.room.players.map(p => p.name));
    const availableNames = AI_NAMES.filter(n => !usedNames.has(n));
    const name = availableNames[0] || `AI ${this.room.players.length}`;
    
    const usedAvatars = new Set(this.room.players.filter(p => p.isAi).map(p => p.avatar));
    const availableAvatars = AI_AVATARS.filter(a => !usedAvatars.has(a));
    const avatar = availableAvatars[0] || '🤖';

    const aiId = `ai-${uuidv4().slice(0, 8)}`;
    return this.addPlayer(aiId, name, avatar, true);
  }

  removePlayer(odId: string, forceRemove: boolean = false): boolean {
    const index = this.room.players.findIndex(p => p.odId === odId);
    if (index === -1) return false;

    const player = this.room.players[index];
    
    // If game is in progress and not forced, just mark as disconnected (allow rejoin)
    if (this.room.status === 'playing' && !forceRemove && !player.isAi) {
      console.log(`[Room] Player ${player.name} disconnected - marking for potential rejoin`);
      player.isConnected = false;
      this.room.lastActivity = Date.now();
      this.onPlayerLeft?.(odId);
      this.onRoomUpdated?.(this.toClientRoom());

      const connectedHumans = this.room.players.filter(p => !p.isAi && p.isConnected).length;
      const aiCount = this.room.players.filter(p => p.isAi).length;
      if (connectedHumans === 1 && aiCount === 0) {
        console.log('[Room] Only one human left - closing room');
        this.onRoomShouldClose?.('המשחק נסגר - נשארת לבד');
      }
      if (connectedHumans === 0 && aiCount > 0) {
        console.log('[Room] Last human left - closing room (only AI remain)');
        this.onRoomShouldClose?.('החדר נסגר - יצאת מהמשחק');
      }

      return true;
    }
    
    // Can't remove host unless room is empty
    if (player.isHost && this.room.players.length > 1) {
      // Transfer host to a random human player (waiting state: rematch; playing: first non-AI)
      const humans = this.room.players.filter(p => p.odId !== odId && !p.isAi);
      if (humans.length > 0) {
        const nextPlayer = humans[Math.floor(Math.random() * humans.length)];
        nextPlayer.isHost = true;
        this.room.hostId = nextPlayer.odId;
      }
    }

    this.room.players.splice(index, 1);
    this.room.lastActivity = Date.now();

    // If game is in progress and it was current player's turn, advance turn
    if (this.room.status === 'playing') {
      if (this.room.currentTurnIndex >= this.room.players.length) {
        this.room.currentTurnIndex = 0;
      }
      // Return cards to deck
      this.room.deck = shuffleDeck([...this.room.deck, ...player.cards]);
    }

    this.onPlayerLeft?.(odId);
    this.onRoomUpdated?.(this.toClientRoom());

    // If only AI left or no players, close room
    if (this.room.players.length === 0 || this.room.players.every(p => p.isAi)) {
      return false; // Signal to delete room
    }

    return true;
  }

  setPlayerConnected(odId: string, connected: boolean): void {
    const player = this.room.players.find(p => p.odId === odId);
    if (player) {
      player.isConnected = connected;
      this.room.lastActivity = Date.now();
    }
  }

  mapSocketToPlayer(odId: string, socketId: string): void {
    this.room.visitorIdToSocketId[odId] = socketId;
  }

  getPlayerInfo(odId: string): { odId: string; name: string } | undefined {
    const player = this.room.players.find(p => p.odId === odId);
    return player ? { odId: player.odId, name: player.name } : undefined;
  }

  getSocketId(odId: string): string | undefined {
    return this.room.visitorIdToSocketId[odId];
  }

  // === Rejoin Support ===
  
  /**
   * Try to rejoin a player who was previously in the room.
   * Returns the player's odId if successful, null otherwise.
   */
  tryRejoinPlayer(name: string, avatar: string, newSocketId: string): string | null {
    // Find a disconnected player with matching name
    const player = this.room.players.find(p => 
      p.name === name && 
      !p.isAi && 
      !p.isConnected
    );
    
    if (!player) {
      return null;
    }
    
    console.log(`[Room] Player ${name} rejoining room ${this.room.code}`);
    
    // Update player's connection state and socket mapping
    player.isConnected = true;
    const newPlayerId = `player-${newSocketId}`;
    
    // Update the player ID to match new socket
    const oldId = player.odId;
    player.odId = newPlayerId;
    
    // Update host reference if needed
    if (this.room.hostId === oldId) {
      this.room.hostId = newPlayerId;
    }
    
    // Clean up old socket mapping and add new one
    delete this.room.visitorIdToSocketId[oldId];
    this.room.visitorIdToSocketId[newPlayerId] = newSocketId;
    
    this.room.lastActivity = Date.now();
    
    return newPlayerId;
  }
  
  /**
   * Check if a player with the given name can rejoin
   */
  canPlayerRejoin(name: string): boolean {
    return this.room.players.some(p => 
      p.name === name && 
      !p.isAi && 
      !p.isConnected
    );
  }
  
  /**
   * Get remaining turn time in milliseconds
   */
  getRemainingTurnTime(): number {
    if (this.room.status !== 'playing') return TURN_TIMEOUT_MS;
    const elapsed = Date.now() - this.room.turnStartTime;
    return Math.max(0, TURN_TIMEOUT_MS - elapsed);
  }

  // === Game Flow ===
  canStart(): boolean {
    return this.room.players.length >= 2 && this.room.status === 'waiting';
  }

  startGame(): boolean {
    if (!this.canStart()) return false;

    if (this.playAgainHostTimer) {
      clearTimeout(this.playAgainHostTimer);
      this.playAgainHostTimer = null;
    }

    // Reset all scores to 0 for new game
    for (const player of this.room.players) {
      player.score = 0;
    }

    this.room.status = 'playing';
    this.room.roundNumber = 1;
    this.isFirstTurnOfRound = true; // First turn of the game
    this.dealCards();
    this.room.currentTurnIndex = Math.floor(Math.random() * this.room.players.length);
    this.room.turnStartTime = Date.now();
    this.room.lastActivity = Date.now();

    // Notify all players
    this.room.players.forEach(player => {
      this.onGameStateUpdated?.(this.toClientGameState(player.odId), player.odId);
    });

    this.startTurnTimer();
    this.checkAiTurn();

    return true;
  }

  private dealCards(): void {
    // Generate deck (4 decks for 2-4 players)
    this.room.deck = generateDeck(4);
    this.room.discardPile = [];

    // Deal cards to each player
    for (const player of this.room.players) {
      player.cards = sortHand(this.room.deck.splice(0, CARDS_PER_PLAYER));
      console.log(`[Room] Dealt ${player.cards.length} cards to ${player.name} (expected ${CARDS_PER_PLAYER})`);
    }

    // First discard card
    const firstDiscard = this.room.deck.shift();
    if (firstDiscard) {
      this.room.discardPile.push(firstDiscard);
      this.room.lastDiscardGroup = [firstDiscard];
    } else {
      this.room.lastDiscardGroup = [];
    }
  }

  // === Turn Management ===
  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout();
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private handleTurnTimeout(): void {
    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    if (!currentPlayer) return;

    if (currentPlayer.isAi) {
      this.executeAiTurn(currentPlayer.odId);
    } else {
      // Increment consecutive timeout counter for human players
      currentPlayer.consecutiveTimeouts++;
      console.log(`[Room] Player ${currentPlayer.name} timeout #${currentPlayer.consecutiveTimeouts}`);
      
      // Check if player should be kicked (2 consecutive timeouts)
      if (currentPlayer.consecutiveTimeouts >= GameRoom.MAX_CONSECUTIVE_TIMEOUTS) {
        this.kickPlayerForInactivity(currentPlayer.odId);
        return;
      }
      
      // Auto-play for human: throw highest card, draw from deck (don't reset timeout counter)
      if (currentPlayer.cards.length > 0) {
        const sorted = [...currentPlayer.cards].sort((a, b) => b.value - a.value);
        this.executeMove(currentPlayer.odId, [sorted[0].id], 'deck', undefined, undefined, true);
      }
    }
  }

  private kickPlayerForInactivity(playerId: string): void {
    const player = this.room.players.find(p => p.odId === playerId);
    if (!player) return;
    
    console.log(`[Room] Kicking player ${player.name} for inactivity (${GameRoom.MAX_CONSECUTIVE_TIMEOUTS} consecutive timeouts)`);
    
    // Notify the kicked player
    this.onPlayerKicked?.(playerId, 'הוצאת מהמשחק בגלל חוסר פעילות');
    
    // Count human players BEFORE removing
    const humanPlayersBefore = this.room.players.filter(p => !p.isAi).length;
    
    // Force remove the player (no chance to rejoin after being kicked for inactivity)
    this.removePlayer(playerId, true);
    
    // Count remaining human players and AI
    const humanPlayersAfter = this.room.players.filter(p => !p.isAi).length;
    const aiCountAfter = this.room.players.filter(p => p.isAi).length;

    // Close room only when: 0 humans left, or exactly 1 human with no AI (left alone)
    // Continue when: 2+ humans, or 1 human + at least one AI
    const shouldClose = humanPlayersAfter === 0 || (humanPlayersAfter === 1 && aiCountAfter === 0);
    if (shouldClose) {
      console.log(`[Room] Closing room - humanPlayersAfter=${humanPlayersAfter}, aiCountAfter=${aiCountAfter}`);
      this.onRoomShouldClose?.(humanPlayersAfter === 0 ? 'הוצאת מהמשחק בגלל חוסר פעילות' : 'המשחק נסגר - נשארת לבד');
    } else {
      console.log(`[Room] Game continues with ${humanPlayersAfter} human(s), ${aiCountAfter} AI`);
      this.room.players.forEach(p => {
        this.onGameStateUpdated?.(this.toClientGameState(p.odId), p.odId);
      });
    }
  }

  private advanceTurn(): void {
    this.clearStickingTimer();
    this.room.currentTurnIndex = (this.room.currentTurnIndex + 1) % this.room.players.length;
    this.room.turnStartTime = Date.now();
    this.room.lastActivity = Date.now();

    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    this.onTurnChanged?.(currentPlayer.odId, this.room.turnStartTime);

    this.startTurnTimer();
    this.checkAiTurn();
  }

  private isFirstTurnOfRound: boolean = true;
  
  private checkAiTurn(): void {
    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    if (currentPlayer?.isAi && this.room.status === 'playing') {
      // AI plays after a short delay
      // - First turn of round 1: 1500ms (UI initialization)
      // - First turn of round 2+: 2500ms (wait for round summary to close on clients)
      // - Regular turns during round: 1000ms
      let delay: number;
      if (this.isFirstTurnOfRound) {
        delay = this.room.roundNumber === 1 ? 1500 : 2500;
        this.isFirstTurnOfRound = false;
      } else {
        delay = 1000;
      }
      
      setTimeout(() => {
        if (this.room.status === 'playing' && this.room.players[this.room.currentTurnIndex]?.odId === currentPlayer.odId) {
          this.executeAiTurn(currentPlayer.odId);
        }
      }, delay + Math.random() * 500);
    } else {
      // Human player's turn - mark first turn as done
      this.isFirstTurnOfRound = false;
    }
  }

  private executeAiTurn(aiId: string): void {
    const player = this.room.players.find(p => p.odId === aiId);
    if (!player || !player.isAi) return;
    if (this.room.status !== 'playing') return;

    // Check if AI should call Yaniv
    if (shouldAiCallYaniv(player.cards)) {
      this.callYaniv(aiId);
      return;
    }

    // Get AI move
    const topDiscard = this.room.discardPile[this.room.discardPile.length - 1];
    console.log(`[AI-DEBUG] Top discard before AI move: ${topDiscard ? `${topDiscard.rank}${topDiscard.suit} (value=${topDiscard.value})` : 'NONE'}`);
    console.log(`[AI-DEBUG] AI hand: ${player.cards.map(c => `${c.rank}${c.suit}`).join(', ')}`);
    
    const { cardsToThrow, drawFrom } = getAiMove(player.cards, topDiscard);
    const cardIds = cardsToThrow.map(c => c.id);
    
    console.log(`[AI-DEBUG] AI decision: throw [${cardsToThrow.map(c => `${c.rank}${c.suit}`).join(', ')}], drawFrom: ${drawFrom}`);
    
    // Notify about AI move BEFORE executing (for animations)
    this.onAiMove?.(aiId, cardsToThrow, drawFrom);
    
    // Execute move after animation delay
    setTimeout(() => {
      if (this.room.status === 'playing') {
        this.executeMove(aiId, cardIds, drawFrom);
      }
    }, 800);
  }

  // === Game Actions ===
  executeMove(playerId: string, cardIds: string[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', pileIndex?: number, pileCardId?: string, fromTimeout?: boolean): { success: boolean; message?: string } {
    const playerIndex = this.room.players.findIndex(p => p.odId === playerId);
    if (playerIndex === -1) return { success: false, message: 'Player not found' };
    if (playerIndex !== this.room.currentTurnIndex) return { success: false, message: 'Not your turn' };
    if (this.room.status !== 'playing') return { success: false, message: 'Game not in progress' };

    const player = this.room.players[playerIndex];

    // Reset consecutive timeout only on real player moves (not auto-play after timeout)
    if (!player.isAi && !fromTimeout) {
      player.consecutiveTimeouts = 0;
    }

    // Validate player has these cards
    if (!playerHasCards(player.cards, cardIds)) {
      return { success: false, message: 'Invalid cards' };
    }

    // Get the actual cards
    const cardsToThrow = player.cards.filter(c => cardIds.includes(c.id));

    // Validate throw
    if (!isValidThrow(cardsToThrow)) {
      return { success: false, message: 'Invalid throw combination' };
    }

    // Remove cards from hand
    player.cards = player.cards.filter(c => !cardIds.includes(c.id));

    // Add to discard pile
    this.room.discardPile.push(...cardsToThrow);

    // Track for sticking
    const lastThrownRank = cardsToThrow[cardsToThrow.length - 1].rank;

    // Draw card
    let drawnCard: Card | undefined;
    const playerName = player.name;
    console.log(`[DRAW-DEBUG] ${playerName} drawing from: ${drawFrom}, pile length: ${this.room.discardPile.length}, threw ${cardsToThrow.length} cards`);

    const isPileDraw = drawFrom === 'pile' || drawFrom === 'pileFirst' || drawFrom === 'pileLast' || drawFrom === 'pileIndex' || drawFrom === 'pileCardId';
    const prevGroupLength = this.room.lastDiscardGroup?.length ?? 0;

    if (isPileDraw) {
      // Take from pile (the card that was on top BEFORE we added cardsToThrow)
      const pileLengthBeforeThrow = this.room.discardPile.length - cardsToThrow.length;
      console.log(`[DRAW-DEBUG] Pile length before throw: ${pileLengthBeforeThrow}`);
      if (pileLengthBeforeThrow > 0) {
        const groupLength = Math.min(prevGroupLength || 1, pileLengthBeforeThrow);
        const groupStartIndex = Math.max(0, pileLengthBeforeThrow - groupLength);
        const groupEndIndex = pileLengthBeforeThrow - 1;
        let targetIndex: number;
        if (drawFrom === 'pileCardId' && pileCardId) {
          const found = this.room.discardPile.findIndex((c, i) => i >= groupStartIndex && i <= groupEndIndex && c.id === pileCardId);
          if (found >= 0) targetIndex = found;
          else {
            const pilePick = 'last';
            targetIndex = groupEndIndex;
          }
        } else if (drawFrom === 'pileIndex' && typeof pileIndex === 'number' && pileIndex >= 0 && pileIndex < groupLength) {
          targetIndex = groupStartIndex + pileIndex;
        } else {
          const pilePick = drawFrom === 'pileFirst' ? 'first' : 'last';
          targetIndex = pilePick === 'first' ? groupStartIndex : groupEndIndex;
        }
        drawnCard = this.room.discardPile[targetIndex];
        console.log(`[DRAW-DEBUG] Taking from pile index ${targetIndex}: ${drawnCard?.rank}${drawnCard?.suit}`);
        this.room.discardPile.splice(targetIndex, 1);
      } else {
        // Pile was empty before throw - can't take from pile, take from deck instead
        console.log(`[DRAW-DEBUG] Pile was empty before throw, drawing from deck instead`);
        if (this.room.deck.length === 0) {
          const topCard = this.room.discardPile.pop();
          this.room.deck = shuffleDeck(this.room.discardPile);
          this.room.discardPile = topCard ? [topCard] : [];
        }
        drawnCard = this.room.deck.shift();
      }
    } else {
      // Take from deck
      if (this.room.deck.length === 0) {
        // Reshuffle discard pile (except top card)
        const topCard = this.room.discardPile.pop();
        this.room.deck = shuffleDeck(this.room.discardPile);
        this.room.discardPile = topCard ? [topCard] : [];
      }
      drawnCard = this.room.deck.shift();
      console.log(`[DRAW-DEBUG] Drew from deck: ${drawnCard?.rank}${drawnCard?.suit}`);
    }

    // Notify others about human move for animations (with drawnCard for pile picks)
    if (!player.isAi) {
      console.log(`[PLAYER-MOVE] Emitting playerMove for ${player.name} (${playerId}), drawFrom: ${drawFrom}, drawnCard: ${drawnCard?.rank}${drawnCard?.suit}`);
      this.onPlayerMove?.(playerId, cardsToThrow, drawFrom, drawnCard);
    }

    // Update last discard group to the cards just thrown
    this.room.lastDiscardGroup = [...cardsToThrow];

    if (drawnCard) {
      player.cards = sortHand([...player.cards, drawnCard]);

      // Check for sticking opportunity (same rank, from deck, sticking enabled)
      if (
        this.room.settings.allowSticking &&
        drawFrom === 'deck' &&
        drawnCard.rank === lastThrownRank
      ) {
        this.startStickingWindow(playerId, drawnCard);
      } else {
        this.advanceTurn();
      }
    } else {
      this.advanceTurn();
    }

    this.room.lastActivity = Date.now();

    // Notify players
    this.room.players.forEach(p => {
      this.onGameStateUpdated?.(this.toClientGameState(p.odId), p.odId);
    });

    return { success: true };
  }

  // === Sticking ===
  private startStickingWindow(playerId: string, card: Card): void {
    this.stickingPlayerId = playerId;
    this.stickingCard = card;

    const STICKING_TIMEOUT_MS = 2000;
    this.onStickingAvailable?.(playerId, card, STICKING_TIMEOUT_MS);

    this.stickingTimer = setTimeout(() => {
      this.expireSticking();
    }, STICKING_TIMEOUT_MS);
  }

  private clearStickingTimer(): void {
    if (this.stickingTimer) {
      clearTimeout(this.stickingTimer);
      this.stickingTimer = null;
    }
    this.stickingCard = null;
    this.stickingPlayerId = null;
  }

  private expireSticking(): void {
    if (this.stickingPlayerId) {
      this.onStickingExpired?.(this.stickingPlayerId);
    }
    this.clearStickingTimer();
    this.advanceTurn();
  }

  executeStick(playerId: string): { success: boolean; message?: string } {
    if (playerId !== this.stickingPlayerId || !this.stickingCard) {
      return { success: false, message: 'No sticking available' };
    }

    const player = this.room.players.find(p => p.odId === playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const cardToStick = this.stickingCard;
    // Remove card from hand
    player.cards = player.cards.filter(c => c.id !== cardToStick.id);

    // Add to discard pile
    this.room.discardPile.push(cardToStick);
    this.room.lastDiscardGroup = [cardToStick];

    this.onStickPerformed?.(playerId, cardToStick);
    this.clearStickingTimer();
    this.room.lastActivity = Date.now();

    // Notify players
    this.room.players.forEach(p => {
      this.onGameStateUpdated?.(this.toClientGameState(p.odId), p.odId);
    });

    this.advanceTurn();
    return { success: true };
  }

  skipStick(playerId: string): void {
    if (playerId === this.stickingPlayerId) {
      this.expireSticking();
    }
  }

  // === Yaniv ===
  callYaniv(playerId: string): { success: boolean; message?: string } {
    const player = this.room.players.find(p => p.odId === playerId);
    if (!player) return { success: false, message: 'Player not found' };
    
    const playerIndex = this.room.players.findIndex(p => p.odId === playerId);
    if (playerIndex !== this.room.currentTurnIndex) {
      return { success: false, message: 'Not your turn' };
    }

    const handValue = getHandValue(player.cards);
    if (!canCallYaniv(handValue)) {
      return { success: false, message: 'Hand value too high for Yaniv' };
    }

    this.clearTurnTimer();
    this.clearStickingTimer();

    // Check for Assaf
    const { isAssaf, winnerId } = checkForAssaf(
      playerId,
      handValue,
      this.room.players.map(p => ({ odId: p.odId, cards: p.cards }))
    );

    const winner = this.room.players.find(p => p.odId === winnerId)!;

    // Calculate scores
    const scoreResults = calculateRoundScores(
      winnerId,
      playerId,
      isAssaf,
      this.room.players.map(p => ({ odId: p.odId, cards: p.cards, score: p.score }))
    );

    // Update player scores
    for (const result of scoreResults) {
      const p = this.room.players.find(pl => pl.odId === result.odId);
      if (p) {
        p.score = result.newScore;
      }
    }

    // Build round result
    const roundResult: RoundResult = {
      winnerId,
      winnerName: winner.name,
      type: isAssaf ? 'assaf' : 'yaniv',
      callerId: playerId,
      callerName: player.name,
      playerResults: this.room.players.map(p => {
        const scoreResult = scoreResults.find(s => s.odId === p.odId)!;
        return {
          odId: p.odId,
          name: p.name,
          avatar: p.avatar,
          cards: [...p.cards],
          pointsAdded: scoreResult.pointsAdded,
          newScore: scoreResult.newScore,
          isEliminated: scoreResult.newScore >= this.room.settings.scoreLimit,
        };
      }),
    };

    this.room.status = 'roundEnd';
    this.room.lastRoundWinnerId = winnerId;
    this.room.lastActivity = Date.now();

    console.log(`[ROUND-DEBUG] Round ended. Winner ID: ${winnerId}, Winner name: ${winner.name}, isAssaf: ${isAssaf}`);
    console.log(`[ROUND-DEBUG] Set lastRoundWinnerId to: ${this.room.lastRoundWinnerId}`);

    this.onRoundEnded?.(roundResult);

    // Check if game is over
    const eliminated = this.room.players.filter(p => p.score >= this.room.settings.scoreLimit);
    const remaining = this.room.players.filter(p => p.score < this.room.settings.scoreLimit);

    if (remaining.length <= 1 || eliminated.length > 0) {
      this.endGame();
    } else {
      // Start next round after delay
      setTimeout(() => {
        this.startNextRound();
      }, 5000);
    }

    return { success: true };
  }

  private startNextRound(): void {
    // Remove eliminated players
    this.room.players = this.room.players.filter(p => p.score < this.room.settings.scoreLimit);

    if (this.room.players.length < 2) {
      this.endGame();
      return;
    }

    // DO NOT reset scores here - scores carry over between rounds
    // Only reset on new game (in startGame)

    this.room.roundNumber++;
    this.room.status = 'playing';
    this.isFirstTurnOfRound = true; // Reset for new round
    this.dealCards();
    
    console.log(`[ROUND-DEBUG] Starting round ${this.room.roundNumber}. lastRoundWinnerId: ${this.room.lastRoundWinnerId}`);
    console.log(`[ROUND-DEBUG] Players: ${this.room.players.map((p, i) => `[${i}] ${p.name} (${p.odId})`).join(', ')}`);
    
    if (this.room.lastRoundWinnerId) {
      const winnerIndex = this.room.players.findIndex(p => p.odId === this.room.lastRoundWinnerId);
      console.log(`[ROUND-DEBUG] Found winner at index: ${winnerIndex}`);
      this.room.currentTurnIndex = winnerIndex >= 0 ? winnerIndex : 0;
    } else {
      console.log(`[ROUND-DEBUG] No lastRoundWinnerId, defaulting to index 0`);
      this.room.currentTurnIndex = 0;
    }
    
    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    console.log(`[ROUND-DEBUG] Current turn index: ${this.room.currentTurnIndex}, player: ${currentPlayer?.name}`);
    
    this.room.turnStartTime = Date.now();
    this.room.lastActivity = Date.now();

    // Notify all players
    this.room.players.forEach(player => {
      this.onGameStateUpdated?.(this.toClientGameState(player.odId), player.odId);
    });

    this.startTurnTimer();
    this.checkAiTurn();
  }

  private endGame(): void {
    this.clearTurnTimer();
    this.clearStickingTimer();

    const finalScores = this.room.players
      .map(p => ({ odId: p.odId, name: p.name, avatar: p.avatar, score: p.score }))
      .sort((a, b) => a.score - b.score);

    this.onGameEnded?.(finalScores);
    this.resetToWaiting();
  }

  /** Reset room to waiting state for rematch (same players, new game) */
  private resetToWaiting(): void {
    this.room.status = 'waiting';
    this.room.deck = [];
    this.room.discardPile = [];
    this.room.lastDiscardGroup = [];
    this.room.currentTurnIndex = 0;
    this.room.turnStartTime = 0;
    this.room.roundNumber = 0;
    for (const p of this.room.players) {
      p.cards = [];
    }
    this.onRoomUpdated?.(this.toClientRoom());

    if (this.playAgainHostTimer) {
      clearTimeout(this.playAgainHostTimer);
      this.playAgainHostTimer = null;
    }
    this.playAgainHostTimer = setTimeout(() => {
      this.playAgainHostTimer = null;
      const host = this.room.players.find(p => p.odId === this.room.hostId);
      const connectedHumans = this.room.players.filter(p => !p.isAi && p.isConnected);
      if (host && !host.isConnected && connectedHumans.length > 0) {
        const newHost = connectedHumans[Math.floor(Math.random() * connectedHumans.length)];
        newHost.isHost = true;
        this.room.hostId = newHost.odId;
        console.log(`[Room] Host reassigned to ${newHost.name} (original host left)`);
        this.onRoomUpdated?.(this.toClientRoom());
      }
    }, 15000);
  }

  // === Conversion to Client Types ===
  private toClientPlayer(player: Player): ClientPlayer {
    return {
      odId: player.odId,
      name: player.name,
      avatar: player.avatar,
      cardCount: player.cards.length,
      score: player.score,
      isHost: player.isHost,
      isAi: player.isAi,
      isConnected: player.isConnected,
    };
  }

  toClientRoom(): ClientRoom {
    return {
      code: this.room.code,
      hostId: this.room.hostId,
      settings: { ...this.room.settings },
      status: this.room.status,
      players: this.room.players.map(p => this.toClientPlayer(p)),
    };
  }

  toClientGameState(forPlayerId?: string): ClientGameState {
    const currentPlayer = this.room.players[this.room.currentTurnIndex];
    const player = forPlayerId ? this.room.players.find(p => p.odId === forPlayerId) : undefined;

    return {
      status: this.room.status,
      players: this.room.players.map(p => this.toClientPlayer(p)),
      discardPile: [...this.room.discardPile],
      lastDiscardGroup: this.room.lastDiscardGroup ? [...this.room.lastDiscardGroup] : undefined,
      deckCount: this.room.deck.length,
      currentTurnOdId: currentPlayer?.odId || '',
      turnStartTime: this.room.turnStartTime,
      roundNumber: this.room.roundNumber,
      yourCards: player ? [...player.cards] : undefined,
    };
  }

  // === Cleanup ===
  destroy(): void {
    this.clearTurnTimer();
    this.clearStickingTimer();
    if (this.playAgainHostTimer) {
      clearTimeout(this.playAgainHostTimer);
      this.playAgainHostTimer = null;
    }
  }
}
