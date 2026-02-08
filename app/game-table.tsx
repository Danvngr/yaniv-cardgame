import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, Home, Settings } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Dimensions, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, UIManager, Vibration, View, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../context/SoundContext';
import { playAssaf, playFlick, playPick, playStick, playYaniv } from '../lib/gameSounds';
import { ClientGameState, RoundResult as ServerRoundResult, socketService } from '../lib/socketService';
import { setUserInRoom } from '../lib/userService';

// הפעלת LayoutAnimation לאנדרואיד
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- גדלים (זום אין) ---
const CARD_RATIO = 1.4;
const AVATAR_SIZE = 48;
const TURN_RING_SIZE = 60;
const TURN_RING_STROKE = 3;
const PROFILE_AVATAR_KEY = 'profile:avatar';
const PROFILE_USERNAME_KEY = 'profile:username';

// קלפים שלי (למטה)
const MY_CARD_WIDTH = width * 0.18; 
const MY_CARD_HEIGHT = MY_CARD_WIDTH * CARD_RATIO;

// קלפי שולחן (ערימה באמצע) - גדולים
const TABLE_CARD_WIDTH = width * 0.22;
const TABLE_CARD_HEIGHT = TABLE_CARD_WIDTH * CARD_RATIO;

// קלפי יריב - גדולים יותר לזום אין
const getMiniCardWidth = (playerCount: number) => {
    if (playerCount <= 2) return width * 0.17;
    if (playerCount === 3) return width * 0.15;
    return width * 0.13;
};
const MINI_CARD_WIDTH = width * 0.17;
const MINI_CARD_HEIGHT = MINI_CARD_WIDTH * CARD_RATIO;

// --- מיקומים (מותאם לעיצוב טרופי) ---
const TABLE_TOP_PCT = 0.56; // ערימה באמצע השולחן - יותר למטה
const TABLE_Y_POS = height * TABLE_TOP_PCT;
const CENTER_OFFSET = 12 + (TABLE_CARD_WIDTH / 2); // מרווח בין הערימות

const PILE_POSITION = { x: width / 2 - CENTER_OFFSET, y: TABLE_Y_POS }; 
const DECK_POSITION = { x: width / 2 + CENTER_OFFSET, y: TABLE_Y_POS }; 
const HAND_POSITION = { x: width / 2, y: height - 80 }; 

// מיקומי יריבים
const OPP_TOP_POSITION = { x: width / 2, y: 70 };
const OPP_LEFT_POSITION = { x: 15, y: height * 0.21 }; // קרוב לקיר שמאל (מיקום מנפה מוגבה ב־30%)
const OPP_RIGHT_POSITION = { x: width - 15, y: height * 0.21 }; // קרוב לקיר ימין

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';
type Position = 'top' | 'left' | 'right';

// === מיפוי תמונות קלפים ===
const CARD_IMAGES: Record<string, any> = {
    // Hearts
    'hearts-A': require('../assets/images/cards/hearts/1-hearts.png'),
    'hearts-2': require('../assets/images/cards/hearts/2-hearts.png'),
    'hearts-3': require('../assets/images/cards/hearts/3-hearts.png'),
    'hearts-4': require('../assets/images/cards/hearts/4-hearts.png'),
    'hearts-5': require('../assets/images/cards/hearts/5-hearts.png'),
    'hearts-6': require('../assets/images/cards/hearts/6-hearts.png'),
    'hearts-7': require('../assets/images/cards/hearts/7-hearts.png'),
    'hearts-8': require('../assets/images/cards/hearts/8-hearts.png'),
    'hearts-9': require('../assets/images/cards/hearts/9-hearts.png'),
    'hearts-10': require('../assets/images/cards/hearts/10-hearts.png'),
    'hearts-J': require('../assets/images/cards/hearts/J-hearts.png'),
    'hearts-Q': require('../assets/images/cards/hearts/Q-hearts.png'),
    'hearts-K': require('../assets/images/cards/hearts/K-hearts.png'),
    
    // Diamonds
    'diamonds-A': require('../assets/images/cards/diamonds/1-diamonds-Photoroom.png'),
    'diamonds-2': require('../assets/images/cards/diamonds/2-diamonds-Photoroom.png'),
    'diamonds-3': require('../assets/images/cards/diamonds/3-diamonds-Photoroom.png'),
    'diamonds-4': require('../assets/images/cards/diamonds/4-diamonds-Photoroom.png'),
    'diamonds-5': require('../assets/images/cards/diamonds/5-diamonds-Photoroom.png'),
    'diamonds-6': require('../assets/images/cards/diamonds/6-diamonds-Photoroom.png'),
    'diamonds-7': require('../assets/images/cards/diamonds/7-diamonds-Photoroom.png'),
    'diamonds-8': require('../assets/images/cards/diamonds/8-diamonds-Photoroom.png'),
    'diamonds-9': require('../assets/images/cards/diamonds/9-diamonds-Photoroom.png'),
    'diamonds-10': require('../assets/images/cards/diamonds/10-diamonds-Photoroom.png'),
    'diamonds-J': require('../assets/images/cards/diamonds/J-diamonds-Photoroom.png'),
    'diamonds-Q': require('../assets/images/cards/diamonds/Q-diamonds-Photoroom.png'),
    'diamonds-K': require('../assets/images/cards/diamonds/K-diamonds-Photoroom.png'),
    
    // Clubs
    'clubs-A': require('../assets/images/cards/clubs/1 -clubs.png'),
    'clubs-2': require('../assets/images/cards/clubs/2 -clubs.png'),
    'clubs-3': require('../assets/images/cards/clubs/3 -clubs.png'),
    'clubs-4': require('../assets/images/cards/clubs/4 -clubs.png'),
    'clubs-5': require('../assets/images/cards/clubs/5 -clubs.png'),
    'clubs-6': require('../assets/images/cards/clubs/6 -clubs.png'),
    'clubs-7': require('../assets/images/cards/clubs/7-clubs.png'),
    'clubs-8': require('../assets/images/cards/clubs/8 -clubs.png'),
    'clubs-9': require('../assets/images/cards/clubs/9 -clubs.png'),
    'clubs-10': require('../assets/images/cards/clubs/10 -clubs.png'),
    'clubs-J': require('../assets/images/cards/clubs/j -clubs.png'),
    'clubs-Q': require('../assets/images/cards/clubs/q -clubs.png'),
    'clubs-K': require('../assets/images/cards/clubs/k -clubs.png'),
    
    // Spades
    'spades-A': require('../assets/images/cards/spades/1-spades-Photoroom.png'),
    'spades-2': require('../assets/images/cards/spades/2-spades-Photoroom.png'),
    'spades-3': require('../assets/images/cards/spades/3-spades-Photoroom.png'),
    'spades-4': require('../assets/images/cards/spades/4-spades-Photoroom.png'),
    'spades-5': require('../assets/images/cards/spades/5-spades-Photoroom.png'),
    'spades-6': require('../assets/images/cards/spades/6-spades-Photoroom.png'),
    'spades-7': require('../assets/images/cards/spades/7-spades-Photoroom.png'),
    'spades-8': require('../assets/images/cards/spades/8-spades-Photoroom.png'),
    'spades-9': require('../assets/images/cards/spades/9-spades-Photoroom.png'),
    'spades-10': require('../assets/images/cards/spades/10-spades-Photoroom.png'),
    'spades-J': require('../assets/images/cards/spades/J-spades-Photoroom.png'),
    'spades-Q': require('../assets/images/cards/spades/Q-spades-Photoroom.png'),
    'spades-K': require('../assets/images/cards/spades/K-spades-Photoroom.png'),
    
    // Joker
    'joker': require('../assets/images/cards/joker.png'),
};

// פונקציה לקבלת תמונת קלף
const getCardImage = (suit: Suit, rank: Rank): any => {
    if (rank === 'Joker' || suit === 'joker') {
        return CARD_IMAGES['joker'];
    }
    const key = `${suit}-${rank}`;
    return CARD_IMAGES[key] || null;
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
    totalScore: number;
    isEliminated: boolean;
  }[];
  scoreLimit: number;
}

// --- לוגיקה ---
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

