import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, Home, Settings } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Dimensions, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, UIManager, Vibration, View, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSound } from '../context/SoundContext';
import { BACKGROUND_IMAGES, CARD_IMAGES } from '../lib/assetPreloader';
import { playAssaf, playFlick, playPick, playStick, playYaniv } from '../lib/gameSounds';
import { ClientGameState, RoundResult as ServerRoundResult, socketService } from '../lib/socketService';
import { setUserInRoom } from '../lib/userService';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- Sizes (zoomed in) ---
const CARD_RATIO = 1.4;
const AVATAR_SIZE = 48;
const TURN_RING_SIZE = 60;
const TURN_RING_STROKE = 3;
const PROFILE_AVATAR_KEY = 'profile:avatar';
const PROFILE_USERNAME_KEY = 'profile:username';
const FALLBACK_AI_NAMES = ['Sage', 'Lyra', 'Finn', 'Juno', 'Atlas', 'Iris', 'Silas', 'Cora', 'Felix', 'Nova'];

// My hand cards (bottom)
const MY_CARD_WIDTH = width * 0.18; 
const MY_CARD_HEIGHT = MY_CARD_WIDTH * CARD_RATIO;

// Table pile cards (center stacks) — larger
const TABLE_CARD_WIDTH = width * 0.22;
const TABLE_CARD_HEIGHT = TABLE_CARD_WIDTH * CARD_RATIO;

// Opponent cards — larger for zoomed-in layout
const getMiniCardWidth = (playerCount: number) => {
    if (playerCount <= 2) return width * 0.17;
    if (playerCount === 3) return width * 0.15;
    return width * 0.13;
};
const MINI_CARD_WIDTH = width * 0.17;
const MINI_CARD_HEIGHT = MINI_CARD_WIDTH * CARD_RATIO;

// --- Positions (tropical layout) ---
const TABLE_TOP_PCT = 0.56; // Piles slightly lower on table
const TABLE_Y_POS = height * TABLE_TOP_PCT;
const CENTER_OFFSET = 12 + (TABLE_CARD_WIDTH / 2); // Gap between deck and discard

const PILE_POSITION = { x: width / 2 - CENTER_OFFSET, y: TABLE_Y_POS }; 
const DECK_POSITION = { x: width / 2 + CENTER_OFFSET, y: TABLE_Y_POS }; 
const HAND_POSITION = { x: width / 2, y: height - 80 }; 
// Fallback only. At runtime we measure the real pile location on screen.
const FALLBACK_FLYING_PILE_POSITION = {
    x: PILE_POSITION.x - (MY_CARD_WIDTH / 2),
    y: PILE_POSITION.y - (MY_CARD_HEIGHT / 2),
};

// Opponent positions
const OPP_TOP_POSITION = { x: width / 2, y: 70 };
const OPP_LEFT_POSITION = { x: 15, y: height * 0.21 }; // Near left wall; fan raised ~30%
const OPP_RIGHT_POSITION = { x: width - 15, y: height * 0.21 }; // Near right wall

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';
type Position = 'top' | 'left' | 'right';

// Resolve card face image (CARD_IMAGES from assetPreloader)
const getCardImage = (suit: Suit, rank: Rank): any => {
    if (rank === 'Joker' || suit === 'joker') {
        return CARD_IMAGES['joker'];
    }
    const key = `${suit}-${rank}`;
    return (CARD_IMAGES as Record<string, any>)[key] || null;
};

interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

interface Player {
  id: string;
  name: string;
  cardsCount: number;
  totalScore: number;
  isTurn: boolean;
  position: Position;
  avatar: string;
  isAi?: boolean;
}

interface PlayerWithCards extends Player {
  cards: Card[];
}

type RoomPlayer = {
  name: string;
  avatar: string;
  isHost?: boolean;
  isAi?: boolean;
};

type RoundEndType = 'yaniv' | 'assaf' | null;

interface RoundResult {
  winner: { id: string; name: string; type: 'yaniv' | 'assaf' };
  players: {
    id: string;
    name: string;
    avatar: string;
    cards: Card[];
    pointsAdded: number;
    previousScore?: number;
    totalScore: number;
    isEliminated: boolean;
  }[];
  scoreLimit: number;
}

// --- Game logic helpers ---
const getRankValue = (rank: Rank): number => {
    const map: Record<string, number> = {
        'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 
        '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'Joker': 0
    };
    return map[rank] || 0;
};

const sortHand = (cards: Card[]): Card[] => {
    const suitOrder = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, joker: 5 };
    return [...cards].sort((a, b) => {
        if (a.rank === 'Joker') return -1;
        if (b.rank === 'Joker') return 1;
        const valA = getRankValue(a.rank);
        const valB = getRankValue(b.rank);
        if (valA !== valB) return valA - valB;
        return suitOrder[a.suit] - suitOrder[b.suit];
    });
};

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Build N full decks (with jokers) and shuffle
const generateFullDeck = (numDecks: number = 4): Card[] => {
    const suits: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];
    
    for (let d = 0; d < numDecks; d++) {
        // 52 standard cards per deck
        for (const suit of suits) {
            for (const rank of ranks) {
                let value = parseInt(rank);
                if (isNaN(value)) { if (rank === 'A') value = 1; else value = 10; }
                deck.push({ id: `${d}-${suit}-${rank}`, suit, rank, value });
            }
        }
        // 2 jokers per deck
        deck.push({ id: `${d}-joker-1`, suit: 'joker', rank: 'Joker', value: 0 });
        deck.push({ id: `${d}-joker-2`, suit: 'joker', rank: 'Joker', value: 0 });
    }
    
    return shuffleArray(deck);
};

// Deal cards from deck top
const dealFromDeck = (deck: Card[], count: number): { dealt: Card[], remaining: Card[] } => {
    const dealt = sortHand(deck.slice(0, count));
    const remaining = deck.slice(count);
    return { dealt, remaining };
};

// Initialize offline deal (hands for all players)
const initializeGame = (playerCount: number = 4, cardsPerPlayer: number = 5) => {
    let deck = generateFullDeck(4); // 4 decks = 216 cards
    
    const hands: Card[][] = [];
    for (let i = 0; i < playerCount; i++) {
        const { dealt, remaining } = dealFromDeck(deck, cardsPerPlayer);
        hands.push(dealt);
        deck = remaining;
    }
    
    // First card starts discard pile
    const firstDiscard = deck[0];
    deck = deck.slice(1);
    
    return { hands, initialDiscard: firstDiscard, remainingDeck: deck };
};

// Random card for temp use / fallback
const generateRandomCard = (): Card => {
    const suits: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    if (Math.random() < 0.04) return { id: Math.random().toString(), suit: 'joker', rank: 'Joker', value: 0 };
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    let value = parseInt(randomRank);
    if (isNaN(value)) { if (randomRank === 'A') value = 1; else value = 10; }
    return { id: Math.random().toString(), suit: randomSuit, rank: randomRank, value: value };
};

const generateInitialHand = (count: number = 5): Card[] => sortHand(Array.from({ length: count }).map(() => generateRandomCard()));

const isSameRankSet = (cards: Card[], minSize: number): boolean => {
    if (cards.length < minSize) return false;
    if (cards.some(c => c.rank === 'Joker')) return false;
    const firstRank = cards[0].rank;
    return cards.every(c => c.rank === firstRank);
};

const hasDuplicateRanks = (cards: Card[]): boolean => {
    const seen = new Set<string>();
    for (const card of cards) {
        if (seen.has(card.rank)) return true;
        seen.add(card.rank);
    }
    return false;
};

const isRunSet = (cards: Card[], minSize: number): boolean => {
    if (cards.length < minSize) return false;
    const nonJokers = cards.filter(c => c.rank !== 'Joker');
    if (nonJokers.length === 0) return false;
    const firstSuit = nonJokers[0].suit;
    if (!nonJokers.every(c => c.suit === firstSuit)) return false;
    if (hasDuplicateRanks(nonJokers)) return false;
    const sorted = [...nonJokers].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
    let gaps = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        const currentVal = getRankValue(sorted[i].rank);
        const nextVal = getRankValue(sorted[i + 1].rank);
        gaps += (nextVal - currentVal - 1);
    }
    const jokersCount = cards.length - nonJokers.length;
    return gaps <= jokersCount;
};

const orderRunCardsForDiscard = (cards: Card[]): Card[] => {
    if (!isRunSet(cards, 3)) return cards;

    const sortedNonJokers = cards
        .filter(c => c.rank !== 'Joker')
        .sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
    const jokers = cards.filter(c => c.rank === 'Joker');
    const ordered: Card[] = [];

    sortedNonJokers.forEach((card, index) => {
        ordered.push(card);
        const nextCard = sortedNonJokers[index + 1];
        if (!nextCard) return;

        const gapSize = getRankValue(nextCard.rank) - getRankValue(card.rank) - 1;
        for (let gap = 0; gap < gapSize && jokers.length > 0; gap++) {
            ordered.push(jokers.shift()!);
        }
    });

    if (jokers.length === 0) return ordered;

    const lowestValue = getRankValue(sortedNonJokers[0].rank);
    const prefixCount = Math.min(jokers.length, Math.max(0, lowestValue - 1));
    const prefixJokers = jokers.splice(0, prefixCount);

    return [...prefixJokers, ...ordered, ...jokers];
};

const isPotentialSet = (selectedCards: Card[], newCard: Card): boolean => {
    const allCards = [...selectedCards, newCard];
    if (allCards.length === 1) return true;
    const hasJoker = allCards.some(c => c.rank === 'Joker');
    if (hasJoker) {
        if (allCards.length >= 3) return isRunSet(allCards, 3);
        const nonJokers = allCards.filter(c => c.rank !== 'Joker');
        if (nonJokers.length === 0) return true;
        const firstSuit = nonJokers[0].suit;
        if (!nonJokers.every(c => c.suit === firstSuit)) return false;
        if (hasDuplicateRanks(nonJokers)) return false;
        return true;
    }
    if (isSameRankSet(allCards, 2)) return true;
    const nonJokers = allCards.filter(c => c.rank !== 'Joker');
    if (nonJokers.length === 0) return true;
    const firstSuit = nonJokers[0].suit;
    if (!nonJokers.every(c => c.suit === firstSuit)) return false;
    if (hasDuplicateRanks(nonJokers)) return false;
    return true;
};

const isValidSetGroup = (cards: Card[]): boolean => {
    if (cards.length === 0) return false;
    if (cards.length === 1) return true;
    const hasJoker = cards.some(c => c.rank === 'Joker');
    if (hasJoker) {
        return cards.length >= 3 && isRunSet(cards, 3);
    }
    if (isSameRankSet(cards, 2)) return true;
    return isRunSet(cards, 3);
};

const getScoreCutPoints = (scoreLimit: number): number[] => [50, 100, 200].filter(point => point <= scoreLimit);

const isGameFinished = (
  players: { totalScore: number; isEliminated: boolean }[],
  scoreLimit: number
): boolean => {
  const someoneExceededLimit = players.some(p => p.totalScore >= scoreLimit);
  const onlyOneLeft = players.filter(p => !p.isEliminated).length <= 1;
  return someoneExceededLimit || onlyOneLeft;
};

const getHandValue = (cards: Card[]) => cards.reduce((sum, card) => sum + card.value, 0);

const getPositionsForOpponents = (count: number): Position[] => {
    if (count <= 1) return ['top'] as Position[];
    if (count === 2) return ['left', 'right'] as Position[];
    const positions: Position[] = ['left', 'top', 'right'];
    return positions.slice(0, count);
};

const getAllValidGroups = (cards: Card[]): Card[][] => {
    const results: Card[][] = [];
    const n = cards.length;
    const recurse = (start: number, current: Card[]) => {
        if (current.length > 0 && isValidSetGroup(current)) {
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
};

const getBestDiscardGroup = (cards: Card[]): Card[] => {
    const groups = getAllValidGroups(cards);
    if (groups.length === 0) return [cards[0]];
    return groups.sort((a, b) => {
        const sumA = getHandValue(a);
        const sumB = getHandValue(b);
        if (sumA !== sumB) return sumB - sumA;
        return b.length - a.length;
    })[0];
};

const getOpponentHandPosition = (position: Position) => {
    if (position === 'left') return OPP_LEFT_POSITION;
    if (position === 'right') return OPP_RIGHT_POSITION;
    return OPP_TOP_POSITION;
};

// --- Visual components ---

const TropicalBackground = React.memo(() => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image 
                source={BACKGROUND_IMAGES['tropical-background']} 
                style={styles.tropicalBackgroundImage}
                resizeMode="cover"
            />
        </View>
    );
});
TropicalBackground.displayName = 'TropicalBackground';

const CardBack = React.memo(({ size = 'regular' }: { size?: 'mini' | 'regular' | 'large' }) => {
    let widthStyle;
    if (size === 'mini') { widthStyle = styles.miniCardSize; }
    else if (size === 'large') { widthStyle = styles.myCardSize; }
    else { widthStyle = styles.tableCardSize; }
    
    return (
        <View style={[styles.tropicalCardBack, widthStyle]}>
            <Image 
                source={BACKGROUND_IMAGES['card-back']} 
                style={styles.cardBackImage}
                resizeMode="cover"
            />
        </View>
    );
});
CardBack.displayName = 'CardBack';

type CardSize = 'mini' | 'regular' | 'large';

type PlayingCardProps = {
    card?: Card;
    isFaceDown?: boolean;
    isSelected?: boolean;
    onPress?: () => void;
    rotate?: string;
    translateY?: number;
    size?: CardSize;
    style?: any;
};

const PlayingCard = React.memo(({ card, isFaceDown = false, isSelected = false, onPress, rotate = '0deg', translateY = 0, size = 'regular', style }: PlayingCardProps) => {
    if (isFaceDown) return <CardBack size={size} />;
    if (!card) return null;

    let dimensionsStyle = styles.tableCardSize;
    
    if (size === 'large') { 
        dimensionsStyle = styles.myCardSize; 
    } else if (size === 'mini') {
        dimensionsStyle = styles.miniCardSize;
    }
    
    // Card face asset
    const cardImage = getCardImage(card.suit, card.rank);

    return (
        <Pressable
            onPress={onPress}
            renderToHardwareTextureAndroid
            style={[styles.cardImageContainer, dimensionsStyle, style, { transform: [{ rotate }, { translateY }] }]}
        >
            <Image 
                source={cardImage} 
                style={styles.cardImage}
                resizeMode="contain"
                fadeDuration={0}
            />
        </Pressable>
    );
});
PlayingCard.displayName = 'PlayingCard';

const PlayerCardView = ({ card, index, total, isSelected, selectionIsValid, onPress, throwAnimValue, isStickCard }: any) => {
    const rotateDeg = (index - (total - 1) / 2) * 4;
    const cardOverlap = -MY_CARD_WIDTH * 0.45;

    // Stable animated values – never switch between Animated.Value and plain number
    const raiseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(raiseAnim, {
            toValue: isSelected ? -25 : 0,
            duration: 120,
            useNativeDriver: true,
        }).start();
    }, [isSelected]);
    
    // Stick card: plain View, not Animated
    if (isStickCard) {
        return (
            <View style={{ 
                marginLeft: index === 0 ? 0 : cardOverlap, 
                zIndex: 100,
                transform: [{ rotate: `${rotateDeg}deg` }, { translateY: -25 }]
            }}>
                <PlayingCard card={card} size="large" isSelected={false} onPress={onPress} style={styles.stickingCard} />
            </View>
        );
    }

    const isThrowAnimating = isSelected && throwAnimValue;

    const animOpacity = isThrowAnimating
        ? throwAnimValue.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] })
        : 1;

    const animTranslateY = isThrowAnimating
        ? throwAnimValue.interpolate({ inputRange: [0, 1], outputRange: [-20, -300] })
        : raiseAnim;

    const animScale = isThrowAnimating
        ? throwAnimValue.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.5] })
        : 1;

    const cardStyle = isSelected ? (selectionIsValid ? styles.validSelectedCard : styles.selectedCard) : undefined;

    return (
        <Animated.View style={{
            marginLeft: index === 0 ? 0 : cardOverlap,
            zIndex: isSelected ? 100 : index,
            opacity: animOpacity,
            transform: [
                { rotate: `${rotateDeg}deg` },
                { translateY: animTranslateY },
                { scale: animScale },
            ],
        }}>
            <PlayingCard card={card} size="large" isSelected={false} onPress={onPress} style={cardStyle} />
        </Animated.View>
    );
};


