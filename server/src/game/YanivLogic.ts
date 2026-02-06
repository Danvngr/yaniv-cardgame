import { Card, Suit, Rank } from '../types';
import { v4 as uuidv4 } from 'uuid';

// === Card Value Calculation ===
export function getCardValue(rank: Rank): number {
  if (rank === 'Joker') return 0;
  if (rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank);
}

export function getHandValue(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.value, 0);
}

// === Deck Generation ===
export function generateDeck(numDecks: number = 2): Card[] {
  const suits: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (let d = 0; d < numDecks; d++) {
    // Regular cards
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: uuidv4(),
          suit,
          rank,
          value: getCardValue(rank),
        });
      }
    }
    // 2 Jokers per deck
    deck.push({ id: uuidv4(), suit: 'joker', rank: 'Joker', value: 0 });
    deck.push({ id: uuidv4(), suit: 'joker', rank: 'Joker', value: 0 });
  }

  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// === Card Sorting ===
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, joker: 5 };
  return [...cards].sort((a, b) => {
    if (a.rank === 'Joker') return -1;
    if (b.rank === 'Joker') return 1;
    const valDiff = a.value - b.value;
    if (valDiff !== 0) return valDiff;
    return suitOrder[a.suit] - suitOrder[b.suit];
  });
}

// === Move Validation ===
function getRankValue(rank: Rank): number {
  const map: Record<string, number> = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'Joker': 0
  };
  return map[rank] || 0;
}

// Check if cards form a valid set (same rank)
function isSameRankSet(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const nonJokers = cards.filter(c => c.rank !== 'Joker');
  if (nonJokers.length === 0) return false;
  const firstRank = nonJokers[0].rank;
  return nonJokers.every(c => c.rank === firstRank);
}

// Check if cards have duplicate ranks (for run validation)
function hasDuplicateRanks(cards: Card[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.rank === 'Joker') continue;
    if (seen.has(card.rank)) return true;
    seen.add(card.rank);
  }
  return false;
}

// Check if cards form a valid run (same suit, consecutive)
function isRunSet(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  
  const nonJokers = cards.filter(c => c.rank !== 'Joker');
  if (nonJokers.length === 0) return false;
  
  // All non-jokers must be same suit
  const firstSuit = nonJokers[0].suit;
  if (!nonJokers.every(c => c.suit === firstSuit)) return false;
  
  // No duplicate ranks
  if (hasDuplicateRanks(nonJokers)) return false;
  
  // Check if jokers can fill the gaps
  const sorted = [...nonJokers].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
  let gaps = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentVal = getRankValue(sorted[i].rank);
    const nextVal = getRankValue(sorted[i + 1].rank);
    gaps += (nextVal - currentVal - 1);
  }
  
  const jokersCount = cards.length - nonJokers.length;
  return gaps <= jokersCount;
}

// Validate a throw (1 card, same rank set, or run)
export function isValidThrow(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  if (isSameRankSet(cards)) return true;
  if (isRunSet(cards)) return true;
  return false;
}

// Validate that player has these cards
export function playerHasCards(playerCards: Card[], cardIds: string[]): boolean {
  const playerCardIds = new Set(playerCards.map(c => c.id));
  return cardIds.every(id => playerCardIds.has(id));
}

// === Yaniv/Assaf Logic ===
export function canCallYaniv(handValue: number): boolean {
  return handValue <= 7;
}

export function checkForAssaf(
  callerId: string,
  callerHandValue: number,
  players: { odId: string; cards: Card[] }[]
): { isAssaf: boolean; winnerId: string } {
  // Find if anyone has equal or lower hand value
  for (const player of players) {
    if (player.odId === callerId) continue;
    const theirValue = getHandValue(player.cards);
    if (theirValue <= callerHandValue) {
      return { isAssaf: true, winnerId: player.odId };
    }
  }
  return { isAssaf: false, winnerId: callerId };
}