// מערבוב מערך (Fisher-Yates shuffle)
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// יצירת 4 חפיסות מלאות (כולל ג'וקרים) ומערבוב
const generateFullDeck = (numDecks: number = 4): Card[] => {
    const suits: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];
    
    for (let d = 0; d < numDecks; d++) {
        // 52 קלפים רגילים
        for (const suit of suits) {
            for (const rank of ranks) {
                let value = parseInt(rank);
                if (isNaN(value)) { if (rank === 'A') value = 1; else value = 10; }
                deck.push({ id: `${d}-${suit}-${rank}`, suit, rank, value });
            }
        }
        // 2 ג'וקרים לכל חפיסה
        deck.push({ id: `${d}-joker-1`, suit: 'joker', rank: 'Joker', value: 0 });
        deck.push({ id: `${d}-joker-2`, suit: 'joker', rank: 'Joker', value: 0 });
    }
    
    return shuffleArray(deck);
};

// חלוקת קלפים מהחפיסה
const dealFromDeck = (deck: Card[], count: number): { dealt: Card[], remaining: Card[] } => {
    const dealt = sortHand(deck.slice(0, count));
    const remaining = deck.slice(count);
    return { dealt, remaining };
};

// פונקציה לאתחול המשחק (חלוקה לכל השחקנים)
const initializeGame = (playerCount: number = 4, cardsPerPlayer: number = 5) => {
    let deck = generateFullDeck(4); // 4 חפיסות = 216 קלפים
    
    const hands: Card[][] = [];
    for (let i = 0; i < playerCount; i++) {
        const { dealt, remaining } = dealFromDeck(deck, cardsPerPlayer);
        hands.push(dealt);
        deck = remaining;
    }
    
    // קלף ראשון לערימה הפתוחה
    const firstDiscard = deck[0];
    deck = deck.slice(1);
    
    return { hands, initialDiscard: firstDiscard, remainingDeck: deck };
};

// יצירת קלף אקראי (לשימוש זמני / fallback)
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

const isPotentialSet = (selectedCards: Card[], newCard: Card): boolean => {
    const allCards = [...selectedCards, newCard];
    if (allCards.length === 1) return true;
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
    if (isSameRankSet(cards, 2)) return true;
    return isRunSet(cards, 3);
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

// --- רכיבים ויזואליים ---

const TropicalBackground = () => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image 
                source={require('../assets/images/tropical-background.jpg')} 
                style={styles.tropicalBackgroundImage}
                resizeMode="cover"
            />
        </View>
    );
};

const CardBack = ({ size = 'regular' }: { size?: 'mini' | 'regular' | 'large' }) => {
    let widthStyle;
    if (size === 'mini') { widthStyle = styles.miniCardSize; }
    else if (size === 'large') { widthStyle = styles.myCardSize; }
    else { widthStyle = styles.tableCardSize; }
    
    return (
        <View style={[styles.tropicalCardBack, widthStyle]}>
            <Image 
                source={require('../assets/images/card-back.jpg')} 
                style={styles.cardBackImage}
                resizeMode="cover"
            />
        </View>
    );
};

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

const PlayingCard = ({ card, isFaceDown = false, isSelected = false, onPress, rotate = '0deg', translateY = 0, size = 'regular', style }: PlayingCardProps) => {
    if (isFaceDown) return <CardBack size={size} />;
    if (!card) return null;

    let dimensionsStyle = styles.tableCardSize;
    
    if (size === 'large') { 
        dimensionsStyle = styles.myCardSize; 
    } else if (size === 'mini') {
        dimensionsStyle = styles.miniCardSize;
    }
    
    // קבלת תמונת הקלף
    const cardImage = getCardImage(card.suit, card.rank);

    return (
        <Pressable onPress={onPress} style={[styles.cardImageContainer, dimensionsStyle, style, { transform: [{ rotate }, { translateY }] }]}>
            <Image 
                source={cardImage} 
                style={styles.cardImage}
                resizeMode="contain"
            />
        </Pressable>
    );
};

const PlayerCardView = ({ card, index, total, isSelected, selectionIsValid, onPress, throwAnimValue, isStickCard }: any) => {
    const rotateDeg = (index - (total - 1) / 2) * 4;
    const cardOverlap = -MY_CARD_WIDTH * 0.45;
    
    // קלף הדבקה - משתמשים ב-View רגיל, לא Animated
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
    
    // קלף רגיל - נבחר או לא
    const shouldBeRaised = isSelected;
    
    const animatedStyle = isSelected && throwAnimValue ? {
        opacity: throwAnimValue.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
        transform: [
            { rotate: `${rotateDeg}deg` }, 
            { translateY: throwAnimValue.interpolate({ inputRange: [0, 1], outputRange: [-20, -300] })},
            { scale: throwAnimValue.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.5] })}
        ]
    } : { 
        opacity: 1, 
        transform: [
            { rotate: `${rotateDeg}deg` },
            { translateY: shouldBeRaised ? -25 : 0 }
        ] 
    };

    const cardStyle = isSelected ? (selectionIsValid ? styles.validSelectedCard : styles.selectedCard) : undefined;

    return (
        <Animated.View style={{ 
            marginLeft: index === 0 ? 0 : cardOverlap, 
            zIndex: shouldBeRaised ? 100 : index, 
            ...animatedStyle 
        }}>
            <PlayingCard card={card} size="large" isSelected={false} onPress={onPress} style={cardStyle} />
        </Animated.View>
    );
};