const PlayerView = ({ player, isMe = false, isLeader = false, handValue, handLabel = 'Hand', turnSecondsLeft, turnDurationSeconds = 60, lastMessage, revealedCards, playerCount = 2, position = 'top' }: { player: Player | PlayerWithCards, isMe?: boolean, isLeader?: boolean, handValue?: number, handLabel?: string, turnSecondsLeft?: number, turnDurationSeconds?: number, lastMessage?: string, revealedCards?: Card[], playerCount?: number, position?: 'top' | 'left' | 'right' }) => {
    const hasValidPlayer = !!player && !!player.id;
    const playerName = player.name || 'Player';
    const playerAvatar = player.avatar || '?';
    const playerTotalScore = player.totalScore ?? 0;
    const playerCardsCount = player.cardsCount ?? 0;
    const playerIsTurn = player.isTurn || false;
    
    const showTurnTimer = playerIsTurn && typeof turnSecondsLeft === 'number';
    const ringSize = TURN_RING_SIZE;
    const ringStroke = TURN_RING_STROKE;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringProgress = showTurnTimer ? Math.max(0, Math.min(1, turnSecondsLeft! / turnDurationSeconds)) : 0;
    const ringOffset = ringCircumference * (1 - ringProgress);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const isLowTime = showTurnTimer && (turnSecondsLeft ?? 0) <= 10;
    
    // Mini card size
    const dynamicMiniCardWidth = getMiniCardWidth(playerCount);
    const miniScale = Math.max(1.0, Math.min(1.3, dynamicMiniCardWidth / MINI_CARD_WIDTH));
    
    // Vertical fan (sides) vs horizontal fan (top)
    const isVerticalFan = position === 'left' || position === 'right';
    const cardSpacing = isVerticalFan ? 28 : 35; // Wider spacing between cards

    useEffect(() => {
        if (!isLowTime) {
            pulseAnim.setValue(1);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true })
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [isLowTime, pulseAnim]);

    // Guard after hooks so React sees the same hook order on every render.
    if (!hasValidPlayer) {
        return null;
    }

    // Render fan: vertical or horizontal
    const renderCardFan = () => {
        const cards = revealedCards && Array.isArray(revealedCards) && revealedCards.length > 0 
            ? revealedCards 
            : null;
        const count = cards ? cards.length : Math.min(playerCardsCount || 0, 5);
        
        return [...Array(count)].map((_, i) => {
            const card = cards ? cards[i] : null;
            if (cards && (!card || !card.id)) return null;
            
            const total = count;
            const middle = total > 0 ? (total - 1) / 2 : 0;
                        const diff = i - middle;
            
            // Side fans: top-to-bottom stack
            // Top fan: inverted arc toward ceiling
            const transform = isVerticalFan 
                ? [
                    { translateY: diff * cardSpacing },
                    { rotate: `${diff * 10}deg` },
                    { translateX: Math.abs(diff) * 4 },
                    { scale: miniScale }
                ]
                : [
                    { translateX: diff * cardSpacing },
                    { rotate: `${-diff * 12}deg` },  // Reverse rotation direction
                    { translateY: -Math.abs(diff) * 8 },  // Arc upward (negative Y)
                    { scale: miniScale }
                ];
            
            return (
                <View key={card?.id || `card-back-${i}`} style={[styles.miniFanCard, { 
                    transform,
                    zIndex: i
                }]}>
                    {card ? <PlayingCard card={card} size="mini" /> : <CardBack size="mini" />}
                             </View>
                        );
        });
    };

    // Side opponents: fan center, avatar+name on outer side
    if (!isMe && isVerticalFan) {
        const isLeftSide = position === 'left';
        return (
            <View style={[styles.sidePlayerWrapper, isLeftSide ? styles.sidePlayerLeft : styles.sidePlayerRight]}>
                {/* Chat bubble */}
                {lastMessage ? (
                    <View style={[
                        styles.sidePlayerMessageBubble, 
                        isLeftSide ? styles.sideMessageLeft : styles.sideMessageRight
                    ]} pointerEvents="none">
                        <Text style={styles.playerMessageText}>{String(lastMessage)}</Text>
                    </View>
                ) : null}
                
                {/* Row: cards + (avatar+name) */}
                <View style={[styles.sidePlayerContent, { flexDirection: isLeftSide ? 'row' : 'row-reverse' }]}>
                    {/* Cards */}
                    <View style={styles.verticalFanContainerSide}>
                        {renderCardFan()}
                    </View>
                    
                    {/* Avatar and name on opposite side from fan */}
                    <View style={[styles.sidePlayerInfo, { marginLeft: isLeftSide ? 8 : 0, marginRight: isLeftSide ? 0 : 8 }]}>
                        <View style={styles.avatarContainerSmall}>
                            {showTurnTimer ? (
                                <Animated.View style={[styles.turnRingContainerSmall, isLowTime ? { transform: [{ scale: pulseAnim }] } : undefined]} pointerEvents="none">
                                    <Svg width={ringSize * 0.8} height={ringSize * 0.8}>
                                        <Circle cx={ringSize * 0.4} cy={ringSize * 0.4} r={(ringSize * 0.8 - ringStroke) / 2} stroke={isLowTime ? '#7F1D1D' : '#064E3B'} strokeWidth={ringStroke} fill="none" />
                                        <Circle cx={ringSize * 0.4} cy={ringSize * 0.4} r={(ringSize * 0.8 - ringStroke) / 2} stroke={isLowTime ? '#EF4444' : '#22C55E'} strokeWidth={ringStroke} strokeLinecap="round" fill="none" strokeDasharray={`${ringCircumference * 0.8} ${ringCircumference * 0.8}`} strokeDashoffset={ringOffset * 0.8} rotation="-90" origin={`${ringSize * 0.4}, ${ringSize * 0.4}`} />
                                    </Svg>
                                </Animated.View>
                            ) : null}
                            <View style={[styles.avatarCircleSmall, isLeader ? { borderColor: '#FBBF24' } : undefined]}>
                                <Text style={{fontSize: 18}}>{playerAvatar || '?'}</Text>
                            </View>
                            {isLeader ? (
                                <View style={styles.crownBadgeSmall}><Crown size={8} color="#92400e" fill="#FBBF24" /></View>
                            ) : null}
                            <View style={styles.scoreBadgeSmall}>
                                <Text style={[styles.scoreText, { fontSize: 9 }]}>{String(playerTotalScore ?? 0)}</Text>
                            </View>
                        </View>
                        <View style={styles.nameTagSmall}>
                            <Text style={[styles.nameText, { fontSize: 10 }]}>{playerName}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // Top opponent: cards above, avatar+name below
    if (!isMe && position === 'top') {
        return (
            <View style={styles.topOpponentWrapper}>
                {/* Cards on top */}
                <View style={styles.topOpponentFanContainer}>
                    {renderCardFan()}
                </View>
                
                {/* Avatar and name below */}
                <View style={styles.topOpponentInfoBelow}>
                    {lastMessage ? (
                        <View style={styles.playerMessageBubble} pointerEvents="none">
                            <Text style={styles.playerMessageText}>{String(lastMessage)}</Text>
                        </View>
                    ) : null}
                    <View style={styles.avatarContainer}>
                        {showTurnTimer ? (
                            <Animated.View style={[styles.turnRingContainer, isLowTime ? { transform: [{ scale: pulseAnim }] } : undefined]} pointerEvents="none">
                                <Svg width={ringSize} height={ringSize}>
                                    <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={isLowTime ? '#7F1D1D' : '#064E3B'} strokeWidth={ringStroke} fill="none" />
                                    <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={isLowTime ? '#EF4444' : '#22C55E'} strokeWidth={ringStroke} strokeLinecap="round" fill="none" strokeDasharray={`${ringCircumference} ${ringCircumference}`} strokeDashoffset={ringOffset} rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`} />
                                </Svg>
                            </Animated.View>
                        ) : null}
                        <View style={[styles.avatarCircle, isLeader ? { borderColor: '#FBBF24' } : undefined]}>
                            <Text style={{fontSize: 22}}>{playerAvatar || '?'}</Text>
                        </View>
                        {isLeader ? (
                            <View style={styles.crownBadge}><Crown size={10} color="#92400e" fill="#FBBF24" /></View>
                        ) : null}
                        <View style={styles.scoreBadge}>
                            <Text style={styles.scoreText}>{String(playerTotalScore ?? 0)}</Text>
                        </View>
                    </View>
                    <View style={styles.nameTag}>
                        <Text style={[styles.nameText, { fontSize: 12 }]}>{playerName}</Text>
                    </View>
                </View>
            </View>
        );
    }

    // Local player: standard layout
    return (
        <View style={[styles.playerWrapper, playerCount >= 4 ? styles.playerWrapperCompact : undefined]}>
            {lastMessage ? (
                <View style={styles.playerMessageBubble} pointerEvents="none">
                    <Text style={styles.playerMessageText}>{String(lastMessage)}</Text>
                </View>
            ) : null}
            <View style={styles.avatarContainer}>
                {showTurnTimer ? (
                    <Animated.View style={[styles.turnRingContainer, isLowTime ? { transform: [{ scale: pulseAnim }] } : undefined]} pointerEvents="none">
                        <Svg width={ringSize} height={ringSize}>
                            <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={isLowTime ? '#7F1D1D' : '#064E3B'} strokeWidth={ringStroke} fill="none" />
                            <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={isLowTime ? '#EF4444' : '#22C55E'} strokeWidth={ringStroke} strokeLinecap="round" fill="none" strokeDasharray={`${ringCircumference} ${ringCircumference}`} strokeDashoffset={ringOffset} rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`} />
                        </Svg>
                    </Animated.View>
                ) : null}
                <View style={[styles.avatarCircle, isLeader ? { borderColor: '#FBBF24' } : undefined]}>
                    <Text style={{fontSize: 26}}>{playerAvatar || '?'}</Text>
                </View>
                {isLeader ? (
                    <View style={styles.crownBadge}><Crown size={12} color="#92400e" fill="#FBBF24" /></View>
                ) : null}
                <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{String(playerTotalScore ?? 0)}</Text>
                </View>
            </View>

            <View style={styles.nameTag}>
                <Text style={styles.nameText}>{playerName}</Text>
            </View>
            
            {isMe ? (
                <View style={styles.handValueTag}>
                    <Text style={styles.handValueText}>{`${handLabel}: ${handValue ?? 0}`}</Text>
                </View>
            ) : null}
        </View>
    );
};

// --- Discard pile (runs, spread groups, hidden top card) ---
const CARD_SPREAD = 28;
const SET_GROUP_SPREAD_PAIR = 72;   // Pair: cards more separated
const SET_GROUP_SPREAD_34 = 48;     // Trips/quads: tighter spread for phones
const SET_GROUP_SPREAD_5 = 30;      // 5-card runs/sets: fit on screen
const getGroupSpread = (cardCount: number, isRun: boolean, isSetGroup: boolean): number => {
    if (isSetGroup && !isRun) {
        if (cardCount >= 5) return SET_GROUP_SPREAD_5;
        if (cardCount >= 3) return SET_GROUP_SPREAD_34;
        return SET_GROUP_SPREAD_PAIR;
    }
    if (isRun && cardCount >= 5) return SET_GROUP_SPREAD_5;
    return CARD_SPREAD;
};
// Fixed width for discard area so the deck never shifts
const MAX_DISCARD_SPREAD = Math.max(3 * SET_GROUP_SPREAD_PAIR, 4 * SET_GROUP_SPREAD_5);
const MAX_DISCARD_CONTAINER_WIDTH = TABLE_CARD_WIDTH + Math.floor(MAX_DISCARD_SPREAD / 3);
const DiscardPile = React.memo(({
    cards,
    onPress,
    onPickFromGroup,
    isSelected,
    hiddenCardId,
    lastGroupCards = [],
    allowGroupPick = true
}: {
    cards: Card[];
    onPress: () => void;
    onPickFromGroup?: (pick: 'first' | 'last' | number | string) => void; // string = cardId for pick in spread group
    isSelected: boolean;
    hiddenCardId: string | null;
    lastGroupCards?: Card[];
    allowGroupPick?: boolean;
}) => {
    const groupCards = lastGroupCards || [];
    const groupSize = groupCards.length;
    const isRun = groupSize >= 3 && isRunSet(groupCards, 3);
    const isSetGroup = groupSize >= 2 && isSameRankSet(groupCards, 2); // pair / trips / quads
    const showSpread = isRun || isSetGroup;
    const [closingCards, setClosingCards] = useState<Card[] | null>(null);
    const [isOpeningSpread, setIsOpeningSpread] = useState(false);
    const collapseAnim = useRef(new Animated.Value(1)).current;
    const prevShowSpreadRef = useRef(showSpread);
    const prevSpreadCardsRef = useRef<Card[]>(groupCards);

    // Remember last spread group for smooth collapse next turn
    useEffect(() => {
        if (showSpread && groupCards.length >= 2) {
            prevSpreadCardsRef.current = groupCards;
        }
    }, [showSpread, groupCards]);

    // Animate from spread back to stacked pile
    useEffect(() => {
        const wasSpread = prevShowSpreadRef.current;
        if (!wasSpread && showSpread) {
            collapseAnim.setValue(0);
            setIsOpeningSpread(true);
            Animated.timing(collapseAnim, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true
            }).start(() => {
                setIsOpeningSpread(false);
            });
        }
        if (wasSpread && !showSpread) {
            const cardsToClose = prevSpreadCardsRef.current;
            if (cardsToClose.length >= 2) {
                setClosingCards(cardsToClose);
                collapseAnim.setValue(1);
                Animated.timing(collapseAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true
                }).start(() => {
                    setClosingCards(null);
                });
            }
        }
        prevShowSpreadRef.current = showSpread;
    }, [showSpread, collapseAnim]);

    const canPickFirstOrLast = isRun && allowGroupPick && onPickFromGroup;
    const canPickAnyInGroup = isSetGroup && !isRun && allowGroupPick && onPickFromGroup; // Any card in group pickable
    const displayCards = closingCards ?? (showSpread ? groupCards : cards.slice(-5));
    const displayIsRun = displayCards.length >= 3 && isRunSet(displayCards, 3);
    const displayIsSetGroup = displayCards.length >= 2 && isSameRankSet(displayCards, 2);
    const showSpreadVisual = showSpread || (!!closingCards && (displayIsRun || displayIsSetGroup));
    const spread = showSpreadVisual
        ? getGroupSpread(displayCards.length, displayIsRun, displayIsSetGroup && !displayIsRun)
        : CARD_SPREAD;
    const totalSpread = showSpreadVisual ? (displayCards.length - 1) * spread : 0;
    const containerWidth = TABLE_CARD_WIDTH + totalSpread;

    const renderCard = (card: Card, index: number) => {
        const isTop = index === displayCards.length - 1;
        const seed = card.id.charCodeAt(0);
        let offsetX = 0, offsetY = 0, rotation = 0, opacity = 1;
        if (showSpreadVisual) {
            offsetX = index * spread;
            offsetY = (index % 2 === 0) ? -8 : 8;
            rotation = (index - (displayCards.length - 1) / 2) * 3;
            opacity = card.id === hiddenCardId ? 0 : (index === 0 || isTop ? 1 : 0.85);
        } else {
            if (!isTop) {
                offsetX = (seed % 20) - 10;
                offsetY = ((seed * 2) % 20) - 10;
                rotation = (seed % 30) - 15;
            }
            opacity = card.id === hiddenCardId ? 0 : (isTop ? 1 : Math.max(0.7, 0.7 + (index / (displayCards.length - 1)) * 0.3));
        }

        const closingTranslateX = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, offsetX] });
        const closingTranslateY = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, offsetY] });
        const closingRotate = collapseAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rotation}deg`] });

        return (
            <Animated.View
                key={`${card.id}-${index}`}
                style={{
                    position: 'absolute',
                    left: showSpreadVisual ? 0 : undefined,
                    zIndex: index,
                    transform: showSpreadVisual
                        ? (closingCards || isOpeningSpread)
                            ? [{ translateX: closingTranslateX }, { translateY: closingTranslateY }, { rotate: closingRotate }]
                            : [{ translateX: offsetX }, { translateY: offsetY }, { rotate: `${rotation}deg` }]
                        : [{ translateX: offsetX }, { translateY: offsetY }, { rotate: `${rotation}deg` }],
                    opacity
                }}
                pointerEvents="none"
            >
                <PlayingCard card={card} size="regular" />
            </Animated.View>
        );
    };

    if (!canPickFirstOrLast && !canPickAnyInGroup) {
        return (
            <Pressable onPress={onPress} style={styles.pileContainer}>
                <View style={styles.pilePlaceholder} pointerEvents="none" />
                {displayCards.map((card, index) => renderCard(card, index))}
            </Pressable>
        );
    }

    const extraWidth = containerWidth - TABLE_CARD_WIDTH;
    const firstCardClickableWidth = CARD_SPREAD;

    if (canPickAnyInGroup) {
        return (
            <View style={[styles.pileContainer, { width: containerWidth, marginLeft: -extraWidth / 2 }]}>
                {displayCards.map((card, index) => renderCard(card, index))}
                {displayCards.map((card, index) => (
                    <Pressable
                        key={card.id}
                        onPress={() => onPickFromGroup?.(card.id)}
                        style={{
                            position: 'absolute',
                            left: index * spread,
                            top: 0,
                            width: spread,
                            height: TABLE_CARD_HEIGHT,
                            zIndex: 50 + index
                        }}
                    />
                ))}
            </View>
        );
    }

    return (
        <View style={[styles.pileContainer, { width: containerWidth, marginLeft: -extraWidth / 2 }]}>
            {displayCards.map((card, index) => renderCard(card, index))}
            <Pressable onPress={() => onPickFromGroup?.('first')} style={{ position: 'absolute', left: 0, top: 0, width: firstCardClickableWidth, height: TABLE_CARD_HEIGHT, zIndex: 50 }} />
            <Pressable onPress={() => onPickFromGroup?.('last')} style={{ position: 'absolute', left: firstCardClickableWidth, top: 0, width: containerWidth - firstCardClickableWidth, height: TABLE_CARD_HEIGHT, zIndex: 51 }} />
        </View>
    );
});
DiscardPile.displayName = 'DiscardPile';

const DeckPile = React.memo(({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.deckContainer}>
        <View style={[styles.deckShadowCard, { top: -2, left: -1 }]}><CardBack size="regular" /></View>
        <View style={[styles.deckShadowCard, { top: -4, left: -2 }]}><CardBack size="regular" /></View>
        <View style={{position: 'relative'}}>
            <CardBack size="regular" />
        </View>
    </Pressable>
));
DeckPile.displayName = 'DeckPile';

// --- Flying card overlay ---
const FlyingCard = React.memo(({ startPos, endPos, card, onComplete, delay = 0, isFaceDown = false, isSlam = false, isThrowToPile = false, duration = 600, arcHeight: customArcHeight }: any) => {
    const anim = useRef(new Animated.Value(0)).current;
    
    // Scale ratio table card → hand card (avoids visual jump)
    const TABLE_TO_HAND_RATIO = TABLE_CARD_WIDTH / MY_CARD_WIDTH;

    useEffect(() => {
        if (isSlam) {
            // Slam: fast aggressive drop from above
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { 
                    toValue: 1, 
                    duration: duration || 180, 
                    useNativeDriver: true, 
                    // Aggressive easing: slow start, accelerate (free-fall feel)
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
                })
            ]).start(({ finished }) => { if (finished && onComplete) onComplete(); });
        } else {
            // Normal throw: smooth end so card settles on pile top without a hard stop
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { 
                    toValue: 1, 
                    duration: duration, 
                    useNativeDriver: true, 
                    easing: Easing.bezier(0.22, 0.61, 0.36, 1)
                })
            ]).start(({ finished }) => { if (finished && onComplete) onComplete(); });
        }
    }, []);

    const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [startPos.x, endPos.x] });
    const baseTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [startPos.y, endPos.y] });
    
    // Rotation: extra spin on slam for landing impact
    const rotate = isSlam 
        ? anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: ['-15deg', '-8deg', '12deg', '0deg'] })
        : anim.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['0deg', '14deg', '0deg'] });

    const isThrowing = isThrowToPile || startPos.y > endPos.y;
    const defaultArcHeight = isThrowing ? 0 : -40; // Throw to pile: straight path to top of stack
    const arcHeight = customArcHeight !== undefined ? customArcHeight : defaultArcHeight;
    
    // Slam: short sharp bounce on land. Normal throw: arcHeight 0 = straight to pile top
    const arcTranslateY = isSlam
        ? anim.interpolate({ 
            inputRange: [0, 0.85, 0.92, 1], 
            outputRange: [0, 0, -12, 0]  // Short sharp bounce
        })
        : anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, arcHeight, 0] });
    
    const translateY = Animated.add(baseTranslateY, arcTranslateY);
    
    // Scale: slam grows through fall then pops at impact
    const scale = isSlam 
        ? anim.interpolate({ 
            inputRange: [0, 0.5, 0.85, 0.92, 1], 
            outputRange: [1.1, 1.3, 1.4, TABLE_TO_HAND_RATIO * 0.9, TABLE_TO_HAND_RATIO]
        })
        : anim.interpolate({ 
            inputRange: [0, 1], 
            outputRange: isThrowing 
                ? [1, TABLE_TO_HAND_RATIO] 
                : [TABLE_TO_HAND_RATIO, 1]
        });

    return (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }}>
            <PlayingCard card={card} size="large" isFaceDown={isFaceDown} />
        </Animated.View>
    );
});
FlyingCard.displayName = 'FlyingCard';

// --- Confetti ---
const CONFETTI_COLORS = ['#FBBF24', '#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
const CONFETTI_COUNT = 30;

const ConfettiPiece = ({ delay, startX }: { delay: number; startX: number }) => {
    const fallAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size = 8 + Math.random() * 8;
    const drift = (Math.random() - 0.5) * 100;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fallAnim, { toValue: 1, duration: 2000 + Math.random() * 1000, delay, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: 1, duration: 1500, delay, useNativeDriver: true })
        ]).start();
    }, []);

    const translateY = fallAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 50] });
    const translateX = fallAnim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
    const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + Math.random() * 360}deg`] });
    const opacity = fallAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });

    return (
        <Animated.View style={{
            position: 'absolute',
            left: startX,
            top: 0,
            width: size,
            height: size * 0.6,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ translateY }, { translateX }, { rotate }],
            opacity
        }} />
    );
};

const Confetti = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {[...Array(CONFETTI_COUNT)].map((_, i) => (
                <ConfettiPiece key={i} delay={i * 50} startX={Math.random() * width} />
            ))}
        </View>
    );
};

// --- Round-end effects (region confetti / giant hand on Assaf) ---
const FLOWERS_PHASE_MS = 1000;
const SLAP_PHASE_MS = 1500;

function useConfettiParticles() {
  return useMemo(() => {
    const particles: { id: number; color: string; left: number; top: number; size: number; rotate: number; drift: number }[] = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      particles.push({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 40,
      });
    }
    return particles;
  }, []);
}