// === Score Calculation ===
export function applyScoreCut(score: number): number {
  // If score lands exactly on 50, 100, 150, 200 - cut in half
  const cutPoints = [50, 100, 150, 200];
  if (cutPoints.includes(score)) {
    return Math.floor(score / 2);
  }
  return score;
}

export function calculateRoundScores(
  winnerId: string,
  callerId: string,
  isAssaf: boolean,
  players: { odId: string; cards: Card[]; score: number }[]
): { odId: string; pointsAdded: number; newScore: number }[] {
  return players.map(player => {
    const handValue = getHandValue(player.cards);
    let pointsAdded: number;

    if (player.odId === winnerId) {
      // Winner gets 0 points
      pointsAdded = 0;
    } else if (isAssaf && player.odId === callerId) {
      // Caller who got Assaf gets hand value + 30 penalty
      pointsAdded = handValue + 30;
    } else {
      // Everyone else gets their hand value
      pointsAdded = handValue;
    }

    const rawNewScore = player.score + pointsAdded;
    const newScore = applyScoreCut(rawNewScore);

    return { odId: player.odId, pointsAdded, newScore };
  });
}

// === AI Logic ===
export function getAiMove(hand: Card[], topDiscard?: Card): { cardsToThrow: Card[]; drawFrom: 'deck' | 'pile' } {
  // Simple AI: throw highest value valid group, then decide draw source
  const allGroups = getAllValidGroups(hand);
  
  if (allGroups.length === 0) {
    const sorted = [...hand].sort((a, b) => b.value - a.value);
    return { cardsToThrow: [sorted[0]], drawFrom: decideDrawSource(hand, [sorted[0]], topDiscard) };
  }

  const bestGroup = allGroups.sort((a, b) => {
    const sumA = a.reduce((s, c) => s + c.value, 0);
    const sumB = b.reduce((s, c) => s + c.value, 0);
    return sumB - sumA;
  })[0];

  return { cardsToThrow: bestGroup, drawFrom: decideDrawSource(hand, bestGroup, topDiscard) };
}

function decideDrawSource(hand: Card[], cardsToThrow: Card[], topDiscard?: Card): 'deck' | 'pile' {
  if (!topDiscard) {
    console.log(`[AI-DECIDE] No topDiscard, choosing deck`);
    return 'deck';
  }

  const remainingHand = hand.filter(c => !cardsToThrow.some(t => t.id === c.id));
  const wouldFormGroupWithTop = () => {
    const groups = getAllValidGroups([...remainingHand, topDiscard]);
    return groups.some(g => g.length >= 2 && g.some(c => c.id === topDiscard.id));
  };

  const lowValue = topDiscard.value <= 3;
  const matchesRank = remainingHand.some(c => c.rank === topDiscard.rank);
  const formsGroup = wouldFormGroupWithTop();

  const shouldTakeFromPile = lowValue || matchesRank || formsGroup;

  console.log(`[AI-DECIDE] TopDiscard: ${topDiscard.rank}${topDiscard.suit} (value=${topDiscard.value})`);
  console.log(`[AI-DECIDE] Checks: lowValue=${lowValue}, matchesRank=${matchesRank}, formsGroup=${formsGroup}`);
  console.log(`[AI-DECIDE] Decision: ${shouldTakeFromPile ? 'pile' : 'deck'}`);

  return shouldTakeFromPile ? 'pile' : 'deck';
}

function getAllValidGroups(cards: Card[]): Card[][] {
  const results: Card[][] = [];
  const n = cards.length;

  const recurse = (start: number, current: Card[]) => {
    if (current.length > 0 && isValidThrow(current)) {
      results.push([...current]);
    }
    for (let i = start; i < n; i++) {
      current.push(cards[i]);
      recurse(i + 1, current);
      current.pop();
    }
  };

  recurse(0, []);
  return results;
}

export function shouldAiCallYaniv(hand: Card[]): boolean {
  const handValue = getHandValue(hand);
  // AI calls Yaniv if hand value is 5 or less (conservative)
  return handValue <= 5;
}