const PlayerView = ({ player, isMe = false, isLeader = false, handValue, turnSecondsLeft, turnDurationSeconds = 60, lastMessage, revealedCards, playerCount = 2, position = 'top' }: { player: Player | PlayerWithCards, isMe?: boolean, isLeader?: boolean, handValue?: number, turnSecondsLeft?: number, turnDurationSeconds?: number, lastMessage?: string, revealedCards?: Card[], playerCount?: number, position?: 'top' | 'left' | 'right' }) => {
    // בדיקה שהשחקן קיים
    if (!player || !player.id) {
        return null;
    }
    
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
    
    // גודל קלפים
    const dynamicMiniCardWidth = getMiniCardWidth(playerCount);
    const miniScale = Math.max(1.0, Math.min(1.3, dynamicMiniCardWidth / MINI_CARD_WIDTH));
    
    // האם המניפה אנכית (לצדדים) או אופקית (למעלה)
    const isVerticalFan = position === 'left' || position === 'right';
    const cardSpacing = isVerticalFan ? 28 : 35; // מרווח בין קלפים - גדול יותר

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

    // רינדור הקלפים - אנכי או אופקי
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
            
            // עבור מניפה אנכית (שמאל/ימין) - קלפים מלמעלה למטה
            // עבור מניפה אופקית (למעלה) - קלפים בקשת הפוכה (לכיוון התקרה)
            const transform = isVerticalFan 
                ? [
                    { translateY: diff * cardSpacing },
                    { rotate: `${diff * 10}deg` },
                    { translateX: Math.abs(diff) * 4 },
                    { scale: miniScale }
                ]
                : [
                    { translateX: diff * cardSpacing },
                    { rotate: `${-diff * 12}deg` },  // הפוך את כיוון הסיבוב
                    { translateY: -Math.abs(diff) * 8 },  // קשת לכיוון התקרה (מינוס = למעלה)
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

    // עבור יריבים בצדדים - קלפים באמצע, לוגו+שם בצד הנגדי
    if (!isMe && isVerticalFan) {
        const isLeftSide = position === 'left';
        return (
            <View style={[styles.sidePlayerWrapper, isLeftSide ? styles.sidePlayerLeft : styles.sidePlayerRight]}>
                {/* הודעת צ'אט */}
                {lastMessage ? (
                    <View style={[
                        styles.sidePlayerMessageBubble, 
                        isLeftSide ? styles.sideMessageLeft : styles.sideMessageRight
                    ]} pointerEvents="none">
                        <Text style={styles.playerMessageText}>{String(lastMessage)}</Text>
                    </View>
                ) : null}
                
                {/* מיכל אופקי: קלפים + (לוגו+שם) */}
                <View style={[styles.sidePlayerContent, { flexDirection: isLeftSide ? 'row' : 'row-reverse' }]}>
                    {/* קלפים */}
                    <View style={styles.verticalFanContainerSide}>
                        {renderCardFan()}
                    </View>
                    
                    {/* לוגו ושם - בצד הנגדי של הקלפים */}
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

    // עבור יריב למעלה (לא בצדדים) - קלפים למעלה, לוגו+שם למטה
    if (!isMe && position === 'top') {
        return (
            <View style={styles.topOpponentWrapper}>
                {/* קלפים למעלה */}
                <View style={styles.topOpponentFanContainer}>
                    {renderCardFan()}
                </View>
                
                {/* לוגו ושם למטה */}
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

    // עבור השחקן שלי - תצוגה רגילה
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
                    <Text style={styles.handValueText}>{`יד: ${handValue ?? 0}`}</Text>
                </View>
            ) : null}
        </View>
    );
};

// --- קומפוננטת ערימת זריקה משודרגת (עם תמיכה ברצף ובהסתרה) ---
const CARD_SPREAD = 28;
const SET_GROUP_SPREAD_PAIR = 72;   // זוג – קלפים נפרדים
const SET_GROUP_SPREAD_34 = 48;     // שלישייה/רביעייה – צמצום פתיחה לטלפון
// Fixed width for discard area so the deck never shifts; use ~1/3 of max spread so deck is a bit left
const MAX_DISCARD_SPREAD = 3 * Math.max(SET_GROUP_SPREAD_PAIR, SET_GROUP_SPREAD_34);
const MAX_DISCARD_CONTAINER_WIDTH = TABLE_CARD_WIDTH + Math.floor(MAX_DISCARD_SPREAD / 3);
const DiscardPile = ({
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
    onPickFromGroup?: (pick: 'first' | 'last' | number | string) => void; // string = cardId (בחירת קלף ספציפי בקבוצה)
    isSelected: boolean;
    hiddenCardId: string | null;
    lastGroupCards?: Card[];
    allowGroupPick?: boolean;
}) => {
    const groupCards = lastGroupCards || [];
    const groupSize = groupCards.length;
    const isRun = groupSize >= 3 && isRunSet(groupCards, 3);
    const isSetGroup = groupSize >= 2 && isSameRankSet(groupCards, 2); // זוג/שלישייה/רביעייה
    const showSpread = isRun || isSetGroup;
    const canPickFirstOrLast = isRun && allowGroupPick && onPickFromGroup;
    const canPickAnyInGroup = isSetGroup && !isRun && allowGroupPick && onPickFromGroup; // בחירת כל קלף בקבוצה
    const visibleCards = showSpread ? groupCards : cards.slice(-5);
    const spread = showSpread && isSetGroup && !isRun
        ? (groupSize >= 3 ? SET_GROUP_SPREAD_34 : SET_GROUP_SPREAD_PAIR)
        : CARD_SPREAD;
    const totalSpread = showSpread ? (visibleCards.length - 1) * spread : 0;
    const containerWidth = TABLE_CARD_WIDTH + totalSpread;

    const renderCard = (card: Card, index: number) => {
        const isTop = index === visibleCards.length - 1;
        const seed = card.id.charCodeAt(0);
        let offsetX = 0, offsetY = 0, rotation = 0, opacity = 1;
        if (showSpread) {
            offsetX = index * spread;
            offsetY = (index % 2 === 0) ? -8 : 8;
            rotation = (index - (visibleCards.length - 1) / 2) * 3;
            opacity = card.id === hiddenCardId ? 0 : (index === 0 || isTop ? 1 : 0.85);
        } else {
            if (!isTop) {
                offsetX = (seed % 20) - 10;
                offsetY = ((seed * 2) % 20) - 10;
                rotation = (seed % 30) - 15;
            }
            opacity = card.id === hiddenCardId ? 0 : (isTop ? 1 : Math.max(0.7, 0.7 + (index / (visibleCards.length - 1)) * 0.3));
        }
        return (
            <View
                key={`${card.id}-${index}`}
                style={{
                    position: 'absolute',
                    left: showSpread ? offsetX : undefined,
                    zIndex: index,
                    transform: showSpread
                        ? [{ translateY: offsetY }, { rotate: `${rotation}deg` }]
                        : [{ translateX: offsetX }, { translateY: offsetY }, { rotate: `${rotation}deg` }],
                    opacity
                }}
                pointerEvents="none"
            >
                <PlayingCard card={card} size="regular" />
            </View>
        );
    };

    if (!canPickFirstOrLast && !canPickAnyInGroup) {
        return (
            <Pressable onPress={onPress} style={styles.pileContainer}>
                <View style={styles.pilePlaceholder} pointerEvents="none" />
                {visibleCards.map((card, index) => renderCard(card, index))}
            </Pressable>
        );
    }

    const extraWidth = containerWidth - TABLE_CARD_WIDTH;
    const firstCardClickableWidth = CARD_SPREAD;

    if (canPickAnyInGroup) {
        return (
            <View style={[styles.pileContainer, { width: containerWidth, marginLeft: -extraWidth / 2 }]}>
                {visibleCards.map((card, index) => renderCard(card, index))}
                {visibleCards.map((card, index) => (
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
            {visibleCards.map((card, index) => renderCard(card, index))}
            <Pressable onPress={() => onPickFromGroup?.('first')} style={{ position: 'absolute', left: 0, top: 0, width: firstCardClickableWidth, height: TABLE_CARD_HEIGHT, zIndex: 50 }} />
            <Pressable onPress={() => onPickFromGroup?.('last')} style={{ position: 'absolute', left: firstCardClickableWidth, top: 0, width: containerWidth - firstCardClickableWidth, height: TABLE_CARD_HEIGHT, zIndex: 51 }} />
        </View>
    );
};

const DeckPile = ({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.deckContainer}>
        <View style={[styles.deckShadowCard, { top: -2, left: -1 }]}><CardBack size="regular" /></View>
        <View style={[styles.deckShadowCard, { top: -4, left: -2 }]}><CardBack size="regular" /></View>
        <View style={{position: 'relative'}}>
            <CardBack size="regular" />
        </View>
    </Pressable>
);

// --- קלף מעופף ---
const FlyingCard = ({ startPos, endPos, card, onComplete, delay = 0, isFaceDown = false, isSlam = false, duration = 600, arcHeight: customArcHeight }: any) => {
    const anim = useRef(new Animated.Value(0)).current;
    
    // יחס גדלים למניעת קפיצה (שולחן ליד)
    const TABLE_TO_HAND_RATIO = TABLE_CARD_WIDTH / MY_CARD_WIDTH;

    useEffect(() => {
        if (isSlam) {
            // אנימציית כאפה - נפילה מהירה ואגרסיבית מלמעלה
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { 
                    toValue: 1, 
                    duration: duration || 180, 
                    useNativeDriver: true, 
                    // Easing אגרסיבי - מתחיל איטי ומאיץ לקראת הסוף (כמו נפילה חופשית)
                    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
                })
            ]).start(({ finished }) => { if (finished && onComplete) onComplete(); });
        } else {
            // זריקה רגילה: easing עדין בסוף כדי שהקלף יגיע ברציפות לראש הערימה בלי "עצירה" ואז נחיתה
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
    
    // סיבוב - עבור כאפה, סיבוב דרמטי שמוסיף לאפקט הנחיתה
    const rotate = isSlam 
        ? anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: ['-15deg', '-8deg', '12deg', '0deg'] })
        : anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    const isThrowing = startPos.y > endPos.y;
    const defaultArcHeight = isThrowing ? 0 : -40; // זריקה לערימה: בלי קשת – קו ישר עד ראש הערימה
    const arcHeight = customArcHeight !== undefined ? customArcHeight : defaultArcHeight;
    
    // עבור כאפה - bounce קטן וחד בסוף הנחיתה. זריקה רגילה - בלי קשת (arcHeight=0) כדי שהקלף יגיע ישר לראש הערימה
    const arcTranslateY = isSlam
        ? anim.interpolate({ 
            inputRange: [0, 0.85, 0.92, 1], 
            outputRange: [0, 0, -12, 0]  // bounce קצר וחד
        })
        : anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, arcHeight, 0] });
    
    const translateY = Animated.add(baseTranslateY, arcTranslateY);
    
    // סקייל - עבור כאפה, הקלף גדל תוך כדי נפילה ואז "מתפוצץ" בנחיתה
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
};

// --- קונפטי ---
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

// --- אנימציית סיום סיבוב (יניב/אסף) ---
const RoundEndOverlay = ({ type, winnerName, onComplete }: { type: RoundEndType; winnerName: string; onComplete: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (!type) return;
        
        if (type === 'yaniv') {
            setShowConfetti(true);
        }

        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true })
        ]).start();

        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(scaleAnim, { toValue: 0.8, duration: 300, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start(() => {
                setShowConfetti(false);
                onComplete();
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [type]);

    if (!type) return null;

    const isYaniv = type === 'yaniv';
    const title = isYaniv ? 'יניב!' : 'אסף!';
    const emoji = isYaniv ? '🎉' : '💥';

    return (
        <Animated.View style={[styles.roundEndOverlay, { opacity: opacityAnim }]}>
            <Confetti active={showConfetti} />
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={styles.roundEndCard}>
                    <Text style={styles.roundEndEmoji}>{emoji}</Text>
                    <Text style={styles.roundEndTitle}>{title}</Text>
                    <Text style={styles.roundEndWinner}>{winnerName}</Text>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

// --- רכיב ראשי ---
export default function GameTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  
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
          { name: 'אתה', avatar: '😎', isHost: true, isAi: false },
          { name: 'AI 1', avatar: '🤖', isHost: false, isAi: true }
      ];
  };
  const roomPlayers = parseRoomPlayers();
  const roundId = (params.roundId as string) ?? 'init';
  const lastRoundIdRef = useRef(roundId);
  const roundEndHandledRef = useRef(false);
  
  // מידע על מנצח הסיבוב הקודם (להחלטה מי מתחיל) - רלוונטי רק למצב אופליין
  const prevWinnerId = params.prevWinnerId as string | undefined;
  const isFirstRound = !prevWinnerId;

  // אתחול המשחק - 4 חפיסות מעורבבות, חלוקה לכל השחקנים
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
  useEffect(() => {
    discardPileRef.current = discardPile;
  }, [discardPile]);
  
  // State חדש לניהול הקלף ה"מוסתר" בזמן אנימציה
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // === הדבקה (Slap/Stick) ===
  // stickCardId - ה-ID של הקלף שניתן להדביק (null אם אין הדבקה זמינה)
  const [stickCardId, setStickCardId] = useState<string | null>(null);
  // רפרנס לסנכרון מיידי בתוך callbacks (ללא בעיות closure)
  const stickCardIdRef = useRef<string | null>(null);
  useEffect(() => {
      stickCardIdRef.current = stickCardId;
  }, [stickCardId]);
  // lastDiscardedRank - הרנק של הקלף האחרון שנזרק (למוד אופליין)
  const [lastDiscardedRank, setLastDiscardedRank] = useState<Rank | null>(null);
  // טיימר להדבקה
  const stickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // ניקוי טיימר הדבקה כשהקומפוננטה מתפרקת
  useEffect(() => {
      return () => {
          if (stickTimerRef.current) {
              clearTimeout(stickTimerRef.current);
          }
      };
  }, []);
  
  // 4 חפיסות = 216 קלפים, מינוס 4 שחקנים * 5 קלפים = 20, מינוס 1 קלף פתוח = 195
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
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; }[]>([
      { id: 'm1', sender: 'דני', text: '🔥 מהלך יפה!' },
      { id: 'm2', sender: 'אתה', text: 'תודה 😎' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [lastMessageByPlayer, setLastMessageByPlayer] = useState<Record<string, string>>({});
  const messageTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chatScrollRef = useRef<ScrollView | null>(null);
  const quickEmojis = ['😀', '😂', '😮', '👏', '🔥', '😎'];
  const [myAvatar, setMyAvatar] = useState('😎');
  const [myName, setMyName] = useState('אתה');

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
  
  // חישוב מי מתחיל את הסיבוב
  const getStartingTurnIndex = () => {
      if (isOnlineMode) {

          return 0;
      }
      const order = ['me', ...opponentIds.slice(0, roomPlayers.length - 1)];

      if (isFirstRound) {
          // סיבוב ראשון - רנדומלי
          const randomIdx = Math.floor(Math.random() * order.length);

          return randomIdx;
      }
      // סיבובים הבאים - המנצח מתחיל
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
      // התור הראשון - רנדומלי בסיבוב ראשון, אחרת המנצח מתחיל (אופליין בלבד)
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
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const SCORE_LIMIT = gameScoreLimit; // מתוך הגדרות החדר

  // צלילי סיום סיבוב (יניב / אסף)
  useEffect(() => {
    if (!roundEndType || !sfxOn) return;
    if (roundEndType === 'yaniv') playYaniv(true);
    if (roundEndType === 'assaf') playAssaf(true);
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
  // עבור הדבקה באונליין: הרנק של הקלף האחרון שנזרק (כדי לדעת אם הקלף שנמשך מאפשר הדבקה)
  const lastThrownRankForStickRef = useRef<Rank | null>(null);
  const isShowingRoundSummaryRef = useRef<boolean>(false); // לדחות עדכונים בזמן מסך סיכום
  const isThrowingCardsRef = useRef<boolean>(false);
  const pendingDiscardPileRef = useRef<Card[] | null>(null);
  const pendingDiscardGroupRef = useRef<Card[] | null>(null);
  const isAiAnimatingRef = useRef<boolean>(false);
  const turnTimerIntervalRef = useRef<number | null>(null);
  const gameEndedRef = useRef(false);
  const hasLeftGameRef = useRef(false);
  
  // Keep opponents ref in sync
  useEffect(() => {
    opponentsRef.current = opponents;
  }, [opponents]);
  
  useEffect(() => {
    if (!isOnlineMode) return;
    
    // Get my player ID from socket service
    myServerPlayerId.current = socketService.getMyPlayerId();
    
    // Setup socket callbacks
    socketService.onGameStateUpdated = (gameState: ClientGameState) => {

      // אם מסך הסיכום מוצג, דחה את כל העדכונים - הקלפים יחולקו אחרי שהמסך נסגר
      if (isShowingRoundSummaryRef.current) {

        return;
      }
      
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
        hasMadeMoveThisTurnRef.current = false;
        
        // Reset scores ONLY on first round (new game) - server already did this in startGame()
        if (isFirstRound) {
          setMyScore(0);
          setOpponents(prev => prev.map(o => ({ ...o, totalScore: 0 })));
        }
        // For subsequent rounds, scores are already updated from server in onRoundEnded
      }
      
      // Update my cards - detect new card and animate it BEFORE adding to hand
      // CRITICAL: Skip hand updates while throwing animation is in progress to prevent flicker
      if (gameState.yourCards && !isThrowingCardsRef.current) {
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
          console.log('=== onGameStateUpdated with waiting ===');
          console.log('isWaitingForNewCardRef:', isWaitingForNewCardRef.current);
          console.log('lastDrawSourceRef:', lastDrawSourceRef.current);
          console.log('lastThrownRankForStickRef:', lastThrownRankForStickRef.current);
          console.log('stickCardIdRef:', stickCardIdRef.current);
          // Find any new cards (ones that don't exist in previous hand)
          // Don't check hand size - just check if there are new cards by ID
          const newCards = previousHand.length > 0 
            ? sortedCards.filter(c => !previousHand.some(pc => pc.id === c.id))
            : [];
          
          if (newCards.length > 0) {
            // Found new card(s) - take the first one (should only be one)
            const newCard = newCards[0];
            
            if (newCard) {

              // === חשוב: אם מדובר בהדבקה (נמשך מהקופה והמספר זהה למה שנזרק) ===
              // אז *אסור* להסתיר את הקלף מהיד בשביל אנימציית משיכה,
              // אחרת השחקן רואה "חסר קלף" בדיוק בחלון ההדבקה.
              // === חשוב: אם השרת כבר אמר שיש הדבקה, אסור להסתיר את הקלף החדש מהיד ===
              // אחרת נראה "חסר קלף" לאורך חלון ההדבקה.
              const stickIdFromServer = stickCardIdRef.current;
              const isStickCardFromServer =
                !!stickIdFromServer && newCards.some(nc => nc.id === stickIdFromServer);

              // גיבוי: אם האירוע מהשרת הגיע אחרי ה-gameStateUpdated (נדיר), נזהה לפי רנק
              const isPotentialStickByRank =
                lastDrawSourceRef.current === 'deck' &&
                lastThrownRankForStickRef.current !== null &&
                newCard.rank === lastThrownRankForStickRef.current;

              console.log('=== Checking stick ===');
              console.log('newCard:', newCard.rank, newCard.suit);
              console.log('lastThrownRankForStickRef:', lastThrownRankForStickRef.current);
              console.log('lastDrawSourceRef:', lastDrawSourceRef.current);
              console.log('isStickCardFromServer:', isStickCardFromServer);
              console.log('isPotentialStickByRank:', isPotentialStickByRank);

              if (isStickCardFromServer || isPotentialStickByRank) {
                console.log('=== STICK DETECTED! ===');
                // משאירים את הקלף ביד כדי שניתן יהיה לסמן אותו בכחול ולהרים אותו
                setMyHand(sortedCards);
                previousHandRef.current = sortedCards;

                // אם עדיין אין stickCardId מהשרת (מקרה גיבוי) נגדיר אותו כאן
                if (!stickIdFromServer) {
                  stickCardIdRef.current = newCard.id;
                  setStickCardId(newCard.id);
                }

                isWaitingForNewCardRef.current = false;
                lastDrawSourceRef.current = null;
                lastThrownRankForStickRef.current = null;
                setIsAnimating(false);
                return;
              }

              console.log('=== NOT a stick card, running normal animation ===');
              // DON'T add the new card to hand yet - animate it first
              // Remove ALL new cards from the hand temporarily
              const handWithoutNewCard = sortedCards.filter(c => !newCards.some(nc => nc.id === c.id));
              setMyHand(sortHand(handWithoutNewCard));
              
              // Animate the new card coming to hand
              setIsAnimating(true);
              
              // הקלף שאני לוקח תמיד פתוח עבורי (כי אני השחקן שלקח אותו)
              // אחרים רואים את זה דרך animateOpponentMove עם הלוגיקה שלהם
              const drawAnim = {
                id: `draw-new-${newCard.id}-${Date.now()}`,
                startPos: lastDrawSourceRef.current === 'pile' ? PILE_POSITION : DECK_POSITION,
                endPos: HAND_POSITION,
                card: newCard,
                isFaceDown: false, // אני תמיד רואה את הקלף שלי פתוח
                delay: 0
              };
              setAnimatingCards(prev => [...prev, drawAnim]);
              setDiscardPile(prev => prev.filter(c => c.id !== newCard.id));
              if (sfxOn) playPick(true);
              
              // Add card to hand AFTER animation completes
              setTimeout(() => {

                setMyHand(prev => {
                  const updated = sortHand([...prev, newCard]);
                  previousHandRef.current = updated;
                  return updated;
                });
                setAnimatingCards(prev => prev.filter(a => a.id !== drawAnim.id));
                setIsAnimating(false);
                isWaitingForNewCardRef.current = false;
                lastDrawSourceRef.current = null;
                lastThrownRankForStickRef.current = null;
              }, 800);
              
              return; // Don't update previousHandRef yet - wait for animation
            }
          }
          
          // If we were waiting but didn't find the card, clear the flag and update normally

          isWaitingForNewCardRef.current = false;
          lastDrawSourceRef.current = null;
          lastThrownRankForStickRef.current = null;
        }
        
        // No new card or no animation needed - update normally
        setMyHand(sortedCards);
        previousHandRef.current = sortedCards;
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

        // רק אם יש אנימציה פעילה - דחה את העדכון
        const hasActiveAnimation = isThrowingCardsRef.current || isAiAnimatingRef.current;
        
        if (hasActiveAnimation) {

          pendingDiscardPileRef.current = pile;
          pendingDiscardGroupRef.current = (gameState.lastDiscardGroup ?? []).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value })) as Card[];
        } else {
          // אין אנימציה פעילה - עדכן מיד

          setDiscardPile(pile);
          setLastDiscardGroup((gameState.lastDiscardGroup ?? []).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, value: c.value })) as Card[]);
        }
      }
      
      // Update deck count
      setDeckCount(gameState.deckCount);
      
      // Update opponents - completely rebuild from server state
      const serverPlayers = gameState.players.filter(p => p.odId !== myServerPlayerId.current);
      // Calculate positions dynamically based on actual opponent count from server
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
      // If turn changed and we were throwing cards, apply pending update if exists
      if (isThrowingCardsRef.current && pendingDiscardPileRef.current) {

        setDiscardPile(pendingDiscardPileRef.current);
        pendingDiscardPileRef.current = null;
        if (pendingDiscardGroupRef.current) {
          setLastDiscardGroup(pendingDiscardGroupRef.current);
          pendingDiscardGroupRef.current = null;
        }
      }
      
      // IMPORTANT: Reset isThrowingCardsRef if turn changed (animation should be done by now)
      // This prevents "Not your turn" errors when user tries to make a move
      if (isThrowingCardsRef.current) {

        isThrowingCardsRef.current = false;
      }
      
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
      isShowingRoundSummaryRef.current = true; // דחה עדכונים עד שמסך הסיכום יסגר
      
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

      // Mark that game has ended
      gameEndedRef.current = true;
      
      // Cleanup all timers before leaving
      if (turnTimerIntervalRef.current) {
        clearInterval(turnTimerIntervalRef.current);
        turnTimerIntervalRef.current = null;
      }
      
      // Stop turn timer countdown
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      
      // Convert server final scores to game-over format
      const finalPlayers = finalScores.map((player, index) => {
        const isMe = player.odId === myServerPlayerId.current;
        return {
          id: isMe ? (user?.uid || 'me') : player.odId,
          name: isMe ? (profile?.username || 'אתה') : player.name,
          avatar: player.avatar,
          score: player.score,
          isMe: isMe,
        };
      });
      
      // המתנה 4 שניות לפני מעבר למסך הסיכום
      setTimeout(() => {
        hasLeftGameRef.current = true;
        router.replace({
          pathname: '/game-over',
          params: {
            players: JSON.stringify(finalPlayers),
            roomCode: params.roomCode as string | undefined,
            roomName: params.roomName as string | undefined,
            scoreLimit: params.scoreLimit as string | undefined,
            allowSticking: params.allowSticking as string | undefined,
          },
        });
      }, 4000);
    };
    
    // === הדבקה זמינה - השרת מודיע שניתן להדביק ===
    socketService.onStickingAvailable = (card, timeoutMs) => {
      stickCardIdRef.current = card.id;
      setStickCardId(card.id);
      
      // הקלף הוסתר באנימציה - הוסף אותו ליד מיד
      setMyHand(prev => {
        const cardExists = prev.some(c => c.id === card.id);
        if (cardExists) return prev;
        return sortHand([...prev, card]);
      });
      
      // עצור אנימציות רלוונטיות
      setAnimatingCards(prev => prev.filter(a => !a.id.includes(card.id)));
      setIsAnimating(false);
    };
    
    // === זמן ההדבקה נגמר ===
    socketService.onStickingExpired = () => {
      console.log('=== CLIENT: stickingExpired received ===');
      stickCardIdRef.current = null;
      setStickCardId(null);
    };
    
    socketService.onRoomClosed = (reason) => {
      setRoomClosedReason(reason);
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
      setErrorMessage('החיבור נכשל. חוזר ללובי...');
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
          endPos: PILE_POSITION,
          card: c as Card,
          delay: i * 50
        });
      });
      
      // משיכה מהערימה: הקלף יוצא מהערימה ומוצג פתוח – משתמשים בראש הערימה (השרת לא שולח ב-aiMove)
      const isAiPileDraw = drawFrom === 'pile';
      const aiTopOfPile = discardPileRef.current?.length ? discardPileRef.current[discardPileRef.current.length - 1] : null;
      const drawDelay = cardsThrown.length * 50 + 200;
      aiAnims.push({
        id: `ai-draw-${Date.now()}`,
        startPos: isAiPileDraw ? PILE_POSITION : DECK_POSITION,
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
          endPos: PILE_POSITION,
          card: c as Card,
          delay: i * 50
        });
      });
      const isPileDraw = drawFrom === 'pile' || drawFrom === 'pileFirst' || drawFrom === 'pileLast' || drawFrom === 'pileIndex' || drawFrom === 'pileCardId';
      // הקלף שנמשך חייב להיות זה שהיה בראש הערימה (לפני הזריקה), לא אחד מהקלפים שנזרקו
      const thrownIds = new Set(cardsThrown.map(c => c.id));
      const drawnCardOk = drawnCard && !thrownIds.has(drawnCard.id);
      const topOfPile = discardPileRef.current?.length ? discardPileRef.current[discardPileRef.current.length - 1] : null;
      const drawCard = isPileDraw
        ? (drawnCardOk ? drawnCard : (topOfPile ?? generateRandomCard()))
        : generateRandomCard();
      // משיכה מהערימה: הקלף יוצא מהערימה ומוצג פתוח עד ליד היריב
      const showFaceDown = !isPileDraw;
      const drawDelay = cardsThrown.length * 50 + 200;
      anims.push({
        id: `opp-draw-${Date.now()}`,
        startPos: isPileDraw ? PILE_POSITION : DECK_POSITION,
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

    // === אנימציית הדבקה (כאפה) - כל השחקנים רואים ===
    socketService.onStickPerformed = (playerId, card) => {
      const isMe = playerId === myServerPlayerId.current;
      
      // מחשבים מאיפה הקלף מתחיל
      let startPos: { x: number; y: number };
      if (isMe) {
        // אני עשיתי הדבקה - מהיד שלי (קצת למעלה כי הקלף מורם)
        startPos = { x: HAND_POSITION.x, y: HAND_POSITION.y - 25 };
        // מסירים את הקלף מהיד
        setMyHand(prev => prev.filter(c => c.id !== card.id));
        // מנקים את ה-state
        setStickCardId(null);
        if (stickTimerRef.current) {
          clearTimeout(stickTimerRef.current);
          stickTimerRef.current = null;
        }
      } else {
        // יריב עשה הדבקה - מהיד שלו
        const currentOpponents = opponentsRef.current;
        const opponent = currentOpponents.find(o => o.id === playerId);
        startPos = opponent ? getOpponentHandPosition(opponent.position) : PILE_POSITION;
      }
      
      // === אנימציית כאפה ===
      const ts = Date.now();
      const animUp = `slap-up-${ts}`;
      const animSlam = `slap-slam-${ts}`;
      
      // נקודה גבוהה מעל הערימה
      const highPoint = { 
        x: PILE_POSITION.x, 
        y: PILE_POSITION.y - (height * 0.3)
      };
      
      const UP_TIME = 350;
      const SLAM_TIME = 150;
      
      // שלב 1: עלייה מהיד למעלה
      setAnimatingCards(prev => [...prev, { 
        id: animUp, 
        startPos: startPos, 
        endPos: highPoint, 
        card: card, 
        delay: 0, 
        duration: UP_TIME, 
        arcHeight: -50,
        isSlam: false 
      }]);
      
      // שלב 2: נפילה חדה על הערימה
      setTimeout(() => {
        setAnimatingCards(prev => {
          const filtered = prev.filter(a => a.id !== animUp);
          return [...filtered, { 
            id: animSlam, 
            startPos: highPoint, 
            endPos: PILE_POSITION, 
            card: card, 
            delay: 0, 
            duration: SLAM_TIME, 
            arcHeight: 0,
            isSlam: true
          }];
        });
      }, UP_TIME);
      
      // שלב 3: צליל בדיוק ברגע הפגיעה
      setTimeout(() => {
        if (sfxOn) playStick(true);
      }, UP_TIME + SLAM_TIME);
      
      // שלב 4: ניקוי
      setTimeout(() => {
        setAnimatingCards(prev => prev.filter(a => a.id !== animSlam));
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
      () => (showChat ? chatMessages : chatMessages.filter(msg => msg.sender === 'אתה')),
      [showChat, chatMessages]
  );

  const opponentMessage = (name: string) => (showChat ? lastMessageByPlayer[name] : undefined);

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
      const id = `m-${Date.now()}`;
      setChatMessages(prev => [...prev, { id, sender: 'אתה', text: emoji }]);
      setLastMessageByPlayer(prev => ({ ...prev, 'אתה': emoji }));
      scheduleMessageClear('אתה');
      setChatOpen(false);
      if (isOnlineMode) {
          socketService.sendChatMessage(emoji);
      }
  };

  const sendChatMessage = () => {
      const trimmed = chatInput.trim();
      if (!trimmed) return;
      const id = `m-${Date.now()}`;
      setChatMessages(prev => [...prev, { id, sender: 'אתה', text: trimmed }]);
      setLastMessageByPlayer(prev => ({ ...prev, 'אתה': trimmed }));
      setChatInput('');
      scheduleMessageClear('אתה');
      setChatOpen(false);
      if (isOnlineMode) {
          socketService.sendChatMessage(trimmed);
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

      // קודם בודקים את הקלף העליון בערימה הנוכחית (לפני שה-AI זורק)
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
      // עכשיו יוצרים את הערימה החדשה אחרי זריקת ה-AI
      let nextDiscardPile = [...discardPile, ...discardGroup];
      
      let drawnCard: Card;
      let drawSource: 'pile' | 'deck' = 'deck';

      if (shouldTakeFromPile && discardPile.length > 0) {
          // לוקחים את הקלף שהיה למעלה לפני שה-AI זרק
          drawnCard = topDiscardBeforeThrow;
          // מסירים אותו מהערימה (הוא נמצא לפני הקלפים שה-AI זרק)
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
              endPos: PILE_POSITION,
              card: c,
              delay: i * 50
          });
      });
      aiAnims.push({
          id: `ai-draw-${drawnCard.id}-${Date.now()}`,
          startPos: drawSource === 'pile' ? PILE_POSITION : DECK_POSITION,
          endPos: opponentPos,
          card: drawnCard,
          isFaceDown: drawSource === 'deck', // מהערימה הפתוחה = פנים למעלה, מהחפיסה = הפוך
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
          setRoundEndWinner(assafPlayer?.name || 'יריב');
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
          setRoundEndWinner(winner?.name || 'יריב');
          setRoundEndWinnerId(winner?.id || '');
          setRoundEndCallerId(aiPlayer.id);
      } else {

          setRoundEndType('yaniv');
          setRoundEndWinner(aiPlayer.name);
          setRoundEndWinnerId(aiPlayer.id);
          setRoundEndCallerId(aiPlayer.id);
      }
  };

  // פונקציית חיתוך ניקוד - אם מגיעים בדיוק ל-50/100/150/200 הניקוד נחתך בחצי
  const applyScoreCut = (score: number): number => {
      const cutPoints = [50, 100, 150, 200];
      if (cutPoints.includes(score)) {
          return Math.floor(score / 2);
      }
      return score;
  };
  
  const handleRoundEndOverlayComplete = () => {
      // Prevent multiple calls
      if (roundEndHandledRef.current) return;
      roundEndHandledRef.current = true;
      
      // Stop and reset turn timer at round end
      setTurnSecondsLeft(TURN_DURATION_SECONDS);
      setTurnWarningShown(false);
      timeoutHandledRef.current = false;

      // Show revealed cards
      setCardsRevealed(true);
      
      // After delay, navigate to round summary
      setTimeout(() => {
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
                      totalScore: pr.newScore,
                      isEliminated: pr.isEliminated
                  })),
                  scoreLimit: SCORE_LIMIT
              };
              
              hasLeftGameRef.current = true;
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
              
              serverRoundResultRef.current = null;
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
                          totalScore: finalScore,
                          isEliminated: finalScore >= SCORE_LIMIT
                      };
                  })
              ];

              const roundResult: RoundResult = {
                  winner: { 
                      id: winnerId,
                      name: roundEndWinner,
                      type: roundEndType as 'yaniv' | 'assaf'
                  },
                  players: allPlayers,
                  scoreLimit: SCORE_LIMIT
              };

              hasLeftGameRef.current = true;
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
          }

          // Reset states
          setRoundEndType(null);
          setCardsRevealed(false);
          setRoundEndWinner('');
          setRoundEndWinnerId('');
          setRoundEndCallerId('');
      }, 3000);
  };

  const handleCardTap = (card: Card) => {
    // במצב הדבקה - לחיצה על קלפים ביד לא עושה כלום (חייב ללחוץ על הערימה!)
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
      // 1. הגנות
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
          const cardIdsToSend = [...selectedCardIds]; // Save before clearing
          // שומרים את הרנק האחרון שנזרק לצורך הדבקה (אם הקלף שיימשך מהקופה יהיה אותו רנק)
          lastThrownRankForStickRef.current = cardsToThrow.length > 0 ? cardsToThrow[cardsToThrow.length - 1].rank : null;
          
          // Create throw animations
          const newAnims: any[] = [];
          cardsToThrow.forEach((c, i) => {
              newAnims.push({
                  id: `throw-${c.id}-${Date.now()}-${i}`,
                  startPos: HAND_POSITION,
                  endPos: PILE_POSITION,
                  card: c,
                  delay: i * 50
              });
          });
          
          // Don't create draw animation here - server will send the real card
          // and onGameStateUpdated will handle the animation
          
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
          
          // Store draw source for animation when card arrives (כל משיכה מהערימה = פנים פתוחים)
          lastDrawSourceRef.current = (source === 'pileFirst' || source === 'pileLast' || source === 'pileIndex' || source === 'pileCardId') ? 'pile' : source;
          isWaitingForNewCardRef.current = true; // Flag that we're expecting a new card

          // Send to server (this will trigger immediate gameStateUpdated)
          socketService.throwCards(cardIdsToSend, source, source === 'pileIndex' ? pileIndex : undefined, source === 'pileCardId' ? pileCardId : undefined);
          
          // שמירת הקלפים שנזרקו לעדכון אופטימיסטי
          const thrownCardsForPile = [...cardsToThrow];
          
          setTimeout(() => {
              setAnimatingCards(prev => prev.filter(a => !a.id.startsWith('throw-') && !a.id.startsWith('draw-')));
              setIsAnimating(false);
              
              isThrowingCardsRef.current = false;
              isWaitingForNewCardRef.current = false;
              
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
          }, 800);
          
          return;
      }

      // === Offline mode: local logic ===
      setIsAnimating(true);
      const cardsToThrow = myHand.filter(c => selectedCardIds.includes(c.id));
      
      // שומרים את הרנק של הקלף שנזרק (לצורך הדבקות)
      const thrownRank = cardsToThrow[cardsToThrow.length - 1].rank;
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
         // לוקחים קלף מהחפיסה הראשית
         if (deckRef.current.length === 0 && discardPile.length > 1) {
             // החפיסה ריקה - מערבבים את ערימת הזריקה מחדש (פרט לקלף העליון)
             const topCard = discardPile[discardPile.length - 1];
             const cardsToReshuffle = discardPile.slice(0, -1);
             deckRef.current = shuffleArray(cardsToReshuffle);
             setDiscardPile([topCard]); // משאירים רק את הקלף העליון
             setDeckCount(deckRef.current.length); // מעדכנים אחרי הערבוב
         }
         
         if (deckRef.current.length > 0) {
             newCardToAdd = deckRef.current[0];
             deckRef.current = deckRef.current.slice(1);
             setDeckCount(deckRef.current.length); // מעדכנים מיד את התצוגה
         } else {
             // fallback אם גם אחרי הערבוב אין קלפים (מצב קיצוני)
         newCardToAdd = generateRandomCard();
         }
      }

      // האם יש הזדמנות להדבקה? (רק משיכה מהקופה ורנק זהה למה שנזרק)
      const willOfferStick = source === 'deck' && allowSticking && newCardToAdd.rank === thrownRank;

      // מסירים את הקלפים שנזרקו מהיד
      // חשוב: אם יש הדבקה, מוסיפים את הקלף החדש ליד *מיד* כדי שלא ייראה שחסר קלף.
      setMyHand(prev => {
          const handWithoutThrown = prev.filter(c => !selectedCardIds.includes(c.id));
          if (!willOfferStick) return handWithoutThrown;
          // הוספה מיידית של הקלף שנמשך (כדי לסמן בכחול ולהרים)
          return sortHand([...handWithoutThrown, newCardToAdd]);
      });
      setSelectedCardIds([]);

      // אם יש הדבקה - מסמנים מיידית ומתחילים חלון 2 שניות (בלי לחכות לסיום האנימציה)
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
      
      // אנימציית זריקה
      cardsToThrow.forEach((c, i) => {
          newAnims.push({ id: `throw-${c.id}`, startPos: HAND_POSITION, endPos: PILE_POSITION, card: c, delay: i * 50 });
      });

      // אנימציית משיכה - רק אם אין הדבקה!
      // במצב הדבקה הקלף כבר ביד (הוספנו אותו למעלה) ומוצג עם סגנון כחול מורם
      if (!willOfferStick) {
          newAnims.push({
              id: `draw-${newCardToAdd.id}`, startPos: isPileSource ? PILE_POSITION : DECK_POSITION, endPos: HAND_POSITION, card: newCardToAdd, isFaceDown: false, delay: 200
          });
      }
      if (isPileSource && pileTakeIndex !== null) {
          setDiscardPile(prev => prev.filter((_, i) => i !== pileTakeIndex));
      }
      setAnimatingCards(prev => [...prev, ...newAnims]);
      if (sfxOn) playFlick(true);
      if (!willOfferStick && sfxOn) setTimeout(() => playPick(true), 200);
      
      setTimeout(() => {
          setDiscardPile(prev => [...prev, ...cardsToThrow]);
          setLastDiscardGroup(cardsToThrow);
          
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
      }, 1000);
  };
  
  // === ביצוע הדבקה (לחיצה על הערימה במצב הדבקה) ===
  const performStick = () => {
      if (!stickCardId) return;
      
      // מוצאים את הקלף להדבקה
      const cardToStick = myHand.find(c => c.id === stickCardId);
      if (!cardToStick) return;
      
      // מנקים טיימר
      if (stickTimerRef.current) {
          clearTimeout(stickTimerRef.current);
          stickTimerRef.current = null;
      }
      
      // === Online mode ===
      if (isOnlineMode) {
          socketService.stick();
          return;
      }
      
      // === Offline mode - אנימציה מקומית ===
      const card = { ...cardToStick };
      
      // מנקים state
      setStickCardId(null);
      
      // מסירים מהיד
      setMyHand(prev => prev.filter(c => c.id !== card.id));
      
      // אנימציית כאפה
      const ts = Date.now();
      const animUp = `slap-up-${ts}`;
      const animSlam = `slap-slam-${ts}`;
      
      const startPos = { x: HAND_POSITION.x, y: HAND_POSITION.y - 25 };
      const highPoint = { x: PILE_POSITION.x, y: PILE_POSITION.y - (height * 0.3) };
      
      const UP_TIME = 350;
      const SLAM_TIME = 150;
      
      // עלייה
      setAnimatingCards(prev => [...prev, { 
          id: animUp, startPos, endPos: highPoint, card, 
          delay: 0, duration: UP_TIME, arcHeight: -50, isSlam: false 
      }]);
      
      // נפילה
      setTimeout(() => {
          setAnimatingCards(prev => {
              const filtered = prev.filter(a => a.id !== animUp);
              return [...filtered, { 
                  id: animSlam, startPos: highPoint, endPos: PILE_POSITION, card, 
                  delay: 0, duration: SLAM_TIME, arcHeight: 0, isSlam: true 
              }];
          });
      }, UP_TIME);
      
      // צליל בנחיתה
      setTimeout(() => {
          if (sfxOn) playStick(true);
      }, UP_TIME + SLAM_TIME);
      
      // ניקוי ועדכון
      setTimeout(() => {
          setAnimatingCards(prev => prev.filter(a => a.id !== animSlam));
          setDiscardPile(prev => [...prev, card]);
          setLastDiscardGroup([card]);
          setLastDiscardedRank(null);
          advanceTurn();
      }, UP_TIME + SLAM_TIME + 150);
  };
  
  // === לחיצה על הערימה הפתוחה ===
  const handlePilePress = (pick: 'first' | 'last' | number | string = 'last') => {
      // אם יש הדבקה זמינה - לחיצה על הערימה מבצעת הדבקה!
      if (stickCardId) {
          performStick();
          return;
      }
      // אחרת - מהלך רגיל: first/last לרצף, cardId לזוג/שלישייה/רביעייה (הקלף עליו לחצו)
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

      {opponentsWithTurn.map((opponent, idx) => {
          // בדיקה שהשחקן קיים לפני רינדור
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
          // חישוב כמות שחקנים כוללת
          const playerCount = opponentsWithTurn.length + 1;
          
          return (
              <View key={opponent.id || `opponent-${idx}`} style={positionStyle}>
                  <PlayerView
                      player={opponent}
                      isLeader={Boolean(hasLeader && (opponent.totalScore ?? 0) === minScore)}
                      turnSecondsLeft={turnSecondsLeft}
                      turnDurationSeconds={TURN_DURATION_SECONDS}
                      lastMessage={opponentMessage(opponent.name || '') || undefined}
                      revealedCards={cardsRevealed && opponent.cards && Array.isArray(opponent.cards) ? opponent.cards : undefined}
                      playerCount={playerCount}
                      position={opponentPosition}
                  />
              </View>
          );
      })}

      <View style={styles.centerTable}>
          <View style={[styles.discardAreaWrapper, { width: MAX_DISCARD_CONTAINER_WIDTH }]}>
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

      {animatingCards.map(anim => <FlyingCard key={anim.id} {...anim} />)}

      <RoundEndOverlay type={roundEndType} winnerName={roundEndWinner} onComplete={handleRoundEndOverlayComplete} />

      {leaveConfirmOpen && (
          <View style={styles.leaveConfirmOverlay}>
              <View style={styles.leaveConfirmCard}>
                  <Text style={styles.leaveConfirmTitle}>לעזוב משחק?</Text>
                  <Text style={styles.leaveConfirmText}>האם אתה בטוח שתרצה לצאת מהמשחק?</Text>
                  <View style={styles.leaveConfirmActions}>
                      <Pressable style={styles.leaveCancelButton} onPress={() => setLeaveConfirmOpen(false)}>
                          <Text style={styles.leaveCancelText}>ביטול</Text>
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
                          <Text style={styles.leaveExitText}>יציאה</Text>
                      </Pressable>
                  </View>
              </View>
          </View>
      )}

      {roomClosedReason && (
          <View style={styles.leaveConfirmOverlay}>
              <View style={styles.leaveConfirmCard}>
                  <Text style={styles.leaveConfirmTitle}>המשחק נסגר</Text>
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
                          <Text style={styles.leaveExitText}>חזרה ללובי</Text>
                      </Pressable>
                  </View>
              </View>
          </View>
      )}

      {isReconnecting && (
          <View style={styles.reconnectingOverlay}>
              <View style={styles.reconnectingCard}>
                  <ActivityIndicator size="large" color="#5B8A72" />
                  <Text style={styles.reconnectingTitle}>מתחבר מחדש...</Text>
                  <Text style={styles.reconnectingText}>אנא המתן</Text>
              </View>
          </View>
      )}

      {errorMessage && (
          <View style={styles.errorOverlay}>
              <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>שגיאה</Text>
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
                      <Text style={styles.errorButtonText}>סגור</Text>
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
              <Text style={styles.settingsTitle}>הגדרות משחק</Text>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>מוזיקה</Text>
                  <Switch value={musicOn} onValueChange={setMusicOn} thumbColor={musicOn ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>צלילים</Text>
                  <Switch value={sfxOn} onValueChange={setSfxOn} thumbColor={sfxOn ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
              <View style={styles.settingsRow}>
                  <Text style={styles.settingsLabel}>הסתר הודעות אחרים</Text>
                  <Switch value={showChat} onValueChange={setShowChat} thumbColor={showChat ? '#22C55E' : '#6B7280'} trackColor={{ false: '#374151', true: '#16A34A' }} />
              </View>
              <Text style={styles.settingsHint}>עוד בהמשך: מהירות אנימציה, סגנון קלפים, מצב חיסכון בסוללה</Text>
          </View>
      )}

      <Pressable style={styles.chatToggle} onPress={() => setChatOpen(prev => !prev)}>
          <Text style={styles.chatToggleText}>💬</Text>
      </Pressable>

      {chatOpen && (
          <View style={styles.chatPanel}>
              <View style={styles.chatHeader}>
                  <Text style={styles.chatTitle}>צ׳אט</Text>
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
                      <View key={msg.id} style={[styles.chatBubble, msg.sender === 'אתה' ? styles.chatBubbleMe : styles.chatBubbleOther]}>
                          <Text style={styles.chatBubbleText}>{msg.text}</Text>
                      </View>
                  ))}
              </ScrollView>
              <View style={styles.chatInputRow}>
                  <TextInput
                      value={chatInput}
                      onChangeText={setChatInput}
                      placeholder="כתוב הודעה..."
                      placeholderTextColor="#9CA3AF"
                      style={styles.chatInput}
                      onSubmitEditing={sendChatMessage}
                      returnKeyType="send"
                  />
                  <Pressable style={styles.chatSendButton} onPress={sendChatMessage}>
                      <Text style={styles.chatSendText}>שלח</Text>
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

      <View style={styles.myArea}>
           <View style={{marginBottom: 6}}>
               {myPlayer ? (
                   <PlayerView
                       player={myPlayer}
                       isMe
                       isLeader={Boolean(hasLeader && myScore === minScore)}
                       handValue={myHandValue}
                       turnSecondsLeft={turnSecondsLeft}
                       turnDurationSeconds={TURN_DURATION_SECONDS}
                       lastMessage={lastMessageByPlayer[myPlayer.name || ''] || undefined}
                       playerCount={opponentsWithTurn.length + 1}
                   />
               ) : null}
           </View>
           {canCallYaniv && !roundEndType && (
               <Pressable style={styles.tropicalYanivButton} onPress={handleYaniv}>
                   <LinearGradient colors={['#D4A574', '#B8956A', '#8B7355']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.tropicalYanivGradient}>
                       <Text style={styles.tropicalYanivText}>🌴 יניב! 🌴</Text>
                   </LinearGradient>
               </Pressable>
           )}
           {/* אינדיקטור הדבקה - לחץ על הערימה! */}
           {stickCardId && (
               <View style={styles.stickIndicator}>
                   <Text style={styles.stickIndicatorText}>👆 לחץ על הערימה להדבקה!</Text>
               </View>
           )}
           <View style={styles.handContainer}>
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
  
  // כפתורים בסגנון עץ
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
  
  // קלפים עם תמונות
  cardImageContainer: { 
      borderRadius: 10, 
      overflow: 'hidden', 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 3 }, 
      shadowOpacity: 0.3, 
      shadowRadius: 4, 
      elevation: 5,
      backgroundColor: 'transparent',
  },
  cardImage: { 
      width: '100%', 
      height: '100%', 
      borderRadius: 10,
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
  
  cornerContainer: { alignItems: 'center', justifyContent: 'center', minWidth: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', marginBottom: -2, textAlign: 'center' },
  
  cardBackContainer: { borderRadius: 8, borderWidth: 2, borderColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cardBackInnerBorder: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: 'rgba(254, 243, 199, 0.3)', borderRadius: 4 },
  patternGrid: { position: 'absolute', opacity: 0.15, flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 },
  patternDot: { width: 6, height: 6, backgroundColor: '#FEF3C7', transform: [{rotate: '45deg'}] },
  backLogoText: { fontFamily: Platform.OS === 'ios' ? 'serif' : 'notoserif', fontWeight: '900', color: '#FEF3C7', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: {width:1, height:1}, textShadowRadius: 3 },
  backSubText: { color: 'rgba(254, 243, 199, 0.8)', fontWeight: 'bold', letterSpacing: 1, fontSize: 8 },
  
  // === עיצוב קלפים עץ חקוק ===
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
  
  // פסי עץ - טקסטורה
  woodGrainOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  woodGrainLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: '#A08060' },
  
  // פינות קלף עץ
  woodenCornerTopLeft: { position: 'absolute', top: 8, left: 10, zIndex: 10 },
  woodenCornerBottomRight: { position: 'absolute', bottom: 8, right: 10, zIndex: 10 },
  woodenRankText: { 
      fontWeight: '900', 
      fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', 
      textShadowColor: 'rgba(180, 150, 100, 0.5)', 
      textShadowOffset: {width: 1, height: 1}, 
      textShadowRadius: 1,
  },
  
  // סמל באמצע - חקוק
  woodenCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // סמלים חקוקים
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
  
  // תאימות לאחור - סטיילים ישנים
  tropicalCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width:0, height:3}, shadowOpacity:0.3, shadowRadius:4, elevation: 5 },
  tropicalCardBg: { flex: 1, borderRadius: 12, padding: 6, position: 'relative' },
  tropicalCornerTopLeft: { position: 'absolute', top: 6, left: 8 },
  tropicalCornerBottomRight: { position: 'absolute', bottom: 6, right: 8 },
  tropicalRankText: { fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 2 },
  tropicalCenterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tropicalSuitContainer: { padding: 8, borderRadius: 8 },
  
  playerWrapper: { alignItems: 'center', position: 'relative', width: 150 },
  playerWrapperCompact: { width: 130 },
  
  // סטיילים ליריבים בצדדים (מניפה אנכית)
  sidePlayerWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', height: 180 },
  sidePlayerLeft: { },
  sidePlayerRight: { },
  sidePlayerContent: { alignItems: 'center' },
  verticalFanContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  verticalFanContainerSide: { height: 120, width: 60, alignItems: 'center', justifyContent: 'center' },
  sidePlayerInfo: { alignItems: 'center', zIndex: 10 },
  
  // סגנונות קטנים ליריבי צדדים
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
  // הודעות צ'אט ליריבים בצדדים
  sidePlayerMessageBubble: { position: 'absolute', backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#374151', maxWidth: 140, zIndex: 50 },
  sideMessageLeft: { left: 70, top: -20 }, // הודעה מימין לשחקן השמאלי
  sideMessageRight: { right: 70, top: -20 }, // הודעה משמאל לשחקן הימני
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
  
  // יריב למעלה - קלפים למעלה, לוגו+שם למטה
  topOpponentWrapper: { alignItems: 'center', flexDirection: 'column' },
  topOpponentFanContainer: { height: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  topOpponentInfoBelow: { alignItems: 'center' },
  
  // מיקומי יריבים (מתואמים ל-OPP_TOP_POSITION, OPP_LEFT_POSITION, OPP_RIGHT_POSITION)
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
  yanivButton: { marginBottom: 10 },
  yanivGradient: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 22, borderWidth: 2, borderColor: '#FCD34D' },
  yanivText: { color: 'white', fontWeight: '900', fontSize: 15 },
  
  // כפתור יניב טרופי
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
  
  // Round end overlay – כמו פופ־אפים אחרים (leaveConfirm, errorCard)
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
  
  // Sticking button styles - סגנון טרופי
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