type Region = 'top' | 'left' | 'right' | 'bottom';

const REGION_STYLES: Record<Region, { position: 'absolute'; top?: number; left?: number; right?: number; bottom?: number; width?: number; height?: number }> = {
  top:    { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.38 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.38 },
  left:   { position: 'absolute', top: height * 0.18, left: 0, width: width * 0.30, bottom: height * 0.32 },
  right:  { position: 'absolute', top: height * 0.18, right: 0, width: width * 0.30, bottom: height * 0.32 },
};

// Region centers (slap anim: origin → target)
const REGION_CENTERS: Record<Region, { x: number; y: number }> = {
  top:    { x: width / 2, y: (height * 0.38) / 2 },
  bottom: { x: width / 2, y: height - (height * 0.38) / 2 },
  left:   { x: (width * 0.30) / 2, y: height * 0.18 + (height * (1 - 0.18 - 0.32)) / 2 },
  right:  { x: width - (width * 0.30) / 2, y: height * 0.18 + (height * (1 - 0.18 - 0.32)) / 2 },
};

const RegionConfettiOverlay = ({ region }: { region: Region }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useConfettiParticles();
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 1600, useNativeDriver: true }).start();
    return () => progress.setValue(0);
  }, [region]);

  return (
    <Animated.View pointerEvents="none" style={[REGION_STYLES[region], { overflow: 'hidden', zIndex: 50 }]}>
      {particles.map((p) => {
        const translateY = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [-20, 0, 100] });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const particleOpacity = progress.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0.3, 1, 1] });
        return (
          <Animated.View
            key={p.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size * 1.4,
              backgroundColor: p.color,
              borderRadius: 1,
              transform: [{ translateY }, { translateX }, { rotate: `${p.rotate}deg` }, { scale }],
              opacity: particleOpacity,
            }}
          />
        );
      })}
    </Animated.View>
  );
};

const SLAP_HAND_WIDTH = Math.min(width, height) * 0.36;
const SLAP_HAND_HEIGHT = SLAP_HAND_WIDTH * 1.2;

const SlapOverlay = ({ originRegion, targetRegion }: { originRegion: Region; targetRegion: Region }) => {
  const origin = REGION_CENTERS[originRegion];
  const target = REGION_CENTERS[targetRegion];

  const windupX = (target.x - origin.x) * 0.18;
  const windupY = -72;
  const aboveTargetX = target.x - origin.x;
  const aboveTargetY = target.y - origin.y - 90;
  const slapX = target.x - origin.x;
  const slapY = target.y - origin.y;
  const overshootX = slapX + (slapX - windupX) * 0.06;
  const overshootY = slapY + 22;

  const moveX = useRef(new Animated.Value(0)).current;
  const moveY = useRef(new Animated.Value(0)).current;
  const handRotate = useRef(new Animated.Value(0)).current;
  const handScale = useRef(new Animated.Value(0.62)).current;
  const handOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const impactFlash = useRef(new Animated.Value(0)).current;
  const impactPulse = useRef(new Animated.Value(0.6)).current;
  const impactOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    moveX.setValue(0);
    moveY.setValue(0);
    handRotate.setValue(0);
    handScale.setValue(0.62);
    handOpacity.setValue(0);
    shakeX.setValue(0);
    impactFlash.setValue(0);
    impactPulse.setValue(0.6);
    impactOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(handOpacity, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(handScale, { toValue: 1.14, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(moveX, { toValue: windupX, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(moveY, { toValue: windupY, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(handRotate, { toValue: -22, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(moveX, { toValue: aboveTargetX, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(moveY, { toValue: aboveTargetY, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(handRotate, { toValue: 34, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(handScale, { toValue: 1.3, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(moveX, { toValue: slapX, duration: 95, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(moveY, { toValue: slapY, duration: 95, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(handRotate, { toValue: -8, duration: 95, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(handScale, { toValue: 0.98, duration: 95, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(moveX, { toValue: overshootX, duration: 65, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(moveY, { toValue: overshootY, duration: 65, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 13, duration: 38, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -10, duration: 38, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 32, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 32, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(moveX, { toValue: slapX, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(moveY, { toValue: slapY, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(280),
      Animated.timing(handOpacity, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    // Impact flash + pulse right when the hand lands.
    Animated.sequence([
      Animated.delay(480),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(impactFlash, { toValue: 0.45, duration: 60, useNativeDriver: true }),
          Animated.timing(impactFlash, { toValue: 0, duration: 170, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(impactOpacity, { toValue: 0.65, duration: 70, useNativeDriver: true }),
          Animated.timing(impactOpacity, { toValue: 0, duration: 210, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(impactPulse, { toValue: 1.25, duration: 95, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(impactPulse, { toValue: 1.0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    const vibrateTimer = setTimeout(() => {
      try { Vibration.vibrate(50); } catch (_) {}
    }, 500);

    return () => {
      clearTimeout(vibrateTimer);
      moveX.setValue(0);
      moveY.setValue(0);
      handOpacity.setValue(0);
      impactFlash.setValue(0);
      impactOpacity.setValue(0);
    };
  }, [originRegion, targetRegion]);

  const rotateStr = handRotate.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 55 }]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: target.x - 80,
          top: target.y - 80,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: '#FFFFFF',
          opacity: impactFlash,
        }}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: target.x - 70,
          top: target.y - 70,
          width: 140,
          height: 140,
          borderRadius: 70,
          borderWidth: 4,
          borderColor: '#FCA5A5',
          opacity: impactOpacity,
          transform: [{ scale: impactPulse }],
        }}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: origin.x - SLAP_HAND_WIDTH * 0.55,
          top: origin.y - SLAP_HAND_HEIGHT * 0.75,
          width: SLAP_HAND_WIDTH,
          height: SLAP_HAND_HEIGHT,
          opacity: handOpacity,
          transform: [
            { translateX: Animated.add(moveX, shakeX) },
            { translateY: moveY },
            { scale: handScale },
            { rotate: rotateStr },
          ],
        }}
      >
        <View style={{ position: 'absolute', left: 0, top: 52, width: 58, height: 88, borderRadius: 28, backgroundColor: '#D79266' }} />
        <LinearGradient
          colors={['#FFD6B0', '#F6BF93', '#E9A577']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            position: 'absolute',
            left: 28,
            top: 48,
            width: SLAP_HAND_WIDTH - 32,
            height: SLAP_HAND_HEIGHT - 62,
            borderRadius: 44,
            borderWidth: 2,
            borderColor: '#D48D62',
          }}
        />

        {[0, 1, 2, 3].map((i) => (
          <LinearGradient
            key={i}
            colors={['#FFD6B0', '#F4BA8B']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 34 + i * ((SLAP_HAND_WIDTH - 62) / 4),
              width: (SLAP_HAND_WIDTH - 78) / 4,
              height: SLAP_HAND_HEIGHT * (0.45 - i * 0.02),
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              borderWidth: 2,
              borderColor: '#D48D62',
            }}
          />
        ))}

        <LinearGradient
          colors={['#FFDAB7', '#F2B786']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{
            position: 'absolute',
            left: 6,
            top: 70,
            width: SLAP_HAND_WIDTH * 0.33,
            height: SLAP_HAND_HEIGHT * 0.26,
            borderRadius: 24,
            transform: [{ rotate: '-28deg' }],
            borderWidth: 2,
            borderColor: '#D48D62',
          }}
        />
      </Animated.View>
    </View>
  );
};

// --- Main screen ---
export default function GameTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const gameText = useMemo(() => ({
    he: {
      me: 'אתה',
      opponent: 'יריב',
      hand: 'יד',
      leaveTitle: 'לעזוב משחק?',
      leaveText: 'האם אתה בטוח שתרצה לצאת מהמשחק?',
      cancel: 'ביטול',
      exit: 'יציאה',
      roomClosed: 'המשחק נסגר',
      backToLobby: 'חזרה ללובי',
      reconnecting: 'מתחבר מחדש...',
      pleaseWait: 'אנא המתן',
      error: 'שגיאה',
      close: 'סגור',
      settingsTitle: 'הגדרות משחק',
      music: 'מוזיקה',
      sounds: 'צלילים',
      hideOthersMessages: 'הסתר הודעות מאחרים',
      chat: 'צ׳אט',
      messagePlaceholder: 'כתוב הודעה...',
      send: 'שלח',
      yanivButton: '🌴 יניב! 🌴',
      stickHint: '👆 לחץ על הערימה להדבקה!',
      waitingForPlayers: 'ממתין לשחקנים נוספים...',
      reconnectFailed: 'החיבור נכשל. חוזר ללובי...',
    },
    en: {
      me: 'You',
      opponent: 'Opponent',
      hand: 'Hand',
      leaveTitle: 'Leave game?',
      leaveText: 'Are you sure you want to leave the game?',
      cancel: 'Cancel',
      exit: 'Exit',
      roomClosed: 'Game closed',
      backToLobby: 'Back to lobby',
      reconnecting: 'Reconnecting...',
      pleaseWait: 'Please wait',
      error: 'Error',
      close: 'Close',
      settingsTitle: 'Game Settings',
      music: 'Music',
      sounds: 'Sound effects',
      hideOthersMessages: 'Hide messages',
      chat: 'Chat',
      messagePlaceholder: 'Write a message...',
      send: 'Send',
      yanivButton: '🌴 Yaniv! 🌴',
      stickHint: '👆 Tap the pile to stick!',
      waitingForPlayers: 'Waiting for other players...',
      reconnectFailed: 'Connection failed. Returning to lobby...',
    },
  }), []);
  const gt = gameText[language];
  
  // Check if this is an online game (server-driven) or offline (local)
  const isOnlineMode = params.isOnline === 'true';
  
  // Parse scores from navigation params (for continuing between rounds)
  const getInitialScores = () => {
      try {
          if (params.scores) {
              return JSON.parse(params.scores as string) as Record<string, number>;
          }
      } catch (e) {}
      return { me: 0, o1: 0, o2: 0, o3: 0 };
  };
  const initialScores = getInitialScores();
  
  // Game settings from room creation
  const gameScoreLimit = params.scoreLimit ? parseInt(params.scoreLimit as string) : 100;
  const allowSticking = params.allowSticking === 'yes';
  
  // Parse room players (host + friends/AI)
  const parseRoomPlayers = (): RoomPlayer[] => {
      try {
          if (params.players) {
              const parsed = JSON.parse(params.players as string) as RoomPlayer[];
              if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
      } catch (e) {}
      // fallback: 1 human + 1 AI
      return [
          { name: gt.me, avatar: '😎', isHost: true, isAi: false },
          { name: FALLBACK_AI_NAMES[Math.floor(Math.random() * FALLBACK_AI_NAMES.length)], avatar: '🤖', isHost: false, isAi: true }
      ];
  };
  const roomPlayers = parseRoomPlayers();
  const roundId = (params.roundId as string) ?? 'init';
  const lastRoundIdRef = useRef(roundId);
  const roundEndHandledRef = useRef(false);
  
  // Previous round winner (who starts) — offline only
  const prevWinnerId = params.prevWinnerId as string | undefined;
  const isFirstRound = !prevWinnerId;

  // Initial deal: 4 shuffled decks, hands for all players
  const [gameInit, setGameInit] = useState(() => initializeGame(roomPlayers.length, 5));
  const deckRef = useRef<Card[]>(gameInit.remainingDeck);

  const [myHand, setMyHand] = useState<Card[]>(gameInit.hands[0]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const TURN_DURATION_SECONDS = 60;
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(TURN_DURATION_SECONDS);
  const [turnWarningShown, setTurnWarningShown] = useState(false);
  const timeoutHandledRef = useRef(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActiveAtRef = useRef<number>(Date.now());
  
  const [discardPile, setDiscardPile] = useState<Card[]>([gameInit.initialDiscard]);
  const [lastDiscardGroup, setLastDiscardGroup] = useState<Card[]>([]);
  const discardPileRef = useRef<Card[]>(discardPile);
  const pileLayoutRef = useRef<View | null>(null);
  const pileDropTargetRef = useRef(FALLBACK_FLYING_PILE_POSITION);
  const updatePileDropTarget = () => {
    requestAnimationFrame(() => {
      pileLayoutRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        if (measuredWidth > 0 && measuredHeight > 0) {
          pileDropTargetRef.current = {
            x: x + (measuredWidth / 2) - (MY_CARD_WIDTH / 2),
            y: y + (measuredHeight / 2) - (MY_CARD_HEIGHT / 2),
          };
        }
      });
    });
  };
  const getPileDropTarget = () => pileDropTargetRef.current;
  useEffect(() => {
    discardPileRef.current = discardPile;
    updatePileDropTarget();
  }, [discardPile]);
  
  // Card hidden during throw/draw animation
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // === Sticking (slap) ===
  // stickCardId — card that can be stuck (null if no stick window)
  const [stickCardId, setStickCardId] = useState<string | null>(null);
  // Ref for immediate reads inside callbacks (avoids stale closure)
  const stickCardIdRef = useRef<string | null>(null);
  useEffect(() => {
      stickCardIdRef.current = stickCardId;
  }, [stickCardId]);
  // lastDiscardedRank — rank of last discard (offline stick logic)
  const [lastDiscardedRank, setLastDiscardedRank] = useState<Rank | null>(null);
  // Stick window timer
  const stickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Clear stick timer on unmount
  useEffect(() => {
      return () => {
          if (stickTimerRef.current) {
              clearTimeout(stickTimerRef.current);
          }
      };
  }, []);
  
  // 4 decks = 216 cards − 4×5 dealt − 1 discard top = 195 in deck (example for 4 players)
  const [deckCount, setDeckCount] = useState(deckRef.current.length);
  const [animatingCards, setAnimatingCards] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [roomClosedReason, setRoomClosedReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorNavigateToLobby, setErrorNavigateToLobby] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { musicOn, setMusicOn, sfxOn, setSfxOn } = useSound();
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [lastMessageByPlayer, setLastMessageByPlayer] = useState<Record<string, string>>({});
  const messageTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chatScrollRef = useRef<ScrollView | null>(null);
  const quickEmojis = ['😀', '😂', '😮', '👏', '🔥', '😎'];
  const [myAvatar, setMyAvatar] = useState('😎');
  const [myName, setMyName] = useState(gt.me);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedAvatar = await AsyncStorage.getItem(PROFILE_AVATAR_KEY);
        const savedUsername = await AsyncStorage.getItem(PROFILE_USERNAME_KEY);
        if (savedAvatar) setMyAvatar(savedAvatar);
        if (savedUsername) setMyName(savedUsername);
      } catch (e) {}
    };
    loadProfile();
  }, []);

  const opponentIds = ['o1', 'o2', 'o3'];
  const opponentPlayers = roomPlayers.slice(1).slice(0, 3);
  const opponentPositions = getPositionsForOpponents(opponentPlayers.length);
  const [opponents, setOpponents] = useState<PlayerWithCards[]>(
    opponentPlayers.map((p, idx) => ({
      id: opponentIds[idx],
      name: p.name,
      avatar: p.avatar,
      cardsCount: gameInit.hands[idx + 1]?.length ?? 0,
      totalScore: initialScores[opponentIds[idx]] ?? 0,
      isTurn: false,
      position: opponentPositions[idx],
      cards: gameInit.hands[idx + 1] ?? [],
      isAi: p.isAi ?? false
    }))
  );
  const [myScore, setMyScore] = useState(initialScores.me);
  
  // Who starts the round
  const getStartingTurnIndex = () => {
      if (isOnlineMode) {

          return 0;
      }
      const order = ['me', ...opponentIds.slice(0, roomPlayers.length - 1)];

      if (isFirstRound) {
          // First round: random starter
          const randomIdx = Math.floor(Math.random() * order.length);

          return randomIdx;
      }
      // Later rounds: previous winner starts
      if (prevWinnerId === 'me') {

          return 0;
      }
      const idx = order.indexOf(prevWinnerId!);

      return idx >= 0 ? idx : 0;
  };
  
  const [currentTurnIndex, setCurrentTurnIndex] = useState(() => (isOnlineMode ? 0 : getStartingTurnIndex()));
  const playerOrder = ['me', ...opponents.map(o => o.id)];
  const currentTurnPlayerId = playerOrder[currentTurnIndex] ?? 'me';
  const isViewerCurrentTurn = currentTurnPlayerId === 'me';
  const myPlayer: Player = { id: 'me', name: myName, avatar: myAvatar, cardsCount: 0, totalScore: myScore, isTurn: isViewerCurrentTurn, position: 'top' };
  const advanceTurn = () => {
      if (playerOrder.length === 0) return;
      setCurrentTurnIndex(prev => (prev + 1) % playerOrder.length);
  };

  useEffect(() => {
      if (lastRoundIdRef.current === roundId) return;
      lastRoundIdRef.current = roundId;
      const nextInit = initializeGame(roomPlayers.length, 5);
      setGameInit(nextInit);
      deckRef.current = nextInit.remainingDeck;
      setMyHand(nextInit.hands[0]);
      setDiscardPile([nextInit.initialDiscard]);
      setLastDiscardGroup(nextInit.initialDiscard ? [nextInit.initialDiscard] : []);
      setSelectedCardIds([]);
      setAnimatingCards([]);
      setHiddenCardId(null);
      setIsAnimating(false);
      setStickCardId(null);
      setLastDiscardedRank(null);
      setDeckCount(nextInit.remainingDeck.length);
      // First turn: random on round 1, else winner leads (offline only)
      if (!isOnlineMode) {
          setCurrentTurnIndex(getStartingTurnIndex());
      }
      setRoundEndType(null);
      setRoundEndWinner('');
      setRoundEndWinnerId('');
      setRoundEndCallerId('');
      setCardsRevealed(false);
      // Reset turn timer for the new round
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      setTurnWarningShown(false);
      timeoutHandledRef.current = false;
      roundEndHandledRef.current = false;
      setOpponents(prev =>
          prev.map((o, idx) => ({
              ...o,
              cards: nextInit.hands[idx + 1] ?? [],
              cardsCount: nextInit.hands[idx + 1]?.length ?? 0
          }))
      );
  }, [roundId, roomPlayers.length]);

  useEffect(() => {
      if (currentTurnIndex >= playerOrder.length) {
          setCurrentTurnIndex(0);
      }
  }, [playerOrder.length, currentTurnIndex]);
  
  // Round end state
  const [roundEndType, setRoundEndType] = useState<RoundEndType>(null);
  const [roundEndWinner, setRoundEndWinner] = useState<string>('');
  const [roundEndWinnerId, setRoundEndWinnerId] = useState<string>('');
  const [roundEndCallerId, setRoundEndCallerId] = useState<string>('');
  const [roundEndPhase, setRoundEndPhase] = useState<'flowers' | 'slap' | null>(null);
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const [waitingForRoundStart, setWaitingForRoundStart] = useState(false);
  const SCORE_LIMIT = gameScoreLimit; // From room settings

  // Round-end overlay: confetti on caller, then (if Assaf) slap on winner
  useEffect(() => {
    if (!roundEndType) {
      setRoundEndPhase(null);
      return;
    }
    setRoundEndPhase('flowers');
    if (roundEndType === 'yaniv') {
      const t = setTimeout(() => handleRoundEndOverlayComplete(), 2000);
      return () => clearTimeout(t);
    }
    if (roundEndType === 'assaf') {
      const t1 = setTimeout(() => {
        setRoundEndPhase('slap');
        if (sfxOn) playAssaf(true);
      }, FLOWERS_PHASE_MS);
      const t2 = setTimeout(() => handleRoundEndOverlayComplete(), FLOWERS_PHASE_MS + SLAP_PHASE_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [roundEndType]);

  // Yaniv SFX when round end starts
  useEffect(() => {
    if (roundEndType && sfxOn) playYaniv(true);
  }, [roundEndType, sfxOn]);

  // === Socket handlers for online mode ===
  const myServerPlayerId = useRef<string | null>(null);
  const lastRoundNumRef = useRef<number>(0);
  const serverRoundResultRef = useRef<ServerRoundResult | null>(null);
  const opponentsRef = useRef<PlayerWithCards[]>([]);
  const hasMadeMoveThisTurnRef = useRef<boolean>(false);
  const lastTurnStartTimeRef = useRef<number>(0);
  const previousHandRef = useRef<Card[]>([]);
  const lastDrawSourceRef = useRef<'deck' | 'pile' | null>(null);
  const isWaitingForNewCardRef = useRef<boolean>(false);
  const optimisticDrawAnimIdRef = useRef<string | null>(null);
  const optimisticDrawReadyRef = useRef(false);
  const pendingOptimisticDrawCardRef = useRef<Card | null>(null);
  const activeDrawCardIdRef = useRef<string | null>(null);
  // Online stick: rank of last discard (detect stick when drawing matching rank)
  const lastThrownRankForStickRef = useRef<Rank | null>(null);
  const isShowingRoundSummaryRef = useRef<boolean>(false); // Defer state updates while summary is shown
  const isThrowingCardsRef = useRef<boolean>(false);
  const pendingDiscardPileRef = useRef<Card[] | null>(null);
  const pendingDiscardGroupRef = useRef<Card[] | null>(null);
  const isAiAnimatingRef = useRef<boolean>(false);
  const isStickAnimatingRef = useRef<boolean>(false);
  const turnTimerIntervalRef = useRef<number | null>(null);
  const gameEndedRef = useRef(false);
  const hasLeftGameRef = useRef(false);
  const pendingGameOverPlayersRef = useRef<{ id: string; name: string; avatar: string; score: number; isMe: boolean }[] | null>(null);
  
  // Keep opponents ref in sync
  useEffect(() => {
    opponentsRef.current = opponents;
  }, [opponents]);

  const completeOptimisticDraw = (card: Card) => {
    const drawAnimId = optimisticDrawAnimIdRef.current;
    setMyHand(prev => {
      const withoutDuplicate = prev.filter(c => c.id !== card.id);
      const updated = sortHand([...withoutDuplicate, card]);
      previousHandRef.current = updated;
      return updated;
    });
    if (drawAnimId) {
      setAnimatingCards(prev => prev.filter(a => a.id !== drawAnimId));
    }
    setHiddenCardId(null);
    if (!isThrowingCardsRef.current) {
      setIsAnimating(false);
    }
    isWaitingForNewCardRef.current = false;
    lastDrawSourceRef.current = null;
    lastThrownRankForStickRef.current = null;
    optimisticDrawAnimIdRef.current = null;
    optimisticDrawReadyRef.current = false;
    pendingOptimisticDrawCardRef.current = null;
    activeDrawCardIdRef.current = null;
  };
  
  useEffect(() => {
    if (!isOnlineMode) return;
    
    // Get my player ID from socket service
    myServerPlayerId.current = socketService.getMyPlayerId();
    
    // Setup socket callbacks
    socketService.onGameStateUpdated = (gameState: ClientGameState) => {

      // While summary is visible, defer updates — deal resumes after dismiss
      if (isShowingRoundSummaryRef.current) {

        return;
      }
      
      // Sync waiting-for-continue state between rounds
      setWaitingForRoundStart(!!gameState.waitingForRoundStart);
      
      // Check if new round started
      if (gameState.roundNumber && gameState.roundNumber !== lastRoundNumRef.current) {
        const isFirstRound = lastRoundNumRef.current === 0;
        lastRoundNumRef.current = gameState.roundNumber;
        // New round - reset game state (but NOT scores - scores carry over)
        setSelectedCardIds([]);
        setAnimatingCards([]);
        setHiddenCardId(null);
        setIsAnimating(false);
        setStickCardId(null);
        setRoundEndType(null);
        setCardsRevealed(false);
        
        // Reset refs for new round
        previousHandRef.current = [];
        lastDrawSourceRef.current = null;
        activeDrawCardIdRef.current = null;
        hasMadeMoveThisTurnRef.current = false;
        
        // Reset scores ONLY on first round (new game) - server already did this in startGame()
        if (isFirstRound) {
          setMyScore(0);
          setOpponents(prev => prev.map(o => ({ ...o, totalScore: 0 })));
        }
        // For subsequent rounds, scores are already updated from server in onRoundEnded
      }
      
      // Update my cards - detect new card and animate it BEFORE adding to hand.
      // During a throw, only process the pending drawn card; full hand sync waits until throw lands.
      if (gameState.yourCards && (!isThrowingCardsRef.current || isWaitingForNewCardRef.current)) {
        const myCards = gameState.yourCards.map(c => ({
          id: c.id,
          suit: c.suit,
          rank: c.rank,
          value: c.value
        })) as Card[];
        
        const sortedCards = sortHand(myCards);

        const previousHand = previousHandRef.current;
        
        // If we're waiting for a new card animation, handle it specially
        if (isWaitingForNewCardRef.current && lastDrawSourceRef.current) {
          // Find any new cards (ones that don't exist in previous hand)
          // Don't check hand size - just check if there are new cards by ID
          const newCards = previousHand.length > 0 
            ? sortedCards.filter(c => !previousHand.some(pc => pc.id === c.id))
            : [];
          
          if (newCards.length > 0) {
            // Found new card(s) - take the first one (should only be one)
            const newCard = newCards[0];
            
            if (newCard) {

              // === Stick from deck (same rank as discard): do NOT hide card for draw anim ===
              // or the hand looks short during the stick window.
              // === If server already marked stick, never hide the new card from hand ===
              // or missing-card flicker persists for the whole window.
              const stickIdFromServer = stickCardIdRef.current;
              const isStickCardFromServer =
                !!stickIdFromServer && newCards.some(nc => nc.id === stickIdFromServer);

              // Fallback: server event after gameStateUpdated — detect by rank
              const isPotentialStickByRank =
                lastDrawSourceRef.current === 'deck' &&
                lastThrownRankForStickRef.current !== null &&
                newCard.rank === lastThrownRankForStickRef.current;

              if (isStickCardFromServer || (allowSticking && isPotentialStickByRank)) {
                // Keep card in hand for blue highlight / raised state
                setMyHand(sortedCards);
                previousHandRef.current = sortedCards;
                if (optimisticDrawAnimIdRef.current) {
                  setAnimatingCards(prev => prev.filter(a => a.id !== optimisticDrawAnimIdRef.current));
                  optimisticDrawAnimIdRef.current = null;
                  optimisticDrawReadyRef.current = false;
                  pendingOptimisticDrawCardRef.current = null;
                  setHiddenCardId(null);
                }

                // If server has not sent stickCardId yet, set from client fallback
                if (!stickIdFromServer && allowSticking) {
                  stickCardIdRef.current = newCard.id;
                  setStickCardId(newCard.id);
                }

                isWaitingForNewCardRef.current = false;
                lastDrawSourceRef.current = null;
                lastThrownRankForStickRef.current = null;
                if (!isThrowingCardsRef.current) {
                  setIsAnimating(false);
                }
                return;
              }

              // DON'T add the new card to hand yet - animate it first
              // Remove ALL new cards from the hand temporarily
              const handWithoutNewCard = sortedCards.filter(c => !newCards.some(nc => nc.id === c.id));
              setMyHand(sortHand(handWithoutNewCard));

              if (optimisticDrawAnimIdRef.current) {
                pendingOptimisticDrawCardRef.current = newCard;
                setDiscardPile(prev => prev.filter(c => c.id !== newCard.id));
                if (optimisticDrawReadyRef.current) {
                  completeOptimisticDraw(newCard);
                }
                return;
              }

              if (activeDrawCardIdRef.current === newCard.id) {
                return;
              }
              activeDrawCardIdRef.current = newCard.id;
              
              // Animate the new card coming to hand
              setIsAnimating(true);
              
              // Self always sees drawn card face-up; others use animateOpponentMove
              const drawAnim = {
                id: `draw-new-${newCard.id}-${Date.now()}`,
                startPos: lastDrawSourceRef.current === 'pile' ? getPileDropTarget() : DECK_POSITION,
                endPos: HAND_POSITION,
                card: newCard,
                isFaceDown: false, // Local player always sees own draw face-up
                delay: 0
              };
              setAnimatingCards(prev => [...prev, drawAnim]);
              setDiscardPile(prev => prev.filter(c => c.id !== newCard.id));
              if (sfxOn) playPick(true);
              
              // Add card to hand AFTER animation completes
              setTimeout(() => {

                setMyHand(prev => {
                  const withoutDuplicate = prev.filter(c => c.id !== newCard.id);
                  const updated = sortHand([...withoutDuplicate, newCard]);
                  previousHandRef.current = updated;
                  return updated;
                });
                setAnimatingCards(prev => prev.filter(a => a.id !== drawAnim.id));
                if (!isThrowingCardsRef.current) {
                  setIsAnimating(false);
                }
                isWaitingForNewCardRef.current = false;
                lastDrawSourceRef.current = null;
                lastThrownRankForStickRef.current = null;
                activeDrawCardIdRef.current = null;
              }, 800);
              
              return; // Don't update previousHandRef yet - wait for animation
            }
          }
          
          // If we were waiting but didn't find the card, clear the flag and update normally
          if (optimisticDrawAnimIdRef.current) {
            return;
          }

          if (isThrowingCardsRef.current) {
            return;
          }

          isWaitingForNewCardRef.current = false;
          lastDrawSourceRef.current = null;
          lastThrownRankForStickRef.current = null;
        }
        
        // No new card or no animation needed - update normally
        if (!isThrowingCardsRef.current) {
          setMyHand(sortedCards);
          previousHandRef.current = sortedCards;
        }
      }
      
      // Update discard pile - but wait for throw animation to complete
      // Always log if discardPile exists or not
      if (!gameState.discardPile) {

      }
      
      if (gameState.discardPile) {
        const pile = gameState.discardPile.map(c => ({
          id: c.id,
          suit: c.suit,
          rank: c.rank,
          value: c.value
        })) as Card[];
        
        const currentTopCard = discardPile.length > 0 ? `${discardPile[discardPile.length - 1].rank}${discardPile[discardPile.length - 1].suit}` : 'none';
        const newTopCard = pile.length > 0 ? `${pile[pile.length - 1].rank}${pile[pile.length - 1].suit}` : 'none';
        const pileIncreased = pile.length > discardPile.length;
        // Top card changed if: both exist and are different, OR pile was empty and now has cards
        const topCardChanged = (currentTopCard !== 'none' && newTopCard !== 'none' && currentTopCard !== newTopCard) || 
                               (currentTopCard === 'none' && newTopCard !== 'none') ||
                               (discardPile.length === 0 && pile.length > 0);

        // Defer pile update while throw/AI animation runs
        const hasActiveAnimation = isThrowingCardsRef.current || isAiAnimatingRef.current || isStickAnimatingRef.current;
        
        if (hasActiveAnimation) {

          pendingDiscardPileRef.current = pile;
          pendingDiscardGroupRef.current = (gameState.lastDiscardGroup ?? []).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value })) as Card[];
        } else {
          // No active animation — apply immediately

          setDiscardPile(pile);
          setLastDiscardGroup((gameState.lastDiscardGroup ?? []).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value })) as Card[]);
        }
      }
      
      // Update deck count
      setDeckCount(gameState.deckCount);
      
      // Update opponents - rotate server order so each viewer sees themselves at bottom,
      // then the next players in turn order go left -> top -> right.
      const myIndex = gameState.players.findIndex(p => p.odId === myServerPlayerId.current);
      const orderedPlayers = myIndex >= 0
        ? [
            ...gameState.players.slice(myIndex + 1),
            ...gameState.players.slice(0, myIndex),
          ]
        : gameState.players.filter(p => p.odId !== myServerPlayerId.current);
      const serverPlayers = orderedPlayers.filter(p => p.odId !== myServerPlayerId.current);
      const serverOpponentCount = Math.min(serverPlayers.length, 3);
      const dynamicPositions = getPositionsForOpponents(serverOpponentCount);

      const newOpponents = serverPlayers.slice(0, 3).map((sp, idx) => {
        // Find existing opponent to preserve position if it's still valid
        const existing = opponents.find(o => o.id === sp.odId);
        // Use dynamic position based on current opponent count, not initial count
        const assignedPosition = dynamicPositions[idx] || 'top';
        
        return {
          id: sp.odId,
          name: sp.name,
          avatar: sp.avatar,
          cardsCount: sp.cardCount,
          totalScore: sp.score, // Always use server score - this is the source of truth
          isTurn: gameState.currentTurnOdId === sp.odId,
          position: assignedPosition,
          cards: existing?.cards || [], // Preserve revealed cards if any
          isAi: sp.isAi
        };
      });
      setOpponents(newOpponents);
      
      // CRITICAL FIX: Sync currentTurnIndex from server's currentTurnOdId
      // This ensures isViewerCurrentTurn is always correct, not just opponents[x].isTurn
      const isMyTurnFromServer = gameState.currentTurnOdId === myServerPlayerId.current;
      if (isMyTurnFromServer) {
        setCurrentTurnIndex(0);
      } else {
        // Find which opponent has the turn
        const turnOpponentIndex = newOpponents.findIndex(o => o.id === gameState.currentTurnOdId);
        if (turnOpponentIndex >= 0) {
          setCurrentTurnIndex(turnOpponentIndex + 1);
        }
      }
      // Update my score - always use server score
      const myServerPlayer = gameState.players.find(p => p.odId === myServerPlayerId.current);
      if (myServerPlayer) {
        setMyScore(myServerPlayer.score);
      }
    };
    
    socketService.onTurnChanged = (currentTurnOdId: string, turnStartTime: number) => {

      const isMyTurn = currentTurnOdId === myServerPlayerId.current;
      // Throw/stick animations commit pending pile state at their visual landing time.
      // Applying it on turnChanged can show the real pile before the ghost lands.
      
      // Reset move flag and draw source when turn changes to me
      if (isMyTurn && turnStartTime !== lastTurnStartTimeRef.current) {
        hasMadeMoveThisTurnRef.current = false;
        lastTurnStartTimeRef.current = turnStartTime;
        lastDrawSourceRef.current = null;
        // Reset previous hand to avoid false positives for new card detection
        previousHandRef.current = [];
      }
      
      // Update turn index based on server turn
      if (isMyTurn) {
        setCurrentTurnIndex(0);
      } else {
        // Find opponent index - use opponentsRef to avoid stale closure!
        const currentOpponents = opponentsRef.current;
        const oppIndex = currentOpponents.findIndex(o => o.id === currentTurnOdId);
        setCurrentTurnIndex(prev => {
          if (oppIndex >= 0) {
            return oppIndex + 1;
          }
          return prev;
        });
      }
      
      // Reset turn timer
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      setTurnWarningShown(false);
      timeoutHandledRef.current = false;
    };
    
    socketService.onRoundEnded = (result: ServerRoundResult) => {

      // Store result for navigation
      serverRoundResultRef.current = result;
      isShowingRoundSummaryRef.current = true; // Defer updates until summary closes

      const roundPlayers = result.playerResults.map(pr => ({
        totalScore: pr.newScore,
        isEliminated: pr.isEliminated,
      }));
      if (isGameFinished(roundPlayers, SCORE_LIMIT)) {
        gameEndedRef.current = true;
      }
      
      setRoundEndType(result.type);
      setRoundEndWinner(result.winnerName);
      setRoundEndWinnerId(result.winnerId);
      setRoundEndCallerId(result.callerId);
      setCardsRevealed(true);
      
      // Update all player scores from server (these are the correct scores)
      // IMPORTANT: Use newScore from server, not calculate locally
      for (const pr of result.playerResults) {
        if (pr.odId === myServerPlayerId.current) {

          setMyScore(pr.newScore);
        } else {

          setOpponents(prev => prev.map(o => 
            o.id === pr.odId 
              ? { ...o, totalScore: pr.newScore, cards: pr.cards as Card[] }
              : o
          ));
        }
      }
    };
    
    socketService.onGameEnded = (finalScores) => {

      // Mark that game has ended — navigation happens after round-end animation
      gameEndedRef.current = true;
      
      // Cleanup all timers before leaving
      if (turnTimerIntervalRef.current) {
        clearInterval(turnTimerIntervalRef.current);
        turnTimerIntervalRef.current = null;
      }
      
      // Stop turn timer countdown
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      
      pendingGameOverPlayersRef.current = finalScores.map((player) => {
        const isMe = player.odId === myServerPlayerId.current;
        return {
          id: isMe ? (user?.uid || 'me') : player.odId,
          name: isMe ? (profile?.username || gt.me) : player.name,
          avatar: player.avatar,
          score: player.score,
          isMe,
        };
      });
    };
    
    // === Sticking available (server) ===
    socketService.onStickingAvailable = (card, timeoutMs) => {
      if (!allowSticking) return;
      stickCardIdRef.current = card.id;
      setStickCardId(card.id);
      
      // Card was hidden for anim — merge into hand immediately
      setMyHand(prev => {
        const cardExists = prev.some(c => c.id === card.id);
        if (cardExists) return prev;
        return sortHand([...prev, card]);
      });
      
      // Stop overlapping draw/fly animations so the stick card does not remain as a ghost over the hand.
      const optimisticDrawAnimId = optimisticDrawAnimIdRef.current;
      setAnimatingCards(prev => prev.filter(a =>
        a.id !== optimisticDrawAnimId &&
        !a.id.includes(card.id) &&
        a.card?.id !== card.id
      ));
      optimisticDrawAnimIdRef.current = null;
      optimisticDrawReadyRef.current = false;
      pendingOptimisticDrawCardRef.current = null;
      isWaitingForNewCardRef.current = false;
      lastDrawSourceRef.current = null;
      lastThrownRankForStickRef.current = null;
      setHiddenCardId(null);
      setIsAnimating(false);
    };
    
    // === Stick window ended ===
    socketService.onStickingExpired = () => {
      stickCardIdRef.current = null;
      setStickCardId(null);
    };
    
    socketService.onRoomClosed = (reason) => {
      setRoomClosedReason(reason);
    };

    socketService.onChatMessage = (odId, name, text) => {
      const senderName = odId === myServerPlayerId.current ? gt.me : name;
      const messageKey = odId === myServerPlayerId.current ? 'me' : odId;
      const id = `m-${Date.now()}-${odId}`;
      setChatMessages(prev => [...prev, { id, sender: senderName, text }]);
      setLastMessageByPlayer(prev => ({ ...prev, [messageKey]: text }));
      scheduleMessageClear(messageKey);
    };
    
    socketService.onPlayerKicked = (reason) => {

      setErrorMessage(reason);
      setErrorNavigateToLobby(true);
    };
    
    socketService.onMoveResult = (success, message) => {
      if (!success && message) {

        setErrorMessage(message);
        setErrorNavigateToLobby(false);
      }
    };
    
    // === Reconnection Handling ===
    socketService.onDisconnected = () => {

      setIsReconnecting(true);
    };
    
    socketService.onReconnecting = (attempt) => {

      setIsReconnecting(true);
    };
    
    socketService.onReconnected = () => {

      setIsReconnecting(false);
      // Update player ID after reconnection (socket.id changed)
      myServerPlayerId.current = socketService.getMyPlayerId();
      
      // Sync timer with server's turn start time
      const gameState = socketService.getGameState();
      if (gameState && gameState.turnStartTime) {
        const elapsedMs = Date.now() - gameState.turnStartTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const remainingSeconds = Math.max(0, TURN_DURATION_SECONDS - elapsedSeconds);

        setTurnSecondsLeft(remainingSeconds);
      }
    };
    
    socketService.onReconnectFailed = (reason) => {

      setIsReconnecting(false);
      setErrorMessage(gt.reconnectFailed);
      setErrorNavigateToLobby(true);
    };
    
    socketService.onAiMove = (playerId, cardsThrown, drawFrom) => {

      // Find AI player from current opponents (use ref to avoid stale closure)
      const currentOpponents = opponentsRef.current;
      const aiPlayer = currentOpponents.find(o => o.id === playerId);
      if (!aiPlayer) {

        return;
      }
      
      // Mark that AI is animating (prevent discard pile update)
      isAiAnimatingRef.current = true;
      
      // Create animations for AI move
      setIsAnimating(true);
      const aiPos = getOpponentHandPosition(aiPlayer.position);
      
      const aiAnims: any[] = [];
      cardsThrown.forEach((c, i) => {
        aiAnims.push({
          id: `ai-throw-${c.id}-${Date.now()}-${i}`,
          startPos: aiPos,
          endPos: getPileDropTarget(),
          card: c as Card,
          delay: i * 50,
          isThrowToPile: true
        });
      });
      
      // Pile draw: animate top of pile face-up (server omits drawn card in aiMove)
      const isAiPileDraw = drawFrom === 'pile';
      const aiTopOfPile = discardPileRef.current?.length ? discardPileRef.current[discardPileRef.current.length - 1] : null;
      const drawDelay = cardsThrown.length * 50 + 200;
      const throwLandingDelay = 600 + Math.max(0, cardsThrown.length - 1) * 50;
      aiAnims.push({
        id: `ai-draw-${Date.now()}`,
        startPos: isAiPileDraw ? getPileDropTarget() : DECK_POSITION,
        endPos: aiPos,
        card: isAiPileDraw && aiTopOfPile ? aiTopOfPile : generateRandomCard(),
        isFaceDown: !isAiPileDraw,
        delay: drawDelay
      });
      
      if (isAiPileDraw && aiTopOfPile) {
          setDiscardPile(prev => prev.filter(c => c.id !== aiTopOfPile!.id));
      }
      setAnimatingCards(prevAnims => [...prevAnims, ...aiAnims]);
      if (sfxOn) playFlick(true);
      if (sfxOn) setTimeout(() => playPick(true), drawDelay);
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('ai-throw-')));
        if (pendingDiscardPileRef.current) {
          setDiscardPile(pendingDiscardPileRef.current);
          pendingDiscardPileRef.current = null;
          if (pendingDiscardGroupRef.current) {
            setLastDiscardGroup(pendingDiscardGroupRef.current);
            pendingDiscardGroupRef.current = null;
          }
        } else {
          setDiscardPile(prev => [...prev, ...(cardsThrown as Card[])]);
          setLastDiscardGroup(cardsThrown as Card[]);
        }
      }, throwLandingDelay);
      
      // Clear animations after delay (longer to match server execution)
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => !a.id.startsWith(`ai-`)));
        setIsAnimating(false);
        isAiAnimatingRef.current = false;
        
        // Now update discard pile if we have a pending update from server
        if (pendingDiscardPileRef.current) {
          setDiscardPile(pendingDiscardPileRef.current);
          pendingDiscardPileRef.current = null;
          if (pendingDiscardGroupRef.current) {
            setLastDiscardGroup(pendingDiscardGroupRef.current);
            pendingDiscardGroupRef.current = null;
          }
        }
      }, 1200);
    };

    const animateOpponentMove = (playerId: string, cardsThrown: Card[], drawFrom: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', drawnCard?: Card) => {
      const currentOpponents = opponentsRef.current;
      const opponent = currentOpponents.find(o => o.id === playerId);
      if (!opponent) return;
      isAiAnimatingRef.current = true;
      setIsAnimating(true);
      const oppPos = getOpponentHandPosition(opponent.position);
      const anims: any[] = [];
      cardsThrown.forEach((c, i) => {
        anims.push({
          id: `opp-throw-${c.id}-${Date.now()}-${i}`,
          startPos: oppPos,
          endPos: getPileDropTarget(),
          card: c as Card,
          delay: i * 50,
          isThrowToPile: true
        });
      });
      const isPileDraw = drawFrom === 'pile' || drawFrom === 'pileFirst' || drawFrom === 'pileLast' || drawFrom === 'pileIndex' || drawFrom === 'pileCardId';
      // Drawn pile card must be pre-throw top, not one of the cards just thrown
      const thrownIds = new Set(cardsThrown.map(c => c.id));
      const drawnCardOk = drawnCard && !thrownIds.has(drawnCard.id);
      const topOfPile = discardPileRef.current?.length ? discardPileRef.current[discardPileRef.current.length - 1] : null;
      const drawCard = isPileDraw
        ? (drawnCardOk ? drawnCard : (topOfPile ?? generateRandomCard()))
        : generateRandomCard();
      // Pile draw: card flies face-up from pile to opponent hand
      const showFaceDown = !isPileDraw;
      const drawDelay = cardsThrown.length * 50 + 200;
      const throwLandingDelay = 600 + Math.max(0, cardsThrown.length - 1) * 50;
      anims.push({
        id: `opp-draw-${Date.now()}`,
        startPos: isPileDraw ? getPileDropTarget() : DECK_POSITION,
        endPos: oppPos,
        card: drawCard,
        isFaceDown: showFaceDown,
        delay: drawDelay
      });
      if (isPileDraw && drawCard) {
          setDiscardPile(prev => prev.filter(c => c.id !== drawCard.id));
      }
      setAnimatingCards(prevAnims => [...prevAnims, ...anims]);
      if (sfxOn) playFlick(true);
      if (sfxOn) setTimeout(() => playPick(true), drawDelay);
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('opp-throw-')));
        if (pendingDiscardPileRef.current) {
          setDiscardPile(pendingDiscardPileRef.current);
          pendingDiscardPileRef.current = null;
          if (pendingDiscardGroupRef.current) {
            setLastDiscardGroup(pendingDiscardGroupRef.current);
            pendingDiscardGroupRef.current = null;
          }
        } else {
          setDiscardPile(prev => [...prev, ...cardsThrown]);
          setLastDiscardGroup(cardsThrown);
        }
      }, throwLandingDelay);
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('opp-')));
        setIsAnimating(false);
        isAiAnimatingRef.current = false;
        if (pendingDiscardPileRef.current) {
          setDiscardPile(pendingDiscardPileRef.current);
          pendingDiscardPileRef.current = null;
          if (pendingDiscardGroupRef.current) {
            setLastDiscardGroup(pendingDiscardGroupRef.current);
            pendingDiscardGroupRef.current = null;
          }
        }
      }, 1200);
    };

    socketService.onPlayerMove = (playerId, cardsThrown, drawFrom, drawnCard) => {
      if (playerId === myServerPlayerId.current) return;
      animateOpponentMove(playerId, cardsThrown, drawFrom, drawnCard);
    };

    // === Stick animation (slam) — all clients ===
    socketService.onStickPerformed = (playerId, card) => {
      const isMe = playerId === myServerPlayerId.current;
      isStickAnimatingRef.current = true;
      
      // Animation start from correct hand
      let startPos: { x: number; y: number };
      if (isMe) {
        // Local player stick: from hand (raised)
        startPos = { x: HAND_POSITION.x, y: HAND_POSITION.y - 25 };
        // Remove from hand
        setMyHand(prev => prev.filter(c => c.id !== card.id));
        // Clear stick state
        stickCardIdRef.current = null;
        setStickCardId(null);
        setHiddenCardId(null);
        if (stickTimerRef.current) {
          clearTimeout(stickTimerRef.current);
          stickTimerRef.current = null;
        }
      } else {
        // Opponent stick: from their seat
        const currentOpponents = opponentsRef.current;
        const opponent = currentOpponents.find(o => o.id === playerId);
        startPos = opponent ? getOpponentHandPosition(opponent.position) : PILE_POSITION;
      }
      
      // === Slam sequence ===
      const ts = Date.now();
      const animUp = `slap-up-${ts}`;
      const animSlam = `slap-slam-${ts}`;
      
      // High point above discard pile
      const highPoint = { 
        x: PILE_POSITION.x, 
        y: PILE_POSITION.y - (height * 0.3)
      };
      
      const UP_TIME = 350;
      const SLAM_TIME = 150;
      
      // Phase 1: lift from hand
      const optimisticDrawAnimId = optimisticDrawAnimIdRef.current;
      optimisticDrawAnimIdRef.current = null;
      optimisticDrawReadyRef.current = false;
      pendingOptimisticDrawCardRef.current = null;
      setAnimatingCards(prev => [
        ...prev.filter(a =>
          a.id !== optimisticDrawAnimId &&
          !a.id.includes(card.id) &&
          a.card?.id !== card.id
        ),
        { 
        id: animUp, 
        startPos: startPos, 
        endPos: highPoint, 
        card: card, 
        delay: 0, 
        duration: UP_TIME, 
        arcHeight: -50,
        isSlam: false 
        }
      ]);
      
      // Phase 2: slam onto pile
      setTimeout(() => {
        setAnimatingCards(prev => {
          const filtered = prev.filter(a => a.id !== animUp);
          return [...filtered, { 
            id: animSlam, 
            startPos: highPoint, 
            endPos: getPileDropTarget(),
            card: card, 
            delay: 0, 
            duration: SLAM_TIME, 
            arcHeight: 0,
            isSlam: true
          }];
        });
      }, UP_TIME);
      
      // Phase 3: SFX on impact
      setTimeout(() => {
        if (sfxOn) playStick(true);
      }, UP_TIME + SLAM_TIME);
      
      // Phase 4: cleanup overlay
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => a.id !== animSlam));
        if (pendingDiscardPileRef.current) {
          setDiscardPile(pendingDiscardPileRef.current);
          pendingDiscardPileRef.current = null;
          if (pendingDiscardGroupRef.current) {
            setLastDiscardGroup(pendingDiscardGroupRef.current);
            pendingDiscardGroupRef.current = null;
          }
        } else {
          setDiscardPile(prev => [...prev, card]);
          setLastDiscardGroup([card]);
        }
        isStickAnimatingRef.current = false;
      }, UP_TIME + SLAM_TIME + 150);
    };
    
    // Initial state from server
    const gameState = socketService.getGameState();
    if (gameState) {
      socketService.onGameStateUpdated?.(gameState);
    }
    
    return () => {
      // Cleanup socket listeners
      socketService.onGameStateUpdated = undefined;
      socketService.onTurnChanged = undefined;
      socketService.onRoundEnded = undefined;
      socketService.onGameEnded = undefined;
      socketService.onStickingAvailable = undefined;
      socketService.onStickingExpired = undefined;
      socketService.onRoomClosed = undefined;
      socketService.onPlayerKicked = undefined;
      socketService.onMoveResult = undefined;
      socketService.onAiMove = undefined;
      socketService.onPlayerMove = undefined;
      socketService.onStickPerformed = undefined;
      socketService.onChatMessage = undefined;
      socketService.onDisconnected = undefined;
      socketService.onReconnecting = undefined;
      socketService.onReconnected = undefined;
      socketService.onReconnectFailed = undefined;
      
      // Cleanup refs
      isThrowingCardsRef.current = false;
      isAiAnimatingRef.current = false;
      isStickAnimatingRef.current = false;
      isWaitingForNewCardRef.current = false;
      pendingDiscardPileRef.current = null;
      pendingDiscardGroupRef.current = null;
      gameEndedRef.current = false;
      isShowingRoundSummaryRef.current = false; // Reset when component unmounts
    };
  }, [isOnlineMode, opponents.length]);

  const myHandValue = myHand.reduce((sum, card) => sum + card.value, 0);
  const isHandComplete = !isAnimating;
  // Yaniv button should only appear if:
  // 1. Hand is complete (not animating)
  // 2. It's my turn
  // 3. Hand value <= 7
  // 4. In online mode: I have NOT made a move this turn yet (can only call Yaniv before throwing cards)
  const canCallYaniv = isHandComplete && 
                       isViewerCurrentTurn && 
                       !waitingForRoundStart &&
                       myHandValue <= 7 &&
                       (!isOnlineMode || !hasMadeMoveThisTurnRef.current);
  const allScores = [...opponents.map(o => o.totalScore), myScore]; 
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const hasLeader = minScore !== maxScore;
  const hasActiveTurn = playerOrder.length > 0;
  const opponentsWithTurn = opponents.map(o => ({ ...o, isTurn: currentTurnPlayerId === o.id }));
  const selectedCards = myHand.filter(c => selectedCardIds.includes(c.id));
  const isSelectionValid = selectedCards.length > 0 && isValidSetGroup(selectedCards);

  useEffect(() => {
      if (!hasActiveTurn) return;
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      setTurnWarningShown(false);
      timeoutHandledRef.current = false;
  }, [currentTurnPlayerId, hasActiveTurn]);

  useEffect(() => {
      const subscription = AppState.addEventListener('change', (nextState) => {
          const wasActive = appStateRef.current === 'active';
          appStateRef.current = nextState;
          const nowActive = nextState === 'active';
          setIsAppActive(nowActive);
          if (!wasActive && nowActive) {
              const elapsedSeconds = Math.floor((Date.now() - lastActiveAtRef.current) / 1000);
              if (elapsedSeconds > 0 && !roundEndType && !isAnimating) {
                  setTurnSecondsLeft(prev => Math.max(0, prev - elapsedSeconds));
              }
              setTurnWarningShown(false);
          }
          if (nowActive) {
              lastActiveAtRef.current = Date.now();
          }
      });
      return () => subscription.remove();
  }, [roundEndType, isAnimating]);

  useEffect(() => {
      // Pause turn timer during round-end overlay or animations
      if (!hasActiveTurn || !isAppActive || roundEndType || isAnimating) {
        // Clear interval if exists
        if (turnTimerIntervalRef.current) {
          clearInterval(turnTimerIntervalRef.current);
          turnTimerIntervalRef.current = null;
        }
        return;
      }
      
      // Don't start timer if game has ended
      if (gameEndedRef.current) {
        if (turnTimerIntervalRef.current) {
          clearInterval(turnTimerIntervalRef.current);
          turnTimerIntervalRef.current = null;
        }
        return;
      }
      
      // Clear any existing interval
      if (turnTimerIntervalRef.current) {
        clearInterval(turnTimerIntervalRef.current);
      }
      
      const interval = setInterval(() => {
          // Don't countdown if game ended
          if (gameEndedRef.current) {
            clearInterval(interval);
            turnTimerIntervalRef.current = null;
            return;
          }
          setTurnSecondsLeft(prev => Math.max(0, prev - 1));
          lastActiveAtRef.current = Date.now();
      }, 1000);
      
      turnTimerIntervalRef.current = interval;
      
      return () => {
        clearInterval(interval);
        turnTimerIntervalRef.current = null;
      };
  }, [hasActiveTurn, isAppActive, roundEndType, isAnimating]);

  useEffect(() => {
      // Don't timeout if game has ended
      if (gameEndedRef.current) return;
      
      // Don't timeout during round-end overlay or animations
      if (!hasActiveTurn || !isAppActive || roundEndType || isAnimating) return;
      if (turnSecondsLeft <= 0) {
          handleTurnTimeout();
      }
  }, [turnSecondsLeft, hasActiveTurn, isAppActive, roundEndType, isAnimating]);

  useEffect(() => {
      // Don't vibrate if user already left the game (lobby, round summary, game over, etc.)
      if (hasLeftGameRef.current) return;
      // Don't show warnings if game has ended
      if (gameEndedRef.current) return;
      
      if (!hasActiveTurn) return;
      if (turnSecondsLeft === TURN_DURATION_SECONDS) {
          setTurnWarningShown(false);
          return;
      }
      if (turnSecondsLeft <= 5 && !turnWarningShown) {
          Vibration.vibrate(200);
          setTurnWarningShown(true);
      }
  }, [turnSecondsLeft, turnWarningShown, hasActiveTurn]);

  useEffect(() => {
      if (!chatOpen) return;
      const timer = setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timer);
  }, [chatOpen, chatMessages.length]);

  const visibleChatMessages = useMemo(
      () => (showChat ? chatMessages : chatMessages.filter(msg => msg.sender === gt.me || msg.sender === 'אתה')),
      [showChat, chatMessages, gt.me]
  );

  const opponentMessage = (id: string) => lastMessageByPlayer[id] || undefined;

  const scheduleMessageClear = (sender: string) => {
      if (messageTimersRef.current[sender]) {
          clearTimeout(messageTimersRef.current[sender]);
      }
      messageTimersRef.current[sender] = setTimeout(() => {
          setLastMessageByPlayer(prev => {
              const next = { ...prev };
              delete next[sender];
              return next;
          });
      }, 4000);
  };

  const sendQuickEmoji = (emoji: string) => {
      setChatOpen(false);
      if (isOnlineMode) {
          socketService.sendChatMessage(emoji);
      } else {
          const id = `m-${Date.now()}`;
          setChatMessages(prev => [...prev, { id, sender: gt.me, text: emoji }]);
          setLastMessageByPlayer(prev => ({ ...prev, me: emoji }));
          scheduleMessageClear('me');
      }
  };

  const sendChatMessage = () => {
      const trimmed = chatInput.trim();
      if (!trimmed) return;
      setChatInput('');
      setChatOpen(false);
      if (isOnlineMode) {
          socketService.sendChatMessage(trimmed);
      } else {
          const id = `m-${Date.now()}`;
          setChatMessages(prev => [...prev, { id, sender: gt.me, text: trimmed }]);
          setLastMessageByPlayer(prev => ({ ...prev, me: trimmed }));
          scheduleMessageClear('me');
      }
  };

  const handleTurnTimeout = () => {
      // In online mode, the server handles turn timeouts - don't do anything locally
      if (isOnlineMode) {

          return;
      }
      
      // Don't handle timeout if we're not in the game anymore
      if (!hasActiveTurn) return;
      if (timeoutHandledRef.current) return;
      timeoutHandledRef.current = true;

      if (currentTurnPlayerId === 'me') {
          // Don't kick to lobby on timeout - auto-play a safe move instead
          if (roundEndType) return;
          if (isAnimating) return;
          if (myHand.length === 0) {
              advanceTurn();
              return;
          }

          const sortedByValue = [...myHand].sort((a, b) => b.value - a.value);
          const cardToThrow = sortedByValue[0];
          const remainingHand = myHand.filter(c => c.id !== cardToThrow.id);

          let nextDiscardPile = [...discardPile, cardToThrow];
          let drawnCard: Card;

          if (deckRef.current.length === 0 && nextDiscardPile.length > 1) {
              const topCard = nextDiscardPile[nextDiscardPile.length - 1];
              const cardsToReshuffle = nextDiscardPile.slice(0, -1);
              deckRef.current = shuffleArray(cardsToReshuffle);
              nextDiscardPile = [topCard];
          }

          if (deckRef.current.length > 0) {
              drawnCard = deckRef.current[0];
              deckRef.current = deckRef.current.slice(1);
          } else {
              drawnCard = generateRandomCard();
          }

          setDiscardPile(nextDiscardPile);
          setMyHand(sortHand([...remainingHand, drawnCard]));
          setDeckCount(deckRef.current.length);
          setSelectedCardIds([]);
          setHiddenCardId(null);
          setStickCardId(null);
          setLastDiscardedRank(null);
          advanceTurn();
          return;
      }
      setOpponents(prev => prev.filter(o => o.id !== currentTurnPlayerId));
      advanceTurn();
  };

  const aiTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const takeAiTurn = (aiId: string) => {
      const aiPlayer = opponents.find(o => o.id === aiId);
      if (!aiPlayer) return;
      if (roundEndType) return;

      const aiHandValue = getHandValue(aiPlayer.cards);
      if (aiHandValue <= 7) {
          handleAiYaniv(aiPlayer);
          return;
      }

      setIsAnimating(true);

      const discardGroup = getBestDiscardGroup(aiPlayer.cards);
      const remainingHand = aiPlayer.cards.filter(c => !discardGroup.some(d => d.id === c.id));

      // Snapshot discard top before AI throw
      const topDiscardBeforeThrow = discardPile[discardPile.length - 1];
      
      const wouldFormGroupWithTop = (hand: Card[], candidate: Card) => {
          const groups = getAllValidGroups([...hand, candidate]);
          return groups.some(g => g.length >= 2 && g.some(c => c.id === candidate.id));
      };
      const shouldTakeFromPile =
          !!topDiscardBeforeThrow &&
          (
              topDiscardBeforeThrow.value <= 3 ||
              remainingHand.some(c => c.rank === topDiscardBeforeThrow.rank) ||
              wouldFormGroupWithTop(remainingHand, topDiscardBeforeThrow)
          );
      // Build post-throw discard pile
      let nextDiscardPile = [...discardPile, ...discardGroup];
      
      let drawnCard: Card;
      let drawSource: 'pile' | 'deck' = 'deck';

      if (shouldTakeFromPile && discardPile.length > 0) {
          // Take card that was on top before AI discard
          drawnCard = topDiscardBeforeThrow;
          // Remove it from pile (it sits under the new discard group)
          nextDiscardPile = nextDiscardPile.filter(c => c.id !== topDiscardBeforeThrow.id);
          drawSource = 'pile';
      } else {
          if (deckRef.current.length === 0 && nextDiscardPile.length > 1) {
              const topCard = nextDiscardPile[nextDiscardPile.length - 1];
              const cardsToReshuffle = nextDiscardPile.slice(0, -1);
              deckRef.current = shuffleArray(cardsToReshuffle);
              nextDiscardPile = [topCard];
          }
          if (deckRef.current.length > 0) {
              drawnCard = deckRef.current[0];
              deckRef.current = deckRef.current.slice(1);
          } else {
              drawnCard = generateRandomCard();
          }
      }

      const newHand = sortHand([...remainingHand, drawnCard]);
      const opponentPos = getOpponentHandPosition(aiPlayer.position);

      const aiAnims: any[] = [];
      discardGroup.forEach((c, i) => {
          aiAnims.push({
              id: `ai-throw-${c.id}-${Date.now()}`,
              startPos: opponentPos,
              endPos: getPileDropTarget(),
              card: c,
              delay: i * 50,
              isThrowToPile: true
          });
      });
      aiAnims.push({
          id: `ai-draw-${drawnCard.id}-${Date.now()}`,
          startPos: drawSource === 'pile' ? getPileDropTarget() : DECK_POSITION,
          endPos: opponentPos,
          card: drawnCard,
          isFaceDown: drawSource === 'deck', // Pile = face up; deck = face down
          delay: 200
      });
      setAnimatingCards(prev => [...prev, ...aiAnims]);

      setTimeout(() => {
          setDiscardPile(nextDiscardPile);
          setOpponents(prev => prev.map(o => (
              o.id === aiId ? { ...o, cards: newHand, cardsCount: newHand.length } : o
          )));
          setDeckCount(deckRef.current.length);
          setAnimatingCards([]);
          setIsAnimating(false);
          advanceTurn();
      }, 1000);
  };

  useEffect(() => {
      // In online mode, AI is handled by the server - don't run local AI logic
      if (isOnlineMode) return;
      
      if (currentTurnPlayerId === 'me') return;
      const currentOpponent = opponents.find(o => o.id === currentTurnPlayerId);
      if (!currentOpponent?.isAi) return;
      if (aiTurnTimerRef.current) clearTimeout(aiTurnTimerRef.current);
      aiTurnTimerRef.current = setTimeout(() => {
          takeAiTurn(currentOpponent.id);
      }, 800);
      return () => {
          if (aiTurnTimerRef.current) clearTimeout(aiTurnTimerRef.current);
      };
  }, [currentTurnPlayerId, opponents, roundEndType, discardPile, isOnlineMode]);

  const handleYaniv = () => {
      if (waitingForRoundStart) return;
      // === Online mode: send to server ===
      if (isOnlineMode) {
          socketService.callYaniv();
          return;
      }

      // === Offline mode: local logic ===
      // Check if someone has lower or equal score (Assaf)
      const lowestOpponentScore = Math.min(...opponents.map(o => getHandValue(o.cards)));
      const isAssaf = lowestOpponentScore <= myHandValue;

      if (isAssaf) {
          const assafPlayer = opponents.find(o => getHandValue(o.cards) === lowestOpponentScore);

          setRoundEndType('assaf');
          setRoundEndWinner(assafPlayer?.name || gt.opponent);
          setRoundEndWinnerId(assafPlayer?.id || '');
          setRoundEndCallerId(myPlayer.id);
      } else {

          setRoundEndType('yaniv');
          setRoundEndWinner(myPlayer.name);
          setRoundEndWinnerId(myPlayer.id);
          setRoundEndCallerId(myPlayer.id);
      }
  };

  const handleAiYaniv = (aiPlayer: PlayerWithCards) => {
      const aiHandValue = getHandValue(aiPlayer.cards);
      const otherPlayers = [
          { id: myPlayer.id, name: myPlayer.name, cards: myHand },
          ...opponents.filter(o => o.id !== aiPlayer.id).map(o => ({ id: o.id, name: o.name, cards: o.cards }))
      ];
      const lowestOtherValue = Math.min(...otherPlayers.map(p => getHandValue(p.cards)));
      const isAssaf = lowestOtherValue <= aiHandValue;

      if (isAssaf) {
          const winner = otherPlayers.find(p => getHandValue(p.cards) === lowestOtherValue);

          setRoundEndType('assaf');
          setRoundEndWinner(winner?.name || gt.opponent);
          setRoundEndWinnerId(winner?.id || '');
          setRoundEndCallerId(aiPlayer.id);
      } else {

          setRoundEndType('yaniv');
          setRoundEndWinner(aiPlayer.name);
          setRoundEndWinnerId(aiPlayer.id);
          setRoundEndCallerId(aiPlayer.id);
      }
  };

  // Yaniv score cut: landing exactly on 50/100/200 halves the total (once per threshold)
  const applyScoreCut = (score: number): number => {
      if (getScoreCutPoints(SCORE_LIMIT).includes(score)) {
          return Math.floor(score / 2);
      }
      return score;
  };
  
  const navigateToGameOver = (finalPlayers: { id: string; name: string; avatar: string; score: number; isMe: boolean }[]) => {
      hasLeftGameRef.current = true;
      router.replace({
          pathname: '/game-over',
          params: {
              players: JSON.stringify(finalPlayers),
              roomCode: params.roomCode as string | undefined,
              roomName: params.roomName as string | undefined,
              scoreLimit: params.scoreLimit as string | undefined,
              allowSticking: params.allowSticking as string | undefined,
              playersConfig: params.players as string | undefined,
          },
      });
  };

  const resetRoundEndState = () => {
      setRoundEndType(null);
      setCardsRevealed(false);
      setRoundEndWinner('');
      setRoundEndWinnerId('');
      setRoundEndCallerId('');
      serverRoundResultRef.current = null;
      pendingGameOverPlayersRef.current = null;
  };

  const handleRoundEndOverlayComplete = () => {
      // Prevent multiple calls
      if (roundEndHandledRef.current) return;
      roundEndHandledRef.current = true;
      setRoundEndPhase(null);
      
      // Stop and reset turn timer at round end
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      setTurnWarningShown(false);
      timeoutHandledRef.current = false;

      // Show revealed cards
      setCardsRevealed(true);
      
      const finishRoundEndNavigation = () => {
          // === Online mode: use server result ===
          if (isOnlineMode && serverRoundResultRef.current) {
              const serverResult = serverRoundResultRef.current;
              
              // Convert server result to local format
              const roundResult: RoundResult = {
                  winner: {
                      id: serverResult.winnerId,
                      name: serverResult.winnerName,
                      type: serverResult.type
                  },
                  players: serverResult.playerResults.map(pr => ({
                      id: pr.odId,
                      name: pr.name,
                      avatar: pr.avatar,
                      cards: pr.cards as Card[],
                      pointsAdded: pr.pointsAdded,
                      previousScore: pr.previousScore,
                      totalScore: pr.newScore,
                      isEliminated: pr.isEliminated
                  })),
                  scoreLimit: SCORE_LIMIT
              };

              if (gameEndedRef.current || isGameFinished(roundResult.players, SCORE_LIMIT)) {
                  const finalPlayers = pendingGameOverPlayersRef.current ?? roundResult.players
                      .map(p => ({
                          id: p.id === myServerPlayerId.current ? (user?.uid || 'me') : p.id,
                          name: p.id === myServerPlayerId.current ? (profile?.username || gt.me) : p.name,
                          avatar: p.avatar,
                          score: p.totalScore,
                          isMe: p.id === myServerPlayerId.current,
                      }))
                      .sort((a, b) => a.score - b.score);
                  navigateToGameOver(finalPlayers);
                  resetRoundEndState();
                  return;
              }
              
              setTimeout(() => {
                  router.push({
                      pathname: '/round-summary',
                      params: {
                          roundResult: JSON.stringify(roundResult),
                          roomCode: params.roomCode as string | undefined,
                          scoreLimit: params.scoreLimit as string | undefined,
                          allowSticking: params.allowSticking as string | undefined,
                          isOnline: 'true'
                      }
                  });
                  resetRoundEndState();
              }, 3000);
          } else {
              // === Offline mode: calculate locally ===
              const winnerId = roundEndWinnerId || myPlayer.id;
              const callerId = roundEndCallerId || myPlayer.id;

              const getPoints = (playerId: string, handVal: number) => {
                  if (roundEndType === 'yaniv') {
                      return playerId === winnerId ? 0 : handVal;
                  }
                  if (roundEndType === 'assaf') {
                      if (playerId === winnerId) return 0;
                      if (playerId === callerId) return handVal + 30;
                      return handVal;
                  }
                  return handVal;
              };

              // Calculate points for each player
              const pointsForMe = getPoints(myPlayer.id, myHandValue);
              const rawScoreMe = myPlayer.totalScore + pointsForMe;
              const finalScoreMe = applyScoreCut(rawScoreMe);
              
              const allPlayers = [
                  {
                      id: myPlayer.id,
                      name: myPlayer.name,
                      avatar: myPlayer.avatar,
                      cards: myHand,
                      pointsAdded: pointsForMe,
                      previousScore: myPlayer.totalScore,
                      totalScore: finalScoreMe,
                      isEliminated: finalScoreMe >= SCORE_LIMIT
                  },
                  ...opponents.map(o => {
                      const handVal = getHandValue(o.cards);
                      const points = getPoints(o.id, handVal);
                      const rawScore = o.totalScore + points;
                      const finalScore = applyScoreCut(rawScore);
                      return {
                          id: o.id,
                          name: o.name,
                          avatar: o.avatar,
                          cards: o.cards,
                          pointsAdded: points,
                          previousScore: o.totalScore,
                          totalScore: finalScore,
                          isEliminated: finalScore >= SCORE_LIMIT
                      };
                  })
              ];

              if (isGameFinished(allPlayers, SCORE_LIMIT)) {
                  const finalPlayers = allPlayers
                      .map(p => ({
                          id: p.id,
                          name: p.name,
                          avatar: p.avatar,
                          score: p.totalScore,
                          isMe: p.id === 'me',
                      }))
                      .sort((a, b) => a.score - b.score);
                  navigateToGameOver(finalPlayers);
                  resetRoundEndState();
                  return;
              }

              const roundResult: RoundResult = {
                  winner: { 
                      id: winnerId,
                      name: roundEndWinner,
                      type: roundEndType as 'yaniv' | 'assaf'
                  },
                  players: allPlayers,
                  scoreLimit: SCORE_LIMIT
              };

              setTimeout(() => {
                  router.push({
                      pathname: '/round-summary',
                      params: { 
                          roundResult: JSON.stringify(roundResult),
                          roomName: params.roomName as string | undefined,
                          scoreLimit: params.scoreLimit as string | undefined,
                          allowSticking: params.allowSticking as string | undefined,
                          players: params.players as string | undefined,
                          isOnline: 'false'
                      }
                  });
                  resetRoundEndState();
              }, 3000);
          }
      };

      finishRoundEndNavigation();
  };

  const handleCardTap = (card: Card) => {
    if (waitingForRoundStart) return;
    // During stick window, hand taps ignored — must tap discard pile
    if (stickCardId) {
      return;
    }
    
    if (selectedCardIds.includes(card.id)) { setSelectedCardIds(prev => prev.filter(id => id !== card.id)); } 
    else {
        const current = myHand.filter(c => selectedCardIds.includes(c.id));
        if (isPotentialSet(current, card)) { setSelectedCardIds(prev => [...prev, card.id]); } 
        else { setSelectedCardIds([card.id]); }
    }
  };

  const executeMove = (source: 'deck' | 'pile' | 'pileFirst' | 'pileLast' | 'pileIndex' | 'pileCardId', pileIndex?: number, pileCardId?: string) => {
      // 1. Guards
      if (waitingForRoundStart) return;
      if (isAnimating) return;
      if (!isViewerCurrentTurn) {
          return;
      }
      if (selectedCardIds.length === 0) {
          return;
      }
      if (!isSelectionValid) {
          return;
      }

      // === Online mode: create animations first, then send to server ===
      if (isOnlineMode) {
      setIsAnimating(true);
      const cardsToThrow = myHand.filter(c => selectedCardIds.includes(c.id));
          const discardOrderedCardsToThrow = orderRunCardsForDiscard(cardsToThrow);
          const cardIdsToSend = [...selectedCardIds]; // Save before clearing
          // Last thrown rank for online stick detection on deck draw
          lastThrownRankForStickRef.current = discardOrderedCardsToThrow.length > 0 ? discardOrderedCardsToThrow[discardOrderedCardsToThrow.length - 1].rank : null;
          
          // Create throw animations
          const newAnims: any[] = [];
          discardOrderedCardsToThrow.forEach((c, i) => {
              newAnims.push({
                  id: `throw-${c.id}-${Date.now()}-${i}`,
                  startPos: HAND_POSITION,
                  endPos: getPileDropTarget(),
                  card: c,
                  delay: i * 50,
                  isThrowToPile: true
              });
          });

          const isPileSource = source === 'pile' || source === 'pileFirst' || source === 'pileLast' || source === 'pileIndex' || source === 'pileCardId';
          let optimisticDrawCard: Card | null = null;
          if (isPileSource && discardPile.length > 0) {
              const groupLength = lastDiscardGroup.length > 0
                ? Math.min(lastDiscardGroup.length, discardPile.length)
                : 1;
              const groupStartIndex = Math.max(0, discardPile.length - groupLength);
              let drawIndex = discardPile.length - 1;
              if (source === 'pileCardId' && pileCardId) {
                  const found = discardPile.findIndex((c, i) => i >= groupStartIndex && i < groupStartIndex + groupLength && c.id === pileCardId);
                  drawIndex = found >= 0 ? found : discardPile.length - 1;
              } else if (source === 'pileIndex' && typeof pileIndex === 'number' && pileIndex >= 0 && pileIndex < groupLength) {
                  drawIndex = groupStartIndex + pileIndex;
              } else if (source === 'pileFirst') {
                  drawIndex = groupStartIndex;
              }
              optimisticDrawCard = discardPile[drawIndex] ?? null;
              if (optimisticDrawCard) {
                  setHiddenCardId(optimisticDrawCard.id);
              }
          }

          const optimisticDrawAnimId = optimisticDrawCard ? `draw-immediate-${Date.now()}` : null;
          optimisticDrawAnimIdRef.current = optimisticDrawAnimId;
          optimisticDrawReadyRef.current = false;
          pendingOptimisticDrawCardRef.current = null;
          if (optimisticDrawCard) {
              newAnims.push({
                  id: optimisticDrawAnimId,
                  startPos: isPileSource ? getPileDropTarget() : DECK_POSITION,
                  endPos: HAND_POSITION,
                  card: optimisticDrawCard,
                  isFaceDown: false,
                  delay: 0,
              });
              if (sfxOn) playPick(true);
              setTimeout(() => {
                  optimisticDrawReadyRef.current = true;
                  if (pendingOptimisticDrawCardRef.current) {
                      completeOptimisticDraw(pendingOptimisticDrawCardRef.current);
                  }
              }, 600);
          }
          
          // CRITICAL: Set flag BEFORE setting animations to catch any immediate updates from server
          isThrowingCardsRef.current = true;
          
          setAnimatingCards(prev => [...prev, ...newAnims]);
          if (sfxOn) playFlick(true);
          
          // Save current hand BEFORE removing cards (critical for new card detection)
          const currentHandBeforeRemoval = [...myHand];
          previousHandRef.current = currentHandBeforeRemoval;
          
          // Remove cards from hand (optimistic update)
          setMyHand(prev => prev.filter(c => !cardIdsToSend.includes(c.id)));
          setSelectedCardIds([]);
          
          // Mark that we made a move this turn (prevents Yaniv button from showing)
          hasMadeMoveThisTurnRef.current = true;
          
          // Draw source for incoming card anim (any pile pick = face up)
          lastDrawSourceRef.current = (source === 'pileFirst' || source === 'pileLast' || source === 'pileIndex' || source === 'pileCardId') ? 'pile' : source;
          isWaitingForNewCardRef.current = true; // Flag that we're expecting a new card

          // Send to server (this will trigger immediate gameStateUpdated)
          socketService.throwCards(cardIdsToSend, source, source === 'pileIndex' ? pileIndex : undefined, source === 'pileCardId' ? pileCardId : undefined);
          
          // Thrown cards for optimistic pile update after anim
          const thrownCardsForPile = [...discardOrderedCardsToThrow];
          const throwLandingDelay = 600 + Math.max(0, discardOrderedCardsToThrow.length - 1) * 50;
          
          setTimeout(() => {
              setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('throw-')));
              isThrowingCardsRef.current = false;
              
              if (pendingDiscardPileRef.current) {
                setDiscardPile(pendingDiscardPileRef.current);
                pendingDiscardPileRef.current = null;
                if (pendingDiscardGroupRef.current) {
                  setLastDiscardGroup(pendingDiscardGroupRef.current);
                  pendingDiscardGroupRef.current = null;
                }
              } else {
                setDiscardPile(prev => [...prev, ...thrownCardsForPile]);
                setLastDiscardGroup(thrownCardsForPile);
              }

              // Re-process the latest server state now that the throw has visually landed.
              // This keeps the draw animation alive instead of letting the card pop into hand later.
              const latestGameState = socketService.getGameState();
              if (latestGameState) {
                socketService.onGameStateUpdated?.(latestGameState);
                if (!optimisticDrawAnimIdRef.current && !isWaitingForNewCardRef.current) {
                  setIsAnimating(false);
                }
              } else {
                isWaitingForNewCardRef.current = false;
                optimisticDrawAnimIdRef.current = null;
                optimisticDrawReadyRef.current = false;
                pendingOptimisticDrawCardRef.current = null;
                setIsAnimating(false);
              }
          }, throwLandingDelay);
          
          return;
      }

      // === Offline mode: local logic ===
      setIsAnimating(true);
      const cardsToThrow = myHand.filter(c => selectedCardIds.includes(c.id));
      const discardOrderedCardsToThrow = orderRunCardsForDiscard(cardsToThrow);
      
      // Thrown rank for offline stick
      const thrownRank = discardOrderedCardsToThrow[discardOrderedCardsToThrow.length - 1].rank;
      setLastDiscardedRank(thrownRank);
      
      let newCardToAdd: Card;
      const isPileSource = source === 'pile' || source === 'pileFirst' || source === 'pileLast' || source === 'pileIndex' || source === 'pileCardId';
      let pileTakeIndex: number | null = null;
      
      if (isPileSource) {
         if (discardPile.length === 0) { setIsAnimating(false); return; }
         const groupLength = lastDiscardGroup.length > 0
           ? Math.min(lastDiscardGroup.length, discardPile.length)
           : 1;
         const groupStartIndex = Math.max(0, discardPile.length - groupLength);
         if (source === 'pileCardId' && pileCardId) {
           const found = discardPile.findIndex((c, i) => i >= groupStartIndex && i < groupStartIndex + groupLength && c.id === pileCardId);
           if (found >= 0) pileTakeIndex = found;
           else pileTakeIndex = discardPile.length - 1;
         } else if (source === 'pileIndex' && typeof pileIndex === 'number' && pileIndex >= 0 && pileIndex < groupLength) {
           pileTakeIndex = groupStartIndex + pileIndex;
         } else {
           pileTakeIndex = source === 'pileFirst' ? groupStartIndex : discardPile.length - 1;
         }
         const topPileCard = discardPile[pileTakeIndex];
         
         setHiddenCardId(topPileCard.id);
         newCardToAdd = { ...topPileCard, id: `drawn-${Date.now()}` };
      } else {
         // Draw from stock
         if (deckRef.current.length === 0 && discardPile.length > 1) {
             // Empty stock — reshuffle discard except top card
             const topCard = discardPile[discardPile.length - 1];
             const cardsToReshuffle = discardPile.slice(0, -1);
             deckRef.current = shuffleArray(cardsToReshuffle);
             setDiscardPile([topCard]); // Leave only visible top
             setDeckCount(deckRef.current.length); // Refresh count after reshuffle
         }
         
         if (deckRef.current.length > 0) {
             newCardToAdd = deckRef.current[0];
             deckRef.current = deckRef.current.slice(1);
             setDeckCount(deckRef.current.length); // Sync UI immediately
         } else {
             // Last-resort if still no cards
         newCardToAdd = generateRandomCard();
         }
      }

      // Stick offer: deck draw matching thrown rank only
      const willOfferStick = source === 'deck' && allowSticking && newCardToAdd.rank === thrownRank;

      // Remove thrown cards from hand
      // If sticking: add drawn card immediately so hand never looks short
      setMyHand(prev => {
          const handWithoutThrown = prev.filter(c => !selectedCardIds.includes(c.id));
          if (!willOfferStick) return handWithoutThrown;
          // Immediate add for blue highlight / raised stick UI
          return sortHand([...handWithoutThrown, newCardToAdd]);
      });
      setSelectedCardIds([]);

      // Stick: start 2s window immediately (do not wait for fly anim)
      if (willOfferStick) {
          setStickCardId(newCardToAdd.id);
          if (stickTimerRef.current) clearTimeout(stickTimerRef.current);
          stickTimerRef.current = setTimeout(() => {
              setStickCardId(null);
              setLastDiscardedRank(null);
              advanceTurn();
          }, 2000);
      }

      const newAnims: any[] = [];
      
      // Throw animations
      discardOrderedCardsToThrow.forEach((c, i) => {
          newAnims.push({ id: `throw-${c.id}`, startPos: HAND_POSITION, endPos: getPileDropTarget(), card: c, delay: i * 50, isThrowToPile: true });
      });

      // Draw anim only when not sticking
      // Stick path: card already in hand with raised blue styling
      if (!willOfferStick) {
          newAnims.push({
              id: `draw-${newCardToAdd.id}`, startPos: isPileSource ? getPileDropTarget() : DECK_POSITION, endPos: HAND_POSITION, card: newCardToAdd, isFaceDown: false, delay: 200
          });
      }
      if (isPileSource && pileTakeIndex !== null) {
          setDiscardPile(prev => prev.filter((_, i) => i !== pileTakeIndex));
      }
      setAnimatingCards(prev => [...prev, ...newAnims]);
      if (sfxOn) playFlick(true);
      if (!willOfferStick && sfxOn) setTimeout(() => playPick(true), 200);
      const throwLandingDelay = 600 + Math.max(0, discardOrderedCardsToThrow.length - 1) * 50;
      const drawLandingDelay = willOfferStick ? throwLandingDelay : 800;
      
      setTimeout(() => {
          setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('throw-')));
          setDiscardPile(prev => [...prev, ...discardOrderedCardsToThrow]);
          setLastDiscardGroup(discardOrderedCardsToThrow);
      }, throwLandingDelay);

      setTimeout(() => {
          if (!willOfferStick) {
              setMyHand(prev => sortHand([...prev, newCardToAdd]));
          }
          
          setDeckCount(deckRef.current.length);
          setHiddenCardId(null);
          setAnimatingCards([]);
          setIsAnimating(false);
          
          if (!willOfferStick) {
              setLastDiscardedRank(null);
              advanceTurn();
          }
      }, Math.max(throwLandingDelay, drawLandingDelay));
  };
  
  // === Perform stick (tap discard while stick active) ===
  const performStick = () => {
      if (!allowSticking) return;
      if (!stickCardId) return;
      
      // Resolve stick target card
      const cardToStick = myHand.find(c => c.id === stickCardId);
      if (!cardToStick) return;
      
      // Clear stick timer
      if (stickTimerRef.current) {
          clearTimeout(stickTimerRef.current);
          stickTimerRef.current = null;
      }
      
      // === Online mode ===
      if (isOnlineMode) {
          const optimisticDrawAnimId = optimisticDrawAnimIdRef.current;
          isStickAnimatingRef.current = true;
          stickCardIdRef.current = null;
          setStickCardId(null);
          setHiddenCardId(null);
          setMyHand(prev => prev.filter(c => c.id !== cardToStick.id));
          setAnimatingCards(prev => prev.filter(a =>
              a.id !== optimisticDrawAnimId &&
              !a.id.includes(cardToStick.id) &&
              a.card?.id !== cardToStick.id
          ));
          optimisticDrawAnimIdRef.current = null;
          optimisticDrawReadyRef.current = false;
          pendingOptimisticDrawCardRef.current = null;
          isWaitingForNewCardRef.current = false;
          lastDrawSourceRef.current = null;
          lastThrownRankForStickRef.current = null;
          socketService.stick();
          return;
      }
      
      // === Offline: local slam anim ===
      const card = { ...cardToStick };
      
      // Clear stick UI state
      stickCardIdRef.current = null;
      setStickCardId(null);
      
      // Remove from hand
      setMyHand(prev => prev.filter(c => c.id !== card.id));
      
      // Slam animation
      const ts = Date.now();
      const animUp = `slap-up-${ts}`;
      const animSlam = `slap-slam-${ts}`;
      
      const startPos = { x: HAND_POSITION.x, y: HAND_POSITION.y - 25 };
      const highPoint = { x: PILE_POSITION.x, y: PILE_POSITION.y - (height * 0.3) };
      
      const UP_TIME = 350;
      const SLAM_TIME = 150;
      
      // Lift phase
      setAnimatingCards(prev => [...prev, { 
          id: animUp, startPos, endPos: highPoint, card, 
          delay: 0, duration: UP_TIME, arcHeight: -50, isSlam: false 
      }]);
      
      // Slam phase
      setTimeout(() => {
          setAnimatingCards(prev => {
              const filtered = prev.filter(a => a.id !== animUp);
              return [...filtered, { 
                  id: animSlam, startPos: highPoint, endPos: getPileDropTarget(), card,
                  delay: 0, duration: SLAM_TIME, arcHeight: 0, isSlam: true 
              }];
          });
      }, UP_TIME);
      
      // SFX on land
      setTimeout(() => {
          if (sfxOn) playStick(true);
      }, UP_TIME + SLAM_TIME);
      
      // Cleanup and commit to pile
      setTimeout(() => {
          setAnimatingCards(prev => prev.filter(a => a.id !== animSlam));
          setDiscardPile(prev => [...prev, card]);
          setLastDiscardGroup([card]);
          setLastDiscardedRank(null);
          advanceTurn();
      }, UP_TIME + SLAM_TIME + 150);
  };
  
  // === Discard pile press ===
  const handlePilePress = (pick: 'first' | 'last' | number | string = 'last') => {
      // Stick window: pile tap performs stick
      if (stickCardId) {
          performStick();
          return;
      }
      // Normal move: first/last for runs; cardId for set groups
      if (typeof pick === 'string' && pick !== 'first' && pick !== 'last') {
          executeMove('pileCardId', undefined, pick);
      } else if (typeof pick === 'number') {
          executeMove('pileIndex', pick);
      } else {
          executeMove(pick === 'first' ? 'pileFirst' : 'pileLast');
      }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <TropicalBackground />
      <View style={styles.header}>
          <Pressable
              style={styles.woodenIconButton}
              onPress={() => setLeaveConfirmOpen(true)}
          >
              <LinearGradient 
                  colors={['#8B7355', '#6B5344', '#5C4A32']} 
                  style={styles.woodenIconButtonGradient}
              >
                  <Home size={20} color="#F5E6D3" />
              </LinearGradient>
          </Pressable>
          <Pressable style={styles.woodenIconButton} onPress={() => setSettingsOpen(prev => !prev)}>
              <LinearGradient 
                  colors={['#8B7355', '#6B5344', '#5C4A32']} 
                  style={styles.woodenIconButtonGradient}
              >
                  <Settings size={20} color="#F5E6D3" />
              </LinearGradient>
          </Pressable>
      </View>

      {roundEndPhase === 'flowers' && roundEndCallerId && (() => {
        const winnerRegion: Region = myPlayer?.id === roundEndCallerId ? 'bottom' : (opponentsWithTurn.find(o => o.id === roundEndCallerId)?.position as Region) || 'top';
        return <RegionConfettiOverlay key="confetti" region={winnerRegion} />;
      })()}
      {roundEndPhase === 'slap' && roundEndType === 'assaf' && roundEndWinnerId && roundEndCallerId && (() => {
        const originRegion: Region = myPlayer?.id === roundEndWinnerId ? 'bottom' : ((opponentsWithTurn.find(o => o.id === roundEndWinnerId)?.position) as Region) || 'top';
        const targetRegion: Region = myPlayer?.id === roundEndCallerId ? 'bottom' : ((opponentsWithTurn.find(o => o.id === roundEndCallerId)?.position) as Region) || 'top';
        return <SlapOverlay key="slap" originRegion={originRegion} targetRegion={targetRegion} />;
      })()}

      {opponentsWithTurn.map((opponent, idx) => {
          // Guard before render
          if (!opponent || !opponent.id) {
              return null;
          }
          
          const opponentPosition = opponent.position || 'top';
          const positionStyle =
              opponentPosition === 'left'
                  ? styles.posLeft
                  : opponentPosition === 'right'
                  ? styles.posRight
                  : styles.posTop;
          // Total players for layout density
          const playerCount = opponentsWithTurn.length + 1;
          
          return (
              <View key={opponent.id || `opponent-${idx}`} style={positionStyle}>
                  <PlayerView
                      player={opponent}
                      isLeader={Boolean(hasLeader && (opponent.totalScore ?? 0) === minScore)}
                      turnSecondsLeft={turnSecondsLeft}
                      turnDurationSeconds={TURN_DURATION_SECONDS}
                      lastMessage={opponentMessage(opponent.id) || undefined}
                      revealedCards={cardsRevealed && opponent.cards && Array.isArray(opponent.cards) ? opponent.cards : undefined}
                      playerCount={playerCount}
                      position={opponentPosition}
                  />
              </View>
          );
      })}

      <View style={styles.centerTable}>
          <View
              ref={pileLayoutRef}
              onLayout={updatePileDropTarget}
              style={[styles.discardAreaWrapper, { width: MAX_DISCARD_CONTAINER_WIDTH }]}
          >
              <DiscardPile
                cards={discardPile}
                onPress={() => handlePilePress('last')}
                onPickFromGroup={handlePilePress}
                isSelected={selectedCardIds.length > 0 || stickCardId !== null}
                hiddenCardId={hiddenCardId}
                lastGroupCards={lastDiscardGroup}
                allowGroupPick={true}
              />
          </View>
          <DeckPile onPress={() => executeMove('deck')} />
      </View>

      {!settingsOpen && animatingCards.map(anim => <FlyingCard key={anim.id} {...anim} />)}


      {leaveConfirmOpen && (
          <View style={styles.leaveConfirmOverlay}>
              <View style={styles.leaveConfirmCard}>
                  <Text style={styles.leaveConfirmTitle}>{gt.leaveTitle}</Text>
                  <Text style={styles.leaveConfirmText}>{gt.leaveText}</Text>
                  <View style={styles.leaveConfirmActions}>
                      <Pressable style={styles.leaveCancelButton} onPress={() => setLeaveConfirmOpen(false)}>
                          <Text style={styles.leaveCancelText}>{gt.cancel}</Text>
                      </Pressable>
                      <Pressable style={styles.leaveExitButton} onPress={() => {
                          hasLeftGameRef.current = true;
                          // Cleanup all timers before leaving
                          if (turnTimerIntervalRef.current) {
                            clearInterval(turnTimerIntervalRef.current);
                            turnTimerIntervalRef.current = null;
                          }
                          
                          if (isOnlineMode) {
                              socketService.leaveRoom();
                              if (user) setUserInRoom(user.uid, false).catch(() => {});
                          }
                          router.replace('/lobby');
                      }}>
                          <Text style={styles.leaveExitText}>{gt.exit}</Text>
                      </Pressable>
                  </View>
              </View>
          </View>
      )}

      {roomClosedReason && (
          <View style={styles.leaveConfirmOverlay}>
              <View style={styles.leaveConfirmCard}>
                  <Text style={styles.leaveConfirmTitle}>{gt.roomClosed}</Text>
                  <Text style={styles.leaveConfirmText}>{roomClosedReason}</Text>
                  <View style={styles.leaveConfirmActions}>
                      <Pressable style={styles.leaveExitButton} onPress={() => {
                          hasLeftGameRef.current = true;
                          setRoomClosedReason(null);
                          if (turnTimerIntervalRef.current) {
                            clearInterval(turnTimerIntervalRef.current);
                            turnTimerIntervalRef.current = null;
                          }
                          if (isOnlineMode) {
                              socketService.leaveRoom();
                              if (user) setUserInRoom(user.uid, false).catch(() => {});
                          }
                          router.replace('/lobby');
                      }}>
                          <Text style={styles.leaveExitText}>{gt.backToLobby}</Text>
                      </Pressable>
                  </View>
              </View>
          </View>
      )}

      {isReconnecting && (
          <View style={styles.reconnectingOverlay}>
              <View style={styles.reconnectingCard}>
                  <ActivityIndicator size="large" color="#5B8A72" />
                  <Text style={styles.reconnectingTitle}>{gt.reconnecting}</Text>
                  <Text style={styles.reconnectingText}>{gt.pleaseWait}</Text>
              </View>
          </View>
      )}

      {errorMessage && (
          <View style={styles.errorOverlay}>
              <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>{gt.error}</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  <Pressable
                      style={styles.errorButton}
                      onPress={() => {
                          if (errorNavigateToLobby) hasLeftGameRef.current = true;
                          setErrorMessage(null);
                          if (errorNavigateToLobby) {
                              router.replace('/lobby');
                          }
                      }}
                  >
                      <Text style={styles.errorButtonText}>{gt.close}</Text>
                  </Pressable>
              </View>
          </View>
      )}

      {settingsOpen && (
          <Pressable style={styles.settingsBackdrop} onPress={() => setSettingsOpen(false)}>
              <View />
          </Pressable>
      )}

      {settingsOpen && (
          <View style={styles.settingsPanel}>
              <Text style={styles.settingsTitle}>{gt.settingsTitle}</Text>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>{gt.music}</Text>
                  <Switch value={musicOn} onValueChange={setMusicOn} thumbColor={musicOn ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>{gt.sounds}</Text>
                  <Switch value={sfxOn} onValueChange={setSfxOn} thumbColor={sfxOn ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>{gt.hideOthersMessages}</Text>
                  <Switch value={showChat} onValueChange={setShowChat} thumbColor={showChat ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
          </View>
      )}

      <Pressable style={styles.chatToggle} onPress={() => setChatOpen(prev => !prev)}>
          <Text style={styles.chatToggleText}>💬</Text>
      </Pressable>

      {chatOpen && (
          <View style={styles.chatPanel}>
              <View style={styles.chatHeader}>
                  <Text style={styles.chatTitle}>{gt.chat}</Text>
                  <Pressable style={styles.chatCloseButton} onPress={() => setChatOpen(false)}>
                      <Text style={styles.chatCloseText}>✕</Text>
                  </Pressable>
              </View>
              <ScrollView
                  ref={chatScrollRef}
                  style={styles.chatMessages}
                  contentContainerStyle={styles.chatMessagesContent}
              >
                  {visibleChatMessages.map(msg => (
                      <View key={msg.id} style={[styles.chatBubble, (msg.sender === gt.me || msg.sender === 'אתה') ? styles.chatBubbleMe : styles.chatBubbleOther]}>
                          <Text style={styles.chatBubbleText}>{msg.text}</Text>
                      </View>
                  ))}
              </ScrollView>
              <View style={styles.chatInputRow}>
                  <TextInput
                      value={chatInput}
                      onChangeText={setChatInput}
                      placeholder={gt.messagePlaceholder}
                      placeholderTextColor="#9CA3AF"
                      style={styles.chatInput}
                      onSubmitEditing={sendChatMessage}
                      returnKeyType="send"
                  />
                  <Pressable style={styles.chatSendButton} onPress={sendChatMessage}>
                      <Text style={styles.chatSendText}>{gt.send}</Text>
                  </Pressable>
              </View>
              <View style={styles.quickEmojiRow}>
                  {quickEmojis.map(emoji => (
                      <Pressable key={emoji} style={styles.quickEmojiButton} onPress={() => sendQuickEmoji(emoji)}>
                          <Text style={styles.quickEmojiText}>{emoji}</Text>
                      </Pressable>
                  ))}
              </View>
          </View>
      )}

      <View style={[styles.myArea, settingsOpen && styles.myAreaBehindOverlay]} pointerEvents={settingsOpen ? 'none' : 'auto'}>
           <View style={{marginBottom: 6}}>
               {myPlayer ? (
                   <PlayerView
                       player={myPlayer}
                       isMe
                       isLeader={Boolean(hasLeader && myScore === minScore)}
                       handValue={myHandValue}
                       handLabel={gt.hand}
                       turnSecondsLeft={turnSecondsLeft}
                       turnDurationSeconds={TURN_DURATION_SECONDS}
                       lastMessage={lastMessageByPlayer.me || undefined}
                       playerCount={opponentsWithTurn.length + 1}
                   />
               ) : null}
           </View>
           {canCallYaniv && !roundEndType && (
               <Pressable style={styles.tropicalYanivButton} onPress={handleYaniv}>
                   <LinearGradient colors={['#D4A574', '#B8956A', '#8B7355']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.tropicalYanivGradient}>
                       <Text style={styles.tropicalYanivText}>{gt.yanivButton}</Text>
                   </LinearGradient>
               </Pressable>
           )}
           {/* Stick hint — tap the discard pile */}
           {stickCardId && (
               <View style={styles.stickIndicator}>
                   <Text style={styles.stickIndicatorText}>{gt.stickHint}</Text>
               </View>
           )}
           {waitingForRoundStart && (
               <View style={styles.waitingRoundBanner}>
                   <Text style={styles.waitingRoundText}>{gt.waitingForPlayers}</Text>
               </View>
           )}
           <View style={styles.handContainer} pointerEvents={roundEndType || waitingForRoundStart ? 'none' : 'auto'}>
               {myHand.map((card, i) => (
                   <PlayerCardView 
                       key={card.id} 
                       card={card} 
                       index={i} 
                       total={myHand.length} 
                       isSelected={selectedCardIds.includes(card.id)} 
                       selectionIsValid={isSelectionValid} 
                       onPress={() => handleCardTap(card)}
                       isStickCard={stickCardId !== null && String(stickCardId) === String(card.id)}
                   />
               ))}
           </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  tropicalBackgroundImage: { width: '100%', height: '100%', position: 'absolute' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, marginTop: 40, zIndex: 50 },
  iconButton: { padding: 10, borderRadius: 50, borderWidth: 2, shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity:0.3, shadowRadius:4, elevation: 4 },
  
  // Wood-styled header buttons
  woodenIconButton: { 
      borderRadius: 50, 
      overflow: 'hidden',
      shadowColor: '#000', 
      shadowOffset: {width: 0, height: 4}, 
      shadowOpacity: 0.4, 
      shadowRadius: 5, 
      elevation: 6,
      borderWidth: 2,
      borderColor: '#4A3728',
  },
  woodenIconButtonGradient: {
      padding: 12,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
  },
  
  miniCardSize: { width: MINI_CARD_WIDTH, height: MINI_CARD_HEIGHT },
  tableCardSize: { width: TABLE_CARD_WIDTH, height: TABLE_CARD_HEIGHT },
  myCardSize: { width: MY_CARD_WIDTH, height: MY_CARD_HEIGHT },
  
  // Cards using face images
  cardImageContainer: { 
      borderRadius: 10, 
      overflow: 'hidden', 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 3 }, 
      shadowOpacity: 0.3, 
      shadowRadius: 4, 
      elevation: 5,
      backgroundColor: 'transparent',
      opacity: 1,
      backfaceVisibility: 'hidden',
  },
  cardImage: { 
      width: '100%', 
      height: '100%', 
      borderRadius: 10,
      opacity: 1,
      backfaceVisibility: 'hidden',
  },
  
  cardContainer: { borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'space-between', padding: 6, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.15, shadowRadius:3, elevation: 4 },
  cardBgWhite: { backgroundColor: '#FFFFFF' },
  
  jokerRankText: { color: '#FEF3C7', fontWeight: '900', letterSpacing: 1, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2 },

  selectedCard: { borderColor: '#FBBF24', borderWidth: 2, shadowColor: '#FBBF24', shadowOpacity: 0.5 },
  validSelectedCard: { borderColor: '#22C55E', borderWidth: 2, shadowColor: '#22C55E', shadowOpacity: 0.7 },
  stickingCard: { borderColor: '#38BDF8', borderWidth: 4, shadowColor: '#38BDF8', shadowOpacity: 1, shadowRadius: 15, elevation: 10 },
  stickIndicator: {
      backgroundColor: '#38BDF8',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 8,
      alignSelf: 'center',
  },
  stickIndicatorText: {
      color: '#000',
      fontWeight: 'bold',
      fontSize: 14,
  },
  waitingRoundBanner: {
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      marginBottom: 8,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  waitingRoundText: {
      color: '#FBBF24',
      fontWeight: '700',
      fontSize: 14,
      textAlign: 'center',
  },
  
  cornerContainer: { alignItems: 'center', justifyContent: 'center', minWidth: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', marginBottom: -2, textAlign: 'center' },
  
  cardBackContainer: { borderRadius: 8, borderWidth: 2, borderColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cardBackInnerBorder: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: 'rgba(254, 243, 199, 0.3)', borderRadius: 4 },
  patternGrid: { position: 'absolute', opacity: 0.15, flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 },
  patternDot: { width: 6, height: 6, backgroundColor: '#FEF3C7', transform: [{rotate: '45deg'}] },
  backLogoText: { fontFamily: Platform.OS === 'ios' ? 'serif' : 'notoserif', fontWeight: '900', color: '#FEF3C7', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: {width:1, height:1}, textShadowRadius: 3 },
  backSubText: { color: 'rgba(254, 243, 199, 0.8)', fontWeight: 'bold', letterSpacing: 1, fontSize: 8 },
  
  // === Carved wood card chrome ===
  woodenCard: { 
      borderRadius: 12, 
      overflow: 'hidden', 
      shadowColor: '#000', 
      shadowOffset: {width: 0, height: 4}, 
      shadowOpacity: 0.4, 
      shadowRadius: 6, 
      elevation: 8,
      borderWidth: 1,
      borderColor: '#A08060',
  },
  woodenCardBg: { 
      flex: 1, 
      borderRadius: 12, 
      position: 'relative',
  },
  tropicalCardBack: { 
      borderRadius: 12, 
      overflow: 'hidden', 
      shadowColor: '#000', 
      shadowOffset: {width: 0, height: 4}, 
      shadowOpacity: 0.4, 
      shadowRadius: 6, 
      elevation: 8,
      borderWidth: 1,
      borderColor: '#8B7355',
  },
  cardBackImage: { width: '100%', height: '100%', borderRadius: 12 },
  
  // Wood grain stripes
  woodGrainOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  woodGrainLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: '#A08060' },
  
  // Card corner brackets
  woodenCornerTopLeft: { position: 'absolute', top: 8, left: 10, zIndex: 10 },
  woodenCornerBottomRight: { position: 'absolute', bottom: 8, right: 10, zIndex: 10 },
  woodenRankText: { 
      fontWeight: '900', 
      fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', 
      textShadowColor: 'rgba(180, 150, 100, 0.5)', 
      textShadowOffset: {width: 1, height: 1}, 
      textShadowRadius: 1,
  },
  
  // Center suit — engraved look
  woodenCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Corner rank pips
  carvedSuitContainer: { justifyContent: 'center', alignItems: 'center' },
  carvedSuit: { 
      shadowColor: '#5C4A32', 
      shadowOffset: { width: 2, height: 3 }, 
      shadowOpacity: 0.6, 
      shadowRadius: 2,
  },
  carvedHeart: { 
      borderTopLeftRadius: 100, 
      borderTopRightRadius: 100, 
      borderBottomLeftRadius: 50, 
      borderBottomRightRadius: 50,
      transform: [{ rotate: '-45deg' }],
  },
  carvedDiamond: { 
      transform: [{ rotate: '45deg' }], 
      borderRadius: 4,
  },
  carvedClubContainer: { 
      position: 'relative', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100%',
      height: '100%',
  },
  carvedClubCircle: { 
      position: 'absolute', 
      borderRadius: 100,
      shadowColor: '#5C4A32', 
      shadowOffset: { width: 1, height: 2 }, 
      shadowOpacity: 0.5, 
      shadowRadius: 1,
  },
  carvedClubTop: { top: 0 },
  carvedClubLeft: { bottom: '30%', left: '10%' },
  carvedClubRight: { bottom: '30%', right: '10%' },
  carvedClubStem: { position: 'absolute', bottom: 0, borderRadius: 2 },
  carvedSpade: { 
      borderTopLeftRadius: 50, 
      borderTopRightRadius: 50,
      borderBottomLeftRadius: 100, 
      borderBottomRightRadius: 100,
      transform: [{ rotate: '180deg' }],
      shadowColor: '#5C4A32', 
      shadowOffset: { width: 2, height: 3 }, 
      shadowOpacity: 0.6, 
      shadowRadius: 2,
  },
  
  // Legacy style aliases
  tropicalCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity:0.3, shadowRadius:4, elevation: 5 },
  tropicalCardBg: { flex: 1, borderRadius: 12, padding: 6, position: 'relative' },
  tropicalCornerTopLeft: { position: 'absolute', top: 6, left: 8 },
  tropicalCornerBottomRight: { position: 'absolute', bottom: 6, right: 8 },
  tropicalRankText: { fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2 },
  tropicalCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tropicalSuitContainer: { padding: 8, borderRadius: 8 },
  
  playerWrapper: { alignItems: 'center', position: 'relative', width: 150 },
  playerWrapperCompact: { width: 130 },
  
  // Side opponents (vertical fan)
  sidePlayerWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', height: 180 },
  sidePlayerLeft: { },
  sidePlayerRight: { },
  sidePlayerContent: { alignItems: 'center' },
  verticalFanContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  verticalFanContainerSide: { height: 120, width: 60, alignItems: 'center', justifyContent: 'center' },
  sidePlayerInfo: { alignItems: 'center', zIndex: 10 },
  
  // Compact chrome for side opponents
  avatarContainerSmall: { marginBottom: 2, alignItems: 'center', justifyContent: 'center', width: 50, height: 50, zIndex: 20 },
  turnRingContainerSmall: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  avatarCircleSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#5C4A32', borderWidth: 2, borderColor: '#8B7355', alignItems: 'center', justifyContent: 'center' },
  crownBadgeSmall: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FBBF24', borderRadius: 8, padding: 2, zIndex: 30 },
  scoreBadgeSmall: { position: 'absolute', bottom: -4, backgroundColor: '#5B8A72', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: '#3D5E4A', zIndex: 30 },
  nameTagSmall: { backgroundColor: 'rgba(75, 55, 40, 0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2, borderWidth: 1, borderColor: 'rgba(139, 115, 85, 0.5)' },
  
  avatarContainer: { marginBottom: 4, alignItems: 'center', justifyContent: 'center', width: TURN_RING_SIZE, height: TURN_RING_SIZE, zIndex: 20 },
  avatarCircle: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: '#F5E6D3', borderWidth: 4, borderColor: '#5B8A72', justifyContent: 'center', alignItems: 'center', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.45, elevation:6 },
  turnRingContainer: { position: 'absolute', width: TURN_RING_SIZE, height: TURN_RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  playerMessageBubble: { position: 'absolute', top: -36, backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#374151', maxWidth: 160 },
  playerMessageText: { color: 'white', fontSize: 13, fontWeight: '600' },
  // Chat bubbles beside side seats
  sidePlayerMessageBubble: { position: 'absolute', backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#374151', maxWidth: 140, zIndex: 50 },
  sideMessageLeft: { left: 70, top: -20 }, // Bubble to the right of left-seat player
  sideMessageRight: { right: 70, top: -20 }, // Bubble to the left of right-seat player
  crownBadge: { position: 'absolute', top: -8, right: -5, backgroundColor: '#FBBF24', borderRadius: 12, padding: 3, borderWidth: 2, borderColor: 'white' },
  scoreBadge: { position: 'absolute', bottom: -8, backgroundColor: '#5B8A72', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: '#3D5E4A' },
  scoreText: { color: '#FFFBF5', fontSize: 12, fontWeight: 'bold' },
  turnTimerPill: { backgroundColor: '#5B8A72', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginBottom: 4, borderWidth: 2, borderColor: '#3D5E4A' },
  turnTimerText: { color: '#FFFBF5', fontSize: 12, fontWeight: 'bold' },
  nameTag: { backgroundColor: 'rgba(75, 55, 40, 0.9)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginBottom: 4, zIndex: 30, borderWidth: 1, borderColor: 'rgba(139, 115, 85, 0.5)' },
  nameText: { color: '#F5E6D3', fontSize: 14, fontWeight: 'bold' },
  handValueTag: { backgroundColor: 'rgba(91, 138, 114, 0.9)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(61, 94, 74, 0.5)' },
  handValueText: { color: '#FFFBF5', fontSize: 12, fontWeight: 'bold' },
  
  opponentFanContainer: { position: 'absolute', top: 65, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  opponentFanContainerCompact: { top: 60 },
  miniFanCard: { position: 'absolute' },
  
  // Top opponent: fan above, avatar row below
  topOpponentWrapper: { alignItems: 'center', flexDirection: 'column' },
  topOpponentFanContainer: { height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  topOpponentInfoBelow: { alignItems: 'center' },
  
  // Opponent slots (matches OPP_TOP/LEFT/RIGHT)
  posTop: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  posLeft: { position: 'absolute', top: height * 0.21, left: 15, zIndex: 10 },
  posRight: { position: 'absolute', top: height * 0.21, right: 15, zIndex: 10 },
  
  centerTable: { position: 'absolute', top: TABLE_Y_POS - (TABLE_CARD_HEIGHT/2), width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 24, zIndex: 5 },
  discardAreaWrapper: { alignItems: 'center', justifyContent: 'center' },

  chatToggle: { position: 'absolute', right: 16, bottom: 170, width: 50, height: 50, borderRadius: 25, backgroundColor: '#6B5344', borderWidth: 3, borderColor: '#4A3728', alignItems: 'center', justifyContent: 'center', zIndex: 30, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.45, shadowRadius:6, elevation:6 },
  chatToggleText: { color: 'white', fontSize: 20 },
  chatPanel: { position: 'absolute', right: 16, bottom: 230, width: 250, maxHeight: 290, backgroundColor: 'rgba(75, 55, 40, 0.97)', borderRadius: 16, borderWidth: 2, borderColor: '#6B5344', padding: 12, zIndex: 30, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.45, shadowRadius:12, elevation:10 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(139, 115, 85, 0.4)', marginBottom: 8 },
  chatTitle: { color: '#F5E6D3', fontWeight: '700', fontSize: 14 },
  chatCloseButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#5C4A32', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8B7355' },
  chatCloseText: { color: '#F5E6D3', fontSize: 13 },
  chatMessages: { maxHeight: 170 },
  chatMessagesContent: { paddingBottom: 8, gap: 6 },
  chatBubble: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, maxWidth: '100%' },
  chatBubbleMe: { backgroundColor: '#5B8A72', alignSelf: 'flex-end' },
  chatBubbleOther: { backgroundColor: '#5C4A32', alignSelf: 'flex-start' },
  chatBubbleText: { color: '#FFFBF5', fontSize: 13, fontWeight: '500' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  chatInput: { flex: 1, height: 36, borderRadius: 12, backgroundColor: '#5C4A32', borderWidth: 1, borderColor: '#8B7355', color: '#F5E6D3', paddingHorizontal: 12, fontSize: 13 },
  chatSendButton: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#5B8A72', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3D5E4A' },
  chatSendText: { color: '#FFFBF5', fontSize: 13, fontWeight: 'bold' },
  quickEmojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  quickEmojiButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#5C4A32', borderWidth: 1, borderColor: '#8B7355', alignItems: 'center', justifyContent: 'center' },
  quickEmojiText: { fontSize: 16 },
  
  pileContainer: { 
      alignItems: 'center', 
      justifyContent: 'center',
      width: TABLE_CARD_WIDTH, 
      height: TABLE_CARD_HEIGHT,
  },
  
  pilePlaceholder: { position: 'absolute', width: TABLE_CARD_WIDTH, height: TABLE_CARD_HEIGHT, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(139, 115, 85, 0.3)', borderStyle: 'dashed' },
  deckContainer: {  },
  deckShadowCard: { position: 'absolute' },
  deckCountBadge: { position: 'absolute', bottom: -12, alignSelf: 'center', backgroundColor: '#5B8A72', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 2, borderColor: '#3D5E4A' },
  deckCountText: { fontSize: 11, fontWeight: 'bold', color: '#FFFBF5' },
  
  myArea: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 15 },
  myAreaBehindOverlay: { zIndex: 1 },
  yanivButton: { marginBottom: 10 },
  yanivGradient: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 22, borderWidth: 2, borderColor: '#FCD34D' },
  yanivText: { color: 'white', fontWeight: '900', fontSize: 15 },
  
  // Tropical Yaniv CTA
  tropicalYanivButton: { 
      marginBottom: 10,
      shadowColor: '#5C4A32',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
  },
  tropicalYanivGradient: { 
      paddingHorizontal: 28, 
      paddingVertical: 12, 
      borderRadius: 25, 
      borderWidth: 3, 
      borderColor: '#6B5344',
  },
  tropicalYanivText: { 
      color: '#FFFBF5', 
      fontWeight: '900', 
      fontSize: 18,
      textShadowColor: 'rgba(92, 74, 50, 0.6)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
  },
  handContainer: { flexDirection: 'row', alignItems: 'flex-end', height: MY_CARD_HEIGHT + 15, paddingHorizontal: 5 },
  
  // Round end overlay — same pattern as leaveConfirm / errorCard
  roundEndOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
  roundEndCard: { width: 300, backgroundColor: '#4B3728', borderRadius: 18, padding: 28, borderWidth: 3, borderColor: '#8B7355', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 14 },
  roundEndEmoji: { fontSize: 52, marginBottom: 8 },
  roundEndTitle: { fontSize: 32, fontWeight: '900', color: '#F5E6D3', textAlign: 'center' },
  roundEndWinner: { fontSize: 18, fontWeight: '700', color: 'rgba(245, 230, 211, 0.9)', marginTop: 6, textAlign: 'center' },
  leaveConfirmOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 9000 },
  leaveConfirmCard: { width: 290, backgroundColor: '#4B3728', borderRadius: 18, padding: 20, borderWidth: 3, borderColor: '#6B5344', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 14 },
  leaveConfirmTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  leaveConfirmText: { color: 'rgba(245, 230, 211, 0.85)', fontSize: 14, textAlign: 'center', marginBottom: 18 },
  leaveConfirmActions: { flexDirection: 'row', gap: 12 },
  leaveCancelButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#8B7355', backgroundColor: '#5C4A32', alignItems: 'center' },
  leaveCancelText: { color: '#F5E6D3', fontSize: 14, fontWeight: '700' },
  leaveExitButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#9B4444', borderWidth: 2, borderColor: '#7A3333', alignItems: 'center' },
  leaveExitText: { color: '#FFFBF5', fontSize: 14, fontWeight: '700' },

  errorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 9000 },
  errorCard: { width: 290, backgroundColor: '#4B3728', borderRadius: 18, padding: 20, borderWidth: 3, borderColor: '#6B5344', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 14 },
  errorTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  errorText: { color: 'rgba(245, 230, 211, 0.85)', fontSize: 14, textAlign: 'center', marginBottom: 18 },
  errorButton: { backgroundColor: '#D4A574', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#B8956A' },
  errorButtonText: { color: '#4B3728', fontSize: 15, fontWeight: '800' },

  // Reconnecting overlay styles
  reconnectingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 9500 },
  reconnectingCard: { width: 260, backgroundColor: '#4B3728', borderRadius: 18, padding: 30, borderWidth: 3, borderColor: '#5B8A72', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 14 },
  reconnectingTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: '900', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  reconnectingText: { color: 'rgba(245, 230, 211, 0.7)', fontSize: 14, textAlign: 'center' },

  settingsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 60 },
  settingsPanel: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 270, backgroundColor: '#4B3728', padding: 22, paddingTop: 60, borderLeftWidth: 3, borderLeftColor: '#6B5344', zIndex: 70, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },
  settingsTitle: { color: '#F5E6D3', fontSize: 18, fontWeight: 'bold', marginBottom: 18 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(139, 115, 85, 0.3)' },
  settingsLabel: { color: '#F5E6D3', fontSize: 15 },
  settingsHint: { color: 'rgba(245, 230, 211, 0.6)', fontSize: 13, marginTop: 16 },
  
  // Sticking CTA — tropical styling
  stickButton: { 
      position: 'absolute', 
      top: TABLE_Y_POS + TABLE_CARD_HEIGHT + 10, 
      alignSelf: 'center',
      zIndex: 100,
      shadowColor: '#5B8A72',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 10,
  },
  stickButtonGradient: {
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: '#3D5E4A',
      alignItems: 'center',
  },
  stickButtonText: {
      color: '#FFFBF5',
      fontWeight: '900',
      fontSize: 18,
  },
  stickButtonSubtext: {
      color: 'rgba(255, 251, 245, 0.8)',
      fontWeight: '600',
      fontSize: 13,
  },
});